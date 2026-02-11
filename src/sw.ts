import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, CacheFirst, StaleWhileRevalidate, ExpirationPlugin } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (string | PrecacheEntry)[] | undefined;
    addEventListener(type: string, listener: (event: any) => void): void;
    skipWaiting(): void;
    clients: {
      matchAll(): Promise<any[]>;
    };
  }
}

declare const self: ServiceWorkerGlobalScope;

// Versión del Service Worker: 1.2.01 (Fix de Chunk Loading Offline)
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    // CRÍTICO: Cachear chunks de JavaScript para navegación offline sin errores
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith('/_next/static/chunks/'),
      handler: new CacheFirst({
        cacheName: 'static-chunks-cache',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200, // Permitir muchos chunks
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
          }),
        ],
      }),
    },
    // Cachear CSS de forma agresiva
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith('/_next/static/css/'),
      handler: new CacheFirst({
        cacheName: 'static-css-cache',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          }),
        ],
      }),
    },
    // Estrategia para Navegación: Intenta red primero con timeout corto, cae a cache
    {
      matcher: ({ request }: { request: Request }) => request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 días
          }),
        ],
      }),
    },
    // Estrategia para API de Supabase: StaleWhileRevalidate para lectura rápida
    {
      matcher: ({ url }: { url: URL }) => url.pathname.includes('/rest/v1/') && !url.pathname.includes('/auth/'),
      handler: new StaleWhileRevalidate({
        cacheName: 'api-cache',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 días
          }),
        ],
      })
    },
    {
      matcher: ({ request }: { request: Request }) => request.destination === 'image',
      handler: new CacheFirst({
        cacheName: 'images-cache',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
          }),
        ],
      })
    },
    {
      matcher: ({ url }: { url: URL }) => url.origin === 'https://fonts.googleapis.com' ||
        url.origin === 'https://fonts.gstatic.com',
      handler: new CacheFirst({
        cacheName: 'fonts-cache',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          }),
        ],
      })
    }
  ],
});

serwist.addEventListeners();

self.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type === 'PROCESS_MUTATIONS') {
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'PROCESS_MUTATIONS' });
      });
    });
  }

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
