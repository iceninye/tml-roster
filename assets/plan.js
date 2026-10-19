// 編更: arrange a team's duties over the Standard Roster by preference.
// Hand-written, no build step. This page is separate from the personal
// roster page: it imports its own Standard Roster (CSV) and keeps it, and the
// plan (names, preferences, results), only in this browser's localStorage,
// never uploaded. Book-on/off times come from data/duty-basic.json.

import { EMPTY, EXTRA, EXTRA_HOURS, LEAVE, PENDING, SHIFTS, allToTray, canRemove, cleanPlan, clearWeek, combosView, fillMember, fillTeam, formatRanges, fromTray, importWeek, isoWeek, mondayOfIsoWeek, namedRows, newPlan, parseRanges, prefDistance, removeBlock, renameBlock, restIssues, setCell, setSheet, sheetOf, shiftOf, swapCells, toTray, trayView, useCombo, weekView } from "../lib/tml-plan.js"
import { addDays, classify, cleanRoster, mondayOf, newRoster, normaliseCode, parseRoster, weekDates } from "../lib/tml-roster.js"
import { serviceDate } from "../lib/tml-time.js"

const BUILD = { version: "0.9.12", commit: "dev" }
// The plan page keeps its own Standard Roster, apart from the personal roster of the 我的更表 page ("tml-roster").
const ROSTER_KEY = "tml-plan-roster"
const PLAN_KEY = "tml-roster-plan"

const S = {
  weekdays: ["一", "二", "三", "四", "五", "六", "日"],
  shift: { dawn: "死早", early: "早", mid: "中", late: "夜", night: "死夜" },
  shiftHelp: { dawn: "06:30 前上班", early: "10:00 前上班", mid: "10:00–15:00 上班", late: "15:00 後上班", night: "00:30 後下班" },
  status: { RD: "休息", AL: "年假", SH: "法定假", HC: "HC" },
  noRoster: "未有 Standard Roster。請匯入下星期嘅 CSV（有 Name 欄嗰份）。",
  csvBtn: "揀 CSV 檔匯入",
  csvTitle: "匯入下星期 Standard Roster",
  csvFor: (week) => `匯入後用於 ${week}`,
  csvHelp: "格式：標題行 `,Name,Mon,Tue,Wed,Thu,Fri,Sat,Sun`，之後每行係 行號、名稱、七日更份。有名稱嘅行就係組員，組員嘅喜好按名稱記住；一行七格 TBC 嘅唔跟輪換。",
  csvEmpty: "讀唔到任何一行，請確認係 CSV",
  csvDone: (rows, named, week, kept) => `已匯入 ${rows} 行${named ? `：${named} 位組員，用於 ${week}${kept ? `，${kept} 位沿用之前嘅喜好` : ""}；所有積木已放入待定區，設好假期同喜好後按「自動」` : ""}`,
  importWeek: "週數",
  importPast: (week) => `唔可以匯入 ${week}：呢個係本週或者之前嘅星期，會覆蓋本週嘅編更。請揀下星期。`,
  importNotNext: (week, next) => `你揀咗 ${week}，唔係下星期 ${next}。確定用呢個星期？`,
  importOver: (weeks) => `${weeks} 已經有手動編排，匯入後會重新開始。確定？`,
  importedWeek: (week) => `而家嘅 Standard Roster：${week}`,
  templateBtn: "下載匯入範本",
  templateHelp: "範本有 141 行、7 格，RD 只係示範，請換成實際更份。Name 欄填咗名嘅行就係組員。",
  csvFail: "讀取檔案失敗",
  useNamed: "用有名稱嘅行",
  namedHint: (n) => `Standard Roster 有 ${n} 行有名稱。`,
  setupTitle: "設定組員",
  setupAdvanced: "進階：手動設定組員行號",
  setupIntro: "一般唔使用：匯入 CSV 時有名稱嘅行已經係組員。只有想改組員行號先用呢度。每過一個星期，組員自動跳去下一行。",
  weekLabel: "基準星期（ISO 週數）",
  weekSpanLabel: (week, span) => `第 ${week} 週：${span}`,
  yearLabel: "年份",
  rangesLabel: "組員行號（基準星期）",
  rangesHelp: "例如 31-40, 55-70。用逗號分隔，可以有多段。",
  save: "儲存",
  week: (y, w) => `${y} 年第 ${w} 週`,
  weekOf: (a, b) => `${a} – ${b}`,
  team: (n) => `${n} 位組員`,
  prev: "上週",
  next: "下週",
  backNext: "回到下週",
  thisWeek: "本週",
  nextWeek: "下週",
  arrange: "自動",
  arrangeHelp: "「自動」用待定區嘅更份填組員嘅空格，按喜好同最少 12 小時休息分配；未有 RD 嘅組員唔會編；手動改過（📌）嘅格保留。剔選組員就只編嗰幾位。",
  stepsTitle: "使用步驟",
  steps: [
    "每個星期匯入下星期嘅 Standard Roster CSV：組員自動下移一行，喜好跟名稱保留，本週唔會被改。",
    "喺每位組員嘅格仔放 RD、AL、SH（撳空格揀，或者由待定區拖入去）。週一至三放 AL 就成星期年假。",
    "撳組員名下面嘅 死早／早／中／夜／死夜 設喜好。",
    "撳「自動」：按喜好同 12 小時休息填其餘空格。",
    "睇「注意事項」逐項跟進，最後「匯出本週 CSV」。",
  ],
  undo: "還原",
  undone: "已還原",
  noUndo: "冇可以還原嘅步驟",
  reset: "本週重新開始",
  resetAsk: "本週所有格會清空，全部積木放返待定區，確定？",
  resetDone: "本週已重新開始，所有積木喺待定區",
  csv: "匯出本週 CSV",
  member: "組員",
  rowNow: (r) => `第 ${r} 行`,
  fit: "配中",
  fitLine: (hit, all, std, stdAll, short) => `全組配中喜好 ${hit}/${all} 更（Standard 係 ${std}/${stdAll}）${short ? ` · ${short} 格休息唔夠鐘` : ""}`,
  hours: "工時",
  pinned: "手動改",
  tooShort: (h) => `休息只有 ${h} 小時`,
  selected: (who, day, code) => `${who} · 週${day}：${code}`,
  selHelp: "再撳同一日另一格就對調；電腦直接拖放，手機長按後拖。",
  editLabel: "更份編號",
  editSave: "改",
  cancel: "取消",
  badCode: "格式唔啱：請輸入 7 位更份編號，或者 RD、AL、SH、HC、HSP1 呢類代號",
  quickLeave: "加假期/其他",
  quickOther: "其他",
  leaveNoBlock: (day, code) => `待定區已經冇「${code}（${day}）」積木，冇得放。`,
  leaveAlertTitle: "冇積木",
  sameDay: "只可以同一日嘅格對調",
  swapped: "已對調",
  arranged: (skipped) => `已自動編排${skipped.length ? `；${skipped.length} 位未有 RD 冇編：${skipped.slice(0, 5).join("、")}${skipped.length > 5 ? " 等" : ""}` : ""}`,
  tray: "待定區",
  trayHelp: "將積木拖去同一日嘅格仔，或者將格仔拖返入嚟。HC／TBC 要先撳入去填更份編號。",
  trayNone: "—",
  empty: "空",
  toTray: "放入待定區",
  blockSel: (day, code) => `待定 ${code} · 週${day}`,
  tabBlocks: "單日積木",
  tabOther: "其他",
  otherHelp: "其他積木唔使由待定區扣：撳一粒，再撳任何一日嘅格仔放入去。自定：輸入代號或者更份編號。",
  otherSel: (code) => `其他：${code}`,
  otherPick: "撳任何一格放入去",
  customLabel: "自定",
  customUse: "用呢個",
  offDay: "休息日",
  pickDuty: "揀當日更份",
  pickNone: "當日冇未用嘅更份",
  autoOn: "自動填入：開",
  autoOff: "自動填入：關",
  autoTurned: (on) => (on ? "已開自動填入：改組員喜好或者假期，會即刻編嗰行" : "已關自動填入：改動唔會自動填格，要編就撳「自動」"),
  arrangeScope: (rows) => `自動（${rows} 位）`,
  pickRow: "剔選：自動只編呢位",
  orderBy: { row: "行數", name: "姓名" },
  orderLabel: "排序",
  pickClear: "清除揀選",
  clearCell: "清空",
  notes: (n) => `注意事項（${n}）`,
  notesNone: "冇嘢要跟進",
  noteShort: (who, day, h) => `${who} · 週${day}：休息只有 ${h} 小時`,
  noteNoRd: (names, n) => `${n} 位本週未有 RD：${names}`,
  noteEmpty: (who, days) => `${who}：週${days} 仲係空`,
  noteMissing: (who, day, code) => `${who} · 週${day}：Duty Sheet 冇 ${code}`,
  notePending: (day, n) => `週${day}：待定區仲有 ${n} 粒 HC／TBC 未填編號`,
  noteLeft: (day, n) => `週${day}：待定區仲有 ${n} 個更份未分配`,
  csvSaved: (name) => `已下載 ${name}`,
  tabCombos: (n) => `組合（${n}）`,
  comboHelp: "組合係 Standard Roster 一整行：撳一個組合，再撳一位組員嘅任何一格，成行放入去（手動設定咗嘅日子唔郁）。用咗其中一粒積木，組合就會拆散。",
  comboSel: (row) => `組合：Standard 第 ${row} 行`,
  comboPick: "撳一位組員嘅任何一格，放入成行",
  comboUsed: "已放入組合",
  comboGone: "呢個組合已經拆散咗",
  comboNone: "冇完整嘅組合（積木已經用咗或者被篩走）",
  filter: "篩選",
  filterAll: "全部",
  filterLeave: "假期",
  filterHc: "HC／TBC",
  sort: "排序",
  sortBy: { on: "上班時間", off: "下班時間", code: "更份編號" },
  blockHelp: "撳同一日一格放入去（該格原有更份會返去待定區）。",
  pendingHelp: "輸入 7 位更份編號，填好先可以放入格仔。",
  pendingNeed: "HC／TBC 要先輸入更份編號，先可以放入格仔",
  hcCell: "格仔唔可以放 HC／TBC：請輸入更份編號，或者喺待定區填好編號再放入",
  dutyCode: "更份編號",
  renamed: "已填好編號",
  badDuty: "請輸入 7 位更份編號",
  trayed: "已放入待定區",
  placed: "已放入",
  noMove: "呢樣唔可以咁調（休息日、假期唔郁；HC 可以放入更份）",
  settingsTitle: "設定／備份",
  backupHelp: "編更資料只存喺呢部機。換機或者交俾其他人之前，先匯出。",
  exportJson: "下載備份（JSON）",
  exported: (name) => `已下載備份：${name}`,
  importJson: "匯入備份",
  importPh: "貼上備份內容",
  importBad: "備份內容讀唔到",
  imported: "已匯入",
  importedNoRoster: "已匯入編更；呢個舊備份冇 Standard Roster，請再由 CSV 匯入一次",
  clear: "清除編更資料",
  clearAsk: "清除之後組員、偏好同所有編排都會冇咗，確定？",
  saved: "已儲存",
  notStored: "呢部機儲存唔到，關閉頁面後會冇咗",
  legendRest: "紅框：休息唔夠鐘",
  legendPin: "📌 手動改",
  legendMiss: "• 唔係喜好",
  noDuty: "Duty Sheet 入面冇呢個更份",
  legendHc: "HC／TBC：自己改編號，或者將待定區嘅放入去",
  removeBlock: "刪除呢個更份積木",
  blockRemoved: "已刪除積木，其餘空格已按偏好重新編排",
  needRd: "每位組員一星期要有一日 RD，未有 RD 就唔會自動填更份",
  setupDone: "已儲存組員，積木已放入待定區；設好假期同喜好後按「自動」",
  emptyCount: (n) => `空 ${n}`,
}

const view = document.getElementById("view")
const state = { monday: null, sel: null, message: "", tray: { tab: "blocks", filter: [], sort: "on", order: "row" }, pick: { rows: [] }, notesOpen: false, importOpen: false, leaveOpen: false }
// How the tray and the members are shown (tab, filter, sort, member order) is this viewer's own; kept in the browser.
const TRAY_KEY = "tml-plan-tray-view"
// Earlier { plan, roster } pairs, for 還原上一步; kept for this visit only.
const history = []

let roster = null
let plan = null
let basic = {}
let cards = {} // book-on/off of the duties on the special sheets (8022, 8023 ...), from data/duties

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

function saveTrayView() {
  try {
    localStorage.setItem(TRAY_KEY, JSON.stringify(state.tray))
  } catch {
    // Blocked storage: the tray view lasts until the page is closed.
  }
}

function loadTrayView() {
  const saved = read(TRAY_KEY)
  const kinds = [...SHIFTS, "leave", "hc"]
  if (!saved || typeof saved !== "object") return
  if (["blocks", "combos", "other"].includes(saved.tab)) state.tray.tab = saved.tab
  if (Array.isArray(saved.filter)) state.tray.filter = saved.filter.filter((k) => kinds.includes(k))
  if (["on", "off", "code"].includes(saved.sort)) state.tray.sort = saved.sort
  if (["row", "name"].includes(saved.order)) state.tray.order = saved.order
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
  const key = code ? String(code).toUpperCase() : ""
  // Days off (CL, SL ...) have no book-on/off, whatever the duty list holds for them.
  if (key in EXTRA_HOURS) return null
  const row = basic[key]
  return row ? { on: row[0], off: row[2], hours: row[4] } : cards[key] ?? null
}

// Every duty of a Duty Sheet (e.g. 8022 -> 8022101, ...), from the basic list and the duty cards.
function sheetCodes(sheet) {
  const all = new Set([...Object.keys(basic), ...Object.keys(cards)])
  return [...all].filter((code) => /^\d{7}$/.test(code) && code.startsWith(sheet)).sort()
}

// Once leave and preferences are set, the empty cells are filled by preference.
// A member on leave on Monday, Tuesday or Wednesday takes the whole annual-leave week.
const ANNUAL = ["AL", "AL", "AL", "SH", "SH", "RD", "RD"]

// Save a change to one member, then fill that member's empty cells (only that row).
function settle(next, row, message = S.saved) {
  const weekOf = (plan) => weekView(roster, plan, state.monday).find((item) => item.member.row === row)
  let out = next
  // Only when this change put the AL there, so later changes to the week are kept.
  const had = weekOf(plan).codes.slice(0, 3).includes("AL")
  if (!had && weekOf(out).codes.slice(0, 3).includes("AL")) ANNUAL.forEach((code, d) => { out = setCell(roster, out, state.monday, row, d, code) })
  if (out.auto === false) return store(out, message)
  const missing = !weekOf(out).codes.includes("RD")
  store(fillMember(roster, out, state.monday, row, timeOf), missing ? S.needRd : message)
}

const who = (member) => member.name || `#${member.row}`

const pickBox = (cls, value, on, label) => `<input type="checkbox" class="pick ${cls}" data-v="${value}"${on ? " checked" : ""} aria-label="${label}" title="${label}">`

// The duties of a day's Duty Sheet nobody has yet: not in a cell, not in the tray.
function freeDuties(day) {
  const used = new Set([...trayView(plan, state.monday)[day], ...weekView(roster, plan, state.monday).map((line) => line.codes[day])])
  return sheetCodes(sheetOf(plan, addDays(state.monday, day))).filter((code) => !used.has(code) && timeOf(code))
    .sort((a, b) => timeOf(a).on - timeOf(b).on || a.localeCompare(b))
}

// The ISO week of a Monday, with its dates, e.g. 2026 年第 43 週（2026/10/19 至 2026/10/25）.
const weekNo = (monday) => `${isoWeek(monday).year} 年第 ${isoWeek(monday).week} 週（${weekSpan(monday)}）`

// Plans are made a week ahead: the page opens on next week.
const nextMonday = () => addDays(mondayOf(serviceDate(Date.now())), 7)

// A week seen for the first time starts with every block in the tray and the
// cells empty; a date on a special Duty Sheet gets that sheet's blocks.
function opened(p, monday) {
  if (p.weeks?.[monday]) return p
  let out = allToTray(roster, p, monday, timeOf)
  for (let d = 0; d < 7; d += 1) {
    const sheet = out.sheets?.[addDays(monday, d)]
    if (sheet) out = setSheet(roster, out, monday, d, sheet, sheetCodes(sheet))
  }
  return out
}

/* --------------------------------------------------------------- pages */

function render() {
  if (!roster) {
    view.innerHTML = `<p class="empty">${S.noRoster}</p>${csvImportHtml()}<p class="me-msg" role="status">${escapeHtml(state.message)}</p>` +
      `<details class="panel"><summary>${S.importJson}</summary>${backupImportHtml()}</details>`
    return
  }
  if (plan && !plan.weeks?.[state.monday]) savePlan(opened(plan, state.monday))
  // Repainting must not throw the reader back to the top of a long table.
  const table = view.querySelector(".ptable")
  const keep = table ? [table.scrollLeft, table.scrollTop, window.scrollY] : null
  view.innerHTML = plan ? csvImportHtml() + weekHtml() + stepsHtml() + settingsHtml() : setupHtml()
  const fresh = view.querySelector(".ptable")
  if (keep && fresh) {
    fresh.scrollLeft = keep[0]
    fresh.scrollTop = keep[1]
    window.scrollTo(0, keep[2])
  }
}

// The Monday to Sunday of a week, e.g. 2026/10/12 至 2026/10/18.
const weekSpan = (monday) => `${monday.replaceAll("-", "/")} 至 ${addDays(monday, 6).replaceAll("-", "/")}`

// Year and ISO week inputs, with the dates of that week under them.
function weekFields(monday, label) {
  const { year, week } = isoWeek(monday)
  return `<div class="plan-grid"><label>${S.yearLabel}<input name="year" type="number" inputmode="numeric" value="${year}" required></label>` +
    `<label>${label}<input name="week" type="number" inputmode="numeric" min="1" max="53" value="${week}" required></label></div>` +
    `<p class="fine p-span">${S.weekSpanLabel(week, weekSpan(monday))}</p>`
}

// 匯入下星期 Standard Roster: the week defaults to next week; the import itself checks the week.
function csvImportHtml() {
  const next = nextMonday()
  const now = plan?.anchor ? `<p class="fine p-current">${S.importedWeek(weekNo(plan.anchor))}</p>` : ""
  return `<details class="panel csv-import"${!plan || plan.anchor < next || state.importOpen ? " open" : ""}><summary>${S.csvTitle}<span class="meta">${weekNo(next)}</span></summary><div class="me-setup">` +
    now + weekFields(next, S.importWeek) +
    `<div class="me-edit-row"><label class="btn primary filebtn">${S.csvBtn}<input type="file" class="p-csv-file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden></label>` +
    `<a class="btn" href="data/roster-template.csv" download="roster-template.csv">${S.templateBtn}</a></div><p class="fine">${S.csvHelp} ${S.templateHelp}</p></div></details>`
}

// Whether a CSV may be imported for that Monday: never this week or before; ask when it is
// not next week, and when a week from then on already has hand-made changes.
function importAllowed(anchor) {
  const current = mondayOf(serviceDate(Date.now()))
  if (anchor <= current) {
    alert(S.importPast(weekNo(anchor)))
    return false
  }
  if (anchor !== nextMonday() && !window.confirm(S.importNotNext(weekNo(anchor), weekNo(nextMonday())))) return false
  const touched = Object.entries(plan?.weeks ?? {})
    .filter(([monday, week]) => monday >= anchor && Object.values(week).some((cell) => cell.pins?.some(Boolean)))
    .map(([monday]) => monday).sort()
  if (touched.length && !window.confirm(S.importOver(touched.map((m) => `第 ${isoWeek(m).week} 週`).join("、")))) return false
  return true
}

// The year and week typed next to an input, as a Monday, or null.
function typedMonday(box) {
  const year = Number(box?.querySelector("input[name=year]")?.value)
  const week = Number(box?.querySelector("input[name=week]")?.value)
  return year >= 2000 && year <= 2100 && week >= 1 && week <= 53 ? mondayOfIsoWeek(year, week) : null
}

function setupHtml(inPanel = false) {
  const anchor = plan?.anchor ?? state.monday
  const named = roster ? namedRows(roster) : []
  const body =
    `<form class="me-setup plan-setup" autocomplete="off">` + weekFields(anchor, S.weekLabel) +
    `<label>${S.rangesLabel}<input name="ranges" value="${escapeHtml(plan?.ranges ?? (named.length ? formatRanges(named) : "31-40, 55-70"))}" spellcheck="false" required></label>` +
    `<p class="fine">${S.rangesHelp}${named.length ? ` ${S.namedHint(named.length)}<button type="button" class="link p-named">${S.useNamed}</button>` : ""}</p>` +
    `<div class="me-edit-row"><button type="submit" class="btn primary">${S.save}</button></div>` +
    (inPanel ? "" : `<p class="me-msg" role="status">${escapeHtml(state.message)}</p>`) + `</form>`
  if (inPanel) return body
  return `${csvImportHtml()}<section class="panel"><h3>${S.setupTitle}</h3><p class="fine">${S.setupIntro}</p>${body}</section>`
}

function weekHtml() {
  const dates = weekDates(state.monday)
  const current = mondayOf(serviceDate(Date.now()))
  const lines = weekView(roster, plan, state.monday)
  const empties = dates.map((_, d) => lines.filter((line) => line.codes[d] === EMPTY).length)
  const issues = new Map(restIssues(roster, plan, state.monday, timeOf).map((x) => [`${x.row}:${x.day}`, x.rest]))
  const { year, week } = isoWeek(state.monday)
  const order = Object.entries(S.orderBy).map(([k, label]) => `<button type="button" class="pchip p-order" data-order="${k}" data-shift="" aria-pressed="${state.tray.order === k}">${label}</button>`).join("")
  const head = `<tr><th class="who"><span class="who-head">${S.member}<span class="pchips" role="group" aria-label="${S.orderLabel}">${order}</span></span></th>` +
    `${dates.map((d, i) => `<th>${S.weekdays[i]}<small>${meDate(d)}</small>${empties[i] ? `<small class="p-empties">${S.emptyCount(empties[i])}</small>` : ""}</th>`).join("")}<th>${S.fit}</th><th>${S.hours}</th></tr>`
  // 姓名 sorts by name (members without a name last), 行數 by this week's row.
  const shown = state.tray.order === "name"
    ? [...lines].sort((a, b) => (!a.member.name) - (!b.member.name) || a.member.name.localeCompare(b.member.name, "zh-Hant") || a.row - b.row)
    : [...lines].sort((a, b) => a.row - b.row)
  const body = shown.map((line) => {
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
      } else hours += EXTRA_HOURS[code] ?? 0
      const c = classify(code)
      const short = issues.get(`${line.member.row}:${d}`)
      const sel = state.sel && state.sel.row === line.member.row && state.sel.day === d
      const blank = code === EMPTY
      const missing = !t && /^\d{7}$/.test(code)
      const label = blank ? S.empty : code === "RD" ? `RD(${S.weekdays[d]})` : c.kind === "status" ? S.status[c.code] ?? c.code : code
      return `<td><button type="button" class="pcell" data-row="${line.member.row}" data-day="${d}"` +
        ` data-shift="${shift}" data-kind="${t ? "duty" : blank ? "empty" : c.kind}"${PENDING.includes(code) ? ' data-hc="1"' : ""}${LEAVE.includes(code) ? ' data-leave="1"' : ""}${missing ? ` data-missing="1" title="${S.noDuty}"` : ""}${sel ? ' data-sel="1"' : ""}${short != null ? ` data-short="1" title="${S.tooShort((short / 3600).toFixed(1))}"` : ""}>` +
        `<b>${escapeHtml(label)}${line.pins[d] ? `<i class="pin" title="${S.pinned}">📌</i>` : ""}${miss ? `<i class="miss" aria-label="唔係喜好">•</i>` : ""}</b>` +
        (t ? `<small>${hhmm(t.on)}–${hhmm(t.off)}</small><span class="ptag">${S.shift[shift]}</span>` : "") +
        `</button></td>`
    }).join("")
    const chips = SHIFTS.map((sh) => `<button type="button" class="pchip" data-row="${line.member.row}" data-shift="${sh}" aria-pressed="${line.member.prefs.includes(sh)}">${S.shift[sh]}</button>`).join("")
    return `<tr${state.pick.rows.includes(line.member.row) ? ' data-picked="1"' : ""}><th class="who">${pickBox("p-pick-row", line.member.row, state.pick.rows.includes(line.member.row), S.pickRow)}<input class="p-name" data-row="${line.member.row}" value="${escapeHtml(line.member.name)}" placeholder="#${line.member.row}" maxlength="40" aria-label="${S.member}">` +
      `<small>${S.rowNow(line.row)}</small><span class="pchips">${chips}</span></th>${cells}` +
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
    `<div class="weeklabel"><b>${S.week(year, week)} · ${S.weekOf(meDate(dates[0]), meDate(dates[6]))}</b>` +
    `<span>${S.team(lines.length)}${state.monday === current ? ` · ${S.thisWeek}` : ""}${state.monday === nextMonday() ? ` · ${S.nextWeek}` : ` · <button type="button" class="link p-this">${S.backNext}</button>`}</span></div>` +
    `<button type="button" class="btn p-next" aria-label="${S.next}">›</button></div>` +
    `<div class="plan-actions"><button type="button" class="btn primary p-arrange">${state.pick.rows.length ? S.arrangeScope(state.pick.rows.length) : S.arrange}</button>` +
    (state.pick.rows.length ? `<button type="button" class="link p-pick-clear">${S.pickClear}</button>` : "") +
    `<button type="button" class="btn p-auto" aria-pressed="${plan.auto !== false}">${plan.auto !== false ? S.autoOn : S.autoOff}</button>` +
    `<button type="button" class="btn p-undo"${history.length ? "" : " disabled"}>↶ ${S.undo}</button>` +
    `<span class="plan-actions-end"><button type="button" class="btn p-csv">${S.csv}</button><button type="button" class="btn danger p-reset">${S.reset}</button></span></div>` +
    `<p class="me-msg" role="status">${escapeHtml(state.message)}</p>` +
    `<p class="fine plan-fit">${S.fitLine(fitNow.hit, fitNow.all, fitStd.hit, fitStd.all, issues.size)}</p>` +
    notesHtml(lines, issues) +
    selHtml(lines) +
    `<div class="ptable"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>` +
    trayHtml() +
    `<p class="legend plan-legend">${legend}<span>${S.legendRest}</span><span>${S.legendPin}</span><span>${S.legendMiss}</span><span>${S.legendHc}</span></p>` +
    `<p class="fine">${S.arrangeHelp}</p>`
}

function stepsHtml() {
  return `<details class="panel p-steps"><summary>${S.stepsTitle}</summary><ol>${S.steps.map((step) => `<li>${step}</li>`).join("")}</ol></details>`
}

// 注意事項: what still needs a look this week; each line jumps to its cell.
function notesHtml(lines, issues) {
  const items = []
  const noRd = lines.filter((line) => !line.codes.includes("RD"))
  const note = (text, row, day) => items.push(`<li><button type="button" class="link p-note"${row != null ? ` data-row="${row}" data-day="${day}"` : ""}>${escapeHtml(text)}</button></li>`)
  for (const line of lines) {
    const name = who(line.member)
    line.codes.forEach((code, d) => {
      const short = issues.get(`${line.member.row}:${d}`)
      if (short != null) note(S.noteShort(name, S.weekdays[d], (short / 3600).toFixed(1)), line.member.row, d)
      if (/^\d{7}$/.test(code) && !timeOf(code)) note(S.noteMissing(name, S.weekdays[d], code), line.member.row, d)
    })
    const empty = line.codes.map((code, d) => (code === EMPTY ? d : -1)).filter((d) => d !== -1)
    if (empty.length && line.codes.includes("RD")) note(S.noteEmpty(name, empty.map((d) => S.weekdays[d]).join("、")), line.member.row, empty[0])
  }
  if (noRd.length) {
    const names = noRd.slice(0, 6).map((line) => who(line.member)).join("、") + (noRd.length > 6 ? " 等" : "")
    note(S.noteNoRd(names, noRd.length), noRd[0].member.row, Math.max(0, noRd[0].codes.indexOf(EMPTY)))
  }
  trayView(plan, state.monday).forEach((codes, d) => {
    const pending = codes.filter((code) => PENDING.includes(code)).length
    const left = codes.filter((code) => timeOf(code)).length
    if (pending) note(S.notePending(S.weekdays[d], pending))
    if (left) note(S.noteLeft(S.weekdays[d], left))
  })
  return `<details class="panel p-notes"${state.notesOpen ? " open" : ""}><summary>${S.notes(items.length)}${items.length ? "" : ` · ${S.notesNone}`}</summary>` +
    (items.length ? `<ul>${items.join("")}</ul>` : "") + `</details>`
}

// Whether the day's tray still holds that code. RD, AL and SH come out of the tray,
// so a block that is no longer there cannot be placed.
const trayHas = (day, code) => trayView(plan, state.monday)[day].includes(code)

// One tap to put a leave block in the selected empty cell. RD, AL and SH must still
// be in that day's tray; the 13 other codes are free of the tray, as before.
function leaveQuickHtml(day) {
  const btn = (code) => `<button type="button" class="btn p-leave" data-code="${code}"` +
    `${LEAVE.includes(code) && !trayHas(day, code) ? ' data-spent="1"' : ""}>${code}</button>`
  const others = EXTRA.filter((code) => !LEAVE.includes(code)).map(btn).join("")
  return `<div class="plan-leave"><span class="meta">${S.quickLeave}</span>` + LEAVE.map(btn).join("") +
    `<button type="button" class="btn p-leave-more" aria-expanded="${state.leaveOpen ? "true" : "false"}">${S.quickOther}</button>` +
    `<span class="plan-leave-all"${state.leaveOpen ? "" : " hidden"}>${others}</span></div>`
}

// Say so and stop, rather than quietly taking the member's own Standard duty block.
function leaveBlocked(day, code) {
  if (!LEAVE.includes(code) || trayHas(day, code)) return false
  alert(S.leaveNoBlock(S.weekdays[day], code))
  return true
}

// The bar for the selected cell or block: change it, put it away, or tap another to place it.
function selHtml(lines) {
  const sel = state.sel
  if (!sel) return ""
  if (sel.type === "combo") {
    const combo = combosView(roster, plan, state.monday)[sel.ci]
    if (!combo) return ""
    return `<form class="plan-sel panel" autocomplete="off"><div><b>${escapeHtml(S.comboSel(combo.row))}</b><span class="meta">${S.comboPick}</span></div>` +
      `<div class="me-edit-row"><button type="button" class="btn p-cancel">${S.cancel}</button></div></form>`
  }
  if (sel.type === "other") {
    return `<form class="plan-sel panel" autocomplete="off"><div><b>${escapeHtml(S.otherSel(sel.code))}</b><span class="meta">${S.otherPick}</span></div>` +
      `<div class="me-edit-row"><button type="button" class="btn p-cancel">${S.cancel}</button></div></form>`
  }
  if (sel.type === "block") {
    const code = trayView(plan, state.monday)[sel.day][sel.index]
    if (code == null) return ""
    const pending = PENDING.includes(code)
    const free = pending ? freeDuties(sel.day) : []
    const options = free.map((c) => {
      const t = timeOf(c)
      return `<option value="${c}">${c} · ${hhmm(t.on)}–${hhmm(t.off)} · ${S.shift[shiftOf(t.on, t.off)]}</option>`
    }).join("")
    const picker = pending ? `<label class="meta">${S.pickDuty} <select name="pick"><option value="">${free.length ? "—" : S.pickNone}</option>${options}</select></label>` : ""
    return `<form class="plan-sel plan-block panel" autocomplete="off"><div><b>${escapeHtml(S.blockSel(S.weekdays[sel.day], code))}</b><span class="meta">${pending ? S.pendingHelp : S.blockHelp}</span></div>` +
      `<div class="me-edit-row">${picker}${pending ? `<label class="meta">${S.dutyCode} <input name="code" inputmode="numeric" maxlength="7" spellcheck="false"></label><button type="submit" class="btn primary">${S.editSave}</button>` : ""}` +
      `<button type="button" class="btn p-cancel">${S.cancel}</button></div></form>`
  }
  const line = lines.find((item) => item.member.row === sel.row)
  if (!line) return ""
  const d = sel.day
  const quick = line.codes[d] === EMPTY ? leaveQuickHtml(d) : ""
  return `<form class="plan-sel panel" autocomplete="off"><div><b>${escapeHtml(S.selected(who(line.member), S.weekdays[d], line.codes[d] === EMPTY ? S.empty : line.codes[d]))}</b>` +
    `<span class="meta">Standard：${escapeHtml(line.std[d])} · ${S.selHelp}</span></div>` + quick +
    `<div class="me-edit-row"><label class="meta">${S.editLabel} <input name="code" value="${line.codes[d] === EMPTY ? "" : escapeHtml(line.codes[d])}" maxlength="10" autocapitalize="characters" spellcheck="false"></label>` +
    `<button type="submit" class="btn primary">${S.editSave}</button>` +
    (timeOf(line.codes[d]) || LEAVE.includes(line.codes[d]) ? `<button type="button" class="btn p-to-tray">${S.toTray}</button>` : "") +
    (line.codes[d] !== EMPTY && !timeOf(line.codes[d]) && !LEAVE.includes(line.codes[d]) ? `<button type="button" class="btn p-clear-cell">${S.clearCell}</button>` : "") +
    `<button type="button" class="btn p-cancel">${S.cancel}</button></div></form>`
}

// Which kind a tray code is for the filter: a shift, "leave" or "hc".
function kindOf(code) {
  const t = timeOf(code)
  if (t) return shiftOf(t.on, t.off)
  return PENDING.includes(code) ? "hc" : "leave"
}

const passes = (code) => !state.tray.filter.length || state.tray.filter.includes(kindOf(code))

// A combination passes when every duty in it is of a kind picked (rest days and leave don't count).
const comboPasses = (codes) => {
  if (!state.tray.filter.length) return true
  const duties = codes.filter((code) => timeOf(code))
  return duties.length > 0 && duties.every((code) => state.tray.filter.includes(kindOf(code)))
}

function sortKey(code) {
  const t = timeOf(code)
  if (state.tray.sort === "code") return [t ? 0 : 1, 0, code]
  return [t ? 0 : 1, t ? (state.tray.sort === "off" ? t.off : t.on) : 0, code]
}
const byKey = (a, b) => a[0] - b[0] || a[1] - b[1] || String(a[2]).localeCompare(String(b[2]))

function blockHtml(code, d, i, removable) {
  const t = timeOf(code)
  const shift = t ? shiftOf(t.on, t.off) : ""
  const sel = state.sel?.type === "block" && state.sel.day === d && state.sel.index === i
  const x = t && removable ? `<span class="blk-x" role="button" tabindex="0" data-day="${d}" data-index="${i}" aria-label="${S.removeBlock}" title="${S.removeBlock}">✕</span>` : ""
  return `<button type="button" class="block" data-day="${d}" data-index="${i}" data-shift="${shift}" data-kind="${t ? "duty" : "leave"}"${PENDING.includes(code) ? ' data-pending="1"' : ""}${sel ? ' data-sel="1"' : ""}>${x}` +
    `<b>${escapeHtml(t ? code : code === "RD" ? `RD(${S.weekdays[d]})` : S.status[code] ?? code)}</b>${t ? `<small>${hhmm(t.on)}–${hhmm(t.off)}</small><span class="ptag">${S.shift[shift]}</span>` : ""}</button>`
}

function comboHtml(combo, ci) {
  const sel = state.sel?.type === "combo" && state.sel.ci === ci
  const cells = combo.codes.map((code, d) => {
    const t = timeOf(code)
    const shift = t ? shiftOf(t.on, t.off) : ""
    return `<span class="cb-day" data-shift="${shift}"><i>${S.weekdays[d]}</i><b>${escapeHtml(t && /^\d{7}$/.test(code) ? code.slice(4) : code)}</b>${t ? `<small>${hhmm(t.on)}</small>` : ""}</span>`
  }).join("")
  return `<button type="button" class="combo" data-ci="${ci}"${sel ? ' data-sel="1"' : ""}><span class="cb-row">${S.rowNow(combo.row)}</span><span class="cb-days">${cells}</span></button>`
}

// 待定區: blocks waiting to be placed, one column per day, or the Standard rows as combinations.
function trayHtml() {
  const tray = trayView(plan, state.monday)
  const combos = combosView(roster, plan, state.monday)
  const tv = state.tray
  const kinds = [...SHIFTS.map((sh) => [sh, S.shift[sh]]), ["leave", S.filterLeave], ["hc", S.filterHc]]
  const chips = `<button type="button" class="pchip tf-chip" data-f="" data-shift="" aria-pressed="${!tv.filter.length}">${S.filterAll}</button>` +
    kinds.map(([k, label]) => `<button type="button" class="pchip tf-chip" data-f="${k}" data-shift="${SHIFTS.includes(k) ? k : ""}" aria-pressed="${tv.filter.includes(k)}">${label}</button>`).join("")
  const sort = `<label class="meta">${S.sort} <select class="p-tray-sort">${Object.entries(S.sortBy).map(([k, label]) => `<option value="${k}"${k === tv.sort ? " selected" : ""}>${label}</option>`).join("")}</select></label>`
  const tabs = `<span class="tray-tabs" role="tablist"><button type="button" class="tray-tab" data-tab="blocks" aria-selected="${tv.tab === "blocks"}">${S.tabBlocks}</button>` +
    `<button type="button" class="tray-tab" data-tab="combos" aria-selected="${tv.tab === "combos"}">${S.tabCombos(combos.length)}</button>` +
    `<button type="button" class="tray-tab" data-tab="other" aria-selected="${tv.tab === "other"}">${S.tabOther}</button></span>`
  let body
  if (tv.tab === "other") {
    const shown = EXTRA.filter(passes).sort((a, b) => byKey(sortKey(a), sortKey(b)))
    const blocks = shown.map((code) => {
      const t = timeOf(code)
      const shift = t ? shiftOf(t.on, t.off) : ""
      const sel = state.sel?.type === "other" && state.sel.code === code
      return `<button type="button" class="block" data-other="${code}" data-shift="${shift}" data-kind="${t ? "duty" : "leave"}"${sel ? ' data-sel="1"' : ""}>` +
        `<b>${code}</b>${t ? `<small>${hhmm(t.on)}–${hhmm(t.off)}</small><span class="ptag">${S.shift[shift]}</span>` : `<small>${S.offDay} · ${EXTRA_HOURS[code]}h</small>`}</button>`
    }).join("")
    body = `<p class="fine">${S.otherHelp}</p><div class="other-blocks">${blocks}</div>` +
      `<form class="p-custom me-edit-row" autocomplete="off"><label class="meta">${S.customLabel} <input name="code" maxlength="10" autocapitalize="characters" spellcheck="false"></label><button type="submit" class="btn">${S.customUse}</button></form>`
  } else if (tv.tab === "combos") {
    const mean = (codes) => {
      const ts = codes.map(timeOf).filter(Boolean)
      if (!ts.length) return Infinity
      return ts.reduce((sum, t) => sum + (tv.sort === "off" ? t.off : t.on), 0) / ts.length
    }
    const shown = combos.map((combo, ci) => ({ combo, ci })).filter(({ combo }) => comboPasses(combo.codes))
    if (tv.sort === "code") shown.sort((a, b) => a.combo.row - b.combo.row)
    else shown.sort((a, b) => mean(a.combo.codes) - mean(b.combo.codes))
    body = `<p class="fine">${S.comboHelp}</p><div class="combos">${shown.map(({ combo, ci }) => comboHtml(combo, ci)).join("") || `<span class="tray-none">${S.comboNone}</span>`}</div>`
  } else {
    const cols = tray.map((codes, d) => {
      const removable = canRemove(roster, plan, state.monday, d)
      const shown = codes.map((code, i) => ({ code, i })).filter(({ code }) => passes(code)).sort((a, b) => byKey(sortKey(a.code), sortKey(b.code)))
      const blocks = shown.map(({ code, i }) => blockHtml(code, d, i, removable)).join("")
      const count = shown.length === codes.length ? `${codes.length}` : `${shown.length}/${codes.length}`
      return `<div class="tray-col" data-day="${d}"><span class="tray-day">${S.weekdays[d]}<em>${count}</em></span><div class="tray-blocks">${blocks || `<span class="tray-none">${S.trayNone}</span>`}</div></div>`
    }).join("")
    body = `<div class="tray-cols">${cols}</div>`
  }
  return `<section class="tray panel" aria-label="${S.tray}"><div class="tray-head"><b>${S.tray}</b>${tabs}<span class="meta">${S.trayHelp}</span></div>` +
    `<div class="tray-tools"><span class="pchips">${chips}</span>${sort}</div>${body}</section>`
}

// 匯入備份：also offered before any roster exists, so a backup restores on a new phone.
function backupImportHtml() {
  return `<form class="me-setup p-import" autocomplete="off"><label>${S.importJson}<textarea name="text" rows="3" spellcheck="false" placeholder="${S.importPh}"></textarea></label>` +
    `<div class="me-edit-row"><button type="submit" class="btn">${S.importJson}</button></div></form>`
}

function settingsHtml() {
  return `<details class="panel"><summary>${S.settingsTitle}</summary><h4>${S.setupAdvanced}</h4><p class="fine">${S.setupIntro}</p>${setupHtml(true)}` +
    `<p class="fine">${S.backupHelp}</p><div class="me-foot"><button type="button" class="btn p-export">${S.exportJson}</button>` +
    `<button type="button" class="btn danger p-clear">${S.clear}</button></div>` +
    backupImportHtml() + `</details>`
}

/* ------------------------------------------------------------- actions */

function remember() {
  history.push({ plan, roster })
  if (history.length > 50) history.shift()
}

function store(next, message = S.saved) {
  if (JSON.stringify(next) !== JSON.stringify(plan)) remember()
  state.message = savePlan(next) ? message : S.notStored
}

function saveRoster(next) {
  roster = next
  try {
    if (next) localStorage.setItem(ROSTER_KEY, JSON.stringify(next))
    else localStorage.removeItem(ROSTER_KEY)
  } catch {
    // Blocked storage: the roster lasts until the page is closed.
  }
}

function undo() {
  const last = history.pop()
  state.sel = null
  if (!last) {
    state.message = S.noUndo
    return render()
  }
  if (last.roster !== roster) saveRoster(last.roster)
  if (last.plan) savePlan(last.plan)
  else {
    plan = null
    try {
      localStorage.removeItem(PLAN_KEY)
    } catch {
      // Storage blocked: nothing was stored.
    }
  }
  state.message = S.undone
  render()
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
  state.monday = next.anchor === plan?.anchor ? state.monday : next.anchor
  store(next.weeks?.[state.monday] ? allToTray(roster, next, state.monday, timeOf) : opened(next, state.monday), S.setupDone)
  render()
}


// Read a CSV (or pasted rows) as the Standard Roster; rows with a name become the team.
function importRoster(text, anchor) {
  const parsed = parseRoster(text)
  if (parsed.issues.length || !parsed.rows.length) {
    state.message = parsed.issues.slice(0, 4).join("；") || S.csvEmpty
    return render()
  }
  remember()
  // The CSV is the Standard Roster of the week it is imported for.
  const next = newRoster(parsed, { row: parsed.numbers[0], monday: anchor })
  saveRoster(next)
  const named = namedRows(next)
  if (named.length) {
    // Members are matched by name, so their preferences carry over; weeks before this
    // one stay as they were, this week and later start over with all blocks in the tray.
    const made = importWeek(next, plan, anchor)
    const kept = made.members.filter((m) => m.prefs.length).length
    state.monday = anchor
    state.sel = null
    state.pick = { rows: [] }
    state.importOpen = false
    state.message = savePlan(opened(made, anchor)) ? S.csvDone(parsed.rows.length, named.length, weekNo(anchor), kept) : S.notStored
  } else state.message = S.csvDone(parsed.rows.length, 0)
  render()
}

// 備份檔名：roster-<日期>-v<n>.json，n 係「同一日第幾個備份」（每日由 1 開始）。
const COUNT_KEY = "tml-plan-backup-count"

function backupNumber(date) {
  let n = 1
  try {
    const saved = read(COUNT_KEY)
    n = saved?.date === date ? Math.max(0, Number(saved.n) || 0) + 1 : 1
    localStorage.setItem(COUNT_KEY, JSON.stringify({ date, n }))
  } catch {
    n = 1 // Storage blocked: the name is still usable, just always v1.
  }
  return n
}

const backupName = () => {
  const date = serviceDate(Date.now())
  return `roster-${date}-v${backupNumber(date)}.json`
}

// A file straight to the Downloads folder (same helper as the personal roster page).
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

// 自動編排: fill every member's empty cells from the tray.
function autoFill() {
  const { plan: next, skipped } = fillTeam(roster, plan, state.monday, timeOf, { rows: state.pick.rows })
  state.sel = null
  store(next, S.arranged(skipped.map((row) => who(plan.members.find((m) => m.row === row)))))
  render()
}

// One move, from a drag or from two taps. source: a cell or a tray block;
// target: a cell or a day's tray. Everything happens within one day.
function act(source, target) {
  state.sel = null
  if (source.day !== target.day) {
    state.message = S.sameDay
    return render()
  }
  let next = null
  let message = S.swapped
  if (source.type === "cell" && target.type === "cell") next = swapCells(roster, plan, state.monday, source.row, target.row, source.day, timeOf)
  else if (source.type === "cell" && target.type === "tray") {
    next = toTray(roster, plan, state.monday, source.row, source.day, timeOf)
    message = S.trayed
  } else if (source.type === "block" && target.type === "cell") {
    if (PENDING.includes(trayView(plan, state.monday)[source.day][source.index])) {
      state.message = S.pendingNeed
      return render()
    }
    next = fromTray(roster, plan, state.monday, target.row, source.day, source.index, timeOf)
    message = S.placed
    if (next) {
      settle(next, target.row, message)
      return render()
    }
  } else return render()
  if (next) store(next, message)
  else state.message = S.noMove
  render()
}

// The week as a CSV file (with a BOM so Excel reads the Chinese), downloaded.
function downloadCsv() {
  const dates = weekDates(state.monday)
  const lines = weekView(roster, plan, state.monday)
  const { year, week } = isoWeek(state.monday)
  const quote = (v) => `"${String(v).replace(/"/g, '""')}"`
  const out = [["行", "組員", ...dates.map((d, i) => `${S.weekdays[i]} ${d}`), S.hours].map(quote).join(",")]
  for (const line of lines) {
    const hours = line.codes.reduce((sum, code) => sum + (timeOf(code)?.hours || EXTRA_HOURS[code] || 0), 0)
    out.push([line.row, who(line.member), ...line.codes.map((code) => (code === EMPTY ? "" : code)), hours ? hours.toFixed(1) : ""].map(quote).join(","))
  }
  const name = `tml-plan-${year}-W${String(week).padStart(2, "0")}.csv`
  const url = URL.createObjectURL(new Blob(["\ufeff" + out.join("\r\n")], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  state.message = S.csvSaved(name)
}

let suppressClick = false

function onClick(event) {
  if (suppressClick) return
  const t = event.target
  const del = t.closest(".blk-x")
  if (del) {
    const next = removeBlock(roster, plan, state.monday, Number(del.dataset.day), Number(del.dataset.index))
    state.sel = null
    if (next) store(next, S.blockRemoved)
    render()
    return
  }
  const comboEl = t.closest(".combo")
  if (comboEl) {
    const ci = Number(comboEl.dataset.ci)
    state.sel = state.sel?.type === "combo" && state.sel.ci === ci ? null : { type: "combo", ci }
    state.message = ""
    return render()
  }
  const tab = t.closest(".tray-tab")
  const fchip = t.closest(".tf-chip")
  if (tab || fchip) {
    if (tab) state.tray.tab = tab.dataset.tab
    else {
      const f = fchip.dataset.f
      state.tray.filter = !f ? [] : state.tray.filter.includes(f) ? state.tray.filter.filter((x) => x !== f) : [...state.tray.filter, f]
    }
    saveTrayView()
    return render()
  }
  const other = t.closest(".block[data-other]")
  if (other) {
    const code = other.dataset.other
    state.sel = state.sel?.type === "other" && state.sel.code === code ? null : { type: "other", code }
    state.message = ""
    return render()
  }
  const cell = t.closest(".pcell")
  if (cell && state.sel?.type === "other") {
    const row = Number(cell.dataset.row)
    const code = state.sel.code
    state.sel = null
    settle(setCell(roster, plan, state.monday, row, Number(cell.dataset.day), code), row, S.placed)
    return render()
  }
  if (cell && state.sel?.type === "combo") {
    const combo = combosView(roster, plan, state.monday)[state.sel.ci]
    const row = Number(cell.dataset.row)
    const next = combo && useCombo(roster, plan, state.monday, row, combo.codes, timeOf)
    state.sel = null
    if (next) settle(next, row, S.comboUsed)
    else state.message = S.comboGone
    return render()
  }
  const block = t.closest(".block")
  const col = t.closest(".tray-col")
  if (cell || block || col) {
    const sel = state.sel
    const here = cell
      ? { type: "cell", row: Number(cell.dataset.row), day: Number(cell.dataset.day) }
      : block
        ? { type: "block", day: Number(block.dataset.day), index: Number(block.dataset.index) }
        : { type: "tray", day: Number(col.dataset.day) }
    state.message = ""
    const same = sel && sel.type === here.type && sel.day === here.day && sel.row === here.row && sel.index === here.index
    if (!sel) state.sel = here.type === "tray" ? null : here
    else if (same) state.sel = null
    else if (here.type === "tray") {
      if (sel.type === "cell") return act(sel, here)
      state.sel = null
    } else if (sel.type === "cell" && here.type === "block") return act(here, sel)
    else if (sel.type === "block" && here.type === "cell") return act(sel, here)
    else if (sel.type === "cell" && here.type === "cell") return act(sel, here)
    else state.sel = here
    return render()
  }
  const leaveMore = t.closest(".p-leave-more")
  if (leaveMore) {
    state.leaveOpen = !state.leaveOpen
    return render()
  }
  const leaveBtn = t.closest(".p-leave")
  if (leaveBtn && state.sel?.type === "cell") {
    const code = leaveBtn.dataset.code
    const { row, day } = state.sel
    if (leaveBlocked(day, code)) return render()
    state.sel = null
    state.leaveOpen = false
    settle(setCell(roster, plan, state.monday, row, day, code), row, S.placed)
    return render()
  }
  const orderChip = t.closest(".p-order")
  if (orderChip) {
    state.tray.order = orderChip.dataset.order
    saveTrayView()
    return render()
  }
  const chip = t.closest(".pchip")
  if (chip) {
    const row = Number(chip.dataset.row)
    const members = plan.members.map((m) => {
      if (m.row !== row) return m
      const prefs = m.prefs.includes(chip.dataset.shift) ? m.prefs.filter((p) => p !== chip.dataset.shift) : [...m.prefs, chip.dataset.shift]
      return { ...m, prefs: SHIFTS.filter((sh) => prefs.includes(sh)) }
    })
    settle({ ...plan, members }, row)
    return render()
  }
  if (t.closest(".p-prev")) state.monday = addDays(state.monday, -7)
  else if (t.closest(".p-next")) state.monday = addDays(state.monday, 7)
  else if (t.closest(".p-this")) state.monday = nextMonday()
  else if (t.closest(".p-arrange")) return autoFill()
  else if (t.closest(".p-undo")) return undo()
  else if (t.closest(".p-auto")) {
    const on = plan.auto === false
    store({ ...plan, auto: on }, S.autoTurned(on))
  } else if (t.closest(".p-pick-clear")) state.pick = { rows: [] }
  else if (t.closest(".p-clear-cell")) {
    const row = state.sel.row
    const next = setCell(roster, plan, state.monday, row, state.sel.day, null)
    state.sel = null
    settle(next, row)
  }
  else if (t.closest(".p-cancel")) state.sel = null
  else if (t.closest(".p-named")) {
    const input = t.closest("form").elements.ranges
    input.value = formatRanges(namedRows(roster))
    return
  } else if (t.closest(".p-to-tray")) return act(state.sel, { type: "tray", day: state.sel.day })
  else if (t.closest(".p-reset")) {
    if (!window.confirm(S.resetAsk)) return
    state.sel = null
    store(opened(clearWeek(plan, state.monday), state.monday), S.resetDone)
  } else if (t.closest(".p-csv")) downloadCsv()
  else if (t.closest(".p-note")) {
    const note = t.closest(".p-note")
    if (note.dataset.row == null) {
      state.tray.tab = "blocks"
      render()
      view.querySelector(".tray")?.scrollIntoView({ block: "nearest" })
      return
    }
    state.sel = { type: "cell", row: Number(note.dataset.row), day: Number(note.dataset.day) }
    render()
    view.querySelector(`.pcell[data-row="${note.dataset.row}"][data-day="${note.dataset.day}"]`)?.scrollIntoView({ block: "center", inline: "center" })
    return
  }
  else if (t.closest(".p-export")) {
    const backup = { app: "tml-plan", appVersion: BUILD.version, plan, roster }
    const name = backupName()
    download(name, JSON.stringify(backup, null, 1), "application/json")
    state.message = S.exported(name)
  } else if (t.closest(".p-clear")) {
    if (!window.confirm(S.clearAsk)) return
    remember()
    try {
      localStorage.removeItem(PLAN_KEY)
    } catch {
      // Storage blocked: nothing was stored.
    }
    plan = null
  } else return
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
  if (form.matches(".p-custom")) {
    const code = normaliseCode(form.elements.code.value)
    if (!code || PENDING.includes(code)) {
      state.message = PENDING.includes(code) ? S.hcCell : S.badCode
      return render()
    }
    state.sel = { type: "other", code }
    state.message = ""
    return render()
  }
  if (form.matches(".plan-block")) {
    const code = normaliseCode(form.elements.pick?.value || form.elements.code?.value || "")
    const next = code && renameBlock(plan, state.monday, state.sel.day, state.sel.index, code, timeOf)
    if (!next) state.message = S.badDuty
    else {
      state.sel = null
      store(next, S.renamed)
    }
    return render()
  }
  if (form.matches(".plan-sel")) {
    const code = normaliseCode(form.elements.code.value)
    if (!code) {
      state.message = S.badCode
      return render()
    }
    if (PENDING.includes(code)) {
      state.message = S.hcCell
      return render()
    }
    if (leaveBlocked(state.sel.day, code)) return render()
    settle(setCell(roster, plan, state.monday, state.sel.row, state.sel.day, code), state.sel.row)
    state.sel = null
    return render()
  }
  if (form.matches(".p-import")) {
    let raw = null
    try {
      raw = JSON.parse(form.elements.text.value)
    } catch {
      raw = null
    }
    // New backups hold { app, version, plan, roster }; older ones are the plan alone.
    const next = raw ? cleanPlan(raw.plan ?? raw) : null
    const nextRoster = raw?.roster ? cleanRoster(raw.roster) : null
    if (!next) state.message = S.importBad
    else {
      if (nextRoster) saveRoster(nextRoster)
      // An old backup carries no roster: say so instead of leaving the CSV prompt unexplained.
      store(next, roster ? S.imported : S.importedNoRoster)
      state.monday = nextMonday()
    }
    render()
  }
}

// Drag and drop with pointer events, so mouse, pen and touch all work. A mouse
// starts dragging after a few pixels; a finger after a short hold (moving
// sooner just scrolls). Duty cells and tray blocks can be picked up; cells of
// the same day and that day's tray column are the places to drop.
let press = null

const sourceOf = (el) => (el.classList.contains("block")
  ? { type: "block", day: Number(el.dataset.day), index: Number(el.dataset.index) }
  : { type: "cell", row: Number(el.dataset.row), day: Number(el.dataset.day) })

function targetAt(x, y) {
  const el = document.elementFromPoint(x, y)?.closest(".pcell[data-target], .tray-col[data-target]")
  if (!el) return null
  return el.classList.contains("tray-col")
    ? { type: "tray", day: Number(el.dataset.day), el }
    : { type: "cell", row: Number(el.dataset.row), day: Number(el.dataset.day), el }
}

function startDrag() {
  const { el, src } = press
  press.started = true
  const box = el.getBoundingClientRect()
  press.ghost = el.cloneNode(true)
  press.ghost.classList.add("pghost")
  press.ghost.style.width = `${box.width}px`
  document.body.append(press.ghost)
  view.classList.add("dragging")
  view.querySelectorAll(`.pcell[data-day="${src.day}"], .tray-col[data-day="${src.day}"]`).forEach((node) => node.setAttribute("data-target", "1"))
  el.setAttribute("data-lifted", "1")
  press.scroller = setInterval(autoScroll, 40)
  moveGhost()
}

function moveGhost() {
  const { ghost, x, y } = press
  ghost.style.left = `${x - ghost.offsetWidth / 2}px`
  ghost.style.top = `${y - ghost.offsetHeight / 2}px`
  view.querySelectorAll("[data-over]").forEach((node) => node.removeAttribute("data-over"))
  targetAt(x, y)?.el.setAttribute("data-over", "1")
}

// Near the top or bottom edge of the table, keep it scrolling while the pointer is held there.
function autoScroll() {
  const table = view.querySelector(".ptable")
  if (!table || !press) return
  const box = table.getBoundingClientRect()
  if (press.x < box.left || press.x > box.right) return
  if (press.y < box.top + 36 && press.y > box.top - 40) table.scrollTop -= 14
  else if (press.y > box.bottom - 36 && press.y < box.bottom + 40) table.scrollTop += 14
}

function endPress(drop) {
  const done = press
  press = null
  document.removeEventListener("pointermove", onPointerMove)
  document.removeEventListener("pointerup", onPointerUp)
  document.removeEventListener("pointercancel", onPointerCancel)
  clearTimeout(done.timer)
  if (!done.started) return
  clearInterval(done.scroller)
  done.ghost.remove()
  view.classList.remove("dragging")
  const target = drop ? targetAt(done.x, done.y) : null
  view.querySelectorAll("[data-target], [data-over], [data-lifted]").forEach((node) => {
    node.removeAttribute("data-target")
    node.removeAttribute("data-over")
    node.removeAttribute("data-lifted")
  })
  // The click that follows a drag must not also select a cell.
  suppressClick = true
  setTimeout(() => { suppressClick = false }, 60)
  if (target) act(done.src, target)
}

function onPointerMove(event) {
  if (!press || event.pointerId !== press.id) return
  const far = Math.hypot(event.clientX - press.startX, event.clientY - press.startY)
  press.x = event.clientX
  press.y = event.clientY
  if (!press.started) {
    if (press.touch) {
      if (far > 8) endPress(false)
    } else if (far >= 5) startDrag()
    return
  }
  moveGhost()
}

const onPointerUp = (event) => {
  if (press && event.pointerId === press.id) endPress(true)
}
const onPointerCancel = (event) => {
  if (press && event.pointerId === press.id) endPress(false)
}

function onPointerDown(event) {
  if (press || (event.pointerType === "mouse" && event.button !== 0)) return
  if (event.target.closest(".blk-x")) return
  const el = event.target.closest(".block:not([data-pending]):not([data-other]), .pcell[data-kind='duty'], .pcell[data-leave='1']")
  if (!el) return
  press = {
    el, src: sourceOf(el), id: event.pointerId, touch: event.pointerType !== "mouse",
    startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, started: false,
  }
  if (press.touch) press.timer = setTimeout(() => { if (press) startDrag() }, 320)
  document.addEventListener("pointermove", onPointerMove)
  document.addEventListener("pointerup", onPointerUp)
  document.addEventListener("pointercancel", onPointerCancel)
}

async function boot() {
  roster = cleanRoster(read(ROSTER_KEY))
  plan = cleanPlan(read(PLAN_KEY))
  state.monday = nextMonday()
  loadTrayView()
  try {
    const response = await fetch("data/duty-basic.json")
    basic = (await response.json()).duties ?? {}
  } catch {
    basic = {}
  }
  try {
    const index = await (await fetch("data/duties/index.json")).json()
    await Promise.all(index.sheets.map(async (sheet) => {
      if (sheet.class !== "special") return
      const book = await (await fetch(`data/duties/${sheet.file}`)).json()
      for (const duty of book.duties) if (duty.on && duty.off) cards[duty.id] = { on: duty.on[0], off: duty.off[0], hours: (duty.work ?? 0) / 60 }
    }))
  } catch {
    // The page works without the special sheets' cards; their duties just show no times.
  }
  view.addEventListener("click", onClick)
  view.addEventListener("submit", onSubmit)
  view.addEventListener("input", (event) => {
    const box = event.target.closest(".plan-setup, .csv-import")
    if (!box || !event.target.matches("input[name=year], input[name=week]")) return
    const monday = typedMonday(box)
    const span = box.querySelector(".p-span")
    if (span && monday) span.textContent = S.weekSpanLabel(isoWeek(monday).week, weekSpan(monday))
  })
  view.addEventListener("change", (event) => {
    if (event.target.matches(".p-name")) {
      const row = Number(event.target.dataset.row)
      store({ ...plan, members: plan.members.map((m) => (m.row === row ? { ...m, name: event.target.value.trim().slice(0, 40) } : m)) })
      render()
    } else if (event.target.matches(".p-csv-file")) {
      const file = event.target.files?.[0]
      if (!file) return
      const anchor = typedMonday(event.target.closest(".csv-import")) ?? nextMonday()
      event.target.value = ""
      if (!importAllowed(anchor)) return
      file.text().then((text) => importRoster(text, anchor)).catch(() => {
        state.message = S.csvFail
        render()
      })
    } else if (event.target.matches(".p-pick-row")) {
      const v = Number(event.target.dataset.v)
      const list = state.pick.rows
      state.pick = { rows: event.target.checked ? [...list, v].sort((a, b) => a - b) : list.filter((x) => x !== v) }
      render()
    } else if (event.target.matches(".plan-block select[name=pick]") && event.target.value) {
      event.target.form.requestSubmit()
    } else if (event.target.matches(".p-tray-sort")) {
      state.tray.sort = event.target.value
      saveTrayView()
      render()
    }
  })
  view.addEventListener("pointerdown", onPointerDown)
  // Remember whether 注意事項 and the import panel are open across repaints.
  view.addEventListener("toggle", (event) => {
    if (event.target.matches?.(".p-notes")) state.notesOpen = event.target.open
    if (event.target.matches?.(".csv-import")) state.importOpen = event.target.open
  }, true)
  // Ctrl+Z / ⌘Z undoes the last change, except while typing.
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z") return
    if (event.target.closest?.("input, textarea, select")) return
    event.preventDefault()
    undo()
  })
  // Once a held finger has picked something up, the page must not scroll under it.
  document.addEventListener("touchmove", (event) => {
    if (press?.started) event.preventDefault()
  }, { passive: false })
  view.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".pcell, .block")) event.preventDefault()
  })
  document.getElementById("foot").innerHTML =
    `v${BUILD.version} · ${BUILD.commit === "dev" ? "dev" : `commit ${escapeHtml(BUILD.commit)}`} · 編更資料只存喺呢部機`
  render()
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {})
}

boot()
