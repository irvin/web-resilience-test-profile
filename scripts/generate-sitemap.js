#!/usr/bin/env node

/**
 * Generate sitemap.xml under web/
 *
 * Default baseUrl: https://resilience.ocf.tw/web/
 * Override with --base or SITEMAP_BASE_URL
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

  console.log(`✓ Wrote sitemap: ${outPath}`);
  console.log(`  baseUrl: ${baseUrl}`);
  console.log(`  urls: ${entries.length}`);
  console.log('  mode: from web/');
}

main();
