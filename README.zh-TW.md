# Web Resilience Profile

靜態網站生成器，用於生成「海纜斷掉時網站會動嗎？」的測試結果頁面。

英文主文件請見 [`README.md`](README.md)。  
跨專案上線流程的英文版請見 [`add-new-sites.md`](add-new-sites.md)。

> 檢測本身（收集連線、產生 JSON + `statistic.tsv`）在 `web-resilience-test` 專案完成，  
> 本專案負責把測試結果「轉成可以對外瀏覽的靜態頁面」並部署到 `gh-pages`。

## 功能說明

這個專案會：
1. 從 submodule 讀取 `statistic.tsv` 取得所有測試過的網址
2. 為每個網址生成獨立的靜態 HTML 頁面
3. 使用 headless browser（Playwright）渲染 Vue 應用，確保 SEO 友善
4. 將建置產物部署到 `gh-pages` 分支，供其他 repo 使用 submodule 引入

## 從「更新檢測結果」到「在 resilience.ocf.tw 看到新網頁」的完整流程

請參考 [`add-new-sites.zh-TW.md`](add-new-sites.zh-TW.md)。

每次改程式或建置後的回歸測試請見 [`TESTING.zh-TW.md`](TESTING.zh-TW.md)。

## 安裝

```bash
# 安裝依賴
npm install

# 安裝 Playwright 瀏覽器
npx playwright install chromium

# 初始化並更新 submodule（取得測試結果資料）
git submodule update --init --recursive
```

更新 submodule（取得最新資料）：

```bash
git submodule update --remote test-result
```

## 快速參考

| 指令 | 說明 |
|------|------|
| `npm run build` | 測試建置（只處理第一個網址） |
| `npm run build <網站名稱>` | 建置特定網站（例如：`npm run build www.article19.org`） |
| `npm run build:all` | 建置所有網站 |
| `npm run generate:sitemap` | 只產生 sitemap（不跑 Playwright） |
| `npm run build-worktree` | 手動執行 worktree 操作（不執行建置） |
| `npm run deploy` | 推送 `gh-pages` 分支到遠端 |

## 建置流程

### 測試建置（只編譯一個網站，預設）

```bash
npm run build
```

這會：
- 只處理第一個網址，用於快速測試建置流程
- 建置完成後自動準備部署到 `gh-pages` 分支

### 建置特定網站

```bash
npm run build www.article19.org
```

這會：
- 只處理指定的網站（支援部分匹配，例如 `article19.org` 可以匹配 `www.article19.org`）
- 自動過濾出所有匹配的網站並進行建置
- 建置完成後自動準備部署到 `gh-pages` 分支

範例：

```bash
# 建置 www.article19.org
npm run build www.article19.org

# 使用部分名稱也可以（會匹配所有包含該字串的網站）
npm run build article19.org

# 如果找不到匹配的網站，會顯示錯誤訊息並退出
```

### 建置所有網站

```bash
npm run build:all
```

這會：
- 從 submodule 讀取 `statistic.tsv` 取得所有測試網址
- 使用 8 個並行的瀏覽器實例處理
- 為每個網址生成繁中、英文靜態 HTML 頁面到 `web/` 目錄
- 每個網址會建立目錄，例如 `web/google.com/index.html`（繁中）與 `web/google.com/en/index.html`（英文）
- 主頁面為 `web/index.html`（繁中）與 `web/en/index.html`（英文）
- 建置完成後會在 `web/` 產生 `sitemap.xml`（部署後位於 `/web/sitemap.xml`）
- 建置完成後自動準備部署到 `gh-pages` 分支

## Sitemap（提交搜尋引擎用）

### 產出位置

- 建置後：`web/sitemap.xml`
- 部署後：`https://resilience.ocf.tw/web/sitemap.xml`

### 內容與日期（lastmod）規則

- **sitemap 收錄哪些頁面**：以 `statistic.tsv` 為準，雙語首頁共 2 筆，每個網站資料列再各產生繁中、英文 2 筆，總數公式為 `2 + 2 × 網站資料列數`
- **主頁 `/web/` 與 `/web/en/` 的 lastmod**：分別使用對應 `index.html` 的 mtime
- **個別站點 `/web/<domain>/` 與 `/web/<domain>/en/` 的 lastmod**：分別使用對應 `index.html` 的 mtime

備註：測試模式（`npm run build` 預設）不會更新 `web/sitemap.xml`，避免把 sitemap 變成只含 1 筆測試資料。

### 只重建 sitemap（不跑 Playwright）

```bash
npm run generate:sitemap
```

## 部署到 gh-pages 分支

建置指令會自動將 `web/` 的內容部署到 `gh-pages` 分支。完成建置後，執行以下指令推送到遠端：

```bash
npm run deploy
```

這會自動執行：
- 推送 `gh-pages` 分支到遠端
- 清理本地 worktree

### 手動執行 worktree 操作

如果只需要準備 worktree 而不執行建置，可以使用：

```bash
npm run build-worktree
```

這會：
- 將 `web/` 的內容部署到 `gh-pages` 分支（不執行建置）
- 適用於已經完成建置，只需要更新 worktree 的情況

## 本地預覽（開發）

在 repo 根目錄編輯 `index.html`、`app.js`、`i18n.js`、`locales/`，並以 HTTP 服務根目錄（例如 VS Code Live Server 或 `npx serve .`）開啟 `index.html`。

- localhost 可用 `?url=example.com` 動態預覽單站結果。
- 請勿用 `file://` 開啟；讀取 `/test-result/` 需要本機伺服器。
- `web/` 為建置產物，日常改 UI 請改根目錄模板。

## 雙語介面（繁中 / 英文）

正式站以**路徑**區分語系（一個 URL、一種語言、建置時烘焙一次）：

| 頁面 | 繁中 | 英文 |
|------|------|------|
| 首頁 | `/web/` | `/web/en/` |
| 子站 | `/web/{domain}/` | `/web/{domain}/en/` |

- `npm run build:all` 一次產出上述雙語靜態頁；建置產物**不含** `#site-dynamic` / `#overview-dynamic`。
- 語言切換為純 `<a href>` 連到對應路徑。
- **找不到的網站**：`resilience.ocf.tw` 的 [`404.html`](../resilience.ocf.tw/404.html) 將未知路徑轉到 query 模式——繁中 `/web/?url={domain}`、英文 `/web/en/?url={domain}`；語言切換在該模式下會保留 `url` 參數。
- 已知網站若帶 `?url=` 造訪，仍由 `loadResults()` 導向對應靜態路徑。

開發模板（repo 根目錄）仍保留 Vue dynamic 區塊供預覽；localhost 可用 `?url=example.com&lang=en` 預覽英文。

文案在 `locales/zh-TW.js`、`locales/en.js`。Fork 仍可用 `window.__WEB_RESILIENCE_TEXT__` 覆寫動態文字。

## 專案結構

```text
web-resilience-profile/
├── web/                     # 建置產物目錄
│   ├── index.html           # 繁中首頁
│   ├── en/
│   │   └── index.html       # 英文首頁
│   ├── locales/
│   ├── i18n.js
│   ├── google.com/          # 每個網址的目錄
│   │   ├── index.html       # 繁中
│   │   └── en/
│   │       └── index.html   # 英文
│   └── ...
├── test-result/             # Git submodule（測試結果資料）
│   ├── statistic.tsv
│   ├── *.json
│   └── ...
├── scripts/
│   ├── build.js             # 建置腳本
│   ├── build-wrapper.js     # 建置包裝腳本（處理參數傳遞）
│   ├── build-worktree.js    # 部署腳本
│   ├── deploy.js            # 推送與清理腳本
│   ├── generate-sitemap.js  # sitemap 生成腳本（輸出到 web/sitemap.xml）
│   └── clean-worktree.js    # 清理腳本（內部使用）
├── locales/
│   ├── zh-TW.js
│   └── en.js
├── index.html               # 唯一模板（dev 用 Vue dynamic 區塊）
├── i18n.js
├── add-new-sites.zh-TW.md   # 維運流程（繁中）
├── add-new-sites.md         # 維運流程（英文）
├── app.js
├── styles.css
└── package.json
```

## 技術細節

### 建置流程

1. **讀取資料**：從 submodule (`test-result`) 讀取 `statistic.tsv` 取得所有測試網址
2. **過濾網址**（可選）：如果指定了網站名稱，會過濾出匹配的網址（支援部分匹配）
3. **啟動 HTTP 伺服器**：在本地啟動 HTTP 伺服器提供 `index.html`（建置時從 submodule 讀取 JSON 和 statistic.tsv）
4. **並行處理**：使用 8 個 Playwright 瀏覽器實例並行處理
5. **生成靜態 HTML**：透過 headless browser 載入頁面並渲染，生成完整 HTML，包含：
   - 正確的 title 和 meta 標籤（SEO 友善）
   - 已渲染的內容（搜尋引擎可直接索引）
   - Vue 互動功能（用戶可以展開/收合詳細資訊）

### 路徑處理

- 每個網址會建立一個目錄，例如 `google.com/index.html`
- 對應訪問 URL 為 `https://resilience.ocf.tw/web/google.com/`

## TODO

- 問題：使用者端看不到更新？

FIXME: 因 statistic.tsv 會在 client side cache 24 小時，故使用者端無法強制更新網頁清單。  
需在 build 頁面時加入對應的 statistic.tsv 版本資訊，然後頁面載入時檢查 statistic.tsv 的 build time，若早於頁面則需抓取最新版本。

## 相關連結

- 研究方法與原始碼：https://github.com/irvin/web-resilience-test
- 測試結果資料：https://github.com/irvin/web-resilience-test-result

## 📜 授權

本專案在 ISIF 研究專案期間（2026 年 12 月 31 日前）採用 [CC BY-NC-ND 4.0 International](https://creativecommons.org/licenses/by-nc-nd/4.0/)（姓名標示─非商業性─禁止改作 4.0 國際）。

2026 年 12 月 31 日後，本專案之資料與腳本將釋出至公有領域（Public Domain）。研究期間若需超出 CC BY-NC-ND 4.0 限制之使用，請聯絡 Irvin Chen（Open Culture Foundation）：irvin@moztw.org（請 cc hi@ocf.tw）。

完整條款與建議署名格式請見 [LICENSE](LICENSE)。

## 致謝

This work was supported by a grant from the APNIC Foundation, via the Information Society Innovation Fund (ISIF Asia).
