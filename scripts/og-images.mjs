// Renders one 1200x630 OG image per page into public/og/<slug>.png (Vite copies it to /tools/watermark/og/).
//
//   node scripts/og-images.mjs        (runs as part of npm run build)
//
// Each image comes from scripts/og-template.html, rendered by headless Chrome through
// puppeteer-core. The PNGs carry their provenance in tEXt chunks (Comment, Software, Title).
// Needs Chrome or Chromium: set CHROME_PATH if it is not in a usual place. The PNGs in public/og/
// are kept in the repo, so without a browser (a CI runner, say) the script keeps them, warns about
// any page that has none, and exits 0 so the build still runs.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import puppeteer from 'puppeteer-core';
import { serveDir } from './static-server.mjs';
import { loadPages } from './build-pages.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'og');
const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
].filter(Boolean).find((p) => fs.existsSync(p));

// PNG tEXt chunk: keyword, NUL, Latin-1 text, with the CRC over type + data.
function textChunk(keyword, text) {
  const data = Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0]), Buffer.from(text.replace(/[^\x20-\x7e\xa0-\xff]/g, '?'), 'latin1')]);
  const type = Buffer.from('tEXt', 'latin1');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([type, data])) >>> 0);
  return Buffer.concat([len, type, data, crc]);
}
function withText(png, entries) {
  const afterIhdr = 8 + 4 + 4 + png.readUInt32BE(8) + 4;
  return Buffer.concat([png.subarray(0, afterIhdr), ...entries.map(([k, v]) => textChunk(k, v)), png.subarray(afterIhdr)]);
}

const pages = loadPages();
fs.mkdirSync(OUT, { recursive: true });

function keepExisting(reason) {
  const missing = pages.filter((p) => !fs.existsSync(path.join(OUT, `${p.slug}.png`)));
  console.warn(`og-images: ${reason}. Skipped rendering and kept the images already in public/og/.`);
  if (missing.length) console.warn(`og-images: WARNING, these pages have no OG image yet: ${missing.map((p) => p.slug).join(', ')}. Run npm run og on a machine with Chrome.`);
  process.exit(0);
}

if (!CHROME) keepExisting('no Chrome or Chromium found (set CHROME_PATH to use one)');

const server = await serveDir(ROOT);
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'markdrift-og-')),
    // Linux CI runners often can't start Chrome's sandbox
    args: process.platform === 'linux' ? ['--no-sandbox'] : [],
  });
} catch (e) {
  await server.close();
  keepExisting(`could not start ${CHROME} (${String(e.message).split(/\r?\n/)[0]})`);
}
const version = await browser.version();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.goto(`${server.url}/scripts/og-template.html`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.ogReady === true);
  for (const p of pages) {
    const mode = p.type === 'tool' ? (p.preset.mode || 'combo') : 'combo';
    const kind = p.type === 'tool' ? (p.preset.kind || 'text') : 'text';
    await page.evaluate((o) => window.renderOg(o), { h1: p.h1, mode, kind });
    const png = Buffer.from(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } }));
    fs.writeFileSync(path.join(OUT, `${p.slug}.png`), withText(png, [
      ['Title', p.h1],
      ['Comment', 'rendered from scripts/og-template.html by headless Chrome'],
      ['Software', `${version} via puppeteer-core`],
    ]));
  }
  if (errors.length) throw new Error('og-template.html: ' + errors.join(' | '));
  // drop images of pages that no longer exist
  const keep = new Set(pages.map((p) => `${p.slug}.png`));
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png') && !keep.has(f)) fs.rmSync(path.join(OUT, f));
  console.log(`og-images: ${pages.length} images written to public/og/ (${version})`);
} finally {
  await browser.close();
  await server.close();
}
