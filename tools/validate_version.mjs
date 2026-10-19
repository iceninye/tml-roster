// 頁尾顯示嘅 BUILD.version 要同 CHANGELOG 最新一節對得上。
// 之前幾次都係改咗 CHANGELOG 但漏咗 app.js 嘅 BUILD（審計報告 item 8），所以加個檢查。
import { readFileSync } from "node:fs"

const app = readFileSync(new URL("../assets/app.js", import.meta.url), "utf8")
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8")

const build = app.match(/const BUILD = \{ version: "([0-9.]+)"/)?.[1]
const latest = changelog.match(/^## v([0-9.]+)/m)?.[1]

if (!build || !latest) {
  console.error("validate_version: 搵唔到 BUILD.version 或 CHANGELOG 版本")
  process.exit(1)
}
if (build !== latest) {
  console.error(`validate_version: BUILD=${build} 但 CHANGELOG 最新=v${latest}（請對齊）`)
  process.exit(1)
}
console.log(`validate_version OK (v${build})`)
