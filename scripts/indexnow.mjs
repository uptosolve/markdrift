// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver and others) about every page in
// the live sitemap. Run after a deploy that adds or changes pages:
//   node scripts/indexnow.mjs
// The key file lives in public/<key>.txt and is served at https://uptosolve.com/tools/watermark/<key>.txt

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const keyFile = fs.readdirSync(path.join(root, 'public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('No IndexNow key file found in public/');
const key = keyFile.replace('.txt', '');

const sitemap = await (await fetch('https://uptosolve.com/tools/watermark/sitemap.xml')).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'uptosolve.com', key, keyLocation: `https://uptosolve.com/tools/watermark/${key}.txt`, urlList }),
});
console.log(`IndexNow: ${res.status} for ${urlList.length} URLs`);
