// A team plan (編更): a group of people working consecutive rows of the
// Standard Roster, whose duties are swapped between them day by day so that
// each person gets the kind of shift they prefer. Pure functions, no storage
// and no DOM; like the personal roster, a plan (names, preferences, results)
// stays in the user's browser and never goes in the repo.
//
// Every person is the row they work in the anchor week; each later week they
// move down one row and go back to the first row after the last, the same
// cycle as lib/tml-roster.js. On any one day only the duties already in the
// team's rows that day are handed round, so the day's set of duties never
// changes and no duty is worked twice. Rest days and leave (RD, AL, SH, HC)
// stay with the row; only cells with book-on/off times are swapped.
//
// Saved shape: { v: 1, anchor: monday, ranges: "31-40,55-70", rest: hours,
//   members: [{ row, name, prefs: [shift, ...] }],
//   weeks: { monday: { row: { codes: [7], pins: [7 x 0|1] } } },
//   trays: { monday: [7 x [duty, ...]] },
//   sheets: { "YYYY-MM-DD": sheet } }
// sheets sets the Duty Sheet of single dates (1101 / 6091 / 7091 / 8022 / 8023):
// the Standard Roster's duty numbers of that date keep their last three digits
// and take the sheet's first four, so 6091124 on a date set to 8022 reads 8022124.
// A cell holding EMPTY has no duty (its duty was put in the tray). The tray
// of a day holds duties taken out of cells, waiting to be dropped on a cell.
// row is the member's row in the anchor week and is their id.

import { addDays, isDate, mondayOf, rowAfter, weekdayIndex } from "./tml-roster.js"

const DAY_MS = 86_400_000
const DAY = 86400

export const EMPTY = "-"

// Rest and leave, and the codes that stand for a duty not decided yet.
const DUTY = /^\d{7}$/
export const LEAVE = ["RD", "AL", "SH"]
export const PENDING = ["HC", "TBC"]

export const SHEETS = ["1101", "6091", "7091", "8022", "8023"]

// The sheet a date uses when none is set: Monday to Friday 1101, Saturday 6091, Sunday 7091.
export const defaultSheet = (date) => ["1101", "1101", "1101", "1101", "1101", "6091", "7091"][weekdayIndex(date)]

// The Duty Sheet in force on a date.
export const sheetOf = (plan, date) => plan.sheets?.[date] ?? defaultSheet(date)

// A duty number moved to another sheet; anything else (RD, AL, HSP1 ...) is unchanged.
export const mapCode = (code, sheet) => (/^\d{7}$/.test(code) ? sheet + code.slice(4) : code)

// 死早, 早, 中, 夜, 死夜 in order of book-on, so "next to" means close in time.
export const SHIFTS = ["dawn", "early", "mid", "late", "night"]

// 死早: books on before 06:30. 死夜: books off after 00:30 (next day). The rest
// split as the week page does: early before 10:00, late from 15:00.
export function shiftOf(on, off) {
  if (on < 6.5 * 3600) return "dawn"
  if (off > DAY + 0.5 * 3600) return "night"
  return on < 10 * 3600 ? "early" : on < 15 * 3600 ? "mid" : "late"
}

// "31-40, 55-70" -> [31 ... 40, 55 ... 70], in the order typed, no repeats.
export function parseRanges(text) {
  const rows = []
  const issues = []
  for (const part of String(text ?? "").split(/[,，、\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d{1,4})(?:[-–~至](\d{1,4}))?$/)
    if (!m) {
      issues.push(`「${part}」認不出`)
      continue
    }
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    if (b < a) {
      issues.push(`「${part}」由大到細`)
      continue
    }
    for (let r = a; r <= b; r += 1) if (!rows.includes(r)) rows.push(r)
  }
  return { rows, issues }
}

// ISO 8601 week of a Monday: { year, week }. Week 1 holds the year's first Thursday.
export function isoWeek(monday) {
  const thursday = new Date(`${addDays(monday, 3)}T00:00:00Z`)
  const year = thursday.getUTCFullYear()
  const jan1 = Date.UTC(year, 0, 1)
  return { year, week: Math.floor((thursday.getTime() - jan1) / DAY_MS / 7) + 1 }
}

export function mondayOfIsoWeek(year, week) {
  const jan4 = `${year}-01-04`
  return addDays(mondayOf(jan4), (week - 1) * 7)
}

const weeksBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS / 7)

// The row label a member works in the week starting on monday, or null when
// their anchor row is not in the roster.
export function memberRow(roster, plan, member, monday) {
  return rowAfter(roster, member.row, weeksBetween(plan.anchor, monday))
}

// The rows of a roster that carry a name: the team.
export function namedRows(roster) {
  return roster.numbers.filter((_, i) => roster.names?.[i])
}

// [2, 5, 6, 7, 9] -> "2, 5-7, 9"
export function formatRanges(rows) {
  const out = []
  for (let i = 0; i < rows.length; i += 1) {
    let j = i
    while (rows[j + 1] === rows[j] + 1) j += 1
    out.push(j - i >= 2 ? `${rows[i]}-${rows[j]}` : rows.slice(i, j + 1).join(", "))
    i = j
  }
  return out.join(", ")
}

function standardCodes(roster, label) {
  return roster.rows[roster.numbers.indexOf(label)]
}

// The week as the plan has it: per member { member, row, std, codes, pins }.
// codes falls back to the Standard Roster row where nothing was planned.
export function weekView(roster, plan, monday) {
  const saved = plan.weeks?.[monday] ?? {}
  return plan.members.map((member) => {
    const row = memberRow(roster, plan, member, monday)
    const raw = row == null ? Array(7).fill("HC") : standardCodes(roster, row)
    const std = raw.map((code, d) => {
      const set = plan.sheets?.[addDays(monday, d)]
      return set ? mapCode(code, set) : code
    })
    const own = saved[member.row]
    return { member, row, std, codes: own ? [...own.codes] : [...std], pins: own ? own.pins.map(Boolean) : Array(7).fill(false) }
  })
}

// The member's cell on the day before monday (Sunday of the week before).
function lastSunday(roster, plan, monday) {
  const before = weekView(roster, plan, addDays(monday, -7))
  return new Map(before.map((line) => [line.member.row, line.codes[6]]))
}

// Seconds of rest between a duty and the next day's, or null when either has no times.
function restBetween(a, b) {
  return a && b ? b.on + DAY - a.off : null
}

// Cells with too little rest since the day before: [{ row, day, rest }] where
// rest is in seconds. timeOf(code) -> { on, off } | null.
export function restIssues(roster, plan, monday, timeOf) {
  const min = (plan.rest ?? 11) * 3600
  const prev = lastSunday(roster, plan, monday)
  const out = []
  for (const line of weekView(roster, plan, monday)) {
    for (let d = 0; d < 7; d += 1) {
      const before = d === 0 ? prev.get(line.member.row) : line.codes[d - 1]
      const rest = restBetween(timeOf(before), timeOf(line.codes[d]))
      if (rest != null && rest < min) out.push({ row: line.member.row, day: d, rest })
    }
  }
  return out
}

// How far a duty is from what the member asked for: 0 when it is one of their
// preferred kinds (or they have none), else the steps to the nearest one.
export function prefDistance(prefs, shift) {
  if (!prefs?.length || !shift) return 0
  const at = SHIFTS.indexOf(shift)
  return Math.min(...prefs.map((p) => Math.abs(SHIFTS.indexOf(p) - at)))
}

// Minimum-cost assignment on a square matrix (Hungarian method, O(n^3)).
// Returns col[i], the column given to row i.
export function assign(cost) {
  const n = cost.length
  const u = Array(n + 1).fill(0)
  const v = Array(n + 1).fill(0)
  const p = Array(n + 1).fill(0)
  const way = Array(n + 1).fill(0)
  for (let i = 1; i <= n; i += 1) {
    p[0] = i
    let j0 = 0
    const minv = Array(n + 1).fill(Infinity)
    const used = Array(n + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= n; j += 1) {
        if (used[j]) continue
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= n; j += 1) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else minv[j] -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0)
  }
  const col = Array(n).fill(-1)
  for (let j = 1; j <= n; j += 1) if (p[j]) col[p[j] - 1] = j - 1
  return col
}

const BIG = 1000

// Arrange one week: day by day, hand the team's swappable duties of that day
// to the members working it, as close to their preferences as possible, never
// below the minimum rest when that can be helped, and spreading misses so the
// same person does not keep losing out. Pinned cells (set by hand) are kept.
// Returns { plan, unassigned: [{ day, code }] }.
export function arrangeWeek(roster, plan, monday, timeOf) {
  const lines = weekView(roster, plan, monday)
  const min = (plan.rest ?? 11) * 3600
  const prev = lastSunday(roster, plan, monday)
  const misses = new Map(lines.map((line) => [line.member.row, 0]))
  const unassigned = []
  // Duties in the tray go back in the pool; rest days and leave stay where they are.
  const saved = trayView(plan, monday)
  const tray = saved.map((codes) => codes.filter((code) => !timeOf(code)))
  for (let d = 0; d < 7; d += 1) {
    // A date on a special Duty Sheet works from that sheet's duties: the tray and the unpinned cells.
    const special = Boolean(plan.sheets?.[addDays(monday, d)])
    // The day's pool: every swappable duty in the team's Standard Roster rows.
    const pool = special
      ? [...saved[d].filter((code) => timeOf(code)), ...lines.filter((line) => !line.pins[d] && timeOf(line.codes[d])).map((line) => line.codes[d])]
      : lines.filter((line) => timeOf(line.std[d])).map((line) => line.std[d])
    for (const line of lines) {
      if (!line.pins[d]) continue
      const k = pool.indexOf(line.codes[d])
      if (k !== -1) pool.splice(k, 1)
    }
    // Free cells: unpinned ones with a Standard duty, or emptied into the tray.
    const isFree = (line) => !line.pins[d] && (timeOf(line.std[d]) || line.codes[d] === EMPTY || (special && timeOf(line.codes[d])))
    const free = lines.filter(isFree)
    for (const line of lines) if (!line.pins[d] && !isFree(line)) line.codes[d] = line.std[d]
    const n = Math.max(free.length, pool.length)
    if (!n) continue
    const cost = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
      const line = free[i]
      const code = pool[j]
      if (!line) return 0 // a duty nobody here can take
      if (code == null) return BIG * 2 // a member left without a duty
      const t = timeOf(code)
      const before = timeOf(d === 0 ? prev.get(line.member.row) : line.codes[d - 1])
      const after = line.pins[d + 1] ? timeOf(line.codes[d + 1]) : null
      const tooShort = (restBetween(before, t) ?? Infinity) < min || (restBetween(t, after) ?? Infinity) < min
      const dist = prefDistance(line.member.prefs, shiftOf(t.on, t.off))
      return (tooShort ? BIG : 0) + dist * dist * 10 * (1 + 0.5 * misses.get(line.member.row)) + (code === line.std[d] ? 0 : 1)
    }))
    const col = assign(cost)
    col.forEach((j, i) => {
      const line = free[i]
      if (!line) {
        if (pool[j] != null) {
          unassigned.push({ day: d, code: pool[j] })
          tray[d].push(pool[j])
        }
        return
      }
      const code = pool[j] ?? (timeOf(line.std[d]) ? "HC" : EMPTY)
      line.codes[d] = code
      const t = timeOf(code)
      if (t && prefDistance(line.member.prefs, shiftOf(t.on, t.off)) > 0) misses.set(line.member.row, misses.get(line.member.row) + 1)
    })
  }
  return { plan: withTray(withWeek(plan, monday, lines), monday, tray.map((codes) => sortTray(codes, timeOf))), unassigned }
}

function withWeek(plan, monday, lines) {
  const week = {}
  for (const line of lines) week[line.member.row] = { codes: line.codes, pins: line.pins.map((p) => (p ? 1 : 0)) }
  return { ...plan, weeks: { ...plan.weeks, [monday]: week } }
}

const sortTray = (codes, timeOf) => [...codes].sort((a, b) => (timeOf(a)?.on ?? 0) - (timeOf(b)?.on ?? 0) || a.localeCompare(b))

// The day trays of a week: 7 lists of duties.
export function trayView(plan, monday) {
  const saved = plan.trays?.[monday]
  return Array.from({ length: 7 }, (_, d) => [...(saved?.[d] ?? [])])
}

function withTray(plan, monday, tray) {
  const trays = { ...plan.trays }
  if (tray.some((list) => list.length)) trays[monday] = tray
  else delete trays[monday]
  return { ...plan, trays }
}

// Swap two members' cells on one day; both become pinned. Duties, rest days
// and leave swap with each other; a duty or leave dropped on a pending cell
// (HC, TBC) moves there, leaving its old cell empty. null when not allowed.
export function swapCells(roster, plan, monday, rowA, rowB, day, timeOf) {
  const lines = weekView(roster, plan, monday)
  const a = lines.find((line) => line.member.row === rowA)
  const b = lines.find((line) => line.member.row === rowB)
  if (!a || !b || a === b) return null
  const movable = (code) => code === EMPTY || LEAVE.includes(code) || Boolean(timeOf(code))
  const [x, y] = [a.codes[day], b.codes[day]]
  if (movable(x) && movable(y)) [a.codes[day], b.codes[day]] = [y, x]
  else if (movable(x) && PENDING.includes(y)) [a.codes[day], b.codes[day]] = [EMPTY, x]
  else if (movable(y) && PENDING.includes(x)) [a.codes[day], b.codes[day]] = [y, EMPTY]
  else return null
  a.pins[day] = true
  b.pins[day] = true
  return withWeek(plan, monday, lines)
}

// Take a member's duty, rest day or leave out of a cell into that day's tray;
// the cell is left empty.
export function toTray(roster, plan, monday, row, day, timeOf) {
  const lines = weekView(roster, plan, monday)
  const line = lines.find((item) => item.member.row === row)
  if (!line || !(timeOf(line.codes[day]) || LEAVE.includes(line.codes[day]))) return null
  const tray = trayView(plan, monday)
  tray[day] = sortTray([...tray[day], line.codes[day]], timeOf)
  line.codes[day] = EMPTY
  line.pins[day] = true
  return withTray(withWeek(plan, monday, lines), monday, tray)
}

// Put a tray block on a cell. A duty, rest day or leave already there goes back
// to the tray; an empty or pending cell just takes it.
export function fromTray(roster, plan, monday, row, day, index, timeOf) {
  const lines = weekView(roster, plan, monday)
  const line = lines.find((item) => item.member.row === row)
  const tray = trayView(plan, monday)
  const block = tray[day][index]
  if (!line || block == null) return null
  const old = line.codes[day]
  const keep = LEAVE.includes(old) || Boolean(timeOf(old))
  if (!(old === EMPTY || PENDING.includes(old) || keep)) return null
  tray[day].splice(index, 1)
  if (keep) tray[day] = sortTray([...tray[day], old], timeOf)
  line.codes[day] = block
  line.pins[day] = true
  return withTray(withWeek(plan, monday, lines), monday, tray)
}

// Put every rest day and leave (RD, AL, SH) of the week in the day trays.
export function leaveToTray(roster, plan, monday, timeOf) {
  const lines = weekView(roster, plan, monday)
  const tray = trayView(plan, monday)
  for (const line of lines) {
    for (let d = 0; d < 7; d += 1) {
      if (!LEAVE.includes(line.codes[d])) continue
      tray[d].push(line.codes[d])
      line.codes[d] = EMPTY
      line.pins[d] = true
    }
  }
  return withTray(withWeek(plan, monday, lines), monday, tray.map((codes) => sortTray(codes, timeOf)))
}

// Start a week from scratch: every duty, rest day and leave of the team's
// unpinned cells goes to that day's tray, leaving the cells empty to be set by
// hand (leave) or filled by arrangeWeek (duties). HC and TBC stay.
export function allToTray(roster, plan, monday, timeOf) {
  const lines = weekView(roster, plan, monday)
  const tray = trayView(plan, monday)
  for (const line of lines) {
    for (let d = 0; d < 7; d += 1) {
      const code = line.codes[d]
      if (line.pins[d] || code === EMPTY || PENDING.includes(code)) continue
      tray[d].push(code)
      line.codes[d] = EMPTY
    }
  }
  return withTray(withWeek(plan, monday, lines), monday, tray.map((codes) => sortTray(codes, timeOf)))
}

// Set one cell by hand (pinned), or with null put it back to the Standard Roster.
export function setCell(roster, plan, monday, row, day, code) {
  const lines = weekView(roster, plan, monday)
  const line = lines.find((item) => item.member.row === row)
  if (!line) return plan
  const old = line.codes[day]
  const special = Boolean(plan.sheets?.[addDays(monday, day)])
  line.codes[day] = code ?? (special ? EMPTY : line.std[day])
  line.pins[day] = code != null
  const tray = trayView(plan, monday)
  // A duty written over on a special sheet goes back to the tray; a leave typed in uses up its tray block.
  if (special && DUTY.test(old) && old !== code) tray[day].push(old)
  const k = LEAVE.includes(code) ? tray[day].indexOf(code) : -1
  if (k !== -1) tray[day].splice(k, 1)
  return withTray(withWeek(plan, monday, lines), monday, tray)
}

// Set the Duty Sheet of one date (the default sheet clears it). A special sheet
// puts all of its duties (codes) in that day's tray, to be handed out or removed;
// going back to the default hands the day back to the Standard Roster. Cells set
// by hand stay, their duties following to the new sheet.
export function setSheet(roster, plan, monday, day, sheet, codes = []) {
  if (!SHEETS.includes(sheet)) return plan
  const date = addDays(monday, day)
  const sheets = { ...plan.sheets }
  const special = sheet !== defaultSheet(date)
  if (special) sheets[date] = sheet
  else delete sheets[date]
  const before = weekView(roster, plan, monday)
  const next = { ...plan, sheets }
  const std = new Map(weekView(roster, next, monday).map((line) => [line.member.row, line.std[day]]))
  const tray = trayView(plan, monday)
  const taken = []
  for (const line of before) {
    const code = line.codes[day]
    if (line.pins[day]) {
      line.codes[day] = mapCode(code, sheet)
      if (DUTY.test(line.codes[day])) taken.push(line.codes[day])
    } else if (DUTY.test(code)) line.codes[day] = special ? EMPTY : std.get(line.member.row)
  }
  tray[day] = special
    ? [...tray[day].filter((code) => !DUTY.test(code)), ...codes.filter((code) => !taken.includes(code))]
    : tray[day].filter((code) => !DUTY.test(code))
  return withTray(withWeek(next, monday, before), monday, tray)
}

// Whether a duty block of a special-sheet day may be deleted: the day's blocks
// (in the tray and in cells) must stay at least as many as the members needing one.
export function canRemove(roster, plan, monday, day) {
  if (!plan.sheets?.[addDays(monday, day)]) return false
  const lines = weekView(roster, plan, monday)
  const need = lines.filter((line) => !LEAVE.includes(line.codes[day]) && !PENDING.includes(line.codes[day])).length
  const blocks = trayView(plan, monday)[day].filter((code) => DUTY.test(code)).length + lines.filter((line) => DUTY.test(line.codes[day])).length
  return blocks > need
}

// Delete a duty block from the tray of a special-sheet day, or null when it may not go.
export function removeBlock(roster, plan, monday, day, index) {
  const tray = trayView(plan, monday)
  if (!DUTY.test(tray[day][index] ?? "") || !canRemove(roster, plan, monday, day)) return null
  tray[day].splice(index, 1)
  return withTray(plan, monday, tray)
}

export function clearWeek(plan, monday) {
  const weeks = { ...plan.weeks }
  const trays = { ...plan.trays }
  delete weeks[monday]
  delete trays[monday]
  return { ...plan, weeks, trays }
}

// A plan for the rows typed, keeping names and preferences of rows already there.
export function newPlan(anchor, ranges, old = null, roster = null) {
  const { rows } = parseRanges(ranges)
  const known = new Map((old?.members ?? []).map((m) => [m.row, m]))
  const sameAnchor = old?.anchor === anchor
  return {
    v: 1,
    anchor,
    ranges,
    rest: old?.rest ?? 11,
    members: rows.map((row) => {
      const member = (sameAnchor && known.get(row)) || { row, name: "", prefs: [] }
      const named = roster?.names?.[roster.numbers.indexOf(row)]
      return member.name || !named ? member : { ...member, name: named }
    }),
    weeks: sameAnchor ? old?.weeks ?? {} : {},
    trays: sameAnchor ? old?.trays ?? {} : {},
    sheets: old?.sheets ?? {},
  }
}

// Check a saved or imported plan; returns it cleaned, or null when unusable.
export function cleanPlan(value) {
  if (!value || value.v !== 1 || !isDate(value.anchor) || !Array.isArray(value.members)) return null
  const members = []
  for (const m of value.members) {
    if (!Number.isInteger(m?.row) || members.some((x) => x.row === m.row)) return null
    members.push({ row: m.row, name: String(m.name ?? "").slice(0, 40), prefs: (m.prefs ?? []).filter((p) => SHIFTS.includes(p)) })
  }
  const weeks = {}
  for (const [monday, week] of Object.entries(value.weeks ?? {})) {
    if (!isDate(monday) || mondayOf(monday) !== monday || !week || typeof week !== "object") continue
    const clean = {}
    for (const [row, cell] of Object.entries(week)) {
      if (!Array.isArray(cell?.codes) || cell.codes.length !== 7 || !cell.codes.every((c) => typeof c === "string" && /^([0-9A-Z]{1,10}|-)$/.test(c))) continue
      clean[row] = { codes: cell.codes, pins: Array.from({ length: 7 }, (_, i) => (cell.pins?.[i] ? 1 : 0)) }
    }
    weeks[monday] = clean
  }
  const trays = {}
  for (const [monday, tray] of Object.entries(value.trays ?? {})) {
    if (!isDate(monday) || mondayOf(monday) !== monday || !Array.isArray(tray) || tray.length !== 7) continue
    const days = tray.map((list) => (Array.isArray(list) ? list.filter((c) => typeof c === "string" && /^[0-9A-Z]{1,10}$/.test(c)) : []))
    if (days.some((list) => list.length)) trays[monday] = days
  }
  const sheets = {}
  for (const [date, sheet] of Object.entries(value.sheets ?? {})) {
    if (isDate(date) && SHEETS.includes(sheet) && sheet !== defaultSheet(date)) sheets[date] = sheet
  }
  const rest = Number(value.rest)
  return { v: 1, anchor: mondayOf(value.anchor), ranges: String(value.ranges ?? ""), rest: rest >= 0 && rest <= 24 ? rest : 11, members, weeks, trays, sheets }
}
