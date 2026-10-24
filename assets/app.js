// TML Roster: your own duty roster over the Tuen Ma Line Duty Sheet cards.
// Hand-written, no build step. The roster is kept in this browser's
// localStorage; the optional cross-device sync uploads it to Workers KV only
// when the user pastes a token and presses 上傳. Duty cards, book-on/off times and
// station names are read from https://github.com/iceninye/TML-traffic (lib/tml-data.js).

import { dutyState, mealMates, reliefOf } from "../lib/tml-duties.js"
import { addDays, classify, cleanRoster, dayEntry, mondayOf, newRoster, normaliseCode, parseRoster, recentOverrides, rowLabelFor, setOverride, weekDates, weekdayIndex } from "../lib/tml-roster.js"
import { SHIFTS, shiftOf } from "../lib/tml-shift.js"
import { nearRows, summariseWeek, weekLabel } from "../lib/tml-week.js"
import { OFF_CODES, workOf } from "../lib/tml-extra.js"
import { serviceDate, serviceSeconds } from "../lib/tml-time.js"
import { fetchData, placeNames, sheetForDate, stationNames } from "../lib/tml-data.js"
import { monthDates, otClock, otFromClock, recentOt, setOt } from "../lib/tml-ot.js"
import { TOKEN_RE, fingerprint, guessDevice, hkStamp, logToken, mailWhy, newToken, postJson } from "../lib/tml-cloud.js"

const BUILD = { version: "0.9.29", commit: "dev" }
const thisDevice = () => guessDevice(globalThis.navigator?.userAgent ?? "")
const ROSTER_KEY = "tml-roster"
// 頁首標題（用戶自己改名，只存喺呢部機）
const TITLE_KEY = "tml-roster-title"
// The key TML-traffic v0.9.0 used; a roster saved there is picked up once.
const LEGACY_KEY = "tml-traffic-roster"
// 跨裝置同步：token 同雲端版本號都只存喺呢部機
const KV_KEY = "tml-roster-kv-token"
const KV_VERSION = "tml-roster-kv-version"
// 最後一次上傳／下載時嘅更表指紋：同而家唔同就喺齒輪旁加一粒「未上傳」點
const KV_SYNCED = "tml-roster-kv-synced"

const S = {
  weekdays: ["週一", "週二", "週三", "週四", "週五", "週六", "週日"],
  status: { RD: "休息日", AL: "年假", SH: "法定假日", HC: "待定" },
  spare: (code) => `後備更 ${code}`,
  spareNote: "後備更未有上下班資料",
  noCard: "呢個更份暫時冇上下班資料",
  spareTag: "後備更",
  extraOff: (hours) => `假期${hours ? ` · ${hours} 小時` : ""}`,
  extraWork: (hours) => `開工日 · ${hours} 小時（冇上下班時間）`,
  basicNote: "呢個更份冇逐段行程資料，只有上下班時間同地點。",
  shift: { dawn: "死早", early: "早", mid: "中", late: "夜", night: "死夜" },
  nextDay: "翌日",
  hours: (h) => `${h} 小時`,
  sheetHint: (sheet, id) => `當日用 Duty Sheet ${sheet}，你嘅更可能係 ${id}，請檢查。`,
  noSheet: (id) => `搵唔到更份 ${id} 所屬嘅 Duty Sheet 資料`,
  notOnSheet: (id, sheet) => `呢日用 Duty Sheet ${sheet}，入面冇 ${id}；請改做當日嘅更份編號`,
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
  // 今日卡：倒數、下一程、交車、下一更
  dur: (sec) => {
    const m = Math.max(0, Math.ceil(sec / 60))
    if (m < 60) return `${m} 分`
    return `${Math.floor(m / 60)} 小時${m % 60 ? ` ${m % 60} 分` : ""}`
  },
  factOn: "返工",
  factOff: "放工",
  factNext: "下一程",
  factHand: "落車",
  factMeal: "用膳",
  factNextDuty: "下一更",
  inTime: (d) => `仲有 ${d}`,
  offDone: "已放工",
  pickUp: (run, place) => `${place} 接 Run ${run}`,
  takeFrom: (id) => `由 ${id} 交`,
  prepAt: (run, place) => `${place} 出車準備 Run ${run}`,
  handTo: (id) => `交俾 ${id}`,
  handNone: "收車／泊車",
  restGap: (d) => `休息 ${d}`,
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
  logSent: "token log 已寄去電郵。",
  logFail: (why) => `token log 電郵寄唔到（${why}）。`,
  syncBackupFail: (why) => `雲端現有版本寄唔到電郵備份（${why}），覆蓋咗就冇得用電郵還原。撳「確定」照樣上傳；撳「取消」就唔上傳。`,
  syncBackedUp: "雲端舊版本已先寄去電郵備份。",
  localMailed: "呢部機原本嘅版本已寄去電郵備份。",
  localSaved: (why) => `呢部機原本嘅版本寄唔到電郵（${why}），已下載咗做備份。`,
  syncNewAsk: "產生新 token 會換走呢部機現有嗰條（雲端舊記錄唔會刪除）。確定？",
  syncNewDone: "已產生新 token 並記住。請撳「複製」存好佢；另一部機貼同一條，就可以下載同一份更表。",
  syncCopied: "已複製 token。",
  syncCopyFail: "複製唔到，請手動選取輸入框內容。",
  syncUpload: "上傳到雲端",
  syncDownload: "由雲端下載",
  syncNoToken: "先貼上同步 token 再撳。",
  syncBadToken: "token 格式唔啱（20 至 64 個細楷英文字母或數字），冇上傳亦冇下載。",
  syncConflict: (at, name, device) => `雲端有另一個版本（${at}${name ? ` · ${name}` : ""}${device ? ` · 由「${device}」上傳` : ""}）。撳「確定」用呢部機覆蓋雲端；撳「取消」就唔覆蓋。`,
  syncOverwriteLocal: (at, name) => `雲端版本（${at}${name ? ` · ${name}` : ""}）會取代呢部機嘅更表同手動改動。撳「確定」照下載；撳「取消」就唔變。`,
  syncKeptLocal: "冇覆蓋：雲端版本保持不變。",
  syncKeptDown: "冇下載：呢部機嘅更表保持不變。",
  syncDirty: "呢部機有改動未上傳到雲端。",
  sumTitle: "本週概況",
  sumShort: (n) => `休息唔夠 ${n} 日`,
  sumRest: (n) => `休息 ${n} 日`,
  sumLeave: (n) => `假期 ${n} 日`,
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
    ["HSP1 · KSP3", "後備更"],
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
  // OT（lib/tml-ot.js）
  ot: "OT",
  otSum: (m) => `OT ${S.workMin(m)}`,
  otMonth: (m) => `本月 OT ${S.workMin(m)}`,
  otWhole: "成更 OT",
  otBefore: (m) => `更前 OT ${S.workMin(m)}`,
  otAfter: (m) => `更後 OT ${S.workMin(m)}`,
  otTitle: "OT（加班）",
  otNone: "未有 OT",
  otWholeLabel: "成更 OT（呢更嘅工時全部計 OT）",
  otBeforeLabel: "更前",
  otAfterLabel: "更後",
  otHoursUnit: "小時",
  otFrom: "或由",
  otTo: "或至",
  otSave: "儲存 OT",
  otClear: "清除 OT",
  otSaved: "已儲存 OT",
  otCleared: "已清除 OT",
  otBad: "OT 時數唔啱：請輸入 0 至 12 小時（例如 3.5）",
  otHelp: "成更 OT：例如休息日返 1101150，成更 7 小時計 OT（先用 ✏️ 改做嗰個更份）。更前／更後：打時數（例如 3.5）或者揀鐘數，兩格會自動對返。OT 計開工日，時數同正常工時分開計；上下班時間同休息檢查會計埋 OT。",
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
let places = {} // OS 外放車、CIOT 第一城側線 ...（TML-traffic data/tml-network.json places）
let basic = null // TML-traffic data/duty-basic.json: book-on/off of every duty, incl. spare duties
let dutyIndex = null
let dutySheets = null
// 讀唔到嘅資料唔記住：網絡返嚟或者返到呢頁就再讀（retryData）。
let basicFailed = false
let indexFailed = false
let networkFailed = false
const dutyBooks = new Map()
let shown = ""
let openedWeek = ""

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

function loadBasic() {
  basicFailed = false
  fetchData("data/duty-basic.json")
    .then((data) => {
      basic = data.duties
      paintData()
    })
    .catch(() => {
      basicFailed = true
    })
}

// 站名同車廠名：未讀到之前地點顯示代號，讀到再畫一次，唔使等佢先開頁。
function loadNetwork() {
  networkFailed = false
  fetchData("data/tml-network.json")
    .then((network) => {
      stations = stationNames(network)
      places = placeNames(network)
      paintData()
    })
    .catch(() => {
      networkFailed = true
    })
}

function dutyIndexPromise() {
  dutyIndex ??= fetchData("data/duties/index.json")
    .then((index) => {
      dutySheets = index.sheets
      return index
    })
    .catch(() => {
      indexFailed = true
      return null
    })
  return dutyIndex
}

// 再讀之前讀失敗嘅資料（index、duty-basic、站名、更份卡）。
function retryData() {
  if (basicFailed) loadBasic()
  if (networkFailed) loadNetwork()
  if (indexFailed) {
    indexFailed = false
    dutyIndex = null
    dutyIndexPromise().then(paintData)
  }
  for (const [code, entry] of dutyBooks) if (entry.status === "error") dutyBooks.delete(code)
  paintData()
}

function dutyBook(code) {
  let entry = dutyBooks.get(code)
  if (!entry) {
    entry = { status: "loading", data: null, entry: null }
    dutyBooks.set(code, entry)
    dutyIndexPromise()
      .then((index) => {
        if (!index) throw new Error("no index")
        entry.entry = index.sheets.find((item) => item.code === code) ?? null
        // index 冇呢份 sheet：真係冇，唔係讀失敗
        if (!entry.entry) return null
        return fetchData(`data/duties/${entry.entry.file}`)
      })
      .then((data) => {
        entry.data = data
        entry.status = data ? "ok" : "missing"
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
  return cell?.otOff ?? cell?.duty?.off?.[0] ?? cell?.basic?.off ?? null
}

// 更類（死早／早…）跟原本更份嘅時間，唔跟 OT 延長咗嘅
const shiftOfCell = (cell) => shiftOf(cell.baseOn !== undefined ? cell.baseOn : cell.on, cell.baseOff !== undefined ? cell.baseOff : offOf(cell))

// 當日 OT 加落 cell：返工提早 before、放工延遲 after（分鐘）；原本時間留喺 baseOn／baseOff。
function withOt(cell, ot) {
  if (!ot) return cell
  const off = offOf(cell)
  const out = { ...cell, ot, baseOn: cell.on ?? null, baseOff: off }
  if (cell.on != null) out.on = cell.on - (ot.before ?? 0) * 60
  if (off != null) out.otOff = off + (ot.after ?? 0) * 60
  return out
}

// 一日嘅 { entry, cell }，cell 已經計埋 OT
function dayCell(date) {
  const entry = dayEntry(roster, date)
  return { entry, cell: withOt(cellInfo(entry.code, date), entry.ot) }
}

// 「成更 OT · 更後 OT 3 小時 30 分」
function otText(ot) {
  if (!ot) return ""
  return [ot.whole ? S.otWhole : "", ot.before ? S.otBefore(ot.before) : "", ot.after ? S.otAfter(ot.after) : ""].filter(Boolean).join(" · ")
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
  let prev = dayCell(addDays(dates[0], -1)).cell
  for (const date of dates) {
    const cur = dayCell(date).cell
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
  if (places[code]) return places[code]
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
// { label, status: none | ok | loading | failed | nosheet | noduty | nocard, duty, c, note }.
// date picks the Duty Sheet: on a dated sheet's days (7091M on 1 Nov 2026) its own
// cards, not the regular sheet that shares the numbers.
function cellInfo(code, date) {
  const c = classify(code)
  if (c.kind === "status") return { label: `${S.status[c.code]} ${c.code}`, status: "none", tone: c.code === "HC" ? "tbd" : (c.code === "AL" || c.code === "SH" ? "leave" : "rest") }
  // 其他代碼（編更「其他」tab，lib/tml-extra.js）：工時跟 Ice 嘅表；時間用表入面有嘅，冇就用官表（duty-basic）。
  if (c.kind === "other" && Object.hasOwn(OFF_CODES, c.code)) return { label: S.extraOff(OFF_CODES[c.code]), status: "none", tone: "leave" }
  const work = c.kind === "other" ? workOf(c.code) : null
  if (work) {
    const row = basicOf(c.code)
    const on = work.on ?? row?.on
    if (on == null) return { label: c.code, status: "none", note: S.extraWork(work.hours), tone: "duty", extraHours: work.hours }
    return { label: c.code, status: "basic", basic: { on, off: work.off ?? row.off, hours: work.hours, onAt: row?.onAt ?? "", offAt: row?.offAt ?? "", flag: row?.flag ?? "" }, on, tone: "duty" }
  }
  const known = c.kind === "duty" ? null : basicOf(c.code)
  if (known) return { label: c.code, tag: c.kind === "spare" ? S.spareTag : "", status: "basic", basic: known, on: known.on, tone: "duty" }
  if (c.kind === "spare") return { label: S.spare(c.code), status: "none", note: S.spareNote, tone: "spare" }
  if (c.kind === "other") return { label: c.code, status: "none", tone: "spare" }
  // 要 index 先知呢日有冇特別 sheet
  if (dutySheets == null) {
    if (indexFailed) return { label: c.id, status: "failed", c }
    dutyIndexPromise().then(paintData)
    return { label: c.id, status: "loading", c }
  }
  const sheet = sheetForDate(dutySheets, date, c.id)
  const dated = sheet !== c.sheet
  if (dated) c.sheet = sheet
  const book = dutyBook(c.sheet)
  if (book.status === "loading") return { label: c.id, status: "loading", c, dated }
  const duty = book.status === "ok" ? book.data.duties.find((item) => item.id === c.id) : null
  if (!duty) {
    // 官表 basic 只係平日嗰份 sheet 嘅時間，特別日子唔用
    const fallback = dated ? null : basicOf(c.id)
    if (fallback) return { label: c.id, tag: "", status: "basic", basic: fallback, on: fallback.on, tone: "duty", c }
    const status = book.status === "ok" ? "noduty" : book.status === "missing" ? "nosheet" : "failed"
    return { label: c.id, status, c, dated, sheet: dated ? sheet : "" }
  }
  return { label: c.id, group: duty.group, status: duty.on ? "ok" : "nocard", duty, c, tone: "duty", on: duty.on?.[0], dated, sheet: dated ? sheet : "" }
}

// 特別日提示：Standard Roster 寫 6091124，但當日行 8022，就提示更份可能係 8022124（只提示，唔自動換）。
function sheetHint(code, date) {
  const c = classify(code)
  if (c.kind !== "duty" || !dutySheets) return ""
  const special = dutySheets.find((s) => s.class === "special" && [...(s.dates ?? []), ...(s.alsoOn ?? [])].includes(date))
  if (!special || special.code === sheetForDate(dutySheets, date, c.id)) return ""
  return `<p class="fine sheet-hint">${S.sheetHint(special.code, special.code.slice(0, 4) + c.id.slice(4))}</p>`
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
  // OT 延長咗嘅返工／放工（冇 OT 就係原本時間）
  const ot = otText(cell.ot)
  if (cell.status === "ok") {
    return {
      span: [cell.on, offOf(cell)],
      times: `${clockHtml(cell.on)} – ${clockHtml(offOf(cell))}`,
      note: [routeText(d.on[1], d.off[1]) + (d.meal ? ` · ${S.meal} ${hhmm(d.meal[0])}` : ""), ot].filter(Boolean).join(" · "),
    }
  }
  if (cell.status === "basic") {
    const b = cell.basic
    return { span: [cell.on, offOf(cell)], times: `${clockHtml(cell.on)} – ${clockHtml(offOf(cell))}`, note: [b.onAt && b.offAt ? routeText(b.onAt, b.offAt) : "", S.hours(b.hours), ot].filter(Boolean).join(" · ") }
  }
  return { times: "", note: [summary(cell), ot].filter(Boolean).join(" · ") }
}

function summary(cell) {
  if (cell.status === "loading") return S.loading
  if (cell.status === "failed") return S.failed
  if (cell.status === "noduty" && cell.dated) return S.notOnSheet(cell.c.id, cell.sheet)
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
  const place = (at) => (at ? escapeHtml(placeName(at)) : "")
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
  if (!duty) return `<p class="empty">${book.status === "ok" ? S.noDuty(id) : book.status === "missing" ? S.noSheet(id) : S.failed}</p>`
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

// 今日卡下面嘅幾行：返工／放工倒數、下一程（接邊個嘅車）、落車交俾邊個、用膳、下一更。
function todayFactsHtml(date, cell, live) {
  const tau = serviceSeconds(Date.now())
  const rows = []
  const on = cell.on
  const off = offOf(cell)
  const onAt = cell.duty?.on?.[1] ?? cell.basic?.onAt
  const offAt = cell.duty?.off?.[1] ?? cell.basic?.offAt
  if (on != null && tau < on) rows.push([S.factOn, `${S.inTime(S.dur(on - tau))} · ${hhmm(on)} ${placeName(onAt)}`])
  else if (off != null && tau < off) rows.push([S.factOff, `${S.inTime(S.dur(off - tau))} · ${hhmm(off)} ${placeName(offAt)}`])
  else if (off != null) rows.push([S.factOff, S.offDone])

  const duty = cell.status === "ok" ? cell.duty : null
  const sheet = duty ? dutyBook(cell.c.sheet) : null
  const all = sheet?.status === "ok" ? sheet.data.duties : null
  // 之後會發生嘅事按時間排：落車、用膳、下一程
  const events = []
  if (duty && all && (off == null || tau < off)) {
    const legs = duty.legs ?? []
    // 而家喺車上：呢條 run 去到邊、交俾邊個
    if (live?.leg != null && ["drive", "empty", "park"].includes(live.phase)) {
      let last = live.leg
      while (legs[last + 1] && legs[last + 1][1] === legs[last][1]) last += 1
      const end = legs[last][5] ?? legs[last + 1]?.[3] ?? duty.off[0]
      const to = reliefOf(duty, all, last).to
      events.push([end, S.factHand, `${hhmm(end)} ${placeName(legs[last][4])} · ${to ? S.handTo(to.id) : S.handNone}`])
    }
    // 下一程：之後第一段要「接車」嘅（唔計同一個 run 嘅延續）
    const train = (leg) => ["drive", "empty", "park", "prep"].includes(leg?.[0])
    const next = legs.findIndex((leg, i) => leg[3] > tau && train(leg) && !(train(legs[i - 1]) && legs[i - 1][1] === leg[1]))
    if (next !== -1) {
      const leg = legs[next]
      const from = reliefOf(duty, all, next).from
      const what = leg[0] === "prep" ? S.prepAt(leg[1], placeName(leg[2])) : S.pickUp(leg[1], placeName(leg[2]))
      events.push([leg[3], S.factNext, `${hhmm(leg[3])} ${what}${from ? ` · ${S.takeFrom(from.id)}` : ""} · ${S.inTime(S.dur(leg[3] - tau))}`])
    }
    if (duty.meal && duty.meal[1] != null && tau < duty.meal[0]) {
      events.push([duty.meal[0], S.factMeal, `${hhmm(duty.meal[0])}–${hhmm(duty.meal[1])} ${placeName(duty.meal[2])} · ${S.inTime(S.dur(duty.meal[0] - tau))}`])
    }
  }

  for (const [, k, v] of events.sort((a, b) => a[0] - b[0])) rows.push([k, v])

  // 下一更：今日放咗工，或者今日唔使返工
  if (off == null || tau >= off) {
    for (let k = 1; k <= 14; k += 1) {
      const day = addDays(date, k)
      const next = dayCell(day).cell
      if (next.on == null) continue
      const gap = off != null ? ` · ${S.restGap(S.dur(k * 86400 + next.on - off))}` : ""
      rows.push([S.factNextDuty, `${S.weekdays[weekdayIndex(day)]} ${meDate(day)} · ${next.label} ${hhmm(next.on)}${gap}`])
      break
    }
  }
  if (!rows.length) return ""
  // 卡本身係 <button>，入面只可以用 span
  return `<span class="today-facts">${rows.map(([k, v]) => `<b>${k}</b><span>${escapeHtml(v)}</span>`).join("")}</span>`
}

// Today, big, with what the duty is doing right now.
function todayHtml(date, entry, cell, short = false) {
  const lines = dayLines(cell)
  const shift = shiftOfCell(cell)
  const live = cell.status === "ok" ? dutyState(cell.duty, serviceSeconds(Date.now())) : null
  const tags = (cell.group ? `<span class="badge plain">${cell.group}</span>` : "") + (cell.tag ? `<span class="badge plain">${cell.tag}</span>` : "") +
    (cell.sheet ? `<span class="badge plain">${cell.sheet}</span>` : "") +
    (shift ? `<span class="badge shift">${S.shift[shift]}</span>` : "") +
    (cell.ot ? `<span class="badge ot">${S.ot}</span>` : "") +
    (entry.source === "override" ? `<span class="badge plain">${S.changed}</span>` : "")
  return `<button type="button" class="today me-day" data-date="${date}" data-tone="${cell.tone ?? "duty"}" data-shift="${shift}"${short ? ' data-short="1"' : ""}>` +
    `<span class="today-label">${S.today} · ${S.weekdays[weekdayIndex(date)]} ${meDate(date)}</span>` +
    `<span class="today-title">${isOffTone(cell) ? offTitleHtml(entry.code, cell) : escapeHtml(cell.label)}${tags}${short ? `<span class="badge rest-short">${S.restShort}</span>` : ""}</span>` +
    (lines.times ? `<span class="today-times">${lines.times}</span>${barHtml(lines.span, serviceSeconds(Date.now()))}` : "") +
    (lines.note ? `<span class="today-note">${escapeHtml(lines.note)}</span>` : "") +
    (live ? `<span class="today-live"><i class="pulse"></i><span>${S.now}：${escapeHtml(dutyPhaseText(live))} <small>${S.until(hhmm(live.until))}</small></span></span>` : "") +
    todayFactsHtml(date, cell, live) +
    `</button>`
}

// 一週概況：計法喺 lib/tml-week.js，呢度只係餵現時嘅 roster 同已載入嘅更份資料。
function weekSummary(dates) {
  return summariseWeek(dates, (date) => dayEntry(roster, date), (code, date) => {
    const cell = cellInfo(code, date)
    // 特別日子嘅 sheet（7091M）同平日共用編號：官表 basic 係平日嗰份，唔好用
    const known = cell.basic ?? (cell.dated ? null : basicOf(code))
    return known ? { ...cell, basic: known } : cell
  })
}

// 本週出現最多次嘅組別；冇就 null
function usualGroup(dates) {
  const count = new Map()
  for (const date of dates) {
    const group = cellInfo(dayEntry(roster, date).code, date).group
    if (group) count.set(group, (count.get(group) ?? 0) + 1)
  }
  let best = null
  for (const [group, n] of count) if (!best || n > count.get(best)) best = group
  return best
}

// 桌面版左欄：今日卡下面放本週概況（開工、工時、各更類日數、休息唔夠）
function weekCardHtml(dates, short) {
  const s = weekSummary(dates)
  const shifts = new Map()
  for (const date of dates) {
    const shift = shiftOfCell(dayCell(date).cell)
    if (shift) shifts.set(shift, (shifts.get(shift) ?? 0) + 1)
  }
  const parts = [
    s.days ? `<li><b>${S.sumDays(s.days)}</b></li>` : "",
    s.days ? `<li>${S.sumWork} <b>${S.workMin(s.minutes)}</b></li>` : "",
    `<li>${S.ot} <b>${S.workMin(s.ot)}</b></li>`,
    s.rest ? `<li>${S.sumRest(s.rest)}</li>` : "",
    s.leave ? `<li>${S.sumLeave(s.leave)}</li>` : "",
    short.size ? `<li class="bad">${S.sumShort(short.size)}</li>` : "",
  ].join("")
  const legend = SHIFTS.filter((k) => shifts.has(k))
    .map((k) => `<li data-shift="${k}"><i></i>${S.shift[k]} ${shifts.get(k)}</li>`).join("")
  return `<section class="week-card"><h3>${S.sumTitle}</h3><ul class="week-facts">${parts}</ul>` +
    (legend ? `<ul class="week-shifts">${legend}</ul>` : "") + `</section>`
}

// 一句話講本週：行號 + 開工日數 + 工時（頁首副標用）
// 本月：睇緊本週就跟今日嘅月份，其他週跟嗰週週一嘅月份（1 號至月尾，Ice 2026-10-24）。
function subLine(monday) {
  const row = rowLabelFor(roster, monday)
  const s = weekSummary(weekDates(monday))
  if (row == null) return S.title
  const today = serviceDate(Date.now())
  const month = weekSummary(monthDates(weekDates(monday).includes(today) ? today : monday))
  return `${S.stdRow(row)}${s.days ? ` · ${S.sumDays(s.days)} · ${S.sumWork} ${S.workMin(s.minutes)}` : ""} · ${S.otMonth(month.ot)}`
}

/* ------------------------------------------------------------------ OT */

// 日詳情頁嘅 OT 表格。喺 me-data 外面（me-data 每 15 秒重畫，會洗走輸入）。
function otPanelHtml(date, entry) {
  const ot = entry.ot ?? {}
  const base = cellInfo(entry.code, date)
  const on = base.on ?? null
  const off = offOf(base)
  const hours = (m) => (m ? String(Math.round((m / 60) * 100) / 100) : "")
  const row = (side, label, word, mins, ref) =>
    `<div class="ot-row"><span class="ot-side">${label}</span>` +
    `<input name="${side}H" class="mini" type="number" inputmode="decimal" step="any" value="${hours(mins)}" placeholder="0" aria-label="${label} ${S.otHoursUnit}"><span>${S.otHoursUnit}</span>` +
    `<span class="ot-or">${word}</span><input name="${side}T" class="mini" type="time" value="${mins && ref != null ? otClock(ref, mins, side) : ""}"${ref == null ? " disabled" : ""} aria-label="${label} ${word}"></div>`
  return `<details class="panel me-ot"${entry.ot ? " open" : ""}><summary><b>${S.otTitle}</b><span class="meta">${escapeHtml(otText(entry.ot) || S.otNone)}</span></summary>` +
    `<form class="me-ot-form" autocomplete="off">` +
    `<label class="ot-check"><input type="checkbox" name="whole"${ot.whole ? " checked" : ""}> ${S.otWholeLabel}</label>` +
    row("before", S.otBeforeLabel, S.otFrom, ot.before, on) +
    row("after", S.otAfterLabel, S.otTo, ot.after, off) +
    `<div class="row"><button type="submit" class="btn primary">${S.otSave}</button>` +
    (entry.ot ? ` <button type="button" class="btn me-ot-clear">${S.otClear}</button>` : "") + `</div>` +
    `<p class="fine">${S.otHelp}</p></form></details>`
}

// 時數同鐘數兩格互相對返：改時數就計鐘數，揀鐘數就計時數。
function syncOtInputs(form, input) {
  const m = /^(before|after)([HT])$/.exec(input.name ?? "")
  if (!m) return
  const [, side, kind] = m
  const entry = dayEntry(roster, state.date)
  const base = cellInfo(entry.code, state.date)
  const ref = side === "before" ? base.on ?? null : offOf(base)
  if (ref == null) return
  if (kind === "H") {
    const mins = Math.round(Number(input.value) * 60)
    form.elements[`${side}T`].value = Number.isFinite(mins) && mins > 0 ? otClock(ref, mins, side) : ""
  } else {
    const mins = otFromClock(ref, input.value, side)
    form.elements[`${side}H`].value = mins ? String(Math.round((mins / 60) * 100) / 100) : ""
  }
}

function submitOt(form) {
  const read = (name) => {
    const text = String(form.elements[name].value ?? "").trim()
    if (!text) return 0
    const h = Number(text)
    return Number.isFinite(h) && h >= 0 && h <= 12 ? Math.round(h * 60) : null
  }
  const before = read("beforeH")
  const after = read("afterH")
  if (before === null || after === null) {
    state.message = S.otBad
    return render()
  }
  const next = setOt(roster, state.date, { whole: form.elements.whole.checked, before, after })
  state.message = saveRoster(next) ? (next.ot[state.date] ? S.otSaved : S.otCleared) : S.notStored
  render()
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
  openedWeek = state.monday
  state.date = null
  render()
}

// 放喺主畫面過夜：週一 04:00 之後，如果仲停喺舊一週（冇自己換週），就跳返本週。
function rollWeek() {
  const current = mondayOf(serviceDate(Date.now()))
  if (current === openedWeek) return
  if (state.page === "week" && state.monday === openedWeek) {
    state.monday = current
    render()
  }
  openedWeek = current
}

// 頁首副標：一頁一句實用資訊（唔係死板標語）
function setSub(text) {
  const el = document.getElementById("sub")
  if (el && el.textContent !== text) el.textContent = text
}

function render() {
  renderPage()
  paintDirty()
}

function renderPage() {
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
      otPanelHtml(state.date, entry) +
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
    const cell = cellInfo(entry.code, state.date)
    if (cell.status === "none") html = `<p class="empty">${escapeHtml(cell.label)}${cell.note ? ` · ${cell.note}` : ""}</p>`
    else if (cell.status === "basic") html = basicDetailHtml(cell)
    else if (cell.status === "loading") html = `<p class="empty">${S.loading}</p>`
    else if (cell.status === "nosheet") html = `<p class="empty">${S.noSheet(cell.c.id)}</p>`
    else if (cell.status === "failed") html = `<p class="empty">${S.failed}</p>`
    else html = dutyDetailHtml({ sheet: cell.c.sheet, id: cell.c.id }, state.date === serviceDate(Date.now()))
    html = sheetHint(entry.code, state.date) + html
  } else if (state.page === "week") {
    const today = serviceDate(Date.now())
    const week = weekDates(state.monday)
    const short = shortRestDates(week)
    const heroHtml = week.includes(today) ? todayHtml(today, dayEntry(roster, today), dayCell(today).cell, short.has(today)) + sheetHint(dayEntry(roster, today).code, today) : ""
    // 今日已經有 hero，列表唔再重複
    const listDays = week.includes(today) ? week.filter((date) => date !== today) : week
    // 本週最常見嘅組別（例如 KSR）唔使每張卡都寫，唔同先顯示
    const usual = usualGroup(week)
    const listHtml = `<ul class="day-list">${listDays.map((date) => {
      const { entry, cell } = dayCell(date)
      const lines = dayLines(cell)
      const badges = (date === today ? `<span class="badge now">${S.today}</span>` : "") +
        (entry.source === "override" ? `<span class="badge plain">${S.changed}</span>` : "")
      const shift = shiftOfCell(cell)
      const tags = (cell.group && cell.group !== usual ? `<span class="badge plain">${cell.group}</span>` : "") + (cell.tag ? `<span class="badge plain">${cell.tag}</span>` : "") +
        (cell.sheet ? `<span class="badge plain">${cell.sheet}</span>` : "") +
        (shift ? `<span class="badge shift">${S.shift[shift]}</span>` : "") +
        (cell.ot ? `<span class="badge ot">${S.ot}</span>` : "")
      return `<li><button type="button" class="day me-day" data-date="${date}" data-tone="${cell.tone ?? "duty"}" data-shift="${shift}" data-today="${date === today ? 1 : 0}"${short.has(date) ? ' data-short="1"' : ""}>` +
        `<span class="day-date"><small>${S.weekdays[weekdayIndex(date)]}</small><b>${Number(date.slice(8))}</b></span>` +
        `<span class="day-main"><span class="day-title">${isOffTone(cell) ? offTitleHtml(entry.code, cell) : escapeHtml(cell.label)}${tags}${badges}${short.has(date) ? `<span class="badge rest-short">${S.restShort}</span>` : ""}</span>` +
        (lines.times ? `<span class="day-times">${lines.times}</span>${barHtml(lines.span)}` : "") +
        (noteWithHours(lines.note, cell) ? `<span class="meta">${escapeHtml(noteWithHours(lines.note, cell))}</span>` : "") +
        `</span></button></li>`
    }).join("")}</ul>`
    html = `<div class="me-cols"><div class="me-col-a">${heroHtml}${weekCardHtml(week, short)}</div>` +
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
        (kvDirty() ? `<p class="fine me-sync-dirty">${S.syncDirty}</p>` : "") +
        `<p class="me-msg me-sync-msg" role="status">${escapeHtml(state.syncMsg)}</p></section>`)
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
// 用輸入框入面嘅 token；換咗就記住，版本號由 0 開始，並寄 log。
// 框入面打咗嘢但唔係 token 格式就回 null，唔好靜靜用返舊 token。
function adoptToken() {
  const value = String(document.getElementById("me-kv-token")?.value ?? "").trim().toLowerCase()
  if (value && !TOKEN_RE.test(value)) return null
  if (value && value !== kvToken()) {
    writePref(KV_KEY, value)
    writePref(KV_VERSION, "0") // 換咗 token：手上版本號唔再適用
    sendLog("join", value)
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

// 會上傳嘅內容嘅指紋（FNV-1a），用嚟知道上次同步之後有冇改過。
function kvPrint() {
  if (!roster) return ""
  // OT 有先計（同 Worker content() 一樣），舊版冇 OT 嘅指紋唔會因為升級而變
  const ot = Object.keys(roster.ot ?? {}).length ? [roster.ot] : []
  return fingerprint(JSON.stringify([title, roster.rows, roster.numbers, roster.names, roster.anchor, roster.overrides, ...ot]))
}

// 有 token、網址支援同步，而且更表同上次同步唔同
function kvDirty() {
  return !!roster && !!kvToken() && syncSupported !== false && readPref(KV_SYNCED) !== kvPrint()
}

function paintDirty() {
  const button = document.querySelector(".me-settings")
  if (!button) return
  const dirty = kvDirty()
  button.classList.toggle("dirty", dirty)
  button.setAttribute("aria-label", dirty ? `${S.settings}（${S.syncDirty}）` : S.settings)
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

// 產生／換 token 時寄 log 電郵；結果加喺訊息後面（寄緊嗰陣唔阻用戶）。
async function sendLog(event, token) {
  const out = await logToken("/api/token-log", "roster", event, token, thisDevice())
  const note = out.ok ? S.logSent : S.logFail(mailWhy(out.reason))
  state.syncMsg = state.syncMsg ? `${state.syncMsg}${note}` : note
  render()
}

function kvNewToken() {
  if (kvToken() && !confirm(S.syncNewAsk)) return
  const token = newToken()
  writePref(KV_KEY, token)
  writePref(KV_VERSION, "0") // 新記錄由第 0 版開始
  kvMessage(S.syncNewDone)
  sendLog("new", token)
}

async function kvCopyToken() {
  const token = adoptToken()
  if (token === null) return kvMessage(S.syncBadToken)
  if (!token) return kvMessage(S.syncNoToken)
  try {
    await navigator.clipboard.writeText(token)
    kvMessage(S.syncCopied)
  } catch {
    kvMessage(S.syncCopyFail)
  }
}

// skipBackup：雲端舊版本寄唔到電郵，用戶都揀照樣覆蓋
async function kvUpload(force = false, skipBackup = false) {
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
        overrides: recentOverrides(roster.overrides, serviceDate(Date.now())),
        ot: recentOt(roster.ot, serviceDate(Date.now())),
        version: Number(readPref(KV_VERSION) ?? 0),
        force,
        skipBackup,
        device: thisDevice(),
      }),
    })
  } catch {
    return kvMessage(S.syncFail)
  }
  const body = await res.json().catch(() => null)
  if (res.status === 409 && body?.reason === "conflict" && !force) {
    const when = hkStamp(body.cloud?.updatedAt)
    if (confirm(S.syncConflict(when, body.cloud?.title ?? "", body.cloud?.device ?? ""))) return kvUpload(true, skipBackup)
    return kvMessage(S.syncKeptLocal)
  }
  if (res.status === 502 && body?.reason === "backup_failed" && !skipBackup) {
    if (confirm(S.syncBackupFail(mailWhy(body.why)))) return kvUpload(true, true)
    return kvMessage(S.syncKeptLocal)
  }
  if (body?.reason === "too_many_overrides") return kvMessage(mailWhy(body.reason))
  if (!res.ok || !body?.ok) return kvMessage(S.syncFail)
  writePref(KV_VERSION, String(body.version))
  writePref(KV_SYNCED, kvPrint())
  kvMessage(S.syncUp(body.version, hkStamp(body.updatedAt)) + (body.backedUp ? S.syncBackedUp : ""))
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
  // OT：雲端有欄位就跟雲端；舊記錄（未有 OT 嗰陣上傳）冇就保留呢部機嘅
  const ot = rec.ot && typeof rec.ot === "object" ? rec.ot : (roster?.ot ?? {})
  const next = cleanRoster({
    v: 1,
    rows,
    numbers,
    names,
    anchor: { row: anchorRow ?? 1, monday: anchorMonday },
    overrides,
    ot,
  })
  if (!next) return kvMessage(S.syncFail)
  const when = hkStamp(rec.updatedAt)
  const fresh = !roster // 第一次用：冇本地更表，冇嘢會被蓋，唔使問
  if (!fresh && !confirm(S.syncOverwriteLocal(when, rec.title ?? ""))) return kvMessage(S.syncKeptDown)
  // 蓋掉呢部機之前，先將呢部機嘅版本寄去電郵（寄唔到就下載個檔）；同雲端一樣就唔使。
  const backup = fresh || kvPrint() === readPref(KV_SYNCED) ? "" : await backupLocal()
  if (!saveRoster(next)) return kvMessage(S.notStored)
  if (rec.title) {
    title = String(rec.title).slice(0, 24)
    writePref(TITLE_KEY, title)
  }
  writePref(KV_VERSION, String(rec.version ?? 0))
  writePref(KV_SYNCED, kvPrint())
  if (fresh) {
    state.page = "week"
    state.monday = mondayOf(serviceDate(Date.now()))
  }
  kvMessage(S.syncDown(when) + (backup ? backup : ""))
}

// 呢部機嘅更表，用設定頁「貼返入去」嘅格式（cleanRoster 讀得返）。
async function backupLocal() {
  const stamp = hkStamp(new Date().toISOString())
  const name = `my-roster-${stamp.slice(0, 10)}-${stamp.slice(11).replace(":", "")}.json`
  const text = JSON.stringify({ ...roster, title }, null, 1)
  const out = await postJson("/api/backup", { name, text, device: thisDevice() })
  if (out.ok) return S.localMailed
  download(name, text, "application/json")
  return S.localSaved(mailWhy(out.reason))
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
  } else if (target.closest(".me-ot-clear")) {
    state.message = saveRoster(setOt(roster, state.date, null)) ? S.otCleared : S.notStored
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
    if (adoptToken() === null) kvMessage(S.syncBadToken)
    else kvUpload()
    return
  } else if (target.closest(".me-kv-down")) {
    if (adoptToken() === null) kvMessage(S.syncBadToken)
    else kvDownload()
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

function boot() {
  loadNetwork()
  title = String(readPref(TITLE_KEY) ?? "").trim().slice(0, 24)
  applyTitle()
  wireTitle()
  view.addEventListener("click", onClick)
  wireKeys()
  wireSettings()
  view.addEventListener("input", (event) => {
    const form = event.target.closest?.(".me-setup")
    if (form) refreshPreview(form)
    const otForm = event.target.closest?.(".me-ot-form")
    if (otForm) syncOtInputs(otForm, event.target)
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
    else if (event.target.matches(".me-ot-form")) submitOt(event.target)
  })
  document.getElementById("foot").innerHTML =
    `v${BUILD.version} · ${BUILD.commit === "dev" ? "dev" : `commit ${escapeHtml(BUILD.commit)}`} · ` +
    `更份資料來自 <a href="https://github.com/iceninye/TML-traffic">TML-traffic</a>`
  loadBasic()
  probeSync()
  open()
  dutyIndexPromise().then((index) => {
    if (index) document.getElementById("foot").insertAdjacentHTML("beforeend", ` · ${S.dutyData(index.sheets.filter((s) => s.class !== "special").map((s) => s.issued).sort().pop())}`)
  })
  // 每 15 秒重畫一次就夠（時間軸以分鐘為單位）；唔好每秒做全套計算。
  setInterval(() => { rollWeek(); paintData() }, 15000)
  window.addEventListener("online", retryData)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return
    rollWeek()
    retryData()
  })
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {})
}

boot()
