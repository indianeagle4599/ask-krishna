#!/usr/bin/env python3
"""
Normalize the source Bhagavad Gita JSONL dataset into the split layout used by
the app:

  data/verses.json                -- [{id, chapter, verse, sanskrit}, ...]
  data/translations/hi.json       -- { "1.1": "<hindi>", ... }
  data/translations/en.json       -- { "1.1": "<english>", ... }

Usage:
  python3 scripts/normalize_gita.py /path/to/gita.jsonl data/ [debug-log.jsonl]
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DEBUG_RULES = {"remove_encoding_markers"}


def note(log: list[dict[str, str]], verse_id: str, field: str, rule: str, before: str, after: str) -> None:
    if before == after or rule not in DEBUG_RULES:
        return
    log.append(
        {
            "id": verse_id,
            "field": field,
            "rule": rule,
            "before": before[:180],
            "after": after[:180],
        }
    )


def clean_common(text: str, verse_id: str, field: str, log: list[dict[str, str]]) -> str:
    before = text
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    note(log, verse_id, field, "trim_and_newlines", before, text)

    before = text
    text = re.sub(r"ï\d+", "", text)
    text = text.replace("�", "")

    before = text
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    note(log, verse_id, field, "collapse_spacing", before, text)
    return text.strip()


def clean_translation(text: str, verse_id: str, field: str, log: list[dict[str, str]]) -> str:
    original = text
    text = clean_common(text, verse_id, field, log)
    before = text
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    text = re.sub(r"^।।\s*\d+[.\-।]\d+\s*।।\s*", "", text)
    text = re.sub(r"^\d+\.\d+\.?\s*", "", text)
    note(log, verse_id, field, "remove_verse_prefix", before, text)
    text = re.sub(r"[ \t]+", " ", text).strip()
    if re.search(r"ï\d+|�", original):
        note(log, verse_id, field, "remove_encoding_markers", original, text)
    return text


def clean_sanskrit(text: str, verse_id: str, field: str, log: list[dict[str, str]]) -> str:
    original = text
    text = clean_common(text, verse_id, field, log)
    if re.search(r"ï\d+|�", original):
        note(log, verse_id, field, "remove_encoding_markers", original, text)
    return text


def normalize(source: Path) -> tuple[list[dict[str, object]], dict[str, dict[str, str]], list[dict[str, str]]]:
    """Return (verses, translations_by_code, log)."""
    verses: list[dict[str, object]] = []
    translations: dict[str, dict[str, str]] = {"hi": {}, "en": {}}
    log: list[dict[str, str]] = []
    seen: set[str] = set()

    with source.open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue

            raw = json.loads(line)
            chapter = int(raw["chapter"])
            verse = int(raw["verse"])
            verse_id = f"{chapter}.{verse}"

            if verse_id in seen:
                raise ValueError(f"duplicate verse id: {verse_id}")
            seen.add(verse_id)

            verses.append(
                {
                    "chapter": chapter,
                    "verse": verse,
                    "id": verse_id,
                    "sanskrit": clean_sanskrit(raw["slok"], verse_id, "sanskrit", log),
                }
            )
            translations["hi"][verse_id] = clean_translation(raw["tej"]["ht"], verse_id, "hindi", log)
            translations["en"][verse_id] = clean_translation(raw["siva"]["et"], verse_id, "english", log)

    verses.sort(key=lambda row: (row["chapter"], row["verse"]))
    return verses, translations, log


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    if len(sys.argv) not in (3, 4):
        print(__doc__.strip(), file=sys.stderr)
        return 2

    source = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    log_path = Path(sys.argv[3]) if len(sys.argv) == 4 else out_dir / "normalization-log.jsonl"

    verses, translations, log = normalize(source)
    write_json(out_dir / "verses.json", verses)
    for code, mapping in translations.items():
        write_json(out_dir / "translations" / f"{code}.json", mapping)

    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(
        "".join(json.dumps(entry, ensure_ascii=False) + "\n" for entry in log),
        encoding="utf-8",
    )

    print(f"Wrote {len(verses)} verses to {out_dir / 'verses.json'}")
    for code, mapping in translations.items():
        print(f"Wrote {len(mapping)} translations to {out_dir / 'translations' / f'{code}.json'}")
    print(f"Wrote {len(log)} normalization log entries to {log_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
