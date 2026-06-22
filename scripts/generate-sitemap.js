#!/usr/bin/env node

/**
 * Generate sitemap.xml under web/
 *
 * Default baseUrl: https://resilience.ocf.tw/web/
 * Override with --base or SITEMAP_BASE_URL
 *
 * Emits zh-TW and en URLs for the homepage and each site in statistic.tsv.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'web');
const STATISTIC_TSV_PATH = path.join(ROOT_DIR, 'test-result', 'statistic.tsv');

function getArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) throw new Error('baseUrl is required (--base or SITEMAP_BASE_URL)');
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

function urlToDirPath(url) {
  let cleanUrl = url.replace(/^https?:\/\//, '');
  cleanUrl = cleanUrl.replace(/\/+$/, '');
  cleanUrl = cleanUrl.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (cleanUrl.length > 100) {
    cleanUrl = cleanUrl.slice(0, 100);
  }
  return cleanUrl;
}

function loadStatisticDomains() {
  if (!fs.existsSync(STATISTIC_TSV_PATH)) {
    return [];
  }

  const text = fs.readFileSync(STATISTIC_TSV_PATH, 'utf-8');
  const lines = text.split('\n').filter(line => line.trim());
  const domains = [];

  for (let i = 1; i < lines.length; i++) {
    let url = lines[i].split('\t')[0];
    if (url && url.startsWith('http')) {
      url = url.replace(/\/+$/, '').replace(/^https?:\/\//, '');
      domains.push(urlToDirPath(url));
    }
  }

  return domains;
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

  const entries = [];
  const rootIndexLastmod = getIndexHtmlLastModDate(path.join(outputDir, 'index.html'));
  const enIndexLastmod = getIndexHtmlLastModDate(path.join(outputDir, 'en', 'index.html'));

  entries.push({ loc: baseUrl, lastmod: rootIndexLastmod });
  entries.push({ loc: `${baseUrl}en/`, lastmod: enIndexLastmod || rootIndexLastmod });

  const domains = loadStatisticDomains();
  for (const dirName of domains) {
    const zhLastmod = getIndexHtmlLastModDate(path.join(outputDir, dirName, 'index.html'));
    const enLastmod = getIndexHtmlLastModDate(path.join(outputDir, dirName, 'en', 'index.html'));

    entries.push({
      loc: `${baseUrl}${dirName}/`,
      lastmod: zhLastmod
    });
    entries.push({
      loc: `${baseUrl}${dirName}/en/`,
      lastmod: enLastmod || zhLastmod
    });
  }

  const xml = buildSitemapXml(entries);
  const outPath = path.join(outputDir, 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf-8');

  console.log(`✓ Wrote sitemap: ${outPath}`);
  console.log(`  baseUrl: ${baseUrl}`);
  console.log(`  urls: ${entries.length}`);
  console.log('  mode: bilingual from statistic.tsv');
}

main();
