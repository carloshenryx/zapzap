import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.resolve(root, 'dist');

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || 'localhost';

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.map', 'application/json; charset=utf-8'],
]);

function safeResolveDistPath(urlPath) {
  const cleaned = decodeURIComponent(urlPath.split('?')[0] || '/');
  const withoutLeadingSlash = cleaned.replace(/^\/+/, '');
  const resolved = path.resolve(distDir, withoutLeadingSlash);
  if (!resolved.startsWith(distDir + path.sep) && resolved !== distDir) return null;
  return resolved;
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function readFileOrNull(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const urlPath = req.url || '/';
  const resolved = safeResolveDistPath(urlPath);
  if (!resolved) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  const isRoot = urlPath === '/' || urlPath.startsWith('/?');
  const target = isRoot ? path.join(distDir, 'index.html') : resolved;

  const targetExists = await fileExists(target);
  const finalPath = targetExists ? target : path.join(distDir, 'index.html');

  const body = await readFileOrNull(finalPath);
  if (!body) {
    res.statusCode = 500;
    res.end('dist/ não encontrado. Rode npm run build antes.');
    return;
  }

  const ext = path.extname(finalPath).toLowerCase();
  res.setHeader('Content-Type', contentTypes.get(ext) || 'application/octet-stream');
  res.statusCode = targetExists ? 200 : 200;
  if (method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body);
});

server.listen(port, host, () => {
  process.stdout.write(`SPA preview: http://${host}:${port}/\n`);
});
