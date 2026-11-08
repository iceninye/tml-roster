// Checks lib/tml-hko.js（天文台農曆對照表、天氣預報）:
//   node tools/validate_hko.mjs
import { lunarFromApi, lunarLabel, mergeFnd, nextTerm, parseLunarTable, psrLevel, tempRange, wxIcon, cleanFlw } from "../lib/tml-hko.js"

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

if (failed) {
  console.error(`${failed} check(s) failed`)
  process.exit(1)
}
console.log("validate_hko OK")
