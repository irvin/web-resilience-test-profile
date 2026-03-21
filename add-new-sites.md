## 新增網站：從測試到上線的流程

這份文件整理「從新增一個測試網站」到「在 `https://resilience.ocf.tw/web/<domain>/` 上看到對應頁面」的完整跨專案流程。

專案所有 repos
- 檢測與統計：`web-resilience-test`
- 生成靜態頁面與部署： `web-resilience-test-profile`
- 對外網站： `resilience.ocf.tw`

部署完成會更新以下頁面：

- 主頁：`https://resilience.ocf.tw/web/`
- 單一網站頁面：`https://resilience.ocf.tw/web/<domain>/`
- Sitemap：`https://resilience.ocf.tw/web/sitemap.xml`

---

## 0. 前置條件

- 三個 repo 均已 clone 到本機，且路徑關係大致如下（實際目錄名稱可依你環境調整）：

  ```bash
  web-resilience-test/
    test-results/ (submodule)
  web-resilience-test-profile/
    test-result/ (submodule)
  resilience.ocf.tw/
    web/ (submodule)
  ```

- `web-resilience-test` 以及 `web-resilience-test-profile` 裡的 `test-result/`，是指向同一個 `test-results` 測試結果 repo 的 Git submodule。

## 1. 檢測網站（repo `web-resilience-test`）

> 目標：對新網站跑檢測、產生 JSON 結果與更新 `statistic.tsv`。

測試前記得要先關掉會影響連線狀態的 VPN 或 (macOS) iCloud Private Relay。

### 1-1. 檢測單一網站

在 `web-resilience-test` 目錄中：

```bash
cd /path/to/web-resilience-test
node no-global-connection-check.js \
  --adblock-url 'https://filter.futa.gg/hosts_abp.txt,https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_15_DnsFilter/filter.txt' \
  --dns 168.95.1.1 \
  --ipinfo-token $IPINFO_TOKEN \
  --save https://www.example.com
```

說明：

- `--save` 會在 `test-results/` 底下產生一個 JSON 檔，檔名大致為 `{hostname+path}.json`  
  例：`test-results/www.article19.org.json`
- 常用參數：
  - `--debug`：輸出詳細偵錯資訊
  - `--dns IP`：自訂 DNS 伺服器（通常使用中華電信 `168.95.1.1`）
  - `--ipinfo-token TOKEN`：指定 IPinfo Token（也可直接設環境變數 `IPINFO_TOKEN`）
  - `--adblock false`：不使用 adblock 清單過濾
  - `--adblock-url url1,url2`：指定自訂 adblock DNS 過濾清單（可用逗號分隔多個）
  - `--cache false`：不使用快取（強制重新下載 adblock / IPinfo 資料；預設為使用）
  - `--timeout N`：頁面載入逾時（秒，預設 120）
  - `--headless false`：改用非 headless 瀏覽器模式

### 1-2. 批次檢測網站

若一次要新增很多網站，建議先建立要檢測的網站清單（例如 `manual_curated_list_tw.json`），再使用 `batch-test.js` 檢測該清單，會自動為每個站呼叫 `checkWebsiteResilience(... --save)`，並在最後替你跑統計。

`batch-test.js` 可使用 `no-global-connection-check.js` 的相同參數。

目前本專案使用的「參數組合」如下：

```bash
cd /path/to/web-resilience-test
node batch-test.js \
  --adblock-url 'https://filter.futa.gg/hosts_abp.txt,https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_15_DnsFilter/filter.txt' \
  --dns 168.95.1.1 \
  --ipinfo-token $IPINFO_TOKEN \
  manual_curated_list_tw.json
```

## 2. 更新 `statistic.tsv` 統計檔

同樣在 `web-resilience-test` 目錄中：

```bash
node generate_statistic.js
```

**這支腳本會：**

- 掃描 `test-results/` 內所有網站的 JSON 結果
- 依 `top-traffic-list-taiwan/merged_lists_tw.json` 的排序產出統計
- 統計並寫入 `test-results/statistic.tsv`，包含以下欄位：
  - `url`, `timestamp`
  - [境內／境外] × [雲端／直連] 連線數

> 若是透過 `batch-test.js` 批次測試，腳本執行完會自動呼叫 `generate_statistic.js`

## 3. 更新 `test-results` 測試結果 repo

如果 `test-results/` 是獨立的 Git submodule，需要在該目錄內單獨 commit / push：

```bash
cd test-results
git add .
git commit -m "新增網站測試結果: example.com"
git push
```

## 4. 在 `web-resilience-test-profile` 匯入最新結果建置頁面

> 目標：把剛剛更新好的 `statistic.tsv` 與 JSON 結果轉成靜態 HTML 頁面。

### 4-1. 更新測試結果 submodule

在 `web-resilience-test-profile` 目錄中：

```bash
cd /path/to/web-resilience-test-profile
git submodule update --remote test-result
```

這會把 `test-result/` 更新到剛才 push 的最新版本，包含：

- `test-result/statistic.tsv`
- 各網站的 `*.json` 結果檔

### 4-2. （首次或環境變更時）安裝 dependencies

```bash
npm install
npx playwright install chromium
```

### 4-3. 建置靜態頁面

**更新單一網站頁面：**

```bash
# 支援部分字串匹配
npm run build example.com
# 例：npm run build www.article19.org
# 或：npm run build article19.org
```

**或建置所有網站頁面：**

```bash
npm run build:all
```

建置完成後，會在 `web/` 下產生：

- `web/<domain>/index.html`：每個網站的個別頁面
- `web/index.html`：主列表頁
- `web/sitemap.xml`：在完整建置流程中更新，用於搜尋引擎

### 4-4. 推送到 `gh-pages` branch

> 目標：把 `web/` 目錄內容推到 `gh-pages` 分支。

在 `web-resilience-test-profile` 目錄中：

```bash
npm run deploy
```

這會：

- 把 `web/` 的內容更新到 `gh-pages` 分支
- 推送到遠端
- 清理本地 worktree

## 5. 更新 `resilience.ocf.tw`

`resilience.ocf.tw` 這個 repo 是整體網站容器，透過 submodule 掛入 `web-resilience-test-profile` 的 `gh-pages` 成為 `/web/` 的內容。

### 5-1. 更新 `/web` submodule

在 `resilience.ocf.tw` 目錄中：

```bash
git submodule update --remote web-resilience-test-profile
```

### 5-2. 更新 cloudflare cache

`resilience.ocf.tw` 使用 Cloudflare 設定 cache everything。更新頁面後，可手動清除 cache。（optional）

- 確定 github pages action 已完成 `https://github.com/ocftw/resilience.ocf.tw/actions/workflows/gh-pages.yml`
- 於 https://dash.cloudflare.com/f76f75b73e9e49dd7c05a7bd315dc468/ocf.tw/caching/configuration 點選「custom perge」，選擇「hostname」，輸入「`resilience.ocf.tw`」

### 5-3. (known issue) 使用者端最長需要等候24小時才能看到新加入的網站

因現行的 statistic.tsv 會在使用者端的瀏覽器 local storage 中 cache 24 小時，故使用者端無法強制更新網頁清單。

## 6. 問題快速檢查清單

若在 resilience.ocf.tw 網站上看不到更新，依照下列順序檢查：

1. `web-resilience-test` 是否有跑 `npm run check --save` 與 `node generate_statistic.js`
2. `test-results` submodule 是否已經 `git push`
3. `web-resilience-test-profile` 是否有成功建立靜態頁面並推送到 `gh-pages` branch：
   - `git submodule update --remote test-result`
   - `npm run build <domain>` 或 `npm run build:all`
   - `npm run deploy`
4. `resilience.ocf.tw` 是否已正確指到最新的 `gh-pages` submodule 版本
5. 手動清除 Cloudflare cache
