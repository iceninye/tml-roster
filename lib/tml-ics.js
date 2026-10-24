// 學校假期：讀一份 iCal（.ics）入面嘅活動，變成 [{ start, end, title }]（日期 YYYY-MM-DD，end 包埋嗰日）。
// Worker 用佢代讀 Google Calendar（瀏覽器直接讀會俾 CORS 擋），前端用 holidaysOn 搵某日有咩。
// Pure：冇 DOM、冇網絡。唔處理 RRULE（重複活動只計第一次）。

import { addDays } from "./tml-roster.js"

const dateOf = (value) => {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(String(value ?? ""))
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

// RFC 5545：長行會斷開，下一行用空格或 Tab 開頭；文字入面 \, \; \n \\ 係轉義。
const unfold = (text) => String(text ?? "").replace(/\r?\n[ \t]/g, "")
const unescape = (text) => text.replace(/\\([,;\\nN])/g, (_, c) => (c === "n" || c === "N" ? " " : c))

export function parseIcs(text) {
  const out = []
  let cur = null
  for (const line of unfold(text).split(/\r?\n/)) {
    if (line === "BEGIN:VEVENT") cur = {}
    else if (line === "END:VEVENT") {
      if (cur?.start && cur.status !== "CANCELLED") {
        // 全日活動嘅 DTEND 係「之後嗰日」（唔包），所以減一日；冇 DTEND 就係一日。
        let end = cur.end ?? cur.start
        if (cur.allDay && cur.end && cur.end > cur.start) end = addDays(cur.end, -1)
        if (end < cur.start) end = cur.start
        out.push({ start: cur.start, end, title: (cur.title ?? "").trim().slice(0, 80) })
      }
      cur = null
    } else if (cur) {
      const at = line.indexOf(":")
      if (at === -1) continue
      const [name, ...params] = line.slice(0, at).split(";")
      const value = line.slice(at + 1)
      if (name === "DTSTART") {
        cur.start = dateOf(value)
        cur.allDay = params.includes("VALUE=DATE") || /^\d{8}$/.test(value)
      } else if (name === "DTEND") cur.end = dateOf(value)
      else if (name === "SUMMARY") cur.title = unescape(value)
      else if (name === "STATUS") cur.status = value.trim().toUpperCase()
    }
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
}

// 只留 from 至 to 之間（有重疊）嘅活動，免得成份歷史都傳去前端。
export const holidaysBetween = (list, from, to) => (list ?? []).filter((h) => h.end >= from && h.start <= to)

// 某日嘅活動名（可能多過一個）
export const holidaysOn = (list, date) => (list ?? []).filter((h) => h.start <= date && date <= h.end).map((h) => h.title)
