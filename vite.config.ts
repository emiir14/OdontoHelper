import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function spaApiBoundaryPlugin(): Plugin {
  const apiGuard = (
    req: { url?: string },
    res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void },
    next: () => void
  ) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'API route unavailable in static dev server.' }));
      return;
    }
    next();
  };

  return {
    name: 'odontohelper-spa-api-boundary',
    configureServer(server) {
      server.middlewares.use(apiGuard);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiGuard);
    },
  };
}

export default defineConfig(() => {
  return {
    appType: 'spa' as const,
    plugins: [
      spaApiBoundaryPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          lang: 'es',
          name: 'OdontoHelper - Historias Clínicas Odontológicas',
          short_name: 'OdontoHelper',
          description: 'Sistema de historias clínicas odontológicas, agenda y dictado por voz 100% local.',
          theme_color: '#0d9488',
          background_color: '#FAFAF8',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /\/[^/?]+\.[^/]+$/],
          globPatterns: ['**/*.{js,css,html,wasm}'],
          globIgnores: ['**/assets/aistudio/**'],
          maximumFileSizeToCacheInBytes: 35 * 1024 * 1024,
        },
        devOptions: {
          enabled: false, // Keep disabled during dev hot edits to prevent stale worker locks
        },
      }),
    ],
    worker: {
      format: 'es' as const,
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Referrer-Policy': 'no-referrer',
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Referrer-Policy': 'no-referrer',
      },
    },
  };
});
