# Changelog

## v0.3.0 — 2026-10-17
- Import: pick a .csv / .tsv / .txt file besides pasting; tab-separated rows with no row numbers (copied from Excel) read as rows 1, 2, 3 …
- Live preview on the setup page: as you paste or pick a file it shows the rows read, any bad lines, and whether the row number you gave exists.
- The imported roster is shown as a table on the week page and on the settings page, with this week's row and today's cell marked.

## v0.2.0 — 2026-10-17 (`050b0cb`)
- Layout: the week is a list of day cards (big book-on/off times, duty number, meal), today highlighted; the day page leads with book-on/off and puts the edit box below; setup is two numbered steps with a format guide and example.
- Wording rewritten in one plain Cantonese voice, with help text for the row number, 飯腳, backup and day edits.
- Deployed to GitHub Pages (`.github/workflows/pages.yml`); README rewritten as a quick start.

## v0.1.0 — 2026-10-16 (`336a40d`)
- First version, moved out of TML-traffic v0.9.0 (我的更表, never merged there): paste your roster, follow the weekly cycle, change single days, full duty card with 飯腳, backup and clear. Stored only in this browser (`tml-roster`; a roster saved by the TML-traffic preview under `tml-traffic-roster` is picked up).
- Duty cards copied from TML-traffic (DS1101, DS6091, DS7091, DS8022, DS8023) with `tools/sync-duties.mjs`.
