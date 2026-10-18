// 一週嘅顯示用計算：週標題、附近行、週概況。
// Pure: 冇 DOM、冇 storage。資料由外面用 callback 餵入，所以可以單獨測。
import { classify } from "./tml-roster.js"

// 週標題：帶年份，同年只寫一次。
// 2026-10-12…18 → "2026/10/12 – 10/18"；跨年 2026-12-28…2027-01-03 → "2026/12/28 – 2027/1/3"
export function weekLabel(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return ""
  const md = (date) => {
    const [, month, day] = String(date).split("-").map(Number)
    return `${month}/${day}`
  }
  const first = dates[0]
  const last = dates[dates.length - 1]
  const y1 = String(first).slice(0, 4)
  const y2 = String(last).slice(0, 4)
  return `${y1}/${md(first)} – ${y1 === y2 ? md(last) : `${y2}/${md(last)}`}`
}

// 當前嗰行附近嘅行（roster 太長時只顯示附近）。回傳 index 陣列，唔會負數或越界。
export function nearRows(list, cur, span = 4) {
  const rows = list?.rows ?? []
  if (!rows.length) return []
  const at = (list.numbers ?? []).indexOf(cur)
  const i = at === -1 ? 0 : at
  return rows.map((_, k) => k).slice(Math.max(0, i - span), Math.min(rows.length, i + span + 1))
}

// 一週概況：開工日數、總工時、休息／假期／待定日數。
// entryOf(date) → dayEntry；cellOf(code) → { on, duty, basic }（未載入嘅日子俾 on = null）。
export function summariseWeek(dates, entryOf, cellOf) {
  const sum = { days: 0, minutes: 0, rest: 0, leave: 0, pending: 0 }
  for (const date of dates ?? []) {
    const entry = entryOf(date)
    if (!entry) continue
    const kind = classify(entry.code).kind
    if (kind === "status") {
      if (entry.code === "RD") sum.rest += 1
      else sum.leave += 1
      continue
    }
    // 後備更（KSP／HSP 等）同日班一樣要計開工日同工時，只係冇 duty sheet。
    const cell = cellOf(entry.code) ?? {}
    if (cell.on == null) {
      sum.pending += 1
      continue
    }
    sum.days += 1
    // 工時優先序：duty sheet 嘅工作時數 → Index 表嘅時數 → 上落班差
    const work = cell.duty?.work
    const off = cell.duty?.off?.[0] ?? cell.basic?.off ?? null
    if (work != null) sum.minutes += work
    else if (cell.basic?.hours) sum.minutes += cell.basic.hours * 60
    else if (off != null && off > cell.on) sum.minutes += (off - cell.on) / 60
  }
  sum.minutes = Math.round(sum.minutes)
  return sum
}
