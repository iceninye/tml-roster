// A personal roster: which duty a person works on which day.
// Pure functions, no storage and no DOM. The roster itself never leaves the
// user's browser (the app keeps it in localStorage); only these helpers live
// in the repo.
//
// A roster is a cycle of weekly rows, Monday to Sunday. The person works one
// row a week and goes back to the first row after the last. A row cell is a
// 7-digit duty number (the first four digits are the Duty Sheet), or a status
// such as RD, AL, SH, HC, or a spare duty such as HSP1 / KSP3.
//
// Saved shape: { v: 1, rows: [[7 cells], ...], numbers: [row labels],
//                names: [one name per row, "" when none],
//                anchor: { row, monday }, overrides: { "YYYY-MM-DD": code } }
// A row of seven TBC cells is a person without a roster yet: it is kept in the
// table but is not part of the weekly cycle and stays on its own row.
// anchor says "in the week starting on monday I work the row labelled row".

const DAY_MS = 86_400_000

export const STATUS = ["RD", "AL", "SH", "HC"]

const dayNumber = (date) => {
  const [y, m, d] = date.split("-").map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}
const fromDayNumber = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10)

export function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return fromDayNumber(dayNumber(value)) === value
}

// 0 = Monday ... 6 = Sunday.
export function weekdayIndex(date) {
  return (((dayNumber(date) + 3) % 7) + 7) % 7
}

export function mondayOf(date) {
  return fromDayNumber(dayNumber(date) - weekdayIndex(date))
}

export function addDays(date, days) {
  return fromDayNumber(dayNumber(date) + days)
}

export function weekDates(monday) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

// What a cell is: { kind: "duty", sheet, id } | { kind: "status" | "spare" | "other", code }.
export function classify(code) {
  const c = String(code ?? "").trim().toUpperCase()
  if (/^\d{7}$/.test(c)) return { kind: "duty", sheet: c.slice(0, 4), id: c, code: c }
  if (STATUS.includes(c)) return { kind: "status", code: c }
  if (/^[HK]SP\d?$/.test(c)) return { kind: "spare", code: c }
  return { kind: "other", code: c }
}

// A cell as typed by the user: letters and digits only, upper case; an empty
// string is not a valid cell. Returns null when it cannot be one.
export function normaliseCode(value) {
  const c = String(value ?? "").replace(/\s+/g, "").toUpperCase()
  return /^(\d{7}|[A-Z]{1,4}\d{0,2})$/.test(c) ? c : null
}

// Read pasted rows. Cells split on tabs, else commas, else white space.
// A header line (Mon, Tue ...) and blank lines are skipped. When a line has
// 8 cells and the first is a number, that number is the row's label; with 9
// cells the second is also the person's name (a "Name" column), as in
// ",Name,Mon,Tue,Wed,Thu,Fri,Sat,Sun". Otherwise rows are labelled 1, 2, 3 ...
// in order.
// CSV 一行拆格，識得雙引號（"Chan, Tai Man" 入面嘅逗號唔拆，"" 係一個引號）。
function splitLine(line, sep) {
  if (typeof sep !== "string" || !line.includes('"')) return line.split(sep)
  const cells = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quoted) {
      if (ch !== '"') cell += ch
      else if (line[i + 1] === '"') { cell += '"'; i += 1 } else quoted = false
    } else if (ch === '"') quoted = true
    else if (ch === sep) { cells.push(cell); cell = "" } else cell += ch
  }
  cells.push(cell)
  return cells
}

export function parseRoster(text) {
  const rows = []
  const numbers = []
  const names = []
  const issues = []
  const lines = String(text ?? "").split(/\r?\n/)
  lines.forEach((line, i) => {
    if (!line.trim()) return
    const sep = line.includes("\t") ? "\t" : line.includes(",") ? "," : /\s+/
    let cells = splitLine(line, sep).map((cell) => (typeof sep === "string" ? cell : cell.replace(/^"|"$/g, "")).trim())
    if (/^(mon|一|星期一|週一)/i.test(cells.find((cell) => cell) ?? "") || cells.some((cell) => /^(mon|monday|星期一|週一)$/i.test(cell))) return
    let label = null
    let name = ""
    const where = /^\d{1,4}$/.test(cells[0]) ? `行號 ${cells[0]}` : `第 ${i + 1} 行`
    if (cells.length === 9 && /^\d{1,4}$/.test(cells[0])) {
      label = Number(cells[0])
      name = cells[1].slice(0, 40)
      cells = cells.slice(2)
    } else if (cells.length === 8 && /^\d{1,4}$/.test(cells[0])) {
      label = Number(cells[0])
      cells = cells.slice(1)
    } else if (cells.length === 8 && cells[0] === "") {
      cells = cells.slice(1)
    }
    if (cells.length !== 7) {
      issues.push(`${where}有 ${cells.length} 格，應該是 7 格（週一至週日）`)
      return
    }
    const codes = cells.map((cell) => normaliseCode(cell))
    const bad = codes.findIndex((code) => code === null)
    if (bad !== -1) {
      issues.push(`${where}第 ${bad + 1} 格「${cells[bad]}」認不出`)
      return
    }
    rows.push(codes)
    numbers.push(label ?? rows.length)
    names.push(name)
  })
  return { rows, numbers, names, issues }
}

const isPending = (row) => row.every((cell) => cell === "TBC")

// The label of the row a person on row `label` works `weeks` weeks later (null
// when the roster has no such row). A row of all TBC does not rotate.
export function rowAfter(roster, label, weeks) {
  const at = roster.numbers.indexOf(Number(label))
  if (at === -1) return null
  if (isPending(roster.rows[at])) return roster.numbers[at]
  const cycle = roster.rows.map((row, i) => i).filter((i) => !isPending(roster.rows[i]))
  const n = cycle.length
  return roster.numbers[cycle[((cycle.indexOf(at) + weeks) % n + n) % n]]
}

// Row index in the cycle for a week, or -1 when the roster has no anchor.
function rowIndex(roster, monday) {
  const anchor = roster.anchor
  if (!roster.rows.length || !anchor) return -1
  const label = rowAfter(roster, anchor.row, Math.round((dayNumber(monday) - dayNumber(anchor.monday)) / 7))
  return label == null ? -1 : roster.numbers.indexOf(label)
}

// The label of the row worked in the week starting on monday (null = no roster).
export function rowLabelFor(roster, monday) {
  const i = rowIndex(roster, monday)
  return i === -1 ? null : roster.numbers[i]
}

// The cell for a date: the user's own entry for that day when there is one,
// else the cycle's. null without a usable roster.
//   { code, source: "override" | "cycle", defaultCode, row }
export function dayEntry(roster, date) {
  if (!roster || !isDate(date)) return null
  const i = rowIndex(roster, mondayOf(date))
  if (i === -1) return null
  const defaultCode = roster.rows[i][weekdayIndex(date)]
  const own = roster.overrides?.[date]
  return {
    code: own ?? defaultCode,
    source: own ? "override" : "cycle",
    defaultCode,
    row: roster.numbers[i],
  }
}

// Set (or with null / the cycle's own cell, clear) one day. Returns a new roster.
export function setOverride(roster, date, code) {
  const overrides = { ...(roster.overrides ?? {}) }
  const entry = dayEntry(roster, date)
  if (code == null || (entry && code === entry.defaultCode)) delete overrides[date]
  else overrides[date] = code
  return { ...roster, overrides }
}

// 同步上傳前刪走超過一年前嘅手動改動（Worker 最多收 400 個，超過會拒絕）。
export function recentOverrides(overrides, today) {
  const from = addDays(today, -366)
  return Object.fromEntries(Object.entries(overrides ?? {}).filter(([date]) => date >= from))
}

export function newRoster({ rows, numbers, names }, anchor) {
  return { v: 1, rows, numbers, names: names ?? rows.map(() => ""), anchor, overrides: {} }
}

// Check a saved or imported roster; returns it cleaned, or null when unusable.
export function cleanRoster(value) {
  if (!value || value.v !== 1 || !Array.isArray(value.rows) || !value.rows.length) return null
  const rows = value.rows.map((row) => (Array.isArray(row) && row.length === 7 ? row.map(normaliseCode) : null))
  if (rows.some((row) => !row || row.includes(null))) return null
  const numbers = Array.isArray(value.numbers) && value.numbers.length === rows.length
    ? value.numbers.map(Number)
    : rows.map((_, i) => i + 1)
  if (numbers.some((n) => !Number.isInteger(n)) || new Set(numbers).size !== numbers.length) return null
  const names = Array.isArray(value.names) && value.names.length === rows.length
    ? value.names.map((name) => String(name ?? "").slice(0, 40))
    : rows.map(() => "")
  const anchor = value.anchor && isDate(value.anchor.monday) && numbers.includes(Number(value.anchor.row))
    ? { row: Number(value.anchor.row), monday: mondayOf(value.anchor.monday) }
    : null
  if (!anchor) return null
  const overrides = {}
  for (const [date, code] of Object.entries(value.overrides ?? {})) {
    const clean = normaliseCode(code)
    if (isDate(date) && clean) overrides[date] = clean
  }
  return { v: 1, rows, numbers, names, anchor, overrides }
}
