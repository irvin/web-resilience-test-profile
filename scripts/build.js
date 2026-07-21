const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { bakeShellStrings } = require('./bake-shell-strings');

// Repository root (this file lives under scripts/)
const ROOT_DIR = path.join(__dirname, '..');

// Submodule path
const SUBMODULE_DIR = path.join(ROOT_DIR, 'test-result');
const STATISTIC_TSV_PATH = path.join(SUBMODULE_DIR, 'statistic.tsv');
const OVERALL_RESULT_TSV_PATH = path.join(SUBMODULE_DIR, 'overall-result.tsv');
const SUBMODULE_IMG_DIR = path.join(SUBMODULE_DIR, 'img');
const OUTPUT_DIR = path.join(ROOT_DIR, 'web');
const TEMPLATE_FILE = path.join(ROOT_DIR, 'index.html');
const BROWSER_INSTANCES = 8; // parallel browser instances
const SERVER_PORT = 3000;
const BUILD_LOCALES = ['zh-TW', 'en'];
const PUBLIC_BASE = 'https://resilience.ocf.tw/web';
const SITEMAP_BASE_URL = `${PUBLIC_BASE}/`; // sitemap base URL (/web)

// Test mode: only the first URL (default)
// --all: build every site
// Pass a site name to build a subset (e.g. node build.js www.article19.org)
const BUILD_ALL = process.argv.includes('--all');

// Optional positional site filter (not starting with --)
let BUILD_SITE = null;
if (!BUILD_ALL) {
  // Ignore node, script path, and any --flags
  const directArgs = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  if (directArgs.length > 0) {
    BUILD_SITE = directArgs[0];
  }
}

const TEST_MODE = !BUILD_ALL && !BUILD_SITE; // true when neither --all nor a site name is provided
const TEST_LIMIT = TEST_MODE ? 1 : null;

// Turn a URL into a safe directory name
function urlToDirPath(url) {
  let cleanUrl = url.replace(/^https?:\/\//, '');
  cleanUrl = cleanUrl.replace(/\/+$/, '');
  cleanUrl = cleanUrl.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (cleanUrl.length > 100) {
    cleanUrl = cleanUrl.slice(0, 100);
  }
  return cleanUrl;
}

function stripTrailingWhitespace(html) {
  return html.replace(/[\t ]+$/gm, '');
}

// Rewrite relative asset URLs so nested pages load correctly (depth 0 = same dir, 1 = ../, 2 = ../../)
function fixAssetPaths(html, depth = 1) {
  const prefix = depth === 0 ? '' : depth === 2 ? '../../' : '../';
  if (!prefix) {
    return html;
  }
  // src="..."
  html = html.replace(/src=["']((?!https?:\/\/|\.\.\/|\/)[^"']+\.(png|svg|jpg|jpeg|gif|webp|css|js))["']/gi, (match, filename) => {
    return match.replace(filename, `${prefix}${filename}`);
  });
  // href="..." (e.g. styles.css)
  html = html.replace(/href=["']((?!https?:\/\/|\.\.\/|\/)[^"']+\.(png|svg|jpg|jpeg|gif|webp|css|js))["']/gi, (match, filename) => {
    return match.replace(filename, `${prefix}${filename}`);
  });
  return html;
}

function publicPageUrl(domain, locale) {
  if (!domain) {
    return locale === 'en' ? `${PUBLIC_BASE}/en/` : `${PUBLIC_BASE}/`;
  }
  return locale === 'en'
    ? `${PUBLIC_BASE}/${domain}/en/`
    : `${PUBLIC_BASE}/${domain}/`;
}

function injectPageUrls(html, domain, locale) {
  const pageUrl = publicPageUrl(domain, locale);
  const htmlLang = locale === 'en' ? 'en' : 'zh-TW';
  let out = html.replace(/<html lang="[^"]*">/i, `<html lang="${htmlLang}">`);
  out = out.replace(
    /<link id="canonical"[^>]*href="[^"]*"/i,
    `<link id="canonical" rel="canonical" href="${pageUrl}"`
  );
  out = out.replace(
    /<meta property="og:url" content="[^"]*"/i,
    `<meta property="og:url" content="${pageUrl}"`
  );
  return out;
}

function injectHreflang(html, { zhUrl, enUrl }) {
  // Only skip when <link rel="alternate"> exists (not <a hreflang> in the lang switcher).
  if (html.includes('rel="alternate" hreflang="zh-TW"') && html.includes('rel="alternate" hreflang="en"')) {
    return html;
  }
  const block = `    <link rel="alternate" hreflang="zh-TW" href="${zhUrl}">
    <link rel="alternate" hreflang="en" href="${enUrl}">
`;
  return html.replace('</head>', `${block}</head>`);
}

/** Only the homepage build should ship OG image tags for the overall chart (template omits them). */
function injectHomepageChartOgMeta(html, locale) {
  if (html.includes('property="og:image"')) {
    return html.replace(
      /<meta property="og:image:alt" content="[^"]*">/i,
      `<meta property="og:image:alt" content="${locale === 'en'
        ? 'Overall resilience test results chart for popular Taiwan websites'
        : '台灣常用網站韌性檢測整體結果圖表'}">`
    );
  }

  const imageUrl = `${PUBLIC_BASE}/img/overall-result.png`;
  const alt = locale === 'en'
    ? 'Overall resilience test results chart for popular Taiwan websites'
    : '台灣常用網站韌性檢測整體結果圖表';
  const block = `    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:alt" content="${alt}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${imageUrl}">
`;
  return html.replace('</head>', `${block}</head>`);
}

function getSiteOutputPath(domainDir, locale) {
  if (locale === 'en') {
    return path.join(OUTPUT_DIR, domainDir, 'en', 'index.html');
  }
  return path.join(OUTPUT_DIR, domainDir, 'index.html');
}

function getHomepageOutputPath(locale) {
  if (locale === 'en') {
    return path.join(OUTPUT_DIR, 'en', 'index.html');
  }
  return path.join(OUTPUT_DIR, 'index.html');
}

function getAssetDepth(locale, isHomepage) {
  if (isHomepage) {
    return locale === 'en' ? 1 : 0;
  }
  return locale === 'en' ? 2 : 1;
}

function stripSiteDynamic(html) {
  return html.replace(/<div id="site-dynamic"[^>]*>[\s\S]*?(?=\s*<div id="search-container")/i, '');
}

function stripOverviewDynamic(html) {
  return html.replace(/<div id="overview-dynamic"[^>]*>[\s\S]*?(?=\s*<footer>)/i, '');
}

function insertHomeTitle(html, homeTitleHTML) {
  if (!homeTitleHTML) {
    return html;
  }
  return html.replace(/(<\/nav>\s*)/i, `$1\n\n    ${homeTitleHTML}\n\n    `);
}

function finalizeHomepageHtml(html, homeTitleHTML) {
  const prerenderPattern = /<div v-pre id="overview-prerender"[^>]*>[\s\S]*?<div[^>]*data-overview-static="begin"[^>]*><\/div>([\s\S]*?)<div[^>]*data-overview-static="end"[^>]*><\/div>\s*<\/div>\s*<div id="overview-dynamic"[^>]*>[\s\S]*?(?=\s*<footer>)/i;
  let out = prerenderPattern.test(html)
    ? html.replace(prerenderPattern, '$1\n\n    ')
    : stripHomepageOverview(html);
  out = stripSiteDynamic(out);
  return insertHomeTitle(out, homeTitleHTML);
}

function finalizeSiteHtml(html) {
  let out = stripSiteDynamic(html);
  out = stripHomepageOverview(out);
  return out;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getStatisticArtifact() {
  const statisticContent = fs.readFileSync(STATISTIC_TSV_PATH, 'utf-8');
  const statisticVersion = crypto.createHash('sha1').update(statisticContent).digest('hex');
  return { statisticFileName: `statistic.${statisticVersion}.tsv` };
}

function statisticPublicUrl(statisticFileName) {
  return `/web/${statisticFileName}`;
}

/**
 * Replace the template meta with the versioned URL; optionally append preload and static marker before </head>.
 */
function injectHeadExtras(html, { statisticFileName, statisticPreload = false, staticPageMarker = false }) {
  const url = statisticPublicUrl(statisticFileName);
  let out = html.replace(
    /<meta name="web-resilience-statistic-url" content="[^"]*">/,
    `<meta name="web-resilience-statistic-url" content="${url}">`
  );
  const extra = [];
  if (statisticPreload) {
    extra.push(`    <link rel="preload" href="${url}" as="fetch">`);
  }
  if (staticPageMarker) {
    extra.push('    <script>window.__IS_STATIC_PAGE__ = true;</script>');
  }
  if (extra.length) {
    out = out.replace('</head>', `\n${extra.join('\n')}\n</head>`);
  }
  return out;
}

function stripHomepageOverview(html) {
  let out = html.replace(
    /<div v-pre id="overview-prerender"[^>]*>[\s\S]*?<\/div>\s*(?=<div id="overview-dynamic")/i,
    ''
  );
  out = out.replace(/<div id="overview-dynamic"[^>]*>[\s\S]*?(?=\s*<footer>)/i, '');
  return out;
}

function insertBetweenDataMarkers(html, attribute, content) {
  const beginPattern = new RegExp(`<div[^>]*${attribute}="begin"[^>]*><\\/div>`);
  const endPattern = new RegExp(`<div[^>]*${attribute}="end"[^>]*><\\/div>`);

  const beginMatch = html.match(beginPattern);
  const endMatch = html.match(endPattern);
  if (!beginMatch || !endMatch) {
    return { html, ok: false };
  }

  const beginIndex = beginMatch.index;
  const endIndex = endMatch.index;
  if (endIndex <= beginIndex) {
    return { html, ok: false };
  }

  const beginTagEnd = beginIndex + beginMatch[0].length;
  const beforeBegin = html.substring(0, beginTagEnd);
  const afterEnd = html.substring(endIndex);
  return {
    html: beforeBegin + '\n        ' + content + '\n    ' + afterEnd,
    ok: true
  };
}

function cleanupVersionedStatisticTsfs(outputDir) {
  if (!fs.existsSync(outputDir)) return;
  for (const entry of fs.readdirSync(outputDir)) {
    if (/^statistic\.[a-f0-9]+\.tsv$/i.test(entry)) {
      fs.rmSync(path.join(outputDir, entry), { force: true });
    }
  }
}

function copyVersionedStatistic(outputDir, artifact) {
  if (!fs.existsSync(STATISTIC_TSV_PATH)) return;
  cleanupVersionedStatisticTsfs(outputDir);
  fs.copyFileSync(STATISTIC_TSV_PATH, path.join(outputDir, artifact.statisticFileName));
}

// Read statistic.tsv and return host/path list (no scheme)
function loadStatisticData() {
  console.log('Reading statistic.tsv...');

  if (!fs.existsSync(SUBMODULE_DIR)) {
    console.error('❌ Submodule missing. Run:');
    console.error('   git submodule update --init --recursive');
    process.exit(1);
  }

  if (!fs.existsSync(STATISTIC_TSV_PATH)) {
    console.error(`❌ statistic.tsv not found at ${STATISTIC_TSV_PATH}`);
    console.error('   Initialize the submodule and try again.');
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

// Minimal static HTTP server for local rendering
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${SERVER_PORT}`);
      let filePath;

      if (url.pathname === '/' || url.pathname === '/index.html') {
        const hasUrlQuery = url.searchParams.has('url');
        const langParam = url.searchParams.get('lang');
        if (hasUrlQuery || langParam === 'en') {
          filePath = TEMPLATE_FILE;
        } else {
          const builtIndex = path.join(OUTPUT_DIR, 'index.html');
          filePath = fs.existsSync(builtIndex) ? builtIndex : TEMPLATE_FILE;
        }
      } else if (url.pathname.endsWith('.json')) {
        const filename = path.basename(url.pathname);
        filePath = path.join(SUBMODULE_DIR, filename);
      } else if (url.pathname === '/statistic.tsv') {
        filePath = STATISTIC_TSV_PATH;
      } else {
        filePath = path.join(ROOT_DIR, url.pathname);
      }

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
      console.log(`✓ HTTP server listening on http://localhost:${SERVER_PORT}\n`);
      resolve(server);
    });
  });
}

// Render one page with Playwright and extract static HTML
async function generateStaticHTML(browser, url, index, total, artifact, locale) {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 }
  });

  try {

    const cleanUrl = url.replace(/\/+$/, '');
    const previewParams = new URLSearchParams({
      url: cleanUrl,
      lang: locale
    });
    const fileUrl = `http://localhost:${SERVER_PORT}/?${previewParams.toString()}`;

    console.log(`  [browser ${index}] [${locale}] [${total}] loading: ${cleanUrl}`);

    await page.goto(fileUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait until we either have a result card or the empty-search UI
    await page.waitForFunction(
      () => {
        const vueState = window.__vueState__;
        if (!vueState) return false;

        const hasResult = !!(vueState.vueResult && vueState.vueResult.value);
        const noResultEl = document.getElementById('search-no-results');
        const hasNoResultMessage = !!(noResultEl && noResultEl.textContent && noResultEl.textContent.trim().length > 0);
        return hasResult || hasNoResultMessage;
      },
      { timeout: 10000 }
    ).catch(() => {
      console.log(`  [browser ${index}] warning: timed out waiting for render state: ${cleanUrl}`);
    });

    // Two rAF ticks to flush DOM updates
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));

    const renderedHtml = await page.content();

    const testResult = await page.evaluate(() => {
      return window.__vueState__ && window.__vueState__.vueResult ? window.__vueState__.vueResult.value : null;
    });

    const title = await page.title();
    console.log(`  [browser ${index}] document title: ${title}`);

    let html = fs.readFileSync(TEMPLATE_FILE, 'utf8');

    if (testResult) {
      const staticWrapperHTML = await page.evaluate(() => {
        const dynamicRoot = document.getElementById('site-dynamic');
        return dynamicRoot ? dynamicRoot.innerHTML.trim() : '';
      });

      const beginPattern = /<div[^>]*class="static-wrapper"[^>]*data-static="begin"[^>]*><\/div>/;
      const endPattern = /<div[^>]*class="static-wrapper"[^>]*data-static="end"[^>]*><\/div>/;

      const beginMatch = html.match(beginPattern);
      const endMatch = html.match(endPattern);

      if (beginMatch && endMatch) {
        const inserted = insertBetweenDataMarkers(html, 'data-static', staticWrapperHTML);
        if (inserted.ok) {
          html = inserted.html;
          console.log(`  [browser ${index}] ✅ replaced static-wrapper region`);
        } else {
          console.log(`  [browser ${index}] ⚠️  marker order invalid (begin: ${beginMatch.index}, end: ${endMatch.index})`);
        }
      } else {
        console.log(`  [browser ${index}] ⚠️  data-static markers missing (begin: ${beginMatch ? 'found' : 'not found'}, end: ${endMatch ? 'found' : 'not found'})`);
      }

      const renderedHead = await page.evaluate(() => {
        const headElement = document.querySelector('head');
        return headElement ? headElement.outerHTML : '';
      });

      if (renderedHead) {
        const headPattern = /<head[^>]*>[\s\S]*?<\/head>/i;
        const headMatch = html.match(headPattern);
        if (headMatch) {
          html = html.replace(headPattern, renderedHead);
          console.log(`  [browser ${index}] ✅ replaced <head>`);
        } else {
          console.log(`  [browser ${index}] ⚠️  <head> not found in template`);
        }
      } else {
        console.log(`  [browser ${index}] ⚠️  could not extract <head> from rendered page`);
      }

      html = injectHeadExtras(html, {
        statisticFileName: artifact.statisticFileName,
        staticPageMarker: true
      });
      console.log(`  [browser ${index}] ✅ injected static page markers`);

      const domainDir = urlToDirPath(cleanUrl);
      html = injectPageUrls(html, domainDir, locale);
      html = injectHreflang(html, {
        zhUrl: publicPageUrl(domainDir, 'zh-TW'),
        enUrl: publicPageUrl(domainDir, 'en')
      });

      html = finalizeSiteHtml(html);
      html = bakeShellStrings(html, { locale, domain: domainDir }, ROOT_DIR);
    }

    const depth = getAssetDepth(locale, false);
    html = fixAssetPaths(html, depth);

    return { success: true, html: stripTrailingWhitespace(html), url: cleanUrl, locale };
  } catch (error) {
    console.error(`  [browser ${index}] error: ${url}`, error.message);
    return { success: false, html: null, url, locale };
  } finally {
    await page.close();
  }
}

/** Prerender homepage overview (into data-overview-static) and <head> meta/title. */
async function prerenderHomepageOverviewAndMeta(browser, artifact, locale) {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 }
  });

  try {
    console.log(`  [homepage] [${locale}] loading / (overview + meta)...`);
    await page.goto(`http://localhost:${SERVER_PORT}/?lang=${locale}`, {
      waitUntil: 'networkidle0',
      timeout: 45000
    });

    await page
      .waitForFunction(
        () => {
          const root = document.getElementById('overview-dynamic');
          if (!root) return false;
          return !root.textContent.includes('{{');
        },
        { timeout: 25000 }
      )
      .catch(() => {
        console.log('  [homepage] ⚠️  timeout waiting for #overview-dynamic; continuing');
      });

    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));

    const overviewHTML = await page.evaluate(() => {
      const dynamicRoot = document.getElementById('overview-dynamic');
      return dynamicRoot ? dynamicRoot.innerHTML.trim() : '';
    });

    const homeTitleHTML = await page.evaluate(() => {
      const titleEl = document.querySelector('#site-dynamic h1.home-title');
      return titleEl ? titleEl.outerHTML.trim() : '';
    });

    let html = fs.readFileSync(TEMPLATE_FILE, 'utf8');

    if (overviewHTML) {
      const inserted = insertBetweenDataMarkers(html, 'data-overview-static', overviewHTML);
      if (inserted.ok) {
        html = inserted.html;
        console.log('  [homepage] ✅ replaced data-overview-static region');
      } else {
        console.log('  [homepage] ⚠️  data-overview-static markers missing or invalid');
      }
    }

    const renderedHead = await page.evaluate(() => {
      const headElement = document.querySelector('head');
      return headElement ? headElement.outerHTML : '';
    });

    if (renderedHead) {
      const headPattern = /<head[^>]*>[\s\S]*?<\/head>/i;
      if (headPattern.test(html)) {
        html = html.replace(headPattern, renderedHead);
        console.log('  [homepage] ✅ replaced <head>');
      }
    }

    html = injectHeadExtras(html, {
      statisticFileName: artifact.statisticFileName,
      statisticPreload: false,
      staticPageMarker: false
    });

    html = injectHreflang(html, {
      zhUrl: publicPageUrl('', 'zh-TW'),
      enUrl: publicPageUrl('', 'en')
    });

    html = injectPageUrls(html, '', locale);

    // Prerender runs on localhost where getOverallChartUrl() is /test-result/img/...;
    // shipped site lives under /web/ with assets in /web/img/ (see copy step above).
    html = html.replace(/\/test-result\/img\/overall-result\.(svg|png)/g, '/web/img/overall-result.png');

    html = injectHomepageChartOgMeta(html, locale);
    html = finalizeHomepageHtml(html, homeTitleHTML);
    html = bakeShellStrings(html, { locale, domain: '' }, ROOT_DIR);

    const depth = getAssetDepth(locale, true);
    html = fixAssetPaths(html, depth);

    return stripTrailingWhitespace(html);
  } catch (error) {
    console.error('  [homepage] error:', error.message);
    throw error;
  } finally {
    await page.close();
  }
}

async function processUrl(browser, url, browserIndex, globalIndex, totalUrls, artifact, locale) {
  return await generateStaticHTML(browser, url, browserIndex, globalIndex, artifact, locale);
}

async function processUrlWorker(browser, urlQueue, workerId, totalUrls, artifact, locale) {
  const results = [];

  while (urlQueue.length > 0) {
    const url = urlQueue.shift();
    if (!url) break;

    const globalIndex = totalUrls - urlQueue.length;
    const result = await processUrl(browser, url, workerId, globalIndex, totalUrls, artifact, locale);
    results.push(result);

    if (result.success && result.html) {
      const dirPath = urlToDirPath(result.url);
      const outputPath = getSiteOutputPath(dirPath, locale);
      const fullDirPath = path.dirname(outputPath);

      if (!fs.existsSync(fullDirPath)) {
        fs.mkdirSync(fullDirPath, { recursive: true });
      }

      fs.writeFileSync(outputPath, result.html, 'utf-8');
      const relPath = locale === 'en' ? `${dirPath}/en/index.html` : `${dirPath}/index.html`;
      console.log(`  ✓ wrote ${relPath}`);
    }
  }

  return results;
}

async function build() {
  console.log('Building static pages...');
  if (BUILD_SITE) {
    console.log(`🎯 Single-site mode: ${BUILD_SITE}\n`);
  } else if (TEST_MODE) {
    console.log('🧪 Test mode: only the first URL (use npm run build:all for everything)\n');
  } else {
    console.log('🚀 Full build: all URLs\n');
  }

  const artifact = getStatisticArtifact();
  const templateHtml = fs.readFileSync(TEMPLATE_FILE, 'utf8');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const homepageHtml = injectHeadExtras(templateHtml, {
    statisticFileName: artifact.statisticFileName,
    statisticPreload: true
  });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'index.html'),
    stripTrailingWhitespace(homepageHtml),
    'utf8'
  );

  const assets = [
    'g0v_logo.svg',
    'Logo_Compact-OCF_Purple.svg',
    'APNIC-Foundation-and-ISIF-Logo-CMYK-stacked-01-a.svg',
    'styles.css',
    'app.js',
    'i18n.js',
    'favicon.ico'
  ];
  assets.forEach(asset => {
    const srcPath = path.join(ROOT_DIR, asset);
    const destPath = path.join(OUTPUT_DIR, asset);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  });

  copyDirRecursive(path.join(ROOT_DIR, 'locales'), path.join(OUTPUT_DIR, 'locales'));

  copyVersionedStatistic(OUTPUT_DIR, artifact);

  if (fs.existsSync(OVERALL_RESULT_TSV_PATH)) {
    fs.copyFileSync(OVERALL_RESULT_TSV_PATH, path.join(OUTPUT_DIR, 'overall-result.tsv'));
  }

  if (fs.existsSync(SUBMODULE_IMG_DIR)) {
    const outputImgDir = path.join(OUTPUT_DIR, 'img');
    fs.rmSync(outputImgDir, { recursive: true, force: true });
    fs.mkdirSync(outputImgDir, { recursive: true });

    const overallChartSrc = path.join(SUBMODULE_IMG_DIR, 'overall-result.svg');
    const overallChartDest = path.join(outputImgDir, 'overall-result.svg');
    const overallChartPngSrc = path.join(SUBMODULE_IMG_DIR, 'overall-result.png');
    const overallChartPngDest = path.join(outputImgDir, 'overall-result.png');
    if (fs.existsSync(overallChartSrc)) {
      fs.copyFileSync(overallChartSrc, overallChartDest);
    }
    if (fs.existsSync(overallChartPngSrc)) {
      fs.copyFileSync(overallChartPngSrc, overallChartPngDest);
    } else {
      console.warn(`⚠️  Missing ${overallChartPngSrc}; homepage chart expects PNG`);
    }
  }

  const server = await startServer();

  try {
    const urls = loadStatisticData();

    let urlsToProcess;
    if (BUILD_SITE) {
      const sitePattern = BUILD_SITE.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      urlsToProcess = urls.filter(url => {
        const cleanUrl = url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        return cleanUrl.includes(sitePattern) || sitePattern.includes(cleanUrl);
      });

      if (urlsToProcess.length === 0) {
        console.error(`❌ No sites matched "${BUILD_SITE}"`);
        console.error('   Check the site name / partial match string.');
        process.exit(1);
      }

      console.log(`Matched ${urlsToProcess.length} site(s):`);
      urlsToProcess.forEach(url => {
        console.log(`   - ${url}`);
      });
      console.log('');
    } else {
      urlsToProcess = TEST_LIMIT ? urls.slice(0, TEST_LIMIT) : urls;
    }

    console.log(`Found ${urls.length} URLs in statistic.tsv; processing ${urlsToProcess.length} per locale\n`);

    let totalSuccess = 0;
    let totalFail = 0;
    let flatResults = [];

    for (const locale of BUILD_LOCALES) {
      console.log(`\n=== Building locale: ${locale} ===\n`);

      console.log('Prerendering homepage (.overview-card + <head>)...\n');
      const homeBrowser = await chromium.launch({
        headless: true
      });
      try {
        const prerenderedHome = await prerenderHomepageOverviewAndMeta(homeBrowser, artifact, locale);
        const homePath = getHomepageOutputPath(locale);
        fs.mkdirSync(path.dirname(homePath), { recursive: true });
        fs.writeFileSync(homePath, prerenderedHome, 'utf8');
        const relHome = locale === 'en' ? 'en/index.html' : 'index.html';
        console.log(`✓ Homepage overview + meta written to web/${relHome}\n`);
      } finally {
        await homeBrowser.close();
      }

      const urlQueue = [...urlsToProcess];

      console.log(`Launching ${BROWSER_INSTANCES} browser instances...\n`);

      const browsers = await Promise.all(
        Array.from({ length: BROWSER_INSTANCES }, async () => {
          try {
            return await chromium.launch({
              headless: true
            });
          } catch (error) {
            console.error('Failed to launch browser:', error.message);
            throw error;
          }
        })
      );

      let successCount = 0;
      let failCount = 0;

      try {
        const allResults = await Promise.all(
          browsers.map((browser, idx) =>
            processUrlWorker(browser, urlQueue, idx + 1, urlsToProcess.length, artifact, locale)
          )
        );

        const localeResults = allResults.flat();
        flatResults = flatResults.concat(localeResults);

        for (const result of localeResults) {
          if (result.success && result.html) {
            successCount++;
          } else {
            failCount++;
          }
        }
      } finally {
        console.log('\nClosing browser instances...');
        await Promise.all(browsers.map(browser => browser.close()));
      }

      console.log(`\nLocale ${locale} finished: ${successCount} page(s), ${failCount} failed/skipped`);
      totalSuccess += successCount;
      totalFail += failCount;
    }

    console.log('\nBuild finished.');
    console.log(`Generated: ${totalSuccess} page(s) across ${BUILD_LOCALES.length} locale(s)`);
    console.log(`Failed / skipped: ${totalFail} URL(s)`);
    console.log(`Output: ${OUTPUT_DIR}`);

    if (TEST_MODE) {
      console.log('ℹ️  Test mode: leaving sitemap.xml unchanged');
    } else {
      try {
        const sitemapScript = path.join(__dirname, 'generate-sitemap.js');
        execFileSync(process.execPath, [sitemapScript, '--base', SITEMAP_BASE_URL, '--out', OUTPUT_DIR], { stdio: 'inherit' });
      } catch (e) {
        console.log(`⚠️  sitemap generation failed: ${e.message}`);
      }
    }

    if (TEST_MODE && totalSuccess > 0) {
      const firstResult = flatResults.find(r => r.success);
      if (firstResult) {
        const dirPath = urlToDirPath(firstResult.url);
        const zhPath = path.join(OUTPUT_DIR, dirPath, 'index.html');
        const enPath = path.join(OUTPUT_DIR, dirPath, 'en', 'index.html');
        console.log(`\n📄 Test output (zh-TW): ${zhPath}`);
        console.log(`   URL: http://127.0.0.1:5500/web/${dirPath}/`);
        if (fs.existsSync(enPath)) {
          console.log(`📄 Test output (en): ${enPath}`);
          console.log(`   URL: http://127.0.0.1:5500/web/${dirPath}/en/`);
        }
        console.log('   Open in a browser to preview.');
      }
    }
  } finally {
    server.close();
    console.log('\n✓ HTTP server stopped');
  }
}

build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
