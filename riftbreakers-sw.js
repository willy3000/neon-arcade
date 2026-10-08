/* Cache only this game's shell and arcade navigation. Other games pass through. */
const CACHE = "riftbreakers-v1",
  FILES = [
    "./",
    "./index.html",
    "./library.js",
    "./library.css",
    "./riftbreakers.html",
    "./riftbreakers/style.css",
    "./riftbreakers/levels.js",
    "./riftbreakers/physics.js",
    "./riftbreakers/combat.js",
    "./riftbreakers/ai.js",
    "./riftbreakers/simulation.js",
    "./riftbreakers/save.js",
    "./riftbreakers/audio.js",
    "./riftbreakers/render.js",
    "./riftbreakers/game.js",
    "./riftbreakers/input.js",
  ];
const URLS = new Set(
  FILES.map((f) => new URL(f, self.registration.scope).href),
);
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("riftbreakers-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !URLS.has(event.request.url)) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)),
          );
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
