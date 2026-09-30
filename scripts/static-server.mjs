// A tiny static file server, used to check the built site and to render the OG images.
// It behaves like the Cloudflare deploy for what matters here: "/x/" serves "/x/index.html",
// "/x" redirects to "/x/" when that folder has an index.html, and a missing file gets the
// nearest 404.html walking up from the requested path, with status 404.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm',
};

export function serveDir(dir, { port = 0, host = '127.0.0.1' } = {}) {
  const root = path.resolve(dir);
  const inside = (f) => f === root || f.startsWith(root + path.sep);
  const isFile = (f) => inside(f) && fs.existsSync(f) && fs.statSync(f).isFile();

  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.statusCode = 400; return res.end(); }
    let file = path.join(root, pathname);
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
    else if (!isFile(file) && isFile(path.join(file, 'index.html'))) {
      res.writeHead(301, { Location: pathname + '/' });
      return res.end();
    }
    let status = 200;
    if (!isFile(file)) {
      status = 404;
      file = null;
      for (let d = path.dirname(path.join(root, pathname)); inside(d); d = path.dirname(d)) {
        if (isFile(path.join(d, '404.html'))) { file = path.join(d, '404.html'); break; }
        if (d === root) break;
      }
      if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
    }
    res.writeHead(status, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const { port: p } = server.address();
      resolve({ url: `http://${host}:${p}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}
