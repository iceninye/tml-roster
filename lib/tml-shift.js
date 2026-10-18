// 更類：死早 / 早 / 中 / 夜 / 死夜。
// 主頁（我的更表）同編更頁共用同一標準，免兩邊分得唔同。
// Pure: 只收秒數，冇 DOM、冇 storage。

const DAY = 86400

// 按上班時間排序，所以「隔籬」= 時間接近。
export const SHIFTS = ["dawn", "early", "mid", "late", "night"]

// 死早：06:30 前上班。死夜：翌日 00:30 後下班。
// 其餘按上班時間：10:00 前早，15:00 前中，之後夜。
export function shiftOf(on, off) {
  if (on == null) return ""
  if (on < 6.5 * 3600) return "dawn"
  if (off != null && off > DAY + 0.5 * 3600) return "night"
  return on < 10 * 3600 ? "early" : on < 15 * 3600 ? "mid" : "late"
}
