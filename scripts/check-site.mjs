// Checks the built site in dist/ the way it will be served (dist/ mounted at "/").
//
//   npm run build && npm run check-site          (add --shots to also write docs/site-*.png)
//
// Every page: 200, exactly one <h1>, a unique <title> and description, a canonical, an og:image
// that exists and is a 1200x630 PNG, and JSON-LD that parses. The sitemap lists exactly the pages,
// a bad path gets the 404 page with status 404, no page scrolls sideways at 390px, and on a
// 1440x900 desktop the tool (stage and save button) is fully in view with the H1 above it.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { serveDir } from './static-server.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ORIGIN = 'https://uptosolve.com';
const SHOTS = process.argv.includes('--shots');
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .filter(Boolean).find((p) => fs.existsSync(p));

const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/.meta/pages.json'), 'utf8'));
const problems = [];
const bad = (msg) => problems.push(msg);
const server = await serveDir(DIST);
const local = (u) => server.url + u.replace(ORIGIN, '');
const attr = (html, re) => (html.match(re) || [])[1];

const rows = [];
const titles = new Map();
const descriptions = new Map();
for (const p of pages) {
  const res = await fetch(local(p.path));
  const html = await res.text();
  const row = { path: p.path, status: res.status };
  if (res.status !== 200) bad(`${p.path}: status ${res.status}`);
  row.h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (row.h1 !== 1) bad(`${p.path}: ${row.h1} <h1> elements`);
  const title = attr(html, /<title>([^<]*)<\/title>/);
  const desc = attr(html, /<meta name="description" content="([^"]*)"/);
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  const og = attr(html, /<meta property="og:image" content="([^"]*)"/);
  if (!title) bad(`${p.path}: no title`);
  if (!desc) bad(`${p.path}: no description`);
  if (titles.has(title)) bad(`${p.path}: same title as ${titles.get(title)}`); else titles.set(title, p.path);
  if (descriptions.has(desc)) bad(`${p.path}: same description as ${descriptions.get(desc)}`); else descriptions.set(desc, p.path);
  if (canonical !== ORIGIN + p.path) bad(`${p.path}: canonical is ${canonical}`);
  if (!/<html lang="en">/.test(html)) bad(`${p.path}: no lang="en"`);
  for (const k of ['og:title', 'og:description', 'og:url']) if (!html.includes(`property="${k}"`)) bad(`${p.path}: no ${k}`);
  for (const k of ['twitter:card', 'twitter:title', 'twitter:image']) if (!html.includes(`name="${k}"`)) bad(`${p.path}: no ${k}`);
  if (!og) bad(`${p.path}: no og:image`);
  else {
    const img = await fetch(local(og));
    const buf = Buffer.from(await img.arrayBuffer());
    const isPng = buf.subarray(1, 4).toString() === 'PNG';
    row.og = isPng ? `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}` : `status ${img.status}`;
    if (img.status !== 200 || !isPng || row.og !== '1200x630') bad(`${p.path}: og:image ${og} is ${row.og}`);
    if (!buf.includes('rendered from scripts/og-template.html by headless Chrome')) bad(`${p.path}: og:image has no provenance text`);
  }
  row.jsonld = [];
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(json);
      const types = (data['@graph'] || [data]).map((n) => n['@type']);
      row.jsonld.push(...types);
      if (JSON.stringify(data).match(/aggregateRating|"review"|ratingValue/i)) bad(`${p.path}: JSON-LD has a rating`);
      const want = { tool: 'WebApplication', guide: 'Article' }[p.type];
      if (want && !types.includes(want)) bad(`${p.path}: JSON-LD has no ${want}`);
      if (!types.includes('BreadcrumbList')) bad(`${p.path}: JSON-LD has no BreadcrumbList`);
    } catch (e) { bad(`${p.path}: JSON-LD does not parse (${e.message})`); }
  }
  if (!row.jsonld.length) bad(`${p.path}: no JSON-LD`);
  // every link to another page of the site must resolve
  for (const [, href] of html.matchAll(/href="(\/tools\/[^"#]*)"/g)) {
    if (/\.(css|js|svg|woff2|png)$/.test(href)) continue;
    if (!pages.some((q) => q.path === href)) bad(`${p.path}: links to ${href}, which is not a page`);
  }
  rows.push(row);
}

// sitemap
const sm = await fetch(server.url + '/tools/sitemap.xml');
const smText = await sm.text();
const locs = [...smText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
const want = pages.map((p) => ORIGIN + p.path).sort();
const sitemapOk = sm.status === 200 && JSON.stringify(locs) === JSON.stringify(want);
if (!sitemapOk) bad(`sitemap lists ${locs.length} URLs, expected exactly the ${want.length} pages`);
for (const p of pages) if (!smText.includes(`<loc>${ORIGIN + p.path}</loc>\n    <lastmod>${p.updated}</lastmod>`)) bad(`sitemap: ${p.path} has no lastmod ${p.updated}`);

// 404
const miss = await fetch(server.url + '/tools/this-page-does-not-exist-' + Math.random().toString(36).slice(2) + '/');
const missText = await miss.text();
const notFoundOk = miss.status === 404 && missText.includes("This page isn't here") && missText.includes('noindex');
if (!notFoundOk) bad(`bad path returned ${miss.status} without the 404 page`);

// in a real browser: sideways scroll at 390px, the fold at 1440x900, screenshots
const layout = [];
if (!CHROME) bad('no Chrome found for the layout checks');
else {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'md-check-')) });
  const errors = [];
  const open = async (url, vp) => {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(`${url}: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`${url}: failed ${r.url()}`));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${url}: ${r.status()} ${r.url()}`); });
    await page.setViewport(vp);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    return page;
  };
  for (const p of [...pages, { path: '/tools/404.html', type: '404', slug: '404' }]) {
    const phone = await open(local(p.path), { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const over = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 0) bad(`${p.path}: ${over}px sideways overflow at 390px`);
    await phone.close();
    let fold = '';
    if (p.type === 'tool') {
      const desk = await open(local(p.path), { width: 1440, height: 900 });
      const m = await desk.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        return { h1: r('h1').bottom, stage: r('.stage').bottom, button: r('#exportBtn').bottom, fontOk: document.fonts.check('600 16px "Google Sans Flex"') };
      });
      fold = `h1 ends ${Math.round(m.h1)}px, stage ends ${Math.round(m.stage)}px, save button ends ${Math.round(m.button)}px`;
      if (!(m.h1 < m.stage && m.stage <= 900 && m.button <= 900)) bad(`${p.path}: tool not fully above the fold at 1440x900 (${fold})`);
      if (!m.fontOk) bad(`${p.path}: Google Sans Flex did not load`);
      await desk.close();
    }
    layout.push({ path: p.path, overflow390: over, fold });
  }
  if (SHOTS) {
    const shots = [['site-tool-video', '/tools/watermark-video/'], ['site-tool-photos', '/tools/watermark-photos/'], ['site-guide', pages.find((p) => p.type === 'guide')?.path]];
    for (const [name, p] of shots) {
      if (!p) continue;
      for (const [suffix, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
        const page = await open(local(p), vp);
        await new Promise((r) => setTimeout(r, 600));
        await page.screenshot({ path: path.join(ROOT, 'docs', `${name}-${suffix}.png`) });
        await page.close();
      }
    }
  }
  await browser.close();
  for (const e of [...new Set(errors)]) bad(e);
}
await server.close();

console.table(rows.map((r) => ({ ...r, jsonld: r.jsonld.join(' + ') })));
console.table(layout);
console.log(`sitemap: ${locs.length} URLs (${sitemapOk ? 'matches the pages' : 'MISMATCH'}); 404: status ${miss.status} (${notFoundOk ? 'ok' : 'WRONG'})`);
console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\nall checks passed');
process.exit(problems.length ? 1 : 0);
