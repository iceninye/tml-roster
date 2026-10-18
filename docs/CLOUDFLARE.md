# Cloudflare Workers 部署（tml-roster）

目標網址：`https://tml-roster.iceninye.workers.dev`
舊站（保留、繼續運作）：`https://iceninye.github.io/tml-roster/`

## 現況

- 純靜態站，`wrangler.jsonc` 用 **assets-only Worker**（`"directory": "."`），冇 Worker script、冇 API、冇資料庫
- `.assetsignore` 排除 `.git`、`.github`、`tools`、`docs`、`*.md`、`.wrangler`、`wrangler.jsonc`、`.assetsignore`、`.gitignore`、`node_modules`
- 站內所有路徑都係**相對路徑**（`./`、`assets/…`、`lib/…`、`data/…`）→ 放喺網域根目錄直接可行，唔需要改任何 code
- Service Worker cache 名 `tml-roster-shell-v26`；`workers.dev` 係另一個 origin，同 GitHub Pages 完全獨立，唔會互相干擾

## 行為差異（實測，本地 `wrangler dev`）

| 請求 | GitHub Pages（舊站，不變） | Workers（`tml-roster.iceninye.workers.dev`） |
|---|---|---|
| `/` | 200 我的更表 | **200 編更** |
| `/plan.html` | 200 編更 | **200 編更**（URL 唔變）|
| `/plan` | — | 200 編更 |
| `/roster` | — | 200 我的更表 |
| `/index.html` | 200 | 200 我的更表 |
| `/assets/*`、`/lib/*`、`/data/*`、`/sw.js` | 200 | 200 |
| `/README.md`、`/.gitignore`、`/.wrangler` | — | 404（正確，唔會外洩） |

> ⚠️ `html_handling: "none"` 單獨用會令 `/` 變 404（冇 index 解析）→ **一定要配 `_redirects` 將 `/` 指去 `/plan.html`**（下面有做）。

## `_redirects` + `html_handling: "none"`（Workers 專用路由）

Workers 預設（`auto-trailing-slash`）會將 `/plan.html` 307 去 `/plan`，而 `/index.html` 又 307 去 `/`。
改為 `html_handling: "none"`（精確檔名）＋ `_redirects` proxy（200，URL 唔變）：

```txt
/            /plan.html   200     # 根路徑 = 編更（冰日常用嘅頁）
/plan.html   /plan.html   200
/plan        /plan.html   200
/roster      /index.html  200     # 我的更表（設定／匯入）
```

實測（本地 `wrangler dev` + 真瀏覽器）：

- `/` → 200，`<title>編更 · TML Roster`
- `/roster` → 200，`<title>我的更表 · TML Roster`
- `/plan.html`、`/plan` → 200，URL 唔變
- `/index.html` → 200（`none` 之後唔再 307）
- `/_redirects`、`/README.md` → 404（唔會外洩）
- Service Worker scope = `/`

⚠️ **GitHub Pages 完全忽略 `_redirects`** → 舊站行為 100% 不變（根路徑仍然係「我的更表」）。

## 部署步驟（一次，喺 Cloudflare Dashboard）

1. 登入 Cloudflare → **Workers & Pages**
2. 第一次用：設定 **workers.dev 子網域** = `iceninye`（全域唯一；如果被人用咗，改另一個名，網址跟住變）
3. **Create → Workers → Connect to Git** → 授權 GitHub → 選 repo `iceninye/tml-roster`
4. 設定：
   - Branch：`main`
   - Build command：**留空**
   - Deploy command：`npx wrangler deploy`
   - Root directory：`/`
5. Save and Deploy → 等 1–2 分鐘
6. 開 `https://tml-roster.iceninye.workers.dev/` 驗證

## 驗證清單（部署後）

- [ ] `/` 出「我的更表」
- [ ] `/plan.html` 開到編更頁（會 307 去 `/plan`）
- [ ] 匯入 CSV → 排更 → 重新整理資料仍在（localStorage）
- [ ] iOS Safari 開到（Service Worker 正常，冇白屏）
- [ ] Console 0 error
- [ ] `curl -sI https://tml-roster.iceninye.workers.dev/README.md` → 404（確認唔會外洩 repo 文件）

## Rollback

- Cloudflare Dashboard → 該 Worker → **Deployments** → 揀上一個版本 → **Rollback**
- 或者完全唔用：刪 Worker，GitHub Pages 完全冇受影響（兩個站獨立）

## 免費額度（官方，2026-10-18 核實）

| 項目 | Workers Free |
|---|---|
| 靜態檔請求 | 免費、無限 |
| 動態請求 | 100,000 / 日 |
| CPU | 10 ms / request |
| 靜態檔 | 20,000 檔 / 版本、單檔 25 MiB |

本專案只有靜態檔，唔會用到 CPU 額度。

## 未做（等決定）

- 帳號密碼登入 + D1 資料庫（冰 2026-10-18：**暫時唔實行**，先搬站）
