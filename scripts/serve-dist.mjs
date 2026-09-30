// Serves the built site the way it is deployed: dist/ is mounted at "/", so pages live at /tools/...
//   npm run build && npm run preview   ->  http://127.0.0.1:5189/tools/
import path from 'node:path';
import { serveDir } from './static-server.mjs';

const port = Number(process.env.PORT) || 5189;
const { url } = await serveDir(path.resolve(import.meta.dirname, '../dist'), { port });
console.log(`Serving dist/ at ${url}/tools/  (Ctrl+C to stop)`);
