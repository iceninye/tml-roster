// 我的更表同編更 跨裝置同步：一條 token 一條記錄，存喺 Workers KV。
//
//   GET /api/roster/<token>   -> 讀返雲端嘅「我的更表」
//   PUT /api/roster/<token>   -> 寫上去（帶 version；版本唔對就 409，唔會無聲蓋掉）
//   GET /api/plan/<token>     -> 讀返雲端嘅編更（同一套規則，另一條 token）
//   PUT /api/plan/<token>
//   POST /api/token-log       -> 產生／用新 token 時寄一封 log 電郵（裝置、時間、token）
//   POST /api/backup          -> 將一份備份檔寄去 owner 電郵
//   GET /api/school-holidays  -> 代讀學校假期 iCal（Google Calendar 唔俾瀏覽器直接讀），回 JSON
//
// PUT 要蓋掉雲端現有版本之前，會先將現有版本寄電郵做備份；寄唔到就唔寫，回 502
// backup_failed，等用戶揀（帶 skipBackup: true 先會照寫）。
//
// 設計上刻意冇 listing：冇 token 就冇入口，`/api/roster/` 一律 404，
// 所以唔可以 enumerate 出任何記錄。token 由用戶自己保管（只存佢自己部機）。
// 呢個係「靠 URL 保密」，唔係認證 —— 攞到條 URL 嘅人讀寫得到。

import { holidaysBetween, parseIcs } from "../lib/tml-ics.js"

const TOKEN_RE = /^[a-z0-9]{20,64}$/
const MAX_BYTES = { roster: 128 * 1024, plan: 1024 * 1024 }
const CODE_RE = /^[A-Z0-9-]{1,10}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_OVERRIDES = 400
const MAX_NOTE = 200
const MAX_LOCKS = 120
const MAX_OT_MIN = 12 * 60 // 更前／更後 OT 最多 12 小時，同 lib/tml-ot.js 一致
const MAX_NAME = 40 // 同 lib/tml-roster.js 一致，唔好上傳再下載靜靜變短
const MAX_DEVICE = 60

const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  })

// 收嘅係一份完整嘅「我的更表」：標題、行號、每行 7 日代號、名、基準週（week number）
// 同手動改動。唔收 duty 卡、編更計劃。
// anchor.monday 一定要同步，唔係第二部機會用「今日」做基準週，兩邊顯示唔同。
function cleanRecord(input) {
  if (!input || input.schema !== 1) return null
  const title = typeof input.title === "string" ? input.title.slice(0, 24) : ""
  if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > 200) return null
  const rows = []
  for (const row of input.rows) {
    if (!Array.isArray(row) || row.length !== 7) return null
    const cells = []
    for (const cell of row) {
      const code = String(cell ?? "").trim().toUpperCase()
      if (!CODE_RE.test(code)) return null
      cells.push(code)
    }
    rows.push(cells)
  }
  const numbers = Array.isArray(input.numbers) && input.numbers.length === rows.length
    ? input.numbers.map(Number)
    : rows.map((_, i) => i + 1)
  if (numbers.some((n) => !Number.isInteger(n) || n < 0 || n > 9999)) return null

  const names = Array.isArray(input.names) && input.names.length === rows.length
    ? input.names.map((name) => String(name ?? "").slice(0, MAX_NAME))
    : rows.map(() => "")

  // 基準週：一個日期就要，其他一律當冇，由前端用本機資料補。
  const anchorIn = input.anchor ?? {}
  const anchor = {
    row: Number.isInteger(Number(anchorIn.row)) && numbers.includes(Number(anchorIn.row)) ? Number(anchorIn.row) : null,
    monday: DATE_RE.test(String(anchorIn.monday ?? "")) ? String(anchorIn.monday) : null,
  }

  // 手動改動：日期 -> 代號；數量封頂，唔好比人塞爆 KV。
  const overrides = {}
  for (const [date, code] of Object.entries(input.overrides ?? {})) {
    const clean = String(code ?? "").trim().toUpperCase()
    if (DATE_RE.test(date) && CODE_RE.test(clean)) overrides[date] = clean
  }

  // OT：日期 -> { whole?, before?, after? }（分鐘），同 lib/tml-ot.js cleanOtDay 一樣規則；舊前端冇就係 {}。
  const ot = {}
  for (const [date, day] of Object.entries(input.ot ?? {})) {
    if (!DATE_RE.test(date) || !day || typeof day !== "object") continue
    const clean = {}
    if (day.whole === true) clean.whole = true
    for (const side of ["before", "after"]) {
      const n = Math.round(Number(day[side]))
      if (Number.isFinite(n) && n > 0) clean[side] = Math.min(MAX_OT_MIN, n)
    }
    if (Object.keys(clean).length) ot[date] = clean
  }

  // 每日備註：日期 -> 字（最多 200 字，去走控制字元，換行除外），同 lib/tml-roster.js cleanNote 一樣。
  const notes = {}
  for (const [date, text] of Object.entries(input.notes && typeof input.notes === "object" ? input.notes : {})) {
    const clean = String(text ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim().slice(0, MAX_NOTE)
    if (DATE_RE.test(date) && clean) notes[date] = clean
  }

  // 🔒 鎖住嘅星期：週一 -> { row, codes: [7], own: [7 x 0/1] }，同 lib/tml-roster.js cleanLocks 一樣規則；最多 120 個。
  const locks = {}
  const lockList = Object.entries(input.locks && typeof input.locks === "object" ? input.locks : {})
    .filter(([monday]) => DATE_RE.test(monday))
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, MAX_LOCKS)
  for (const [monday, held] of lockList) {
    if (!Array.isArray(held?.codes) || held.codes.length !== 7) continue
    const codes = held.codes.map((c) => String(c ?? "").trim().toUpperCase())
    if (!codes.every((c) => CODE_RE.test(c))) continue
    const own = Array.from({ length: 7 }, (_, i) => (Array.isArray(held.own) && held.own[i] ? 1 : 0))
    const row = held.row !== null && held.row !== "" && Number.isInteger(Number(held.row)) ? Number(held.row) : null
    locks[monday] = { row, codes, own }
  }

  return { schema: 1, title, rows, numbers, names, anchor, overrides, ot, notes, locks }
}

// 有 OT 先加入比較，冇 OT 嘅記錄同舊版一樣（唔會因為升級而當內容改咗）
const otPart = (record) => (Object.keys(record.ot ?? {}).length ? [record.ot] : [])
// 備註同樣有先加，按日子排
const notePart = (record) => {
  const keys = Object.keys(record.notes ?? {}).sort()
  return keys.length ? [keys.map((k) => [k, record.notes[k]])] : []
}
// 鎖同樣有先加，按日子排
const lockPart = (record) => {
  const keys = Object.keys(record.locks ?? {}).sort()
  return keys.length ? [keys.map((k) => [k, record.locks[k].row, record.locks[k].codes, record.locks[k].own])] : []
}

// 編更：收成份備份（{ app: "tml-plan", plan, roster }，同「下載備份」個檔一樣），
// 雲端只檢查係唔係編更備份，內容由前端 cleanPlan／cleanRoster 讀返先用。
function cleanPlanRecord(input) {
  if (!input || input.schema !== 1) return null
  const data = input.data
  if (!data || typeof data !== "object" || data.app !== "tml-plan" || !data.plan || typeof data.plan !== "object") return null
  return { schema: 1, data: { app: "tml-plan", appVersion: String(data.appVersion ?? "").slice(0, 20), plan: data.plan, roster: data.roster ?? null } }
}

// 兩個版本內容一樣（只係版本號／時間唔同）就唔使寄備份。
function content(kind, record) {
  if (kind === "plan") return JSON.stringify([record.data?.plan ?? null, record.data?.roster ?? null])
  return JSON.stringify([record.title ?? "", record.rows, record.numbers, record.names, record.anchor, record.overrides, ...otPart(record), ...notePart(record), ...lockPart(record)])
}

// 用戶自己改嘅裝置名，例如「Ice iPhone」；去走控制字元。
function cleanDevice(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_DEVICE)
}

/* ---------------------------------------------------------------- 電郵 */

// 用 Resend 寄（secret RESEND_API_KEY，可選 BACKUP_FROM，預設 Resend 嘅測試寄件人，
// 只寄得去 Resend 帳戶本身嘅電郵）。收件人喺 Worker 嗰邊設定（secret BACKUP_TO），
// repo 同網頁都唔會寫出電郵地址。收件人固定，所以人哋最多只能寄嘢俾 owner；
// 再加每日上限（所有種類一齊計），唔好被人塞爆。
const MAIL_PER_DAY = 60
const BACKUP_MAX = 1024 * 1024
const PLAN_NAME_RE = /^roster-\d{4}-\d{2}-\d{2}-v\d{1,3}\.json$/
const MY_NAME_RE = /^my-roster-\d{4}-\d{2}-\d{2}-\d{4}\.json$/

function base64(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

// 香港時間，例如 2026-10-20 14:03:05（Worker 時區係 UTC）。
function hkTime(value = Date.now()) {
  const ms = typeof value === "number" ? value : Date.parse(String(value ?? ""))
  if (!Number.isFinite(ms)) return ""
  return new Date(ms + 8 * 3600_000).toISOString().slice(0, 19).replace("T", " ")
}

// 檔名用：20261020-1403
const fileStamp = (value) => hkTime(value).slice(0, 16).replace(/-/g, "").replace(" ", "-").replace(":", "")

async function sendMail(env, { subject, text, attachments }) {
  if (!env.RESEND_API_KEY || !env.BACKUP_TO) return { ok: false, reason: "not_configured" }
  const day = hkTime().slice(0, 10)
  const countKey = `backup-mail:${day}`
  const sent = Number((await env.ROSTER_KV.get(countKey)) ?? 0)
  if (sent >= MAIL_PER_DAY) return { ok: false, reason: "too_many" }
  await env.ROSTER_KV.put(countKey, String(sent + 1), { expirationTtl: 2 * 86400 })
  let response
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.BACKUP_FROM || "TML Roster <onboarding@resend.dev>",
        to: [env.BACKUP_TO],
        subject,
        text,
        ...(attachments ? { attachments } : {}),
      }),
    })
  } catch {
    return { ok: false, reason: "send_failed" }
  }
  return response.ok ? { ok: true } : { ok: false, reason: "send_failed", status: response.status }
}

// 邊部機做嘅：用戶改嘅名，加瀏覽器、IP 同大約地區（Cloudflare 提供）。
function deviceLines(request, device) {
  const cf = request.cf ?? {}
  const place = [cf.city, cf.region, cf.country].filter(Boolean).join(", ")
  return [
    `裝置：${cleanDevice(device) || "（冇名）"}`,
    `瀏覽器：${String(request.headers.get("user-agent") ?? "").slice(0, 200) || "（不明）"}`,
    `IP：${request.headers.get("cf-connecting-ip") ?? "（不明）"}${place ? `（${place}）` : ""}`,
  ]
}

const PAGE = { roster: "我的更表", plan: "編更" }
const tail = (token) => `…${token.slice(-6)}`

async function readJson(request, max) {
  const raw = await request.text()
  if (raw.length > max) return { error: reply({ ok: false, reason: "too_large" }, 413) }
  try {
    return { body: JSON.parse(raw) }
  } catch {
    return { error: reply({ ok: false, reason: "bad_json" }, 400) }
  }
}

// 寄信嘅兩個 endpoint 按 IP 限速（Workers Rate Limiting binding MAIL_LIMITER，wrangler.jsonc 設定）。
// 冇 binding（本機測試、GitHub Pages）就唔限；每日 60 封上限（sendMail）照舊。
async function limited(request, env) {
  if (!env.MAIL_LIMITER || request.method !== "POST") return null
  const { success } = await env.MAIL_LIMITER.limit({ key: request.headers.get("cf-connecting-ip") ?? "unknown" })
  return success ? null : reply({ ok: false, reason: "rate_limited" }, 429)
}

const notPost = () => new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } })

// POST /api/backup { name, text, device? }：編更備份（roster-<日期>-v<n>.json），
// 或者我的更表由雲端下載之前，呢部機現有版本（my-roster-<日期>-<時分>.json）。
async function mailBackup(request, env) {
  if (request.method !== "POST") return notPost()
  if (!env.RESEND_API_KEY || !env.BACKUP_TO) return reply({ ok: false, reason: "not_configured" }, 503)
  const { body: input, error } = await readJson(request, BACKUP_MAX)
  if (error) return error
  const name = String(input?.name ?? "")
  let kind = null
  try {
    const parsed = JSON.parse(input.text)
    if (parsed.app === "tml-plan" && PLAN_NAME_RE.test(name)) kind = "plan"
    else if (parsed.v === 1 && Array.isArray(parsed.rows) && MY_NAME_RE.test(name)) kind = "roster"
  } catch {
    kind = null
  }
  if (!kind) return reply({ ok: false, reason: "bad_shape" }, 400)
  const note = kind === "plan"
    ? `附件係編更備份 ${name}。要還原：編更頁 → 匯入同備份 → 匯入備份，貼上檔案內容。`
    : `附件係我的更表喺呢部機嘅版本（由雲端下載之前備份）。要還原：我的更表 → 設定 → 將檔案內容貼入「Standard Roster 內容」再確認。`
  const sent = await sendMail(env, {
    subject: `${kind === "plan" ? "編更備份" : "我的更表 本機備份"} ${name}`,
    text: [note, "", `時間：${hkTime()}`, ...deviceLines(request, input.device)].join("\n"),
    attachments: [{ filename: name, content: base64(input.text) }],
  })
  if (!sent.ok) return reply(sent, sent.reason === "too_many" ? 429 : sent.reason === "not_configured" ? 503 : 502)
  return reply({ ok: true })
}

// POST /api/token-log { app: "roster" | "plan", event: "new" | "join", token, device }
async function tokenLog(request, env) {
  if (request.method !== "POST") return notPost()
  const { body: input, error } = await readJson(request, 4096)
  if (error) return error
  const app = PAGE[input?.app] ? input.app : null
  const event = input?.event === "new" || input?.event === "join" ? input.event : null
  const token = String(input?.token ?? "")
  if (!app || !event || !TOKEN_RE.test(token)) return reply({ ok: false, reason: "bad_shape" }, 400)
  const what = event === "new" ? "產生咗新 token" : "用咗呢條 token（貼上／換 token）"
  const when = hkTime()
  const sent = await sendMail(env, {
    subject: `${PAGE[app]} token log：${event === "new" ? "新 token" : "裝置連接"} ${tail(token)} · ${when.slice(0, 16)}`,
    text: [
      `${PAGE[app]}：${what}`,
      "",
      `時間：${when}（香港時間）`,
      ...deviceLines(request, input.device),
      `token：${token}`,
      "",
      "唔係你做嘅話：喺自己部機撳「產生 token」換一條新嘅，再上傳一次。",
    ].join("\n"),
  })
  if (!sent.ok) return reply(sent, sent.reason === "too_many" ? 429 : sent.reason === "not_configured" ? 503 : 502)
  return reply({ ok: true })
}

// 蓋掉雲端之前：將雲端現有嗰份寄去 owner。我的更表用「貼返入設定」嘅格式，編更用備份檔格式。
async function mailOldVersion(kind, token, stored, request, device, env) {
  const version = Number(stored.version ?? 0)
  const stamp = fileStamp(stored.updatedAt || Date.now())
  let filename
  let file
  if (kind === "plan") {
    filename = `plan-cloud-v${version}-${stamp}.json`
    file = JSON.stringify(stored.data, null, 1)
  } else {
    filename = `my-roster-cloud-v${version}-${stamp}.json`
    const numbers = stored.numbers ?? []
    // 舊記錄可能冇基準週：用第一行同今個星期一補，等佢貼得返入去。
    const today = hkTime().slice(0, 10)
    const day = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7
    const monday = new Date(Date.parse(`${today}T00:00:00Z`) - day * 86400_000).toISOString().slice(0, 10)
    file = JSON.stringify({
      v: 1,
      title: stored.title ?? "",
      rows: stored.rows,
      numbers,
      names: stored.names,
      anchor: { row: stored.anchor?.row ?? numbers[0] ?? 1, monday: stored.anchor?.monday ?? monday },
      overrides: stored.overrides ?? {},
      ot: stored.ot ?? {},
    }, null, 1)
  }
  const restore = kind === "plan"
    ? "要還原：編更頁 → 匯入同備份 → 匯入備份，貼上附件內容。"
    : "要還原：我的更表 → 設定 → 將附件內容貼入「Standard Roster 內容」再確認。"
  return sendMail(env, {
    subject: `${PAGE[kind]} 雲端備份 第 ${version} 版 ${tail(token)} · ${hkTime().slice(0, 16)}`,
    text: [
      `雲端嘅${PAGE[kind]}（第 ${version} 版）即將被新版本覆蓋，附件係覆蓋之前嘅版本。`,
      restore,
      "",
      `舊版本上傳時間：${hkTime(stored.updatedAt) || "（不明）"}${stored.device ? `，由「${stored.device}」上傳` : ""}`,
      `覆蓋時間：${hkTime()}（香港時間）`,
      `覆蓋嘅裝置：`,
      ...deviceLines(request, device).map((line) => `  ${line}`),
      `token：${tail(token)}`,
    ].join("\n"),
    attachments: [{ filename, content: base64(file) }],
  })
}

/* ------------------------------------------------------------ 學校假期 */

// 學校日曆（Google Calendar 嘅 cid）。只讀呢度列出嘅（唔係任意 URL 嘅 proxy）。
// 第一次俾嘅 skhsslmc.edu.hk_5k7g1ubf9dqnlvn7fegnkuj3h0 回 404（唔公開），已換走。
// Ice 2026-10-24 再定：只用 cal 1（vk7g…，學校假期），其餘 3 個（01rud…、4j27…、2cls…）係其他活動，唔讀。
export const SCHOOL_CALENDARS = [
  "skhsslmc.edu.hk_vk7g1ubf9dqnlvn7fegnkuj3h0@group.calendar.google.com",
]
const icsUrl = (id) => `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`
const SCHOOL_TTL = 6 * 3600

// 讀一個日曆：成功回 iCal 文字，否則回失敗原因（HTTP 狀態、not_ics 或者錯誤訊息）。
// Google 有時唔睬冇 User-Agent 嘅請求。
async function readCalendar(id) {
  try {
    const res = await fetch(icsUrl(id), {
      headers: { "user-agent": "Mozilla/5.0 (compatible; tml-roster/1.0; +https://tml-roster.iceninye.workers.dev)", accept: "text/calendar, text/plain, */*" },
      cf: { cacheTtl: SCHOOL_TTL, cacheEverything: true },
    })
    const body = await res.text()
    if (res.ok && body.includes("BEGIN:VCALENDAR")) return { text: body }
    return { why: res.ok ? "not_ics" : res.status }
  } catch (error) {
    return { why: String(error?.message ?? error).slice(0, 60) }
  }
}

// 日曆一齊讀、合併，回前後約一年嘅活動 [{ start, end, title, cal }]（cal = 第幾個日曆，0 起）。
// 讀唔到嘅跳過，記喺 tried（同日曆次序一樣，"ok" 或者原因）；全部都讀唔到先回 502。
// Cloudflare 同瀏覽器都快取 6 個鐘。
async function schoolHolidays() {
  const results = await Promise.all(SCHOOL_CALENDARS.map(readCalendar))
  const tried = results.map((r) => (r.text != null ? "ok" : r.why))
  if (results.every((r) => r.text == null)) return reply({ ok: false, reason: "upstream", tried }, 502)
  const today = new Date().toISOString().slice(0, 10)
  const year = Number(today.slice(0, 4))
  const seen = new Set()
  const holidays = []
  results.forEach((r, cal) => {
    if (r.text == null) return
    for (const h of holidaysBetween(parseIcs(r.text), `${year - 1}${today.slice(4)}`, `${year + 1}${today.slice(4)}`)) {
      // 同一個活動出現喺兩個日曆就只留一個
      const key = `${h.start}|${h.end}|${h.title}`
      if (seen.has(key)) continue
      seen.add(key)
      holidays.push({ ...h, cal })
    }
  })
  holidays.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
  return new Response(JSON.stringify({ ok: true, holidays, tried }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${SCHOOL_TTL}` },
  })
}

/* ---------------------------------------------------------------- 同步 */

async function syncRecord(kind, token, request, env) {
  const key = `${kind}:${token}`

  if (request.method === "GET") {
    const stored = await env.ROSTER_KV.get(key, "json")
    if (!stored) return reply({ ok: false, reason: "empty" }, 404)
    return reply({ ok: true, record: stored })
  }

  if (request.method !== "PUT") {
    return new Response(null, { status: 405, headers: { allow: "GET, PUT", "cache-control": "no-store" } })
  }

  const { body, error } = await readJson(request, MAX_BYTES[kind])
  if (error) return error
  // 手動改動太多就拒絕（以前靜靜截走最新嗰幾個）；前端上傳前會刪走一年前嘅。
  if (kind !== "plan" && (Object.keys(body?.overrides ?? {}).length > MAX_OVERRIDES || Object.keys(body?.ot ?? {}).length > MAX_OVERRIDES || Object.keys(body?.notes ?? {}).length > MAX_OVERRIDES)) return reply({ ok: false, reason: "too_many_overrides" }, 400)
  const clean = kind === "plan" ? cleanPlanRecord(body) : cleanRecord(body)
  if (!clean) return reply({ ok: false, reason: "bad_shape" }, 400)
  const device = cleanDevice(body.device)

  const stored = await env.ROSTER_KV.get(key, "json")
  const wanted = Number(body.version ?? 0)
  const cloudVersion = Number(stored?.version ?? 0)
  // 有人改過（雲端版本同你手上嘅唔一樣）就停手，等用戶揀，除非明確 force。
  if (stored && wanted !== cloudVersion && body.force !== true) {
    return reply({
      ok: false,
      reason: "conflict",
      cloud: { version: cloudVersion, updatedAt: stored.updatedAt ?? "", title: stored.title ?? "", device: stored.device ?? "" },
    }, 409)
  }

  // 先寄現有版本做備份，寄到先覆蓋；內容一樣就唔使寄。
  let backedUp = false
  if (stored && content(kind, stored) !== content(kind, clean) && body.skipBackup !== true) {
    const sent = await mailOldVersion(kind, token, stored, request, device, env)
    if (!sent.ok) return reply({ ok: false, reason: "backup_failed", why: sent.reason }, 502)
    backedUp = true
  }

  const record = { ...clean, device, updatedAt: new Date().toISOString(), version: (stored ? cloudVersion : 0) + 1 }
  await env.ROSTER_KV.put(key, JSON.stringify(record))
  return reply({ ok: true, version: record.version, updatedAt: record.updatedAt, backedUp })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith("/api/")) {
      // 唔係 API：交返俾靜態資產（連 _redirects 都由資產層處理）
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 })
    }

    const parts = url.pathname.split("/").filter(Boolean) // ["api","roster","<token>"]
    // 前端用嚟問「呢個網址支唔支援同步」（GitHub Pages 版會 404）
    if (parts[0] === "api" && parts[1] === "ping") return reply({ ok: true, sync: true, mail: !!(env.RESEND_API_KEY && env.BACKUP_TO) })
    if (parts[0] === "api" && parts[1] === "school-holidays" && parts.length === 2 && request.method === "GET") return schoolHolidays()
    if (parts[0] === "api" && parts[1] === "backup" && parts.length === 2) return (await limited(request, env)) ?? mailBackup(request, env)
    if (parts[0] === "api" && parts[1] === "token-log" && parts.length === 2) return (await limited(request, env)) ?? tokenLog(request, env)
    if (parts.length < 2 || parts[0] !== "api" || (parts[1] !== "roster" && parts[1] !== "plan")) {
      return reply({ ok: false, reason: "not_found" }, 404)
    }
    const token = parts[2]
    if (!token) return reply({ ok: false, reason: "not_found" }, 404) // 冇 listing
    if (!TOKEN_RE.test(token)) return reply({ ok: false, reason: "bad_token" }, 400)
    if (parts.length > 3) return reply({ ok: false, reason: "not_found" }, 404)
    return syncRecord(parts[1], token, request, env)
  },
}
