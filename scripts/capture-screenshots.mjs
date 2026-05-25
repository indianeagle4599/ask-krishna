import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "fs/promises";

const BASE = process.env.SCREENSHOT_BASE || "http://localhost:8000";
const OUT = "assets/screenshots";
const PLAN_PATH = `${OUT}/capture-plan.json`;
const VIEWPORT = { width: 1280, height: 960 };

const THEMES = ["vedic-light", "vedic-dark", "modern-light", "modern-dark"];
const LANGUAGES = ["en", "hi", "sa"];
const DEFAULTS = { theme: "vedic-light", language: "en" };

const THEME_LABELS = {
  "vedic-light": "Vedic Light",
  "vedic-dark": "Vedic Dark",
  "modern-light": "Modern Light",
  "modern-dark": "Modern Dark",
};

const LANGUAGE_LABELS = {
  en: "English",
  hi: "Hindi",
  sa: "Sanskrit UI",
};

const ASSIGNABLE = [
  "home",
  "purification",
  "reflect",
  "passage",
  "wait",
  "example-save",
  "read-index",
  "read-reader",
  "read-marked-verse",
  "read-marks",
  "read-save",
];

function shuffle(items) {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

async function loadPlan() {
  try {
    const plan = JSON.parse(await readFile(PLAN_PATH, "utf8"));
    if (!plan.pages["read-save"]) {
      plan.pages["read-save"] = { ...plan.defaults };
      await writeFile(PLAN_PATH, `${JSON.stringify(plan, null, 2)}\n`);
    }
    return plan;
  } catch (_error) {
    const pages = shuffle(ASSIGNABLE);
    const themeTargets = pages.slice(0, THEMES.length);
    const languageTargets = shuffle(ASSIGNABLE).slice(0, LANGUAGES.length);
    const plan = {
      defaults: DEFAULTS,
      pages: Object.fromEntries(ASSIGNABLE.map((name) => [name, { ...DEFAULTS }])),
      themePages: Object.fromEntries(THEMES.map((theme, index) => [theme, themeTargets[index]])),
      languagePages: Object.fromEntries(LANGUAGES.map((language, index) => [language, languageTargets[index]])),
    };

    THEMES.forEach((theme) => {
      plan.pages[plan.themePages[theme]].theme = theme;
    });
    LANGUAGES.forEach((language) => {
      plan.pages[plan.languagePages[language]].language = language;
    });

    await mkdir(OUT, { recursive: true });
    await writeFile(PLAN_PATH, `${JSON.stringify(plan, null, 2)}\n`);
    return plan;
  }
}

function lookFor(plan, shot) {
  if (shot === "settings-theme" || shot === "settings-language") return plan.defaults;
  return plan.pages[shot] || plan.defaults;
}

function captionFor(plan, shot, title) {
  const look = lookFor(plan, shot);
  const parts = [title];
  const themeLabel = THEME_LABELS[look.theme];
  const languageLabel = LANGUAGE_LABELS[look.language];
  const themed = plan.themePages && Object.entries(plan.themePages).some(([theme, page]) => page === shot && theme === look.theme);
  const translated = plan.languagePages && Object.entries(plan.languagePages).some(([language, page]) => page === shot && language === look.language);
  const tags = [];
  if (themed) tags.push(themeLabel);
  if (translated) tags.push(languageLabel);
  if (tags.length) parts.push(tags.join(" · "));
  return parts.join(" · ");
}

async function shotViewport(page, name) {
  await page.screenshot({ path: `${OUT}/${name}` });
}

async function shotSaveCard(page, name, look, entryKind) {
  await applyLook(page, look);
  await page.evaluate(async ({ language, entryKind: kind }) => {
    const AK = window.ASK_KRISHNA;
    await document.fonts.ready;
    const translations = await AK.i18n.loadTranslations(language);
    const entry = kind === "passage"
      ? AK.session.passages[0]
      : (() => {
          const focal = AK.verseById(AK.readFocalId) || AK.verseData[0];
          return { mainId: focal.id, verses: [focal] };
        })();
    const canvas = AK.cardCanvas(entry, translations);
    canvas.id = "shot-canvas";
    document.body.replaceChildren(canvas);
  }, { language: look.language, entryKind });
  await page.locator("#shot-canvas").screenshot({ path: `${OUT}/${name}` });
}

async function applyLook(page, look) {
  await page.evaluate(async ({ theme, language }) => {
    const AK = window.ASK_KRISHNA;
    localStorage.setItem("askKrishna.theme", theme);
    localStorage.setItem("askKrishna.language", language);
    await AK.i18n.loadLanguage(language);
    AK.setTheme(theme, false);
    if (AK.render) AK.render();
  }, look);
}

async function prepReflect(page, look) {
  await page.goto(`${BASE}/`);
  await page.waitForSelector(".topbar");
  await page.evaluate(() => {
    localStorage.removeItem("askKrishna.session");
    localStorage.removeItem("askKrishna.readProgress");
    localStorage.removeItem("askKrishna.readBookmarks");
    sessionStorage.clear();
  });
  await applyLook(page, look);
}

async function openThemeMenu(page) {
  await page.getByRole("button", { name: "Theme" }).click();
  await page.waitForSelector(".setting.open .menu.swatches");
}

async function openLanguageMenu(page) {
  await page.getByRole("button", { name: "Language" }).click();
  await page.waitForSelector(".setting.open .menu.langs");
}

async function captureReflect(page, plan) {
  await prepReflect(page, lookFor(plan, "home"));
  await shotViewport(page, "home.png");

  await applyLook(page, plan.defaults);
  await openThemeMenu(page);
  await shotViewport(page, "settings-theme.png");
  await page.getByRole("button", { name: "Theme" }).click();

  await openLanguageMenu(page);
  await shotViewport(page, "settings-language.png");
  await page.getByRole("button", { name: "Language" }).click();

  await applyLook(page, lookFor(plan, "purification"));
  await page.evaluate(() => {
    window.ASK_KRISHNA.session = {};
    window.ASK_KRISHNA.go("reflect");
  });
  await page.waitForSelector(".center .pulse");
  await shotViewport(page, "purification.png");

  await applyLook(page, lookFor(plan, "reflect"));
  await page.evaluate(() => {
    window.ASK_KRISHNA.saveSession({ holdReady: true, receiveReady: true });
    window.ASK_KRISHNA.go("reflect");
  });
  await page.waitForSelector(".center .reveal.show");
  await shotViewport(page, "reflect.png");

  await applyLook(page, lookFor(plan, "passage"));
  await page.evaluate(async () => {
    const AK = window.ASK_KRISHNA;
    const data = await fetch(`${AK.root}data/verses.json`).then((response) => response.json());
    const pick = (id) => data.find((verse) => verse.id === id);
    const triad = { mainId: "2.47", verses: [pick("2.46"), pick("2.47"), pick("2.48")].filter(Boolean) };
    AK.saveSession({ index: 0, passages: Array.from({ length: 5 }, () => triad) });
    AK.go("passage");
  });
  await page.waitForSelector(".passage-card.triad");
  await page.locator(".pager").scrollIntoViewIfNeeded();
  await shotViewport(page, "passage.png");

  await applyLook(page, lookFor(plan, "wait"));
  await page.evaluate(() => {
    window.ASK_KRISHNA.go("wait");
  });
  await page.waitForSelector(".wait-screen");
  await shotViewport(page, "wait.png");

  const saveLook = lookFor(plan, "example-save");
  await shotSaveCard(page, "example-save.png", saveLook, "passage");
}

async function captureRead(page, plan) {
  await page.goto(`${BASE}/pages/read.html`);
  await page.waitForSelector(".topbar");

  async function bootRead(look) {
    await page.evaluate(({ look: nextLook }) => {
      history.replaceState(null, "", `${location.pathname}${location.search}`);
      localStorage.removeItem("askKrishna.readBookmarks");
      sessionStorage.setItem(
        "askKrishna.readPurify",
        JSON.stringify({ rememberReady: true, readReady: true }),
      );
      window.__readBooted = true;
      window.ASK_KRISHNA.readFocalId = "";
      window.ASK_KRISHNA.readPhase = "index";
    }, { look });
    await applyLook(page, look);
    await page.evaluate(() => {
      window.ASK_KRISHNA.readScreens();
    });
  }

  await bootRead(lookFor(plan, "read-index"));
  await page.waitForSelector(".index-picker");
  await shotViewport(page, "read-index.png");

  await bootRead(lookFor(plan, "read-reader"));
  await page.waitForSelector(".index-picker");
  await page.locator(".index-verse").first().click();
  await page.waitForSelector(".passage-card");
  await shotViewport(page, "read-reader.png");

  await bootRead(lookFor(plan, "read-marked-verse"));
  await page.waitForSelector(".index-picker");
  await page.locator(".index-verse").first().click();
  await page.waitForSelector(".passage-card");
  await page.locator(".bookmark-button").click();
  await page.waitForSelector('.bookmark-button[aria-pressed="true"]');
  await shotViewport(page, "read-marked-verse.png");

  await bootRead(lookFor(plan, "read-marks"));
  await page.waitForSelector(".index-picker");
  await page.locator(".index-verse").first().click();
  await page.waitForSelector(".passage-card");
  await page.locator(".bookmark-button").click();
  await page.locator(".index-button").click();
  await page.waitForSelector(".mark-links");
  await shotViewport(page, "read-marks.png");

  await bootRead(lookFor(plan, "read-save"));
  await page.waitForSelector(".index-picker");
  await page.locator(".index-verse").first().click();
  await page.waitForSelector(".passage-card");
  await shotSaveCard(page, "read-save.png", lookFor(plan, "read-save"), "verse");
}

async function run() {
  const plan = await loadPlan();
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });

  await captureReflect(page, plan);
  await captureRead(page, plan);

  await browser.close();
  console.log("Screenshots saved to", OUT, `(${VIEWPORT.width}x${VIEWPORT.height})`);
  console.log("Capture plan:", PLAN_PATH);
  console.log("Theme pages:", plan.themePages);
  console.log("Language pages:", plan.languagePages);
  console.log("Captions:");
  [
    ["home", "Start"],
    ["settings-theme", "Theme picker"],
    ["settings-language", "Language picker"],
    ["purification", "Purification"],
    ["reflect", "Hold"],
    ["passage", "Passage"],
    ["wait", "Wait"],
    ["example-save", "Saved PNG"],
    ["read-index", "Verse index"],
    ["read-reader", "Reader"],
    ["read-marked-verse", "Marked verse"],
    ["read-marks", "Index with marks"],
    ["read-save", "Saved PNG"],
  ].forEach(([shot, title]) => console.log(`- ${captionFor(plan, shot, title)}`));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
