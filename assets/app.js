// TML Roster: your own duty roster over the Tuen Ma Line Duty Sheet cards.
// Hand-written, no build step. The roster is kept in this browser's
// localStorage; the optional cross-device sync uploads it to Workers KV only
// when the user pastes a token and presses 上傳. Duty cards come from data/duties/, copied
// from https://github.com/iceninye/TML-traffic (see tools/sync-duties.mjs).

import { dutyState, mealMates } from "../lib/tml-duties.js"
import { addDays, classify, cleanRoster, dayEntry, mondayOf, newRoster, normaliseCode, parseRoster, rowLabelFor, setOverride, weekDates, weekdayIndex } from "../lib/tml-roster.js"
import { shiftOf } from "../lib/tml-shift.js"
import { nearRows, summariseWeek, weekLabel } from "../lib/tml-week.js"
import { serviceDate, serviceSeconds } from "../lib/tml-time.js"

const BUILD = { version: "0.9.8", commit: "dev" }
const ROSTER_KEY = "tml-roster"
// 頁首標題（用戶自己改名，只存喺呢部機）
const TITLE_KEY = "tml-roster-title"
// The key TML-traffic v0.9.0 used; a roster saved there is picked up once.
const LEGACY_KEY = "tml-traffic-roster"
// 跨裝置同步：token 同雲端版本號都只存喺呢部機
const KV_KEY = "tml-roster-kv-token"
const KV_VERSION = "tml-roster-kv-version"

const S = {
  weekdays: ["週一", "週二", "週三", "週四", "週五", "週六", "週日"],
  status: { RD: "休息日", AL: "年假", SH: "法定假日", HC: "待定" },
  spare: (code) => `後備更 ${code}`,
  spareNote: "後備更未有上下班資料",
  noCard: "呢個更份暫時冇上下班資料",
  spareTag: "後備更",
  basicNote: "呢個更份冇逐段行程資料，只有上下班時間同地點。",
  shift: { dawn: "死早", early: "早", mid: "中", late: "夜", night: "死夜" },
  nextDay: "翌日",
  hours: (h) => `${h} 小時`,
  noSheet: (id) => `搵唔到更份 ${id} 所屬嘅 Duty Sheet 資料`,
  noDuty: (id) => `Duty Sheet 入面冇更份 ${id} 嘅資料`,
  loading: "讀取更份資料中…",
  failed: "讀取更份資料失敗，請稍後再試",
  on: "上班",
  off: "下班",
  meal: "用膳",
  mates: "飯腳",
  matesNone: "冇（同一車站食飯重疊未夠 45 分鐘）",
  matesHelp: "飯腳：同你喺同一個車站、食飯時間重疊至少 45 分鐘嘅更份。撳更份編號可以睇佢嘅行程。",
  matesMore: (n) => `其餘 ${n} 個飯腳`,
  work: "工時",
  workMin: (m) => `${Math.floor(m / 60)} 小時${m % 60 ? ` ${m % 60} 分` : ""}`,
  legs: "全日行程",
  bookOn: "上班",
  bookOff: "下班",
  now: "現時",
  until: (clock) => `至 ${clock}`,
  kind: { drive: "載客", empty: "空車", park: "泊車", prep: "準備", ride: "乘搭", wait: "待命", other: "其他" },
  phase: {
    drive: (run, a, b) => `Run ${run} 行駛中 ${a} → ${b}`,
    empty: (run, a, b) => `Run ${run} 空車 ${a} → ${b}`,
    park: (run, a, b) => `Run ${run} 泊車 ${a} → ${b}`,
    ride: (run, a, b) => `乘搭接駁 ${a} → ${b}`,
    prep: (run, a) => `出車準備 ${a}`,
    wait: (run, a) => `待命／等候 ${a}`,
    other: (run, a) => `其他 ${a}`,
    meal: (run, a) => `用膳中 ${a}`,
    end: (run, a) => `收車 ${a}`,
    gap: (run, a) => `等待接班 ${a}`,
  },
  cls: { weekday: "平日", saturday: "星期六", sunday: "星期日", special: "特別日" },
  source: (code, tab, issued, dates, cls, full) =>
    `資料來源：Duty Sheet ${code}（${cls}${dates ? `，只用於 ${dates}` : ""}）${tab ? `、工作表 ${tab}` : ""}${issued ? `、${issued} 發佈` : ""}。${full ? "只收更份編號、上下班、用膳同每段 Run 嘅時間，唔收備註原文。接班時間準確到秒，離班時間係到站時間（只計到分鐘）。" : "呢份資料只有更份編號。"}`,
  title: "我的更表",
  prev: "‹ 上週",
  next: "下週 ›",
  thisWeek: "本週",
  today: "今日",
  changed: "已手動改",
  settings: "設定／備份",
  back: "‹ 返回",
  backThis: "回到本週",

  stdRow: (n) => `Standard Roster 第 ${n} 行`,
  titleLabel: "更表名稱",
  weekHint: "撳任何一日睇全日行程；特別日子（例如 8022、8023）可以喺該日入面手動改。",
  sumDays: (n) => `開工 ${n} 日`,
  sumWork: "工時",
  rosterNear: "只睇附近",
  rosterAll: (n) => `全部 ${n} 行`,
  swipeHint: "左右滑動可換週",
  hintTitle: "提示",
  restShort: "休息唔夠 12 小時",
  restHelp: "休息唔夠鐘：前一日下班到下一個開工唔夠 12 小時，會用閃動紅框標住（同編更頁一致）。",
  syncTitle: "跨裝置同步",
  syncFirstTitle: "有雲端備份？貼 token 下載",
  syncFirstHelp: "換咗機或者清咗瀏覽器？貼同一條 token，撳「由雲端下載」就攞返更表。token 係你第一次上傳時自己嗰條，只存喺你自己部機。",
  syncHelp: "雲端會存：更表（標題、行號、每格代號）、Standard Roster 每行嘅名字、基準週，同你手動改過嘅日子。唔會存更份卡或者編更計劃。token 只存喺呢部機。⚠️ 拿到呢條網址嘅人都讀寫得到，唔好傳出去。",
  syncToken: "同步 token",
  syncUnsupported: "呢個網址唔支援雲端同步（GitHub Pages 版冇 Workers API）。要同步請開 https://tml-roster.iceninye.workers.dev/ice/",
  syncNew: "產生 token",
  syncCopy: "複製",
  syncNewAsk: "產生新 token 會換走呢部機現有嗰條（雲端舊記錄唔會刪除）。確定？",
  syncNewDone: "已產生新 token 並記住。請撳「複製」存好佢；另一部機貼同一條，就可以下載同一份更表。",
  syncCopied: "已複製 token。",
  syncCopyFail: "複製唔到，請手動選取輸入框內容。",
  syncUpload: "上傳到雲端",
  syncDownload: "由雲端下載",
  syncNoToken: "先貼上同步 token 再撳。",
  syncConflict: (at, name) => `雲端有另一個版本（${at}${name ? ` · ${name}` : ""}）。撳「確定」用呢部機覆蓋雲端；撳「取消」就唔覆蓋。`,
  syncOverwriteLocal: (at, name) => `雲端版本（${at}${name ? ` · ${name}` : ""}）會取代呢部機嘅更表同手動改動。撳「確定」照下載；撳「取消」就唔變。`,
  syncKeptLocal: "冇覆蓋：雲端版本保持不變。",
  syncKeptDown: "冇下載：呢部機嘅更表保持不變。",
  syncEmpty: "雲端未有資料，請先上傳一次。",
  syncFail: "同步失敗（網絡或者 token 有問題）。",
  syncUp: (v, at) => `已上傳到雲端（第 ${v} 版 · ${at}）。`,
  syncDown: (at) => `已由雲端下載（${at}）。`,
  editCode: "改呢日嘅更份編號",
  save: "儲存",
  cancel: "取消",
  reset: "還原",
  badCode: "格式唔啱：請輸入 7 位更份編號，或者 RD、AL、SH、HC、HSP1、KSP3 呢類代號",
  setupTitle: "設定我的更表",
  settingsTitle: "更表設定",
  setupIntro: "第一次使用，請完成下面兩步。更表預設只會儲存喺呢部機嘅瀏覽器；想跨裝置就喺下面貼同步 token。",
  step1: "貼上 Standard Roster",
  step2: "行號",
  howTitle: "應該貼成點樣？",
  howBody: "每行代表一個星期，由週一至週日共 7 格。行頭可以有行號（冇都得）。用逗號、Tab 或空格分隔都得，直接由 Excel 複製貼上就可以。",
  howCodes: [
    ["1101179", "7 位更份編號（頭 4 位係 Duty Sheet 編號）"],
    ["RD · AL · SH · HC", "休息日 · 年假 · 法定假日 · 待定"],
    ["HSP1 · KSP3", "後備更（冇上下班時間）"],
  ],
  howExample: "1,1101101,1101102,RD,1101104,1101105,6091101,RD\n2,AL,AL,AL,SH,SH,RD,RD",
  fileBtn: "由檔案匯入",
  fileHelp: "支援 .csv、.tsv、.txt。直接貼上都得。",
  fileFail: "讀取檔案失敗",
  previewTitle: "即時預覽",
  previewOk: (n, a, b) => `讀到 ${n} 行（行號 ${a}–${b}）`,
  previewKeep: (n) => `而家用緊嘅 roster：${n} 行`,
  previewHint: "貼上之後，呢度會即時顯示讀到嘅 roster。",
  previewRowMiss: (row, a, b) => `你填嘅第 ${row} 行喺呢份 roster 入面冇（有 ${a}–${b}），請修改第 2 步。`,
  rosterTitle: (n) => `我嘅 roster（${n} 行）`,
  rosterHelp: "紅色係今個星期，紅框係今日。",
  rowHead: "行",
  pasteLabel: "Standard Roster 內容",
  pastePlaceholder: "喺度貼上，每行一個星期",
  pasteKeep: "留空就保留現有更表；貼上新內容會取代舊嘅，但你手動改過嘅日子會保留",
  rowLabel: (monday) => `今個星期（${monday} 起）係第幾行？`,
  ok: "確認",
  rowBad: (nums) => `喺你嘅 roster 入面搵唔到呢個行號（有 ${nums}）`,
  saved: "已儲存",
  notStored: "已讀入，但呢部機儲存唔到，關閉頁面後會冇咗",
  backupTitle: "備份同清除",
  backupHelp: "換手機或者清除瀏覽器資料之前，先匯出備份。要還原就將備份內容貼返入上面「Standard Roster 內容」再儲存。",
  export: "匯出 CSV（一週一行）",
  exportJson: "匯出備份（JSON，包手動改動）",
  exportHelp: "下載之後可以貼返入上面「Standard Roster 內容」還原。",
  exported: "已匯出檔案",
  clear: "清除我的更表",
  clearAsk: "清除之後要重新貼上 roster，確定？",
  noRoster: "未有 roster，請先貼上",
  badBackup: "備份內容讀唔到，請確認複製完整",
  dutyData: (issued) => `更份資料 ${issued} 發佈`,
}

// Depot and siding codes as the sheets print them (read from the sheets' own
// duty list pages, not from MTR documents).
const DEPOT_NAMES = { TAD: "大圍廠", HHS: "紅磡廠", TT: "大圍廠", W1A: "八鄉廠", W1C: "八鄉廠", W1F: "八鄉廠", LT1: "紅磡廠", LT2: "紅磡廠", E3A: "錦上路", E3C: "錦上路" }

const view = document.getElementById("view")
const state = {
  page: "week", // week | detail | duty | setup
  monday: null,
  date: null,
  duty: null, // { sheet, id } of a duty opened from 飯腳
  from: "week",
  message: "",
  rosterAll: false,
  editing: false,
  syncMsg: "",
}

let roster = null
let title = ""
let stations = {}
let basic = null // data/duty-basic.json: book-on/off of every duty, incl. spare duties
let dutyIndex = null
let dutySheets = null
const dutyBooks = new Map()
let shown = ""

/* ------------------------------------------------------------- storage */

function readPref(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writePref(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode or blocked storage: the roster just is not remembered.
  }
}

function loadRoster() {
  for (const key of [ROSTER_KEY, LEGACY_KEY]) {
    try {
      const raw = readPref(key)
      const found = raw ? cleanRoster(JSON.parse(raw)) : null
      if (found) return found
    } catch {
      // A damaged entry is ignored; the setup page starts fresh.
    }
  }
  return null
}

// Keep the roster; false when the browser would not store it.
function saveRoster(next) {
  roster = next
  const json = JSON.stringify(next)
  writePref(ROSTER_KEY, json)
  return readPref(ROSTER_KEY) === json
}

function clearRoster() {
  roster = null
  for (const key of [ROSTER_KEY, LEGACY_KEY]) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Storage blocked: nothing was stored to remove.
    }
  }
}

/* ---------------------------------------------------------------- data */

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response.json()
}

function loadBasic() {
  fetchJson("data/duty-basic.json")
    .then((data) => {
      basic = data.duties
      paintData()
    })
    .catch(() => {
      basic = {}
    })
}

function dutyIndexPromise() {
  dutyIndex ??= fetchJson("data/duties/index.json")
    .then((index) => {
      dutySheets = index.sheets
      return index
    })
    .catch(() => {
      dutySheets = []
      return null
    })
  return dutyIndex
}

function dutyBook(code) {
  let entry = dutyBooks.get(code)
  if (!entry) {
    entry = { status: "loading", data: null, entry: null }
    dutyBooks.set(code, entry)
    dutyIndexPromise()
      .then((index) => {
        entry.entry = index?.sheets.find((item) => item.code === code) ?? null
        if (!entry.entry) throw new Error("no such sheet")
        return fetchJson(`data/duties/${entry.entry.file}`)
      })
      .then((data) => {
        entry.data = data
        entry.status = "ok"
      })
      .catch(() => {
        entry.status = "error"
      })
      .finally(paintData)
  }
  return entry
}

/* ------------------------------------------------------------- helpers */

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
}

function secClock(sec) {
  const t = ((Math.round(sec) % 86400) + 86400) % 86400
  const two = (n) => String(n).padStart(2, "0")
  return `${two(Math.floor(t / 3600))}:${two(Math.floor((t % 3600) / 60))}:${two(t % 60)}`
}

const hhmm = (sec) => secClock(sec).slice(0, 5)

// A clock time for display: past 24:00 it is the next calendar day, marked 翌日.
const clockHtml = (sec) => `${hhmm(sec)}${sec >= 86400 ? `<small class="nd">${S.nextDay}</small>` : ""}`

// 死早 / 早 / 中 / 夜 / 死夜：定義喺 lib/tml-shift.js（同編更頁一致）。
// 一個 cell 嘅下班秒數，未載入到資料時係 null。
function offOf(cell) {
  return cell?.duty?.off?.[0] ?? cell?.basic?.off ?? null
}

// 休息唔夠鐘：前一日下班到下一個開工唔夠 12 小時就標；同編更頁預設（plan.rest）一致，唔好兩頁一紅一唔紅。
const REST_MIN = 12 * 3600

function restTooShort(prevCell, cell) {
  const off = offOf(prevCell)
  const on = cell?.on
  if (off == null || on == null) return false
  return 86400 + on - off < REST_MIN
}

// 邊幾日嘅開工時間同前一日嘅休息唔夠鐘（會同上週日比較）。
function shortRestDates(dates) {
  const out = new Set()
  // 由前一日（上週日）開始比較，唔會漏咗「上週日夜更 → 週一早更」。
  let prev = cellInfo(dayEntry(roster, addDays(dates[0], -1)).code)
  for (const date of dates) {
    const cur = cellInfo(dayEntry(roster, date).code)
    if (restTooShort(prev, cur)) out.add(date)
    prev = cur
  }
  return out
}

// A duty known only by its book-on/off row: [on, place, off, place, hours, DE/DL].
function basicOf(code) {
  const row = basic?.[String(code).toUpperCase()]
  return row ? { on: row[0], onAt: row[1], off: row[2], offAt: row[3], hours: row[4], flag: row[5] } : null
}

// "KSR2" is platform 2 of 錦上路; a code that is no station keeps its letters.
function placeName(code) {
  if (!code) return "—"
  if (DEPOT_NAMES[code]) return `${DEPOT_NAMES[code]} ${code}`
  const base = code.replace(/\d$/, "")
  const name = stations[base]?.tc
  return !name ? code : `${name}${base === code ? "" : ` ${code.slice(base.length)}`}`
}

// 同一個地點就唔寫兩次（避免「錦上路 → 錦上路」）
function routeText(from, to) {
  const a = placeName(from)
  const b = placeName(to)
  return a === b ? a : `${a} → ${b}`
}

function meDate(date) {
  const [, m, d] = date.split("-").map(Number)
  return `${m}/${d}`
}

function mealPlace(meal) {
  const [, , from, to] = meal
  return to && to !== from ? `${placeName(from)} → ${placeName(to)}` : placeName(from)
}

function dutyPhaseText(st) {
  const a = placeName(st.from ?? st.place)
  if (st.phase === "wait" && st.leg == null) return S.phase.gap(null, a)
  const make = S.phase[st.phase] ?? S.phase.other
  return make(st.run, a, placeName(st.to))
}

// A cell as the week list and the day page show it:
// { label, status: none | ok | loading | nosheet | noduty | nocard, duty, c, note }.
function cellInfo(code) {
  const c = classify(code)
  if (c.kind === "status") return { label: `${S.status[c.code]} ${c.code}`, status: "none", tone: c.code === "HC" ? "tbd" : (c.code === "AL" || c.code === "SH" ? "leave" : "rest") }
  const known = c.kind === "duty" ? null : basicOf(c.code)
  if (known) return { label: c.code, tag: c.kind === "spare" ? S.spareTag : "", status: "basic", basic: known, on: known.on, tone: "duty" }
  if (c.kind === "spare") return { label: S.spare(c.code), status: "none", note: S.spareNote, tone: "spare" }
  if (c.kind === "other") return { label: c.code, status: "none", tone: "spare" }
  const book = dutyBook(c.sheet)
  if (book.status === "loading") return { label: c.id, status: "loading", c }
  const duty = book.status === "ok" ? book.data.duties.find((item) => item.id === c.id) : null
  if (!duty) {
    const fallback = basicOf(c.id)
    if (fallback) return { label: c.id, tag: "", status: "basic", basic: fallback, on: fallback.on, tone: "duty", c }
    return { label: c.id, status: book.status === "ok" ? "noduty" : "nosheet", c }
  }
  return { label: c.id, group: duty.group, status: duty.on ? "ok" : "nocard", duty, c, tone: "duty", on: duty.on?.[0] }
}

// 卡上工時：官表有 basic 時數就用佢，否則用更份卡嘅 work（分鐘）。
function cardHours(cell) {
  if (cell.basic?.hours != null) return S.hours(cell.basic.hours)
  if (cell.duty?.work != null) return S.hours(Math.round((cell.duty.work / 60) * 100) / 100)
  return ""
}

// 路線行尾加工時（例如「錦上路 · 用膳 19:16 · 7 小時」），唔再另佔一行。
function noteWithHours(note, cell) {
  const hours = cardHours(cell)
  if (!hours || (note || "").includes("小時")) return note || ""
  return note ? `${note} · ${hours}` : hours
}

// 休息日／待定：代號（粗）＋細字狀態，唔再排成一句「休息日 RD」。
function offTitleHtml(code, cell) {
  const what = S.status?.[code] ?? cell.label
  return `<b class="code">${escapeHtml(code)}</b><span class="day-sub">${escapeHtml(what)}</span>`
}

const isOffTone = (cell) => cell.tone === "rest" || cell.tone === "tbd" || cell.tone === "leave"

// The week list's lines for one day: times and a quiet note.
function dayLines(cell) {
  const d = cell.duty
  if (cell.status === "ok") {
    return {
      span: [d.on[0], d.off[0]],
      times: `${clockHtml(d.on[0])} – ${clockHtml(d.off[0])}`,
      note: routeText(d.on[1], d.off[1]) + (d.meal ? ` · ${S.meal} ${hhmm(d.meal[0])}` : ""),
    }
  }
  if (cell.status === "basic") {
    const b = cell.basic
    return { span: [b.on, b.off], times: `${clockHtml(b.on)} – ${clockHtml(b.off)}`, note: [b.onAt && b.offAt ? routeText(b.onAt, b.offAt) : "", S.hours(b.hours)].filter(Boolean).join(" · ") }
  }
  return { times: "", note: summary(cell) }
}

function summary(cell) {
  if (cell.status === "loading") return S.loading
  if (cell.status === "nosheet" || cell.status === "noduty") return S.noSheet(cell.c.id)
  if (cell.status === "nocard") return S.noCard
  if (cell.status !== "ok") return cell.note ?? ""
  const d = cell.duty
  return `${S.on} ${hhmm(d.on[0])} ${placeName(d.on[1])} → ${S.off} ${hhmm(d.off[0])} ${placeName(d.off[1])}` +
    (d.meal ? ` · ${S.meal} ${hhmm(d.meal[0])}` : "")
}

/* ---------------------------------------------------------- duty card */

// 飯腳: duties eating at the same station with 45 min or more of overlap.
function mealMatesHtml(duty, duties, sheet) {
  const mates = mealMates(duty, duties)
  if (!mates.length) return `<span class="meta">${S.matesNone}</span>`
  const item = ({ duty: other, from, to }) =>
    `<button type="button" class="duty-mate" data-duty="${other.id}" data-sheet="${sheet}"><b>${other.id}</b>` +
    `<small>${hhmm(from)}–${hhmm(to)} · ${Math.round((to - from) / 60)} 分</small></button>`
  // 只列前 3 個，其餘收埋，免得日詳情被飯腳塞爆
  const rest = mates.slice(3)
  return `<span class="mates">${mates.slice(0, 3).map(item).join("")}</span>` +
    (rest.length ? `<details class="mates-more"><summary>${S.matesMore(rest.length)}</summary><span class="mates">${rest.map(item).join("")}</span></details>` : "")
}

// A duty without leg-by-leg data (spare duties, sheets not copied here).
function basicDetailHtml(cell) {
  const b = cell.basic
  const place = (at) => (at ? escapeHtml(at) : "")
  return `<div class="duty-sub">${cell.tag ? `<span class="badge plain">${cell.tag}</span> ` : ""}<span class="badge plain">${S.shift[shiftOf(b.on, b.off)]}</span></div>` +
    `<div class="hero"><div><small>${S.on}</small><b>${hhmm(b.on)}</b><span>${place(b.onAt)}</span></div>` +
    `<i aria-hidden="true">→</i><div><small>${S.off}</small><b>${clockHtml(b.off)}</b><span>${place(b.offAt)}</span></div></div>` +
    `<dl class="kv"><dt>${S.work}</dt><dd>${S.hours(b.hours)}</dd>` + (b.flag ? `<dt>DE/DL</dt><dd>${escapeHtml(b.flag)}</dd>` : "") + `</dl>` +
    `<p class="fine">${S.basicNote}</p>`
}

// The full card of one duty. liveOn marks what it is doing now, for today only.
function dutyDetailHtml({ sheet, id }, liveOn) {
  const book = dutyBook(sheet)
  if (book.status === "loading") return `<p class="empty">${S.loading}</p>`
  const duty = book.status === "ok" ? book.data.duties.find((item) => item.id === id) : null
  if (!duty) return `<p class="empty">${book.status === "ok" ? S.noDuty(id) : S.failed}</p>`
  const entry = book.entry
  const source = S.source(sheet, duty.tab, entry.issued, entry.dates?.join("、"), S.cls[entry.class] ?? entry.class, Boolean(duty.on))
  if (!duty.on) return `<p class="empty">${S.noCard}</p><dl class="kv"><dt>更份</dt><dd>${id} · ${duty.group}</dd></dl><p class="fine">${source}</p>`
  const live = liveOn ? dutyState(duty, serviceSeconds(Date.now())) : null
  const nowBox = live
    ? `<div class="duty-nowbox"><span class="badge now">${S.now}</span> ${escapeHtml(dutyPhaseText(live))} <span class="meta">${S.until(hhmm(live.until))}</span></div>`
    : ""
  const rows = [{ kind: "book", at: duty.on[0], html: `<span class="duty-t">${hhmm(duty.on[0])}</span><span>${S.bookOn}</span><span>${placeName(duty.on[1])}</span>` }]
  duty.legs.forEach((leg, i) => {
    const [kind, run, from, at, to, until] = leg
    rows.push({
      kind, at, now: live?.leg === i && live.phase === kind,
      html: `<span class="duty-t">${secClock(at)}</span><span>${S.kind[kind] ?? kind}${run == null ? "" : ` Run ${run}`}</span>` +
        `<span>${placeName(from)}${to ? ` → ${placeName(to)}${until != null ? ` ${hhmm(until)}` : ""}` : ""}</span>`,
    })
  })
  if (duty.meal) {
    rows.push({ kind: "meal", at: duty.meal[0], now: live?.phase === "meal", html: `<span class="duty-t">${hhmm(duty.meal[0])}</span><span>${S.meal}</span><span>${mealPlace(duty.meal)} ${hhmm(duty.meal[0])}–${hhmm(duty.meal[1])}</span>` })
  }
  rows.sort((a, b) => a.at - b.at)
  rows.push({ kind: "book", at: duty.off[0], html: `<span class="duty-t">${hhmm(duty.off[0])}</span><span>${S.bookOff}</span><span>${placeName(duty.off[1])}</span>` })
  return `<div class="duty-sub"><span class="badge plain">${duty.group}</span> Duty Sheet ${sheet}</div>` +
    `<div class="hero"><div><small>${S.on}</small><b>${hhmm(duty.on[0])}</b><span>${placeName(duty.on[1])}</span></div>` +
    `<i aria-hidden="true">→</i><div><small>${S.off}</small><b>${clockHtml(duty.off[0])}</b><span>${placeName(duty.off[1])}</span></div></div>` +
    `<dl class="kv">` +
    (duty.work != null ? `<dt>${S.work}</dt><dd>${S.workMin(duty.work)}</dd>` : "") +
    (duty.meal ? `<dt>${S.meal}</dt><dd>${hhmm(duty.meal[0])}–${hhmm(duty.meal[1])} ${mealPlace(duty.meal)}</dd>` +
      `<dt>${S.mates}</dt><dd>${mealMatesHtml(duty, book.data.duties, sheet)}</dd>` : "") +
    `</dl>${duty.meal ? `<p class="fine">${S.matesHelp}</p>` : ""}${nowBox}<div class="stops-head">${S.legs}</div><ol class="duty-legs">` +
    rows.map((row) => `<li data-now="${row.now ? 1 : 0}" data-kind="${row.kind}">${row.html}</li>`).join("") + `</ol><p class="fine">${source}</p>`
}

/* ------------------------------------------------------------ day views */

// A thin 24 h strip (04:00 to 04:00) with the shift marked on it.
function barHtml(span, nowAt = null) {
  if (!span) return ""
  const pct = (sec) => Math.min(100, Math.max(0, ((sec - 14400) / 86400) * 100))
  const left = pct(span[0])
  const mark = nowAt == null ? "" : `<b class="bar-now" style="left:${pct(nowAt).toFixed(1)}%"><s></s></b>`
  return `<span class="bar" aria-hidden="true"><i style="left:${left.toFixed(1)}%;width:${Math.max(2, pct(span[1]) - left).toFixed(1)}%"></i>${mark}</span>`
}

// Today, big, with what the duty is doing right now.
function todayHtml(date, entry, cell, short = false) {
  const lines = dayLines(cell)
  const shift = shiftOf(cell.on, offOf(cell))
  const live = cell.status === "ok" ? dutyState(cell.duty, serviceSeconds(Date.now())) : null
  const tags = (cell.group ? `<span class="badge plain">${cell.group}</span>` : "") + (cell.tag ? `<span class="badge plain">${cell.tag}</span>` : "") +
    (shift ? `<span class="badge shift">${S.shift[shift]}</span>` : "") +
    (entry.source === "override" ? `<span class="badge plain">${S.changed}</span>` : "")
  return `<button type="button" class="today me-day" data-date="${date}" data-tone="${cell.tone ?? "duty"}" data-shift="${shift}"${short ? ' data-short="1"' : ""}>` +
    `<span class="today-label">${S.today} · ${S.weekdays[weekdayIndex(date)]} ${meDate(date)}</span>` +
    `<span class="today-title">${isOffTone(cell) ? offTitleHtml(entry.code, cell) : escapeHtml(cell.label)}${tags}${short ? `<span class="badge rest-short">${S.restShort}</span>` : ""}</span>` +
    (lines.times ? `<span class="today-times">${lines.times}</span>${barHtml(lines.span, serviceSeconds(Date.now()))}` : "") +
    (lines.note ? `<span class="today-note">${escapeHtml(lines.note)}</span>` : "") +
    (live ? `<span class="today-live"><i class="pulse"></i><span>${S.now}：${escapeHtml(dutyPhaseText(live))} <small>${S.until(hhmm(live.until))}</small></span></span>` : "") +
    `</button>`
}

// 一週概況：計法喺 lib/tml-week.js，呢度只係餵現時嘅 roster 同已載入嘅更份資料。
function weekSummary(dates) {
  return summariseWeek(dates, (date) => dayEntry(roster, date), (code) => {
    const cell = cellInfo(code)
    const known = cell.basic ?? basicOf(code)
    return known ? { ...cell, basic: known } : cell
  })
}

// 一句話講本週：行號 + 開工日數 + 工時（頁首副標用）
function subLine(monday) {
  const row = rowLabelFor(roster, monday)
  const s = weekSummary(weekDates(monday))
  if (row == null) return S.title
  return `${S.stdRow(row)}${s.days ? ` · ${S.sumDays(s.days)} · ${S.sumWork} ${S.workMin(s.minutes)}` : ""}`
}

/* ------------------------------------------------------- roster table */

// Every row of a roster as a table. cur = label of the row to mark (this
// week), today = a date whose cell gets a frame. Pass a parsed { rows, numbers }.
function rosterTableHtml({ rows, numbers }, cur = null, todayIndex = -1, only = null) {
  const head = `<tr><th>${S.rowHead}</th>${S.weekdays.map((d) => `<th>${d.replace("週", "")}</th>`).join("")}</tr>`
  const picks = only ?? rows.map((_, i) => i)
  const body = picks.map((i) => {
    const row = rows[i]
    const now = numbers[i] === cur
    return `<tr${now ? ' class="cur"' : ""}><th>${numbers[i]}</th>` +
      row.map((code, d) => {
        const kind = classify(code).kind
        return `<td data-kind="${kind}"${now && d === todayIndex ? ' class="todaycell"' : ""}>${escapeHtml(code)}</td>`
      }).join("") + "</tr>"
  }).join("")
  return `<div class="rtable"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`
}

// The setup page's live preview of what is typed, or of the saved roster.
function previewHtml(text, row) {
  const t = text.trim()
  if (!t) {
    return roster
      ? `<p class="fine">${S.previewKeep(roster.rows.length)}</p>${rosterTableHtml(roster, rowLabelFor(roster, mondayOf(serviceDate(Date.now()))))}`
      : `<p class="fine">${S.previewHint}</p>`
  }
  if (t.startsWith("{")) {
    let backup = null
    try {
      backup = cleanRoster(JSON.parse(t))
    } catch {
      backup = null
    }
    return backup
      ? `<p class="fine ok">${S.previewKeep(backup.rows.length)}</p>${rosterTableHtml(backup, backup.anchor.row)}`
      : `<p class="fine bad">${S.badBackup}</p>`
  }
  const parsed = parseRoster(t)
  const a = parsed.numbers[0]
  const b = parsed.numbers[parsed.numbers.length - 1]
  let out = parsed.issues.length ? `<ul class="issues">${parsed.issues.slice(0, 6).map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : ""
  if (parsed.rows.length) {
    out += `<p class="fine ${parsed.issues.length ? "" : "ok"}">${S.previewOk(parsed.rows.length, a, b)}</p>`
    if (row && !parsed.numbers.includes(row)) out += `<p class="fine bad">${S.previewRowMiss(row, a, b)}</p>`
    out += rosterTableHtml(parsed, row || null)
  }
  return out
}

function refreshPreview(form) {
  const box = document.getElementById("setup-preview")
  if (box) box.innerHTML = previewHtml(form.elements.text.value, Number(form.elements.row.value) || null)
}

/* --------------------------------------------------------------- pages */

function open() {
  roster = loadRoster()
  state.page = roster ? "week" : "setup"
  state.monday = mondayOf(serviceDate(Date.now()))
  state.date = null
  render()
}

// 頁首副標：一頁一句實用資訊（唔係死板標語）
function setSub(text) {
  const el = document.getElementById("sub")
  if (el && el.textContent !== text) el.textContent = text
}

function render() {
  shown = ""
  if (state.page === "setup") {
    view.innerHTML = setupHtml()
    setSub(roster ? S.settingsTitle : S.setupTitle)
    return
  }
  if (state.page === "duty") {
    view.innerHTML = `<div class="duty-head"><button type="button" class="btn me-back">${S.back}</button><h2>${escapeHtml(state.duty.id)}</h2></div><div id="me-data"></div>`
    setSub(S.title)
    paintData()
    return
  }
  if (state.page === "detail") {
    const entry = dayEntry(roster, state.date)
    const changed = entry.source === "override"
    const head = state.editing
      ? `<form class="me-code-form" autocomplete="off"><input name="code" value="${escapeHtml(entry.code)}" maxlength="10" ` +
        `autocapitalize="characters" spellcheck="false" aria-label="${S.editCode}">` +
        `<button type="submit" class="btn icon" title="${S.save}" aria-label="${S.save}">✓</button>` +
        `<button type="button" class="btn icon me-code-cancel" title="${S.cancel}" aria-label="${S.cancel}">✕</button></form>`
      : `<h2 class="me-code">${escapeHtml(entry.code)}</h2>` +
        `<button type="button" class="btn icon me-code-edit" title="${S.editCode}" aria-label="${S.editCode}">✏️</button>` +
        (changed ? `<button type="button" class="btn icon me-reset" title="${S.reset}" aria-label="${S.reset}">↺</button>` : "")
    view.innerHTML =
      `<div class="duty-head"><button type="button" class="btn me-back">${S.back}</button>${head}</div>` +
      `<p class="me-msg" role="status">${escapeHtml(state.message)}</p>` +
      `<div id="me-data"></div>`
    setSub(`${S.weekdays[weekdayIndex(state.date)]} ${meDate(state.date)} · ${S.stdRow(entry.row)}`)
    paintData()
    if (state.editing) {
      const input = view.querySelector(".me-code-form input")
      input?.focus()
      input?.select()
    }
    return
  }
  const dates = weekDates(state.monday)
  const current = mondayOf(serviceDate(Date.now()))
  const curRow = rowLabelFor(roster, state.monday)
  const near = state.rosterAll ? null : nearRows(roster, curRow)
  view.innerHTML =
    `<div class="me-nav"><button type="button" class="btn me-prev" aria-label="${S.prev}">‹</button>` +
    `<div class="weeklabel"><b>${weekLabel(dates)}</b>` +
    `<span>${state.monday === current ? S.thisWeek : `<button type="button" class="link me-this">${S.backThis}</button>`}</span></div>` +
    `<button type="button" class="btn me-next" aria-label="${S.next}">›</button></div>` +
    `<div id="me-data"></div>` +
    `<details class="fine-box hints"><summary>${S.hintTitle}</summary><p class="fine">${S.weekHint} · ${S.swipeHint} · ${S.restHelp}</p></details>` +
    `<details class="panel roster-box"><summary>${S.rosterTitle(roster.rows.length)}</summary>` +
    `<div class="roster-tools"><p class="fine">${S.rosterHelp}</p>` +
    `<button type="button" class="link me-roster-toggle">${state.rosterAll ? S.rosterNear : S.rosterAll(roster.rows.length)}</button></div>` +
    rosterTableHtml(roster, curRow, dates.indexOf(serviceDate(Date.now())), near) + `</details>`
  setSub(subLine(state.monday))
  paintData()
  // Show this week's row inside the table without moving the page.
  const table = view.querySelector(".rtable")
  const cur = table?.querySelector("tr.cur")
  if (cur) table.scrollTop = Math.max(0, cur.offsetTop - table.clientHeight / 2)
}

// The part that depends on loaded duty data or the clock: repainted when a
// sheet finishes loading and once a second, never touching the form fields.
function paintData() {
  const box = document.getElementById("me-data")
  if (!box) return
  let html
  if (state.page === "duty") {
    html = dutyDetailHtml(state.duty, false)
  } else if (state.page === "detail") {
    const entry = dayEntry(roster, state.date)
    const cell = cellInfo(entry.code)
    if (cell.status === "none") html = `<p class="empty">${escapeHtml(cell.label)}${cell.note ? ` · ${cell.note}` : ""}</p>`
    else if (cell.status === "basic") html = basicDetailHtml(cell)
    else if (cell.status === "loading") html = `<p class="empty">${S.loading}</p>`
    else if (cell.status === "nosheet") html = `<p class="empty">${S.noSheet(cell.c.id)}</p>`
    else html = dutyDetailHtml({ sheet: cell.c.sheet, id: cell.c.id }, state.date === serviceDate(Date.now()))
  } else if (state.page === "week") {
    const today = serviceDate(Date.now())
    const week = weekDates(state.monday)
    const short = shortRestDates(week)
    const heroHtml = week.includes(today) ? todayHtml(today, dayEntry(roster, today), cellInfo(dayEntry(roster, today).code), short.has(today)) : ""
    // 今日已經有 hero，列表唔再重複
    const listDays = week.includes(today) ? week.filter((date) => date !== today) : week
    const listHtml = `<ul class="day-list">${listDays.map((date) => {
      const entry = dayEntry(roster, date)
      const cell = cellInfo(entry.code)
      const lines = dayLines(cell)
      const badges = (date === today ? `<span class="badge now">${S.today}</span>` : "") +
        (entry.source === "override" ? `<span class="badge plain">${S.changed}</span>` : "")
      const shift = shiftOf(cell.on, offOf(cell))
      const tags = (cell.group ? `<span class="badge plain">${cell.group}</span>` : "") + (cell.tag ? `<span class="badge plain">${cell.tag}</span>` : "") +
        (shift ? `<span class="badge shift">${S.shift[shift]}</span>` : "")
      return `<li><button type="button" class="day me-day" data-date="${date}" data-tone="${cell.tone ?? "duty"}" data-shift="${shift}" data-today="${date === today ? 1 : 0}"${short.has(date) ? ' data-short="1"' : ""}>` +
        `<span class="day-date"><small>${S.weekdays[weekdayIndex(date)]}</small><b>${Number(date.slice(8))}</b></span>` +
        `<span class="day-main"><span class="day-title">${isOffTone(cell) ? offTitleHtml(entry.code, cell) : escapeHtml(cell.label)}${tags}${badges}${short.has(date) ? `<span class="badge rest-short">${S.restShort}</span>` : ""}</span>` +
        (lines.times ? `<span class="day-times">${lines.times}</span>${barHtml(lines.span)}` : "") +
        (noteWithHours(lines.note, cell) ? `<span class="meta">${escapeHtml(noteWithHours(lines.note, cell))}</span>` : "") +
        `</span></button></li>`
    }).join("")}</ul>`
    html = `<div class="me-cols"><div class="me-col-a">${heroHtml}</div>` +
      `<div class="me-col-b">${listHtml}</div></div>`
    // 更份資料載入後工時先算得出：每次重畫順手更新副標
    setSub(subLine(state.monday))
  } else {
    return
  }
  if (html === shown) return
  shown = html
  box.innerHTML = html
}

function setupHtml() {
  const monday = mondayOf(serviceDate(Date.now()))
  const row = roster ? rowLabelFor(roster, monday) : ""
  const codes = S.howCodes.map(([code, what]) => `<li><code>${code}</code><span>${what}</span></li>`).join("")
  return `<div class="duty-head">${roster ? `<button type="button" class="btn me-back">${S.back}</button>` : `<h2>${S.setupTitle}</h2>`}</div>` +
    (roster ? "" : `<p class="lead">${S.setupIntro}</p>`) +
    `<form class="me-setup" autocomplete="off">` +
    `<section class="panel"><h3><span class="step">1</span>${S.step1}</h3>` +
    `<details class="how"><summary>${S.howTitle}</summary><p class="fine">${S.howBody}</p><ul class="how-codes">${codes}</ul>` +
    `<pre>${escapeHtml(S.howExample).replace(/\n/g, "<br>")}</pre></details>` +
    `<label><span class="sr">${S.pasteLabel}</span><textarea name="text" rows="6" spellcheck="false" placeholder="${roster ? S.pasteKeep : S.pastePlaceholder}"></textarea></label>` +
    `<div class="me-edit-row"><label class="btn filebtn">${S.fileBtn}<input type="file" class="me-file" accept=".csv,.tsv,.txt,text/plain,text/csv" hidden></label><span class="meta">${S.fileHelp}</span></div>` +
    `<h4 class="prev-title">${S.previewTitle}</h4><div id="setup-preview">${previewHtml("", row)}</div></section>` +
    `<section class="panel"><h3><span class="step">2</span>${S.step2}</h3>` +
    `<div class="field-line"><label for="me-row">${S.rowLabel(monday)}</label>` +
    `<input id="me-row" name="row" class="mini" type="number" inputmode="numeric" min="1" value="${row}" required>` +
    `<button type="submit" class="btn primary">${S.ok}</button></div></section>` +
    `<p class="me-msg" role="status">${escapeHtml(state.message)}</p></form>` +
    (roster
      ? `<section class="panel"><h3>${S.titleLabel}</h3>` +
        `<form class="me-title" autocomplete="off">` +
        `<div class="field-line"><label for="me-title-input"><span class="sr">${S.titleLabel}</span></label>` +
        `<input id="me-title-input" name="title" class="mini wide" maxlength="24" value="${escapeHtml(title)}" placeholder="${S.title}">` +
        `<button type="submit" class="btn primary">${S.ok}</button></div></form></section>`
      : "") +
    (roster
      ? `<section class="panel"><h3>${S.backupTitle}</h3><details class="fine-box"><summary>${S.hintTitle}</summary><p class="fine">${S.backupHelp}</p></details>` +
        `<div class="me-foot"><button type="button" class="btn me-export">${S.export}</button> ` +
        `<button type="button" class="btn danger me-clear">${S.clear}</button></div>` +
        `<p class="fine"><button type="button" class="linkish me-export-json">${S.exportJson}</button> · ${S.exportHelp}</p></section>`
      : "") +
    (syncSupported === false
      ? `<section class="panel"><h3>${S.syncTitle}</h3><p class="fine">${S.syncUnsupported}</p></section>`
      : `<section class="panel"><h3>${roster ? S.syncTitle : S.syncFirstTitle}</h3><details class="fine-box"><summary>${S.hintTitle}</summary><p class="fine">${roster ? S.syncHelp : S.syncFirstHelp}</p></details>` +
        `<div class="field-line"><label for="me-kv-token">${S.syncToken}</label>` +
        `<input id="me-kv-token" class="mini wide mono" type="password" autocomplete="off" spellcheck="false" maxlength="64" value="${escapeHtml(kvToken())}" placeholder="a1b2c3d4...">` +
        `<button type="button" class="btn me-kv-new">${S.syncNew}</button>` +
        `<button type="button" class="btn me-kv-copy">${S.syncCopy}</button></div>` +
        `<div class="row me-foot">` +
        (roster ? `<button type="button" class="btn me-kv-up">${S.syncUpload}</button>` : "") +
        `<button type="button" class="btn ${roster ? "" : "primary "}me-kv-down">${S.syncDownload}</button></div>` +
        `<p class="me-msg" role="status">${escapeHtml(state.syncMsg)}</p></section>`)
}

// 匯出：CSV 每行一個星期（行號、名、週一至週日），可以原封不動貼返入「Standard Roster 內容」
function csvText() {
  const cell = (value) => {
    const text = String(value ?? "")
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return roster.rows
    .map((row, i) => [roster.numbers[i], roster.names[i] ?? "", ...row].map(cell).join(","))
    .join("\r\n")
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 上傳／下載之前，採用輸入框裡面嘅 token（唔使另外撳「記住」，用一次就會記住）。
function adoptToken() {
  const value = String(document.getElementById("me-kv-token")?.value ?? "").trim().toLowerCase()
  if (/^[a-z0-9]{20,64}$/.test(value) && value !== kvToken()) {
    writePref(KV_KEY, value)
    writePref(KV_VERSION, "0") // 換咗 token：手上版本號唔再適用
  }
  return kvToken()
}

// 跨裝置同步：一條 token 一條雲端記錄，存喺 Workers KV。token 只留喺呢部機。
// 雲端回來嘅日期係唔係 YYYY-MM-DD（唔信外部資料）
function isDateStr(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function kvToken() {
  return String(readPref(KV_KEY) ?? "").trim()
}

function kvEndpoint() {
  return `/api/roster/${encodeURIComponent(kvToken())}`
}

// 呢個網址有冇 Workers API（GitHub Pages 版冇）：開頁時問一次。
let syncSupported = null // null = 未問到；true / false
async function probeSync() {
  try {
    const res = await fetch("/api/ping", { headers: { accept: "application/json" }, cache: "no-store" })
    const body = await res.json().catch(() => null)
    syncSupported = !!(res.ok && body?.ok)
  } catch {
    // 離線或者網絡出錯：唔知支唔支援，照舊顯示同步面板（唔好誤報「唔支援」）
    return
  }
  render()
}

function kvMessage(text) {
  state.syncMsg = text
  render()
}

// 32 個 [a-z0-9] 字元，用 crypto.getRandomValues；捨棄 >= 252 嘅值，令每個字元機會均等。
function newToken() {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789"
  let out = ""
  while (out.length < 32) {
    for (const byte of crypto.getRandomValues(new Uint8Array(48))) {
      if (byte < 252 && out.length < 32) out += abc[byte % 36]
    }
  }
  return out
}

function kvNewToken() {
  if (kvToken() && !confirm(S.syncNewAsk)) return
  writePref(KV_KEY, newToken())
  writePref(KV_VERSION, "0") // 新記錄由第 0 版開始
  kvMessage(S.syncNewDone)
}

async function kvCopyToken() {
  const token = adoptToken()
  if (!token) return kvMessage(S.syncNoToken)
  try {
    await navigator.clipboard.writeText(token)
    kvMessage(S.syncCopied)
  } catch {
    kvMessage(S.syncCopyFail)
  }
}

async function kvUpload(force = false) {
  if (!kvToken()) return kvMessage(S.syncNoToken)
  let res
  try {
    res = await fetch(kvEndpoint(), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schema: 1,
        title,
        rows: roster.rows,
        numbers: roster.numbers,
        names: roster.names,
        anchor: roster.anchor, // 基準週（week number）要同步，唔係第二部機會自己揀「今週」
        overrides: roster.overrides,
        version: Number(readPref(KV_VERSION) ?? 0),
        force,
      }),
    })
  } catch {
    return kvMessage(S.syncFail)
  }
  const body = await res.json().catch(() => null)
  if (res.status === 409 && body?.reason === "conflict" && !force) {
    const when = String(body.cloud?.updatedAt ?? "").replace("T", " ").slice(0, 16)
    if (confirm(S.syncConflict(when, body.cloud?.title ?? ""))) return kvUpload(true)
    return kvMessage(S.syncKeptLocal)
  }
  if (!res.ok || !body?.ok) return kvMessage(S.syncFail)
  writePref(KV_VERSION, String(body.version))
  kvMessage(S.syncUp(body.version, String(body.updatedAt ?? "").replace("T", " ").slice(0, 16)))
}

async function kvDownload() {
  if (!kvToken()) return kvMessage(S.syncNoToken)
  let res
  try {
    res = await fetch(kvEndpoint(), { headers: { accept: "application/json" } })
  } catch {
    return kvMessage(S.syncFail)
  }
  const body = await res.json().catch(() => null)
  if (res.status === 404 && body?.reason === "empty") return kvMessage(S.syncEmpty)
  if (!res.ok || !body?.ok) return kvMessage(S.syncFail)
  const rec = body.record ?? {}
  const rows = Array.isArray(rec.rows) ? rec.rows : []
  const numbers = Array.isArray(rec.numbers) ? rec.numbers.map(Number) : rows.map((_, i) => i + 1)
  // 雲端有嘅（名、基準週、手動改動）一律用雲端；舊記錄冇就跟呢部機。
  const names = Array.isArray(rec.names) && rec.names.length === rows.length
    ? rec.names.map((n) => String(n ?? ""))
    : (roster?.names?.length === rows.length ? roster.names : [])
  const anchorRow = numbers.includes(Number(rec.anchor?.row))
    ? Number(rec.anchor.row)
    : (numbers.includes(Number(roster?.anchor?.row)) ? Number(roster.anchor.row) : numbers[0])
  const anchorMonday = isDateStr(rec.anchor?.monday) ? rec.anchor.monday : (roster?.anchor?.monday ?? mondayOf(serviceDate(Date.now())))
  // 雲端有呢個欄位就以雲端為準（刻意清空都要跟）；舊記錄冇欄位才沿用本機
  const overrides = rec.overrides && typeof rec.overrides === "object"
    ? rec.overrides
    : (roster?.overrides ?? {})
  const next = cleanRoster({
    v: 1,
    rows,
    numbers,
    names,
    anchor: { row: anchorRow ?? 1, monday: anchorMonday },
    overrides,
  })
  if (!next) return kvMessage(S.syncFail)
  const when = String(rec.updatedAt ?? "").replace("T", " ").slice(0, 16)
  const fresh = !roster // 第一次用：冇本地更表，冇嘢會被蓋，唔使問
  if (!fresh && !confirm(S.syncOverwriteLocal(when, rec.title ?? ""))) return kvMessage(S.syncKeptDown)
  if (!saveRoster(next)) return kvMessage(S.notStored)
  if (rec.title) {
    title = String(rec.title).slice(0, 24)
    writePref(TITLE_KEY, title)
  }
  writePref(KV_VERSION, String(rec.version ?? 0))
  if (fresh) {
    state.page = "week"
    state.monday = mondayOf(serviceDate(Date.now()))
  }
  kvMessage(S.syncDown(when))
}

// 更表名稱：存喺呢部機，即時反映喺頁首
function submitTitle(form) {
  title = String(form.elements.title.value ?? "").trim().slice(0, 24)
  writePref(TITLE_KEY, title)
  applyTitle()
  state.message = S.saved
  render()
}

function submitSetup(form) {
  const text = form.elements.text.value.trim()
  const row = Number(form.elements.row.value)
  const monday = mondayOf(serviceDate(Date.now()))
  const range = (r) => `${r.numbers[0]}–${r.numbers[r.numbers.length - 1]}`
  let next = null
  if (text.startsWith("{")) {
    try {
      next = cleanRoster(JSON.parse(text))
    } catch {
      next = null
    }
    if (!next) state.message = S.badBackup
  } else if (text) {
    const parsed = parseRoster(text)
    if (parsed.issues.length || !parsed.rows.length) {
      state.message = parsed.issues.slice(0, 4).join("；") || S.noRoster
    } else if (!parsed.numbers.includes(row)) {
      state.message = S.rowBad(range(parsed))
    } else {
      next = newRoster(parsed, { row, monday })
      next.overrides = roster?.overrides ?? {}
    }
  } else if (roster) {
    if (!roster.numbers.includes(row)) state.message = S.rowBad(range(roster))
    else next = { ...roster, anchor: { row, monday } }
  } else {
    state.message = S.noRoster
  }
  if (next) {
    state.message = saveRoster(next) ? S.saved : S.notStored
    state.monday = monday
    state.page = "week"
  }
  render()
}

// 日詳情嘅更份編號：喺原位改，Enter 或 ✓ 儲存
function submitCode(form) {
  const code = normaliseCode(form.elements.code.value.trim())
  state.editing = false
  if (!code) {
    state.message = S.badCode
    return render()
  }
  state.message = saveRoster(setOverride(roster, state.date, code)) ? S.saved : S.notStored
  render()
}

function onClick(event) {
  const target = event.target
  const mate = target.closest(".duty-mate")
  if (mate) {
    state.from = state.page
    state.page = "duty"
    state.duty = { sheet: mate.dataset.sheet, id: mate.dataset.duty }
  } else if (target.closest(".me-day")) {
    state.page = "detail"
    state.date = target.closest(".me-day").dataset.date
    state.message = ""
    state.editing = false
  } else if (target.closest(".me-code-edit")) {
    state.editing = true
    state.message = ""
  } else if (target.closest(".me-code-cancel")) {
    state.editing = false
    state.message = ""
  } else if (target.closest(".me-back")) {
    state.page = state.page === "duty" ? state.from : roster ? "week" : "setup"
    state.message = ""
    state.editing = false
  } else if (target.closest(".me-prev")) state.monday = addDays(state.monday, -7)
  else if (target.closest(".me-next")) state.monday = addDays(state.monday, 7)
  else if (target.closest(".me-this")) state.monday = mondayOf(serviceDate(Date.now()))
  else if (target.closest(".me-roster-toggle")) state.rosterAll = !state.rosterAll
  else if (target.closest(".me-settings")) {
    state.page = "setup"
    state.message = ""
    state.syncMsg = ""
  } else if (target.closest(".me-reset")) {
    state.editing = false
    state.message = saveRoster(setOverride(roster, state.date, null)) ? S.saved : S.notStored
  } else if (target.closest(".me-kv-new")) {
    kvNewToken()
    return
  } else if (target.closest(".me-kv-copy")) {
    kvCopyToken()
    return
  } else if (target.closest(".me-kv-up")) {
    adoptToken()
    kvUpload()
    return
  } else if (target.closest(".me-kv-down")) {
    adoptToken()
    kvDownload()
    return
  } else if (target.closest(".me-export")) {
    // 加 BOM，Excel 開中文唔會亂碼
    download(`tml-roster-${serviceDate(Date.now())}.csv`, "\uFEFF" + csvText(), "text/csv;charset=utf-8")
    state.message = S.exported
    render()
    return
  } else if (target.closest(".me-export-json")) {
    download(`tml-roster-${serviceDate(Date.now())}.json`, JSON.stringify(roster, null, 1), "application/json")
    state.message = S.exported
    render()
    return
  } else if (target.closest(".me-clear")) {
    if (!window.confirm(S.clearAsk)) return
    clearRoster()
    state.page = "setup"
    state.message = ""
  } else return
  render()
  window.scrollTo(0, 0)
}

function wireKeys() {
  const step = (delta) => {
    if (state.page !== "week" || !roster) return
    state.monday = addDays(state.monday, delta * 7)
    render()
  }
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    // Esc 喺輸入框內都要生效，所以要排喺 INPUT guard 之前
    if (event.key === "Escape" && state.editing) {
      event.preventDefault()
      state.editing = false
      state.message = ""
      render()
      return
    }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return
    if (event.key === "ArrowLeft") step(-1)
    else if (event.key === "ArrowRight") step(1)
  })
  // 手機：喺更表範圍左右滑動換週
  let fromX = null
  let fromY = null
  view.addEventListener("touchstart", (event) => {
    const touch = event.touches[0]
    fromX = touch.clientX
    fromY = touch.clientY
  }, { passive: true })
  view.addEventListener("touchend", (event) => {
    if (fromX == null || state.page !== "week") return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - fromX
    const dy = touch.clientY - fromY
    fromX = null
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.8) return
    if (event.target.closest(".rtable")) return
    state.monday = addDays(state.monday, dx < 0 ? 7 : -7)
    render()
  }, { passive: true })
}

// 頁首 H1 用用戶自己改嘅名（預設「我的更表」）
function applyTitle() {
  const h1 = document.querySelector(".top h1")
  if (h1) h1.textContent = title || S.title
}

// 撳頁首標題 → 去設定頁改名
function wireTitle() {
  const h1 = document.querySelector(".top h1")
  if (!h1) return
  h1.classList.add("me-title-edit")
  h1.title = S.titleLabel
  h1.addEventListener("click", () => {
    if (!roster) return
    state.page = "setup"
    state.message = ""
    render()
    const input = view.querySelector(".me-title input")
    input?.focus()
    input?.select()
  })
}

// 設定／備份放頁首齒輪，唔使碌到頁尾
function wireSettings() {
  const top = document.querySelector(".top")
  if (!top || top.querySelector(".me-settings")) return
  const button = document.createElement("button")
  button.type = "button"
  button.className = "btn icon me-settings"
  button.title = S.settings
  button.setAttribute("aria-label", S.settings)
  button.textContent = "⚙"
  button.addEventListener("click", () => {
    // 撳一下入設定，再撳一下返主頁
    state.page = state.page === "setup" && roster ? "week" : "setup"
    state.editing = false
    state.message = ""
    state.syncMsg = ""
    render()
    window.scrollTo(0, 0)
  })
  top.appendChild(button)
}

async function boot() {
  try {
    stations = await fetchJson("data/stations.json")
  } catch {
    stations = {}
  }
  title = String(readPref(TITLE_KEY) ?? "").trim().slice(0, 24)
  applyTitle()
  wireTitle()
  view.addEventListener("click", onClick)
  wireKeys()
  wireSettings()
  view.addEventListener("input", (event) => {
    const form = event.target.closest?.(".me-setup")
    if (form) refreshPreview(form)
  })
  view.addEventListener("change", (event) => {
    if (!event.target.matches(".me-file")) return
    const file = event.target.files?.[0]
    const form = event.target.closest(".me-setup")
    if (!file || !form) return
    file.text().then((text) => {
      form.elements.text.value = text
      refreshPreview(form)
    }).catch(() => {
      state.message = S.fileFail
      render()
    })
  })
  view.addEventListener("submit", (event) => {
    event.preventDefault()
    if (event.target.matches(".me-setup")) submitSetup(event.target)
    else if (event.target.matches(".me-code-form")) submitCode(event.target)
    else if (event.target.matches(".me-title")) submitTitle(event.target)
  })
  document.getElementById("foot").innerHTML =
    `v${BUILD.version} · ${BUILD.commit === "dev" ? "dev" : `commit ${escapeHtml(BUILD.commit)}`} · ` +
    `更份資料來自 <a href="https://github.com/iceninye/TML-traffic">TML-traffic</a>`
  loadBasic()
  probeSync()
  open()
  dutyIndexPromise().then((index) => {
    if (index) document.getElementById("foot").insertAdjacentHTML("beforeend", ` · ${S.dutyData(index.sheets.map((s) => s.issued).sort().pop())}`)
  })
  // 每 15 秒重畫一次就夠（時間軸以分鐘為單位）；唔好每秒做全套計算。
  setInterval(paintData, 15000)
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {})
}

boot()
