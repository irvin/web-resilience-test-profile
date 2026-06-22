# Post-update testing checklist

Run through this document after code changes, builds, or deployment updates.  
Traditional Chinese version: [`TESTING.zh-TW.md`](TESTING.zh-TW.md).

---

## When to use

| Change type | Recommended sections |
|-------------|----------------------|
| `app.js`, `i18n.js`, `index.html`, `locales/` | §1 Dev preview, §2 Build output, §3 Routing, §4 i18n |
| `scripts/build.js`, build pipeline | §2, §3, §4, §5 SEO |
| Single-site data update only | §2 (that site), §7 Production spot check |
| `resilience.ocf.tw/404.html`, `index.html` | §3-2 404 redirects, §7 |
| Full release (`build:all` + deploy) | All sections |

---

## Test environments

| Environment | Purpose | How to start |
|-------------|---------|--------------|
| **Dev template** | UI work, dynamic `?url=` preview | Live Server at repo root → `http://127.0.0.1:5500/` |
| **Built output** | Verify `web/` matches production | Live Server on `resilience.ocf.tw/` or `web/` → `/web/...` |
| **Production** | 404, root redirect, CDN | `https://resilience.ocf.tw/...` |

Do not use `file://`; fetches require HTTP.

### Suggested test domains

| Domain | Purpose |
|--------|---------|
| `google.com` | Known site (in `statistic.tsv`) |
| `google.coms` | Unknown site (not in list) |

---

## 1. Dev template (repo root)

Serve `web-resilience-test-profile/` root locally.

- [ ] **Homepage** `/` shows search + overview (`#overview-dynamic` visible)
- [ ] **Dynamic result** `/?url=google.com` shows results, does **not** redirect to static path
- [ ] **Unknown site** `/?url=google.coms` shows empty / search state
- [ ] **English preview** `/?url=google.com&lang=en` renders English UI
- [ ] **Lang switch (dev)** links use `?lang=` and preserve `url`
- [ ] **Search autocomplete** selecting a site goes to `?url=...&lang=...`

---

## 2. Build output checks

After build, inspect `web/` (or `gh-pages-worktree/`).

```bash
npm run build              # smoke test (first site only)
npm run build google.com   # single site
npm run build:all          # full release
```

### 2-1. Files exist

- [ ] `web/index.html`, `web/en/index.html`
- [ ] `web/<domain>/index.html`, `web/<domain>/en/index.html`
- [ ] `web/statistic.<hash>.tsv` matches `<meta name="web-resilience-statistic-url">`
- [ ] Shared assets copied: `locales/`, `i18n.js`, `app.js`
- [ ] `web/sitemap.xml` after `build:all`

### 2-2. HTML structure (sample homepage + one site)

- [ ] No `#site-dynamic` or `#overview-dynamic` in output
- [ ] Homepage has `<h1 class="home-title">` (zh-TW and en)
- [ ] Site pages have prerendered results
- [ ] Paired `hreflang="zh-TW"` and `hreflang="en"` links
- [ ] `canonical` / `og:url` point to `https://resilience.ocf.tw/web/...`

### 2-3. Build command behavior

- [ ] `npm run build` does **not** shrink `sitemap.xml` to one test page
- [ ] `build:all` sitemap lists ~3700+ zh-TW and en URLs

---

## 3. Routing and redirects

Test on **built output** (`/web/` paths). Example: `http://127.0.0.1:5500/web/...`.

### 3-1. Known site: query → static

| Input | Expected |
|-------|----------|
| `/web/?url=google.com` | Redirect → `/web/google.com/` |
| `/web/en/?url=google.com` | Redirect → `/web/google.com/en/` |

- [ ] No `?url=` left in address bar after redirect

### 3-2. Unknown site: 404 and query mode (production / deployed `404.html`)

| Input | Expected |
|-------|----------|
| `/web/notexist.example/` | → `/web/?url=notexist.example` |
| `/web/notexist.example/en/` | → `/web/en/?url=notexist.example` |
| `/web/en` | → `/web/en/` |
| Non-`/web/` 404 | Stays on 404 page |

- [ ] Unknown `?url=` stays on query URL, no static redirect

### 3-3. Direct static access

| Input | Expected |
|-------|----------|
| `/web/`, `/web/en/` | Homepages with search + chart |
| `/web/google.com/`, `/web/google.com/en/` | Site result pages |

### 3-4. Site shell (`resilience.ocf.tw`)

- [ ] `/` → `/web`
- [ ] `/web/sitemap.xml` accessible

### 3-5. Legacy redirect

- [ ] `irvin.github.io` with `?url=` → `https://resilience.ocf.tw/web/?url=...`

---

## 4. Bilingual / language switching

Built pages use **paths**; dev template uses `?lang=`.

### 4-1. Static path switching

| Current | 中文 | English |
|---------|------|---------|
| `/web/` | stay | → `/web/en/` |
| `/web/google.com/` | stay | → `/web/google.com/en/` |

- [ ] `<html lang>` is `zh-TW` or `en`

### 4-2. Not-found query mode

| Current | Other locale |
|---------|--------------|
| `/web/?url=google.coms` | → `/web/en/?url=google.coms` |
| `/web/en/?url=google.coms` | → `/web/?url=google.coms` |

- [ ] `url` param preserved; no `/web/?lang=en` on `/web/` paths

---

## 5. Search and interaction

On `/web/` or `/web/en/`:

- [ ] Autocomplete, keyboard navigation, Enter to navigate
- [ ] Known site selection → `/web/<domain>/` (or `/en/`)

On static site pages:

- [ ] "Check another site" reveals search

---

## 6. SEO (spot check)

- [ ] `title`, description, Open Graph tags per locale
- [ ] `canonical` matches locale path

---

## 7. After production deploy

- [ ] GitHub Actions gh-pages workflow succeeded
- [ ] Spot-check §3–§4 on production
- [ ] If `404.html` changed, verify §3-2 on production
- [ ] (Optional) Cloudflare purge for `resilience.ocf.tw`

**Known limitation:** `statistic.tsv` is cached in the browser for 24 hours.

---

## 8. Quick shell checks (optional)

```bash
grep -l 'home-title' web/index.html web/en/index.html
! grep -q 'id="site-dynamic"' web/index.html
test -f web/google.com/index.html && test -f web/google.com/en/index.html
```

---

## Related docs

- Release workflow: [`add-new-sites.md`](add-new-sites.md)
- Site shell: [resilience.ocf.tw README](https://github.com/ocftw/resilience.ocf.tw/blob/main/README.md)
- Bilingual URL model: [`README.md` § Bilingual UI](README.md)
