// Checks lib/tml-hko.js（天文台農曆對照表、天氣預報）:
//   node tools/validate_hko.mjs
import { lunarFromApi, lunarLabel, mergeFnd, nextTerm, parseLunarTable, psrLevel, tempRange, wxIcon, cleanFlw, cleanWarnsum, cleanWarningInfo, cleanSwt, cleanQuake, cleanRyes, wxAlerts, warnIconSvg, warnIconUrl, hkoUrl } from "../lib/tml-hko.js"

let failed = 0
const check = (ok, what) => {
  if (!ok) failed += 1
  console.log(`${ok ? "✓" : "✗"} ${what}`)
}

// 天文台文字表（T2026c.txt）嘅樣：每月初一只寫月份，節氣喺最後一欄
const TEXT = [
  "2026(丙午 - 肖馬)年公曆與農曆日期對照表",
  "公曆日期              農曆日期    星期        節氣",
  "2026年1月1日          十三        星期四",
  "2026年1月5日          十七        星期一      小寒",
  "2026年1月18日         三十        星期日",
  "2026年1月19日         十二月      星期一",
  "2026年2月17日         正月        星期二",
  "2026年2月18日         初二        星期三",
  "2026年10月10日        九月        星期六",
  "2026年11月7日         廿九        星期六      立冬",
  "2026年11月8日         三十        星期日",
  "2026年11月9日         十月        星期一",
  "2026年11月22日        十四        星期日      小雪",
].join("\r\n")
const t = parseLunarTable(TEXT)
check(lunarLabel(t["2026-01-01"]) === "十一月十三", "year start before the first month line belongs to the month before (十一月)")
check(t["2026-01-05"].term === "小寒", "solar term column is read")
check(lunarLabel(t["2026-01-19"]) === "十二月初一", "a month-only line is 初一 of that month")
check(lunarLabel(t["2026-02-18"]) === "正月初二", "days follow the latest month (正月)")
check(lunarLabel(t["2026-11-08"]) === "九月三十" && lunarLabel(t["2026-11-09"]) === "十月初一", "2026-11-08 九月三十, 11-09 十月初一")
check(Object.keys(t).length === 11, "title and header lines are skipped")

// CSV 版（欄位次序唔靠）
const csv = parseLunarTable("﻿公曆日期,農曆日期,星期,節氣\n2027-01-01,十一月廿四,星期五,\n2027-01-05,十一月廿八,星期二,小寒\n")
check(lunarLabel(csv["2027-01-01"]) === "十一月廿四" && csv["2027-01-05"].term === "小寒", "CSV with full lunar dates")
check(Object.keys(parseLunarTable("nothing here\n")).length === 0, "rubbish gives an empty table")

check(nextTerm(t, "2026-11-08")?.term === "小雪" && nextTerm(t, "2026-11-07").date === "2026-11-07", "nextTerm counts the day itself")
check(lunarLabel(lunarFromApi({ LunarYear: "丙午年，馬", LunarDate: "九月三十" })) === "九月三十", "lunardate.php answer")
check(lunarFromApi({ LunarDate: "?" }) === null, "bad lunardate.php answer is ignored")

// 天氣
check(psrLevel("中高")?.level === 3 && psrLevel("Low")?.text === "低" && psrLevel("x") === null, "PSR levels")
check(wxIcon(65) === "⛈️" && wxIcon("50") === "☀️" && wxIcon(999) === "🌡️", "weather icons")
const day = (d, psr) => ({ forecastDate: d, week: "星期一", forecastWeather: "大致多雲", forecastWind: "東風", forecastMintemp: { value: 22, unit: "C" }, forecastMaxtemp: { value: 26, unit: "C" }, ForecastIcon: 54, PSR: psr })
const morning = mergeFnd(null, { weatherForecast: [day("20261108", "中"), day("20261109", "低")], updateTime: "x" }, "2026-11-08")
const noon = mergeFnd(morning, { weatherForecast: [day("20261109", "中高"), day("20261110", "低")] }, "2026-11-08")
check(noon.days["2026-11-08"]?.psr === "中" && noon.days["2026-11-09"].psr === "中高" && noon.days["2026-11-10"], "fnd merge keeps this morning's today and takes newer days")
check(!mergeFnd(noon, null, "2026-11-09").days["2026-11-08"], "past days are dropped")
check(tempRange(noon.days["2026-11-09"]) === "22–26°", "temperature range")
check(cleanFlw({ forecastDesc: "  天晴。 ", tcInfo: "" })?.desc === "天晴。" && cleanFlw({}) === null, "flw cleaned")

// 警告
const ws = cleanWarnsum({
  WFIRE: { name: "火災危險警告", code: "WFIRE", type: "紅色", actionCode: "ISSUE" },
  WTCSGNL: { name: "熱帶氣旋警告信號", code: "TC8NE", actionCode: "ISSUE", issueTime: "2026-11-08T22:15:00+08:00" },
  WRAIN: { name: "暴雨警告信號", code: "WRAINA", actionCode: "CANCEL" },
})
check(ws.map((w) => w.code).join() === "TC8NE,WFIRER", "warnsum: cancelled dropped, 紅色火災 read from type, TC first")
check(cleanWarnsum({}).length === 0 && cleanWarnsum(null).length === 0, "no warnings -> nothing")
const info = cleanWarningInfo({ details: [{ warningStatementCode: "WTCSGNL", contents: ["八號東北烈風或暴風信號現正生效。", "長文……"] }] })
check(info.WTCSGNL.length === 2 && Object.keys(cleanWarningInfo({})).length === 0, "warningInfo by statement code; empty body is fine")
check(cleanSwt({ swt: [{ desc: " 雷雨區正移近 " }] })[0] === "雷雨區正移近" && cleanSwt({}).length === 0, "special weather tips")
const now = Date.parse("2026-11-08T23:00:00+08:00")
const qem = cleanQuake({ mag: 5.6, region: "台灣東部海域", ptime: "2026-11-08T21:05:00+08:00" })
const oldQ = cleanQuake({ mag: 4, region: "日本", ptime: "2026-11-05T21:05:00+08:00" })
const felt = cleanQuake([{ mag: 4.1, region: "廣東陽江", intensity: "III", ptime: "2026-11-08T20:00:00+08:00", details: ["長文"] }])
const ryes = cleanRyes({ KingsParkLocationName: "京士柏", KingsParkMicrosieverts: "0.14", TapMunMicrosieverts: "0.12", RYESDate: "20261107" })
check(qem.mag === 5.6 && felt.intensity === "III" && ryes.max === 0.14 && ryes.stations[1].name === "TapMun", "earthquake and radiation parsed")
check(cleanRyes({ foo: 1 }) === null && cleanQuake({}) === null, "rubbish quake / RYES -> null")
const items = wxAlerts({ warnsum: ws, info, swt: ["短提示", "好長".repeat(30)], qem, felt, ryes }, now)
const by = Object.fromEntries(items.map((a) => [a.key, a]))
check(items[0].code === "TC8NE" && by["w-TC8NE"].more.length === 2 && by["w-WFIRER"].more.length === 0, "warnings first, details hidden behind a tap")
check(by["swt-0"].text === "短提示" && !by["swt-1"].text && by["swt-1"].more.length === 1, "short tip inline, long tip collapsed")
check(by.qem.text.includes("5.6") && by.felt.text.includes("III") && by.felt.more[0] === "長文", "recent earthquakes shown")
check(!wxAlerts({ qem: oldQ }, now).length, "old earthquake not shown")
check(by.ryes.kind === "info" && !by.ryes.text && by.ryes.more.length === 2, "normal radiation collapsed")
check(wxAlerts({ ryes: cleanRyes({ XMicrosieverts: 0.5 }) }, now)[0].kind === "warn-info", "high radiation shown")
check(wxAlerts({}, now).length === 0 && wxAlerts(null).length === 0, "nothing at all -> no items")
check(wxAlerts({ tc: "熱帶氣旋銀杏集結在南海北部。" }, now)[0].title === "熱帶氣旋消息", "flw tcInfo kept when warnsum unavailable")
check(warnIconSvg("TC8NE").includes("東北") && warnIconSvg("TC1").includes("<path") && warnIconSvg("WRAINB").includes("雨") && warnIconSvg("XX") === "", "warning icons")
check(warnIconUrl("TC8SE").endsWith("/tc8b.gif") && warnIconUrl("WMSGNL").endsWith("/sms.gif") && warnIconUrl("WFIRER").endsWith("/firer.gif") && warnIconUrl("XX") === "", "official HKO warning icons")
check(by.ryes.title === "☢ 輻射水平", "radiation line title")
check(hkoUrl("qem").includes("earthquake.php?dataType=qem") && hkoUrl("ryes", "2026-11-07").includes("date=20261107") && hkoUrl("x") === null, "feed URLs")

if (failed) {
  console.error(`${failed} check(s) failed`)
  process.exit(1)
}
console.log("validate_hko OK")
