# Web Resilience Profile

Static site generator for publishing web resilience test result pages such as "Will this website still work during a submarine cable outage?"

中文文件請見 For Chinese documentation, see [`README.zh-TW.md`](README.zh-TW.md).

> The underlying measurement pipeline that collects requests and produces JSON plus `statistic.tsv` lives in the `web-resilience-test` repository.  
> This repository turns that data into browseable static pages and prepares the output for deployment on `gh-pages`.

## What this repository does

This project:
1. Reads `statistic.tsv` from the `test-result` submodule
2. Generates one static HTML page per tested website
3. Uses a headless browser (Playwright) to render the Vue app for SEO-friendly output
4. Prepares the generated `web/` output for deployment on the `gh-pages` branch

## End-to-end workflow

For the full workflow from updating test results to publishing a new page on `resilience.ocf.tw`, see [`add-new-sites.md`](add-new-sites.md).

For a post-update regression checklist, see [`TESTING.md`](TESTING.md).

## Installation

```bash
# Install dependencies
npm install

# Install the Playwright browser
npx playwright install chromium

# Initialize and update the submodule that stores test result data
git submodule update --init --recursive
```

To refresh the submodule later:

```bash
git submodule update --remote test-result
```

## Quick reference

| Command | Description |
|------|------|
| `npm run build` | Test build that only processes the first website |
| `npm run build <site>` | Build a specific website, for example `npm run build www.article19.org` |
| `npm run build:all` | Build all websites |
| `npm run generate:sitemap` | Generate the sitemap only, without Playwright |
| `npm run build-worktree` | Prepare the `gh-pages` worktree without rebuilding |
| `npm run deploy` | Push the `gh-pages` branch to the remote |

## Build modes

### Test build

```bash
npm run build
```

This mode:
- Builds only the first website for a fast smoke test
- Prepares the generated output for the `gh-pages` branch automatically

### Build a specific website

```bash
npm run build www.article19.org
```

This mode:
- Builds only matching websites
- Supports partial matching such as `article19.org`
- Prepares the generated output for the `gh-pages` branch automatically

Examples:

```bash
# Build one exact site
npm run build www.article19.org

# Partial matching also works
npm run build article19.org
```

### Build all websites

```bash
npm run build:all
```

This mode:
- Reads all tested URLs from `test-result/statistic.tsv`
- Uses 8 parallel browser instances
- Generates zh-TW and English static pages under `web/`
- Creates one directory per site, for example `web/google.com/index.html` (zh-TW) and `web/google.com/en/index.html` (en)
- Homepage output: `web/index.html` (zh-TW) and `web/en/index.html` (en)
- Generates `web/sitemap.xml`
- Prepares the output for the `gh-pages` branch automatically

## Sitemap

### Output path

- Build output: `web/sitemap.xml`
- Deployed URL: `https://resilience.ocf.tw/web/sitemap.xml`

### `lastmod` rules

- The sitemap contains two homepage URLs plus two URLs (zh-TW and en) for every site row in `statistic.tsv`: `2 + 2 × site rows`
- `/web/` and `/web/en/` use the mtime of their respective `index.html`
- `/web/<domain>/` and `/web/<domain>/en/` use the mtime of their respective `index.html`

Note: the default `npm run build` test mode does not update `web/sitemap.xml`, so the sitemap will not accidentally shrink to a single test page.

### Rebuild only the sitemap

```bash
npm run generate:sitemap
```

## Deployment

Build commands automatically prepare the `web/` output for the `gh-pages` branch. After the build finishes, push the result with:

```bash
npm run deploy
```

This will:
- Push `gh-pages` to the remote
- Clean up the local worktree

### Prepare the worktree only

If you already built the site and only want to sync the worktree:

```bash
npm run build-worktree
```

## Local preview (development)

Edit files at the repository root (`index.html`, `app.js`, `i18n.js`, `locales/`). Serve the repo root over HTTP (for example VS Code Live Server or `npx serve .`) and open `index.html`.

- Use `?url=example.com` on localhost to preview a site result dynamically.
- Do not use `file://`; fetches to `/test-result/` require a local server.
- Built output under `web/` is for deployment verification; day-to-day UI work uses the root template.

## Bilingual UI (zh-TW / en)

Production pages use **path-based locales** (one URL, one language, baked at build time):

| Page | zh-TW | en |
|------|-------|-----|
| Homepage | `/web/` | `/web/en/` |
| Site | `/web/{domain}/` | `/web/{domain}/en/` |

- `npm run build:all` emits both locales in one run; built HTML **does not** include `#site-dynamic` or `#overview-dynamic`.
- Language switching uses plain `<a href>` links to the alternate path.
- **Unknown sites**: the site-wide [`404.html`](../resilience.ocf.tw/404.html) redirects missing paths to query mode — zh-TW `/web/?url={domain}`, en `/web/en/?url={domain}`; lang switcher links preserve the `url` parameter in that mode.
- Known sites visited with `?url=` are still redirected to the static path by `loadResults()`.

The dev template at the repo root keeps Vue dynamic blocks for preview; on localhost use `?url=example.com&lang=en` for English preview.

Copy lives in `locales/zh-TW.js` and `locales/en.js`. Forks can still override dynamic labels via `window.__WEB_RESILIENCE_TEXT__`.

## Customizing for your own version

If you are adapting this repository for another country, organization, or report set, these are the main places to start:

- `index.html`: the single dev template (Vue dynamic blocks; stripped from built output)
- `locales/`: UI strings and per-locale `appText` (summary labels, meta helpers)
- `i18n.js`: path-based locale detection, not-found query hrefs, and `t()` helper
- `app.js`: shared runtime logic, summary mapping, and search behavior
- `styles.css`: shared styles
- `test-result/`: the input data source, including `statistic.tsv` and result JSON files
- `add-new-sites.md`: maintainer workflow (English)
- `add-new-sites.zh-TW.md`: same workflow (Traditional Chinese)

Typical customization points:
- branding and logos
- report links and source code links
- page copy, FAQ text, and empty-state text
- default locale and meta text overrides
- deployment destination and hosting URL

English copy lives in `locales/en.js`.

## Project structure

```text
web-resilience-profile/
├── web/                     # Generated output directory
│   ├── index.html           # zh-TW homepage
│   ├── en/
│   │   └── index.html       # English homepage
│   ├── locales/             # Copied locale bundles
│   ├── i18n.js
│   ├── google.com/          # One directory per tested website
│   │   ├── index.html       # zh-TW
│   │   └── en/
│   │       └── index.html   # English
│   └── ...
├── test-result/             # Git submodule with test result data
│   ├── statistic.tsv
│   ├── *.json
│   └── ...
├── scripts/
│   ├── build.js
│   ├── build-wrapper.js
│   ├── build-worktree.js
│   ├── deploy.js
│   ├── generate-sitemap.js
│   └── clean-worktree.js
├── locales/
│   ├── zh-TW.js
│   └── en.js
├── index.html
├── i18n.js
├── add-new-sites.md
├── add-new-sites.zh-TW.md
├── app.js
├── styles.css
└── package.json
```

## Technical notes

### Build flow

1. Read `statistic.tsv` from the `test-result` submodule
2. Optionally filter the target sites when a site name is supplied
3. Start a local HTTP server that serves `index.html`
4. Render pages with parallel Playwright browser instances
5. Save fully rendered static HTML with SEO metadata and Vue interactions preserved

### URL structure

- Each website becomes a directory such as `google.com/index.html`
- The corresponding deployed URL is `https://resilience.ocf.tw/web/google.com/`

## Known issue

`statistic.tsv` is cached on the client side for 24 hours, so users may not immediately see updated site lists.

Future improvement:
- embed a `statistic.tsv` version or build timestamp in generated pages
- compare that timestamp at runtime
- refresh the list when the page is newer than the cached statistic data

## Related repositories

- Research method and measurement code: https://github.com/irvin/web-resilience-test
- Test result dataset: https://github.com/irvin/web-resilience-test-result

## License

This project is licensed under [CC BY-NC-ND 4.0 International](https://creativecommons.org/licenses/by-nc-nd/4.0/) during the ISIF research period (through December 31, 2026). After that date, data and scripts will be released into the Public Domain. For uses beyond CC BY-NC-ND 4.0 restrictions during the research period, contact Irvin Chen (Open Culture Foundation; ORCID: [https://orcid.org/0009-0002-1059-7130](https://orcid.org/0009-0002-1059-7130)) at irvin@ocf.tw (cc hi@ocf.tw).

See [LICENSE](LICENSE) for full terms and suggested attribution. See also [`CITATION.cff`](CITATION.cff) for machine-readable citation metadata.

## Acknowledgements

This work was supported by a grant from the APNIC Foundation, via the Information Society Innovation Fund (ISIF Asia).
