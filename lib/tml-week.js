// 一週嘅顯示用計算：週標題、附近行、週概況。
// Pure: 冇 DOM、冇 storage。資料由外面用 callback 餵入，所以可以單獨測。
import { classify } from "./tml-roster.js"
import { isOffCode } from "./tml-extra.js"
import { extraOtMinutes } from "./tml-ot.js"

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

// 一週（或者一個月）概況：開工日數、總工時、OT、休息／假期／待定日數。
// entryOf(date) → dayEntry（可以有 ot）；cellOf(code, date) → { on, duty, basic }（未載入嘅日子俾 on = null）。
// OT（lib/tml-ot.js）：成更 OT 嘅工時計入 ot 唔計 minutes，但照計開工日；更前／更後 OT 只計 ot。
export function summariseWeek(dates, entryOf, cellOf) {
  const sum = { days: 0, minutes: 0, ot: 0, rest: 0, leave: 0, pending: 0 }
  for (const date of dates ?? []) {
    const entry = entryOf(date)
    if (!entry) continue
    sum.ot += extraOtMinutes(entry.ot)
    const whole = entry.ot?.whole === true
    const kind = classify(entry.code).kind
    if (kind === "status") {
      // HC 係待定（未有更份），唔係假期。
      if (entry.code === "RD") sum.rest += 1
      else if (entry.code === "HC") sum.pending += 1
      else sum.leave += 1
      continue
    }
    // 其他代碼（lib/tml-extra.js）：CL、CP 等係假期。
    if (isOffCode(entry.code)) {
      sum.leave += 1
      continue
    }
    // 後備更（KSP／HSP 等）同日班一樣要計開工日同工時，只係冇 duty sheet。
    const cell = cellOf(entry.code, date) ?? {}
    // 開工日代碼（TRG、SPT7 等）冇上下班時間，但有工時：cell.extraHours。
    if (cell.on == null && cell.extraHours == null) {
      sum.pending += 1
      continue
    }
    sum.days += 1
    const key = whole ? "ot" : "minutes"
    if (cell.on == null) {
      sum[key] += cell.extraHours * 60
      continue
    }
    // 工時以官表（duty-basic.json 嘅 Index 表）為準：佢同人手對數一致。
    // duty sheet 嘅 work 有時同官表差 0.5（例如 1101131 係 8 vs 7.5），所以只做後備。
    const work = cell.duty?.work
    const off = cell.duty?.off?.[0] ?? cell.basic?.off ?? null
    if (cell.basic?.hours != null) sum[key] += cell.basic.hours * 60
    else if (work != null) sum[key] += work
    else if (off != null && off > cell.on) sum[key] += (off - cell.on) / 60
  }
  sum.minutes = Math.round(sum.minutes)
  sum.ot = Math.round(sum.ot)
  return sum
}
