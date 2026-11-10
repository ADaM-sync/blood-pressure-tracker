
const CACHE_NAME = "bp-tracker-v3.1";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css?v=3.1",
  "./app.js?v=3.1",
  "./theme.js?v=3.1",
  "./ios-install.js?v=3.1",
  "./apple-touch-icon.png?v=3.1",
  "./apple-touch-icon-precomposed.png?v=3.1",
  "./startup.png?v=3.1",
  "./icons/apple-touch-icon-180.png",
  "./icons/apple-touch-icon-167.png",
  "./icons/apple-touch-icon-152.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./manifest.json?v=3.1"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_FILES)
    )
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith("bp-tracker-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  // Read fresh installation metadata online, with the last good page offline.
  // A cache-first HTML response can make Safari install an obsolete icon set.
  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          await cache.put(event.request, response.clone());
          await cache.put("./index.html", response.clone());
        }
        return response;
      } catch {
        return await cache.match(event.request) || await cache.match("./index.html") ||
          new Response("Please connect once to load BP Tracker.", { status: 503 });
      }
    })());
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => cache.match(event.request)).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (
          response.ok &&
          new URL(event.request.url).origin === self.location.origin
        ) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, copy)
          );
        }

        return response;
      }).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }

        return new Response("Offline", { status: 503 });
      });
    })
  );
});

