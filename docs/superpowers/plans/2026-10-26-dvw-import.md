# DataVolley (.dvw) Match Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A team admin picks a `.dvw` file on a team's Matches tab, reviews it, and gets a finished match (events, summary, report) identical in shape to a live-scouted one.

**Architecture:** A pure parser (`decodeDvw` → `parseDvw` → `parseScoutCode`) turns the file into a typed `DvwFile`. A pure mapper turns `DvwFile` + the coach's choices (our side, roster mapping) into `NewMatchEvent[]` plus checks, replaying through the existing `scoutEngine` as it goes to keep the score in sync with the file. A small API module writes the match, the events in batches and the finish payload through the existing finish path. A dialog drives file pick → review → import.

**Tech Stack:** React 18 + TypeScript, Firestore (web SDK), Vitest + Testing Library, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-20-volley-skills-dvw-import-design.md` (read it; this plan argues from it). Companion: `docs/superpowers/specs/2026-10-13-volley-skills-scouting-design.md`.

## Global Constraints

- Branch: `feature/dvw-import` from `main`. Paths via `clubCol()` / `clubDoc()` only.
- Parsing is in the browser; the file is never uploaded or stored. Max file size **2 MB**.
- Opponent players: nothing stored (no names, ids or actions). File player names appear only on the review screen; the roster snapshot uses the **app** player's name. Free text from the file (`[3MORE]`, comments) is never stored.
- New event source `'import'`; all imported events share one `chunkId` (the import id) and get `order` 1, 2, 3, … in file order.
- `MATCH_EVENTS_CAP = 2000`; refuse an import whose mapped events exceed **1,900**.
- Online only: the Import button is disabled offline with a hint.
- UI copy, verbatim: button "Import from DataVolley (.dvw)"; help "Also works with Click&Scout and VolleyStation .dvw exports."; footnote "Not affiliated with Data Project or Genius Sports. DataVolley is a trademark of its owner."; report line "Imported from DataVolley".
- Independent parser: credit the MIT `openvolley/datavolley` R package as a format reference in a code comment; copy no code from it or from `pydatavolley` / `py-datavolley`.
- No real match files committed: fixtures are synthetic with invented names.
- Errors inline with `role="alert"`; success via `useNotify()`. Design tokens only, no `dark:` variants.

## Review Focus

1. **A rally decided twice.** Our action closes the rally in the engine and the file's point line follows; emitting a `point` too would add a phantom rally. Covered in Task 4 (`emits no point when our action already decided the rally`).
2. **Our action decides for the other side than the file's point line.** The file wins: the action is dropped, a warning names the line. Covered in Task 4 (`drops a conflicting deciding action; the point line wins`).
3. **Score drift ends a set on a tie.** A `correction { score }` is emitted right after the point that drifted, so `setEnd` never meets a tie. Covered in Task 4 (`re-syncs the score after a mismatching point`).
4. **A file saved in windows-1252 with accented names.** UTF-8 fails strictly; decode with the declared or default code page, never show mojibake. Covered in Task 1 (`decodes windows-1252 when UTF-8 is invalid`).
5. **A starter mapped to "Skip".** The engine needs six on court; the review must block the import and say why. Covered in Task 5 (`blocks import while a starter is skipped`).

---

### Task 1: Decode and parse the file (sections, match, teams, sets, players)

**Files:**
- Create: `src/matches/dvw/types.ts`, `src/matches/dvw/decodeDvw.ts`, `src/matches/dvw/parseDvw.ts`
- Create: `src/matches/dvw/fixtures/three-sets-home.dvw`, `src/matches/dvw/fixtures/five-sets-away.dvw`, `src/matches/dvw/fixtures/loadFixture.ts`
- Test: `src/matches/dvw/decodeDvw.test.ts`, `src/matches/dvw/parseDvw.test.ts`

**Interfaces:**
- Produces (in `types.ts`):
  ```ts
  export type DvwSide = '*' | 'a';                       // '*' home, 'a' visiting
  export interface DvwTeam { name: string; setsWon: number }
  export interface DvwSet { played: boolean; home: number; visiting: number }   // from the final score "25-16"
  export interface DvwPlayer { side: DvwSide; jersey: number; fileId: string; lastName: string; firstName: string;
    specialRole: 'L' | 'C' | null; roleCode: 1 | 2 | 3 | 4 | 5 | 6; startingPositions: (number | null)[] }
  export type ScoutCode =
    | { kind: 'skill'; side: DvwSide; jersey: number | null; skill: Skill; grade: Grade }   // jersey null = '$$'
    | { kind: 'point'; side: DvwSide; home: number; visiting: number }
    | { kind: 'rotation'; side: DvwSide }
    | { kind: 'sub'; side: DvwSide; outJersey: number; inJersey: number }
    | { kind: 'timeout'; side: DvwSide }
    | { kind: 'setEnd'; set: number }
    | { kind: 'other'; reason: 'teamCode' | 'note' | 'lineupMarker' | 'unparsed' };
  export interface ScoutLine { lineNo: number; raw: string; code: ScoutCode; set: number;
    homeCourt: (number | null)[]; visitingCourt: (number | null)[] }   // P1–P6 jerseys, index 0 = P1
  export interface DvwFile { generator: string; date: string | null; season: string; league: string;
    teams: Record<DvwSide, DvwTeam>; sets: DvwSet[]; players: DvwPlayer[]; scout: ScoutLine[]; warnings: string[] }
  export interface DvwError { error: string }
  ```
- Produces: `decodeDvw(bytes: ArrayBuffer): string`, `parseDvw(text: string): DvwFile | DvwError` (uses `parseScoutCode` from Task 2 for the `code` field; until Task 2 lands, Task 1 stubs it as `{ kind: 'other', reason: 'unparsed' }` behind the same import).
- Produces (`loadFixture.ts`, tests only): `loadFixture(name: string): string` reading `fixtures/<name>` with `readFileSync` (tests run with `// @vitest-environment node`).

Format layout (independent reading of the openvolley `datavolley` documentation; settle against a real file in Task 8):
- Sections start at lines `[3NAME]`. `;` separates fields.
- `[3DATAVOLLEYSCOUT]`: the `GENERATOR-PRG:` line → `generator` (empty string if absent).
- `[3MATCH]`, first line: field 1 date `MM/DD/YYYY` → ISO `YYYY-MM-DD` (unparseable → `null`), field 3 season, field 4 league, field 9 text-encoding code page (e.g. `1252`), field 10 regulation: `2` (indoor rally point) is the only accepted value; anything else → `{ error: 'Unsupported regulation: only indoor rally-point matches can be imported.' }`.
- `[3TEAMS]`: line 1 home, line 2 visiting; field 2 name, field 3 sets won.
- `[3SET]`: up to five lines; field 1 `True`/`False` played, field 5 final score `HH-VV`.
- `[3PLAYERS-H]` / `[3PLAYERS-V]`: field 2 jersey, fields 4–8 starting position for sets 1–5 (number, `*` = on the bench, empty = did not play → `null` for both), field 9 file player id, field 10 last name, field 11 first name, field 13 special role (`L`, `C` or empty), field 14 role code 1–6 (missing/invalid → 6).
- `[3SCOUT]`: per line, field 1 the code, field 9 set number, fields 15–20 home P1–P6 jerseys, fields 21–26 visiting P1–P6 (empty → `null`).
- A file with no `[3SCOUT]` section → `{ error: 'This file has no scouted rallies.' }`.

- [ ] **Step 1: Write the fixtures** — `three-sets-home.dvw`: home = "Volley Club Test" wins 3–0 (25-20, 25-18, 25-22), visiting "Rivali Uno"; 12 home players incl. one `L` libero, setter role code 5. `five-sets-away.dvw`: we are visiting, 3–2 with a 15-13 fifth set. Both carry: a substitution, timeouts for both sides, a `*$$&H#` team code, a `>ROT` note, a `$$` skill line, one invalid grade for its skill (`*07S!`), and (in `three-sets-home`, set 2) one point line whose score jumps by 2 (a manual score edit). Invented names only. Keep each under 400 scout lines; they are reused by Tasks 2–4 and 8.
- [ ] **Step 2: Write the failing tests**
  - `decodeDvw`: `decodes UTF-8`, `decodes windows-1252 when UTF-8 is invalid` (bytes for `Müller`/`Pérez` encoded as 1252; result contains `Müller` and `Pérez`), `uses the code page declared in [3MATCH]` (a 1250 file with `ř` declared `1250`).
  - `parseDvw`: on `three-sets-home.dvw` expect `teams['*'].name === 'Volley Club Test'`, `sets.filter(s => s.played).map(s => [s.home, s.visiting])` equals `[[25,20],[25,18],[25,22]]`, the libero has `specialRole: 'L'`, `date` is ISO, scout line 1 has `set === 1` and six non-null `homeCourt` jerseys; `refuses another regulation` (field 10 = `1`) returns the exact error string; `returns an error without [3SCOUT]`.
- [ ] **Step 3: Run** `npx vitest run src/matches/dvw` — expect FAIL (modules missing).
- [ ] **Step 4: Implement** `types.ts`, `decodeDvw` (`new TextDecoder('utf-8', { fatal: true })`, on throw read the `[3MATCH]` code page from a `latin1` decode, then `new TextDecoder('windows-<cp>')`, default `windows-1252`), and `parseDvw` per the layout above.
- [ ] **Step 5: Run** `npx vitest run src/matches/dvw` — expect PASS.
- [ ] **Step 6: Commit** `feat(dvw): decode and parse DataVolley files`

### Task 2: Scout code grammar

**Files:**
- Create: `src/matches/dvw/parseScoutCode.ts` (replace Task 1's stub import)
- Test: `src/matches/dvw/parseScoutCode.test.ts`

**Interfaces:**
- Consumes: `ScoutCode`, `DvwSide` from Task 1; `Skill`, `Grade` from `src/types/match.ts`.
- Produces: `parseScoutCode(code: string): ScoutCode`.

Grammar (spec §3): side char `*` / `a`, then:
- skill: `^([*a])(\d{1,2}|\$\$)([SRABDEF])(.)([#+!\-/=])` (the 4th group is the type char, ignored; the rest of the line ignored).
- point: `^([*a])p(\d{1,2}):(\d{1,2})` (home:visiting after the point).
- rotation: `^([*a])z\d` without `>LUp`; lineup markers `^([*a])(P\d{1,2}|z\d)>LUp` → `other / lineupMarker`.
- substitution: `^([*a])c(\d{1,2}):(\d{1,2})` (out:in).
- timeout: `^([*a])T$`.
- set end: `^\*\*(\d)set`.
- team code `^[*a]\$\$&` → `other / teamCode`; a line starting `>` → `other / note`; anything else → `other / unparsed` (never throws).

- [ ] **Step 1: Write the failing tests** — one `it` per kind with exact expectations, e.g. `parseScoutCode('*07SH+~~~45AM')` → `{ kind: 'skill', side: '*', jersey: 7, skill: 'S', grade: '+' }`; `'a$$SM='` → jersey `null`; `'ap12:14'` → `{ kind: 'point', side: 'a', home: 12, visiting: 14 }`; `'*c05:11'`; `'aT'`; `'**2set'` → `{ kind: 'setEnd', set: 2 }`; `'*P05>LUp'` and `'*z3>LUp'` → lineupMarker; `'*$$&H#'` → teamCode; `'>ROT'` → note; `'*zz'` and `''` → unparsed.
- [ ] **Step 2: Run** `npx vitest run src/matches/dvw/parseScoutCode.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `parseScoutCode` with the regexes above, in the order lineupMarker, teamCode, note, setEnd, point, sub, timeout, rotation, skill, unparsed.
- [ ] **Step 4: Run** `npx vitest run src/matches/dvw` — expect PASS (Task 1 tests still pass with real codes).
- [ ] **Step 5: Commit** `feat(dvw): scout code grammar`

### Task 3: Event source `import` everywhere it is counted or shown, plus rules

**Files:**
- Modify: `src/types/match.ts` (`EventSource` gains `'import'`; `MatchStats.sourceCounts` becomes `{ tap: number; text: number; import?: number }`; `Match` gains `import?: MatchImport | null`)
- Modify: `src/matches/scoutStats.ts:39,58` (count `import`), `src/matches/report/MatchReport.tsx:36,146-150`, `src/matches/scout/TimelineDrawer.tsx:33`, `src/awards/testMatches.ts:46`
- Modify: `firestore.rules` (events `source` list; match `import` field)
- Test: `src/matches/scoutStats.test.ts`, `src/matches/report/MatchReport.test.tsx`, `tests/rules/matches.rules.test.ts`

**Interfaces:**
- Produces: `export interface MatchImport { format: 'dvw'; fileName: string; fileSha256: string; generator: string; importedAt: unknown; importedBy: string; warnings: number }` in `src/types/match.ts`. `importedBy` is the uid.
- Older summaries have no `import` count: read it as `stats.sourceCounts.import ?? 0`.

- [ ] **Step 1: Write the failing tests**
  - `scoutStats`: `counts imported actions under import` — two `source: 'import'` actions → `sourceCounts` equals `{ tap: 0, text: 0, import: 2 }`.
  - `MatchReport`: with `sourceCounts: { tap: 0, text: 0, import: 10 }` the report shows `Imported from DataVolley`; with `{ tap: 5, text: 5 }` (no `import` key) it still shows `50% tapped · 50% from text`.
  - Rules (`matches.rules.test.ts`): `accepts import events`; `accepts a match created with a valid import field` (`{ format: 'dvw', fileName: 'm.dvw', fileSha256: '<64 hex>', generator: 'Data Volley 4', importedAt: serverTimestamp(), importedBy: <uid>, warnings: 0 }`); `refuses an import field with extra keys, a wrong format, a bad hash or another user's uid`; `refuses adding or changing import on update`; existing source validation still refuses `source: 'bogus'`.
- [ ] **Step 2: Run** `npx vitest run src/matches/scoutStats.test.ts src/matches/report` and `npm run test:rules` — expect FAIL.
- [ ] **Step 3: Implement** the type changes; `scoutStats` initialises `{ tap: 0, text: 0, import: 0 }` and counts by source; `MatchReport` adds ` · Imported from DataVolley` when `import > 0` (and drops a 0% part); `TimelineDrawer` shows lucide `FileDown` with `aria-label="Imported"` for `source === 'import'`. Rules: events `d.source in ['tap', 'text', 'correction', 'import']`; match create allows `import` absent or `validImport(request.resource.data.import)` (keys exactly the seven above, `format == 'dvw'`, `fileName` string ≤ 255, `fileSha256` matches `^[0-9a-f]{64}$`, `generator` string ≤ 100, `importedAt == request.time`, `importedBy == request.auth.uid`, `warnings` int ≥ 0); match update requires `import` unchanged (`'import' in resource.data ? request.resource.data.import == resource.data.import : !('import' in request.resource.data)`).
- [ ] **Step 4: Run** `npm test` and `npm run test:rules` — expect PASS.
- [ ] **Step 5: Commit** `feat(matches): import as an event source; rules for imported matches`

### Task 4: Map a parsed file to app events (the core)

**Files:**
- Create: `src/matches/dvw/mapDvw.ts`, `src/matches/dvw/pickSide.ts`
- Test: `src/matches/dvw/mapDvw.test.ts`, `src/matches/dvw/pickSide.test.ts`, `src/matches/dvw/roundTrip.test.ts`

**Interfaces:**
- Consumes: `DvwFile`, `ScoutLine` (Task 1/2); `replay`, `EngineMatch` (`scoutEngine.ts`); `rallyOutcome`, `validGrades` (`skillGrades.ts`); `Player` (`src/types/player.ts`).
- Produces:
  ```ts
  // pickSide.ts — builder's heuristic (spec §9): token overlap of each file team name with the app names.
  export function pickOurSide(teams: Record<DvwSide, DvwTeam>, appNames: string[]): DvwSide;
  // mapDvw.ts
  export type PlayerMapping = Record<string, string | null>;      // key `${side}${jersey}`, value playerId or null = Skip
  export function autoMapPlayers(file: DvwFile, us: DvwSide, players: Player[]): PlayerMapping;  // same jersey → that player
  export function ourFilePlayers(file: DvwFile, us: DvwSide): DvwPlayer[];  // our players who appear: on court in any line, in a skill or sub line
  export interface DvwIssue { kind: 'blocking' | 'warning'; message: string; lines: number[] }
  export interface DvwChecks { fileSets: SetScore[]; pointLineSets: SetScore[]; replaySets: SetScore[];
    corrections: number[]; eventCounts: Record<MatchEventPayload['type'], number>; ignoredLines: number }
  export interface DvwPlan { setup: MatchSetupInput; events: NewMatchEvent[]; checks: DvwChecks; issues: DvwIssue[] }
  export function mapDvw(file: DvwFile, opts: { us: DvwSide; mapping: PlayerMapping; players: Player[]; importId: string }): DvwPlan;
  ```
  `setup` and `events` are oriented to us/them; all `SetScore`s are `{ us, them }`.

Rules (spec §4; the tests below pin each):
- **Setup**: `date` = file date (or `''`, which `validateSetup` reports), `opponent` = the other team's name, `competition: 'league'`, `homeAway` = `us === '*' ? 'home' : 'away'`, `format` = `DEFAULT_FORMAT` with `bestOf: 3` when the winner's `setsWon === 2`, `roster` = mapped players (app `fullName`, app `number`, role from the file role code: 5→`S`, 2→`OH`, 3→`O`, 4→`MB`, 1→`L`, else the app player's `positionCategory`), `liberos` = mapped players with `specialRole === 'L'` or role code 1 → `{ playerId, mode: 'receiving', replaces: [] }` (at most 2; a third → blocking issue).
- **setStart** at the first scout line of each set: `lineup` = our court jerseys of that line mapped to playerIds (P1 first); `serving` = side of the set's first serve line; `roles` = the roster roles keyed by playerId. A starter that is unmapped or skipped → blocking issue "Map or keep every starter: the app needs six players on court in set N." **setEnd** at `**Nset`.
- **Actions**: our skill lines with a mapped jersey → `action`. Grade not in `validGrades(skill)` → dropped, warning. `$$` or skipped/unmapped jersey → dropped, warning. Opponent skill lines never become actions. Once an action has decided the current file rally (`rallyOutcome !== null`), later our actions before the next point line are dropped with a warning (the engine would open a new rally).
- **Points** (§4.4): at each point line, winner = `line.side === us ? 'us' : 'them'`. If an emitted our action in this rally decided it for the same winner → emit nothing. If it decided for the other winner → remove that action, warn with its line number, emit the point. Otherwise emit `point { winner, reason }`; reason from the last opponent skill line in the rally: `S#` → `oppAce`, `A#` → `oppKill`, `B#` → `oppBlock`, opponent `=` or `A/` / `B/` → `oppError`; a reason not in `POINT_REASONS[winner]` → `unknown`; no opponent line → `unknown`.
- **Subs and timeouts**: our `c` → `sub { outPlayerId, inPlayerId }` (both mapped, else warning and skip); opponent subs ignored; `T` → `timeout { team }`.
- **Score check** (§4.7): after each point line, `replay(engineMatch, eventsSoFar)`; if the engine score differs from the line's score (oriented), emit `correction { score: <file score>, rotation: null, serving: null }` right after, and record the line number in `checks.corrections`.
- **Meta**: every event `{ order: i + 1, source: 'import', chunkId: importId }`. More than 1,900 events → blocking issue "This match is too long to import (more than 1,900 events)."
- **Checks**: `fileSets` from `[3SET]`, `pointLineSets` from the last point line of each set, `replaySets` from `replay(...).setScores`; any `replaySets` ≠ `fileSets` → warning "The replayed score differs from the file's set scores." (the review requires an extra confirm for it, Task 5). `ignoredLines` counts `other` lines.

- [ ] **Step 1: Write the failing tests** (`mapDvw.test.ts` builds small `DvwFile`s inline with a helper `file(lines: string[], opts?)` that runs `parseScoutCode`; `pickSide.test.ts`; `roundTrip.test.ts` on both fixtures):
  - `pickOurSide`: `['Volley Club Test', 'U17']` picks `*` for teams `Volley Club Test` / `Rivali Uno`, and `a` when the names are swapped.
  - `maps setStart lineup, serving and roles from the first line of each set`
  - `emits no point when our action already decided the rally` (`*07SH#` then `*p01:00` → one action, no point)
  - `drops a conflicting deciding action; the point line wins` (`*09AH=` then `*p01:00` → no action, `point { winner: 'us' }`, a warning listing that line)
  - `infers the point reason from the last opponent skill line` (cases `aS#`→oppAce, `aA#`→oppKill, `aB#`→oppBlock, `aA=`→oppError for us, none→unknown)
  - `drops actions of skipped players and $$ lines, keeping their points`
  - `drops a grade the app does not offer for that skill` (`*07S!`)
  - `re-syncs the score after a mismatching point` (a point line jumping 2 → one `correction` with the file score right after the point; replay of the result never warns `setEndTie`)
  - `blocks import while a starter is skipped` and `flags more than two liberos`
  - `refuses more than 1,900 events`
  - `orders events 1..n with source import and the import id as chunkId`
  - Round trip (`roundTrip.test.ts`): each fixture → `parseDvw` → `autoMapPlayers` with a 12-player app roster built from the fixture's jerseys → `mapDvw` → `replay` → `buildReportData`; expect `setScores` to equal the fixture's `[3SET]` scores oriented to us, `setsWon` 3–0 / 3–2, zero `setEndTie` warnings, and action counts per skill equal to the fixture's our-side skill lines minus the dropped ones.
- [ ] **Step 2: Run** `npx vitest run src/matches/dvw` — expect FAIL.
- [ ] **Step 3: Implement** `pickSide.ts` and `mapDvw.ts` per the rules above (a single pass over `file.scout`, keeping the current file rally's emitted events and its last opponent skill line).
- [ ] **Step 4: Run** `npx vitest run src/matches` — expect PASS.
- [ ] **Step 5: Commit** `feat(dvw): map a DataVolley file to match events with score checks`

### Task 5: Import API — duplicates, batched write, finish, retry and discard

**Files:**
- Create: `src/matches/dvw/dvwImportApi.ts`, `src/matches/dvw/sha256.ts`
- Modify: `src/matches/matchesApi.ts` (export `MATCH_EVENTS_CAP`, `eventsCol`, `matchesCol` helpers needed here, or add the functions below to `matchesApi.ts` itself — keep all Firestore calls in `*Api.ts` files)
- Test: `src/matches/dvw/dvwImportApi.test.ts`, `src/matches/dvw/sha256.test.ts`

**Interfaces:**
- Consumes: `DvwPlan` (Task 4), `createMatch`-equivalent write, `buildFinishPayload` (`finish.ts`), `finishMatch`, `getUsageProfile`, `deleteMatch`, `replay`.
- Produces:
  ```ts
  export function sha256OfBytes(bytes: ArrayBuffer): Promise<string>;             // lowercase hex
  export function findImportedMatch(teamId: string, fileSha256: string): Promise<{ id: string; date: string; opponent: string } | null>;
  export interface ImportJob { matchId: string; eventIds: string[]; nextBatch: number }
  export function startImport(teamId: string, plan: DvwPlan, meta: { fileName: string; fileSha256: string; generator: string; warnings: number }, uid: string): ImportJob;  // ids generated up front
  export function runImport(teamId: string, plan: DvwPlan, job: ImportJob, onProgress: (done: number, total: number) => void): Promise<void>;
  export function discardImport(teamId: string, matchId: string): Promise<void>;  // = deleteMatch
  ```
  `runImport` writes the match doc (status `setup`, `import` with `importedAt: serverTimestamp()`) if `nextBatch === 0`, then events with `writeBatch`es of ≤ 450 `set` writes (each event `{ ...event, createdBy: uid, createdAt: serverTimestamp() }`, ids from `job.eventIds`), advancing `job.nextBatch` after each commit, then `finishMatch(teamId, matchId, buildFinishPayload(match, replay(match, eventsWithIds), await getUsageProfile(teamId)))`. Calling it again after a failure resumes at `job.nextBatch` (same ids: idempotent). Duplicate query: `query(matchesCol(teamId), where('import.fileSha256', '==', hash), limit(1))` (automatic single-field index; no `firestore.indexes.json` change).

- [ ] **Step 1: Write the failing tests** (mock `firebase/firestore` the way `matchesApi.test.ts` does):
  - `sha256OfBytes` of the bytes of `"abc"` → `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
  - `writes events in batches of at most 450 with the pre-generated ids` (1,000 events → 3 batch commits; ids in order).
  - `resumes after a failed batch without rewriting earlier ones` (batch 2 rejects once; second `runImport` call commits batches 2–3 only, then finishes).
  - `finishes through buildFinishPayload` (`finishMatch` called once with a summary whose `sourceCounts.import` equals the number of actions).
  - `findImportedMatch queries import.fileSha256 with limit 1`.
- [ ] **Step 2: Run** `npx vitest run src/matches/dvw/dvwImportApi.test.ts src/matches/dvw/sha256.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** `feat(dvw): import writes, retry and duplicate check`

### Task 6: Review and import dialog, and the Matches tab button

**Files:**
- Create: `src/matches/dvw/DvwImportDialog.tsx`, `src/matches/dvw/DvwReview.tsx`
- Modify: `src/matches/TeamMatchesTab.tsx` (secondary button next to "New match")
- Test: `src/matches/dvw/DvwImportDialog.test.tsx`, `src/matches/TeamMatchesTab.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–5; `loadTeamRoster(teamId)` (`matchesApi.ts`); `useAuth()` (`club`, `firebaseUser`); team name from the caller.
- Produces: `<DvwImportDialog teamId teamName onClose onImported={(matchId) => void} />`; `TeamMatchesTab` gains a `teamName` prop (pass it from the team page).

Behaviour (spec §2):
- Step "file": `<input type="file" accept=".dvw">`; reject > 2 MB ("This file is larger than 2 MB."); `decodeDvw` → `parseDvw`; a `DvwError` shows its message (`role="alert"`). Help text and footnote verbatim from Global Constraints.
- Step "review": editable date, opponent, competition (select), format (best of 3/5); "Which team is us" radio with both file names, preselected by `pickOurSide(file.teams, [club.name, teamName])`; flipping re-runs `autoMapPlayers` and `mapDvw`. Roster table: file jersey, file name, file role → select of app players (auto-picked by jersey) or "Skip". Checks block: per-set `fileSets` / `pointLineSets` / `replaySets`, corrections count with the first five line numbers, event counts per type, warnings, ignored lines. Duplicate warning with a link to the existing match. Blocking issues disable "Import"; a `replaySets` ≠ `fileSets` warning requires ticking "I checked the scores" before "Import" enables.
- Step "importing": progress `done/total`; on error, "Retry" (calls `runImport` with the same job) and "Discard" (calls `discardImport`, closes). On success: `notify('Match imported.')`, `onImported(matchId)` → navigate to the match page.
- The Matches-tab button "Import from DataVolley (.dvw)" is disabled with the hint "Connect to the internet to import." while `navigator.onLine === false` (listen to `online`/`offline`).

- [ ] **Step 1: Write the failing tests**
  - `shows the parse error inline for a non-DataVolley file`; `refuses a file over 2 MB`.
  - `preselects our side by name and remaps the roster when flipped`.
  - `blocks import while a starter is skipped` (choose Skip for a starter → Import disabled, message shown).
  - `warns about a duplicate with a link to the existing match` (`findImportedMatch` mocked).
  - `requires the score confirmation when replayed and file set scores differ`.
  - `retries a failed import and opens the match when done` (`runImport` rejects once, then resolves → `onImported('m1')`).
  - `TeamMatchesTab`: `disables the DataVolley import offline`.
- [ ] **Step 2: Run** `npx vitest run src/matches/dvw/DvwImportDialog.test.tsx src/matches/TeamMatchesTab.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement** the dialog (`Dialog` with `size="lg" mobileSheet`), the review, and the button.
- [ ] **Step 4: Run** `npm test` — expect PASS; `npm run lint` and `npx tsc -b` clean.
- [ ] **Step 5: Commit** `feat(dvw): import dialog with review, checks and retry`

### Task 7: Docs

**Files:**
- Modify: `CLAUDE.md` (Architecture: one paragraph "DataVolley import (`src/matches/dvw/`)": pure parser and mapper, `source: 'import'`, file never stored, opponent data never stored), `docs/PRODUCTION-READINESS.md` section E (lawyer list: Data Project EULA on exported files)

- [ ] **Step 1: Edit both files.**
- [ ] **Step 2: Commit** `docs: DataVolley import`

### Task 8: Manual check with a real file (operator)

Not automated (real files carry minors' names and are never committed).

- [ ] **Step 1:** `npm run dev:emulator`, sign in as `president@example.com`, open the seeded team → Matches → Import from DataVolley, pick a real `.dvw` from the operator's club (kept outside the repo).
- [ ] **Step 2:** Compare the review's per-set scores and the finished report with the DataVolley report by eye. Note any layout field the parser read wrongly (Task 1's layout) and fix with a regression test using a synthetic line of the same shape.
- [ ] **Step 3:** Settle the libero question (spec §4.1): if the libero's actions show as off-court in the timeline, decide with the operator whether `replaces` should list the middle blockers; record the decision in the spec.
