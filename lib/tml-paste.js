// 編更嘅匯入／匯出：由 Excel 貼上「Staff Roster - Train Crew Unit」（Tab 分隔），
// 同埋複製返出去 Excel 嘅文字。純函數，冇 DOM、冇儲存。
//
// 貼入嘅內容唔靠固定位置，靠條件搵：
//   - 標題行 = 有「Rota No.」同「Name」兩格；Name 之後到「Remarks」之前係七日，
//     每日兩格（更份編號、時數）；日期（21/9/2026 ...）喺標題行，用嚟對位。
//   - 「WK : 39 /26」嗰行（標題行之前）係週數同年份。
//   - 標題行之後，每行 Rota 係數字先當一行；七日入面見到 TRA 就停（TRA 同事唔要）。
//   - Zvacant 空缺行：保留行號（輪班循環要用），但冇名。
// 員工資料只喺使用者嘅瀏覽器，呢個檔同測試都冇真人名。

import { addDays, isDate, mondayOf, newRoster } from "./tml-roster.js"
import { isoWeek } from "./tml-plan.js"

const CODE_RE = /^[0-9A-Z/]{1,10}$/
const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

// 貼入嘅一格：去頭尾空格（包括 Excel 帶入嘅不換行空格）。
const clean = (cell) => String(cell ?? "").replace(/[ ​]/g, " ").trim()

function isoDate(text) {
  const m = DATE_RE.exec(text)
  if (!m) return null
  const date = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  return isDate(date) ? date : null
}

// WK 行：「WK :  ...  39  /26」→ { week: 39, year: 2026 }；搵唔到就 null。
function readWeek(cells) {
  const at = cells.findIndex((cell) => /(^|\s)WK\s*:?$/i.test(cell))
  if (at === -1) return null
  const rest = cells.slice(at + 1).filter(Boolean)
  const week = rest.map((cell) => /^\d{1,2}$/.exec(cell)?.[0]).find(Boolean)
  const year = rest.map((cell) => /^\/\s*(\d{2}|\d{4})$/.exec(cell)?.[1]).find(Boolean)
  if (!week) return null
  return { week: Number(week), year: year ? (year.length === 2 ? 2000 + Number(year) : Number(year)) : null }
}

// 同一個代碼喺貼入資料出現幾個時數：取最多嗰個；有唔同嘅記低畀人知。
function hoursTable(rows) {
  const seen = {}
  for (const row of rows) {
    row.codes.forEach((code, d) => {
      const hours = row.hours[d]
      if (hours == null) return
      const list = (seen[code] ??= new Map())
      list.set(hours, (list.get(hours) ?? 0) + 1)
    })
  }
  const hours = {}
  const mixed = []
  for (const [code, list] of Object.entries(seen)) {
    const ranked = [...list.entries()].sort((a, b) => b[1] - a[1])
    hours[code] = ranked[0][0]
    if (ranked.length > 1) mixed.push({ code, hours: ranked.map(([h]) => h) })
  }
  hours.RD = 0
  return { hours, mixed }
}

// 讀貼入嘅文字。回傳 { issues, rows, week, monday, dates, hours, mixed, vacant, stoppedAt }：
// issues 非空就唔可以匯入。rows: [{ rota, name, codes[7], hours[7], remark, vacant }]。
export function parsePaste(text) {
  const out = { issues: [], rows: [], week: null, monday: null, dates: [], hours: {}, mixed: [], vacant: 0, stoppedAt: null }
  const lines = String(text ?? "").replace(/^﻿/, "").split(/\r?\n/).map((line) => line.split("\t").map(clean))
  let head = -1
  let iRota = -1
  let iName = -1
  for (let i = 0; i < lines.length && head === -1; i += 1) {
    const r = lines[i].findIndex((cell) => /^rota\s*no\.?$/i.test(cell))
    const n = lines[i].findIndex((cell) => /^name$/i.test(cell))
    if (r !== -1 && n !== -1 && n > r) [head, iRota, iName] = [i, r, n]
  }
  if (head === -1) {
    out.issues.push("搵唔到標題行（要有「Rota No.」同「Name」）。請由 Excel 複製成份 Staff Roster 再貼上。")
    return out
  }
  for (let i = 0; i < head; i += 1) out.week ??= readWeek(lines[i])
  const header = lines[head]
  const iRemarks = header.findIndex((cell, i) => i > iName && /^remarks?$/i.test(cell))
  if (iRemarks === -1) {
    out.issues.push("標題行搵唔到「Remarks」欄。")
    return out
  }
  const dateAt = []
  header.forEach((cell, i) => {
    if (i > iName && i < iRemarks && isoDate(cell)) dateAt.push(i)
  })
  const dates = dateAt.map((i) => isoDate(header[i]))
  const spaced = dateAt.every((at, k) => k === 0 || at - dateAt[k - 1] === 2)
  const consecutive = dates.every((date, k) => k === 0 || date === addDays(dates[k - 1], 1))
  if (dates.length !== 7 || !spaced || dateAt[6] + 2 !== iRemarks) {
    out.issues.push(`標題行應該有七日日期（每日兩格，去到 Remarks 為止），而家讀到 ${dates.length} 日。`)
    return out
  }
  if (!consecutive || mondayOf(dates[0]) !== dates[0]) out.issues.push("標題行嘅日期唔係由星期一開始嘅連續七日。")
  out.dates = dates
  out.monday = dates[0]
  const seen = new Set()
  for (let i = head + 1; i < lines.length; i += 1) {
    const cells = lines[i]
    if (!/^\d{1,4}$/.test(cells[iRota] ?? "")) continue
    const rota = Number(cells[iRota])
    const codes = dateAt.map((at) => (cells[at] ?? "").toUpperCase().replace(/\s+/g, ""))
    if (codes.includes("TRA")) {
      out.stoppedAt = rota
      break
    }
    const hours = dateAt.map((at) => {
      const value = parseFloat(cells[at + 1])
      return Number.isFinite(value) ? value : null
    })
    const bad = codes.findIndex((code) => !CODE_RE.test(code))
    if (bad !== -1) {
      out.issues.push(`行號 ${rota} 第 ${bad + 1} 日「${cells[dateAt[bad]] ?? ""}」認不出。`)
      continue
    }
    if (seen.has(rota)) out.issues.push(`行號 ${rota} 出現多過一次。`)
    seen.add(rota)
    const name = (cells[iName] ?? "").replace(/\s+/g, " ")
    const vacant = !name || /^z?vacant$/i.test(name)
    if (vacant) out.vacant += 1
    out.rows.push({ rota, name: vacant ? "" : name.slice(0, 40), codes, hours, remark: clean(cells[iRemarks]).slice(0, 12), vacant })
  }
  if (!out.rows.some((row) => !row.vacant)) out.issues.push("標題行之後讀唔到任何一位同事。")
  Object.assign(out, hoursTable(out.rows))
  return out
}

// 貼入嘅週數／年份同日期對唔對得上：{ week, year, agree }（冇 WK 行就 agree = null）。
export function pasteWeek(parsed) {
  if (!parsed.monday) return null
  const { week, year } = isoWeek(parsed.monday)
  const wk = parsed.week
  return { week, year, agree: wk ? wk.week === week && (wk.year == null || wk.year === year) : null, wk }
}

export const nameKey = (name) => String(name ?? "").trim().replace(/\s+/g, " ").toLowerCase()

// 預先剔好邊啲人：上次組員（按英文全名對）。第一次匯入冇組員就全部唔剔。
export function preTicked(parsed, previousNames = []) {
  const keys = new Set(previousNames.filter(Boolean).map(nameKey))
  return new Set(parsed.rows.flatMap((row, i) => (!row.vacant && keys.has(nameKey(row.name)) ? [i] : [])))
}

// 上次組員但今次貼入冇嘅名。
export function leftNames(parsed, previousNames = []) {
  const now = new Set(parsed.rows.filter((row) => !row.vacant).map((row) => nameKey(row.name)))
  return previousNames.filter((name) => name && !now.has(nameKey(name)))
}

// 同名要剔多個（同一個名喺貼入出現幾次）：回傳重複嘅名。
export function dupNames(parsed, ticked) {
  const count = new Map()
  for (const i of ticked) count.set(nameKey(parsed.rows[i].name), (count.get(nameKey(parsed.rows[i].name)) ?? 0) + 1)
  return parsed.rows.filter((row, i) => ticked.has(i) && count.get(nameKey(row.name)) > 1).map((row) => row.name)
}

// 貼入 + 剔選 → 編更用嘅 Standard Roster：全部行（輪班循環要）但只有剔咗嘅人有名同 Remarks；
// hours = 貼入資料嘅 { 代碼: 時數 }。其他同事嘅名唔存。
export function buildRoster(parsed, ticked) {
  const names = parsed.rows.map((row, i) => (ticked.has(i) ? row.name : ""))
  const remarks = parsed.rows.map((row, i) => (ticked.has(i) ? row.remark : ""))
  const base = newRoster({ rows: parsed.rows.map((row) => row.codes), numbers: parsed.rows.map((row) => row.rota), names }, { row: parsed.rows[0].rota, monday: parsed.monday })
  return { ...base, remarks, hours: parsed.hours }
}

// 編更自己存嘅 Standard Roster（比我的更表嘅 cleanRoster 闊：代碼可以係 S、OJTEPIC、HC/AL ...，
// 另外有 remarks 同貼入時數）。唔啱就 null。
export function cleanPlanRoster(value) {
  if (!value || value.v !== 1 || !Array.isArray(value.rows) || !value.rows.length) return null
  const rows = value.rows.map((row) => (Array.isArray(row) && row.length === 7 ? row.map((code) => String(code ?? "").toUpperCase().replace(/\s+/g, "")) : null))
  if (rows.some((row) => !row || row.some((code) => !CODE_RE.test(code)))) return null
  const numbers = Array.isArray(value.numbers) && value.numbers.length === rows.length ? value.numbers.map(Number) : rows.map((_, i) => i + 1)
  if (numbers.some((n) => !Number.isInteger(n)) || new Set(numbers).size !== numbers.length) return null
  const list = (items, max) => (Array.isArray(items) && items.length === rows.length ? items.map((item) => String(item ?? "").slice(0, max)) : rows.map(() => ""))
  const anchor = value.anchor && isDate(value.anchor.monday) && numbers.includes(Number(value.anchor.row))
    ? { row: Number(value.anchor.row), monday: mondayOf(value.anchor.monday) }
    : null
  if (!anchor) return null
  const hours = {}
  for (const [code, h] of Object.entries(value.hours ?? {})) {
    if (CODE_RE.test(code) && Number.isFinite(h) && h >= 0 && h <= 24) hours[code] = h
  }
  return { ...newRoster({ rows, numbers, names: list(value.names, 40) }, anchor), remarks: list(value.remarks, 12), hours }
}

/* ------------------------------------------------------------------ 時數 */

// 假期類代碼（唔係開工日）：AL、GH、PH、SH、SSL、LSL、NPL、CL 同佢哋嘅時數變體（AL7、SH85 ...），
// 加 CP、compL、SL、WB、RD、HC/AL、MA、MG。duty no. 表入面嘅 NIL 只代表冇固定時間，唔等於假期。
const LEAVE_RE = /^((AL|GH|PH|SH|SSL|LSL|NPL|CL)\d*|CP|COMPL|SL|WB|RD|HC\/AL|MA|MG)$/
export const isLeaveCode = (code) => LEAVE_RE.test(String(code ?? "").toUpperCase())

// duty no. 表（data/duty-codes.json 嘅 codes: { 代碼: [工時, 上班, 落班] }）入面有上下班嘅代碼。
// 休息、假期、HC／TBC 唔當有時間嘅更份。
export function tableTime(code, table) {
  const key = String(code ?? "").toUpperCase()
  const row = table?.[key]
  if (!row || row[1] == null || row[2] == null || isLeaveCode(key) || key === "HC" || key === "TBC") return null
  return { on: row[1], off: row[2], hours: row[0] }
}

// 一格嘅工時：貼入資料永遠優先；跟住係更份本身（t = 有上下班嘅更份）、
// 其他代碼表（extra），最後先係 duty no. 表。RD 係 0。
export function cellHours(code, { time = null, pasted = {}, extra = () => 0, table = {} } = {}) {
  const key = String(code ?? "").toUpperCase()
  if (key === "RD") return 0
  if (pasted[key] != null) return pasted[key]
  return time?.hours || extra(key) || table[key]?.[0] || 0
}

/* ------------------------------------------------------------------ 組員排序 */

// Remarks 預設次序 E、L、HC、AL，其他排後面。
export const REMARK_ORDER = ["E", "L", "HC", "AL"]

// mode: "default"（E、L、HC、AL）、"asc"（A–Z）、"desc"（Z–A）。同 Remarks 入面按行號；冇 Remarks 排最後。
export function byRemark(mode = "default") {
  const text = (line) => String(line.member.remark ?? "").trim().toUpperCase()
  const rank = (line) => {
    const at = REMARK_ORDER.indexOf(text(line))
    return at === -1 ? REMARK_ORDER.length : at
  }
  return (a, b) => {
    const [x, y] = [text(a), text(b)]
    if (!x !== !y) return x ? -1 : 1
    if (mode === "default" && rank(a) !== rank(b)) return rank(a) - rank(b)
    if (mode !== "default" && x !== y) return (mode === "desc" ? -1 : 1) * x.localeCompare(y, "en")
    if (mode === "default" && x !== y) return x.localeCompare(y, "en")
    return a.row - b.row
  }
}

// 撳一下 Remarks：預設 → A–Z → Z–A → 還原預設。
export const nextRemarkMode = (mode) => (mode === "default" ? "asc" : mode === "asc" ? "desc" : "default")

/* ------------------------------------------------------------------ 匯出 */

const hoursText = (hours) => String(Math.round(hours * 100) / 100)

// 匯出頭幾格：Rota No.（呢個星期嘅行號）、英文名、Remarks、星期一至日更份、七日總工時。
// 冇標題行，Tab 分隔，一行一位，貼落 Excel 自動分格。空格（未編）留白。
// order: "name"（英文名 A–Z）或者 "rota"。hoursOf(code, dayIndex) 係一格嘅工時。
export function exportText(lines, hoursOf, order = "name") {
  const sorted = [...lines].sort((a, b) => (order === "rota" ? 0 : a.member.name.localeCompare(b.member.name, "en", { sensitivity: "base" })) || a.row - b.row)
  return sorted.map((line) => {
    const total = line.codes.reduce((sum, code, d) => sum + (code === "-" ? 0 : hoursOf(code, d)), 0)
    return [line.row, line.member.name, line.member.remark ?? "", ...line.codes.map((code) => (code === "-" ? "" : code)), hoursText(total)].join("\t")
  }).join("\n")
}

// 未編（空格）嘅數量。
export const emptyCount = (lines) => lines.reduce((sum, line) => sum + line.codes.filter((code) => code === "-").length, 0)
