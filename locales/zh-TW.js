(function (global) {
    global.WebResilienceLocaleBundles = global.WebResilienceLocaleBundles || {};

    global.WebResilienceLocaleBundles['zh-TW'] = {
        messages: {
            lang: {
                switcherLabel: '語言',
                zh: '中文',
                en: 'English'
            },
            meta: {
                defaultTitle: '海纜斷掉時網站會動嗎？',
                defaultDescription: '輸入網址查看測試結果'
            },
            home: {
                title: '海纜斷掉時，台灣人常用的網站會動嗎？',
                titlePrefix: '海纜斷掉時，',
                titleSuffix: ' 會動嗎？',
                overviewQuestion: '海纜斷掉時，台灣人常用的網站會動嗎？',
                overviewStats: '根據 {totalCount} 個台灣常用網站的檢測結果，在海纜斷光或極度壅塞的情況下，有 {wontWorkPercent} 的網站可能不會動；{internationalCloudPercent} 的網站有較高風險；僅 {mightWorkPercent} 的網站相對較有韌性，較有可能維持正常運作。',
                overviewChartCaption: '下圖為台灣常用網站的境外及國際雲資源依賴暴露狀態。',
                overviewFallback: '根據目前的檢測結果，下圖為台灣常用網站的境外及國際雲資源依賴暴露狀態。亦即，在海纜斷光或極度壅塞的情境下，有多少比例的網站將會直接失效，多少網站因依賴國際雲節點而故障風險較高，多少比例的網站則相對較有韌性。',
                reportLink: '查看研究方法與彙整報告',
                overviewTrailing: '。',
                chartAlt: '整體結果圖表'
            },
            search: {
                placeholder: '輸入網址查看測試結果...',
                noResults: '找不到 {query} 的測試結果',
                noResultsHelpHtml: '你可以在此檢視<a href="https://github.com/irvin/web-resilience-test-result" target="_blank">已測試網站資料</a>，並<a href="https://github.com/irvin/web-resilience-test/tree/a6ccd6f1b05fca34034250055d566d1c1c0f4c65#d-automated-testing-tool" target="_blank">使用此工具</a>手動進行測試。',
                statsWithItems: '總共 {totalAll} 網站，目前顯示前 {shown} 個。',
                statsEmpty: '總共 {totalAll} 網站，目前顯示前 0 個。',
                loadMore: '[載入更多網站]'
            },
            result: {
                scores: {
                    domestic: '境內直接連線 (O)',
                    cloud: '境內雲端服務 (?)',
                    foreign: '境外連線 (X)'
                },
                faq: {
                    openQuestion: '海纜斷掉時，{displayUrl} 還能正常開啟嗎？',
                    wontWork: {
                        opening: '根據最近一次測試，在海纜斷掉的情境下，{displayUrl} 可能「不會動」。這表示如果海纜中斷、對外連線受阻，網站就可能打不開。',
                        whyQuestion: '為什麼 {displayUrl} 在海纜斷掉時「不會動」？',
                        whyAnswer: '測試過程中，網站的首頁載入時，我們發現有部分內容或資源需要從境外取得。平常這些資源可以正常載入，但在海纜中斷或嚴重塞車的情境下，這些連線可能失敗，網站也就可能跟著出問題。',
                        congestionQuestion: '這是不是代表在海纜壅塞時，{displayUrl} 屆時一定不能用？',
                        congestionAnswer: '不一定。這個結果是根據首頁載入時觀察到的資源依賴來判定，反映的是較高風險，而不能保證所有頁面或所有功能，都一定完全失效。'
                    },
                    uncertain: {
                        opening: '根據最近一次測試，在海纜斷掉的情境下，{displayUrl} 的可用性「不確定」。這表示如果海纜中斷、對外連線受阻時，無法確認網站是否能維持可用。',
                        whyQuestion: '為什麼 {displayUrl} 在海纜斷掉時「不確定是否會動」？',
                        whyAnswer: '測試過程中，我們雖然沒有看到直接連到境外的資源請求，但有發現對於跨國雲服務在台灣的節點依賴。這些服務能否在對外受阻時持續運作，會受到平台架構、快取設計、或回源方式等影響，所以目前只能列為「不確定」。',
                        congestionQuestion: '這是不是代表在海纜壅塞時，{displayUrl} 屆時可能不能用？',
                        congestionAnswer: '「不確定」的意思是，目前不足以判定一定能用或不能用。{displayUrl} 所依賴的這些跨國雲服務在台節點，在海纜斷線或極度壅塞時的可用性，需由業者進一步釐清與說明。'
                    },
                    mightWork: {
                        opening: '根據最近一次測試，在海纜斷掉的情境下，{displayUrl} 「可能會動」。這表示如果海纜中斷、對外連線受阻，網站有可能維持可用。',
                        whyQuestion: '為什麼 {displayUrl} 在海纜斷掉時「可能會動」？',
                        whyAnswer: '測試過程中，{displayUrl} 的首頁使用的資源，看起來都能在境內取得，也沒有發現明確的國際雲依賴。這代表在海纜中斷或阻礙時，相對比較有機會維持運作。',
                        congestionQuestion: '這是不是代表在海纜壅塞時，{displayUrl} 一定沒問題？',
                        congestionAnswer: '不是。「可能會動」只表示首頁測試中沒有看到明顯高風險依賴，不代表整個網站所有頁面、登入流程、API、資料庫或其他功能，都一定正常。'
                    },
                    resilienceQuestion: '怎麼研判 {displayUrl} 在海纜障礙時的韌性？',
                    resilienceBodyHtml: '打開 {displayUrl} 的首頁時，我們觀察到來自 {uniqueDomains} 個網域的 {requestCount} 個請求。<br>如果其中包含境外的連線，判定為「不會動」；如果沒有境外連線，但有依賴跨國雲服務在台灣的節點，判定為「不確定」；如果只有境內跨國雲服務之外的連線，判定為「可能會動」。<br>詳細判定規則與流程，請參考<a href="https://resilience.ocf.tw/web/report/" target="_blank">研究方法與整體報告</a>。'
                },
                details: {
                    connectionsToggle: '連線資訊',
                    siteLocation: '網站位置',
                    connections: '連線資訊',
                    testEnvToggle: '測試環境',
                    testParams: '測試參數',
                    customDns: '指定 DNS 伺服器：{value}',
                    adblockLists: '使用 Adblock 清單：',
                    testEnv: '測試環境',
                    ip: 'IP：{value}',
                    city: '城市：{value}',
                    region: '地區：{value}',
                    country: '國家：{value}',
                    org: '組織：{value}',
                    dnsServer: 'DNS 伺服器：{value}',
                    rawDataToggle: '原始資料',
                    viewOnGithub: '在 GitHub 上查看',
                    lastTested: '最後測試時間：{time}'
                }
            },
            footer: {
                checkOther: '檢查其他網站',
                g0vTitle: 'g0v 數位韌性松',
                ocfTitle: '開放文化基金會',
                report: '研究報告',
                reportUrl: 'https://resilience.ocf.tw/web/report/',
                source: '原始碼',
                apnicTitle: 'APNIC Foundation ISIF Asia',
                apnicSupportHtml: 'This work was supported by a grant from the <a href="https://apnic.foundation/" target="_blank">APNIC Foundation</a>, via <a href="https://apnic.foundation/home/isifasia/" target="_blank">ISIF Asia</a>.'
            }
        },
        appText: {
            displayLocale: 'zh-TW',
            sortLocale: 'zh-TW',
            summaryLabels: {
                wontWork: '不會動',
                uncertain: '不確定',
                mightWork: '可能會動'
            },
            categoryLabels: {
                'domestic/cloud': '境內／雲端',
                'foreign/cloud': '境外／雲端',
                'domestic/direct': '境內／其他',
                'foreign/direct': '境外／其他'
            },
            pageTitle: (domain) => (domain ? `海纜斷掉時，${domain} 會動嗎？` : '海纜斷掉時網站會動嗎？'),
            homeOverallMetaDescription: (stats) => (
                `根據 ${stats.totalCount} 個台灣常用網站的檢測結果，在海纜斷光或極度壅塞的情況下，有 ${stats.wontWorkPercent} 的網站可能不會動；${stats.internationalCloudPercent} 的網站有較高風險；僅 ${stats.mightWorkPercent} 的網站相對較有韌性。輸入網址查看測試結果！`
            ),
            ogDescription: (domain, summaryKey) => {
                if (!domain) {
                    return '輸入網址查看測試結果';
                }
                if (summaryKey === 'wontWork') {
                    return `根據最近一次測試，在海纜斷掉的情境下，${domain} 可能「不會動」。這表示如果海纜中斷、對外連線受阻，網站就可能打不開。`;
                }
                if (summaryKey === 'uncertain') {
                    return `根據最近一次測試，在海纜斷掉的情境下，${domain} 的可用性「不確定」。這表示如果海纜中斷、對外連線受阻時，無法確認網站是否能維持可用。`;
                }
                return `根據最近一次測試，在海纜斷掉的情境下，${domain} 「可能會動」。這表示如果海纜中斷、對外連線受阻，網站有可能維持可用。`;
            }
        }
    };
})(window);
