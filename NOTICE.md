# NOTICE

## App Code

The Ask Krishna application code is licensed under the MIT License. See `LICENSE`.

## Bhagavad Gita Data

`data/verses.json` (Sanskrit + structure) and `data/translations/<code>.json` (per-language verse translations) are normalized from:

- Dataset: Bhagavad Gita - Sanskrit, Transliteration & Multi-Commentary Dataset
- Hugging Face URL: https://huggingface.co/datasets/Voider22/bhagavad-gita-verses-sanskrit-translations
- Source named by dataset: VedicScriptures API, https://vedicscriptures.github.io/
- Dataset license: MIT License

Selected fields:

- Sanskrit (`data/verses.json`): `slok`
- Hindi translation (`data/translations/hi.json`): `tej.ht`, attributed in the source to Swami Tejomayananda
- English translation (`data/translations/en.json`): `siva.et`, attributed in the source to Swami Sivananda

Additional `data/translations/<code>.json` files added in the future should carry their own attribution entries in this notice.

The source dataset README states: "Bhagavad Gita data sourced from VedicScriptures (MIT License)."

## Interface Text References

The app-authored interface translations live as `assets/locales/<code>.json`, one file per language, loaded by `assets/i18n.js`. The purification mantra meaning was cross-checked against public mantra references including:

- Shlokam.org: https://shlokam.org/shloka/apavitra-pavitro.htm
- The Divine India: https://www.thedivineindia.com/hi/om-apavitra-pavitro.html
- Mahashakti: https://www.mahashakti.org.in/2012/10/blog-post_98.html

## Dataset License Notice

MIT License

Copyright (c) 2022 Vedic Scriptures

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
