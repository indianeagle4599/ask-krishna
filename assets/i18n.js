window.ASK_KRISHNA_I18N = (function () {
  const root = location.pathname.includes("/pages/") ? "../" : "";

  // Manifest holds only the metadata needed to render the language picker
  // before any locale or translation file is fetched. Per-language UI strings
  // live in `assets/locales/<code>.json`; per-language Gita translations live
  // in `data/translations/<code>.json` when `translations: true` is set.
  const manifest = {
    sa: { code: "सं", htmlLang: "sa" },
    hi: { code: "हि", htmlLang: "hi", translations: true },
    en: { code: "En", htmlLang: "en", translations: true },
  };

  const languages = {};
  const translations = {};

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} → ${response.status}`);
    return response.json();
  }

  async function loadLanguage(code) {
    if (!manifest[code]) throw new Error(`unknown language: ${code}`);
    if (!languages[code]) languages[code] = await fetchJson(`${root}assets/locales/${code}.json`);
    return languages[code];
  }

  async function loadTranslations(code) {
    if (!manifest[code]?.translations) return null;
    if (!translations[code]) translations[code] = await fetchJson(`${root}data/translations/${code}.json`);
    return translations[code];
  }

  return {
    defaultLanguage: "en",
    manifest,
    languages,
    translations,
    loadLanguage,
    loadTranslations,
  };
})();
