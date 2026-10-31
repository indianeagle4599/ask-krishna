(function () {
  "use strict";

  const AK = (window.ASK_KRISHNA = window.ASK_KRISHNA || {});

  AK.THEME = "askKrishna.theme";
  AK.LANG = "askKrishna.language";
  AK.WAIT_MS = 10000;
  AK.HOLD_MS = 7000;

  AK.themes = {
    "vedic-light": ["#f8f0df", "#8b4f1d"],
    "vedic-dark": ["#1d1711", "#dfad68"],
    "modern-light": ["#f7f8f8", "#316a72"],
    "modern-dark": ["#151718", "#8fcbd1"],
  };

  AK.$ = (selector, root = document) => root.querySelector(selector);
  AK.root = location.pathname.includes("/pages/") ? "../" : "";
  AK.timer = 0;

  AK.homeUrl = function () {
    return AK.root || "./";
  };

  AK.readLinkUrl = function (verseId) {
    const id = verseId || (() => {
      try {
        return JSON.parse(localStorage.getItem("askKrishna.readProgress"))?.verseId;
      } catch (_error) {
        return null;
      }
    })();
    return `${AK.root}pages/read.html${id ? `#${id}` : ""}`;
  };

  AK.hasReflectReturn = function () {
    return sessionStorage.getItem("askKrishna.reflectReturn") === "1";
  };

  AK.openReadVerse = function (verseId) {
    sessionStorage.setItem("askKrishna.reflectReturnPending", "1");
    sessionStorage.setItem("askKrishna.readPurify", JSON.stringify({ rememberReady: true, readReady: true }));
    location.href = AK.readLinkUrl(verseId);
  };

  AK.returnToReflect = function () {
    sessionStorage.removeItem("askKrishna.reflectReturn");
    sessionStorage.setItem("askKrishna.openPassage", "1");
    location.href = AK.homeUrl();
  };

  AK.i18n = window.ASK_KRISHNA_I18N;
  AK.languages = AK.i18n.languages;
  AK.manifest = AK.i18n.manifest;

  AK.language = function () {
    const stored = localStorage.getItem(AK.LANG);
    return AK.manifest[stored] ? stored : AK.i18n.defaultLanguage;
  };

  AK.currentLanguage = function () {
    return AK.languages[AK.language()] || AK.languages[AK.i18n.defaultLanguage];
  };

  AK.text = function (path) {
    const keys = path.split(".");
    const pick = (source) => keys.reduce((value, key) => value?.[key], source);
    return pick(AK.currentLanguage()) || pick(AK.languages[AK.i18n.defaultLanguage]) || "";
  };

  AK.langLabel = function () {
    return AK.manifest[AK.language()]?.code || AK.manifest[AK.i18n.defaultLanguage].code;
  };

  AK.maskIcon = function (name) {
    const icon = document.createElement("span");
    icon.className = `ui-icon ui-icon--${name}`;
    icon.setAttribute("aria-hidden", "true");
    return icon;
  };

  AK.iconLink = function (href, icon, label, className = "icon-button") {
    const link = document.createElement("a");
    link.href = href;
    link.className = className;
    link.append(AK.maskIcon(icon));
    link.setAttribute("aria-label", label);
    return link;
  };

  AK.settingMenu = function (ariaLabel, buttonContent, buildMenu) {
    const control = document.createElement("div");
    control.className = "setting";
    const trigger = AK.button("", () => control.classList.toggle("open"), "icon-button");
    trigger.setAttribute("aria-label", ariaLabel);
    trigger.append(buttonContent());
    const menu = document.createElement("div");
    menu.className = "menu";
    buildMenu(menu);
    control.append(trigger, menu);
    return control;
  };

  AK.pager = function ({ onPrev, onNext, center, leading, prevDisabled, nextDisabled }) {
    const nav = document.createElement("nav");
    nav.className = "pager";
    const prev = AK.button("←", onPrev, "arrow");
    const next = AK.button("→", onNext, "arrow");
    prev.disabled = !!prevDisabled;
    next.disabled = !!nextDisabled;
    const actions = document.createElement("div");
    actions.className = "card-actions";
    if (leading) actions.append(leading);
    if (center) actions.append(center);
    nav.append(prev, actions, next);
    return nav;
  };

  AK.indexButton = function (onOpen) {
    const btn = AK.button("", onOpen, "icon-button index-button");
    btn.append(AK.maskIcon("index"));
    btn.setAttribute("aria-label", AK.text("labels.verseIndex"));
    return btn;
  };

  AK.bookmarkButton = function (bookmarked, onToggle) {
    const btn = AK.button("", onToggle, "icon-button bookmark-button");
    btn.append(AK.maskIcon("bookmark"));
    btn.setAttribute("aria-label", AK.text(bookmarked ? "labels.bookmarked" : "labels.bookmark"));
    btn.setAttribute("aria-pressed", String(bookmarked));
    return btn;
  };

  AK.chapterNav = function ({ chapters, value, onChange }) {
    let current = value;
    const first = chapters[0];
    const last = chapters[chapters.length - 1];
    const nav = document.createElement("nav");
    nav.className = "chapter-nav";

    const select = document.createElement("select");
    select.className = "chapter-select";
    select.setAttribute("aria-label", AK.text("labels.chapter"));
    chapters.forEach((chapter) => {
      const option = document.createElement("option");
      option.value = chapter;
      option.textContent = `${AK.text("labels.chapter")} ${chapter}`;
      select.append(option);
    });

    const prev = AK.button("←", () => apply(current - 1), "arrow chapter-arrow");
    const next = AK.button("→", () => apply(current + 1), "arrow chapter-arrow");

    const sync = () => {
      select.value = String(current);
      prev.disabled = current <= first;
      next.disabled = current >= last;
    };

    const apply = (chapter) => {
      if (chapter < first || chapter > last) return;
      current = chapter;
      sync();
      onChange(chapter);
    };

    select.addEventListener("change", () => apply(Number(select.value)));
    sync();
    nav.append(prev, select, next);
    return nav;
  };

  AK.systemTheme = function () {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "vedic-dark" : "vedic-light";
  };

  AK.setTheme = function (name, persist = true) {
    const theme = AK.themes[name] ? name : AK.systemTheme();
    document.documentElement.dataset.theme = theme;
    if (persist && AK.themes[name]) localStorage.setItem(AK.THEME, theme);
  };

  AK.setLanguage = async function (name) {
    const lang = AK.manifest[name] ? name : AK.i18n.defaultLanguage;
    try {
      await AK.i18n.loadLanguage(lang);
    } catch (_error) {
      return;
    }
    localStorage.setItem(AK.LANG, lang);
    document.documentElement.lang = AK.manifest[lang].htmlLang;
    AK.render();
  };

  AK.updateMetaDescription = function () {
    const value = AK.page === "read" ? AK.text("meta.readDescription") : AK.text("meta.description");
    const meta = document.querySelector('meta[name="description"]');
    if (meta && value) meta.content = value;
  };

  AK.button = function (label, action, className = "text-button") {
    const el = document.createElement("button");
    el.type = "button";
    el.className = className;
    el.textContent = label;
    el.addEventListener("click", action);
    return el;
  };

  AK.block = function (className, value) {
    const el = document.createElement("p");
    el.className = className;
    el.textContent = value;
    return el;
  };

  AK.heading = function (level, className, value) {
    const el = document.createElement(`h${level}`);
    el.className = className;
    el.textContent = value;
    return el;
  };

  AK.sacredBlock = function (key) {
    const wrap = document.createElement("div");
    const sa = AK.languages.sa;
    const original = sa?.sacred?.[key] || "";
    const chosen = AK.text(`sacred.${key}`);
    wrap.append(AK.block("mantra", original));
    if (AK.language() !== "sa" && chosen && chosen !== original) wrap.append(AK.block("mantra chosen", chosen));
    return wrap;
  };

  AK.topbar = function () {
    const bar = document.createElement("header");
    bar.className = "topbar";

    const brand = document.createElement("a");
    brand.href = AK.homeUrl();
    brand.className = "brand";
    const logo = document.createElement("span");
    logo.className = "brand-logo";
    logo.setAttribute("aria-hidden", "true");
    brand.append(logo, document.createTextNode(AK.text("appName")));
    brand.addEventListener("click", AK.goHome);
    const heading = document.createElement("h1");
    heading.className = "brand-heading";
    heading.append(brand);

    const controls = document.createElement("div");
    controls.className = "settings";

    const themeControl = AK.settingMenu(
      AK.text("labels.theme"),
      () => document.createTextNode("◐"),
      (menu) => {
        menu.classList.add("swatches");
        Object.entries(AK.themes).forEach(([name, colors]) => {
          const swatch = AK.button("", () => AK.setTheme(name), "swatch");
          swatch.style.setProperty("--swatch-bg", colors[0]);
          swatch.style.setProperty("--swatch-fg", colors[1]);
          swatch.setAttribute("aria-label", AK.text(`themes.${name}`));
          menu.append(swatch);
        });
      },
    );

    const languageControl = AK.settingMenu(
      AK.text("labels.language"),
      () => {
        const label = document.createElement("span");
        label.className = "lang-toggle";
        label.textContent = AK.langLabel();
        return label;
      },
      (menu) => {
        menu.classList.add("langs");
        Object.entries(AK.manifest).forEach(([name, def]) => {
          const lang = AK.button(def.code, () => AK.setLanguage(name), "lang-button");
          lang.toggleAttribute("aria-current", name === AK.language());
          menu.append(lang);
        });
      },
    );

    if (AK.page !== "read") {
      const readLink = AK.iconLink(AK.readLinkUrl(), "book", AK.text("labels.readGita"), "read-link icon-button");
      readLink.addEventListener("click", (event) => event.stopPropagation());
      controls.append(readLink, themeControl, languageControl);
    } else {
      controls.append(themeControl, languageControl);
    }

    bar.append(heading, controls);
    return bar;
  };

  AK.footer = function () {
    const el = document.createElement("footer");
    el.className = "site-footer";
    el.textContent = AK.text("disclaimer");
    return el;
  };

  AK.pageFrame = function (content) {
    const counter = document.querySelector("[data-goatcounter]");
    const topbar = AK.topbar();
    const footer = AK.footer();
    if (!AK._shell) {
      if (!AK.screen) {
        AK.screen = document.createElement("main");
        AK.screen.className = "screen";
        AK.screen.dataset.screen = "";
      }
      document.body.replaceChildren(topbar, AK.screen, footer, ...(counter ? [counter] : []));
      AK._shell = true;
    } else {
      document.querySelector(".topbar")?.replaceWith(topbar);
      document.querySelector(".site-footer")?.replaceWith(footer);
    }
    AK.screen.replaceChildren(content);
  };

  AK.clearTimer = function () {
    clearTimeout(AK.timer);
    AK.timer = 0;
  };

  AK.setCookie = function (name, value, days) {
    const expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
  };

  AK.getCookie = function (name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  };

  AK.pauseScreen = function ({
    session,
    getSession,
    saveSession,
    secondMessageKey,
    actionLabel,
    onAction,
    pauseKey = "pauseReady",
    actionKey = "actionReady",
  }) {
    AK.clearTimer();
    const content = document.createElement("section");
    content.className = "center";
    const verse = document.createElement("div");
    verse.append(
      session[pauseKey]
        ? AK.block("mantra", AK.text(secondMessageKey))
        : AK.sacredBlock("purification"),
    );
    const pulse = document.createElement("i");
    pulse.className = "pulse";
    const action = AK.button(actionLabel, onAction, "text-button reveal");
    if (session[actionKey]) action.classList.add("show");
    content.append(verse, pulse, action);
    AK.pageFrame(content);

    if (session[actionKey]) return;

    if (session[pauseKey]) {
      AK.timer = setTimeout(() => {
        saveSession({ ...getSession(), [actionKey]: true });
        action.classList.add("show");
      }, AK.HOLD_MS);
      return;
    }

    AK.timer = setTimeout(() => {
      saveSession({ ...getSession(), [pauseKey]: true });
      verse.replaceChildren(AK.block("mantra", AK.text(secondMessageKey)));
      AK.timer = setTimeout(() => {
        saveSession({ ...getSession(), [pauseKey]: true, [actionKey]: true });
        action.classList.add("show");
      }, AK.HOLD_MS);
    }, AK.WAIT_MS);
  };

  AK.readReflectSession = function () {
    try {
      return JSON.parse(localStorage.getItem("askKrishna.session")) || {};
    } catch (_error) {
      return {};
    }
  };
})();
