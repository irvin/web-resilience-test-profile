const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

// 專案根目錄（build.js 現在在 scripts/ 目錄中）
const ROOT_DIR = path.join(__dirname, '..');

// Submodule 路徑
const SUBMODULE_DIR = path.join(ROOT_DIR, 'test-result');
const STATISTIC_TSV_PATH = path.join(SUBMODULE_DIR, 'statistic.tsv');
const OUTPUT_DIR = path.join(ROOT_DIR, 'web');
const TEMPLATE_FILE = path.join(ROOT_DIR, 'index.html');
const BROWSER_INSTANCES = 8; // 同時開啟的瀏覽器實例數量
const SERVER_PORT = 3000;

// 測試模式：只處理第一個 URL（預設行為）
// --all 參數：編譯所有網站
// 直接傳入網站名稱作為參數：編譯特定網站（例如：node build.js www.article19.org）
const BUILD_ALL = process.argv.includes('--all');

// 檢查是否有直接傳入的參數（不是以 -- 開頭的）
let BUILD_SITE = null;
if (!BUILD_ALL) {
  // 過濾掉 node、腳本路徑、以及所有以 -- 開頭的參數
  const directArgs = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  if (directArgs.length > 0) {
    BUILD_SITE = directArgs[0];
  }
}

const TEST_MODE = !BUILD_ALL && !BUILD_SITE; // 如果沒有 --all 和直接傳入的網站名稱，就是測試模式
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

// 修復資源檔案路徑：將相對路徑改為 ../ 路徑
// 這樣在子目錄中的頁面（如 web/google.com/index.html 或 web/404.html）也能正確載入資源
function fixAssetPaths(html) {
  // 處理 src 屬性
  html = html.replace(/src=["']((?!https?:\/\/|\.\.\/|\/)[^"']+\.(png|svg|jpg|jpeg|gif|webp|css|js))["']/gi, (match, filename) => {
    return match.replace(filename, `../${filename}`);
  });
  // 處理 href 屬性（用於 link 標籤，如 styles.css）
  html = html.replace(/href=["']((?!https?:\/\/|\.\.\/|\/)[^"']+\.(png|svg|jpg|jpeg|gif|webp|css|js))["']/gi, (match, filename) => {
    return match.replace(filename, `../${filename}`);
  });
  return html;
}

// 將網址轉換為完整的輸出路徑（目錄 + index.html）
function urlToOutputPath(url) {
  const dirName = urlToDirPath(url);
  return path.join(dirName, 'index.html');
}

// 讀取 statistic.tsv 並解析 URL 列表
function loadStatisticData() {
  console.log('正在讀取 statistic.tsv...');

  // 檢查 submodule 是否存在
  if (!fs.existsSync(SUBMODULE_DIR)) {
    console.error('❌ Submodule 不存在，請先執行：');
    console.error('   git submodule update --init --recursive');
    process.exit(1);
  }

  if (!fs.existsSync(STATISTIC_TSV_PATH)) {
    console.error(`❌ statistic.tsv 不存在於 ${STATISTIC_TSV_PATH}`);
    console.error('   請確認 submodule 已正確初始化');
    process.exit(1);
  }

  const text = fs.readFileSync(STATISTIC_TSV_PATH, 'utf-8');
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
      } else if (url.pathname.endsWith('.json')) {
        // JSON 檔案從 submodule 讀取
        const filename = path.basename(url.pathname);
        filePath = path.join(SUBMODULE_DIR, filename);
      } else if (url.pathname === '/statistic.tsv') {
        // statistic.tsv 從 submodule 讀取
        filePath = STATISTIC_TSV_PATH;
      } else {
        // 處理其他資源檔案
        filePath = path.join(ROOT_DIR, url.pathname);
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
          '.json': 'application/json',
          '.tsv': 'text/tab-separated-values'
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

    // 取得渲染後的 HTML（用於提取靜態內容和 meta 資訊）
    const renderedHtml = await page.content();

    // 從頁面中取得測試結果資料（用於更新 meta）
    const testResult = await page.evaluate(() => {
      return window.__vueState__ && window.__vueState__.vueResult ? window.__vueState__.vueResult.value : null;
    });

    // 檢查 title 是否已更新（驗證 SEO 資訊）
    const title = await page.title();
    console.log(`  [瀏覽器 ${index}] 頁面標題: ${title}`);

    // 1. 從原始模板取得完整頁面
    let html = fs.readFileSync(TEMPLATE_FILE, 'utf8');

    if (testResult) {
      // 2. 從 playwright 取得中間靜態部分（兩個標記之間的內容）
      const staticWrapperHTML = await page.evaluate(() => {
        const beginMarker = document.querySelector('div[data-static="begin"]');
        const endMarker = document.querySelector('div[data-static="end"]');

        if (beginMarker && endMarker && beginMarker.parentElement) {
          const parentHTML = beginMarker.parentElement.innerHTML;
          const beginMarkerHTML = beginMarker.outerHTML;
          const endMarkerHTML = endMarker.outerHTML;
          const beginIndex = parentHTML.indexOf(beginMarkerHTML);
          const endIndex = parentHTML.indexOf(endMarkerHTML);

          if (beginIndex !== -1 && endIndex !== -1 && endIndex > beginIndex) {
            const start = beginIndex + beginMarkerHTML.length;
            return parentHTML.substring(start, endIndex).trim();
          }
        }
        return '';
      });

      // 3. 替換原始版中間的部分
      const beginPattern = /<div[^>]*class="static-wrapper"[^>]*data-static="begin"[^>]*><\/div>/;
      const endPattern = /<div[^>]*class="static-wrapper"[^>]*data-static="end"[^>]*><\/div>/;

      const beginMatch = html.match(beginPattern);
      const endMatch = html.match(endPattern);

      if (beginMatch && endMatch) {
        const beginIndex = beginMatch.index;
        const endIndex = endMatch.index;

        if (endIndex > beginIndex) {
          const beginTagEnd = beginIndex + beginMatch[0].length;
          const endTagStart = endIndex;

          // 替換兩個標記之間的所有內容
          const beforeBegin = html.substring(0, beginTagEnd);
          const afterEnd = html.substring(endTagStart);
          html = beforeBegin + '\n        ' + staticWrapperHTML + '\n    ' + afterEnd;
          console.log(`  [瀏覽器 ${index}] ✅ 已替換 static-wrapper 內容`);
        } else {
          console.log(`  [瀏覽器 ${index}] ⚠️  標記順序錯誤 (begin: ${beginIndex}, end: ${endIndex})`);
        }
      } else {
        console.log(`  [瀏覽器 ${index}] ⚠️  找不到 data-static 標記 (begin: ${beginMatch ? 'found' : 'not found'}, end: ${endMatch ? 'found' : 'not found'})`);
      }

      // 4. 替換整個 head 部分
      // 從 Playwright 渲染的 HTML 中提取整個 head
      const renderedHead = await page.evaluate(() => {
        const headElement = document.querySelector('head');
        return headElement ? headElement.outerHTML : '';
      });

      if (renderedHead) {
        // 替換原始模板中的整個 head 部分
        const headPattern = /<head[^>]*>[\s\S]*?<\/head>/i;
        const headMatch = html.match(headPattern);
        if (headMatch) {
          html = html.replace(headPattern, renderedHead);
          console.log(`  [瀏覽器 ${index}] ✅ 已替換整個 head 部分`);
        } else {
          console.log(`  [瀏覽器 ${index}] ⚠️  找不到 head 標籤`);
        }
      } else {
        console.log(`  [瀏覽器 ${index}] ⚠️  無法從渲染頁面提取 head`);
      }

      // 在靜態頁面中加入環境變數標記
      // 在 </head> 之前插入標記 script
      const staticPageMarker = `
    <script>
        // 標記此頁面為靜態編譯頁面
        window.__IS_STATIC_PAGE__ = true;
    </script>
`;
      html = html.replace('</head>', staticPageMarker + '</head>');
      console.log(`  [瀏覽器 ${index}] ✅ 已加入靜態頁面標記`);
    }

    // 修復資源檔案路徑
    html = fixAssetPaths(html);

    return { success: true, html, url: cleanUrl };
  } catch (error) {
    console.error(`  [瀏覽器 ${index}] 錯誤: ${url}`, error.message);
    return { success: false, html: null, url };
  } finally {
    await page.close();
  }
}

// 處理單一 URL（使用瀏覽器實例）
async function processUrl(browser, url, browserIndex, globalIndex, totalUrls) {
  return await generateStaticHTML(browser, url, browserIndex, globalIndex);
}

// Worker 函數：從 URL 隊列中取一個處理一個
async function processUrlWorker(browser, urlQueue, workerId, totalUrls) {
  const results = [];

  while (urlQueue.length > 0) {
    const url = urlQueue.shift();
    if (!url) break;

    const globalIndex = totalUrls - urlQueue.length;
    const result = await processUrl(browser, url, workerId, globalIndex, totalUrls);
    results.push(result);

    // 立即寫入檔案（不需要等待所有完成）
    if (result.success && result.html) {
      const dirPath = urlToDirPath(result.url);
      const fullDirPath = path.join(OUTPUT_DIR, dirPath);
      const outputPath = path.join(fullDirPath, 'index.html');

      // 確保目錄存在
      if (!fs.existsSync(fullDirPath)) {
        fs.mkdirSync(fullDirPath, { recursive: true });
      }

      // 寫入 index.html
      fs.writeFileSync(outputPath, result.html, 'utf-8');
      console.log(`  ✓ 已儲存: ${dirPath}/index.html`);
    }
  }

  return results;
}

// 主建置函數
async function build() {
  console.log('開始建置靜態頁面...');
  if (BUILD_SITE) {
    console.log(`🎯 特定網站模式：只處理 ${BUILD_SITE}\n`);
  } else if (TEST_MODE) {
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

  // 複製主頁面作為 404.html，並修復圖片路徑
  let html404 = fs.readFileSync(TEMPLATE_FILE, 'utf8');
  html404 = fixAssetPaths(html404);
  fs.writeFileSync(path.join(OUTPUT_DIR, '404.html'), html404, 'utf8');

  // 複製其他資源檔案
  const assets = ['g0v_logo.svg', 'Logo_Compact-OCF_Purple.svg', 'APNIC-Foundation-and-ISIF-Logo-CMYK-stacked-01-a.svg', 'styles.css', 'app.js'];
  assets.forEach(asset => {
    const srcPath = path.join(ROOT_DIR, asset);
    const destPath = path.join(OUTPUT_DIR, asset);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  });

  // 注意：statistic.tsv 和 JSON 檔案都不複製到 web
  // - 建置時：從 submodule 讀取 statistic.tsv 取得 URL 列表
  // - 建置時的 HTTP 伺服器：從 submodule 提供檔案（用於渲染）
  // - 部署後的主頁面：從線上 API 讀取 statistic.tsv 和 JSON
  // - 靜態頁面（如 web/google.com/index.html）：使用內嵌的資料，不需要額外檔案

  // 啟動 HTTP 伺服器
  const server = await startServer();

  try {
    // 讀取 URL 列表
    const urls = loadStatisticData();

    // 根據模式過濾 URL
    let urlsToProcess;
    if (BUILD_SITE) {
      // 過濾出匹配的網站（支援部分匹配，例如 "article19.org" 可以匹配 "www.article19.org"）
      const sitePattern = BUILD_SITE.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      urlsToProcess = urls.filter(url => {
        const cleanUrl = url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        return cleanUrl.includes(sitePattern) || sitePattern.includes(cleanUrl);
      });

      if (urlsToProcess.length === 0) {
        console.error(`❌ 找不到匹配 "${BUILD_SITE}" 的網站`);
        console.error(`   請確認網站名稱是否正確`);
        process.exit(1);
      }

      console.log(`找到 ${urlsToProcess.length} 個匹配的網站：`);
      urlsToProcess.forEach(url => console.log(`   - ${url}`));
      console.log('');
    } else {
      urlsToProcess = TEST_LIMIT ? urls.slice(0, TEST_LIMIT) : urls;
    }

    console.log(`找到 ${urls.length} 個測試網址，將處理 ${urlsToProcess.length} 個\n`);

    // 創建 URL 隊列（複製一份，避免修改原始陣列）
    const urlQueue = [...urlsToProcess];

    console.log(`啟動 ${BROWSER_INSTANCES} 個瀏覽器實例進行平行處理...\n`);

    // 啟動所有瀏覽器實例
    const browsers = await Promise.all(
      Array.from({ length: BROWSER_INSTANCES }, async (_, idx) => {
        try {
          return await chromium.launch({
            headless: true  // 不顯示瀏覽器視窗
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
      // 並行處理：每個 worker 從隊列中取一個 URL 處理一個
      const allResults = await Promise.all(
        browsers.map((browser, idx) =>
          processUrlWorker(browser, urlQueue, idx + 1, urlsToProcess.length)
        )
      );

      // 將結果扁平化
      flatResults = allResults.flat();

      // 統計成功和失敗數量
      for (const result of flatResults) {
        if (result.success && result.html) {
          successCount++;
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
        console.log(`   URL: http://127.0.0.1:5500/web/${dirPath}/`);
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
