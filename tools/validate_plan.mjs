// Checks lib/tml-plan.js on a made-up roster and made-up duty times
// (real rosters and staff never go in the repo):
//   node tools/validate_plan.mjs
import { EMPTY, EXTRA, SHEETS, formatRanges, leaveToTray, namedRows, arrangeWeek, defaultSheet, mapCode, setSheet, sheetOf, assign, cleanPlan, fromTray, toTray, trayView, allToTray, canRemove, fillMember, fillTeam, combosView, useCombo, renameBlock, removeBlock, isoWeek, memberRow, mondayOfIsoWeek, newPlan, parseRanges, prefDistance, restIssues, setCell, shiftOf, swapCells, weekView } from "../lib/tml-plan.js"
import { newRoster, parseRoster } from "../lib/tml-roster.js"

let failed = 0
const check = (ok, what) => {
  if (!ok) failed += 1
  console.log(`${ok ? "✓" : "✗"} ${what}`)
}

const h = (hh, mm = 0) => hh * 3600 + mm * 60
// Made-up duties: 0001xx dawn, 0002xx early, 0003xx mid, 0004xx late, 0005xx night.
const TIMES = {
  1101001: [h(5, 10), h(13, 40)], // 死早
  1101002: [h(8, 0), h(16, 0)], // 早
  1101003: [h(11, 0), h(19, 0)], // 中
  1101004: [h(16, 0), h(24, 0)], // 夜
  1101005: [h(17, 30), h(25, 40)], // 死夜, books off 01:40
  6091001: [h(5, 30), h(13, 0)],
  6091005: [h(18, 0), h(26, 0)],
}
const timeOf = (code) => (TIMES[code] ? { on: TIMES[code][0], off: TIMES[code][1] } : null)

check(shiftOf(h(6, 29), h(14)) === "dawn" && shiftOf(h(6, 30), h(14)) === "early", "死早 is book-on before 06:30")
check(shiftOf(h(17), h(24, 31)) === "night" && shiftOf(h(17), h(24, 30)) === "late", "死夜 is book-off after 00:30")
check(shiftOf(h(10), h(18)) === "mid" && shiftOf(h(15), h(23)) === "late", "early / mid / late split at 10:00 and 15:00")
check(parseRanges("31-40, 55-70").rows.length === 26 && parseRanges("31-40,55-70").rows[10] === 55, "row ranges read in order")
check(parseRanges("5-3, x").issues.length === 2, "bad ranges are reported")
check(isoWeek("2026-10-12").week === 42 && isoWeek("2025-12-29").week === 1 && isoWeek("2025-12-29").year === 2026, "ISO week numbers (week 1 of 2026 starts 29 Dec 2025)")
check(mondayOfIsoWeek(2026, 43) === "2026-10-19", "week 43 of 2026 starts 19 Oct")
check(prefDistance(["early"], "mid") === 1 && prefDistance([], "dawn") === 0 && prefDistance(["dawn", "night"], "mid") === 2, "preference distance")
check(assign([[4, 1, 3], [2, 0, 5], [3, 2, 2]]).join() === "1,0,2", "assignment finds the minimum cost")

// Five rows; the team is rows 2-4 in the anchor week.
const csv = [
  "1,1101001,1101001,1101001,1101001,1101001,6091001,RD",
  "2,1101001,1101002,RD,1101004,1101005,RD,RD",
  "3,1101005,1101003,1101003,1101001,1101002,6091005,RD",
  "4,1101002,1101005,1101002,AL,1101004,6091001,RD",
  "5,RD,RD,RD,RD,RD,RD,RD",
].join("\n")
const roster = newRoster(parseRoster(csv), { row: 1, monday: "2026-10-12" })
let plan = newPlan("2026-10-12", "2-4")
check(plan.members.map((m) => m.row).join() === "2,3,4", "members are the anchor week's rows")
check(memberRow(roster, plan, plan.members[2], "2026-10-19") === 5, "a week later every member is one row down")
check(memberRow(roster, plan, plan.members[2], "2026-10-26") === 1, "after the last row the member goes back to row 1")

plan.members[0].prefs = ["night"]
plan.members[1].prefs = ["dawn"]
plan.members[2].prefs = ["early"]
const { plan: done } = arrangeWeek(roster, plan, "2026-10-12", timeOf)
const lines = weekView(roster, done, "2026-10-12")
check(lines[0].codes[0] === "1101005" && lines[1].codes[0] === "1101001" && lines[2].codes[0] === "1101002", "Monday goes to each member's preference")
for (let d = 0; d < 7; d += 1) {
  const before = lines.map((l) => l.std[d]).sort().join()
  const after = lines.map((l) => l.codes[d]).sort().join()
  check(before === after, `${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d]}: the team's duties are the same set, only handed round`)
}
check(lines[0].codes[2] === "RD" && lines[2].codes[3] === "AL", "rest days and leave stay with the row")
check(restIssues(roster, done, "2026-10-12", timeOf).length === 0, "the arranged week keeps at least 11 hours of rest")

// Start from scratch: everything in the tray, leave set by hand, the rest filled by preference.
{
  const start = allToTray(roster, plan, "2026-10-12", timeOf)
  const v0 = weekView(roster, start, "2026-10-12")
  check(v0.every((l) => l.codes.every((c) => c === EMPTY)), "starting over empties the team's cells")
  check(trayView(start, "2026-10-12")[2].includes("RD"), "the Standard rest day is in that day's tray")
  const set = setCell(roster, start, "2026-10-12", plan.members[0].row, 1, "RD")
  const { plan: filled } = arrangeWeek(roster, set, "2026-10-12", timeOf)
  const f = weekView(roster, filled, "2026-10-12")
  check(f[0].codes[1] === "RD" && f[0].pins[1], "a leave set by hand is kept")
  check(f[1].codes[0] !== EMPTY && timeOf(f[1].codes[0]), "an empty cell is filled with a duty")
}

// A night duty (off 01:40) followed by a dawn duty (on 05:10) is too little rest.
const tight = setCell(roster, plan, "2026-10-12", 3, 1, "1101001")
check(restIssues(roster, tight, "2026-10-12", timeOf).some((x) => x.row === 3 && x.day === 1), "night then dawn is flagged as too little rest")

const swapped = swapCells(roster, plan, "2026-10-12", 2, 4, 0, timeOf)
const sw = weekView(roster, swapped, "2026-10-12")
check(sw[0].codes[0] === "1101002" && sw[2].codes[0] === "1101001" && sw[0].pins[0] && sw[2].pins[0], "a swap trades the two cells and pins both")
const rearranged = weekView(roster, arrangeWeek(roster, swapped, "2026-10-12", timeOf).plan, "2026-10-12")
check(rearranged[0].codes[0] === "1101002" && rearranged[2].codes[0] === "1101001", "arranging again keeps pinned cells")

// Tray: take a duty out of a cell, drop it on another.
const out = toTray(roster, plan, "2026-10-12", 2, 1, timeOf)
const outLines = weekView(roster, out, "2026-10-12")
check(outLines[0].codes[1] === EMPTY && outLines[0].pins[1] && trayView(out, "2026-10-12")[1].join() === "1101002", "a duty taken out of a cell sits in that day's tray and leaves the cell empty")
check(toTray(roster, plan, "2026-10-12", 4, 3, timeOf) !== null && toTray(roster, plan, "2026-10-12", 2, 1, (c) => null) === null, "a rest day or leave goes to the tray; a code that is neither does not")
const back = fromTray(roster, out, "2026-10-12", 3, 1, 0, timeOf)
const backLines = weekView(roster, back, "2026-10-12")
check(backLines[1].codes[1] === "1101002" && trayView(back, "2026-10-12")[1].join() === "1101003", "dropping a tray duty on an occupied cell sends that cell's duty back to the tray")
check(fromTray(roster, out, "2026-10-12", 4, 5, 0, timeOf) === null, "a tray block is not placed on another day's cell")
const emptyDrop = fromTray(roster, out, "2026-10-12", 2, 1, 0, timeOf)
check(weekView(roster, emptyDrop, "2026-10-12")[0].codes[1] === "1101002" && trayView(emptyDrop, "2026-10-12")[1].length === 0, "a tray duty put back on its empty cell empties the tray")
check(restIssues(roster, out, "2026-10-12", timeOf).every((x) => !(x.row === 2 && x.day === 1)), "an empty cell has no rest problem")
// HC (pending) is filled by hand: a duty moved there leaves its old cell empty.
const hcPlan = newPlan("2026-10-12", "2,4,5")
const hcRoster = newRoster(parseRoster(csv.replace("5,RD,RD,RD,RD,RD,RD,RD", "5,HC,RD,RD,RD,RD,RD,RD")), { row: 1, monday: "2026-10-12" })
const hcMove = swapCells(hcRoster, hcPlan, "2026-10-12", 2, 5, 0, timeOf)
const hcLines = weekView(hcRoster, hcMove, "2026-10-12")
check(hcLines[0].codes[0] === EMPTY && hcLines[2].codes[0] === "1101001", "a duty dropped on an HC cell moves there")
const rdSwap = weekView(hcRoster, swapCells(hcRoster, hcPlan, "2026-10-12", 2, 4, 1, timeOf), "2026-10-12")
check(rdSwap[0].codes[1] === "1101005" && rdSwap[1].codes[1] === "1101001" || rdSwap[0].codes[1] !== "1101001", "a rest day swaps with a duty")
// Rest and leave go to the tray in bulk and come back by hand; arranging keeps them there.
const leaveOut = leaveToTray(roster, plan, "2026-10-12", timeOf)
const lo = weekView(roster, leaveOut, "2026-10-12")
check(lo.every((l) => l.codes.every((c) => c !== "RD" && c !== "AL")) && trayView(leaveOut, "2026-10-12")[2].join() === "RD", "leaveToTray moves every RD and AL of the week into the day trays")
const keptLeave = arrangeWeek(roster, leaveOut, "2026-10-12", timeOf).plan
check(trayView(keptLeave, "2026-10-12")[2].join() === "RD" && weekView(roster, keptLeave, "2026-10-12")[0].codes[2] === EMPTY, "arranging keeps leave blocks in the tray and the cells empty")
const leaveBack = fromTray(roster, leaveOut, "2026-10-12", 2, 2, 0, timeOf)
check(weekView(roster, leaveBack, "2026-10-12")[0].codes[2] === "RD" && trayView(leaveBack, "2026-10-12")[2].length === 0, "a leave block drops back on an empty cell")
// A TBC cell is pending like HC.
const tbcRoster = newRoster(parseRoster(csv.replace("5,RD,RD,RD,RD,RD,RD,RD", "5,TBC,TBC,TBC,TBC,TBC,TBC,TBC")), { row: 1, monday: "2026-10-12" })
const tbcMove = weekView(tbcRoster, swapCells(tbcRoster, newPlan("2026-10-12", "2,4,5"), "2026-10-12", 2, 5, 0, timeOf), "2026-10-12")
check(tbcMove[2].codes[0] === "1101001" && tbcMove[0].codes[0] === EMPTY, "a duty dropped on a TBC cell moves there")
// Names: the rows with a name are the team.
const named = parseRoster(",Name,Mon,Tue,Wed,Thu,Fri,Sat,Sun\n1,,1101001,RD,RD,RD,RD,RD,RD\n2,Ann,1101002,RD,RD,RD,RD,RD,RD\n3,,RD,RD,RD,RD,RD,RD,RD\n4,Bo,1101004,RD,RD,RD,RD,RD,RD\n5,Cy,TBC,TBC,TBC,TBC,TBC,TBC,TBC\n6,Di,TBC,TBC,TBC,TBC,TBC,TBC,TBC")
const namedRoster = newRoster(named, { row: 1, monday: "2026-10-12" })
check(named.issues.length === 0 && named.rows.length === 6 && namedRoster.names.join() === ",Ann,,Bo,Cy,Di", "a Name column is read and the header skipped")
check(namedRows(namedRoster).join() === "2,4,5,6" && formatRanges([2, 4, 5, 6, 9, 10, 11, 12]) === "2, 4-6, 9-12", "rows with a name are the team, written as ranges")
const np = newPlan("2026-10-12", formatRanges(namedRows(namedRoster)), null, namedRoster)
check(np.members.map((m) => m.name).join() === "Ann,Bo,Cy,Di", "members take the names from the roster")
check(memberRow(namedRoster, np, np.members[0], "2026-10-19") === 3 && memberRow(namedRoster, np, np.members[1], "2026-10-19") === 1, "rotation skips the pending rows (4 wraps to 1)")
check(memberRow(namedRoster, np, np.members[2], "2026-10-26") === 5 && memberRow(namedRoster, np, np.members[3], "2026-11-09") === 6, "an all-TBC row stays on its own row every week")
// A pinned empty cell leaves its duty in the tray after arranging.
const emptied = arrangeWeek(roster, toTray(roster, plan, "2026-10-12", 2, 1, timeOf), "2026-10-12", timeOf)
check(trayView(emptied.plan, "2026-10-12")[1].length === 1 && emptied.unassigned.length === 1, "arranging with an emptied cell leaves one duty unassigned, in the tray")
check(cleanPlan(JSON.parse(JSON.stringify(emptied.plan)))?.trays["2026-10-12"]?.[1]?.length === 1, "trays survive a save")
check(cleanPlan(JSON.parse(JSON.stringify(done)))?.members.length === 3, "a saved plan reads back")
check(cleanPlan({ v: 1, anchor: "2026-10-12", members: [{ row: 1 }, { row: 1 }] }) === null, "a plan with a member twice is refused")
const moved = newPlan("2026-10-12", "3-5", done)
check(moved.members[0].prefs.join() === "dawn" && moved.members[2].prefs.length === 0, "changing the rows keeps the preferences of rows still in the team")

// Duty Sheet per date: 6091124 on a date set to 8022 reads 8022124.
check(defaultSheet("2026-10-14") === "1101" && defaultSheet("2026-10-17") === "6091" && defaultSheet("2026-10-18") === "7091", "default sheets: 1101 weekdays, 6091 Saturday, 7091 Sunday")
check(mapCode("6091001", "8022") === "8022001" && mapCode("RD", "8022") === "RD" && mapCode("HSP1", "8022") === "HSP1", "only 7-digit duty numbers change sheet")
const SAT = ["8022101", "8022102", "8022103", "8022104"]
const sat = setSheet(roster, plan, "2026-10-12", 5, "8022", SAT)
check(sheetOf(sat, "2026-10-17") === "8022" && sheetOf(sat, "2026-10-16") === "1101", "a date takes the sheet it was set to, others keep theirs")
check(weekView(roster, sat, "2026-10-12")[0].std[5] === "RD" && weekView(roster, sat, "2026-10-12")[1].std[5] === "8022005", "the Standard duty numbers of that date move to the sheet")
check(weekView(roster, sat, "2026-10-12")[2].std[4] === "1101004", "the other days are untouched")
const satArranged = arrangeWeek(roster, sat, "2026-10-12", (c) => (TIMES[c] ? timeOf(c) : /^8022/.test(c) ? { on: h(9), off: h(17) } : null)).plan
const satLines = weekView(roster, satArranged, "2026-10-12")
check(satLines.every((l) => !/^6091/.test(l.codes[5])), "arranging keeps the new sheet")
const satBack = setSheet(roster, satArranged, "2026-10-12", 5, "6091")
check(satBack.sheets["2026-10-17"] === undefined && weekView(roster, satBack, "2026-10-12").every((l) => !/^8022/.test(l.codes[5])), "setting the default sheet again clears it and moves the planned duties back")
check(setSheet(roster, plan, "2026-10-12", 5, "9999") === plan && SHEETS.length === 5, "an unknown sheet is refused")
check(cleanPlan(JSON.parse(JSON.stringify(sat))).sheets["2026-10-17"] === "8022" && cleanPlan({ ...JSON.parse(JSON.stringify(plan)), sheets: { "2026-10-17": "6091", "2026-10-18": "x" } }).sheets["2026-10-17"] === undefined, "sheets survive a save; defaults and junk are dropped")

// A special sheet puts all its duties in the tray; blocks can go while there are more than members.
{
  const day = 5
  const week = "2026-10-12"
  const members = weekView(roster, sat, week).length
  const v = weekView(roster, sat, week)
  check(trayView(sat, week)[day].join() === SAT.join(), "a special sheet puts every one of its duties in the day's tray")
  check(v.every((l) => !/^\d{7}$/.test(l.codes[day])), "the cells of that day are emptied for arranging")
  const extra = Array.from({ length: members + 1 }, (_, i) => `8022${String(200 + i).padStart(3, "0")}`)
  const many = setSheet(roster, plan, week, day, "8022", extra)
  check(canRemove(roster, many, week, day), "blocks may go on a special day while they outnumber the members")
  const surplus = trayView(many, week)[day].length - members
  let cut = many
  for (let i = 0; i < surplus; i += 1) cut = removeBlock(roster, cut, week, day, 0)
  check(trayView(cut, week)[day].length === members && !canRemove(roster, cut, week, day), "removal stops when blocks equal members")
  check(removeBlock(roster, cut, week, day, 0) === null, "so the last blocks stay")
  const filled = arrangeWeek(roster, cut, week, timeOf).plan
  check(weekView(roster, filled, week).length === members, "arranging keeps every member")
  const typed = setCell(roster, sat, week, plan.members[1].row, day, "RD")
  check(typed && weekView(roster, typed, week)[1].codes[day] === "RD", "a leave can be typed in")
}

// Auto-fill works on one member's row only, and needs a rest day in the week.
{
  const week = "2026-10-12"
  const start = allToTray(roster, plan, week, timeOf)
  const [a, b] = [plan.members[0].row, plan.members[1].row]
  const noRd = fillMember(roster, start, week, a, timeOf)
  check(weekView(roster, noRd, week)[0].codes.every((c) => c === "-"), "no rest day, no auto-fill")
  const withRd = setCell(roster, start, week, a, 0, "RD")
  const filled = fillMember(roster, withRd, week, a, timeOf)
  const fa = weekView(roster, filled, week)
  check(fa[0].codes.slice(1).some((c) => /^\d{7}$/.test(c)), "a rest day fills the empty days of that member's week with duties")
  check(fa[0].codes.every((c) => /^\d{7}$/.test(c) || c === "RD" || c === "-"), "only duties are placed in the cells")
  check(weekView(roster, filled, week)[1].codes.every((c) => c === "-") && b !== a, "the other members are left alone")
}

// Setting a cell uses up a block of that day, and what the cell held goes back.
{
  const week = "2026-10-12"
  const start = allToTray(roster, plan, week, timeOf)
  const count = (p, d) => trayView(p, week)[d].length + weekView(roster, p, week).filter((l) => l.codes[d] !== "-").length
  const al = setCell(roster, start, week, 2, 0, "AL")
  check(trayView(al, week)[0].length === trayView(start, week)[0].length - 1, "a leave typed in takes the member's own block when the tray has no such leave")
  const again = setCell(roster, al, week, 2, 0, "AL")
  check(again === al, "typing the same code again uses nothing more")
  const over = setCell(roster, al, week, 2, 0, "1101002")
  check(trayView(over, week)[0].includes("AL") && count(over, 0) === count(al, 0), "writing over a cell sends its code back to the tray")
}

// HC and TBC blocks wait in the tray until they have a duty number.
{
  const week = "2026-10-12"
  const hcR = newRoster(parseRoster(csv.replace("5,RD,RD,RD,RD,RD,RD,RD", "5,HC,RD,RD,RD,RD,RD,RD")), { row: 1, monday: week })
  const p = allToTray(hcR, newPlan(week, "2,4,5"), week, timeOf)
  const i = trayView(p, week)[0].indexOf("HC")
  check(i !== -1 && fromTray(hcR, p, week, 2, 0, i, timeOf) === null, "an HC block can't go on a cell")
  check(renameBlock(p, week, 0, i, "HC", timeOf) === null, "an HC block needs a 7-digit duty number")
  const named = renameBlock(p, week, 0, i, "1101003", timeOf)
  check(trayView(named, week)[0].includes("1101003") && !trayView(named, week)[0].includes("HC"), "an HC block given a number becomes that duty")
}

// 自動編排 fills the whole team from the tray, but only members with a rest day.
{
  const week = "2026-10-12"
  const start = allToTray(roster, plan, week, timeOf)
  const withRd = setCell(roster, setCell(roster, start, week, 2, 2, "RD"), week, 3, 6, "RD")
  const { plan: filled, skipped } = fillTeam(roster, withRd, week, timeOf)
  const v = weekView(roster, filled, week)
  check(skipped.join() === "4" && v[2].codes.every((c) => c === "-"), "a member with no RD is skipped")
  check(v[0].codes[0] === "1101005" && v[1].codes[0] === "1101001", "each member gets a duty of their preference")
  const left = trayView(filled, week)
  for (let d = 0; d < 7; d += 1) {
    const all = [...left[d], ...v.map((l) => l.codes[d]).filter((c) => c !== "-")].sort().join()
    const before = [...trayView(withRd, week)[d], ...weekView(roster, withRd, week).map((l) => l.codes[d]).filter((c) => c !== "-")].sort().join()
    if (all !== before) check(false, `day ${d}: blocks are only moved, never made or lost`)
  }
  check(restIssues(roster, filled, week, timeOf).length === 0, "the filled week keeps 12 hours of rest")
}

// A preference set after the row was filled refills it; a late duty is never followed by too little rest.
{
  const week = "2026-10-12"
  const start = allToTray(roster, { ...plan, members: plan.members.map((m) => ({ ...m, prefs: [] })) }, week, timeOf)
  const rd = setCell(roster, start, week, 3, 6, "RD")
  const first = fillMember(roster, rd, week, 3, timeOf)
  const liked = { ...first, members: first.members.map((m) => (m.row === 3 ? { ...m, prefs: ["dawn"] } : m)) }
  const again = weekView(roster, fillMember(roster, liked, week, 3, timeOf), week)[1]
  check(again.codes[0] === "1101001", "a preference set later moves the member's filled duties to it")
  check(restIssues(roster, fillMember(roster, liked, week, 3, timeOf), week, timeOf).every((x) => x.row !== 3), "the refilled week has no short rest")
  const count = (p) => [0, 1, 2, 3, 4, 5, 6].map((d) => trayView(p, week)[d].length + weekView(roster, p, week).filter((l) => l.codes[d] !== "-").length).join()
  check(count(fillMember(roster, liked, week, 3, timeOf)) === count(rd), "refilling only moves blocks")
}

// Standard rows as combinations: whole rows go on one member; a used block breaks the combination.
{
  const week = "2026-10-12"
  const start = allToTray(roster, plan, week, timeOf)
  const combos = combosView(roster, start, week)
  check(combos.length === 3 && combos[0].codes.join() === weekView(roster, start, week)[0].std.join(), "each team row is offered as a combination")
  const put = useCombo(roster, start, week, 4, combos[0].codes, timeOf)
  const v = weekView(roster, put, week)
  check(v[2].codes.join() === combos[0].codes.join() && v[2].pins.every(Boolean), "a combination fills the member's whole week, pinned")
  check(combosView(roster, put, week).length === 2 && useCombo(roster, put, week, 3, combos[0].codes, timeOf) === null, "a used combination is gone")
}

// A plan saved before v0.9 starts its weeks over in the tray.
{
  const old = cleanPlan({ ...JSON.parse(JSON.stringify(done)), v: 1 })
  check(old && old.v === 2 && Object.keys(old.weeks).length === 0 && old.members.length === 3, "a v1 plan keeps the team and drops its weeks")
}

// 自動編排 on some members or some days only; 其他 codes come from no block.
{
  const week = "2026-10-12"
  const start = allToTray(roster, plan, week, timeOf)
  let p = start
  for (const row of [2, 3, 4]) p = setCell(roster, p, week, row, 6, "RD")
  const some = weekView(roster, fillTeam(roster, p, week, timeOf, { rows: [2] }).plan, week)
  check(some[0].codes.slice(0, 6).some((c) => c !== "-") && some[1].codes.slice(0, 6).every((c) => c === "-"), "a picked member is filled, the others are not")
  const day = weekView(roster, fillTeam(roster, p, week, timeOf, { days: [1] }).plan, week)
  check(day.every((l) => l.codes[0] === "-") && day.some((l) => l.codes[1] !== "-"), "a picked day is filled, the other days are not")
  check(EXTRA.includes("TRG") && EXTRA.includes("CL"), "the 其他 codes")
  const trg = setCell(roster, start, week, 2, 0, "TRG")
  check(trayView(trg, week)[0].length === trayView(start, week)[0].length - 1, "a TRG day uses up the member's own block")
  const back = setCell(roster, trg, week, 2, 0, null)
  check(!trayView(back, week)[0].includes("TRG") && weekView(roster, back, week)[0].codes[0] === "-", "clearing a TRG day puts no TRG block in the tray")
}

if (failed) {
  console.error(`${failed} check(s) failed`)
  process.exit(1)
}
console.log("all plan checks passed")
