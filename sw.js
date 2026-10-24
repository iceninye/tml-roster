// Offline shell. Same-origin GETs and the Duty data read from TML-traffic are
// cached; a file is revalidated every time the network is up, so a release never
// pairs a new app.js with old libs, and a new Duty Sheet shows up on next open.

const CACHE = "tml-roster-shell-v60"
const SHELL = [
  "./",
  "index.html",
  "plan.html",
  "site.webmanifest",
  "plan.webmanifest",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
  "android-chrome-maskable-512x512.png",
  "assets/app.css",
  "assets/app.js",
  "assets/plan.js",
  "assets/icon.svg",
  "lib/tml-duties.js",
  "lib/tml-extra.js",
  "lib/tml-ot.js",
  "lib/tml-plan.js",
  "lib/tml-roster.js",
  "lib/tml-shift.js",
  "lib/tml-week.js",
  "lib/tml-time.js",
  "lib/tml-cloud.js",
  "lib/tml-data.js",
]

// Same list as DATA_BASES in lib/tml-data.js (a classic worker can't import it).
const DATA_BASES = [
  "https://tml-traffic.iceninye.workers.dev/",
  "https://raw.githubusercontent.com/iceninye/TML-traffic/main/",
]
const DATA_ORIGINS = DATA_BASES.map((base) => new URL(base).origin)

// Best effort: the Duty data for offline use, from the first source that answers.
// Every sheet in index.json is cached, so a new sheet needs no change here.
async function cacheData(cache) {
  for (const base of DATA_BASES) {
    try {
      const get = async (path) => {
        const response = await fetch(base + path, { cache: "no-cache" })
        if (!response.ok) throw new Error(`${path}: ${response.status}`)
        await cache.put(base + path, response.clone())
        return response
      }
      const index = await (await get("data/duties/index.json")).json()
      await Promise.all([
        get("data/duty-basic.json"),
        get("data/tml-network.json"),
        ...index.sheets.map((sheet) => get(`data/duties/${sheet.file}`)),
      ])
      return
    } catch {
      // try the next source; the pages still fetch the data themselves
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL).then(() => cacheData(cache)))
      .then(() => self.skipWaiting()),
  )
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
  const url = new URL(request.url)
  if (request.method !== "GET") return
  if (url.origin !== self.location.origin && !DATA_ORIGINS.includes(url.origin)) return
  // 雲端同步 API 唔快取：cache 住會離線時攞返舊版本，而且 token 會留喺 cache 網址。
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return
  event.respondWith(answer(event, request))
})

// 先問網絡（唔係先用快取），但訊號差時唔好等到失敗：3 秒未答就先出快取，網絡背後繼續跑並更新快取。
const SLOW_MS = 3000

async function answer(event, request) {
  const network = fetch(request, { cache: "no-cache" }).then((response) => {
    if (response.ok) {
      const copy = response.clone()
      caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
    }
    return response
  })
  const cached = await caches.match(request)
  if (!cached) return network.catch(() => Response.error())
  event.waitUntil(network.catch(() => {}))
  let timer
  const slow = new Promise((resolve) => { timer = setTimeout(() => resolve(cached), SLOW_MS) })
  return Promise.race([network.catch(() => cached), slow]).finally(() => clearTimeout(timer))
}
