(function () {
  "use strict";

  const AK = window.ASK_KRISHNA;
  const READ_PROGRESS = "askKrishna.readProgress";
  const READ_BOOKMARKS = "askKrishna.readBookmarks";
  const READ_COOKIE = "ak_read";
  const READ_PURIFY = "askKrishna.readPurify";

  AK.verseData = null;
  AK.readFocalId = "";
  AK.readPhase = "purify";

  if (!window.__readBooted) {
    sessionStorage.removeItem(READ_PURIFY);
    AK.readPhase = "purify";
    window.__readBooted = true;
  }

  AK.goHome = function (event) {
    if (event) event.preventDefault();
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

  AK.parseInitialReadId = function () {
    const hash = location.hash.replace(/^#/, "");
    if (hash && AK.verseById(hash)) return hash;
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
      onAction: () => {
        AK.saveReadPurify({ ...AK.readPurifySession(), readReady: true });
        AK.readPhase = "read";
        AK.openRead();
      },
    });
  };

  AK.setReadFocal = function (id) {
    AK.saveReadProgress(id);
    AK.readView();
  };

  AK.readMove = function (step) {
    if (!AK.verseData?.length || !AK.readFocalId) return;
    const index = AK.verseData.findIndex((verse) => verse.id === AK.readFocalId);
    const next = AK.verseData[index + step];
    if (next) AK.setReadFocal(next.id);
  };

  async function loadVerses() {
    if (AK.verseData) return AK.verseData;
    AK.verseData = await fetch(`${AK.root}data/verses.json`).then((response) => response.json());
    return AK.verseData;
  }

  AK.readView = async function () {
    await loadVerses();
    if (!AK.readFocalId) AK.readFocalId = AK.parseInitialReadId();

    const hash = location.hash.replace(/^#/, "");
    const storedProgress = AK.readProgress()?.verseId;
    const focal = AK.verseById(AK.readFocalId) || AK.verseData[0];
    AK.readFocalId = focal.id;
    AK.saveReadProgress(AK.readFocalId);

    const translations = await AK.i18n.loadTranslations(AK.language());
    const entry = { mainId: focal.id, verses: [focal] };
    const content = document.createElement("section");
    content.className = "read-screen";

    if (!hash && storedProgress && !sessionStorage.getItem("askKrishna.readBanner")) {
      const banner = document.createElement("div");
      banner.className = "resume-banner";
      banner.append(
        AK.button(AK.text("actions.continueReading").replace("{ref}", storedProgress), () => {
          sessionStorage.setItem("askKrishna.readBanner", "1");
          AK.setReadFocal(storedProgress);
        }, "text-button"),
        AK.button(AK.text("actions.startOver"), () => {
          sessionStorage.setItem("askKrishna.readBanner", "1");
          AK.setReadFocal("1.1");
        }, "text-button"),
      );
      content.append(banner);
    }

    const controls = document.createElement("div");
    controls.className = "read-controls";
    const chapterSelect = document.createElement("select");
    chapterSelect.className = "chapter-select";
    chapterSelect.setAttribute("aria-label", AK.text("labels.chapter"));
    [...new Set(AK.verseData.map((verse) => verse.chapter))].forEach((chapter) => {
      const option = document.createElement("option");
      option.value = chapter;
      option.textContent = `${AK.text("labels.chapter")} ${chapter}`;
      option.selected = chapter === focal.chapter;
      chapterSelect.append(option);
    });
    chapterSelect.addEventListener("change", () => {
      const first = AK.verseData.find((verse) => verse.chapter === Number(chapterSelect.value));
      if (first) AK.setReadFocal(first.id);
    });

    controls.append(chapterSelect, AK.block("ref", `${AK.text("labels.chapter")} ${focal.chapter} · ${focal.verse}`));

    const bookmarked = AK.readBookmarks().includes(focal.id);
    const list = document.createElement("div");
    list.className = "passage";
    list.append(AK.renderCard(entry, translations));

    const focalIndex = AK.verseData.findIndex((verse) => verse.id === focal.id);
    content.append(
      controls,
      list,
      AK.pager({
        onPrev: () => AK.readMove(-1),
        onNext: () => AK.readMove(1),
        center: AK.bookmarkButton(bookmarked, () => {
          AK.toggleBookmark(focal.id);
          AK.readView();
        }),
        prevDisabled: focalIndex <= 0,
        nextDisabled: focalIndex >= AK.verseData.length - 1,
      }),
    );
    AK.pageFrame(content);
  };

  AK.openRead = function () {
    AK.readView().catch(() => {
      const status = AK.block("save-status", AK.text("actions.saveError"));
      AK.pageFrame(status);
    });
  };

  AK.readScreens = function () {
    if (AK.readPurifySession().readReady) AK.readPhase = "read";
    if (AK.readPhase !== "read") return AK.readPurify();
    AK.readView().catch(() => {
      AK.pageFrame(AK.block("save-status", AK.text("actions.saveError")));
    });
  };
})();
