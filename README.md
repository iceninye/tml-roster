# TML Roster · 我的更表

屯馬綫 Duty Sheet 個人版面：貼上自己嘅 roster 一次，之後逐日、逐週睇自己嘅更份（上班、下班、地點、用膳、全日行程）。

- **更表只存喺你部機嘅瀏覽器**（`localStorage`），唔會上傳；repo 入面冇任何人嘅 roster。
- 純靜態網站，無 build step，由 Cloudflare Workers static assets 提供（`wrangler.jsonc`）。
- 更份資料（`data/duties/`）係由公開 repo [TML-traffic](https://github.com/iceninye/TML-traffic) 解析 Duty Sheet 後複製過嚟。

## 用法

1. 首次打開，貼上 roster：每行一星期，週一至週日 7 格，可以連行號；CSV、Tab 分隔都得。格可以係 7 位更份編號（頭 4 位係 Duty Sheet，例如 `1101179`）、`RD` `AL` `SH` `HC`，或後備更 `HSP1` `KSP3`。
2. 填「本週係第幾行」。之後逐週跟循環，行完最後一行返去第一行。
3. 週頁每日顯示更份同上下班；點一日睇全日行程（今日會標示現時做緊乜）。
4. 特別情況（例如 8022／8023）：點該日，直接改成 `8022131` 之類編號或代號，亦可以還原預設。
5. 換機前用「設定 → 匯出備份」，之後貼返入設定頁還原。

## 開發

```
python3 -m http.server 8000      # 開 http://localhost:8000
node tools/validate_roster.mjs   # roster 邏輯檢查（用虛構 roster）
node tools/sync-duties.mjs       # 由 TML-traffic 同步更份資料
```

TML-traffic 解析新 Duty Sheet 後，執行 `sync-duties.mjs`，再將 `sw.js` 嘅 `CACHE` 版本加一（新增 sheet 要同時加入 `SHELL`），然後發佈。

版本號同 commit：`assets/app.js` 頂部嘅 `BUILD`，每次發佈同步更新 `CHANGELOG.md`。

## 授權

程式碼 MIT（見 `LICENSE`）。更份資料唔屬 MIT 範圍，見 `NOTICE.md`。
