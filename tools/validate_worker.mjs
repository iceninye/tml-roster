// Checks src/index.js (sync, token log, mail-before-overwrite) with a fake KV and a fake Resend:
//   node tools/validate_worker.mjs
import worker from "../src/index.js"
import { TOKEN_RE, guessDevice, hkStamp, newToken, syncState } from "../lib/tml-cloud.js"

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
// 學校假期 iCal stand-in（schoolDown 令佢失敗）
let schoolDown = false
const year = Number(new Date().toISOString().slice(0, 4))
const SCHOOL_TEXT = [
  "BEGIN:VCALENDAR", "BEGIN:VEVENT", `DTSTART;VALUE=DATE:${year}1001`, `DTEND;VALUE=DATE:${year}1002`, "SUMMARY:國慶日", "END:VEVENT",
  "BEGIN:VEVENT", `DTSTART;VALUE=DATE:${year}1221`, `DTEND;VALUE=DATE:${year + 1}0102`, "SUMMARY:聖誕及新年假\, 全校", "END:VEVENT",
  "BEGIN:VEVENT", `DTSTART:${year}1105T013000Z`, `DTEND:${year}1105T090000Z`, "SUMMARY:家長日", "END:VEVENT",
  "BEGIN:VEVENT", `DTSTART;VALUE=DATE:${year}0901`, "SUMMARY:取消咗", "STATUS:CANCELLED", "END:VEVENT",
  "BEGIN:VEVENT", `DTSTART;VALUE=DATE:${year - 5}0101`, "SUMMARY:好舊", "END:VEVENT", "END:VCALENDAR",
].join("\r\n")
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://calendar.google.com/")) {
    // 只應該讀 cal 1（vk7g…）；讀其他日曆就係錯
    if (!url.includes("skhsslmc.edu.hk_vk7g1ubf9dqnlvn7fegnkuj3h0%40group.calendar.google.com")) throw new Error(`unexpected calendar ${url}`)
    if (schoolDown) return new Response("", { status: 404 })
    return new Response(SCHOOL_TEXT)
  }
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
{
  const many = Object.fromEntries(Array.from({ length: 401 }, (_, i) => [new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), "AL"]))
  const few = Object.fromEntries(Object.entries(many).slice(0, 400))
  r = await call("PUT", `/api/roster/${TOKEN}`, { ...roster("1101101"), overrides: many, version: 4, skipBackup: true })
  check(r.status === 400 && r.body.reason === "too_many_overrides", "more than 400 manual changes are refused, not cut off")
  const other = "zyxwvutsrq9876543210zyxwvutsrq98"
  r = await call("PUT", `/api/roster/${other}`, { ...roster("1101101"), overrides: few, version: 0 })
  check(r.status === 200 && r.body.ok, "400 manual changes are accepted")
  const stored = await call("GET", `/api/roster/${other}`)
  check(Object.keys(stored.body.record.overrides).length === 400, "all 400 are kept")
}
r = await call("GET", `/api/roster/${TOKEN}`)
check(r.status === 200 && r.body.record.rows[0][0] === "1101103", "GET returns the latest roster")

// OT 跟更表一齊同步；亂嘢會被清走
{
  const otToken = "otototototototototototototototo"
  const ot = { "2026-10-25": { whole: true }, "2026-10-26": { after: 210, before: -5 }, "2026-10-27": { after: 9999 }, bad: { whole: true }, "2026-10-28": { whole: "yes" } }
  r = await call("PUT", `/api/roster/${otToken}`, { ...roster("1101101"), ot, version: 0 })
  const got = (await call("GET", `/api/roster/${otToken}`)).body.record.ot
  check(r.status === 200 && JSON.stringify(got) === JSON.stringify({ "2026-10-25": { whole: true }, "2026-10-26": { after: 210 }, "2026-10-27": { after: 720 } }), "OT is synced and cleaned")
  const mailsBefore = mails.length
  r = await call("PUT", `/api/roster/${otToken}`, { ...roster("1101101"), ot: { "2026-10-25": { whole: true } }, version: 1 })
  check(r.status === 200 && mails.length === mailsBefore + 1, "changing only OT counts as a change (old version mailed)")
  const many = Object.fromEntries(Array.from({ length: 401 }, (_, i) => [new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), { after: 60 }]))
  r = await call("PUT", `/api/roster/${otToken}`, { ...roster("1101101"), ot: many, version: 2 })
  check(r.status === 400 && r.body.reason === "too_many_overrides", "more than 400 OT days are refused")
}

// 同事更表跟更表同步；亂嘢清走
{
  const mateToken = "mtmtmtmtmtmtmtmtmtmtmtmtmtmtmtmt"
  const mates = [{ row: 2, monday: "2026-10-19", name: "Bo" }, { row: "x", monday: "2026-10-19" }, { row: 3, monday: "bad" }]
  r = await call("PUT", `/api/roster/${mateToken}`, { ...roster("1101101"), mates, version: 0 })
  const got = (await call("GET", `/api/roster/${mateToken}`)).body.record.mates
  check(r.status === 200 && JSON.stringify(got) === JSON.stringify([{ row: 2, monday: "2026-10-19", name: "Bo" }]), "colleagues are synced and cleaned")
}

// 每日備註跟更表同步；亂嘢清走
{
  const noteToken = "ntntntntntntntntntntntntntntntnt"
  const notes = { "2026-10-21": " 換更\u0007 ", bad: "x", "2026-10-22": "", "2026-10-23": "字".repeat(300) }
  r = await call("PUT", `/api/roster/${noteToken}`, { ...roster("1101101"), notes, version: 0 })
  const got = (await call("GET", `/api/roster/${noteToken}`)).body.record.notes
  check(r.status === 200 && got["2026-10-21"] === "換更" && got["2026-10-23"].length === 200 && Object.keys(got).length === 2, "notes are synced and cleaned")
  const mailsBefore = mails.length
  r = await call("PUT", `/api/roster/${noteToken}`, { ...roster("1101101"), version: 1 })
  check(r.status === 200 && mails.length === mailsBefore + 1, "deleting notes counts as a change (old version mailed)")
}

// 🔒 鎖住嘅星期跟更表同步；格式唔啱嘅清走
{
  const lockToken = "lklklklklklklklklklklklklklklklk"
  const locks = { "2026-10-19": { row: 7, codes: ["1101101", "rd", "RD", "AL", "AL", "SH", "RD"], own: [1, 0, 0, 0, 0, 0, 0] }, "2026-10-12": { codes: ["RD"] }, bad: { codes: Array(7).fill("RD") } }
  r = await call("PUT", `/api/roster/${lockToken}`, { ...roster("1101101"), locks, version: 0 })
  const got = (await call("GET", `/api/roster/${lockToken}`)).body.record.locks
  check(r.status === 200 && JSON.stringify(got) === JSON.stringify({ "2026-10-19": { row: 7, codes: ["1101101", "RD", "RD", "AL", "AL", "SH", "RD"], own: [1, 0, 0, 0, 0, 0, 0] } }), "week locks are synced and cleaned")
  const mailsBefore = mails.length
  r = await call("PUT", `/api/roster/${lockToken}`, { ...roster("1101101"), version: 1 })
  check(r.status === 200 && mails.length === mailsBefore + 1, "removing a lock counts as a change (old version mailed)")
}

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

// ---- per-IP limit on the two mail endpoints (the binding is absent above, so nothing was limited)
let allowed = 2
const limiterKeys = []
const limitedEnv = { ...env, MAIL_LIMITER: { limit: async ({ key }) => (limiterKeys.push(key), { success: allowed-- > 0 }) } }
kv.delete(`backup-mail:${day}`)
const mailsBefore = mails.length
r = await call("POST", "/api/token-log", { app: "plan", event: "new", token: TOKEN }, limitedEnv)
check(r.status === 200, "within the limit a token log goes out")
r = await call("POST", "/api/backup", { name: "roster-2026-10-20-v1.json", text: JSON.stringify(planData(3)) }, limitedEnv)
check(r.status === 200, "within the limit a backup goes out")
r = await call("POST", "/api/token-log", { app: "plan", event: "new", token: TOKEN }, limitedEnv)
check(r.status === 429 && r.body.reason === "rate_limited" && mails.length === mailsBefore + 2, "over the limit gets 429 and no mail")
check(limiterKeys.every((key) => key === "203.0.113.9"), "the limiter is keyed by the caller's IP")
r = await call("GET", "/api/ping", undefined, limitedEnv)
check(r.status === 200, "ping and sync are not rate limited")

r = await call("GET", "/api/ping")
check(r.body.ok && r.body.mail === true, "ping says mail is set up")
r = await call("GET", "/api/plan/")
check(r.status === 404, "no listing of plans")

// ---- 學校假期
r = await call("GET", "/api/school-holidays")
check(r.status === 200 && r.body.ok && JSON.stringify(r.body.holidays.map((h) => [h.start, h.end, h.title])) === JSON.stringify([
  [`${year}-10-01`, `${year}-10-01`, "國慶日"], [`${year}-11-05`, `${year}-11-05`, "家長日"], [`${year}-12-21`, `${year + 1}-01-01`, "聖誕及新年假, 全校"],
]) && r.body.tried.join() === "ok", "school holidays: only cal 1 (vk7g…) is read; all-day end inclusive, cancelled and old events dropped")
schoolDown = true
r = await call("GET", "/api/school-holidays")
check(r.status === 502 && r.body.reason === "upstream" && r.body.tried.join() === "404", "school calendar down -> 502 upstream with its status")
schoolDown = false

// ---- lib/tml-cloud.js
check(TOKEN_RE.test(newToken()) && newToken() !== newToken(), "newToken makes a fresh 32-char token")
check(guessDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18.0 Mobile Safari/604.1") === "iPhone · Safari", "an iPhone Safari is named")
check(guessDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0") === "Windows · Edge", "Edge on Windows is named")
check(guessDevice("Android Chrome/1") === "Android · Chrome", "an Android Chrome is named")
check(hkStamp("2026-10-20T06:03:00Z") === "2026-10-20 14:03", "hkStamp shows Hong Kong time")
check(syncState({ cloudVersion: null, localVersion: 3, dirty: true }) === "none", "🔔 no cloud answer: no bell")
check(syncState({ cloudVersion: 3, localVersion: 3, dirty: false }) === "none", "🔔 same version, no change: no bell")
check(syncState({ cloudVersion: 4, localVersion: 3, dirty: false }) === "cloud", "🔔 cloud has a newer version")
check(syncState({ cloudVersion: 3, localVersion: 3, dirty: true }) === "local", "🔔 this device changed since the last sync")
check(syncState({ cloudVersion: 4, localVersion: 3, dirty: true }) === "both", "🔔 both changed")
check(syncState({ cloudVersion: 4, localVersion: 3, dirty: true, same: true }) === "none", "🔔 same content under another version: no bell")
check(syncState({ cloudVersion: 1, localVersion: 0, dirty: false }) === "cloud", "🔔 fresh token on this device, cloud already has one")

if (failed) {
  console.error(`${failed} check(s) failed`)
  process.exit(1)
}
console.log("validate_worker OK")
