# Post-match report, team stats and awards

This area turns scouted match data into something a coach can read, print, export and present:

- **Post-match report**: the finished-match view of `MatchPage` at `/teams/:teamId/matches/:matchId`. It renders `MatchReport`, offers Print / PDF and two CSV exports, links to match awards and can reopen the match. The same `MatchReport` component also renders the live report for a match in progress; live scouting itself is covered by another inventory.
- **Team Stats tab**: `/teams/:teamId?tab=stats`. A season dashboard built from the stored summaries of finished matches, with filters in the URL, KPI tiles, a trend chart, rotation bars, leaderboards and a sortable player table. It exports Print / PDF and CSV and links to season awards.
- **Awards**: two full-screen routes outside `AppShell`, both lazy-loaded behind `RequireAuth` (which includes `ClubGate`):
  - `/teams/:teamId/awards` (`AwardsPage scope="season"`)
  - `/teams/:teamId/matches/:matchId/awards` (`AwardsPage scope="match"`)

  The coach prepares the award winners and the card look (Prepare), presents a Wrapped-style story on a canvas (Present), and exports PNG cards, a summary PNG and a recorded video. Everything is drawn on a 1080×1920 canvas.

**Who uses it:** team admins only, meaning people listed in `team.adminEmails` and club admins (`isTeamAdmin`, `src/teams/teamAccess.ts`). The Firestore rules let only active team admins, or a club admin's export-only access, read match documents (`firestore.rules`, `match /matches/{matchId}` → `allow read: if (activeMember() && teamAdmin()) || exporter()`). Season award docs follow the same rule. In practice the report, the stats tab and awards are coach-only. Guardians and viewers never see any of it.

Data sources:
- The finished-match report reads `match.report` (`MatchReportData`), which is stored when the match is finished (`buildFinishPayload`, `src/matches/finish.ts`). It never reads the event log. Only live matches, and finished matches without a stored `report` (finished before reports were stored), replay `events`.
- The stats tab and season awards read up to 60 finished matches (`listFinishedMatches`: `where status == 'finished'`, `orderBy date desc`, `limit(FINISHED_MATCHES_CAP = 60)`) and use their `summary` (equal to `report.all`) and `result`. They never read events.
- The roster comes from `loadTeamRoster`. Its failure is tolerated: the code falls back to `[]`.

Languages: every visible string comes from the i18n catalog (`src/i18n/en/*`, with an Italian twin in `src/i18n/it/*`). English strings are quoted below.

---

## Screens and components

### 1. Match page, finished state (`src/matches/MatchPage.tsx`, route `/teams/:teamId/matches/:matchId`)

- **Purpose**: the page shell around the report once `match.status === 'finished'`. The `setup` and `live` states are covered by another inventory, but the header, delete action and load states are shared.
- **Who can see / do what**: team admins. Non-admins get `permission-denied`, which shows the same not-found state as a missing match (`isNotFoundError`).
- **Elements**:
  - A back link "Back to team" (`ChevronLeft` icon) → `/teams/:teamId`. Hidden in print.
  - A card containing:
    - a meta line: `date · Home|Away · <competition label>`, e.g. "2026-10-18 · Home · League". The date is the raw ISO string.
    - an `h1` "vs <opponent>". Long names break.
    - a "Delete match" button (variant `dangerGhost`, small, top right). Hidden in print.
  - The finished actions bar (right-aligned, hidden in print):
    - an **Export** menu with a `Download` icon and a chevron. The trigger has a blue outline. Items: "Print / PDF" (`Printer` icon), a divider, "CSV · Excel (Belgium/EU)" and "CSV · Excel (English) / Sheets" (both with a `FileSpreadsheet` icon).
    - a "Match awards" link (orange filled, `Trophy` icon) → `/teams/:teamId/matches/:matchId/awards`.
    - a "Reopen for editing" button (secondary, small).
    - an inline `role="alert"` for action errors.
  - Below that, `MatchReport` (see §2) with the set filter **controlled by the page** (`reportSet` state), so the CSV export follows the selected set.
- **Actions → results**:
  - **Print / PDF** → `window.print()`.
  - **CSV (EU)** → downloads `reportCsv(match, stats, 'eu')` for the selected scope via `downloadText(name, text, 'text/csv;charset=utf-8')`. The scope is `report.all`, or `report.bySet[n]` with a fallback to `all`. The file name is `reportCsvFileName(match, set)` (§17).
  - **CSV (English)** → the same with `'en'`.
  - **Match awards** → navigates to the match awards route. The link is shown for every finished match, even one with no scouted actions.
  - **Reopen for editing** → optimistic. The status is set to `live` locally right away (the page switches to the live banner "Scouting in progress"), and `setMatchStatus(…, 'live')` is written. If the write rejects, the page reverts to `finished` and shows "Could not reopen the match. Please try again."
  - **Delete match** → opens a `ConfirmDialog`: title "Delete this match?", message "All scouted actions for this match are deleted. This cannot be undone.", confirm "Yes, delete". On success it navigates to `/teams/:teamId`. On failure it shows "Could not delete the match. Please try again." inside the dialog, and the dialog stays open. Cancel closes it and clears the error.
- **States**:
  - Loading: `PageSkeleton layout="match"`, label "Loading match…".
  - Not found or access denied: `NotFoundState` with title "Match not found", message "It may have been deleted, or you don't have access." and a back link "Back to team" → `/teams/:teamId`.
  - Load error (other errors): a bare paragraph `role="alert"` reading "Could not load this match." No retry button.
  - Finished with a stored report: renders immediately from `match.report` and never subscribes to events.
  - Finished without a stored report: subscribes to events and replays them to build the report.
  - Page title (`usePageMeta`): "vs <opponent>", or "Match" while loading.
- **Validation & messages**: listed above. Finishing a match (live state) builds `summary`, `report`, `usageContribution`, `result` and `usageProfile` through `buildFinishPayload`. That flow belongs to the live inventory, but it is what produces the stored report this page reads.
- **Edge cases**:
  - Writes are not awaited (offline-safe), except `getUsageProfile` during finish.
  - `report` is memoised: the stored report for finished matches, otherwise `buildReportData(replay(match, events))`.
  - The report is not rendered for `setup` matches.
- **Tests that lock this in**: `src/matches/MatchPage.test.tsx` covers:
  - rendering from the stored report without reading events
  - print and CSV exports for all sets and for one set, with exact file names and separators
  - falling back to the event log
  - the reopen revert
  - not-found and permission-denied states
  - the awards link href

  `src/i18n/italian.smoke.test.tsx` checks that a match report renders in Italian.

### 2. Match report (`src/matches/report/MatchReport.tsx`, rendered inside MatchPage)

- **Purpose**: a one-page summary of a match, or of one set.
- **Who can see / do what**: anyone who can open the match page (team admins).
- **Elements**, in order, all inside a root `div.match-report` (the hook for print CSS):
  1. **Result header**:
     - sets won "3–1" (big `text-stat` extrabold, tabular)
     - set scores "25–20 · 22–25 · …", taken from `report.setScores`
     - a print-only line "Set 2 only" when one set is selected. It has `hidden print:block`, so it is invisible on screen.
     - the **Set** control on the right: a native `<select aria-label="Set">` with "All" plus one option per set number that has data (`report.sets`). Hidden in print.
  2. **KPI grid** of 6 tiles, laid out 2, then 3 (sm), then 6 (lg) columns:

     | Label | Value |
     |---|---|
     | "Side-out" | `sideOut.won / sideOut.total` as a whole percent |
     | "Break point" | `breakPoint.won / breakPoint.total` as a percent |
     | "Reception +" | team reception positivity, as a percent |
     | "Attack eff." | signed percent (`fmtEff`) |
     | "Aces / serve errors" | "`aces` / `serveErrors`" |
     | "Opp. errors" | count of rallies with reason `oppError` |

     A null value shows "—". Each tile has a label above the value and a border.
  3. **Players** (`h2`) table, which scrolls horizontally on small screens and becomes visible overflow in print:
     - Columns: "Player"; one column per skill in `SKILLS` order with the localised labels "Serve", "Reception", "Attack", "Block", "Dig", "Set", "Free ball"; "Att. eff"; "Rec +"; "Pts / Err".
     - Player cell: "#<number> <name>". It shows "#?" when the player is not in the roster.
     - Skill cell: the attempt count, plus a 64-px-wide stacked bar of the grade distribution in `GRADES` order `# + ! - / =`. Each segment's width is `count/attempts`. Colours come from `GRADE_CLASS`: `#` green, `+` green/15, `!` bordered bg, `-` orange/20, `/` orange/40, `=` red. The bar is `aria-hidden`. A cell with no attempts shows "—".
     - "Att. eff" uses `fmtEff`. It turns red and bold (`WEAK_CLASS = 'font-semibold text-red-strong'`) when below 0.
     - "Rec +" uses `fmtPct`. It turns red when below 40%.
     - "Pts / Err": points in `text-green-strong`, " / ", then errors, which turn red when they are 3 or more (per match).
     - Rows are sorted by jersey number ascending (unknown → 0). Only players with at least one action in scope appear.
  4. **Rotations** (`h2`): 6 boxes in the order **1, 6, 5, 4, 3, 2**, in a 3-column grid (6 columns from sm). Each box shows "Rot N", the signed difference (`+3`, `0`, `-2`) and "won–lost". The weakest rotation (lowest won−lost; on a tie, the lowest-numbered rotation, from key order) gets a red border and a `bg-red/10` fill. A rotation with no rallies shows "0" and "0–0".
  5. **Timeouts** (`h2`), shown only when there are timeouts in scope. One line per timeout: "Set 2 · T/O us at 12–10 → next rallies 3–2". The counts cover up to 5 rallies in that set starting at the timeout.
  6. **Source note** (small, slate), shown only when the action total is above 0. It joins parts with " · ": "NN% tapped" (if any taps), "NN% from text" (if any text), and "Imported from DataVolley" (if any import). Each percentage is rounded on its own.
- **Actions → results**: changing the set select switches every section to `report.bySet[n]`, or back to `report.all` for "All". It falls back to `all` if that set's stats are missing. The control can be owned by the component itself (uncontrolled, default "all") or controlled by MatchPage.
- **States**:
  - No actions at all: the table has no rows, the KPIs show "—" and 0, and the source note is hidden.
  - No timeouts: the section is hidden.
- **Validation & messages**: none.
- **Edge cases** (from code and tests):
  - A single-set print label appears only when a set is selected.
  - Import-only matches show only "Imported from DataVolley". Older summaries have no `import` count, so the code treats it as 0.
  - Grade bars use inline `width` styles and depend on print color-adjust (§3).
- **Tests that lock this in**: `src/matches/report/MatchReport.test.tsx` covers:
  - the KPI label "Aces / serve errors"
  - player rows "#1 Ns", and the set filter removing rows
  - the "Set 2 only" text having the classes `hidden print:block`
  - the "Imported from DataVolley" note
  - "50% tapped · 50% from text"

  `src/matches/report/reportData.test.ts` covers `buildReportData`, which must equal `computeStats` for the whole match and per set.

### 3. Match report print output (print CSS in `src/index.css`, `print:` utilities in MatchPage and MatchReport)

- **Purpose**: browser "Save as PDF" or a paper copy of the report.
- **Elements and rules**:
  - `@media print { header, nav, footer { display: none !important } body { background: #fff } }`. This hides the app shell.
  - `.match-report * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }` keeps the grade bars and the weakest-rotation colour in print.
  - `.match-report tr { break-inside: avoid; }` stops a player row from splitting across pages.
  - Hidden in print: the back link, the Delete button, the finished actions bar (Export, Awards, Reopen) and the Set select.
  - The page card loses its border, padding and shadow in print (`print:border-0 print:p-0 print:shadow-none`).
  - The table container becomes `print:overflow-visible`, and the report's gap shrinks to `print:gap-4`.
  - The "Set N only" line is shown in print only.
- **Actions → results**: triggered by Export → Print / PDF, or the browser's own print command.
- **Tests**: `MatchReport.test.tsx` (the print-only class on the single-set label) and `MatchPage.test.tsx` (`window.print` is called).

### 4. Team Stats tab (`src/teams/stats/TeamStatsTab.tsx`, route `/teams/:teamId?tab=stats`)

- **Purpose**: a season dashboard of the team's scouted matches.
- **Who can see / do what**:
  - The tab only exists for team admins (`TeamPage`: `...(admin ? [{ id: 'stats' }] : [])`).
  - A non-admin who requests `?tab=stats` is shown the Roster tab (`activeTab` falls back to `'roster'`), and the component is not rendered.
  - It is lazy-loaded (`lazy(() => import('./stats/TeamStatsTab'))`) with the Suspense fallback "Loading team stats…".
- **Elements**, top to bottom:
  1. A print-only heading: "<team name> · Season <season>" and "Printed <date>" (numeric locale date, e.g. en-GB day-first).
  2. A **filter bar** (hidden in print), with native selects and inline labels:
     - "Competition": All / League / Cup / Friendly / Tournament.
     - "Range": Whole season / Last 5 / Last 10 / Dates….
     - When the range is "Dates…": "From" and "To" `type="date"` inputs.
     - "Venue": Home & away / Home / Away.
     - Pushed to the right:
       - a **Season awards** link (orange filled, `Trophy` icon) → `/teams/:teamId/awards`
       - an **Export** menu (bordered trigger, `Download` icon) with "Print / PDF", a divider, "CSV · Excel (Belgium/EU)" and "CSV · Excel (English) / Sheets".
  3. A **coverage line** (small, slate), whose parts are joined with " · ":
     - "Based on N scouted match(es)" (pluralised)
     - "K score-only", if K > 0
     - "J skipped (finished before stats existed)", if J > 0
     - then, for a Last N range, "Showing the last N scouted matches"; otherwise, when the filtered count ≠ total, "Showing X of Y matches"
     - "Showing the latest 60 matches.", when 60 or more docs were loaded.
  4. **KPI tiles** (`StatTile`, 2 columns, 4 columns from sm; 7 tiles):

     | Label | Value |
     |---|---|
     | "Record" | "W–L", with the hint "Sets a–b" |
     | "Side-out" | percent |
     | "Break point" | percent |
     | "Attack eff." | signed percent |
     | "Reception +" | percent |
     | "Aces / serve errors" | "a / e" |
     | "Points from opp. errors" | count |
  5. A **Trend** section (`h3`) containing `TeamTrendChart` (§5).
  6. A **Rotations** section (`h3`) containing `RotationBars` (§6).
  7. A **Best players** section (`h3`) containing `Leaderboards` (§7).
  8. A **Players** section (`h3`) containing `PlayerStatsTable` (§8). It starts on a new page in print (`print:break-before-page`).
- **Actions → results**:
  - Any filter change rewrites the URL search params with `setParams(p, { replace: true })`, so no history entry is added. The `tab` param is kept. The params are:
    - `comp` = league | cup | friendly | tournament (omitted for All)
    - `ha` = home | away (omitted for all)
    - `range` = `last5` | `last10` | `dates` (omitted for the whole season)
    - `from`, `to` (ISO date or empty; only with `range=dates`)

    The default filter produces empty params. Changing team tabs in `TeamPage` deletes `comp`, `ha`, `range`, `from` and `to`.
  - Choosing **Dates…** pre-fills From and To with the earliest and latest date of **all** loaded finished matches.
  - Editing From or To updates only that bound. An empty bound is open-ended, and a reversed range is swapped when filtering.
  - **Season awards** → season awards route.
  - **Print / PDF** → `window.print()`.
  - **CSV EU / EN** → downloads `teamStatsCsv(season.players, format)` named `teamStatsCsvFileName(team.name, filtered)` (§17).
- **Filtering semantics** (`filterMatches`, `teamSeason.ts`):
  - Competition and venue are applied first. Matches are then sorted by date ascending.
  - "Dates" keeps `from ≤ date ≤ to`, with empty bounds open and a reversed range swapped.
  - "Last N" keeps only *scouted* matches (a summary with at least one player action) after the competition and venue filters, and takes the last N by date.
  - The KPIs, trend, rotations, leaderboards and player table all use the **filtered** set.
  - Coverage (scouted / score-only / skipped / capped) is always computed over **all** loaded matches.
- **States**:
  - Loading: the text "Loading team stats…".
  - Error: `role="alert"` reading "Could not load team stats.", shown when `listFinishedMatches` rejects. A roster failure is ignored.
  - Empty: when **no loaded match is scouted** (even if score-only matches exist), the text "No scouted matches yet — scout a match to see team stats." This check ignores filters.
  - A filter that matches nothing: the dashboard still renders, with "0–0" and "—" values and empty sections. There is no dedicated empty state.
- **Validation & messages**: invalid URL params (an unknown comp, `range=last7`, a bad date) silently fall back to the defaults (`parseStatsFilter`).
- **Edge cases**:
  - "Record" counts every filtered match from `result`, including score-only and skipped matches. A draw (equal sets) counts as neither a win nor a loss.
  - Rates come from **summed counts**, not averages of per-match rates. Side-out is Σwon/Σtotal over matches with a summary.
  - Score-only matches (a summary but no actions) still contribute rally totals and rotations.
- **Tests that lock this in**:
  - `src/teams/stats/TeamStatsTab.test.tsx`: the coverage text "Based on 1 scouted match" and "1 skipped"; the leaderboard region "Top scorer"; the Season awards href; the empty state; the load error; print and CSV EU with the file name; Last 5 → Dates seeding From/To and keeping data; the competition filter producing "Showing 1 of 2 matches".
  - `statsFilterParams.test.ts`: round-trip, open-ended dates, defaults on garbage, empty params for the default.
  - `teamSeason.test.ts`: coverage counts, the cap at 60, filtering, open and reversed ranges, aggregation, player rows, empty input giving null rather than NaN.
  - `rosterIndex.test.ts`.
  - `src/i18n/italianLabelBudget.test.ts`: Italian KPI tile labels `teams.stats.{record, sideOut, breakPoint, attackEff, receptionPos, acesServeErrors, oppErrors}` must stay at or below max(English length × 1.5, 12) characters.

### 5. Trend chart (`src/teams/stats/TeamTrendChart.tsx`)

- **Purpose**: shows side-out, attack efficiency and reception positivity match by match.
- **Elements**:
  - An inline SVG that is `aria-hidden`. Its viewBox width is 640 when `(min-width: 640px)` matches and 320 otherwise, so the text keeps its nominal size on phones. The height is 200.
  - The y axis runs from −50% to 100%, and values are clamped to that range.
  - Gridlines at 0% (solid) and at 50% and 100% (dashed), labelled "0%", "50%", "100%".
  - Three polylines: side-out `stroke-blue`, attack eff `stroke-orange`, reception + `stroke-green`. Null points are skipped, so the line joins across the gap.
  - Below each match, "W" (`fill-green-strong`) or "L" (`fill-red-strong`).
  - A legend `figcaption`: "Side-out %", "Attack eff.", "Reception +".
  - An `sr-only` table labelled "Trend data", with the columns Date, Opponent, Result (Won/Lost), Side-out %, Attack eff., Reception +.
- **States**: with fewer than 2 points (matches with a summary in the filtered set), it shows "Scout at least two matches to see a trend."
- **Edge cases**:
  - Points are only matches with a summary, in date order.
  - "won" means `setsUs > setsThem`.
  - Print keeps colours (`[print-color-adjust:exact]`).
- **Tests**: `statsComponents.test.tsx` checks that the accessible table "Trend data" exists.

### 6. Rotation bars (`src/teams/stats/RotationBars.tsx`)

- **Elements**:
  - Rows R1…R6 in **numeric order 1–6**.
  - Each row has a label "R1", a bar (`role="img"`, `aria-label` "Rotation 1: 4 won, 2 lost"), a green segment for won and a red segment for lost. Widths are proportional to the largest won+lost of any rotation.
  - The text "won–lost" sits on the right.
  - Below the rows: "Best rotation: N" and "Weakest rotation: N". Each is omitted when null.
- **Rule**: best and weakest are judged by **win rate** won/(won+lost) over rotations that have rallies. On a tie, the first rotation (lowest number) wins. The match report instead uses the **won−lost difference**.
- **Tests**: `statsComponents.test.tsx` covers "Best rotation: 1" and "Weakest rotation: 2". `teamSeason.test.ts` checks that best is 4 and weakest is 5 for the fixture.

### 7. Leaderboards (`src/teams/stats/Leaderboards.tsx`)

- **Elements**:
  - One card (`section`, `aria-labelledby`) per season award, in the order `AWARDS_FOR.season`: Top scorer, Best attacker, Best server, Best receiver, Best blocker, Best defender, Best setter, Most improved, Ever-present, MVP.
  - Titles come from `labels.awardTitle[id](gender)`. They are gendered through `teamGender(team)`, which defaults to `'mixed'`.
  - Each card lists ranks 1–3. **Every** player tied at rank 3 or better is shown. Each line shows "1.", the name and the value: "#7 Ana" plus "+40% att. eff. · 40 att." (attempts only when not null).
  - The name links to `/teams/:teamId/players/:playerId` **only for current roster players**. Former players are plain text.
  - "Not enough data: <names>" (small) lists players below the minimum attempts.
  - A card with no ranked players shows "No data yet".
- **Data**: `rankAward(id, 'season', filtered)`. The leaderboards follow the stats filters.
- **Names**: from the newest roster snapshot in the matches that lists the player (`latestRosterIndex`), merged with the current roster (`withCurrentRoster`, which marks `current` and adds players who never played). An unknown player shows "Unknown player".
- **Tests**: `statsComponents.test.tsx` covers top 3, links only for current players, the not-enough-data line, all ties at rank 3, and "No data yet".

### 8. Player stats table (`src/teams/stats/PlayerStatsTable.tsx`)

- **Elements**:
  - Columns: "#"; "Name" (a row header that links to the player card for current players); "MP"; "Points"; "Errors"; "MVP" (per-match average, 1 decimal); "Att. eff."; "Serve eff."; "Rec. +".
  - Then six **rating** columns: "Serve", "Reception", "Attack", "Block", "Set", "Defence". Each shows a 1–10 rating with 1 decimal, or "—" when there are fewer than 15 attempts or no data (`matchRatings`, `src/players/matchRating.ts`).
- **Actions → results**:
  - The headers "#", MP, Points, Errors, MVP, Att. eff., Serve eff. and Rec. + are buttons.
  - "#" sorts ascending by number (null → 999).
  - The other buttons sort descending, with nulls last.
  - The active column shows an `ArrowDown` icon and `aria-sort="descending"`.
  - Rating columns are not sortable.
  - The default sort is by number.
- **Weak flags**: Att. eff. below 0 and Rec. + below 40% turn red (`WEAK_CLASS`). Season errors are deliberately **not** flagged.
- **Rows**: only players with at least one action in a filtered match that has a summary.
- **Tests**: `statsComponents.test.tsx` (sorting by Points puts Bea first). The CSV is covered by `teamStatsCsv.test.ts`.

### 9. Team stats print output

- Hidden in print: the filter bar, the Export menu and the Season awards link. Also hidden: the `TeamPage` section tabs (`print:hidden`) and the app header, nav and footer (global print CSS).
- Shown only in print: the heading "<team> · Season <season>" and "Printed <date>".
- `break-inside-avoid` applies to the trend, rotations, leaderboard cards and stat tiles. The player table starts a new page. Chart colours print exactly.

### 10. Awards page container (`src/awards/AwardsPage.tsx`, routes `/teams/:teamId/awards` and `/teams/:teamId/matches/:matchId/awards`)

- **Purpose**: loads data, owns state (config, photos, logos, palette, name style, story toggle, recording), autosaves, gates photos by consent and switches between Prepare and Present.
- **Who can see / do what**:
  - Team admins only. The code calls `getTeam`; a missing team, or a user who is not `isTeamAdmin`, gets the **not-found** state (the same screen as a missing team or match).
  - This is a full-screen route outside `AppShell`, with no app nav.
  - Page title: "Season awards" or "Match awards".
- **Load sequence**:
  1. Team and admin check.
  2. In parallel: the roster (`[]` on failure); the finished matches (season scope); the match (match scope); the saved season awards (season scope).
  3. Match scope, match missing → not-found. Match not finished → the not-finished state.
  4. `await ensureCardFonts()`. A failure is ignored and the system font is used.
  5. Initial config: for match scope, `match.awards`; for season scope, `teams/{id}/awards/season`; otherwise `EMPTY_AWARDS`.
  6. Build:
     - `people` (roster index from the matches plus the current roster)
     - `consented` (roster players for whom `photoAllowed(p, now)`)
     - `adults` (roster players whose age from `dob` is 18 or more).
- **States**:
  - Loading: "Loading awards…".
  - Not found: title "Awards not found", message "The team or match may not exist, or you don't have access.", back link "Back to team" → `/teams/:teamId`.
  - Not finished (match scope): title "Match awards", message "Awards are available once the match is finished.", back link "Back to match" → the match page.
  - Error (not a permission error): `role="alert"` reading "Could not load awards." plus a **Try again** button, which resets to loading and retries.
  - Ready: Prepare (§11) or Present (§18).
- **Autosave**:
  - Every Prepare action marks the config dirty.
  - The save indicator shows "Saving…", or "Offline — will sync" when `navigator.onLine === false`.
  - The save runs after an **800 ms debounce**. Writes are not awaited by the UI.
  - On success the indicator shows "Saved". On failure it shows "Could not save" in red. Only the newest write may change the indicator (a sequence counter).
  - The initial load never saves.
  - A pending edit is flushed on `pagehide` and on unmount.
  - Season scope uses `setDoc(clubs/{c}/teams/{t}/awards/season, {picks, custom, order, updatedBy: uid, updatedAt: serverTimestamp()})`.
  - Match scope uses `updateDoc(match, { awards: {…, updatedBy, updatedAt}, updatedAt })`.
- **Derived data**:
  - `awards = resolveAwards(scope, matches, config, people, teamGender(team))` (§20).
  - The heading is "Season <season>" or "vs <opponent> · <short date>". The date uses `formatDate(iso, 'short')`, e.g. "12 Oct 2026".
  - A card model is built for each award with a winner: the award title, the name styled by name style, the jersey number, the stat line (stats choice only) or the custom note, the footer (= heading), the team name and the club name (from the club doc, `club?.name ?? ''`).
  - Cards for the presentation are the `revealable` awards: not hidden and with a winner.
  - The story slides are built by `buildStory`. The intro title is "Season <season>" or "vs <opponent>", and the subtitle is the team name.
  - Each award's colours are the palette colour of the scene in which it is revealed (`colorIndexForAward`). A single exported PNG therefore matches the colour it has in the presentation, which depends on whether the story is included.
- **Photo gating**:
  - `photoAllowedKeys` contains the award keys whose winner is in `consented`. Former players and awards without a winner are excluded.
  - `gatedArt` returns the photo and cut-out only for allowed keys. Otherwise both are null, and the card shows the jersey number.
  - `photosForWinners` keeps a photo or cut-out only while the award is still won by the player it was added for (`photoOwners`). If the coach switches the winner, the old face never appears under the new name.
- **Image memory**:
  - Photos, cut-outs, the background and logos are canvases held in memory only.
  - A replaced or removed canvas has `width = 0`.
  - On unmount, every photo, cut-out, background and logo canvas has its width set to 0.
  - Leaving the page aborts a running recording.
- **Share guard**:
  - Before exporting winner cards, a single PNG, the summary or the video, the page checks `exportIncludesMinors`: true when any exported winner is not a known adult. A missing dob or a former player counts as a possible minor.
  - It also checks `needsShareWarning()`, which is true until the coach confirms once in this browser session (sessionStorage `vcb.awards.shareWarned`, or always when storage is blocked).
  - When both are true, a `ConfirmDialog` (`role="alertdialog"`) opens: title "Share award cards", message "You're about to share images of minors. Share them only within the team.", confirm "Share". Confirming marks the session as warned and runs the export. Cancel aborts.
  - When every exported winner is an adult, the export runs straight away.
- **Exports** (all on the device; §17 has file names):
  - **Winner cards**: one PNG per revealable award, rendered at `t = 1`, then one `shareOrDownload(files, heading)` call. On failure the alert reads "Could not export the cards. Please try again."
  - **Single PNG**: the same for one key.
  - **Summary card**: the last story slide (the summary) rendered fully with reduced motion. On failure: "Could not export the summary card. Please try again."
  - **Record video**: opens §16. On failure (not an abort): "Could not record the video. Please try again."
- **Close**: season scope → `/teams/:teamId?tab=stats`. Match scope → `/teams/:teamId/matches/:matchId`.
- **Tests that lock this in**: `src/awards/AwardsPage.test.tsx` covers:
  - the debounced season save, with exact payload and uid
  - the initial load never saving
  - flushing on unmount
  - a retryable error that is not shown as not-found
  - fonts loaded before the page shows
  - a second photo not freeing the first
  - the inline export error after the minors warning
  - leaving the page aborting a recording
  - the video shared only on a fresh tap
  - adult winners skipping the warning
  - a minor with data consent but no photo consent getting no photo slot
  - an adult getting the photo slot without consent
  - an unreadable logo showing an error and adding nothing
  - the unfinished match message
  - non-admins getting not-found
  - Present, then Escape returning to Prepare
  - the unit tests for `photoAllowedKeys`, `gatedArt`, `photosForWinners` and `exportIncludesMinors`

  `src/awards/awardsApi.test.ts` checks paths and payloads. `tests/rules/awards.rules.test.ts` checks rules: admin-only, only the `season` doc id, at most 5 custom awards, and the payload shape.

### 11. Awards Prepare (`src/awards/AwardsPrepare.tsx`)

- **Purpose**: choose the winners, the order and the custom awards, and set the card look. Export entry points live here too.
- **Elements**:
  - **Header**:
    - an `h1` "Awards" with the heading underneath
    - a save indicator `role="status"` with "Saved", "Saving…", "Offline — will sync" or "Could not save" (red)
    - an **Export** menu (`Share2` icon, blue outline), shown **only when at least one winner exists**, with the items "Winner cards (PNG)", "Summary card (PNG)" and "Record video"
    - a **Present** button (primary, `Play` icon), disabled when there are no revealable winners
    - a close button (ghost, `X` icon, `aria-label` "Close awards")
  - When nothing is revealable: the hint "Pick at least one winner to present or export cards."
  - A notice line `role="alert"` (red) for page-level errors: export, background, logo, recording, share.
  - The **Card settings** panel (`section aria-label="Card settings"`) contains:
    - **Palette** select, with optgroups "Presets" (Navy, Gold Night, Court Orange, Clean Light, Wrapped; localised names) and "Yours" (custom palettes, shown when there are any). Swatches of the selected palette sit next to it.
    - "New palette" (secondary), which opens §12 empty.
    - "Edit palette" (ghost), shown only when a custom palette is selected, which opens §12 with that palette.
    - A checkbox labelled "Include season story" or "Include match story".
    - "Background image": a native file input (`accept="image/*"`) with the hint "Don't use photos that show players." linked by `aria-describedby`. When a background is set, a ghost "Remove background" button appears.
    - "Names on cards" select: "Full name", "First name + initial", "First name", "Number only".
    - A **Branding** group (`role="group"`):
      - "Club logo": a file input. Once loaded it is replaced by a `LogoThumb` and an icon button "Remove club logo".
      - Each sponsor: a `LogoThumb` and an icon button "Remove sponsor N".
      - "Add sponsor logos": a `multiple` file input, disabled at 6, with the note "Up to 6 sponsors" at the cap.
      - A checkbox "Logos in original colours", unchecked by default, which means the logos are tinted single-colour.
    - A privacy note: "Photos and logos stay on this device and are forgotten when you leave."
  - The **award list** (`ol`), in the current resolved order. Each row is a `section` labelled by its title. It is `opacity-60` when hidden. A row contains:
    - A 108-px **CardThumbnail** (§21), shown only when the award has a winner.
    - The title (`h2`).
    - For stats awards, a **Winner** select. The first option, value "", reads "Stats' choice (#7 Ana Lopez)" or "Stats' choice (none)", followed by every person "#N Name". The people are sorted with current players first, then by number (null last). The select shows the picked player only when the award is *overridden*; otherwise it shows "Stats' choice".
    - For custom awards: the text "#N Name · note".
    - "No winner — pick one or hide" (orange), when the winner is null.
    - The stat line, e.g. "+40% att. eff. · 40 att." (stats choice only).
    - "Stats suggest: #7 Ana Lopez", when overridden and a suggestion exists.
    - "Runners-up: #9 Bea Smit, …": the next two ranked players.
    - A controls row:
      - a "Hide" checkbox (stats awards only)
      - ↑ and ↓ icon buttons ("Move <title> up" / "Move <title> down"); the first row's up and the last row's down are disabled
      - photo controls (§13–14) **only when the photo is allowed**; otherwise, if there is a winner, the note "No photo consent on file — the card shows the jersey number."
      - a "PNG" button (`Download` icon) when a card exists
      - "Remove" (`dangerGhost`) for custom awards
  - A **custom award** control:
    - A "+ Custom award" button (secondary), disabled when 5 custom awards exist.
    - It opens an inline form with:
      - "Award title": a text field, max 40.
      - "Player": a select with "Choose…" and the people list.
      - "Note": a text field, max 80. Under it sits the `HealthHint` "Don't record health, injury or medical information." (linked by `aria-describedby`).
      - "Add award" (submit, primary) and "Cancel" (ghost).
- **Actions → results** (all through `onAction`, then `applyPrepareAction`, §19):
  - Winner select → `{type:'pick', key, playerId | null}`.
  - Hide → `{type:'hide', key, hidden}`.
  - ↑ / ↓ → `{type:'move', key, dir}`. The whole current order is written.
  - Add award → `{type:'addCustom', title (trimmed), playerId, note (trimmed)}`. The form ignores the submit when the trimmed title or the player is empty. On success the form resets and closes. The new id is `c-<base36 timestamp>`, and it is inserted just before MVP.
  - Remove → `{type:'removeCustom', key}`.
  - Palette select → stored and applied right away (localStorage `vcb.awards.palettes` and `vcb.awards.palette`).
  - Story checkbox → localStorage `vcb.awards.story` (`'1'` or `'0'`, default on).
  - Names select → localStorage `vcb.awards.nameStyle`.
  - Background file:
    - The file is decoded in the browser (`createImageBitmap`, with EXIF orientation) and scaled to a long side of at most 1920 px.
    - The previous background canvas is freed.
    - On error: "Could not load that background image."
    - The file input value is cleared after each pick, so the same file can be picked again.
  - Club logo / sponsor files:
    - Each logo is decoded, scaled to at most 512 px and has its background knocked out: when at least 3 corners share one opaque colour, pixels close to it become transparent. Transparent padding is then cropped.
    - Only the first 6 sponsor files are taken, and the total is capped at 6.
    - On error: "Could not load that logo." Nothing is added.
  - "Logos in original colours" → `mono = !checked`.
  - **Present** → switches to §18.
  - Export menu items → see §10. "Record video", when unsupported, stays a clickable **no-op** item with the hint "Video export isn't supported in this browser". It is not disabled.
  - PNG → single-card export, guarded by §15. **Hidden awards with a winner still show this button.**
  - Close X → navigates back (§10).
- **States**: the no-winners hint; the offline save state; error notices; a per-row cut-out status and error.
- **Validation & messages**: custom title ≤ 40 characters (`CUSTOM_TITLE_MAX`), note ≤ 80 (`CUSTOM_NOTE_MAX`), at most 5 custom awards (`MAX_CUSTOM_AWARDS`). The reducer refuses a 6th, the button is disabled, and the rules reject more than 5.
- **Edge cases**:
  - An unknown override player resolves to "Unknown player" without crashing.
  - Picking the suggested player explicitly is not "overridden": the stat line is kept and the select shows "Stats' choice".
  - Overriding drops the stat line, and the card shows no stat line.
  - A custom award's winner may be a former player. It then gets no photo, because former players are never consented.
- **Tests that lock this in**: `src/awards/AwardsPrepare.test.tsx` covers:
  - the suggestion, stat line and runners-up
  - pick, clear and hide actions
  - "Stats suggest" when overridden
  - the move buttons and the disabled first up
  - adding a custom award, and the button disabled at 5
  - no winners → Present disabled, the Export menu absent and the hint shown
  - the notice alert
  - the offline save text, and Present calling back
  - the palette switch and story toggle
  - saving a new palette and selecting it
  - the background hint
  - the no-consent note and the missing Add photo control
  - cut-out progress, then the error
  - the export menu items, with video showing the unsupported hint
  - branding upload, remove and colours toggle, and the sponsor cap at 6

  `awardsReducer.test.ts` and `resolveAwards.test.ts` cover the underlying logic.

### 12. Palette editor dialog (`src/awards/PaletteEditor.tsx`)

- **Elements**:
  - A `Dialog` titled "New palette" or "Edit palette".
  - "Palette name": max 40 characters, defaulting to "My palette".
  - "Colours" with the hint "Each slide takes the next colour; text turns white or dark automatically so it stays readable."
  - 4–5 colour inputs ("Colour N"), each with a trash button "Remove colour N" that is disabled at 4 colours.
  - "Add colour", disabled at 5. A new colour copies colour 1.
  - A "Preview" row of 9:16 mini tiles, each showing "7" in the accent colour and "wins" in the text colour, using the real `slideColors` contrast logic.
  - Footer: "Delete palette" (edit mode only, danger), "Cancel" and "Save palette" (disabled when the trimmed name is empty).
- **Actions → results**:
  - Colours are stored uppercase.
  - Save: a new palette gets the id `custom-<time><rand>`; editing keeps the id. The palette is then selected and the dialog closes.
  - Delete removes the palette and selects the first preset (Navy).
  - Cancel or close discards changes.
- **Defaults**: a new palette starts from the first 4 colours of "Wrapped".
- **Persistence**:
  - Custom palettes are kept per device in localStorage.
  - Invalid stored data falls back to the presets. A palette is valid with 4–5 `#RRGGBB` colours.
  - The legacy `vcb.awards.theme` key is migrated: a preset id is kept, and an old two-colour gradient becomes a custom palette named "My colours".
- **Tests**: `PaletteEditor.test.tsx` and `palette.test.ts` (contrast, cycling, accent fallback, preset readability, validation, persistence, migration).

### 13. Photo add / crop dialog (`src/awards/PhotoCropDialog.tsx`, opened from an award row)

- **Who**: only rows whose winner passes the photo gate (§10).
- **Elements in the row**:
  - "Add photo", or "Change photo" once a photo exists. It is a label wrapping a visually hidden file input (`ImagePlus` icon, blue).
  - "Remove photo", once a photo exists.
- **Dialog elements**:
  - Title "Position the photo".
  - The note "The photo stays on this device and is forgotten when you leave this page."
  - An error line (`role="alert"`) showing "Choose an image file." or "This image could not be opened."
  - A 280-px **circular canvas preview** labelled "Drag to position the photo". It accepts pointer drags, with `touch-none` and a grab cursor.
  - A "Zoom" range from 1 to 4, step 0.05.
  - "Cancel" and "Use photo". "Use photo" is disabled until the image is decoded.
- **Actions → results**:
  - Dragging moves the crop centre, clamped to the image.
  - Zoom shrinks the square crop.
  - Use photo renders a square crop of at most 1080 px and calls `onPhoto(key, canvas)`. The photo owner is recorded, the old canvas is freed and **any cut-out is dropped**.
  - Remove photo → `onPhoto(key, null)`, which also drops the cut-out.
  - Cancel closes the dialog without changes.
- **Edge cases**:
  - The bitmap is closed on unmount or when the file changes.
  - Adding a second photo for another award never frees the first.
- **Tests**: `PhotoCropDialog.test.tsx` (the non-image error, cancel, the "stays on this device" note), `photo.test.ts` (`fitSize`, `cropRect`, rejecting non-images) and `AwardsPage.test.tsx` (the second photo keeping the first alive).

### 14. Background removal / cut-out (inline in the award row; `src/awards/cutout/segment.ts`)

- **Who**: rows with an allowed photo.
- **Elements**:
  - "Remove background" (ghost). It is disabled while any cut-out is running.
  - While running: the status "Preparing on this device…" (`role="status"`).
  - On failure: the alert "Could not remove the background. The original photo is kept."
  - Once cut out: "Use original" (ghost).
- **Actions → results**:
  - "Remove background" lazy-imports `cutout/segment`. That module loads `@mediapipe/tasks-vision`, with the WASM from `/mediapipe` and the model from `/models/selfie_segmenter.tflite`, using the CPU delegate and IMAGE mode. All of this is same-origin.
  - The person mask becomes alpha (a smoothstep from 0.3 to 0.7), the image is cropped to the opaque bounds, and the result is stored as the cut-out.
  - "Use original" drops the cut-out.
  - A failed model load is retried on the next attempt.
  - "No person found in the photo" leads to the same error message.
- **Effect on cards**:
  - With a cut-out, the reveal card draws the player poster-style on the right, with the bottom 12% fading out in strips and no clip circle.
  - Without one, the photo sits in a circle.
  - The summary slide uses the cut-out if present, otherwise the photo.
- **Tests**: `cutout/segment.test.ts` (the mask-to-alpha mapping, nearest upsampling, bounds, retry after a load failure) and `cutout/csp.test.ts` (the CSP `script-src` includes `'wasm-unsafe-eval'` but not `'unsafe-eval'`, and there is no storage.googleapis or jsdelivr). `AwardsPrepare.test.tsx` covers progress and the error.

### 15. Minors' images share warning (`ConfirmDialog` in AwardsPage; `src/awards/shareWarning.ts`)

- Described in §10. It shows at most once per browser session, and only when the export includes at least one winner who is not a known adult.
- It applies to the winner cards, a single PNG, the summary PNG and starting a video recording.
- **Tests**: `shareWarning.test.ts` (once per session; still warns when storage is blocked) and `AwardsPage.test.tsx`.

### 16. Video recording and "Video ready" dialogs (in AwardsPage; `src/awards/exportVideo.ts`)

- **Recording dialog**:
  - Title "Recording video", body "Playing the story once on this device. Keep this tab open."
  - A `<progress>` from 0 to 1, labelled "Recording progress".
  - A footer "Cancel" button. Cancel and closing the dialog both abort the recording.
- **Recording behaviour**:
  - The fonts are loaded first.
  - An off-screen 1080×1920 canvas feeds `captureStream(30)` into a `MediaRecorder`. The MIME type is the first supported of `video/mp4;codecs=avc1`, `video/mp4`, `video/webm;codecs=vp9`, `video/webm`, at 6 Mbps.
  - The whole story plays once with fixed timings: intro 2000 ms, stat 3000, award title 1500, suspense 1500, reveal 4000, summary 4000.
  - The colour wipe between slides is included. The video has no progress bar or controls.
  - An abort rejects with `AbortError`; no message is shown and the dialog closes.
  - A drawing error stops the recorder and rejects, which shows "Could not record the video. Please try again."
- **Video ready dialog**:
  - Title "Video ready", body "The video is ready on this device. Share it with the team, or close to discard it."
  - Buttons "Close" (ghost) and "Share video" (primary).
  - **Share video** must be a fresh tap, because the browser share sheet needs a recent user gesture. It calls `shareOrDownload([file], heading)`. On failure: "Could not share the video. Please try again."
  - Close discards the video.
- **Availability**: `videoSupported()` requires `MediaRecorder`, `HTMLCanvasElement.captureStream` and a supported MIME type.
- **Tests**: `exportVideo.test.ts` (MIME preference, timings, abort, a drawing error stopping the recorder) and `AwardsPage.test.tsx` (abort on leave, share only on a fresh tap).

### 17. Exported files (CSV, PNG, video)

- **Match report CSV** (`reportCsv.ts`):
  - A UTF-8 BOM, then CRLF line ends, ending with a CRLF.
  - EU format: `;` separator and a decimal comma. EN format: `,` separator and a decimal point.
  - The header has 59 columns: Number, Name, then for each of the 7 skills "<Skill> att" and "<Skill> #", "+", "!", "-", "/", "=" (localised skill labels), then Attack eff, Serve eff, Reception +, Reception #, Points, Errors, Side-out, Break point.
  - One row per player, sorted by number. An unknown name is written as "?". Side-out and Break point are blank on player rows.
  - A final "Team" row holds the summed grade counts, the team attack eff, the serve eff of the merged serves, the team reception +, the reception # ratio, the summed points and errors, and the side-out and break-point ratios.
  - Ratios are written as decimals rounded to 3 places (`0.25`), not as percentages. Null is written as blank.
  - Text cells starting with `= + - @ TAB CR` get a leading `'` to block formula injection. Text containing `" , ; CR LF` is quoted with doubled quotes.
  - File name: `<date>-<opponent slug>-all.csv` or `-set<N>.csv`, e.g. "2026-10-18-Rivals-B-all.csv".
  - Header language follows the active UI language.
- **Team stats CSV** (`teamStatsCsv.ts`):
  - The same document format.
  - Columns: Number, Name, Matches, Points, Errors, MVP avg, Attack eff, Serve eff, Reception +, then "Rating serve", "Rating reception", "Rating attack", "Rating block", "Rating set", "Rating defence".
  - Rows follow `teamSeason` order (by number), **not** the on-screen sort.
  - File name: `<team slug>-stats-<first date>-<last date>.csv` over the filtered matches, or `-stats-empty.csv`.
- **Award PNGs** (`exportCards.ts`):
  - 1080×1920 PNGs.
  - File names: `award-<key>-<date>-vs-<opponent slug>.png` (match) or `award-<key>-season-<season slug>.png` (season).
  - The summary uses the key `summary`.
  - The video uses `award-story-…` with a `.mp4` or `.webm` extension.
- **Sharing** (`src/export/shareFile.ts`):
  - If `navigator.canShare({files})` and `navigator.share` exist, there is one share call with all files. A user cancel (`AbortError`) counts as cancelled, with no download.
  - Otherwise, or on another error, the files download one by one, 300 ms apart.
- **Tests**: `reportCsv.test.ts`, `teamStatsCsv.test.ts`, `exportCards.test.ts` and `MatchPage.test.tsx`.

### 18. Awards Present / ceremony (`src/awards/AwardsPresent.tsx`)

- **Purpose**: a full-screen, Wrapped-style presentation for a room or projector.
- **Elements**:
  - A fixed full-viewport overlay (`z-50`) whose background is the current slide's colour.
  - A centred, **letterboxed 9:16** canvas (1080×1920 drawn, `object-contain`, `aria-hidden`).
  - A DOM **progress bar** (`role="progressbar"`, "Presentation progress", `aria-valuemin` 1, `aria-valuemax` = number of scenes, `aria-valuenow` = current scene + 1). It has one segment per scene (colour). An award's three steps fill its segment in thirds. The bar is drawn in the slide's text colour at 25% alpha with a full-alpha fill. It is **not** part of exports.
  - Two invisible half-width tap zones: "Previous" on the left half and "Next" on the right half.
  - Top-right round controls: "Previous slide", "Next slide", "Fullscreen", "Exit presentation". They auto-hide (fade to opacity 0) after 2 s without pointer movement, and any pointer move shows them again.
  - An `sr-only` `aria-live="polite"` status announcing each slide:
    - intro: "Season 2026-27 — U17"
    - stat: "This season: 7 wins out of 10 matches"
    - title and suspense: "Best server"
    - reveal: "Best server: Ana L."
    - summary: "Winners: Best server — Ana L., MVP — Bea S."
- **Keyboard**:

  | Keys | Action |
  |---|---|
  | Space, ArrowRight, PageDown | next (`preventDefault`) |
  | ArrowLeft, PageUp | back |
  | f, F | toggle fullscreen |
  | Escape | exit to Prepare |

- **Gestures**: tap or click the right half for next, the left half for back.
- **Behaviour**:
  - The index is clamped: the show stops on the summary, and back stops at the first slide.
  - The Screen Wake Lock is requested on mount and when the page becomes visible again, and released on unmount, including a lock that resolves after unmount.
  - Fullscreen uses `requestFullscreen` on the root, or `exitFullscreen` when already fullscreen.
  - Each slide runs one `requestAnimationFrame` loop that draws to the canvas. React state is never set per frame, and the loop stops when the frame is final.
  - `prefers-reduced-motion: reduce` makes each slide draw its final frame (§19), and the suspense slide stops pulsing.
  - Runners-up are never shown, because only winners are in the cards.
- **States**: renders nothing when there are no slides. That cannot happen in practice, because Present is disabled without winners.
- **Tests**: `AwardsPresent.test.tsx` (announcements and keyboard, ending on the summary, Escape exit, the number of progress segments and their filling, `object-contain`, wake lock release after unmount, no runners-up) and `AwardsPage.test.tsx` (Present, then Escape).

### 19. Story slides and canvas renderer (`src/awards/story/*`, `src/awards/card/*`)

- **Slide list** (`buildStory`):
  - If the story is included: `intro` (title "Season X" or "vs Opponent", subtitle = team name), then one `stat` slide per story stat.
  - Then, per revealable award: `awardTitle` → `awardSuspense` → `awardReveal`, all three in the same colour.
  - Then `summary`, if there is at least one award.
  - Each scene takes the next palette colour index. With zero awards there is no summary.
- **Story stats** (`storyStats`), positive-only:
  - **record**:
    - Match scope: kicker "Final score", value "3–1" (big = sets us, suffix "–them"), caption "vs <opponent>", detail = the set scores "25–20 · …" or null.
    - Season scope: kicker "This season", big = wins, caption "N win(s) out of M match(es)", detail "Sets a–b". The slide is **skipped when there are no wins**.
  - **strength**: the larger positive margin of side-out above 50% (kicker "Side-out", caption "of rallies won on the opponent’s serve") or reception + above 40% (kicker "Reception", caption "of serves received on target"). The fallback is aces when there are more than 0 (kicker "From the service line", caption "ace(s)"). Otherwise the slide is skipped.
  - **rotation** (season only): the best rotation by win rate, shown only with at least 20 rallies. Kicker "Rotation N", value = win %, caption "of its rallies won — the strongest rotation", detail "W of R rallies".
  - With no matches there are no stats. Score-only seasons show only the record slide, with no NaN.
- **Slide drawing** (`renderStoryFrame(ctx, slides, index, elapsedMs, deps, reduced, prevIndex)`, a pure canvas function):
  - **intro** (1200 ms):
    - The background is the slide colour plus a soft accent disc, with the optional background image at 35% alpha, cover-fit.
    - A header row.
    - The title punches in word by word (scale 1.15 → 1 with `easeOutBack`, plus a fade) when it has 4 or fewer words and each fits at 170 px. Otherwise it wraps and shrinks, up to 4 lines. The last line is in the accent colour.
    - The subtitle fades in.
    - A sponsor row.
  - **stat** (1600 ms): the kicker in uppercase accent; the big number **counts up** from 0 (`easeOutCubic` over the first 70%); the caption slides up (up to 3 lines); then the detail line (up to 2 lines); then the sponsor row.
  - **awardTitle** (0 ms): a title card with the award title centred (up to 3 lines) on a radial accent glow, a header row and a sponsor row.
  - **awardSuspense**: the same card with the glow pulsing in a 1600 ms loop. It never reports "done" unless motion is reduced.
  - **awardReveal** (`CARD_DURATION_MS = 3500`): `drawAwardCard` with these beats:

    | t range | Beat |
    |---|---|
    | 0.00–0.20 | background |
    | 0.20–0.45 | title slides up |
    | 0.45–0.70 | photo or number circle scales in with an overshoot and a light sweep, or the cut-out slides up |
    | 0.70–0.85 | name appears letter by letter |
    | 0.85–1.00 | stat line fades in, plus confetti |

  - **summary** (600 + 80 × cards ms):
    - The title "Winners" in accent at 120 px.
    - A 2-column grid (centred when there is one card) of circles holding the cut-out, the photo or the jersey number. They pop in 80 ms apart. Under each circle: the award title (muted) and the winner name.
    - A header and a sponsor row.
  - When the colour changes, the previous slide's background is **wiped away left to right over 250 ms**. The frame does not report done during the wipe.
  - Reduced motion, or a zero duration, draws the final frame (`t = 1`), with no confetti and no overshoot.
- **Award card layout** (`drawAwardCard`):
  - **Header row**: the club logo, if set, *replaces* the club name. The left side shows "CLUB · TEAM" in uppercase; with no club name it shows only "TEAM". The right side shows the footer (the heading) in uppercase.
  - The **award title** is big, left-aligned, up to 3 lines, in the accent colour.
  - The **player** is on the right: either the photo in a circle with a 14-px text-coloured ring and the jersey number when there is no photo, or the cut-out poster.
  - The **lower third** is one row: the name on the left (800 weight, up to 2 lines, up to 110 px) and the stat line or custom note on the right (muted, 1–2 lines).
  - The optional **sponsor row** sits at y 1740–1860 under a divider at 1712. Content stays above the divider.
  - Logos are single-colour (the slide's text colour) unless "original colours" is on. They are sized by visual weight, each at most 40% of the row width.
- **Colours** (`slideColors(palette, i)`):
  - bg = `colors[i mod n]`.
  - text = white or `#0F172A`, whichever contrasts more.
  - accent = `colors[(k + 2) mod n]` if its contrast is at least 3:1, otherwise the text colour.
  - muted = white at 78% or ink at 72%.
  - Every preset meets text contrast of at least 4.5 and accent contrast of at least 3.
- **Text fitting** (`fitBlock` / `fitFontSize`): the font shrinks to as little as 40% of the maximum size, then wraps, then gets an ellipsis. No text line exceeds the 920 px text area or leaves the card. With sponsors, no text enters the sponsor row.
- **Determinism**:
  - Confetti uses a seeded PRNG (`mulberry32(seedFrom(card.key))`), and particles are a pure function of progress.
  - The same `t` produces identical drawing calls, which both PNG and video rely on.
  - Font family string: `Inter, system-ui, sans-serif`. `ensureCardFonts()` preloads the Inter weights and sizes used.
- **Tests**: `drawSlide.test.ts`, `drawAwardCard.test.ts`, `branding.test.ts`, `cardTimeline.test.ts`, `confetti.test.ts`, `wrapText.test.ts`, `fitName.test.ts`, `buildStory.test.ts`, `storyStats.test.ts`, `storyStatsItalian.test.tsx` (Italian kicker "Risultato finale", caption "contro Rivals") and `storyPref.test.ts`.

### 20. Award rules and resolution (`src/awards/awardRules.ts`, `resolveAwards.ts`, `awardsReducer.ts`, `matchMvp.ts`)

These are not screens, but they decide what every awards screen and leaderboard shows.

- **Awards per scope**:
  - match: `topScorer, attacker, server, receiver, blocker, defender, setter, mvp`
  - season: the same plus `mostImproved, everPresent`, with `mvp` last.
- **Only scouted matches count**: a summary with at least one player action. Each player's appearances are matches where they have actions, oldest first.
- **Minimum attempts** (match / season):

  | Award | Match | Season |
  |---|---|---|
  | attacker | 8 | 30 |
  | server | 8 | 30 |
  | receiver | 8 | 30 |
  | defender | 6 | 25 |
  | setter | 10 | 40 |

  Players below the minimum go to "not enough data".
- **Metrics and tie-breaks**:

  | Award | Metric | Tie-break |
  |---|---|---|
  | topScorer | points > 0 | fewer errors |
  | attacker | attack eff `(# − = − /)/att` | more kills |
  | server | serve eff `(# − =)/att` | more aces |
  | receiver | `(# + +)/att` | more `#` |
  | blocker | block `#` count ≥ 1 | fewer `=` + `/` |
  | defender (D + F) | quality → displayed as "rating x.x" = 1 + 9q | more attempts |
  | setter (E) | quality → displayed as "rating x.x" = 1 + 9q | more attempts |
  | mvp | mean `mvpScore` | fewer errors, then more points |
  | mostImproved | mean MVP score of the last third minus the first third; needs ≥ 6 matches; positive only | last-third score |
  | everPresent | matches played | more actions |

  - Quality q = Σ(count × weight) / attempts, with weights `# 1, + .75, ! .5, - .25, / 0, = 0`.
  - `mvpScore = points − errors + 0.5 × Σ attempts × (quality − 0.5)`.
  - Season MVP requires playing at least ⌈scouted/2⌉ matches.
  - Full ties share a rank.
- **Stat line text**:

  | Example | Award |
  |---|---|
  | "+40% att. eff." | attacker |
  | "+12% serve eff." | server |
  | "65% rec. +" | receiver |
  | "3 blocks" | blocker |
  | "rating 7.2" | defender, setter |
  | "6.2 MVP pts" / "…/match" | MVP (match / season) |
  | "12 pts" | top scorer |
  | "+1.4 MVP pts/match" | most improved |
  | "9 matches" | ever-present |

  When attempts apply, " · N att." is appended.
- **Resolution**:
  - The winner is the pick when set, else the top-ranked player.
  - The suggestion is the top-ranked player. Runners-up are the next two.
  - `overridden` = a picked player that differs from the suggestion. The stat line is shown only when not overridden.
  - Custom awards resolve to their player, with the note.
  - Order = the saved order (valid keys only), followed by `defaultOrder` (stats awards except MVP, then customs, then MVP) for any missing keys.
  - `revealable` = not hidden and has a winner.
- **Reducer**:
  - A pick or hide entry that returns to the defaults (null player and not hidden) is deleted.
  - Move swaps neighbours and writes the full order. Moving past either end only writes the order.
  - Add custom inserts the new award before MVP. Remove custom drops it from the order.
- **matchMvpLabel**: used on the Home page's recent results, outside this area. It returns the saved MVP pick, or the computed one, as "#N First I.". A hidden pick returns null, and so does a match with nothing scouted.
- **Tests**: `awardRules.test.ts`, `resolveAwards.test.ts`, `awardsReducer.test.ts`, `matchMvp.test.ts`.

### 21. Card thumbnail and logo thumbnail (`src/awards/CardThumbnail.tsx`, `src/awards/LogoThumb.tsx`)

- **CardThumbnail**: a static 108-px-wide preview at 9:16. It draws `drawAwardCard` at `t = 1` with reduced motion, scaled. It passes only the photo, cut-out and background, so **branding (club logo and sponsors) is not drawn in the thumbnail**. It is `aria-hidden` and uses `rounded-sm shadow-card`.
- **LogoThumb**: a 48-px contain-fit preview of a logo canvas. It is `aria-hidden`.
- **Tests**: none directly. Behaviour is indirectly covered through Prepare.

### 22. Links into reports from other areas (noted only)

- `src/players/PlayerMatchStatsSection.tsx`, on the player card: in the per-match table, each opponent name is a link to `/teams/:teamId/matches/:matchId` (that match's report). It uses the same `fmtEff` and `fmtPct` formatters. The player card itself is covered by another inventory.
- `src/home/HomePage.tsx`: the recent-results block shows the match MVP from `matchMvpLabel`.

---

## Must-keep invariants

1. **The report reads the stored report.** A finished match with `match.report` renders without subscribing to events. Only live matches, or finished matches without `report`, replay events (`MatchPage.test.tsx`).
2. **Report scopes:** `buildReportData` stores `all` = `computeStats(state, {})` and `bySet[n]` = `computeStats(state, {set: n})` for every set with rallies or actions. The Set filter lists exactly those sets plus "All".
3. **KPI formulas, surfaced as-is:**
   - Side-out % = rallies won when the opponent served, divided by those rallies.
   - Break point % = rallies won when we served, divided by those rallies.
   - Reception + = (R# + R+) / R attempts.
   - Attack eff = (A# − A= − A/) / A attempts.
   - Serve eff = (S# − S=) / S attempts.
   - Aces = S#. Serve errors = S=.
   - Opp. errors = rallies with reason `oppError`.
   - Every ratio is null (shown "—") when the denominator is 0, never NaN.
4. **Points and errors** come from `rallyOutcome`. A point is `#` on Serve, Attack or Block. An error is `=` on any skill, or `/` on Attack or Block.
5. **Number formatting:**
   - `fmtPct` gives a whole percent, using the locale's decimal separator rules, or "—".
   - `fmtEff` adds a leading "+" when the rounded value is above 0.
   - The team table shows MVP and ratings with 1 decimal (`formatNumber`).
   - Numbers use `tabular-nums`.
6. **Red "weak" flags use one source** (`statFlags.ts`) across the live panel, the report and team stats:
   - attack eff below 0
   - reception + below 40%
   - errors of 3 or more **per match** (report only; season totals are never flagged)
7. **Grade bar colours and order:** segments in the order `# + ! - / =`, coloured `#` green, `+` light green, `!` neutral, `-` light orange, `/` stronger orange, `=` red. Widths are proportional to count/attempts.
8. **Report ordering rules:**
   - Players are sorted by jersey number.
   - The report's rotation grid is in the order 1, 6, 5, 4, 3, 2, with the weakest rotation (lowest won−lost, lowest number on a tie) highlighted red.
   - The stats tab's rotation bars are in the order 1–6, with best and weakest chosen by win rate.
9. **Timeout effects** count the next up to 5 rallies of that set from the timeout. The section is hidden when there are none.
10. **Source note:** the tapped and text percentages are rounded independently. "Imported from DataVolley" appears whenever there are imported actions. The note is hidden when there are 0 actions.
11. **Print:**
    - Hidden: the app header, nav and footer, the back link, Delete, the action bar, the Set select and the stats filter bar.
    - Shown in print only: "Set N only" when filtered, and the stats print heading with the "Printed <date>" line.
    - Grade bars and rotation and trend colours print exactly.
    - Player rows never split across pages, and the team stats player table starts on a new page.
12. **CSV contract (both exports):**
    - Starts with a BOM and uses CRLF line ends.
    - EU = `;` with a decimal comma. EN = `,` with a decimal point.
    - Numbers are rounded to 3 decimals, ratios are written as decimals, and null is blank.
    - Formula-injection guard: a leading `'` before `= + - @ TAB CR`.
    - RFC 4180-style quoting of `" , ; CR LF`.
    - The match CSV has 59 columns and a final "Team" row.
    - The exported scope equals the report's selected set.
    - File names follow §17 exactly. The two menu items are labelled "CSV · Excel (Belgium/EU)" and "CSV · Excel (English) / Sheets".
13. **Stats tab access:** the tab exists only for team admins (or club admins). `?tab=stats` for a non-admin shows Roster.
14. **Stats URL contract:**
    - Params `comp`, `ha`, `range` (`last5` | `last10` | `dates`), `from`, `to`. Defaults produce no params.
    - Garbage falls back to the defaults.
    - Updates use `replace` and keep `tab`.
    - Leaving the tab clears the filter params.
    - Choosing "Dates…" seeds from/to with the earliest and latest date of all loaded matches.
15. **Stats filtering semantics:**
    - "Last N" means the last N *scouted* matches after the competition and venue filters.
    - Date bounds may be empty (open-ended), and a reversed range is swapped.
    - Coverage counts all loaded matches. The empty state ("No scouted matches yet…") ignores filters.
    - The 60-match cap message appears when 60 docs are loaded.
16. **Season aggregation uses summed counts**, never averages of per-match rates. Record counts every filtered match from `result`, and draws count as neither a win nor a loss.
17. **Leaderboards:** one card per season award in `AWARDS_FOR.season` order, with top 3 including all ties at rank ≤ 3, "· N att." when attempts apply, "Not enough data: …" and "No data yet". Names link to the player card only for current roster players.
18. **Player table:** clickable sort headers (# ascending; stat columns descending with nulls last; `aria-sort`), default sort by number, rating columns not sortable, ratings shown only with at least 15 attempts.
19. **Award rules** (§20) stay exact: the awards per scope; MVP last by default; the minimum attempts; the metrics, tie-breaks, shared ranks and season MVP participation rule; most improved requiring at least 6 matches and a positive change; stat line wording.
20. **Resolution semantics:**
    - "Stats' choice" is the default option.
    - An override equal to the suggestion is not an override.
    - An override hides the stat line and shows "Stats suggest: …".
    - Runners-up (ranks 2–3) are shown **only in Prepare**, never in Present, cards or exports.
    - Hidden awards and awards without a winner are excluded from the presentation, "Winner cards" and the summary.
21. **Custom awards:** at most 5 (UI, reducer and rules), title ≤ 40 characters, note ≤ 80 characters, a player is required, and the health hint sits under the note. They are inserted before MVP and are removable.
22. **Awards access:** a non-admin, a missing team or a missing match shows "Awards not found". An unfinished match shows "Awards are available once the match is finished." with "Back to match". A non-permission load error is retryable.
23. **Autosave:**
    - Debounced by 800 ms. The initial load never writes.
    - Flushed on `pagehide` and on unmount. Writes are not awaited.
    - The indicator is Saved / Saving… / Offline — will sync / Could not save, and a stale write never shows "Saved".
    - Season awards go to `clubs/{c}/teams/{t}/awards/season`. Match awards go in the `awards` field of the match doc, with `updatedBy` and `updatedAt`.
24. **Photo consent gate:**
    - A photo or cut-out may appear only for a winner who is a **current roster player** and for whom `photoAllowed` holds: age 18 or over from a valid `dob`, or `photoConsent === true`. A missing or invalid dob counts as a minor, and the 18th birthday counts as adult.
    - Guardian data consent (`consent.given`) does **not** grant photo use.
    - Otherwise the card shows the jersey number, and the row says "No photo consent on file — the card shows the jersey number." with no photo controls.
25. **A photo belongs to the winner it was added for.** Changing the winner removes the photo and cut-out from cards. A new or removed photo invalidates its cut-out.
26. **Photos, cut-outs, background images and logos are never stored or uploaded.** They are not written to Firestore, localStorage or IndexedDB, or sent over the network. They are decoded in the browser, kept as in-memory canvases and freed (`width = 0`) on replace and on leave. The UI says "Photos and logos stay on this device and are forgotten when you leave." and the crop dialog says "The photo stays on this device and is forgotten when you leave this page."
27. **Background removal runs on the device**, with the MediaPipe WASM and model served same-origin (`/mediapipe`, `/models`). It is lazy-loaded on first use, and a failed load can be retried. The CSP keeps `'wasm-unsafe-eval'` without `'unsafe-eval'`. A failure keeps the original photo, with the stated message.
28. **Minors' share warning:**
    - Shown before winner cards, a single PNG, the summary PNG or a video recording, when any exported winner is not a known adult.
    - Shown once per browser session, and every time when storage is blocked.
    - An all-adult export skips it.
29. **Canvas rendering is independent of app CSS.** The cards, story slides, exported PNGs and video frames are drawn by pure canvas functions with palette hex colours and the font string `Inter, system-ui, sans-serif`. They use no CSS variables, Tailwind classes or dark-mode state. The app's theme and redesign must not change what the canvas draws.
30. **What the room sees is what is exported.** The same `renderStoryFrame` and `drawAwardCard` produce the live show, the PNGs (at `t = 1`) and the video. Drawing is deterministic for the same `t`. A single exported card uses the colour of the scene it is revealed in. The DOM progress bar and controls are never in exports.
31. **Card geometry and layout:**
    - 1080×1920 at 9:16, 60 px margins.
    - Header row: the club logo replaces the club name; "CLUB · TEAM" in uppercase on the left, the footer in uppercase on the right.
    - Title up to 3 lines. Name and stat on one row.
    - Sponsor row at the bottom (at most 6 logos, single-colour unless "original colours").
    - No text overflows the 920 px area or enters the sponsor row.
    **Superseded:** the canvas header and kicker are in sentence case, not uppercase (design doc §4.3, §9).
32. **Palette rules:**
    - Text is white or `#0F172A` by contrast.
    - The accent is the colour two steps later, if its contrast is at least 3:1, otherwise the text colour.
    - Presets meet text contrast ≥ 4.5 and accent contrast ≥ 3.
    - Custom palettes have 4–5 colours and a required name.
    - Per-device keys: `vcb.awards.palettes`, `vcb.awards.palette`, legacy `vcb.awards.theme` (migrated).
33. **Story rules:**
    - The order is intro, stats, 3 steps per award, then summary, with one colour per scene.
    - Stats stay positive: a winless season has no record slide; strength needs a positive margin, with an aces fallback; the rotation slide is season-only and needs at least 20 rallies.
    - The story toggle defaults to on and is stored in `vcb.awards.story`.
34. **Name style:** Full / First name + initial (default) / First name / Number only, stored in `vcb.awards.nameStyle`. "Number only" falls back to first name + initial when there is no number. It applies to cards, the show and exports.
35. **Present controls:**
    - Space / → / PageDown go next. ← / PageUp go back. F toggles fullscreen. Esc exits to Prepare.
    - Tapping the right or left half goes next or back.
    - Controls auto-hide after 2 s and reappear on pointer move.
    - The show is clamped at both ends.
    - The wake lock is held while presenting and released after.
    - Reduced motion shows final frames with no confetti or pulse.
    - The aria-live announcements use the exact wording in §18.
    - The progress bar has one segment per scene, and award steps fill it in thirds.
36. **Slide and video timings:**
    - Live show: intro 1.2 s, stat 1.6 s, reveal 3.5 s, suspense pulse 1.6 s, summary 0.6 s + 80 ms per card, colour wipe 250 ms.
    - Video: 2 / 3 / 1.5 / 1.5 / 4 / 4 s, at 30 fps and 6 Mbps, MIME preferring MP4 then WebM.
37. **Video sharing needs a fresh tap.** Recording ends in a "Video ready" dialog whose "Share video" button opens the share sheet. Cancel or leaving the page aborts the recording silently.
38. **Fonts load before the first draw** (`ensureCardFonts`). A font failure never blocks.
39. **Close targets:** season awards → `/teams/:id?tab=stats`. Match awards → the match page. The stats tab links to season awards, and the finished match page links to match awards.

---

## Current UX pain points / redesign opportunities

*Observations only. These are not requirements.*

- **Label inconsistency across views:**
  - "Attack eff." (report KPI), "Att. eff" (report column) and "Att. eff." (stats table).
  - "Rec +" versus "Rec. +".
  - "Opp. errors" (report) versus "Points from opp. errors" (stats).
  - "Print / PDF" sits in two differently styled Export menus: a blue outlined trigger on the match page, and a plain bordered trigger on the stats tab.
- **Rotation views disagree:**
  - The report orders rotations 1, 6, 5, 4, 3, 2 and judges the weakest by won−lost.
  - The stats tab orders them 1–6 and judges best and weakest by win rate.
  - A coach comparing the two can see different "weakest" rotations.
- **The report table is wide** (11 columns) and scrolls horizontally on phones with no sticky player column. The grade bars are `aria-hidden`, so screen-reader users get only attempt counts, with no grade breakdown.
- **The set filter is a small native select** placed apart from the header. On screen, nothing shows that a single set is being viewed, except the changed numbers (the "Set N only" label is print-only).
- **Source note percentages** are rounded on their own and can sum to 99% or 101%.
- **Destructive action placement:** "Delete match" sits next to the title on finished matches, near everyday actions.
- **The match page load error** has no retry button, while awards and the team page do have one.
- **Stats filters:**
  - Native selects with inline labels and no "reset filters".
  - A filter that matches nothing renders an all-dash dashboard instead of an empty state.
  - The empty state ignores filters.
- **The team stats CSV ignores the on-screen sort** and always uses number order.
- **The trend chart** has no hover or point detail. Null values silently join across gaps. The x axis shows only W/L, with no dates or opponents (those are in the sr-only table only).
- **The Prepare settings panel is crowded.** One flex-wrapped card holds the palette, story toggle, background image, name style, branding and privacy note, with raw native file inputs.
- **The "Remove background" label is used for two different actions**: removing the card background image (settings panel) and cutting the player out of their photo (award row).
- **The "Record video" menu item, when unsupported,** stays clickable and does nothing. It shows a hint but is not disabled.
- **Hidden awards still show a "PNG" export button**, which exports a hidden card.
- **CardThumbnail omits branding**, so the club logo and sponsors appear only in the presentation and exports. The thumbnail is small (108 px), and there is no larger preview of a card before presenting.
- **Reordering uses arrow buttons only**: accessible, but slow for long lists.
- **The Winner select shows "Stats' choice"** even after the coach explicitly picks the suggested player (because that pick is not an "override"), which may read as if the pick was lost.
- **The share warning wording** says "images of minors" even when no photo is used, because any minor winner triggers it, even with only a name and number.
- **Present mode** gives no visible hint of the keyboard shortcuts. The tap halves cover the whole card. The controls fade after 2 s, so they are easy to miss on touch devices without hover or pointer movement.
- **The close button on Prepare is an icon-only ghost "X"**, and it is the only way back to the app because the route has no app shell.

---

## Open questions

1. Does the redesign scope include the **canvas output** (card, story, summary, video look)? Today it is fully decoupled from app CSS. Changing it alters the shared PNGs and videos and their tests (`drawAwardCard.test.ts`, `drawSlide.test.ts`). Should it be treated as out of scope for an "app UI" redesign?
2. Must the **print layout** stay as it is (same sections and page breaks), or only remain printable?
3. Should the two **rotation definitions** (report won−lost with the 1, 6, 5, 4, 3, 2 order, versus stats win rate with the 1–6 order) be kept as two views, or unified? Today the difference is behaviour, not just styling.
4. Is offering **PNG export for hidden awards** intended?
5. Should **CardThumbnail** show branding, as cards do?
6. Should the stats-tab **empty state** consider the active filters? And should the team CSV follow the on-screen sort?
7. Season awards always use all loaded finished matches (up to 60) and ignore the stats-tab filters, while the leaderboards on the stats tab follow them. Is this intended, and should the redesign make it visible?
8. Should the **"Record video" unsupported item** become a real disabled state, given that the test only asserts the hint text?
9. Should the match page **load error** gain a retry, to match the other pages?
10. Is the **CSV header language following the UI language** (Italian headers when the UI is Italian) intended for files shared with English-speaking staff?
