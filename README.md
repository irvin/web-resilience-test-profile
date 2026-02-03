# Web Resilience Profile

靜態網站生成器，用於生成「海纜斷掉時網站會動嗎？」的測試結果頁面。

## 功能說明

這個專案會：
1. 從 submodule 讀取 `statistic.tsv` 取得所有測試過的網址
2. 為每個網址生成獨立的靜態 HTML 頁面
3. 使用 headless browser（Playwright）渲染 Vue 應用，確保 SEO 友善
4. 將建置產物部署到 `gh-pages` 分支，供其他 repo 使用 submodule 引入

## 安裝

```bash
# 安裝依賴
npm install

# 安裝 Playwright 瀏覽器
npx playwright install chromium

# 初始化並更新 submodule（取得測試結果資料）
git submodule update --init --recursive
```

**更新 submodule（取得最新資料）：**
```bash
git submodule update --remote test-result
```

## 快速參考

| 指令 | 說明 |
|------|------|
| `npm run build` | 測試建置（只處理第一個網址） |
| `npm run build <網站名稱>` | 建置特定網站（例如：`npm run build www.article19.org`） |
| `npm run build:all` | 建置所有網站 |
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

**範例：**
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
- 為每個網址生成靜態 HTML 頁面到 `web/` 目錄
- 每個網址會建立一個目錄，例如 `web/google.com/index.html`
- 主頁面（`web/index.html`）會從線上 API 讀取 JSON 和 statistic.tsv 資料
- 建置完成後自動準備部署到 `gh-pages` 分支

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

## 專案結構

```
web-resilience-profile/
├── web/                     # 建置產物目錄
│   ├── index.html          # 主頁面
│   ├── google.com/         # 每個網址的目錄
│   │   └── index.html
│   ├── g0v_logo.svg        # 資源檔案
│   └── ...                 # 
├── test-result/  # Git submodule（測試結果資料）
│   ├── statistic.tsv
│   ├── *.json
│   └── ...
├── scripts/
│   ├── build.js            # 建置腳本
│   ├── build-wrapper.js    # 建置包裝腳本（處理參數傳遞）
│   ├── build-worktree.js  # 部署腳本
│   ├── deploy.js           # 推送與清理腳本
│   └── clean-worktree.js   # 清理腳本（內部使用）
├── index.html              # 原始模板
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

## 相關連結

- 研究方法與原始碼：https://github.com/irvin/web-resilience-test
- 測試結果資料：https://github.com/irvin/web-resilience-test-result

## License

CC BY-NC-ND 4.0 International License
