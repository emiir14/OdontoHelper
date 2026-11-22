export interface SpaFallbackDecision {
  action: 'api' | 'asset' | 'spa' | 'not_found';
  normalizedPath: string;
}

const STATIC_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.json',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.wasm',
  '.onnx',
  '.map',
  '.txt',
  '.xml',
  '.webmanifest',
  '.mp4',
  '.webm',
]);

export const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.mp4': 'video/mp4',
};

export function extractPathname(rawUrl: string): string {
  const withoutHash = rawUrl.split('#')[0] || '/';
  const withoutQuery = withoutHash.split('?')[0] || '/';
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
}

export function hasFileExtension(pathname: string): boolean {
  const lastSegment = pathname.split('/').pop() || '';
  const dotIdx = lastSegment.lastIndexOf('.');
  if (dotIdx <= 0) return false;
  const ext = lastSegment.slice(dotIdx).toLowerCase();
  return STATIC_EXTENSIONS.has(ext) || /\.[a-z0-9]{1,8}$/i.test(lastSegment);
}

/**
 * Determines how the HTTP server / dev middleware should route an incoming request:
 * - /api/* -> never fall back to index.html (prevent HTML responses on JSON endpoints)
 * - Static files / assets with extension -> serve file (or 404 if missing)
 * - GET/HEAD browser navigation routes without extension -> serve SPA index.html
 */
export function resolveServerRequestAction(
  method: string | undefined,
  rawUrl: string,
  acceptHeader = ''
): SpaFallbackDecision {
  const normalizedPath = extractPathname(rawUrl);
  const upperMethod = (method || 'GET').toUpperCase();

  if (normalizedPath === '/api' || normalizedPath.startsWith('/api/')) {
    return { action: 'api', normalizedPath };
  }

  if (upperMethod !== 'GET' && upperMethod !== 'HEAD') {
    return { action: 'not_found', normalizedPath };
  }

  if (normalizedPath !== '/' && hasFileExtension(normalizedPath)) {
    return { action: 'asset', normalizedPath };
  }

  // Only serve SPA HTML when client accepts HTML or didn't explicitly request JSON/asset-only MIME
  const lowerAccept = acceptHeader.toLowerCase();
  if (
    lowerAccept &&
    !lowerAccept.includes('text/html') &&
    !lowerAccept.includes('*/*') &&
    !lowerAccept.includes('application/xhtml+xml')
  ) {
    return { action: 'not_found', normalizedPath };
  }

  return { action: 'spa', normalizedPath };
}
