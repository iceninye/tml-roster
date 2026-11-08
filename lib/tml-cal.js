// 手機日曆同步：我的更表 -> iCalendar 訂閱（webcal）。冇 DOM，Worker 同測試都 import。
//
// 做法：前端計好每日一個 event（返工時間、地點、OT），PUT 去 Worker；Worker 存入 KV，
// 喺 /api/ics/<feed>.ics 出一個 .ics。手機日曆（iPhone「訂閱的行事曆」、Google 日曆「透過網址新增」）
// 訂閱咗之後會自己定時重讀：新日子會加入，改咗嘅日子（UID 唔變，SEQUENCE 加一）會更新，
// 唔再出現嘅日子會消失。
//
// UID = <日期>@<feed>：一日一個，改更份係「更新」同一個 event，唔會變兩個。
// feed = sha256(token) 頭 32 個 hex：由 token 計出嚟但倒推唔返，條訂閱網址唔會洩露同步 token。

export const FEED_RE = /^[0-9a-f]{32}$/
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const MAX_EVENTS = 120
const MAX_TEXT = { summary: 80, location: 60, description: 400 }
const DAY_SEC = 86400

export async function feedId(token) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tml-cal:${token}`)))
  return [...bytes.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

const text = (value, max) => String(value ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max)
const secs = (value) => (Number.isInteger(value) && value >= 0 && value <= 2 * DAY_SEC ? value : null)

// Worker 收到嘅 events 清洗一次：日期唯一、時間合理、字數封頂。唔啱就成個拒絕（null）。
// event: { date, summary, location?, description?, on?, off? }（on/off = 當日 00:00 起計嘅秒，冇就係全日）
export function cleanEvents(input) {
  if (!Array.isArray(input) || input.length > MAX_EVENTS) return null
  const seen = new Set()
  const out = []
  for (const ev of input) {
    if (!ev || !DATE_RE.test(String(ev.date)) || seen.has(ev.date)) return null
    seen.add(ev.date)
    const summary = text(ev.summary, MAX_TEXT.summary)
    if (!summary) return null
    const on = secs(ev.on)
    const off = secs(ev.off)
    const timed = on != null && off != null && off > on
    out.push({
      date: ev.date,
      summary,
      location: text(ev.location, MAX_TEXT.location),
      description: text(ev.description, MAX_TEXT.description),
      ...(timed ? { on, off } : {}),
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// 每週同步（首頁 🗓️）：只換 [from, to] 嗰幾日，其他日子照留；太舊嘅（keepFrom 之前）順手清走，
// 總數封頂 MAX_STORED（留最新嗰啲）。events 要全部喺範圍內，唔係就 null。
export const MAX_STORED = 200
export function mergeRange(prev, events, from, to, keepFrom = "") {
  if (!DATE_RE.test(String(from)) || !DATE_RE.test(String(to)) || from > to) return null
  if (events.some((ev) => ev.date < from || ev.date > to)) return null
  const kept = (prev ?? []).filter((ev) => (ev.date < from || ev.date > to) && ev.date >= keepFrom)
  return [...kept, ...events].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_STORED)
}

const keyOf = (ev) => JSON.stringify([ev.summary, ev.location, ev.description, ev.on ?? null, ev.off ?? null])

// 同上次存低嘅比較：內容變咗 SEQUENCE 加一、記低改動時間；冇變就保留舊嘅（日曆 app 唔會當有更新）。
export function withSequence(prev, events, nowIso) {
  const old = new Map((prev ?? []).map((ev) => [ev.date, ev]))
  return events.map((ev) => {
    const before = old.get(ev.date)
    if (before && keyOf(before) === keyOf(ev)) return { ...ev, seq: before.seq ?? 0, modified: before.modified ?? nowIso }
    return { ...ev, seq: before ? (before.seq ?? 0) + 1 : 0, modified: nowIso }
  })
}

// RFC 5545 文字 escape 同 75 octet 摺行（唔好切開中文字）
const esc = (value) => String(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
function fold(line) {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const parts = []
  let cur = ""
  let size = 0
  let limit = 75
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (size + n > limit) {
      parts.push(cur)
      cur = ""
      size = 0
      limit = 74 // 續行開頭有一個空格
    }
    cur += ch
    size += n
  }
  parts.push(cur)
  return parts.join("\r\n ")
}

const pad = (n) => String(n).padStart(2, "0")
const compact = (date) => date.replace(/-/g, "")
function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
// 日期 + 秒（可以過咗 24:00）-> 香港時間 20261108T153000
function localStamp(date, sec) {
  const day = addDays(date, Math.floor(sec / DAY_SEC))
  const s = sec % DAY_SEC
  return `${compact(day)}T${pad(Math.floor(s / 3600))}${pad(Math.floor((s % 3600) / 60))}${pad(s % 60)}`
}
const utcStamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

export function icsText(events, { feed, name = "我的更表", nowIso = new Date().toISOString() } = {}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//iceninye//tml-roster//ZH-HK",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "X-WR-TIMEZONE:Asia/Hong_Kong",
    // 叫日曆 app 每小時重讀（iPhone 會參考；Google 日曆自己決定，通常幾個鐘到一日）
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Hong_Kong",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:HKT",
    "END:STANDARD",
    "END:VTIMEZONE",
  ]
  const stamp = utcStamp(nowIso)
  for (const ev of events) {
    lines.push("BEGIN:VEVENT", `UID:${ev.date}@${feed}.tml-roster`, `DTSTAMP:${stamp}`, `SEQUENCE:${ev.seq ?? 0}`)
    if (ev.modified) lines.push(`LAST-MODIFIED:${utcStamp(ev.modified)}`)
    if (ev.on != null) {
      lines.push(`DTSTART;TZID=Asia/Hong_Kong:${localStamp(ev.date, ev.on)}`, `DTEND;TZID=Asia/Hong_Kong:${localStamp(ev.date, ev.off)}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(ev.date)}`, `DTEND;VALUE=DATE:${compact(addDays(ev.date, 1))}`, "TRANSP:TRANSPARENT")
    }
    lines.push(`SUMMARY:${esc(ev.summary)}`)
    if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`)
    if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`)
    lines.push("END:VEVENT")
  }
  lines.push("END:VCALENDAR")
  return lines.map(fold).join("\r\n") + "\r\n"
}

// 訂閱連結：iPhone／Mac 用 webcal://；Google 日曆用 cid= 開「透過網址新增」
export function subscribeLinks(origin, feed) {
  const https = `${origin.replace(/\/$/, "")}/api/ics/${feed}.ics`
  const webcal = https.replace(/^https?:/, "webcal:")
  return { https, webcal, google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}` }
}
