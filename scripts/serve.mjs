import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_TYPES, RUNTIME_FILES } from './runtime-files.mjs';
import { readRuntimeFile } from './runtime-content.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function teachingModuleOrigin(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    if (url.origin !== raw || url.username || url.password) return null;
    const owned = raw === 'https://haimuhaimu.github.io';
    const local = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
      && Number(url.port) >= 1024;
    return owned || local ? raw : null;
  } catch {
    return null;
  }
}

/** Serve sources by default. Use { built: true } explicitly for a dist directory. */
export function createAppServer(root = ROOT, { built = false } = {}) {
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', CSP);
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    try {
      const path = decodeURIComponent((req.url || '/').split('?')[0]);
      const file = path === '/' ? 'index.html' : path.slice(1);
      if (!path.startsWith('/') || !Object.hasOwn(RUNTIME_FILES, file)) throw new Error('Not an asset');
      const bytes = await readRuntimeFile(root, file, { built });
      if (file.endsWith('.mjs')) {
        res.setHeader('Vary', 'Origin');
        const origin = teachingModuleOrigin(req.headers.origin);
        if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.writeHead(200, {
        'Content-Type': CONTENT_TYPES[extname(file)],
        'Content-Length': bytes.length,
      });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : 'Not found');
    }
  });
}

export async function startServer({ port = 3040, root = ROOT, built = false } = {}) {
  const server = createAppServer(root, { built });
  await new Promise((ready, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', ready);
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3040);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  const server = await startServer({ port });
  console.log(`算法游乐场 → http://127.0.0.1:${server.address().port}/`);
}
