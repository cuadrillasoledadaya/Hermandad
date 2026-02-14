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

// Versión del Service Worker: 1.2.13 (Fix Precache Conflict)
const serwist = new Serwist({
  precacheEntries: [
    ...(self.__SW_MANIFEST || []),
    { url: "/~offline", revision: "1.2.13" },
    { url: "/", revision: "1.2.13" },
  ],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. Chunks de Next.js (Alta Prioridad)
    {
      matcher: ({ url }) => url.pathname.startsWith('/_next/static/chunks/'),
      handler: new CacheFirst({
        cacheName: 'static-chunks-cache',
        plugins: [new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 31536000 })],
      }),
    },
    // 2. CSS de Next.js
    {
      matcher: ({ url }) => url.pathname.startsWith('/_next/static/css/'),
      handler: new CacheFirst({
        cacheName: 'static-css-cache',
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 31536000 })],
      }),
    },
    // 3. RSC Payloads (CRÍTICO para navegación Next.js)
    {
      matcher: ({ url }) => url.searchParams.has('_rsc') || url.pathname.includes('/_next/data/'),
      handler: new StaleWhileRevalidate({
        cacheName: 'rsc-payloads-cache',
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 604800 })],
      }),
    },
    // 4. Navegación de Páginas (Estrategia agresiva con fallback)
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 3,
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 604800 })],
      }),
    },
    // 5. API de Supabase - ELIMINADO CACHÉ DE SW PARA EVITAR DATOS OBSOLETOS
    // Dejamos que React Query gestione la persistencia y frescura de datos
    // 6. Imágenes
    {
      matcher: ({ request }) => request.destination === 'image',
      handler: new CacheFirst({
        cacheName: 'images-cache',
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 2592000 })],
      }),
    },
    // 7. Fuentes
    {
      matcher: ({ url }) => url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com'),
      handler: new CacheFirst({
        cacheName: 'fonts-cache',
        plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 31536000 })],
      }),
    },
    // 8. Caché por defecto de Serwist (Baja Prioridad)
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.mode === "navigate";
        },
      },
    ],
  },
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
