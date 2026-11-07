#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

const BASE = process.env.SCREENSHOT_BASE || "http://127.0.0.1:8000";
const OUT = process.env.SCREENSHOT_OUT || "/opt/cursor/artifacts/responsive-after-v2";

const VIEWPORTS = [
  { w: 640, h: 360, dpr: 2, mobile: true },
  { w: 844, h: 390, dpr: 2, mobile: true },
  { w: 932, h: 430, dpr: 2, mobile: true },
  { w: 390, h: 844, dpr: 2, mobile: true },
  { w: 1280, h: 800, dpr: 1, mobile: false },
  { w: 1440, h: 900, dpr: 1, mobile: false },
  { w: 1920, h: 1080, dpr: 1, mobile: false },
  { w: 2560, h: 1440, dpr: 1, mobile: false },
];

const SHOTS = [
  { id: "home", prep: prepHome },
  { id: "purification", prep: prepPurification },
  { id: "read-2-47", prep: (p) => prepReadVerse(p, "2.47") },
  { id: "read-11-55", prep: (p) => prepReadVerse(p, "11.55") },
];

function slug(vp) {
  return `${vp.w}x${vp.h}`;
}

async function prepHome(page) {
  await page.goto(`${BASE}/`);
  await page.evaluate(() => {
    localStorage.setItem("askKrishna.theme", "vedic-light");
    localStorage.setItem("askKrishna.language", "en");
    localStorage.removeItem("askKrishna.session");
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".center button");
}

async function prepPurification(page) {
  await page.goto(`${BASE}/`);
  await page.evaluate(() => {
    localStorage.setItem("askKrishna.theme", "vedic-light");
    localStorage.setItem("askKrishna.language", "en");
    sessionStorage.clear();
    localStorage.removeItem("askKrishna.session");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => window.ASK_KRISHNA?.go);
  await page.evaluate(() => {
    window.ASK_KRISHNA.session = {};
    window.ASK_KRISHNA.go("reflect");
  });
  await page.waitForSelector(".center .pulse");
}

async function prepReadVerse(page, id) {
  await page.goto(`${BASE}/pages/read.html#${id}`);
  await page.evaluate(() => {
    localStorage.setItem("askKrishna.theme", "vedic-light");
    localStorage.setItem("askKrishna.language", "en");
    sessionStorage.setItem(
      "askKrishna.readPurify",
      JSON.stringify({ rememberReady: true, readReady: true }),
    );
    window.__readBooted = true;
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(
    async (verseId) => {
      const AK = window.ASK_KRISHNA;
      if (!AK?.setReadFocal) return false;
      await AK.i18n.loadLanguage("en");
      if (!AK.verseData?.length) {
        AK.verseData = await fetch(`${AK.root}data/verses.json`).then((r) => r.json());
      }
      if (AK.readFocalId !== verseId) AK.setReadFocal(verseId);
      return !!document.querySelector(".passage-card .sanskrit-line");
    },
    id,
    { timeout: 20000 },
  );
}

async function measureFonts(page, shot) {
  return page.evaluate((which) => {
    const px = (el) => (el ? getComputedStyle(el).fontSize : null);
    if (which === "home") {
      return {
        mantra: px(document.querySelector(".center .mantra")),
        chosen: px(document.querySelector(".center .chosen")),
        footer: px(document.querySelector(".site-footer")),
        beginBottom: document.querySelector(".center button")?.getBoundingClientRect().bottom,
        viewportH: window.innerHeight,
        scrollH: document.documentElement.scrollHeight,
      };
    }
    if (which === "purification") {
      return {
        mantra: px(document.querySelector(".center .mantra")),
        footer: px(document.querySelector(".site-footer")),
        viewportH: window.innerHeight,
        scrollH: document.documentElement.scrollHeight,
      };
    }
    const card = document.querySelector(".passage-card");
    return {
      sanskrit: px(card?.querySelector(".sanskrit-line")),
      english: px(card?.querySelector(".translation-line")),
      footer: px(document.querySelector(".site-footer")),
      viewportH: window.innerHeight,
      scrollH: document.documentElement.scrollHeight,
    };
  }, shot.id.startsWith("read") ? shot.id : shot.id);
}

const browser = await chromium.launch({ headless: true });
await mkdir(OUT, { recursive: true });
const measures = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  const page = await context.newPage();
  for (const shot of SHOTS) {
    await shot.prep(page);
    const name = `${shot.id}__${slug(vp)}.png`;
    await page.screenshot({ path: join(OUT, name) });
    const m = await measureFonts(page, shot);
    const beginOk =
      shot.id === "home"
        ? m.beginBottom <= m.viewportH && m.scrollH <= m.viewportH + 1
        : m.scrollH <= m.viewportH + 1;
    measures.push({ viewport: slug(vp), shot: shot.id, ...m, noScroll: beginOk });
  }
  await context.close();
}

await browser.close();

let mainCss = "";
try {
  mainCss = execSync("git show main:assets/styles.css", { cwd: join(import.meta.dirname, ".."), encoding: "utf8" });
} catch {
  mainCss = "";
}

const log = {
  capturedAt: new Date().toISOString(),
  outputDir: OUT,
  note: "main reference: translation-line clamp(1.2rem, 4.5vw, 1.65rem); sanskrit-line clamp(0.95rem, 3.4vw, 1.15rem)",
  mainCssSnippet: mainCss.includes("max-height: 31.25rem") ? "branch has short-height rules" : "main has no short-height rules",
  measures,
};

await writeFile(join(OUT, "font-sizes.json"), `${JSON.stringify(log, null, 2)}\n`);
console.log("Saved to", OUT);
console.log("Measures written to font-sizes.json");
