// Checks src/index.js (sync, token log, mail-before-overwrite) with a fake KV and a fake Resend:
//   node tools/validate_worker.mjs
import worker from "../src/index.js"
import { TOKEN_RE, guessDevice, hkStamp, newToken } from "../lib/tml-cloud.js"

let failed = 0
const check = (ok, what) => {
  if (!ok) failed += 1
  console.log(`${ok ? "✓" : "✗"} ${what}`)
}

const kv = new Map()
const ROSTER_KV = {
  get: async (key, type) => (kv.has(key) ? (type === "json" ? JSON.parse(kv.get(key)) : kv.get(key)) : null),
  put: async (key, value) => void kv.set(key, value),
}
const env = { ROSTER_KV, RESEND_API_KEY: "test", BACKUP_TO: "owner@example.com" }

// Resend stand-in: records each mail; `resendDown` makes it fail.
const mails = []
let resendDown = false
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith("https://api.resend.com/")) throw new Error(`unexpected fetch ${url}`)
  if (resendDown) return new Response("{}", { status: 500 })
  mails.push(JSON.parse(init.body))
  return new Response("{}", { status: 200 })
}

const call = async (method, path, body, e = env) => {
  const request = new Request(`https://x.test${path}`, {
    method,
    headers: { "content-type": "application/json", "user-agent": "Test iPhone Safari", "cf-connecting-ip": "203.0.113.9" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const response = await worker.fetch(request, e)
  return { status: response.status, body: await response.json().catch(() => null) }
}

const TOKEN = "abcdefghij0123456789abcdefghij01"
const roster = (code) => ({ schema: 1, title: "我", rows: [[code, "RD", "RD", "RD", "RD", "RD", "RD"]], numbers: [1], names: [""], anchor: { row: 1, monday: "2026-10-19" }, overrides: {} })

// ---- token log
let r = await call("POST", "/api/token-log", { app: "roster", event: "new", token: TOKEN, device: "Ice iPhone" })
check(r.status === 200 && r.body.ok, "token log is accepted")
const log = mails.at(-1)
check(log && log.to[0] === "owner@example.com", "token log goes to BACKUP_TO")
check(log?.text.includes(TOKEN) && log.text.includes("Ice iPhone") && log.text.includes("203.0.113.9") && log.text.includes("香港時間"), "token log names the token, device, IP and HK time")
check(log?.subject.includes("我的更表") && log.subject.includes(TOKEN.slice(-6)), "token log subject names the page and the token end")
r = await call("POST", "/api/token-log", { app: "x", event: "new", token: TOKEN })
check(r.status === 400, "token log refuses an unknown page")
r = await call("POST", "/api/token-log", { app: "plan", event: "new", token: "short" })
check(r.status === 400, "token log refuses a bad token")
r = await call("POST", "/api/token-log", { app: "plan", event: "join", token: TOKEN }, { ROSTER_KV })
check(r.status === 503 && r.body.reason === "not_configured", "token log says when mail is not set up")

// ---- roster: first upload mails nothing, overwrite mails the old version first
let before = mails.length
r = await call("PUT", `/api/roster/${TOKEN}`, { ...roster("1101101"), version: 0, device: "Ice iPhone" })
check(r.status === 200 && r.body.version === 1 && !r.body.backedUp && mails.length === before, "first roster upload needs no backup mail")
r = await call("PUT", `/api/roster/${TOKEN}`, { ...roster("1101101"), version: 1, device: "Ice iPhone" })
check(r.status === 200 && r.body.version === 2 && !r.body.backedUp && mails.length === before, "same content again mails nothing")
r = await call("PUT", `/api/roster/${TOKEN}`, { ...roster("1101102"), version: 2, device: "Ice Mac" })
const old = mails.at(-1)
check(r.status === 200 && r.body.backedUp && mails.length === before + 1, "changed roster mails the cloud version before writing")
const file = old ? JSON.parse(Buffer.from(old.attachments[0].content, "base64").toString("utf8")) : null
check(file?.v === 1 && file.rows[0][0] === "1101101" && file.anchor.row === 1, "the mailed roster is the old one, in the paste-back (cleanRoster) shape")
check(old?.text.includes("Ice iPhone") && old.text.includes("Ice Mac") && old.attachments[0].filename.startsWith("my-roster-cloud-v2-"), "backup mail names who uploaded the old and the new version")

// mail down: refuse, keep the cloud version, unless skipBackup
resendDown = true
r = await call("PUT", `/api/roster/${TOKEN}`, { ...roster("1101103"), version: 3 })
const kept = JSON.parse(kv.get(`roster:${TOKEN}`))
check(r.status === 502 && r.body.reason === "backup_failed" && kept.rows[0][0] === "1101102" && kept.version === 3, "no backup mail -> no overwrite")
r = await call("PUT", `/api/roster/${TOKEN}`, { ...roster("1101103"), version: 3, skipBackup: true })
check(r.status === 200 && r.body.version === 4, "skipBackup (user said yes) writes anyway")
resendDown = false

// conflict still comes first, and says which device
r = await call("PUT", `/api/roster/${TOKEN}`, { ...roster("1101104"), version: 1 })
check(r.status === 409 && r.body.reason === "conflict" && r.body.cloud.version === 4, "stale version is a conflict")
r = await call("GET", `/api/roster/${TOKEN}`)
check(r.status === 200 && r.body.record.rows[0][0] === "1101103", "GET returns the latest roster")

// ---- plan sync
const planData = (n) => ({ app: "tml-plan", appVersion: "0.9.16", plan: { v: 2, n }, roster: { v: 1, rows: [] } })
r = await call("PUT", `/api/plan/${TOKEN}`, { schema: 1, data: { app: "other" }, version: 0 })
check(r.status === 400, "plan upload must be a 編更 backup")
before = mails.length
r = await call("PUT", `/api/plan/${TOKEN}`, { schema: 1, data: planData(1), version: 0, device: "Office PC" })
check(r.status === 200 && r.body.version === 1 && mails.length === before, "first plan upload needs no backup mail")
check(kv.has(`plan:${TOKEN}`) && kv.has(`roster:${TOKEN}`), "plan and roster with the same token are separate records")
r = await call("PUT", `/api/plan/${TOKEN}`, { schema: 1, data: { ...planData(1), appVersion: "0.9.17" }, version: 1, device: "Office PC" })
check(r.status === 200 && !r.body.backedUp, "only the app version changed -> no backup mail")
r = await call("PUT", `/api/plan/${TOKEN}`, { schema: 1, data: planData(2), version: 2 })
const planMail = mails.at(-1)
const planFile = planMail ? JSON.parse(Buffer.from(planMail.attachments[0].content, "base64").toString("utf8")) : null
check(r.body.backedUp && planFile?.app === "tml-plan" && planFile.plan.n === 1, "plan overwrite mails the old plan as an importable backup")
check(planMail?.subject.includes("編更") && planMail.text.includes("Office PC"), "plan backup mail names the page and the old device")
r = await call("GET", `/api/plan/${TOKEN}`)
check(r.body.record.data.plan.n === 2 && r.body.record.device === "", "GET returns the latest plan")

// ---- /api/backup keeps working, and takes my-roster local backups
r = await call("POST", "/api/backup", { name: "roster-2026-10-20-v1.json", text: JSON.stringify(planData(3)) })
check(r.status === 200, "編更 backup mail still works")
r = await call("POST", "/api/backup", { name: "my-roster-2026-10-20-1403.json", text: JSON.stringify({ v: 1, rows: [] }), device: "Ice iPhone" })
check(r.status === 200 && mails.at(-1).subject.includes("我的更表"), "my-roster local backup mail works")
r = await call("POST", "/api/backup", { name: "evil.json", text: JSON.stringify({ v: 1, rows: [] }) })
check(r.status === 400, "backup with an odd file name is refused")

// ---- daily cap shared by every kind of mail
const day = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
kv.set(`backup-mail:${day}`, "60")
r = await call("POST", "/api/token-log", { app: "plan", event: "new", token: TOKEN })
check(r.status === 429 && r.body.reason === "too_many", "the daily mail cap holds")

r = await call("GET", "/api/ping")
check(r.body.ok && r.body.mail === true, "ping says mail is set up")
r = await call("GET", "/api/plan/")
check(r.status === 404, "no listing of plans")

// ---- lib/tml-cloud.js
check(TOKEN_RE.test(newToken()) && newToken() !== newToken(), "newToken makes a fresh 32-char token")
check(guessDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18.0 Mobile Safari/604.1") === "iPhone · Safari", "an iPhone Safari is named")
check(guessDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0") === "Windows · Edge", "Edge on Windows is named")
check(guessDevice("Android Chrome/1") === "Android · Chrome", "an Android Chrome is named")
check(hkStamp("2026-10-20T06:03:00Z") === "2026-10-20 14:03", "hkStamp shows Hong Kong time")

if (failed) {
  console.error(`${failed} check(s) failed`)
  process.exit(1)
}
console.log("validate_worker OK")
