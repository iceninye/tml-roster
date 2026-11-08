// 天文台資料（Ice 2026-11-08）：天氣預報同公曆／農曆對照表。Pure：冇 DOM、冇網絡。
//
// - 本港地區天氣預報 flw、九天天氣預報 fnd：天文台開放數據 API
//   https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw|fnd&lang=tc
// - 公曆與農曆對照表（data.gov.hk）同節氣：天文台每年一份文字表
//   https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2026c.txt
//   （「2026年11月9日  十月  星期一」：每月初一只寫月份，其他日子只寫日；節氣寫喺最後一欄）
//   同 CSV 版 https://data.weather.gov.hk/weatherAPI/hko_data/calendar/nongli_calendar_2026.csv
//   兩款都用 parseLunarTable 讀：逐行搵日期、農曆、節氣，唔靠欄位位置。

export const HKO_API = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php"
export const HKO_LUNAR_API = "https://data.weather.gov.hk/weatherAPI/opendata/lunardate.php"
export const lunarTextUrl = (year) => `https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T${year}c.txt`
export const lunarCsvUrl = (year) => `https://data.weather.gov.hk/weatherAPI/hko_data/calendar/nongli_calendar_${year}.csv`

export const SOLAR_TERMS = [
  "小寒", "大寒", "立春", "雨水", "驚蟄", "春分", "清明", "穀雨", "立夏", "小滿", "芒種", "夏至",
  "小暑", "大暑", "立秋", "處暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至",
]
const TERM_ALIAS = { 惊蛰: "驚蟄", 谷雨: "穀雨", 小满: "小滿", 芒种: "芒種", 处暑: "處暑" }

const MONTHS = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"]
const DAYS = [
  "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
]
const MONTH_RE = /^(閏?(?:正|十一|十二|冬|臘|[一二三四五六七八九十]))月/
const pad = (n) => String(n).padStart(2, "0")

function dateOf(token) {
  const m = /(\d{4})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})/.exec(token)
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`
  const n = /^(\d{4})(\d{2})(\d{2})$/.exec(token)
  return n ? `${n[1]}-${n[2]}-${n[3]}` : null
}

// 「十二月」「閏六月」「十一月十三」「十三」「初一」 -> { month: "十二" | "閏六" | null, day: "初一" | "十三" | null }
function lunarOf(token) {
  const t = token.replace(/^農曆/, "")
  const m = MONTH_RE.exec(t)
  let month = m ? m[1].replace("冬", "十一").replace("臘", "十二") : null
  const rest = m ? t.slice(m[0].length) : t
  if (rest && !DAYS.includes(rest)) return null
  if (!month && !rest) return null
  return { month, day: rest || "初一" }
}

// 上一個月：用嚟補年頭（第一個「X月」之前嘅日子屬於上一個月）。閏月嘅上一個月係同名正月份。
function monthBefore(month) {
  if (month.startsWith("閏")) return month.slice(1)
  const i = MONTHS.indexOf(month)
  return MONTHS[(i + MONTHS.length - 1) % MONTHS.length]
}

// 讀一份對照表（文字表或 CSV），回 { "2026-11-08": { month: "九", day: "三十", term: "" }, ... }。
// 讀唔到任何一行就回 {}。
export function parseLunarTable(text) {
  const rows = []
  for (const line of String(text ?? "").replace(/^﻿/, "").split(/\r?\n/)) {
    const tokens = line.split(/[\s,，;\t"]+/).filter(Boolean)
    let date = null
    let lunar = null
    let term = ""
    for (const token of tokens) {
      const name = TERM_ALIAS[token] ?? token
      if (!date && dateOf(token)) date = dateOf(token)
      else if (SOLAR_TERMS.includes(name)) term = name
      else if (!lunar && date && !/^(星期|週|周)/.test(token)) lunar = lunarOf(token)
    }
    if (date && lunar) rows.push({ date, ...lunar, term })
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  // 只寫日嘅行跟返上面最近一個月份；年頭冇月份嘅，用第一個月份嘅上一個月
  const first = rows.find((r) => r.month)
  let month = first ? monthBefore(first.month) : null
  const out = {}
  for (const r of rows) {
    if (r.month) month = r.month
    if (!month) continue
    out[r.date] = { month, day: r.day, term: r.term }
  }
  return out
}

// 「九月三十」；初一寫「十月初一」
export const lunarLabel = (lunar) => (lunar ? `${lunar.month}月${lunar.day}` : "")

// 天文台 lunardate.php 回 { LunarYear: "丙午年，馬", LunarDate: "九月三十" }
export function lunarFromApi(body) {
  const text = String(body?.LunarDate ?? "").trim()
  const m = MONTH_RE.exec(text)
  if (!m) return null
  const day = text.slice(m[0].length)
  return DAYS.includes(day) ? { month: m[1], day, term: "" } : null
}

// 由 date 開始（包埋當日）搵下一個節氣：{ date, term } 或者 null。table 係 parseLunarTable 嘅合併結果。
export function nextTerm(table, date) {
  let best = null
  for (const [d, v] of Object.entries(table ?? {})) {
    if (v.term && d >= date && (!best || d < best.date)) best = { date: d, term: v.term }
  }
  return best
}

/* ------------------------------------------------------------------ 天氣 */

// 天文台天氣圖示編號 -> emoji（https://www.hko.gov.hk/textonly/v2/explain/wxicon_c.htm）
const ICONS = {
  50: "☀️", 51: "🌤️", 52: "⛅", 53: "🌦️", 54: "🌦️",
  60: "☁️", 61: "☁️", 62: "🌧️", 63: "🌧️", 64: "🌧️", 65: "⛈️",
  70: "🌙", 71: "🌙", 72: "🌙", 73: "🌙", 74: "🌙", 75: "🌙", 76: "☁️", 77: "🌙",
  80: "🌬️", 81: "🌵", 82: "💧", 83: "🌫️", 84: "🌫️", 85: "🌫️",
  90: "🥵", 91: "🌡️", 92: "🍃", 93: "🥶",
}
export const wxIcon = (code) => ICONS[Number(code)] ?? "🌡️"

// 顯著降雨概率（PSR）：高、中高、中、中低、低 -> 0..4（愈大愈大機會落雨）
const PSR_LEVELS = ["低", "中低", "中", "中高", "高"]
const PSR_EN = { Low: "低", "Medium Low": "中低", Medium: "中", "Medium High": "中高", High: "高" }
export function psrLevel(psr) {
  const text = PSR_EN[psr] ?? String(psr ?? "").trim()
  const i = PSR_LEVELS.indexOf(text)
  return i === -1 ? null : { text, level: i }
}

// fnd 一日 -> { date, week, icon, weather, wind, min, max, psr }
function cleanDay(day) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(day?.forecastDate ?? ""))
  if (!m) return null
  const num = (v) => (Number.isFinite(Number(v?.value)) ? Number(v.value) : null)
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    week: String(day.week ?? ""),
    icon: Number(day.ForecastIcon) || null,
    weather: String(day.forecastWeather ?? ""),
    wind: String(day.forecastWind ?? ""),
    min: num(day.forecastMintemp),
    max: num(day.forecastMaxtemp),
    psr: psrLevel(day.PSR)?.text ?? "",
  }
}

// 九天預報合併入舊記錄：同一日用新嘅；舊記錄只留 today 或之後（天文台中午更新後就唔再有今日，
// 所以朝早讀過嘅「今日」要留住）。回 { days: { date: day }, updateTime }
export function mergeFnd(saved, body, today) {
  const days = {}
  for (const [date, day] of Object.entries(saved?.days ?? {})) if (date >= today) days[date] = day
  for (const raw of Array.isArray(body?.weatherForecast) ? body.weatherForecast : []) {
    const day = cleanDay(raw)
    if (day) days[day.date] = day
  }
  return { days, updateTime: String(body?.updateTime ?? saved?.updateTime ?? "") }
}

// flw -> { situation, period, desc, outlook, tc, fire, updateTime }，冇預報內容就 null
export function cleanFlw(body) {
  const s = (v) => String(v ?? "").trim()
  if (!s(body?.forecastDesc)) return null
  return {
    situation: s(body.generalSituation),
    period: s(body.forecastPeriod),
    desc: s(body.forecastDesc),
    outlook: s(body.outlook),
    tc: s(body.tcInfo),
    fire: s(body.fireDangerWarning),
    updateTime: s(body.updateTime),
  }
}

// 「23–27°」
export const tempRange = (day) =>
  day && day.min != null && day.max != null ? `${day.min}–${day.max}°` : day?.max != null ? `${day.max}°` : ""
