/**
 * Volunteer page UI i18n — ?lang= → sessionStorage → en.
 * Locales register on window.AWGP_BOOKS_I18N[lang].
 * (Separate from book language filter: awgp-books-lang-filter.)
 */
(function () {
  var STORAGE_KEY = 'awgp-books-ui-lang';
  var SUPPORTED = ['en', 'hi', 'gu', 'mr'];

  function normalizeLang(value) {
    if (!value) return null;
    var code = String(value).toLowerCase().split(/[-_]/)[0];
    return SUPPORTED.indexOf(code) !== -1 ? code : null;
  }

  function resolveLang() {
    try {
      var params = new URLSearchParams(window.location.search);
      var fromQuery = normalizeLang(params.get('lang'));
      if (fromQuery) {
        try {
          sessionStorage.setItem(STORAGE_KEY, fromQuery);
        } catch (e) {}
        return fromQuery;
      }
      var fromStore = normalizeLang(sessionStorage.getItem(STORAGE_KEY));
      if (fromStore) return fromStore;
    } catch (e) {}
    return 'en';
  }

  function getDict(lang) {
    var all = window.AWGP_BOOKS_I18N || {};
    return all[lang] || all.en || {};
  }

  function lookup(dict, key) {
    if (!key) return undefined;
    var parts = key.split('.');
    var cur = dict;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return typeof cur === 'string' ? cur : undefined;
  }

  function t(key, fallback) {
    var lang = window.AWGP_BOOKS_LANG || 'en';
    var primary = lookup(getDict(lang), key);
    if (primary != null) return primary;
    if (lang !== 'en') {
      var en = lookup(getDict('en'), key);
      if (en != null) return en;
    }
    return fallback != null ? fallback : key;
  }

  function withLang(href, lang) {
    if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0) return href;
    if (/^https?:\/\//i.test(href) && href.indexOf(window.location.host) === -1) {
      try {
        var abs = new URL(href, window.location.href);
        if (abs.origin !== window.location.origin) return href;
      } catch (e) {
        return href;
      }
    }
    try {
      var url = new URL(href, window.location.href);
      if (lang && lang !== 'en') url.searchParams.set('lang', lang);
      else url.searchParams.delete('lang');
      return url.pathname + url.search + url.hash;
    } catch (e) {
      return href;
    }
  }

  function applyText() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      el.textContent = t(key, el.textContent);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      el.innerHTML = t(key, el.innerHTML);
    });
    var titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) document.title = t(titleEl.getAttribute('data-i18n'), document.title);
  }

  function rewriteLinks(lang) {
    document.querySelectorAll('a[href]').forEach(function (a) {
      if (a.hasAttribute('data-lang-switch')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0) return;
      if (/^https?:\/\//i.test(href) && href.indexOf(window.location.host) === -1) return;
      a.setAttribute('href', withLang(href, lang));
    });
  }

  function ensureFonts(lang) {
    if (lang !== 'hi' && lang !== 'mr' && lang !== 'gu') return;
    if (document.getElementById('awgp-books-indic-fonts')) return;
    var link = document.createElement('link');
    link.id = 'awgp-books-indic-fonts';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans+Gujarati:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  function renderLangSwitcher(lang) {
    var host = document.getElementById('lang-switcher');
    if (!host) return;
    var labels = { en: 'English', hi: 'हिन्दी', gu: 'ગુજરાતી', mr: 'मराठी' };
    host.innerHTML = SUPPORTED.map(function (code) {
      var active = code === lang ? ' is-active' : '';
      return (
        '<button type="button" class="lang-btn' +
        active +
        '" data-lang-switch="' +
        code +
        '" aria-pressed="' +
        (code === lang ? 'true' : 'false') +
        '">' +
        labels[code] +
        '</button>'
      );
    }).join('');
    host.querySelectorAll('[data-lang-switch]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = btn.getAttribute('data-lang-switch');
        try {
          sessionStorage.setItem(STORAGE_KEY, next);
        } catch (e) {}
        var url = new URL(window.location.href);
        if (next === 'en') url.searchParams.delete('lang');
        else url.searchParams.set('lang', next);
        window.location.href = url.toString();
      });
    });
  }

  var lang = resolveLang();
  window.AWGP_BOOKS_LANG = lang;
  window.AWGP_BOOKS_t = t;
  window.AWGP_BOOKS_withLang = withLang;
  document.documentElement.lang = lang;
  document.documentElement.setAttribute('data-books-ui-lang', lang);
  ensureFonts(lang);

  function boot() {
    applyText();
    rewriteLinks(lang);
    renderLangSwitcher(lang);
    document.dispatchEvent(new CustomEvent('awgp-books-i18n-ready', { detail: { lang: lang } }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
