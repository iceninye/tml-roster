// OT（加班）：我的更表每日可以有一個 OT 記錄，同更份代號分開存（roster.ot）。
//   { whole: true }              成更 OT：當日嘅更份成更計 OT（例如 RD 返 1101150，OT 7 小時）
//   { before: 60, after: 210 }   更前／更後 OT，單位分鐘（例如放工後再做 3.5 小時）
// 兩樣可以一齊有。OT 日計開工日；OT 時數同正常工時分開計（Ice 2026-10-24）。
// Pure：冇 DOM、冇 storage。

import { addDays, isDate } from "./tml-roster.js"

// 更前／更後最多 12 小時
export const OT_MAX_MIN = 12 * 60

const minutes = (value) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) && n > 0 ? Math.min(OT_MAX_MIN, n) : 0
}

// 一日嘅 OT 記錄，清理好；冇 OT 就 null。
export function cleanOtDay(value) {
  if (!value || typeof value !== "object") return null
  const out = {}
  if (value.whole === true) out.whole = true
  const before = minutes(value.before)
  const after = minutes(value.after)
  if (before) out.before = before
  if (after) out.after = after
  return Object.keys(out).length ? out : null
}

// 成份 roster.ot：{ "YYYY-MM-DD": { whole?, before?, after? } }
export function cleanOt(value) {
  const out = {}
  if (!value || typeof value !== "object") return out
  for (const [date, day] of Object.entries(value)) {
    const clean = isDate(date) ? cleanOtDay(day) : null
    if (clean) out[date] = clean
  }
  return out
}

// 設定（或者 null／空就刪走）某日嘅 OT，回一份新 roster。
export function setOt(roster, date, day) {
  const ot = { ...(roster.ot ?? {}) }
  const clean = cleanOtDay(day)
  if (clean) ot[date] = clean
  else delete ot[date]
  return { ...roster, ot }
}

// 同步上傳前刪走一年前嘅 OT（同手動改動一樣）。
export function recentOt(ot, today) {
  const from = addDays(today, -366)
  return Object.fromEntries(Object.entries(ot ?? {}).filter(([date]) => date >= from))
}

// 更前／更後加埋嘅分鐘數（唔計成更）。
export const extraOtMinutes = (day) => (day?.before ?? 0) + (day?.after ?? 0)

// 「放工後 OT 至 15:50」：由一個鐘數計分鐘。base = 放工（after）或者返工（before）嘅秒數，
// clock = "HH:MM"。過咗午夜都計得（23:00 放工，OT 至 01:30 = 150 分鐘）。
export function otFromClock(base, clock, side) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(clock ?? ""))
  if (base == null || !m) return 0
  const at = Number(m[1]) * 60 + Number(m[2])
  const ref = Math.round(base / 60) % 1440
  const diff = side === "before" ? ref - at : at - ref
  return ((diff % 1440) + 1440) % 1440
}

// 反方向：OT 之後（或之前）嘅鐘數 "HH:MM"。
export function otClock(base, mins, side) {
  if (base == null) return ""
  const t = ((Math.round(base / 60) + (side === "before" ? -mins : mins)) % 1440 + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
}

// 某個日期所屬月份嘅所有日子（1 號至月尾）。
export function monthDates(date) {
  const first = `${String(date).slice(0, 7)}-01`
  const out = []
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) out.push(d)
  return out
}
