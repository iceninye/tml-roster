// TML Roster: your own duty roster over the Tuen Ma Line Duty Sheet cards.
// Hand-written, no build step. The roster is kept only in this browser's
// localStorage; nothing is uploaded. Duty cards come from data/duties/, copied
// from https://github.com/iceninye/TML-traffic (see tools/sync-duties.mjs).

import { dutyState, mealMates } from "../lib/tml-duties.js"
import { addDays, classify, cleanRoster, dayEntry, mondayOf, newRoster, normaliseCode, parseRoster, rowLabelFor, setOverride, weekDates, weekdayIndex } from "../lib/tml-roster.js"
import { serviceDate, serviceSeconds } from "../lib/tml-time.js"

const BUILD = { version: "0.1.0", commit: "336a40d" }
const ROSTER_KEY = "tml-roster"
// The key TML-traffic v0.9.0 used; a roster saved there is picked up once.
const LEGACY_KEY = "tml-traffic-roster"

const S = {
  weekdays: ["週一", "週二", "週三", "週四", "週五", "週六", "週日"],
  status: { RD: "休息日", AL: "年假", SH: "法定假日", HC: "待定" },
  spare: (code) => `後備更 ${code}`,
  spareNote: "後備更沒有上下班時間",
  noCard: "此更份暫時沒有上下班資料",
  noSheet: (id) => `找不到更份 ${id} 所屬的 Duty Sheet 資料`,
  noDuty: (id) => `Duty Sheet 冇更份 ${id} 嘅卡片資料`,
  loading: "讀取更份資料中…",
  failed: "讀取更份資料失敗，稍後再試",
  on: "上班",
  off: "下班",
  meal: "用膳",
  mates: "飯腳",
  matesNone: "冇（同車站重疊未夠 45 分鐘）",
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
    `來源：Duty Sheet ${code}（${cls}${dates ? `，只用於 ${dates}` : ""}）${tab ? `、工作表 ${tab}` : ""}${issued ? `、發佈 ${issued}` : ""}。${full ? "只收編號、上下班、用膳、各腿 Run 及時間，備註原文不收錄；接班時間準確到秒，離班時間為到站時間（按分鐘）。" : "此份只有更份編號。"}`,
  title: "我的更表",
  row: (n) => `第 ${n} 行`,
  prev: "‹ 上週",
  next: "下週 ›",
  thisWeek: "本週",
  today: "今日",
  changed: "已改",
  settings: "設定",
  back: "‹ 返回",
  editLabel: "改呢日嘅更份",
  editHint: "更份編號（例如 8022131）或 RD、AL、SH、HC、HSP1、KSP3",
  save: "儲存",
  reset: "還原預設",
  defaultIs: (code) => `預設：${code}`,
  badCode: "格式唔啱：請輸入 7 位更份編號或 RD、AL、SH、HC、HSP1、KSP3 之類代號",
  setupTitle: "設定我的更表",
  setupIntro: "貼上你嘅 roster（每行一星期，週一至週日 7 格，可以連行號；CSV、Tab 分隔都得）。更表只存喺呢部機嘅瀏覽器，唔會上傳，其他人睇唔到。",
  pasteLabel: "Roster 內容",
  pasteKeep: "留空就保留現有更表；貼上新內容會取代，但保留你手動改過嘅日子",
  rowLabel: (monday) => `本週（${monday} 起）係第幾行`,
  rowBad: (nums) => `呢個行號喺 roster 入面搵唔到（有 ${nums}）`,
  saved: "已儲存",
  notStored: "已讀入，但呢部機儲存唔到，關閉頁面後會冇咗",
  export: "匯出備份",
  exportNote: "複製下面內容存好；之後可以貼返入上面欄位還原。",
  clear: "清除我的更表",
  clearAsk: "清除之後要重新貼上 roster，確定？",
  noRoster: "未有 roster",
  badBackup: "備份內容讀唔到",
  dutyData: (issued) => `更份資料發佈於 ${issued}`,
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
  if (c.kind === "status") return { label: `${S.status[c.code]} ${c.code}`, status: "none" }
  if (c.kind === "spare") return { label: S.spare(c.code), status: "none", note: S.spareNote }
  if (c.kind === "other") return { label: c.code, status: "none" }
  const book = dutyBook(c.sheet)
  if (book.status === "loading") return { label: c.id, status: "loading", c }
  if (book.status !== "ok") return { label: c.id, status: "nosheet", c }
  const duty = book.data.duties.find((item) => item.id === c.id)
  if (!duty) return { label: c.id, status: "noduty", c }
  return { label: `${c.id} · ${duty.group}`, status: duty.on ? "ok" : "nocard", duty, c }
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
    `<dl class="kv"><dt>${S.on}</dt><dd>${hhmm(duty.on[0])} ${placeName(duty.on[1])}</dd>` +
    `<dt>${S.off}</dt><dd>${hhmm(duty.off[0])} ${placeName(duty.off[1])}</dd>` +
    (duty.work != null ? `<dt>${S.work}</dt><dd>${S.workMin(duty.work)}</dd>` : "") +
    (duty.meal ? `<dt>${S.meal}</dt><dd>${hhmm(duty.meal[0])}–${hhmm(duty.meal[1])} ${mealPlace(duty.meal)}</dd>` +
      `<dt>${S.mates}</dt><dd>${mealMatesHtml(duty, book.data.duties, sheet)}</dd>` : "") +
    `</dl>${nowBox}<div class="stops-head">${S.legs}</div><ol class="duty-legs">` +
    rows.map((row) => `<li data-now="${row.now ? 1 : 0}">${row.html}</li>`).join("") + `</ol><p class="fine">${source}</p>`
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
      `<form class="me-edit" autocomplete="off"><label>${S.editLabel}` +
      `<input name="code" value="${escapeHtml(entry.code)}" maxlength="10" autocapitalize="characters" spellcheck="false" aria-label="${S.editHint}" placeholder="${S.editHint}"></label>` +
      `<div class="me-edit-row"><button type="submit" class="btn">${S.save}</button>` +
      `${entry.source === "override" ? `<button type="button" class="btn me-reset">${S.reset}</button>` : ""}` +
      `<span class="meta">${S.defaultIs(entry.defaultCode)}</span></div>` +
      `<p class="me-msg" role="status">${escapeHtml(state.message)}</p></form><div id="me-data"></div>`
    paintData()
    return
  }
  const dates = weekDates(state.monday)
  const current = mondayOf(serviceDate(Date.now()))
  view.innerHTML =
    `<div class="me-nav"><button type="button" class="btn me-prev">${S.prev}</button>` +
    `<button type="button" class="btn me-this" ${state.monday === current ? "disabled" : ""}>${S.thisWeek}</button>` +
    `<button type="button" class="btn me-next">${S.next}</button></div>` +
    `<div class="duty-sum"><b>${meDate(dates[0])} – ${meDate(dates[6])}</b> <span class="meta">${S.row(rowLabelFor(roster, state.monday))}</span></div>` +
    `<div id="me-data"></div><div class="me-foot"><button type="button" class="btn me-settings">${S.settings}</button></div>`
  paintData()
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
    else if (cell.status === "loading") html = `<p class="empty">${S.loading}</p>`
    else if (cell.status === "nosheet") html = `<p class="empty">${S.noSheet(cell.c.id)}</p>`
    else html = dutyDetailHtml({ sheet: cell.c.sheet, id: cell.c.id }, state.date === serviceDate(Date.now()))
  } else if (state.page === "week") {
    const today = serviceDate(Date.now())
    html = `<ul class="duty-list">${weekDates(state.monday).map((date) => {
      const entry = dayEntry(roster, date)
      const cell = cellInfo(entry.code)
      const badges = (date === today ? ` <span class="badge now">${S.today}</span>` : "") +
        (entry.source === "override" ? ` <span class="badge plain">${S.changed}</span>` : "")
      return `<li><button type="button" class="duty-row me-day" data-date="${date}">` +
        `<span class="duty-no">${S.weekdays[weekdayIndex(date)]} ${meDate(date)}${badges}</span>` +
        `<span class="me-code">${escapeHtml(cell.label)}</span>` +
        `<span class="meta">${escapeHtml(summary(cell))}</span></button></li>`
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
  return `<div class="duty-head"><h2>${S.setupTitle}</h2></div>` +
    `<form class="me-setup" autocomplete="off"><p class="fine">${S.setupIntro}</p>` +
    `<label>${S.pasteLabel}<textarea name="text" rows="6" spellcheck="false" placeholder="${roster ? S.pasteKeep : ""}"></textarea></label>` +
    `<label>${S.rowLabel(monday)}<input name="row" type="number" inputmode="numeric" min="1" value="${row}" required></label>` +
    `<div class="me-edit-row"><button type="submit" class="btn">${S.save}</button>` +
    `${roster ? `<button type="button" class="btn me-back">${S.back}</button>` : ""}</div>` +
    `<p class="me-msg" role="status">${escapeHtml(state.message)}</p></form>` +
    (roster
      ? `<div class="me-foot"><button type="button" class="btn me-export">${S.export}</button> ` +
        `<button type="button" class="btn me-clear">${S.clear}</button></div>` +
        (state.exportText ? `<p class="fine">${S.exportNote}</p><textarea class="me-export-box" readonly rows="5">${escapeHtml(state.exportText)}</textarea>` : "")
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
  view.addEventListener("submit", (event) => {
    event.preventDefault()
    if (event.target.matches(".me-setup")) submitSetup(event.target)
    else if (event.target.matches(".me-edit")) submitEdit(event.target)
  })
  document.getElementById("foot").innerHTML =
    `v${BUILD.version} · ${BUILD.commit === "dev" ? "dev" : `commit ${escapeHtml(BUILD.commit)}`} · ` +
    `更份資料來自 <a href="https://github.com/iceninye/TML-traffic">TML-traffic</a>`
  open()
  dutyIndexPromise().then((index) => {
    if (index) document.getElementById("foot").insertAdjacentHTML("beforeend", ` · ${S.dutyData(index.sheets.map((s) => s.issued).sort().pop())}`)
  })
  setInterval(paintData, 1000)
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {})
}

boot()
