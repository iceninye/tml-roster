# Changelog

## v0.9.0 — unreleased
- 編更: the CSV import has its own year and ISO week (the base week of the CSV); the page opens on next week. The week title shows the year, e.g. 2026 · Week 43.
- Every week starts with all of the team's blocks in the 待定區 and the cells empty, not only the imported week. 本週重新開始 puts the week back that way; 全部放入待定區, 假期放入待定區 and 還原 Standard are gone.
- Setting a cell uses up a block of that day (the same code, or for a leave the member's own block) and sends what the cell held back to the tray, so the annual-leave week uses up its blocks.
- HC and TBC blocks stay in the tray until given a 7-digit duty number; a cell can't be set to HC or TBC.
- 自動編排 (was 按偏好自動編排) fills the whole team's empty cells from the tray by preference and rest, skipping members with no RD in the week. 編多週 is gone.
- 還原上一步 button and Ctrl+Z / ⌘Z undo the last change. The table head shows each day's empty cells; the tray shows each day's block count.

## v0.8.4 — unreleased
- 編更: the 年假 button is gone. A member on AL Monday to Wednesday takes the whole annual-leave week (AL AL AL SH SH RD RD).
- Auto-fill works on the member changed only: a preference, a leave or a block sets that member's empty days from the day trays. A week needs one RD before it fills.
- The settings title shows the week and its dates.

## v0.8.3 — unreleased
- 編更: the HC status is labelled HC (not 待定), like TBC, to be changed by hand.

## v0.8.2 — unreleased
- 編更: a 下載匯入範本 button gives the CSV template (141 rows, 7 cells; RD is a placeholder). The setup form and the import message show the ISO week and its dates, e.g. 第 42 週：2026/10/12 至 2026/10/18.

## v0.8.1 — unreleased
- 編更: the rest between duties is fixed at 12 hours (the input is gone). Import and 全部放入待定區 put every block of the team in the tray, including HC and TBC: 7 blocks per member. TBC and HC blocks can be dropped in a cell and its duty number typed.

## v0.8.0 — unreleased
- 編更: importing (or 全部放入待定區) puts every duty, RD, AL and SH of the team in the 待定區 and empties the cells. Setting a preference, leave, a block or a Duty Sheet fills the empty cells by preference straight away; RD blocks show their weekday, e.g. RD(四).
- 年假 chip on each member: fills the row AL AL AL SH SH RD RD (pinned); tap again to undo.
- A date on a special Duty Sheet (e.g. 8022) puts all of that sheet's duties in its tray. Each block has a ✕ to delete it, until the day's blocks equal the members needing one.

## v0.7.1 — unreleased
- 編更 is a separate page: open `plan.html` directly (no link from 我的更表). It imports and keeps its own Standard Roster (`tml-plan-roster`) and no longer reads or writes the personal roster (`tml-roster`).

## v0.7.0 — unreleased
- 編更: a 積木區 (tray) under the table. Drag a duty out of a cell into its day's column, then drop it on any cell of the same day; a duty already there goes back to the tray. Duties nobody can take after auto-arranging land there too.
- Drag and drop now uses pointer events: mouse drags at once, touch after a short hold (moving sooner scrolls the table); drop targets light up, the table scrolls near its edges, and cells of the same day swap. Tapping a cell then another cell, a block or a tray column does the same.
- Member names and preferred shifts are set right in the table; the separate members panel is gone.
- HC (pending) cells are never touched by auto-arrange; fill them by hand or with a block.
- The table keeps its scroll position after each change.
- CSV import with a Name column (`,Name,Mon,Tue,Wed,Thu,Fri,Sat,Sun`, then `row,name,7 cells`) on both pages; the header line is skipped. On 編更 the rows with a name become the team and their names are filled in. A row of seven TBC cells does not rotate and stays on its own row; TBC cells are pending like HC.
- 積木區 is now 待定區 and also takes rest days and leave: drag an RD / AL / SH cell into it (or "假期放入待定區" for the whole week) and drop it on another cell of the same day. Auto-arrange leaves these blocks alone.
- Each date can be set to a Duty Sheet (1101 / 6091 / 7091 / 8022 / 8023) from a menu under the day: that day's Standard Roster duty numbers keep their last three digits and take the sheet's (6091124 on 8022 reads 8022124). Duties already planned follow; 8022 / 8023 times come from the duty cards, and a number the sheet lacks shows in red.

## v0.6.0 — 2026-10-17
- New 編更 page (`plan.html`): pick a base week and the team's rows (for example Week 42, rows 31–40 and 55–70); every later week each member moves one row down, wrapping after the last row.
- Each member gets a name and preferred shifts: 死早 (book on before 06:30), 早, 中, 夜, 死夜 (book off after 00:30).
- 按偏好自動編排 hands round the team's duties of each day (never across days; rest days and leave stay) to match preferences, spread misses fairly and keep the minimum rest (11 h by default, flagged in red when short). It can run over several weeks in a row.
- Swap two cells of the same day by drag and drop, or tap one then the other; tap a cell to change that one date. Hand-made changes are pinned and kept by the next arrangement.
- Plan kept only in this browser; export / import as JSON and the week as CSV. Link to it from the week page.

## v0.5.0 — 2026-10-17 (`179a751`)
- Visual redesign: one colour system for dark and light, softer cards, clearer type scale.
- Week page: a "today" card on top with the duty, a 24-hour strip and what the duty is doing right now; week navigation is a bar with the date range and roster row; each day card shows the day number large and a strip marking the shift.
- Day page: a vertical timeline with a dot per kind of leg (revenue, empty, meal, ride), times above and places below; 飯腳 are tappable chips.

## v0.4.0 — 2026-10-17 (`de04c8f`)
- Spare duties (HSP1–3, KSP1–4, TSP1–4, SEP, SLP …) and duties whose sheet has no card here now show book-on/off time, place and working hours, from the new `data/duty-basic.json` (built by `tools/index-to-basic.py` from a duty workbook's Index sheet; remarks are not copied).
- Readability: early / middle / late duty colour bar and tag, 翌日 marker when a duty books off after midnight, larger type, sticky week navigation, a colour legend.

## v0.3.0 — 2026-10-17 (`200bd61`)
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
