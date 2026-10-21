// Duty 資料（更份卡片、官表上落班時間、站名）只存喺 TML-traffic：嗰邊匯入新
// Duty Sheet 或者總表，呢度下次開頁就讀到，唔使再複製。
// 先讀 TML-traffic 網站（Cloudflare，_headers 開放 data/*），讀唔到就讀 GitHub main 嘅 raw 檔。
// 離線時由 sw.js 嘅快取答。冇 DOM，測試可以傳假 fetch。

export const DATA_BASES = [
  "https://tml-traffic.iceninye.workers.dev/",
  "https://raw.githubusercontent.com/iceninye/TML-traffic/main/",
]

// path 例如 "data/duties/index.json"；逐個來源試，全部失敗先 throw。
export async function fetchData(path, { bases = DATA_BASES, fetcher = fetch, timeout = 8000 } = {}) {
  let last = null
  for (const base of bases) {
    try {
      const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(timeout) : undefined
      const response = await fetcher(base + path, { cache: "no-cache", signal })
      if (!response.ok) throw new Error(`${base}${path}: ${response.status}`)
      return await response.json()
    } catch (error) {
      last = error
    }
  }
  throw last ?? new Error(`${path}: no source`)
}

// data/tml-network.json → { 站代號: { tc, en } }
export function stationNames(network) {
  return Object.fromEntries(Object.entries(network?.stations ?? {}).map(([code, s]) => [code, { tc: s.tc, en: s.en }]))
}

// data/tml-network.json "places" → { 代號: 名 }：車廠、側線、調頭位置（OS 外放車、CIOT 第一城側線 ...）。
export function placeNames(network) {
  return Object.fromEntries(Object.entries(network?.places ?? {}).filter(([, p]) => p?.tc).map(([code, p]) => [code, p.tc]))
}

// 某日嘅更份用邊份 Duty Sheet。通常係編號頭 4 位；但有啲特別日子嘅 sheet 同另一份共用編號
// （2026-11-01 馬拉松 7091M 都係 7091xxx），所以先睇 index 入面邊份 sheet 嘅 dates／alsoOn 有呢日。
// sheets = data/duties/index.json 嘅 sheets；未讀到就當冇特別日子。
export function sheetForDate(sheets, date, code) {
  const prefix = String(code ?? "").slice(0, 4)
  const dated = (sheets ?? []).find((sheet) => sheet.code !== prefix && sheet.code.startsWith(prefix) &&
    [...(sheet.dates ?? []), ...(sheet.alsoOn ?? [])].includes(date))
  return dated?.code ?? prefix
}
