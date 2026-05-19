(async function () {
  "use strict";

  const COUNT = 5;
  const WAIT_MS = 10000;
  const HOLD_MS = 7000;
  const CARD_WIDTH = 1080;
  const THEME = "askKrishna.theme";
  const LANG = "askKrishna.language";
  const SESSION = "askKrishna.session";

  const themes = {
    "vedic-light": ["#f8f0df", "#8b4f1d"],
    "vedic-dark": ["#1d1711", "#dfad68"],
    "modern-light": ["#f7f8f8", "#316a72"],
    "modern-dark": ["#151718", "#8fcbd1"],
  };

  const i18n = window.ASK_KRISHNA_I18N;
  const languages = i18n.languages;
  const manifest = i18n.manifest;

  const $ = (selector, root = document) => root.querySelector(selector);
  const page = document.body.dataset.page;
  const screen = $("[data-screen]");
  const root = location.pathname.includes("/pages/") ? "../" : "";
  let session = readSession();
  let reflectTimer = 0;

  function pageUrl(name) {
    return name === "index" ? `${root}index.html` : `${root}pages/${name}.html`;
  }

  function language() {
    const stored = localStorage.getItem(LANG);
    return manifest[stored] ? stored : i18n.defaultLanguage;
  }

  function text(path) {
    const keys = path.split(".");
    const pick = (source) => keys.reduce((value, key) => value?.[key], source);
    return pick(currentLanguage()) || pick(languages[i18n.defaultLanguage]) || "";
  }

  function currentLanguage() {
    return languages[language()] || languages[i18n.defaultLanguage];
  }

  function systemTheme() {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "vedic-dark" : "vedic-light";
  }

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION)) || {};
    } catch (_error) {
      return {};
    }
  }

  function saveSession(next) {
    session = next;
    localStorage.setItem(SESSION, JSON.stringify(session));
  }

  function reset() {
    localStorage.removeItem(SESSION);
  }

  function goHome(event) {
    if (event) event.preventDefault();
    reset();
    location.href = pageUrl("index");
  }

  function isReload() {
    return performance.getEntriesByType("navigation")[0]?.type === "reload";
  }

  function setTheme(name, persist = true) {
    const theme = themes[name] ? name : systemTheme();
    document.documentElement.dataset.theme = theme;
    if (persist && themes[name]) localStorage.setItem(THEME, theme);
  }

  async function setLanguage(name) {
    const lang = manifest[name] ? name : i18n.defaultLanguage;
    try {
      await i18n.loadLanguage(lang);
    } catch (_error) {
      return;
    }
    localStorage.setItem(LANG, lang);
    document.documentElement.lang = manifest[lang].htmlLang;
    render();
  }

  function button(label, action, className = "text-button") {
    const el = document.createElement("button");
    el.type = "button";
    el.className = className;
    el.textContent = label;
    el.addEventListener("click", action);
    return el;
  }

  function block(className, value) {
    const el = document.createElement("p");
    el.className = className;
    el.textContent = value;
    return el;
  }

  function topbar() {
    const bar = document.createElement("header");
    bar.className = "topbar";

    const brand = document.createElement("a");
    brand.href = pageUrl("index");
    brand.className = "brand";
    const logo = document.createElement("span");
    logo.className = "brand-logo";
    logo.setAttribute("aria-hidden", "true");
    brand.append(logo, document.createTextNode(text("appName")));
    brand.addEventListener("click", goHome);

    const controls = document.createElement("div");
    controls.className = "settings";

    const themeControl = document.createElement("div");
    themeControl.className = "setting";
    const themeButton = button("◐", () => themeControl.classList.toggle("open"), "icon-button");
    themeButton.setAttribute("aria-label", text("labels.theme"));
    const swatches = document.createElement("div");
    swatches.className = "menu swatches";
    Object.entries(themes).forEach(([name, colors]) => {
      const swatch = button("", () => setTheme(name), "swatch");
      swatch.style.setProperty("--swatch-bg", colors[0]);
      swatch.style.setProperty("--swatch-fg", colors[1]);
      swatch.setAttribute("aria-label", text(`themes.${name}`));
      swatches.append(swatch);
    });
    themeControl.append(themeButton, swatches);

    const languageControl = document.createElement("div");
    languageControl.className = "setting";
    const languageButton = button("अ", () => languageControl.classList.toggle("open"), "icon-button");
    languageButton.setAttribute("aria-label", text("labels.language"));
    const langs = document.createElement("div");
    langs.className = "menu langs";
    Object.entries(manifest).forEach(([name, def]) => {
      const lang = button(def.code, () => setLanguage(name), "lang-button");
      lang.toggleAttribute("aria-current", name === language());
      langs.append(lang);
    });
    languageControl.append(languageButton, langs);

    controls.append(themeControl, languageControl);
    bar.append(brand, controls);
    return bar;
  }

  function footer() {
    const el = document.createElement("footer");
    el.className = "site-footer";
    el.textContent = text("disclaimer");
    return el;
  }

  function pageFrame(content) {
    document.body.replaceChildren(topbar(), screen, footer());
    screen.replaceChildren(content);
  }

  function home() {
    reset();
    const content = document.createElement("section");
    content.className = "center";
    content.append(sacredBlock("mantra"), button(text("actions.begin"), () => location.href = pageUrl("reflect")));
    pageFrame(content);
  }

  function sacredBlock(key) {
    const wrap = document.createElement("div");
    const original = languages.sa.sacred[key];
    const chosen = text(`sacred.${key}`);
    wrap.append(block("mantra", original));
    if (language() !== "sa" && chosen !== original) wrap.append(block("mantra chosen", chosen));
    return wrap;
  }

  function reflect() {
    clearTimeout(reflectTimer);
    const content = document.createElement("section");
    content.className = "center";
    const verse = document.createElement("div");
    verse.append(session.holdReady ? block("mantra", text("messages.hold")) : sacredBlock("purification"));
    const pulse = document.createElement("i");
    pulse.className = "pulse";
    const receive = button(text("actions.receive"), () => location.href = pageUrl("passage"), "text-button reveal");
    if (session.receiveReady) receive.classList.add("show");
    content.append(verse, pulse, receive);
    pageFrame(content);

    if (session.receiveReady) return;
    if (session.holdReady) {
      reflectTimer = setTimeout(() => {
        saveSession({ ...session, receiveReady: true });
        receive.classList.add("show");
      }, HOLD_MS);
      return;
    }

    reflectTimer = setTimeout(() => {
      saveSession({ ...session, holdReady: true });
      verse.replaceChildren(block("mantra", text("messages.hold")));
      reflect();
    }, WAIT_MS);
  }

  function ref(verses) {
    const first = verses[0];
    const last = verses[verses.length - 1];
    return `${text("reference")} ${first.chapter}.${first.verse}-${last.chapter}.${last.verse}`;
  }

  function passageFor(data, main) {
    const chapter = data.filter((verse) => verse.chapter === main.chapter);
    const i = chapter.findIndex((verse) => verse.id === main.id);
    if (i < 1) return chapter.slice(0, 3);
    if (i > chapter.length - 2) return chapter.slice(-3);
    return chapter.slice(i - 1, i + 2);
  }

  async function makeSession() {
    if (session.passages?.length === COUNT) return session;
    const data = await fetch(`${root}data/verses.json`).then((response) => response.json());
    const pool = [...data];
    const passages = [];

    while (passages.length < COUNT && pool.length) {
      const main = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const verses = passageFor(data, main);
      passages.push({ mainId: main.id, verses });
    }

    saveSession({ index: 0, passages });
    return session;
  }

  function line(verse, mainId, className, value) {
    const el = block(className, value);
    if (verse.id === mainId) el.classList.add("main");
    return el;
  }

  function renderCard(entry, translations) {
    const card = document.createElement("article");
    const sanskrit = document.createElement("div");
    card.className = "passage-card";
    sanskrit.className = "sanskrit-set";

    entry.verses.forEach((verse) => {
      sanskrit.append(line(verse, entry.mainId, "verse-text sanskrit-line", verse.sanskrit));
    });

    card.append(block("ref", ref(entry.verses)), sanskrit);
    if (translations) {
      const translation = document.createElement("div");
      translation.className = "translation-set";
      entry.verses.forEach((verse) => {
        translation.append(line(verse, entry.mainId, "verse-text translation-line", translations[verse.id]));
      });
      card.append(translation);
    }
    return card;
  }

  async function passage() {
    const data = await makeSession();
    const translations = await i18n.loadTranslations(language());
    const entry = data.passages[data.index || 0];
    const content = document.createElement("section");
    const nav = document.createElement("nav");
    const actions = document.createElement("div");
    const status = block("save-status", "");
    const list = document.createElement("div");
    const index = data.index || 0;
    const count = block("ref page-count", `${index + 1}/${data.passages.length}`);
    const prev = button("←", () => move(-1), "arrow");
    const next = button("→", () => move(1), "arrow");
    prev.disabled = index === 0;

    nav.className = "pager";
    actions.className = "card-actions";
    actions.append(button(text("actions.save"), () => save(entry, status, translations), "text-button"));
    nav.append(prev, actions, next);
    list.className = "passage";
    list.append(renderCard(entry, translations));
    content.append(count, list, nav, status);
    pageFrame(content);
  }

  function move(step) {
    if (!session.passages?.length) return;
    if ((session.index || 0) === session.passages.length - 1 && step > 0) {
      location.href = pageUrl("wait");
      return;
    }
    const next = Math.max(0, Math.min((session.index || 0) + step, session.passages.length - 1));
    saveSession({ ...session, index: next });
    passage();
  }

  function wait() {
    const content = document.createElement("section");
    const actions = document.createElement("div");
    const status = block("save-status", "");
    content.className = "center wait-screen";
    actions.className = "card-actions";
    actions.append(
      button(text("actions.back"), () => location.href = pageUrl("passage"), "text-button"),
      button(text("actions.saveAll"), () => saveAll(status), "text-button save-all"),
    );
    content.append(block("wait-note", text("messages.wait")), block("muted ponder-line", text("messages.ponder")), actions, status);
    pageFrame(content);
  }

  async function save(entry, status, translations) {
    const ok = await download(entry, translations);
    status.textContent = text(ok ? "actions.saved" : "actions.saveError");
  }

  async function saveAll(status) {
    const translations = await i18n.loadTranslations(language());
    await document.fonts?.ready;
    const passages = session.passages || [];
    let ok = passages.length > 0;
    for (let i = 0; i < passages.length; i++) {
      const success = await downloadCanvas(cardCanvas(passages[i], translations), passageFileName(passages[i]));
      if (!success) ok = false;
      if (i < passages.length - 1) await new Promise((r) => setTimeout(r, 300));
    }
    status.textContent = text(ok ? "actions.saved" : "actions.saveError");
  }

  async function download(entry, translations) {
    await document.fonts?.ready;
    return downloadCanvas(cardCanvas(entry, translations), passageFileName(entry));
  }

  function downloadCanvas(canvas, filename) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(false);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve(true);
      }, "image/png");
    });
  }

  function passageFileName(entry) {
    const first = entry.verses[0].id;
    const last = entry.verses[entry.verses.length - 1].id;
    return `ask-krishna-${first}-${last}.png`;
  }

  function colors() {
    const styles = getComputedStyle(document.documentElement);
    return {
      bg: styles.getPropertyValue("--bg").trim(),
      surface: styles.getPropertyValue("--surface").trim(),
      text: styles.getPropertyValue("--text").trim(),
      muted: styles.getPropertyValue("--muted").trim(),
      subtle: styles.getPropertyValue("--subtle").trim(),
    };
  }

  function cardCanvas(entry, translations) {
    const palette = colors();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const plan = cardPlan(ctx, entry, 0, translations);
    sizeCanvas(canvas, ctx, CARD_WIDTH, plan.height);
    drawCard(ctx, plan, palette);
    return canvas;
  }

  function sizeCanvas(canvas, ctx, width, height) {
    const scale = Math.min(window.devicePixelRatio || 1, height > 7000 ? 1 : 2);
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(scale, scale);
  }

  function cardPlan(ctx, entry, offsetY, translations) {
    const padding = 74;
    const width = CARD_WIDTH;
    const max = width - padding * 2;
    const rows = [
      row(ctx, "ref", ref(entry.verses), max),
      { gap: 48 },
      ...entry.verses.map((verse) => row(ctx, "sanskrit", verse.sanskrit, max, verse.id === entry.mainId)),
    ];
    if (translations) {
      rows.push({ divider: true, gap: 36 });
      entry.verses.forEach((verse) => {
        rows.push(row(ctx, "translation", translations[verse.id], max, verse.id === entry.mainId));
      });
    }
    const bodyHeight = rows.reduce((sum, item) => sum + (item.height || 0) + (item.gap || 22), 0);
    return { entry, offsetY, padding, rows, width, height: Math.ceil(bodyHeight + padding * 2 - 22) };
  }

  function row(ctx, kind, value, max, main = false) {
    const style = rowStyle(kind);
    ctx.font = style.font;
    const lines = wrap(ctx, value, max);
    const inset = main ? 24 : 0;
    return { kind, lines, main, ...style, height: lines.length * style.lineHeight + inset * 2 };
  }

  function rowStyle(kind) {
    if (kind === "ref") return { font: font(24), lineHeight: 34, color: "muted" };
    if (kind === "sanskrit") return { font: font(34), lineHeight: 58, color: "muted" };
    return { font: font(43), lineHeight: 66, color: "text" };
  }

  function font(size, weight = "400") {
    return `${weight} ${size}px Georgia, "Noto Serif Devanagari", "Nirmala UI", serif`;
  }

  function wrap(ctx, value, max) {
    return String(value || "").split("\n").flatMap((part) => {
      const segments = part.match(/\S+\s*/g);
      if (!segments) return [""];
      return segments.reduce((lines, segment) => {
        const last = lines[lines.length - 1] || "";
        const next = last + segment;
        if (!last || ctx.measureText(next.trimEnd()).width <= max) lines[lines.length - 1] = next;
        else lines.push(segment);
        return lines;
      }, [""]).map((entry) => entry.trimEnd());
    });
  }

  function drawCard(ctx, plan, palette) {
    ctx.beginPath();
    ctx.roundRect(0.5, plan.offsetY + 0.5, plan.width - 1, plan.height - 1, 18);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.strokeStyle = palette.subtle;
    ctx.lineWidth = 1;
    ctx.stroke();
    let y = plan.offsetY + plan.padding;
    plan.rows.forEach((item) => {
      if (item.divider) {
        strokeLine(ctx, palette.subtle, plan.padding, y + 0.5, plan.width - plan.padding, y + 0.5);
        y += item.gap;
        return;
      }
      if (item.gap) {
        y += item.gap;
        return;
      }
      drawRow(ctx, item, plan, y, palette);
      y += item.height + 22;
    });
  }

  function drawRow(ctx, item, plan, y, palette) {
    const max = plan.width - plan.padding * 2;
    const color = palette[item.color];
    const x = plan.width / 2;
    let textY = y;
    ctx.font = item.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = color;
    if (item.main) {
      strokeLine(ctx, palette.subtle, plan.padding, y + 0.5, plan.width - plan.padding, y + 0.5);
      strokeLine(ctx, palette.subtle, plan.padding, y + item.height + 0.5, plan.width - plan.padding, y + item.height + 0.5);
      textY += 24;
    }
    item.lines.forEach((part) => {
      ctx.fillText(part, x, textY, max);
      textY += item.lineHeight;
    });
  }

  function fill(ctx, color, x, y, width, height) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  function stroke(ctx, color, x, y, width, height) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  }

  function strokeLine(ctx, color, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function render() {
    setTheme(localStorage.getItem(THEME), false);
    document.documentElement.lang = manifest[language()].htmlLang;
    const label = text(`pageLabels.${page}`);
    document.title = label ? `${label} - ${text("appName")}` : text("appName");
    if (page !== "index" && isReload()) return goHome();
    if (page === "index") return home();
    if (page === "reflect") return reflect();
    if (page === "passage") return passage();
    if (page === "wait") return wait();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && page === "index" && !event.target.closest("button,a")) location.href = pageUrl("reflect");
    if (event.key === "Enter" && page === "reflect" && session.receiveReady && !event.target.closest("button,a")) location.href = pageUrl("passage");
    if (event.key === "ArrowLeft" && page === "passage") move(-1);
    if (event.key === "ArrowRight" && page === "passage") move(1);
  });

  await i18n.loadLanguage(i18n.defaultLanguage);
  await i18n.loadLanguage("sa");
  const chosen = language();
  if (chosen !== i18n.defaultLanguage && chosen !== "sa") {
    try { await i18n.loadLanguage(chosen); } catch (_error) { /* keep default */ }
  }
  render();
})();
