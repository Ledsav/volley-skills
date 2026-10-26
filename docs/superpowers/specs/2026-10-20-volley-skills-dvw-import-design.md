# Volley Skills — DataVolley (.dvw) match import

Date: 2026-10-20
Status: Design — awaiting approval
Programme: `feature/club-platform` (third of four; **built after the club platform lands**, against `clubs/{clubId}/teams/…` paths via the club path helper and the club `status` gate, with its rules changes in the rewritten club rules and tests)
Companion: `2026-10-13-volley-skills-scouting-design.md` (event model, replay engine — this design adds a third event source next to tap and text)

## 1. Intent

Clubs from Serie B upward already scout with DataVolley (or Click&Scout / VolleyStation, which write the same `.dvw` format). Today that data sits on the analyst's laptop. Importing a `.dvw` file turns each scouted match into a normal match in the app: report, team stats, season awards, player footprints — the same as a match scouted live in the app. Positioning from the pricing report: *keep your scout on DataVolley; the rest of the club gets everything else*. The import makes the incumbent a data source instead of a rival.

### Goals
1. A team admin picks a `.dvw` file on a team's match list and gets a finished match with events, summary and report.
2. Everything is parsed **in the browser**; the file itself is never uploaded or stored.
3. Our players are matched to the team's roster by jersey number, with a review step for mismatches.
4. Imported events replay through the existing `scoutEngine` and produce the same stats a live-scouted match would.
5. A score check against the file's own point lines, so the coach can trust the import.
6. Re-importing the same file is detected.

### Non-goals
- **Opponent players.** The app's model is "our team only + point us / point them" (scouting design). Opponent names, ids and individual actions are **not stored**; opponents contribute only through point outcomes and reasons. This is also the data-minimisation stance in the legal research (opponents are often minors).
- Zones, cones, coordinates, attack combinations, setter calls, skill subtypes, number of blockers, video time, comments — the app has no place for them (v1). Not stored.
- Export to `.dvw`.
- VolleyStation's own `.vsm` format.
- Merging an import into an existing live-scouted match (an import always creates a new match).
- Offline import (needs a connection; §5.4).

### Anti-goals
- Storing anything about opponents beyond what a live-scouted match stores.
- An import whose stats silently disagree with the file's scores.
- Code copied from unlicensed parsers (see §7).

## 2. User flow
1. Team → Matches tab → **Import from DataVolley (.dvw)** (team admins only, club `active`).
2. File picker (`.dvw`, ≤ 2 MB). Parsing runs locally; errors are shown inline (`role="alert"`).
3. **Review** screen:
   - Match: date, home/away, opponent name (from the file's other team, editable), competition (default `league`, editable), format (best of 5 unless the file shows otherwise; set points 25/15).
   - **Which team is us**: preselected by the closest name match between the file's two team names and the app team's name; the coach confirms or flips.
   - **Roster mapping**: each of our file players (jersey, name from the file shown only on this screen, role) ↔ an app player with the same jersey (auto), or a select to pick another player, or "Skip". Liberos flagged from the file's `L` role.
   - **Checks**: sets and final score per set from the file; the app's replayed score per set; number of events per type; warnings (unknown jersey, actions by skipped players, score mismatches with line numbers, unsupported lines ignored).
   - Duplicate warning if a match with the same file hash exists in this team.
4. **Import** → progress → opens the new match page (status finished, report ready).

Players not in the app cannot be created from this screen in v1 (builder may add "create player" later); skipped players' actions are dropped, their points still count through point lines (§4.4).

## 3. Parser — `src/matches/dvw/`

Pure TypeScript, no I/O, fully unit-tested:
- `decodeDvw(bytes: ArrayBuffer): string` — try UTF-8 with `fatal: true`; on failure use the code page declared in `[3MATCH]` (text-encoding field, e.g. `1252`, `1250`) when present, else `windows-1252`. `TextDecoder` supports these labels in modern browsers.
- `parseDvw(text: string): DvwFile | DvwError` — split into sections by `[3…]` headers; `;`-separated fields; returns:
  - `match`: date (MM/DD/YYYY in the file → ISO `YYYY-MM-DD`), season, league, regulation (`1` = indoor rally point expected; `0` indoor sideout, `2` beach and anything else → error "unsupported regulation").
  - `teams`: home (`*`) and visiting (`a`): name, sets won, coach.
  - `sets`: per set — played flag, final score "25-16" (spaces around the dash allowed, e.g. "15- 9"), duration.
  - `players`: home/visiting lists — jersey, file player id, last/first name, special role (`L`, `C`), role code (1 libero, 2 outside, 3 opposite, 4 middle, 5 setter, 6 unknown), starting positions per set.
  - `scout`: ordered lines with line number, raw code, parsed code, and trailing fields: set number, home and visiting setter position (10, 11), home P1–P6 jerseys (15–20), visiting P1–P6 jerseys (21–26).
- Code grammar (`parseScoutCode`):
  - Team char `*` (home) / `a` (visiting).
  - **Skill line**: jersey digits (or `$$` unknown), skill `S R A B D E F`, type char, evaluation `# + ! - / =`, the rest ignored in v1.
  - **Point**: `*pHH:VV` / `apHH:VV` (score home:visiting after the point).
  - **Rotation**: `*zN` / `azN`; `*PNN>LUp` / `*zN>LUp` lineup markers (positions taken from fields 15–26 instead).
  - **Substitution**: `*cOUT:IN` / `acOUT:IN`.
  - **Timeout**: `*T` / `aT`.
  - **Set end**: `**Nset`.
  - **Team-level codes** `*$$&…` / `a$$&…`, sanctions/notes starting `>` (e.g. `>ROT`): kept as `other` lines, ignored (counted in checks).
  - Anything unparseable → `other` with a warning, never a crash.
- Set number of a scout line: the running count of `**Nset` markers (lines before the first marker are set 1, lines after the Nth marker are set N+1; a marker belongs to the set it ends). Lines after the last marker start a set only if they hold a rally (a skill or point line); otherwise they stay in the last set, so a trailing note never makes a phantom set. Blank lines and NUL padding (real files can end with a stray NUL byte) are skipped. Field 9 is only a cross-check: one parse warning per set where it is empty or disagrees; marker lines are not checked, since DataVolley writes the next set's number on them. Parse warnings are shown in the review's checks with the mapping warnings.
- `[3SET]`: a set is played only when it is marked `True` **and** has a final score; DataVolley marks unplayed sets `True` too.

Format reference: the openvolley `datavolley` R package (MIT licence) and its documented column layouts were used to understand the format; the TypeScript parser is written independently (§7).

## 4. Mapping to app events

Let `us` be the file side chosen in the review (`*` or `a`), `them` the other.

### 4.1 Match doc
Created like `createMatch` does today, then finished (§5): `date`, `opponent` (other team's name), `competition`, `homeAway` (`us == '*' ? 'home' : 'away'`), `format`, `roster` (snapshot of mapped players: playerId, number, name from the **app** player, positionCategory), `liberos` (mapped players with special role `L` or role code 1, at most two → `{ playerId, mode: 'always', replaces: <playerIds of the roster entries whose positionCategory is 'MB'> }`; real files rarely carry role codes, so when no roster entry is a middle, the replaced players are read from the scout: a player who is in the back row (P5, P6, or P1 in a rally we did not serve) on at least 10 of our skill lines and plays the ball on under 5% of them was off court for the libero (a real file had a middle with one stray dig in 94 such lines). The guess is shown as a warning naming the jerseys (or, if none is found, a warning that the libero never comes on court); either way the coach fixes it by marking the middles MB in the roster: DataVolley never lists the libero in P1–P6, so the engine puts the libero on court for whichever middle is in the back row, except in P1 while we serve. A player with special role `L` gets `positionCategory: 'L'` whatever the role code. With two liberos, the engine uses the first `always` one), and a new field:

```
import: { format: 'dvw', fileName, fileSha256, generator, importedAt, importedBy, warnings: number }
```

### 4.2 Per set
- `setStart { set, lineup, serving, roles }` at the first scout line of each set:
  - `lineup`: our P1–P6 jerseys from fields 15–20 (home) or 21–26 (visiting) of that first line, mapped to playerIds (index 0 = P1, same as the app). An unmapped jersey → blocking issue in the review (the coach maps or skips; a skipped starter blocks import because the engine needs six — the review says so).
  - `serving`: side of the first serve (`S`) line of the set.
  - `roles`: from file role codes (5→setter `S`, 2→outside, 3→opposite, 4→middle, 1→libero) mapped to the app's `PositionCategory`; the engine derives rotation from the setter (scouting design).
- `setEnd { set }` at `**Nset`.

### 4.3 Actions
Our skill lines with a mapped jersey → `action { playerId, skill, grade }`. Skill letters and grade symbols are identical to the app's (`skillGrades.ts`). A block graded `!` (DataVolley: poor block, ball to the opponent) is read as `-` (touch theirs). Grades still not valid for a skill in the app (e.g. `/` on a set) → dropped with a warning. `$$` (unknown player), skipped players and actions after the rally was decided → dropped with a warning. Dropped actions are grouped into one warning per jersey and reason (per skill and grade for invalid grades), with the count and the first five line numbers. A jersey seen in the scout but missing from the file's player list is warned about only when it is mapped to an app player. Two file players who appear in the match mapped to the same app player block the import (their stats would merge). Opponent skill lines are not turned into actions.

### 4.4 Points
The engine closes a rally on an action whose grade decides it (`rallyOutcome`) or on a `point` event. To avoid counting twice:
- Our actions, and our subs and both teams' timeouts, are held until the rally's point line and then emitted in file order; an action that would decide the rally for the **other** side is dropped on its own with a warning (the rest of the rally is kept), and our actions after the first one that decides it for the file's winner are dropped as "already decided". A set end, or the end of the file, emits what is held with no known winner (the first deciding action closes the rally). Subs and timeouts after a set's end marker that start no new set are counted as ignored lines. If the file ends without the last set's end marker and that set's score already ends it, a `setEnd` is added.
- For each file point line (`*p` / `ap`): if one of **our** actions decides the rally for the same winner, emit nothing.
- Otherwise emit `point { winner, reason }`, `winner` from the point line's team, `reason` from the last **opponent** skill line in that rally: `S#` → `oppAce`, `A#` → `oppKill`, `B#` → `oppBlock`, any opponent `=` (or `A/`, `B/` that hands us the point) → `oppError`; otherwise `unknown`.
- If our action decided the rally for the **other** side than the point line says → **the file wins**: the conflicting action is dropped (it would close the rally the wrong way in the engine), the `point` for the file's winner is emitted, and a warning names the line. The file's point lines are the authority for who won each rally.

### 4.5 Substitutions and timeouts
- Our `c` lines → `sub { outPlayerId, inPlayerId }` (both mapped; else warning and skip). Opponent subs ignored.
- `*T` / `aT` → `timeout { team: 'us' | 'them' }`.

### 4.6 Ordering
Events get sequential `order` values (1, 2, 3, … in file order) — no anchors needed; all events share one `chunkId` (the import id) and `source: 'import'`.

### 4.7 Score check
The mapper replays as it goes (`scoutEngine.replay` over the events emitted so far, in memory). After every file point line it compares the engine's score with the file's `HH:VV` (oriented to us/them). On a mismatch it **re-syncs** by emitting a `correction { score }` event (existing event type, `source: 'import'`) right after that point, so drift never carries into serving, rotation or the set end — in particular a set can never end on a replayed tie and fall out of the result (`setEndTie`). Corrections count toward the event limit (§5.3).

The review shows: number of corrections needed (with the first five line numbers), per-set final scores from the replay vs the file's point lines vs `[3SET]`. Corrections warn; they do not block (DataVolley files can contain manual score edits). A file whose final set scores differ from `[3SET]` shows a prominent warning and requires an extra confirm.

## 5. Writing

### 5.1 New event source
`source: 'import'` is added to `EventSource` (`src/types/match.ts`), to the rules' allowed list (`firestore.rules` events rule), to `MatchStats.sourceCounts` (`{ tap, text, import }`; `scoutStats.ts` counts it), to the report's source line (`MatchReport.tsx` — "Imported from DataVolley"), and to the timeline icon (`TimelineDrawer.tsx`). Older summaries without `import` count read as 0.

### 5.2 Write sequence
1. `createMatch` (status `setup`) with the `import` field (rules: allowed key, shape-checked, only on create).
2. Events in `writeBatch`es of ≤ 450 docs with client-generated ids (idempotent retries).
3. `finishMatch` with `buildFinishPayload(match, replay(match, events), profile)` — the same path as live scouting, so summary, report, `usageContribution` and the team's `scoutProfile/usage` update together.
4. On failure after step 1: the review screen offers "Retry" (re-sends remaining batches, ids are stable) or "Discard" (deletes the match and its events, like the existing delete-match path).

### 5.3 Limits
`MATCH_EVENTS_CAP = 2000` (live subscription cap). A five-set file yields well under that for our side; if the mapped events exceed 1,900 the import is refused with a message.

### 5.4 Online only
Batch commits resolve only on server acknowledgement; with the persistent cache offline they would hang. The Import button is disabled offline with a hint.

### 5.5 Duplicates
Query `matches where import.fileSha256 == hash limit 1` in the team (single-field index is automatic; no composite needed). Found → warning with a link to the existing match; the coach can still import.

### 5.6 Editing an imported match
Same as any finished match today (no special casing). The report shows the import origin.

## 6. Privacy
- The file never leaves the device; only mapped app data is written.
- Opponent players: nothing stored. Our players' names from the file are shown only on the review screen and never written (the roster snapshot uses the app player's name).
- Free-text from the file (comments, `[3MORE]` referees/arena/scout name) is not stored.

## 7. Legal and naming
- UI label: "Import from DataVolley (.dvw)"; help text adds "Also works with Click&Scout and VolleyStation .dvw exports." and a footnote: "Not affiliated with Data Project or Genius Sports. DataVolley is a trademark of its owner." (nominative use, EU Trademark Regulation Art. 14).
- Independent parser: no decompiling DataVolley, no copying its manuals, no code from `pydatavolley` / `py-datavolley` (no licence = all rights reserved). The openvolley R package is MIT; it is used as a format reference and credited in a code comment; no code is copied.
- The Terms say the club imports only files it is entitled to use (legal design T7, T18).
- Open risk from the research: the Data Project EULA was not found; if it restricts use of exported files, that binds the club, not the operator. Noted for the lawyer list.

## 8. Testing
- **Fixtures**: synthetic `.dvw` files written for the tests (`src/matches/dvw/fixtures/`), with invented names — **no real match files committed** (real files carry minors' names). Cover: a 3-set and a 5-set match; home and away; a windows-1252 file with accented names; a substitution; timeouts; a libero; `$$` lines; a team-level `&` code; a `>ROT` note; an invalid grade; a score mismatch.
- **Unit**: `decodeDvw` (UTF-8, 1252, 1250 fallback); `parseDvw` sections and trailing fields; `parseScoutCode` for every line kind; mapping (§4) per rule, especially §4.4 double-count avoidance and reason inference; score check.
- **Round trip**: fixture → parse → map → `replay` → `buildReportData` gives the expected set scores and per-skill counts.
- **Component**: review screen (team side flip, roster mapping, blocking issues, duplicate warning), import progress and retry.
- **Rules**: `source: 'import'` accepted; `import` field only on create with the right shape; other sources still validated.
- **Manual**: one real DataVolley file from the operator's club, imported on the emulator, compared by eye with the DataVolley report (the operator provides the file locally; it is not committed). It also checks the libero rule in §4.1 against a real file.

## 9. Left to the builder
- Name-similarity heuristic for picking "us".
- Review screen layout within the design system.
- Whether the file-name/date of the match prefill comes from `[3MATCH]` or the file name when they disagree.
