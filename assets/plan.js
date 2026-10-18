// 編更: arrange a team's duties over the Standard Roster by preference.
// Hand-written, no build step. This page is separate from the personal
// roster page: it imports its own Standard Roster (CSV) and keeps it, and the
// plan (names, preferences, results), only in this browser's localStorage,
// never uploaded. Book-on/off times come from data/duty-basic.json.

import { EMPTY, LEAVE, PENDING, SHEETS, SHIFTS, allToTray, canRemove, cleanPlan, clearWeek, fillMember, fillTeam, formatRanges, fromTray, isoWeek, mondayOfIsoWeek, namedRows, newPlan, parseRanges, prefDistance, removeBlock, renameBlock, restIssues, setCell, setSheet, sheetOf, shiftOf, swapCells, toTray, trayView, weekView } from "../lib/tml-plan.js"
import { addDays, classify, cleanRoster, mondayOf, newRoster, normaliseCode, parseRoster, weekDates } from "../lib/tml-roster.js"
import { serviceDate } from "../lib/tml-time.js"

const BUILD = { version: "0.9.0", commit: "dev" }
// The plan page keeps its own Standard Roster, apart from the personal roster of the 我的更表 page ("tml-roster").
const ROSTER_KEY = "tml-plan-roster"
const PLAN_KEY = "tml-roster-plan"

const S = {
  weekdays: ["一", "二", "三", "四", "五", "六", "日"],
  shift: { dawn: "死早", early: "早", mid: "中", late: "夜", night: "死夜" },
  shiftHelp: { dawn: "06:30 前上班", early: "10:00 前上班", mid: "10:00–15:00 上班", late: "15:00 後上班", night: "00:30 後下班" },
  status: { RD: "休息", AL: "年假", SH: "法定假", HC: "HC" },
  noRoster: "未有 Standard Roster。請匯入 CSV（有「名稱」欄嗰份）。",
  csvBtn: "由 CSV 匯入 Standard Roster",
  csvHelp: "格式：標題行 `,Name,Mon,Tue,Wed,Thu,Fri,Sat,Sun`，之後每行 行號、名稱、七日更份。有名稱嘅行就係組員；一行七格 TBC 嘅唔跟輪換，留喺原行。",
  csvEmpty: "讀唔到任何一行，請確認係 CSV",
  csvDone: (rows, named, week) => `已匯入 ${rows} 行${named ? `，有名稱嘅 ${named} 位已設為組員，基準${week}，所有積木已放入待定區；設好假期同喜好後按「自動編排」` : ""}`,
  importWeek: "CSV 屬於邊個星期（基準星期）",
  templateBtn: "下載匯入範本",
  templateHelp: "範本有 141 行、7 格，RD 只係示範，請換成實際更份。Name 欄填咗名嘅行就係組員。",
  csvFail: "讀取檔案失敗",
  useNamed: "用有名稱嘅行",
  namedHint: (n) => `Standard Roster 有 ${n} 行有名稱。`,
  setupTitle: "設定組員",
  setupIntro: "揀一個基準星期，填嗰個星期組員做緊嘅行號。之後每個星期，每位組員自動跳去下一行。",
  weekLabel: "基準星期（ISO 週數）",
  weekSpanLabel: (week, span) => `第 ${week} 週：${span}`,
  yearLabel: "年份",
  rangesLabel: "組員行號（基準星期）",
  rangesHelp: "例如 31-40, 55-70。用逗號分隔，可以有多段。",
  save: "儲存",
  week: (y, w) => `${y} · Week ${w}`,
  weekOf: (a, b) => `${a} – ${b}`,
  team: (n) => `${n} 位組員`,
  prev: "上週",
  next: "下週",
  backNext: "回到下週",
  thisWeek: "本週",
  nextWeek: "下週",
  arrange: "自動編排",
  arrangeHelp: "自動編排用待定區嘅更份填滿組員嘅空格，按偏好同 12 小時休息分配；一星期未有 RD 嘅組員唔會編；手動改過（📌）嘅格會保留。",
  undo: "還原上一步",
  undone: "已還原上一步",
  noUndo: "冇可以還原嘅步驟",
  reset: "本週重新開始",
  resetAsk: "本週所有格會清空，全部積木放返待定區，確定？",
  resetDone: "本週已重新開始，所有積木喺待定區",
  csv: "匯出本週 CSV",
  member: "組員",
  rowNow: (r) => `第 ${r} 行`,
  fit: "配中",
  fitLine: (hit, all, std, short) => `全組配中偏好 ${hit}/${all} 更（Standard 係 ${std}/${all}）${short ? ` · ${short} 格休息唔夠鐘` : ""}`,
  hours: "工時",
  pinned: "手動改",
  tooShort: (h) => `休息只有 ${h} 小時`,
  selected: (who, day, code) => `${who} · 週${day}：${code}`,
  selHelp: "再撳同一日另一格就對調；電腦直接拖放，手機長按後拖。",
  editLabel: "改做",
  editSave: "改",
  cancel: "取消",
  badCode: "格式唔啱：請輸入 7 位更份編號，或者 RD、AL、SH、HC、HSP1 呢類代號",
  sameDay: "只可以同一日嘅格對調",
  swapped: "已對調",
  arranged: (skipped) => `已自動編排${skipped.length ? `；${skipped.length} 位未有 RD 冇編：${skipped.slice(0, 5).join("、")}${skipped.length > 5 ? " 等" : ""}` : ""}`,
  tray: "待定區",
  trayHelp: "將積木拖去同一日嘅格仔，或者將格仔拖返入嚟。HC／TBC 要先撳入去填更份編號。",
  trayNone: "—",
  empty: "空",
  toTray: "放入待定區",
  blockSel: (day, code) => `待定 ${code} · 週${day}`,
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
  sheetLabel: "Duty Sheet",
  sheetTitle: (day, dates) => `週${day} 用嘅 Duty Sheet${dates ? `（${dates} 發佈）` : ""}`,
  sheetHelp: "每日可以揀 Duty Sheet（1101 / 6091 / 7091 / 8022 / 8023）：該日 Standard Roster 嘅更份編號會跟住轉，例如 6091124 揀 8022 就變 8022124。",
  sheetChanged: (n) => `已將週${n} 改用新 Duty Sheet`,
  noDuty: "Duty Sheet 入面冇呢個更份",
  legendHc: "HC／TBC：自己改編號，或者將待定區嘅放入去",
  removeBlock: "刪除呢個更份積木",
  blockRemoved: "已刪除積木，其餘空格已按偏好重新編排",
  needRd: "每位組員一星期要有一日 RD，未有 RD 就唔會自動填更份",
  setupDone: "已儲存組員，積木已放入待定區；設好假期同喜好後按「自動編排」",
  emptyCount: (n) => `空 ${n}`,
}

const view = document.getElementById("view")
const state = { monday: null, sel: null, message: "", exportText: "" }
// Earlier { plan, roster } pairs, for 還原上一步; kept for this visit only.
const history = []

let roster = null
let plan = null
let basic = {}
let cards = {} // book-on/off of the duties on the special sheets (8022, 8023 ...), from data/duties
let sheetDates = {} // sheet -> dates it is issued for, from data/duties/index.json

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
  const key = code ? String(code).toUpperCase() : ""
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
  const missing = !weekOf(out).codes.includes("RD")
  store(fillMember(roster, out, state.monday, row, timeOf), missing ? S.needRd : message)
}

const who = (member) => member.name || `#${member.row}`

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
    view.innerHTML = `<p class="empty">${S.noRoster}</p><section class="panel">${csvImportHtml()}<p class="me-msg" role="status">${escapeHtml(state.message)}</p></section>`
    return
  }
  if (plan && !plan.weeks?.[state.monday]) savePlan(opened(plan, state.monday))
  // Repainting must not throw the reader back to the top of a long table.
  const table = view.querySelector(".ptable")
  const keep = table ? [table.scrollLeft, table.scrollTop, window.scrollY] : null
  view.innerHTML = plan ? weekHtml() + settingsHtml() : setupHtml()
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

function csvImportHtml() {
  return `<div class="csv-import">${weekFields(plan?.anchor ?? nextMonday(), S.importWeek)}` +
    `<div class="me-edit-row"><label class="btn primary filebtn">${S.csvBtn}<input type="file" class="p-csv-file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden></label>` +
    `<a class="btn" href="data/roster-template.csv" download="roster-template.csv">${S.templateBtn}</a></div><p class="fine">${S.csvHelp} ${S.templateHelp}</p></div>`
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
  return `<section class="panel"><h3>${S.setupTitle}</h3>${csvImportHtml()}<p class="fine">${S.setupIntro}</p>${body}</section>`
}

function weekHtml() {
  const dates = weekDates(state.monday)
  const current = mondayOf(serviceDate(Date.now()))
  const lines = weekView(roster, plan, state.monday)
  const empties = dates.map((_, d) => lines.filter((line) => line.codes[d] === EMPTY).length)
  const issues = new Map(restIssues(roster, plan, state.monday, timeOf).map((x) => [`${x.row}:${x.day}`, x.rest]))
  const { year, week } = isoWeek(state.monday)
  const sheetSelect = (date, i) => {
    const now = sheetOf(plan, date)
    const opts = SHEETS.map((sh) => `<option value="${sh}"${sh === now ? " selected" : ""}>${sh}</option>`).join("")
    return `<select class="p-sheet" data-day="${i}" aria-label="${S.sheetTitle(S.weekdays[i], "")}" title="${S.sheetTitle(S.weekdays[i], (sheetDates[now] ?? []).join("、"))}"${plan.sheets?.[date] ? ' data-set="1"' : ""}>${opts}</select>`
  }
  const head = `<tr><th class="who">${S.member}</th>${dates.map((d, i) => `<th>${S.weekdays[i]}<small>${meDate(d)}</small>${sheetSelect(d, i)}${empties[i] ? `<small class="p-empties">${S.emptyCount(empties[i])}</small>` : ""}</th>`).join("")}<th>${S.fit}</th><th>${S.hours}</th></tr>`
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
      const blank = code === EMPTY
      const missing = !t && /^\d{7}$/.test(code)
      const label = blank ? S.empty : code === "RD" ? `RD(${S.weekdays[d]})` : c.kind === "status" ? S.status[c.code] ?? c.code : code
      return `<td><button type="button" class="pcell" data-row="${line.member.row}" data-day="${d}"` +
        ` data-shift="${shift}" data-kind="${t ? "duty" : blank ? "empty" : c.kind}"${PENDING.includes(code) ? ' data-hc="1"' : ""}${LEAVE.includes(code) ? ' data-leave="1"' : ""}${missing ? ` data-missing="1" title="${S.noDuty}"` : ""}${sel ? ' data-sel="1"' : ""}${short != null ? ` data-short="1" title="${S.tooShort((short / 3600).toFixed(1))}"` : ""}>` +
        `<b>${escapeHtml(label)}${line.pins[d] ? `<i class="pin" title="${S.pinned}">📌</i>` : ""}${miss ? `<i class="miss" aria-label="唔係偏好">•</i>` : ""}</b>` +
        (t ? `<small>${hhmm(t.on)}–${hhmm(t.off)}</small><span class="ptag">${S.shift[shift]}</span>` : "") +
        `</button></td>`
    }).join("")
    const chips = SHIFTS.map((sh) => `<button type="button" class="pchip" data-row="${line.member.row}" data-shift="${sh}" aria-pressed="${line.member.prefs.includes(sh)}">${S.shift[sh]}</button>`).join("")
    return `<tr><th class="who"><input class="p-name" data-row="${line.member.row}" value="${escapeHtml(line.member.name)}" placeholder="#${line.member.row}" maxlength="40" aria-label="${S.member}">` +
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
    `<div class="plan-actions"><button type="button" class="btn primary p-arrange">${S.arrange}</button>` +
    `<button type="button" class="btn p-undo"${history.length ? "" : " disabled"}>↶ ${S.undo}</button>` +
    `<span class="plan-actions-end"><button type="button" class="btn p-csv">${S.csv}</button><button type="button" class="btn danger p-reset">${S.reset}</button></span></div>` +
    `<p class="me-msg" role="status">${escapeHtml(state.message)}</p>` +
    `<p class="fine plan-fit">${S.fitLine(fitNow.hit, fitNow.all, fitStd.hit, issues.size)}</p>` +
    selHtml(lines) +
    `<div class="ptable"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>` +
    trayHtml() +
    `<p class="legend plan-legend">${legend}<span>${S.legendRest}</span><span>${S.legendPin}</span><span>${S.legendMiss}</span><span>${S.legendHc}</span></p>` +
    `<p class="fine">${S.arrangeHelp}</p><p class="fine">${S.sheetHelp}</p>` +
    (state.exportText ? `<textarea class="me-export-box" readonly rows="6">${escapeHtml(state.exportText)}</textarea>` : "")
}

// The bar for the selected cell or block: change it, put it away, or tap another to place it.
function selHtml(lines) {
  const sel = state.sel
  if (!sel) return ""
  if (sel.type === "block") {
    const code = trayView(plan, state.monday)[sel.day][sel.index]
    if (code == null) return ""
    const pending = PENDING.includes(code)
    return `<form class="plan-sel plan-block panel" autocomplete="off"><div><b>${escapeHtml(S.blockSel(S.weekdays[sel.day], code))}</b><span class="meta">${pending ? S.pendingHelp : S.blockHelp}</span></div>` +
      `<div class="me-edit-row">${pending ? `<label class="meta">${S.dutyCode} <input name="code" inputmode="numeric" maxlength="7" spellcheck="false"></label><button type="submit" class="btn primary">${S.editSave}</button>` : ""}` +
      `<button type="button" class="btn p-cancel">${S.cancel}</button></div></form>`
  }
  const line = lines.find((item) => item.member.row === sel.row)
  if (!line) return ""
  const d = sel.day
  return `<form class="plan-sel panel" autocomplete="off"><div><b>${escapeHtml(S.selected(who(line.member), S.weekdays[d], line.codes[d] === EMPTY ? S.empty : line.codes[d]))}</b>` +
    `<span class="meta">Standard：${escapeHtml(line.std[d])} · ${S.selHelp}</span></div>` +
    `<div class="me-edit-row"><label class="meta">${S.editLabel} <input name="code" value="${line.codes[d] === EMPTY ? "" : escapeHtml(line.codes[d])}" maxlength="10" autocapitalize="characters" spellcheck="false"></label>` +
    `<button type="submit" class="btn primary">${S.editSave}</button>` +
    (timeOf(line.codes[d]) || LEAVE.includes(line.codes[d]) ? `<button type="button" class="btn p-to-tray">${S.toTray}</button>` : "") +
    `<button type="button" class="btn p-cancel">${S.cancel}</button></div></form>`
}

// 待定區: duties taken out of cells, one column per day, waiting to be dropped.
function trayHtml() {
  const tray = trayView(plan, state.monday)
  const removable = tray.map((_, d) => canRemove(roster, plan, state.monday, d))
  const cols = tray.map((codes, d) => {
    const blocks = codes.map((code, i) => {
      const t = timeOf(code)
      const shift = t ? shiftOf(t.on, t.off) : ""
      const sel = state.sel?.type === "block" && state.sel.day === d && state.sel.index === i
      const x = t && removable[d] ? `<span class="blk-x" role="button" tabindex="0" data-day="${d}" data-index="${i}" aria-label="${S.removeBlock}" title="${S.removeBlock}">✕</span>` : ""
      return `<button type="button" class="block" data-day="${d}" data-index="${i}" data-shift="${shift}" data-kind="${t ? "duty" : "leave"}"${PENDING.includes(code) ? ' data-pending="1"' : ""}${sel ? ' data-sel="1"' : ""}>${x}` +
        `<b>${escapeHtml(t ? code : code === "RD" ? `RD(${S.weekdays[d]})` : S.status[code] ?? code)}</b>${t ? `<small>${hhmm(t.on)}–${hhmm(t.off)}</small><span class="ptag">${S.shift[shift]}</span>` : ""}</button>`
    }).join("")
    return `<div class="tray-col" data-day="${d}"><span class="tray-day">${S.weekdays[d]}<em>${codes.length}</em></span><div class="tray-blocks">${blocks || `<span class="tray-none">${S.trayNone}</span>`}</div></div>`
  }).join("")
  return `<section class="tray panel" aria-label="${S.tray}"><div class="tray-head"><b>${S.tray}</b><span class="meta">${S.trayHelp}</span></div><div class="tray-cols">${cols}</div></section>`
}

function settingsHtml() {
  return `<details class="panel"><summary>${S.settingsTitle}${plan ? `（${S.weekSpanLabel(isoWeek(plan.anchor).week, weekSpan(plan.anchor))}）` : ""}</summary>${csvImportHtml()}${setupHtml(true)}` +
    `<p class="fine">${S.backupHelp}</p><div class="me-foot"><button type="button" class="btn p-export">${S.exportJson}</button>` +
    `<button type="button" class="btn danger p-clear">${S.clear}</button></div>` +
    `<form class="me-setup p-import" autocomplete="off"><label>${S.importJson}<textarea name="text" rows="3" spellcheck="false" placeholder="${S.importPh}"></textarea></label>` +
    `<div class="me-edit-row"><button type="submit" class="btn">${S.importJson}</button></div></form></details>`
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

// The ISO week of a plan anchor, with its dates, e.g. 42 (2026/10/12 至 2026/10/18).
const weekNo = (monday) => `${isoWeek(monday).year} 年第 ${isoWeek(monday).week} 週（${weekSpan(monday)}）`

// Read a CSV (or pasted rows) as the Standard Roster; rows with a name become the team.
function importRoster(text, anchor) {
  const parsed = parseRoster(text)
  if (parsed.issues.length || !parsed.rows.length) {
    state.message = parsed.issues.slice(0, 4).join("；") || S.csvEmpty
    return render()
  }
  remember()
  const keep = roster?.anchor && parsed.numbers.includes(Number(roster.anchor.row)) ? roster.anchor : { row: parsed.numbers[0], monday: anchor }
  const next = newRoster(parsed, keep)
  next.overrides = roster?.overrides ?? {}
  saveRoster(next)
  const named = namedRows(next)
  if (named.length) {
    // A new Standard Roster starts every week over, all blocks in the tray.
    const made = { ...newPlan(anchor, formatRanges(named), plan, next), weeks: {}, trays: {} }
    state.monday = anchor
    state.sel = null
    state.message = savePlan(opened(made, anchor)) ? S.csvDone(parsed.rows.length, named.length, weekNo(anchor)) : S.notStored
  } else state.message = S.csvDone(parsed.rows.length, 0)
  render()
}

// 自動編排: fill every member's empty cells from the tray.
function autoFill() {
  const { plan: next, skipped } = fillTeam(roster, plan, state.monday, timeOf)
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

function weekCsv() {
  const dates = weekDates(state.monday)
  const lines = weekView(roster, plan, state.monday)
  const out = [["行", "組員", ...dates.map((d, i) => `${S.weekdays[i]} ${d}`)].join(",")]
  for (const line of lines) out.push([line.row, `"${who(line.member).replace(/"/g, '""')}"`, ...line.codes].join(","))
  return out.join("\n")
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
  const cell = t.closest(".pcell")
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
  } else if (t.closest(".p-csv")) state.exportText = weekCsv()
  else if (t.closest(".p-export")) {
    state.exportText = JSON.stringify(plan)
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
  if (form.matches(".plan-block")) {
    const code = normaliseCode(form.elements.code?.value ?? "")
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
    settle(setCell(roster, plan, state.monday, state.sel.row, state.sel.day, code), state.sel.row)
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
  const el = event.target.closest(".block:not([data-pending]), .pcell[data-kind='duty'], .pcell[data-leave='1']")
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
  try {
    const response = await fetch("data/duty-basic.json")
    basic = (await response.json()).duties ?? {}
  } catch {
    basic = {}
  }
  try {
    const index = await (await fetch("data/duties/index.json")).json()
    await Promise.all(index.sheets.map(async (sheet) => {
      sheetDates[sheet.code] = sheet.dates ?? []
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
      file.text().then((text) => importRoster(text, anchor)).catch(() => {
        state.message = S.csvFail
        render()
      })
    } else if (event.target.matches(".p-sheet")) {
      const day = Number(event.target.dataset.day)
      state.sel = null
      store(setSheet(roster, plan, state.monday, day, event.target.value, sheetCodes(event.target.value)), S.sheetChanged(S.weekdays[day]))
      render()
    }
  })
  view.addEventListener("pointerdown", onPointerDown)
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
