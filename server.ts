import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  MIME_TYPES,
  resolveServerRequestAction,
} from './src/core/routing/spaFallback.ts';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = path.resolve(process.cwd(), 'dist');

function applySecurityHeaders(res: http.ServerResponse) {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'microphone=(self)');
}

function serveFile(res: http.ServerResponse, filePath: string, method: string) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  applySecurityHeaders(res);

  const method = (req.method || 'GET').toUpperCase();
  const rawUrl = req.url || '/';
  const accept = String(req.headers.accept || '');
  const decision = resolveServerRequestAction(method, rawUrl, accept);

  if (decision.action === 'api') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        ok: false,
        error: 'API route not handled by static SPA server.',
      })
    );
    return;
  }

  if (decision.action === 'not_found') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not found');
    return;
  }

  const relativePath = decision.normalizedPath.replace(/^\/+/, '');
  const resolvedCandidate = path.resolve(DIST_DIR, relativePath || 'index.html');

  // Guard against path traversal outside DIST_DIR
  if (!resolvedCandidate.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  if (decision.action === 'asset') {
    if (fs.existsSync(resolvedCandidate) && fs.statSync(resolvedCandidate).isFile()) {
      serveFile(res, resolvedCandidate, method);
      return;
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Asset not found');
    return;
  }

  // SPA route -> serve exact static match if any, otherwise fallback to dist/index.html
  if (
    relativePath &&
    fs.existsSync(resolvedCandidate) &&
    fs.statSync(resolvedCandidate).isFile()
  ) {
    serveFile(res, resolvedCandidate, method);
    return;
  }

  const indexHtmlPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Build output not found. Run npm run build first.');
    return;
  }

  serveFile(res, indexHtmlPath, method);
});

server.listen(PORT, HOST, () => {
  console.log(`OdontoHelper SPA server listening on http://${HOST}:${PORT}`);
});
