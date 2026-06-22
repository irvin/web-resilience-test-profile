(function (global) {
    const LOCALES = ['zh-TW', 'en'];
    const DEFAULT_LOCALE = 'zh-TW';
    const SITE_BASE = '/web';

    let currentLocale = DEFAULT_LOCALE;

    function normalizeDomain(domain) {
        if (!domain) {
            return '';
        }
        return String(domain).replace(/^https?:\/\//, '').replace(/\/+$/, '');
    }

    function parseWebPath(pathname) {
        const normalized = (pathname || '').replace(/\/+$/, '') || SITE_BASE;

        if (normalized === SITE_BASE) {
            return { domain: '', locale: DEFAULT_LOCALE };
        }
        if (normalized === `${SITE_BASE}/en`) {
            return { domain: '', locale: 'en' };
        }

        const match = normalized.match(/^\/web\/([^/]+)(?:\/(en))?$/);
        if (!match) {
            return { domain: '', locale: DEFAULT_LOCALE };
        }

        const segment = match[1];
        const suffix = match[2];
        if (segment === 'en' && !suffix) {
            return { domain: '', locale: 'en' };
        }

        return {
            domain: segment,
            locale: suffix === 'en' ? 'en' : DEFAULT_LOCALE
        };
    }

    function resolveLocale() {
        return parseWebPath(global.location.pathname).locale;
    }

    function isProductionWebPath() {
        const pathname = global.location.pathname;
        return pathname === '/web' || pathname.startsWith('/web/');
    }

    function buildDevLocaleHref(locale) {
        const params = new URLSearchParams(global.location.search);
        const urlParam = params.get('url');
        if (urlParam) {
            params.set('url', normalizeDomain(urlParam));
        }
        params.set('lang', locale);
        const pathname = global.location.pathname || '/';
        return `${pathname}?${params.toString()}`;
    }

    function buildPagePath(domain, locale) {
        const cleanDomain = normalizeDomain(domain);
        if (!cleanDomain) {
            return locale === 'en' ? `${SITE_BASE}/en/` : `${SITE_BASE}/`;
        }
        return locale === 'en'
            ? `${SITE_BASE}/${cleanDomain}/en/`
            : `${SITE_BASE}/${cleanDomain}/`;
    }

    function sitePageHref(url) {
        const cleanDomain = normalizeDomain(url);
        if (!isProductionWebPath()) {
            const params = new URLSearchParams();
            params.set('url', cleanDomain);
            params.set('lang', currentLocale);
            const pathname = global.location.pathname || '/';
            return `${pathname}?${params.toString()}`;
        }
        return buildPagePath(cleanDomain, currentLocale);
    }

    function homeHref(locale) {
        const targetLocale = locale || currentLocale;
        if (!isProductionWebPath()) {
            return buildDevLocaleHref(targetLocale);
        }
        return buildPagePath('', targetLocale);
    }

    function getNotFoundUrlParam() {
        const { domain } = parseWebPath(global.location.pathname);
        if (domain) {
            return '';
        }
        const urlParam = new URLSearchParams(global.location.search).get('url');
        return urlParam ? normalizeDomain(urlParam) : '';
    }

    function buildNotFoundQueryHref(locale, domain) {
        const base = locale === 'en' ? `${SITE_BASE}/en/` : `${SITE_BASE}/`;
        return `${base}?url=${encodeURIComponent(domain)}`;
    }

    function alternateLocaleHref() {
        if (!isProductionWebPath()) {
            const target = currentLocale === 'en' ? DEFAULT_LOCALE : 'en';
            return buildDevLocaleHref(target);
        }
        const notFound = getNotFoundUrlParam();
        if (notFound) {
            const target = currentLocale === 'en' ? DEFAULT_LOCALE : 'en';
            return buildNotFoundQueryHref(target, notFound);
        }
        const { domain, locale } = parseWebPath(global.location.pathname);
        const target = locale === 'en' ? DEFAULT_LOCALE : 'en';
        return buildPagePath(domain, target);
    }

    function zhLocaleHref() {
        if (!isProductionWebPath()) {
            return buildDevLocaleHref(DEFAULT_LOCALE);
        }
        const notFound = getNotFoundUrlParam();
        if (notFound) {
            return buildNotFoundQueryHref(DEFAULT_LOCALE, notFound);
        }
        const { domain } = parseWebPath(global.location.pathname);
        return buildPagePath(domain, DEFAULT_LOCALE);
    }

    function enLocaleHref() {
        if (!isProductionWebPath()) {
            return buildDevLocaleHref('en');
        }
        const notFound = getNotFoundUrlParam();
        if (notFound) {
            return buildNotFoundQueryHref('en', notFound);
        }
        const { domain } = parseWebPath(global.location.pathname);
        return buildPagePath(domain, 'en');
    }

    function getBundles() {
        return global.WebResilienceLocaleBundles || {};
    }

    function getBundle(locale) {
        const bundles = getBundles();
        return bundles[locale] || bundles[DEFAULT_LOCALE] || {};
    }

    function getNested(messages, key) {
        const parts = key.split('.');
        let node = messages;
        for (const part of parts) {
            if (node == null || typeof node !== 'object') {
                return undefined;
            }
            node = node[part];
        }
        return node;
    }

    function interpolate(str, params) {
        if (!params || typeof str !== 'string') {
            return str;
        }
        return str.replace(/\{(\w+)\}/g, (_, name) => (
            params[name] != null ? String(params[name]) : `{${name}}`
        ));
    }

    function t(key, params) {
        const bundle = getBundle(currentLocale);
        const raw = getNested(bundle.messages || {}, key);
        if (typeof raw !== 'string') {
            return key;
        }
        return interpolate(raw, params);
    }

    function getAppText() {
        const bundle = getBundle(currentLocale);
        return bundle.appText || {};
    }

    function init() {
        const params = new URLSearchParams(global.location.search);
        const lang = params.get('lang');
        const onWebPath = global.location.pathname === '/web'
            || global.location.pathname.startsWith('/web/');

        if (!onWebPath && (lang === 'en' || lang === DEFAULT_LOCALE)) {
            currentLocale = lang === 'en' ? 'en' : DEFAULT_LOCALE;
        } else {
            currentLocale = resolveLocale();
        }

        global.document.documentElement.lang = currentLocale === 'en' ? 'en' : 'zh-TW';
    }

    global.WebResilienceI18n = {
        LOCALES,
        DEFAULT_LOCALE,
        SITE_BASE,
        init,
        resolveLocale,
        parseWebPath,
        getLocale: () => currentLocale,
        buildPagePath,
        sitePageHref,
        homeHref,
        alternateLocaleHref,
        zhLocaleHref,
        enLocaleHref,
        t,
        getAppText
    };
})(window);
