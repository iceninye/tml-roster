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

/* ------------------------------------------------------------------ 警告（Ice 2026-11-08） */
// 天文台開放數據（HKO Open Data API）：
//   weather.php?dataType=warnsum      天氣警告一覽（{ WTCSGNL: { name, code, actionCode, issueTime, ... }, ... }）
//   weather.php?dataType=warningInfo  詳細天氣警告資訊（{ details: [{ warningStatementCode, contents: [...] }] }）
//   weather.php?dataType=swt          特別天氣提示（{ swt: [{ desc, updateTime }] }）
//   earthquake.php?dataType=qem       地震速報（{ lat, lon, mag, region, ptime, updateTime }）
//   earthquake.php?dataType=feltearthquake  本地有感地震報告（[{ mag, region, intensity, ptime, details: [...] }]）
//   opendata.php?dataType=RYES&date=YYYYMMDD  天氣及輻射水平資料（各站 xxxMicrosieverts）
// 全部都係「有先出」：冇警告就乜都唔顯示。

const HKO_BASE = "https://data.weather.gov.hk/weatherAPI/opendata/"
export const HKO_TYPES = ["flw", "fnd", "warnsum", "warningInfo", "swt", "qem", "feltearthquake", "ryes"]
// date：RYES 用（YYYY-MM-DD，天文台每日出前一日嘅報告）
export function hkoUrl(type, date = "") {
  if (["flw", "fnd", "warnsum", "warningInfo", "swt"].includes(type)) return `${HKO_BASE}weather.php?dataType=${type}&lang=tc`
  if (type === "qem" || type === "feltearthquake") return `${HKO_BASE}earthquake.php?dataType=${type}&lang=tc`
  if (type === "ryes") return `${HKO_BASE}opendata.php?dataType=RYES&date=${String(date).replace(/-/g, "")}&lang=tc`
  return null
}

// 警告代號 -> 顯示：短名、圖示（tc = 熱帶氣旋信號形狀；其他係色塊加一隻字）、排序（細 = 重要）
const WARN = {
  TC1: { name: "一號戒備信號", tc: "1", order: 10 },
  TC3: { name: "三號強風信號", tc: "3", order: 9 },
  TC8NE: { name: "八號東北烈風或暴風信號", tc: "8", dir: "東北", order: 8 },
  TC8SE: { name: "八號東南烈風或暴風信號", tc: "8", dir: "東南", order: 8 },
  TC8NW: { name: "八號西北烈風或暴風信號", tc: "8", dir: "西北", order: 8 },
  TC8SW: { name: "八號西南烈風或暴風信號", tc: "8", dir: "西南", order: 8 },
  TC9: { name: "九號烈風或暴風風力增強信號", tc: "9", order: 7 },
  TC10: { name: "十號颶風信號", tc: "10", order: 6 },
  WRAINA: { name: "黃色暴雨警告", ch: "雨", bg: "#f2b705", fg: "#111", order: 14 },
  WRAINR: { name: "紅色暴雨警告", ch: "雨", bg: "#d7261e", order: 13 },
  WRAINB: { name: "黑色暴雨警告", ch: "雨", bg: "#111", order: 12 },
  WTMW: { name: "海嘯警告", ch: "嘯", bg: "#123f8c", order: 11 },
  WFNTSA: { name: "新界北部水浸特別報告", ch: "浸", bg: "#1f6fb2", order: 15 },
  WL: { name: "山泥傾瀉警告", ch: "泥", bg: "#8d5b2c", order: 16 },
  WTS: { name: "雷暴警告", ch: "⚡", bg: "#f2b705", fg: "#111", order: 17 },
  WMSGNL: { name: "強烈季候風信號", ch: "季", bg: "#3b4a63", order: 18 },
  WHOT: { name: "酷熱天氣警告", ch: "熱", bg: "#e4572e", order: 19 },
  WCOLD: { name: "寒冷天氣警告", ch: "冷", bg: "#2f7ed8", order: 19 },
  WFROST: { name: "霜凍警告", ch: "霜", bg: "#5aa9d6", order: 20 },
  WFIREY: { name: "黃色火災危險警告", ch: "火", bg: "#f2b705", fg: "#111", order: 21 },
  WFIRER: { name: "紅色火災危險警告", ch: "火", bg: "#d7261e", order: 21 },
}
// 熱帶氣旋信號形狀（白底黑色）：1 = T、3 = 倒 T、9 = 沙漏、10 = 十字；8 寫數字同方向
const TC_SHAPE = {
  1: '<path d="M6 7h16v3.5h-6.2V22h-3.6V10.5H6z"/>',
  3: '<path d="M6 21h16v-3.5h-6.2V6h-3.6v11.5H6z"/>',
  9: '<path d="M7 5h14l-7 9zM7 23h14l-7-9z"/>',
  10: '<path d="M12 5h4v7h7v4h-7v7h-4v-7H5v-4h7z"/>',
}
const svgEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

// 警告圖示（inline SVG，離線都畫到）。唔識嘅代號回 ""。
export function warnIconSvg(code) {
  const w = WARN[code]
  if (!w) return ""
  const open = `<svg class="wx-icon" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">`
  if (w.tc) {
    const tile = '<rect x="0.5" y="0.5" width="27" height="27" rx="5" fill="#fff" stroke="#111"/>'
    const body = TC_SHAPE[w.tc]
      ? `<g fill="#111">${TC_SHAPE[w.tc]}</g>`
      : `<text x="14" y="15" text-anchor="middle" font-size="15" font-weight="800" fill="#111">${svgEsc(w.tc)}</text>` +
        `<text x="14" y="25" text-anchor="middle" font-size="8" font-weight="700" fill="#111">${svgEsc(w.dir ?? "")}</text>`
    return `${open}${tile}${body}</svg>`
  }
  const stroke = w.bg === "#111" ? ' stroke="#fff" stroke-width="1.5"' : ""
  return `${open}<rect x="1" y="1" width="26" height="26" rx="5" fill="${w.bg}"${stroke}/>` +
    `<text x="14" y="19.5" text-anchor="middle" font-size="15" font-weight="800" fill="${w.fg ?? "#fff"}">${svgEsc(w.ch)}</text></svg>`
}

const str = (v) => String(v ?? "").trim()

// 天氣警告一覽 -> [{ key, code, name, issueTime }]，重要嘅排先；已取消嘅唔要
export function cleanWarnsum(body) {
  const out = []
  if (!body || typeof body !== "object") return out
  for (const [key, raw] of Object.entries(body)) {
    if (!raw || typeof raw !== "object") continue
    if (/^cancel/i.test(str(raw.actionCode))) continue
    // 火災危險：code 有時只係 WFIRE，type 寫「紅色」「黃色」
    let code = str(raw.code) || key
    if (code === "WFIRE") code = /紅|red/i.test(str(raw.type)) ? "WFIRER" : "WFIREY"
    const known = WARN[code]
    out.push({ key, code, name: known?.name ?? (str(raw.name) || code), issueTime: str(raw.issueTime || raw.updateTime), order: known?.order ?? 50 })
  }
  return out.sort((a, b) => a.order - b.order).map(({ order, ...w }) => w)
}

// 詳細天氣警告資訊 -> { WTCSGNL: ["段落", ...], ... }
export function cleanWarningInfo(body) {
  const out = {}
  for (const d of Array.isArray(body?.details) ? body.details : []) {
    const key = str(d?.warningStatementCode)
    const lines = (Array.isArray(d?.contents) ? d.contents : [d?.contents]).map(str).filter(Boolean)
    if (key && lines.length) out[key] = [...(out[key] ?? []), ...lines]
  }
  return out
}

// 特別天氣提示 -> ["...", ...]
export const cleanSwt = (body) => (Array.isArray(body?.swt) ? body.swt : []).map((t) => str(t?.desc)).filter(Boolean)

const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v))
// 地震速報 -> { mag, region, time } 或 null
export function cleanQuake(body) {
  const q = Array.isArray(body) ? body[0] : body
  if (!q || num(q.mag) == null) return null
  return { mag: num(q.mag), region: str(q.region), time: str(q.ptime || q.updateTime), intensity: str(q.intensity), details: Array.isArray(q.details) ? q.details.map(str).filter(Boolean) : [] }
}

// 天氣及輻射水平資料 -> { stations: [{ name, value }], max } 或 null（讀唔到輻射數字）
export function cleanRyes(body) {
  if (!body || typeof body !== "object") return null
  const stations = []
  for (const [key, value] of Object.entries(body)) {
    const m = /^(.*)Microsieverts$/.exec(key)
    if (!m || num(value) == null) continue
    stations.push({ name: str(body[`${m[1]}LocationName`]) || m[1], value: num(value) })
  }
  if (!stations.length) return null
  return { stations, max: Math.max(...stations.map((s) => s.value)), date: str(body.RYESDate || body.BulletinDate) }
}

// 輻射超過正常範圍（天文台：一般 0.06–0.3 微希沃特／小時）
export const RADIATION_HIGH = 0.3
export const SHORT_TEXT = 40

// 今日卡要顯示嘅警告同提示：[{ key, kind, code?, title, text, more: [...] }]
// text = 直接顯示嘅短句（可以冇），more = 撳一下先顯示嘅長文（可以冇）。
// warn = { warnsum, info, swt, qem, felt, ryes, tc, fire }（已 clean），now = ms
export function wxAlerts(warn, now = Date.now()) {
  const items = []
  if (!warn) return items
  const info = warn.info ?? {}
  const used = new Set()
  const list = warn.warnsum ?? []
  for (const w of list) {
    const statement = w.code.startsWith("TC") ? "WTCSGNL" : w.key
    let more = info[statement] ?? info[w.key] ?? []
    if (more.length) used.add(statement)
    if (statement === "WTCSGNL" && !more.length && warn.tc) more = [warn.tc]
    items.push({ key: `w-${w.code}`, kind: "warn", code: w.code, title: w.name, text: "", more })
  }
  // 警告一覽讀唔到，但 flw 有熱帶氣旋／火災危險：照舊顯示
  if (!list.some((w) => w.code.startsWith("TC")) && warn.tc) items.push(textItem("tc", "熱帶氣旋消息", [warn.tc]))
  if (!list.some((w) => w.code.startsWith("WFIRE")) && warn.fire) items.push({ key: "fire", kind: "info", title: "火災危險", text: warn.fire, more: [] })
  // 一覽冇但詳細資訊有嘅（例如未入一覽嘅特別報告）
  for (const [key, lines] of Object.entries(info)) {
    if (used.has(key) || list.some((w) => w.key === key) || (key === "WTCSGNL" && list.some((w) => w.code.startsWith("TC")))) continue
    items.push(textItem(`i-${key}`, WARN[key]?.name ?? "天氣警告", lines))
  }
  ;(warn.swt ?? []).forEach((t, i) => items.push(textItem(`swt-${i}`, "特別天氣提示", [t])))

  const age = (t) => now - Date.parse(t)
  const q = warn.qem
  if (q && age(q.time) < 24 * 3600e3) {
    items.push({ key: "qem", kind: "quake", title: "地震速報", text: `${q.mag.toFixed(1)} 級 · ${q.region}`, time: q.time, more: [] })
  }
  const f = warn.felt
  if (f && age(f.time) < 3 * 24 * 3600e3) {
    const text = [f.intensity ? `本港最高烈度 ${f.intensity}` : "", `${f.mag.toFixed(1)} 級`, f.region].filter(Boolean).join(" · ")
    items.push({ key: "felt", kind: "quake", title: "本地有感地震", text, time: f.time, more: f.details })
  }
  const r = warn.ryes
  if (r) {
    const lines = r.stations.map((s) => `${s.name} ${s.value} 微希沃特／小時`)
    if (r.max > RADIATION_HIGH) items.push({ key: "ryes", kind: "warn-info", title: "輻射水平偏高", text: `最高 ${r.max} 微希沃特／小時`, more: lines })
    else items.push({ key: "ryes", kind: "info", title: "天氣及輻射水平", text: "", note: `正常 · 最高 ${r.max}`, more: lines })
  }
  return items
}

// 短（≤ SHORT_TEXT 字、一段）就直接顯示；長就收埋，撳一下先出
function textItem(key, title, lines) {
  const one = lines.length === 1 && lines[0].length <= SHORT_TEXT
  return { key, kind: "info", title, text: one ? lines[0] : "", more: one ? [] : lines }
}

// 天文台天氣圖示（https://www.hko.gov.hk/textonly/v2/explain/wxicon_c.htm 嗰套圖）；離線用 wxIcon 嘅 emoji
export const wxIconUrl = (code) => (Number(code) ? `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${Number(code)}.png` : "")
