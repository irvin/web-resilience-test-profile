(function (global) {
    global.WebResilienceLocaleBundles = global.WebResilienceLocaleBundles || {};

    global.WebResilienceLocaleBundles.en = {
        messages: {
            lang: {
                switcherLabel: 'Language',
                zh: '中文',
                en: 'English'
            },
            meta: {
                defaultTitle: 'When submarine cables fail, will websites still work?',
                defaultDescription: 'Enter a URL to view the test result'
            },
            home: {
                title: 'When submarine cables fail, will the websites Taiwanese people use most still work?',
                titlePrefix: 'When submarine cables fail, will ',
                titleSuffix: ' still work?',
                overviewQuestion: 'When submarine cables fail, will the websites Taiwanese people use most still work?',
                overviewStats: 'Based on tests of {totalCount} widely used Taiwanese websites, if submarine cables fail or congestion is severe, {wontWorkPercent} of sites may not work; {internationalCloudPercent} face higher risk; only {mightWorkPercent} are relatively more resilient and more likely to remain available.',
                overviewChartCaption: 'The chart below shows exposure to foreign and international cloud dependencies among widely used Taiwanese sites.',
                overviewFallback: 'Based on current test results, the chart below shows exposure to foreign and international cloud dependencies among widely used Taiwanese websites—that is, what share of sites would fail outright, how many face higher fault risk due to reliance on international cloud nodes, and what share are relatively more resilient when submarine cables fail or congestion is extreme.',
                reportLink: 'Read the research methodology and aggregated report',
                overviewTrailing: '.',
                chartAlt: 'Overall results chart'
            },
            search: {
                placeholder: 'Enter a URL to view the test result...',
                noResults: 'No test result found for {query}',
                noResultsHelpHtml: 'You can browse the <a href="https://github.com/irvin/web-resilience-test-result" target="_blank">dataset of tested sites</a> and run a manual test with <a href="https://github.com/irvin/web-resilience-test/tree/a6ccd6f1b05fca34034250055d566d1c1c0f4c65#d-automated-testing-tool" target="_blank">this tool</a>.',
                statsWithItems: '{totalAll} sites in total; showing the first {shown}.',
                statsEmpty: '{totalAll} sites in total; showing the first 0.',
                loadMore: '[Load more sites]'
            },
            result: {
                scores: {
                    domestic: 'Domestic direct connections (O)',
                    cloud: 'Domestic cloud services (?)',
                    foreign: 'Foreign connections (X)'
                },
                faq: {
                    openQuestion: 'When submarine cables fail, can {displayUrl} still load normally?',
                    wontWork: {
                        opening: 'Based on the latest test, under a submarine-cable outage scenario {displayUrl} may “not work.” If international connectivity is cut or blocked, the site may fail to load.',
                        whyQuestion: 'Why might {displayUrl} “not work” when submarine cables fail?',
                        whyAnswer: 'During testing, when the homepage loaded we found that some content or resources had to be fetched from outside the country. Those resources usually load fine, but when cables are cut or traffic is severely congested those connections can fail—and the site may break along with them.',
                        congestionQuestion: 'Does this mean {displayUrl} will definitely be unavailable during severe cable congestion?',
                        congestionAnswer: 'Not necessarily. This result is inferred from resource dependencies observed while loading the homepage. It reflects higher risk—not a guarantee that every page or every feature would fail completely.'
                    },
                    uncertain: {
                        opening: 'Based on the latest test, under a submarine-cable outage scenario the availability of {displayUrl} is “uncertain.” If international connectivity is cut or blocked, we cannot confirm whether the site would remain available.',
                        whyQuestion: 'Why is it “uncertain” whether {displayUrl} would work when submarine cables fail?',
                        whyAnswer: 'We did not see direct requests to foreign resources, but we did find reliance on in-country nodes of multinational cloud services. Whether those services keep running when outbound connectivity is impaired depends on platform architecture, cache design, origin routing, and more—so for now we can only label the outcome “uncertain.”',
                        congestionQuestion: 'Does this mean {displayUrl} might be unavailable during severe cable congestion?',
                        congestionAnswer: '“Uncertain” means we currently cannot conclude it will definitely work or definitely fail. Availability of the multinational cloud in-country nodes that {displayUrl} depends on, when cables are cut or congestion is extreme, needs to be clarified and explained further by providers.'
                    },
                    mightWork: {
                        opening: 'Based on the latest test, under a submarine-cable outage scenario {displayUrl} “may work.” If international connectivity is cut or blocked, the site may still remain available.',
                        whyQuestion: 'Why might {displayUrl} “may work” when submarine cables fail?',
                        whyAnswer: 'During testing, resources used by the homepage of {displayUrl} appeared obtainable within the country, and we did not find clear international-cloud dependencies. That means when cables are cut or connectivity is blocked, the site has a relatively better chance of staying up.',
                        congestionQuestion: 'Does this mean {displayUrl} will definitely be fine during severe cable congestion?',
                        congestionAnswer: 'No. “May work” only means the homepage test did not show obvious high-risk dependencies. It does not guarantee that every page, login flow, API, database, or other function would behave normally.'
                    },
                    resilienceQuestion: 'How is resilience for {displayUrl} under cable outages assessed?',
                    resilienceBodyHtml: 'When opening the homepage of {displayUrl}, we observed {requestCount} requests across {uniqueDomains} domains.<br>If any involve connections abroad, the outcome is classified as “Will not work.” If there are no foreign connections but there is reliance on in-country nodes of multinational cloud services, the outcome is “Uncertain.” If connections are only domestic aside from that international-cloud pattern, the outcome is “May work.”<br>For detailed rules and the full workflow, see the <a href="https://resilience.ocf.tw/web/report/" target="_blank">research methodology and overall report</a>.'
                },
                details: {
                    connectionsToggle: 'Connection information',
                    siteLocation: 'Site location',
                    connections: 'Connection information',
                    testEnvToggle: 'Test environment',
                    testParams: 'Test parameters',
                    customDns: 'Specified DNS server: {value}',
                    adblockLists: 'Adblock lists used:',
                    testEnv: 'Test environment',
                    ip: 'IP: {value}',
                    city: 'City: {value}',
                    region: 'Region: {value}',
                    country: 'Country: {value}',
                    org: 'Organization: {value}',
                    dnsServer: 'DNS server: {value}',
                    rawDataToggle: 'Raw data',
                    viewOnGithub: 'View on GitHub',
                    lastTested: 'Last tested: {time}'
                }
            },
            footer: {
                checkOther: 'Check another site',
                g0vTitle: 'g0v Digital Resilience Hackathon',
                ocfTitle: 'Open Culture Foundation',
                report: 'Research report',
                reportUrl: 'https://resilience.ocf.tw/web/report/en.html',
                source: 'Source code',
                apnicTitle: 'APNIC Foundation ISIF Asia',
                apnicSupportHtml: 'This work was supported by a grant from the <a href="https://apnic.foundation/" target="_blank">APNIC Foundation</a>, via <a href="https://apnic.foundation/home/isifasia/" target="_blank">ISIF Asia</a>.'
            }
        },
        appText: {
            displayLocale: 'en-US',
            sortLocale: 'en',
            summaryLabels: {
                wontWork: 'Will not work',
                uncertain: 'Uncertain',
                mightWork: 'May work'
            },
            categoryLabels: {
                'domestic/cloud': 'Domestic / Cloud',
                'foreign/cloud': 'Foreign / Cloud',
                'domestic/direct': 'Domestic / Other',
                'foreign/direct': 'Foreign / Other'
            },
            pageTitle: (domain) => (domain
                ? `When submarine cables fail, will ${domain} still work?`
                : 'When submarine cables fail, will websites still work?'),
            homeOverallMetaDescription: (stats) => (
                `Based on tests of ${stats.totalCount} widely used Taiwanese websites, if submarine cables fail, ${stats.wontWorkPercent} may not work, ${stats.internationalCloudPercent} face higher risk, and only ${stats.mightWorkPercent} are more likely to remain operable. Enter a URL to see whether the site you want to visit might work!`
            ),
            ogDescription: (domain, summaryKey) => {
                if (!domain) {
                    return 'Enter a URL to view the test result';
                }
                if (summaryKey === 'wontWork') {
                    return `Based on the latest test, under a submarine-cable outage scenario ${domain} may “not work.” If international connectivity is cut or blocked, the site may fail to load.`;
                }
                if (summaryKey === 'uncertain') {
                    return `Based on the latest test, under a submarine-cable outage scenario the availability of ${domain} is “uncertain.” If international connectivity is cut or blocked, we cannot confirm whether the site would remain available.`;
                }
                return `Based on the latest test, under a submarine-cable outage scenario ${domain} “may work.” If international connectivity is cut or blocked, the site may still remain available.`;
            }
        }
    };
})(window);
