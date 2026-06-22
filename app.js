const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/irvin/web-resilience-test-result/refs/heads/main/';
const GITHUB_WEB_URL = 'https://github.com/irvin/web-resilience-test-result/blob/main/';

const DEFAULT_DISPLAY_LOCALE = 'zh-TW';
const DEFAULT_SORT_LOCALE = 'zh-TW';

const SUMMARY_KEYS = {
    WONT_WORK: 'wontWork',
    UNCERTAIN: 'uncertain',
    MIGHT_WORK: 'mightWork'
};

const SUMMARY_LABELS = {
    [SUMMARY_KEYS.WONT_WORK]: '不會動',
    [SUMMARY_KEYS.UNCERTAIN]: '不確定',
    [SUMMARY_KEYS.MIGHT_WORK]: '可能會動'
};

const CATEGORY_LABELS = {
    'domestic/cloud': '境內／雲端',
    'foreign/cloud': '境外／雲端',
    'domestic/direct': '境內／其他',
    'foreign/direct': '境外／其他'
};

const DEFAULT_PAGE_TITLE = '海纜斷掉時網站會動嗎？';
const DEFAULT_META_DESCRIPTION = '輸入網址查看測試結果';

/**
 * Homepage meta description once overall-result.tsv is loaded (Vue updates DOM; no build placeholders).
 * @param {{ totalCount: string, wontWorkPercent: string, internationalCloudPercent: string, mightWorkPercent: string }} stats
 */
function defaultHomeOverallMetaDescription(stats) {
    return `根據 ${stats.totalCount} 個台灣常用網站的檢測結果，在海纜斷光或極度壅塞的情況下，有 ${stats.wontWorkPercent} 的網站可能不會動；${stats.internationalCloudPercent} 的網站有較高風險；僅 ${stats.mightWorkPercent} 的網站相對較有韌性。輸入網址查看測試結果！`;
}

const DEFAULT_APP_TEXT = {
    displayLocale: DEFAULT_DISPLAY_LOCALE,
    sortLocale: DEFAULT_SORT_LOCALE,
    summaryLabels: SUMMARY_LABELS,
    categoryLabels: CATEGORY_LABELS,
    pageTitle: (domain) => domain ? `海纜斷掉時，${domain} 會動嗎？` : DEFAULT_PAGE_TITLE,
    homeOverallMetaDescription: defaultHomeOverallMetaDescription,
    ogDescription: (domain, summaryKey) => {
        if (!domain) {
            return DEFAULT_META_DESCRIPTION;
        }

        if (summaryKey === SUMMARY_KEYS.WONT_WORK) {
            return `根據最近一次測試，在海纜斷掉的情境下，${domain} 可能「不會動」。這表示如果海纜中斷、對外連線受阻，網站就可能打不開。`;
        }

        if (summaryKey === SUMMARY_KEYS.UNCERTAIN) {
            return `根據最近一次測試，在海纜斷掉的情境下，${domain} 的可用性「不確定」。這表示如果海纜中斷、對外連線受阻時，無法確認網站是否能維持可用。`;
        }

        return `根據最近一次測試，在海纜斷掉的情境下，${domain} 「可能會動」。這表示如果海纜中斷、對外連線受阻，網站有可能維持可用。`;
    }
};

function getLocaleAppTextBase() {
    if (window.WebResilienceI18n) {
        const fromLocale = window.WebResilienceI18n.getAppText();
        if (fromLocale && Object.keys(fromLocale).length > 0) {
            return fromLocale;
        }
    }
    return DEFAULT_APP_TEXT;
}

function getAppTextConfig() {
    const base = getLocaleAppTextBase();
    const overrides = window.__WEB_RESILIENCE_TEXT__ || {};
    return {
        ...base,
        ...overrides,
        homeOverallMetaDescription: overrides.homeOverallMetaDescription || base.homeOverallMetaDescription,
        pageTitle: overrides.pageTitle || base.pageTitle,
        ogDescription: overrides.ogDescription || base.ogDescription,
        summaryLabels: {
            ...base.summaryLabels,
            ...(overrides.summaryLabels || {})
        },
        categoryLabels: {
            ...base.categoryLabels,
            ...(overrides.categoryLabels || {})
        }
    };
}

if (window.WebResilienceI18n) {
    window.WebResilienceI18n.init();
}

// Global state
let allUrls = [];
let statisticLoaded = false;

function isLocalhost() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
}

function isWebDeploymentPath() {
    const pathname = window.location.pathname;
    return pathname === '/web' || pathname.startsWith('/web/');
}

function shouldRedirectKnownUrlToStatic() {
    // Repo-root dev template on localhost keeps dynamic ?url= preview.
    return !isLocalhost() || isWebDeploymentPath();
}

// Resolve the statistic.tsv location from template metadata.
// - source template: /test-result/statistic.tsv
// - built pages: replaced with the versioned /web/statistic.<hash>.tsv
function getStatisticTsvUrl() {
    const meta = document.querySelector('meta[name="web-resilience-statistic-url"]');
    const rawUrl = meta ? meta.getAttribute('content') : null;
    const metaUrl = rawUrl ? rawUrl.trim() : null;
    if (metaUrl) {
        return metaUrl;
    }

    return '/web/statistic.tsv';
}

// Resolve the overall chart location:
// - localhost: read from the test-result submodule
// - production: read the file emitted under /web/img/ at build time
function getOverallChartUrl() {
    if (isLocalhost()) {
        return '/test-result/img/overall-result.png';
    }
    return '/web/img/overall-result.png';
}

// Resolve the overall-result.tsv location:
// - localhost: read from the test-result submodule
// - production: read the file emitted under /web/ at build time
function getOverallResultTsvUrl() {
    if (isLocalhost()) {
        return '/test-result/overall-result.tsv';
    }
    return '/web/overall-result.tsv';
}

function formatOverallPercent(rawPercent) {
    if (rawPercent === null || rawPercent === undefined) return '';
    const match = String(rawPercent).trim().match(/^(-?\d+(?:\.\d+)?)%?$/);
    if (!match) return String(rawPercent);
    return `${Math.round(Number(match[1]))}%`;
}

async function loadOverallResult() {
    try {
        const response = await fetch(getOverallResultTsvUrl());
        if (!response.ok) return null;
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) return null;

        const headers = lines[0].split('\t').map(h => h.trim());
        const categoryIdx = headers.indexOf('category');
        const countIdx = headers.indexOf('count');
        const percentIdx = headers.indexOf('percent');
        if (categoryIdx === -1 || countIdx === -1 || percentIdx === -1) return null;

        const rowsByCategory = {};
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split('\t');
            const category = (cols[categoryIdx] || '').trim();
            if (!category) continue;
            rowsByCategory[category] = {
                count: (cols[countIdx] || '').trim(),
                percent: (cols[percentIdx] || '').trim()
            };
        }

        const required = ['全部', '不會動', '國際雲', '可能會動'];
        for (const key of required) {
            if (!rowsByCategory[key]) return null;
        }

        return {
            totalCount: rowsByCategory['全部'].count,
            wontWorkPercent: formatOverallPercent(rowsByCategory['不會動'].percent),
            internationalCloudPercent: formatOverallPercent(rowsByCategory['國際雲'].percent),
            mightWorkPercent: formatOverallPercent(rowsByCategory['可能會動'].percent)
        };
    } catch (error) {
        console.error('Error loading overall-result.tsv:', error);
        return null;
    }
}

async function fetchTestResult(filename) {
    try {
        const response = await fetch(GITHUB_RAW_URL + filename);
        return await response.json();
    } catch (error) {
        console.error('Error fetching result:', error);
        return null;
    }
}

function formatDate(isoString, locale = DEFAULT_DISPLAY_LOCALE) {
    return new Date(isoString).toLocaleString(locale);
}

function getSummaryKey(result) {
    const foreignTotal = (result.test_results.foreign?.cloud || 0) + (result.test_results.foreign?.direct || 0);
    if (foreignTotal > 0) {
        return SUMMARY_KEYS.WONT_WORK;
    }
    const domesticCloud = result.test_results.domestic?.cloud || 0;
    if (domesticCloud > 0) {
        return SUMMARY_KEYS.UNCERTAIN;
    }
    return SUMMARY_KEYS.MIGHT_WORK;
}

function getSummaryText(summaryKey) {
    return getAppTextConfig().summaryLabels[summaryKey] || '';
}

function getOgDescription(domain, summaryKey) {
    const normalizedDomain = cleanUrlForNavigation(domain || '');
    return getAppTextConfig().ogDescription(normalizedDomain, summaryKey);
}

// Read the current target URL from the query string.
function getUrlParam() {
    return new URLSearchParams(window.location.search).get('url') || '';
}

// Convert a URL into the corresponding JSON filename.
function urlToFilename(url) {
    const urlObj = new URL('https://' + url.replace(/^https?:\/\//, ''));
    let filename = urlObj.hostname + urlObj.pathname.replace(/\//g, '_');
    if (urlObj.search) filename += '__' + urlObj.search.substring(1).replace(/[&=]/g, '_');
    filename = filename.replace(/_+$/, '');
    if (filename.length > 95) {
        filename = filename.slice(0, 95);
    }
    return filename + '.json';
}

function toggleTestEnv(element) {
    const content = element.nextElementSibling;
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        element.classList.add('collapsed');
    } else {
        content.classList.add('expanded');
        element.classList.remove('collapsed');
    }
}

// Load statistic data.
async function loadStatisticData() {
    // Keep the parsed list in memory for the current page only.
    if (allUrls && allUrls.length > 0) {
        return allUrls;
    }

    try {
        const response = await fetch(getStatisticTsvUrl());
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim());

        // Skip the header row and collect URLs from the first column.
        allUrls = [];
        for (let i = 1; i < lines.length; i++) {
            let url = lines[i].split('\t')[0];
            if (url && url.startsWith('http')) {
                // Normalize URLs by removing redundant trailing slashes.
                url = cleanUrl(url, { removeProtocol: false, removeWww: false, removeTrailingSlash: true });
                allUrls.push(url);
            }
        }

        // Sort alphabetically using normalized URLs.
        allUrls.sort((a, b) => {
            const ca = cleanUrlForSearch(a);
            const cb = cleanUrlForSearch(b);
            if (ca < cb) return -1;
            if (ca > cb) return 1;
            return 0;
        });

        return allUrls;
    } catch (error) {
        console.error('Error loading statistic data:', error);
        return [];
    }
}

// Ensure statistic data has been loaded before search is used.
async function ensureStatisticLoaded() {
    if (statisticLoaded && allUrls && allUrls.length > 0) {
        // Already loaded, just sync the Vue state and exit.
        if (window.__vueState__ && window.__vueState__.allUrls) {
            window.__vueState__.allUrls.value = allUrls;
        }
        return;
    }

    await loadStatisticData();
    statisticLoaded = true;

    // Inject the URL list into Vue state for search usage.
    if (window.__vueState__ && window.__vueState__.allUrls) {
        window.__vueState__.allUrls.value = allUrls;
    }
}

// Shared URL cleanup helper.
// options: { removeProtocol: true, removeWww: false, removeTrailingSlash: true, toLowerCase: false }
function cleanUrl(url, options = {}) {
    if (!url) return '';
    let cleaned = url;
    const {
        removeProtocol = true,
        removeWww = false,
        removeTrailingSlash = true,
        toLowerCase = false
    } = options;

    if (removeProtocol) {
        cleaned = cleaned.replace(/^https?:\/\//, '');
    }
    if (removeWww) {
        cleaned = cleaned.replace(/^www\./, '');
    }
    if (removeTrailingSlash) {
        cleaned = cleaned.replace(/\/+$/, '');
    }
    if (toLowerCase) {
        cleaned = cleaned.toLowerCase();
    }
    return cleaned;
}

// URL cleanup for display labels.
function cleanUrlForDisplay(url) {
    return cleanUrl(url, { removeProtocol: true, removeWww: true, removeTrailingSlash: true });
}

// URL cleanup for navigation targets.
function cleanUrlForNavigation(url) {
    return cleanUrl(url, { removeProtocol: true, removeWww: false, removeTrailingSlash: true });
}

// URL cleanup for search matching.
function cleanUrlForSearch(url) {
    return cleanUrl(url, { removeProtocol: true, removeWww: false, removeTrailingSlash: false, toLowerCase: true });
}

// Pure URL filter shared by Vue and plain JS code.
function filterUrls(query, urls) {
    if (!query) return urls;
    const lowerQuery = query.toLowerCase();
    return urls.filter(url => {
        const cleanUrl = cleanUrlForSearch(url);
        return cleanUrl.includes(lowerQuery);
    });
}

// Check whether the current page is a prerendered static page.
function isStaticPage() {
    return window.__IS_STATIC_PAGE__ === true;
}

function hasBakedStaticContent() {
    const begin = document.querySelector('[data-static="begin"]');
    const end = document.querySelector('[data-static="end"]');
    if (!begin || !end) {
        return false;
    }
    let node = begin.nextElementSibling;
    while (node && node !== end) {
        if (node.textContent && node.textContent.trim().length > 0) {
            return true;
        }
        node = node.nextElementSibling;
    }
    return false;
}

function hasBakedOverviewContent() {
    const begin = document.querySelector('[data-overview-static="begin"]');
    const end = document.querySelector('[data-overview-static="end"]');
    if (!begin || !end) {
        return false;
    }
    let node = begin.nextElementSibling;
    while (node && node !== end) {
        if (node.textContent && node.textContent.trim().length > 0) {
            return true;
        }
        node = node.nextElementSibling;
    }
    return false;
}

function isDevTemplate() {
    return !isStaticPage() && !hasBakedStaticContent() && !hasBakedOverviewContent();
}

function sitePageHref(url) {
    const cleanUrl = cleanUrlForNavigation(url);
    if (window.WebResilienceI18n) {
        return window.WebResilienceI18n.sitePageHref(cleanUrl);
    }
    return `/web/${cleanUrl}/`;
}

// Navigate to the selected URL.
function selectUrl(url) {
    window.location.href = sitePageHref(url);
}

// Extract the domain from a /web/{domain}/ or /web/{domain}/en/ path.
function extractDomainFromPath() {
    if (window.WebResilienceI18n && window.WebResilienceI18n.parseWebPath) {
        const { domain } = window.WebResilienceI18n.parseWebPath(window.location.pathname);
        return domain || null;
    }

    const pathname = window.location.pathname;
    const match = pathname.match(/^\/web\/([^/]+)(?:\/en)?\/?$/);
    if (match && match[1] !== 'en') {
        return match[1];
    }
    return null;
}

async function loadResults() {
    // Redirect legacy GitHub Pages URLs to the current site.
    if (window.location.hostname === 'irvin.github.io') {
        const search = window.location.search || '';
        if (search.startsWith('?url=')) {
            const hash = window.location.hash || '';
            window.location.replace(`https://resilience.ocf.tw/web/${search}${hash}`);
            return;
        }
    }

    let urlParam = getUrlParam();

    // Recover the target URL from the path when handling a 404 fallback.
    if (!urlParam && !isStaticPage()) {
        const domainFromPath = extractDomainFromPath();
        if (domainFromPath) {
            urlParam = domainFromPath;
        }
    }

    // Redirect to a static page when the URL exists in statistic.tsv.
    // Repo-root dev template on localhost keeps dynamic ?url= preview.
    if (urlParam && shouldRedirectKnownUrlToStatic()) {
        await ensureStatisticLoaded();
        const targetKey = cleanUrlForNavigation(urlParam);
        // Match URLs using the same normalization logic as the static page paths.
        const existsInStatistic = allUrls.some(url => {
            return cleanUrlForNavigation(url) === targetKey;
        });

        if (existsInStatistic) {
            window.location.href = sitePageHref(targetKey);
            return;
        }
        // If the URL is missing from statistic.tsv, keep the dynamic flow so
        // the page can fall back to the "no results" search state.
    }

    const resultsEl = document.getElementById('results');

    // A prerendered static page without query params does not need runtime fetches.
    if (isStaticPage() && !urlParam) {
        if (window.__vueState__) {
            if (window.__vueState__.showSearch) {
                window.__vueState__.showSearch.value = false;
            }
            if (window.__vueState__.showCheckOther) {
                window.__vueState__.showCheckOther.value = true;
            }
        }
        return;
    }

    // Remaining cases:
    // - dynamic homepage with no URL param
    // - repo-root dev template on localhost with a URL param
    // - query URL for a site not present in statistic.tsv
    // All of them need statistic data to power search behavior.
    await ensureStatisticLoaded();

    if (!urlParam) {
        // No URL parameter: show search only and hide the results section.
        if (resultsEl) {
            resultsEl.style.display = 'none';
        }
        // Sync the visible state through Vue.
        if (window.__vueState__) {
            if (window.__vueState__.showSearch) {
                window.__vueState__.showSearch.value = true;
            }
            if (window.__vueState__.showCheckOther) {
                window.__vueState__.showCheckOther.value = false;
            }
            if (window.__vueState__.searchQuery) {
                window.__vueState__.searchQuery.value = '';
            }
            if (window.__vueState__.selectedIndex) {
                window.__vueState__.selectedIndex.value = -1;
            }
            if (window.__vueState__.maxDisplay) {
                window.__vueState__.maxDisplay.value = 200;
            }
        }
        return;
    }

    // A URL parameter is present: show results and hide search initially.
    if (resultsEl) {
        resultsEl.style.display = 'block';
    }
    // Sync the visible state through Vue.
    if (window.__vueState__) {
        if (window.__vueState__.showSearch) {
            window.__vueState__.showSearch.value = false;
        }
        if (window.__vueState__.showCheckOther) {
            window.__vueState__.showCheckOther.value = true;
        }
    }

    // Update meta tags for the current page.
    const baseUrl = 'https://resilience.ocf.tw/web/';
    const canonicalPath = urlParam ? cleanUrlForNavigation(urlParam) : '';
    const currentUrl = canonicalPath ? `${baseUrl}${canonicalPath}/` : baseUrl;

    document.querySelector('link[rel="canonical"]').href = currentUrl;
    document.querySelector('meta[property="og:url"]').content = currentUrl;
    const cleanUrlParam = urlParam ? cleanUrlForNavigation(urlParam) : '';
    document.title = getAppTextConfig().pageTitle(cleanUrlParam);
    document.querySelector('meta[property="og:title"]').content = document.title;

    // Load and display the test result.
    const result = await fetchTestResult(urlToFilename(urlParam));
    if (result) {
        // Write the result into Vue state so the template can render it.
        if (window.__vueState__ && window.__vueState__.vueResult) {
            window.__vueState__.vueResult.value = result;
        }

        const summaryKey = getSummaryKey(result);
        const description = getOgDescription(cleanUrlParam, summaryKey);
        document.querySelector('meta[property="og:description"]').content = description;
        document.querySelector('meta[name="description"]').content = description;
    }
    else {
        // Fall back to the search-based empty state when no result exists.
        if (resultsEl) {
            resultsEl.style.display = 'none';
        }
        // Sync the visible state through Vue.
        if (window.__vueState__) {
            if (window.__vueState__.showSearch) {
                window.__vueState__.showSearch.value = true;
            }
            if (window.__vueState__.showCheckOther) {
                window.__vueState__.showCheckOther.value = false;
            }
            // Seed the search input with the requested URL for the empty state.
            const clean = cleanUrlForNavigation(urlParam);
            if (window.__vueState__.searchQuery) {
                window.__vueState__.searchQuery.value = clean;
            }
            if (window.__vueState__.selectedIndex) {
                window.__vueState__.selectedIndex.value = -1;
            }
            if (window.__vueState__.maxDisplay) {
                window.__vueState__.maxDisplay.value = 200;
            }
        }
    }

}

const { createApp, ref, computed, watch } = Vue;

// Vue state container exposed to the existing plain JS helpers.
const vueState = {
    vueResult: null,
    allUrls: null,
    searchQuery: null,
    selectedIndex: null,
    maxDisplay: null
};

const vueRootApp = createApp({
    setup() {
        const vueResult = ref(null);

        // Search-related state
        const allUrlsRef = ref([]);
        const searchQuery = ref('');
        const selectedIndex = ref(-1);
        const maxDisplay = ref(200);
        const showSearch = ref(false);
        const showCheckOther = ref(true);

        // Allow external JS helpers to update result and search state directly.
        vueState.vueResult = vueResult;
        vueState.allUrls = allUrlsRef;
        vueState.searchQuery = searchQuery;
        vueState.selectedIndex = selectedIndex;
        vueState.maxDisplay = maxDisplay;
        vueState.showSearch = showSearch;
        vueState.showCheckOther = showCheckOther;

        const hasResult = computed(() => !!vueResult.value);
        const overallChartUrl = computed(() => getOverallChartUrl());

        const overallStats = ref(null);
        vueState.overallStats = overallStats;
        loadOverallResult().then(stats => {
            if (stats) overallStats.value = stats;
        });

        function applyHomepageOverallMetaIfNeeded() {
            const stats = overallStats.value;
            if (!stats || vueResult.value) {
                return;
            }
            const desc = getAppTextConfig().homeOverallMetaDescription(stats);
            const metaDesc = document.querySelector('meta[name="description"]');
            const ogDesc = document.querySelector('meta[property="og:description"]');
            if (metaDesc) {
                metaDesc.content = desc;
            }
            if (ogDesc) {
                ogDesc.content = desc;
            }
        }

        watch([overallStats, vueResult], applyHomepageOverallMetaIfNeeded, { immediate: true });

        const locale = ref(window.WebResilienceI18n ? window.WebResilienceI18n.getLocale() : DEFAULT_DISPLAY_LOCALE);

        const displayUrl = computed(() => {
            if (!vueResult.value) return '';
            return cleanUrlForNavigation(vueResult.value.url || '');
        });

        function t(key, params) {
            locale.value;
            if (!window.WebResilienceI18n) {
                return key;
            }
            return window.WebResilienceI18n.t(key, params);
        }

        function applyPageMeta() {
            if (!isDevTemplate()) {
                return;
            }

            const domain = displayUrl.value || '';
            const config = getAppTextConfig();
            const title = config.pageTitle(domain);
            document.title = title;
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle) {
                ogTitle.content = title;
            }

            if (vueResult.value) {
                const summaryKeyValue = getSummaryKey(vueResult.value);
                const description = getOgDescription(domain, summaryKeyValue);
                const metaDesc = document.querySelector('meta[name="description"]');
                const ogDesc = document.querySelector('meta[property="og:description"]');
                if (metaDesc) {
                    metaDesc.content = description;
                }
                if (ogDesc) {
                    ogDesc.content = description;
                }
                return;
            }

            if (!domain) {
                applyHomepageOverallMetaIfNeeded();
                const fallbackDesc = window.WebResilienceI18n
                    ? window.WebResilienceI18n.t('meta.defaultDescription')
                    : DEFAULT_META_DESCRIPTION;
                const metaDesc = document.querySelector('meta[name="description"]');
                const ogDesc = document.querySelector('meta[property="og:description"]');
                if (metaDesc && !overallStats.value) {
                    metaDesc.content = fallbackDesc;
                }
                if (ogDesc && !overallStats.value) {
                    ogDesc.content = fallbackDesc;
                }
            }
        }

        const showSiteDynamic = computed(() => isDevTemplate());
        const showOverviewDynamic = computed(() => isDevTemplate() && !displayUrl.value);

        const zhLocaleHref = computed(() => {
            if (!window.WebResilienceI18n) return '/web/';
            return window.WebResilienceI18n.zhLocaleHref();
        });

        const enLocaleHref = computed(() => {
            if (!window.WebResilienceI18n) return '/web/en/';
            return window.WebResilienceI18n.enLocaleHref();
        });

        const homeHref = computed(() => {
            if (!window.WebResilienceI18n) return '/web/';
            return window.WebResilienceI18n.homeHref();
        });

        vueState.applyPageMeta = applyPageMeta;
        vueState.displayUrl = displayUrl;

        const testTime = computed(() => {
            locale.value;
            if (!vueResult.value) return '';
            return formatDate(vueResult.value.timestamp, getAppTextConfig().displayLocale);
        });

        const httpStatus = computed(() => {
            if (!vueResult.value) return null;
            return vueResult.value.httpStatus || null;
        });

        const requestCount = computed(() => {
            if (!vueResult.value) return 0;
            return vueResult.value.requestCount || 0;
        });

        const uniqueDomains = computed(() => {
            if (!vueResult.value) return 0;
            return vueResult.value.uniqueDomains || 0;
        });

        const testParameters = computed(() => {
            if (!vueResult.value) return {};
            return vueResult.value.testParameters || {};
        });

        const testingEnvironment = computed(() => {
            if (!vueResult.value) return null;
            return vueResult.value.testingEnvironment || null;
        });

        // Search-related computed state
        const filteredUrls = computed(() => {
            return filterUrls(searchQuery.value, allUrlsRef.value || []);
        });

        const displayedUrls = computed(() => {
            return filteredUrls.value.slice(0, maxDisplay.value);
        });

        const totalAll = computed(() => (allUrlsRef.value || []).length);
        const totalMatched = computed(() => filteredUrls.value.length);
        const shown = computed(() => displayedUrls.value.length);
        const hasItems = computed(() => totalMatched.value > 0);
        const hasMore = computed(() => totalMatched.value > shown.value);
        const isAutoLoadingMore = ref(false);

        const foreignCloud = computed(() => {
            if (!vueResult.value) return 0;
            return vueResult.value.test_results?.foreign?.cloud || 0;
        });

        const foreignDirect = computed(() => {
            if (!vueResult.value) return 0;
            return vueResult.value.test_results?.foreign?.direct || 0;
        });

        const domesticCloud = computed(() => {
            if (!vueResult.value) return 0;
            return vueResult.value.test_results?.domestic?.cloud || 0;
        });

        const domesticDirect = computed(() => {
            if (!vueResult.value) return 0;
            return vueResult.value.test_results?.domestic?.direct || 0;
        });

        const domesticCount = computed(() => domesticDirect.value);
        const cloudCount = computed(() => domesticCloud.value);
        const foreignCloudCount = computed(() => foreignCloud.value);
        const foreignDirectCount = computed(() => foreignDirect.value);
        const foreignCount = computed(() => foreignCloudCount.value + foreignDirectCount.value);

        const summaryKey = computed(() => {
            if (!vueResult.value) return '';
            return getSummaryKey(vueResult.value);
        });

        const summaryText = computed(() => {
            locale.value;
            if (!summaryKey.value) return '';
            return getSummaryText(summaryKey.value);
        });

        const summaryClass = computed(() => {
            if (!vueResult.value) return '';
            const fc = foreignCloud.value;
            const fd = foreignDirect.value;
            const dc = domesticCloud.value;
            if (fc + fd > 0) return 'wont-work';
            if (dc > 0) return 'might-work';
            return 'will-work';
        });

        // Build a list of non-zero connection statistics.
        const connectionStatsItems = computed(() => {
            const items = [];
            if (domesticCount.value > 0) {
                items.push({ count: domesticCount.value, key: 'domestic' });
            }
            if (cloudCount.value > 0) {
                items.push({ count: cloudCount.value, key: 'cloud' });
            }
            if (foreignCloudCount.value > 0) {
                items.push({ count: foreignCloudCount.value, key: 'foreignCloud' });
            }
            if (foreignDirectCount.value > 0) {
                items.push({ count: foreignDirectCount.value, key: 'foreignDirect' });
            }
            return items;
        });

        const domesticZeroClass = computed(() => domesticCount.value === 0 ? ' score-zero' : '');
        const cloudZeroClass = computed(() => cloudCount.value === 0 ? ' score-zero' : '');
        const foreignZeroClass = computed(() => foreignCount.value === 0 ? ' score-zero' : '');

        const rawDataUrl = computed(() => {
            if (!vueResult.value) return '#';
            return GITHUB_WEB_URL + urlToFilename(vueResult.value.url);
        });

        const detailsJson = computed(() => {
            if (!vueResult.value) return '';
            return JSON.stringify(vueResult.value, null, 2);
        });

        // Convert a category key into the current display label.
        function getCategoryDisplayText(category) {
            return getAppTextConfig().categoryLabels[category] || category;
        }

        // Map category keys to CSS classes.
        function getCategoryClass(category) {
            const classMap = {
                'domestic/cloud': 'category-domestic-cloud',
                'foreign/cloud': 'category-foreign-cloud',
                'domestic/direct': 'category-domestic-direct',
                'foreign/direct': 'category-foreign-direct'
            };
            return classMap[category] || '';
        }

        // Primary site location taken from domainDetails[0].
        const siteLocation = computed(() => {
            locale.value;
            if (!vueResult.value || !vueResult.value.domainDetails || vueResult.value.domainDetails.length === 0) {
                return null;
            }
            const firstDetail = vueResult.value.domainDetails[0];
            return {
                ip: firstDetail.ipinfo?.ip || '',
                org: firstDetail.ipinfo?.org || '',
                category: firstDetail.category || '',
                categoryText: getCategoryDisplayText(firstDetail.category || ''),
                categoryClass: getCategoryClass(firstDetail.category || '')
            };
        });

        // Connection details from domainDetails[1] onward.
        const connectionDetails = computed(() => {
            locale.value;
            if (!vueResult.value || !vueResult.value.domainDetails || vueResult.value.domainDetails.length <= 1) {
                return [];
            }
            return vueResult.value.domainDetails.slice(1)
                .filter(detail => {
                    // Ignore connections with missing required data.
                    if (!detail.category) {
                        return false;
                    }

                    // A valid domain is required.
                    let domain = '';
                    try {
                        const url = new URL(detail.originalUrl);
                        domain = url.hostname;
                    } catch (e) {
                        // Fall back to ipinfo.domain when originalUrl is not parseable.
                        domain = detail.ipinfo?.domain || '';
                    }

                    // Ignore empty domain values.
                    if (!domain || domain.trim() === '') {
                        return false;
                    }
                    return true;
                })
                .map(detail => {
                    // Extract the domain from originalUrl.
                    let domain = '';
                    try {
                        const url = new URL(detail.originalUrl);
                        domain = url.hostname;
                    } catch (e) {
                        // Fall back to ipinfo.domain when parsing fails.
                        domain = detail.ipinfo?.domain || detail.originalUrl;
                    }
                    return {
                        domain: domain,
                        originalUrl: detail.originalUrl,
                        org: detail.ipinfo?.org || '',
                        category: detail.category || '',
                        categoryText: getCategoryDisplayText(detail.category || ''),
                        categoryClass: getCategoryClass(detail.category || '')
                    };
                })
                .sort((a, b) => {
                    // Sort by organization name without the ASN prefix.
                    const orgA = a.org || '';
                    const orgB = b.org || '';
                    // Keep the original order when both org values are missing.
                    if (!orgA && !orgB) return 0;
                    // Missing organization values sort last.
                    if (!orgA) return 1;
                    if (!orgB) return -1;

                    // Extract the organization name after the ASN prefix.
                    // Expected forms are "AS12345 Organization Name" or "AS12345".
                    const extractOrgName = (org) => {
                        // Strip the "AS" prefix and following digits.
                        const match = org.match(/^AS\d+\s*(.+)?$/i);
                        if (match && match[1]) {
                            return match[1].trim();
                        }

                        // Missing organization names sort last.
                        return '';
                    };

                    const nameA = extractOrgName(orgA);
                    const nameB = extractOrgName(orgB);

                    // Fall back to the full org string when both names are missing.
                    if (!nameA && !nameB) {
                        return orgA.localeCompare(orgB, getAppTextConfig().sortLocale);
                    }
                    // Missing organization names sort last.
                    if (!nameA) return 1;
                    if (!nameB) return -1;

                    // Sort by the extracted organization name.
                    return nameA.localeCompare(nameB, getAppTextConfig().sortLocale);
                });
        });

        // Search-related methods
        function loadMore() {
            maxDisplay.value = Math.min(totalMatched.value, maxDisplay.value + 200);
        }

        function onDropdownScroll(event) {
            if (isAutoLoadingMore.value || !hasMore.value) return;

            const dropdown = event.target;
            const distanceToBottom = dropdown.scrollHeight - dropdown.scrollTop - dropdown.clientHeight;

            // Allow a small threshold to avoid float precision issues near the bottom.
            if (distanceToBottom <= 8) {
                isAutoLoadingMore.value = true;
                loadMore();

                requestAnimationFrame(() => {
                    isAutoLoadingMore.value = false;
                });
            }
        }

        function onSearchKeydown(e) {
            if (!displayedUrls.value.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex.value = Math.min(
                    selectedIndex.value + 1,
                    displayedUrls.value.length - 1
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex.value = Math.max(selectedIndex.value - 1, -1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                let targetUrl = null;
                if (selectedIndex.value >= 0 && displayedUrls.value[selectedIndex.value]) {
                    targetUrl = displayedUrls.value[selectedIndex.value];
                } else if (displayedUrls.value.length > 0) {
                    targetUrl = displayedUrls.value[0];
                }
                if (targetUrl) {
                    selectUrl(targetUrl);
                }
            } else if (e.key === 'Escape') {
                // Keep the dropdown open on Escape and just clear selection.
                selectedIndex.value = -1;
            }
        }

        function onSearchFocus() {
            // Reset selection when the input regains focus.
            selectedIndex.value = -1;
        }

        async function openSearch() {
            // Ensure statistic.tsv is loaded before opening search for the first time.
            await ensureStatisticLoaded();

            // Show the search box and hide the secondary CTA button.
            showSearch.value = true;
            showCheckOther.value = false;

            // Reset search state.
            searchQuery.value = '';
            selectedIndex.value = -1;
            maxDisplay.value = 200;

            // Focus the input after the DOM updates.
            setTimeout(() => {
                const input = document.getElementById('search-input');
                if (input) {
                    input.focus();
                    const container = document.getElementById('search-container');
                    if (container) {
                        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }, 50);
        }

        // Expose openSearch globally for inline onclick handlers.
        window.openSearch = openSearch;

        watch(vueResult, () => {
            applyPageMeta();
        });

        applyPageMeta();

        return {
            locale,
            t,
            showSiteDynamic,
            showOverviewDynamic,
            zhLocaleHref,
            enLocaleHref,
            homeHref,
            vueResult,
            hasResult,
            overallChartUrl,
            overallStats,
            displayUrl,
            testTime,
            httpStatus,
            requestCount,
            uniqueDomains,
            testParameters,
            testingEnvironment,
            domesticCount,
            cloudCount,
            foreignCount,
            foreignCloudCount,
            foreignDirectCount,
            summaryKey,
            summaryText,
            summaryClass,
            connectionStatsItems,
            domesticZeroClass,
            cloudZeroClass,
            foreignZeroClass,
            rawDataUrl,
            detailsJson,
            siteLocation,
            connectionDetails,
            getCategoryDisplayText,
            getCategoryClass,
            // Search-related state and methods
            allUrls: allUrlsRef,
            searchQuery,
            selectedIndex,
            maxDisplay,
            filteredUrls,
            displayedUrls,
            totalAll,
            totalMatched,
            shown,
            hasItems,
            hasMore,
            showSearch,
            showCheckOther,
            formatDisplayUrl: cleanUrlForDisplay, // Reuse the global cleanUrlForDisplay helper.
            loadMore,
            onDropdownScroll,
            onSearchKeydown,
            onSearchFocus,
            selectUrl: selectUrl, // Reuse the global selectUrl helper.
            sitePageHref,
            openSearch
        };
    }
});

const vm = vueRootApp.mount('#app');
window.__vueApp__ = vm;
window.__vueState__ = vueState;

// Load results after Vue mounts so state writes are immediately reactive.
loadResults();
