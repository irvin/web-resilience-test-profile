# 更新後測試清單

每次修改程式、建置產物或部署設定後，依本文件逐項確認。  
英文版請見 [`TESTING.md`](TESTING.md)。

---

## 適用時機

| 變更類型 | 建議執行的章節 |
|----------|----------------|
| `app.js`、`i18n.js`、`index.html`、`locales/` | §1 開發預覽、§2 建置產物、§3 路由與轉向、§4 雙語 |
| `scripts/build.js`、建置流程 | §2 建置產物、§3、§4、§5 SEO |
| 只更新單一網站資料 | §2（該站）、§6 部署後抽樣 |
| `resilience.ocf.tw/404.html`、`index.html` | §3-2 404 轉向、§6 |
| 完整上線（`build:all` + deploy） | 全部章節 |

---

## 測試環境

| 環境 | 用途 | 啟動方式 |
|------|------|----------|
| **開發模板** | 改 UI、搜尋、動態 `?url=` 預覽 | 在 repo 根目錄開 Live Server，開啟 `http://127.0.0.1:5500/` |
| **建置產物** | 驗證 `web/` 輸出與正式站行為一致 | 對 `resilience.ocf.tw/` 或 `web-resilience-test-profile/web/` 開 Live Server，路徑為 `/web/...` |
| **正式站** | 404、根路徑轉址、CDN 快取 | `https://resilience.ocf.tw/...`（需完成 deploy） |

> 請勿用 `file://` 開啟；`fetch` 需要 HTTP 伺服器。

### 建議測試用網域

| 網域 | 用途 |
|------|------|
| `google.com` | 已知網站（在 `statistic.tsv` 內） |
| `google.coms`（或任意不存在的網域） | 未知網站（不在清單內） |

---

## 1. 開發模板預覽（repo 根目錄）

在 `web-resilience-test-profile/` 根目錄啟動本機伺服器後測試。

- [ ] **首頁**：`/` 顯示搜尋框與整體統計區塊（`#overview-dynamic` 可見）
- [ ] **動態結果**：`/?url=google.com` 顯示該站檢測結果，不轉向靜態路徑
- [ ] **未知網站**：`/?url=google.coms` 顯示「查無結果」／搜尋狀態
- [ ] **英文預覽**：`/?url=google.com&lang=en` 介面為英文
- [ ] **語言切換（dev）**：切換連結帶 `?lang=zh-TW` 或 `?lang=en`，並保留 `url` 參數
- [ ] **搜尋自動完成**：輸入 `google` 出現建議，點選後導向 `?url=...&lang=...`（非 `/web/` 路徑）

---

## 2. 建置產物檢查

執行建置後檢查 `web/`（或 `gh-pages-worktree/`）。

```bash
# 快速煙霧測試（只建第一個站）
npm run build

# 或建置特定站
npm run build google.com

# 完整建置（上線前）
npm run build:all
```

### 2-1. 檔案是否存在

- [ ] `web/index.html`（繁中首頁）
- [ ] `web/en/index.html`（英文首頁）
- [ ] `web/<domain>/index.html`（繁中子站，例如 `google.com`）
- [ ] `web/<domain>/en/index.html`（英文子站）
- [ ] `web/statistic.<hash>.tsv` 與 `<meta name="web-resilience-statistic-url">` 一致
- [ ] `web/locales/zh-TW.js`、`web/locales/en.js`、`web/i18n.js`、`web/app.js` 已複製
- [ ] `npm run build:all` 後有 `web/sitemap.xml`

### 2-2. 建置後 HTML 結構（任一站 + 首頁各抽一個）

- [ ] **已移除動態區塊**：產物中**沒有** `#site-dynamic`、`#overview-dynamic`
- [ ] **首頁標題**：繁中／英文首頁皆有 `<h1 class="home-title">`
- [ ] **子站內容**：靜態頁已烘焙檢測結果（不需等 JS 才出現主要結果）
- [ ] **hreflang**：`<link rel="alternate" hreflang="zh-TW">` 與 `hreflang="en"` 成對存在
- [ ] **canonical / og:url** 指向正確的 `https://resilience.ocf.tw/web/...` 路徑

### 2-3. 建置指令行為

- [ ] `npm run build` **不會**把 `sitemap.xml` 縮成只有一個測試站
- [ ] `npm run build:all` 後 sitemap 含首頁與各站繁中／英文 URL（約 3700+ 筆）

---

## 3. 路由與轉向

在 **建置產物** 環境（`/web/` 路徑）測試。本機範例：`http://127.0.0.1:5500/web/...`（以 `resilience.ocf.tw/` 為伺服器根目錄時）。

### 3-1. 已知網站：query → 靜態頁

| 輸入 URL | 預期結果 |
|----------|----------|
| `/web/?url=google.com` | 自動轉向 `/web/google.com/` |
| `/web/en/?url=google.com` | 自動轉向 `/web/google.com/en/` |

- [ ] 轉向後網址列無 `?url=` 參數
- [ ] 頁面標題含 `google.com`

### 3-2. 未知網站：404 與 query 模式（正式站或已部署 `404.html`）

`resilience.ocf.tw/404.html` 負責將不存在的 `/web/...` 路徑轉成查詢模式。

| 輸入 URL | 預期結果 |
|----------|----------|
| `/web/notexist.example/` | → `/web/?url=notexist.example` |
| `/web/notexist.example/en/` | → `/web/en/?url=notexist.example` |
| `/web/en`（無尾斜線） | → `/web/en/` |
| `/web/`（僅尾段空白） | → `/web`（交給首頁 index） |
| 非 `/web/` 開頭的 404 | 留在 404 頁，不轉向 |

- [ ] 未知 query 模式顯示搜尋／查無結果 UI，**不**轉向靜態路徑
- [ ] `/web/?url=google.coms` 停留於 query URL

### 3-3. 靜態頁直接存取

| 輸入 URL | 預期結果 |
|----------|----------|
| `/web/` | 繁中首頁：搜尋 + 整體統計圖 |
| `/web/en/` | 英文首頁 |
| `/web/google.com/` | 繁中單站結果 |
| `/web/google.com/en/` | 英文單站結果 |

- [ ] 靜態子站無 `?url=` 時直接顯示結果，不需二次載入才出現主內容
- [ ] 「檢查其他網站」連結可回到搜尋狀態

### 3-4. 網站殼層（`resilience.ocf.tw` repo）

- [ ] `https://resilience.ocf.tw/` → `/web`
- [ ] `https://resilience.ocf.tw/web/sitemap.xml` 可存取

### 3-5. 舊網址轉址

- [ ] `irvin.github.io` 上帶 `?url=` 的舊連結會轉向 `https://resilience.ocf.tw/web/?url=...`

---

## 4. 雙語與語言切換

語言以**路徑**區分（建置產物）；開發模板用 `?lang=`。

### 4-1. 靜態路徑切換

| 目前頁面 | 點「中文」 | 點「English」 |
|----------|------------|----------------|
| `/web/` | 停留 `/web/` | → `/web/en/` |
| `/web/google.com/` | 停留 | → `/web/google.com/en/` |
| `/web/google.com/en/` | → `/web/google.com/` | 停留 |

- [ ] `<html lang>` 為 `zh-TW` 或 `en`
- [ ] 導覽列、按鈕、FAQ 等文案隨語系改變

### 4-2. 找不到網站時（query 模式）切換語系

| 目前頁面 | 點另一語系 |
|----------|------------|
| `/web/?url=google.coms` | → `/web/en/?url=google.coms` |
| `/web/en/?url=google.coms` | → `/web/?url=google.coms` |

- [ ] `url` 參數在切換後仍保留
- [ ] **不**應出現 `/web/?lang=en` 這類舊式 query（`/web/` 路徑不讀 `?lang=`）

### 4-3. 開發模板語系

- [ ] repo 根目錄 `/?lang=en` 可切英文（僅 dev，非 `/web/` 路徑）

---

## 5. 搜尋與互動

在 `/web/` 或 `/web/en/` 首頁：

- [ ] 輸入關鍵字出現自動完成列表
- [ ] 鍵盤上下選擇、Enter 可導向
- [ ] 選取已知網站後導向 `/web/<domain>/`（或 `/en/`）
- [ ] 搜尋無結果時有適當空狀態文案

在已知子站靜態頁：

- [ ] 「檢查其他網站」可開啟搜尋
- [ ] 結果區塊的圖示、分類標籤、連結正確

---

## 6. SEO 與中繼資料（抽樣）

任選首頁與一個子站，檢視原始碼或開發者工具：

- [ ] `<title>`、`meta description` 合理且語系正確
- [ ] `og:title`、`og:description`、`og:url`、`og:image` 存在
- [ ] `link rel="canonical"` 與實際語系路徑一致
- [ ] 首頁 `og:image` 指向 `/web/img/overall-result.png`

---

## 7. 部署後確認（正式站）

完成 `npm run deploy` 與 `resilience.ocf.tw` submodule 更新後：

- [ ] GitHub Actions（[gh-pages workflow](https://github.com/ocftw/resilience.ocf.tw/actions/workflows/gh-pages.yml)）成功
- [ ] 正式站 §3、§4 抽樣 URL 行為與本機建置產物一致
- [ ] 若有更新 `404.html`，用 §3-2 在正式站驗證
- [ ] （選用）Cloudflare「cache everything」時手動 purge `resilience.ocf.tw`

### 已知限制

- 瀏覽器會快取 `statistic.tsv` **24 小時**；新增網站後，部分使用者可能要隔天才能在搜尋清單看到新站（見 README §Known issue）。

---

## 8. 快速檢查指令（選用）

在 `web-resilience-test-profile/` 目錄：

```bash
# 確認首頁已烘焙標題、已 stripping 動態區塊
grep -l 'home-title' web/index.html web/en/index.html
! grep -q 'id="site-dynamic"' web/index.html
! grep -q 'id="overview-dynamic"' web/index.html

# 確認子站雙語產物
test -f web/google.com/index.html && test -f web/google.com/en/index.html

# 確認 sitemap 含雙語首頁（需 build:all 後）
grep -c '<loc>' web/sitemap.xml
```

---

## 9. 測試紀錄範本

每次發版可複製填寫：

```text
日期：
變更摘要：
建置指令：npm run build / build:all / 其他
測試環境：本機 web/ □  正式站 □

§1 開發模板：Pass / Fail / N/A
§2 建置產物：Pass / Fail
§3 路由轉向：Pass / Fail
§4 雙語：Pass / Fail
§5 搜尋互動：Pass / Fail
§6 SEO 抽樣：Pass / Fail
§7 部署：Pass / Fail / N/A

備註：
```

---

## 相關文件

- 上線流程：[`add-new-sites.zh-TW.md`](add-new-sites.zh-TW.md)
- 網站殼層：[`resilience.ocf.tw` README](https://github.com/ocftw/resilience.ocf.tw/blob/main/README.md)
- URL 與雙語設計：[`README.zh-TW.md` §雙語 UI](README.zh-TW.md)
