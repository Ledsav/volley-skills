# UI Redesign 4e: Reports, Stats and Awards Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the screens of area 05 in the v2 system to match the mockups: the match report (screen 5), the team Stats tab and the awards screens' chrome (Prepare, its dialogs, Present controls). Export moves to the Stats toolbar (§6.5), the match page load error gains Retry, the unsupported "Record video" item becomes really disabled (§4.6), and Present gains a visible "?" shortcuts hint (§8.5). Every inventory-05 invariant holds.

**Precondition:** plan 4c is merged. This plan uses its `OWN_CHROME` set in `TeamPage.tsx`, its pinned segmented team tabs and `useWindowScrolled()` (`src/layout/useWindowScrolled.ts`).

**Architecture:**
- **A menu main action.** `PageMainAction` gains a `menu` variant: the toolbar pill opens a menu instead of running one handler. The Stats tab publishes **Export** with Print / PDF and the two CSV items (§6.5 "Export CSV", no "⋯"; the menu keeps both formats and print, which are parity).
- **Report.** `MatchReport` gets a summary header (result word, sets won, one tile per set score), a Set segmented control, stat tiles, a borderless players table with a sticky name column and token grade bars (`GRADE_BAR_CLASS`, moved out of the scouting folder), and a note naming its rotation definition. `MatchPage` formats the eyebrow date and adds Retry.
- **Print.** One `@media print` block resets every dark token to its light value, so the report and stats print light whatever the theme. The `match-report` rules stay.
- **Stats.** The filter row is in the content: Range as a segmented control, Competition and Venue as check menus. Leaderboards become grouped lists with a bar per row in the band of the player's season rating for that skill. The trend chart goes monochrome (dash patterns).
- **Awards.** `AwardsRoot` makes every awards state forced-dark, like `ScoutRoot`. Prepare becomes a full-screen dark "sheet": a glass top bar (Close · title · Export, Present) and three steps (Choose, Photos, Preview) in a tabs segmented control. The custom award, palette editor, crop and recording dialogs are `Sheet`s.

**Not in this plan:**
- The canvas outputs: `src/awards/card/**`, `src/awards/story/**`, `renderStoryFrame`, `drawAwardCard`, `CardThumbnail`'s drawing, exported PNGs, the video and the training PDF (spec §9, the shared-outputs plan). Present's canvas, tap zones and progress bar are untouched.
- What the mockup shows but the text doesn't agree to (the text wins): the report's Team · Players · Rotations · Timeline segments (§8.5: the sections stay as titled groups, and print keeps all of them); its team skills table with Eff./Tot columns (no such section exists; §2 no new features); "per-player rows open on tap".
- A toolbar secondary row: none exists in the shell, so the stats filters sit at the top of the tab's content, as 4c did for the roster search.
- `teamStatsCsv` row order, CSV headers, file names and the share warning wording (parity, §4.6).

**Tech Stack:** React 18, TypeScript strict (noUnusedLocals/Parameters), React Router v7, Tailwind with CSS-variable tokens (no `dark:`), Vitest + Testing Library (jsdom), lucide-react.

**Spec:**
- `docs/superpowers/specs/2026-10-28-ui-redesign-design.md`: §8.5; §6.3 (sheets), §6.5 (Team · Stats; Match page (finished)); §4.6 (rotation views labelled differently, hidden awards keep PNG, disabled "Record video", match page Retry, CSV headers follow the UI language, Cancel asks "Discard changes?"); §10; §11; §12 (charts: keep the approach, restyle only); §9 only as the boundary.
- Parity contract: `docs/superpowers/specs/ui-redesign-inventory/05-reports-stats-awards.md` (39 invariants) and the README's cross-cutting rules.
- Visual target: `docs/design/design-system/mockups/screens-set.html` screen 5 (lines 268–297) and `screens-set.png`. Design rules: `docs/design/design-system/README.md` §1, §2.2 (data colours), §3, §5 (materials), §8.

## Global Constraints

**Parity**
- Every inventory-05 invariant holds. Existing tests change selectors or markup only. An assertion changes only where a task maps it to §4.6, §6.5 or §8.5.
- Canvas output is untouched: no file under `src/awards/card/`, `src/awards/story/` or `src/awards/cutout/` changes, and `CardThumbnail.tsx` / `LogoThumb.tsx` change at most their wrapper classes (invariants 29–31).
- Photo rules stay exactly: the consent gate (`photoAllowedKeys`, `gatedArt`, `photosForWinners`, `photoGate.ts`), memory-only canvases freed with `width = 0`, the minors' share warning, MediaPipe from `/mediapipe` and `/models` (invariants 24–28). `AwardsPage`'s logic changes only its wrappers and the two recording dialogs.
- Both rotation definitions stay (report: order 1, 6, 5, 4, 3, 2, weakest by won − lost; stats: 1–6, best/weakest by win rate) and are now labelled (§4.6).
- Weak flags still come from `statFlags.ts` only (invariant 6). URL params, `replace: true` and `tab` keeping are unchanged (invariant 14).
- Print (invariant 11): app header, nav, footer, the back link, the toolbar, the Set control and the stats filter row are hidden; "Set N only" and the stats print heading print; grade bars, rotation colours and trend print exactly (`print-color-adjust: exact`); report rows never split; the stats players table starts a new page. `PageHeader` stays a `div`, so the match title prints.

**Visual**
- Colour comes only from tokens. Legacy `navy`, `slate`, `border-border`, `bg-blue/…`, `text-blue-strong`, `stroke-blue`, `stroke-border`, `fill-slate`, `text-white`, `bg-black/…` are retired in every file this plan touches.
- Data colours only for data: grade bars, the weakest rotation, won/lost rotation bars, W/L letters, level bands on leaderboard bars, weak flags. Chrome (buttons, links, selection, the awards Export trigger, Add photo) is ink. Text in a data colour uses `-strong` (`src/theme/dataColourText.test.ts` stays green).
- Type roles: page title via `PageHeader`; section headers `text-title-3`; group captions `text-caption text-ink-2`; row titles `text-headline`; metadata `text-footnote text-ink-2`; figures `text-stat` (`StatTile`). Sentence case, never `uppercase`. `tabular-nums` on every number, score and date.
- Touch targets at least 44 px (`min-h-11`); grouped rows at least 52 px.

**Data, strings, gates**
- No new reads, writes, queries or indexes. No rules change, so `npm run test:rules` is not needed.
- Every new string goes in `src/i18n/en/*.ts` and `src/i18n/it/*.ts` (the shipped languages). `src/i18n/italianLabelBudget.test.ts` gains the pairs the tasks name.
- `vcb.awards.*` keys are unchanged; the Prepare step is not stored.
- Never commit `serviceAccountKey.json` (or `.enc`), `*.vsbackup`, private keys, `.env.local` or `reference/`. Commit only as the steps say. Don't push or merge, and add no dependency.
- Gates per group: `npm test`, `npm run lint` (0 errors), `npm run build`.

## Review Focus

1. **Export from the toolbar right after a filter change.** The CSV must hold the matches the screen now shows, never the previous filter's (the toolbar's handlers are ref-backed copies).
   - Pinned in Task 1 by "a menu main action runs the latest handler" and in Task 4 by "CSV from the toolbar exports what the current filter shows".
2. **Printing while the app is dark.** The report and the stats print dark-on-white, not light text on a white page.
   - Pinned in Task 3 by "print resets every dark token to its light value".
3. **A leaderboard whose leader is zero or negative** (every attacker below 0 % efficiency). No NaN or negative widths; the bars are empty and the values still read.
   - Pinned in Task 5 by "barFraction is 0 when the leader is not positive" and "a card whose leader is negative draws empty bars".
4. **"?" then Escape in Present.** The first Escape closes the shortcuts and stays in the show; the second goes back to Prepare.
   - Pinned in Task 8 by "Escape closes the shortcuts first, then exits".
5. **Switching steps while a background removal runs.** "Preparing on this device…" and the disabled button survive, and the result still lands on the right award.
   - Pinned in Task 7 by "a running cut-out survives a step change".

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/Button.tsx`, `src/components/Toolbar.tsx`, `src/layout/{PageChrome,ShellToolbar}.tsx`, `src/test/chromeProbe.tsx` (modify) | `buttonClassName`; the `menu` main action |
| `src/matches/report/gradeBarStyles.ts` (create), `src/matches/scout/gradeStyles.ts` (modify) | Report grade bar fills; `GRADE_CLASS` leaves the scouting file |
| `src/matches/report/MatchReport.tsx`, `src/matches/MatchPage.tsx` (modify) | v2 report; eyebrow date; Retry |
| `src/index.css`, `src/theme/printTheme.test.ts` (create) | Light print tokens |
| `src/teams/stats/TeamStatsTab.tsx`, `src/teams/TeamPage.tsx` (modify) | Stats chrome, filters, states |
| `src/teams/stats/leaderBars.ts` (create), `Leaderboards.tsx`, `RotationBars.tsx`, `PlayerStatsTable.tsx`, `TeamTrendChart.tsx` (modify) | Stats sections |
| `src/awards/AwardsRoot.tsx` (create), `src/awards/AwardsPage.tsx`, `src/App.tsx` (modify) | Forced-dark awards root; states; recording sheets |
| `src/awards/AwardsPrepare.tsx` (modify), `src/awards/prepare/{ChooseStep,PhotosStep,PreviewStep,CustomAwardSheet}.tsx` (create) | Prepare frame and steps |
| `src/awards/{PaletteEditor,PhotoCropDialog,AwardsPresent}.tsx` (modify) | Sheets; Present controls and shortcuts |
| `src/i18n/{en,it}/{matches,teams,awards}.ts`, `src/i18n/italianLabelBudget.test.ts` (modify) | Strings; budget pairs |

---

### Task 1: The menu main action

**Files:**
- Modify: `src/components/Button.tsx`, `src/components/Toolbar.tsx`, `src/layout/PageChrome.tsx`, `src/layout/ShellToolbar.tsx`, `src/test/chromeProbe.tsx`
- Test: `src/layout/PageChrome.test.tsx`, `src/layout/ShellToolbar.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // Button.tsx — the class string Button already builds, now shared
  export function buttonClassName(variant: ButtonVariant, size: ButtonSize = 'md'): string;
  // Toolbar.tsx — MainAction's classes, shared with the menu trigger
  export const MAIN_ACTION_CLASS: string; // buttonClassName('primary','pill') + ' relative gap-2 before:absolute before:-inset-y-1 before:inset-x-0'
  // PageChrome.tsx
  export type PageMainAction = { label: string; icon?: LucideIcon; disabled?: boolean } &
    ({ onSelect: () => void; menu?: undefined } | { menu: MenuItem[]; onSelect?: undefined });
  ```
- `usePublishPageChrome` wraps `menu` items exactly like `more`: each action's `onSelect` reads `latest.current.mainAction?.menu?.[i]`. A menu action is published without an `onSelect`; a plain action keeps today's wrapped `onSelect`. Existing publishers all pass `onSelect`, so they compile unchanged. `sameChrome` also compares the two menus with `sameMore` and whether each side is a menu.
- `ShellToolbar`: a menu action renders `<Menu label={label} items={menu} align="end" triggerClassName={MAIN_ACTION_CLASS} trigger={<>{icon}{!iconOnly && label}</>} />`. On phones it is icon-only when it has an icon, as today; the accessible name is the label. `disabled` is ignored for a menu action.
- `ChromeProbe`: for a menu action it renders a `<span>{label}</span>` and one `<button>` per `action` item of `menu`, in order (like `more`).

- [ ] **Step 1: Failing tests.**
  - `PageChrome.test.tsx`: `it('a menu main action runs the latest handler')`: publish `{ label: 'Export', menu: [{ kind: 'action', label: 'CSV', onSelect: a }] }`, re-render with `onSelect: b`, click the probe's "CSV": `b` called, `a` not.
  - `ShellToolbar.test.tsx`: `it('a main action with a menu opens it from the pill')`: the button "Export" has `aria-haspopup="menu"`; clicking it shows `menuitem` "CSV"; choosing it calls the handler.
- [ ] **Step 2:** Run `npx vitest run src/layout src/components/Button.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above. `Button` builds its class with `buttonClassName`; `MainAction` uses `MAIN_ACTION_CLASS`.
- [ ] **Step 4:** Run `npx vitest run src/layout src/components src/test`. Expected: PASS, every existing toolbar, chrome and button test unchanged.
- [ ] **Step 5: Commit** `feat(layout): a main action can open a menu`

### Task 2: Match report and match page (screen 5)

**Files:**
- Create: `src/matches/report/gradeBarStyles.ts`, `src/matches/report/gradeBarStyles.test.ts`
- Modify: `src/matches/report/MatchReport.tsx`, `src/matches/scout/gradeStyles.ts` (delete `GRADE_CLASS`; `SCOUT_GRADE_CLASS` unchanged), `src/matches/MatchPage.tsx`, `src/i18n/{en,it}/matches.ts`
- Test: `src/matches/report/MatchReport.test.tsx`, `src/matches/MatchPage.test.tsx`

**Interfaces:**
- `export const GRADE_BAR_CLASS: Record<Grade, string>` = `'#': 'bg-green'`, `'+': 'bg-green/45'`, `'!': 'bg-ink-3/40'`, `'-': 'bg-orange/40'`, `'/': 'bg-orange/75'`, `'=': 'bg-red'` (invariant 7: light orange `-`, stronger `/`).
- **`MatchReport` (props unchanged)**, root `div.match-report flex flex-col gap-8 print:gap-4`, in order:
  1. **Summary** (`flex flex-wrap items-end justify-between gap-4`):
     - left: the result word `rp.won` / `rp.lost` (`text-headline text-ink-2`; none on equal sets), then `<p className="text-stat tabular-nums text-ink">{us}–{them}</p>` (keep "3–1" alone in its element), then the print-only `rp.setOnly(set)` (`hidden print:block`, unchanged);
     - right: `<ol aria-label={rp.setScores} className="flex gap-2 overflow-x-auto">`, one tile per `report.setScores` entry (`rounded-md bg-surface px-3 py-2 text-center shadow-card`): `rp.setN(i + 1)` (`text-caption text-ink-2`) over the score (`text-headline tabular-nums`, `text-ink` when won, `text-ink-2` when lost).
  2. **Set control:** `<SegmentedControl label={rp.set} options={[{ id: 'all', label: rp.all }, ...report.sets.map((n) => ({ id: String(n), label: rp.setN(n) }))]} value={String(set)} onChange={(id) => setSet(id === 'all' ? 'all' : Number(id))} className="w-full sm:w-auto print:hidden" />`. Controlled/uncontrolled behaviour and the `bySet` → `all` fallback are unchanged.
  3. **KPIs:** six `StatTile`s, same labels and formulas, in `grid grid-cols-2 gap-3 sm:grid-cols-3`. The local `Kpi` goes.
  4. **Players:** `h2 text-title-3 mb-2`; container `overflow-x-auto rounded-lg bg-surface shadow-card print:overflow-visible print:shadow-none`; table `w-full text-callout tabular-nums`:
     - `th`: `px-3 py-2 text-left text-caption font-medium text-ink-2`, sentence case;
     - body `divide-y divide-separator`;
     - the player cell `sticky left-0 z-10 bg-surface whitespace-nowrap px-3 py-2 text-headline`;
     - skill cell: the count (`text-footnote`) over a `flex h-2.5 w-16 overflow-hidden rounded-full bg-surface-2` bar of `GRADE_BAR_CLASS` segments (`aria-hidden`, widths unchanged); "—" in `text-ink-2`;
     - weak flags and Pts / Err unchanged.
  5. **Rotations:** `h2`, then `rp.rotationsNote` (`text-footnote text-ink-2`), then the 1, 6, 5, 4, 3, 2 grid (`grid-cols-3 sm:grid-cols-6 gap-2`). Tiles: `rounded-md bg-surface p-3 text-center shadow-card`. The weakest: `bg-red-tint ring-1 ring-inset ring-red`, its difference `text-red-strong`.
  6. **Timeouts** (when any): `h2`, then `ul rounded-lg bg-surface shadow-card divide-y divide-separator`, rows `px-4 py-3 text-callout tabular-nums`.
  7. **Source note:** `text-footnote text-ink-2`.
- **`MatchPage`:**
  - The eyebrow date is `formatDate(match.date, 'short')` (every state).
  - Load error (§4.6): `<div className="p-6"><p role="alert" className="text-callout text-red-strong">{p.loadError}</p><Button variant="secondary" className="mt-3" onClick={retry}>{t.common.retry}</Button></div>`. `retry` clears the error and bumps an `attempt` state that the load effect depends on.
- Strings `matches.report`, en / it:
  - `setN`: `` (n) => `Set ${n}` `` / `` (n) => `Set ${n}` ``;
  - `setScores`: `'Set scores'` / `'Punteggi dei set'`;
  - `won`: `'Won'` / `'Vinta'`; `lost`: `'Lost'` / `'Persa'`;
  - `rotationsNote`: `'In court order 1, 6, 5, 4, 3, 2. The weakest has the lowest points won minus lost.'` / `'In ordine di campo 1, 6, 5, 4, 3, 2. La più debole ha il saldo punti più basso.'`.

- [ ] **Step 1: Failing tests.**
  - `gradeBarStyles.test.ts`: `it('keeps the grade colour meanings')`: `#` is `bg-green`, `+` a lighter green, `!` neutral (`ink-3`), `-` and `/` orange with `/` the higher opacity, `=` is `bg-red`.
  - `MatchReport.test.tsx`:
    - `it('shows the result and each set score')`: report with `setsWon 3–1` and scores 25–20, 22–25: "Won", "3–1", the list "Set scores" has 2 items, and "22–25" has `text-ink-2`;
    - `it('names how the weakest rotation is judged')`: the `rotationsNote` text shows.
  - `MatchPage.test.tsx`: `it('a load error offers Retry, which loads the match')`: `getMatch` rejects once, then resolves; click "Retry"; the h1 "vs Rivals" shows.
- [ ] **Step 2:** Run `npx vitest run src/matches/report src/matches/MatchPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Selector changes.** Each `fireEvent.change(getByLabelText('Set'), { target: { value: 'N' } })` becomes `fireEvent.click(getByRole('radio', { name: 'Set N' }))`: in "renders KPIs, players and filters by set", "labels a single-set view for print…" and "prints and exports the selected set…".
- [ ] **Step 5:** Run `npx vitest run src/matches src/i18n src/theme`. Expected: PASS. These must pass unchanged: "renders a finished match from its stored report…", "falls back to the event log…", the reopen revert, both not-found tests, "finished match opens match awards from the toolbar", "Delete match…", the source-note tests, `reportData.test.ts`, `reportCsv.test.ts`, `italian.smoke.test.tsx` "a match report", every scouting test.
- [ ] **Step 6: Commit** `feat(matches): v2 match report with set tiles and a segmented set filter; load error Retry`

### Task 3: Light print stylesheet

**Files:**
- Create: `src/theme/printTheme.test.ts`
- Modify: `src/index.css`

**Interfaces:**
- Inside the existing `@media print` block, add a `.dark { … }` rule with `color-scheme: light` and, for **every** custom property the top-level `.dark` block declares, that property's top-level `:root` value. The `header, nav, footer`, `body`, and `.match-report` rules stay.

- [ ] **Step 1: Failing test** `printTheme.test.ts` (reads `src/index.css` with `node:fs`, like `dataColourText.test.ts`):
  - `it('print resets every dark token to its light value')`: parse the first top-level `:root { }` and `.dark { }` blocks into `name → value` maps; inside `@media print`, the `.dark` block declares every name of the top-level `.dark` map with the `:root` value, plus `color-scheme: light`.
- [ ] **Step 2:** Run `npx vitest run src/theme/printTheme.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/theme`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(print): reports and stats print light whatever the theme`

### Task 4: Stats tab: toolbar Export, filters and states

**Files:**
- Modify: `src/teams/stats/TeamStatsTab.tsx`, `src/teams/TeamPage.tsx` (adds `'stats'` to `OWN_CHROME`), `src/i18n/{en,it}/teams.ts`, `src/i18n/italianLabelBudget.test.ts`
- Test: `src/teams/stats/TeamStatsTab.test.tsx`

**Interfaces:**
- Consumes the menu main action and `buttonClassName` (Task 1).
- **Chrome.** At the top of the component, before any early return: `usePublishPageChrome({ title: team.name, mainAction: ready ? { label: t.export, icon: Download, menu: [print, divider, csvEu, csvEn] } : undefined })`. `ready` = loaded with `coverage.scouted > 0`. The items keep today's labels, icons and handlers. The in-content Export menu and the orange Season awards button go (§6.5).
- **Filter row** (`flex flex-wrap items-center gap-2 print:hidden`):
  - Range: `<SegmentedControl label={t.range} options={[season, last5, last10, dates]} … className="w-full sm:w-auto" />` with ids `'season' | 'last5' | 'last10' | 'dates'`. Choosing `dates` seeds From/To with `dateBounds(matches)`, as today.
  - Competition and Venue: `<Menu label={t.filterValue(t.competition, current)} align="start" triggerClassName={`${buttonClassName('secondary', 'pill')} gap-1`} trigger={<>{t.filterValue(t.competition, current)}<ChevronDown size={16} aria-hidden /></>} items={…check items, checked = current…} />`. Venue is the same with `t.venue`.
  - When `range.kind === 'dates'`: a full-width row with visible labels From and To (`text-footnote text-ink-2`) on `type="date"` inputs with `FIELD_CLASS`.
- **States:**
  - Loading: `<div role="status">` with the sr-only `tt.teams.shared.loadingStats`, and `SkeletonBlock`s for the filter row (`h-11 w-72`), 4 tiles (`h-[104px]`) and the chart (`h-52`).
  - Error: `role="alert"` (`text-callout text-red-strong`), copy unchanged.
  - Empty: the same text in `rounded-lg bg-surface p-6 text-callout text-ink-2 shadow-card`.
- **Body:** the coverage line `text-footnote text-ink-2 tabular-nums`; the tiles as today; sections with `h3 text-title-3 mb-2`.
  - The Best players header is `flex items-baseline justify-between`: the `h3` plus `<Link to={`/teams/${team.id}/awards`} className="min-h-11 text-callout text-ink-2 hover:text-ink print:hidden">{t.seasonAwards} <span aria-hidden="true">→</span></Link>` (invariant 39; it is a page link, not an action).
  - Print heading, `break-inside-avoid` and `print:break-before-page` unchanged.
- Strings `teams.stats.filterValue`: en `` (label, value) => `${label}: ${value}` ``, it the same. Budget pairs for `teams.stats.{wholeSeason, last5, last10, dates}`.

- [ ] **Step 1: Failing tests** in `TeamStatsTab.test.tsx`, every render wrapped in `WithChrome`:
  - `it('Export in the toolbar prints and downloads CSV')` (replaces "exports: print and CSV", §6.5): click the probe's "Print / PDF", then "CSV · Excel (Belgium/EU)"; `print` and `downloadText` are called as today.
  - `it('publishes no Export before there is anything to export')`: the empty state has no "Print / PDF" in the probe.
  - `it('CSV from the toolbar exports what the current filter shows')`: matches cup `2026-09-01` and league `2026-09-08`; choose Competition → Cup (`button` /Competition/, then `menuitemcheckbox` "Cup"); the CSV file name matches `/stats-2026-09-01-2026-09-01\.csv$/`.
  - `it('shows skeletons with a status while loading')`: a pending `listFinishedMatches`; `getByRole('status')` contains "Loading team stats…".
- [ ] **Step 2:** Run `npx vitest run src/teams/stats/TeamStatsTab.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Selector changes.**
  - "switching Last 5 to Dates…" clicks `radio` "Last 5", then `radio` "Dates…"; its From/To assertions are unchanged.
  - "filter changes the URL-driven view" chooses Cup through the Competition menu.
  - "shows coverage, KPIs and leaderboards" keeps `link` /Season awards/ → `/teams/t1/awards`.
  - If `TeamPage.test.tsx` asserts the Stats tab's chrome, it now reads the title only until the stats load (§6.5).
- [ ] **Step 5:** Run `npx vitest run src/teams src/i18n`. Expected: PASS. Unchanged: "empty state when nothing is scouted", "load error is shown inline", `statsFilterParams.test.ts`, `teamSeason.test.ts`, `teamStatsCsv.test.ts`, `rosterIndex.test.ts`, every `?tab=` test in `TeamPage.test.tsx`.
- [ ] **Step 6: Commit** `feat(stats): Export in the toolbar, segmented range and filter menus`

### Task 5: Stats sections: leaderboards, rotations, players, trend

**Files:**
- Create: `src/teams/stats/leaderBars.ts`, `src/teams/stats/leaderBars.test.ts`
- Modify: `src/teams/stats/{Leaderboards,RotationBars,PlayerStatsTable,TeamTrendChart,TeamStatsTab}.tsx`, `src/i18n/{en,it}/teams.ts`
- Test: `src/teams/stats/statsComponents.test.tsx`

**Interfaces:**
- `leaderBars.ts`:
  ```ts
  export const AWARD_RATING_SKILL: Partial<Record<AwardId, 'serve' | 'reception' | 'attack' | 'block' | 'set' | 'defence'>>;
  // attacker→attack, server→serve, receiver→reception, blocker→block, defender→defence, setter→set
  export function barFraction(value: number, leader: number): number; // max(0, value) / leader, clamped to [0, 1]; 0 when leader <= 0
  export function leaderBand(id: AwardId, ratings: MatchRatings | undefined): Level | null; // computeLevel(rating) of that skill; null without a skill or a rating
  export const BAND_BAR_CLASS: Record<Level, string>; // bg-red, bg-orange, bg-blue, bg-green
  ```
- **`Leaderboards`** gains `players?: TeamPlayerRow[]` (default `[]`); `TeamStatsTab` passes `season.players`.
  - Grid `grid gap-6 sm:grid-cols-2 lg:grid-cols-3`. Each award keeps `<section aria-labelledby>` (`break-inside-avoid`), with its `h3` styled as a group caption (`px-4 pb-2 text-caption text-ink-2`).
  - Then `<ol className="overflow-hidden rounded-lg bg-surface shadow-card">`, one row per ranked player at rank ≤ 3 (all ties). Rows are `min-h-[52px] px-4 py-2` with inset hairlines.
    - Line 1: rank (`w-5 text-footnote text-ink-2 tabular-nums`), the name (`text-headline`, a link only for current players), and `display · N att.` (`text-callout text-ink-2 tabular-nums`).
    - Line 2: a `h-1.5 rounded-full bg-surface-2` track, `aria-hidden`, `[print-color-adjust:exact]`, holding a fill with `data-band={band ?? 'none'}`, width `barFraction(x.value, r.ranked[0].value)` (the card's rank-1 value), class `BAND_BAR_CLASS[band]` or `bg-ink-3`. `band = leaderBand(r.id, ratingsById.get(x.playerId))`, where `ratingsById` maps `players` by `playerId`.
  - "No data yet" is a row (`px-4 py-3 text-callout text-ink-2`). "Not enough data: …" is a footnote under the group.
- **`RotationBars`:**
  - inside `rounded-lg bg-surface p-4 shadow-card`;
  - track `bg-surface-2`; won `bg-green`, lost `bg-red`; labels `text-ink-2`;
  - `t.rotationsNote` (footnote) above the best/weakest line. Order, `role="img"` labels and the best/weakest rules are unchanged.
- **`PlayerStatsTable`:**
  - container `overflow-x-auto rounded-lg bg-surface shadow-card print:overflow-visible print:shadow-none`;
  - `th` `text-caption text-ink-2`; sort buttons `min-h-11`, with `ArrowDown` and `aria-sort` as today;
  - the name `th` is `sticky left-0 z-10 bg-surface`;
  - rows `divide-y divide-separator`. Sorting, weak flags and the rating rule are unchanged.
- **`TeamTrendChart`** (§12: same SVG, restyled):
  - inside `rounded-lg bg-surface p-4 shadow-card`;
  - gridlines `stroke-separator`, axis labels `fill-ink-2`;
  - series side-out `stroke-ink` solid, attack eff `stroke-ink-2` dash `6 4`, reception + `stroke-ink-3` dash `2 3` (round caps); the legend swatches use the same dashes;
  - W/L letters unchanged; the sr-only table and `trendNone` unchanged.
- Strings `teams.stats.rotationsNote`: `'In rotation order 1 to 6. Best and weakest by share of rallies won.'` / `'In ordine di rotazione da 1 a 6. Migliore e peggiore per quota di scambi vinti.'`.

- [ ] **Step 1: Failing tests.**
  - `leaderBars.test.ts`:
    - `it('barFraction scales to the leader')`: `(30, 40)` → 0.75; `(40, 40)` → 1;
    - `it('barFraction is 0 when the leader is not positive')`: `(-0.1, -0.05)` → 0; `(0, 0)` → 0;
    - `it('leaderBand uses the season rating of the award\'s skill')`: attacker with `attack.rating 7.2` → `'Advanced'`; topScorer → null; server with `serve.rating null` → null.
  - `statsComponents.test.tsx`:
    - `it('leaderboard bars take the band of the player\'s season rating')`: a player row with `ratings.attack.rating 8.5`; the attacker row's fill has `data-band="Elite"` and `bg-green`;
    - `it('a card whose leader is negative draws empty bars')`: every fill in the attacker card has width `0%`;
    - `it('rotation bars say how best and weakest are judged')`.
- [ ] **Step 2:** Run `npx vitest run src/teams/stats`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/teams src/theme`. Expected: PASS. These must pass unchanged: the three leaderboard tests (top 3 and links, ties at rank 3, "No data yet"), "player table sorts by a column", "trend chart has an accessible data table; rotations call out best and weakest".
- [ ] **Step 5: Commit** `feat(stats): grouped leaderboards with band bars, labelled rotations, v2 table and trend`

### Task 6: Awards root, page states and recording sheets

**Files:**
- Create: `src/awards/AwardsRoot.tsx`
- Modify: `src/awards/AwardsPage.tsx`, `src/App.tsx`
- Test: `src/awards/AwardsPage.test.tsx`

**Interfaces:**
- `export function AwardsRoot({ children }: { children: ReactNode })` renders `<div data-awards-root className="dark min-h-[100dvh] bg-bg text-ink" style={{ colorScheme: 'dark' }}>`. Like `ScoutRoot`, it never touches `<html>`. Sheets, menus and alerts render inline, so they inherit it.
- `AwardsPage` wraps every return in `AwardsRoot`: loading, not found, not finished, error, Prepare and Present.
  - Loading: `<p role="status" className="p-6 text-callout text-ink-2">`, same copy.
  - Error: the alert (`text-callout text-red-strong`) and a `secondary` Try again, centred in a `max-w-md` column.
- Recording: `<Sheet title={ta.recordingTitle} onClose={abort} footer={<Button variant="secondary" onClick={abort}>{t.common.cancel}</Button>}>`, holding the body `text-callout text-ink-2` and `<progress className="mt-3 h-2 w-full accent-[rgb(var(--color-ink))]" max={1} value aria-label />`. Escape and the backdrop abort, as today.
- Video ready: `<Sheet title={ta.videoReadyTitle} onClose={discard} footer={<>Close (ghost), Share video (primary, same fresh-tap handler)</>}>`.
- `App.tsx`: `LazyFallback` for `'awards'` renders inside `AwardsRoot`.

- [ ] **Step 1: Failing test** `it('every awards state renders on the forced-dark root and leaves the page theme alone')`: the not-found state and the ready state each sit in `[data-awards-root]` with class `dark` and `colorScheme` `dark`; `document.documentElement` has no `dark` class.
- [ ] **Step 2:** Run `npx vitest run src/awards/AwardsPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/awards src/App.test.tsx`. Expected: PASS. These must pass unchanged: the debounced save, "initial load never saves", the unmount flush, the retryable error, fonts before the page, both recording tests, "shares the finished video only on a fresh tap", the adult/minor export tests, the unfinished match, non-admin not-found, "Present switches to the ceremony and Escape returns", and every pure-function test.
- [ ] **Step 5: Commit** `feat(awards): forced-dark awards root; recording and video sheets`

### Task 7: Prepare in steps: Choose, Photos, Preview

**Files:**
- Create: `src/awards/prepare/ChooseStep.tsx`, `src/awards/prepare/PhotosStep.tsx`, `src/awards/prepare/PreviewStep.tsx`, `src/awards/prepare/CustomAwardSheet.tsx`
- Modify: `src/awards/AwardsPrepare.tsx`, `src/i18n/{en,it}/awards.ts`, `src/i18n/italianLabelBudget.test.ts`
- Test: `src/awards/AwardsPrepare.test.tsx`, `src/awards/AwardsPage.test.tsx`

**Interfaces:**
- `AwardsPrepareProps` and `PrepareAction` are unchanged, so `AwardsPage` is untouched. `type PrepareStep = 'choose' | 'photos' | 'preview'` lives in `AwardsPrepare` state (default `'choose'`, not stored). `cropFor`, `editing`, `cutting` and `cutError` stay in `AwardsPrepare`, so the crop sheet, palette editor and a running cut-out survive a step change. Steps receive what they show as props (`Pick<AwardsPrepareProps, …>` plus those states and their setters).
- **Frame** (screen = a full-screen dark sheet):
  - Top bar: `sticky top-0 z-30 grid h-14 grid-cols-[auto_1fr_auto] items-center gap-2 px-4`, `glass` once `useWindowScrolled()`, else `bg-bg`.
    - Leading: ghost icon button `X`, aria "Close awards" → `onClose`.
    - Centre: `h1 text-headline` "Awards", then `<p className="truncate text-footnote text-ink-2">{heading} · <span role="status">{saveState}</span></p>`; the error state is `text-red-strong`.
    - Trailing: the Export `Menu` (aria "Export", trigger `Share2` plus the label from `sm`, `buttonClassName('secondary','pill')`) only while a winner exists; then Present (`primary`, size `pill`, `Play`), disabled with no revealable winner.
  - Content: `mx-auto w-full max-w-[880px] px-4 pb-16 sm:px-6`, holding:
    - `<SegmentedControl semantics="tabs" label={ta.steps.label} options={[choose, photos, preview]} className="mt-2 w-full sm:w-auto" />`;
    - the no-winners hint (`text-callout text-ink-2`) and the notice alert;
    - `<div role="tabpanel" aria-label={stepLabel} className="mt-6">`.
  - Export items as today, except an unsupported video: `{ kind: 'action', label: ta.recordVideo, hint: ta.videoUnsupported, disabled: true, onSelect: () => {} }` (§4.6).
- **`ChooseStep`:** `ol space-y-3`. Each award is `section aria-labelledby={`award-${key}`}` (`rounded-lg bg-surface p-4 shadow-card`, `opacity-60` when hidden), holding:
  - the title `h2 text-headline`;
  - the Winner select (`FIELD_CLASS`, options unchanged) or the custom line;
  - No winner (`text-orange-strong`), the stat line, Stats suggest and Runners-up (footnote);
  - a controls row: Hide checkbox, move ↑/↓ (44 px icon buttons, same labels and disabled ends), Remove (custom, `dangerGhost`).

  Under the list, "+ Custom award" (`secondary`, disabled at 5) opens `CustomAwardSheet`.
- **`CustomAwardSheet({ people, onAdd, onClose })`:** `<Sheet title={ta.customAwardTitle} guardUnsaved confirm={{ label: ta.addAward, form: 'custom-award-form', disabled: !title.trim() || !playerId }}>`. It holds Award title (max 40), Player (select, "Choose…"), Note (max 80) with `HealthHint id="award-note-hint"` on `aria-describedby`. Submit calls `onAdd(title.trim(), playerId, note.trim())`; `AwardsPrepare` dispatches `addCustom` and closes.
- **`PhotosStep`:** one `section aria-labelledby={`photo-${key}`}` card per award **with a winner**:
  - `CardThumbnail` when a card exists;
  - the title and winner label;
  - then today's photo controls, ink not blue: Add/Change photo as a label-wrapped hidden file input styled `secondary` pill, Remove photo, Remove background / Use original, the status and the error. Or the no-consent note.
- **`PreviewStep`:**
  - `section aria-label={ta.cardSettings}` as a grouped surface (`rounded-lg bg-surface shadow-card`, `divide-y divide-separator`, rows `px-4 py-3 min-h-[52px]`). Rows: Palette (select, swatches, New / Edit palette), story checkbox, Background image (file input with `file:` pill classes, hint on `aria-describedby`, Remove background), Names on cards, the Branding `role="group"` (club logo, sponsors, Add sponsor logos, the cap note, original colours). Then the privacy note (footnote).
  - `h2 text-title-3` `ta.cards`, then a `grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4` with, per award that has a card: `CardThumbnail`, the title (footnote) and PNG (ghost, `Download`). Hidden awards are included at `opacity-60` (§4.6).
- Strings `awards.prepare`, en / it:
  - `steps`: `{ label: 'Award steps', choose: 'Choose', photos: 'Photos', preview: 'Preview' }` / `{ label: 'Passaggi', choose: 'Scegli', photos: 'Foto', preview: 'Anteprima' }`;
  - `customAwardTitle`: `'Custom award'` / `'Premio personalizzato'`;
  - `cards`: `'Cards'` / `'Card'`.

  Remove `prepare.cancel` if unused. Budget pairs for `awards.prepare.steps.{choose,photos,preview}`.

- [ ] **Step 1: Failing tests** in `AwardsPrepare.test.tsx`:
  - `it('is split into Choose, Photos and Preview, starting on Choose')`: the tablist "Award steps" has 3 tabs with "Choose" selected; region "Best attacker" shows; no "Palette" field.
  - `it('a running cut-out survives a step change')`: a deferred `onCutout`. On Photos, click "Remove background", go to Preview, then back to Photos: "Preparing on this device…" shows and the button is disabled. Resolve: the status goes, and `onCutout` was called once with `('attacker', true)`.
  - `it('Cancel on the custom award sheet after typing asks to discard')`.
  - `it('Preview shows each card with its PNG, hidden awards included')`: `cardFor` returns a model for both awards, one hidden; on Preview there are 2 "PNG" buttons; the first calls `onExportOne('attacker')`.
  - "export menu offers cards, summary and video…" adds (§4.6): the video item has `aria-disabled="true"`, and clicking it does not call `onRecordVideo`.
- [ ] **Step 2:** Run `npx vitest run src/awards/AwardsPrepare.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Selector changes** (assertions unchanged):
  - `AwardsPrepare.test.tsx`:
    - click tab "Photos" first in "disables photo controls…" and "offers background removal…";
    - click tab "Preview" first in "switches palette…", "saves a new custom palette…", "warns not to use photos…" and both branding tests;
    - "adds a custom award" fills the sheet and clicks its "Add award".
  - `AwardsPage.test.tsx`:
    - tab "Photos" first in "adding a second photo…", "a minor with guardian data consent…" and "an adult winner gets the photo slot…";
    - tab "Preview" first in "a logo the browser cannot read…".
- [ ] **Step 5:** Run `npx vitest run src/awards src/i18n`. Expected: PASS. These must pass unchanged: "lists awards with suggested winner and runners-up", "picking a winner and hiding…", "shows the stats suggestion…", "reorders with buttons…", "disables custom award when 5 exist", "disables present and export with a hint…", "shows a surfaced error…", "save indicator and present", `awardsReducer.test.ts`, `resolveAwards.test.ts`.
- [ ] **Step 6: Commit** `feat(awards): Prepare as a dark full-screen sheet in three steps`

### Task 8: Palette and crop sheets; Present controls and shortcuts

**Files:**
- Modify: `src/awards/PaletteEditor.tsx`, `src/awards/PhotoCropDialog.tsx`, `src/awards/AwardsPresent.tsx`, `src/i18n/{en,it}/awards.ts`
- Test: `src/awards/PaletteEditor.test.tsx`, `src/awards/PhotoCropDialog.test.tsx`, `src/awards/AwardsPresent.test.tsx`

**Interfaces:**
- **`PaletteEditor`:** `<Sheet title guardUnsaved confirm={{ label: t.save, onConfirm: save, disabled: !name.trim() }}>`.
  - Delete palette (edit only) moves into the body, at the end, as `dangerGhost`.
  - Colour inputs `h-12 w-12 rounded-md ring-1 ring-separator`; labels `text-headline`, hints footnote.
  - The preview tiles keep their inline palette colours (data). Every rule about ids, uppercase colours, 4–5 colours and defaults is unchanged.
- **`PhotoCropDialog`:** `<Sheet title={t.title} detent="large" confirm={{ label: t.use, onConfirm: use, disabled: !bitmap }}>`, with no dirty guard (§12; nothing typed).
  - Body: the note (footnote), the alert, the 280 px canvas (`bg-surface-2`, pointer drag unchanged), Zoom (`accent-[rgb(var(--color-ink))]`).
  - Bitmap closing and crop maths are unchanged.
- **`AwardsPresent`:**
  - Controls row, in order: "?" (`CircleHelp`, aria `t.shortcuts`), Previous, Next, Fullscreen, Exit. Each is `glass h-11 w-11 rounded-full text-ink grid place-items-center`, with the same labels and the same 2 s auto-hide.
  - New state `shortcutsOpen`:
    - the "?" button and the `?` key toggle it;
    - Escape closes it if open, otherwise exits (topmost layer first);
    - while it is open, the controls don't auto-hide.
  - The panel: `<section aria-label={t.shortcuts} className="glass absolute right-4 top-20 w-72 rounded-xl p-4 text-callout text-ink">`, a `dl` of `kbd` badges (`rounded-sm bg-surface-3 px-1.5 text-footnote`):
    - Space · → · PageDown — `t.nextSlide`;
    - ← · PageUp — `t.previousSlide`;
    - F — `t.fullscreen`;
    - Esc — `t.keysExit`;
    - ? — `t.keysToggle`;
    - then `t.keysTap` (footnote).

    It sits outside the 9:16 box, so it never covers the tap zones' handlers or reaches the canvas.
- Strings `awards.present`, en / it:
  - `shortcuts`: `'Keyboard shortcuts'` / `'Scorciatoie da tastiera'`;
  - `keysExit`: `'Back to prepare'` / `'Torna alla preparazione'`;
  - `keysToggle`: `'Show or hide this list'` / `'Mostra o nascondi questo elenco'`;
  - `keysTap`: `'Tap the right half to go forward, the left half to go back.'` / `'Tocca la metà destra per andare avanti, quella sinistra per tornare indietro.'`.

- [ ] **Step 1: Failing tests.**
  - `PaletteEditor.test.tsx`: `it('Cancel after editing asks to discard')`.
  - `AwardsPresent.test.tsx`:
    - `it('the ? button and the ? key show the shortcuts')`: the region "Keyboard shortcuts" lists "Back to prepare";
    - `it('Escape closes the shortcuts first, then exits')`: `onExit` is not called on the first Escape, and is called on the second;
    - `it('controls stay visible while the shortcuts are open')`: with fake timers and 2.5 s, the "Exit presentation" wrapper keeps `opacity-100`.
- [ ] **Step 2:** Run `npx vitest run src/awards/PaletteEditor.test.tsx src/awards/AwardsPresent.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/awards`. Expected: PASS. These must pass unchanged:
  - the three `PaletteEditor` tests (the footer "Save palette" is the sheet confirm);
  - both `PhotoCropDialog` tests (its "Cancel" is the sheet's);
  - every `AwardsPresent` test (announcements, keyboard, summary end, Escape exit, progress segments, `object-contain`, wake lock, no runners-up);
  - `palette.test.ts`, `photo.test.ts`, `cutout/*.test.ts`, `drawSlide.test.ts`, `drawAwardCard.test.ts`.
- [ ] **Step 5: Commit** `feat(awards): palette and crop sheets; Present shortcuts hint`

### Task 9: Gate and user checklist

**Files:** none new.

- [ ] **Step 1:** Run `npm test`, `npm run lint` and `npm run build`. Expected: all green, with 0 lint errors. If a known flaky load-timeout test fails (the Italian smoke test), rerun that file alone and report both results.
- [ ] **Step 2: Greps.** Each should print nothing:
  - `grep -rnE "dark:|navy|slate|border-border|bg-blue/|text-blue-strong|stroke-blue|stroke-border|text-white|bg-black/" src/matches/report src/matches/MatchPage.tsx src/teams/stats src/awards/*.tsx src/awards/prepare --include=*.tsx | grep -v test`;
  - `grep -n "GRADE_CLASS\b" src/matches/scout/gradeStyles.ts | grep -v SCOUT_`;
  - `git diff --stat main -- src/awards/card src/awards/story src/awards/cutout firestore.rules firestore.indexes.json` (canvas, rules and indexes untouched).
- [ ] **Step 3: Commit** any lint-only fix-ups as `chore(reports): gate fix-ups`, if there are any.
- [ ] **Step 4: User checklist** for the group report. The user runs it on a real phone and a desktop, in light and dark mode.
  - **Report vs screen 5.** On a finished match, check:
    - the title with the date eyebrow;
    - "Won" and the sets, with the set tiles to the right (lost sets muted);
    - the Set segmented control;
    - six stat tiles;
    - the borderless players table with colour only in the grade bars and weak flags, and the name column staying put while scrolling sideways on a phone;
    - the red weakest rotation and its note.
  - **Toolbar.** Match page: Match awards, and "⋯" Print, CSV, Reopen, Delete. Stats: Export opens Print / PDF and both CSVs; there is no "⋯".
  - **Print.** In dark mode, Print / PDF the report with Set 2 selected: a white page, "Set 2 only", coloured bars. Then print the stats: the heading and "Printed …", and the players table on a new page.
  - **Stats.** Range segments, the Competition and Venue menus, Dates with From/To. Leaderboard bars in band colours (grey for awards without a skill rating). A monochrome trend with W/L, and "Season awards →" next to Best players.
  - **Retry.** Go offline, open a match that isn't cached: "Could not load this match." with Retry.
  - **Awards.** The whole route is dark in both app themes.
    - Choose, Photos and Preview steps; the custom award sheet asks to discard after typing.
    - Photos only for consented winners, and a cut-out keeps running across steps.
    - Preview: settings and every card with PNG.
    - In a browser without video export, "Record video" is greyed with its hint.
  - **Present.** The "?" button and key show the shortcuts. Escape closes them, then exits. The controls stay while the list is open.
  - **Italian.** The steps, the range segments and the filter menus fit.
  - `tailwind.config.js` did not change, so no dev-server restart is needed.
