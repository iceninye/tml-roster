// TML Roster: your own duty roster over the Tuen Ma Line Duty Sheet cards.
// Hand-written, no build step. The roster is kept only in this browser's
// localStorage; nothing is uploaded. Duty cards come from data/duties/, copied
// from https://github.com/iceninye/TML-traffic (see tools/sync-duties.mjs).

import { dutyState, mealMates } from "../lib/tml-duties.js"
import { addDays, classify, cleanRoster, dayEntry, mondayOf, newRoster, normaliseCode, parseRoster, rowLabelFor, setOverride, weekDates, weekdayIndex } from "../lib/tml-roster.js"
import { serviceDate, serviceSeconds } from "../lib/tml-time.js"

const BUILD = { version: "0.4.0", commit: "200bd61" }
const ROSTER_KEY = "tml-roster"
// The key TML-traffic v0.9.0 used; a roster saved there is picked up once.
const LEGACY_KEY = "tml-traffic-roster"

const S = {
  weekdays: ["週一", "週二", "週三", "週四", "週五", "週六", "週日"],
  status: { RD: "休息日", AL: "年假", SH: "法定假日", HC: "待定" },
  spare: (code) => `後備更 ${code}`,
  spareNote: "後備更冇固定上下班時間",
  noCard: "呢個更份暫時冇上下班資料",
  spareTag: "後備更",
  basicNote: "呢個更份冇逐段行程資料，只有上下班時間同地點。",
  shift: { early: "早更", mid: "中更", late: "夜更" },
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
  row: (n) => `第 ${n} 行`,
  prev: "‹ 上週",
  next: "下週 ›",
  thisWeek: "本週",
  today: "今日",
  changed: "已手動改",
  settings: "設定／備份",
  back: "‹ 返回",
  weekOf: (a, b) => `${a} – ${b}`,
  rowOf: (n) => `roster 第 ${n} 行`,
  weekHint: "撳任何一日睇全日行程；特別日子（例如 8022、8023）可以喺該日入面手動改。",
  editTitle: "改呢日嘅更份",
  editLabel: "更份編號或代號",
  editHint: "例如 8022131、RD、AL",
  editHelp: "特別日子（例如 8022、8023）想換成另一個更份就喺度改。改完只影響呢一日。",
  save: "儲存",
  reset: "還原做預設",
  defaultIs: (code) => `預設係 ${code}`,
  badCode: "格式唔啱：請輸入 7 位更份編號，或者 RD、AL、SH、HC、HSP1、KSP3 呢類代號",
  setupTitle: "設定我的更表",
  settingsTitle: "更表設定",
  setupIntro: "第一次使用，請完成下面兩步。你嘅更表只會儲存喺呢部機嘅瀏覽器，唔會上傳，其他人睇唔到。",
  step1: "貼上你嘅 roster",
  step2: "講低今個星期係第幾行",
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
  pasteLabel: "Roster 內容",
  pastePlaceholder: "喺度貼上，每行一個星期",
  pasteKeep: "留空就保留現有更表；貼上新內容會取代舊嘅，但你手動改過嘅日子會保留",
  rowLabel: (monday) => `今個星期（${monday} 起）係第幾行？`,
  rowHelp: "填你 roster 嘅行號。之後每過一個星期會自動跳去下一行，最後一行之後返去第一行。",
  rowBad: (nums) => `喺你嘅 roster 入面搵唔到呢個行號（有 ${nums}）`,
  saved: "已儲存",
  notStored: "已讀入，但呢部機儲存唔到，關閉頁面後會冇咗",
  backupTitle: "備份同清除",
  backupHelp: "換手機或者清除瀏覽器資料之前，先匯出備份。要還原就將備份內容貼返入上面「Roster 內容」再儲存。",
  export: "匯出備份",
  exportNote: "複製下面成段內容，存喺安全嘅地方。",
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
  exportText: "",
}

let roster = null
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

// Early (on before 10:00), middle, or late (on from 15:00) duty.
function shiftOf(onSec) {
  return onSec < 36000 ? "early" : onSec < 54000 ? "mid" : "late"
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
  if (c.kind === "status") return { label: `${S.status[c.code]} ${c.code}`, status: "none", tone: c.code === "HC" ? "tbd" : "rest" }
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

// The week list's lines for one day: times and a quiet note.
function dayLines(cell) {
  const d = cell.duty
  if (cell.status === "ok") {
    return {
      times: `${clockHtml(d.on[0])} – ${clockHtml(d.off[0])}`,
      note: `${placeName(d.on[1])} → ${placeName(d.off[1])}` + (d.meal ? ` · ${S.meal} ${hhmm(d.meal[0])}` : ""),
    }
  }
  if (cell.status === "basic") {
    const b = cell.basic
    return { times: `${clockHtml(b.on)} – ${clockHtml(b.off)}`, note: [b.onAt && b.offAt ? `${b.onAt} → ${b.offAt}` : "", S.hours(b.hours)].filter(Boolean).join(" · ") }
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
  return mates.map(({ duty: other, from, to }) =>
    `<button type="button" class="link duty-mate" data-duty="${other.id}" data-sheet="${sheet}">${other.id}</button>` +
    `<span class="meta"> ${hhmm(from)}–${hhmm(to)}（${Math.round((to - from) / 60)} 分）</span>`).join("<br>")
}

// A duty without leg-by-leg data (spare duties, sheets not copied here).
function basicDetailHtml(cell) {
  const b = cell.basic
  const place = (at) => (at ? escapeHtml(at) : "")
  return `<div class="duty-sub">${cell.tag ? `<span class="badge plain">${cell.tag}</span> ` : ""}<span class="badge plain">${S.shift[shiftOf(b.on)]}</span></div>` +
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
  const rows = [{ at: duty.on[0], html: `<span class="duty-t">${hhmm(duty.on[0])}</span><span>${S.bookOn}</span><span>${placeName(duty.on[1])}</span>` }]
  duty.legs.forEach((leg, i) => {
    const [kind, run, from, at, to, until] = leg
    rows.push({
      at, now: live?.leg === i && live.phase === kind,
      html: `<span class="duty-t">${secClock(at)}</span><span>${S.kind[kind] ?? kind}${run == null ? "" : ` Run ${run}`}</span>` +
        `<span>${placeName(from)}${to ? ` → ${placeName(to)}${until != null ? ` ${hhmm(until)}` : ""}` : ""}</span>`,
    })
  })
  if (duty.meal) {
    rows.push({ at: duty.meal[0], now: live?.phase === "meal", html: `<span class="duty-t">${hhmm(duty.meal[0])}</span><span>${S.meal}</span><span>${mealPlace(duty.meal)} ${hhmm(duty.meal[0])}–${hhmm(duty.meal[1])}</span>` })
  }
  rows.sort((a, b) => a.at - b.at)
  rows.push({ at: duty.off[0], html: `<span class="duty-t">${hhmm(duty.off[0])}</span><span>${S.bookOff}</span><span>${placeName(duty.off[1])}</span>` })
  return `<div class="duty-sub"><span class="badge plain">${duty.group}</span> Duty Sheet ${sheet}</div>` +
    `<div class="hero"><div><small>${S.on}</small><b>${hhmm(duty.on[0])}</b><span>${placeName(duty.on[1])}</span></div>` +
    `<i aria-hidden="true">→</i><div><small>${S.off}</small><b>${clockHtml(duty.off[0])}</b><span>${placeName(duty.off[1])}</span></div></div>` +
    `<dl class="kv">` +
    (duty.work != null ? `<dt>${S.work}</dt><dd>${S.workMin(duty.work)}</dd>` : "") +
    (duty.meal ? `<dt>${S.meal}</dt><dd>${hhmm(duty.meal[0])}–${hhmm(duty.meal[1])} ${mealPlace(duty.meal)}</dd>` +
      `<dt>${S.mates}</dt><dd>${mealMatesHtml(duty, book.data.duties, sheet)}</dd>` : "") +
    `</dl>${duty.meal ? `<p class="fine">${S.matesHelp}</p>` : ""}${nowBox}<div class="stops-head">${S.legs}</div><ol class="duty-legs">` +
    rows.map((row) => `<li data-now="${row.now ? 1 : 0}">${row.html}</li>`).join("") + `</ol><p class="fine">${source}</p>`
}

/* ------------------------------------------------------- roster table */

// Every row of a roster as a table. cur = label of the row to mark (this
// week), today = a date whose cell gets a frame. Pass a parsed { rows, numbers }.
function rosterTableHtml({ rows, numbers }, cur = null, todayIndex = -1) {
  const head = `<tr><th>${S.rowHead}</th>${S.weekdays.map((d) => `<th>${d.replace("週", "")}</th>`).join("")}</tr>`
  const body = rows.map((row, i) => {
    const now = numbers[i] === cur
    return `<tr${now ? ' class="cur"' : ""}><th>${numbers[i]}</th>` +
      row.map((code, d) => {
        const kind = classify(code).kind
        return `<td data-kind="${kind}"${now && d === todayIndex ? ' class="today"' : ""}>${escapeHtml(code)}</td>`
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

function render() {
  shown = ""
  if (state.page === "setup") {
    view.innerHTML = setupHtml()
    return
  }
  if (state.page === "duty") {
    view.innerHTML = `<div class="duty-head"><button type="button" class="btn me-back">${S.back}</button><h2>${escapeHtml(state.duty.id)}</h2></div><div id="me-data"></div>`
    paintData()
    return
  }
  if (state.page === "detail") {
    const entry = dayEntry(roster, state.date)
    view.innerHTML =
      `<div class="duty-head"><button type="button" class="btn me-back">${S.back}</button><h2>${S.weekdays[weekdayIndex(state.date)]} ${meDate(state.date)}</h2></div>` +
      `<div id="me-data"></div>` +
      `<details class="panel me-editbox" ${state.message || entry.source === "override" ? "open" : ""}><summary>${S.editTitle}${entry.source === "override" ? ` <span class="badge plain">${S.changed}</span>` : ""}</summary>` +
      `<form class="me-edit" autocomplete="off"><p class="fine">${S.editHelp}</p><label>${S.editLabel}` +
      `<input name="code" value="${escapeHtml(entry.code)}" maxlength="10" autocapitalize="characters" spellcheck="false" placeholder="${S.editHint}"></label>` +
      `<div class="me-edit-row"><button type="submit" class="btn primary">${S.save}</button>` +
      `${entry.source === "override" ? `<button type="button" class="btn me-reset">${S.reset}</button>` : ""}` +
      `<span class="meta">${S.defaultIs(entry.defaultCode)}</span></div>` +
      `<p class="me-msg" role="status">${escapeHtml(state.message)}</p></form></details>`
    paintData()
    return
  }
  const dates = weekDates(state.monday)
  const current = mondayOf(serviceDate(Date.now()))
  view.innerHTML =
    `<div class="me-nav"><button type="button" class="btn me-prev">${S.prev}</button>` +
    `<button type="button" class="btn me-this" ${state.monday === current ? "disabled" : ""}>${S.thisWeek}</button>` +
    `<button type="button" class="btn me-next">${S.next}</button></div>` +
    `<div class="duty-sum"><b>${S.weekOf(meDate(dates[0]), meDate(dates[6]))}</b> <span class="badge plain">${S.rowOf(rowLabelFor(roster, state.monday))}</span></div>` +
    `<div id="me-data"></div>` +
    `<p class="legend"><span><i style="background:#d9a23b"></i>${S.shift.early}（10:00 前上班）</span><span><i style="background:#4f9fd6"></i>${S.shift.mid}</span><span><i style="background:#8a6fd1"></i>${S.shift.late}（15:00 後上班）</span></p>` +
    `<p class="fine">${S.weekHint}</p>` +
    `<details class="panel roster-box" open><summary>${S.rosterTitle(roster.rows.length)}</summary><p class="fine">${S.rosterHelp}</p>` +
    rosterTableHtml(roster, rowLabelFor(roster, state.monday), dates.indexOf(serviceDate(Date.now()))) + `</details>` +
    `<div class="me-foot"><button type="button" class="btn me-settings">${S.settings}</button></div>`
  paintData()
  view.querySelector(".rtable tr.cur")?.scrollIntoView({ block: "nearest" })
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
    html = `<ul class="day-list">${weekDates(state.monday).map((date) => {
      const entry = dayEntry(roster, date)
      const cell = cellInfo(entry.code)
      const lines = dayLines(cell)
      const badges = (date === today ? `<span class="badge now">${S.today}</span>` : "") +
        (entry.source === "override" ? `<span class="badge plain">${S.changed}</span>` : "")
      const shift = cell.on != null ? shiftOf(cell.on) : ""
      const tags = (cell.group ? `<span class="badge plain">${cell.group}</span>` : "") + (cell.tag ? `<span class="badge plain">${cell.tag}</span>` : "") +
        (shift ? `<span class="badge shift">${S.shift[shift]}</span>` : "")
      return `<li><button type="button" class="day me-day" data-date="${date}" data-tone="${cell.tone ?? "duty"}" data-shift="${shift}" data-today="${date === today ? 1 : 0}">` +
        `<span class="day-date"><b>${S.weekdays[weekdayIndex(date)]}</b><small>${meDate(date)}</small></span>` +
        `<span class="day-main"><span class="day-title">${escapeHtml(cell.label)}${tags}${badges}</span>` +
        (lines.times ? `<span class="day-times">${lines.times}</span>` : "") +
        (lines.note ? `<span class="meta">${escapeHtml(lines.note)}</span>` : "") +
        `</span><span class="day-go" aria-hidden="true">›</span></button></li>`
    }).join("")}</ul>`
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
  return `<div class="duty-head">${roster ? `<button type="button" class="btn me-back">${S.back}</button>` : ""}<h2>${roster ? S.settingsTitle : S.setupTitle}</h2></div>` +
    (roster ? "" : `<p class="lead">${S.setupIntro}</p>`) +
    `<form class="me-setup" autocomplete="off">` +
    `<section class="panel"><h3><span class="step">1</span>${S.step1}</h3>` +
    `<details class="how"><summary>${S.howTitle}</summary><p class="fine">${S.howBody}</p><ul class="how-codes">${codes}</ul>` +
    `<pre>${escapeHtml(S.howExample).replace(/\n/g, "<br>")}</pre></details>` +
    `<label><span class="sr">${S.pasteLabel}</span><textarea name="text" rows="6" spellcheck="false" placeholder="${roster ? S.pasteKeep : S.pastePlaceholder}"></textarea></label>` +
    `<div class="me-edit-row"><label class="btn filebtn">${S.fileBtn}<input type="file" class="me-file" accept=".csv,.tsv,.txt,text/plain,text/csv" hidden></label><span class="meta">${S.fileHelp}</span></div>` +
    `<h4 class="prev-title">${S.previewTitle}</h4><div id="setup-preview">${previewHtml("", row)}</div></section>` +
    `<section class="panel"><h3><span class="step">2</span>${S.step2}</h3>` +
    `<label>${S.rowLabel(monday)}<input name="row" type="number" inputmode="numeric" min="1" value="${row}" required></label>` +
    `<p class="fine">${S.rowHelp}</p></section>` +
    `<div class="me-edit-row"><button type="submit" class="btn primary">${S.save}</button></div>` +
    `<p class="me-msg" role="status">${escapeHtml(state.message)}</p></form>` +
    (roster
      ? `<section class="panel"><h3>${S.backupTitle}</h3><p class="fine">${S.backupHelp}</p>` +
        `<div class="me-foot"><button type="button" class="btn me-export">${S.export}</button> ` +
        `<button type="button" class="btn danger me-clear">${S.clear}</button></div>` +
        (state.exportText ? `<p class="fine">${S.exportNote}</p><textarea class="me-export-box" readonly rows="5">${escapeHtml(state.exportText)}</textarea>` : "") + `</section>`
      : "")
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
    state.page = "week"
    state.monday = monday
  }
  render()
}

function submitEdit(form) {
  const code = normaliseCode(form.elements.code.value.trim())
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
  } else if (target.closest(".me-back")) {
    state.page = state.page === "duty" ? state.from : roster ? "week" : "setup"
    state.message = ""
  } else if (target.closest(".me-prev")) state.monday = addDays(state.monday, -7)
  else if (target.closest(".me-next")) state.monday = addDays(state.monday, 7)
  else if (target.closest(".me-this")) state.monday = mondayOf(serviceDate(Date.now()))
  else if (target.closest(".me-settings")) {
    state.page = "setup"
    state.message = ""
    state.exportText = ""
  } else if (target.closest(".me-reset")) {
    state.message = saveRoster(setOverride(roster, state.date, null)) ? S.saved : S.notStored
  } else if (target.closest(".me-export")) {
    state.exportText = JSON.stringify(roster)
  } else if (target.closest(".me-clear")) {
    if (!window.confirm(S.clearAsk)) return
    clearRoster()
    state.page = "setup"
    state.message = ""
    state.exportText = ""
  } else return
  render()
  window.scrollTo(0, 0)
}

async function boot() {
  try {
    stations = await fetchJson("data/stations.json")
  } catch {
    stations = {}
  }
  view.addEventListener("click", onClick)
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
    else if (event.target.matches(".me-edit")) submitEdit(event.target)
  })
  document.getElementById("foot").innerHTML =
    `v${BUILD.version} · ${BUILD.commit === "dev" ? "dev" : `commit ${escapeHtml(BUILD.commit)}`} · ` +
    `更份資料來自 <a href="https://github.com/iceninye/TML-traffic">TML-traffic</a>`
  loadBasic()
  open()
  dutyIndexPromise().then((index) => {
    if (index) document.getElementById("foot").insertAdjacentHTML("beforeend", ` · ${S.dutyData(index.sheets.map((s) => s.issued).sort().pop())}`)
  })
  setInterval(paintData, 1000)
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {})
}

boot()
