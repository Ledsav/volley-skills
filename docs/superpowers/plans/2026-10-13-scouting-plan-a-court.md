# Match Scouting — Plan A: Court Scouting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Team admins can create a match, scout it live by tapping players on a court (DataVolley grades), see live per-player stats, fix mistakes via undo/timeline/corrections, finish it, and read a post-match report; matches also show on the team calendar.

**Architecture:** A match is an ordered log of small event docs (`teams/{t}/matches/{m}/events`). Score, rotation, who is on court (libero applied), sets, warnings and all stats are derived by a pure `replay()` function — nothing derived is stored except a `result` for list views and a `summary` + usage contribution written at Finish. Firestore's persistent local cache makes writes durable offline; the UI never awaits event writes.

**Tech Stack:** React 18 + TypeScript (strict), Vite, Tailwind (design-system tokens), React Router v7, Firebase Auth + Firestore (Spark plan, no Functions), Vitest + Testing Library, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-13-volley-skills-scouting-design.md` (this plan covers §10 "Plan A"; text/Groq mode is Plan B).

## Global Constraints

- TypeScript `strict` + `noUnusedLocals` / `noUnusedParameters` — unused symbols fail `npm run build`.
- Components never import `firebase/firestore`; only `src/matches/matchesApi.ts` does.
- No unbounded reads: every query has `limit(...)`; events listener capped at `MATCH_EVENTS_CAP = 2000`.
- Firestore never receives `undefined` — use `null` for absent optional fields.
- Event writes are fire-and-forget (`written.catch(...)`); never `await` an event write before updating UI (offline writes only resolve on server ack).
- Dates are ISO `"YYYY-MM-DD"` strings.
- Access: team admins (`email ∈ teams/{id}.adminEmails`) + superadmins only. Every rules change has a test in `tests/rules/`.
- Grades `# + ! - / =`, skills `S R A B D E F`; point us: `S# A# B#`; point them: any `=`, `A/`, `B/` (spec §3).
- UI: design-system tokens only (`navy blue orange green red ink slate border bg surface`), `tabular-nums` for numbers, `lucide-react` icons, 44px min touch targets on phone.
- Tests sit next to code. Run single files with `npx vitest run <path>`.
- Commit after every task with a `feat:`/`test:`/`chore:` message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Two events with the same `order`** (double tap, two devices) — replay must be deterministic: sort by `order`, then `id`. → test in Task 2.
2. **Libero after a substitution** — when a player the libero replaces is subbed out, the libero must keep replacing the incoming player for the rest of the set. → test in Task 3.
3. **Deuce and deciding set** — 25–24 is not a set point, 26–24 is; set 5 of a best-of-5 ends at 15. → tests in Task 2.
4. **Re-finishing a reopened match** must not double-count usage history. → test in Task 6.
5. **Correction mid-set then play continues** — a rotation correction rotates the lineup consistently so later side-outs rotate from the corrected position. → test in Task 2.

---

## File map

| File | Responsibility |
|---|---|
| `src/types/match.ts` | All match/event/stats types + constants |
| `src/matches/skillGrades.ts` | Labels, valid grades per skill, `rallyOutcome` |
| `src/matches/scoutEngine.ts` | `replay()` → `MatchState`, lineup/libero helpers, `resultFromState` |
| `src/matches/nextActions.ts` | `expectedSkill`, `orderSkills` |
| `src/matches/scoutStats.ts` | `computeStats`, `liveAlerts` |
| `src/matches/usage.ts` | usage contribution / profile math |
| `src/matches/finish.ts` | `buildFinishPayload` |
| `src/matches/eventOrder.ts` | `appendOrder`, `orderAfter` |
| `src/matches/deviceLock.ts` | device id + lock staleness |
| `src/matches/matchSetup.ts` | roster building, setup validation, default lineup |
| `src/matches/format.ts` | `fmtPct`, `fmtEff`, `describeEvent` |
| `src/matches/matchesApi.ts` | Firestore access |
| `src/matches/useMatchEvents.ts` | events listener hook |
| `src/matches/MatchSetupForm.tsx` | create/edit setup |
| `src/matches/TeamMatchesTab.tsx` | list + new match |
| `src/matches/MatchPage.tsx` | setup / live / finished switch |
| `src/matches/report/MatchReport.tsx` | report |
| `src/matches/scout/*` | scouting screen pieces |
| `firestore.rules`, `tests/rules/matches.rules.test.ts` | security |
| `src/firebase/config.ts` | persistent cache |
| `src/calendar/*`, `src/teams/TeamPage.tsx`, `src/App.tsx` | integration |
| `scripts/seed/seedMatch.mjs`, `scripts/seed/dev.mjs` | demo data |

---

### Task 1: Match types and grading vocabulary

**Files:**
- Create: `src/types/match.ts`
- Create: `src/matches/skillGrades.ts`
- Test: `src/matches/skillGrades.test.ts`

**Interfaces:**
- Produces: every type below (used by all later tasks); `SKILL_LABELS`, `GRADE_LABELS`, `validGrades(skill)`, `rallyOutcome(skill, grade): Side | null`.

- [ ] **Step 1: Create the types file**

`src/types/match.ts`:

```ts
import type { PositionCategory } from './player';

export type Skill = 'S' | 'R' | 'A' | 'B' | 'D' | 'E' | 'F';
export const SKILLS: Skill[] = ['S', 'R', 'A', 'B', 'D', 'E', 'F'];

export type Grade = '#' | '+' | '!' | '-' | '/' | '=';
export const GRADES: Grade[] = ['#', '+', '!', '-', '/', '='];

export type Side = 'us' | 'them';

export type PointReason = 'oppError' | 'oppKill' | 'oppAce' | 'oppBlock' | 'unknown';
export const POINT_REASON_LABELS: Record<PointReason, string> = {
  oppError: 'Opp. error',
  oppKill: 'Opp. kill',
  oppAce: 'Opp. ace',
  oppBlock: 'Opp. block',
  unknown: 'Other',
};

export type MatchStatus = 'setup' | 'live' | 'finished';
export type Competition = 'league' | 'cup' | 'friendly' | 'tournament';
export type HomeAway = 'home' | 'away';
export type LiberoMode = 'receiving' | 'serving' | 'always';

export interface MatchFormat {
  bestOf: 3 | 5;
  setPoints: number;
  decidingSetPoints: number;
  subsPerSet: number;
  timeoutsPerSet: number;
}

export const DEFAULT_FORMAT: MatchFormat = {
  bestOf: 5,
  setPoints: 25,
  decidingSetPoints: 15,
  subsPerSet: 6,
  timeoutsPerSet: 2,
};

/** Snapshot of a player at match time, so old reports survive number changes. */
export interface RosterEntry {
  playerId: string;
  number: number;
  name: string;
  positionCategory: PositionCategory;
}

export interface LiberoConfig {
  playerId: string;
  mode: LiberoMode;
  replaces: string[];
}

export interface SetScore {
  us: number;
  them: number;
}

export interface MatchResult {
  setsUs: number;
  setsThem: number;
  sets: SetScore[];
}

export const EMPTY_RESULT: MatchResult = { setsUs: 0, setsThem: 0, sets: [] };

export type SkillCounts = Partial<Record<Skill, number>>;
/** Per player, per skill action counts for one match. */
export type UsageContribution = Record<string, SkillCounts>;

export interface UsageProfile {
  players: Record<string, { matches: number; totals: SkillCounts }>;
}

export type GradeCounts = Record<Grade, number>;

export interface SkillLine {
  attempts: number;
  grades: GradeCounts;
}

export interface PlayerStats {
  playerId: string;
  skills: Partial<Record<Skill, SkillLine>>;
  points: number;
  errors: number;
  attackEff: number | null;
  serveEff: number | null;
  receptionPos: number | null;
  receptionPerfect: number | null;
}

export interface WonTotal {
  won: number;
  total: number;
}

export interface TeamStats {
  sideOut: WonTotal;
  breakPoint: WonTotal;
  oppErrorPoints: number;
  rotations: Record<number, { won: number; lost: number }>;
  weakestRotation: number | null;
  receptionPos: number | null;
  attackEff: number | null;
  aces: number;
  serveErrors: number;
}

export interface TimeoutEffect {
  set: number;
  team: Side;
  score: SetScore;
  won: number;
  lost: number;
}

export interface MatchStats {
  players: Record<string, PlayerStats>;
  team: TeamStats;
  timeoutEffects: TimeoutEffect[];
  sourceCounts: { tap: number; text: number };
}

export type MatchSummary = MatchStats;

export interface ActiveDevice {
  id: string;
  /** Client clock, ms since epoch. */
  at: number;
}

export interface MatchSetupInput {
  date: string;
  opponent: string;
  competition: Competition;
  homeAway: HomeAway;
  format: MatchFormat;
  roster: RosterEntry[];
  liberos: LiberoConfig[];
}

export interface Match extends MatchSetupInput {
  id: string;
  status: MatchStatus;
  result: MatchResult;
  summary: MatchSummary | null;
  usageContribution: UsageContribution | null;
  activeDevice: ActiveDevice | null;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export type EventSource = 'tap' | 'text' | 'correction';

export type MatchEventPayload =
  | { type: 'setStart'; set: number; lineup: string[]; serving: Side }
  | { type: 'action'; playerId: string; skill: Skill; grade: Grade }
  | { type: 'point'; winner: Side; reason: PointReason | null }
  | { type: 'sub'; outPlayerId: string; inPlayerId: string }
  | { type: 'timeout'; team: Side }
  | { type: 'correction'; score: SetScore | null; rotation: number | null; serving: Side | null }
  | { type: 'setEnd'; set: number };

export interface EventMeta {
  order: number;
  source: EventSource;
  chunkId: string | null;
}

export type NewMatchEvent = MatchEventPayload & EventMeta;
export type MatchEvent = NewMatchEvent & { id: string };
export type ActionEvent = Extract<MatchEvent, { type: 'action' }>;
```

- [ ] **Step 2: Write the failing test**

`src/matches/skillGrades.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GRADE_LABELS, rallyOutcome, SKILL_LABELS, validGrades } from './skillGrades';

describe('skillGrades', () => {
  it('labels every skill', () => {
    expect(SKILL_LABELS.R).toBe('Reception');
    expect(SKILL_LABELS.E).toBe('Set');
  });

  it('hides grades that make no sense for a skill', () => {
    expect(validGrades('S')).toEqual(['#', '+', '-', '/', '=']);
    expect(validGrades('E')).toEqual(['#', '+', '!', '-', '=']);
    expect(validGrades('B')).toEqual(['#', '+', '-', '/', '=']);
    expect(validGrades('A')).toEqual(['#', '+', '!', '-', '/', '=']);
  });

  it('labels grades per skill', () => {
    expect(GRADE_LABELS.A['#']).toBe('Kill');
    expect(GRADE_LABELS.S['#']).toBe('Ace');
    expect(GRADE_LABELS.B['/']).toBe('Tooled');
  });

  it('derives rally outcomes', () => {
    expect(rallyOutcome('S', '#')).toBe('us');
    expect(rallyOutcome('A', '#')).toBe('us');
    expect(rallyOutcome('B', '#')).toBe('us');
    expect(rallyOutcome('R', '#')).toBeNull();
    expect(rallyOutcome('D', '=')).toBe('them');
    expect(rallyOutcome('A', '/')).toBe('them');
    expect(rallyOutcome('B', '/')).toBe('them');
    expect(rallyOutcome('R', '/')).toBeNull();
    expect(rallyOutcome('A', '+')).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/matches/skillGrades.test.ts`
Expected: FAIL — cannot resolve `./skillGrades`.

- [ ] **Step 4: Implement**

`src/matches/skillGrades.ts`:

```ts
import { GRADES, type Grade, type Side, type Skill } from '../types/match';

export const SKILL_LABELS: Record<Skill, string> = {
  S: 'Serve',
  R: 'Reception',
  A: 'Attack',
  B: 'Block',
  D: 'Dig',
  E: 'Set',
  F: 'Free ball',
};

/** DataVolley grades with a per-skill meaning. A missing key = grade not offered. */
export const GRADE_LABELS: Record<Skill, Partial<Record<Grade, string>>> = {
  S: { '#': 'Ace', '+': 'Pressure', '-': 'Easy', '/': 'Free back', '=': 'Error' },
  R: { '#': 'Perfect', '+': 'Good', '!': 'OK', '-': 'Poor', '/': 'Overpass', '=': 'Aced' },
  A: { '#': 'Kill', '+': 'Good', '!': 'Covered', '-': 'Easy dig', '/': 'Blocked', '=': 'Error' },
  B: { '#': 'Stuff', '+': 'Touch ours', '-': 'Touch theirs', '/': 'Tooled', '=': 'Net' },
  D: { '#': 'Perfect', '+': 'Good', '!': 'OK', '-': 'Poor', '/': 'Overpass', '=': 'Error' },
  E: { '#': 'Perfect', '+': 'Good', '!': 'OK', '-': 'Poor', '=': 'Error' },
  F: { '#': 'Perfect', '+': 'Good', '!': 'OK', '-': 'Poor', '/': 'Overpass', '=': 'Error' },
};

export function validGrades(skill: Skill): Grade[] {
  return GRADES.filter((g) => GRADE_LABELS[skill][g] !== undefined);
}

/** Who wins the rally because of this action, or null if the rally continues. */
export function rallyOutcome(skill: Skill, grade: Grade): Side | null {
  if (grade === '#' && (skill === 'S' || skill === 'A' || skill === 'B')) return 'us';
  if (grade === '=') return 'them';
  if (grade === '/' && (skill === 'A' || skill === 'B')) return 'them';
  return null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/matches/skillGrades.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/match.ts src/matches/skillGrades.ts src/matches/skillGrades.test.ts
git commit -m "feat(scouting): match types and DataVolley grading vocabulary"
```

---

### Task 2: Rally engine — score, serve, rotation, sets, corrections

**Files:**
- Create: `src/matches/scoutEngine.ts`
- Create: `src/matches/testFixtures.ts` (shared test roster — not a test file, so importing it never re-runs tests)
- Test: `src/matches/scoutEngine.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `rallyOutcome`.
- Produces:
  - `type EngineMatch = Pick<Match, 'format' | 'roster' | 'liberos'>`
  - `interface RallyRecord { set: number; index: number; serving: Side; rotation: number; winner: Side; reason: PointReason | null; scoreAfter: SetScore; actionIds: string[]; endEventId: string }`
  - `interface TimeoutRecord { set: number; team: Side; ralliesBefore: number; score: SetScore; eventId: string }`
  - `interface ActionRecord { eventId: string; set: number; playerId: string; skill: Skill; grade: Grade; source: EventSource }`
  - `type WarningCode = 'noSet' | 'offCourt' | 'unknownPlayer' | 'subLimit' | 'illegalReentry' | 'subNotOnCourt' | 'timeoutLimit' | 'setEndTie'`
  - `interface EngineWarning { eventId: string; code: WarningCode; message: string }`
  - `interface MatchState { set; inSet; score; serving; rotation; lineup; court; activeLiberoId; setStartLineup; currentRally: ActionEvent[]; setsWon: SetScore; setScores: SetScore[]; subsUsed; timeoutsUsed: SetScore; setPointReached; matchOver; rallies: RallyRecord[]; timeouts: TimeoutRecord[]; actions: ActionRecord[]; warnings: EngineWarning[] }` (`setsWon`/`timeoutsUsed` reuse the `{us, them}` shape)
  - `replay(match: EngineMatch, events: MatchEvent[]): MatchState`
  - `sortEvents`, `rotateLineup`, `nextRotation`, `prevRotation`, `setTarget`, `setsToWin`, `resultFromState(state): MatchResult`
  - Lineup convention: `lineup[i]` = player in zone P(i+1). Rotation number = zone of the set's setter at set start (1 if no `S` in lineup), then 1→6→5→4→3→2→1 on each side-out.

Libero handling is added in Task 3; in this task `court` = `lineup` copy and `activeLiberoId` = `null` via a stub `applyLibero` that Task 3 replaces.

- [ ] **Step 1: Write the fixture and the failing tests**

`src/matches/testFixtures.ts`:

```ts
import type { RosterEntry } from '../types/match';

export const ROSTER: RosterEntry[] = [
  { playerId: 's', number: 2, name: 'Sofía', positionCategory: 'S' },
  { playerId: 'oh1', number: 7, name: 'Ana', positionCategory: 'OH' },
  { playerId: 'mb1', number: 11, name: 'Marta', positionCategory: 'MB' },
  { playerId: 'o', number: 4, name: 'Olga', positionCategory: 'O' },
  { playerId: 'oh2', number: 9, name: 'Lucía', positionCategory: 'OH' },
  { playerId: 'mb2', number: 12, name: 'Nora', positionCategory: 'MB' },
  { playerId: 'lib', number: 1, name: 'Lara', positionCategory: 'L' },
  { playerId: 'lib2', number: 3, name: 'Eva', positionCategory: 'L' },
  { playerId: 'bench', number: 5, name: 'Bea', positionCategory: 'OH' },
];
```

`src/matches/scoutEngine.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type MatchEvent, type MatchEventPayload, type Side } from '../types/match';
import { replay, resultFromState, type EngineMatch } from './scoutEngine';
import { ROSTER } from './testFixtures';

const LINEUP = ['s', 'oh1', 'mb1', 'o', 'oh2', 'mb2'];
const match: EngineMatch = { format: DEFAULT_FORMAT, roster: ROSTER, liberos: [] };

let n = 0;
const ev = (p: MatchEventPayload): MatchEvent => {
  n += 1;
  return { id: `e${String(n).padStart(3, '0')}`, order: n, source: 'tap', chunkId: null, ...p } as MatchEvent;
};
const start = (serving: Side = 'us', set = 1, lineup = LINEUP) => ev({ type: 'setStart', set, lineup, serving });
const act = (playerId: string, skill: 'S' | 'R' | 'A' | 'B' | 'D' | 'E' | 'F', grade: '#' | '+' | '!' | '-' | '/' | '=') =>
  ev({ type: 'action', playerId, skill, grade });
const point = (winner: Side) => ev({ type: 'point', winner, reason: winner === 'us' ? 'oppError' : null });
const correct = (c: { score?: { us: number; them: number }; rotation?: number; serving?: Side }) =>
  ev({ type: 'correction', score: c.score ?? null, rotation: c.rotation ?? null, serving: c.serving ?? null });
const setEnd = (set = 1) => ev({ type: 'setEnd', set });

describe('replay — rallies and rotation', () => {
  beforeEach(() => {
    n = 0;
  });

  it('starts empty before any set', () => {
    const s = replay(match, []);
    expect(s.set).toBe(0);
    expect(s.inSet).toBe(false);
  });

  it('starts a set with the setter zone as rotation', () => {
    const s = replay(match, [start('us')]);
    expect(s.set).toBe(1);
    expect(s.inSet).toBe(true);
    expect(s.rotation).toBe(1);
    expect(s.lineup).toEqual(LINEUP);
    expect(s.court).toEqual(LINEUP);
  });

  it('an ace scores for us and keeps the serve', () => {
    const s = replay(match, [start('us'), act('s', 'S', '#')]);
    expect(s.score).toEqual({ us: 1, them: 0 });
    expect(s.serving).toBe('us');
    expect(s.rotation).toBe(1);
    expect(s.rallies).toHaveLength(1);
  });

  it('a serve error gives them the point and the serve', () => {
    const s = replay(match, [start('us'), act('s', 'S', '=')]);
    expect(s.score).toEqual({ us: 0, them: 1 });
    expect(s.serving).toBe('them');
  });

  it('a side-out rotates the lineup clockwise', () => {
    const s = replay(match, [start('them'), act('oh1', 'R', '+'), act('s', 'E', '+'), act('oh1', 'A', '#')]);
    expect(s.score).toEqual({ us: 1, them: 0 });
    expect(s.serving).toBe('us');
    expect(s.rotation).toBe(6);
    expect(s.lineup).toEqual(['oh1', 'mb1', 'o', 'oh2', 'mb2', 's']);
  });

  it('keeps the rally open on non-ending actions', () => {
    const s = replay(match, [start('them'), act('oh1', 'R', '+'), act('s', 'E', '+')]);
    expect(s.currentRally.map((a) => a.skill)).toEqual(['R', 'E']);
    expect(s.rallies).toHaveLength(0);
  });

  it('a point event closes the rally with its reason', () => {
    const s = replay(match, [start('us'), act('s', 'S', '+'), point('us')]);
    expect(s.score).toEqual({ us: 1, them: 0 });
    expect(s.rallies[0].reason).toBe('oppError');
    expect(s.rallies[0].actionIds).toHaveLength(1);
    expect(s.currentRally).toHaveLength(0);
  });

  it('ignores and warns about events before any set', () => {
    const s = replay(match, [act('s', 'S', '#')]);
    expect(s.score).toEqual({ us: 0, them: 0 });
    expect(s.warnings[0].code).toBe('noSet');
  });

  it('sorts by order, then id, so ties are deterministic', () => {
    const a = { ...start('us'), order: 1 };
    const x = { ...act('s', 'S', '='), id: 'b', order: 2 } as MatchEvent;
    const y = { ...act('s', 'S', '#'), id: 'a', order: 2 } as MatchEvent;
    const s1 = replay(match, [a, x, y]);
    const s2 = replay(match, [y, a, x]);
    expect(s1.rallies.map((r) => r.winner)).toEqual(['us', 'them']);
    expect(s2.rallies.map((r) => r.winner)).toEqual(['us', 'them']);
  });
});

describe('replay — sets and corrections', () => {
  beforeEach(() => {
    n = 0;
  });

  it('flags set point at 25–23 but not at 25–24', () => {
    expect(replay(match, [start('us'), correct({ score: { us: 24, them: 23 } }), act('s', 'S', '#')]).setPointReached).toBe(true);
    expect(replay(match, [start('us'), correct({ score: { us: 24, them: 24 } }), act('s', 'S', '#')]).setPointReached).toBe(false);
    expect(replay(match, [start('us'), correct({ score: { us: 25, them: 24 } }), act('s', 'S', '#')]).setPointReached).toBe(true);
  });

  it('uses deciding-set points in the last set', () => {
    const s = replay(match, [start('us', 5), correct({ score: { us: 14, them: 12 } }), act('s', 'S', '#')]);
    expect(s.setPointReached).toBe(true);
  });

  it('records a set end and the match end', () => {
    const events: MatchEvent[] = [];
    for (let set = 1; set <= 3; set++) {
      events.push(start('us', set), correct({ score: { us: 25, them: 20 } }), setEnd(set));
    }
    const s = replay(match, events);
    expect(s.setsWon).toEqual({ us: 3, them: 0 });
    expect(s.setScores).toHaveLength(3);
    expect(s.inSet).toBe(false);
    expect(s.matchOver).toBe(true);
    expect(resultFromState(s)).toEqual({ setsUs: 3, setsThem: 0, sets: s.setScores });
  });

  it('refuses to end a tied set', () => {
    const s = replay(match, [start('us'), setEnd()]);
    expect(s.inSet).toBe(true);
    expect(s.warnings[0].code).toBe('setEndTie');
  });

  it('a rotation correction rotates the lineup, and later side-outs continue from it', () => {
    const s = replay(match, [start('them'), correct({ rotation: 4 })]);
    expect(s.rotation).toBe(4);
    expect(s.lineup[0]).toBe('o');
    const t = replay(match, [start('them'), correct({ rotation: 4 }), point('us')]);
    expect(t.rotation).toBe(3);
    expect(t.lineup[0]).toBe('oh2');
  });

  it('a serving correction changes who serves', () => {
    const s = replay(match, [start('us'), correct({ serving: 'them' })]);
    expect(s.serving).toBe('them');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/matches/scoutEngine.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

`src/matches/scoutEngine.ts`:

```ts
import { rallyOutcome } from './skillGrades';
import type {
  ActionEvent,
  EventSource,
  Grade,
  LiberoConfig,
  Match,
  MatchEvent,
  MatchFormat,
  MatchResult,
  PointReason,
  SetScore,
  Side,
  Skill,
} from '../types/match';

export type EngineMatch = Pick<Match, 'format' | 'roster' | 'liberos'>;

export interface RallyRecord {
  set: number;
  /** 0-based index of the rally within its set. */
  index: number;
  serving: Side;
  rotation: number;
  winner: Side;
  reason: PointReason | null;
  scoreAfter: SetScore;
  actionIds: string[];
  endEventId: string;
}

export interface TimeoutRecord {
  set: number;
  team: Side;
  ralliesBefore: number;
  score: SetScore;
  eventId: string;
}

export interface ActionRecord {
  eventId: string;
  set: number;
  playerId: string;
  skill: Skill;
  grade: Grade;
  source: EventSource;
}

export type WarningCode =
  | 'noSet'
  | 'offCourt'
  | 'unknownPlayer'
  | 'subLimit'
  | 'illegalReentry'
  | 'subNotOnCourt'
  | 'timeoutLimit'
  | 'setEndTie';

export interface EngineWarning {
  eventId: string;
  code: WarningCode;
  message: string;
}

export interface MatchState {
  set: number;
  inSet: boolean;
  score: SetScore;
  serving: Side;
  rotation: number;
  /** Base players by zone, index 0 = P1. Liberos never appear here. */
  lineup: string[];
  /** Who is physically on court by zone (libero applied). */
  court: string[];
  activeLiberoId: string | null;
  setStartLineup: string[];
  currentRally: ActionEvent[];
  setsWon: SetScore;
  setScores: SetScore[];
  subsUsed: number;
  timeoutsUsed: SetScore;
  setPointReached: boolean;
  matchOver: boolean;
  rallies: RallyRecord[];
  timeouts: TimeoutRecord[];
  actions: ActionRecord[];
  warnings: EngineWarning[];
}

export function sortEvents(events: MatchEvent[]): MatchEvent[] {
  return [...events].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Side-out rotation: P2 → P1, P1 → P6, … */
export function rotateLineup(lineup: string[]): string[] {
  return lineup.map((_, i) => lineup[(i + 1) % 6]);
}

export function nextRotation(rotation: number): number {
  return rotation === 1 ? 6 : rotation - 1;
}

export function prevRotation(rotation: number): number {
  return rotation === 6 ? 1 : rotation + 1;
}

export function setTarget(format: MatchFormat, set: number): number {
  return set === format.bestOf ? format.decidingSetPoints : format.setPoints;
}

export function setsToWin(format: MatchFormat): number {
  return Math.ceil(format.bestOf / 2);
}

/** Replaced in Task 3 with real libero logic. */
export function applyLibero(
  lineup: string[],
  _liberos: LiberoConfig[],
  _serving: Side,
): { court: string[]; activeLiberoId: string | null } {
  return { court: [...lineup], activeLiberoId: null };
}

export function resultFromState(state: MatchState): MatchResult {
  return { setsUs: state.setsWon.us, setsThem: state.setsWon.them, sets: state.setScores };
}

function initialState(): MatchState {
  return {
    set: 0,
    inSet: false,
    score: { us: 0, them: 0 },
    serving: 'us',
    rotation: 1,
    lineup: [],
    court: [],
    activeLiberoId: null,
    setStartLineup: [],
    currentRally: [],
    setsWon: { us: 0, them: 0 },
    setScores: [],
    subsUsed: 0,
    timeoutsUsed: { us: 0, them: 0 },
    setPointReached: false,
    matchOver: false,
    rallies: [],
    timeouts: [],
    actions: [],
    warnings: [],
  };
}

export function replay(match: EngineMatch, events: MatchEvent[]): MatchState {
  const s = initialState();
  const rosterIds = new Set(match.roster.map((r) => r.playerId));
  const setterIds = new Set(match.roster.filter((r) => r.positionCategory === 'S').map((r) => r.playerId));
  const liberos = match.liberos;

  const warn = (ev: MatchEvent, code: WarningCode, message: string) => {
    s.warnings.push({ eventId: ev.id, code, message });
  };
  const ralliesInSet = () => s.rallies.filter((r) => r.set === s.set).length;

  const closeRally = (winner: Side, reason: PointReason | null, endEventId: string) => {
    const scoreAfter = { ...s.score, [winner]: s.score[winner] + 1 };
    s.rallies.push({
      set: s.set,
      index: ralliesInSet(),
      serving: s.serving,
      rotation: s.rotation,
      winner,
      reason,
      scoreAfter,
      actionIds: s.currentRally.map((a) => a.id),
      endEventId,
    });
    s.score = scoreAfter;
    if (winner === 'us' && s.serving === 'them') {
      s.lineup = rotateLineup(s.lineup);
      s.rotation = nextRotation(s.rotation);
      s.serving = 'us';
    } else if (winner === 'them' && s.serving === 'us') {
      s.serving = 'them';
    }
    s.currentRally = [];
  };

  for (const ev of sortEvents(events)) {
    if (ev.type !== 'setStart' && !s.inSet) {
      warn(ev, 'noSet', 'Recorded while no set was running — ignored.');
      continue;
    }
    switch (ev.type) {
      case 'setStart': {
        s.set = ev.set;
        s.inSet = true;
        s.score = { us: 0, them: 0 };
        s.lineup = [...ev.lineup];
        s.setStartLineup = [...ev.lineup];
        s.serving = ev.serving;
        const setterZone = ev.lineup.findIndex((id) => setterIds.has(id));
        s.rotation = setterZone >= 0 ? setterZone + 1 : 1;
        s.subsUsed = 0;
        s.timeoutsUsed = { us: 0, them: 0 };
        s.currentRally = [];
        break;
      }
      case 'action': {
        if (!rosterIds.has(ev.playerId)) {
          warn(ev, 'unknownPlayer', 'Player is not in this match roster — ignored.');
          break;
        }
        if (!s.court.includes(ev.playerId)) {
          warn(ev, 'offCourt', 'Credited to a player the app shows off court.');
        }
        s.actions.push({
          eventId: ev.id,
          set: s.set,
          playerId: ev.playerId,
          skill: ev.skill,
          grade: ev.grade,
          source: ev.source,
        });
        s.currentRally.push(ev);
        const winner = rallyOutcome(ev.skill, ev.grade);
        if (winner) closeRally(winner, null, ev.id);
        break;
      }
      case 'point':
        closeRally(ev.winner, ev.reason, ev.id);
        break;
      case 'sub':
      case 'timeout':
        // Implemented in Task 3.
        break;
      case 'correction': {
        if (ev.score) s.score = { ...ev.score };
        if (ev.serving) s.serving = ev.serving;
        if (ev.rotation !== null) {
          for (let k = 0; k < 6 && s.rotation !== ev.rotation; k++) {
            s.lineup = rotateLineup(s.lineup);
            s.rotation = nextRotation(s.rotation);
          }
        }
        break;
      }
      case 'setEnd': {
        if (s.score.us === s.score.them) {
          warn(ev, 'setEndTie', 'A set cannot end tied — ignored.');
          break;
        }
        s.setScores.push({ ...s.score });
        s.setsWon[s.score.us > s.score.them ? 'us' : 'them'] += 1;
        s.inSet = false;
        s.currentRally = [];
        break;
      }
    }
    const { court, activeLiberoId } = applyLibero(s.lineup, liberos, s.serving);
    s.court = court;
    s.activeLiberoId = activeLiberoId;
  }

  const target = setTarget(match.format, s.set);
  const top = Math.max(s.score.us, s.score.them);
  s.setPointReached = s.inSet && top >= target && Math.abs(s.score.us - s.score.them) >= 2;
  s.matchOver = Math.max(s.setsWon.us, s.setsWon.them) >= setsToWin(match.format);
  return s;
}
```

Note: the `noSet` guard also catches a `setEnd` sent outside a set.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/matches/scoutEngine.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/matches/scoutEngine.ts src/matches/scoutEngine.test.ts src/matches/testFixtures.ts
git commit -m "feat(scouting): rally engine replay for score, serve, rotation and sets"
```

---

### Task 3: Rally engine — libero, substitutions, timeouts, warnings

**Files:**
- Modify: `src/matches/scoutEngine.ts`
- Test: `src/matches/scoutEngine.libero.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces: real `applyLibero(lineup, liberos, serving)`; `sub` and `timeout` handling inside `replay`; `MatchState.subsUsed`, `timeoutsUsed`, `timeouts` populated. Libero `replaces` lists follow substitutions within a set (reset each `setStart`).

- [ ] **Step 1: Write the failing tests**

`src/matches/scoutEngine.libero.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type LiberoConfig, type MatchEvent, type MatchEventPayload, type Side } from '../types/match';
import { ROSTER } from './testFixtures';
import { applyLibero, replay, type EngineMatch } from './scoutEngine';

const LINEUP = ['s', 'oh1', 'mb1', 'o', 'oh2', 'mb2']; // mb2 in P6
let n = 0;
const ev = (p: MatchEventPayload): MatchEvent => {
  n += 1;
  return { id: `e${String(n).padStart(3, '0')}`, order: n, source: 'tap', chunkId: null, ...p } as MatchEvent;
};
const start = (serving: Side = 'us', lineup = LINEUP) => ev({ type: 'setStart', set: 1, lineup, serving });
const sub = (outPlayerId: string, inPlayerId: string) => ev({ type: 'sub', outPlayerId, inPlayerId });
const to = (team: Side) => ev({ type: 'timeout', team });
const m = (liberos: LiberoConfig[], format = DEFAULT_FORMAT): EngineMatch => ({ format, roster: ROSTER, liberos });

const ALWAYS: LiberoConfig = { playerId: 'lib', mode: 'always', replaces: ['mb1', 'mb2'] };

describe('applyLibero', () => {
  it('puts the libero in for a replaced back-row player', () => {
    const r = applyLibero(LINEUP, [ALWAYS], 'them');
    expect(r.court[5]).toBe('lib');
    expect(r.activeLiberoId).toBe('lib');
  });

  it('never lets the libero serve', () => {
    const lineup = ['mb2', 's', 'oh1', 'mb1', 'o', 'oh2'];
    expect(applyLibero(lineup, [ALWAYS], 'us').court[0]).toBe('mb2');
    expect(applyLibero(lineup, [ALWAYS], 'them').court[0]).toBe('lib');
  });

  it('leaves front-row players alone', () => {
    const lineup = ['s', 'oh1', 'mb1', 'o', 'oh2', 'oh2x'];
    expect(applyLibero(lineup, [ALWAYS], 'them').court).toEqual(lineup);
  });

  it('picks the reception libero when receiving and the defence libero when serving', () => {
    const liberos: LiberoConfig[] = [
      { playerId: 'lib', mode: 'receiving', replaces: ['mb1', 'mb2'] },
      { playerId: 'lib2', mode: 'serving', replaces: ['mb1', 'mb2'] },
    ];
    expect(applyLibero(LINEUP, liberos, 'them').court[5]).toBe('lib');
    expect(applyLibero(LINEUP, liberos, 'us').court[5]).toBe('lib2');
  });

  it('has no libero on court when no mode matches', () => {
    const liberos: LiberoConfig[] = [{ playerId: 'lib', mode: 'receiving', replaces: ['mb2'] }];
    const r = applyLibero(LINEUP, liberos, 'us');
    expect(r.court[5]).toBe('mb2');
    expect(r.activeLiberoId).toBeNull();
  });
});

describe('replay — subs and timeouts', () => {
  beforeEach(() => {
    n = 0;
  });

  it('applies the libero after replay', () => {
    const s = replay(m([ALWAYS]), [start('them')]);
    expect(s.court[5]).toBe('lib');
    expect(s.lineup[5]).toBe('mb2');
  });

  it('swaps a substitute into the lineup and counts it', () => {
    const s = replay(m([]), [start('us'), sub('oh2', 'bench')]);
    expect(s.lineup[4]).toBe('bench');
    expect(s.subsUsed).toBe(1);
  });

  it('keeps the libero replacing the player who came in for a replaced player', () => {
    const s = replay(m([ALWAYS]), [start('them'), sub('mb2', 'bench')]);
    expect(s.lineup[5]).toBe('bench');
    expect(s.court[5]).toBe('lib');
  });

  it('warns past the substitution limit', () => {
    const format = { ...DEFAULT_FORMAT, subsPerSet: 1 };
    const s = replay(m([], format), [start('us'), sub('oh2', 'bench'), sub('bench', 'oh2')]);
    expect(s.warnings.map((w) => w.code)).toContain('subLimit');
  });

  it('warns on an illegal re-entry', () => {
    const s = replay(m([]), [start('us'), sub('oh2', 'bench'), sub('bench', 'oh2'), sub('oh1', 'bench')]);
    expect(s.warnings.map((w) => w.code)).toEqual(['illegalReentry']);
  });

  it('ignores a sub whose outgoing player is not on court', () => {
    const s = replay(m([]), [start('us'), sub('bench', 'oh2')]);
    expect(s.warnings[0].code).toBe('subNotOnCourt');
    expect(s.subsUsed).toBe(0);
  });

  it('counts timeouts, records them, and warns past the limit', () => {
    const s = replay(m([]), [start('us'), to('us'), to('us'), to('us'), to('them')]);
    expect(s.timeoutsUsed).toEqual({ us: 3, them: 1 });
    expect(s.timeouts).toHaveLength(4);
    expect(s.timeouts[0]).toMatchObject({ set: 1, team: 'us', ralliesBefore: 0, score: { us: 0, them: 0 } });
    expect(s.warnings.map((w) => w.code)).toEqual(['timeoutLimit']);
  });

  it('warns when crediting an off-court player but still counts the action', () => {
    const s = replay(m([]), [start('us'), ev({ type: 'action', playerId: 'bench', skill: 'A', grade: '+' })]);
    expect(s.warnings[0].code).toBe('offCourt');
    expect(s.actions).toHaveLength(1);
  });

  it('ignores actions by players outside the roster', () => {
    const s = replay(m([]), [start('us'), ev({ type: 'action', playerId: 'ghost', skill: 'A', grade: '#' })]);
    expect(s.warnings[0].code).toBe('unknownPlayer');
    expect(s.score.us).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/matches/scoutEngine.libero.test.ts` → FAIL (libero/sub/timeout assertions).

- [ ] **Step 3: Implement**

In `src/matches/scoutEngine.ts`, replace the stub `applyLibero` with:

```ts
const BACK_ROW_ZONES = [4, 5, 0]; // P5, P6, P1

/**
 * Picks the libero for the current serve state and puts them in for the first
 * back-row player they replace. Never in P1 while we serve (liberos can't serve).
 */
export function applyLibero(
  lineup: string[],
  liberos: LiberoConfig[],
  serving: Side,
): { court: string[]; activeLiberoId: string | null } {
  const court = [...lineup];
  const libero =
    liberos.find((l) => l.mode === 'always') ??
    liberos.find((l) => l.mode === (serving === 'us' ? 'serving' : 'receiving')) ??
    null;
  if (!libero) return { court, activeLiberoId: null };
  for (const zone of BACK_ROW_ZONES) {
    if (zone === 0 && serving === 'us') continue;
    if (libero.replaces.includes(lineup[zone])) {
      court[zone] = libero.playerId;
      return { court, activeLiberoId: libero.playerId };
    }
  }
  return { court, activeLiberoId: null };
}
```

In `replay`, change `const liberos = match.liberos;` to a per-set mutable copy and add re-entry pairs:

```ts
  let liberos: LiberoConfig[] = match.liberos.map((l) => ({ ...l, replaces: [...l.replaces] }));
  let pairs: Record<string, string> = {};
```

In the `setStart` case, after `s.currentRally = [];` add:

```ts
        liberos = match.liberos.map((l) => ({ ...l, replaces: [...l.replaces] }));
        pairs = {};
```

Replace the `case 'sub': case 'timeout':` stub with:

```ts
      case 'sub': {
        const zone = s.lineup.indexOf(ev.outPlayerId);
        if (zone < 0) {
          warn(ev, 'subNotOnCourt', 'Outgoing player is not in the lineup — ignored.');
          break;
        }
        const outPartner = pairs[ev.outPlayerId];
        const inPartner = pairs[ev.inPlayerId];
        if ((outPartner && outPartner !== ev.inPlayerId) || (inPartner && inPartner !== ev.outPlayerId)) {
          warn(ev, 'illegalReentry', 'A player can only re-enter for the player who replaced them.');
        } else {
          pairs[ev.outPlayerId] = ev.inPlayerId;
          pairs[ev.inPlayerId] = ev.outPlayerId;
        }
        s.lineup = s.lineup.map((id) => (id === ev.outPlayerId ? ev.inPlayerId : id));
        liberos = liberos.map((l) =>
          l.replaces.includes(ev.outPlayerId)
            ? { ...l, replaces: l.replaces.map((id) => (id === ev.outPlayerId ? ev.inPlayerId : id)) }
            : l,
        );
        s.subsUsed += 1;
        if (s.subsUsed > match.format.subsPerSet) {
          warn(ev, 'subLimit', `More than ${match.format.subsPerSet} substitutions this set.`);
        }
        break;
      }
      case 'timeout': {
        s.timeoutsUsed = { ...s.timeoutsUsed, [ev.team]: s.timeoutsUsed[ev.team] + 1 };
        s.timeouts.push({
          set: s.set,
          team: ev.team,
          ralliesBefore: ralliesInSet(),
          score: { ...s.score },
          eventId: ev.id,
        });
        if (s.timeoutsUsed[ev.team] > match.format.timeoutsPerSet) {
          warn(ev, 'timeoutLimit', `More than ${match.format.timeoutsPerSet} timeouts this set.`);
        }
        break;
      }
```

- [ ] **Step 4: Run both engine test files**

Run: `npx vitest run src/matches/scoutEngine` → PASS (both files).

- [ ] **Step 5: Commit**

```bash
git add src/matches/scoutEngine.ts src/matches/scoutEngine.libero.test.ts
git commit -m "feat(scouting): libero auto-swap, substitutions and timeouts in the engine"
```

---

### Task 4: Next-action ordering

**Files:**
- Create: `src/matches/nextActions.ts`
- Test: `src/matches/nextActions.test.ts`

**Interfaces:**
- Consumes: `MatchState` (Task 2), `rallyOutcome`, types.
- Produces:
  - `expectedSkill(state: Pick<MatchState, 'currentRally' | 'serving'>): Skill`
  - `orderSkills(args: { position: PositionCategory; isLibero: boolean; expected: Skill; matchCounts: SkillCounts; history: { matches: number; totals: SkillCounts } | null }): Skill[]`
  - `countsForPlayer(state: Pick<MatchState, 'actions'>, playerId: string): SkillCounts`

- [ ] **Step 1: Failing test**

`src/matches/nextActions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ActionEvent, Grade, Skill } from '../types/match';
import { countsForPlayer, expectedSkill, orderSkills } from './nextActions';

const a = (skill: Skill, grade: Grade = '+'): ActionEvent => ({
  id: skill + grade, order: 1, source: 'tap', chunkId: null, type: 'action', playerId: 'p', skill, grade,
});

describe('expectedSkill', () => {
  it('follows the rally phase', () => {
    expect(expectedSkill({ currentRally: [], serving: 'us' })).toBe('S');
    expect(expectedSkill({ currentRally: [], serving: 'them' })).toBe('R');
    expect(expectedSkill({ currentRally: [a('R')], serving: 'them' })).toBe('E');
    expect(expectedSkill({ currentRally: [a('E')], serving: 'them' })).toBe('A');
    expect(expectedSkill({ currentRally: [a('A')], serving: 'them' })).toBe('B');
    expect(expectedSkill({ currentRally: [a('S')], serving: 'us' })).toBe('B');
    expect(expectedSkill({ currentRally: [a('B')], serving: 'us' })).toBe('D');
    expect(expectedSkill({ currentRally: [a('D')], serving: 'us' })).toBe('E');
    expect(expectedSkill({ currentRally: [a('F')], serving: 'us' })).toBe('E');
  });
});

describe('orderSkills', () => {
  it('puts the expected skill first, then position defaults', () => {
    expect(orderSkills({ position: 'S', isLibero: false, expected: 'R', matchCounts: {}, history: null }))
      .toEqual(['R', 'E', 'S', 'D', 'B', 'A', 'F']);
  });

  it('drops skills a libero cannot perform', () => {
    expect(orderSkills({ position: 'L', isLibero: true, expected: 'S', matchCounts: {}, history: null }))
      .toEqual(['R', 'D', 'F', 'E']);
  });

  it('uses history averages when the player has no actions this match', () => {
    const order = orderSkills({
      position: 'OH', isLibero: false, expected: 'S', matchCounts: {},
      history: { matches: 2, totals: { E: 30, A: 4 } },
    });
    expect(order.slice(0, 3)).toEqual(['S', 'E', 'A']);
  });

  it('switches to current-match counts once the player has acted', () => {
    const order = orderSkills({
      position: 'OH', isLibero: false, expected: 'S', matchCounts: { B: 3 },
      history: { matches: 2, totals: { E: 30 } },
    });
    expect(order.slice(0, 2)).toEqual(['S', 'B']);
    expect(order.indexOf('E')).toBeGreaterThan(order.indexOf('R'));
  });
});

describe('countsForPlayer', () => {
  it('counts a player actions per skill', () => {
    const actions = [
      { eventId: '1', set: 1, playerId: 'p', skill: 'A' as const, grade: '#' as const, source: 'tap' as const },
      { eventId: '2', set: 1, playerId: 'p', skill: 'A' as const, grade: '=' as const, source: 'tap' as const },
      { eventId: '3', set: 1, playerId: 'q', skill: 'R' as const, grade: '#' as const, source: 'tap' as const },
    ];
    expect(countsForPlayer({ actions }, 'p')).toEqual({ A: 2 });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/matches/nextActions.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/matches/nextActions.ts`:

```ts
import type { PositionCategory } from '../types/player';
import { SKILLS, type ActionEvent, type Side, type Skill, type SkillCounts } from '../types/match';
import type { MatchState } from './scoutEngine';

const LIBERO_FORBIDDEN: Skill[] = ['S', 'A', 'B'];

const POSITION_DEFAULTS: Partial<Record<PositionCategory, Skill[]>> = {
  S: ['E', 'S', 'D', 'B', 'A'],
  L: ['R', 'D', 'F', 'E'],
  MB: ['B', 'A', 'S', 'D'],
  OH: ['R', 'A', 'S', 'D', 'B'],
  O: ['A', 'B', 'S', 'D'],
};
const GENERIC_DEFAULT: Skill[] = ['S', 'R', 'A', 'B', 'D', 'E'];

const NEXT_AFTER: Record<Skill, Skill> = {
  S: 'B',
  R: 'E',
  E: 'A',
  A: 'B',
  B: 'D',
  D: 'E',
  F: 'E',
};

export function expectedSkill(state: { currentRally: ActionEvent[]; serving: Side }): Skill {
  const last = state.currentRally[state.currentRally.length - 1];
  if (!last) return state.serving === 'us' ? 'S' : 'R';
  return NEXT_AFTER[last.skill];
}

export function countsForPlayer(state: Pick<MatchState, 'actions'>, playerId: string): SkillCounts {
  const counts: SkillCounts = {};
  for (const a of state.actions) {
    if (a.playerId === playerId) counts[a.skill] = (counts[a.skill] ?? 0) + 1;
  }
  return counts;
}

function total(counts: SkillCounts): number {
  return Object.values(counts).reduce((sum, v) => sum + (v ?? 0), 0);
}

export function orderSkills(args: {
  position: PositionCategory;
  isLibero: boolean;
  expected: Skill;
  matchCounts: SkillCounts;
  history: { matches: number; totals: SkillCounts } | null;
}): Skill[] {
  const { position, isLibero, expected, matchCounts, history } = args;
  const allowed = SKILLS.filter((s) => !(isLibero && LIBERO_FORBIDDEN.includes(s)));
  const defaults = POSITION_DEFAULTS[isLibero ? 'L' : position] ?? GENERIC_DEFAULT;
  const defaultRank = (s: Skill) => {
    const i = defaults.indexOf(s);
    return i >= 0 ? i : defaults.length + SKILLS.indexOf(s);
  };

  let weight: (s: Skill) => number = () => 0;
  if (total(matchCounts) > 0) {
    weight = (s) => matchCounts[s] ?? 0;
  } else if (history && history.matches > 0) {
    weight = (s) => (history.totals[s] ?? 0) / history.matches;
  }

  const ranked = [...allowed].sort((a, b) => weight(b) - weight(a) || defaultRank(a) - defaultRank(b));
  if (!allowed.includes(expected)) return ranked;
  return [expected, ...ranked.filter((s) => s !== expected)];
}
```

- [ ] **Step 4: Run** `npx vitest run src/matches/nextActions.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/matches/nextActions.ts src/matches/nextActions.test.ts
git commit -m "feat(scouting): rally-phase and usage-based action ordering"
```

---

### Task 5: Stats and live alerts

**Files:**
- Create: `src/matches/scoutStats.ts`
- Test: `src/matches/scoutStats.test.ts`

**Interfaces:**
- Consumes: `MatchState` (`actions`, `rallies`, `timeouts`, `set`), `rallyOutcome`.
- Produces:
  - `computeStats(state: Pick<MatchState, 'actions' | 'rallies' | 'timeouts'>, scope: { set?: number }): MatchStats`
  - `type LiveAlert = { kind: 'playerErrors'; playerId: string; errors: number } | { kind: 'oppRun'; run: number }`
  - `liveAlerts(state: Pick<MatchState, 'actions' | 'rallies' | 'set'>): LiveAlert[]`
  - `playerForm(state, playerId): 'good' | 'bad' | null` — `bad` if ≥ 3 errors this set, `good` if points − errors ≥ 3 this set.

- [ ] **Step 1: Failing test**

`src/matches/scoutStats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Grade, Side, Skill } from '../types/match';
import type { ActionRecord, RallyRecord, TimeoutRecord } from './scoutEngine';
import { computeStats, liveAlerts, playerForm } from './scoutStats';

let id = 0;
const act = (playerId: string, skill: Skill, grade: Grade, set = 1): ActionRecord => ({
  eventId: `a${++id}`, set, playerId, skill, grade, source: 'tap',
});
const rally = (winner: Side, serving: Side, rotation = 1, set = 1, index = 0, reason: RallyRecord['reason'] = null): RallyRecord => ({
  set, index, serving, rotation, winner, reason, scoreAfter: { us: 0, them: 0 }, actionIds: [], endEventId: `r${++id}`,
});
const empty = { actions: [] as ActionRecord[], rallies: [] as RallyRecord[], timeouts: [] as TimeoutRecord[] };

describe('computeStats', () => {
  it('computes attack efficiency, points and errors per player', () => {
    const actions = ['#', '#', '=', '/', '+'].map((g) => act('oh1', 'A', g as Grade));
    const p = computeStats({ ...empty, actions }, {}).players.oh1;
    expect(p.skills.A?.attempts).toBe(5);
    expect(p.skills.A?.grades['#']).toBe(2);
    expect(p.attackEff).toBe(0);
    expect(p.points).toBe(2);
    expect(p.errors).toBe(2);
  });

  it('computes reception positivity and perfect rate', () => {
    const actions = ['#', '+', '-', '='].map((g) => act('oh1', 'R', g as Grade));
    const p = computeStats({ ...empty, actions }, {}).players.oh1;
    expect(p.receptionPos).toBe(0.5);
    expect(p.receptionPerfect).toBe(0.25);
    expect(p.attackEff).toBeNull();
  });

  it('computes side-out, break point, rotations and opponent errors', () => {
    const rallies = [
      rally('us', 'them', 1),
      rally('them', 'them', 1),
      rally('us', 'us', 6, 1, 2, 'oppError'),
      rally('them', 'us', 6),
      rally('them', 'us', 6),
    ];
    const t = computeStats({ ...empty, rallies }, {}).team;
    expect(t.sideOut).toEqual({ won: 1, total: 2 });
    expect(t.breakPoint).toEqual({ won: 1, total: 3 });
    expect(t.oppErrorPoints).toBe(1);
    expect(t.rotations[6]).toEqual({ won: 1, lost: 2 });
    expect(t.weakestRotation).toBe(6);
  });

  it('filters by set', () => {
    const actions = [act('oh1', 'S', '#', 1), act('oh1', 'S', '=', 2)];
    expect(computeStats({ ...empty, actions }, { set: 2 }).players.oh1.skills.S?.grades['=']).toBe(1);
    expect(computeStats({ ...empty, actions }, { set: 2 }).players.oh1.skills.S?.grades['#']).toBe(0);
    expect(computeStats({ ...empty, actions }, {}).team.aces).toBe(1);
  });

  it('measures the run after each timeout', () => {
    const rallies = [0, 1, 2, 3, 4, 5, 6].map((i) => rally(i < 2 ? 'them' : 'us', 'us', 1, 1, i));
    const timeouts: TimeoutRecord[] = [{ set: 1, team: 'us', ralliesBefore: 2, score: { us: 0, them: 2 }, eventId: 't1' }];
    const [effect] = computeStats({ ...empty, rallies, timeouts }, {}).timeoutEffects;
    expect(effect).toEqual({ set: 1, team: 'us', score: { us: 0, them: 2 }, won: 5, lost: 0 });
  });
});

describe('liveAlerts and playerForm', () => {
  it('alerts on 3 errors in the current set and on an opponent run', () => {
    const actions = [act('oh2', 'R', '='), act('oh2', 'A', '='), act('oh2', 'A', '/')];
    const rallies = [rally('us', 'us'), rally('them', 'us'), rally('them', 'them'), rally('them', 'them')];
    const alerts = liveAlerts({ actions, rallies, set: 1 });
    expect(alerts).toContainEqual({ kind: 'playerErrors', playerId: 'oh2', errors: 3 });
    expect(alerts).toContainEqual({ kind: 'oppRun', run: 3 });
    expect(playerForm({ actions, set: 1 }, 'oh2')).toBe('bad');
  });

  it('marks a player in good form', () => {
    const actions = [act('oh1', 'A', '#'), act('oh1', 'A', '#'), act('oh1', 'S', '#')];
    expect(playerForm({ actions, set: 1 }, 'oh1')).toBe('good');
    expect(playerForm({ actions, set: 1 }, 'nobody')).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/matches/scoutStats.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/matches/scoutStats.ts`:

```ts
import { rallyOutcome } from './skillGrades';
import type { GradeCounts, MatchStats, PlayerStats, SkillLine, TeamStats } from '../types/match';
import type { MatchState } from './scoutEngine';

const emptyGrades = (): GradeCounts => ({ '#': 0, '+': 0, '!': 0, '-': 0, '/': 0, '=': 0 });

function ratio(numerator: number, attempts: number): number | null {
  return attempts === 0 ? null : numerator / attempts;
}

function attackEff(line: SkillLine | undefined): number | null {
  if (!line) return null;
  return ratio(line.grades['#'] - line.grades['='] - line.grades['/'], line.attempts);
}

function serveEff(line: SkillLine | undefined): number | null {
  if (!line) return null;
  return ratio(line.grades['#'] - line.grades['='], line.attempts);
}

function mergeLines(lines: (SkillLine | undefined)[]): SkillLine | undefined {
  const present = lines.filter((l): l is SkillLine => !!l);
  if (present.length === 0) return undefined;
  const grades = emptyGrades();
  let attempts = 0;
  for (const l of present) {
    attempts += l.attempts;
    for (const g of Object.keys(grades) as (keyof GradeCounts)[]) grades[g] += l.grades[g];
  }
  return { attempts, grades };
}

export function computeStats(
  state: Pick<MatchState, 'actions' | 'rallies' | 'timeouts'>,
  scope: { set?: number },
): MatchStats {
  const inScope = <T extends { set: number }>(x: T) => scope.set === undefined || x.set === scope.set;
  const players: Record<string, PlayerStats> = {};
  const sourceCounts = { tap: 0, text: 0 };

  for (const a of state.actions.filter(inScope)) {
    const p = (players[a.playerId] ??= {
      playerId: a.playerId,
      skills: {},
      points: 0,
      errors: 0,
      attackEff: null,
      serveEff: null,
      receptionPos: null,
      receptionPerfect: null,
    });
    const line = (p.skills[a.skill] ??= { attempts: 0, grades: emptyGrades() });
    line.attempts += 1;
    line.grades[a.grade] += 1;
    const outcome = rallyOutcome(a.skill, a.grade);
    if (outcome === 'us') p.points += 1;
    if (outcome === 'them') p.errors += 1;
    sourceCounts[a.source === 'text' ? 'text' : 'tap'] += 1;
  }

  for (const p of Object.values(players)) {
    p.attackEff = attackEff(p.skills.A);
    p.serveEff = serveEff(p.skills.S);
    const r = p.skills.R;
    p.receptionPos = r ? ratio(r.grades['#'] + r.grades['+'], r.attempts) : null;
    p.receptionPerfect = r ? ratio(r.grades['#'], r.attempts) : null;
  }

  const team: TeamStats = {
    sideOut: { won: 0, total: 0 },
    breakPoint: { won: 0, total: 0 },
    oppErrorPoints: 0,
    rotations: {},
    weakestRotation: null,
    receptionPos: null,
    attackEff: null,
    aces: 0,
    serveErrors: 0,
  };

  const rallies = state.rallies.filter(inScope);
  for (const r of rallies) {
    const bucket = r.serving === 'them' ? team.sideOut : team.breakPoint;
    bucket.total += 1;
    if (r.winner === 'us') bucket.won += 1;
    const rot = (team.rotations[r.rotation] ??= { won: 0, lost: 0 });
    if (r.winner === 'us') rot.won += 1;
    else rot.lost += 1;
    if (r.reason === 'oppError') team.oppErrorPoints += 1;
  }

  let weakest: { rotation: number; diff: number } | null = null;
  for (const [rotation, { won, lost }] of Object.entries(team.rotations)) {
    const diff = won - lost;
    if (!weakest || diff < weakest.diff) weakest = { rotation: Number(rotation), diff };
  }
  team.weakestRotation = weakest ? weakest.rotation : null;

  const all = Object.values(players);
  const reception = mergeLines(all.map((p) => p.skills.R));
  team.receptionPos = reception ? ratio(reception.grades['#'] + reception.grades['+'], reception.attempts) : null;
  team.attackEff = attackEff(mergeLines(all.map((p) => p.skills.A)));
  const serve = mergeLines(all.map((p) => p.skills.S));
  team.aces = serve?.grades['#'] ?? 0;
  team.serveErrors = serve?.grades['='] ?? 0;

  const timeoutEffects = state.timeouts.filter(inScope).map((t) => {
    const next = state.rallies.filter((r) => r.set === t.set && r.index >= t.ralliesBefore).slice(0, 5);
    return {
      set: t.set,
      team: t.team,
      score: t.score,
      won: next.filter((r) => r.winner === 'us').length,
      lost: next.filter((r) => r.winner === 'them').length,
    };
  });

  return { players, team, timeoutEffects, sourceCounts };
}

export type LiveAlert =
  | { kind: 'playerErrors'; playerId: string; errors: number }
  | { kind: 'oppRun'; run: number };

const ERROR_ALERT = 3;
const RUN_ALERT = 3;

function setTally(state: Pick<MatchState, 'actions' | 'set'>) {
  const tally: Record<string, { points: number; errors: number }> = {};
  for (const a of state.actions) {
    if (a.set !== state.set) continue;
    const t = (tally[a.playerId] ??= { points: 0, errors: 0 });
    const outcome = rallyOutcome(a.skill, a.grade);
    if (outcome === 'us') t.points += 1;
    if (outcome === 'them') t.errors += 1;
  }
  return tally;
}

export function liveAlerts(state: Pick<MatchState, 'actions' | 'rallies' | 'set'>): LiveAlert[] {
  const alerts: LiveAlert[] = [];
  for (const [playerId, t] of Object.entries(setTally(state))) {
    if (t.errors >= ERROR_ALERT) alerts.push({ kind: 'playerErrors', playerId, errors: t.errors });
  }
  const setRallies = state.rallies.filter((r) => r.set === state.set);
  let run = 0;
  for (let i = setRallies.length - 1; i >= 0 && setRallies[i].winner === 'them'; i--) run += 1;
  if (run >= RUN_ALERT) alerts.push({ kind: 'oppRun', run });
  return alerts;
}

export function playerForm(state: Pick<MatchState, 'actions' | 'set'>, playerId: string): 'good' | 'bad' | null {
  const t = setTally(state)[playerId];
  if (!t) return null;
  if (t.errors >= ERROR_ALERT) return 'bad';
  if (t.points - t.errors >= 3) return 'good';
  return null;
}
```

- [ ] **Step 4: Run** `npx vitest run src/matches/scoutStats.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/matches/scoutStats.ts src/matches/scoutStats.test.ts
git commit -m "feat(scouting): per-player/team stats, timeout effects and live alerts"
```

---

### Task 6: Usage history, finish payload, event ordering, device lock, formatting

Small pure helpers used by the UI.

**Files:**
- Create: `src/matches/usage.ts`, `src/matches/finish.ts`, `src/matches/eventOrder.ts`, `src/matches/deviceLock.ts`, `src/matches/format.ts`
- Test: `src/matches/usage.test.ts`, `src/matches/eventOrder.test.ts`, `src/matches/deviceLock.test.ts`, `src/matches/format.test.ts`

**Interfaces:**
- Produces:
  - `computeUsageContribution(state: Pick<MatchState, 'actions'>): UsageContribution`
  - `applyUsage(profile: UsageProfile, previous: UsageContribution | null, next: UsageContribution): UsageProfile`
  - `buildFinishPayload(match: Match, state: MatchState, profile: UsageProfile): { summary: MatchSummary; usageContribution: UsageContribution; result: MatchResult; usageProfile: UsageProfile }`
  - `appendOrder(events: { order: number }[]): number`; `orderAfter(events: { id: string; order: number }[], anchorId: string): number`
  - `getDeviceId(): string`; `LOCK_STALE_MS`; `isLockedByOther(active: ActiveDevice | null, myId: string, now: number): boolean`
  - `fmtPct(x: number | null): string`; `fmtEff(x: number | null): string`; `describeEvent(ev: MatchEvent, roster: Map<string, RosterEntry>): string`; `rosterMap(roster: RosterEntry[]): Map<string, RosterEntry>`; `playerLabel(entry: RosterEntry | undefined): string`

- [ ] **Step 1: Failing tests**

`src/matches/usage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyUsage, computeUsageContribution } from './usage';

describe('usage', () => {
  it('counts actions per player and skill', () => {
    const actions = [
      { eventId: '1', set: 1, playerId: 'p', skill: 'A' as const, grade: '#' as const, source: 'tap' as const },
      { eventId: '2', set: 2, playerId: 'p', skill: 'A' as const, grade: '+' as const, source: 'tap' as const },
      { eventId: '3', set: 1, playerId: 'q', skill: 'E' as const, grade: '+' as const, source: 'tap' as const },
    ];
    expect(computeUsageContribution({ actions })).toEqual({ p: { A: 2 }, q: { E: 1 } });
  });

  it('adds a first contribution', () => {
    const profile = applyUsage({ players: {} }, null, { p: { A: 2 } });
    expect(profile).toEqual({ players: { p: { matches: 1, totals: { A: 2 } } } });
  });

  it('replaces a previous contribution instead of double counting on re-finish', () => {
    const once = applyUsage({ players: { p: { matches: 3, totals: { A: 10 } } } }, null, { p: { A: 2 } });
    const again = applyUsage(once, { p: { A: 2 } }, { p: { A: 5 }, q: { R: 1 } });
    expect(again.players.p).toEqual({ matches: 4, totals: { A: 15 } });
    expect(again.players.q).toEqual({ matches: 1, totals: { R: 1 } });
  });

  it('removes a player whose only match contribution is withdrawn', () => {
    const once = applyUsage({ players: {} }, null, { p: { A: 2 } });
    expect(applyUsage(once, { p: { A: 2 } }, {}).players.p).toBeUndefined();
  });
});
```

`src/matches/eventOrder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { appendOrder, orderAfter } from './eventOrder';

describe('eventOrder', () => {
  it('appends after the highest order', () => {
    expect(appendOrder([])).toBe(1);
    expect(appendOrder([{ order: 3 }, { order: 7 }])).toBe(8);
  });

  it('inserts at the midpoint after an anchor', () => {
    const events = [{ id: 'a', order: 1 }, { id: 'b', order: 2 }, { id: 'c', order: 3 }];
    expect(orderAfter(events, 'a')).toBe(1.5);
    expect(orderAfter(events, 'c')).toBe(4);
    expect(orderAfter(events, 'missing')).toBe(4);
  });
});
```

`src/matches/deviceLock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getDeviceId, isLockedByOther, LOCK_STALE_MS } from './deviceLock';

describe('deviceLock', () => {
  it('returns a stable device id', () => {
    expect(getDeviceId()).toBe(getDeviceId());
  });

  it('is locked only by another, recently active device', () => {
    const now = 1_000_000;
    expect(isLockedByOther(null, 'me', now)).toBe(false);
    expect(isLockedByOther({ id: 'me', at: now }, 'me', now)).toBe(false);
    expect(isLockedByOther({ id: 'other', at: now - 1000 }, 'me', now)).toBe(true);
    expect(isLockedByOther({ id: 'other', at: now - LOCK_STALE_MS - 1 }, 'me', now)).toBe(false);
  });
});
```

`src/matches/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { MatchEvent, RosterEntry } from '../types/match';
import { describeEvent, fmtEff, fmtPct, rosterMap } from './format';

const roster: RosterEntry[] = [
  { playerId: 'p7', number: 7, name: 'Ana', positionCategory: 'OH' },
  { playerId: 'p9', number: 9, name: 'Lucía', positionCategory: 'OH' },
];
const meta = { id: 'e', order: 1, source: 'tap' as const, chunkId: null };

describe('format', () => {
  it('formats percentages and efficiencies', () => {
    expect(fmtPct(null)).toBe('—');
    expect(fmtPct(0.526)).toBe('53%');
    expect(fmtEff(0.25)).toBe('+25%');
    expect(fmtEff(-0.1)).toBe('-10%');
  });

  it('describes events for the timeline', () => {
    const map = rosterMap(roster);
    const ev = (e: object) => ({ ...meta, ...e }) as MatchEvent;
    expect(describeEvent(ev({ type: 'action', playerId: 'p7', skill: 'A', grade: '#' }), map)).toBe('#7 Attack # Kill');
    expect(describeEvent(ev({ type: 'point', winner: 'them', reason: 'oppKill' }), map)).toBe('Point them · Opp. kill');
    expect(describeEvent(ev({ type: 'sub', outPlayerId: 'p7', inPlayerId: 'p9' }), map)).toBe('Sub #9 in for #7');
    expect(describeEvent(ev({ type: 'timeout', team: 'us' }), map)).toBe('Timeout us');
    expect(describeEvent(ev({ type: 'setStart', set: 2, lineup: [], serving: 'them' }), map)).toBe('Set 2 · they serve');
    expect(describeEvent(ev({ type: 'correction', score: { us: 3, them: 4 }, rotation: null, serving: null }), map))
      .toBe('Correction · score 3–4');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/matches/usage.test.ts src/matches/eventOrder.test.ts src/matches/deviceLock.test.ts src/matches/format.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/matches/usage.ts`:

```ts
import type { Skill, SkillCounts, UsageContribution, UsageProfile } from '../types/match';
import type { MatchState } from './scoutEngine';

export function computeUsageContribution(state: Pick<MatchState, 'actions'>): UsageContribution {
  const out: UsageContribution = {};
  for (const a of state.actions) {
    const counts = (out[a.playerId] ??= {});
    counts[a.skill] = (counts[a.skill] ?? 0) + 1;
  }
  return out;
}

function addCounts(totals: SkillCounts, delta: SkillCounts, sign: 1 | -1): SkillCounts {
  const next: SkillCounts = { ...totals };
  for (const [skill, value] of Object.entries(delta) as [Skill, number][]) {
    const v = (next[skill] ?? 0) + sign * value;
    if (v > 0) next[skill] = v;
    else delete next[skill];
  }
  return next;
}

/** Removes `previous` (if this match was finished before) and adds `next`. */
export function applyUsage(
  profile: UsageProfile,
  previous: UsageContribution | null,
  next: UsageContribution,
): UsageProfile {
  const players: UsageProfile['players'] = {};
  for (const [id, entry] of Object.entries(profile.players)) players[id] = { matches: entry.matches, totals: { ...entry.totals } };

  for (const [id, counts] of Object.entries(previous ?? {})) {
    const entry = players[id];
    if (!entry) continue;
    entry.matches = Math.max(0, entry.matches - 1);
    entry.totals = addCounts(entry.totals, counts, -1);
    if (entry.matches === 0) delete players[id];
  }
  for (const [id, counts] of Object.entries(next)) {
    const entry = (players[id] ??= { matches: 0, totals: {} });
    entry.matches += 1;
    entry.totals = addCounts(entry.totals, counts, 1);
  }
  return { players };
}
```

`src/matches/finish.ts`:

```ts
import type { Match, MatchResult, MatchSummary, UsageContribution, UsageProfile } from '../types/match';
import { resultFromState, type MatchState } from './scoutEngine';
import { computeStats } from './scoutStats';
import { applyUsage, computeUsageContribution } from './usage';

export interface FinishPayload {
  summary: MatchSummary;
  usageContribution: UsageContribution;
  result: MatchResult;
  usageProfile: UsageProfile;
}

export function buildFinishPayload(match: Match, state: MatchState, profile: UsageProfile): FinishPayload {
  const usageContribution = computeUsageContribution(state);
  return {
    summary: computeStats(state, {}),
    usageContribution,
    result: resultFromState(state),
    usageProfile: applyUsage(profile, match.usageContribution, usageContribution),
  };
}
```

`src/matches/eventOrder.ts`:

```ts
export function appendOrder(events: { order: number }[]): number {
  return events.length === 0 ? 1 : Math.max(...events.map((e) => e.order)) + 1;
}

/** An order strictly between the anchor and the event after it (or after the end). */
export function orderAfter(events: { id: string; order: number }[], anchorId: string): number {
  const sorted = [...events].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((e) => e.id === anchorId);
  if (i < 0) return appendOrder(events);
  const next = sorted[i + 1];
  return next ? (sorted[i].order + next.order) / 2 : sorted[i].order + 1;
}
```

`src/matches/deviceLock.ts`:

```ts
import type { ActiveDevice } from '../types/match';

const KEY = 'vcb.scoutDeviceId';
export const LOCK_STALE_MS = 2 * 60 * 1000;
let memoryId: string | null = null;

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `dev-${Math.random().toString(36).slice(2)}`;
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    memoryId ??= newId();
    return memoryId;
  }
}

export function isLockedByOther(active: ActiveDevice | null, myId: string, now: number): boolean {
  return !!active && active.id !== myId && now - active.at < LOCK_STALE_MS;
}
```

`src/matches/format.ts`:

```ts
import { POINT_REASON_LABELS, type MatchEvent, type RosterEntry } from '../types/match';
import { GRADE_LABELS, SKILL_LABELS } from './skillGrades';

export function fmtPct(x: number | null): string {
  return x === null ? '—' : `${Math.round(x * 100)}%`;
}

export function fmtEff(x: number | null): string {
  if (x === null) return '—';
  const pct = Math.round(x * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

export function rosterMap(roster: RosterEntry[]): Map<string, RosterEntry> {
  return new Map(roster.map((r) => [r.playerId, r]));
}

export function playerLabel(entry: RosterEntry | undefined): string {
  return entry ? `#${entry.number}` : '#?';
}

export function describeEvent(ev: MatchEvent, roster: Map<string, RosterEntry>): string {
  switch (ev.type) {
    case 'action':
      return `${playerLabel(roster.get(ev.playerId))} ${SKILL_LABELS[ev.skill]} ${ev.grade} ${GRADE_LABELS[ev.skill][ev.grade] ?? ''}`.trim();
    case 'point':
      return `Point ${ev.winner}${ev.reason ? ` · ${POINT_REASON_LABELS[ev.reason]}` : ''}`;
    case 'sub':
      return `Sub ${playerLabel(roster.get(ev.inPlayerId))} in for ${playerLabel(roster.get(ev.outPlayerId))}`;
    case 'timeout':
      return `Timeout ${ev.team}`;
    case 'setStart':
      return `Set ${ev.set} · ${ev.serving === 'us' ? 'we serve' : 'they serve'}`;
    case 'setEnd':
      return `Set ${ev.set} end`;
    case 'correction': {
      const parts: string[] = [];
      if (ev.score) parts.push(`score ${ev.score.us}–${ev.score.them}`);
      if (ev.rotation !== null) parts.push(`rotation ${ev.rotation}`);
      if (ev.serving) parts.push(ev.serving === 'us' ? 'we serve' : 'they serve');
      return `Correction · ${parts.join(', ')}`;
    }
  }
}
```

- [ ] **Step 4: Run the four test files** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/matches/usage.ts src/matches/finish.ts src/matches/eventOrder.ts src/matches/deviceLock.ts src/matches/format.ts src/matches/*.test.ts
git commit -m "feat(scouting): usage history, finish payload, event ordering, device lock and formatting helpers"
```

---

### Task 7: Security rules for matches, events and usage

**Files:**
- Modify: `firestore.rules` (inside `match /teams/{teamId} { … }`, after the `testingSessions` block)
- Test: `tests/rules/matches.rules.test.ts`

**Interfaces:**
- Produces: rules for `teams/{teamId}/matches/{matchId}`, `…/events/{eventId}`, `teams/{teamId}/scoutProfile/{docId}`.

- [ ] **Step 1: Failing rules test**

`tests/rules/matches.rules.test.ts`:

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

const MATCH = {
  date: '2026-10-18',
  opponent: 'Rivals',
  status: 'setup',
  createdBy: 'coach-uid',
};
const ACTION = { type: 'action', order: 1, source: 'tap', chunkId: null, playerId: 'p1', skill: 'A', grade: '#' };

describe('matches rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('adminAllowlist/super@example.com').set({});
      await db.doc('users/super-uid').set({ role: 'superadmin', email: 'super@example.com' });
      await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
      await db.doc('teams/team-2').set({ name: 'U15', adminEmails: ['other@example.com'] });
      await db.doc('teams/team-1/players/p1').set({ fullName: 'P', viewerEmails: ['parent@example.com'] });
      await db.doc('teams/team-1/matches/m1').set(MATCH);
      await db.doc('teams/team-1/matches/m1/events/e1').set(ACTION);
      await db.doc('teams/team-1/scoutProfile/usage').set({ players: {} });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  const as = async (uid: string, email: string) =>
    (await getTestEnv()).authenticatedContext(uid, { email }).firestore();

  it('lets the team admin read and write matches, events and usage', async () => {
    const db = await as('coach-uid', 'coach@example.com');
    await assertSucceeds(db.doc('teams/team-1/matches/m1').get());
    await assertSucceeds(db.collection('teams/team-1/matches').add(MATCH));
    await assertSucceeds(db.doc('teams/team-1/matches/m1').update({ status: 'live' }));
    await assertSucceeds(db.collection('teams/team-1/matches/m1/events').orderBy('order').limit(10).get());
    await assertSucceeds(db.collection('teams/team-1/matches/m1/events').add({ ...ACTION, order: 2 }));
    await assertSucceeds(db.doc('teams/team-1/matches/m1/events/e1').update({ grade: '=' }));
    await assertSucceeds(db.doc('teams/team-1/matches/m1/events/e1').delete());
    await assertSucceeds(db.doc('teams/team-1/scoutProfile/usage').set({ players: { p1: { matches: 1, totals: {} } } }));
    await assertSucceeds(db.doc('teams/team-1/matches/m1').delete());
  });

  it('lets a superadmin read matches of any team', async () => {
    const db = await as('super-uid', 'super@example.com');
    await assertSucceeds(db.doc('teams/team-1/matches/m1').get());
  });

  it('denies another team admin, a guardian viewer and strangers', async () => {
    for (const [uid, email] of [
      ['other-uid', 'other@example.com'],
      ['parent-uid', 'parent@example.com'],
      ['x-uid', 'x@example.com'],
    ]) {
      const db = await as(uid, email);
      await assertFails(db.doc('teams/team-1/matches/m1').get());
      await assertFails(db.doc('teams/team-1/matches/m1/events/e1').get());
      await assertFails(db.collection('teams/team-1/matches/m1/events').add(ACTION));
      await assertFails(db.doc('teams/team-1/scoutProfile/usage').get());
    }
  });

  it('denies unauthenticated access', async () => {
    const db = (await getTestEnv()).unauthenticatedContext().firestore();
    await assertFails(db.doc('teams/team-1/matches/m1').get());
  });

  it('validates match docs', async () => {
    const db = await as('coach-uid', 'coach@example.com');
    await assertFails(db.collection('teams/team-1/matches').add({ ...MATCH, createdBy: 'someone-else' }));
    await assertFails(db.collection('teams/team-1/matches').add({ ...MATCH, status: 'paused' }));
    await assertFails(db.collection('teams/team-1/matches').add({ ...MATCH, date: 20261018 }));
    await assertFails(db.doc('teams/team-1/matches/m1').update({ status: 'paused' }));
  });

  it('validates events', async () => {
    const db = await as('coach-uid', 'coach@example.com');
    const events = db.collection('teams/team-1/matches/m1/events');
    await assertFails(events.add({ ...ACTION, grade: '++' }));
    await assertFails(events.add({ ...ACTION, skill: 'X' }));
    await assertFails(events.add({ ...ACTION, type: 'party' }));
    await assertFails(events.add({ ...ACTION, order: '1' }));
    await assertFails(events.add({ ...ACTION, source: 'magic' }));
    await assertSucceeds(events.add({ type: 'point', order: 3, source: 'tap', chunkId: null, winner: 'us', reason: null }));
  });
});
```

- [ ] **Step 2: Run** `npm run test:rules -- tests/rules/matches.rules.test.ts` (or plain `npm run test:rules`) → FAIL (all denied).

- [ ] **Step 3: Add the rules**

In `firestore.rules`, inside `match /teams/{teamId} {`, after the closing brace of `match /testingSessions/{sessionId} { … }`, add:

```
      match /matches/{matchId} {
        function isTeamAdmin() {
          return request.auth != null && (isSuperAdmin() || request.auth.token.email in
            get(/databases/$(database)/documents/teams/$(teamId)).data.adminEmails);
        }
        function validStatus(d) {
          return d.status in ['setup', 'live', 'finished'];
        }
        allow read, delete: if isTeamAdmin();
        allow create: if isTeamAdmin()
          && request.resource.data.createdBy == request.auth.uid
          && request.resource.data.date is string
          && validStatus(request.resource.data);
        allow update: if isTeamAdmin()
          && request.resource.data.date is string
          && validStatus(request.resource.data);

        match /events/{eventId} {
          function isTeamAdmin() {
            return request.auth != null && (isSuperAdmin() || request.auth.token.email in
              get(/databases/$(database)/documents/teams/$(teamId)).data.adminEmails);
          }
          function validEvent(d) {
            return d.type in ['setStart', 'action', 'point', 'sub', 'timeout', 'correction', 'setEnd']
              && d.order is number
              && d.source in ['tap', 'text', 'correction']
              && (d.type != 'action'
                  || (d.skill in ['S', 'R', 'A', 'B', 'D', 'E', 'F']
                      && d.grade in ['#', '+', '!', '-', '/', '=']));
          }
          allow read, delete: if isTeamAdmin();
          allow create, update: if isTeamAdmin() && validEvent(request.resource.data);
        }
      }

      match /scoutProfile/{docId} {
        function isTeamAdmin() {
          return request.auth != null && (isSuperAdmin() || request.auth.token.email in
            get(/databases/$(database)/documents/teams/$(teamId)).data.adminEmails);
        }
        allow read, write: if isTeamAdmin();
      }
```

Check `isSuperAdmin()` at the top of the file (line ~4) — it already exists and is used the same way by `calendar`.

- [ ] **Step 4: Run** `npm run test:rules` → all rules tests PASS (including existing files).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/rules/matches.rules.test.ts
git commit -m "feat(scouting): security rules for matches, events and usage profile"
```

---

### Task 8: Persistent cache + matches API + events hook

**Files:**
- Modify: `src/firebase/config.ts`
- Create: `src/matches/matchesApi.ts`, `src/matches/useMatchEvents.ts`
- Test: `src/matches/matchesApi.test.ts`

**Interfaces:**
- Consumes: types; `listPlayers` from `src/players/playersApi.ts` (`(teamId, afterDoc) => Promise<{ players, lastDoc, hasMore }>`).
- Produces (`matchesApi.ts`):
  - `MATCH_EVENTS_CAP = 2000`
  - `listMatches(teamId, afterDoc?: QueryDocumentSnapshot | null): Promise<{ matches: Match[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }>`
  - `listMatchesInRange(teamId, start: string, end: string): Promise<Match[]>`
  - `getMatch(teamId, matchId): Promise<Match | null>`
  - `createMatch(teamId, input: MatchSetupInput, uid): Promise<string>`
  - `updateMatchSetup(teamId, matchId, input: MatchSetupInput): Promise<void>`
  - `setMatchStatus(teamId, matchId, status: MatchStatus): Promise<void>`
  - `updateMatchResult(teamId, matchId, result: MatchResult): Promise<void>`
  - `claimDevice(teamId, matchId, deviceId: string): Promise<void>`
  - `deleteMatch(teamId, matchId): Promise<void>`
  - `subscribeEvents(teamId, matchId, onChange: (events: MatchEvent[], pending: number) => void, onError: (e: Error) => void): () => void`
  - `addEvent(teamId, matchId, event: NewMatchEvent, uid): { id: string; written: Promise<void> }`
  - `updateEvent(teamId, matchId, eventId, patch: Partial<NewMatchEvent>): Promise<void>`
  - `deleteEvents(teamId, matchId, ids: string[]): Promise<void>`
  - `getUsageProfile(teamId): Promise<UsageProfile>`
  - `finishMatch(teamId, matchId, payload: FinishPayload): Promise<void>`
  - `loadTeamRoster(teamId): Promise<Player[]>`
- Produces (`useMatchEvents.ts`): `useMatchEvents(teamId, matchId): { events: MatchEvent[] | null; pending: number; error: string | null }`

- [ ] **Step 1: Switch Firestore to the persistent cache**

In `src/firebase/config.ts` change the import and initialization:

```ts
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
```

and replace `export const db = getFirestore(app);` with:

```ts
// Persistent (IndexedDB) cache: writes made offline — e.g. scouting a match in
// a gym with no signal — survive reloads and sync when the connection returns.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
```

(`getFirestore` is no longer imported — `noUnusedLocals` would fail otherwise.)

- [ ] **Step 2: Failing API test**

`src/matches/matchesApi.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT } from '../types/match';
import { addEvent, createMatch, listMatchesInRange, loadTeamRoster, subscribeEvents } from './matchesApi';
import * as playersApi from '../players/playersApi';

const m = vi.hoisted(() => ({
  setDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  doc: vi.fn((..._args: unknown[]) => ({ id: 'new-id' })),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'col'),
  doc: m.doc,
  setDoc: m.setDoc,
  getDoc: vi.fn(),
  getDocs: m.getDocs,
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: m.onSnapshot,
  writeBatch: vi.fn(() => ({ update: vi.fn(), set: vi.fn(), delete: vi.fn(), commit: vi.fn(() => Promise.resolve()) })),
  query: vi.fn((...args: unknown[]) => args),
  where: m.where,
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  startAfter: vi.fn(),
  serverTimestamp: () => 'ts',
}));
vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('../players/playersApi');

describe('matchesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a match in setup state with an empty result', async () => {
    const id = await createMatch(
      'team-1',
      { date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT, roster: [], liberos: [] },
      'uid-1',
    );
    expect(id).toBe('new-id');
    expect(m.setDoc).toHaveBeenCalledWith(
      { id: 'new-id' },
      expect.objectContaining({ status: 'setup', summary: null, usageContribution: null, activeDevice: null, createdBy: 'uid-1' }),
    );
  });

  it('queries matches in a date range', async () => {
    m.getDocs.mockResolvedValue({ docs: [{ id: 'm1', data: () => ({ date: '2026-10-18' }) }] });
    expect(await listMatchesInRange('team-1', '2026-10-01', '2026-10-31')).toEqual([{ id: 'm1', date: '2026-10-18' }]);
    expect(m.where).toHaveBeenCalledWith('date', '>=', '2026-10-01');
    expect(m.where).toHaveBeenCalledWith('date', '<=', '2026-10-31');
  });

  it('writes an event without awaiting the server and returns its id', () => {
    const { id, written } = addEvent(
      'team-1', 'm1',
      { type: 'timeout', team: 'us', order: 3, source: 'tap', chunkId: null },
      'uid-1',
    );
    expect(id).toBe('new-id');
    expect(written).toBeInstanceOf(Promise);
    expect(m.setDoc).toHaveBeenCalledWith({ id: 'new-id' }, expect.objectContaining({ type: 'timeout', order: 3, createdBy: 'uid-1' }));
  });

  it('reports pending writes from snapshot metadata', () => {
    m.onSnapshot.mockImplementation((_q, _opts, next) => {
      next({
        metadata: { hasPendingWrites: true },
        docs: [
          { id: 'e1', data: () => ({ order: 1 }), metadata: { hasPendingWrites: false } },
          { id: 'e2', data: () => ({ order: 2 }), metadata: { hasPendingWrites: true } },
        ],
      });
      return () => undefined;
    });
    const onChange = vi.fn();
    subscribeEvents('team-1', 'm1', onChange, vi.fn());
    expect(onChange).toHaveBeenCalledWith([{ id: 'e1', order: 1 }, { id: 'e2', order: 2 }], 1);
  });

  it('loads every roster page', async () => {
    vi.mocked(playersApi.listPlayers)
      .mockResolvedValueOnce({ players: [{ id: 'a' }] as never, lastDoc: 'cursor' as never, hasMore: true })
      .mockResolvedValueOnce({ players: [{ id: 'b' }] as never, lastDoc: null, hasMore: false });
    expect((await loadTeamRoster('team-1')).map((p) => p.id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 3: Run** `npx vitest run src/matches/matchesApi.test.ts` → FAIL.

- [ ] **Step 4: Implement**

`src/matches/matchesApi.ts`:

```ts
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { listPlayers } from '../players/playersApi';
import type { Player } from '../types/player';
import {
  EMPTY_RESULT,
  type Match,
  type MatchEvent,
  type MatchResult,
  type MatchSetupInput,
  type MatchStatus,
  type NewMatchEvent,
  type UsageProfile,
} from '../types/match';
import type { FinishPayload } from './finish';

const MATCHES_PAGE_SIZE = 20;
const MATCHES_MONTH_CAP = 50;
export const MATCH_EVENTS_CAP = 2000;
const BATCH_LIMIT = 450;

const matchesCol = (teamId: string) => collection(db, 'teams', teamId, 'matches');
const matchDoc = (teamId: string, matchId: string) => doc(db, 'teams', teamId, 'matches', matchId);
const eventsCol = (teamId: string, matchId: string) => collection(db, 'teams', teamId, 'matches', matchId, 'events');
const usageDoc = (teamId: string) => doc(db, 'teams', teamId, 'scoutProfile', 'usage');

const toMatch = (id: string, data: object) => ({ id, ...data }) as Match;

export interface MatchesPage {
  matches: Match[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export async function listMatches(teamId: string, afterDoc: QueryDocumentSnapshot | null = null): Promise<MatchesPage> {
  const q = afterDoc
    ? query(matchesCol(teamId), orderBy('date', 'desc'), startAfter(afterDoc), limit(MATCHES_PAGE_SIZE))
    : query(matchesCol(teamId), orderBy('date', 'desc'), limit(MATCHES_PAGE_SIZE));
  const snapshot = await getDocs(q);
  return {
    matches: snapshot.docs.map((d) => toMatch(d.id, d.data())),
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === MATCHES_PAGE_SIZE,
  };
}

export async function listMatchesInRange(teamId: string, start: string, end: string): Promise<Match[]> {
  const snapshot = await getDocs(
    query(matchesCol(teamId), where('date', '>=', start), where('date', '<=', end), orderBy('date'), limit(MATCHES_MONTH_CAP)),
  );
  return snapshot.docs.map((d) => toMatch(d.id, d.data()));
}

export async function getMatch(teamId: string, matchId: string): Promise<Match | null> {
  const snapshot = await getDoc(matchDoc(teamId, matchId));
  return snapshot.exists() ? toMatch(snapshot.id, snapshot.data()) : null;
}

export async function createMatch(teamId: string, input: MatchSetupInput, uid: string): Promise<string> {
  const ref = doc(matchesCol(teamId));
  await setDoc(ref, {
    ...input,
    status: 'setup',
    result: EMPTY_RESULT,
    summary: null,
    usageContribution: null,
    activeDevice: null,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export function updateMatchSetup(teamId: string, matchId: string, input: MatchSetupInput): Promise<void> {
  return updateDoc(matchDoc(teamId, matchId), { ...input, updatedAt: serverTimestamp() });
}

export function setMatchStatus(teamId: string, matchId: string, status: MatchStatus): Promise<void> {
  return updateDoc(matchDoc(teamId, matchId), { status, updatedAt: serverTimestamp() });
}

export function updateMatchResult(teamId: string, matchId: string, result: MatchResult): Promise<void> {
  return updateDoc(matchDoc(teamId, matchId), { result, updatedAt: serverTimestamp() });
}

export function claimDevice(teamId: string, matchId: string, deviceId: string): Promise<void> {
  return updateDoc(matchDoc(teamId, matchId), { activeDevice: { id: deviceId, at: Date.now() } });
}

export async function deleteMatch(teamId: string, matchId: string): Promise<void> {
  const events = await getDocs(query(eventsCol(teamId, matchId), limit(MATCH_EVENTS_CAP)));
  for (let i = 0; i < events.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    events.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(matchDoc(teamId, matchId));
}

export function subscribeEvents(
  teamId: string,
  matchId: string,
  onChange: (events: MatchEvent[], pending: number) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(eventsCol(teamId, matchId), orderBy('order'), limit(MATCH_EVENTS_CAP)),
    { includeMetadataChanges: true },
    (snapshot) => {
      const events = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MatchEvent);
      const pendingDocs = snapshot.docs.filter((d) => d.metadata.hasPendingWrites).length;
      onChange(events, pendingDocs === 0 && snapshot.metadata.hasPendingWrites ? 1 : pendingDocs);
    },
    onError,
  );
}

/** Not awaited by callers: offline writes only resolve once the server acks. */
export function addEvent(teamId: string, matchId: string, event: NewMatchEvent, uid: string): { id: string; written: Promise<void> } {
  const ref = doc(eventsCol(teamId, matchId));
  const written = setDoc(ref, { ...event, createdBy: uid, createdAt: serverTimestamp() });
  return { id: ref.id, written };
}

export function updateEvent(teamId: string, matchId: string, eventId: string, patch: Partial<NewMatchEvent>): Promise<void> {
  return updateDoc(doc(eventsCol(teamId, matchId), eventId), patch);
}

export function deleteEvents(teamId: string, matchId: string, ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(eventsCol(teamId, matchId), id)));
  return batch.commit();
}

export async function getUsageProfile(teamId: string): Promise<UsageProfile> {
  const snapshot = await getDoc(usageDoc(teamId));
  return snapshot.exists() ? (snapshot.data() as UsageProfile) : { players: {} };
}

export function finishMatch(teamId: string, matchId: string, payload: FinishPayload): Promise<void> {
  const batch = writeBatch(db);
  batch.update(matchDoc(teamId, matchId), {
    status: 'finished',
    summary: payload.summary,
    usageContribution: payload.usageContribution,
    result: payload.result,
    updatedAt: serverTimestamp(),
  });
  batch.set(usageDoc(teamId), payload.usageProfile);
  return batch.commit();
}

/** Teams are ~20 players; pages through the existing bounded player query. */
export async function loadTeamRoster(teamId: string): Promise<Player[]> {
  const all: Player[] = [];
  let cursor: QueryDocumentSnapshot | null = null;
  for (;;) {
    const page = await listPlayers(teamId, cursor);
    all.push(...page.players);
    if (!page.hasMore || !page.lastDoc) return all;
    cursor = page.lastDoc;
  }
}
```

`src/matches/useMatchEvents.ts`:

```ts
import { useEffect, useState } from 'react';
import type { MatchEvent } from '../types/match';
import { subscribeEvents } from './matchesApi';

export function useMatchEvents(teamId: string, matchId: string) {
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeEvents(
      teamId,
      matchId,
      (next, pendingCount) => {
        setEvents(next);
        setPending(pendingCount);
      },
      () => setError('Could not load match events. Check your connection.'),
    );
  }, [teamId, matchId]);

  return { events, pending, error };
}
```

- [ ] **Step 5: Run** `npx vitest run src/matches/matchesApi.test.ts` → PASS. Then `npm test` (whole suite — the config change must not break other tests, which all mock `../firebase/config`) → PASS. Then `npm run build` → succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/firebase/config.ts src/matches/matchesApi.ts src/matches/matchesApi.test.ts src/matches/useMatchEvents.ts
git commit -m "feat(scouting): matches API, events listener and offline-persistent Firestore cache"
```

---

### Task 9: Match setup form, Matches tab, match page shell, routes

**Files:**
- Create: `src/matches/matchSetup.ts`, `src/matches/matchSetup.test.ts`
- Create: `src/matches/MatchSetupForm.tsx`, `src/matches/MatchSetupForm.test.tsx`
- Create: `src/matches/TeamMatchesTab.tsx`, `src/matches/TeamMatchesTab.test.tsx`
- Create: `src/matches/MatchPage.tsx` (setup state only in this task; report added in Task 15)
- Modify: `src/teams/TeamPage.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `matchesApi` (Task 8), types.
- Produces:
  - `buildRoster(players: Player[], picks: Record<string, { checked: boolean; number: number }>): RosterEntry[]` — starters first, then by number
  - `validateSetup(input: MatchSetupInput): string | null`
  - `defaultLineup(roster: RosterEntry[], liberos: LiberoConfig[]): string[]` — first 6 non-libero roster players
  - `<MatchSetupForm teamId initial? defaultDate? submitLabel onSubmit(input): Promise<void> onCancel />`
  - `<TeamMatchesTab teamId newMatchDate?: string | null onNewMatchHandled?: () => void />`
  - `<MatchPage />` at `/teams/:teamId/matches/:matchId`
  - Route `/teams/:teamId/matches/:matchId/scout` → lazy `ScoutPage` (component created in Task 11; this task adds the route with the lazy import, so create a placeholder `src/matches/scout/ScoutPage.tsx` exporting `export function ScoutPage() { return null; }` that Task 11 replaces).

- [ ] **Step 1: Failing pure test**

`src/matches/matchSetup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type MatchSetupInput, type RosterEntry } from '../types/match';
import type { Player } from '../types/player';
import { buildRoster, defaultLineup, validateSetup } from './matchSetup';

const player = (id: string, number: number, positionCategory: Player['positionCategory'], starting = false) =>
  ({ id, number, fullName: `Player ${id}`, positionCategory, starting }) as Player;

const roster = (n: number): RosterEntry[] =>
  Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, number: i + 1, name: `P${i}`, positionCategory: 'OH' }));

const input = (over: Partial<MatchSetupInput> = {}): MatchSetupInput => ({
  date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home',
  format: DEFAULT_FORMAT, roster: roster(7), liberos: [], ...over,
});

describe('matchSetup', () => {
  it('builds the roster from checked players, starters first, with overridden numbers', () => {
    const players = [player('a', 4, 'OH'), player('b', 2, 'S', true), player('c', 9, 'MB')];
    const picks = { a: { checked: true, number: 14 }, b: { checked: true, number: 2 }, c: { checked: false, number: 9 } };
    expect(buildRoster(players, picks)).toEqual([
      { playerId: 'b', number: 2, name: 'Player b', positionCategory: 'S' },
      { playerId: 'a', number: 14, name: 'Player a', positionCategory: 'OH' },
    ]);
  });

  it('validates required fields and roster size', () => {
    expect(validateSetup(input())).toBeNull();
    expect(validateSetup(input({ opponent: ' ' }))).toMatch(/opponent/i);
    expect(validateSetup(input({ date: '' }))).toMatch(/date/i);
    expect(validateSetup(input({ roster: roster(5) }))).toMatch(/at least 6/i);
    expect(validateSetup(input({ roster: roster(7), liberos: [{ playerId: 'p0', mode: 'always', replaces: [] }] }))).toBeNull();
    expect(validateSetup(input({ roster: roster(6), liberos: [{ playerId: 'p0', mode: 'always', replaces: [] }] }))).toMatch(/at least 6/i);
    expect(validateSetup(input({ liberos: [{ playerId: 'ghost', mode: 'always', replaces: [] }] }))).toMatch(/libero/i);
    const dup = roster(7);
    dup[1] = { ...dup[1], number: 1 };
    expect(validateSetup(input({ roster: dup }))).toMatch(/#1/);
  });

  it('defaults the lineup to the first six non-libero players', () => {
    expect(defaultLineup(roster(8), [{ playerId: 'p0', mode: 'always', replaces: [] }])).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/matches/matchSetup.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/matches/matchSetup.ts`**

```ts
import type { LiberoConfig, MatchSetupInput, RosterEntry } from '../types/match';
import type { Player } from '../types/player';

export function buildRoster(players: Player[], picks: Record<string, { checked: boolean; number: number }>): RosterEntry[] {
  return players
    .filter((p) => picks[p.id]?.checked)
    .sort((a, b) => Number(b.starting) - Number(a.starting) || picks[a.id].number - picks[b.id].number)
    .map((p) => ({
      playerId: p.id,
      number: picks[p.id].number,
      name: p.fullName,
      positionCategory: p.positionCategory,
    }));
}

export function validateSetup(input: MatchSetupInput): string | null {
  if (!input.date) return 'Pick a date.';
  if (!input.opponent.trim()) return 'Enter the opponent.';
  const liberoIds = new Set(input.liberos.map((l) => l.playerId));
  if (input.liberos.length > 2) return 'At most two liberos.';
  if (input.liberos.some((l) => !input.roster.some((r) => r.playerId === l.playerId))) {
    return 'Each libero must be in the match roster.';
  }
  if (input.roster.filter((r) => !liberoIds.has(r.playerId)).length < 6) {
    return 'Pick at least 6 players besides the libero(s).';
  }
  const seen = new Set<number>();
  for (const r of input.roster) {
    if (seen.has(r.number)) return `Two players share #${r.number}.`;
    seen.add(r.number);
  }
  const f = input.format;
  if ([f.setPoints, f.decidingSetPoints, f.subsPerSet, f.timeoutsPerSet].some((v) => !Number.isFinite(v) || v < 0) || f.setPoints < 1) {
    return 'Check the match format numbers.';
  }
  return null;
}

export function defaultLineup(roster: RosterEntry[], liberos: LiberoConfig[]): string[] {
  const liberoIds = new Set(liberos.map((l) => l.playerId));
  return roster.filter((r) => !liberoIds.has(r.playerId)).slice(0, 6).map((r) => r.playerId);
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Failing form test**

`src/matches/MatchSetupForm.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../types/player';
import { MatchSetupForm } from './MatchSetupForm';
import * as matchesApi from './matchesApi';

vi.mock('./matchesApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const players = [
  ['s', 2, 'S'], ['a', 7, 'OH'], ['b', 9, 'OH'], ['m1', 11, 'MB'], ['m2', 12, 'MB'], ['o', 4, 'O'], ['l', 1, 'L'],
].map(([id, number, positionCategory]) => ({ id, number, fullName: `Name ${id}`, positionCategory, starting: false }) as Player);

describe('MatchSetupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(matchesApi.loadTeamRoster).mockResolvedValue(players);
  });

  it('submits a match with all players ticked and a libero replacing the middles', async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(<MatchSetupForm teamId="t1" defaultDate="2026-10-18" submitLabel="Create match" onSubmit={onSubmit} onCancel={vi.fn()} />);
    await screen.findByText('#7 Name a');

    fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'Rivals' } });
    fireEvent.change(screen.getByLabelText('Libero 1'), { target: { value: 'l' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create match' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const input = onSubmit.mock.calls[0][0];
    expect(input).toMatchObject({ date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home' });
    expect(input.roster).toHaveLength(7);
    expect(input.liberos).toEqual([{ playerId: 'l', mode: 'always', replaces: ['m1', 'm2'] }]);
  });

  it('shows the validation error instead of submitting', async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(<MatchSetupForm teamId="t1" defaultDate="2026-10-18" submitLabel="Create match" onSubmit={onSubmit} onCancel={vi.fn()} />);
    await screen.findByText('#7 Name a');
    fireEvent.click(screen.getByRole('button', { name: 'Create match' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/opponent/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run** → FAIL.

- [ ] **Step 7: Implement `src/matches/MatchSetupForm.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { FIELD_CLASS, Input } from '../components/Input';
import {
  DEFAULT_FORMAT,
  type Competition,
  type HomeAway,
  type LiberoMode,
  type MatchFormat,
  type MatchSetupInput,
} from '../types/match';
import type { Player } from '../types/player';
import { loadTeamRoster } from './matchesApi';
import { buildRoster, validateSetup } from './matchSetup';

interface MatchSetupFormProps {
  teamId: string;
  initial?: MatchSetupInput;
  defaultDate?: string;
  submitLabel: string;
  onSubmit: (input: MatchSetupInput) => Promise<void>;
  onCancel: () => void;
}

type Picks = Record<string, { checked: boolean; number: number }>;
interface LiberoPick { playerId: string; mode: LiberoMode }

const LIBERO_MODES: { value: LiberoMode; label: string }[] = [
  { value: 'always', label: 'Always' },
  { value: 'receiving', label: 'When we receive' },
  { value: 'serving', label: 'When we serve' },
];

export function MatchSetupForm({ teamId, initial, defaultDate, submitLabel, onSubmit, onCancel }: MatchSetupFormProps) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? new Date().toISOString().slice(0, 10));
  const [opponent, setOpponent] = useState(initial?.opponent ?? '');
  const [competition, setCompetition] = useState<Competition>(initial?.competition ?? 'league');
  const [homeAway, setHomeAway] = useState<HomeAway>(initial?.homeAway ?? 'home');
  const [format, setFormat] = useState<MatchFormat>(initial?.format ?? DEFAULT_FORMAT);
  const [picks, setPicks] = useState<Picks>({});
  const [liberoPicks, setLiberoPicks] = useState<LiberoPick[]>(() => {
    const fromInitial = initial?.liberos.map((l) => ({ playerId: l.playerId, mode: l.mode })) ?? [];
    const defaults: LiberoPick[] = [
      { playerId: '', mode: 'always' },
      { playerId: '', mode: 'receiving' },
    ];
    return [0, 1].map((i) => fromInitial[i] ?? defaults[i]);
  });
  const [replaces, setReplaces] = useState<string[] | null>(initial?.liberos[0]?.replaces ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTeamRoster(teamId)
      .then((loaded) => {
        setPlayers(loaded);
        const inRoster = new Map(initial?.roster.map((r) => [r.playerId, r.number]));
        setPicks(
          Object.fromEntries(
            loaded.map((p) => [p.id, { checked: initial ? inRoster.has(p.id) : true, number: inRoster.get(p.id) ?? p.number }]),
          ),
        );
        setReplaces((prev) => prev ?? loaded.filter((p) => p.positionCategory === 'MB').map((p) => p.id));
      })
      .catch(() => setError('Could not load the team roster.'));
  }, [teamId, initial]);

  function setNum<K extends keyof MatchFormat>(key: K, value: number) {
    setFormat((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!players) return;
    const roster = buildRoster(players, picks);
    const liberos = liberoPicks
      .filter((l) => l.playerId)
      .map((l) => ({ playerId: l.playerId, mode: l.mode, replaces: (replaces ?? []).filter((id) => id !== l.playerId) }));
    const input: MatchSetupInput = { date, opponent: opponent.trim(), competition, homeAway, format, roster, liberos };
    const problem = validateSetup(input);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(input);
    } catch {
      setError('Could not save the match. Please try again.');
      setSaving(false);
    }
  }

  if (!players) return <p className="text-slate">{error ?? 'Loading roster…'}</p>;
  const checkedPlayers = players.filter((p) => picks[p.id]?.checked);
  const liberoIds = new Set(liberoPicks.map((l) => l.playerId).filter(Boolean));

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Date
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Opponent
          <Input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Team name" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Competition
          <select className={FIELD_CLASS} value={competition} onChange={(e) => setCompetition(e.target.value as Competition)}>
            <option value="league">League</option>
            <option value="cup">Cup</option>
            <option value="friendly">Friendly</option>
            <option value="tournament">Tournament</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Venue
          <select className={FIELD_CLASS} value={homeAway} onChange={(e) => setHomeAway(e.target.value as HomeAway)}>
            <option value="home">Home</option>
            <option value="away">Away</option>
          </select>
        </label>
      </div>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <legend className="mb-2 text-sm font-semibold text-ink">Format</legend>
        <label className="flex flex-col gap-1 text-xs text-slate">
          Best of
          <select className={FIELD_CLASS} value={format.bestOf} onChange={(e) => setNum('bestOf', Number(e.target.value) as 3 | 5)}>
            <option value={3}>3</option>
            <option value={5}>5</option>
          </select>
        </label>
        {([
          ['setPoints', 'Set points'],
          ['decidingSetPoints', 'Deciding set'],
          ['subsPerSet', 'Subs / set'],
          ['timeoutsPerSet', 'Timeouts / set'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex flex-col gap-1 text-xs text-slate">
            {label}
            <Input type="number" min={0} value={format[key]} onChange={(e) => setNum(key, Number(e.target.value))} />
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Match roster</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
              <input
                type="checkbox"
                aria-label={`Include ${p.fullName}`}
                className="h-5 w-5"
                checked={picks[p.id]?.checked ?? false}
                onChange={(e) => setPicks((cur) => ({ ...cur, [p.id]: { ...cur[p.id], checked: e.target.checked } }))}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">#{p.number} {p.fullName}</span>
              <span className="text-xs text-slate">{p.positionCategory}</span>
              <Input
                type="number"
                aria-label={`Number for ${p.fullName}`}
                className="w-16 tabular-nums"
                value={picks[p.id]?.number ?? p.number}
                onChange={(e) => setPicks((cur) => ({ ...cur, [p.id]: { ...cur[p.id], number: Number(e.target.value) } }))}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-ink">Liberos</legend>
        {[0, 1].map((i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-slate">
              {`Libero ${i + 1}`}
              <select
                aria-label={`Libero ${i + 1}`}
                className={FIELD_CLASS}
                value={liberoPicks[i].playerId}
                onChange={(e) =>
                  setLiberoPicks((cur) => cur.map((l, j) => (j === i ? { ...l, playerId: e.target.value } : l)))
                }
              >
                <option value="">None</option>
                {checkedPlayers.map((p) => (
                  <option key={p.id} value={p.id}>#{picks[p.id].number} {p.fullName}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate">
              On court
              <select
                aria-label={`Libero ${i + 1} mode`}
                className={FIELD_CLASS}
                value={liberoPicks[i].mode}
                onChange={(e) =>
                  setLiberoPicks((cur) => cur.map((l, j) => (j === i ? { ...l, mode: e.target.value as LiberoMode } : l)))
                }
              >
                {LIBERO_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
          </div>
        ))}
        {liberoIds.size > 0 && (
          <div>
            <p className="mb-1 text-xs text-slate">Libero replaces (in the back row)</p>
            <div className="flex flex-wrap gap-2">
              {checkedPlayers.filter((p) => !liberoIds.has(p.id)).map((p) => (
                <label key={p.id} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={(replaces ?? []).includes(p.id)}
                    onChange={(e) =>
                      setReplaces((cur) => (e.target.checked ? [...(cur ?? []), p.id] : (cur ?? []).filter((id) => id !== p.id)))
                    }
                  />
                  #{picks[p.id].number}
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {error && <p role="alert" className="text-sm text-red">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>{submitLabel}</Button>
      </div>
    </form>
  );
}
```

`liberoPicks` always holds exactly two slots (initializer above), so the JSX can index `liberoPicks[0]` / `liberoPicks[1]` safely.

- [ ] **Step 8: Run** `npx vitest run src/matches/MatchSetupForm.test.tsx` → PASS.

- [ ] **Step 9: Failing tab test**

`src/matches/TeamMatchesTab.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type Match } from '../types/match';
import { TeamMatchesTab } from './TeamMatchesTab';
import * as matchesApi from './matchesApi';

vi.mock('./matchesApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: { uid: 'u1' } }) }));
vi.mock('./MatchSetupForm', () => ({ MatchSetupForm: ({ defaultDate }: { defaultDate?: string }) => <p>setup-form {defaultDate}</p> }));

const match = (over: Partial<Match>): Match => ({
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT,
  roster: [], liberos: [], status: 'finished', result: { setsUs: 3, setsThem: 1, sets: [] }, summary: null,
  usageContribution: null, activeDevice: null, createdBy: 'u1', createdAt: null, updatedAt: null, ...over,
});

describe('TeamMatchesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(matchesApi.listMatches).mockResolvedValue({
      matches: [match({}), match({ id: 'm2', opponent: 'Live FC', status: 'live', result: { setsUs: 1, setsThem: 0, sets: [] } })],
      lastDoc: null,
      hasMore: false,
    });
  });

  it('lists matches with result and status', async () => {
    render(<MemoryRouter><TeamMatchesTab teamId="t1" /></MemoryRouter>);
    expect(await screen.findByText('Rivals')).toBeInTheDocument();
    expect(screen.getByText('3–1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resume/i })).toHaveAttribute('href', '/teams/t1/matches/m2/scout');
  });

  it('opens the setup form, pre-filled from the calendar date', async () => {
    render(<MemoryRouter><TeamMatchesTab teamId="t1" newMatchDate="2026-11-02" /></MemoryRouter>);
    expect(await screen.findByText('setup-form 2026-11-02')).toBeInTheDocument();
  });

  it('opens the setup form from the button', async () => {
    render(<MemoryRouter><TeamMatchesTab teamId="t1" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /new match/i }));
    expect(screen.getByText(/setup-form/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run** → FAIL.

- [ ] **Step 11: Implement `src/matches/TeamMatchesTab.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { useAuth } from '../auth/AuthContext';
import type { Match, MatchStatus } from '../types/match';
import { createMatch, listMatches } from './matchesApi';
import { MatchSetupForm } from './MatchSetupForm';

const STATUS_LABEL: Record<MatchStatus, string> = { setup: 'Setup', live: 'Live', finished: 'Finished' };
const STATUS_CLASS: Record<MatchStatus, string> = {
  setup: 'bg-border/60 text-ink',
  live: 'bg-orange/15 text-orange-strong',
  finished: 'bg-green/15 text-green-strong',
};

interface TeamMatchesTabProps {
  teamId: string;
  newMatchDate?: string | null;
  onNewMatchHandled?: () => void;
}

export function TeamMatchesTab({ teamId, newMatchDate = null, onNewMatchHandled }: TeamMatchesTabProps) {
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingDate, setCreatingDate] = useState<string | null>(newMatchDate);

  const loadPage = useCallback(
    async (after: QueryDocumentSnapshot | null) => {
      const page = await listMatches(teamId, after);
      setMatches((cur) => (after ? [...cur, ...page.matches] : page.matches));
      setCursor(page.lastDoc);
      setHasMore(page.hasMore);
    },
    [teamId],
  );

  useEffect(() => {
    loadPage(null).catch(() => setError('Could not load matches.'));
  }, [loadPage]);

  useEffect(() => {
    if (newMatchDate) setCreatingDate(newMatchDate);
  }, [newMatchDate]);

  function closeCreate() {
    setCreatingDate(null);
    onNewMatchHandled?.();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreatingDate(new Date().toISOString().slice(0, 10))}>
          <Plus size={16} aria-hidden="true" className="mr-1" />
          New match
        </Button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red">{error}</p>}
      {matches.length === 0 && !error ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-slate">No matches yet.</p>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 shadow-card">
              <Link to={`/teams/${teamId}/matches/${m.id}`} className="min-w-0 flex-1">
                <span className="block text-xs tabular-nums text-slate">{m.date}</span>
                <span className="block truncate font-medium text-ink">{m.opponent}</span>
              </Link>
              <span className="text-lg font-semibold tabular-nums text-ink">
                {m.result.setsUs}–{m.result.setsThem}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[m.status]}`}>{STATUS_LABEL[m.status]}</span>
              {m.status === 'live' && (
                <Link to={`/teams/${teamId}/matches/${m.id}/scout`} className="text-sm font-medium text-blue hover:underline">
                  Resume
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => void loadPage(cursor)}>Load more</Button>
        </div>
      )}
      {creatingDate && firebaseUser && (
        <Dialog title="New match" onClose={closeCreate} size="lg" mobileSheet>
          <MatchSetupForm
            teamId={teamId}
            defaultDate={creatingDate}
            submitLabel="Create match"
            onCancel={closeCreate}
            onSubmit={async (input) => {
              const id = await createMatch(teamId, input, firebaseUser.uid);
              closeCreate();
              navigate(`/teams/${teamId}/matches/${id}`);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}
```

- [ ] **Step 12: Run** `npx vitest run src/matches/TeamMatchesTab.test.tsx` → PASS.

- [ ] **Step 13: MatchPage (setup state), placeholder ScoutPage, routes, TeamPage tab**

`src/matches/scout/ScoutPage.tsx` (placeholder, replaced in Task 11):

```tsx
export function ScoutPage() {
  return null;
}
```

`src/matches/MatchPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Match } from '../types/match';
import { deleteMatch, getMatch, setMatchStatus, updateMatchSetup } from './matchesApi';
import { MatchSetupForm } from './MatchSetupForm';

export function MatchPage() {
  const { teamId = '', matchId = '' } = useParams<{ teamId: string; matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getMatch(teamId, matchId)
      .then((m) => (m ? setMatch(m) : setError('Match not found.')))
      .catch(() => setError("You don't have access to this match."));
  }, [teamId, matchId]);

  if (error) return <p role="alert" className="p-6 text-red">{error}</p>;
  if (!match) return <p className="p-6 text-slate">Loading match…</p>;

  async function startScouting() {
    await setMatchStatus(teamId, matchId, 'live');
    navigate(`/teams/${teamId}/matches/${matchId}/scout`);
  }

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <Link to={`/teams/${teamId}`} className="mb-3 inline-flex items-center gap-1 text-sm text-blue hover:underline">
        <ChevronLeft size={16} aria-hidden="true" /> Back to team
      </Link>
      <div className="rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm tabular-nums text-slate">{match.date} · {match.homeAway === 'home' ? 'Home' : 'Away'}</p>
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">vs {match.opponent}</h1>
          </div>
          <Button variant="dangerGhost" size="sm" onClick={() => setConfirmDelete(true)}>Delete match</Button>
        </div>

        {match.status === 'setup' && (
          <>
            <div className="mb-6 flex justify-end">
              <Button variant="primary" onClick={() => void startScouting()}>Start scouting</Button>
            </div>
            <MatchSetupForm
              teamId={teamId}
              initial={match}
              submitLabel="Save setup"
              onCancel={() => navigate(`/teams/${teamId}`)}
              onSubmit={async (input) => {
                await updateMatchSetup(teamId, matchId, input);
                setMatch({ ...match, ...input });
              }}
            />
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this match?"
          message="All scouted actions for this match are deleted. This cannot be undone."
          confirmLabel="Yes, delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            void deleteMatch(teamId, matchId).then(() => navigate(`/teams/${teamId}`));
          }}
        />
      )}
    </div>
  );
}
```

In `src/App.tsx`:
- add imports `import { MatchPage } from './matches/MatchPage';` and a lazy `ScoutPage`:

```tsx
const ScoutPage = lazy(() => import('./matches/scout/ScoutPage').then((m) => ({ default: m.ScoutPage })));
```

- inside the authenticated layout routes, after `/teams/:teamId/players/:playerId`, add:

```tsx
            <Route path="/teams/:teamId/matches/:matchId" element={<MatchPage />} />
```

- as a sibling of the authenticated layout route (full-screen, no `AppShell`), before `<Route path="/" …>`, add:

```tsx
          <Route
            path="/teams/:teamId/matches/:matchId/scout"
            element={
              <RequireAuth>
                <Suspense fallback={<div className="p-6 text-slate">Loading scouting…</div>}>
                  <ScoutPage />
                </Suspense>
              </RequireAuth>
            }
          />
```

In `src/teams/TeamPage.tsx`:
- `type TeamTab = 'overview' | 'calendar' | 'matches' | 'plan' | 'settings' | 'physicalSession';`
- import `TeamMatchesTab` from `'../matches/TeamMatchesTab'`.
- add state `const [newMatchDate, setNewMatchDate] = useState<string | null>(null);`
- add `{ id: 'matches', label: 'Matches' },` to `tabs` right after the calendar entry.
- render:

```tsx
          {activeTab === 'matches' && (
            <TeamMatchesTab teamId={teamId} newMatchDate={newMatchDate} onNewMatchHandled={() => setNewMatchDate(null)} />
          )}
```

In `src/teams/TeamPage.test.tsx` add, next to the calendarApi mock:

```ts
vi.mock('../matches/matchesApi', () => ({
  listMatches: vi.fn().mockResolvedValue({ matches: [], lastDoc: null, hasMore: false }),
  listMatchesInRange: vi.fn().mockResolvedValue([]),
}));
```

- [ ] **Step 14: Run** `npm test` → PASS; `npm run build` → succeeds; `npm run lint` → clean.

- [ ] **Step 15: Commit**

```bash
git add src/matches src/teams/TeamPage.tsx src/teams/TeamPage.test.tsx src/App.tsx
git commit -m "feat(scouting): match setup form, Matches tab, match page and routes"
```

---

### Task 10: Action sheet and grade styles

**Files:**
- Create: `src/matches/scout/gradeStyles.ts`, `src/matches/scout/ActionSheet.tsx`
- Test: `src/matches/scout/ActionSheet.test.tsx`

**Interfaces:**
- Consumes: `SKILL_LABELS`, `GRADE_LABELS`, `validGrades`.
- Produces:
  - `GRADE_CLASS: Record<Grade, string>`
  - `<ActionSheet player: RosterEntry; isLibero: boolean; skills: Skill[]; onGrade(skill: Skill, grade: Grade): void; onSub(): void; onClose(): void; floating: boolean />` — parent re-mounts it per player with `key={player.playerId}`; first skill pre-selected.
  - Grade buttons have accessible name `"<grade> <label>"` (e.g. `"# Kill"`); skill chips are buttons with `aria-pressed`.

- [ ] **Step 1: Failing test**

`src/matches/scout/ActionSheet.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionSheet } from './ActionSheet';

const player = { playerId: 'mb1', number: 11, name: 'Marta', positionCategory: 'MB' as const };

describe('ActionSheet', () => {
  it('pre-selects the first skill and records a grade in one tap', () => {
    const onGrade = vi.fn();
    render(<ActionSheet player={player} isLibero={false} skills={['B', 'A', 'S']} onGrade={onGrade} onSub={vi.fn()} onClose={vi.fn()} floating={false} />);
    expect(screen.getByRole('button', { name: 'Block' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '# Stuff' }));
    expect(onGrade).toHaveBeenCalledWith('B', '#');
  });

  it('hides grades a skill does not have', () => {
    render(<ActionSheet player={player} isLibero={false} skills={['B', 'A']} onGrade={vi.fn()} onSub={vi.fn()} onClose={vi.fn()} floating={false} />);
    expect(screen.queryByRole('button', { name: /^!/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    expect(screen.getByRole('button', { name: '! Covered' })).toBeInTheDocument();
  });

  it('offers a substitution', () => {
    const onSub = vi.fn();
    render(<ActionSheet player={player} isLibero={false} skills={['B']} onGrade={vi.fn()} onSub={onSub} onClose={vi.fn()} floating={false} />);
    fireEvent.click(screen.getByRole('button', { name: /substitute/i }));
    expect(onSub).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`src/matches/scout/gradeStyles.ts`:

```ts
import type { Grade } from '../../types/match';

export const GRADE_CLASS: Record<Grade, string> = {
  '#': 'bg-green text-white',
  '+': 'bg-green/15 text-ink',
  '!': 'border border-border bg-bg text-ink',
  '-': 'bg-orange/20 text-ink',
  '/': 'bg-orange/40 text-ink',
  '=': 'bg-red text-white',
};
```

`src/matches/scout/ActionSheet.tsx`:

```tsx
import { useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import type { Grade, RosterEntry, Skill } from '../../types/match';
import { GRADE_LABELS, SKILL_LABELS, validGrades } from '../skillGrades';
import { GRADE_CLASS } from './gradeStyles';

interface ActionSheetProps {
  player: RosterEntry;
  isLibero: boolean;
  skills: Skill[];
  onGrade: (skill: Skill, grade: Grade) => void;
  onSub: () => void;
  onClose: () => void;
  /** Phone: fixed bottom sheet. Desktop: inline card. */
  floating: boolean;
}

export function ActionSheet({ player, isLibero, skills, onGrade, onSub, onClose, floating }: ActionSheetProps) {
  const [skill, setSkill] = useState<Skill>(skills[0]);

  return (
    <section
      aria-label={`Actions for #${player.number}`}
      className={`border border-border bg-surface p-3 shadow-pop ${
        floating ? 'fixed inset-x-0 bottom-0 z-40 rounded-t-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'rounded-lg'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-semibold text-ink">
          #{player.number} {player.name}
          <span className="ml-2 text-xs font-normal text-slate">{isLibero ? 'Libero' : player.positionCategory}</span>
        </p>
        {!isLibero && (
          <button type="button" onClick={onSub} className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-blue hover:bg-blue/10">
            <ArrowLeftRight size={16} aria-hidden="true" /> Substitute
          </button>
        )}
        <button type="button" aria-label="Close actions" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-md text-slate hover:bg-bg">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === skill}
            onClick={() => setSkill(s)}
            className={`min-h-9 rounded-full border px-3 text-sm ${
              s === skill ? 'border-blue bg-blue text-white' : 'border-border bg-surface text-ink'
            }`}
          >
            {SKILL_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {validGrades(skill).map((g) => (
          <button
            key={g}
            type="button"
            aria-label={`${g} ${GRADE_LABELS[skill][g]}`}
            onClick={() => onGrade(skill, g)}
            className={`flex min-h-14 flex-col items-center justify-center rounded-md text-sm font-semibold ${GRADE_CLASS[g]}`}
          >
            <span className="text-lg leading-none" aria-hidden="true">{g}</span>
            <span className="text-xs" aria-hidden="true">{GRADE_LABELS[skill][g]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/matches/scout/gradeStyles.ts src/matches/scout/ActionSheet.tsx src/matches/scout/ActionSheet.test.tsx
git commit -m "feat(scouting): action sheet with ordered skill chips and labelled grades"
```

---

### Task 11: Scouting screen — header, court, bench, rally bar, set start, recording, undo, device lock

**Files:**
- Create: `src/matches/scout/ScoutHeader.tsx`, `src/matches/scout/CourtGrid.tsx`, `src/matches/scout/BenchStrip.tsx`, `src/matches/scout/RallyBar.tsx`, `src/matches/scout/SetStartDialog.tsx`
- Replace: `src/matches/scout/ScoutPage.tsx`
- Test: `src/matches/scout/ScoutPage.test.tsx`

**Interfaces:**
- Consumes: `replay`, `expectedSkill`, `orderSkills`, `countsForPlayer`, `playerForm`, `appendOrder`, `orderAfter`, `getDeviceId`, `isLockedByOther`, `rallyOutcome`, `defaultLineup`, `rosterMap`, api functions, `useMatchEvents`, `ActionSheet`.
- Produces:
  - `<ScoutHeader state format opponent pending onEditScore onRotate(delta: 1 | -1) />`
  - `<CourtGrid court: string[] roster: Map<string, RosterEntry> activeLiberoId selectedId form: (id) => 'good'|'bad'|null onSelect(id) onLongPress(id) />` — tiles laid out front row P4 P3 P2, back row P5 P6 P1; tile accessible name `#<n> <name>` (+ `, libero`).
  - `<BenchStrip players: RosterEntry[] onSelect(id) />`
  - `<RallyBar onPoint(winner, reason) onTimeout(team) timeoutsUsed format />`
  - `<SetStartDialog setNumber roster liberos initialLineup initialServing onStart(lineup, serving) onCancel />`
  - `ScoutPage` internal `record(payload: MatchEventPayload)` — computes order (append or after anchor), calls `addEvent` without awaiting. Tasks 12–14 extend `ScoutPage`.

- [ ] **Step 1: Failing page test**

`src/matches/scout/ScoutPage.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type Match, type MatchEvent } from '../../types/match';
import * as api from '../matchesApi';
import { ScoutPage } from './ScoutPage';

vi.mock('../matchesApi');
vi.mock('../../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: { uid: 'u1' } }) }));

const roster = [
  { playerId: 's', number: 2, name: 'Sofía', positionCategory: 'S' as const },
  { playerId: 'oh1', number: 7, name: 'Ana', positionCategory: 'OH' as const },
  { playerId: 'mb1', number: 11, name: 'Marta', positionCategory: 'MB' as const },
  { playerId: 'o', number: 4, name: 'Olga', positionCategory: 'O' as const },
  { playerId: 'oh2', number: 9, name: 'Lucía', positionCategory: 'OH' as const },
  { playerId: 'mb2', number: 12, name: 'Nora', positionCategory: 'MB' as const },
  { playerId: 'bench', number: 5, name: 'Bea', positionCategory: 'OH' as const },
];
const match: Match = {
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT,
  roster, liberos: [], status: 'live', result: { setsUs: 0, setsThem: 0, sets: [] }, summary: null,
  usageContribution: null, activeDevice: null, createdBy: 'u1', createdAt: null, updatedAt: null,
};
const setStart: MatchEvent = {
  id: 'e1', order: 1, source: 'tap', chunkId: null, type: 'setStart', set: 1,
  lineup: ['s', 'oh1', 'mb1', 'o', 'oh2', 'mb2'], serving: 'them',
};

function renderPage(events: MatchEvent[]) {
  vi.mocked(api.subscribeEvents).mockImplementation((_t, _m, onChange) => {
    onChange(events, 0);
    return () => undefined;
  });
  return render(
    <MemoryRouter initialEntries={['/teams/t1/matches/m1/scout']}>
      <Routes>
        <Route path="/teams/:teamId/matches/:matchId/scout" element={<ScoutPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ScoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getMatch).mockResolvedValue(match);
    vi.mocked(api.getUsageProfile).mockResolvedValue({ players: {} });
    vi.mocked(api.claimDevice).mockResolvedValue();
    vi.mocked(api.updateMatchResult).mockResolvedValue();
    vi.mocked(api.addEvent).mockReturnValue({ id: 'new', written: Promise.resolve() });
    vi.mocked(api.deleteEvents).mockResolvedValue();
  });

  it('asks for the lineup before the first set', async () => {
    renderPage([]);
    expect(await screen.findByRole('dialog', { name: 'Start set 1' })).toBeInTheDocument();
  });

  it('records player → grade with reception pre-selected when receiving', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: '#7 Ana' }));
    expect(screen.getByRole('button', { name: 'Reception' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '+ Good' }));
    expect(api.addEvent).toHaveBeenCalledWith(
      't1', 'm1',
      expect.objectContaining({ type: 'action', playerId: 'oh1', skill: 'R', grade: '+', order: 2, source: 'tap', chunkId: null }),
      'u1',
    );
  });

  it('records a point for them with a reason', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: 'Point them' }));
    fireEvent.click(screen.getByRole('button', { name: 'Opp. kill' }));
    expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'point', winner: 'them', reason: 'oppKill' }), 'u1');
  });

  it('undo deletes the last event', async () => {
    const last: MatchEvent = { id: 'e2', order: 2, source: 'tap', chunkId: null, type: 'timeout', team: 'us' };
    renderPage([setStart, last]);
    fireEvent.click(await screen.findByRole('button', { name: /undo/i }));
    await waitFor(() => expect(api.deleteEvents).toHaveBeenCalledWith('t1', 'm1', ['e2']));
  });

  it('warns when another device is scouting', async () => {
    vi.mocked(api.getMatch).mockResolvedValue({ ...match, activeDevice: { id: 'other-device', at: Date.now() } });
    renderPage([setStart]);
    expect(await screen.findByRole('alertdialog', { name: /another device/i })).toBeInTheDocument();
    expect(api.claimDevice).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/matches/scout/ScoutPage.test.tsx` → FAIL.

- [ ] **Step 3: Implement the pieces**

`src/matches/scout/ScoutHeader.tsx`:

```tsx
import { ChevronLeft, ChevronRight, CloudOff, Check } from 'lucide-react';
import type { MatchFormat } from '../../types/match';
import type { MatchState } from '../scoutEngine';

interface ScoutHeaderProps {
  state: MatchState;
  format: MatchFormat;
  opponent: string;
  pending: number;
  onEditScore: () => void;
  onRotate: (delta: 1 | -1) => void;
}

function Dots({ used, total }: { used: number; total: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${i < total - used ? 'bg-white' : 'bg-white/30'}`} />
      ))}
    </span>
  );
}

export function ScoutHeader({ state, format, opponent, pending, onEditScore, onRotate }: ScoutHeaderProps) {
  return (
    <header className="bg-navy px-3 py-2 text-white sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onEditScore} aria-label="Correct score" className="text-left">
          <span className="block text-3xl font-bold tabular-nums leading-tight">
            {state.score.us}–{state.score.them}
          </span>
          <span className="block text-xs text-white/80">
            Set {state.set || 1} · sets {state.setsWon.us}–{state.setsWon.them} · vs {opponent}
          </span>
        </button>
        <div className="flex flex-col items-end gap-1 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${state.serving === 'us' ? 'bg-orange' : 'bg-white/20'}`}>
            {state.serving === 'us' ? '● We serve' : '○ We receive'}
          </span>
          <span className="flex items-center gap-1">
            <button type="button" aria-label="Previous rotation" onClick={() => onRotate(-1)} className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="tabular-nums">Rot {state.rotation}</span>
            <button type="button" aria-label="Next rotation" onClick={() => onRotate(1)} className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </span>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/80">
        <span className="tabular-nums">Subs {state.subsUsed}/{format.subsPerSet}</span>
        <span className="flex items-center gap-1">T/O us <Dots used={state.timeoutsUsed.us} total={format.timeoutsPerSet} /></span>
        <span className="flex items-center gap-1">them <Dots used={state.timeoutsUsed.them} total={format.timeoutsPerSet} /></span>
        <span className="ml-auto flex items-center gap-1" aria-live="polite">
          {pending > 0 ? (
            <><CloudOff size={14} aria-hidden="true" /> {pending} pending</>
          ) : (
            <><Check size={14} aria-hidden="true" /> synced</>
          )}
        </span>
      </div>
    </header>
  );
}
```

`src/matches/scout/CourtGrid.tsx`:

```tsx
import { useRef } from 'react';
import type { RosterEntry } from '../../types/match';

interface CourtGridProps {
  court: string[];
  roster: Map<string, RosterEntry>;
  activeLiberoId: string | null;
  selectedId: string | null;
  form: (playerId: string) => 'good' | 'bad' | null;
  onSelect: (playerId: string) => void;
  onLongPress: (playerId: string) => void;
}

// Seen from behind our baseline: front row P4 P3 P2 (net side), back row P5 P6 P1.
const ZONES = [3, 2, 1, 4, 5, 0];
const LONG_PRESS_MS = 500;

export function CourtGrid({ court, roster, activeLiberoId, selectedId, form, onSelect, onLongPress }: CourtGridProps) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <div className="rounded-lg border-2 border-orange-strong bg-orange/10 p-2">
      <div className="mb-2 h-1 rounded-full bg-ink" aria-hidden="true" />
      <div className="grid grid-cols-3 gap-2">
        {ZONES.map((zone) => {
          const id = court[zone];
          const entry = id ? roster.get(id) : undefined;
          if (!entry) return <div key={zone} className="min-h-16 rounded-md border border-dashed border-border" />;
          const isLibero = id === activeLiberoId;
          const f = form(id);
          return (
            <button
              key={zone}
              type="button"
              aria-label={`#${entry.number} ${entry.name}${isLibero ? ', libero' : ''}`}
              aria-pressed={selectedId === id}
              onPointerDown={() => {
                longPressed.current = false;
                timer.current = window.setTimeout(() => {
                  longPressed.current = true;
                  onLongPress(id);
                }, LONG_PRESS_MS);
              }}
              onPointerUp={clear}
              onPointerLeave={clear}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (!longPressed.current) onSelect(id);
              }}
              className={`relative flex min-h-16 select-none flex-col items-center justify-center rounded-md border text-ink ${
                isLibero ? 'border-orange bg-orange/20' : 'border-border bg-surface'
              } ${selectedId === id ? 'ring-2 ring-blue' : ''}`}
            >
              <span className="text-xl font-bold tabular-nums leading-none">{entry.number}</span>
              <span className="max-w-full truncate px-1 text-xs text-slate">{isLibero ? 'L' : entry.name}</span>
              <span className="absolute left-1 top-1 text-[10px] text-slate">P{zone + 1}</span>
              {f && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1 top-1 h-2.5 w-2.5 rounded-full ${f === 'bad' ? 'bg-red' : 'bg-green'}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

`src/matches/scout/BenchStrip.tsx`:

```tsx
import type { RosterEntry } from '../../types/match';

export function BenchStrip({ players, onSelect }: { players: RosterEntry[]; onSelect: (playerId: string) => void }) {
  if (players.length === 0) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1" aria-label="Bench">
      <span className="text-xs text-slate">Bench</span>
      {players.map((p) => (
        <button
          key={p.playerId}
          type="button"
          aria-label={`#${p.number} ${p.name}`}
          onClick={() => onSelect(p.playerId)}
          className="min-h-11 min-w-11 shrink-0 rounded-md border border-dashed border-border bg-surface px-2 text-sm tabular-nums text-ink"
        >
          {p.number}
        </button>
      ))}
    </div>
  );
}
```

`src/matches/scout/RallyBar.tsx`:

```tsx
import { useState } from 'react';
import { POINT_REASON_LABELS, type MatchFormat, type PointReason, type SetScore, type Side } from '../../types/match';

const REASONS: Record<Side, PointReason[]> = {
  us: ['oppError', 'unknown'],
  them: ['oppKill', 'oppAce', 'oppBlock', 'unknown'],
};

interface RallyBarProps {
  onPoint: (winner: Side, reason: PointReason) => void;
  onTimeout: (team: Side) => void;
  timeoutsUsed: SetScore;
  format: MatchFormat;
}

export function RallyBar({ onPoint, onTimeout, timeoutsUsed, format }: RallyBarProps) {
  const [picking, setPicking] = useState<Side | null>(null);

  if (picking) {
    return (
      <div className="rounded-lg border border-border bg-surface p-2" role="group" aria-label={`Point ${picking} — reason`}>
        <div className="grid grid-cols-2 gap-2">
          {REASONS[picking].map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => {
                onPoint(picking, reason);
                setPicking(null);
              }}
              className={`min-h-11 rounded-md font-medium ${picking === 'us' ? 'bg-green/15 text-green-strong' : 'bg-red/10 text-red-strong'}`}
            >
              {POINT_REASON_LABELS[reason]}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setPicking(null)} className="mt-2 min-h-11 w-full rounded-md text-sm text-slate hover:bg-bg">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => setPicking('us')} className="min-h-12 rounded-md bg-green/15 font-semibold text-green-strong">
        Point us
      </button>
      <button type="button" onClick={() => setPicking('them')} className="min-h-12 rounded-md bg-red/10 font-semibold text-red-strong">
        Point them
      </button>
      <button
        type="button"
        onClick={() => onTimeout('us')}
        className="min-h-11 rounded-md border border-border text-sm text-ink"
      >
        T/O us ({Math.max(0, format.timeoutsPerSet - timeoutsUsed.us)})
      </button>
      <button
        type="button"
        onClick={() => onTimeout('them')}
        className="min-h-11 rounded-md border border-border text-sm text-ink"
      >
        T/O them ({Math.max(0, format.timeoutsPerSet - timeoutsUsed.them)})
      </button>
    </div>
  );
}
```

`src/matches/scout/SetStartDialog.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { FIELD_CLASS } from '../../components/Input';
import type { LiberoConfig, RosterEntry, Side } from '../../types/match';

interface SetStartDialogProps {
  setNumber: number;
  roster: RosterEntry[];
  liberos: LiberoConfig[];
  initialLineup: string[];
  initialServing: Side;
  onStart: (lineup: string[], serving: Side) => void;
  onCancel: () => void;
}

export function SetStartDialog({ setNumber, roster, liberos, initialLineup, initialServing, onStart, onCancel }: SetStartDialogProps) {
  const liberoIds = new Set(liberos.map((l) => l.playerId));
  const eligible = roster.filter((r) => !liberoIds.has(r.playerId));
  const [lineup, setLineup] = useState<string[]>(() => Array.from({ length: 6 }, (_, i) => initialLineup[i] ?? ''));
  const [serving, setServing] = useState<Side>(initialServing);

  const filled = lineup.filter(Boolean);
  const error =
    filled.length < 6 ? 'Fill all six positions.' : new Set(filled).size < 6 ? 'A player is in two positions.' : null;

  return (
    <Dialog
      title={`Start set ${setNumber}`}
      onClose={onCancel}
      mobileSheet
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Back</Button>
          <Button variant="primary" disabled={!!error} onClick={() => onStart(lineup, serving)}>Start set</Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-slate">P1 is the server. Front row: P4, P3, P2.</p>
      <div className="grid grid-cols-3 gap-2">
        {[3, 2, 1, 4, 5, 0].map((zone) => (
          <label key={zone} className="flex flex-col gap-1 text-xs font-medium text-slate">
            P{zone + 1}
            <select
              aria-label={`Position P${zone + 1}`}
              className={`${FIELD_CLASS} min-h-11`}
              value={lineup[zone]}
              onChange={(e) => setLineup((cur) => cur.map((id, i) => (i === zone ? e.target.value : id)))}
            >
              <option value="">—</option>
              {eligible.map((r) => (
                <option key={r.playerId} value={r.playerId}>#{r.number} {r.name}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <fieldset className="mt-4 flex gap-4">
        <legend className="mb-1 text-sm font-medium text-ink">First serve</legend>
        {(['us', 'them'] as const).map((side) => (
          <label key={side} className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input type="radio" name="serving" checked={serving === side} onChange={() => setServing(side)} />
            {side === 'us' ? 'We serve' : 'They serve'}
          </label>
        ))}
      </fieldset>
      {error && <p className="mt-3 text-sm text-slate">{error}</p>}
    </Dialog>
  );
}
```

`src/matches/scout/ScoutPage.tsx` (replace the placeholder):

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useMediaQuery } from '../../components/useMediaQuery';
import type { Match, MatchEventPayload, UsageProfile } from '../../types/match';
import { getDeviceId, isLockedByOther } from '../deviceLock';
import { appendOrder, orderAfter } from '../eventOrder';
import { rosterMap } from '../format';
import { addEvent, claimDevice, deleteEvents, getMatch, getUsageProfile, updateMatchResult } from '../matchesApi';
import { defaultLineup } from '../matchSetup';
import { countsForPlayer, expectedSkill, orderSkills } from '../nextActions';
import { replay, resultFromState, sortEvents } from '../scoutEngine';
import { playerForm } from '../scoutStats';
import { rallyOutcome } from '../skillGrades';
import { useMatchEvents } from '../useMatchEvents';
import { ActionSheet } from './ActionSheet';
import { BenchStrip } from './BenchStrip';
import { CourtGrid } from './CourtGrid';
import { RallyBar } from './RallyBar';
import { ScoutHeader } from './ScoutHeader';
import { SetStartDialog } from './SetStartDialog';

const HEARTBEAT_MS = 60_000;

export function ScoutPage() {
  const { teamId = '', matchId = '' } = useParams<{ teamId: string; matchId: string }>();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const deviceId = useMemo(() => getDeviceId(), []);

  const [match, setMatch] = useState<Match | null>(null);
  const [usage, setUsage] = useState<UsageProfile>({ players: {} });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<string[] | null>(null);
  const { events, pending, error: eventsError } = useMatchEvents(teamId, matchId);

  useEffect(() => {
    getMatch(teamId, matchId)
      .then((m) => {
        if (!m) {
          setLoadError('Match not found.');
          return;
        }
        setMatch(m);
        if (isLockedByOther(m.activeDevice, deviceId, Date.now())) setLocked(true);
        else void claimDevice(teamId, matchId, deviceId).catch(() => undefined);
      })
      .catch(() => setLoadError("You don't have access to this match."));
    getUsageProfile(teamId).then(setUsage).catch(() => undefined);
  }, [teamId, matchId, deviceId]);

  useEffect(() => {
    if (!match || locked) return;
    const t = window.setInterval(() => void claimDevice(teamId, matchId, deviceId).catch(() => undefined), HEARTBEAT_MS);
    return () => window.clearInterval(t);
  }, [match, locked, teamId, matchId, deviceId]);

  const state = useMemo(() => (match && events ? replay(match, events) : null), [match, events]);
  const roster = useMemo(() => rosterMap(match?.roster ?? []), [match]);

  // Keep the list/calendar result current without replaying there.
  useEffect(() => {
    if (!match || !state || locked) return;
    const result = resultFromState(state);
    if (JSON.stringify(result) === JSON.stringify(match.result)) return;
    setMatch({ ...match, result });
    updateMatchResult(teamId, matchId, result).catch(() => undefined);
  }, [state, match, locked, teamId, matchId]);

  const record = useCallback(
    (payload: MatchEventPayload) => {
      if (!events || !firebaseUser) return;
      const order = anchorId ? orderAfter(events, anchorId) : appendOrder(events);
      const { id, written } = addEvent(teamId, matchId, { ...payload, order, source: 'tap', chunkId: null }, firebaseUser.uid);
      written.catch(() => setWriteError('An action could not be saved. Check your connection and the timeline.'));
      if (anchorId) {
        const endsRally =
          payload.type === 'point' || (payload.type === 'action' && rallyOutcome(payload.skill, payload.grade) !== null);
        setAnchorId(endsRally ? null : id);
      }
    },
    [events, firebaseUser, anchorId, teamId, matchId],
  );

  function undo() {
    if (!events || events.length === 0) return;
    const last = sortEvents(events)[events.length - 1];
    const ids = last.chunkId ? events.filter((e) => e.chunkId === last.chunkId).map((e) => e.id) : [last.id];
    if (ids.length > 1) setPendingUndo(ids);
    else void deleteEvents(teamId, matchId, ids).catch(() => setWriteError('Could not undo. Try again.'));
  }

  if (loadError || eventsError) return <p role="alert" className="p-6 text-red">{loadError ?? eventsError}</p>;
  if (!match || !state) return <p className="p-6 text-slate">Loading match…</p>;

  if (locked) {
    return (
      <ConfirmDialog
        title="Being scouted on another device"
        message="Another device scouted this match in the last two minutes. Take over here? Only one device should scout at a time."
        confirmLabel="Take over"
        onCancel={() => navigate(`/teams/${teamId}/matches/${matchId}`)}
        onConfirm={() => {
          setLocked(false);
          void claimDevice(teamId, matchId, deviceId).catch(() => undefined);
        }}
      />
    );
  }

  const liberoIds = new Set(match.liberos.map((l) => l.playerId));
  const selected = selectedId ? roster.get(selectedId) : undefined;
  const bench = match.roster.filter((r) => !state.court.includes(r.playerId));
  const skillsFor = (playerId: string) => {
    const entry = roster.get(playerId);
    return orderSkills({
      position: entry?.positionCategory ?? 'TBD',
      isLibero: liberoIds.has(playerId),
      expected: expectedSkill(state),
      matchCounts: countsForPlayer(state, playerId),
      history: usage.players[playerId] ?? null,
    });
  };

  const courtColumn = (
    <div className="flex flex-col gap-3">
      <CourtGrid
        court={state.court}
        roster={roster}
        activeLiberoId={state.activeLiberoId}
        selectedId={selectedId}
        form={(id) => playerForm(state, id)}
        onSelect={setSelectedId}
        onLongPress={setSelectedId}
      />
      <BenchStrip players={bench} onSelect={setSelectedId} />
      <RallyBar
        format={match.format}
        timeoutsUsed={state.timeoutsUsed}
        onPoint={(winner, reason) => record({ type: 'point', winner, reason })}
        onTimeout={(team) => record({ type: 'timeout', team })}
      />
      {selected && (
        <ActionSheet
          key={selected.playerId}
          player={selected}
          isLibero={liberoIds.has(selected.playerId)}
          skills={skillsFor(selected.playerId)}
          floating={!isDesktop}
          onClose={() => setSelectedId(null)}
          onSub={() => undefined}
          onGrade={(skill, grade) => {
            record({ type: 'action', playerId: selected.playerId, skill, grade });
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <ScoutHeader
        state={state}
        format={match.format}
        opponent={match.opponent}
        pending={pending}
        onEditScore={() => undefined}
        onRotate={() => undefined}
      />
      {writeError && <p role="alert" className="bg-red/10 px-4 py-2 text-sm text-red-strong">{writeError}</p>}
      {anchorId && (
        <div className="flex items-center justify-between bg-blue/10 px-4 py-2 text-sm text-ink">
          <span>Inserting into the timeline</span>
          <button type="button" onClick={() => setAnchorId(null)} className="font-medium text-blue">Back to live</button>
        </div>
      )}
      <main className={`flex-1 p-3 sm:p-4 ${isDesktop ? 'grid grid-cols-[minmax(320px,440px)_1fr] gap-4' : 'pb-80'}`}>
        {courtColumn}
      </main>
      <footer className="sticky bottom-0 flex items-center justify-between border-t border-border bg-surface px-3 py-2">
        <button type="button" onClick={undo} className="flex min-h-11 items-center gap-1 rounded-md px-3 text-sm font-medium text-ink hover:bg-bg">
          <Undo2 size={16} aria-hidden="true" /> Undo
        </button>
        <button
          type="button"
          onClick={() => navigate(`/teams/${teamId}/matches/${matchId}`)}
          className="min-h-11 rounded-md px-3 text-sm text-blue hover:bg-blue/10"
        >
          Exit
        </button>
      </footer>

      {!state.inSet && !state.matchOver && (
        <SetStartDialog
          setNumber={state.set + 1}
          roster={match.roster}
          liberos={match.liberos}
          initialLineup={state.setStartLineup.length === 6 ? state.setStartLineup : defaultLineup(match.roster, match.liberos)}
          initialServing={state.serving === 'us' ? 'them' : 'us'}
          onCancel={() => navigate(`/teams/${teamId}/matches/${matchId}`)}
          onStart={(lineup, serving) => record({ type: 'setStart', set: state.set + 1, lineup, serving })}
        />
      )}

      {pendingUndo && (
        <ConfirmDialog
          title="Undo whole text batch?"
          message={`This removes ${pendingUndo.length} events that were added together.`}
          confirmLabel="Undo batch"
          onCancel={() => setPendingUndo(null)}
          onConfirm={() => {
            void deleteEvents(teamId, matchId, pendingUndo).catch(() => setWriteError('Could not undo. Try again.'));
            setPendingUndo(null);
          }}
        />
      )}
    </div>
  );
}
```

Notes for the implementer:
- `onSub`, `onEditScore` and `onRotate` are deliberately inert here; Task 12 wires them. `setAnchorId` setter is used by Task 13 (timeline "Insert after"). Until then `anchorId` is only cleared — that's fine for `noUnusedLocals` (the variable is read).
- The first-serve default for a new set alternates from the last serve state; the dialog lets the user change it.

- [ ] **Step 4: Run** `npx vitest run src/matches/scout` → PASS. `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/matches/scout
git commit -m "feat(scouting): live scouting screen with court, action sheet, rally bar, undo and device lock"
```

---

### Task 12: Substitutions, corrections, set end and finish

**Files:**
- Create: `src/matches/scout/SubDialog.tsx`, `src/matches/scout/CorrectionDialog.tsx`
- Modify: `src/matches/scout/ScoutPage.tsx`, `src/matches/scout/ScoutPage.test.tsx`

**Interfaces:**
- Consumes: `prevRotation`, `nextRotation`, `buildFinishPayload`, `finishMatch`.
- Produces:
  - `<SubDialog outPlayer: RosterEntry; candidates: RosterEntry[]; onSub(inPlayerId): void; onCancel(): void />`
  - `<CorrectionDialog score: SetScore; serving: Side; rotation: number; onSave(c: { score: SetScore | null; serving: Side | null; rotation: number | null }): void; onCancel(): void />`
  - ScoutPage: long-press tile or "Substitute" → SubDialog → `sub` event; score tap → CorrectionDialog → `correction` event (source `'correction'`); rotation arrows → `correction` with only `rotation`; set point → confirm → `setEnd`; match over → "Finish match" → `finishMatch` → navigate to match page.
  - `record(payload, source?: EventSource)` — default `'tap'`.

- [ ] **Step 1: Add failing tests** to `src/matches/scout/ScoutPage.test.tsx` (inside the `describe`):

```tsx
  it('substitutes a player from the action sheet', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: '#9 Lucía' }));
    fireEvent.click(screen.getByRole('button', { name: /substitute/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Bring on #5 Bea' }));
    expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'sub', outPlayerId: 'oh2', inPlayerId: 'bench' }), 'u1');
  });

  it('rotation arrows write a correction', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: 'Next rotation' }));
    expect(api.addEvent).toHaveBeenCalledWith(
      't1', 'm1',
      expect.objectContaining({ type: 'correction', rotation: 6, score: null, serving: null, source: 'correction' }),
      'u1',
    );
  });

  it('asks to confirm the set at set point', async () => {
    const corr: MatchEvent = { id: 'e2', order: 2, source: 'correction', chunkId: null, type: 'correction', score: { us: 25, them: 20 }, rotation: null, serving: null };
    renderPage([setStart, corr]);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm set' }));
    expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'setEnd', set: 1 }), 'u1');
  });

  it('finishes the match once it is over', async () => {
    vi.mocked(api.finishMatch).mockResolvedValue();
    const events: MatchEvent[] = [];
    let order = 0;
    for (let set = 1; set <= 3; set++) {
      events.push(
        { ...setStart, id: `s${set}`, order: ++order, set } as MatchEvent,
        { id: `c${set}`, order: ++order, source: 'correction', chunkId: null, type: 'correction', score: { us: 25, them: 10 }, rotation: null, serving: null },
        { id: `x${set}`, order: ++order, source: 'tap', chunkId: null, type: 'setEnd', set },
      );
    }
    renderPage(events);
    fireEvent.click(await screen.findByRole('button', { name: 'Finish match' }));
    await waitFor(() =>
      expect(api.finishMatch).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ result: expect.objectContaining({ setsUs: 3, setsThem: 0 }) })),
    );
  });
```

- [ ] **Step 2: Run** → the 4 new tests FAIL.

- [ ] **Step 3: Implement**

`src/matches/scout/SubDialog.tsx`:

```tsx
import { Dialog } from '../../components/Dialog';
import type { RosterEntry } from '../../types/match';

interface SubDialogProps {
  outPlayer: RosterEntry;
  candidates: RosterEntry[];
  onSub: (inPlayerId: string) => void;
  onCancel: () => void;
}

export function SubDialog({ outPlayer, candidates, onSub, onCancel }: SubDialogProps) {
  return (
    <Dialog title={`Substitute #${outPlayer.number} ${outPlayer.name}`} onClose={onCancel}>
      {candidates.length === 0 ? (
        <p className="text-sm text-slate">Nobody on the bench.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {candidates.map((c) => (
            <button
              key={c.playerId}
              type="button"
              aria-label={`Bring on #${c.number} ${c.name}`}
              onClick={() => onSub(c.playerId)}
              className="flex min-h-14 flex-col items-center justify-center rounded-md border border-border bg-surface text-ink hover:bg-blue/10"
            >
              <span className="text-lg font-bold tabular-nums">{c.number}</span>
              <span className="max-w-full truncate px-1 text-xs text-slate">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}
```

`src/matches/scout/CorrectionDialog.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { FIELD_CLASS, Input } from '../../components/Input';
import type { SetScore, Side } from '../../types/match';

interface CorrectionDialogProps {
  score: SetScore;
  serving: Side;
  rotation: number;
  onSave: (c: { score: SetScore | null; serving: Side | null; rotation: number | null }) => void;
  onCancel: () => void;
}

export function CorrectionDialog({ score, serving, rotation, onSave, onCancel }: CorrectionDialogProps) {
  const [us, setUs] = useState(score.us);
  const [them, setThem] = useState(score.them);
  const [srv, setSrv] = useState<Side>(serving);
  const [rot, setRot] = useState(rotation);

  function save() {
    const scoreChanged = us !== score.us || them !== score.them;
    onSave({
      score: scoreChanged ? { us, them } : null,
      serving: srv !== serving ? srv : null,
      rotation: rot !== rotation ? rot : null,
    });
  }

  return (
    <Dialog
      title="Correct the game state"
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save correction</Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-slate">Logged as a correction — stats are not changed.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Us
          <Input type="number" min={0} className="tabular-nums" value={us} onChange={(e) => setUs(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Them
          <Input type="number" min={0} className="tabular-nums" value={them} onChange={(e) => setThem(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Serving
          <select className={FIELD_CLASS} value={srv} onChange={(e) => setSrv(e.target.value as Side)}>
            <option value="us">Us</option>
            <option value="them">Them</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Rotation
          <select className={FIELD_CLASS} value={rot} onChange={(e) => setRot(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
    </Dialog>
  );
}
```

In `src/matches/scout/ScoutPage.tsx`:

1. Imports — add:

```tsx
import type { EventSource } from '../../types/match';
import { Button } from '../../components/Button';
import { buildFinishPayload } from '../finish';
import { finishMatch } from '../matchesApi';   // merge into the existing matchesApi import
import { nextRotation, prevRotation } from '../scoutEngine'; // merge into the existing scoutEngine import
import { CorrectionDialog } from './CorrectionDialog';
import { SubDialog } from './SubDialog';
```

2. State — add:

```tsx
  const [subOutId, setSubOutId] = useState<string | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [dismissedSetPoint, setDismissedSetPoint] = useState<string | null>(null);
```

3. `record` gains a `source` parameter:

```tsx
  const record = useCallback(
    (payload: MatchEventPayload, source: EventSource = 'tap') => {
      if (!events || !firebaseUser) return;
      const order = anchorId ? orderAfter(events, anchorId) : appendOrder(events);
      const { id, written } = addEvent(teamId, matchId, { ...payload, order, source, chunkId: null }, firebaseUser.uid);
      // …rest unchanged
```

4. Add a finish handler (after `undo`):

```tsx
  function finish() {
    if (!match || !state) return;
    finishMatch(teamId, matchId, buildFinishPayload(match, state, usage)).catch(() =>
      setWriteError('Finishing did not sync yet — it will retry when you are back online.'),
    );
    navigate(`/teams/${teamId}/matches/${matchId}`);
  }
```

5. Wire the inert handlers:
- `CourtGrid`: `onLongPress={(id) => { if (!liberoIds.has(id)) setSubOutId(id); }}`
- `ActionSheet`: `onSub={() => { setSubOutId(selected.playerId); setSelectedId(null); }}`
- `ScoutHeader`: `onEditScore={() => setShowCorrection(true)}` and

```tsx
        onRotate={(delta) =>
          record(
            { type: 'correction', score: null, serving: null, rotation: delta === 1 ? nextRotation(state.rotation) : prevRotation(state.rotation) },
            'correction',
          )
        }
```

6. Render, before `{pendingUndo && …}`:

```tsx
      {subOutId && roster.get(subOutId) && (
        <SubDialog
          outPlayer={roster.get(subOutId)!}
          candidates={match.roster.filter((r) => !state.lineup.includes(r.playerId) && !liberoIds.has(r.playerId))}
          onCancel={() => setSubOutId(null)}
          onSub={(inPlayerId) => {
            record({ type: 'sub', outPlayerId: subOutId, inPlayerId });
            setSubOutId(null);
          }}
        />
      )}

      {showCorrection && (
        <CorrectionDialog
          score={state.score}
          serving={state.serving}
          rotation={state.rotation}
          onCancel={() => setShowCorrection(false)}
          onSave={(c) => {
            if (c.score || c.serving || c.rotation !== null) record({ type: 'correction', ...c }, 'correction');
            setShowCorrection(false);
          }}
        />
      )}

      {state.setPointReached && dismissedSetPoint !== `${state.set}-${state.score.us}-${state.score.them}` && (
        <div role="dialog" aria-label="Set point" className="fixed inset-x-3 top-24 z-40 rounded-lg border border-border bg-surface p-4 shadow-pop">
          <p className="mb-3 font-semibold text-ink">
            {state.score.us > state.score.them ? 'Set won' : 'Set lost'} {state.score.us}–{state.score.them}?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDismissedSetPoint(`${state.set}-${state.score.us}-${state.score.them}`)}>
              Not yet
            </Button>
            <Button variant="primary" aria-label="Confirm set" onClick={() => record({ type: 'setEnd', set: state.set })}>
              Confirm set
            </Button>
          </div>
        </div>
      )}
```

7. Match over banner — under the `anchorId` banner:

```tsx
      {state.matchOver && (
        <div className="flex items-center justify-between gap-3 bg-green/15 px-4 py-3">
          <span className="font-semibold text-ink">
            Match over · {state.setsWon.us}–{state.setsWon.them}
          </span>
          <Button variant="primary" size="sm" onClick={finish}>Finish match</Button>
        </div>
      )}
```

- [ ] **Step 4: Run** `npx vitest run src/matches/scout` → PASS; `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/matches/scout
git commit -m "feat(scouting): substitutions, score/rotation corrections, set confirmation and finish"
```

---

### Task 13: Timeline drawer

**Files:**
- Create: `src/matches/scout/TimelineDrawer.tsx`, `src/matches/scout/EditEventDialog.tsx`
- Test: `src/matches/scout/TimelineDrawer.test.tsx`
- Modify: `src/matches/scout/ScoutPage.tsx` (phone tabs + desktop side column)

**Interfaces:**
- Consumes: `describeEvent`, `sortEvents`, `MatchState.rallies`/`warnings`, `updateEvent`, `deleteEvents`, `validGrades`.
- Produces:
  - `<TimelineDrawer events: MatchEvent[]; state: MatchState; roster: Map<string, RosterEntry>; onDelete(ids: string[]): void; onEdit(ev: ActionEvent): void; onInsertAfter(eventId: string): void />` — newest first, set headers, score chip after rally-ending events, ⚠ warnings, ✎ for `source === 'text'`.
  - `<EditEventDialog event: ActionEvent; roster: RosterEntry[]; onSave(patch: { playerId: string; skill: Skill; grade: Grade }): void; onCancel(): void />`
  - ScoutPage phone tabs: `Court | Live | Timeline` (Live content comes in Task 14 — render a placeholder `<p>` until then); desktop: right column shows Timeline under the (future) Live panel.

- [ ] **Step 1: Failing test**

`src/matches/scout/TimelineDrawer.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type MatchEvent } from '../../types/match';
import { rosterMap } from '../format';
import { replay } from '../scoutEngine';
import { TimelineDrawer } from './TimelineDrawer';

const roster = [
  { playerId: 's', number: 2, name: 'S', positionCategory: 'S' as const },
  { playerId: 'a', number: 7, name: 'A', positionCategory: 'OH' as const },
  { playerId: 'b', number: 8, name: 'B', positionCategory: 'OH' as const },
  { playerId: 'c', number: 9, name: 'C', positionCategory: 'MB' as const },
  { playerId: 'd', number: 10, name: 'D', positionCategory: 'MB' as const },
  { playerId: 'e', number: 11, name: 'E', positionCategory: 'O' as const },
];
const meta = (id: string, order: number, source: 'tap' | 'text' = 'tap') => ({ id, order, source, chunkId: null });
const events: MatchEvent[] = [
  { ...meta('e1', 1), type: 'setStart', set: 1, lineup: ['s', 'a', 'b', 'c', 'd', 'e'], serving: 'us' },
  { ...meta('e2', 2), type: 'action', playerId: 's', skill: 'S', grade: '#' },
  { ...meta('e3', 3, 'text'), type: 'action', playerId: 'a', skill: 'D', grade: '+' },
];
const state = replay({ format: DEFAULT_FORMAT, roster, liberos: [] }, events);

describe('TimelineDrawer', () => {
  it('lists events newest first with the score after each rally', () => {
    render(<TimelineDrawer events={events} state={state} roster={rosterMap(roster)} onDelete={vi.fn()} onEdit={vi.fn()} onInsertAfter={vi.fn()} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('#7 Dig + Good');
    expect(rows[0]).toHaveTextContent('✎');
    expect(screen.getByText('1–0')).toBeInTheDocument();
  });

  it('deletes, edits and inserts', () => {
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    const onInsertAfter = vi.fn();
    render(<TimelineDrawer events={events} state={state} roster={rosterMap(roster)} onDelete={onDelete} onEdit={onEdit} onInsertAfter={onInsertAfter} />);
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    expect(onDelete).toHaveBeenCalledWith(['e3']);
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
    expect(onEdit).toHaveBeenCalledWith(events[2]);
    fireEvent.click(screen.getAllByRole('button', { name: /insert after/i })[1]);
    expect(onInsertAfter).toHaveBeenCalledWith('e2');
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`src/matches/scout/TimelineDrawer.tsx`:

```tsx
import { CornerDownRight, Pencil, Trash2 } from 'lucide-react';
import type { ActionEvent, MatchEvent, RosterEntry } from '../../types/match';
import { describeEvent } from '../format';
import { sortEvents, type MatchState } from '../scoutEngine';

interface TimelineDrawerProps {
  events: MatchEvent[];
  state: MatchState;
  roster: Map<string, RosterEntry>;
  onDelete: (ids: string[]) => void;
  onEdit: (ev: ActionEvent) => void;
  onInsertAfter: (eventId: string) => void;
}

export function TimelineDrawer({ events, state, roster, onDelete, onEdit, onInsertAfter }: TimelineDrawerProps) {
  const scoreAfter = new Map(state.rallies.map((r) => [r.endEventId, r.scoreAfter]));
  const warnings = new Map<string, string[]>();
  for (const w of state.warnings) warnings.set(w.eventId, [...(warnings.get(w.eventId) ?? []), w.message]);
  const rows = sortEvents(events).reverse();

  if (rows.length === 0) return <p className="p-4 text-center text-sm text-slate">Nothing recorded yet.</p>;

  return (
    <ol className="divide-y divide-border rounded-lg border border-border bg-surface">
      {rows.map((ev) => {
        const score = scoreAfter.get(ev.id);
        const warn = warnings.get(ev.id);
        const isHeader = ev.type === 'setStart' || ev.type === 'setEnd';
        return (
          <li key={ev.id} className={`flex items-center gap-2 px-3 py-2 text-sm ${isHeader ? 'bg-bg font-semibold' : ''}`}>
            <div className="min-w-0 flex-1">
              <span className="text-ink">
                {ev.source === 'text' && <span aria-label="from text" className="mr-1">✎</span>}
                {describeEvent(ev, roster)}
              </span>
              {warn && <span className="block text-xs text-orange-strong">⚠ {warn.join(' ')}</span>}
            </div>
            {score && (
              <span className="rounded-full bg-navy px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                {score.us}–{score.them}
              </span>
            )}
            <button type="button" aria-label="Insert after" onClick={() => onInsertAfter(ev.id)} className="flex h-9 w-9 items-center justify-center rounded-md text-slate hover:bg-bg">
              <CornerDownRight size={16} aria-hidden="true" />
            </button>
            {ev.type === 'action' && (
              <button type="button" aria-label="Edit" onClick={() => onEdit(ev)} className="flex h-9 w-9 items-center justify-center rounded-md text-blue hover:bg-blue/10">
                <Pencil size={16} aria-hidden="true" />
              </button>
            )}
            <button type="button" aria-label="Delete" onClick={() => onDelete([ev.id])} className="flex h-9 w-9 items-center justify-center rounded-md text-red hover:bg-red/10">
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
```

`src/matches/scout/EditEventDialog.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { FIELD_CLASS } from '../../components/Input';
import { SKILLS, type ActionEvent, type Grade, type RosterEntry, type Skill } from '../../types/match';
import { GRADE_LABELS, SKILL_LABELS, validGrades } from '../skillGrades';

interface EditEventDialogProps {
  event: ActionEvent;
  roster: RosterEntry[];
  onSave: (patch: { playerId: string; skill: Skill; grade: Grade }) => void;
  onCancel: () => void;
}

export function EditEventDialog({ event, roster, onSave, onCancel }: EditEventDialogProps) {
  const [playerId, setPlayerId] = useState(event.playerId);
  const [skill, setSkill] = useState<Skill>(event.skill);
  const [grade, setGrade] = useState<Grade>(event.grade);
  const grades = validGrades(skill);
  const effectiveGrade = grades.includes(grade) ? grade : grades[0];

  return (
    <Dialog
      title="Edit action"
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave({ playerId, skill, grade: effectiveGrade })}>Save</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Player
          <select className={FIELD_CLASS} value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            {roster.map((r) => (
              <option key={r.playerId} value={r.playerId}>#{r.number} {r.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Fundamental
          <select className={FIELD_CLASS} value={skill} onChange={(e) => setSkill(e.target.value as Skill)}>
            {SKILLS.map((s) => (
              <option key={s} value={s}>{SKILL_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Grade
          <select className={FIELD_CLASS} value={effectiveGrade} onChange={(e) => setGrade(e.target.value as Grade)}>
            {grades.map((g) => (
              <option key={g} value={g}>{g} {GRADE_LABELS[skill][g]}</option>
            ))}
          </select>
        </label>
      </div>
    </Dialog>
  );
}
```

In `src/matches/scout/ScoutPage.tsx`:
- import `TimelineDrawer`, `EditEventDialog`, `updateEvent` (from `../matchesApi`), `ActionEvent` type, and `Tab` from `../../components/Tab`.
- state: `const [phoneTab, setPhoneTab] = useState<'court' | 'live' | 'timeline'>('court');` and `const [editing, setEditing] = useState<ActionEvent | null>(null);`
- build the timeline element:

```tsx
  const timeline = (
    <TimelineDrawer
      events={events ?? []}
      state={state}
      roster={roster}
      onDelete={(ids) => void deleteEvents(teamId, matchId, ids).catch(() => setWriteError('Could not delete. Try again.'))}
      onEdit={setEditing}
      onInsertAfter={(id) => {
        setAnchorId(id);
        setPhoneTab('court');
      }}
    />
  );
  const live = <p className="p-4 text-sm text-slate">Live stats</p>; // replaced in Task 14
```

- replace the `<main>` with:

```tsx
      {isDesktop ? (
        <main className="grid flex-1 grid-cols-[minmax(320px,440px)_1fr] gap-4 p-4">
          {courtColumn}
          <div className="flex min-w-0 flex-col gap-4">
            {live}
            <div className="max-h-[50vh] overflow-y-auto">{timeline}</div>
          </div>
        </main>
      ) : (
        <>
          <nav className="flex gap-4 border-b border-border bg-surface px-4">
            <Tab active={phoneTab === 'court'} onClick={() => setPhoneTab('court')}>Court</Tab>
            <Tab active={phoneTab === 'live'} onClick={() => setPhoneTab('live')}>Live</Tab>
            <Tab active={phoneTab === 'timeline'} onClick={() => setPhoneTab('timeline')}>Timeline</Tab>
          </nav>
          <main className={`flex-1 p-3 ${selected ? 'pb-80' : ''}`}>
            {phoneTab === 'court' && courtColumn}
            {phoneTab === 'live' && live}
            {phoneTab === 'timeline' && timeline}
          </main>
        </>
      )}
```

- render the edit dialog next to the other dialogs:

```tsx
      {editing && (
        <EditEventDialog
          event={editing}
          roster={match.roster}
          onCancel={() => setEditing(null)}
          onSave={(patch) => {
            void updateEvent(teamId, matchId, editing.id, patch).catch(() => setWriteError('Could not save the edit.'));
            setEditing(null);
          }}
        />
      )}
```

Check `src/components/Tab.tsx` props: `{ active, onClick, children }` — matches.

- [ ] **Step 4: Run** `npx vitest run src/matches/scout` → PASS (existing ScoutPage tests still pass: jsdom has no `matchMedia`, so `useMediaQuery` returns `true` → desktop layout with the court visible).

- [ ] **Step 5: Commit**

```bash
git add src/matches/scout
git commit -m "feat(scouting): editable timeline with insert-here anchor and phone tabs"
```

---

### Task 14: Live stats panel

**Files:**
- Create: `src/matches/scout/LiveStatsPanel.tsx`
- Test: `src/matches/scout/LiveStatsPanel.test.tsx`
- Modify: `src/matches/scout/ScoutPage.tsx` (replace the `live` placeholder)

**Interfaces:**
- Consumes: `computeStats`, `liveAlerts`, `fmtPct`, `fmtEff`, `MatchState`.
- Produces: `<LiveStatsPanel state: MatchState; roster: Map<string, RosterEntry> />` — scope toggle "This set / Match", alert banner(s), per-player table, team line.

- [ ] **Step 1: Failing test**

`src/matches/scout/LiveStatsPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type MatchEvent } from '../../types/match';
import { rosterMap } from '../format';
import { replay } from '../scoutEngine';
import { LiveStatsPanel } from './LiveStatsPanel';

const roster = ['s', 'a', 'b', 'c', 'd', 'e'].map((id, i) => ({ playerId: id, number: i + 1, name: id.toUpperCase(), positionCategory: 'OH' as const }));
let order = 0;
const m = (e: object) => ({ id: `x${++order}`, order, source: 'tap', chunkId: null, ...e }) as MatchEvent;
const events: MatchEvent[] = [
  m({ type: 'setStart', set: 1, lineup: ['s', 'a', 'b', 'c', 'd', 'e'], serving: 'them' }),
  m({ type: 'action', playerId: 'a', skill: 'R', grade: '=' }),
  m({ type: 'action', playerId: 'a', skill: 'R', grade: '=' }),
  m({ type: 'action', playerId: 'a', skill: 'R', grade: '=' }),
];
const state = replay({ format: DEFAULT_FORMAT, roster, liberos: [] }, events);

describe('LiveStatsPanel', () => {
  it('shows alerts and per-player rows', () => {
    render(<LiveStatsPanel state={state} roster={rosterMap(roster)} />);
    expect(screen.getByRole('alert')).toHaveTextContent('#2 A: 3 errors this set');
    expect(screen.getByRole('alert')).toHaveTextContent('Opponent run 3');
    expect(screen.getByRole('row', { name: /#2 A/ })).toHaveTextContent('0%');
  });

  it('toggles scope', () => {
    render(<LiveStatsPanel state={state} roster={rosterMap(roster)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Match' }));
    expect(screen.getByRole('button', { name: 'Match' })).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `src/matches/scout/LiveStatsPanel.tsx`**

```tsx
import { useState } from 'react';
import type { RosterEntry } from '../../types/match';
import { fmtEff, fmtPct, playerLabel } from '../format';
import type { MatchState } from '../scoutEngine';
import { computeStats, liveAlerts } from '../scoutStats';

export function LiveStatsPanel({ state, roster }: { state: MatchState; roster: Map<string, RosterEntry> }) {
  const [scope, setScope] = useState<'set' | 'match'>('set');
  const stats = computeStats(state, scope === 'set' ? { set: state.set } : {});
  const alerts = liveAlerts(state);
  const rows = Object.values(stats.players).sort(
    (a, b) => (roster.get(a.playerId)?.number ?? 0) - (roster.get(b.playerId)?.number ?? 0),
  );
  const t = stats.team;

  return (
    <section aria-label="Live stats" className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-ink">Live</h2>
        <div className="flex gap-1">
          {(['set', 'match'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              className={`min-h-9 rounded-md px-3 text-sm ${scope === s ? 'bg-navy text-white' : 'text-slate hover:bg-bg'}`}
            >
              {s === 'set' ? 'This set' : 'Match'}
            </button>
          ))}
        </div>
      </div>

      {alerts.length > 0 && (
        <div role="alert" className="mb-2 space-y-1 rounded-md bg-red/10 p-2 text-sm font-medium text-red-strong">
          {alerts.map((a) =>
            a.kind === 'playerErrors' ? (
              <p key={a.playerId}>⚠ {playerLabel(roster.get(a.playerId))} {roster.get(a.playerId)?.name}: {a.errors} errors this set</p>
            ) : (
              <p key="run">⚠ Opponent run {a.run} — timeout?</p>
            ),
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs uppercase text-slate">
              <th className="py-1 pr-2 font-medium">Player</th>
              <th className="px-2 font-medium">Serve</th>
              <th className="px-2 font-medium">Rec +</th>
              <th className="px-2 font-medium">Attack</th>
              <th className="px-2 font-medium">Block</th>
              <th className="px-2 font-medium">Pts / Err</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const entry = roster.get(p.playerId);
              const s = p.skills.S;
              const a = p.skills.A;
              return (
                <tr key={p.playerId} aria-label={`${playerLabel(entry)} ${entry?.name ?? ''}`} className="border-t border-border">
                  <td className="py-1 pr-2 text-ink">{playerLabel(entry)} <span className="text-slate">{entry?.name}</span></td>
                  <td className="px-2">{s ? `${s.attempts} · ${s.grades['#']}# ${s.grades['=']}=` : '—'}</td>
                  <td className={`px-2 ${p.receptionPos !== null && p.receptionPos < 0.4 ? 'text-red' : ''}`}>{fmtPct(p.receptionPos)}</td>
                  <td className={`px-2 ${p.attackEff !== null && p.attackEff < 0 ? 'text-red' : ''}`}>
                    {a ? `${a.grades['#']}/${a.attempts} ${fmtEff(p.attackEff)}` : '—'}
                  </td>
                  <td className="px-2">{p.skills.B ? `${p.skills.B.grades['#']}#` : '—'}</td>
                  <td className="px-2">
                    <span className="text-green-strong">{p.points}</span> / <span className={p.errors >= 3 ? 'font-semibold text-red' : ''}>{p.errors}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate">
        Side-out {fmtPct(t.sideOut.total ? t.sideOut.won / t.sideOut.total : null)} · Break {fmtPct(t.breakPoint.total ? t.breakPoint.won / t.breakPoint.total : null)} ·
        Rec + {fmtPct(t.receptionPos)} · Opp errors {t.oppErrorPoints}
        {t.weakestRotation !== null && ` · Weakest rotation ${t.weakestRotation}`}
      </p>
    </section>
  );
}
```

In `ScoutPage.tsx` replace the placeholder with `const live = <LiveStatsPanel state={state} roster={roster} />;` and import it.

- [ ] **Step 4: Run** `npx vitest run src/matches/scout` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/matches/scout
git commit -m "feat(scouting): live per-player stats, team line and alerts"
```

---

### Task 15: Match report and match page states

**Files:**
- Create: `src/matches/report/MatchReport.tsx`
- Test: `src/matches/report/MatchReport.test.tsx`
- Modify: `src/matches/MatchPage.tsx`, `src/index.css` (print rule)

**Interfaces:**
- Consumes: `replay`, `computeStats`, `useMatchEvents`, `fmtPct`, `fmtEff`, `SKILL_LABELS`, `GRADE_CLASS`, `setMatchStatus`, `buildFinishPayload`, `finishMatch`, `getUsageProfile`.
- Produces: `<MatchReport match: Match; state: MatchState />`; MatchPage: `live` → Resume link + Finish button + report; `finished` → report + "Reopen for editing".

- [ ] **Step 1: Failing test**

`src/matches/report/MatchReport.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type Match, type MatchEvent } from '../../types/match';
import { replay } from '../scoutEngine';
import { MatchReport } from './MatchReport';

const roster = ['s', 'a', 'b', 'c', 'd', 'e'].map((id, i) => ({ playerId: id, number: i + 1, name: `N${id}`, positionCategory: 'OH' as const }));
const match = {
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT, roster,
  liberos: [], status: 'finished', result: { setsUs: 0, setsThem: 0, sets: [] }, summary: null, usageContribution: null,
  activeDevice: null, createdBy: 'u', createdAt: null, updatedAt: null,
} as Match;
let order = 0;
const m = (e: object) => ({ id: `x${++order}`, order, source: 'tap', chunkId: null, ...e }) as MatchEvent;
const events: MatchEvent[] = [
  m({ type: 'setStart', set: 1, lineup: ['s', 'a', 'b', 'c', 'd', 'e'], serving: 'us' }),
  m({ type: 'action', playerId: 's', skill: 'S', grade: '#' }),
  m({ type: 'action', playerId: 's', skill: 'S', grade: '=' }),
  m({ type: 'setStart', set: 2, lineup: ['s', 'a', 'b', 'c', 'd', 'e'], serving: 'us' }),
  m({ type: 'action', playerId: 'a', skill: 'A', grade: '#' }),
];

describe('MatchReport', () => {
  it('renders KPIs, players and filters by set', () => {
    render(<MatchReport match={match} state={replay(match, events)} />);
    expect(screen.getByText('Aces / serve errors')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /#1 Ns/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /#2 Na/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Set'), { target: { value: '2' } });
    expect(screen.queryByRole('row', { name: /#1 Ns/ })).toBeNull();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement `src/matches/report/MatchReport.tsx`**

```tsx
import { useState } from 'react';
import { FIELD_CLASS } from '../../components/Input';
import { GRADES, SKILLS, type Match } from '../../types/match';
import { fmtEff, fmtPct, playerLabel, rosterMap } from '../format';
import type { MatchState } from '../scoutEngine';
import { computeStats } from '../scoutStats';
import { SKILL_LABELS } from '../skillGrades';
import { GRADE_CLASS } from '../scout/gradeStyles';

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs text-slate">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

export function MatchReport({ match, state }: { match: Match; state: MatchState }) {
  const [set, setSet] = useState<number | 'all'>('all');
  const stats = computeStats(state, set === 'all' ? {} : { set });
  const roster = rosterMap(match.roster);
  const t = stats.team;
  const players = Object.values(stats.players).sort(
    (a, b) => (roster.get(a.playerId)?.number ?? 0) - (roster.get(b.playerId)?.number ?? 0),
  );
  const totalSource = stats.sourceCounts.tap + stats.sourceCounts.text;
  const setNumbers = Array.from(new Set(state.rallies.map((r) => r.set).concat(state.actions.map((a) => a.set)))).sort();

  return (
    <div className="flex flex-col gap-6 print:gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tabular-nums text-ink">{state.setsWon.us}–{state.setsWon.them}</p>
          <p className="text-sm tabular-nums text-slate">{state.setScores.map((s) => `${s.us}–${s.them}`).join(' · ')}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink print:hidden">
          Set
          <select aria-label="Set" className={FIELD_CLASS} value={set} onChange={(e) => setSet(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">All</option>
            {setNumbers.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Side-out" value={fmtPct(t.sideOut.total ? t.sideOut.won / t.sideOut.total : null)} />
        <Kpi label="Break point" value={fmtPct(t.breakPoint.total ? t.breakPoint.won / t.breakPoint.total : null)} />
        <Kpi label="Reception +" value={fmtPct(t.receptionPos)} />
        <Kpi label="Attack eff." value={fmtEff(t.attackEff)} />
        <Kpi label="Aces / serve errors" value={`${t.aces} / ${t.serveErrors}`} />
        <Kpi label="Opp. errors" value={String(t.oppErrorPoints)} />
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-ink">Players</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-bg text-left text-xs uppercase text-slate">
              <tr>
                <th className="px-2 py-2 font-medium">Player</th>
                {SKILLS.map((s) => (
                  <th key={s} className="px-2 py-2 font-medium">{SKILL_LABELS[s]}</th>
                ))}
                <th className="px-2 py-2 font-medium">Att. eff</th>
                <th className="px-2 py-2 font-medium">Rec +</th>
                <th className="px-2 py-2 font-medium">Pts / Err</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const entry = roster.get(p.playerId);
                return (
                  <tr key={p.playerId} aria-label={`${playerLabel(entry)} ${entry?.name ?? ''}`} className="border-t border-border">
                    <td className="whitespace-nowrap px-2 py-2 text-ink">{playerLabel(entry)} {entry?.name}</td>
                    {SKILLS.map((s) => {
                      const line = p.skills[s];
                      if (!line) return <td key={s} className="px-2 text-slate">—</td>;
                      return (
                        <td key={s} className="px-2">
                          <span className="block text-xs">{line.attempts}</span>
                          <span className="flex h-2 w-16 overflow-hidden rounded-full" aria-hidden="true">
                            {GRADES.map((g) =>
                              line.grades[g] ? (
                                <span key={g} className={GRADE_CLASS[g]} style={{ width: `${(line.grades[g] / line.attempts) * 100}%` }} />
                              ) : null,
                            )}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-2">{fmtEff(p.attackEff)}</td>
                    <td className="px-2">{fmtPct(p.receptionPos)}</td>
                    <td className="px-2">{p.points} / {p.errors}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-ink">Rotations</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[1, 6, 5, 4, 3, 2].map((r) => {
            const rot = t.rotations[r] ?? { won: 0, lost: 0 };
            const weakest = t.weakestRotation === r;
            return (
              <div key={r} className={`rounded-md border p-2 text-center ${weakest ? 'border-red bg-red/10' : 'border-border'}`}>
                <p className="text-xs text-slate">Rot {r}</p>
                <p className="font-semibold tabular-nums text-ink">{rot.won - rot.lost > 0 ? '+' : ''}{rot.won - rot.lost}</p>
                <p className="text-xs tabular-nums text-slate">{rot.won}–{rot.lost}</p>
              </div>
            );
          })}
        </div>
      </section>

      {stats.timeoutEffects.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-ink">Timeouts</h2>
          <ul className="space-y-1 text-sm text-ink">
            {stats.timeoutEffects.map((e, i) => (
              <li key={i} className="tabular-nums">
                Set {e.set} · T/O {e.team} at {e.score.us}–{e.score.them} → next rallies {e.won}–{e.lost}
              </li>
            ))}
          </ul>
        </section>
      )}

      {totalSource > 0 && (
        <p className="text-xs text-slate">
          {Math.round((stats.sourceCounts.tap / totalSource) * 100)}% tapped · {Math.round((stats.sourceCounts.text / totalSource) * 100)}% from text
        </p>
      )}
    </div>
  );
}
```

`MatchPage.tsx` — after the `setup` block add the `live`/`finished` states. Add imports (`useMatchEvents`, `replay`, `MatchReport`, `buildFinishPayload`, `finishMatch`, `getUsageProfile`, `useMemo`) and inside the component (before the early returns, to respect hook rules):

```tsx
  const { events } = useMatchEvents(teamId, matchId);
  const state = useMemo(() => (match && events ? replay(match, events) : null), [match, events]);
```

Then in the JSX, after the setup block:

```tsx
        {match.status === 'live' && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md bg-orange/10 p-3">
            <span className="font-medium text-ink">Scouting in progress</span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  if (!state) return;
                  const payload = buildFinishPayload(match, state, await getUsageProfile(teamId));
                  void finishMatch(teamId, matchId, payload);
                  setMatch({
                    ...match,
                    status: 'finished',
                    summary: payload.summary,
                    usageContribution: payload.usageContribution,
                    result: payload.result,
                  });
                }}
              >
                Finish match
              </Button>
              <Link to={`/teams/${teamId}/matches/${matchId}/scout`} className="inline-flex min-h-11 items-center rounded-md bg-navy px-3 text-sm font-medium text-white">
                Resume scouting
              </Link>
            </div>
          </div>
        )}
        {match.status === 'finished' && (
          <div className="mb-6 flex justify-end print:hidden">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void setMatchStatus(teamId, matchId, 'live');
                setMatch({ ...match, status: 'live' });
              }}
            >
              Reopen for editing
            </Button>
          </div>
        )}
        {match.status !== 'setup' && state && <MatchReport match={match} state={state} />}
```

Add to `src/index.css`:

```css
@media print {
  header, nav, footer { display: none !important; }
  body { background: #fff; }
}
```

- [ ] **Step 4: Run** `npx vitest run src/matches` → PASS; `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/matches src/index.css
git commit -m "feat(scouting): post-match report, finish/reopen from the match page, print styles"
```

---

### Task 16: Calendar linking

**Files:**
- Modify: `src/calendar/TeamCalendarTab.tsx`, `src/calendar/TeamCalendarTab.test.tsx`, `src/teams/TeamPage.tsx`

**Interfaces:**
- Consumes: `listMatchesInRange` (Task 8), `TeamMatchesTab` `newMatchDate` prop (Task 9).
- Produces: `TeamCalendarTab` prop `onNewMatch?: (date: string) => void`; matches rendered as chips linking to `/teams/:teamId/matches/:id` with label `vs <opponent>` (+ ` <setsUs>–<setsThem>` when status ≠ setup); a "+ Match" button per day (desktop cell and mobile day panel).

- [ ] **Step 1: Failing test** — add to `src/calendar/TeamCalendarTab.test.tsx`:

At the top with the other mocks:

```tsx
import * as matchesApi from '../matches/matchesApi';
vi.mock('../matches/matchesApi');
```

In `beforeEach`:

```tsx
    vi.mocked(matchesApi.listMatchesInRange).mockResolvedValue([
      { id: 'm1', date: '2026-09-12', opponent: 'Rivals', status: 'finished', result: { setsUs: 3, setsThem: 1, sets: [] } } as never,
    ]);
```

New tests:

```tsx
  it('shows matches in the month as links to the match page', async () => {
    render(<MemoryRouter><TeamCalendarTab teamId="team-1" /></MemoryRouter>);
    const link = await screen.findByRole('link', { name: 'vs Rivals 3–1' });
    expect(link).toHaveAttribute('href', '/teams/team-1/matches/m1');
    expect(matchesApi.listMatchesInRange).toHaveBeenCalledWith('team-1', '2026-09-01', '2026-09-30');
  });

  it('offers adding a match on a day', async () => {
    const onNewMatch = vi.fn();
    render(<MemoryRouter><TeamCalendarTab teamId="team-1" onNewMatch={onNewMatch} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Add match on 2026-09-15' }));
    expect(onNewMatch).toHaveBeenCalledWith('2026-09-15');
  });
```

- [ ] **Step 2: Run** `npx vitest run src/calendar/TeamCalendarTab.test.tsx` → new tests FAIL.

- [ ] **Step 3: Implement**

In `TeamCalendarTab.tsx`:
- imports: `import { listMatchesInRange } from '../matches/matchesApi';`, `import type { Match } from '../types/match';`, `Trophy` from `lucide-react`.
- signature: `export function TeamCalendarTab({ teamId, onNewMatch }: { teamId: string; onNewMatch?: (date: string) => void })`
- state: `const [matches, setMatches] = useState<Match[]>([]);`
- in `load`: fetch both:

```tsx
  const load = useCallback(async () => {
    const { start, end } = monthRange(view.year, view.month);
    const [sessionList, matchList] = await Promise.all([
      listCalendarSessions(teamId, start, end),
      listMatchesInRange(teamId, start, end).catch(() => [] as Match[]),
    ]);
    setSessions(sessionList);
    setMatches(matchList);
  }, [teamId, view]);
```

- group: `const matchesByDate = matches.reduce<Record<string, Match[]>>((acc, m) => { (acc[m.date] ??= []).push(m); return acc; }, {});`
- extend `ViewProps` with `teamId: string; matchesByDate: Record<string, Match[]>; onNewMatch?: (date: string) => void;` and pass them in `viewProps`.
- add a shared chip component in the same file:

```tsx
function matchLabel(m: Match): string {
  return m.status === 'setup' ? `vs ${m.opponent}` : `vs ${m.opponent} ${m.result.setsUs}–${m.result.setsThem}`;
}

function MatchChip({ teamId, match }: { teamId: string; match: Match }) {
  return (
    <Link
      to={`/teams/${teamId}/matches/${match.id}`}
      className="flex items-center gap-1 truncate rounded-sm bg-orange/15 px-1.5 py-0.5 text-xs font-medium text-orange-strong hover:underline"
      title={matchLabel(match)}
    >
      <Trophy size={11} aria-hidden="true" />
      <span className="truncate">{matchLabel(match)}</span>
    </Link>
  );
}
```

Because the `Trophy` icon is `aria-hidden`, the link's accessible name is the label text.
- Desktop cell: before the sessions `<ul>`, render `{(matchesByDate[cell.date] ?? []).map((m) => <MatchChip key={m.id} teamId={teamId} match={m} />)}`; after the existing "Add" button, when `onNewMatch` is set:

```tsx
                {onNewMatch && (
                  <button
                    type="button"
                    onClick={() => onNewMatch(cell.date)}
                    aria-label={`Add match on ${cell.date}`}
                    className="flex items-center justify-center gap-1 rounded-sm py-1 text-xs font-medium text-slate/50 hover:bg-orange/10 hover:text-orange-strong group-hover:text-orange-strong"
                  >
                    <Trophy size={12} aria-hidden="true" /> Match
                  </button>
                )}
```

- Mobile: add the match count to the dot row (orange dots: `matchesByDate[cell.date]?.length` rendered as `bg-orange` dots after the blue ones, total capped at `MAX_DOTS`); in the selected-day section render the day's `MatchChip`s above the sessions list, and next to "Add training" a second button when `onNewMatch` is set:

```tsx
            {onNewMatch && (
              <Button variant="secondary" size="sm" onClick={() => onNewMatch(selectedDate)} aria-label={`Add match on ${selectedDate}`}>
                <Trophy size={16} aria-hidden="true" className="mr-1" /> Match
              </Button>
            )}
```

Wrap both buttons in a `<div className="flex gap-2">`.

In `TeamPage.tsx`, pass:

```tsx
          {activeTab === 'calendar' && canCalendar && (
            <TeamCalendarTab
              teamId={teamId}
              onNewMatch={(date) => {
                setNewMatchDate(date);
                setTab('matches');
              }}
            />
          )}
```

- [ ] **Step 4: Run** `npx vitest run src/calendar src/teams` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/calendar src/teams/TeamPage.tsx
git commit -m "feat(scouting): show matches on the team calendar and add matches from a day"
```

---

### Task 17: Demo match seed

**Files:**
- Create: `scripts/seed/seedMatch.mjs`
- Modify: `scripts/seed/dev.mjs` (chain it), `package.json` (`"seed:match": "node scripts/seed/seedMatch.mjs"`), `scripts/seed/README.md` (one line)

**Interfaces:**
- Consumes: the seeded team (`createdBy == 'seed-script'`) and its players.
- Produces: `teams/{seedTeam}/matches/demo-match` (status `finished`, `summary: null` — the report replays events) + its events, and a second `demo-live` match with one set in progress.

- [ ] **Step 1: Write the script**

`scripts/seed/seedMatch.mjs`:

```js
#!/usr/bin/env node
// Seeds a finished demo match and a live one into the LOCAL Firestore emulator,
// for the seeded team, so the Matches tab / report / scouting screen have data.
//
//   npm run seed:match              # against a running emulator (127.0.0.1:8080)
//
// Emulator-only. Replaces previously seeded demo matches (fixed ids).

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
admin.initializeApp({ projectId: 'volley-skills' });
const db = admin.firestore();

// Deterministic pseudo-random so every seed looks the same.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (list) => list[Math.floor(rand() * list.length)];

const teams = await db.collection('teams').where('createdBy', '==', 'seed-script').limit(1).get();
if (teams.empty) {
  console.error('No seeded team found — run `npm run seed:emulator` first.');
  process.exit(1);
}
const teamRef = teams.docs[0].ref;
const players = (await teamRef.collection('players').orderBy('number').limit(30).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const byPos = (p) => players.filter((x) => x.positionCategory === p);
const libero = byPos('L')[0] ?? null;
const field = players.filter((p) => p.id !== libero?.id);
const setter = byPos('S')[0] ?? field[0];
const ordered = [setter, ...byPos('OH'), ...byPos('O'), ...byPos('MB'), ...field].filter(
  (p, i, all) => p && all.findIndex((q) => q.id === p.id) === i && p.id !== libero?.id,
);
const lineup = ordered.slice(0, 6).map((p) => p.id);
const middles = byPos('MB').map((p) => p.id);
const roster = players.map((p) => ({ playerId: p.id, number: p.number, name: p.fullName, positionCategory: p.positionCategory }));
const liberos = libero ? [{ playerId: libero.id, mode: 'always', replaces: middles }] : [];
const format = { bestOf: 5, setPoints: 25, decidingSetPoints: 15, subsPerSet: 6, timeoutsPerSet: 2 };
const attackers = lineup.filter((id) => id !== setter.id);
const receivers = [libero?.id, ...byPos('OH').map((p) => p.id)].filter(Boolean);

function buildSet(events, set, finalScore) {
  let order = events.length;
  const push = (e) => events.push({ order: ++order, source: 'tap', chunkId: null, createdBy: 'seed-match', ...e });
  let serving = set % 2 === 1 ? 'us' : 'them';
  let rot = [...lineup];
  push({ type: 'setStart', set, lineup: rot, serving });
  const score = { us: 0, them: 0 };
  while (score.us < finalScore.us || score.them < finalScore.them) {
    const remainingUs = finalScore.us - score.us;
    const remainingThem = finalScore.them - score.them;
    // Leave the set winner's final point for last.
    const usWins = remainingThem === 0 || (remainingUs > 0 && rand() < remainingUs / (remainingUs + remainingThem) && !(remainingUs === 1 && remainingThem > 0 && finalScore.us > finalScore.them));
    if (serving === 'us') push({ type: 'action', playerId: rot[0], skill: 'S', grade: usWins && rand() < 0.15 ? '#' : pick(['+', '-', '-']) });
    else push({ type: 'action', playerId: pick(receivers), skill: 'R', grade: pick(['#', '+', '+', '!', '-']) });
    const last = events[events.length - 1];
    if (!(last.skill === 'S' && last.grade === '#')) {
      push({ type: 'action', playerId: setter.id, skill: 'E', grade: pick(['#', '+', '+', '!']) });
      if (usWins) push({ type: 'action', playerId: pick(attackers), skill: 'A', grade: '#' });
      else if (rand() < 0.5) push({ type: 'action', playerId: pick(attackers), skill: 'A', grade: pick(['=', '/']) });
      else push({ type: 'point', winner: 'them', reason: pick(['oppKill', 'oppBlock', 'oppAce']) });
    }
    if (usWins) {
      score.us += 1;
      if (serving === 'them') {
        rot = rot.map((_, i) => rot[(i + 1) % 6]);
        serving = 'us';
      }
    } else {
      score.them += 1;
      serving = 'them';
    }
  }
  return score;
}

async function writeMatch(id, meta, sets, finished) {
  const ref = teamRef.collection('matches').doc(id);
  const old = await ref.collection('events').limit(2000).get();
  for (let i = 0; i < old.docs.length; i += 400) {
    const b = db.batch();
    old.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  const events = [];
  const results = [];
  for (const [i, s] of sets.entries()) {
    results.push(buildSet(events, i + 1, s));
    if (finished || i < sets.length - 1) events.push({ order: events.length + 1, source: 'tap', chunkId: null, createdBy: 'seed-match', type: 'setEnd', set: i + 1 });
  }
  const done = finished ? results : results.slice(0, -1);
  await ref.set({
    ...meta,
    format,
    roster,
    liberos,
    status: finished ? 'finished' : 'live',
    result: { setsUs: done.filter((s) => s.us > s.them).length, setsThem: done.filter((s) => s.them > s.us).length, sets: done },
    summary: null,
    usageContribution: null,
    activeDevice: null,
    createdBy: 'seed-match',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  for (let i = 0; i < events.length; i += 400) {
    const b = db.batch();
    events.slice(i, i + 400).forEach((e) => b.set(ref.collection('events').doc(), e));
    await b.commit();
  }
  console.log(`Seeded ${id}: ${events.length} events`);
}

const today = new Date().toISOString().slice(0, 10);
await writeMatch(
  'demo-match',
  { date: today, opponent: 'CV Demo Rivals', competition: 'league', homeAway: 'home' },
  [{ us: 25, them: 21 }, { us: 23, them: 25 }, { us: 25, them: 18 }, { us: 25, them: 22 }],
  true,
);
await writeMatch(
  'demo-live',
  { date: today, opponent: 'Live Test VC', competition: 'friendly', homeAway: 'away' },
  [{ us: 25, them: 19 }, { us: 12, them: 10 }],
  false,
);
```

Note: the in-progress last set of `demo-live` ends at 12–10 without a `setEnd` (the script only appends `setEnd` for completed sets), so it opens mid-set in the scouting screen.

- [ ] **Step 2: Wire it**

- `package.json` scripts: add `"seed:match": "node scripts/seed/seedMatch.mjs",`
- `scripts/seed/dev.mjs` line building `inner`: change `node scripts/seed/seedLibrary.mjs && node …vite` to `node scripts/seed/seedLibrary.mjs && node scripts/seed/seedMatch.mjs && node …vite` (keep the existing quoting style).
- `scripts/seed/README.md`: add a line under the library seed: "`npm run seed:match` — a finished demo match and a live one for the seeded team (also run by `dev:emulator`)."

- [ ] **Step 3: Verify manually**

Run: `npm run emulator` (separate terminal), then `npm run seed:emulator && npm run seed:library && npm run seed:match`.
Expected: `Seeded demo-match: N events` and `Seeded demo-live: M events`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed/seedMatch.mjs scripts/seed/dev.mjs scripts/seed/README.md package.json
git commit -m "chore(scouting): seed a finished and a live demo match into the emulator"
```

---

### Task 18: Final verification

- [ ] **Step 1:** `npm test` → all PASS.
- [ ] **Step 2:** `npm run test:rules` → all PASS.
- [ ] **Step 3:** `npm run lint` → clean.
- [ ] **Step 4:** `npm run build` → succeeds.
- [ ] **Step 5:** Update `CLAUDE.md`'s Firestore model shape paragraph: add `teams/{teamId}/matches/{matchId}` → `events/{eventId}`, and `teams/{teamId}/scoutProfile/usage`; add `/teams/:teamId/matches/:matchId/scout` (lazy, full-screen) to the routing paragraph; mention the persistent local cache in the architecture paragraph. Commit:

```bash
git add CLAUDE.md
git commit -m "docs: note match scouting model, routes and offline cache in CLAUDE.md"
```

- [ ] **Step 6:** Hand over to the user for a manual pass with `npm run dev:emulator` (they verify UI themselves): create a match, scout a few rallies on a phone-width window, undo, timeline edit, sub, set end, finish, report, calendar chip.
