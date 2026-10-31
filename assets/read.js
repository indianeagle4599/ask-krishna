(function () {
  "use strict";

  const AK = window.ASK_KRISHNA;
  const READ_PROGRESS = "askKrishna.readProgress";
  const READ_BOOKMARKS = "askKrishna.readBookmarks";
  const READ_COOKIE = "ak_read";
  const READ_PURIFY = "askKrishna.readPurify";
  const VERSE_HASH = /^\d+\.\d+$/;
  const ANCHOR_HASH = /^(\d+)-(\d+)$/;

  AK.verseData = null;
  AK.readFocalId = "";
  AK.readPhase = "purify";

  if (!window.__readBooted) {
    if (sessionStorage.getItem("askKrishna.reflectReturnPending") === "1") {
      sessionStorage.removeItem("askKrishna.reflectReturnPending");
      sessionStorage.setItem("askKrishna.reflectReturn", "1");
    }
    if (!AK.hasReflectReturn()) sessionStorage.removeItem(READ_PURIFY);
    AK.readPhase = AK.hasReflectReturn() ? "read" : "purify";
    window.__readBooted = true;
  }

  AK.goHome = function (event) {
    if (event) event.preventDefault();
    if (AK.hasReflectReturn()) return AK.returnToReflect();
    sessionStorage.removeItem(READ_PURIFY);
    location.href = AK.homeUrl();
  };

  AK.readPurifySession = function () {
    try {
      return JSON.parse(sessionStorage.getItem(READ_PURIFY)) || {};
    } catch (_error) {
      return {};
    }
  };

  AK.saveReadPurify = function (next) {
    sessionStorage.setItem(READ_PURIFY, JSON.stringify(next));
  };

  AK.readProgress = function () {
    try {
      return JSON.parse(localStorage.getItem(READ_PROGRESS)) || null;
    } catch (_error) {
      return null;
    }
  };

  AK.readBookmarks = function () {
    try {
      return JSON.parse(localStorage.getItem(READ_BOOKMARKS)) || [];
    } catch (_error) {
      return [];
    }
  };

  AK.saveReadProgress = function (id) {
    AK.readFocalId = id;
    localStorage.setItem(READ_PROGRESS, JSON.stringify({ verseId: id }));
    AK.setCookie(READ_COOKIE, id, 365);
    history.replaceState(null, "", `${location.pathname}${location.search}#${id}`);
  };

  AK.toggleBookmark = function (id) {
    const marks = AK.readBookmarks();
    const next = marks.includes(id) ? marks.filter((entry) => entry !== id) : [...marks, id];
    localStorage.setItem(READ_BOOKMARKS, JSON.stringify(next));
    return next.includes(id);
  };

  AK.verseById = function (id) {
    return AK.verseData?.find((verse) => verse.id === id);
  };

  // The verse a deep link points at: read.html#2.47, chapter-2.html#2-47 or
  // chapter-2.html (its first verse). Empty for plain read.html.
  AK.hashVerseId = function () {
    const hash = location.hash.replace(/^#/, "");
    const anchor = hash.match(ANCHOR_HASH);
    return anchor ? `${anchor[1]}.${anchor[2]}` : hash;
  };

  AK.readTargetId = function () {
    const hash = AK.hashVerseId();
    if (VERSE_HASH.test(hash) && AK.verseById(hash)) return hash;
    const chapter = document.body.dataset.chapter;
    if (chapter && AK.verseById(`${chapter}.1`)) return `${chapter}.1`;
    return "";
  };

  // After purification: open the linked verse, or the index as before.
  AK.readAfterPurify = async function () {
    AK.saveReadPurify({ ...AK.readPurifySession(), readReady: true });
    try {
      await loadVerses();
    } catch (_error) {
      return readFail();
    }
    const target = AK.readTargetId();
    if (target) AK.setReadFocal(target);
    else AK.openIndex();
  };

  AK.parseInitialReadId = function () {
    const hash = AK.hashVerseId();
    if (hash && hash !== "index" && AK.verseById(hash)) return hash;
    const saved = AK.readProgress()?.verseId;
    if (saved && AK.verseById(saved)) return saved;
    const cookie = AK.getCookie(READ_COOKIE);
    if (cookie && AK.verseById(cookie)) return cookie;
    return "1.1";
  };

  AK.readPurify = function () {
    AK.pauseScreen({
      session: AK.readPurifySession(),
      getSession: AK.readPurifySession,
      saveSession: AK.saveReadPurify,
      secondMessageKey: "messages.rememberKrishna",
      actionLabel: AK.text("actions.read"),
      pauseKey: "rememberReady",
      actionKey: "readReady",
      onAction: () => AK.readAfterPurify(),
    });
  };

  AK.setReadFocal = function (id) {
    AK.saveReadProgress(id);
    AK.readPhase = "read";
    AK.readView();
  };

  AK.readMove = function (step) {
    if (!AK.verseData?.length || !AK.readFocalId) return;
    const index = AK.verseData.findIndex((verse) => verse.id === AK.readFocalId);
    const target = AK.verseData[index + step];
    if (target) AK.setReadFocal(target.id);
  };

  function readFail() {
    AK.pageFrame(AK.block("save-status", AK.text("actions.saveError")));
  }

  function chapters() {
    return [...new Set(AK.verseData.map((verse) => verse.chapter))];
  }

  function sortedMarks() {
    const marks = AK.readBookmarks();
    if (!marks.length || !AK.verseData) return [];
    const order = new Map(AK.verseData.map((verse, index) => [verse.id, index]));
    return marks
      .slice()
      .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
      .map((id) => AK.verseById(id))
      .filter(Boolean);
  }

  function versePick(verse, label, marked = false) {
    const btn = AK.button(label, () => AK.setReadFocal(verse.id), marked ? "index-verse marked" : "index-verse");
    btn.setAttribute("aria-label", AK.verseRef(verse));
    return btn;
  }

  function buildVerseGrid(chapter, marks) {
    const grid = document.createElement("nav");
    grid.className = "index-verse-grid";
    grid.setAttribute("aria-label", `${AK.text("labels.chapter")} ${chapter}`);
    AK.verseData.filter((verse) => verse.chapter === chapter).forEach((verse) => {
      grid.append(versePick(verse, String(verse.verse), marks.has(verse.id)));
    });
    return grid;
  }

  function buildIndexPicker(openChapter, marks) {
    const picker = document.createElement("div");
    picker.className = "index-picker";
    const gridHost = document.createElement("div");
    gridHost.className = "index-verse-host";
    const showChapter = (chapter) => gridHost.replaceChildren(buildVerseGrid(chapter, marks));

    picker.append(
      AK.chapterNav({ chapters: chapters(), value: openChapter, onChange: showChapter }),
      gridHost,
    );
    showChapter(openChapter);
    return picker;
  }

  async function loadVerses() {
    if (AK.verseData) return AK.verseData;
    AK.verseData = await fetch(`${AK.root}data/verses.json`).then((response) => response.json());
    return AK.verseData;
  }

  AK.readIndexView = async function () {
    await loadVerses();
    AK.readPhase = "index";
    history.replaceState(null, "", `${location.pathname}${location.search}`);

    const content = document.createElement("section");
    content.className = "read-index";
    const storedProgress = AK.readProgress()?.verseId;
    const resume = storedProgress && AK.verseById(storedProgress);

    if (resume) {
      content.append(
        AK.button(
          AK.text("actions.continueReading").replace("{ref}", storedProgress),
          () => AK.setReadFocal(storedProgress),
          "text-button index-continue",
        ),
      );
    }

    const marks = new Set(AK.readBookmarks());
    const marked = sortedMarks();
    if (marked.length) {
      const row = document.createElement("nav");
      row.className = "mark-links";
      marked.forEach((verse) => row.append(versePick(verse, AK.verseRef(verse), true)));
      content.append(row);
    }

    content.append(buildIndexPicker(resume?.chapter || 1, marks));
    AK.pageFrame(content);
  };

  AK.readView = async function () {
    await loadVerses();
    if (!AK.readFocalId) AK.readFocalId = AK.parseInitialReadId();

    const focal = AK.verseById(AK.readFocalId) || AK.verseData[0];
    AK.readFocalId = focal.id;
    AK.readPhase = "read";
    AK.saveReadProgress(AK.readFocalId);

    const translations = await AK.i18n.loadTranslations(AK.language());
    const entry = { mainId: focal.id, verses: [focal] };
    const content = document.createElement("section");
    content.className = "read-screen";
    const status = AK.block("save-status", "");
    const focalIndex = AK.verseData.findIndex((verse) => verse.id === focal.id);
    const center = document.createDocumentFragment();
    center.append(
      AK.bookmarkButton(AK.readBookmarks().includes(focal.id), () => {
        AK.toggleBookmark(focal.id);
        AK.readView();
      }),
      AK.button(AK.text("actions.save"), () => AK.saveEntry(entry, translations, status), "text-button"),
    );

    const list = document.createElement("div");
    list.className = "passage";
    list.append(AK.renderCard(entry, translations));

    content.append(
      AK.block("ref", `${AK.text("labels.chapter")} ${focal.chapter} · ${focal.verse}`),
      list,
      AK.pager({
        onPrev: () => AK.readMove(-1),
        onNext: () => AK.readMove(1),
        leading: AK.hasReflectReturn()
          ? AK.button(AK.text("actions.backToAnswer"), () => AK.returnToReflect(), "text-button")
          : AK.indexButton(() => AK.openIndex()),
        center,
        prevDisabled: focalIndex <= 0,
        nextDisabled: focalIndex >= AK.verseData.length - 1,
      }),
      status,
    );
    AK.pageFrame(content);
  };

  AK.openIndex = function () {
    AK.readIndexView().catch(readFail);
  };

  AK.openRead = function () {
    AK.readPhase = "read";
    AK.readView().catch(readFail);
  };

  AK.readScreens = function () {
    if (AK.readPurifySession().readReady) {
      const hash = AK.hashVerseId();
      AK.readPhase = hash && hash !== "index" && VERSE_HASH.test(hash) ? "read" : "index";
    }
    if (AK.readPhase === "purify") return AK.readPurify();
    if (AK.readPhase === "index") return AK.openIndex();
    return AK.openRead();
  };
})();