(function () {
  "use strict";

  const AK = window.ASK_KRISHNA;

  AK.ref = function (verses) {
    if (verses.length === 1) return `${AK.text("reference")} ${AK.verseRef(verses[0])}`;
    const first = verses[0];
    const last = verses[verses.length - 1];
    return `${AK.text("reference")} ${AK.verseRef(first)}-${AK.verseRef(last)}`;
  };

  AK.verseRef = function (verse) {
    return `${verse.chapter}.${verse.verse}`;
  };

  AK.passageFor = function (data, main) {
    const chapter = data.filter((verse) => verse.chapter === main.chapter);
    const i = chapter.findIndex((verse) => verse.id === main.id);
    if (i < 1) return chapter.slice(0, 3);
    if (i > chapter.length - 2) return chapter.slice(-3);
    return chapter.slice(i - 1, i + 2);
  };

  AK.line = function (verse, mainId, className, value) {
    const el = AK.block(className, value);
    if (verse.id === mainId) el.classList.add("main");
    return el;
  };

  AK.renderCard = function (entry, translations) {
    const card = document.createElement("article");
    const sanskrit = document.createElement("div");
    card.className = "passage-card";
    if (entry.verses.length > 1) card.classList.add("triad");
    sanskrit.className = "sanskrit-set";

    entry.verses.forEach((verse) => {
      sanskrit.append(AK.line(verse, entry.mainId, "verse-text sanskrit-line", verse.sanskrit));
    });

    card.append(AK.block("ref", AK.ref(entry.verses)), sanskrit);
    if (translations) {
      const translation = document.createElement("div");
      translation.className = "translation-set";
      entry.verses.forEach((verse) => {
        translation.append(AK.line(verse, entry.mainId, "verse-text translation-line", translations[verse.id]));
      });
      card.append(translation);
    }
    return card;
  };
})();
