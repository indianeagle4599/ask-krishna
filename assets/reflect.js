(function () {
  "use strict";

  const AK = window.ASK_KRISHNA;
  const COUNT = 5;
  const SESSION = "askKrishna.session";

  AK.saveSession = function (next) {
    AK.session = next;
    localStorage.setItem(SESSION, JSON.stringify(next));
  };

  AK.resetSession = function () {
    localStorage.removeItem(SESSION);
    AK.session = {};
  };

  AK.session = AK.readReflectSession();

  AK.goHome = function (event) {
    if (event) event.preventDefault();
    AK.resetSession();
    AK.go("index");
  };

  AK.go = function (name) {
    AK.clearTimer();
    AK.page = name;
    document.body.dataset.page = name;
    history.replaceState({ page: name }, "", AK.homeUrl());
    AK.render();
  };

  AK.home = function () {
    AK.resetSession();
    const content = document.createElement("section");
    content.className = "center";
    content.append(AK.sacredBlock("mantra"), AK.button(AK.text("actions.begin"), () => AK.go("reflect")));
    AK.pageFrame(content);
  };

  AK.reflect = function () {
    AK.pauseScreen({
      session: AK.session,
      getSession: () => AK.session,
      saveSession: AK.saveSession,
      secondMessageKey: "messages.hold",
      actionLabel: AK.text("actions.receive"),
      pauseKey: "holdReady",
      actionKey: "receiveReady",
      onAction: () => AK.go("passage"),
    });
  };

  AK.makeSession = async function () {
    if (AK.session.passages?.length === COUNT) return AK.session;
    const data = await fetch(`${AK.root}data/verses.json`).then((response) => response.json());
    const pool = [...data];
    const passages = [];

    while (passages.length < COUNT && pool.length) {
      const main = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      passages.push({ mainId: main.id, verses: AK.passageFor(data, main) });
    }

    AK.saveSession({ index: 0, passages });
    return AK.session;
  };

  AK.passage = async function () {
    const data = await AK.makeSession();
    const translations = await AK.i18n.loadTranslations(AK.language());
    const entry = data.passages[data.index || 0];
    const content = document.createElement("section");
    const status = AK.block("save-status", "");
    const list = document.createElement("div");
    const index = data.index || 0;
    const count = AK.block("ref page-count", `${index + 1}/${data.passages.length}`);
    const saveBtn = AK.button(AK.text("actions.save"), () => AK.saveEntry(entry, translations, status), "text-button");
    const center = document.createDocumentFragment();
    center.append(
      AK.button(AK.text("actions.readVerse"), () => AK.openReadVerse(entry.mainId), "text-button"),
      saveBtn,
    );

    list.className = "passage";
    list.append(AK.renderCard(entry, translations));
    content.append(
      count,
      list,
      AK.pager({
        onPrev: () => AK.movePassage(-1),
        onNext: () => AK.movePassage(1),
        center,
        prevDisabled: index === 0,
      }),
      status,
    );
    AK.pageFrame(content);
  };

  AK.movePassage = function (step) {
    if (!AK.session.passages?.length) return;
    if ((AK.session.index || 0) === AK.session.passages.length - 1 && step > 0) {
      AK.go("wait");
      return;
    }
    const next = Math.max(0, Math.min((AK.session.index || 0) + step, AK.session.passages.length - 1));
    AK.saveSession({ ...AK.session, index: next });
    AK.passage();
  };

  AK.wait = function () {
    const content = document.createElement("section");
    const actions = document.createElement("div");
    const status = AK.block("save-status", "");
    content.className = "center wait-screen";
    actions.className = "card-actions";
    actions.append(
      AK.button(AK.text("actions.back"), () => AK.go("passage"), "text-button"),
      AK.button(AK.text("actions.saveAll"), () => AK.saveAllPassages(status), "text-button save-all"),
    );
    content.append(AK.block("wait-note", AK.text("messages.wait")), AK.block("muted ponder-line", AK.text("messages.ponder")), actions, status);
    AK.pageFrame(content);
  };

  AK.saveAllPassages = async function (status) {
    const translations = await AK.i18n.loadTranslations(AK.language());
    await document.fonts?.ready;
    const passages = AK.session.passages || [];
    let ok = passages.length > 0;
    for (let i = 0; i < passages.length; i++) {
      const success = await AK.downloadCanvas(AK.cardCanvas(passages[i], translations), AK.passageFileName(passages[i]));
      if (!success) ok = false;
      if (i < passages.length - 1) await new Promise((r) => setTimeout(r, 300));
    }
    status.textContent = AK.text(ok ? "actions.saved" : "actions.saveError");
  };

  AK.reflectScreens = {
    index: AK.home,
    reflect: AK.reflect,
    passage: AK.passage,
    wait: AK.wait,
  };
})();
