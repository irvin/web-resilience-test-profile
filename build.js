const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/irvin/web-resilience-test-result/refs/heads/main/';
const STATISTIC_TSV_URL = GITHUB_RAW_URL + 'statistic.tsv';
const OUTPUT_DIR = path.join(__dirname, 'dist');
const TEMPLATE_FILE = path.join(__dirname, 'index.html');
const BROWSER_INSTANCES = 4; // 同時開啟的瀏覽器實例數量
const SERVER_PORT = 3000;

// 測試模式：只處理第一個 URL（預設行為）
// --all 參數：編譯所有網站
const BUILD_ALL = process.argv.includes('--all');
const TEST_MODE = !BUILD_ALL; // 如果沒有 --all，就是測試模式
const TEST_LIMIT = TEST_MODE ? 1 : null;

// 將網址轉換為目錄路徑（用於創建目錄結構）
function urlToDirPath(url) {
  let cleanUrl = url.replace(/^https?:\/\//, '');
  cleanUrl = cleanUrl.replace(/\/+$/, '');
  cleanUrl = cleanUrl.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (cleanUrl.length > 100) {
    cleanUrl = cleanUrl.slice(0, 100);
  }
  return cleanUrl;
}

// 將網址轉換為完整的輸出路徑（目錄 + index.html）
function urlToOutputPath(url) {
  const dirName = urlToDirPath(url);
  return path.join(dirName, 'index.html');
}

// 下載檔案
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// 讀取 statistic.tsv 並解析 URL 列表
async function loadStatisticData() {
  console.log('正在下載 statistic.tsv...');
  const text = await fetchUrl(STATISTIC_TSV_URL);
  const lines = text.split('\n').filter(line => line.trim());

  const urls = [];
  for (let i = 1; i < lines.length; i++) {
    let url = lines[i].split('\t')[0];
    if (url && url.startsWith('http')) {
      url = url.replace(/\/+$/, '');
      urls.push(url);
    }
  }

  return urls.map(url => url.replace(/^https?:\/\//, ''));
}

// 啟動簡單的 HTTP 伺服器
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${SERVER_PORT}`);
      let filePath;

      if (url.pathname === '/' || url.pathname === '/index.html') {
        filePath = TEMPLATE_FILE;
      } else {
        // 處理其他資源檔案
        filePath = path.join(__dirname, url.pathname);
      }

      // 檢查檔案是否存在
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
          '.json': 'application/json'
        }[ext] || 'text/plain';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(SERVER_PORT, () => {
      console.log(`✓ HTTP 伺服器已啟動在 http://localhost:${SERVER_PORT}\n`);
      resolve(server);
    });
  });
}

// 使用 Playwright 生成靜態 HTML
async function generateStaticHTML(browser, url, index, total) {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 }
  });

  try {

    // 導航到本地 HTTP 伺服器，並帶上 URL 參數
    const cleanUrl = url.replace(/\/+$/, '');
    const fileUrl = `http://localhost:${SERVER_PORT}/?url=${encodeURIComponent(cleanUrl)}`;

    console.log(`  [瀏覽器 ${index}] [${total}] 載入頁面: ${cleanUrl}`);

    // 等待頁面載入
    await page.goto(fileUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // 等待 Vue 應用完全渲染
    // 檢查結果是否已載入
    await page.waitForFunction(
      () => {
        return window.__vueState__ &&
               window.__vueState__.vueResult &&
               window.__vueState__.vueResult.value !== null;
      },
      { timeout: 10000 }
    ).catch(() => {
      // 如果超時，可能是找不到結果，繼續執行
      console.log(`  [瀏覽器 ${index}] 警告: ${cleanUrl} 可能沒有測試結果`);
    });

    // 等待一小段時間確保所有內容都已渲染
    await page.waitForTimeout(1000);

    // 取得渲染後的完整 HTML
    let html = await page.content();

    // 從頁面中取得測試結果資料
    const testResult = await page.evaluate(() => {
      return window.__vueState__ && window.__vueState__.vueResult ? window.__vueState__.vueResult.value : null;
    });

    // 檢查 title 是否已更新（驗證 SEO 資訊）
    const title = await page.title();
    console.log(`  [瀏覽器 ${index}] 頁面標題: ${title}`);

    // 如果成功取得測試結果，在 HTML 中加入預載 script
    if (testResult) {
      // 在 </head> 之前插入預載 script
      const preloadScript = `
    <script>
      // 預載測試結果資料（用於靜態 HTML）
      window.__STATIC_PAGE_DATA__ = ${JSON.stringify(testResult)};
      window.__STATIC_PAGE_URL__ = ${JSON.stringify(cleanUrl)};
    </script>
`;
      // 在 </head> 之前插入預載資料
      html = html.replace('</head>', preloadScript + '\n    </head>');

      // 修改 loadResults 函數，讓它在靜態頁面中檢查預載資料
      // 在 loadResults 函數定義的開頭添加檢查
      const loadResultsFix = `
            // 靜態頁面檢查：如果有預載資料，直接使用
            if (window.__STATIC_PAGE_DATA__ && window.__STATIC_PAGE_URL__) {
                const urlParam = getUrlParam();
                // 如果沒有 URL 參數，但我們有預載資料，就使用預載資料
                if (!urlParam) {
                    // 等待 Vue 初始化完成
                    const setStaticData = () => {
                        if (window.__vueState__ && window.__vueState__.vueResult) {
                            window.__vueState__.vueResult.value = window.__STATIC_PAGE_DATA__;
                            const resultsEl = document.getElementById('results');
                            if (resultsEl) resultsEl.style.display = 'block';
                            if (window.__vueState__.showSearch) window.__vueState__.showSearch.value = false;
                            if (window.__vueState__.showCheckOther) window.__vueState__.showCheckOther.value = true;
                            return true;
                        }
                        return false;
                    };

                    // 立即嘗試設定，如果 Vue 還沒初始化就等待
                    if (!setStaticData()) {
                        const checkVue = setInterval(() => {
                            if (setStaticData()) {
                                clearInterval(checkVue);
                            }
                        }, 50);
                        setTimeout(() => clearInterval(checkVue), 5000);
                    }

                    // 仍然需要載入統計資料供搜尋使用
                    await loadStatisticData();
                    if (window.__vueState__ && window.__vueState__.allUrls) {
                        window.__vueState__.allUrls.value = allUrls;
                    }
                    return;
                }
            }
`;
      // 在 loadResults 函數開頭插入檢查
      html = html.replace('async function loadResults() {', `async function loadResults() {${loadResultsFix}`);

      // 在 loadResults() 調用之後插入修復 script（確保狀態正確）
      const fixScript = `
        <script>
          // 確保靜態頁面狀態正確
          (function() {
            if (window.__STATIC_PAGE_DATA__ && window.__STATIC_PAGE_URL__) {
              setTimeout(function() {
                if (window.__vueState__ && window.__vueState__.vueResult) {
                  window.__vueState__.vueResult.value = window.__STATIC_PAGE_DATA__;
                  const resultsEl = document.getElementById('results');
                  if (resultsEl) resultsEl.style.display = 'block';
                  if (window.__vueState__.showSearch) window.__vueState__.showSearch.value = false;
                  if (window.__vueState__.showCheckOther) window.__vueState__.showCheckOther.value = true;
                }
              }, 100);
            }
          })();
        </script>
`;
      // 在 loadResults() 調用之後插入
      html = html.replace('loadResults();', `loadResults();${fixScript}`);
      html = html.replace('</head>', preloadScript + '\n    </head>');
    }

    // 修復資源檔案路徑：將相對路徑改為 ../ 路徑
    // 這樣在子目錄中的頁面（如 dist/google.com/index.html）也能正確載入資源
    // 匹配 src="filename" 或 src='filename'，但不包含 http://、https://、//、/ 開頭的
    html = html.replace(/src=["']((?!https?:\/\/|\.\.\/|\/)[^"']+\.(png|svg|jpg|jpeg|gif|webp|css|js))["']/gi, (match, filename) => {
      return match.replace(filename, `../${filename}`);
    });

    return { success: true, html, url: cleanUrl };
  } catch (error) {
    console.error(`  [瀏覽器 ${index}] 錯誤: ${url}`, error.message);
    return { success: false, html: null, url };
  } finally {
    await page.close();
  }
}

// 處理一批 URL（使用單一瀏覽器實例）
async function processBatch(browser, urls, browserIndex, totalUrls) {
  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const globalIndex = results.length + 1;
    const result = await generateStaticHTML(browser, url, browserIndex, globalIndex);
    results.push(result);
  }

  return results;
}

// 主建置函數
async function build() {
  console.log('開始建置靜態頁面...');
  if (TEST_MODE) {
    console.log('🧪 測試模式：只處理第一個網址（使用 npm run build:all 編譯全部）\n');
  } else {
    console.log('🚀 完整建置模式：處理所有網址\n');
  }

  // 確保輸出目錄存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 複製主頁面（index.html）到輸出目錄
  fs.copyFileSync(TEMPLATE_FILE, path.join(OUTPUT_DIR, 'index.html'));

  // 複製其他資源檔案
  const assets = ['g0v_logo.png', 'Logo_Standard_Clearspace-OCF_Purple.svg', 'APNIC-Foundation-and-ISIF-Logo-CMYK-stacked-01-a.svg'];
  assets.forEach(asset => {
    const srcPath = path.join(__dirname, asset);
    const destPath = path.join(OUTPUT_DIR, asset);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  });

  // 啟動 HTTP 伺服器
  const server = await startServer();

  try {
    // 讀取 URL 列表
    const urls = await loadStatisticData();
    const urlsToProcess = TEST_LIMIT ? urls.slice(0, TEST_LIMIT) : urls;
    console.log(`找到 ${urls.length} 個測試網址，將處理 ${urlsToProcess.length} 個\n`);

    // 將 URL 列表平均分配給各個瀏覽器實例
    const urlsPerBrowser = Math.ceil(urlsToProcess.length / BROWSER_INSTANCES);
    const batches = [];

    for (let i = 0; i < BROWSER_INSTANCES; i++) {
      const start = i * urlsPerBrowser;
      const end = Math.min(start + urlsPerBrowser, urlsToProcess.length);
      if (start < urlsToProcess.length) {
        batches.push({
          urls: urlsToProcess.slice(start, end),
          browserIndex: i + 1
        });
      }
    }

    console.log(`啟動 ${batches.length} 個瀏覽器實例進行平行處理...\n`);

    // 啟動所有瀏覽器實例
    const browsers = await Promise.all(
      batches.map(async () => {
        try {
          return await chromium.launch({
            headless: true
          });
        } catch (error) {
          console.error('啟動瀏覽器失敗:', error.message);
          throw error;
        }
      })
    );

    let successCount = 0;
    let failCount = 0;
    let flatResults = [];

    try {
      // 並行處理所有批次
      const allResults = await Promise.all(
        batches.map((batch, idx) =>
          processBatch(browsers[idx], batch.urls, batch.browserIndex, urlsToProcess.length)
        )
      );

      // 將結果扁平化並寫入檔案
      flatResults = allResults.flat();

      for (const result of flatResults) {
        if (result.success && result.html) {
          // 創建目錄結構：dist/google.com/index.html
          const dirPath = urlToDirPath(result.url);
          const fullDirPath = path.join(OUTPUT_DIR, dirPath);
          const outputPath = path.join(fullDirPath, 'index.html');

          // 確保目錄存在
          if (!fs.existsSync(fullDirPath)) {
            fs.mkdirSync(fullDirPath, { recursive: true });
          }

          // 寫入 index.html
          fs.writeFileSync(outputPath, result.html, 'utf-8');
          successCount++;
          console.log(`  ✓ 已儲存: ${dirPath}/index.html`);
        } else {
          failCount++;
        }
      }
    } finally {
      // 關閉所有瀏覽器實例
      console.log('\n關閉瀏覽器實例...');
      await Promise.all(browsers.map(browser => browser.close()));
    }

    console.log('\n建置完成！');
    console.log(`成功生成: ${successCount} 個頁面`);
    console.log(`失敗/跳過: ${failCount} 個網址`);
    console.log(`輸出目錄: ${OUTPUT_DIR}`);

    if (TEST_MODE && successCount > 0) {
      const firstResult = flatResults.find(r => r.success);
      if (firstResult) {
        const dirPath = urlToDirPath(firstResult.url);
        console.log(`\n📄 測試檔案: ${path.join(OUTPUT_DIR, dirPath, 'index.html')}`);
        console.log(`   URL: http://127.0.0.1:5500/dist/${dirPath}/`);
        console.log(`   可以在瀏覽器中開啟查看結果`);
      }
    }
  } finally {
    // 關閉 HTTP 伺服器
    server.close();
    console.log('\n✓ HTTP 伺服器已關閉');
  }
}

// 執行建置
build().catch(error => {
  console.error('建置失敗:', error);
  process.exit(1);
});
