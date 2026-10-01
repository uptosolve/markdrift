// Captures the review screenshots into docs/ (and .impeccable/review/ for the design review).
//   npm run screenshots
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { buildPages } from '../../scripts/build-pages.mjs';

const root = path.resolve(import.meta.dirname, '../..');
buildPages({ quiet: true });
const server = await createServer({ configFile: path.join(root, 'vite.config.js'), logLevel: 'error', server: { port: 5194, strictPort: false } });
await server.listen();
// the app screenshots use the main tool page
const url = new URL('watermark-video/', server.resolvedUrls.local[0]).href;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ui-')) });
const errors = [];
const review = path.join(root, '.impeccable/review');
fs.mkdirSync(review, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function shot(name, { vp = DESKTOP, files = [], exporting = false, scroll = null, reviewName = null }) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
  await page.setViewport(vp);
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__markdrift && document.fonts.status === 'loaded');
  await page.evaluate(async (files, exporting) => {
    localStorage.clear();
    const md = window.__markdrift;
    const t = document.querySelector('[data-key=text]');
    t.value = '@abdulla_al_maruf';
    t.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('input[value=bounce]').click();
    if (!files.length) return;
    const ld = async ([p, type]) => new File([await (await fetch('/__media?name=' + p)).blob()], p, { type });
    await md.handleFiles(await Promise.all(files.map(ld)));
    await new Promise((r) => setTimeout(r, 400));
    const v = document.getElementById('video');
    if (v.src) { v.currentTime = 3.4; await new Promise((r) => { v.onseeked = r; setTimeout(r, 1500); }); }
    if (exporting) {
      // a folder that accepts writes, so the batch runs the real way
      md.state.testDir = {
        name: 'Watermarked',
        async getFileHandle(n, o) { if (!o) throw new DOMException('', 'NotFoundError'); return { createWritable: async () => new WritableStream({}) }; },
        async removeEntry() {},
      };
      document.getElementById('exportBtn').click();
      // catch it part-way: the long third video keeps the batch running while we capture
      while (!(md.state.videos[1]?.status === 'done' && md.state.videos[2]?.status === 'working' && md.state.videos[2].progress > 0.2)) {
        await new Promise((r) => setTimeout(r, 15));
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }, files, exporting);
  if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
  if (!exporting) await new Promise((r) => setTimeout(r, 700));
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (sw > 0) errors.push(name + ': horizontal overflow ' + sw + 'px');
  const out = path.join(root, 'docs', name + '.png');
  await page.screenshot({ path: out });
  if (reviewName) fs.copyFileSync(out, path.join(review, reviewName));
  await page.close();
}

const BATCH = [['landscape-1080p.mp4', 'video/mp4'], ['phone-rotated.mp4', 'video/mp4'], ['clip.webm', 'video/webm'], ['pcm-audio.mov', 'video/quicktime']];

await shot('ui-empty', { reviewName: 'desktop.png' });
await shot('ui-video', { files: [BATCH[0]], reviewName: 'desktop-loaded.png' });
await shot('ui-batch', { files: BATCH, reviewName: 'desktop-batch.png' });
await shot('ui-exporting', { files: [BATCH[0], BATCH[1], ['long-3min.mp4', 'video/mp4'], BATCH[2]], exporting: true, reviewName: 'desktop-exporting.png' });
await shot('ui-mobile', { vp: PHONE, reviewName: 'mobile.png' });
await shot('ui-mobile-loaded', { vp: PHONE, files: BATCH, scroll: 900, reviewName: 'mobile-loaded-scrolled.png' });

console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
await server.close();
