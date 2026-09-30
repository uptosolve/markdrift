import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// The site is a set of static pages generated from content/ by scripts/build-pages.mjs
// into site/ (see SITE-PLAN.md). Vite serves and builds site/ as a multi-page app under /tools/.
//
//   npm run dev    -> http://localhost:5188/tools/  (a tool page: /tools/watermark-video/)
//   npm run build  -> dist/tools/...  (dist/ is the folder that gets deployed)
const ROOT = import.meta.dirname;
const SITE = path.join(ROOT, 'site');
const DIST = path.join(ROOT, 'dist');

// Dev-only helper so automated browser tests can save exported files to disk.
// It is never part of the production build. Both endpoints sit at the server root, outside /tools/.
const saveEndpoint = {
  name: 'markdrift-test-save',
  apply: 'serve',
  configureServer(server) {
    // Firefox under automation drops some video responses (.mov, .mkv) as downloads,
    // so tests fetch media through here with a neutral content type.
    server.middlewares.use('/__media', (req, res) => {
      const name = path.basename(new URL(req.url, 'http://x').searchParams.get('name') || '');
      const file = path.resolve(ROOT, 'test-media', name);
      if (!name || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', 'application/x-markdrift-test');
      fs.createReadStream(file).pipe(res);
    });
    server.middlewares.use('/__save', (req, res) => {
      const name = path.basename(new URL(req.url, 'http://x').searchParams.get('name') || 'out.bin');
      const dir = path.resolve(ROOT, 'test-media/out');
      fs.mkdirSync(dir, { recursive: true });
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks));
        res.end('ok');
      });
    });
  },
};

// Every generated page is an entry: site/index.html, site/<path>/index.html and site/404.html.
function pageInputs() {
  if (!fs.existsSync(SITE)) return {};
  const inputs = {};
  for (const rel of fs.readdirSync(SITE, { recursive: true })) {
    const file = String(rel).replace(/\\/g, '/');
    if (!file.endsWith('.html')) continue;
    const name = file === 'index.html' ? 'hub' : file.replace(/\/index\.html$|\.html$/, '').replace(/\//g, '-');
    inputs[name] = path.join(SITE, file);
  }
  return inputs;
}

// Build extras: start from an empty dist/, write the sitemap the generator prepared,
// and move Cloudflare's _headers file to the deploy root (its paths already include /tools/).
const siteExtras = {
  name: 'markdrift-site-extras',
  apply: 'build',
  buildStart() {
    if (!fs.existsSync(path.join(SITE, 'index.html'))) {
      this.error('site/ is missing. Run `npm run build` (it generates the pages first) or `node scripts/build-pages.mjs`.');
    }
    fs.rmSync(DIST, { recursive: true, force: true });
  },
  generateBundle() {
    const sitemap = path.join(SITE, '.meta', 'sitemap.xml');
    if (fs.existsSync(sitemap)) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: fs.readFileSync(sitemap, 'utf8') });
  },
  closeBundle() {
    const headers = path.join(DIST, 'tools', '_headers');
    if (fs.existsSync(headers)) fs.renameSync(headers, path.join(DIST, '_headers'));
  },
};

export default defineConfig({
  root: SITE,
  base: '/tools/',
  publicDir: path.join(ROOT, 'public'),
  appType: 'mpa',
  // pages live in site/, the app code stays in src/: "/src/..." in a page means <project>/src/...
  resolve: { alias: [{ find: /^\/src\//, replacement: path.join(ROOT, 'src') + '/' }] },
  plugins: [saveEndpoint, siteExtras],
  server: { port: 5188, strictPort: true, fs: { allow: [ROOT] } },
  preview: { port: 5189, strictPort: true },
  build: {
    target: 'es2022',
    outDir: path.join(DIST, 'tools'),
    emptyOutDir: true,
    rollupOptions: { input: pageInputs() },
  },
});
