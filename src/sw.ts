import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, CacheFirst } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (string | PrecacheEntry)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Cache por defecto de Serwist
    ...defaultCache,

    // Estrategia para API de Supabase: Intenta red primero, si falla usa cache
    {
      matcher: ({ url }) => url.pathname.includes('/rest/v1/'),
      handler: new NetworkFirst({
        cacheName: 'api-cache',
        plugins: [
          {
            cachedResponseWillBeUsed: async ({ cachedResponse }) => {
              // Si estamos offline, devolver cache incluso si está viejo
              if (!navigator.onLine && cachedResponse) {
                return cachedResponse;
              }
              return cachedResponse;
            }
          }
        ]
      })
    },

    // Estrategia para imágenes: Usa cache primero
    {
      matcher: ({ request }) => request.destination === 'image',
      handler: new CacheFirst({
        cacheName: 'images-cache',
      })
    },

    // Estrategia para fuentes de Google: Cache primero
    {
      matcher: ({ url }) => url.origin === 'https://fonts.googleapis.com' ||
        url.origin === 'https://fonts.gstatic.com',
      handler: new CacheFirst({
        cacheName: 'fonts-cache',
      })
    }
  ],
});

serwist.addEventListeners();

// 🆕 ESCUCHAR MENSAJES DESDE LA APP - REQUERIDO PARA SINCRONIZACIÓN OFFLINE
// @ts-expect-error - ServiceWorkerGlobalScope types
self.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type === 'PROCESS_MUTATIONS') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).clients.matchAll().then((clients: readonly any[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clients.forEach((client: any) => {
        client.postMessage({ type: 'PROCESS_MUTATIONS' });
      });
    });
  }

  if (event.data?.type === 'SKIP_WAITING') {
    // @ts-expect-error - ServiceWorkerGlobalScope types
    self.skipWaiting();
  }
});
