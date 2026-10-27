#!/usr/bin/env node
// Serves the built website (_site/) on localhost, so the pages can load their
// JavaScript modules, which browsers refuse to load from file:// pages.
//
// Usage: npm run demo, which builds the site first, then open
// http://localhost:8080/

import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../_site/', import.meta.url));
const port = Number(process.env.PORT) || 8080;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    let path = normalize(join(root, decodeURIComponent(pathname)));
    if (path !== root.slice(0, -1) && !path.startsWith(root)) throw new Error('outside the site');
    if ((await stat(path)).isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { location: `${pathname}/` }).end();
        return;
      }
      path = join(path, 'index.html');
    }
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`PWF site: http://localhost:${port}/`);
});
