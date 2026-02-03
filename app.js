const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/irvin/web-resilience-test-result/refs/heads/main/';
const GITHUB_WEB_URL = 'https://github.com/irvin/web-resilience-test-result/blob/main/';
// 部署後 statistic.tsv 在 gh-pages 根目錄，從本站讀取即可
const STATISTIC_TSV_URL = '/statistic.tsv';

// 快取 key
const CACHE_KEY = 'web_resilience_urls_cache';
// 快取過期時間（24 小時，單位：毫秒）
const CACHE_EXPIRE_TIME = 24 * 60 * 60 * 1000;

// 全域變數
let allUrls = [];

async function fetchTestResult(filename) {
    try {
        const response = await fetch(GITHUB_RAW_URL + filename);
        return await response.json();
    } catch (error) {
        console.error('Error fetching result:', error);
        return null;
    }
}

function formatDate(isoString) {
    return new Date(isoString).toLocaleString('zh-TW');
}

function getSummaryText(result) {
    const foreignTotal = (result.test_results.foreign?.cloud || 0) + (result.test_results.foreign?.direct || 0);
    if (foreignTotal > 0) {
        return '不會動';
    }
    const domesticCloud = result.test_results.domestic?.cloud || 0;
    if (domesticCloud > 0) {
        return '不確定';
    }
    return '可能會動';
}

// 從 URL 參數取得要顯示的網址
function getUrlParam() {
    return window.location.search.substring(5);
}

// 將網址轉換為對應的 JSON 檔名
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

// 載入統計資料
async function loadStatisticData() {
    // 檢查快取
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            // 檢查是否過期
            const now = Date.now();
            const cacheTime = data.timestamp || 0;
            const isExpired = (now - cacheTime) > CACHE_EXPIRE_TIME;

            if (!isExpired && data.urls && data.urls.length > 0) {
                allUrls = data.urls;
                return allUrls;
            } else if (isExpired) {
                // 快取已過期，清除
                localStorage.removeItem(CACHE_KEY);
            }
        } catch (e) {
            console.error('Error parsing cache:', e);
            // 解析失敗，清除快取
            localStorage.removeItem(CACHE_KEY);
        }
    }

    // 載入 TSV
    try {
        const response = await fetch(STATISTIC_TSV_URL);
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim());

        // 跳過標題行，提取 URL（第一欄）
        allUrls = [];
        for (let i = 1; i < lines.length; i++) {
            let url = lines[i].split('\t')[0];
            if (url && url.startsWith('http')) {
                // 標準化：移除多餘的結尾斜線
                url = cleanUrl(url, { removeProtocol: false, removeWww: false, removeTrailingSlash: true });
                allUrls.push(url);
            }
        }

        // 依字母順序排序（以去掉協定後的網址為準）
        allUrls.sort((a, b) => {
            const ca = cleanUrlForSearch(a);
            const cb = cleanUrlForSearch(b);
            if (ca < cb) return -1;
            if (ca > cb) return 1;
            return 0;
        });

        // 儲存快取（包含時間戳記）
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            urls: allUrls,
            timestamp: Date.now()
        }));
        return allUrls;
    } catch (error) {
        console.error('Error loading statistic data:', error);
        return [];
    }
}

// 統一的 URL 清理函數
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

// 用於顯示的 URL 清理（移除協議、www、結尾斜線）
function cleanUrlForDisplay(url) {
    return cleanUrl(url, { removeProtocol: true, removeWww: true, removeTrailingSlash: true });
}

// 用於導航的 URL 清理（移除協議、結尾斜線，保留 www.）
function cleanUrlForNavigation(url) {
    return cleanUrl(url, { removeProtocol: true, removeWww: false, removeTrailingSlash: true });
}

// 用於搜尋比對的 URL 清理（移除協議，轉小寫）
function cleanUrlForSearch(url) {
    return cleanUrl(url, { removeProtocol: true, removeWww: false, removeTrailingSlash: false, toLowerCase: true });
}

// 篩選 URL（純函式，供 Vue 與一般 JS 共用）
function filterUrls(query, urls) {
    if (!query) return urls;
    const lowerQuery = query.toLowerCase();
    return urls.filter(url => {
        const cleanUrl = cleanUrlForSearch(url);
        return cleanUrl.includes(lowerQuery);
    });
}

// 檢查是否為靜態頁面
function isStaticPage() {
    return window.__IS_STATIC_PAGE__ === true;
}

// 選擇 URL 並跳轉（一律跳轉到靜態頁面）
function selectUrl(url) {
    // 跳轉時使用標準化後的網址（移除協定與多餘結尾斜線，保留 www.）
    const cleanUrl = cleanUrlForNavigation(url);

    // 統一使用 /web/_domain_ 格式
    const staticPath = `/web/${cleanUrl}/`;
    window.location.href = staticPath;
}

// 從 URL 路徑中提取 domain（用於 404 處理）
function extractDomainFromPath() {
    const pathname = window.location.pathname;
    // 匹配 /web/{domain}/ 格式
    const match = pathname.match(/^\/web\/([^\/]+)\/?$/);
    if (match) {
        return match[1];
    }
    return null;
}

async function loadResults() {
    let urlParam = getUrlParam();

    // 404 處理：如果本身非 static page，則嘗試從路徑擷取 /web/{domain}，視為 URL 參數
    if (!urlParam && !isStaticPage()) {
        const domainFromPath = extractDomainFromPath();
        if (domainFromPath) {
            urlParam = domainFromPath;
        }
    }

    // 如果有 URL 參數，且不在 build 環境中（localhost:3000），直接跳轉到對應的靜態頁面
    if (urlParam && !window.location.hostname.includes('localhost') && window.location.port !== '3000') {
        const cleanUrl = cleanUrlForNavigation(urlParam);
        // 統一使用 /web/_domain_ 格式
        const staticPath = `/web/${cleanUrl}/`;
        window.location.href = staticPath;
        return;
    }

    // 載入統計資料（無論是否有 URL 參數都需要）
    await loadStatisticData();

    // 將統計 URL 清單注入 Vue 狀態，供搜尋使用
    if (window.__vueState__ && window.__vueState__.allUrls) {
        window.__vueState__.allUrls.value = allUrls;
    }

    const resultsEl = document.getElementById('results');

    // 如果是靜態頁面且沒有 URL 參數，直接返回，不需要執行後續的 fetch 邏輯
    if (isStaticPage() && !urlParam) {
        // 靜態頁面：保持顯示，設定搜尋相關狀態
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

    if (!urlParam) {
        // 無 URL 參數：只顯示搜尋框，隱藏結果區
        if (resultsEl) {
            resultsEl.style.display = 'none';
        }
        // 透過 Vue 狀態控制顯示
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
                window.__vueState__.maxDisplay.value = 100;
            }
        }
        return;
    }

    // 有 URL 參數：顯示結果區，初始隱藏搜尋框
    if (resultsEl) {
        resultsEl.style.display = 'block';
    }
    // 透過 Vue 狀態控制顯示
    if (window.__vueState__) {
        if (window.__vueState__.showSearch) {
            window.__vueState__.showSearch.value = false;
        }
        if (window.__vueState__.showCheckOther) {
            window.__vueState__.showCheckOther.value = true;
        }
    }

    // 更新 meta 標籤
    const baseUrl = 'https://resilience.ocf.tw/web';
    const currentUrl = urlParam ? `${baseUrl}/${urlParam}` : baseUrl;

    document.querySelector('link[rel="canonical"]').href = currentUrl;
    document.querySelector('meta[property="og:url"]').content = currentUrl;
    const cleanUrlParam = urlParam ? cleanUrlForNavigation(urlParam) : '';
    document.title = cleanUrlParam ? `海纜斷掉時，${cleanUrlParam} 會動嗎？` : '海纜斷掉時網站會動嗎？';
    document.querySelector('meta[property="og:title"]').content = document.title;

    // 顯示測試結果
    const result = await fetchTestResult(urlToFilename(urlParam));
    if (result) {
        // 將結果寫入 Vue 狀態，由 Vue template 負責渲染結果卡片與 h1
        if (window.__vueState__ && window.__vueState__.vueResult) {
            window.__vueState__.vueResult.value = result;
        }

        const summaryText = getSummaryText(result);
        document.querySelector('meta[property="og:description"]').content = summaryText;
    }
    else {
        // 找不到結果時，改用搜尋框的「找不到」流程
        if (resultsEl) {
            resultsEl.style.display = 'none';
        }
        // 透過 Vue 狀態控制顯示
        if (window.__vueState__) {
            if (window.__vueState__.showSearch) {
                window.__vueState__.showSearch.value = true;
            }
            if (window.__vueState__.showCheckOther) {
                window.__vueState__.showCheckOther.value = false;
            }
            // 將帶入的網址視為輸入框查詢內容（交由 Vue 搜尋邏輯處理）
            const clean = cleanUrlForNavigation(urlParam);
            if (window.__vueState__.searchQuery) {
                window.__vueState__.searchQuery.value = clean;
            }
            if (window.__vueState__.selectedIndex) {
                window.__vueState__.selectedIndex.value = -1;
            }
            if (window.__vueState__.maxDisplay) {
                window.__vueState__.maxDisplay.value = 100;
            }
        }
    }

}

const { createApp, ref, computed } = Vue;

// 提供給現有 JS 存取的 Vue 狀態容器
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

        // 搜尋相關狀態
        const allUrlsRef = ref([]);
        const searchQuery = ref('');
        const selectedIndex = ref(-1);
        const maxDisplay = ref(100);
        const showSearch = ref(false);
        const showCheckOther = ref(true);

        // 讓外部 JS 可以直接設定結果與搜尋狀態
        vueState.vueResult = vueResult;
        vueState.allUrls = allUrlsRef;
        vueState.searchQuery = searchQuery;
        vueState.selectedIndex = selectedIndex;
        vueState.maxDisplay = maxDisplay;
        vueState.showSearch = showSearch;
        vueState.showCheckOther = showCheckOther;

        const hasResult = computed(() => !!vueResult.value);

        const displayUrl = computed(() => {
            if (!vueResult.value) return '';
            return cleanUrlForNavigation(vueResult.value.url || '');
        });

        const testTime = computed(() => {
            if (!vueResult.value) return '';
            return formatDate(vueResult.value.timestamp);
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

        // 搜尋相關計算
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

        const summaryText = computed(() => {
            if (!vueResult.value) return '';
            return getSummaryText(vueResult.value);
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

        // 生成連線統計項目列表（只包含非零項目）
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

        // 格式化 category 為中文
        function formatCategory(category) {
            const categoryMap = {
                'domestic/cloud': '境內／雲端',
                'foreign/cloud': '境外／雲端',
                'domestic/direct': '境內／其他',
                'foreign/direct': '境外／其他'
            };
            return categoryMap[category] || category;
        }

        // 取得 category 對應的 CSS class
        function getCategoryClass(category) {
            const classMap = {
                'domestic/cloud': 'category-domestic-cloud',
                'foreign/cloud': 'category-foreign-cloud',
                'domestic/direct': 'category-domestic-direct',
                'foreign/direct': 'category-foreign-direct'
            };
            return classMap[category] || '';
        }

        // 網站位置（來自 domainDetails[0]）
        const siteLocation = computed(() => {
            if (!vueResult.value || !vueResult.value.domainDetails || vueResult.value.domainDetails.length === 0) {
                return null;
            }
            const firstDetail = vueResult.value.domainDetails[0];
            return {
                ip: firstDetail.ipinfo?.ip || '',
                org: firstDetail.ipinfo?.org || '',
                category: firstDetail.category || '',
                categoryText: formatCategory(firstDetail.category || ''),
                categoryClass: getCategoryClass(firstDetail.category || '')
            };
        });

        // 連線資訊（來自 domainDetails[1] 之後）
        const connectionDetails = computed(() => {
            if (!vueResult.value || !vueResult.value.domainDetails || vueResult.value.domainDetails.length <= 1) {
                return [];
            }
            return vueResult.value.domainDetails.slice(1)
                .filter(detail => {
                    // 篩除沒有有效資料的連線
                    // 必須有 category
                    if (!detail.category) {
                        return false;
                    }
                    // 必須有有效的 domain
                    let domain = '';
                    try {
                        const url = new URL(detail.originalUrl);
                        domain = url.hostname;
                    } catch (e) {
                        // 如果無法解析 URL，檢查是否有 ipinfo.domain
                        domain = detail.ipinfo?.domain || '';
                    }
                    // 如果 domain 為空，則篩除
                    if (!domain || domain.trim() === '') {
                        return false;
                    }
                    return true;
                })
                .map(detail => {
                    // 從 originalUrl 提取 domain
                    let domain = '';
                    try {
                        const url = new URL(detail.originalUrl);
                        domain = url.hostname;
                    } catch (e) {
                        // 如果無法解析，使用 ipinfo.domain
                        domain = detail.ipinfo?.domain || detail.originalUrl;
                    }
                    return {
                        domain: domain,
                        originalUrl: detail.originalUrl,
                        org: detail.ipinfo?.org || '',
                        category: detail.category || '',
                        categoryText: formatCategory(detail.category || ''),
                        categoryClass: getCategoryClass(detail.category || '')
                    };
                })
                .sort((a, b) => {
                    // 按照 AS 號碼以外的名稱排序
                    const orgA = a.org || '';
                    const orgB = b.org || '';
                    // 如果都沒有 org，保持原順序
                    if (!orgA && !orgB) return 0;
                    // 沒有 org 的排在最後
                    if (!orgA) return 1;
                    if (!orgB) return -1;

                    // 提取 AS 號碼後面的名稱部分
                    // 格式通常是 "AS12345 Organization Name" 或 "AS12345"
                    const extractOrgName = (org) => {
                        // 移除 "AS" 開頭和數字部分
                        const match = org.match(/^AS\d+\s*(.+)?$/i);
                        if (match && match[1]) {
                            return match[1].trim();
                        }
                        // 如果沒有名稱部分，返回空字串（會排在最後）
                        return '';
                    };

                    const nameA = extractOrgName(orgA);
                    const nameB = extractOrgName(orgB);

                    // 如果都沒有名稱，按照完整 org 排序
                    if (!nameA && !nameB) {
                        return orgA.localeCompare(orgB, 'zh-TW');
                    }
                    // 沒有名稱的排在最後
                    if (!nameA) return 1;
                    if (!nameB) return -1;
                    // 按照名稱排序
                    return nameA.localeCompare(nameB, 'zh-TW');
                });
        });

        // 搜尋相關方法
        function loadMore() {
            maxDisplay.value = Math.min(totalMatched.value, maxDisplay.value + 100);
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
                // ESC 時暫時不隱藏下拉，僅清除選取
                selectedIndex.value = -1;
            }
        }

        function onSearchFocus() {
            // 聚焦時重新顯示目前查詢結果（狀態由 computed 自動處理）
            selectedIndex.value = -1;
        }

        function openSearch() {
            // 顯示搜尋框，隱藏「檢查其他網站」按鈕
            showSearch.value = true;
            showCheckOther.value = false;
            // 重置搜尋狀態
            searchQuery.value = '';
            selectedIndex.value = -1;
            maxDisplay.value = 100;
            // Focus 輸入框
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

        // 暴露 openSearch 到全域，供 onclick 使用
        window.openSearch = openSearch;

        return {
            vueResult,
            hasResult,
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
            formatCategory,
            getCategoryClass,
            // 搜尋相關
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
            formatDisplayUrl: cleanUrlForDisplay, // 使用全局的 cleanUrlForDisplay 函數
            loadMore,
            onSearchKeydown,
            onSearchFocus,
            selectUrl: selectUrl, // 使用全局的 selectUrl 函數
            openSearch
        };
    }
});

const vm = vueRootApp.mount('#app');
window.__vueApp__ = vm;
window.__vueState__ = vueState;

// Vue 掛載完成後再載入測試結果，確保可以直接寫入 Vue 狀態
loadResults();
