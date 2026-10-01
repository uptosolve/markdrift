// End-to-end test: starts the dev server, runs tests/e2e/suite.js in real browsers,
// then checks every exported file with ffprobe/ffmpeg.
//
//   npm run e2e                 # all browsers found on this machine
//   npm run e2e -- chrome       # just one (chrome | edge | firefox)
//
// Needs ffmpeg + ffprobe on PATH and test media in test-media/ (npm run make-test-media).

import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { unzipSync } from 'fflate';
import { buildPages } from '../../scripts/build-pages.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'test-media/out');

const BROWSERS = {
  chrome: { browser: 'chrome', paths: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'] },
  edge: { browser: 'chrome', paths: ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'] },
  firefox: { browser: 'firefox', paths: ['C:/Program Files/Mozilla Firefox/firefox.exe', '/Applications/Firefox.app/Contents/MacOS/firefox', '/usr/bin/firefox'] },
};

const wanted = process.argv.slice(2).filter((a) => BROWSERS[a]);
// Edge uses the same engine as Chrome and often refuses automation while it runs in the background
const targets = (wanted.length ? wanted : ['chrome', 'firefox'])
  .map((name) => ({ name, ...BROWSERS[name], exe: BROWSERS[name].paths.find((p) => fs.existsSync(p)) }))
  .filter((b) => b.exe);

function probe(file) {
  const json = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,nb_frames:format=duration', '-of', 'json', file]);
  return JSON.parse(json);
}

function decodeErrors(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
  return (r.stderr || '').trim();
}

const SOURCES = {
  'bounce-1080.mp4': 'landscape-1080p.mp4',
  'jump-1080.mp4': 'landscape-1080p.mp4',
  'tile-rotated.mp4': 'phone-rotated.mp4',
  'combo-webm.mp4': 'clip.webm',
  'fixed-pcm.mp4': 'pcm-audio.mov',
  'bounce-mkv.mp4': 'clip.mkv',
  'logo.mp4': 'clip.webm',
};

function checkVideo(out, srcName) {
  const file = path.join(outDir, out);
  const src = probe(path.join(root, 'test-media', srcName));
  const got = probe(file);
  const v = got.streams.find((s) => s.codec_type === 'video');
  const a = got.streams.find((s) => s.codec_type === 'audio');
  const sv = src.streams.find((s) => s.codec_type === 'video');
  const problems = [];
  if (!v) problems.push('no video stream');
  else {
    if (v.codec_name !== 'h264') problems.push(`video codec ${v.codec_name}`);
    const rotated = srcName.includes('rotated');
    const [ew, eh] = rotated ? [sv.height, sv.width] : [sv.width, sv.height];
    if (v.width !== ew || v.height !== eh) problems.push(`size ${v.width}x${v.height}, expected ${ew}x${eh}`);
  }
  if (!a) problems.push('no audio stream');
  else if (!['aac', 'mp3', 'opus'].includes(a.codec_name)) problems.push(`audio codec ${a.codec_name}`);
  const d = Math.abs(+got.format.duration - +src.format.duration);
  if (d > 0.15) problems.push(`duration off by ${d.toFixed(2)}s`);
  const errs = decodeErrors(file);
  if (errs) problems.push('decode errors: ' + errs.split('\n')[0]);
  return { problems, info: `${v?.codec_name} ${v?.width}x${v?.height} ${v?.nb_frames}f, audio ${a?.codec_name}` };
}

function checkFile(out) {
  const file = path.join(outDir, out);
  if (out.endsWith('.zip')) {
    const entries = Object.keys(unzipSync(fs.readFileSync(file)));
    return { problems: entries.length === 3 ? [] : [`zip has ${entries.length} files`], info: entries.join(', ') };
  }
  const got = probe(file).streams[0];
  return { problems: got?.width ? [] : ['not an image'], info: `${got?.codec_name} ${got?.width}x${got?.height}` };
}

// the pages in site/ are generated from content/; make sure they exist and are current
buildPages({ quiet: true });
const server = await createServer({ configFile: path.join(root, 'vite.config.js'), logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
// the app runs on every tool page; the main one is /tools/watermark/ itself
const url = server.resolvedUrls.local[0];
// suite.js lives outside the site root (site/), so the page loads it through Vite's /@fs/ route
const suiteUrl = encodeURI(server.config.base + '@fs/' + path.join(root, 'tests/e2e/suite.js').split(path.sep).join('/').replace(/^\//, ''));
let failed = 0;

try {
  for (const t of targets) {
    console.log(`\n=== ${t.name} (${t.exe})`);
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdrift-e2e-'));
    // the whole suite runs in one call; Firefox encodes slower, so allow plenty of time
    const browser = await puppeteer.launch({ browser: t.browser, executablePath: t.exe, headless: true, userDataDir, protocolTimeout: 900_000 });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__markdrift);
    const report = await page.evaluate(async (prefix, suiteUrl) => {
      const { runSuite } = await import(suiteUrl);
      return runSuite(prefix);
    }, t.name, suiteUrl);
    await browser.close();

    for (const r of report.results) {
      let problems = r.ok ? [] : [r.error];
      let info = r.text || '';
      if (r.ok && r.outs) {
        const lines = [];
        for (const o of r.outs) {
          const c = checkVideo(o.out, o.src);
          problems.push(...c.problems.map((p) => `${o.out}: ${p}`));
          lines.push(c.info);
        }
        info = `${r.outs.length} files ok (${lines.map((l) => l.split(',')[0]).join(' | ')})`;
      } else if (r.ok && r.out) {
        if (!r.size) problems.push('export failed: ' + r.text);
        else {
          const key = r.out.slice(t.name.length + 1);
          const c = SOURCES[key] ? checkVideo(r.out, SOURCES[key]) : checkFile(r.out);
          problems = c.problems;
          info = `${c.info} (${r.secs}s)`;
        }
      }
      if (problems.length) failed++;
      console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${r.name.padEnd(34)} ${problems.length ? problems.join('; ') : info}`);
    }
    if (errors.length) { failed++; console.log('page errors:', [...new Set(errors)].join(' | ')); }
  }
} finally {
  await server.close();
}

if (!targets.length) { console.log('No supported browser found.'); process.exit(1); }
console.log(failed ? `\n${failed} problem(s)` : '\nall good');
process.exit(failed ? 1 : 0);
