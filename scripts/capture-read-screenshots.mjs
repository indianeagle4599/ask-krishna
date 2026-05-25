import { chromium } from "playwright";
import { mkdir } from "fs/promises";

const BASE = "http://localhost:8000";
const OUT = "assets/screenshots";

async function skipPurify(page) {
  await page.goto(`${BASE}/pages/read.html`);
  await page.waitForSelector(".brand");
  await page.evaluate(() => {
    sessionStorage.setItem(
      "askKrishna.readPurify",
      JSON.stringify({ rememberReady: true, readReady: true }),
    );
    window.ASK_KRISHNA.readPhase = "index";
    window.ASK_KRISHNA.readScreens();
  });
  await page.waitForSelector(".index-picker");
}

async function openReader(page) {
  await skipPurify(page);
  await page.locator(".index-verse").first().click();
  await page.waitForSelector(".passage-card");
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 820 } });

  await openReader(page);
  await page.screenshot({ path: `${OUT}/read-reader.png` });

  await page.locator(".index-button").click();
  await page.waitForSelector(".index-picker");
  await page.screenshot({ path: `${OUT}/read-index.png` });

  await page.locator(".index-verse").first().click();
  await page.waitForSelector(".passage-card");
  await page.locator(".bookmark-button").click();
  await page.waitForSelector('.bookmark-button[aria-pressed="true"]');
  await page.screenshot({ path: `${OUT}/read-marked-verse.png` });

  await page.locator(".index-button").click();
  await page.waitForSelector(".mark-links");
  await page.screenshot({ path: `${OUT}/read-marks.png` });

  await browser.close();
  console.log("Screenshots saved to", OUT);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
