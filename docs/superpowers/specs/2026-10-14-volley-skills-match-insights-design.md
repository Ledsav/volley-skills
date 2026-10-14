# Volley Skills App — Match Insights Design

Date: 2026-10-14
Status: Draft — awaiting user review
Branch: `feature/match-insights`
Companion to: `2026-10-13-volley-skills-scouting-design.md` (match/event model, report, scout UI),
`2026-09-04-volley-skills-app-design.md` (player skills, fetching rules), `2026-09-04-volley-skills-design-system.md`

## 1. Purpose and success criteria

Four increments, prompted by a comparison with VolleyInsights (volleyinsights.com), that close
the gaps that matter for VCB without changing the security boundary:

1. **Match stats on the player profile, feeding skill scores** — a coach sees a player's season
   of scouted matches on their profile, and the match evidence is offered as a suggestion when
   scoring skills.
2. **Report export** — print / save the match report as PDF, and download it as CSV.
3. **Quick score mode** — score-only scouting for when nobody can grade actions.
4. **Voice** — a hint that the keyboard's dictation works in text scouting.

Success: after a few finished matches, a team admin opens a player and sees season numbers, a
per-match trend, and "Match 6.8 · 42 att." next to each scoutable skill; one click puts the
suggestion into the edit form. A report prints cleanly on A4 and opens correctly in Excel. A
parent helper can keep the score with two big buttons.

## 2. Decisions log

| # | Decision | Choice |
|---|---|---|
| D1 | Who sees player match stats | Team admins only (matches are admin-read). No rules change, no denormalized copy |
| D2 | Season aggregation | Computed on read from finished match docs' saved `summary`; no running aggregate doc |
| D3 | Match → skill score | Suggest only; coach applies in the edit dialog and saves as today. Saved scores stay coach-authored |
| D4 | Rating formula | Grade-weighted quality → 1–10, min 15 attempts, constants in one file |
| D5 | PDF | `window.print()` + print stylesheet; no PDF library |
| D6 | CSV | Pure generator, RFC 4180 quoting, UTF-8 BOM, formula-injection guard; coach picks the format per device — `eu` (`;` + decimal comma, default, Belgian Excel) or `en` (`,` + decimal point) |
| D7 | Quick score | Per-device toggle (localStorage), switchable mid-match; no data-model change |
| D8 | Voice | OS keyboard dictation only — a UI hint, no speech API, no audio leaves via the app |

## 3. Match stats on the player profile (D1–D4)

### 3.1 Data access

New in `src/matches/matchesApi.ts`:

```ts
export const FINISHED_MATCHES_CAP = 60;
export async function listFinishedMatches(teamId: string): Promise<Match[]>
// query(matchesCol(teamId), where('status', '==', 'finished'), orderBy('date', 'desc'), limit(60))
```

New composite index in `firestore.indexes.json`: collection `matches`, `status ASC`, `date DESC`.

A team doc is one season, so "season" = that team's finished matches. Only `summary` (the
whole-match `MatchStats`), `date`, `opponent`, `id` are used; events are never read. Matches
finished before `summary` existed (`summary: null`) are skipped.

The player page calls it once, only when the viewer is a team admin, and passes the result to
both the Match stats tile and the Skills tile. A failure shows an inline "Could not load match
stats." in the Match stats tile and hides the suggestions; the rest of the page is unaffected.

### 3.2 Pure logic — `src/players/matchRating.ts`

`attackEff` / `serveEff` are exported from `src/matches/scoutStats.ts` (currently private) and
reused, so report and profile can never disagree.

```ts
export interface SeasonMatchRow {
  matchId: string; date: string; opponent: string;
  attackEff: number | null; serveEff: number | null; receptionPos: number | null;
  points: number; errors: number;
}
export interface SeasonStats {
  matchesPlayed: number;                     // matches where the player has ≥ 1 action
  skills: Partial<Record<Skill, SkillLine>>; // grade counts summed across matches
  attackEff: number | null; serveEff: number | null;
  receptionPos: number | null; receptionPerfect: number | null;
  points: number; errors: number;
  rows: SeasonMatchRow[];                    // newest first, only matches played
}
export function seasonStats(matches: Match[], playerId: string): SeasonStats;

export interface MatchRating { rating: number | null; attempts: number } // null below MIN_ATTEMPTS
export function matchRatings(season: SeasonStats): Partial<Record<SkillKey, MatchRating>>;
```

Season efficiencies are recomputed from summed grade counts (never averaged per-match ratios).

**Skill mapping** (scout skill → profile skill):

| Scout | Profile |
|---|---|
| S Serve | `serve` |
| R Reception | `reception` |
| A Attack | `attack` |
| B Block | `block` |
| E Set | `set` |
| D Dig + F Freeball (summed) | `defence` |

`jump`, `speed`, `iq` get no entry.

**Rating:**

```ts
export const GRADE_WEIGHTS: Record<Grade, number> = { '#': 1, '+': 0.75, '!': 0.5, '-': 0.25, '/': 0, '=': 0 };
export const MIN_ATTEMPTS = 15;
quality = Σ(count[g] × weight[g]) / attempts      // 0..1
rating  = 1 + 9 × quality                           // 1..10, displayed to 1 decimal
```

Below `MIN_ATTEMPTS`, `rating` is `null` and `attempts` still reported ("not enough data").
The suggested integer for the edit form is `Math.round(rating)`, clamped to 1–10.

### 3.3 UI

**Match stats tile** (new `src/players/PlayerMatchStatsSection.tsx`, rendered in a `Tile` on
`PlayerCardPage` only when `isAdmin`):

- KPI row: matches played, attack eff., serve eff., reception +, points / errors — formatted
  with the existing `fmtEff` / `fmtPct` from `src/matches/format.ts`, `tabular-nums`.
- Per-match table (newest first): date, opponent, att. eff., serve eff., rec +, pts / err; the
  opponent links to `/teams/:teamId/matches/:matchId`. Horizontal scroll on phone.
- Empty (no match where the player has an action): "No scouted matches for this player yet." Loading: "Loading match stats…".

**Skills tile, read view** (`PlayerSkillsSection` gains an optional `ratings` prop; absent for
non-admins, so viewers see exactly today's UI):

- For each mapped skill with data, a secondary line under the row:
  `Match 6.8 · 42 att.`, or `Match — · 8 att. (not enough data)`.
- When `rating` and `score` are both non-null and `|rating − score| ≥ 1`, an up/down arrow
  (`lucide-react` `ArrowUp`/`ArrowDown`, `aria-label="Match data suggests higher|lower"`).

**Edit skills dialog:** for each skill with a non-null rating, a ghost button "Use 7" next to
the input; it sets that skill's score in the dialog state only. Save is unchanged: `avgScore` /
`level` are derived and written by the existing `updatePlayerSkills` path. Nothing is written
automatically, ever.

## 4. Report export (D5, D6)

On `MatchPage`, next to the existing report header actions (inside the `print:hidden` block),
for finished matches with a report:

- **"Print / PDF"** — calls `window.print()`.
- **"Export CSV"** — downloads `<date>-<opponent-slug>-<set|all>.csv` for the set currently
  selected in the report.

The report's set selector state moves up from `MatchReport` to `MatchPage` (controlled
`set` / `onSetChange` props) so the export buttons know the scope.

**Print stylesheet** (`src/index.css` `@media print` + `print:` utilities):

- The match page header (date, home/away, "vs opponent") already prints; it gains the
  competition. The "Back to team" link and "Delete match" button get `print:hidden`, and the
  page card drops its border/shadow/padding in print (`print:border-0 print:shadow-none print:p-0`).
- `tr { break-inside: avoid; }`, sections `break-inside: avoid` where they fit on a page.
- `print-color-adjust: exact` on the grade bars and rotation cards so colors survive.
- The table drops `overflow-x-auto` in print (`print:overflow-visible`).

**CSV** — `src/matches/report/reportCsv.ts`, pure:

```ts
export function reportCsv(match: Match, stats: MatchStats): string
```

- Columns: `Number, Name`, then for each skill in `SKILLS` order: `<Skill> att, <Skill> #,
  <Skill> +, <Skill> !, <Skill> -, <Skill> /, <Skill> =`, then `Attack eff, Serve eff,
  Reception +, Reception #, Points, Errors`.
- One row per player sorted by number; then a `Team` row with the summed grade counts and team
  `attackEff` / `receptionPos`, side-out % and break-point % appended as the last two columns
  (blank on player rows).
- Ratios as decimals with 3 places (`0.412`), blank for null.
- Quoting per RFC 4180 (wrap in `"` when the cell has `,` `"` `\r` `\n`; double inner quotes);
  `\r\n` line endings; prefixed with a UTF-8 BOM for Excel.
- Formula-injection guard: any text cell starting with `=`, `+`, `-`, `@`, tab or CR gets a
  leading `'`. Numeric cells are written from numbers, never from user text.

Download via a new `downloadText(fileName, text, mime)` in `src/export/exportJson.ts` (Blob +
object URL, same as the existing `downloadJson`, which is refactored to call it). The file name
uses the existing `fileSlug`.

## 5. Quick score mode (D7)

- `src/matches/scout/quickScore.ts`: `readQuickScore()` / `writeQuickScore(on)` with key
  `vcb.scout.quickScore`, every storage access in try/catch, default off — the same pattern as
  `readAutoSelect` in `ScoutPage.tsx`.
- `ScoutHeader` gets a "Quick score" toggle (switch with label, `aria-pressed`).
- When on, `ScoutPage`:
  - does not render `CourtGrid`, `BenchStrip`, `ActionSheet`; clears any selection;
  - renders `RallyBar` with a new `size="large"` prop: the two point buttons become full-width,
    `min-h-24`, larger type; timeouts and the optional reason prompt unchanged;
  - hides the auto-select toggle;
  - ignores hotkey commands `grade`, `skill`, `sub`, `toggleAuto`; `point`, `timeout`,
    `reason`, `undo`, help still work.
- Rotation, serving, side-out / break-point, timeouts, set end, timeline, live stats and text
  scouting all keep working — the engine already handles points without actions.
- A quick-score match simply has no player actions; season stats (§3) ignore it naturally
  (no actions → not counted as played, contributes no attempts).

## 6. Voice (D8)

`TextScoutPanel`: under the textarea, a muted hint —
"Tip: tap your keyboard's microphone to dictate — e.g. "good serve from 7, then a kill by 12"."
No speech API, no new permission, no new data flow. The existing name→number stripping still
applies to whatever text is sent.

## 7. Security and privacy

- No `firestore.rules` change: every new read is of `teams/{id}/matches`, already admin-only;
  nothing new is written. The rules suite is unaffected.
- CSV contains player names (minors); it is produced only for team admins, who can already see
  the report. The formula-injection guard prevents a crafted name from executing in Excel.
- No third-party libraries for PDF or CSV.

## 8. Testing

Unit (`vitest`):

- `matchRating.test.ts` — summing across matches; season eff. from summed counts (not averaged);
  `matchesPlayed` excludes matches without actions; `summary: null` skipped; D + F merged into
  `defence`; rating formula at known points (all `#` → 10, all `=` → 1); below 15 attempts →
  null with attempts reported; unmapped skills absent.
- `reportCsv.test.ts` — header, row order, team row, null → blank, quoting of `,` `"` newline,
  injection guard for `=cmd`, `+1`, `-1`, `@x`; BOM and `\r\n`.
- `quickScore.test.ts` — default off, persists, survives throwing storage.

Component (`@testing-library/react`):

- `PlayerMatchStatsSection` — KPIs and rows render; empty state; links to match.
- `PlayerCardPage` — tile shown for team admin, absent for viewer; `listFinishedMatches` not
  called for viewers.
- `PlayerSkillsSection` — suggestion line and arrow with `ratings`; none without; "Use 7" sets
  the input and nothing is saved until **Save skills**.
- `MatchPage` — Print calls `window.print`; Export CSV triggers a download for the selected set.
- `ScoutPage` — quick score hides the court and still records a point; skill hotkeys ignored.
- `TextScoutPanel` — dictation hint present.

## 9. Out of scope

- Guardian/viewer access to match stats (would need a denormalized, rules-tested stats doc).
- Automatic blending of match ratings into saved scores.
- Season CSV export, team leaderboards, public live scoreboard, i18n (tracked separately).
- Speech-to-text integration.
