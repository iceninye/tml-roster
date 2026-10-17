// Offline shell. Only same-origin GETs are cached; a file is revalidated every
// time the network is up, so a release never pairs a new app.js with old libs.

const CACHE = "tml-roster-shell-v3"
const SHELL = [
  "./",
  "index.html",
  "assets/app.css",
  "assets/app.js",
  "assets/icon.svg",
  "lib/tml-duties.js",
  "lib/tml-roster.js",
  "lib/tml-time.js",
  "data/stations.json",
  "data/duties/index.json",
  "data/duties/DS1101.json",
  "data/duties/DS6091.json",
  "data/duties/DS7091.json",
  "data/duties/DS8022.json",
  "data/duties/DS8023.json",
]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(
    fetch(request, { cache: "no-cache" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
        }
        return response
      })
      .catch(() => caches.match(request).then((hit) => hit ?? Response.error())),
  )
})
