# Volley Skills App — Match Scouting Design

Date: 2026-10-13
Status: Draft — awaiting user review
Branch: `feature/scouting`
Companion to: `2026-09-04-volley-skills-app-design.md` (data model, fetching rules, compliance), `2026-09-04-volley-skills-design-system.md` (tokens, components), `2026-09-11-volley-skills-access-model.md` (team admin access)

## 1. Purpose and success criteria

A team-scoped **match scouting** feature: create a match (date, opponent, roster), scout it live
from a phone or PC, and get a post-match report.

Priorities, in order (agreed with the user):

1. **Live use during the match** — see who is struggling *now* to decide subs and timeouts.
   Tap speed and staying in sync with the real game are the dominant constraints.
2. **Post-match review** — per-player × per-fundamental report for team talks.

Success looks like: one person can scout a full youth match on a phone, one-handed, typically
**2 taps per action**, recover from a missed rally in seconds, never lose data to a bad gym
connection, and walk out with a report.

Two input modes share one event format:

- **Court mode (tap)** — the primary mode.
- **Text mode** — free text parsed by an AI model (provider chosen by the user; Groq by default,
  see §4.8) into the same events, mixable inside a match, with a reconciliation preview before
  merge.

## 2. Decisions log

| # | Decision | Choice |
|---|---|---|
| D1 | Grading scale | Full DataVolley `# + ! - / =` with per-fundamental labels; invalid grades hidden |
| D2 | Opponent tracking | Our team only + "Point us / Point them" rally buttons with optional reason |
| D3 | Sync model | Rally engine auto-advances score/rotation; undo, point-without-stat, rotation/score correction, editable timeline |
| D4 | Subs / libero | Automatic libero swap (up to 2 liberos, each mode `receiving`/`serving`/`always`) + manual subs via long-press; bench strip as a credit-anyone fallback |
| D5 | Action ordering | History seeds a player's ordering only until that player has actions in the current match; then current-match counts only. History averages recomputed at Finish |
| D6 | Connectivity | Local-first: Firestore persistent cache, writes queue offline, "synced / N pending" indicator |
| D7 | Access | Team admins + superadmins only (scout and read). No guardian/viewer access |
| D8 | AI provider + key | Provider-agnostic OpenAI-compatible client. Provider (Groq default, OpenRouter, Local, Custom), model and key per user, stored only in that browser's `localStorage`; never in Firestore. Gemini free tier rejected (see §4.8) |
| D9 | Text mode | Mixable with taps in the same match, anchored insert + replay preview + merge |
| D10 | Architecture | Event log; all state derived by pure replay |
| D11 | Input layout | Tap player → bottom sheet (fundamental chips + 6-grade grid); first chip = next expected fundamental |
| D12 | Live stats | Desktop: side table; phone: Court / Live / Timeline tabs + red/green dots on court tiles |
| D13 | Extras in scope | Calendar linking, substitution limits, timeout tracking |

Verified: Groq's API answers CORS preflight with `access-control-allow-origin: *` and allows
`authorization, content-type` — direct browser calls work (checked 2026-10-13). OpenRouter
(`*`) and Gemini's OpenAI-compatible endpoint (origin echoed) also pass preflight (checked
2026-10-14).

## 3. Grading vocabulary

Fundamentals (`Skill`): `S` serve, `R` reception, `A` attack, `B` block, `D` dig, `E` set,
`F` free ball. Grades (`Grade`): `#` `+` `!` `-` `/` `=`.

| Skill | `#` | `+` | `!` | `-` | `/` | `=` |
|---|---|---|---|---|---|---|
| S | Ace | Pressure (opp out of system) | — | Easy (opp in system) | Free back | Error |
| R | Perfect | Good | OK (limited options) | Poor (high ball only) | Overpass | Aced / error |
| A | Kill | Good (advantage kept) | Covered (blocked, covered) | Easy dig | Blocked (point lost) | Error |
| B | Stuff | Touch, ours | — | Touch, theirs | Tooled | Net / error |
| D | Perfect | Good | OK | Poor | Overpass | Error |
| E | Perfect | Good | OK | Poor | — | Error |
| F | Perfect | Good | OK | Poor | Overpass | Error |

"—" = grade not offered for that skill (button hidden). Labels and valid grades live in
`src/matches/skillGrades.ts`.

**Rally-ending grades (derived, never stored):**

- Point **us**: `S#`, `A#`, `B#`.
- Point **them**: any `=`, plus `A/`, `B/`.
- Every other action continues the rally.

## 4. User flows and screens

### 4.1 Team page → Matches tab

New team tab **Matches**, visible to team admins and superadmins. Lists matches `orderBy('date',
'desc').limit(N)` with cursor paging. Row: date, opponent, result (`3–1`), status chip
(`Setup` / `Live` / `Finished`); a live match shows **Resume**. "+ New match" opens the setup form.

### 4.2 New match (setup)

Single screen:

- Date, opponent, competition (`league` / `cup` / `friendly` / `tournament`), home/away.
- Format: best of 3 / 5; set points (default 25); deciding-set points (default 15); subs per set
  (default 6); timeouts per set (default 2). All editable (youth tournaments vary).
- Match roster: checkboxes over the team's players, all ticked by default. Jersey number
  pre-filled from the player's profile, overridable for this match only.
- Liberos: up to 2; each has a mode (`receiving` / `serving` / `always`) and `replaces`
  (default: the roster's `MB` players).

### 4.3 Set start

Per set: assign 6 roster players to P1–P6 (set 1 pre-filled from `starting` players, later sets
from the previous set's starting lineup) and pick who serves first. "Start set" writes a
`setStart` event and opens the scouting screen.

### 4.4 Scouting screen (`/teams/:teamId/matches/:matchId/scout`)

Lazy-loaded, full-screen on phones (no app nav).

- **Header:** score, set number + sets won, serve/receive indicator, rotation `P1`–`P6`,
  subs used (`Subs 3/6`), timeouts remaining (`T/O ●●` vs `●○`), sync status
  (`✓ synced` / `⟳ N pending`). Score and rotation are tappable for manual correction.
- **Court:** 3×2 grid of player tiles (front row nearest the net), libero tile highlighted with
  its mode. Red/green dot per tile from live alerts. Rotation arrows (◀ ▶) for correction.
  **Long-press a tile** → substitute from bench.
- **Bench strip:** every non-court roster player, tappable to credit an action to someone the app
  doesn't show on court (raises a non-blocking warning).
- **Action sheet** (after tapping a player): player name/number, fundamental chips ordered by
  §6.2, grade grid of the valid grades for the selected chip with per-skill labels. The first
  chip is pre-selected, so the common case is **player → grade**. Sheet closes after the grade.
- **Rally buttons:** "Point us" / "Point them", each with an optional reason
  (`oppError`, `oppKill`, `oppAce`, `oppBlock`, `unknown`).
- **Timeout buttons:** "T/O us" / "T/O them".
- **Footer:** ↶ Undo, ☰ Timeline, ✎ Text.
- **Set end:** when `setPointReached`, prompt "Set won 25–21?" → confirm writes `setEnd`;
  "not yet" lets the user correct first. Next set → set-start dialog. On `matchOver`, prompt
  Finish.
- **Device lock:** opening a live match whose `activeDevice` is another device seen within the
  last 2 minutes shows "Being scouted on another device — take over?". The active device
  refreshes `activeDevice.at` at most once a minute while scouting.

**Phone:** tabs **Court / Live / Timeline**. **Desktop (≥ lg):** court + sheet on the left, live
stats table on the right, timeline as a side drawer.

### 4.5 Live stats

Scope toggle: this set / match.

- Per-player row: per-fundamental attempts with key grade counts, points / errors, trend bar.
- Team row: side-out %, break-point %, reception positivity, opponent errors, weakest rotation.
- Alerts (banner on Live tab + red dot on tile): a player with ≥ 3 errors in the current set;
  opponent run ≥ 3 consecutive points ("Opp run 0–4 — timeout?").
- Tap a player row → per-fundamental breakdown.

### 4.6 Undo and timeline

- **Undo** deletes the last event (by `order`). If it belongs to a text chunk, confirm
  "Undo whole text batch (N events)?" and delete the chunk.
- **Timeline** groups events by set, then rally, with the score after each rally
  (`12–10 · R+ #6 → E# #2 → A# #7`). Text-sourced events marked ✎, warnings ⚠.
  Tap an event to edit player / skill / grade; delete; **"Insert rally here"** sets the insert
  anchor for the next taps or text batch (cleared after one rally / merge, or by "Back to live").
- Edits update or delete event docs; replay recomputes everything after.

### 4.7 Text mode

1. ✎ Text opens the panel showing its anchor (default: end of timeline; or the "Insert rally
   here" anchor), e.g. "Inserting after 12–10, P3, we serve".
2. Free text, any language. Collapsible shorthand cheat sheet (not required). While the panel
   has focus, scouting hotkeys and auto-select are suspended.
3. Draft autosaved to `localStorage` per match (survives offline / reload).
4. **Process** (disabled offline, or with no provider configured):
   - Local privacy pass: replace roster player names (full and first name, accent- and
     case-insensitive) with `#number`.
   - `POST {baseUrl}/chat/completions` of the configured provider (§4.8) with the user's key
     (none for Local), a system prompt describing the vocabulary (§3), the roster as
     `{ number, role, isLibero }` only — `role` = the current set's role (per-set `roles`) —,
     the anchor state (set, score, serving, rotation, on-court numbers), and the output
     contract `{ rallies: [{ actions: [{ number, skill, grade }], point?: { winner, reason },
       subs?: [{ outNumber, inNumber }], timeouts?: [{ team }] }], unparsed: [string] }`.
     Request JSON output via `response_format: { type: 'json_object' }` (widely supported on
     OpenAI-compatible endpoints; retried once without it if the provider rejects the field);
     the response is always validated locally against the contract — never trusted.
   - Text longer than a threshold is split by line into chunks processed sequentially
     (stay under per-minute token limits).
   - Point reasons map to `PointReason` (unknown → `null`, matching one-tap points).
5. **Preview:** editable rows (number / skill / grade dropdowns, delete row, add "point us/them")
   grouped by rally, with a live replay from the anchor ("12–10 → 17–13 · P4 · we serve").
   Highlighted: `unparsed` lines, rallies with no derivable winner, unknown jersey numbers.
   Optional "Actual score" field: on mismatch, highlights rallies without a winner as the
   likely gap. If tap events exist after the anchor, the preview shows them replayed on top,
   with conflicts flagged.
6. **Merge:** disabled while blocking errors exist (unknown number, invalid skill/grade).
   Writes events with `order` values strictly between the anchor event and the next event,
   `source: 'text'`, shared `chunkId`.

Errors: no provider/key → link to Settings; 401/403 → "Key rejected"; 429 → "<Provider> rate
limit — retry in Ns" (from `retry-after` when present; draft kept); invalid JSON / contract
mismatch → one automatic retry, then "Couldn't parse — edit the text or enter by taps";
network failure / local server unreachable → draft kept, with a hint for Local ("Is Ollama /
LM Studio running and allowing this site?").

### 4.8 Settings — AI provider

A "Text scouting (AI)" section in the existing Settings page, persisted only in `localStorage`
(wrapped in try/catch, never Firestore):

| Field | Notes |
|---|---|
| Provider | `Groq` (default) · `OpenRouter` · `Local (Ollama / LM Studio)` · `Custom` |
| Base URL | Pre-filled per provider (`https://api.groq.com/openai/v1`, `https://openrouter.ai/api/v1`, `http://localhost:11434/v1`); editable only for Local/Custom |
| API key | Masked; not required for Local |
| Model | Free text with a per-provider default (Groq: a current free-tier model such as `openai/gpt-oss-120b`; Local: `qwen2.5:7b-instruct`); defaults verified when the plan is written |
| Test connection | Sends a tiny prompt; shows OK / rejected key / unreachable / rate-limited |

**Provider decision (2026-10-14):**
- **Groq — default.** Free tier; by default does not retain inference data and offers Zero
  Data Retention in its Data Controls (Settings copy recommends enabling it); browser CORS OK.
- **OpenRouter — alternative.** Many free models, but data handling depends on the routed
  provider; Settings copy says so.
- **Local (Ollama / LM Studio) — most private.** Free and unlimited; nothing leaves the
  laptop; needs a one-time CORS allowance (`OLLAMA_ORIGINS` / LM Studio "Enable CORS").
  Laptop use, not phones.
- **Gemini free tier — rejected.** Its terms allow only paid services for apps offered to EEA
  users (the club is in Belgium), use unpaid-tier content to improve Google products with
  human review, and say not to send personal information.

Copy explains: the key stays on this device; limits are per provider account; only jersey
numbers, roles, score and the name-stripped text are sent.

### 4.9 Calendar linking

`CalendarSession` (training-only) is unchanged. The team calendar additionally queries
`matches` where `date` is within the visible month (same bounded range pattern) and renders
them as distinct match chips (opponent + result). Tapping opens the match page. Each day offers
"+ Match", opening the setup form with the date pre-filled. Match chips are visible wherever the
calendar is (calendar visibility rules unchanged).

### 4.10 Match page and report (`/teams/:teamId/matches/:matchId`)

- `setup` → setup form; `live` → "Resume scouting" banner + live report; `finished` → report.
- **Report** (match doc + its events, replayed in memory):
  1. Result header — opponent, date, sets, set scores.
  2. Team KPIs — side-out %, break-point %, reception positivity, attack efficiency, serve aces
     vs errors, points from opponent errors.
  3. Player table — grade distribution per fundamental (stacked bar `#`→`=`), efficiencies,
     points / errors; tap to expand.
  4. Rotation table — +/− per rotation, weakest highlighted.
  5. Timeout effects — each timeout with the run in the following 5 rallies.
  6. Set filter (All / S1 / S2 …); source note ("82% tap, 18% text").
- Mobile-first; wide tables scroll inside their card. `@media print` styles for save-as-PDF.
- **Finish match:** store `summary`, update `scoutProfile/usage`, set `status: 'finished'`.
  **Reopen for editing** sets `status: 'live'`; finishing again recomputes both (usage is
  recomputed by replacing this match's previous contribution — see §5.3).

## 5. Data model

### 5.1 Documents

```
teams/{teamId}/matches/{matchId}
  date: string                      // "YYYY-MM-DD"
  opponent: string
  competition: 'league' | 'cup' | 'friendly' | 'tournament'
  homeAway: 'home' | 'away'
  format: { bestOf: 3 | 5, setPoints: number, decidingSetPoints: number,
            subsPerSet: number, timeoutsPerSet: number }
  roster: [{ playerId, number, name, positionCategory }]   // snapshot at match time
  liberos: [{ playerId, mode: 'receiving' | 'serving' | 'always', replaces: string[] }]
  status: 'setup' | 'live' | 'finished'
  result: { setsUs: number, setsThem: number, sets: [{ us: number, them: number }] }
  summary: MatchSummary | null       // written at Finish
  usageContribution: { [playerId]: { [skill]: number } } | null  // per-skill action counts this match, written at Finish
  activeDevice: { id: string, at: Timestamp } | null
  createdBy, createdAt, updatedAt

teams/{teamId}/matches/{matchId}/events/{eventId}
  order: number                      // sort key; inserts use the midpoint of neighbours
  type: 'setStart' | 'action' | 'point' | 'sub' | 'timeout' | 'correction' | 'setEnd'
  source: 'tap' | 'text' | 'correction'
  chunkId: string | null
  createdBy, createdAt
  // payload by type:
  setStart   { set: number, lineup: string[6] /* P1..P6 playerIds */, serving: 'us' | 'them' }
  action     { playerId, skill: Skill, grade: Grade }
  point      { winner: 'us' | 'them', reason: PointReason | null }
  sub        { outPlayerId, inPlayerId }
  timeout    { team: 'us' | 'them' }
  correction { score?: { us, them }, rotation?: 1..6, serving?: 'us' | 'them' }
  setEnd     { set: number }

teams/{teamId}/scoutProfile/usage
  players: { [playerId]: { matches: number, totals: { [skill]: number } } }
```

Event ids are client-generated (`doc()`), so writes are idempotent under offline replay.
`order` for appended events = last order + 1; for inserts = midpoint of the neighbours.

`result` is kept current while live (written on `setEnd` and Finish) so the list and calendar
never need to replay.

### 5.2 Offline and sync

`src/firebase/config.ts` switches from `getFirestore(app)` to
`initializeFirestore(app, { localCache: persistentLocalCache({ tabManager:
persistentMultipleTabManager() }) })` (emulator wiring unchanged). This makes offline writes
durable across reloads app-wide. The scout screen listens with `onSnapshot(..., {
includeMetadataChanges: true })` on the events query and derives the pending count from
`hasPendingWrites`.

### 5.3 Usage history

At Finish, compute per-player per-skill action counts for the match and write them to the match
doc as `usageContribution`. In the same batch, update `scoutProfile/usage`: subtract this match's
previous `usageContribution` (if re-finishing) and add the new one; adjust `matches`. Averages
are `totals[skill] / matches`, computed client-side.

### 5.4 Security rules

New blocks under `match /teams/{teamId}`, using the same `isTeamAdmin()` helper shape as
`calendar`:

- `matches/{matchId}`: read/create/update/delete if `isTeamAdmin()`. Create requires
  `createdBy == request.auth.uid`, `date is string`, `status in ['setup','live','finished']`.
  Update requires `status` stay in the same set.
- `matches/{matchId}/events/{eventId}`: read/create/update/delete if `isTeamAdmin()`. Create
  and update require `type` in the 7 types, `order is number`, `source` in the 3 sources; for
  `type == 'action'`, `skill` in the 7 skills and `grade` in the 6 grades.
- `scoutProfile/{docId}`: read/write if `isTeamAdmin()`.

Covered by `tests/rules/matches.rules.test.ts`: team admin allowed; superadmin allowed; admin of
another team denied; plain member denied; unauthenticated denied; invalid grade / skill / type
denied; scoutProfile same matrix.

### 5.5 Indexes

`matches` by `date` (desc for the list, range for the calendar) and `events` by `order` are
single-field — no composite index needed. Add explicit entries only if the emulator/console
asks.

## 6. Pure logic

### 6.1 `scoutEngine.ts` — `replay(match, events) → MatchState`

`MatchState`: `set`, `score {us, them}`, `serving`, `rotation` (1–6), `lineup` (P1..P6 base
players), `court` (P1..P6 with libero applied), `currentRally` (actions so far), `setsWon`,
`setScores`, `subsUsed`, `timeoutsUsed {us, them}`, `setPointReached`, `matchOver`,
`rallies` (closed rallies with winner, serving side, rotation, score after — feeds stats),
`warnings[]` (each tied to an event id).

Rules:

- **Rally end:** per §3; a `point` event always ends the rally.
- **Rotation:** we win a rally we received → rotate (each player moves P(n) → P(n−1), P1 → P6)
  and we serve. We lose while serving → they serve. Other outcomes keep rotation.
- **Libero:** after every rally end, set start, sub, and correction: pick the active libero
  (`always`, else the one matching current `serving` → `serving` mode / receiving →
  `receiving` mode); place them in the back-row position (P1, P5, P6) of a player they
  `replace`; never in P1 when we serve (the replaced player returns to serve). Derived only.
- **Subs:** swap in `lineup`; count per set; warn when over `subsPerSet`, or when a starter
  re-enters for a player other than the one who replaced them.
- **Timeouts:** count per team per set; warn over `timeoutsPerSet`.
- **Set end:** `setPointReached` when a side has ≥ target (set or deciding-set points) and a
  ≥ 2-point lead; confirmed by `setEnd`. `matchOver` when a side has won `ceil(bestOf/2)` sets.
- **Corrections** override score / rotation / serving at their position.
- **Warnings (never blocking):** sub limit, illegal re-entry, action by off-court player,
  timeout limit, closed rally without derivable winner (text imports), action before any
  `setStart`.

### 6.2 `nextActions.ts`

- **Expected next skill** from the current rally: no actions yet → `S` if serving, `R` if
  receiving; after `R` → `E`; after `E` → `A`; after non-ending `A` or `S` → `B`, then `D`;
  after `D` → `E`; after `F` → `E`.
- **Chip order** for a player: expected skill first, then that player's other skills ranked by
  current-match counts if the player has ≥ 1 action this match, else by history averages
  (`scoutProfile/usage`), else by position default (`S`: E,S,D,B,A · `L`: R,D,F,E · `MB`: B,A,S,D
  · `OH`: R,A,S,D,B · `O`: A,B,S,D · other: S,R,A,B,D,E), then remaining skills.
- Libero chips exclude `S`, `A` and `B`.

### 6.3 `scoutStats.ts` — `computeStats(state, scope: { set?: number })`

- Per player × skill: grade counts, attempts, points (`S#`, `A#`, `B#`), errors (`=`,
  `A/`, `B/`).
- Attack efficiency `(# − = − /) / attempts`; serve efficiency `(# − =) / attempts`;
  reception positivity `(# + +) / attempts`, perfect `# / attempts`.
- Team: side-out % (receiving rallies won), break-point % (serving rallies won), opponent-error
  points (`point` with `reason: 'oppError'`), +/− per rotation, weakest rotation.
- Alerts: player errors ≥ 3 in current set; opponent run ≥ 3.
- Timeout effect: rallies won/lost in the 5 rallies after each timeout.
- `MatchSummary` = `computeStats(state, {})` serialized.

### 6.4 Text mode logic (`text/textScout.ts`)

Name → number substitution; response schema validation; mapping parsed rallies to events
(number → playerId via roster snapshot, appending a `point` event when a rally has an explicit
winner not implied by its last action); order assignment for inserts.

## 7. File layout

```
src/types/match.ts                    Match, MatchEvent, Skill, Grade, MatchFormat, MatchSummary …
src/matches/
  matchesApi.ts                       matches / events / usage reads & writes (only Firestore module)
  skillGrades.ts                      labels + valid grades per skill, rally-ending rules
  scoutEngine.ts (+ .test)            replay → MatchState
  nextActions.ts (+ .test)            chip ordering
  scoutStats.ts (+ .test)             stats, alerts, timeout effects
  TeamMatchesTab.tsx (+ .test)        list + "New match"
  MatchSetupForm.tsx (+ .test)        setup
  SetStartDialog.tsx                  lineup + first serve
  MatchPage.tsx                       setup / live / report switch
  report/MatchReport.tsx …            report sections
  scout/ScoutPage.tsx                 lazy route; header, court, bench, rally & timeout buttons
  scout/ActionSheet.tsx (+ .test)     chips + grade grid
  scout/LiveStatsPanel.tsx
  scout/TimelineDrawer.tsx
  scout/useMatchEvents.ts             snapshot listener, pending count, device lock
  text/TextScoutPanel.tsx (+ .test)   draft, process, preview, merge
  text/aiClient.ts                    OpenAI-compatible fetch wrapper (fakeable)
  text/aiSettings.ts                  provider presets + localStorage read/write
  text/textScout.ts (+ .test)         see §6.4
src/settings/                         + AI provider, base URL, key, model, Test connection
src/calendar/                         + match chips, "+ Match"
src/teams/TeamPage.tsx                + Matches tab
src/App.tsx                           + match routes
src/firebase/config.ts                persistent local cache
firestore.rules, firestore.indexes.json, tests/rules/matches.rules.test.ts
scripts/seed                          + one finished demo match
```

## 8. Testing

Priority per CLAUDE.md:

1. **Rules tests** — §5.4 matrix.
2. **Engine** (table-driven rally sequences): side-out rotation; serving run; libero in/out
   with one and two liberos; libero never serves; subs + limit + illegal re-entry warnings;
   timeouts; set end at 25–23 and 26–24, deciding set to 15; match over; undo (delete last);
   mid-log insert then replay; corrections.
3. **nextActions / scoutStats / textScout** — pure unit tests.
4. **Components** — ActionSheet (chip order, hidden grades, grade tap emits event),
   MatchSetupForm (roster, liberos), TextScoutPanel (fake AI client → preview → edit row → replayed
   score updates → merge emits ordered events).

## 9. Compliance

- Match data is team-admin-only (no guardian/viewer path).
- The AI provider receives only jersey numbers, per-set roles, libero flags, anchor state and
  the user's text after the name→number pass. The Settings copy notes that free text should not
  contain other personal data. Providers whose free terms forbid EEA use or train on free-tier
  content (Gemini free tier) are not offered.
- No analytics; the key never leaves the device except in the `Authorization` header to the
  configured provider.

## 10. Delivery

One spec, two implementation plans:

- **Plan A — Court scouting:** types + engine + stats; rules + API; persistent cache; Matches
  tab + setup + set start; scouting screen; live stats; undo + timeline; subs + timeouts;
  finish + usage; report; calendar linking; seed. Usable on its own.
- **Plan B — Text scouting:** AI provider settings + Test connection; aiClient; textScout;
  TextScoutPanel with preview / reconciliation / merge; chunk undo; hotkey/auto-select
  suspension while typing.

## 11. Out of scope

Opponent player-level scouting; opponent rotation tracking; season trends across matches;
CSV / DataVolley export; guardian or player access to match data; a dedicated "scout" role;
multi-device simultaneous scouting of the same match; copy-paste "no key" text fallback.
