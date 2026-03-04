/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL, type PrecacheEntry } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

self.skipWaiting();
clientsClaim();

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string } | null | undefined;
  if (data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ request, url }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'worker' ||
    url.pathname.startsWith('/static/'),
  new StaleWhileRevalidate({
    cacheName: 'al-media-static',
  })
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'al-media-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

const appShellFallback = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(async (options) => {
  try {
    const response = await fetch(options.event.request, { cache: 'no-store' });
    if (response.ok) {
      return response;
    }
  } catch {
    // Ignore network errors and fall back to the precached app shell.
  }
  return appShellFallback(options);
}, {
  denylist: [/^\/api\//, /^\/admin\//],
});
registerRoute(navigationRoute);
