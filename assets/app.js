(async function () {
  "use strict";

  const AK = window.ASK_KRISHNA;
  AK.page = document.body.dataset.page;
  AK.screen = AK.$("[data-screen]");
  const isReadPage = AK.page === "read" && location.pathname.includes("/pages/read");
  const isIndexSpa = !location.pathname.includes("/pages/");

  if (isIndexSpa) {
    if (sessionStorage.getItem("askKrishna.openPassage")) {
      sessionStorage.removeItem("askKrishna.openPassage");
      AK.page = "passage";
      document.body.dataset.page = "passage";
    } else {
      sessionStorage.removeItem("askKrishna.reflectReturn");
      sessionStorage.removeItem("askKrishna.reflectReturnPending");
      sessionStorage.removeItem("askKrishna.readPurify");
    }
  }

  if (!isIndexSpa && !isReadPage) {
    localStorage.removeItem("askKrishna.session");
    location.replace(AK.root || "./");
    return;
  }
  AK.render = function () {
    AK.setTheme(localStorage.getItem(AK.THEME), false);
    document.documentElement.lang = AK.manifest[AK.language()].htmlLang;
    const label = AK.text(`pageLabels.${AK.page}`);
    if (AK.page === "read") document.title = AK.text("meta.readTitle");
    else document.title = label ? `${label} - ${AK.text("appName")}` : AK.text("meta.title");
    AK.updateMetaDescription();

    if (isReadPage) return AK.readScreens();
    const screen = AK.reflectScreens?.[AK.page];
    if (screen) return screen();
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && AK.page === "index" && !event.target.closest("button,a")) AK.go("reflect");
    if (event.key === "Enter" && AK.page === "reflect" && AK.session?.receiveReady && !event.target.closest("button,a")) AK.go("passage");
    if (event.key === "Enter" && isReadPage && AK.readPhase === "purify" && AK.readPurifySession?.().readReady && !event.target.closest("button,a")) {
      AK.openIndex();
    }
    if (event.key === "ArrowLeft" && AK.page === "passage") AK.movePassage(-1);
    if (event.key === "ArrowRight" && AK.page === "passage") AK.movePassage(1);
    if (event.key === "ArrowLeft" && isReadPage && AK.readPhase === "read") AK.readMove(-1);
    if (event.key === "ArrowRight" && isReadPage && AK.readPhase === "read") AK.readMove(1);
  });

  try { await AK.i18n.loadLanguage(AK.i18n.defaultLanguage); } catch (_error) { /* keep going */ }
  try { await AK.i18n.loadLanguage("sa"); } catch (_error) { /* keep going */ }
  const chosen = AK.language();
  if (chosen !== AK.i18n.defaultLanguage && chosen !== "sa") {
    try { await AK.i18n.loadLanguage(chosen); } catch (_error) { /* keep default */ }
  }

  if (isReadPage) {
    AK.session = {};
  } else {
    AK.session = AK.readReflectSession();
  }

  AK.render();
})();
