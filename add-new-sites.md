# Adding a site: from test to production

This document describes the end-to-end flow from **adding a new tested site** to **seeing the page at** `https://resilience.ocf.tw/web/<domain>/`.

中文文件請見 For the Traditional Chinese version, see [`add-new-sites.zh-TW.md`](add-new-sites.zh-TW.md).

Related repositories
- Measurement and statistics: `web-resilience-test`
- Static page generation and deployment: `web-resilience-test-profile`
- Public site: `resilience.ocf.tw`

After deployment, these URLs are updated:

- Home: `https://resilience.ocf.tw/web/`
- Per-site page: `https://resilience.ocf.tw/web/<domain>/`
- Sitemap: `https://resilience.ocf.tw/web/sitemap.xml`

---

## 0. Prerequisites

- All three repositories are cloned locally, with paths similar to (adjust names as needed):

  ```bash
  web-resilience-test/
    test-results/ (submodule)
  web-resilience-test-profile/
    test-result/ (submodule)
  resilience.ocf.tw/
    web/ (submodule)
  ```

- The `test-result/` directory inside `web-resilience-test` and `web-resilience-test-profile` points to the same `test-results` Git submodule.

## 1. Run a measurement (`web-resilience-test` repo)

> Goal: run the checker for a new site, produce JSON output, and update `statistic.tsv`.

Before testing, turn off VPN or (on macOS) iCloud Private Relay if they affect connectivity.

### 1-1. Single-site measurement

Inside `web-resilience-test`:

```bash
cd /path/to/web-resilience-test
node no-global-connection-check.js \
  --adblock-url 'https://filter.futa.gg/hosts_abp.txt,https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_15_DnsFilter/filter.txt' \
  --dns 168.95.1.1 \
  --ipinfo-token $IPINFO_TOKEN \
  --save https://www.example.com
```

Notes:

- `--save` writes a JSON file under `test-results/`, roughly named `{hostname+path}.json`  
  Example: `test-results/www.article19.org.json`
- Common flags:
  - `--debug`: verbose debug output
  - `--dns IP`: custom DNS server (often Chunghwa Telecom `168.95.1.1`)
  - `--ipinfo-token TOKEN`: IPinfo token (or set env `IPINFO_TOKEN`)
  - `--adblock false`: do not use adblock lists
  - `--adblock-url url1,url2`: custom adblock DNS filter lists (comma-separated)
  - `--cache false`: disable cache (force re-download of adblock / IPinfo data; default is cached)
  - `--timeout N`: page load timeout in seconds (default 120)
  - `--headless false`: run a visible browser

### 1-2. Batch measurement

For many sites, prepare a list file (for example `manual_curated_list_tw.json`) and run `batch-test.js`. It calls `checkWebsiteResilience(... --save)` per site and runs statistics at the end.

`batch-test.js` accepts the same parameters as `no-global-connection-check.js`.

Current parameter bundle used by this project:

```bash
cd /path/to/web-resilience-test
node batch-test.js \
  --adblock-url 'https://filter.futa.gg/hosts_abp.txt,https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_15_DnsFilter/filter.txt' \
  --dns 168.95.1.1 \
  --ipinfo-token $IPINFO_TOKEN \
  manual_curated_list_tw.json
```

## 2. Regenerate `statistic.tsv`

Still in `web-resilience-test`:

```bash
node generate_statistic.js
```

**This script:**

- Scans all site JSON files under `test-results/`
- Orders output using `top-traffic-list-taiwan/merged_lists_tw.json`
- Writes `test-results/statistic.tsv` with columns such as:
  - `url`, `timestamp`
  - counts for [domestic/foreign] × [cloud/direct]

> If you used `batch-test.js`, it already runs `generate_statistic.js` at the end.

## 3. Commit and push the `test-results` repo

If `test-results/` is a separate Git submodule, commit and push there:

```bash
cd test-results
git add .
git commit -m "Add measurement results: example.com"
git push
```

## 4. Pull latest data and build in `web-resilience-test-profile`

> Goal: turn the updated `statistic.tsv` and JSON into static HTML.

### 4-1. Update the `test-result` submodule

Inside `web-resilience-test-profile`:

```bash
cd /path/to/web-resilience-test-profile
git submodule update --remote test-result
```

This updates `test-result/` to the revision you just pushed, including:

- `test-result/statistic.tsv`
- per-site `*.json` files

### 4-2. Install dependencies (first time or after changes)

```bash
npm install
npx playwright install chromium
```

### 4-3. Build static pages

**Single site (partial name match):**

```bash
npm run build example.com
# e.g. npm run build www.article19.org
# or: npm run build article19.org
```

**All sites:**

```bash
npm run build:all
```

Outputs under `web/`:

- `web/<domain>/index.html`: per-site pages
- `web/index.html`: home
- `web/sitemap.xml`: updated on full builds (for search engines)

### 4-4. Push to the `gh-pages` branch

> Goal: publish the `web/` directory to `gh-pages`.

Inside `web-resilience-test-profile`:

```bash
npm run deploy
```

This:

- Updates `gh-pages` with `web/` contents
- Pushes to the remote
- Cleans the local worktree

## 5. Update `resilience.ocf.tw`

The `resilience.ocf.tw` repo is the site shell; it includes `web-resilience-test-profile`’s `gh-pages` output as `/web/`.

### 5-1. Update the `/web` submodule

Inside `resilience.ocf.tw`:

```bash
git submodule update --remote web-resilience-test-profile
```

### 5-2. Purge Cloudflare cache (optional)

`resilience.ocf.tw` uses Cloudflare “cache everything”. After publishing, you can purge cache manually.

- Confirm the GitHub Pages workflow finished: `https://github.com/ocftw/resilience.ocf.tw/actions/workflows/gh-pages.yml`
- In the Cloudflare dashboard, use custom purge by hostname `resilience.ocf.tw`.

### 5-3. (Known issue) Users may wait up to 24 hours to see new sites in the list

The browser caches `statistic.tsv` in `localStorage` for 24 hours, so the site list may not refresh immediately for everyone.

## 6. Quick troubleshooting checklist

If updates do not appear on `resilience.ocf.tw`, check in order:

1. `web-resilience-test`: ran measurement with `--save` and `node generate_statistic.js`
2. `test-results` submodule: changes are `git push`’d
3. `web-resilience-test-profile`: built and deployed:
   - `git submodule update --remote test-result`
   - `npm run build <domain>` or `npm run build:all`
   - `npm run deploy`
4. `resilience.ocf.tw`: submodule points at the latest `gh-pages` revision
5. Purge Cloudflare cache manually

## 7. Post-update testing

After code, build output, or `404.html` changes, run the checklist in [`TESTING.md`](TESTING.md).
