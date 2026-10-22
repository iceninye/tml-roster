// 其他代碼（Ice 定，2026-10-22）：編更「其他」tab 同我的更表共用。
// 開工日 WORK_CODES：工時（小時），部分有固定上下班（秒，由 00:00 起計）。
// 假期 OFF_CODES：有薪工時（小時）；CL 係 0。
const at = (h, m = 0) => (h * 60 + m) * 60

export const WORK_CODES = {
  SPH7: { hours: 7 },
  SPL7: { hours: 7 },
  SPT7: { hours: 7 },
  SPT75: { hours: 7.5 },
  TRG: { hours: 7 },
  TRGK: { hours: 7 },
  TRGL: { hours: 7 },
  SLP: { hours: 7.5, on: at(15), off: at(23) },
  SEP: { hours: 8, on: at(6, 45), off: at(15, 15) },
  JCC: { hours: 7 },
  SPKE: { hours: 7.5, on: at(7), off: at(15) },
  SPKL: { hours: 7.5, on: at(15), off: at(23) },
}

export const OFF_CODES = { CL: 0, CP: 7, GH: 7, PH: 7, SH: 7, SL: 7, WB: 7 }

export const EXTRA = [...Object.keys(OFF_CODES), ...Object.keys(WORK_CODES)]

const upper = (code) => String(code ?? "").toUpperCase()

export const isWorkCode = (code) => Object.hasOwn(WORK_CODES, upper(code))
export const isOffCode = (code) => Object.hasOwn(OFF_CODES, upper(code))

// 開工日嘅 { hours, on?, off? }，或者 null。
export const workOf = (code) => (isWorkCode(code) ? WORK_CODES[upper(code)] : null)

// 呢個代碼俾嘅工時（假期係有薪工時），唔係其他代碼就 0。
export const extraHours = (code) => (isWorkCode(code) ? WORK_CODES[upper(code)].hours : isOffCode(code) ? OFF_CODES[upper(code)] : 0)
