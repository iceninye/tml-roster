// Copy the duty cards and station names from TML-traffic (the public repo that
// parses the Duty Sheets), then check the copy:
//   node tools/sync-duties.mjs [ref]        ref = branch or commit, default main
// Run it after TML-traffic ingests a new Duty Sheet, then bump the shell cache
// in sw.js (and its SHELL list when a sheet is added).
import { mkdirSync, writeFileSync } from "node:fs"

const ref = process.argv[2] ?? "main"
const base = `https://raw.githubusercontent.com/iceninye/TML-traffic/${ref}`
const get = async (path) => {
  const response = await fetch(`${base}/${path}`)
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.text()
}

const index = JSON.parse(await get("data/duties/index.json"))
mkdirSync(new URL("../data/duties/", import.meta.url), { recursive: true })
writeFileSync(new URL("../data/duties/index.json", import.meta.url), `${JSON.stringify(index, null, 1)}\n`)
for (const sheet of index.sheets) {
  const text = await get(`data/duties/${sheet.file}`)
  const book = JSON.parse(text)
  if (book.duties.length !== sheet.duties) throw new Error(`${sheet.file}: index says ${sheet.duties}, file has ${book.duties.length}`)
  writeFileSync(new URL(`../data/duties/${sheet.file}`, import.meta.url), text)
  console.log(`✓ ${sheet.file} (${sheet.duties} duties)`)
}

const network = JSON.parse(await get("data/tml-network.json"))
const names = Object.fromEntries(Object.entries(network.stations).map(([code, s]) => [code, { tc: s.tc, en: s.en }]))
writeFileSync(new URL("../data/stations.json", import.meta.url), `${JSON.stringify(names, null, 1)}\n`)
console.log(`✓ stations.json (${Object.keys(names).length} stations)`)
