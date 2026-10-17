// 編更: arrange a team's duties over the Standard Roster by preference.
// Hand-written, no build step. The Standard Roster is the one saved on the
// 我的更表 page of this browser; the plan (names, preferences, results) is kept
// only in this browser's localStorage and never uploaded. Book-on/off times
// come from data/duty-basic.json.

import { SHIFTS, arrangeWeek, cleanPlan, clearWeek, isoWeek, mondayOfIsoWeek, newPlan, parseRanges, prefDistance, restIssues, setCell, shiftOf, swapCells, weekView } from "../lib/tml-plan.js"
import { addDays, classify, cleanRoster, mondayOf, normaliseCode, weekDates } from "../lib/tml-roster.js"
import { serviceDate } from "../lib/tml-time.js"

const BUILD = { version: "0.6.0", commit: "dev" }
const ROSTER_KEY = "tml-roster"
const PLAN_KEY = "tml-roster-plan"

const S = {
  weekdays: ["一", "二", "三", "四", "五", "六", "日"],
  shift: { dawn: "死早", early: "早", mid: "中", late: "夜", night: "死夜" },
  shiftHelp: { dawn: "06:30 前上班", early: "10:00 前上班", mid: "10:00–15:00 上班", late: "15:00 後上班", night: "00:30 後下班" },
  status: { RD: "休息", AL: "年假", SH: "法定假", HC: "待定" },
  noRoster: "未有 Standard Roster。請先喺「我的更表」貼上成份 Standard Roster（例如 136 行），再返嚟呢頁。",
  toRoster: "去我的更表",
  setupTitle: "設定組員",
  setupIntro: "揀一個基準星期，填嗰個星期組員做緊嘅行號。之後每個星期，每位組員自動跳去下一行。",
  weekLabel: "基準星期（ISO 週數）",
  yearLabel: "年份",
  rangesLabel: "組員行號（基準星期）",
  rangesHelp: "例如 31-40, 55-70。用逗號分隔，可以有多段。",
  restLabel: "兩更之間最少休息（小時）",
  restHelp: "唔夠鐘會標紅。Standard Roster 本身都有少數唔夠鐘嘅地方，所以只係提示。",
  save: "儲存",
  week: (w) => `Week ${w}`,
  weekOf: (a, b) => `${a} – ${b}`,
  team: (n) => `${n} 位組員`,
  prev: "上週",
  next: "下週",
  backThis: "回到本週",
  thisWeek: "本週",
  arrange: "按偏好自動編排",
  arrangeMore: "編多週",
  weeksBox: ["由本週起連續", "週"],
  arrangeHelp: "自動編排只會喺同一日、組員嗰幾行嘅更份之間對調；休息日、假期唔郁；手動改過（📌）嘅格會保留。",
  reset: "還原本週做 Standard",
  resetAsk: "本週所有編排同手動改動會還原做 Standard Roster，確定？",
  csv: "匯出本週 CSV",
  member: "組員",
  rowNow: (r) => `第 ${r} 行`,
  fit: "配中",
  fitLine: (hit, all, std, short) => `全組配中偏好 ${hit}/${all} 更（Standard 係 ${std}/${all}）${short ? ` · ${short} 格休息唔夠鐘` : ""}`,
  hours: "工時",
  pinned: "手動改",
  tooShort: (h) => `休息只有 ${h} 小時`,
  selected: (who, day, code) => `${who} · 週${day}：${code}`,
  selHelp: "再撳同一日另一格就對調；電腦可以直接拖放。",
  editLabel: "改做",
  editSave: "改",
  editReset: "還原 Standard",
  cancel: "取消",
  badCode: "格式唔啱：請輸入 7 位更份編號，或者 RD、AL、SH、HC、HSP1 呢類代號",
  sameDay: "只可以同一日嘅格對調",
  swapped: "已對調",
  arranged: (n, miss) => `已編排 ${n} 週${miss ? `；有 ${miss} 個更份冇人接，請手動處理` : ""}`,
  membersTitle: "組員同偏好",
  membersHelp: "填名同揀想做嘅更（可以揀多個；唔揀即係冇所謂）。行號係基準星期嗰行。",
  namePh: "名",
  settingsTitle: "設定／備份",
  backupHelp: "編更資料只存喺呢部機。換機或者交俾其他人之前，先匯出。",
  exportJson: "匯出備份",
  importJson: "匯入備份",
  importPh: "貼上備份內容",
  importBad: "備份內容讀唔到",
  imported: "已匯入",
  clear: "清除編更資料",
  clearAsk: "清除之後組員、偏好同所有編排都會冇咗，確定？",
  saved: "已儲存",
  notStored: "呢部機儲存唔到，關閉頁面後會冇咗",
  legendRest: "紅框：休息唔夠鐘",
  legendPin: "📌 手動改",
  legendMiss: "• 唔係偏好",
  back: "‹ 我的更表",
}

const view = document.getElementById("view")
const state = { monday: null, sel: null, message: "", exportText: "", weeks: 4 }

let roster = null
let plan = null
let basic = {}

/* ------------------------------------------------------------- storage */

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null")
  } catch {
    return null
  }
}

function savePlan(next) {
  plan = next
  const json = JSON.stringify(next)
  try {
    localStorage.setItem(PLAN_KEY, json)
    return localStorage.getItem(PLAN_KEY) === json
  } catch {
    return false
  }
}

/* ------------------------------------------------------------- helpers */

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
}

const two = (n) => String(n).padStart(2, "0")
const hhmm = (sec) => {
  const t = ((Math.round(sec) % 86400) + 86400) % 86400
  return `${two(Math.floor(t / 3600))}:${two(Math.floor((t % 3600) / 60))}`
}
const meDate = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`

// Book-on/off of a code from data/duty-basic.json, or null (RD, AL, unknown duty).
function timeOf(code) {
  const row = code ? basic[String(code).toUpperCase()] : null
  return row ? { on: row[0], off: row[2], hours: row[4] } : null
}

const who = (member) => member.name || `#${member.row}`

/* --------------------------------------------------------------- pages */

function render() {
  if (!roster) {
    view.innerHTML = `<p class="empty">${S.noRoster}</p><div class="me-foot"><a class="btn" href="./">${S.toRoster}</a></div>`
    return
  }
  view.innerHTML = plan ? weekHtml() + membersHtml() + settingsHtml() : setupHtml()
}

function setupHtml(inPanel = false) {
  const anchor = plan?.anchor ?? state.monday
  const { year, week } = isoWeek(anchor)
  const body =
    `<form class="me-setup plan-setup" autocomplete="off">` +
    `<div class="plan-grid"><label>${S.yearLabel}<input name="year" type="number" inputmode="numeric" value="${year}" required></label>` +
    `<label>${S.weekLabel}<input name="week" type="number" inputmode="numeric" min="1" max="53" value="${week}" required></label></div>` +
    `<label>${S.rangesLabel}<input name="ranges" value="${escapeHtml(plan?.ranges ?? "31-40, 55-70")}" spellcheck="false" required></label>` +
    `<p class="fine">${S.rangesHelp}</p>` +
    `<label>${S.restLabel}<input name="rest" type="number" inputmode="decimal" min="0" max="24" step="0.5" value="${plan?.rest ?? 11}"></label>` +
    `<p class="fine">${S.restHelp}</p>` +
    `<div class="me-edit-row"><button type="submit" class="btn primary">${S.save}</button></div>` +
    (inPanel ? "" : `<p class="me-msg" role="status">${escapeHtml(state.message)}</p>`) + `</form>`
  if (inPanel) return body
  return `<section class="panel"><h3>${S.setupTitle}</h3><p class="fine">${S.setupIntro}</p>${body}</section>`
}

function weekHtml() {
  const dates = weekDates(state.monday)
  const current = mondayOf(serviceDate(Date.now()))
  const lines = weekView(roster, plan, state.monday)
  const issues = new Map(restIssues(roster, plan, state.monday, timeOf).map((x) => [`${x.row}:${x.day}`, x.rest]))
  const { week } = isoWeek(state.monday)
  const head = `<tr><th class="who">${S.member}</th>${dates.map((d, i) => `<th>${S.weekdays[i]}<small>${meDate(d)}</small></th>`).join("")}<th>${S.fit}</th><th>${S.hours}</th></tr>`
  const body = lines.map((line) => {
    let hits = 0
    let work = 0
    let hours = 0
    const cells = line.codes.map((code, d) => {
      const t = timeOf(code)
      const shift = t ? shiftOf(t.on, t.off) : ""
      const miss = t && prefDistance(line.member.prefs, shift) > 0
      if (t) {
        work += 1
        hours += t.hours || 0
        if (!miss) hits += 1
      }
      const c = classify(code)
      const short = issues.get(`${line.member.row}:${d}`)
      const sel = state.sel && state.sel.row === line.member.row && state.sel.day === d
      const label = c.kind === "status" ? S.status[c.code] ?? c.code : code
      return `<td><button type="button" class="pcell" draggable="true" data-row="${line.member.row}" data-day="${d}"` +
        ` data-shift="${shift}" data-kind="${t ? "duty" : c.kind}"${sel ? ' data-sel="1"' : ""}${short != null ? ` data-short="1" title="${S.tooShort((short / 3600).toFixed(1))}"` : ""}>` +
        `<b>${escapeHtml(label)}${line.pins[d] ? `<i class="pin" title="${S.pinned}">📌</i>` : ""}${miss ? `<i class="miss" aria-label="唔係偏好">•</i>` : ""}</b>` +
        (t ? `<small>${hhmm(t.on)}–${hhmm(t.off)}</small><span class="ptag">${S.shift[shift]}</span>` : "") +
        `</button></td>`
    }).join("")
    const prefs = line.member.prefs.map((p) => `<span class="ptag" data-shift="${p}">${S.shift[p]}</span>`).join("")
    return `<tr><th class="who"><b>${escapeHtml(who(line.member))}</b><small>${S.rowNow(line.row)}</small><span class="prefs">${prefs}</span></th>${cells}` +
      `<td class="sum">${work ? `${hits}/${work}` : "—"}</td><td class="sum">${hours ? hours.toFixed(1) : "—"}</td></tr>`
  }).join("")
  // How many duty days match a preference, now and in the Standard Roster.
  const fitOf = (pick) => lines.reduce((acc, line) => {
    for (const code of pick(line)) {
      const t = timeOf(code)
      if (!t) continue
      acc.all += 1
      if (!prefDistance(line.member.prefs, shiftOf(t.on, t.off))) acc.hit += 1
    }
    return acc
  }, { hit: 0, all: 0 })
  const fitNow = fitOf((line) => line.codes)
  const fitStd = fitOf((line) => line.std)
  const legend = SHIFTS.map((s) => `<span><i data-shift="${s}"></i>${S.shift[s]}（${S.shiftHelp[s]}）</span>`).join("")
  return `<div class="me-nav"><button type="button" class="btn p-prev" aria-label="${S.prev}">‹</button>` +
    `<div class="weeklabel"><b>${S.week(week)} · ${S.weekOf(meDate(dates[0]), meDate(dates[6]))}</b>` +
    `<span>${S.team(lines.length)}${state.monday === current ? ` · ${S.thisWeek}` : ` · <button type="button" class="link p-this">${S.backThis}</button>`}</span></div>` +
    `<button type="button" class="btn p-next" aria-label="${S.next}">›</button></div>` +
    `<div class="plan-actions"><button type="button" class="btn primary p-arrange">${S.arrange}</button>` +
    `<span class="p-weekbox"><label class="meta">${S.weeksBox[0]} <input type="number" class="p-weeks" min="1" max="26" value="${state.weeks}"> ${S.weeksBox[1]}</label>` +
    `<button type="button" class="btn p-arrange-more">${S.arrangeMore}</button></span>` +
    `<button type="button" class="btn p-csv">${S.csv}</button><button type="button" class="btn danger p-reset">${S.reset}</button></div>` +
    `<p class="me-msg" role="status">${escapeHtml(state.message)}</p>` +
    `<p class="fine plan-fit">${S.fitLine(fitNow.hit, fitNow.all, fitStd.hit, issues.size)}</p>` +
    selHtml(lines) +
    `<div class="ptable"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>` +
    `<p class="legend plan-legend">${legend}<span>${S.legendRest}</span><span>${S.legendPin}</span><span>${S.legendMiss}</span></p>` +
    `<p class="fine">${S.arrangeHelp}</p>` +
    (state.exportText ? `<textarea class="me-export-box" readonly rows="6">${escapeHtml(state.exportText)}</textarea>` : "")
}

// The bar for the selected cell: change it, put it back, or tap another to swap.
function selHtml(lines) {
  if (!state.sel) return ""
  const line = lines.find((item) => item.member.row === state.sel.row)
  if (!line) return ""
  const d = state.sel.day
  return `<form class="plan-sel panel" autocomplete="off"><div><b>${escapeHtml(S.selected(who(line.member), S.weekdays[d], line.codes[d]))}</b>` +
    `<span class="meta">Standard：${escapeHtml(line.std[d])} · ${S.selHelp}</span></div>` +
    `<div class="me-edit-row"><label class="meta">${S.editLabel} <input name="code" value="${escapeHtml(line.codes[d])}" maxlength="10" autocapitalize="characters" spellcheck="false"></label>` +
    `<button type="submit" class="btn primary">${S.editSave}</button>` +
    (line.pins[d] ? `<button type="button" class="btn p-cell-reset">${S.editReset}</button>` : "") +
    `<button type="button" class="btn p-cancel">${S.cancel}</button></div></form>`
}

function membersHtml() {
  const rows = plan.members.map((m) =>
    `<li><span class="mrow">#${m.row}</span><input class="p-name" data-row="${m.row}" value="${escapeHtml(m.name)}" placeholder="${S.namePh}" maxlength="40">` +
    `<span class="pchips">${SHIFTS.map((s) => `<button type="button" class="pchip" data-row="${m.row}" data-shift="${s}" aria-pressed="${m.prefs.includes(s)}">${S.shift[s]}</button>`).join("")}</span></li>`).join("")
  return `<details class="panel plan-members"${plan.members.some((m) => m.prefs.length) ? "" : " open"}><summary>${S.membersTitle}（${plan.members.length}）</summary>` +
    `<p class="fine">${S.membersHelp}</p><ul class="mlist">${rows}</ul></details>`
}

function settingsHtml() {
  return `<details class="panel"><summary>${S.settingsTitle}</summary>${setupHtml(true)}` +
    `<p class="fine">${S.backupHelp}</p><div class="me-foot"><button type="button" class="btn p-export">${S.exportJson}</button>` +
    `<button type="button" class="btn danger p-clear">${S.clear}</button></div>` +
    `<form class="me-setup p-import" autocomplete="off"><label>${S.importJson}<textarea name="text" rows="3" spellcheck="false" placeholder="${S.importPh}"></textarea></label>` +
    `<div class="me-edit-row"><button type="submit" class="btn">${S.importJson}</button></div></form></details>`
}

/* ------------------------------------------------------------- actions */

function store(next, message = S.saved) {
  state.message = savePlan(next) ? message : S.notStored
}

function submitSetup(form) {
  const year = Number(form.elements.year.value)
  const week = Number(form.elements.week.value)
  const ranges = form.elements.ranges.value.trim()
  const parsed = parseRanges(ranges)
  if (parsed.issues.length || !parsed.rows.length) {
    state.message = parsed.issues.join("；") || S.rangesHelp
    return render()
  }
  const missing = parsed.rows.filter((r) => !roster.numbers.includes(r))
  if (missing.length) {
    state.message = `Standard Roster 冇呢啲行：${missing.join(", ")}`
    return render()
  }
  const next = newPlan(mondayOfIsoWeek(year, week), ranges, plan)
  const rest = Number(form.elements.rest.value)
  if (rest >= 0 && rest <= 24) next.rest = rest
  store(next)
  state.monday = next.anchor === plan?.anchor ? state.monday : next.anchor
  render()
}

function arrange(weeks) {
  let next = plan
  let miss = 0
  for (let i = 0; i < weeks; i += 1) {
    const result = arrangeWeek(roster, next, addDays(state.monday, 7 * i), timeOf)
    next = result.plan
    miss += result.unassigned.length
  }
  state.sel = null
  store(next, S.arranged(weeks, miss))
  render()
}

function swap(a, b) {
  if (a.day !== b.day) {
    state.message = S.sameDay
    return render()
  }
  state.sel = null
  store(swapCells(roster, plan, state.monday, a.row, b.row, a.day), S.swapped)
  render()
}

function weekCsv() {
  const dates = weekDates(state.monday)
  const lines = weekView(roster, plan, state.monday)
  const out = [["行", "組員", ...dates.map((d, i) => `${S.weekdays[i]} ${d}`)].join(",")]
  for (const line of lines) out.push([line.row, `"${who(line.member).replace(/"/g, '""')}"`, ...line.codes].join(","))
  return out.join("\n")
}

function onClick(event) {
  const t = event.target
  const cell = t.closest(".pcell")
  if (cell) {
    const here = { row: Number(cell.dataset.row), day: Number(cell.dataset.day) }
    if (state.sel && state.sel.row === here.row && state.sel.day === here.day) state.sel = null
    else if (state.sel && state.sel.day === here.day) return swap(state.sel, here)
    else state.sel = here
    state.message = ""
    return render()
  }
  const chip = t.closest(".pchip")
  if (chip) {
    const row = Number(chip.dataset.row)
    const members = plan.members.map((m) => {
      if (m.row !== row) return m
      const prefs = m.prefs.includes(chip.dataset.shift) ? m.prefs.filter((p) => p !== chip.dataset.shift) : [...m.prefs, chip.dataset.shift]
      return { ...m, prefs: SHIFTS.filter((s) => prefs.includes(s)) }
    })
    store({ ...plan, members })
    render()
    view.querySelector(".plan-members")?.setAttribute("open", "")
    return
  }
  if (t.closest(".p-prev")) state.monday = addDays(state.monday, -7)
  else if (t.closest(".p-next")) state.monday = addDays(state.monday, 7)
  else if (t.closest(".p-this")) state.monday = mondayOf(serviceDate(Date.now()))
  else if (t.closest(".p-arrange")) return arrange(1)
  else if (t.closest(".p-arrange-more")) return arrange(state.weeks)
  else if (t.closest(".p-cancel")) state.sel = null
  else if (t.closest(".p-cell-reset")) {
    store(setCell(roster, plan, state.monday, state.sel.row, state.sel.day, null))
    state.sel = null
  } else if (t.closest(".p-reset")) {
    if (!window.confirm(S.resetAsk)) return
    store(clearWeek(plan, state.monday))
  } else if (t.closest(".p-csv")) state.exportText = weekCsv()
  else if (t.closest(".p-export")) {
    state.exportText = JSON.stringify(plan)
  } else if (t.closest(".p-clear")) {
    if (!window.confirm(S.clearAsk)) return
    try {
      localStorage.removeItem(PLAN_KEY)
    } catch {
      // Storage blocked: nothing was stored.
    }
    plan = null
  } else return
  if (!t.closest(".p-csv, .p-export")) state.exportText = ""
  if (t.closest(".p-prev, .p-next, .p-this")) {
    state.sel = null
    state.message = ""
  }
  render()
}

function onSubmit(event) {
  event.preventDefault()
  const form = event.target
  if (form.matches(".plan-setup")) return submitSetup(form)
  if (form.matches(".plan-sel")) {
    const code = normaliseCode(form.elements.code.value)
    if (!code) {
      state.message = S.badCode
      return render()
    }
    store(setCell(roster, plan, state.monday, state.sel.row, state.sel.day, code))
    state.sel = null
    return render()
  }
  if (form.matches(".p-import")) {
    let next = null
    try {
      next = cleanPlan(JSON.parse(form.elements.text.value))
    } catch {
      next = null
    }
    if (!next) state.message = S.importBad
    else {
      store(next, S.imported)
      state.monday = mondayOf(serviceDate(Date.now()))
    }
    render()
  }
}

// Drag a cell onto another cell of the same day to swap them (mouse / pen).
let dragFrom = null
function onDrag(event) {
  const cell = event.target.closest?.(".pcell")
  if (event.type === "dragstart") {
    if (!cell) return
    dragFrom = { row: Number(cell.dataset.row), day: Number(cell.dataset.day) }
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", `${dragFrom.row}:${dragFrom.day}`)
    view.classList.add("dragging")
    view.querySelectorAll(`.pcell[data-day="${dragFrom.day}"]`).forEach((el) => el.setAttribute("data-target", "1"))
  } else if (event.type === "dragover") {
    if (cell && dragFrom && Number(cell.dataset.day) === dragFrom.day) event.preventDefault()
  } else if (event.type === "drop") {
    event.preventDefault()
    if (cell && dragFrom) swap(dragFrom, { row: Number(cell.dataset.row), day: Number(cell.dataset.day) })
    dragFrom = null
  } else if (event.type === "dragend") {
    dragFrom = null
    view.classList.remove("dragging")
    view.querySelectorAll(".pcell[data-target]").forEach((el) => el.removeAttribute("data-target"))
  }
}

async function boot() {
  roster = cleanRoster(read(ROSTER_KEY))
  plan = cleanPlan(read(PLAN_KEY))
  state.monday = mondayOf(serviceDate(Date.now()))
  try {
    const response = await fetch("data/duty-basic.json")
    basic = (await response.json()).duties ?? {}
  } catch {
    basic = {}
  }
  view.addEventListener("click", onClick)
  view.addEventListener("submit", onSubmit)
  view.addEventListener("change", (event) => {
    if (event.target.matches(".p-name")) {
      const row = Number(event.target.dataset.row)
      store({ ...plan, members: plan.members.map((m) => (m.row === row ? { ...m, name: event.target.value.trim().slice(0, 40) } : m)) })
      render()
      view.querySelector(".plan-members")?.setAttribute("open", "")
    } else if (event.target.matches(".p-weeks")) {
      state.weeks = Math.min(26, Math.max(1, Number(event.target.value) || 1))
      render()
    }
  })
  for (const type of ["dragstart", "dragover", "drop", "dragend"]) view.addEventListener(type, onDrag)
  document.getElementById("foot").innerHTML =
    `<a href="./">${S.back}</a> · v${BUILD.version} · ${BUILD.commit === "dev" ? "dev" : `commit ${escapeHtml(BUILD.commit)}`} · 編更資料只存喺呢部機`
  render()
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {})
}

boot()
