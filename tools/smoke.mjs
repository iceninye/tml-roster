// 瀏覽器冒煙測試：開頁、貼更表、睇週／日／日曆／設定，有 JS 錯誤或者畫面空咗就失敗。
// 只用 RD／AL 呢類冇需要 Duty Sheet 嘅代碼，所以唔使上網（對外請求全部擋住）。
// 需要 playwright：本機 `npm i --no-save playwright`，CI 見 .github/workflows/test.yml。
import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require("playwright")) } catch { console.log("SKIP smoke: playwright not installed"); process.exit(0) }

const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json" }
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x")
  if (url.pathname.startsWith("/api/")) { res.setHeader("content-type", "application/json"); res.end(url.pathname === "/api/ping" ? '{"ok":true}' : '{"ok":false,"reason":"empty"}'); return }
  const file = path.join(root, url.pathname === "/" ? "index.html" : url.pathname)
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; res.end(); return }
  res.setHeader("content-type", types[path.extname(file)] ?? "application/octet-stream")
  res.end(fs.readFileSync(file))
})
await new Promise((r) => server.listen(0, r))
const base = `http://localhost:${server.address().port}`

let fails = 0
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++ }

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, timezoneId: "Asia/Hong_Kong", serviceWorkers: "block" })
  await ctx.clock.setFixedTime(new Date("2026-11-10T04:46:00Z"))
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { console.log("PAGEERROR", e.message); fails++ })
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "localhost" ? route.continue() : route.abort())

  await page.goto(`${base}/index.html`)
  await page.waitForSelector("textarea[name=text]")
  await page.fill("textarea[name=text]", "1,RD,AL,RD,AL,RD,AL,RD\n2,AL,RD,AL,RD,AL,RD,AL")
  await page.fill("#me-row", "1")
  await page.click(".me-setup button[type=submit]")
  await page.waitForSelector(".me-day")
  ok((await page.locator(".me-day").count()) >= 7, "week shows day cards")
  ok((await page.locator("#me-cal").count()) === 1, "calendar panel exists")

  await page.locator(".me-day").first().click()
  await page.waitForTimeout(300)
  ok((await page.locator(".me-day").count()) === 0 && (await page.locator(".me-back, .btn.me-back").count()) >= 1, "day page opens")
  await page.goBack()
  await page.waitForSelector(".me-day")
  ok(true, "back to week")

  await page.click(".me-settings")
  await page.waitForSelector(".set-group")
  ok((await page.locator(".set-group").count()) >= 1, "settings opens")
} finally {
  await browser.close()
  server.close()
}
if (fails) { console.log(`${fails} failed`); process.exit(1) }
console.log("smoke ok")
