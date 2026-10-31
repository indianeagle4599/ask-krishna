#!/usr/bin/env node
// Rebuilds the search pages and lists for Ask Krishna from the data files.
//
//   node scripts/build-seo.mjs          write the generated files
//   node scripts/build-seo.mjs --check  write nothing; exit 1 if any file is out of date
//
// Generated output:
//   pages/chapter-1.html … pages/chapter-18.html
//   sitemap.xml (lastmod kept in data/seo-manifest.json, changed only when a page changes)
//   the marked chapter block in llms.txt
//   the marked JSON-LD and noscript chapter list in pages/read.html
//
// Uses Node built-ins only. Run it after changing anything in data/,
// the sacred or meta strings in assets/locales/, or data/seo-config.json.

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

function sacred(key) {
  const original = locales.sa.sacred?.[key] || "";
  const english = locales.en.sacred?.[key] || "";
  const out = [`      <p class="mantra" lang="sa">${lines(original)}</p>`];
  if (english && english !== original) out.push(`      <p class="mantra chosen" lang="en">${lines(english)}</p>`);
  return out.join("\n");
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
  <script>document.documentElement.dataset.theme = localStorage.getItem("askKrishna.theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "vedic-dark" : "vedic-light");</script>
  <link rel="stylesheet" href="../assets/themes.css">
  <link rel="stylesheet" href="../assets/styles.css">
  <link rel="stylesheet" href="../assets/chapter.css">
</head>
<body class="chapter-page" data-page="chapter">
  <header class="topbar">
    <a class="brand" href="../"><span class="brand-logo" aria-hidden="true"></span>Ask Krishna</a>
    <a class="chapter-crumb" href="read.html">${esc(config.reader.name)}</a>
  </header>
  <main class="screen chapter-screen">
    <section class="chapter-sacred">
${sacred("mantra")}
${sacred("purification")}
    </section>
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
  </main>
  <footer class="site-footer">
    <p>${esc(locales.en.disclaimer)}</p>
    <p>${esc(config.chapterPage.attribution)} <a href="${esc(config.noticeUrl)}">Details</a></p>
  </footer>
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

function llmsBlock() {
  const items = chapters
    .map((chapter) => `- Chapter ${chapter.n}, ${chapter.name} (${chapter.count} verses): ${chapter.url}`)
    .join("\n");
  return `## Chapter pages\n\nEach page has every verse of one chapter in Sanskrit with English and Hindi meanings. Verse anchors look like \`#2-47\`.\n\n${items}\n`;
}

// ---- build -------------------------------------------------------------------

const outputs = new Map();
chapters.forEach((chapter, index) => outputs.set(chapter.file, chapterPage(chapter, index)));

let readHtml = read("pages/read.html");
readHtml = replaceRegion(readHtml, "jsonld", readerJsonLd(), "pages/read.html");
readHtml = replaceRegion(readHtml, "chapters", readerNoscriptList(), "pages/read.html");
outputs.set("pages/read.html", readHtml);

outputs.set("llms.txt", replaceRegion(read("llms.txt"), "chapters", llmsBlock(), "llms.txt"));

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
