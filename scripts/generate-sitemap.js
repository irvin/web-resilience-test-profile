#!/usr/bin/env node

/**
 * 生成 sitemap.xml 到 web/ 目錄
 *
 * 預設 baseUrl: https://resilience.ocf.tw/web/
 * 可用 --base 或環境變數 SITEMAP_BASE_URL 覆寫
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'web');

function getArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) throw new Error('請提供 baseUrl（--base 或 SITEMAP_BASE_URL）');
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function escapeXml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function getIndexHtmlLastModDate(indexHtmlPath) {
  try {
    const st = fs.statSync(indexHtmlPath);
    if (!st?.mtime) return null;
    return st.mtime.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function listBuiltDirs(outputDir) {
  try {
    return fs.readdirSync(outputDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .filter(name => fs.existsSync(path.join(outputDir, name, 'index.html')))
      .sort();
  } catch {
    return [];
  }
}

function buildSitemapXml(entries) {
  const body = entries.map(e => {
    const lastmod = e.lastmod ? `\n    <lastmod>${escapeXml(e.lastmod)}</lastmod>` : '';
    return `  <url>\n    <loc>${escapeXml(e.loc)}</loc>${lastmod}\n  </url>`;
  }).join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>\n`
  );
}

function main() {
  const args = process.argv.slice(2);

  const baseUrl = normalizeBaseUrl(
    getArgValue(args, '--base') ||
    process.env.SITEMAP_BASE_URL ||
    'https://resilience.ocf.tw/web/'
  );

  const outputDir = getArgValue(args, '--out') || DEFAULT_OUTPUT_DIR;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const builtDirs = listBuiltDirs(outputDir);

  const entries = [];
  // 以 web/ 內實際存在的目錄為準（更符合實際部署內容）
  // 主頁（/web/）
  const rootIndexLastmod = getIndexHtmlLastModDate(path.join(outputDir, 'index.html'));
  entries.push({ loc: baseUrl, lastmod: rootIndexLastmod });

  for (const dirName of builtDirs) {
    const lastmod = getIndexHtmlLastModDate(path.join(outputDir, dirName, 'index.html'));
    entries.push({
      loc: `${baseUrl}${dirName}/`,
      lastmod,
    });
  }

  const xml = buildSitemapXml(entries);
  const outPath = path.join(outputDir, 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf-8');

  console.log(`✓ sitemap 已產生：${outPath}`);
  console.log(`  baseUrl: ${baseUrl}`);
  console.log(`  urls: ${entries.length}`);
  console.log('  mode: from web/');
}

main();

