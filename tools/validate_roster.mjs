// Checks lib/tml-roster.js on a made-up roster (a real one never goes in the repo):
//   node tools/validate_roster.mjs
import { classify, cleanNote, cleanRoster, dayEntry, isLocked, keepLocked, mondayOf, newRoster, recentLocks, recentNotes, setNote, toggleLock, parseRoster, recentOverrides, rowLabelFor, setOverride, weekDates, weekdayIndex } from "../lib/tml-roster.js"
import { shiftOf } from "../lib/tml-shift.js"
import { reliefOf } from "../lib/tml-duties.js"
import { nearRows, summariseWeek, weekLabel } from "../lib/tml-week.js"
import { placeNames, sheetForDate } from "../lib/tml-data.js"
import { holidaysOn, parseIcs } from "../lib/tml-ics.js"
import { cleanOt, monthDates, otClock, otFromClock, recentOt, setOt } from "../lib/tml-ot.js"

let failed = 0
const check = (ok, what) => {
  if (!ok) failed += 1
  console.log(`${ok ? "✓" : "✗"} ${what}`)
}

// Three weekly rows labelled 7, 8, 9 (so the cycle wraps 9 -> 7).
const csv = [
  ",Mon,Tue,Wed,Thu,Fri,Sat,Sun",
  "7,1101101,1101102,RD,1101104,1101105,6091101,RD",
  "8,AL,AL,AL,SH,SH,RD,RD",
  "9,HSP1,KSP3,1101103,RD,HC,RD,7091102",
].join("\n")
const parsed = parseRoster(csv)
check(parsed.rows.length === 3 && parsed.issues.length === 0, "a header line is skipped and 3 rows read")
check(parsed.numbers.join() === "7,8,9", "the row labels are kept")
check(parseRoster(csv.replace(/,/g, "\t")).rows.length === 3, "tab separated rows read too")
check(parseRoster("1101101 RD RD 1101104 1101105 RD RD").rows.length === 1, "white space separated rows without a label read too")
const quoted = parseRoster('1,"Chan, Tai ""Man""",1101101,RD,RD,RD,RD,RD,RD')
check(quoted.issues.length === 0 && quoted.names[0] === 'Chan, Tai "Man"' && quoted.rows[0][0] === "1101101", "a quoted name with a comma and quotes reads back as one cell")
check(Object.keys(recentOverrides({ "2025-01-01": "AL", "2026-01-01": "RD", "2026-10-22": "AL" }, "2026-10-22")).join() === "2026-01-01,2026-10-22", "overrides older than a year are left out of the upload")
check(parseRoster("1,1101101,RD").issues.length === 1, "a short line is reported, not guessed")
check(parseRoster("1,1101101,RD,RD,RD,RD,RD,??").issues.length === 1, "a cell that is no duty or status is reported")

const withNames = parseRoster(",Name,Mon,Tue,Wed,Thu,Fri,Sat,Sun\n1,,1101101,RD,RD,RD,RD,RD,RD\n2,Chan Tai Man,1101102,RD,RD,RD,RD,RD,RD")
check(withNames.issues.length === 0 && withNames.rows.length === 2 && withNames.names.join("|") === "|Chan Tai Man" && withNames.numbers.join() === "1,2", "a Name column is read and its header line skipped")
const roster = newRoster(parsed, { row: 8, monday: "2026-10-12" })
check(weekdayIndex("2026-10-12") === 0 && weekdayIndex("2026-10-18") === 6, "12 Oct 2026 is a Monday and 18 Oct a Sunday")
check(mondayOf("2026-10-18") === "2026-10-12" && mondayOf("2026-10-19") === "2026-10-19", "a week runs Monday to Sunday")
check(weekDates("2026-10-12").join() === "2026-10-12,2026-10-13,2026-10-14,2026-10-15,2026-10-16,2026-10-17,2026-10-18", "weekDates lists 7 days")
check(rowLabelFor(roster, "2026-10-12") === 8, "the anchor week is the anchor row")
check(rowLabelFor(roster, "2026-10-19") === 9, "the next week is the next row")
check(rowLabelFor(roster, "2026-10-26") === 7, "after the last row it goes back to the first")
check(rowLabelFor(roster, "2026-10-05") === 7, "the week before goes back one row, wrapping the other way")
check(rowLabelFor(roster, "2027-03-01") === rowLabelFor(roster, "2026-10-12") || rowLabelFor(roster, "2027-03-01") !== null, "any later date still lands on a row")
check(rowLabelFor(roster, "2026-11-02") === rowLabelFor(roster, "2026-10-12"), "a full cycle (3 weeks) later is the same row")
check(dayEntry(roster, "2026-10-15").code === "SH" && dayEntry(roster, "2026-10-15").source === "cycle", "Thursday of the anchor week is SH from the cycle")
check(dayEntry(roster, "2026-10-19").code === "HSP1", "Monday of the next week is HSP1")
check(dayEntry(roster, "2026-10-25").code === "7091102" && dayEntry(roster, "2026-10-25").row === 9, "Sunday of the next week is 7091102 (row 9)")

const changed = setOverride(roster, "2026-10-24", "8022131")
check(dayEntry(changed, "2026-10-24").code === "8022131" && dayEntry(changed, "2026-10-24").source === "override" && dayEntry(changed, "2026-10-24").defaultCode === "RD",
  "an override replaces the cycle's cell and remembers the default")
check(dayEntry(roster, "2026-10-24").code === "RD", "setOverride does not change the roster it was given")
check(Object.keys(setOverride(changed, "2026-10-24", "RD").overrides).length === 0, "setting a day back to the cycle's cell clears the override")
check(Object.keys(setOverride(changed, "2026-10-24", null).overrides).length === 0, "null clears the override")
check(dayEntry(null, "2026-10-12") === null && dayEntry(roster, "x") === null, "no roster or a bad date gives null")
check(dayEntry({ ...roster, anchor: { row: 99, monday: "2026-10-12" } }, "2026-10-12") === null, "an anchor row that does not exist gives null")

check(classify("1101179").sheet === "1101" && classify("8022131").kind === "duty", "a 7-digit number is a duty and its sheet is the first four digits")
check(classify("rd").kind === "status" && classify("KSP3").kind === "spare" && classify("HSP1").kind === "spare" && classify("E43").kind === "other", "RD is a status, KSP/HSP are spare, anything else is other")

const round = cleanRoster(JSON.parse(JSON.stringify(changed)))
check(round && dayEntry(round, "2026-10-24").code === "8022131", "a saved roster survives a JSON round trip")
check(cleanRoster({ v: 1, rows: [["1", "2"]], anchor: {} }) === null, "a broken roster is refused")
check(cleanRoster({ ...roster, anchor: { row: 7, monday: "2026-10-14" } }).anchor.monday === "2026-10-12", "an anchor date in mid-week moves to its Monday")

// ---- 五級更類：邊界一定要準，錯咗顏色同標籤就會靜靜錯 ----
check(shiftOf(6.5 * 3600 - 1, 11 * 3600) === "dawn", "06:29:59 上班當死早")
check(shiftOf(6.5 * 3600, 11 * 3600) === "early", "06:30:00 上班已經唔算死早")
check(shiftOf(10 * 3600 - 1, 16 * 3600) === "early" && shiftOf(10 * 3600, 16 * 3600) === "mid", "10:00 係早／中分界")
check(shiftOf(15 * 3600 - 1, 21 * 3600) === "mid" && shiftOf(15 * 3600, 21 * 3600) === "late", "15:00 係中／夜分界")
check(shiftOf(16 * 3600, 86400 + 0.5 * 3600) === "late", "00:30:00 落班仲係夜")
check(shiftOf(16 * 3600, 86400 + 0.5 * 3600 + 1) === "night", "00:30:01 之後落班當死夜")
check(shiftOf(4 * 3600, 86400 + 3600) === "dawn", "死早壓過死夜（兩樣都中時講死早）")
check(shiftOf(null, 3600) === "", "冇上班時間就冇更類")

// ---- 週標題：年份同年寫一次，跨年要寫兩次 ----
check(weekLabel(weekDates("2026-10-12")) === "2026/10/12 – 10/18", "同年嘅週標題只寫一次年份")
check(weekLabel(weekDates("2026-12-28")) === "2026/12/28 – 2027/1/3", "跨年嘅週標題兩邊都寫年份")
check(weekLabel(weekDates(mondayOf("2026-01-01"))) === "2025/12/29 – 2026/1/4", "年頭嘅週由上年 12 月開始")
check(weekLabel([]) === "", "冇日期就冇標題")

// ---- 附近行：頭尾都唔會負數或越界 ----
const wide = { rows: Array.from({ length: 12 }, () => []), numbers: Array.from({ length: 12 }, (_, i) => 70 + i) }
check(nearRows(wide, 70).join() === "0,1,2,3,4", "第一行時只向下顯示 5 行")
check(nearRows(wide, 81).join() === "7,8,9,10,11", "最後一行時只向上顯示 5 行")
check(nearRows(wide, 76).join() === "2,3,4,5,6,7,8,9,10", "中間嘅行上下各 4 行")
check(nearRows(wide, 999).join() === "0,1,2,3,4", "唔識嘅行號由第一行開始")
check(nearRows({ rows: [], numbers: [] }, 70).length === 0, "冇行就冇附近行")

// ---- 週概況：只計真更份工時，RD／AL／SH 唔計 ----
const basic = {
  "1101101": { on: 6 * 3600, duty: { work: 300 } },
  "1101102": { on: 13 * 3600, duty: { off: [21 * 3600] } },
  "1101103": { on: 7 * 3600, basic: { hours: 8.5 } },
  "1101104": { on: null, duty: null },
}
const entries = {
  "2026-11-02": "1101101", "2026-11-03": "1101102", "2026-11-04": "1101103",
  "2026-11-05": "1101104", "2026-11-06": "RD", "2026-11-07": "AL", "2026-11-08": "SH",
}
const week = summariseWeek(weekDates("2026-11-02"),
  (date) => ({ code: entries[date] ?? "RD" }),
  (code) => basic[code] ?? { on: null })
check(week.days === 3, `週概況計 3 日開工（實際 ${week.days}）`)
check(week.minutes === 300 + 480 + 510, `週概況工時 21 小時 30 分（實際 ${week.minutes} 分）`)
check(week.rest === 1 && week.leave === 2 && week.pending === 1, "休息／假期／待定分開計，未載入嘅日子當待定")
check(summariseWeek([], () => null, () => ({})).days === 0, "冇日期就係零")
// 其他代碼：TRG（7 小時，冇時間）、SLP（7.5 小時，15:00–23:00）計開工；CP 係假期；HC 待定。
const extras = { "2026-11-02": "TRG", "2026-11-03": "SLP", "2026-11-04": "CP", "2026-11-05": "HC", "2026-11-06": "SEP" }
const ex = summariseWeek(weekDates("2026-11-02").slice(0, 5), (date) => ({ code: extras[date] }), (code) => (
  code === "TRG" ? { on: null, extraHours: 7 }
    : code === "SLP" ? { on: 15 * 3600, basic: { on: 15 * 3600, off: 23 * 3600, hours: 7.5 } }
      : { on: 24300, basic: { on: 24300, off: 54900, hours: 8 } }))
check(ex.days === 3 && ex.minutes === (7 + 7.5 + 8) * 60 && ex.leave === 1 && ex.pending === 1, `TRG／SLP／SEP 計開工同工時，CP 計假期，HC 待定（實際 ${JSON.stringify(ex)}）`)
const hc = summariseWeek(["2026-11-02", "2026-11-03"], (date) => ({ code: date === "2026-11-02" ? "HC" : "AL" }), () => ({ on: null }))
check(hc.pending === 1 && hc.leave === 1, "HC 計待定，唔計假期")

// 後備更（KSP／HSP）冇 duty sheet，但都係返工：要計日數，時數用 Index 表
const spare = summariseWeek(weekDates("2026-11-02"),
  (date) => ({ code: date === "2026-11-02" ? "KSP3" : "RD" }),
  () => ({ on: 43200, basic: { off: 75600, hours: 8.5 } }))
check(spare.days === 1 && spare.minutes === 510, `後備更計開工日同工時（實際 ${spare.days} 日 ${spare.minutes} 分）`)
check(spare.rest === 6, "同一週嘅 RD 照樣計休息")

// 真週樣本：三晚死夜 + 一個中更 + 後備更 + 一個中更
const realWeek = ["1101179", "1101182", "1101165", "RD", "1101148", "KSP3", "7091133"]
const realCells = {
  "1101179": { on: 62100, duty: { work: 480 } },
  "1101182": { on: 62940, duty: { work: 480 } },
  "1101165": { on: 55500, duty: { work: 450 } },
  "1101148": { on: 51600, duty: { work: 450 } },
  "7091133": { on: 53880, duty: { work: 420 } },
  "KSP3": { on: 43200, basic: { off: 75600, hours: 8.5 } },
}
const real = summariseWeek(weekDates("2026-10-12"),
  (date) => ({ code: realWeek[weekDates("2026-10-12").indexOf(date)] }),
  (code) => realCells[code] ?? { on: null })
check(real.days === 6 && real.minutes === 2790, `六日開工 = 46 小時 30 分（實際 ${real.days} 日 ${real.minutes} 分）`)
check(real.minutes !== 6 * 510, "工時用工作時數（扣飯），唔係上落班時間差")


// 工時以官表 Index 為準（後備更都靠佢）；duty sheet 只做後備。
// 真資料兩邊嘅差異由 TML-traffic 嘅 tools/validate-hours.mjs 審，唔一致會即刻報。
const oneDay = (code) => (date) => ({ code: date === "2026-11-02" ? code : "RD" })
const clash = summariseWeek(weekDates("2026-11-02"), oneDay("9900001"),
  () => ({ on: 24840, duty: { work: 480, off: [55440] }, basic: { off: 55440, hours: 7.5 } }))
check(clash.minutes === 7 * 60 + 30, `官表同 duty sheet 打對台時用官表 7.5 小時（實際 ${clash.minutes} 分）`)
const noIndex = summariseWeek(weekDates("2026-11-02"), oneDay("9900001"),
  () => ({ on: 24840, duty: { work: 480, off: [55440] } }))
check(noIndex.minutes === 480, "官表冇呢個更份時才用 duty sheet 嘅工作時數")

// 1101131 官表印錯 7.5，TML-traffic data/duty-hours-fixes.json 改返 8：一週有佢就多 0.5 小時
const fixed = summariseWeek(weekDates("2026-11-02"), oneDay("1101131"),
  () => ({ on: 24840, basic: { off: 55440, hours: 8 } }))
check(fixed.minutes === 480, `1101131 用修正後 8 小時（實際 ${fixed.minutes} 分）`)

// 特別日子嘅 Duty Sheet：按日期揀，7091M 同 7091 共用編號
{
  const sheets = [{ code: "7091", dates: null, alsoOn: ["2026-10-19"] }, { code: "7091M", dates: ["2026-11-01"] }, { code: "8022", dates: ["2026-10-24"], alsoOn: ["2026-10-31"] }]
  check(sheetForDate(sheets, "2026-11-01", "7091123") === "7091M", "11/1 嘅 7091xxx 用 7091M")
  check(sheetForDate(sheets, "2026-11-08", "7091123") === "7091", "其他星期日用返 7091")
  check(sheetForDate(sheets, "2026-10-31", "8022101") === "8022" && sheetForDate(null, "2026-11-01", "7091123") === "7091", "冇 index 就用頭 4 位")
  check(placeNames({ places: { note: "x", OS: { tc: "外放車" }, CIOT: { tc: "第一城側線" } } }).OS === "外放車" && !("note" in placeNames({ places: { note: "x" } })), "地點名由 places 讀")
  const days = []
  summariseWeek(["2026-11-01"], (date) => ({ code: "7091123" }), (code, date) => { days.push(date); return { on: 31080, duty: { work: 480 } } })
  check(days.join() === "2026-11-01", "週概況問更份時間時帶埋日期")
}

// 學校假期 iCal（lib/tml-ics.js）
{
  const ics = "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261029\r\nDTEND;VALUE=DATE:20261031\r\nSUMMARY:中期考試後\r\n 假期\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261001\r\nSUMMARY:國慶日\r\nEND:VEVENT"
  const list = parseIcs(ics)
  check(list.length === 2 && list[0].start === "2026-10-01" && list[1].end === "2026-10-30" && list[1].title === "中期考試後假期", "iCal：長行接返、全日活動 DTEND 唔包、按日期排")
  check(holidaysOn(list, "2026-10-30").join() === "中期考試後假期" && holidaysOn(list, "2026-10-31").length === 0 && holidaysOn(null, "2026-10-01").length === 0, "holidaysOn 搵某日嘅假期")
}

// OT（lib/tml-ot.js）
{
  check(JSON.stringify(cleanOt({ "2026-10-25": { whole: true, after: 210.4 }, "2026-02-30": { whole: true }, "2026-10-26": { before: 0 } })) === '{"2026-10-25":{"whole":true,"after":210}}', "cleanOt 只留有效日子同分鐘")
  const base = newRoster(parseRoster("75,1101105,1101144,RD,1101150,1101179,RD,AL"), { row: 75, monday: "2026-10-19" })
  const withOt = setOt(setOt(base, "2026-10-21", { whole: true }), "2026-10-20", { after: 210 })
  check(dayEntry(withOt, "2026-10-21").ot?.whole === true && dayEntry(withOt, "2026-10-22").ot === null, "dayEntry 帶埋 OT")
  check(!("2026-10-20" in setOt(withOt, "2026-10-20", { after: 0 }).ot), "OT 改做 0 就刪走")
  check(JSON.stringify(cleanRoster(JSON.parse(JSON.stringify(withOt))).ot) === JSON.stringify(withOt.ot), "OT 匯出再匯入唔會冇咗")
  check(Object.keys(recentOt({ "2025-01-01": { after: 60 }, "2026-10-01": { after: 60 } }, "2026-10-24")).join() === "2026-10-01", "上傳前刪走一年前嘅 OT")
  check(otFromClock(12 * 3600 + 20 * 60, "15:50", "after") === 210 && otFromClock(23 * 3600, "01:30", "after") === 150, "揀鐘數計 OT（包過午夜）")
  check(otFromClock(4 * 3600 + 50 * 60, "03:50", "before") === 60 && otClock(4 * 3600 + 50 * 60, 60, "before") === "03:50" && otClock(23 * 3600, 150, "after") === "01:30", "更前 OT 鐘數互換")
  check(monthDates("2026-02-14").length === 28 && monthDates("2026-10-24")[0] === "2026-10-01" && monthDates("2026-10-24").at(-1) === "2026-10-31", "monthDates 由 1 號到月尾")
  // RD 日返 1101150 成更 OT（7 小時）、1101105 放工後 OT 3.5 小時：開工日照計，工時唔包 OT
  const entries = { "2026-10-20": { code: "1101105", ot: { after: 210 } }, "2026-10-21": { code: "1101150", ot: { whole: true } }, "2026-10-22": { code: "1101144", ot: null } }
  const w = summariseWeek(Object.keys(entries), (date) => entries[date], (code) => ({ on: 30000, basic: { hours: code === "1101105" ? 7.5 : 7 } }))
  check(w.days === 3 && w.minutes === 870 && w.ot === 630, `OT 日計開工日，OT 同工時分開計（實際 ${w.days} 日 ${w.minutes} 分 OT ${w.ot}）`)
}

// 接車／交車：用真 duty sheet（公開資料）DS1101，由 TML-traffic 讀。釘死一個 commit，
// 咁 TML-traffic 出新 sheet 都唔會令呢度嘅答案變、阻住部署。
const DS1101 = "https://raw.githubusercontent.com/iceninye/TML-traffic/7058e71cc311613656de8272d799e17dc06b8cab/data/duties/DS1101.json"
const sheet = Object.values((await (await fetch(DS1101)).json()).duties)
const d105 = sheet.find((d) => d.id === "1101105")
check(reliefOf(d105, sheet, 1).from === null, "出車準備之後直接開同一個 run，唔當接車")
check(reliefOf(d105, sheet, 2).from?.id === "1101112", `1101105 喺 WKS 接 Run 10 由 1101112 交（實際 ${reliefOf(d105, sheet, 2).from?.id}）`)
check(reliefOf(d105, sheet, 3).from?.id === "1101126", "1101105 喺錦上路接 Run 22 由 1101126 交")
const back = reliefOf(sheet.find((d) => d.id === "1101112"), sheet, sheet.find((d) => d.id === "1101112").legs.findIndex((l) => l[1] === 10 && l[5] === 26520))
check(back.to?.id === "1101105", "反方向：1101112 喺 WKS 將 Run 10 交俾 1101105")

// 每日備註
{
  const base = newRoster(parseRoster(",Mon,Tue,Wed,Thu,Fri,Sat,Sun\n1,1101101,RD,RD,AL,AL,SH,RD"), { row: 1, monday: "2026-10-19" })
  const noted = setNote(base, "2026-10-21", "  同 Ken 換更\r\n帶證件\u0007 ")
  check(noted.notes["2026-10-21"] === "同 Ken 換更\n帶證件", "a note is trimmed, keeps line breaks and drops control characters")
  check(!("2026-10-21" in setNote(noted, "2026-10-21", "   ").notes), "a blank note deletes it")
  check(cleanNote("字".repeat(300)).length === 200, "a note is cut at 200 characters")
  check(JSON.stringify(cleanRoster(JSON.parse(JSON.stringify({ ...noted, notes: { ...noted.notes, bad: "x", "2026-10-22": "" } }))).notes) === JSON.stringify({ "2026-10-21": "同 Ken 換更\n帶證件" }), "notes survive a save; bad ones are dropped")
  check(Object.keys(recentNotes({ "2025-01-01": "a", "2026-10-21": "b" }, "2026-10-24")).join() === "2026-10-21", "only notes from the last year are uploaded")
}

// 🔒 鎖住嘅星期：影低 7 格（包括手動改），換 Standard Roster／行號都唔變
{
  const base = newRoster(parseRoster(",Mon,Tue,Wed,Thu,Fri,Sat,Sun\n1,1101101,RD,RD,AL,AL,SH,RD\n2,1101102,1101103,RD,RD,1101104,1101105,1101106"), { row: 1, monday: "2026-10-19" })
  const edited = setOverride(base, "2026-10-21", "1101199")
  const locked = toggleLock(edited, "2026-10-19")
  check(isLocked(locked, "2026-10-19") && !isLocked(locked, "2026-10-26"), "a week can be locked")
  const moved = { ...locked, anchor: { row: 2, monday: "2026-10-19" } }
  check(dayEntry(moved, "2026-10-21").code === "1101199" && dayEntry(moved, "2026-10-21").source === "override" && dayEntry(moved, "2026-10-19").code === "1101101" && dayEntry(moved, "2026-10-19").locked, "a locked week keeps its cells and manual changes when the row changes")
  check(dayEntry(moved, "2026-10-26").code === "1101101" && !dayEntry(moved, "2026-10-26").locked, "other weeks follow the new row")
  check(dayEntry(moved, "2026-10-19").row === 1, "a locked week keeps its row number")
  const unlocked = toggleLock(moved, "2026-10-19")
  check(!isLocked(unlocked, "2026-10-19") && dayEntry(unlocked, "2026-10-19").code === "1101102", "unlocking goes back to the roster")
  const fresh = newRoster(parseRoster(",Mon,Tue,Wed,Thu,Fri,Sat,Sun\n1,RD,RD,RD,RD,RD,RD,RD\n2,AL,AL,AL,AL,AL,AL,AL"), { row: 2, monday: "2026-10-19" })
  const kept = keepLocked(locked, fresh, ["2026-10-12", "2026-10-19"])
  check(dayEntry(kept, "2026-10-21").code === "1101199" && dayEntry(kept, "2026-10-13").code === "1101103" && dayEntry(kept, "2026-10-26").code === "RD", "an import keeps locked weeks and locks the given earlier weeks from the old roster")
  const saved = cleanRoster(JSON.parse(JSON.stringify(kept)))
  check(JSON.stringify(Object.entries(saved.locks).sort()) === JSON.stringify(Object.entries(kept.locks).sort()), "locks survive a save")
  check(Object.keys(cleanRoster({ ...kept, locks: { "2026-10-20": locked.locks["2026-10-19"], x: 1, "2026-10-26": { codes: [] } } }).locks).length === 0, "bad locks are dropped")
  check(Object.keys(recentLocks(kept.locks, "2027-10-20")).join() === "2026-10-19", "only locks from the last year are uploaded")
}

process.exit(failed ? 1 : 0)
