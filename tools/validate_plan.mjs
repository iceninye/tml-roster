// Checks lib/tml-plan.js on a made-up roster and made-up duty times
// (real rosters and staff never go in the repo):
//   node tools/validate_plan.mjs
import { EMPTY, SHEETS, arrangeWeek, defaultSheet, mapCode, setSheet, sheetOf, assign, cleanPlan, fromTray, toTray, trayView, isoWeek, memberRow, mondayOfIsoWeek, newPlan, parseRanges, prefDistance, restIssues, setCell, shiftOf, swapCells, weekView } from "../lib/tml-plan.js"
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
check(toTray(roster, plan, "2026-10-12", 2, 2, timeOf) === null, "a rest day cannot go to the tray")
const back = fromTray(roster, out, "2026-10-12", 3, 1, 0, timeOf)
const backLines = weekView(roster, back, "2026-10-12")
check(backLines[1].codes[1] === "1101002" && trayView(back, "2026-10-12")[1].join() === "1101003", "dropping a tray duty on an occupied cell sends that cell's duty back to the tray")
check(fromTray(roster, out, "2026-10-12", 2, 2, 0, timeOf) === null && fromTray(roster, out, "2026-10-12", 4, 5, 0, timeOf) === null, "a tray duty does not go on a rest day or another day's cell")
const emptyDrop = fromTray(roster, out, "2026-10-12", 2, 1, 0, timeOf)
check(weekView(roster, emptyDrop, "2026-10-12")[0].codes[1] === "1101002" && trayView(emptyDrop, "2026-10-12")[1].length === 0, "a tray duty put back on its empty cell empties the tray")
check(restIssues(roster, out, "2026-10-12", timeOf).every((x) => !(x.row === 2 && x.day === 1)), "an empty cell has no rest problem")
// HC (pending) is filled by hand: a duty moved there leaves its old cell empty.
const hcPlan = newPlan("2026-10-12", "2,4,5")
const hcRoster = newRoster(parseRoster(csv.replace("5,RD,RD,RD,RD,RD,RD,RD", "5,HC,RD,RD,RD,RD,RD,RD")), { row: 1, monday: "2026-10-12" })
const hcMove = swapCells(hcRoster, hcPlan, "2026-10-12", 2, 5, 0, timeOf)
const hcLines = weekView(hcRoster, hcMove, "2026-10-12")
check(hcLines[0].codes[0] === EMPTY && hcLines[2].codes[0] === "1101001", "a duty dropped on an HC cell moves there")
check(swapCells(hcRoster, hcPlan, "2026-10-12", 2, 4, 2, timeOf) === null, "a rest day does not swap")
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
const sat = setSheet(plan, "2026-10-12", 5, "8022")
check(sheetOf(sat, "2026-10-17") === "8022" && sheetOf(sat, "2026-10-16") === "1101", "a date takes the sheet it was set to, others keep theirs")
check(weekView(roster, sat, "2026-10-12")[0].std[5] === "RD" && weekView(roster, sat, "2026-10-12")[1].std[5] === "8022005", "the Standard duty numbers of that date move to the sheet")
check(weekView(roster, sat, "2026-10-12")[2].std[4] === "1101004", "the other days are untouched")
const satArranged = arrangeWeek(roster, sat, "2026-10-12", (c) => (TIMES[c] ? timeOf(c) : /^8022/.test(c) ? { on: h(9), off: h(17) } : null)).plan
const satLines = weekView(roster, satArranged, "2026-10-12")
check(satLines.every((l) => !/^6091/.test(l.codes[5])), "arranging keeps the new sheet")
const satBack = setSheet(satArranged, "2026-10-12", 5, "6091")
check(satBack.sheets["2026-10-17"] === undefined && weekView(roster, satBack, "2026-10-12").every((l) => !/^8022/.test(l.codes[5])), "setting the default sheet again clears it and moves the planned duties back")
check(setSheet(plan, "2026-10-12", 5, "9999") === plan && SHEETS.length === 5, "an unknown sheet is refused")
check(cleanPlan(JSON.parse(JSON.stringify(sat))).sheets["2026-10-17"] === "8022" && cleanPlan({ ...JSON.parse(JSON.stringify(plan)), sheets: { "2026-10-17": "6091", "2026-10-18": "x" } }).sheets["2026-10-17"] === undefined, "sheets survive a save; defaults and junk are dropped")

if (failed) {
  console.error(`${failed} check(s) failed`)
  process.exit(1)
}
console.log("all plan checks passed")
