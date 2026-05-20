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
- Generates static pages under `web/`
- Creates one directory per site, for example `web/google.com/index.html`
- Keeps `web/index.html` as the main landing page
- Generates `web/sitemap.xml`
- Prepares the output for the `gh-pages` branch automatically

## Sitemap

### Output path

- Build output: `web/sitemap.xml`
- Deployed URL: `https://resilience.ocf.tw/web/sitemap.xml`

### `lastmod` rules

- The sitemap includes only directories that actually exist under `web/` and contain `index.html`
- The homepage `/web/` uses the modification time of `web/index.html`
- Each site page `/web/<domain>/` uses the modification time of `web/<domain>/index.html`

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

## Customizing for your own version

If you are adapting this repository for another country, organization, or report set, these are the main places to start:

- `index.html`: the current Chinese-first template used by the live site
- `index.en.example.html`: an English example template that demonstrates how to reskin the page
- `app.js`: shared runtime logic, summary mapping, search behavior, and configurable text overrides
- `styles.css`: shared styles used by both the main template and the example template
- `test-result/`: the input data source, including `statistic.tsv` and result JSON files
- `add-new-sites.md`: maintainer workflow (English)
- `add-new-sites.zh-TW.md`: same workflow (Traditional Chinese)

Typical customization points:
- branding and logos
- report links and source code links
- page copy, FAQ text, and empty-state text
- default locale and meta text overrides
- deployment destination and hosting URL

The example English template uses `window.__WEB_RESILIENCE_TEXT__` to override labels and dynamic text while reusing the same `app.js` runtime. That pattern is intended to make forks easier without introducing a full runtime i18n layer.

## Project structure

```text
web-resilience-profile/
├── web/                     # Generated output directory
│   ├── index.html           # Main landing page
│   ├── google.com/          # One directory per tested website
│   │   └── index.html
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
├── index.html
├── index.en.example.html
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

This project is licensed under [CC BY-NC-ND 4.0 International](https://creativecommons.org/licenses/by-nc-nd/4.0/) during the ISIF research period (through December 31, 2026). After that date, data and scripts will be released into the Public Domain. For uses beyond CC BY-NC-ND 4.0 restrictions during the research period, contact Irvin Chen (Open Culture Foundation) at irvin@moztw.org (cc hi@ocf.tw).

See [LICENSE](LICENSE) for full terms and suggested attribution.

## Acknowledgements

This work was supported by a grant from the APNIC Foundation, via the Information Society Innovation Fund (ISIF Asia).