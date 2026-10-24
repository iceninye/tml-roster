# Changelog

## v0.9.39 — unreleased
- 我的更表（Ice 2026-10-24）:
  - 刪走首頁底部「我嘅 roster（N 行）」整格（表、只睇附近／全部、說明）。設定頁貼上時嘅預覽照舊。
  - 今日卡「明天」自己一個框，同上面嘅飯腳、工時、下一更等分開（同今日卡裡面嗰個資料框一樣嘅底色），間距 8px。
  - 設定頁取消所有編號（以前只有「貼上 Standard Roster」同「行號」有 1、2）；格同格之間行距統一 14px（貼上同行號嗰個 form 以前格之間多咗 12px，冇訊息時仲多一行空位）。
- Shell cache 改名 `v69`。

## v0.9.38 — unreleased
- 同事更表（Ice 2026-10-24）:
  - 刪走下面「撳更份睇詳情…」嗰段提示。
  - 設定頁揀同事：每格剩編號同剔格（名放喺撳住時嘅提示），一行 6 格（窄機 5 格），唔再一行兩格。
  - 第一欄：同事嗰行第一行改做可以手動改嘅名稱（撳入去打，離開輸入框就儲存，跟雲端同步），下面細字先係行數；未改名之前唔再寫兩次行數。「我」嗰行照舊。
- 設定頁（Ice 2026-10-24）: 所有項目（貼 Standard Roster、行號、更表名稱、同事更表、備份、跨裝置同步）預設收埋，撳標題先打開，記住打開咗邊格；每次入設定都由全收埋開始（撳 🔔 提示入去就打開「同步」，撳頁首更表名就打開「更表名稱」）。第一次用（未有更表）嘅設定頁照舊攤開。
- Shell cache 改名 `v68`。

## v0.9.37 — unreleased
- 同事更表（Ice 2026-10-24）: 右上角 ⚙ 撳第一下入設定，第二下睇同事更表，第三下返主頁（未揀同事就跳過）。
  - 設定頁新「同事更表」: 剔選同事（本週行號，有名就顯示名）。之後每個星期自動跟佢哋跳去下一行，同自己一樣。
  - 顯示仿編更：每行一個人（第一行係自己，包括手動改），7 日橫排，格入面寫更份同上落班時間，顏色跟更類，今日有框；‹ › 同左右方向鍵換週；撳更份睇詳情。同事只跟 Standard Roster。
  - 「複製本週 CSV」: 複製去剪貼簿（行、名、週一至週日），可以貼去 WhatsApp／Excel；唔支援剪貼簿就下載 CSV。
  - 同事跟雲端同步（Worker 收 `mates`，最多 50 個）。
- 修正: 我的更表貼新 Standard Roster 之前會清走 OT 記錄，而家 OT 同同事都保留。
- 測試: `validate_roster`、`validate_worker` 加同事更表。
- Shell cache 改名 `v67`。

## v0.9.36 — unreleased
- 我的更表 OT 格（Ice 2026-10-24）: 「成更 OT」改做「OT」（剔格保留），「儲存 OT」改「儲存」、「清除 OT」改「清除」；行距收細；預設收埋，標題行寫住而家嘅 OT（例如「更後 OT 1 小時 30 分」），撳儲存或清除之後收埋。
- 每日備註: 日詳情 OT 下面加「備註」（最多 200 字，可以換行），同樣預設收埋。有備註嘅日子：週列表加 📝 一行、今日卡顯示、月曆右下角有細方塊。跟雲端同步（Worker 收 `notes`，最多 400 日、每日 200 字；上傳只送一年內嘅）。
- 今日卡: 最底加「明天」：返工就寫更份同上落班時間（今日落班至明天返工嘅休息時間，唔夠 12 小時有提示），放假就寫 RD／AL 等；明天有 OT 或者備註都寫埋。明天返工嘅話唔再重覆顯示「下一更」。
- 修正: 我的更表貼新 Standard Roster 之前會清走所有 OT 記錄，而家 OT 同備註都保留。
- 測試: `validate_roster`、`validate_worker` 加備註。
- Shell cache 改名 `v66`。

## v0.9.35 — unreleased
- 週標題（編更、我的更表）: 字大 2px（日期 18→20，窄機 16→18；下面一行 13→15）。編更大字改做同我的更表一樣淨係日期（2026/10/26 – 11/1），週數放落下面：「本週（第43週）」、「下週（第44週）」，其他週「第45週」。
- 🔒/🔓 週鎖（Ice 2026-10-24）: 週標題下面撳個鎖切換。
  - 我的更表: 鎖嗰陣影低嗰週 7 格（包括手動改同行號），之後貼新 Standard Roster、改行號都唔會變；鎖住期間唔可以改更份（冇 ✏️ ↺），OT 照改得。解鎖就返去跟而家嘅 roster 同手動改。鎖跟雲端同步（Worker 收 `locks`，最多 120 個；上傳只送一年內嘅）。
  - 我的更表: 貼新 Standard Roster 時，本週同之前 8 個星期未鎖嘅會自動鎖住（用舊更表影低），匯入唔會改到已經返咗嘅更。
  - 編更: 鎖住嘅週匯入新 Standard Roster 都唔會清走（積木、待定區、特別日 sheet 照留，組員照名搬去新行）；鎖住期間唔可以拖放、自動編排、本週重新開始（制停用，其他改動會講「鎖住咗」）。鎖住同解鎖都可以「還原」。
- 修正: 我的更表貼新 Standard Roster 之前會清走所有 OT 記錄，而家保留。
- 測試: `validate_roster`、`validate_plan`、`validate_worker` 加週鎖。
- Shell cache 改名 `v65`。

## v0.9.34 — unreleased
- 今日卡: 首三行（「今日 · 週六 10/24」、更份號碼、上下班時間）字體各大 2px，tags 唔變（14→16、15→17、36→38；窄機 32→34）。
- 月曆: 左邊加一欄週數（ISO 週，星期一開始），字比日期細 1px（11px）。
- Shell cache 改名 `v64`。

## v0.9.33 — unreleased
- 學校假期: Ice 再定只用 cal 1（vk7g…，學校假期），其餘 3 個日曆係其他活動，唔讀。
- 我的更表 OT 格精簡：刪「OT（加班）」標題同狀態、刪「（呢更嘅工時全部計 OT）」、刪長說明；剩返「成更 OT」、更前／更後、儲存／清除。
- 今日卡: 已經有 OT 顯示，唔再重覆寫「成更 OT」（更前／更後時數照寫）。
- 月曆: 刪下面嘅說明句（3 個數字、顏色、橙線、橙點、細點）。
- 月曆: 4 個字或以上嘅代號（例如 HSP1、TRGK、SPT75）之前俾截咗，而家按長度縮字，全部顯示得到。
- 測試: `validate_worker` 改做只讀 1 個日曆。
- Shell cache 改名 `v63`。

## v0.9.32 — unreleased
- 學校假期: 第一次嗰條 iCal 回 404（日曆唔公開）。改用 Ice 俾嘅 4 個學校日曆（Google Calendar cid），Worker 一齊讀、合併，同一個活動喺兩個日曆出現只留一個；每個活動帶 `cal`（第幾個日曆），之後要篩選可以用。讀唔到嘅日曆跳過，回應 `tried` 逐個寫 `ok` 或者原因（例如 404）；4 個都讀唔到先回 502。
- 測試: `validate_worker` 改做 4 個日曆（合併、重複、404、唔係 iCal、全部失敗）。
- Shell cache 改名 `v62`。

## v0.9.31 — unreleased
- 我的更表: 月曆（提示同「我嘅 roster」之間）。一個月一版，‹ › 換月，「本月」返今個月；更份只顯示最後 3 個數字（1101150 → 150），顏色跟更類（死早／早／中／夜／死夜）；RD、AL、SH、HC、後備更等照原樣顯示。今日有框，手動改過有細點，有 OT 嘅日子左上有橙點，撳任何一日睇詳情。
- 學校假期（Ice 2026-10-24）：Worker 新 `GET /api/school-holidays` 代讀指定嘅 Google Calendar iCal（瀏覽器直接讀會俾 CORS 擋；只讀呢一條，唔係任意 proxy），回前後一年嘅活動，Cloudflare 同瀏覽器快取 6 個鐘。月曆有學校假期嘅日子底部有橙線，月曆下面列出當月學校假期；今日卡加「學校」一行。上次讀到嘅存喺呢部機，離線都睇到。GitHub Pages 版冇 Worker，就唔顯示。新檔 `lib/tml-ics.js`（解析 iCal：長行、全日活動 DTEND、取消咗嘅活動；唔處理 RRULE）。
- 今日卡更清楚：大時間下面分開左右寫上班同下班地點；返緊工時進度條下面寫「已做 X · 剩 Y」；下面資料加「飯腳」（頭 3 個）同「工時」；字大咗（資料 16px、行距 1.5），淺字對比加強。
- 測試: `validate_roster` 加 iCal 解析；`validate_worker` 加學校假期（全日、跨年、取消、太舊、上游失敗 502）。
- Shell cache 改名 `v61`（`lib/tml-ics.js` 加入離線快取）。

## v0.9.30 — unreleased
- 我的更表: 🔔 雲端同呢部機邊個新啲。有同步 token 嘅話，開頁同返到前景（最多一分鐘一次）會讀一次雲端，同呢部機比較：「雲端較新」（講埋幾時、邊部機上傳）、「呢部機較新，未上傳」（講埋幾時改）或者「兩邊都改過」。週頁頂顯示一行，撳入去設定頁同步；設定頁同步面板顯示長句。只係讀，唔會自動上傳或者下載。內容一樣只係版本號唔同（例如另一部機上傳咗同一份）就靜靜跟上版本號，唔響。
- 呢部機記低最後改更表／標題嘅時間（`tml-roster-local-at`），🔔 用嚟講「呢部機幾時改」。
- 測試: `validate_worker` 加 `syncState` 幾種情況。
- 雲端內容比較包埋 OT（同 `kvPrint` 一樣）。
- Shell cache 改名 `v60`。

## v0.9.29 — unreleased
- 我的更表: 加 OT（加班）。日詳情頁新「OT」格：「成更 OT」（例如休息日返 1101150，成更 7 小時計 OT），同埋更前／更後 OT，打時數（例如 3.5）或者揀鐘數（例如做到 15:50），兩格自動對返。存喺更表新欄位 `ot`（日期 → `{ whole, before, after }` 分鐘），唔改更份代號。
- OT 日計開工日；OT 時數同正常工時分開計（Ice 2026-10-24）。更前／更後 OT 會延長顯示嘅上下班時間同埋 12 小時休息檢查；更類顏色跟原本更份。週列表同今日卡有「OT」badge，路線行尾寫「更後 OT 3 小時 30 分」。
- 頁首加「· 本月 OT X 小時」（1 號至月尾；睇緊本週跟今日嘅月份，其他週跟嗰週週一）；本週概況加「OT X 小時」。
- 同步: OT 跟更表一齊上傳／下載（只上傳一年內嘅）。Worker `cleanRecord` 收 `ot`（同前端一樣清理，更前／更後最多 12 小時，最多 400 日），內容比較同電郵備份都包 OT；冇 OT 嘅記錄指紋同舊版一樣，升級唔會誤報「未上傳」。舊記錄冇 `ot` 欄位就保留呢部機嘅 OT。JSON 備份包 OT。
- 新檔 `lib/tml-ot.js`（加入離線快取）。測試: `validate_roster` 加 OT 清理、匯出匯入、鐘數互換、月份、週概況計法；`validate_worker` 加 OT 同步、清理、上限。
- Shell cache 改名 `v59`。

## v0.9.27 — unreleased
- 編更: 匯入新一週 Standard Roster 時，plan 只保留匯入週之前 8 週（積木、待定區、特別日 sheet），以前只會越嚟越大，每次上傳同電郵備份都包晒（報告 P5）。
- 我的更表: 週一 04:00 之後，如果仲停喺舊一週（冇自己換週），回到前景或者 15 秒檢查時自動跳返本週（M10）。特別日提示：Standard Roster 寫 6091124 但當日行 8022，今日卡同更份詳情加一行「當日用 Duty Sheet 8022，你嘅更可能係 8022124，請檢查」，只提示唔自動換（M11）。
- 匯入 CSV 識得雙引號：名有逗號（`"Chan, Tai Man"`）唔再被拆開，匯出再貼返得（M9，兩頁都受惠）。
- Worker: 手動改動超過 400 個唔再靜靜截走最新嗰幾個，改為回 400 `too_many_overrides`（頁面顯示原因）；前端上傳前先刪走一年前嘅改動（M6）。
- Service worker: 頁面檔案 3 秒冇回應就先出快取，網絡背後繼續更新快取（D5）。
- CI: 新增 `.github/workflows/test.yml`，每個 PR 都行四個測試（加 `validate_version`），並比對 `lib/tml-duties.js` 同 TML-traffic main 係咪一樣（唔同只警告）；Pages workflow 都加 `validate_version`（D4、T8）。
- 測試: 加 CSV 引號、一年前改動、400 個改動邊界、`pruneWeeks`。
- Shell cache 改名 `v57`。

## v0.9.26 — unreleased
- 其他代碼（Ice 2026-10-22 定）放入共用表 `lib/tml-extra.js`，兩頁共用。開工日：SPH7、SPL7、SPT7、TRG、TRGK、TRGL、JCC 7 小時；SPT75 7.5 小時；SLP 7.5 小時 15:00–23:00；SEP 8 小時 06:45–15:15；SPKE 7.5 小時 07:00–15:00；SPKL 7.5 小時 15:00–23:00。假期：CL 0；CP、GH、PH、SH、SL、WB 有薪 7 小時。
- 編更: 「其他」tab 由 13 粒增至 19 粒（新加 SPL7、SLP、SEP、JCC、SPKE、SPKL）。開工日代碼計開工同工時（唔再標做「休息日」）。上落班時間：表入面有就用表（SLP、SEP、SPKE、SPKL），冇就用官表 duty-basic（例如 TRG、SPT7、SPH7）；有時間嘅顯示更類，參與休息時間檢查同喜好計算，但同其他代碼一樣放入格就用咗，唔會返去待定區。工時一律跟 Ice 嘅表（TRGK 7、TRGL 7、SPT75 7.5，官表係 7.5、7.5、7.0）。
- 我的更表: 開工日代碼計入開工日同工時（時間同上，地點用官表嘅），假期代碼（CL、CP、GH、PH、SL、WB）計假期；以前所有「其他」代碼都當待定，而且 SL 會誤顯示官表嘅時間。假期嘅有薪工時唔計入我的更表工時。
- 測試: `validate_plan` 加代碼表、工時、固定時間、SLP 唔入待定區；`validate_roster` 加週概況計法。
- Shell cache 改名 `v56`（`lib/tml-extra.js` 加入離線快取）。

## v0.9.25 — unreleased
- Worker: `/api/backup` 同 `/api/token-log` 按 IP 限速，每分鐘最多 5 次，超過回 429 `rate_limited`（頁面顯示「太密，請一分鐘後再試」）。用 Workers 內置 Rate Limiting binding `MAIL_LIMITER`（`wrangler.jsonc`），唔使喺 Cloudflare dashboard 設。冇 binding（本機測試、GitHub Pages）就唔限；每日 60 封上限照舊。上傳／下載同步（`/api/roster`、`/api/plan`）唔受影響。報告 D3。
- 測試: `validate_worker` 加限速檢查（限內成功、超過 429 冇寄信、按 IP、ping 唔受限）。
- Shell cache 改名 `v55`。

## v0.9.24 — unreleased
- 編更: 刪積木後訊息改做「已刪除積木」（以前話「其餘空格已按偏好重新編排」，但其實冇編排）。
- 編更: 待定區標題列加「收起／展開」掣，手機上收起後表格有晒位；收起狀態記喺呢部機。揀咗格或積木（要放落去）時自動展開。
- 編更: 手機週標題「第 N 週 · 10/26 – 11/1」只會喺「·」位置斷行，唔會斷開日期；細屏字體縮細少少。
- 編更: 加入主畫面有圖示同名（「編更」）：`plan.html` 加 `apple-touch-icon`、`apple-mobile-web-app-title` 同新嘅 `plan.webmanifest`。
- 我的更表: 後備更詳情嘅地點顯示中文名（例如「錦上路 2」），同週列表一致；匯入說明嘅後備更改做「後備更」（KSP／HSP 已有上下班時間）。
- 兩頁 manifest／圖示用相對路徑，GitHub Pages（`/tml-roster/`）都搵到；`site.webmanifest` 嘅 start_url 改做 `index.html`、冇 scope（以前 `/ice/` 令由 `/roster` 加入主畫面唔喺 scope 入面）；描述由「屯門線」改做「屯馬綫」。
- 部署: Pages workflow 同 `sw.js` 加埋 `plan.webmanifest`。
- Shell cache 改名 `v54`。

## v0.9.23 — unreleased
- 我的更表: 本週概況唔再將 HC 計入「假期」，改計「待定」（TBC 本身已經係待定）。
- 我的更表: 更份資料（index、duty-basic、站名、更份卡）讀唔到唔再記住成個 session：顯示「讀取更份資料失敗，請稍後再試」，唔再誤講「搵唔到 Duty Sheet」；網絡返嚟或者返到呢頁就自動再讀。index 真係冇嗰份 sheet 先講搵唔到。
- 我的更表: 開頁唔再等站名檔讀完先顯示；地點名到咗再補上。
- 編更: duty-basic 同 Duty Sheet 卡同時讀（以前讀完一樣先讀另一樣），讀緊嗰陣顯示「讀緊更份資料…」，唔再係白頁。開新一週要用更份時間排待定區，所以表格仍然等資料到先畫。
- 兩頁: 同步 token 框打錯（唔係 20 至 64 個細楷英文字母或數字）會講「token 格式唔啱」，唔做上傳或下載；以前會靜靜用返舊 token。
- 部署: GitHub Pages workflow 複製埋 `site.webmanifest` 同圖示，Pages 版嘅 service worker 先裝得到（`cache.addAll` 遇到 404 會成個失敗）。
- 測試: `validate_roster` 加 HC 計待定。
- Shell cache 改名 `v53`。

## v0.9.22 — unreleased
- 編更: 特別 Duty Sheet 嗰日（8022、8027、7091M …）唔再將成份 sheet 嘅更份放入待定區（以前 8027 有 166 個、7091M 有 106 個）。每星期匯入嘅 Standard Roster CSV 已經寫咗組員嗰日嘅特別更份，所以待定區只放組員自己嗰日嘅更份，同平日一樣。其他更份照舊可以喺 HC／TBC 揀編號度揀。
- 已經開咗嘅星期唔會自己改：重新匯入嗰星期嘅 CSV，或者按「本週重新開始」，待定區就會用新做法。
- 測試: `validate_plan` 改為檢查特別日子嘅待定區只有組員嘅更份。
- Shell cache 改名 `v52`。

## v0.9.21 — unreleased
- 特別日子按日期揀 Duty Sheet：TML-traffic 嘅 duty index 寫明每份特別 sheet 用喺邊日（`dates`／`alsoOn`），兩頁照住揀（`lib/tml-data.js` `sheetForDate`）。11/1 馬拉松嘅 7091M 同平日 7091 共用 7091xxx 編號，以前兩頁都當平日 7091。
- 我的更表: 11/1 嘅 7091xxx 用 7091M 嘅卡（例如 7091123 17:08 落班，平日係 16:08），卡上加「7091M」標籤；改做 7091401 呢類馬拉松更份都睇到全日行程。嗰日 7091M 冇嘅編號會講「呢日用 Duty Sheet 7091M，入面冇 …」，唔再講搵唔到 Duty Sheet。週概況、休息唔夠鐘、下一更都用當日嘅時間。
- 編更: 特別 sheet 唔再寫死（以前只認 8022／8023）：匯入 CSV 時用 Duty index 認出 8027（10/30）同 7091M（11/1），同 8022 一樣全份更份放入待定區。11/1 嘅格、積木、休息檢查、自動編排同匯出工時都用 7091M 嘅時間。`mapCode` 遇到 7091M 保留 7091xxx 編號。
- 兩頁: 車廠、側線、調頭位置顯示中文名（OS 外放車、PHD 八鄉車廠（東）、CIOT 第一城側線、TB1 大圍調頭位置 …），名由 TML-traffic `tml-network.json` 嘅 `places` 讀。
- 我的更表: 頁尾「更份資料 … 發佈」唔計特別日子嘅 sheet（7091M 寫嘅係運行日 11/1）。
- 測試: `validate_plan` 加 8027／7091M 偵測、7091M 存檔、timeOf 帶日期；`validate_roster` 加 `sheetForDate`、`placeNames`。
- Shell cache 改名 `v51`。

## v0.9.20 — unreleased
- 我的更表: 「跨裝置同步」刪走「呢部機嘅名」輸入格同下面嗰段說明（log／備份電郵寫名、token log、上傳前備份）。同編更（v0.9.18）一樣，token log、上傳同備份電郵直接用瀏覽器估嘅裝置資料（例如「iPhone · Safari」）；電郵 log 同上傳前備份照舊運作。以前喺呢格打過嘅名唔再用。
- 編更: 頁底更類說明（死早／早／中／夜／死夜）縮細行距。
- lib: `lib/tml-cloud.js` 刪走冇用嘅 `deviceName`／`saveDeviceName`／`DEVICE_KEY`。
- Shell cache 改名 `v49`。

## v0.9.19 — unreleased
- Duty 資料統一喺 TML-traffic：更份卡片（`data/duties/`）、官表上落班時間同工時（`duty-basic.json`）同站名，兩頁開嘅時候直接由 TML-traffic 讀（`lib/tml-data.js`：先讀 TML-traffic 網站，讀唔到就讀 GitHub main 嘅 raw 檔）。TML-traffic 匯入新 Duty Sheet 或總表、部署完，呢度下次開頁就用新資料，唔使同步、唔使出新版。
- 刪走副本同工具：`data/duties/`、`data/duty-basic.json`、`data/duty-hours-fixes.json`、`data/stations.json`、`tools/sync-duties.mjs`；`tools/index-to-basic.py` 同 `tools/validate-hours.mjs` 搬咗去 TML-traffic。
- 離線: `sw.js` 安裝時快取 TML-traffic 嘅 index、所有 sheet、`duty-basic.json` 同 `tml-network.json`，之後每次有網都重新攞；新 sheet 唔使改 `SHELL`。Shell cache 改名 `v48`。
- 測試: `validate_roster.mjs` 嘅 DS1101 接車／交車測試改讀 TML-traffic 某個固定 commit 嘅檔。

## v0.9.18 — unreleased
- 編更: 刪走「呢部機嘅名」輸入格；token log 同備份電郵直接用瀏覽器估嘅裝置資料（例如「iPhone · Safari」），Worker 照舊加埋完整瀏覽器資料、IP 同大約地區。
- 編更: 精簡說明：CSV 格式只講標題行同每行內容；刪走範本說明；「備份」刪走自動寄電郵／匯入前備份嗰句；「跨裝置同步」說明改短（電郵 log 同上傳前備份照舊運作，只係唔再寫出嚟）。
- 我的更表: 頁尾版本號跟住升到 v0.9.18，冇其他改動。
- 部署: #40 merge 嗰陣 GitHub 冇觸發 Cloudflare／Pages 部署，用呢個細改動重新觸發，冇功能改動。

## v0.9.17 — unreleased
- 編更: 組員喜好加「紅磡」—— 即係喺紅磡（HHS）上班或者落班嘅更，更份編號第五個數字係 5（xxxx5xx）。可以同更類一齊揀（例如「早」+「紅磡」）；自動編排會盡量畀佢紅磡嘅更，唔係紅磡嘅會當唔係喜好。
- 編更: 待定區篩選加「紅磡」（同更類一齊揀就係「紅磡嘅早更」咁收窄），刪走「HC／TBC」篩選。
- 編更: 待定區分頁「單日積木」改名做「積木」；刪走「將積木拖去同一日嘅格仔……」嗰句說明。
- 我的更表: 頁尾版本號跟住升到 v0.9.17，冇其他改動。

## v0.9.16 — unreleased
- 電郵（Resend，同 v0.9.13 編更備份共用 Worker 嘅 `RESEND_API_KEY`／`BACKUP_TO`）：
  - **token log**：喺我的更表或者編更「產生 token」，或者貼上另一條 token，會寄一封 log 去 owner：頁面、香港時間、token、裝置名、瀏覽器、IP 同大約地區。新增 `POST /api/token-log`。
  - **上傳前先備份**：上傳會蓋掉雲端現有版本嘅話，Worker 先將現有版本做附件寄去電郵，寄到先覆蓋；寄唔到就唔覆蓋，問用戶要唔要照樣上傳（`skipBackup`）。內容一樣（只係版本號唔同）就唔寄。我的更表嘅附件可以直接貼返入設定還原；編更嘅附件可以用「匯入備份」還原。
  - **下載前先備份**（建議）：由雲端下載會蓋掉呢部機有改動嘅版本，先將呢部機嘅版本寄去電郵；寄唔到就下載個檔。
  - 每日電郵上限由 30 升到 60，所有種類一齊計。
- 編更: **跨裝置同步** —— 「跨裝置同步」框：產生／複製 token、上傳到雲端、由雲端下載（`/api/plan/<token>`，同我的更表一樣用版本號防止無聲覆蓋）。上傳成份備份（Standard Roster、組員、喜好、所有星期）。條 token 同我的更表分開。未有 Standard Roster 都顯示，新手機可以直接下載。有改動未上傳會喺框標題提示。
- 兩頁: 新增「呢部機嘅名」（兩頁共用，預設估「iPhone · Safari」之類），寫入 log 同備份電郵；雲端記住最後上傳嘅裝置，有衝突時會講係邊部機上傳。
- lib: 新增 `lib/tml-cloud.js`（token、裝置名、香港時間、指紋、token log），兩頁共用。
- 工具: 新增 `tools/validate_worker.mjs`（假 KV、假 Resend），CI 會跑。

## v0.9.15 — unreleased
- 我的更表: **今日卡加資訊** —— 未返工顯示「返工 仲有 X」，返緊工顯示「放工 仲有 X」，放咗工顯示「已放工」。之後會發生嘅事按時間排：落車（交俾邊個更份）、用膳（倒數）、下一程（幾點喺邊個站接邊條 Run、由邊個更份交）。放咗工或者今日休息，就顯示下一更同中間休息幾耐。
- lib: 新增 `reliefOf(duty, duties, i)` —— 同一張 duty sheet 入面，同一個 run、同一個站、前後 20 分鐘內嘅段落當接車／交車。`validate_roster` 加 4 個檢查（用公開嘅 DS1101）。
- 頁尾版本號更新為 v0.9.15。

## v0.9.14 — unreleased
- 編更: 「匯入同備份」搬去待定區下面（頁尾版本號之前）。
- 編更: 圖例只留更份顏色，刪走「紅框／📌／•／HC／TBC」四句說明。
- 我的更表: 頁尾版本號跟住升到 v0.9.14，冇其他改動。

## v0.9.13 — unreleased
- 編更: 「匯入同備份」合併做頁頂一個框：匯入 CSV（只喺度揀年份同週數，旁邊會講係下星期定本週）、下載／匯入備份、清除資料，同埋「進階：手動設定組員行號」（唔再揀星期，跟匯入嗰個星期）。年份同週數格收窄。
- 編更: 刪走「使用步驟」同「自動」嗰段說明；刪走「電郵備份」掣。
- 編更: 每次下載備份（包括匯入前自動嗰份）都會自動寄一份去 owner 嘅電郵：Worker 新增 `POST /api/backup`，用 Resend 寄，收件人喺 Worker secret `BACKUP_TO`（repo 唔寫地址），要設 `RESEND_API_KEY`；每日最多 30 封。未設定或者 GitHub Pages 版會講「電郵寄唔到」，檔案照樣下載。
- 我的更表: 頁尾版本號跟住升到 v0.9.13，冇其他改動。

## v0.9.12 — unreleased
- 編更: **每星期匯入下星期 Standard Roster** —— 匯入框放咗喺頁頂，預設下星期；揀本週或之前會拒絕（唔會覆蓋本週），揀其他星期會先問。組員按**名稱**配對，所以每星期下移一行之後喜好照樣記住（`plan.known`）；匯入星期之前嘅編排保留，之後嘅星期如有手動改動會先問先重新開始。
- 編更: 匯入時如果新 CSV 冇咗某啲組員，會列出名先問；匯入前自動下載一份 JSON 備份。
- 編更: 刪走表頭每日剔選同 Duty Sheet（1101／6091…）選擇；CSV 某日大部分更份屬 8022／8023 等特別更表，就自動用嗰份 Duty Sheet。「自動」只按剔選嘅組員。
- 編更: 設定加「電郵備份」：手機用分享直接附加檔案，電腦就下載再開電郵。
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
