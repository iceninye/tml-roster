// Checks lib/tml-paste.js (paste import, duty no. hours, Remarks order, 複製 export)
// on a made-up Excel paste (real rosters and staff never go in the repo):
//   node tools/validate_paste.mjs
import { buildRoster, byRemark, cellHours, cleanPlanRoster, dupNames, emptyCount, exportText, isLeaveCode, leftNames, nextRemarkMode, parsePaste, pasteWeek, preTicked, tableTime } from "../lib/tml-paste.js"
import { importWeek, weekView, newPlan, cleanPlan } from "../lib/tml-plan.js"

let failed = 0
const check = (ok, what) => {
  if (!ok) failed += 1
  console.log(`${ok ? "✓" : "✗"} ${what}`)
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const DATES = ["21/9/2026", "22/9/2026", "23/9/2026", "24/9/2026", "25/9/2026", "26/9/2026", "27/9/2026"]
const tail = (...cells) => cells.join("\t")
// A line as Excel copies it: leading blank cell, Rota, Name, 7 x (code, hours), Remarks, then balances.
const line = (rota, name, days, remark, ...rest) => ["", rota, name, ...days.flatMap(([c, hrs]) => [c, hrs]), remark, "43", "", "1", "14.49", ...rest].join("\t")
const wk = (n) => ["", "", "Staff Roster - Train Crew Unit   WK :", ...Array(8).fill(""), String(n), "", "/26"].join("\t")

const head = [
  "\t\t\"Resume Original duty no. just input\"\t\t\tThis roster pattern implemented in January 2022",
  "\t\t\tCompling page",
  "",
  wk(39),
  ["", "Rota No.", "Name", ...DATES.flatMap((d) => [d, ""]), "Remarks", "Working Hr", "", "Odd hr", "AL bal."].join("\t"),
  ["", "", "", ...DAYS.flatMap((d) => [d, ""])].join("\t"),
]
const RD = ["RD", 0]
const pasted = [
  ...head,
  line(1, "Ann Lee", [["1101105", 7], ["1101581", 7], ["1101126", 7.5], ["1101104", 6], ["1102105", 7], RD, ["HSP1", 8.5]], "E"),
  line(2, "Bo  Chan", [["1101108", 8], ["OJT", 7], ["SPT11", 10], ["S", 7], RD, ["7091118", 6.5], RD], "L"),
  line(3, "Zvacant", [RD, RD, RD, RD, RD, RD, RD], "E"),
  line(4, "Cy Wong", [["AL", 7], ["AL", 7], ["AL", 7], ["SH", 7], ["SH", 7], RD, RD], " AL "),
  line(5, "Di Ho", [["1101112", 7.5], ["TRG", 7], ["compL", 7], ["OF", 7], RD, RD, RD], "HC"),
  line(6, "Ed Fung", [RD, RD, RD, RD, RD, RD, RD], "E/L"),
  line(137, "Tra One", Array(6).fill(["TRA", 7]).concat([RD]), " E/L"),
  line(138, "Tra Two", Array(6).fill(["TRA", 7]).concat([RD]), " E/L"),
  line(139, "Zvacant", [RD, RD, RD, RD, RD, RD, RD], " E/L"),
  "",
  "duty no.\tWk hr\tBook on\tBook off",
].join("\n")

const p = parsePaste(pasted)
check(p.issues.length === 0, `paste is read without issues (${p.issues.join("; ")})`)
check(p.rows.map((r) => r.rota).join() === "1,2,3,4,5,6", "rows run from the header and stop at the first TRA row")
check(p.stoppedAt === 137 && p.rows.every((r) => !r.name.startsWith("Tra")), "TRA staff are ignored")
check(p.rows[2].vacant && p.rows[2].name === "" && p.vacant === 1, "Zvacant is kept as a row without a name")
check(p.rows[1].name === "Bo Chan", "extra spaces inside a name are squeezed")
check(p.rows[3].remark === "AL" && p.rows[5].remark === "E/L", "Remarks are trimmed")
check(p.rows[1].codes.join() === "1101108,OJT,SPT11,S,RD,7091118,RD" && p.rows[0].hours.join() === "7,7,7.5,6,7,0,8.5", "each day is a code and its hours")
check(p.rows[4].codes[2] === "COMPL", "codes are read in upper case")
check(p.monday === "2026-09-21" && p.dates[6] === "2026-09-27", "the week comes from the header dates")
const info = pasteWeek(p)
check(info.week === 39 && info.year === 2026 && info.agree === true && info.wk.week === 39 && info.wk.year === 2026, "WK : 39 /26 agrees with the dates")
const off = parsePaste(pasted.replace("\t39\t\t/26", "\t38\t\t/26"))
check(pasteWeek(off).agree === false, "a WK that disagrees with the dates is flagged")
const noWk = parsePaste(pasted.split("\n").filter((l) => !l.includes("WK")).join("\n"))
check(noWk.issues.length === 0 && pasteWeek(noWk).agree === null, "without a WK line the dates decide")

// Found by conditions, not by position: shifted by extra lines, columns and a different name header case.
const shifted = parsePaste(["junk", "more junk\tx", ...pasted.split("\n").map((l) => `x\ty\t${l}`)].join("\n"))
check(shifted.issues.length === 0 && shifted.rows.length === 6 && shifted.rows[0].codes[0] === "1101105", "extra lines and columns before the table do not matter")
check(parsePaste("nothing here").issues.length === 1, "no header row is reported")
check(parsePaste(pasted.replace("Remarks", "Rem")).issues.length === 1, "no Remarks column is reported")
check(parsePaste(pasted.replace("22/9/2026", "")).issues.length > 0, "a missing date is reported")
check(parsePaste(pasted.replace("1101581", "11 0158!")).issues.length > 0, "a code that cannot be read is reported")
check(parsePaste(pasted.replace("\t1101105\t", "\t1101105X12345\t")).issues.length > 0, "a code over 10 characters is reported")

// Hours: pasted always win; a code listed with two hours takes the common one and is reported.
check(p.hours.SPT11 === 10 && p.hours["1101126"] === 7.5 && p.hours.RD === 0 && p.hours.AL === 7, "pasted hours per code")
const twice = parsePaste(pasted.replace("OF\t7", "OF\t7.5"))
check(twice.mixed.length === 0, "a code used once has one hour")
const mixed = parsePaste(pasted.replace(/\tS\t7\t/, "\tSH\t6\t"))
check(mixed.mixed.some((m) => m.code === "SH"), "a code with two hours is reported")

// Duty no. table (tml-traffic data/duty-codes.json shape): [hours, on, off], null = NIL.
const TABLE = { AL: [7, null, null], TRG: [7, null, null], OJT: [7, 31500, 58500], S: [7, 28800, 56700], OF: [7, 28800, 56700], SPT11: [10, 32400, 70200], HC: [7, 32400, 59400], RD: [0, null, null], CL: [0, null, null], SH85: [8.5, null, null] }
check(tableTime("OJT", TABLE).on === 31500 && tableTime("AL", TABLE) === null && tableTime("TRG", TABLE) === null, "only codes with book-on/off get times from the table")
check(tableTime("HC", TABLE) === null && tableTime("SH85", TABLE) === null && tableTime("1101105", TABLE) === null, "HC, leave and unknown duties never get table times")
check(isLeaveCode("AL7") && isLeaveCode("sh85") && isLeaveCode("HC/AL") && isLeaveCode("compL") && !isLeaveCode("TRG") && !isLeaveCode("OJT"), "leave codes (NIL alone does not make a code leave)")
const extra = (code) => ({ SLP: 7.5, CL: 0, SH: 7 }[code] ?? 0)
check(cellHours("RD", { pasted: { RD: 3 } }) === 0, "RD is always 0")
check(cellHours("S", { pasted: { S: 6.5 }, table: TABLE }) === 6.5, "pasted hours beat the table")
check(cellHours("OJT", { table: TABLE }) === 7 && cellHours("TRG", { table: TABLE, extra }) === 7 && cellHours("SLP", { table: TABLE, extra }) === 7.5, "the table fills in a code without hours")
check(cellHours("1101105", { time: { hours: 7 }, pasted: { 1101105: 7 } }) === 7 && cellHours("ZZZ", {}) === 0, "duty numbers keep their hours; unknown codes are 0")
check(cellHours("SPT11", { table: TABLE }) === 10 && cellHours("SPT11", { pasted: p.hours, table: TABLE }) === 10, "SPT11 stays 10 hours")

// Team: matched by English full name, remembered, new names unticked.
check(preTicked(p, []).size === 0, "first import: nobody is ticked")
const before = ["ann lee", "Zed Gone"]
check([...preTicked(p, before)].join() === "0", "later import: last team ticked by full name (case and spaces ignored)")
check(leftNames(p, before).join() === "Zed Gone", "people missing from the new paste are listed")
check(dupNames(p, new Set([0, 1])).length === 0 && dupNames(parsePaste(pasted.replace("Di Ho", "Ann Lee")), new Set([0, 4])).length === 2, "the same name ticked twice is refused")

const ticked = new Set([0, 1, 3, 4])
const roster = buildRoster(p, ticked)
check(roster.numbers.join() === "1,2,3,4,5,6" && roster.names.join() === "Ann Lee,Bo Chan,,Cy Wong,Di Ho,", "only ticked people keep a name; every row is kept")
check(roster.remarks.join() === "E,L,,AL,HC," && roster.anchor.monday === "2026-09-21" && roster.hours.SPT11 === 10, "Remarks of ticked people, anchor week and pasted hours are stored")
const round = cleanPlanRoster(JSON.parse(JSON.stringify(roster)))
check(round && round.rows[1][1] === "OJT" && round.remarks[3] === "AL" && round.hours.SPT11 === 10, "a stored roster reads back (wide codes allowed)")
check(cleanPlanRoster({ ...roster, rows: [["!!", "RD", "RD", "RD", "RD", "RD", "RD"]], numbers: [1], names: [""] }) === null, "a roster with an unreadable code is refused")

// importWeek: members from ticked rows, with Remarks refreshed on every import and preferences kept.
const first = importWeek(roster, null, "2026-09-21")
check(first.members.map((m) => `${m.name}:${m.remark}`).join() === "Ann Lee:E,Bo Chan:L,Cy Wong:AL,Di Ho:HC", "members carry their Remarks")
const prefsPlan = { ...first, members: first.members.map((m) => (m.name === "Ann Lee" ? { ...m, prefs: ["early"] } : m)) }
const later = buildRoster(parsePaste(pasted.replace(/(Ann Lee[^\n]*?)\tE\t/, "$1\tL\t")), new Set([0, 1, 4]))
const second = importWeek(later, prefsPlan, "2026-09-28")
check(second.members.find((m) => m.name === "Ann Lee").remark === "L" && second.members.find((m) => m.name === "Ann Lee").prefs[0] === "early", "Remarks refresh on a new import, preferences stay")
check(second.members.length === 3, "a member unticked on the next import leaves the team")
const saved = cleanPlan(JSON.parse(JSON.stringify(first)))
check(saved.members[0].remark === "E" && saved.members[3].remark === "HC", "Remarks survive a saved plan")

// Remarks order: default E, L, HC, AL; then A–Z, Z–A; each ties by row.
const people = [["x", "AL", 4], ["y", "E", 3], ["z", "HC", 2], ["w", "L", 1], ["v", "E", 0], ["u", "", 9], ["t", "E/L", 8]].map(([name, remark, row]) => ({ row, member: { name, remark } }))
const order = (mode) => [...people].sort(byRemark(mode)).map((l) => l.member.remark || "-").join(",")
check(order("default") === "E,E,L,HC,AL,E/L,-", `Remarks default order E, L, HC, AL (${order("default")})`)
check(order("asc") === "AL,E,E,E/L,HC,L,-", `Remarks A–Z (${order("asc")})`)
check(order("desc") === "L,HC,E/L,E,E,AL,-", `Remarks Z–A (${order("desc")})`)
check([...people].sort(byRemark("default")).map((l) => l.row).slice(0, 2).join() === "0,3", "same Remarks go by row")
check(nextRemarkMode("default") === "asc" && nextRemarkMode("asc") === "desc" && nextRemarkMode("desc") === "default", "one click A–Z, again Z–A, again back")

// 複製: tab separated, no header, ticked members, Rota No. of the imported week, total of the seven days.
const lines = weekView(roster, first, "2026-09-21")
const hoursOf = (code) => cellHours(code, { pasted: roster.hours, table: TABLE })
const text = exportText(lines, hoursOf, "name")
const rows = text.split("\n").map((l) => l.split("\t"))
check(rows.length === 4 && rows.every((r) => r.length === 11), "one row of 11 cells per ticked member, no header")
check(rows.map((r) => r[1]).join() === "Ann Lee,Bo Chan,Cy Wong,Di Ho", "default order is English name A–Z")
check(rows[0].slice(0, 3).join() === "1,Ann Lee,E" && rows[0].slice(3, 10).join() === "1101105,1101581,1101126,1101104,1102105,RD,HSP1", "Rota No., name, Remarks, then Monday to Sunday")
check(rows[0][10] === "43" && rows[2][10] === "35", "total = seven days (RD 0, AL/SH 7), not the imported Working Hr")
check(rows[1][10] === "38.5", `table fills OJT, S; pasted SPT11 10 (${rows[1][10]})`)
check(exportText([...lines].reverse(), hoursOf, "rota").split("\n").map((l) => l.split("\t")[0]).join() === "1,2,4,5", "option to order by Rota No.")
const holes = lines.map((l, i) => (i === 0 ? { ...l, codes: ["-", ...l.codes.slice(1)] } : l))
check(emptyCount(holes) === 1 && exportText(holes, hoursOf).split("\n").find((l) => l.startsWith("1\t")).split("\t")[3] === "", "an empty cell is blank in the copy and counted")
check(rows.every((r) => !/Tra|Vacant/.test(r.join())), "TRA and Zvacant never reach the copy")

// The pasted week is the Rota No. of that week; a later week shifts one row.
const next = weekView(roster, first, "2026-09-28")
check(next.map((l) => l.row).join() !== lines.map((l) => l.row).join() && lines.map((l) => l.row).join() === "1,2,4,5", "later weeks rotate from the imported rows")

if (failed) {
  console.error(`${failed} check(s) failed`)
  process.exit(1)
}
console.log("validate_paste: all checks passed")
