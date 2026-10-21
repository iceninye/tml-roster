# Handoff: background and decisions

Written when 我的更表 moved out of TML-traffic (2026-10-16), for whoever works on this repo next.

## Why a separate repo
Ice WONG first asked (2026-10-15, TML-traffic project thread) for an admin back office plus personal duty views. The personal view was built first as a section of TML-traffic (v0.9.0, draft PR #28, never merged), then moved here by Ice's decision ("不 PR，搬去新 repo tml-roster"). TML-traffic stays the public live diagram and the place where Duty Sheets are parsed.

## Decisions by Ice
- Phase 1 = personal view with data in the browser (no login, no server). The admin back office (date-to-sheet calendar, upload and parse PDF/xlsx, Cloudflare Access) and cross-device sync are later ideas; the design thread's options were: Access-protected /admin, Worker + KV for the calendar, GitHub Actions to run `tools/parse_dutysheet.py` on upload, D1 for per-user rosters. Nothing of that is built.
- Design for many users later: each user has their own roster; personal rosters are private to that person and must never be committed here.
- Roster file format: 136 rows (for Ice) by Monday to Sunday, one row per week, cycling back to row 1 after the last. Ice states which row this week is. Monday to Friday use sheet 1101, Saturday 6091, Sunday 7091.
- Cell codes: 7-digit duty number (first four digits = Duty Sheet), RD rest day, AL annual leave, SH statutory holiday, HC pending (undecided), HSP1/HSP3/KSP1 to KSP4 spare duties (no times).
- Special days (for example 8022 on 2026-10-24 and 8023 on 2026-10-25): use the default roster cell and let Ice change the day by hand; no automatic mapping from 6091xxx to 8022xxx.
- The CSV Ice pasted had shifted rows; the import parser reports lines with the wrong number of cells instead of guessing. Cells that name a duty missing from a sheet (Ice skips 1101185 and 7091150) show "找不到更份 … 資料".
- 編更 (2026-10-17, Ice): team = rows of a base week (Week 42: 31–40 and 55–70), +1 row a week. 死早 = book on before 06:30, 死夜 = book off after 00:30. Defaults picked by Claude, open to change: swaps only within one day's team cells, RD/AL/SH/HC stay with the row, 11 h minimum rest as a warning (the Standard Roster itself has a few gaps under 11 h), times from `data/duty-basic.json`.
- 編更 v0.7.0 (Ice's feedback, 2026-10-17): 11 h minimum rest confirmed; HC is edited by Ice by hand (auto-arrange never touches it); preferences set inline per member; drag and drop swaps; a 積木區 tray holds duties taken out of cells. An emptied cell holds `EMPTY` ("-"); trays live in the plan under `trays`.
- 編更 Duty Sheet per date (Ice, 2026-10-17): the plan's `sheets` maps a date to a sheet; the Standard duty numbers of that date keep their last 3 digits and take the sheet's first 4. Defaults 1101 / 6091 / 7091; special sheets 8022 / 8023 get times from their cards (data/duties), not only duty-basic.json. Since v0.9.21 the CSV import also finds dated sheets from the Duty index (8027, and 7091M on 2026-11-01, which shares 7091xxx numbers), and times on a dated day come from that sheet's cards (`timeOf(code, date)`).
- 編更 CSV (Ice, 2026-10-17): format `,Name,Mon..Sun` then `row,name,7 cells`; rows with a name are the team (names live in the roster's `names`, filled into plan members). Rows of all TBC (137-141 in Ice's file) are kept but excluded from the weekly cycle (`rowAfter` in lib/tml-roster.js) and stay on their row; TBC cells count as pending like HC. 積木區 renamed 待定區; it also takes RD / AL / SH blocks (`leaveToTray`, drag a leave cell). Auto-arrange keeps leave blocks in place. Names are staff data: never commit a CSV or a screenshot of it.
- 編更 is separate from the personal page (Ice, 2026-10-17): own entry `plan.html` (no link from index), own storage `tml-plan-roster` for its Standard Roster; it never touches `tml-roster`. (Until v0.7.0 the plan page read and, on CSV import, overwrote the personal roster.)
- Service day changes at 04:00 Hong Kong time (`lib/tml-time.js`).

## Where things are
- `lib/tml-roster.js`: parse, weekly cycle, per-day overrides, backup validation (pure; `tools/validate_roster.mjs` checks it on a made-up roster).
- `lib/tml-plan.js`: 編更 (team plan): members by anchor-week row, preference fit, per-day assignment (Hungarian method), rest check. `assets/plan.js` is its page; `tools/validate_plan.mjs` checks it. Plans (names, preferences) stay in the browser under `tml-roster-plan`, never in the repo.
- `lib/tml-duties.js`: duty state at a time, 飯腳 (meal mates), copied from TML-traffic.
- `assets/app.js`: the page. Duty cards, `duty-basic.json` and station names are read at run time from TML-traffic (`lib/tml-data.js`: its Workers site, then GitHub raw); no copies here since v0.9.19.
- Duty cards hold no crew names; keep it that way.
