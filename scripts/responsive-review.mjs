#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.SCREENSHOT_BASE || "http://127.0.0.1:8000";
const OUT = process.env.SCREENSHOT_OUT || "/opt/cursor/artifacts/responsive-before";

const VIEWPORTS = [
  { w: 360, h: 640, dpr: 2, mobile: true },
  { w: 390, h: 844, dpr: 2, mobile: true },
  { w: 430, h: 932, dpr: 2, mobile: true },
  { w: 640, h: 360, dpr: 2, mobile: true },
  { w: 844, h: 390, dpr: 2, mobile: true },
  { w: 768, h: 1024, dpr: 2, mobile: true },
  { w: 1024, h: 768, dpr: 2, mobile: false },
  { w: 1280, h: 800, dpr: 1, mobile: false },
  { w: 1440, h: 900, dpr: 1, mobile: false },
  { w: 1920, h: 1080, dpr: 1, mobile: false },
  { w: 2560, h: 1440, dpr: 1, mobile: false },
];

const PAGES = [
  { id: "home", path: "/" },
  { id: "read", path: "/pages/read.html#2.47" },
  { id: "chapter-2", path: "/pages/chapter-2.html" },
  { id: "verse-2-47", path: "/pages/verse-2-47.html" },
  { id: "verse-11-55", path: "/pages/verse-11-55.html" },
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

async function prepRead247(page) {
  await page.goto(`${BASE}/pages/read.html#2.47`);
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
  await page.waitForFunction(async () => {
    const AK = window.ASK_KRISHNA;
    if (!AK?.readScreens) return false;
    await AK.i18n.loadLanguage("en");
    if (!AK.verseData?.length) {
      const data = await fetch(`${AK.root}data/verses.json`).then((r) => r.json());
      AK.verseData = data;
    }
    if (AK.readPhase !== "read" || AK.readFocalId !== "2.47") {
      AK.saveReadPurify({ rememberReady: true, readReady: true });
      AK.setReadFocal("2.47");
    }
    return !!document.querySelector(".passage-card");
  }, { timeout: 15000 });
}

async function captureStaticChapter(context, vp, shot) {
  const page = await context.newPage();
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: join(OUT, `${shot.id}__${slug(vp)}.png`) });
  await page.close();
}

const browser = await chromium.launch({ headless: true });
await mkdir(OUT, { recursive: true });

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  const staticContext = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    javaScriptEnabled: false,
  });

  const page = await context.newPage();
  for (const shot of PAGES) {
    if (shot.id === "chapter-2" || shot.id === "verse-11-55") {
      await captureStaticChapter(staticContext, vp, shot);
      continue;
    }
    if (shot.id === "verse-2-47") {
      await prepRead247(page);
      await page.goto(`${BASE}/pages/verse-2-47.html`, { waitUntil: "networkidle" });
      await page.waitForFunction(async () => {
        const AK = window.ASK_KRISHNA;
        if (!AK?.setReadFocal) return !!document.querySelector(".passage-card");
        if (!AK.verseData?.length) {
          const data = await fetch(`${AK.root}data/verses.json`).then((r) => r.json());
          AK.verseData = data;
        }
        if (AK.readFocalId !== "2.47") AK.setReadFocal("2.47");
        return !!document.querySelector(".passage-card");
      }, { timeout: 15000 });
      await page.screenshot({ path: join(OUT, `${shot.id}__${slug(vp)}.png`) });
      continue;
    }
    if (shot.id === "home") await prepHome(page);
    else if (shot.id === "read") await prepRead247(page);
    await page.screenshot({ path: join(OUT, `${shot.id}__${slug(vp)}.png`) });
  }
  await page.close();
  await context.close();
  await staticContext.close();
}

await browser.close();
console.log("Saved to", OUT);
