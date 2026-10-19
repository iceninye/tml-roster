# Changelog

## v0.9.12 — unreleased
- 編更: **每星期匯入下星期 Standard Roster** —— 匯入框放咗喺頁頂，預設下星期；揀本週或之前會拒絕（唔會覆蓋本週），揀其他星期會先問。組員按**名稱**配對，所以每星期下移一行之後喜好照樣記住（`plan.known`）；匯入星期之前嘅編排保留，之後嘅星期如有手動改動會先問先重新開始。
- 編更: 刪走表頭每日剔選同 Duty Sheet（1101／6091…）選擇；「自動」只按剔選嘅組員。
- 編更: 「組員」欄可按**行數**或**姓名**排序（記喺呢部機）。
- 編更: 文字整理（「偏好」統一做「喜好」、週數用中文）、加「使用步驟」，設定入面嘅組員行號改做進階。
- 我的更表: 頁尾版本號跟住升到 v0.9.12，冇其他改動。

## v0.9.11 — unreleased
- 工具: 新增 `tools/validate_version.mjs` —— 檢查頁尾 `BUILD.version` 同 CHANGELOG 最新一節一致（之前幾次漏 stamp）。
- 我的更表: 頁尾版本號更新為 v0.9.11（之前漏咗，顯示 0.9.9）。
- 我的更表: **雲端時間一律用香港時間（GMT+8）顯示** —— 之前直接切 Worker 回傳嘅 UTC ISO 字串，例如雲端 14:58 UTC 會顯示成「14:58」，比實際慢 8 個鐘。現在用 `Intl.DateTimeFormat` 指定 `Asia/Hong_Kong`，就算部機時區唔係香港都一樣顯示 HKT。

## v0.9.10 — unreleased
- 我的更表: **今日卡（休息／假期／待定）整靚啲** —— 之前 78px、同開工卡一樣用橙色更份底。現在代號做 **44px 大字**、狀態（法定假日／休息日／年假）16px、左邊 6px 色帶（休息綠／假期藍／待定黃／後備灰）、背景按類型用漸變（休息綠調、假期藍調、待定琥珀調），最小高度 **132px**。手機 380px 以下代號 38px。

## v0.9.9 — unreleased
- 我的更表: **「死夜」改深灰藍＋斜紋** —— 之前靛藍色同「夜」嘅紫色喺細色條上分唔到；而家色條同時間條用斜紋，今日卡用深藍黑漸變。編更頁跟同一個 `--night`。
- 我的更表: 日卡唔再重複本週最常見嘅組別（例如全週都係 KSR 就唔寫，HHS 呢類唔同嘅先顯示）；日卡時間條去咗 4 小時刻度，只留今日卡。
- 我的更表: 設定頁輸入框統一（灰底、12px 圓角、44px 高）；「更表名稱」輸入框唔再因為隱藏 label 而縮入。
- 我的更表: 桌面版左欄喺今日卡下面加「本週概況」（開工日、工時、休息／假期、休息唔夠日數、各更類日數）。手機版唔顯示，避免加長。
- 我的更表: **齒輪旁「未上傳」點** —— 有 token 而更表（名稱、每格、名字、基準週、手動改動）同上次上傳／下載唔同，齒輪會有一粒琥珀色點，同步面板亦寫「呢部機有改動未上傳到雲端」。冇 token 或者網址唔支援同步就唔顯示。
- 我的更表: 同步訊息 class 改為 `me-msg me-sync-msg`，同頁頂嘅 `.me-msg` 分得開。
- 頁尾版本號更新為 v0.9.9。

## v0.9.8 — unreleased
- 我的更表: **「由雲端下載」確認框講反方向** —— 由 `syncConflict`（用呢部機覆蓋雲端）改為 `syncOverwriteLocal`（雲端會取代呢部機）；取消時訊息亦改為「冇下載：呢部機嘅更表保持不變」。
- 我的更表: **休息唔夠鐘同編更頁對齊** —— 門檻 11 → **12 小時**（同 `plan.rest` 預設一致）；`shortRestDates()` 改為由**上週日**開始比較，唔會再漏「上週日夜更 → 週一早更」。
- 我的更表: **service worker 唔再快取 `/api/`** —— 之前會 cache `GET /api/roster/<token>`，離線時靜靜攞返舊版本，而且 token 會留喺 cache 網址。
- 我的更表: **冇 Workers API 嘅網址（GitHub Pages 版）自動收埋同步面板** —— 開頁探一次 `GET /api/ping`；唔支援就只顯示一句「請用 workers.dev/ice/」，唔會再彈「同步失敗」令人以為 token 錯。離線時探唔到就照舊顯示面板，唔會誤報。
- 我的更表: 同步說明照實講（雲端會存更表、每行名字、基準週、手動改動）；`spareNote` 改為「後備更未有上下班資料」；修正檔頭「nothing is uploaded」過時註解。
- 我的更表: 下載時**雲端有 `overrides` 欄位就以雲端為準**（刻意清空都跟），舊記錄冇欄位才沿用本機。
- 我的更表: 自動重畫由每秒改為 **15 秒**（時間軸以分鐘為單位）。
- Worker: 新增 `GET /api/ping`；名字長度上限 24 → **40**（同 `lib/tml-roster.js` 一致，避免上傳再下載靜靜變短）。
- 頁尾版本號更新為 v0.9.8。

## v0.9.7 — unreleased
- 我的更表: 同步面板加「產生 token」掣（`crypto.getRandomValues` 生 32 位 `a-z0-9`）同「複製」掣；已有 token 時會先確認先換。換 token 會將本機版本號重設為 0。同步訊息改喺面板底顯示。
- 我的更表: 日卡縮短 —— 取消等高，工時併入路線行（「… · 7 小時」），休息日／假期卡縮成窄條；手機上一週大約一屏睇晒。
- 我的更表: 設定頁 roster 預覽表縮細 —— 每格 34px 高、字級跟屏幕闊度（8.5–12px）、`table-layout: fixed`，390px／360px 手機七欄放得落；更窄嘅屏幕先橫向捲動。現時行改為 600 粗，七位代號唔再黐埋。
- 頁尾版本號更新為 v0.9.7。

## v0.9.6 — unreleased
- 我的更表: 刪走「記住 token」掣 —— 貼完 token 直接撳「上傳到雲端」或「由雲端下載」就會自動記住（`adoptToken()`），少一個步驟。
- 我的更表: **雲端記錄補齊 `names` / `anchor` / `overrides`** —— 之前只存 `title + rows + numbers`，第二部裝置下載時冇「基準週」同「手動改動」，會用「今週」做基準，兩邊睇落唔同步。Worker `cleanRecord()` 相應驗證 `anchor.row` 要喺 `numbers` 之內、`anchor.monday` 要 `YYYY-MM-DD`、`overrides` 最多 400 條。
- 我的更表: **第一次用（設定頁）就有同步 token 位** —— 新機／清咗瀏覽器可以直接貼 token 撳「由雲端下載」攞返更表，唔使先匯入一次。未載入更表時只顯示「記住 token」同「由雲端下載」（冇嘢可上傳）；第一次下載唔會彈「覆蓋」對話（冇本地資料可蓋），成功後直接跳入週視圖。首頁說明改為「預設只存呢部機；想跨裝置就貼 token」。
- 我的更表: 一週日卡改為**單欄、由上至下**（週一 → 週日）。之前闊螢幕會自動變兩欄，閱讀次序變成「左→右、再跳行」嘅 Z 形；`@media (min-width: 900px)` 嗰條 `auto-fill` 規則已移除，改為單欄 + 最大闊 620px。
- 我的更表: 代號字級統一 —— 今日卡 16px→**15px**、休息日／假期代號由 **500 改回 700 粗**（仍用灰色）、更表預覽表格全部 **700**。之前同一個 `RD` 喺三處唔同粗細，睇落好散。
- 我的更表: 一週七張日卡**同一行等高**（`.day-list > li` flex + `.day { height: 100% }`），休息日唔再矮一截。
- 我的更表: 休息日／假期卡改排版 —— 粗體代號（`RD`）＋細字狀態（`休息日` / `年假`），唔再排成一句「休息日 RD」。
- 我的更表: 日卡左邊顏色條 —— 更份（橙，跟班別色）、休息（綠）、假期（藍）、待定（黃）、後備（灰）。
- 我的更表: 每張卡顯示工時（官表時數優先，冇就用 duty sheet 嘅 `work`）；路線行已經有「X 小時」就唔重複顯示。
- 我的更表: `cellInfo()` 新增 `tone: "leave"`（`AL`／`SH`），同 `rest`（`RD`）分色。

## v0.9.5 — unreleased
- Workers: 「我的更表」多一個入口 `/ice/`（同 `/roster` 一樣），靠 `_redirects` 嘅 `/ice/* /:splat 200` 令相對路徑資產照樣載入；GitHub Pages 唔識 `_redirects`，完全唔受影響。
- 我的更表: 加「休息唔夠 11 小時」提示 —— 前一日下班到下一個開工唔夠 11 小時，該日會顯示紅色標籤同**呼吸式閃動紅框**（同編更頁一致，跟系統 `prefers-reduced-motion`）。
- 我的更表: 更表預覽表格每格高度統一 58px、字級 12px（同編更頁一致）。
- 我的更表: 頁尾「提示」同備份說明改為預設收埋，撳一下才展開。
- 我的更表: 今日時間軸加粗到 10px、加每 4 小時刻度、加「現時」光點。
- 我的更表: 設定頁新增「跨裝置同步」（Workers KV）—— 貼一條 token 就可以上傳／下載更表；寫入帶 version，雲端有新版本就 **409 + 問你**，唔會無聲蓋掉（B1）。token 只存喺本機 localStorage。
- Workers: `src/index.js` 加 `/api/roster/<token>`（GET/PUT）；冇 token 一律 404（冇 listing）、token 要 `[a-z0-9]{20,64}`、body ≤128 KiB、`no-store`；`src/` 已加入 `.assetsignore`，Worker 原始碼唔會公開。
- 我的更表: 字眼同編更頁對齊 —— `Roster 內容` → `Standard Roster 內容`、`匯出 CSV` → `匯出 CSV（一週一行）`、`連手動改動（JSON）` → `匯出備份（JSON，包手動改動）`、`還原預設` → `還原`。
## v0.9.4 — unreleased
- 編更: 所有積木（週表格仔、待定區積木、其他積木）統一高度 58px、固定三行（代號／時間／班別），假期積木冇時間都佔返同一高度，唔會再矮一截。
- 編更: 撳空格之後，bar 上面「更份編號」輸入格隔籬多一排「加假期/其他」掣：`RD`、`AL`、`SH`，同埋「其他」（展開 12 個其他積木：CL、CP、GH、PH、SL、WB、SPH7、SPT7、SPT75、TRG、TRGK、TRGL）。撳一粒即刻放入呢格，唔使再按「改」。
- 編更: RD／AL／SH 放入格仔一定扣當日待定區同款積木；待定區已經冇嗰款積木就彈 alert 提你，唔會再靜靜扣走該同事嘅標準更份積木（`setCell` 嘅 fallback 只留返畀其他代號）。
- 編更: 工具列字眼縮短 — `自動編排` → `自動`、`自動套用：開／關` → `自動填入：開／關`、`↶ 還原上一步` → `↶ 還原`（兩個掣都叫「自動」會撞，所以後者叫「自動填入」）。
- 編更: 「注意事項」預設收埋（summary 仍然顯示數量），撳一下才展開；每次開頁都係收埋。
- 編更: 修正選取 bar 被底部「待定區」蓋住下半截（撳唔到掣）—— bar 嘅 `z-index` 由 4 提升到 7（高於待定區嘅 6）。
- 編更: 休息唔夠鐘嘅紅框改為呼吸式閃動（1.2 秒一循環），跟系統 `prefers-reduced-motion` 設定：開咗「減少動態效果」就變返靜態紅框。

## v0.9.3 — unreleased
- 編更: 「匯出備份」改為真下載 `roster-<日期>-v1.json`（同一日再匯出就係 v2、v3…，每日由 1 開始）（唔再要自己複製文字框）。備份包埋 Standard Roster，換機或清瀏覽器之後一次還原得到；舊備份（冇 roster 嘅）一樣匯入得，會提你補匯 CSV。
- 編更: 未有 Standard Roster 時都見到「匯入備份」，所以新機可以直接由備份還原。
- 編更: 自動套用 開／關 switch. Off, a change to a member fills nothing; 自動編排 still fills on demand.
- 自動編排 can be narrowed: tick members (box by the name) and/or days (box in the head); nothing ticked is the whole team.
- An HC or TBC block lists the free duties of its day's Duty Sheet (not in a cell or the tray) to pick from, by book-on time; typing a number still works.
- 待定區 其他 tab: CL, CP, GH, PH, SH, SL, WB (days off, with paid hours), SPH7, SPT7, SPT75, TRG, TRGK, TRGL, and 自定 for any code. They go on any day and use up the member's own block.
- A cell holding a day off or other code has a 清空 button.
- 匯出本週 CSV downloads a file (tml-plan-2026-W43.csv, Excel-ready) with each member's codes and hours.
- 注意事項 above the table lists short rest, members with no RD, empty cells, duty numbers not on the sheet, and blocks left in the tray; tap one to go to its cell.

## v0.9.2 — unreleased
- 我的更表: 桌面 (≥900px) 用兩欄 — 左邊今日卡，右邊一週七日兩欄排；唔使再由頭碌到尾。
- 今日只出現一次：上面嘅今日卡已經係今日，一週清單唔再重複嗰日。
- 頁首副標只留一句實用資訊：Standard Roster 第幾行、開工幾日、總工時。原本嘅週概況 chips 同更類圖例刪走。
- 更類分五級，同編更頁共用 lib/tml-shift.js：死早（06:30 前上班）、早、中、夜、死夜（00:30 後下班）。今日卡同每日卡嘅顏色跟更類；休息／待定用中性深灰。
- 今日卡嘅時間條有「現時」指示。
- 同一地點唔再寫兩次（「錦上路 → 錦上路」變「錦上路」）。
- 「我嘅 roster」表格字大一級（11px），預設收埋，撳一下才打開（refresh 都唔會自動開）；入面預設只顯示本週附近 5 行，可以撳「全部 N 行」。
- 週標題帶年份（2026/10/12 – 10/18，跨年會寫成 2026/12/28 – 2027/1/3）；第二行只留「本週」或「回到本週」。
- 換週：手機喺更表左右滑動、桌面鍵盤 ← →；頁尾嘅「設定／備份」搬去頁首右上齒輪，撳入去再撳同一粒就返主頁。
- 更表名稱可以喺設定頁改（存喺呢部機），撳頁首標題就跳去改名。
- 日詳情頁頂顯示更份編號，隔籬有 ✏️ 即場改：Enter 或 ✓ 儲存、Esc 取消；改過嘅日子先會出現「還原預設 ↺」。原本嗰段長氣說明同「儲存」按鈕刪走。
- 設定頁嘅「貼上你嘅 roster」改為「貼上 Standard Roster」；設定頁標題「更表設定」刪走。
- 設定頁：第 2 步標題由「講低今個星期係第幾行」縮短成「行號」（日期提示已經喺欄位標籤）；行號同更表名稱嘅輸入格縮細，隔離就係「確認」掣；兩個長氣說明字句刪走。「確認」就係儲存（設定頁只剩一個掣），撳完直接返主頁。
- 「匯出備份」改為直接下載 CSV（`tml-roster-<日期>.csv`，帶 BOM 開 Excel 唔亂碼），可以原封不動貼返入「Roster 內容」還原；手動改過嘅日子另備一條「連手動改動（JSON）」下載。
- 日詳情嘅飯腳只列頭 3 個，其餘收喺「其餘 N 個飯腳」。
- 工時一律用官表（`data/duty-basic.json` 嘅 Index 表）為準；後備更（KSP／HSP）都靠佢。
- 修正官表 Index 印錯嘅 4 個更份時數（`data/duty-hours-fixes.json`）：1101107 = 6.5、1101131 = 8、6091137 = 8、8022137 = 8、8022142 = 10。之前一個 1101131 就令整週總工時少／多 0.5 小時。
- 新增 `node tools/validate-hours.mjs`：逐個更份核對官表同 duty sheet 嘅時數，新嘅唔一致會即刻報錯。
- 後備更（KSP／HSP）計入開工日同工時；之前當成待定，令一日開工同日數都漏咗。
- 內部：週標題、附近行、週概況搬去純邏輯 module lib/tml-week.js，五級更類喺 lib/tml-shift.js；`node tools/validate_roster.mjs` 補咗 25 個檢查（更類邊界 06:30 / 10:00 / 15:00 / 00:30、跨年週標題、附近行頭尾、工時只計真更份）。

## v0.9.1 — unreleased
- 編更: filling follows preferences again when they are set after the row was filled: a member's auto-filled duties go back to the tray and the week is chosen again. The week is chosen as a whole, so a late duty is never followed by too little rest; a cell is left empty sooner than short of rest. 自動編排 solves each day again once its neighbours are known.
- Plans saved before v0.9 start their weeks over in the tray (the team, preferences and Duty Sheets stay).
- 待定區 has a 組合 tab: each Standard Roster row of the team, while all its blocks are in the tray, can go on one member in one go. The blocks can still be used one by one.
- 待定區 filter (死早 / 早 / 中 / 夜 / 死夜 / 假期 / HC／TBC) and sort (上班時間 / 下班時間 / 更份編號), for blocks and combinations.

## v0.9.0 — unreleased
- 編更: the CSV import has its own year and ISO week (the base week of the CSV); the page opens on next week. The week title shows the year, e.g. 2026 · Week 43.
- Every week starts with all of the team's blocks in the 待定區 and the cells empty, not only the imported week. 本週重新開始 puts the week back that way; 全部放入待定區, 假期放入待定區 and 還原 Standard are gone.
- Setting a cell uses up a block of that day (the same code, or for a leave the member's own block) and sends what the cell held back to the tray, so the annual-leave week uses up its blocks.
- HC and TBC blocks stay in the tray until given a 7-digit duty number; a cell can't be set to HC or TBC.
- 自動編排 (was 按偏好自動編排) fills the whole team's empty cells from the tray by preference and rest, skipping members with no RD in the week. 編多週 is gone.
- 還原上一步 button and Ctrl+Z / ⌘Z undo the last change. The table head shows each day's empty cells; the tray shows each day's block count.

## v0.8.4 — unreleased
- 編更: the 年假 button is gone. A member on AL Monday to Wednesday takes the whole annual-leave week (AL AL AL SH SH RD RD).
- Auto-fill works on the member changed only: a preference, a leave or a block sets that member's empty days from the day trays. A week needs one RD before it fills.
- The settings title shows the week and its dates.

## v0.8.3 — unreleased
- 編更: the HC status is labelled HC (not 待定), like TBC, to be changed by hand.

## v0.8.2 — unreleased
- 編更: a 下載匯入範本 button gives the CSV template (141 rows, 7 cells; RD is a placeholder). The setup form and the import message show the ISO week and its dates, e.g. 第 42 週：2026/10/12 至 2026/10/18.

## v0.8.1 — unreleased
- 編更: the rest between duties is fixed at 12 hours (the input is gone). Import and 全部放入待定區 put every block of the team in the tray, including HC and TBC: 7 blocks per member. TBC and HC blocks can be dropped in a cell and its duty number typed.

## v0.8.0 — unreleased
- 編更: importing (or 全部放入待定區) puts every duty, RD, AL and SH of the team in the 待定區 and empties the cells. Setting a preference, leave, a block or a Duty Sheet fills the empty cells by preference straight away; RD blocks show their weekday, e.g. RD(四).
- 年假 chip on each member: fills the row AL AL AL SH SH RD RD (pinned); tap again to undo.
- A date on a special Duty Sheet (e.g. 8022) puts all of that sheet's duties in its tray. Each block has a ✕ to delete it, until the day's blocks equal the members needing one.

## v0.7.1 — unreleased
- 編更 is a separate page: open `plan.html` directly (no link from 我的更表). It imports and keeps its own Standard Roster (`tml-plan-roster`) and no longer reads or writes the personal roster (`tml-roster`).

## v0.7.0 — unreleased
- 編更: a 積木區 (tray) under the table. Drag a duty out of a cell into its day's column, then drop it on any cell of the same day; a duty already there goes back to the tray. Duties nobody can take after auto-arranging land there too.
- Drag and drop now uses pointer events: mouse drags at once, touch after a short hold (moving sooner scrolls the table); drop targets light up, the table scrolls near its edges, and cells of the same day swap. Tapping a cell then another cell, a block or a tray column does the same.
- Member names and preferred shifts are set right in the table; the separate members panel is gone.
- HC (pending) cells are never touched by auto-arrange; fill them by hand or with a block.
- The table keeps its scroll position after each change.
- CSV import with a Name column (`,Name,Mon,Tue,Wed,Thu,Fri,Sat,Sun`, then `row,name,7 cells`) on both pages; the header line is skipped. On 編更 the rows with a name become the team and their names are filled in. A row of seven TBC cells does not rotate and stays on its own row; TBC cells are pending like HC.
- 積木區 is now 待定區 and also takes rest days and leave: drag an RD / AL / SH cell into it (or "假期放入待定區" for the whole week) and drop it on another cell of the same day. Auto-arrange leaves these blocks alone.
- Each date can be set to a Duty Sheet (1101 / 6091 / 7091 / 8022 / 8023) from a menu under the day: that day's Standard Roster duty numbers keep their last three digits and take the sheet's (6091124 on 8022 reads 8022124). Duties already planned follow; 8022 / 8023 times come from the duty cards, and a number the sheet lacks shows in red.

## v0.6.0 — 2026-10-17
- New 編更 page (`plan.html`): pick a base week and the team's rows (for example Week 42, rows 31–40 and 55–70); every later week each member moves one row down, wrapping after the last row.
- Each member gets a name and preferred shifts: 死早 (book on before 06:30), 早, 中, 夜, 死夜 (book off after 00:30).
- 按偏好自動編排 hands round the team's duties of each day (never across days; rest days and leave stay) to match preferences, spread misses fairly and keep the minimum rest (11 h by default, flagged in red when short). It can run over several weeks in a row.
- Swap two cells of the same day by drag and drop, or tap one then the other; tap a cell to change that one date. Hand-made changes are pinned and kept by the next arrangement.
- Plan kept only in this browser; export / import as JSON and the week as CSV. Link to it from the week page.

## v0.5.0 — 2026-10-17 (`179a751`)
- Visual redesign: one colour system for dark and light, softer cards, clearer type scale.
- Week page: a "today" card on top with the duty, a 24-hour strip and what the duty is doing right now; week navigation is a bar with the date range and roster row; each day card shows the day number large and a strip marking the shift.
- Day page: a vertical timeline with a dot per kind of leg (revenue, empty, meal, ride), times above and places below; 飯腳 are tappable chips.

## v0.4.0 — 2026-10-17 (`de04c8f`)
- Spare duties (HSP1–3, KSP1–4, TSP1–4, SEP, SLP …) and duties whose sheet has no card here now show book-on/off time, place and working hours, from the new `data/duty-basic.json` (built by `tools/index-to-basic.py` from a duty workbook's Index sheet; remarks are not copied).
- Readability: early / middle / late duty colour bar and tag, 翌日 marker when a duty books off after midnight, larger type, sticky week navigation, a colour legend.

## v0.3.0 — 2026-10-17 (`200bd61`)
- Import: pick a .csv / .tsv / .txt file besides pasting; tab-separated rows with no row numbers (copied from Excel) read as rows 1, 2, 3 …
- Live preview on the setup page: as you paste or pick a file it shows the rows read, any bad lines, and whether the row number you gave exists.
- The imported roster is shown as a table on the week page and on the settings page, with this week's row and today's cell marked.

## v0.2.0 — 2026-10-17 (`050b0cb`)
- Layout: the week is a list of day cards (big book-on/off times, duty number, meal), today highlighted; the day page leads with book-on/off and puts the edit box below; setup is two numbered steps with a format guide and example.
- Wording rewritten in one plain Cantonese voice, with help text for the row number, 飯腳, backup and day edits.
- Deployed to GitHub Pages (`.github/workflows/pages.yml`); README rewritten as a quick start.

## v0.1.0 — 2026-10-16 (`336a40d`)
- First version, moved out of TML-traffic v0.9.0 (我的更表, never merged there): paste your roster, follow the weekly cycle, change single days, full duty card with 飯腳, backup and clear. Stored only in this browser (`tml-roster`; a roster saved by the TML-traffic preview under `tml-traffic-roster` is picked up).
- Duty cards copied from TML-traffic (DS1101, DS6091, DS7091, DS8022, DS8023) with `tools/sync-duties.mjs`.
