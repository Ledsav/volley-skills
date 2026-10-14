# Match Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a player's scouted season on their profile and suggest skill scores from it, export the match report as PDF/CSV, add a quick-score scouting mode, and hint at keyboard dictation in text scouting.

**Architecture:** Season stats are computed on read from the `summary` already saved on finished match docs (one bounded query, admin-only, no rules change), via pure functions in `src/players/matchRating.ts`. Report export is `window.print()` plus a pure CSV generator. Quick score is a per-device localStorage toggle that hides the court UI in `ScoutPage`. Voice is copy only.

**Tech Stack:** React 18 + TypeScript (strict, `noUnusedLocals`), Vite, Tailwind, Firestore, Vitest + Testing Library, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-10-14-volley-skills-match-insights-design.md`

## Global Constraints

- Branch: `feature/match-insights`. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No `firestore.rules` change; no new writes to Firestore anywhere in this plan.
- Components never import `firebase/firestore`; all reads go through `src/matches/matchesApi.ts`.
- Every new query has its index in `firestore.indexes.json`.
- Rating constants exactly: `GRADE_WEIGHTS = { '#': 1, '+': 0.75, '!': 0.5, '-': 0.25, '/': 0, '=': 0 }`, `MIN_ATTEMPTS = 15`, `rating = 1 + 9 × quality`.
- Skill mapping exactly: S→`serve`, R→`reception`, A→`attack`, B→`block`, E→`set`, D+F→`defence`; `jump`/`speed`/`iq` none.
- Match stats and suggestions are visible to team admins only; viewers see today's UI unchanged.
- Saved skill scores are only ever written by the coach pressing **Save skills**.
- CSV: RFC 4180 quoting, `\r\n`, UTF-8 BOM, text cells starting with `= + - @ \t \r` get a leading `'`.
- localStorage access always in try/catch. No new third-party dependencies.
- Numeric UI uses `tabular-nums`. Icons from `lucide-react`.
- Run a single test file with `npx vitest run <path>`.

## Review Focus

- Finished matches saved before `summary` existed (`summary: null`), or where the player has no entry, must be skipped, not crash — Task 1 pins it.
- A player who only appeared in quick-score matches (no actions) must count as zero matches played and show the empty state — Tasks 1 and 3 pin it.
- Player names containing commas, quotes, newlines, or starting with `=`/`+`/`-`/`@` must round-trip safely in CSV — Task 5 pins it.
- Exporting after choosing a set in the report must export that set, not the whole match — Task 6 pins it.
- Turning quick score on while a player's action sheet is open must close it and keep it closed — Task 7 pins it.

## File Structure

| File | Responsibility |
|---|---|
| `src/matches/scoutStats.ts` (modify) | Export `ratio`, `attackEff`, `serveEff`, `mergeLines` for reuse |
| `src/players/matchRating.ts` (create) | `seasonStats`, `matchRatings`, `suggestedScore`, constants |
| `src/matches/matchesApi.ts` (modify) | `listFinishedMatches` |
| `firestore.indexes.json` (modify) | `matches` (`status`, `date desc`) index |
| `src/players/PlayerMatchStatsSection.tsx` (create) | Season KPIs + per-match table |
| `src/players/PlayerSkillsSection.tsx` (modify) | Suggestion line, arrow, "Use N" button |
| `src/players/PlayerCardPage.tsx` (modify) | Loads finished matches for admins, wires both tiles |
| `src/export/exportJson.ts` (modify) | `downloadText`; `downloadJson` delegates to it |
| `src/matches/report/reportCsv.ts` (create) | `csvCell`, `reportCsv`, `reportCsvFileName` |
| `src/matches/report/MatchReport.tsx` (modify) | Optional controlled set; print tweaks |
| `src/matches/MatchPage.tsx` (modify) | Print / CSV buttons, owns report set, print classes |
| `src/index.css` (modify) | Print rules |
| `src/matches/scout/quickScore.ts` (create) | Per-device preference read/write |
| `src/matches/scout/ScoutHeader.tsx`, `RallyBar.tsx`, `ScoutPage.tsx` (modify) | Quick score toggle and layout |
| `src/matches/text/TextScoutPanel.tsx` (modify) | Dictation hint |

---

### Task 1: Season stats and match ratings (pure logic)

**Files:**
- Modify: `src/matches/scoutStats.ts` (top of file: `ratio`, `attackEff`, `serveEff`, `mergeLines`)
- Create: `src/players/matchRating.ts`
- Test: `src/players/matchRating.test.ts`

**Interfaces:**
- Consumes: `Match`, `PlayerStats`, `SkillLine`, `GradeCounts`, `Skill`, `SKILLS`, `GRADES` from `src/types/match.ts`; `SkillKey` from `src/types/player.ts`.
- Produces:
  - from `scoutStats.ts`: `export function ratio(numerator: number, attempts: number): number | null`, `export function attackEff(line: SkillLine | undefined): number | null`, `export function serveEff(line: SkillLine | undefined): number | null`, `export function mergeLines(lines: (SkillLine | undefined)[]): SkillLine | undefined`
  - from `matchRating.ts`: `GRADE_WEIGHTS`, `MIN_ATTEMPTS`, `SKILL_SOURCES`, `interface SeasonMatchRow`, `interface SeasonStats`, `interface MatchRating { rating: number | null; attempts: number }`, `type MatchRatings = Partial<Record<SkillKey, MatchRating>>`, `seasonStats(matches: Match[], playerId: string): SeasonStats`, `matchRatings(season: SeasonStats): MatchRatings`, `suggestedScore(rating: number): number`

- [ ] **Step 1: Export the helpers in `scoutStats.ts`**

Add `export` in front of the four existing functions `ratio`, `attackEff`, `serveEff`, `mergeLines` (lines 7–31). No other change.

- [ ] **Step 2: Write the failing tests** — `src/players/matchRating.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { GradeCounts, Match, PlayerStats, SkillLine } from '../types/match';
import { matchRatings, seasonStats, suggestedScore } from './matchRating';

const line = (grades: Partial<GradeCounts>): SkillLine => {
  const g: GradeCounts = { '#': 0, '+': 0, '!': 0, '-': 0, '/': 0, '=': 0, ...grades };
  return { attempts: Object.values(g).reduce((a, b) => a + b, 0), grades: g };
};

const stats = (skills: PlayerStats['skills'], extra: Partial<PlayerStats> = {}): PlayerStats => ({
  playerId: 'p1', skills, points: 0, errors: 0, attackEff: null, serveEff: null, receptionPos: null, receptionPerfect: null, ...extra,
});

const matchWith = (id: string, date: string, players: Record<string, PlayerStats> | null): Match =>
  ({
    id, date, opponent: `Opp ${id}`,
    summary: players ? { players, team: {}, timeoutEffects: [], sourceCounts: { tap: 0, text: 0 } } : null,
  }) as unknown as Match;

describe('seasonStats', () => {
  it('sums grade counts across matches and recomputes efficiency from the totals', () => {
    const season = seasonStats(
      [
        matchWith('m1', '2026-10-01', { p1: stats({ A: line({ '#': 3, '=': 1 }) }, { attackEff: 0.5, points: 3, errors: 1 }) }),
        matchWith('m2', '2026-10-08', { p1: stats({ A: line({ '#': 1, '-': 5 }) }, { attackEff: 1 / 6, points: 1 }) }),
      ],
      'p1',
    );
    expect(season.skills.A).toEqual(line({ '#': 4, '=': 1, '-': 5 }));
    expect(season.attackEff).toBeCloseTo(0.3); // (4 - 1) / 10, not the mean of 0.5 and 0.167
    expect(season.points).toBe(4);
    expect(season.errors).toBe(1);
    expect(season.matchesPlayed).toBe(2);
  });

  it('skips matches without a summary, without the player, or where the player has no actions', () => {
    const season = seasonStats(
      [
        matchWith('old', '2026-09-01', null),
        matchWith('absent', '2026-09-08', { other: stats({ S: line({ '#': 1 }) }) }),
        matchWith('quick', '2026-09-15', { p1: stats({}) }),
        matchWith('m1', '2026-09-22', { p1: stats({ R: line({ '#': 1, '+': 1, '-': 2 }) }) }),
      ],
      'p1',
    );
    expect(season.matchesPlayed).toBe(1);
    expect(season.rows.map((r) => r.matchId)).toEqual(['m1']);
    expect(season.receptionPos).toBe(0.5);
    expect(season.receptionPerfect).toBe(0.25);
  });

  it('lists per-match rows newest first', () => {
    const season = seasonStats(
      [
        matchWith('a', '2026-10-01', { p1: stats({ S: line({ '#': 1 }) }, { serveEff: 1 }) }),
        matchWith('b', '2026-10-15', { p1: stats({ S: line({ '=': 1 }) }, { serveEff: -1 }) }),
      ],
      'p1',
    );
    expect(season.rows).toEqual([
      { matchId: 'b', date: '2026-10-15', opponent: 'Opp b', attackEff: null, serveEff: -1, receptionPos: null, points: 0, errors: 0 },
      { matchId: 'a', date: '2026-10-01', opponent: 'Opp a', attackEff: null, serveEff: 1, receptionPos: null, points: 0, errors: 0 },
    ]);
  });

  it('returns an empty season for no matches', () => {
    const season = seasonStats([], 'p1');
    expect(season.matchesPlayed).toBe(0);
    expect(season.attackEff).toBeNull();
    expect(season.rows).toEqual([]);
  });
});

describe('matchRatings', () => {
  const ratingsFor = (skills: PlayerStats['skills']) =>
    matchRatings(seasonStats([matchWith('m', '2026-10-01', { p1: stats(skills) })], 'p1'));

  it('maps grade quality onto 1–10', () => {
    expect(ratingsFor({ S: line({ '#': 15 }) }).serve).toEqual({ rating: 10, attempts: 15 });
    expect(ratingsFor({ S: line({ '=': 15 }) }).serve).toEqual({ rating: 1, attempts: 15 });
    expect(ratingsFor({ R: line({ '!': 20 }) }).reception).toEqual({ rating: 5.5, attempts: 20 });
  });

  it('withholds a rating below the minimum but reports the attempts', () => {
    expect(ratingsFor({ A: line({ '#': 14 }) }).attack).toEqual({ rating: null, attempts: 14 });
  });

  it('merges dig and free ball into defence', () => {
    expect(ratingsFor({ D: line({ '+': 10 }), F: line({ '+': 5 }) }).defence).toEqual({ rating: 7.75, attempts: 15 });
  });

  it('maps set and block, and leaves skills without data or without a scouted source out', () => {
    const r = ratingsFor({ E: line({ '#': 15 }), B: line({ '-': 16 }) });
    expect(r.set?.rating).toBe(10);
    expect(r.block?.rating).toBe(3.25);
    expect(Object.keys(r).sort()).toEqual(['block', 'set']);
  });
});

describe('suggestedScore', () => {
  it('rounds and clamps to the 1–10 scale', () => {
    expect(suggestedScore(7.75)).toBe(8);
    expect(suggestedScore(7.4)).toBe(7);
    expect(suggestedScore(0.2)).toBe(1);
    expect(suggestedScore(10.4)).toBe(10);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/players/matchRating.test.ts`
Expected: FAIL — cannot resolve `./matchRating`.

- [ ] **Step 4: Implement** — `src/players/matchRating.ts`

```ts
import { attackEff, mergeLines, ratio, serveEff } from '../matches/scoutStats';
import { GRADES, SKILLS, type Grade, type Match, type PlayerStats, type Skill, type SkillLine } from '../types/match';
import type { SkillKey } from '../types/player';

/** How much each grade is worth when turning a skill's grades into a 0..1 quality. */
export const GRADE_WEIGHTS: Record<Grade, number> = { '#': 1, '+': 0.75, '!': 0.5, '-': 0.25, '/': 0, '=': 0 };

/** Below this many season attempts a skill gets no rating ("not enough data"). */
export const MIN_ATTEMPTS = 15;

/** Scouted fundamentals behind each profile skill. jump, speed and iq have none. */
export const SKILL_SOURCES: Partial<Record<SkillKey, Skill[]>> = {
  serve: ['S'],
  reception: ['R'],
  attack: ['A'],
  block: ['B'],
  set: ['E'],
  defence: ['D', 'F'],
};

export interface SeasonMatchRow {
  matchId: string;
  date: string;
  opponent: string;
  attackEff: number | null;
  serveEff: number | null;
  receptionPos: number | null;
  points: number;
  errors: number;
}

export interface SeasonStats {
  /** Matches where the player has at least one action. */
  matchesPlayed: number;
  /** Grade counts summed across matches. */
  skills: Partial<Record<Skill, SkillLine>>;
  attackEff: number | null;
  serveEff: number | null;
  receptionPos: number | null;
  receptionPerfect: number | null;
  points: number;
  errors: number;
  /** Newest first, matches played only. */
  rows: SeasonMatchRow[];
}

export interface MatchRating {
  /** 1–10, or null when attempts < MIN_ATTEMPTS. */
  rating: number | null;
  attempts: number;
}

export type MatchRatings = Partial<Record<SkillKey, MatchRating>>;

function hasActions(stats: PlayerStats): boolean {
  return Object.values(stats.skills).some((l) => !!l && l.attempts > 0);
}

/** Aggregates a player's scouted season from finished matches' saved summaries; never reads events. */
export function seasonStats(matches: Match[], playerId: string): SeasonStats {
  const played: { match: Match; stats: PlayerStats }[] = [];
  for (const match of matches) {
    const stats = match.summary?.players[playerId];
    if (stats && hasActions(stats)) played.push({ match, stats });
  }

  const skills: Partial<Record<Skill, SkillLine>> = {};
  for (const s of SKILLS) {
    const merged = mergeLines(played.map((p) => p.stats.skills[s]));
    if (merged) skills[s] = merged;
  }
  const r = skills.R;

  return {
    matchesPlayed: played.length,
    skills,
    attackEff: attackEff(skills.A),
    serveEff: serveEff(skills.S),
    receptionPos: r ? ratio(r.grades['#'] + r.grades['+'], r.attempts) : null,
    receptionPerfect: r ? ratio(r.grades['#'], r.attempts) : null,
    points: played.reduce((sum, p) => sum + p.stats.points, 0),
    errors: played.reduce((sum, p) => sum + p.stats.errors, 0),
    rows: played
      .map(({ match, stats }) => ({
        matchId: match.id,
        date: match.date,
        opponent: match.opponent,
        attackEff: stats.attackEff,
        serveEff: stats.serveEff,
        receptionPos: stats.receptionPos,
        points: stats.points,
        errors: stats.errors,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** A 1–10 match rating per profile skill that has scouted data. */
export function matchRatings(season: SeasonStats): MatchRatings {
  const out: MatchRatings = {};
  for (const [key, sources] of Object.entries(SKILL_SOURCES) as [SkillKey, Skill[]][]) {
    const merged = mergeLines(sources.map((s) => season.skills[s]));
    if (!merged || merged.attempts === 0) continue;
    if (merged.attempts < MIN_ATTEMPTS) {
      out[key] = { rating: null, attempts: merged.attempts };
      continue;
    }
    const quality = GRADES.reduce((sum, g) => sum + merged.grades[g] * GRADE_WEIGHTS[g], 0) / merged.attempts;
    out[key] = { rating: 1 + 9 * quality, attempts: merged.attempts };
  }
  return out;
}

/** The whole-number score the edit form offers for a rating. */
export function suggestedScore(rating: number): number {
  return Math.min(10, Math.max(1, Math.round(rating)));
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/players/matchRating.test.ts src/matches/scoutStats.test.ts`
Expected: PASS (both files).

- [ ] **Step 6: Commit**

```bash
git add src/matches/scoutStats.ts src/players/matchRating.ts src/players/matchRating.test.ts
git commit -m "feat(players): season stats and match ratings from finished matches

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `listFinishedMatches` query and index

**Files:**
- Modify: `src/matches/matchesApi.ts` (constants block near line 34; new function after `listMatchesInRange`)
- Modify: `firestore.indexes.json`
- Test: `src/matches/matchesApi.test.ts`

**Interfaces:**
- Produces: `export const FINISHED_MATCHES_CAP = 60;` and `export async function listFinishedMatches(teamId: string): Promise<Match[]>`

- [ ] **Step 1: Write the failing test** — in `src/matches/matchesApi.test.ts`, add `listFinishedMatches` to the import from `./matchesApi`, then add inside `describe('matchesApi', …)`:

```ts
  it('lists finished matches', async () => {
    m.getDocs.mockResolvedValue({ docs: [{ id: 'm1', data: () => ({ date: '2026-10-18', status: 'finished' }) }] });
    expect(await listFinishedMatches('team-1')).toEqual([{ id: 'm1', date: '2026-10-18', status: 'finished' }]);
    expect(m.where).toHaveBeenCalledWith('status', '==', 'finished');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/matches/matchesApi.test.ts`
Expected: FAIL — `listFinishedMatches` is not a function / not exported.

- [ ] **Step 3: Implement** — in `matchesApi.ts`, add next to `MATCHES_MONTH_CAP`:

```ts
/** One team is one season; a youth season has well under this many matches. */
export const FINISHED_MATCHES_CAP = 60;
```

and after `listMatchesInRange`:

```ts
/** Newest finished matches; their saved `summary` feeds player season stats without reading events. */
export async function listFinishedMatches(teamId: string): Promise<Match[]> {
  const snapshot = await getDocs(
    query(matchesCol(teamId), where('status', '==', 'finished'), orderBy('date', 'desc'), limit(FINISHED_MATCHES_CAP)),
  );
  return snapshot.docs.map((d) => toMatch(d.id, d.data()));
}
```

In `firestore.indexes.json`, add to the `indexes` array (after the `testingSessions` entry):

```json
    {
      "collectionGroup": "matches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/matches/matchesApi.test.ts`
Expected: PASS. Also run `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8'))"` — no output means valid JSON.

- [ ] **Step 5: Commit**

```bash
git add src/matches/matchesApi.ts src/matches/matchesApi.test.ts firestore.indexes.json
git commit -m "feat(matches): list finished matches for season stats

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Match stats tile component

**Files:**
- Create: `src/players/PlayerMatchStatsSection.tsx`
- Test: `src/players/PlayerMatchStatsSection.test.tsx`

**Interfaces:**
- Consumes: `SeasonStats` (Task 1); `fmtEff`, `fmtPct` from `src/matches/format.ts`.
- Produces: `export function PlayerMatchStatsSection(props: { teamId: string; season: SeasonStats | null; error: boolean })` — `season: null` means loading.

- [ ] **Step 1: Write the failing test** — `src/players/PlayerMatchStatsSection.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { SeasonStats } from './matchRating';
import { PlayerMatchStatsSection } from './PlayerMatchStatsSection';

const season: SeasonStats = {
  matchesPlayed: 2,
  skills: {},
  attackEff: 0.3,
  serveEff: -0.1,
  receptionPos: 0.55,
  receptionPerfect: 0.2,
  points: 14,
  errors: 6,
  rows: [
    { matchId: 'm2', date: '2026-10-08', opponent: 'Rivals', attackEff: 0.25, serveEff: 0, receptionPos: 0.5, points: 6, errors: 2 },
    { matchId: 'm1', date: '2026-10-01', opponent: 'Neighbours', attackEff: null, serveEff: null, receptionPos: null, points: 8, errors: 4 },
  ],
};

const renderSection = (props: Partial<Parameters<typeof PlayerMatchStatsSection>[0]> = {}) =>
  render(
    <MemoryRouter>
      <PlayerMatchStatsSection teamId="t1" season={season} error={false} {...props} />
    </MemoryRouter>,
  );

describe('PlayerMatchStatsSection', () => {
  it('shows season KPIs and one linked row per match', () => {
    renderSection();
    expect(screen.getByText('+30%')).toBeInTheDocument();
    expect(screen.getByText('55%')).toBeInTheDocument();
    expect(screen.getByText('14 / 6')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rivals' })).toHaveAttribute('href', '/teams/t1/matches/m2');
    expect(screen.getByRole('row', { name: '2026-10-01 vs Neighbours' })).toHaveTextContent('8 / 4');
  });

  it('shows loading, error and empty states', () => {
    const { rerender } = renderSection({ season: null });
    expect(screen.getByText('Loading match stats…')).toBeInTheDocument();
    rerender(<MemoryRouter><PlayerMatchStatsSection teamId="t1" season={null} error /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load match stats.');
    rerender(<MemoryRouter><PlayerMatchStatsSection teamId="t1" season={{ ...season, matchesPlayed: 0, rows: [] }} error={false} /></MemoryRouter>);
    expect(screen.getByText('No scouted matches for this player yet.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/players/PlayerMatchStatsSection.test.tsx`
Expected: FAIL — cannot resolve `./PlayerMatchStatsSection`.

- [ ] **Step 3: Implement** — `src/players/PlayerMatchStatsSection.tsx`

```tsx
import { Link } from 'react-router-dom';
import { fmtEff, fmtPct } from '../matches/format';
import type { SeasonStats } from './matchRating';

interface PlayerMatchStatsSectionProps {
  teamId: string;
  /** null while loading. */
  season: SeasonStats | null;
  error: boolean;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-xs text-slate">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

export function PlayerMatchStatsSection({ teamId, season, error }: PlayerMatchStatsSectionProps) {
  if (error) return <p role="alert" className="text-sm text-red">Could not load match stats.</p>;
  if (!season) return <p className="text-sm text-slate">Loading match stats…</p>;
  if (season.matchesPlayed === 0) return <p className="text-sm text-slate">No scouted matches for this player yet.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Matches" value={String(season.matchesPlayed)} />
        <Stat label="Attack eff." value={fmtEff(season.attackEff)} />
        <Stat label="Serve eff." value={fmtEff(season.serveEff)} />
        <Stat label="Reception +" value={fmtPct(season.receptionPos)} />
        <Stat label="Pts / Err" value={`${season.points} / ${season.errors}`} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-bg text-left text-xs uppercase text-slate">
            <tr>
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Opponent</th>
              <th className="px-2 py-2 font-medium">Att. eff</th>
              <th className="px-2 py-2 font-medium">Serve eff</th>
              <th className="px-2 py-2 font-medium">Rec +</th>
              <th className="px-2 py-2 font-medium">Pts / Err</th>
            </tr>
          </thead>
          <tbody>
            {season.rows.map((row) => (
              <tr key={row.matchId} aria-label={`${row.date} vs ${row.opponent}`} className="border-t border-border">
                <td className="whitespace-nowrap px-2 py-2 text-slate">{row.date}</td>
                <td className="px-2 py-2">
                  <Link to={`/teams/${teamId}/matches/${row.matchId}`} className="text-blue hover:underline">
                    {row.opponent}
                  </Link>
                </td>
                <td className="px-2">{fmtEff(row.attackEff)}</td>
                <td className="px-2">{fmtEff(row.serveEff)}</td>
                <td className="px-2">{fmtPct(row.receptionPos)}</td>
                <td className="px-2">{row.points} / {row.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/players/PlayerMatchStatsSection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/players/PlayerMatchStatsSection.tsx src/players/PlayerMatchStatsSection.test.tsx
git commit -m "feat(players): match stats tile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Match suggestions in the Skills tile, wired on the player page

**Files:**
- Modify: `src/players/PlayerSkillsSection.tsx`
- Modify: `src/players/PlayerCardPage.tsx`
- Test: `src/players/PlayerSkillsSection.test.tsx`, `src/players/PlayerCardPage.test.tsx`

**Interfaces:**
- Consumes: `MatchRatings`, `matchRatings`, `seasonStats`, `suggestedScore`, `SeasonStats` (Task 1); `listFinishedMatches` (Task 2); `PlayerMatchStatsSection` (Task 3).
- Produces: `PlayerSkillsSection` gains optional prop `ratings?: MatchRatings`.

- [ ] **Step 1: Write the failing skills-section test** — in `src/players/PlayerSkillsSection.test.tsx`:

Change the harness to accept and pass `ratings`:

```tsx
function SkillsHarness({
  player,
  onPlayerUpdated = vi.fn(),
  isAdmin = true,
  ratings,
}: {
  player: Player;
  onPlayerUpdated?: (p: Player) => void;
  isAdmin?: boolean;
  ratings?: MatchRatings;
}) {
```

and add `ratings={ratings}` to the `<PlayerSkillsSection … />` it renders. Add `import type { MatchRatings } from './matchRating';` at the top. Then add inside `describe('PlayerSkillsSection', …)`:

```tsx
  it('shows match suggestions and lets the coach apply one before saving', async () => {
    const save = vi.spyOn(playersApi, 'updatePlayerSkills').mockResolvedValue(undefined);
    save.mockClear();
    const player = { ...basePlayer, skills: { ...basePlayer.skills, serve: { score: 5, notes: '', priority: false } } };
    render(
      <SkillsHarness
        player={player}
        ratings={{ serve: { rating: 7.75, attempts: 20 }, attack: { rating: null, attempts: 8 } }}
      />,
    );

    expect(screen.getByText('Match 7.8 · 20 att.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Match data suggests higher' })).toBeInTheDocument();
    expect(screen.getByText('Match — · 8 att. (not enough data)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Edit skills'));
    fireEvent.click(screen.getByRole('button', { name: 'Use 8 for Serve' }));
    expect(screen.getByLabelText('Serve')).toHaveValue(8);
    expect(screen.queryByRole('button', { name: /for Attack/ })).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Save skills'));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        expect.objectContaining({ serve: expect.objectContaining({ score: 8 }) }),
        8,
        'Elite',
      ),
    );
  });

  it('shows no match lines without ratings', () => {
    render(<SkillsHarness player={basePlayer} />);
    expect(screen.queryByText(/^Match /)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/players/PlayerSkillsSection.test.tsx`
Expected: FAIL — `Match 7.8 · 20 att.` not found.

- [ ] **Step 3: Implement in `PlayerSkillsSection.tsx`**

Imports: change `import { Target } from 'lucide-react';` to `import { ArrowDown, ArrowUp, Target } from 'lucide-react';` and add `import { suggestedScore, type MatchRatings } from './matchRating';`.

Add a helper above `interface PlayerSkillsSectionProps`:

```tsx
function matchLine(rating: { rating: number | null; attempts: number }): string {
  return rating.rating === null
    ? `Match — · ${rating.attempts} att. (not enough data)`
    : `Match ${rating.rating.toFixed(1)} · ${rating.attempts} att.`;
}
```

Props: add to the interface

```tsx
  /** Team admins only: season match ratings per skill. Absent → no match lines. */
  ratings?: MatchRatings;
```

and add `ratings,` to the destructured parameters.

Read view: in the `SKILL_ORDER.map` that renders `<li>`, add `const rating = ratings?.[key];` and `const diff = rating?.rating != null && score !== null ? rating.rating - score : 0;` after the existing `const { score, priority } = …` line, and add as the last child of the `<li>` (after `<SkillMeter score={score} />`):

```tsx
                {rating && (
                  <p className="col-span-2 col-start-2 flex items-center gap-1 text-xs tabular-nums text-slate">
                    {matchLine(rating)}
                    {diff >= 1 && <ArrowUp role="img" aria-label="Match data suggests higher" className="h-3 w-3 text-green" />}
                    {diff <= -1 && <ArrowDown role="img" aria-label="Match data suggests lower" className="h-3 w-3 text-orange" />}
                  </p>
                )}
```

Edit dialog: change `{SKILL_ORDER.map((key) => (` to a block body so each row can compute its suggestion:

```tsx
              {SKILL_ORDER.map((key) => {
                const rating = ratings?.[key];
                const value = rating?.rating ?? null;
                return (
                  <div key={key} className="…unchanged…">
                    {/* …the four existing children unchanged… */}
                    {rating && value !== null && (
                      <div className="col-span-2 flex items-center gap-2 text-xs tabular-nums text-slate sm:col-span-4">
                        <span>{matchLine(rating)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Use ${suggestedScore(value)} for ${SKILL_LABELS[key]}`}
                          onClick={() => updateScore(key, String(suggestedScore(value)))}
                        >
                          Use {suggestedScore(value)}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
```

(Close with `})}` instead of `))}`.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/players/PlayerSkillsSection.test.tsx`
Expected: PASS, including the existing tests.

- [ ] **Step 5: Write the failing page test** — in `src/players/PlayerCardPage.test.tsx`:

Add imports and mock:

```tsx
import * as matchesApi from '../matches/matchesApi';
import type { Match } from '../types/match';
```
```tsx
vi.mock('../matches/matchesApi');
```

In `beforeEach`, add: `vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([]);`

Add tests:

```tsx
  it('shows match stats and skill suggestions to a team admin', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' },
        access: superAdminAccess,
      })
    );
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    const serve = { attempts: 15, grades: { '#': 15, '+': 0, '!': 0, '-': 0, '/': 0, '=': 0 } };
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([
      {
        id: 'm1', date: '2026-10-08', opponent: 'Rivals',
        summary: {
          players: { 'player-1': { playerId: 'player-1', skills: { S: serve }, points: 15, errors: 0, attackEff: null, serveEff: 1, receptionPos: null, receptionPerfect: null } },
          team: {}, timeoutEffects: [], sourceCounts: { tap: 15, text: 0 },
        },
      } as unknown as Match,
    ]);

    renderPlayerCard();

    expect(await screen.findByText('Match 10.0 · 15 att.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Match stats' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rivals' })).toBeInTheDocument();
    expect(matchesApi.listFinishedMatches).toHaveBeenCalledWith('team-1');
  });

  it('does not load or show match stats for a viewer', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    vi.mocked(matchesApi.listFinishedMatches).mockClear();

    renderPlayerCard();

    expect(await screen.findByText('Test Player')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Match stats' })).not.toBeInTheDocument();
    expect(matchesApi.listFinishedMatches).not.toHaveBeenCalled();
  });
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/players/PlayerCardPage.test.tsx`
Expected: FAIL — `Match 10.0 · 15 att.` not found.

- [ ] **Step 7: Implement in `PlayerCardPage.tsx`**

Imports: change the React import to `import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';` and add:

```tsx
import { listFinishedMatches } from '../matches/matchesApi';
import { matchRatings, seasonStats, type SeasonStats } from './matchRating';
import { PlayerMatchStatsSection } from './PlayerMatchStatsSection';
```

State and effect — after the `editingSection` state line, add:

```tsx
  const [season, setSeason] = useState<SeasonStats | null>(null);
  const [matchStatsError, setMatchStatsError] = useState(false);
```

and after the existing `handleLatestLoaded` `useCallback` (still before the `if (error)` early return):

```tsx
  // Matches are team-admin data: only admins load them, viewers never query.
  useEffect(() => {
    if (!isAdmin || !teamId || !playerId) return;
    let active = true;
    setSeason(null);
    setMatchStatsError(false);
    listFinishedMatches(teamId)
      .then((matches) => {
        if (active) setSeason(seasonStats(matches, playerId));
      })
      .catch(() => {
        if (active) setMatchStatsError(true);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, teamId, playerId]);

  const ratings = useMemo(() => (season ? matchRatings(season) : undefined), [season]);
```

Pass ratings to the skills section: add `ratings={isAdmin ? ratings : undefined}` to `<PlayerSkillsSection … />`.

Render the tile between Region B and Region C:

```tsx
        {isAdmin && (
          <Tile title="Match stats">
            <PlayerMatchStatsSection teamId={teamId} season={season} error={matchStatsError} />
          </Tile>
        )}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run src/players`
Expected: PASS (all player tests).

- [ ] **Step 9: Commit**

```bash
git add src/players/PlayerSkillsSection.tsx src/players/PlayerSkillsSection.test.tsx src/players/PlayerCardPage.tsx src/players/PlayerCardPage.test.tsx
git commit -m "feat(players): match stats on the profile and match-based skill suggestions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: CSV generator and text download helper

**Files:**
- Modify: `src/export/exportJson.ts`
- Create: `src/matches/report/reportCsv.ts`
- Test: `src/matches/report/reportCsv.test.ts`

**Interfaces:**
- Consumes: `ratio`, `serveEff`, `mergeLines` (Task 1); `rosterMap` from `src/matches/format.ts`; `SKILL_LABELS` from `src/matches/skillGrades.ts`; `fileSlug` from `src/export/exportJson.ts`.
- Produces: `export function downloadText(fileName: string, text: string, mime: string): void` (in `exportJson.ts`); `export function csvCell(value: string | number | null): string`, `export function reportCsv(match: Match, stats: MatchStats): string`, `export function reportCsvFileName(match: Match, set: number | 'all'): string`.

- [ ] **Step 1: Write the failing tests** — `src/matches/report/reportCsv.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { GradeCounts, Match, MatchStats, PlayerStats, SkillLine } from '../../types/match';
import { csvCell, reportCsv, reportCsvFileName } from './reportCsv';

const line = (grades: Partial<GradeCounts>): SkillLine => {
  const g: GradeCounts = { '#': 0, '+': 0, '!': 0, '-': 0, '/': 0, '=': 0, ...grades };
  return { attempts: Object.values(g).reduce((a, b) => a + b, 0), grades: g };
};
const player = (playerId: string, skills: PlayerStats['skills'], extra: Partial<PlayerStats> = {}): PlayerStats => ({
  playerId, skills, points: 0, errors: 0, attackEff: null, serveEff: null, receptionPos: null, receptionPerfect: null, ...extra,
});

const match = {
  id: 'm1', date: '2026-10-18', opponent: 'Rivals / B',
  roster: [
    { playerId: 'a', number: 7, name: 'Ana', positionCategory: 'OH' },
    { playerId: 'b', number: 2, name: 'Bea', positionCategory: 'S' },
  ],
} as unknown as Match;

const stats: MatchStats = {
  players: {
    a: player('a', { S: line({ '#': 1, '=': 1 }) }, { serveEff: 0, points: 1, errors: 1 }),
    b: player('b', { A: line({ '#': 2, '-': 1, '/': 1 }) }, { attackEff: 0.25, points: 2 }),
  },
  team: {
    sideOut: { won: 3, total: 4 }, breakPoint: { won: 1, total: 4 }, oppErrorPoints: 0, rotations: {},
    weakestRotation: null, receptionPos: null, attackEff: 0.25, aces: 1, serveErrors: 1,
  },
  timeoutEffects: [],
  sourceCounts: { tap: 0, text: 0 },
};

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Doe, "Jo"')).toBe('"Doe, ""Jo"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell('plain')).toBe('plain');
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+32 470')).toBe("'+32 470");
    expect(csvCell('-x')).toBe("'-x");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });

  it('writes numbers as numbers and null as blank', () => {
    expect(csvCell(-0.25)).toBe('-0.25');
    expect(csvCell(0.41256)).toBe('0.413');
    expect(csvCell(7)).toBe('7');
    expect(csvCell(null)).toBe('');
  });
});

describe('reportCsv', () => {
  const csv = reportCsv(match, stats);
  const lines = csv.slice(1).split('\r\n');

  it('starts with a BOM and the header, and ends with CRLF', () => {
    expect(csv.startsWith('﻿Number,Name,Serve att,Serve #,Serve +,Serve !,Serve -,Serve /,Serve =,Reception att')).toBe(true);
    expect(lines[0].endsWith(',Attack eff,Serve eff,Reception +,Reception #,Points,Errors,Side-out,Break point')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(lines).toHaveLength(5); // header, 2 players, team, trailing ''
  });

  it('writes one row per player sorted by number', () => {
    const bea = lines[1].split(',');
    expect(bea.slice(0, 2)).toEqual(['2', 'Bea']);
    expect(bea).toHaveLength(59);
    expect(bea.slice(16, 23)).toEqual(['4', '2', '0', '0', '1', '1', '0']); // Attack block
    expect(bea[51]).toBe('0.25'); // attack eff
    expect(bea[52]).toBe(''); // serve eff null
    expect(bea[55]).toBe('2'); // points
    expect(bea[57]).toBe(''); // side-out only on team row
    expect(lines[2].startsWith('7,Ana,2,1,0,0,0,0,1,')).toBe(true);
  });

  it('ends with a team row of summed counts and team rates', () => {
    const team = lines[3].split(',');
    expect(team.slice(0, 2)).toEqual(['', 'Team']);
    expect(team.slice(2, 9)).toEqual(['2', '1', '0', '0', '0', '0', '1']);
    expect(team[51]).toBe('0.25');
    expect(team[52]).toBe('0');
    expect(team[55]).toBe('3');
    expect(team[56]).toBe('1');
    expect(team[57]).toBe('0.75');
    expect(team[58]).toBe('0.25');
  });
});

describe('reportCsvFileName', () => {
  it('names the file by date, opponent and scope', () => {
    expect(reportCsvFileName(match, 'all')).toBe('2026-10-18-Rivals-B-all.csv');
    expect(reportCsvFileName(match, 2)).toBe('2026-10-18-Rivals-B-set2.csv');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/matches/report/reportCsv.test.ts`
Expected: FAIL — cannot resolve `./reportCsv`.

- [ ] **Step 3: Add `downloadText`** — in `src/export/exportJson.ts`, replace `downloadJson` with:

```ts
/** Saves `text` as a file download. */
export function downloadText(fileName: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Saves `payload` as a pretty-printed JSON download. */
export function downloadJson(fileName: string, payload: unknown): void {
  downloadText(fileName, JSON.stringify(payload, null, 2), 'application/json');
}
```

- [ ] **Step 4: Implement** — `src/matches/report/reportCsv.ts`

```ts
import { fileSlug } from '../../export/exportJson';
import { GRADES, SKILLS, type Match, type MatchStats, type Skill, type SkillLine } from '../../types/match';
import { rosterMap } from '../format';
import { mergeLines, ratio, serveEff } from '../scoutStats';
import { SKILL_LABELS } from '../skillGrades';

type Cell = string | number | null;

const BOM = '﻿';

/** One CSV cell: numbers rounded to 3 places, text quoted per RFC 4180 and guarded against formula injection. */
export function csvCell(value: Cell): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(Math.round(value * 1000) / 1000);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const HEADER: Cell[] = [
  'Number',
  'Name',
  ...SKILLS.flatMap((s) => [`${SKILL_LABELS[s]} att`, ...GRADES.map((g) => `${SKILL_LABELS[s]} ${g}`)]),
  'Attack eff',
  'Serve eff',
  'Reception +',
  'Reception #',
  'Points',
  'Errors',
  'Side-out',
  'Break point',
];

function skillCells(line: SkillLine | undefined): Cell[] {
  return line ? [line.attempts, ...GRADES.map((g) => line.grades[g])] : [0, ...GRADES.map(() => 0)];
}

/** The report's player table (one set or the whole match) as an Excel-friendly CSV. */
export function reportCsv(match: Match, stats: MatchStats): string {
  const roster = rosterMap(match.roster);
  const players = Object.values(stats.players).sort(
    (a, b) => (roster.get(a.playerId)?.number ?? 0) - (roster.get(b.playerId)?.number ?? 0),
  );
  const rows: Cell[][] = [HEADER];
  for (const p of players) {
    const entry = roster.get(p.playerId);
    rows.push([
      entry?.number ?? null,
      entry?.name ?? '?',
      ...SKILLS.flatMap((s) => skillCells(p.skills[s])),
      p.attackEff,
      p.serveEff,
      p.receptionPos,
      p.receptionPerfect,
      p.points,
      p.errors,
      null,
      null,
    ]);
  }
  const merged = (s: Skill) => mergeLines(players.map((p) => p.skills[s]));
  const reception = merged('R');
  const t = stats.team;
  rows.push([
    null,
    'Team',
    ...SKILLS.flatMap((s) => skillCells(merged(s))),
    t.attackEff,
    serveEff(merged('S')),
    t.receptionPos,
    reception ? ratio(reception.grades['#'], reception.attempts) : null,
    players.reduce((sum, p) => sum + p.points, 0),
    players.reduce((sum, p) => sum + p.errors, 0),
    ratio(t.sideOut.won, t.sideOut.total),
    ratio(t.breakPoint.won, t.breakPoint.total),
  ]);
  return BOM + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function reportCsvFileName(match: Match, set: number | 'all'): string {
  return `${match.date}-${fileSlug(match.opponent)}-${set === 'all' ? 'all' : `set${set}`}.csv`;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/matches/report/reportCsv.test.ts src/export`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/export/exportJson.ts src/matches/report/reportCsv.ts src/matches/report/reportCsv.test.ts
git commit -m "feat(report): CSV export of the match report

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Print / PDF and CSV buttons on the match page

**Files:**
- Modify: `src/matches/report/MatchReport.tsx`
- Modify: `src/matches/MatchPage.tsx`
- Modify: `src/index.css` (`@media print` block, ~line 59)
- Test: `src/matches/MatchPage.test.tsx`

**Interfaces:**
- Consumes: `downloadText` (Task 5), `reportCsv`, `reportCsvFileName` (Task 5).
- Produces: `MatchReport` accepts optional `set?: number | 'all'` and `onSetChange?: (set: number | 'all') => void` (controlled when given; uncontrolled otherwise).

- [ ] **Step 1: Write the failing test** — in `src/matches/MatchPage.test.tsx`, add the mock under the existing mocks:

```tsx
vi.mock('../export/exportJson', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../export/exportJson')>()),
  downloadText: vi.fn(),
}));
```

and `import { downloadText } from '../export/exportJson';`. Add tests:

```tsx
  it('prints and exports the selected set of a finished match as CSV', async () => {
    const stats = buildReportData(replay(match, [])).all;
    const report = { setsWon: { us: 3, them: 1 }, setScores: [{ us: 25, them: 20 }], sets: [1], all: stats, bySet: { 1: stats } };
    vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...match, status: 'finished', report });
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Print / PDF' }));
    expect(print).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(downloadText).toHaveBeenLastCalledWith('2026-10-18-Rivals-all.csv', expect.stringContaining('Number,Name'), 'text/csv;charset=utf-8');

    fireEvent.change(screen.getByLabelText('Set'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(downloadText).toHaveBeenLastCalledWith('2026-10-18-Rivals-set1.csv', expect.any(String), 'text/csv;charset=utf-8');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/matches/MatchPage.test.tsx`
Expected: FAIL — no button named `Print / PDF`.

- [ ] **Step 3: Make `MatchReport`'s set optionally controlled** — in `MatchReport.tsx` replace the signature and the `useState` line:

```tsx
interface MatchReportProps {
  match: Match;
  report: MatchReportData;
  /** Controlled set filter; omit both to let the report own it. */
  set?: number | 'all';
  onSetChange?: (set: number | 'all') => void;
}

export function MatchReport({ match, report, set: setProp, onSetChange }: MatchReportProps) {
  const [localSet, setLocalSet] = useState<number | 'all'>('all');
  const set = setProp ?? localSet;
  const setSet = onSetChange ?? setLocalSet;
```

(The rest of the component keeps using `set` and `setSet` unchanged.) Also change the players table wrapper `className="overflow-x-auto rounded-lg border border-border"` to `className="overflow-x-auto rounded-lg border border-border print:overflow-visible"`.

- [ ] **Step 4: Add buttons and print classes in `MatchPage.tsx`**

Imports: add `Printer, Download` to the `lucide-react` import, and:

```tsx
import { downloadText } from '../export/exportJson';
import { reportCsv, reportCsvFileName } from './report/reportCsv';
```

State (next to the other `useState` calls, before any early return):

```tsx
  const [reportSet, setReportSet] = useState<number | 'all'>('all');
```

Function (next to `reopen`):

```tsx
  function exportCsv() {
    if (!match || !report) return;
    const stats = (reportSet === 'all' ? report.all : report.bySet[reportSet]) ?? report.all;
    downloadText(reportCsvFileName(match, reportSet), reportCsv(match, stats), 'text/csv;charset=utf-8');
  }
```

Replace the finished block's single button:

```tsx
        {match.status === 'finished' && (
          <div className="mb-6 flex flex-col items-end gap-1 print:hidden">
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer size={16} aria-hidden="true" /> Print / PDF
              </Button>
              <Button variant="secondary" size="sm" disabled={!report} onClick={exportCsv}>
                <Download size={16} aria-hidden="true" /> Export CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={reopen}>Reopen for editing</Button>
            </div>
            {actionError && <p role="alert" className="text-sm text-red">{actionError}</p>}
          </div>
        )}
```

Report render: `<MatchReport match={match} report={report} set={reportSet} onSetChange={setReportSet} />`.

Print classes:
- "Back to team" `<Link …>`: append ` print:hidden` to its className.
- Card `<div className="rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">`: append ` print:border-0 print:p-0 print:shadow-none`.
- Delete button: add `className="print:hidden"` to `<Button variant="dangerGhost" …>`.
- Header subtitle: change `{match.date} · {match.homeAway === 'home' ? 'Home' : 'Away'}` to `{match.date} · {match.homeAway === 'home' ? 'Home' : 'Away'} · <span className="capitalize">{match.competition}</span>`.

- [ ] **Step 5: Print stylesheet** — in `src/index.css`, replace the `@media print` block with:

```css
@media print {
  header, nav, footer { display: none !important; }
  body { background: #fff; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tr, section { break-inside: avoid; }
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run src/matches/MatchPage.test.tsx src/matches/report`
Expected: PASS, existing tests included.

- [ ] **Step 7: Commit**

```bash
git add src/matches/report/MatchReport.tsx src/matches/MatchPage.tsx src/matches/MatchPage.test.tsx src/index.css
git commit -m "feat(report): print to PDF and CSV export buttons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Quick score mode

**Files:**
- Create: `src/matches/scout/quickScore.ts`
- Test: `src/matches/scout/quickScore.test.ts`
- Modify: `src/matches/scout/ScoutHeader.tsx`, `src/matches/scout/RallyBar.tsx`, `src/matches/scout/ScoutPage.tsx`
- Test: `src/matches/scout/ScoutPage.test.tsx`

**Interfaces:**
- Produces: `readQuickScore(): boolean`, `writeQuickScore(on: boolean): void`; `ScoutHeader` props `quickScore: boolean`, `onToggleQuickScore: () => void`; `RallyBar` prop `size?: 'normal' | 'large'`.

- [ ] **Step 1: Write the failing storage test** — `src/matches/scout/quickScore.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readQuickScore, writeQuickScore } from './quickScore';

describe('quickScore preference', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('defaults off and persists', () => {
    expect(readQuickScore()).toBe(false);
    writeQuickScore(true);
    expect(readQuickScore()).toBe(true);
    writeQuickScore(false);
    expect(readQuickScore()).toBe(false);
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readQuickScore()).toBe(false);
    expect(() => writeQuickScore(true)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/matches/scout/quickScore.test.ts`
Expected: FAIL — cannot resolve `./quickScore`.

- [ ] **Step 3: Implement** — `src/matches/scout/quickScore.ts`

```ts
const QUICK_SCORE_KEY = 'vcb.scout.quickScore';

/** Per-device preference, default off. Storage can throw (private mode, blocked site data). */
export function readQuickScore(): boolean {
  try {
    return window.localStorage.getItem(QUICK_SCORE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeQuickScore(on: boolean): void {
  try {
    window.localStorage.setItem(QUICK_SCORE_KEY, on ? 'on' : 'off');
  } catch {
    // Not persisted; the toggle still applies for this visit.
  }
}
```

Run: `npx vitest run src/matches/scout/quickScore.test.ts` — Expected: PASS.

- [ ] **Step 4: Write the failing page tests** — in `src/matches/scout/ScoutPage.test.tsx`, inside `describe('ScoutPage', …)`:

```tsx
  it('quick score hides the court and still records points', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: 'Quick score' }));
    expect(screen.queryByRole('button', { name: '#7 Ana' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Auto-select next player' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Point us/ }));
    expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'point', winner: 'us' }), 'u1');
    expect(window.localStorage.getItem('vcb.scout.quickScore')).toBe('on');
  });

  it('turning quick score on closes an open action sheet', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: '#7 Ana' }));
    expect(screen.getByRole('button', { name: 'Reception' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quick score' }));
    expect(screen.queryByRole('button', { name: 'Reception' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quick score' }));
    expect(screen.getByRole('button', { name: '#7 Ana' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reception' })).not.toBeInTheDocument();
  });

  it('starts in quick score when this device chose it before', async () => {
    window.localStorage.setItem('vcb.scout.quickScore', 'on');
    renderPage([setStart]);
    expect(await screen.findByRole('button', { name: 'Quick score' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '#7 Ana' })).not.toBeInTheDocument();
  });
```

- [ ] **Step 5: Run to verify it fails**

Run: `npx vitest run src/matches/scout/ScoutPage.test.tsx`
Expected: FAIL — no button named `Quick score`.

- [ ] **Step 6: `ScoutHeader` toggle** — add to `ScoutHeaderProps`:

```tsx
  /** Score-only mode: no court, just the rally buttons. */
  quickScore: boolean;
  onToggleQuickScore: () => void;
```

add `quickScore, onToggleQuickScore` to the destructured parameters, and replace the Auto `<button …>…</button>` with:

```tsx
            <button
              type="button"
              aria-label="Quick score"
              aria-pressed={quickScore}
              onClick={onToggleQuickScore}
              className={`flex min-h-11 items-center justify-center rounded-md px-2 font-semibold ${
                quickScore ? 'bg-white text-navy' : 'bg-white/10 text-white/80'
              }`}
            >
              Quick
            </button>
            {!quickScore && (
              <button
                type="button"
                aria-label="Auto-select next player"
                aria-pressed={autoSelect}
                onClick={onToggleAutoSelect}
                className={`mr-1 flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 font-semibold ${
                  autoSelect ? 'bg-white text-navy' : 'bg-white/10 text-white/80'
                }`}
              >
                Auto
                <Kbd>{keyLabel('auto')}</Kbd>
              </button>
            )}
```

- [ ] **Step 7: `RallyBar` large size** — add to `RallyBarProps`:

```tsx
  /** `large` (quick score): taller point buttons with bigger type. */
  size?: 'normal' | 'large';
```

destructure `size = 'normal'`, add `const pointSize = size === 'large' ? 'min-h-24 text-xl' : 'min-h-12';`, and in both point buttons replace `min-h-12` in the className with `${pointSize}` (convert those two `className="…"` to template literals).

- [ ] **Step 8: `ScoutPage` wiring**

- Import: `import { readQuickScore, writeQuickScore } from './quickScore';`
- State, after `autoSelect`: `const [quickScore, setQuickScore] = useState(readQuickScore);`
- After `toggleAutoSelect`:

```tsx
  function toggleQuickScore() {
    const next = !quickScore;
    setQuickScore(next);
    writeQuickScore(next);
    if (next) select(null);
  }
```

- `panelPlayer` line becomes: `const panelPlayer = state.inSet && selection && !quickScore ? selected : undefined;` (this also disables the grade, skill and sub hotkeys, which all require `panelPlayer`).
- Hotkey `case 'toggleAuto':` becomes `if (!quickScore) toggleAutoSelect(); return;`.
- `onJersey`: change `if (entry && state.inSet) select(entry.playerId);` to `if (entry && state.inSet && !quickScore) select(entry.playerId);`.
- In `courtColumn`, wrap `<CourtGrid … />` and `<BenchStrip … />` in `{!quickScore && (<> … </>)}`, and pass `size={quickScore ? 'large' : 'normal'}` to `<RallyBar … />`.
- `<ScoutHeader …>`: add `quickScore={quickScore}` and `onToggleQuickScore={toggleQuickScore}`.

- [ ] **Step 9: Run to verify it passes**

Run: `npx vitest run src/matches/scout`
Expected: PASS, existing scout tests included.

- [ ] **Step 10: Commit**

```bash
git add src/matches/scout/quickScore.ts src/matches/scout/quickScore.test.ts src/matches/scout/ScoutHeader.tsx src/matches/scout/RallyBar.tsx src/matches/scout/ScoutPage.tsx src/matches/scout/ScoutPage.test.tsx
git commit -m "feat(scout): quick score mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Dictation hint, then full verification

**Files:**
- Modify: `src/matches/text/TextScoutPanel.tsx` (the hint spans under the `Textarea`, ~line 250)
- Test: `src/matches/text/TextScoutPanel.test.tsx`

- [ ] **Step 1: Write the failing test** — inside the main `describe` of `TextScoutPanel.test.tsx`:

```tsx
  it('suggests keyboard dictation', () => {
    renderPanel();
    expect(screen.getByText(/tap your keyboard's microphone to dictate/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/matches/text/TextScoutPanel.test.tsx`
Expected: FAIL — text not found.

- [ ] **Step 3: Implement** — after the `Tip: add the result — kill, out, blocked, good…` span, add:

```tsx
        <span className="text-xs font-normal text-slate">
          Tip: tap your keyboard&apos;s microphone to dictate — e.g. &quot;good serve from 7, then a kill by 12&quot;.
        </span>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/matches/text/TextScoutPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/matches/text/TextScoutPanel.tsx src/matches/text/TextScoutPanel.test.tsx
git commit -m "feat(text-scouting): hint at keyboard dictation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Full verification**

Run, in order, each must succeed:

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, no lint errors, `tsc -b` + `vite build` succeed (catches unused imports such as a leftover `useState` in `MatchReport`). Fix anything that fails and commit the fix with the same trailer.
