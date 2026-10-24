// Service day in Hong Kong time: it changes at 04:00, so a shift that books off
// after midnight still belongs to the day it started. Same rule as
// https://github.com/iceninye/TML-traffic (lib/tml-timetable.js).

const HK_OFFSET_MS = 8 * 3_600_000
const DAY_MS = 86_400_000

// Start of the service day in epoch ms.
export function serviceDayStart(ms) {
  const local = ms + HK_OFFSET_MS
  let midnight = Math.floor(local / DAY_MS) * DAY_MS
  if (local - midnight < 4 * 3_600_000) midnight -= DAY_MS
  return midnight - HK_OFFSET_MS
}

// The service date as YYYY-MM-DD.
export function serviceDate(ms) {
  return new Date(serviceDayStart(ms) + HK_OFFSET_MS).toISOString().slice(0, 10)
}

// Seconds since the start of the service day (runs past 86400 after midnight).
export function serviceSeconds(ms) {
  return (ms - serviceDayStart(ms)) / 1000
}

// The calendar date in Hong Kong as YYYY-MM-DD (changes at 00:00, not 04:00).
export function hkDate(ms) {
  return new Date(ms + HK_OFFSET_MS).toISOString().slice(0, 10)
}

// Seconds since 00:00 HK of date (runs past 86400 on the night after).
export function secondsInto(date, ms) {
  return (ms - Date.parse(`${date}T00:00:00+08:00`)) / 1000
}
