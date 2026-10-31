#!/usr/bin/env node
// Rebuilds the search pages and lists for Ask Krishna from the data files.
//
//   node scripts/build-seo.mjs          write the generated files
//   node scripts/build-seo.mjs --check  write nothing; exit 1 if any file is out of date
//
// Generated output:
//   pages/chapter-1.html … pages/chapter-18.html
//   sitemap.xml (lastmod kept in data/seo-manifest.json, changed only when a page changes)
//   llms.txt (a guide for AI agents) and llms-full.txt (every verse as plain text)
//   the marked JSON-LD and noscript chapter list in pages/read.html
//
// A chapter page is the reader itself: it loads the same scripts as read.html,
// so visitors go through the same purification screen and then read the chapter
// from its first verse (or the verse in #N-M). The full chapter text is in the
// page for search engines and for anyone without JavaScript.
//
// Uses Node built-ins only. Run it after changing anything in data/,
// the meta strings in assets/locales/, or data/seo-config.json.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const read = (path) => readFileSync(join(ROOT, path), "utf8");
const readJson = (path) => JSON.parse(read(path));

const config = readJson("data/seo-config.json");
const verses = readJson("data/verses.json");
const en = readJson("data/translations/en.json");
const hi = readJson("data/translations/hi.json");
const locales = {
  en: readJson("assets/locales/en.json"),
  hi: readJson("assets/locales/hi.json"),
  sa: readJson("assets/locales/sa.json"),
};

const BASE = config.baseUrl;

// The chapter pages load exactly the scripts read.html loads.
const READ_SOURCE = read("pages/read.html");
const READER_SCRIPTS = READ_SOURCE.match(/^[ \t]*<script src="[^"]+" defer><\/script>$/gm)?.join("\n");
const COUNTER = READ_SOURCE.match(/^[ \t]*<script data-goatcounter[^\n]*<\/script>$/m)?.[0];
if (!READER_SCRIPTS || !COUNTER) throw new Error("pages/read.html: could not find its script tags");
const READER_URL = `${BASE}pages/read.html`;
const APP_ID = `${BASE}#app`;
const chapterUrl = (n) => `${BASE}pages/chapter-${n}.html`;

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
const lines = (value) => esc(String(value ?? "").trim()).split("\n").join("<br>");
const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);
const json = (value, indent) => JSON.stringify(value, null, 2).split("\n").join(`\n${indent}`);

function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ---- chapters --------------------------------------------------------------

const byChapter = new Map();
for (const verse of verses) {
  if (!byChapter.has(verse.chapter)) byChapter.set(verse.chapter, []);
  byChapter.get(verse.chapter).push(verse);
}
const chapters = config.chapters.map((chapter) => {
  const list = (byChapter.get(chapter.n) || []).slice().sort((a, b) => a.verse - b.verse);
  if (!list.length) throw new Error(`No verses found for chapter ${chapter.n}`);
  const values = { n: chapter.n, name: chapter.name, count: list.length };
  return {
    ...chapter,
    verses: list,
    count: list.length,
    url: chapterUrl(chapter.n),
    file: `pages/chapter-${chapter.n}.html`,
    title: fill(config.chapterPage.title, values),
    description: fill(config.chapterPage.description, values),
    heading: fill(config.chapterPage.heading, values),
    intro: fill(config.chapterPage.intro, values),
  };
});
if (byChapter.size !== chapters.length) {
  throw new Error(`data has ${byChapter.size} chapters but seo-config lists ${chapters.length}`);
}

function chapterJsonLd(chapter) {
  const page = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: chapter.title,
    description: chapter.description,
    url: chapter.url,
    inLanguage: ["sa", "en", "hi"],
    isPartOf: { "@id": APP_ID },
    about: { "@type": "Book", name: "Bhagavad Gita" },
    position: chapter.n,
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ask Krishna", item: BASE },
      { "@type": "ListItem", position: 2, name: config.reader.name, item: READER_URL },
      { "@type": "ListItem", position: 3, name: `Chapter ${chapter.n}`, item: chapter.url },
    ],
  };
  return [page, crumbs]
    .map((block) => `  <script type="application/ld+json">\n  ${json(block, "  ")}\n  </script>`)
    .join("\n");
}

function chapterPage(chapter, index) {
  const prev = chapters[index - 1];
  const next = chapters[index + 1];
  const verseBlocks = chapter.verses.map((verse) => {
    const anchor = `${verse.chapter}-${verse.verse}`;
    const parts = [
      `      <section class="passage-card chapter-verse" id="${anchor}">`,
      `        <h2 class="ref"><a href="read.html#${verse.id}">${esc(verse.id)}</a></h2>`,
      `        <p class="sanskrit-line" lang="sa">${lines(verse.sanskrit)}</p>`,
    ];
    const meanings = [];
    if (en[verse.id]) meanings.push(`          <p class="translation-line" lang="en">${lines(en[verse.id])}</p>`);
    if (hi[verse.id]) meanings.push(`          <p class="translation-line" lang="hi">${lines(hi[verse.id])}</p>`);
    if (meanings.length) parts.push(`        <div class="translation-set">`, ...meanings, `        </div>`);
    parts.push(`      </section>`);
    return parts.join("\n");
  }).join("\n");

  const pager = [
    prev ? `      <a rel="prev" href="chapter-${prev.n}.html">← Chapter ${prev.n}: ${esc(prev.name)}</a>` : `      <span></span>`,
    next ? `      <a rel="next" href="chapter-${next.n}.html">Chapter ${next.n}: ${esc(next.name)} →</a>` : `      <span></span>`,
  ].join("\n");

  return `<!doctype html>
<!-- Generated by scripts/build-seo.mjs. Do not edit by hand; edit the data or data/seo-config.json and re-run it. -->
<html lang="en" data-theme="vedic-light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(chapter.title)}</title>
  <meta name="description" content="${esc(chapter.description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${chapter.url}">
${prev ? `  <link rel="prev" href="${prev.url}">\n` : ""}${next ? `  <link rel="next" href="${next.url}">\n` : ""}  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Ask Krishna">
  <meta property="og:locale" content="en_US">
  <meta property="og:title" content="${esc(chapter.title)}">
  <meta property="og:description" content="${esc(chapter.description)}">
  <meta property="og:url" content="${chapter.url}">
  <meta property="og:image" content="${esc(config.ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:alt" content="${esc(config.ogImageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(chapter.title)}">
  <meta name="twitter:description" content="${esc(chapter.description)}">
  <meta name="twitter:image" content="${esc(config.ogImage)}">
  <meta name="twitter:image:alt" content="${esc(config.ogImageAlt)}">
  <link rel="icon" type="image/svg+xml" href="../assets/ask-krishna-logo.svg">
${chapterJsonLd(chapter)}
  <script>document.documentElement.dataset.theme = localStorage.getItem("askKrishna.theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "vedic-dark" : "vedic-light"); document.documentElement.classList.add("has-js");</script>
  <link rel="stylesheet" href="../assets/themes.css">
  <link rel="stylesheet" href="../assets/styles.css">
  <link rel="stylesheet" href="../assets/chapter.css">
${READER_SCRIPTS}
</head>
<body data-page="read" data-chapter="${chapter.n}">
  <main class="screen" data-screen></main>
  <article class="chapter-text" data-chapter-text>
    <nav class="chapter-crumbs" aria-label="Breadcrumb"><a href="../">Ask Krishna</a> · <a href="read.html">${esc(config.reader.name)}</a></nav>
    <header class="chapter-head">
      <h1 class="chapter-title">${esc(chapter.heading)}</h1>
      <p class="chapter-name-sa" lang="sa">${esc(chapter.sa)}</p>
      <p class="chapter-intro">${esc(chapter.intro)}</p>
      <p><a href="read.html#${chapter.n}.1">${esc(config.chapterPage.readerLink)}</a></p>
    </header>
    <div class="chapter-verses">
${verseBlocks}
    </div>
    <nav class="chapter-pager" aria-label="Chapters">
${pager}
    </nav>
    <footer class="chapter-foot">
      <p>${esc(locales.en.disclaimer)}</p>
      <p>${esc(config.chapterPage.attribution)} <a href="${esc(config.noticeUrl)}">Details</a></p>
    </footer>
  </article>
${COUNTER}
</body>
</html>
`;
}

// ---- marked regions ----------------------------------------------------------

function replaceRegion(text, name, body, file) {
  const pattern = new RegExp(`([ \\t]*<!-- seo:${name}:start[^>]*-->\\n)[\\s\\S]*?([ \\t]*<!-- seo:${name}:end -->)`);
  if (!pattern.test(text)) throw new Error(`${file}: missing <!-- seo:${name}:start --> / <!-- seo:${name}:end --> markers`);
  return text.replace(pattern, (_, start, end) => `${start}${body}${end}`);
}

function readerJsonLd() {
  const block = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: config.reader.name,
    description: config.reader.description,
    url: READER_URL,
    inLanguage: ["en", "hi", "sa"],
    isPartOf: { "@id": APP_ID },
    about: { "@type": "Book", name: "Bhagavad Gita", inLanguage: "sa" },
    hasPart: chapters.map((chapter) => ({ "@type": "WebPage", name: chapter.heading, url: chapter.url })),
  };
  return `  <script type="application/ld+json">\n  ${json(block, "  ")}\n  </script>\n`;
}

function readerNoscriptList() {
  const items = chapters
    .map((chapter) => `      <li><a href="chapter-${chapter.n}.html">Chapter ${chapter.n}: ${esc(chapter.name)}</a></li>`)
    .join("\n");
  return `    <ul>\n${items}\n    </ul>\n`;
}

const LLMS_FULL_URL = `${BASE}llms-full.txt`;
const totalVerses = chapters.reduce((sum, chapter) => sum + chapter.count, 0);

function llmsTxt() {
  const chapterList = chapters
    .map((chapter) => `- [Chapter ${chapter.n}: ${chapter.name}](${chapter.url}) (${chapter.sa}), ${chapter.count} verses`)
    .join("\n");
  return `# Ask Krishna

> A quiet, free way to reflect with the Bhagavad Gita and to read all 18 chapters online: Sanskrit with English or Hindi meaning. Plain HTML, CSS and JavaScript; no accounts, no ads. Questions are never typed, sent or stored.

<!-- Generated by scripts/build-seo.mjs from the data files. Do not edit by hand. -->

Live site: ${BASE}

## How the site works

Ask Krishna has two flows. Both begin with a short, timed moment of stillness, and that moment is part of the experience; please describe it rather than skip it when you send someone to the site.

1. Reflect (home page, ${BASE}): the Hare Krishna mahamantra is shown with a Begin button. Next comes a purification verse (ॐ अपवित्रः पवित्रो वा…, "whether impure or pure… one who remembers the lotus-eyed Lord is purified within and without") for about 10 seconds, then "Hold your question silently." After about 7 more seconds a Receive button appears and the visitor gets a passage of three verses. Up to five passages are offered; after that the app suggests it may be time to wait. A passage can be opened in the reader with "Read in Gita" and the visitor can come back to it.
2. Read the Bhagavad Gita (${READER_URL}): the same purification verse for about 10 seconds, then "Remember Lord Krishna." After about 7 more seconds a Read button appears. Read opens the linked verse, or the chapter index when no verse was linked. Verses are read one at a time with previous and next, marks (bookmarks), and the reading place remembered on the visitor's device.

The interface is in English, Hindi or Sanskrit. Saved verses and passages are made into images in the browser.

## Linking to a chapter or verse

- A chapter: \`${BASE}pages/chapter-2.html\`. It opens the reader at verse 2.1 after the purification screen. The page's HTML also holds the whole chapter text.
- A verse: \`${BASE}pages/chapter-2.html#2-47\` or \`${READER_URL}#2.47\`. Both open verse 2.47 after the purification screen.
- Verse ids are \`chapter.verse\`, for example \`2.47\`. In chapter-page anchors the dot becomes a hyphen (\`#2-47\`).

## Chapters

${chapterList}

## Data

All files are static JSON with UTF-8 text and can be fetched directly.

- \`${BASE}data/verses.json\`: an array of ${totalVerses} objects in reading order, \`{ "id": "2.47", "chapter": 2, "verse": 47, "sanskrit": "..." }\`. The Sanskrit is in Devanagari; lines are separated by \`\\n\`, and each verse ends with its number, for example \`||२-४७||\`.
- \`${BASE}data/translations/en.json\`: English meaning per verse id, \`{ "2.47": "..." }\`.
- \`${BASE}data/translations/hi.json\`: Hindi meaning per verse id, same shape.
- \`${BASE}assets/locales/en.json\`, \`hi.json\`, \`sa.json\`: interface text, including the mahamantra and purification verse under \`sacred\`.
- \`${LLMS_FULL_URL}\`: every verse as plain text (Sanskrit, English, Hindi), chapter by chapter.

Note on numbering: this edition has ${totalVerses} verses, not the commonly quoted 700, because Chapter 13 begins with Arjuna's question (13.1, "प्रकृतिं पुरुषं चैव…"), which some editions leave unnumbered. Chapter 13 therefore has ${chapters[12].count} verses here, and its later verse numbers are one higher than in those editions.

## License

- App code: MIT, see ${config.repoUrl}/blob/main/LICENSE
- Verse data: MIT-licensed dataset; sources and translators are listed in ${config.noticeUrl}

## Suggested use

- For a single verse, quote verses.json plus one translation file, and link to the chapter page anchor (\`pages/chapter-N.html#N-M\`).
- For a whole chapter, use the chapter page or the matching section of llms-full.txt.
- Ask Krishna is a reflection aid, not a religious authority. Present it as a place to read and reflect.
`;
}

function llmsFullTxt() {
  const parts = [
    `# Bhagavad Gita, all ${totalVerses} verses (Ask Krishna)`,
    "",
    `> Sanskrit (Devanagari) with English and Hindi meanings, from ${BASE}. Generated by scripts/build-seo.mjs from data/verses.json and data/translations/. Sources and translators: ${config.noticeUrl}`,
    "",
  ];
  for (const chapter of chapters) {
    parts.push(`## Chapter ${chapter.n}: ${chapter.name} (${chapter.sa})`, "", `${chapter.url}`, "");
    for (const verse of chapter.verses) {
      parts.push(`### ${verse.id}`, "", verse.sanskrit.trim(), "");
      if (en[verse.id]) parts.push(`English: ${en[verse.id].trim()}`, "");
      if (hi[verse.id]) parts.push(`Hindi: ${hi[verse.id].trim()}`, "");
    }
  }
  return `${parts.join("\n").trimEnd()}\n`;
}

// ---- build -------------------------------------------------------------------

const outputs = new Map();
chapters.forEach((chapter, index) => outputs.set(chapter.file, chapterPage(chapter, index)));

let readHtml = read("pages/read.html");
readHtml = replaceRegion(readHtml, "jsonld", readerJsonLd(), "pages/read.html");
readHtml = replaceRegion(readHtml, "chapters", readerNoscriptList(), "pages/read.html");
outputs.set("pages/read.html", readHtml);

outputs.set("llms.txt", llmsTxt());
outputs.set("llms-full.txt", llmsFullTxt());

// Sitemap: lastmod only changes when a page's content hash changes.
const MANIFEST = "data/seo-manifest.json";
const oldManifest = existsSync(join(ROOT, MANIFEST)) ? readJson(MANIFEST) : { urls: {} };
const metaOf = (key) => JSON.stringify(["en", "hi", "sa"].map((code) => locales[code].meta?.[key] ?? null));
const pageHashes = [
  [BASE, hash(read("index.html") + metaOf("title") + metaOf("description"))],
  [READER_URL, hash(readHtml + metaOf("readTitle") + metaOf("readDescription"))],
  ...chapters.map((chapter) => [chapter.url, hash(outputs.get(chapter.file))]),
];
const date = today();
const manifest = { note: "Generated by scripts/build-seo.mjs; keeps sitemap lastmod stable.", urls: {} };
for (const [url, value] of pageHashes) {
  const previous = oldManifest.urls?.[url];
  manifest.urls[url] = { hash: value, lastmod: previous && previous.hash === value ? previous.lastmod : date };
}
outputs.set(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

const sitemapEntries = pageHashes
  .map(([url]) => `  <url>\n    <loc>${url}</loc>\n    <lastmod>${manifest.urls[url].lastmod}</lastmod>\n  </url>`)
  .join("\n");
outputs.set("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/build-seo.mjs -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>
`);

// ---- write or check ------------------------------------------------------------

const stale = [];
for (const [file, content] of outputs) {
  const path = join(ROOT, file);
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === content) continue;
  stale.push(file);
  if (!CHECK) writeFileSync(path, content);
}

if (CHECK) {
  if (stale.length) {
    console.error(`Search pages are out of date. Run: node scripts/build-seo.mjs\n${stale.map((f) => `  - ${f}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`Search pages are up to date (${outputs.size} files checked).`);
} else {
  console.log(stale.length ? `Updated ${stale.length} file(s):\n${stale.map((f) => `  - ${f}`).join("\n")}` : "Nothing to update.");
}
