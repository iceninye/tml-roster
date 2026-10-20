// 我的更表 跨裝置同步：一條 token 一條記錄，存喺 Workers KV。
//
//   GET /api/roster/<token>   -> 讀返雲端嘅更表
//   PUT /api/roster/<token>   -> 寫上去（帶 version；版本唔對就 409，唔會無聲蓋掉）
//
// 設計上刻意冇 listing：冇 token 就冇入口，`/api/roster/` 一律 404，
// 所以唔可以 enumerate 出任何記錄。token 由用戶自己保管（只存佢自己部機）。
// 呢個係「靠 URL 保密」，唔係認證 —— 攞到條 URL 嘅人讀寫得到。

const TOKEN_RE = /^[a-z0-9]{20,64}$/
const MAX_BYTES = 128 * 1024
const CODE_RE = /^[A-Z0-9-]{1,10}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_OVERRIDES = 400
const MAX_NAME = 40 // 同 lib/tml-roster.js 一致，唔好上傳再下載靜靜變短

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
  let count = 0
  for (const [date, code] of Object.entries(input.overrides ?? {})) {
    if (++count > MAX_OVERRIDES) break
    const clean = String(code ?? "").trim().toUpperCase()
    if (DATE_RE.test(date) && CODE_RE.test(clean)) overrides[date] = clean
  }

  return { schema: 1, title, rows, numbers, names, anchor, overrides }
}

// 編更備份寄電郵：POST /api/backup { name, text }。收件人喺 Worker 嗰邊設定
// （secret BACKUP_TO），repo 同網頁都唔會寫出電郵地址；用 Resend 寄（secret RESEND_API_KEY，
// 可選 BACKUP_FROM，預設 Resend 嘅測試寄件人，只寄得去 Resend 帳戶本身嘅電郵）。
// 收件人固定，所以人哋最多只能寄嘢俾 owner；再加每日上限，唔好被人塞爆。
const BACKUP_MAX = 1024 * 1024
const BACKUP_PER_DAY = 30
const BACKUP_NAME_RE = /^roster-\d{4}-\d{2}-\d{2}-v\d{1,3}\.json$/

function base64(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

async function mailBackup(request, env) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } })
  if (!env.RESEND_API_KEY || !env.BACKUP_TO) return reply({ ok: false, reason: "not_configured" }, 503)
  const raw = await request.text()
  if (raw.length > BACKUP_MAX) return reply({ ok: false, reason: "too_large" }, 413)
  let body = null
  try {
    body = JSON.parse(raw)
    if (JSON.parse(body.text).app !== "tml-plan") body = null
  } catch {
    body = null
  }
  if (!body || !BACKUP_NAME_RE.test(String(body.name ?? ""))) return reply({ ok: false, reason: "bad_shape" }, 400)
  const day = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10) // 香港日期
  const countKey = `backup-mail:${day}`
  const sent = Number((await env.ROSTER_KV.get(countKey)) ?? 0)
  if (sent >= BACKUP_PER_DAY) return reply({ ok: false, reason: "too_many" }, 429)
  await env.ROSTER_KV.put(countKey, String(sent + 1), { expirationTtl: 2 * 86400 })
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.BACKUP_FROM || "編更備份 <onboarding@resend.dev>",
      to: [env.BACKUP_TO],
      subject: `編更備份 ${body.name}`,
      text: `附件係編更備份 ${body.name}。要還原：編更頁 → 匯入同備份 → 匯入備份，貼上檔案內容。`,
      attachments: [{ filename: body.name, content: base64(body.text) }],
    }),
  })
  if (!response.ok) return reply({ ok: false, reason: "send_failed", status: response.status }, 502)
  return reply({ ok: true })
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
    if (parts[0] === "api" && parts[1] === "ping") return reply({ ok: true, sync: true })
    if (parts[0] === "api" && parts[1] === "backup" && parts.length === 2) return mailBackup(request, env)
    if (parts.length < 2 || parts[0] !== "api" || parts[1] !== "roster") {
      return reply({ ok: false, reason: "not_found" }, 404)
    }
    const token = parts[2]
    if (!token) return reply({ ok: false, reason: "not_found" }, 404) // 冇 listing
    if (!TOKEN_RE.test(token)) return reply({ ok: false, reason: "bad_token" }, 400)
    if (parts.length > 3) return reply({ ok: false, reason: "not_found" }, 404)

    const key = `roster:${token}`

    if (request.method === "GET") {
      const stored = await env.ROSTER_KV.get(key, "json")
      if (!stored) return reply({ ok: false, reason: "empty" }, 404)
      return reply({ ok: true, record: stored })
    }

    if (request.method !== "PUT") {
      return new Response(null, { status: 405, headers: { allow: "GET, PUT", "cache-control": "no-store" } })
    }

    const text = await request.text()
    if (text.length > MAX_BYTES) return reply({ ok: false, reason: "too_large" }, 413)
    let body = null
    try {
      body = JSON.parse(text)
    } catch {
      return reply({ ok: false, reason: "bad_json" }, 400)
    }
    const clean = cleanRecord(body)
    if (!clean) return reply({ ok: false, reason: "bad_shape" }, 400)

    const stored = await env.ROSTER_KV.get(key, "json")
    const wanted = Number(body.version ?? 0)
    const cloudVersion = Number(stored?.version ?? 0)
    // 有人改過（雲端版本同你手上嘅唔一樣）就停手，等用戶揀，除非明確 force。
    if (stored && wanted !== cloudVersion && body.force !== true) {
      return reply({
        ok: false,
        reason: "conflict",
        cloud: { version: cloudVersion, updatedAt: stored.updatedAt ?? "", title: stored.title ?? "" },
      }, 409)
    }

    const record = { ...clean, updatedAt: new Date().toISOString(), version: (stored ? cloudVersion : 0) + 1 }
    await env.ROSTER_KV.put(key, JSON.stringify(record))
    return reply({ ok: true, version: record.version, updatedAt: record.updatedAt })
  },
}
