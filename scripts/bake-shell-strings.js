const fs = require('fs');
const path = require('path');
const vm = require('vm');

const localeCache = new Map();

function loadLocaleMessages(locale, rootDir) {
  if (localeCache.has(locale)) {
    return localeCache.get(locale);
  }
  const fileName = locale === 'en' ? 'en.js' : 'zh-TW.js';
  const code = fs.readFileSync(path.join(rootDir, 'locales', fileName), 'utf8');
  const sandbox = { window: {}, global: {} };
  sandbox.global = sandbox.window;
  vm.runInNewContext(code, sandbox);
  const messages = sandbox.window.WebResilienceLocaleBundles[locale].messages;
  localeCache.set(locale, messages);
  return messages;
}

function getMessage(messages, key) {
  const parts = key.split('.');
  let node = messages;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') {
      return undefined;
    }
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function escapeHtmlText(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildWebPath(domain, locale) {
  if (!domain) {
    return locale === 'en' ? '/web/en/' : '/web/';
  }
  return locale === 'en' ? `/web/${domain}/en/` : `/web/${domain}/`;
}

function bakeLangSwitcher(messages, locale, domain) {
  const label = escapeHtmlText(getMessage(messages, 'lang.switcherLabel'));
  const zh = escapeHtmlText(getMessage(messages, 'lang.zh'));
  const en = escapeHtmlText(getMessage(messages, 'lang.en'));
  const zhHref = buildWebPath(domain, 'zh-TW');
  const enHref = buildWebPath(domain, 'en');
  const zhCurrent = locale === 'zh-TW' ? ' aria-current="page"' : '';
  const enCurrent = locale === 'en' ? ' aria-current="page"' : '';
  return `<nav class="lang-switcher" aria-label="${label}">
        <a class="lang-switcher-btn" href="${zhHref}" hreflang="zh-TW"${zhCurrent}>${zh}</a>
        <a class="lang-switcher-btn" href="${enHref}" hreflang="en"${enCurrent}>${en}</a>
    </nav>`;
}

/**
 * Replace compile-time i18n in nav, footer, and search chrome.
 * Keeps only parameterized search t() bindings in the HTML.
 */
function bakeShellStrings(html, { locale, domain }, rootDir) {
  const messages = loadLocaleMessages(locale, rootDir);
  const homeHref = buildWebPath('', locale);

  let out = html;

  out = out.replace(/<nav class="lang-switcher"[\s\S]*?<\/nav>/, bakeLangSwitcher(messages, locale, domain));

  const placeholder = escapeHtmlText(getMessage(messages, 'search.placeholder'));
  out = out.replace(
    /:placeholder="t\('search\.placeholder'\)"/,
    `placeholder="${placeholder}"`
  );

  const noResultsHelp = getMessage(messages, 'search.noResultsHelpHtml');
  if (noResultsHelp) {
    out = out.replace(
      /<p v-html="t\('search\.noResultsHelpHtml'\)"><\/p>/,
      `<p>${noResultsHelp}</p>`
    );
  }

  const loadMore = escapeHtmlText(getMessage(messages, 'search.loadMore'));
  out = out.replace(/\{\{\s*t\('search\.loadMore'\)\s*\}\}/, loadMore);

  const checkOther = escapeHtmlText(getMessage(messages, 'footer.checkOther'));
  out = out.replace(/:href="homeHref"/, `href="${homeHref}"`);
  out = out.replace(/\{\{\s*t\('footer\.checkOther'\)\s*\}\}/, checkOther);

  out = out.replace(
    /:title="t\('footer\.g0vTitle'\)"/,
    `title="${escapeHtmlText(getMessage(messages, 'footer.g0vTitle'))}"`
  );
  out = out.replace(
    /:title="t\('footer\.ocfTitle'\)"/,
    `title="${escapeHtmlText(getMessage(messages, 'footer.ocfTitle'))}"`
  );
  out = out.replace(
    /:title="t\('footer\.apnicTitle'\)"/,
    `title="${escapeHtmlText(getMessage(messages, 'footer.apnicTitle'))}"`
  );

  const reportUrl = getMessage(messages, 'footer.reportUrl');
  const reportText = escapeHtmlText(getMessage(messages, 'footer.report'));
  const sourceText = escapeHtmlText(getMessage(messages, 'footer.source'));
  out = out.replace(
    /<a :href="t\('footer\.reportUrl'\)" target="_blank">\{\{\s*t\('footer\.report'\)\s*\}\}<\/a>｜<a href="https:\/\/github\.com\/irvin\/web-resilience-test" target="_blank">\{\{\s*t\('footer\.source'\)\s*\}\}<\/a>/,
    `<a href="${reportUrl}" target="_blank">${reportText}</a>｜<a href="https://github.com/irvin/web-resilience-test" target="_blank">${sourceText}</a>`
  );

  const apnicHtml = getMessage(messages, 'footer.apnicSupportHtml');
  if (apnicHtml) {
    out = out.replace(
      /<p v-html="t\('footer\.apnicSupportHtml'\)"><\/p>/,
      `<p>${apnicHtml}</p>`
    );
  }

  return out;
}

module.exports = { bakeShellStrings };
