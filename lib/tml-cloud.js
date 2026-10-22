// 我的更表同編更共用嘅雲端小工具：token、裝置名、香港時間、token log 電郵。
// 冇 DOM，測試可以直接 import。

export const TOKEN_RE = /^[a-z0-9]{20,64}$/

// 32 個 [a-z0-9] 字元，用 crypto.getRandomValues；捨棄 >= 252 嘅值，令每個字元機會均等。
export function newToken() {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789"
  let out = ""
  while (out.length < 32) {
    for (const byte of crypto.getRandomValues(new Uint8Array(48))) {
      if (byte < 252 && out.length < 32) out += abc[byte % 36]
    }
  }
  return out
}

// 由瀏覽器資料估部機叫咩，例如「iPhone · Safari」；寫入 log 同備份電郵。
export function guessDevice(ua = "") {
  const os = /iPad/.test(ua) ? "iPad"
    : /iPhone/.test(ua) ? "iPhone"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux"
    : "裝置"
  const browser = /Edg\//.test(ua) ? "Edge"
    : /CriOS|Chrome\//.test(ua) ? "Chrome"
    : /FxiOS|Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : ""
  return browser ? `${os} · ${browser}` : os
}

// 雲端時間一律用香港時間顯示（Worker 存嘅係 UTC ISO，直接 slice 會慢 8 個鐘）。
export function hkStamp(value) {
  const ms = Date.parse(String(value ?? ""))
  if (!Number.isFinite(ms)) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(ms))
  const g = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const hour = g.hour === "24" ? "00" : g.hour
  return `${g.year}-${g.month}-${g.day} ${hour}:${g.minute}`
}

// 內容嘅指紋（FNV-1a），用嚟知道上次同步之後有冇改過。
export function fingerprint(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

// POST 一份 JSON，回 { ok, reason }；離線或者冇 Worker（GitHub Pages）就係 offline。
export async function postJson(url, body) {
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const out = await response.json().catch(() => ({}))
    return out.ok ? { ok: true } : { ok: false, reason: out.reason ?? "offline" }
  } catch {
    return { ok: false, reason: "offline" }
  }
}

// token log 電郵：app = "roster" | "plan"，event = "new"（產生）| "join"（貼上另一條）。
export const logToken = (url, app, event, token, device) => postJson(url, { app, event, token, device })

// 電郵寄唔到嘅原因，顯示俾用戶睇
export const MAIL_WHY = {
  not_configured: "未設定電郵",
  too_many: "今日寄得太多",
  rate_limited: "太密，請一分鐘後再試",
  offline: "連唔到伺服器",
  send_failed: "郵件服務出錯",
  too_large: "檔案太大",
  bad_shape: "檔案格式唔啱",
}
export const mailWhy = (reason) => MAIL_WHY[reason] ?? String(reason ?? "")
