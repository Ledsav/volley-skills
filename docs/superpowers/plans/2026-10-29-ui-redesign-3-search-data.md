# UI Redesign 3: Search Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make exercises and trainings searchable from the ⌘K palette. A derived `searchTokens` field is written on every create and update and backfilled for existing documents, two composite indexes back it, and the palette gains server-side Exercises and Trainings groups.

**Architecture:**
- **Tokens.** One pure JavaScript module derives the tokens. The app, the seed scripts and the backfill all import it, so they always agree. It also becomes the single source of the palette's normalisation.
- **Writes and backfill.** Writes go through `exercisesApi` and `trainingsApi`. The backfill is a pure planner plus an I/O core, like the other migrations.
- **Palette.** It sends the longest typed word to Firestore (`array-contains`), filters the other words locally, and pages with a cursor.

**Tech Stack:** React 18, TypeScript strict, Firestore web SDK and the Admin SDK (scripts), Vitest, Firestore rules and emulator tests (`npm run test:rules`).

**Spec:**
- `docs/superpowers/specs/2026-10-28-ui-redesign-design.md` §6.1 (Search everything: server groups, `searchTokens`, offline, access) and §11 item 3.
- Plan 2 built the local groups. They live in `src/search/` (`SearchPalette.tsx`, `SearchProvider.tsx`, `useSearchData.ts`, `match.ts`, `normalize.ts`, `localSources.ts`, `recents.ts`, `types.ts`).

**Not in this plan:** the AI draft actions in the palette (they stay on the pages) and any visual change outside the palette.

## Global Constraints

- **`searchTokens` content** (spec §6.1):
  - Every prefix of 2–12 characters of each normalised word in the name.
  - For trainings, also the `businessId`'s words with their prefixes, and the whole normalised `businessId`.
  - Deduped, capped at **120** entries.
- **Normalisation:** lower case, Unicode NFD with combining marks stripped (`/\p{M}/gu`). Words are split on `/[^\p{L}\p{N}#]+/u`, the same rule as Plan 2's `words()`. There is exactly one implementation.
- **Server queries:**
  - Exercises: `where('searchTokens','array-contains', token)`, `orderBy('name')`, `limit(20)`.
  - Trainings: the same.
  - "Show more" fetches the next 20 with `startAfter(lastDoc)`.
  - No count query is ever run, and server groups show no total.
- **Choosing the token:**
  - The **longest** typed word is sent, truncated to 12 characters. The other words are filtered on the client.
  - If no typed word has at least 2 characters, no server query runs.
  - Each group shows the first **5** matches.
  - Queries are debounced **300 ms** after the last keystroke.
- **Indexes:** two new composites in `firestore.indexes.json`, each `searchTokens` ARRAY_CONTAINS plus `name` ASCENDING, on `exercises` and on `trainings`, with `queryScope: COLLECTION`.
- **Rules:** none change. The builder confirmed that the exercise and training rules have no key whitelist (`firestore.rules`, the `exercises` and `trainings` matches).
- **Access:**
  - The Exercises group and its query exist only when `access.sections.exercises` is true, and Trainings only when `access.sections.trainings` is true.
  - With the section off, no query is sent.
- **Offline:**
  - When `navigator.onLine` is false, the server groups are not queried.
  - The palette shows the local groups plus the note "Exercises and trainings need a connection" (en) / "Esercizi e allenamenti richiedono una connessione" (it).
- **Scripts in scope** (spec §6.1): `.claude/skills/plan-team-training/scripts/apply.mjs` and `scripts/seed/seedLibrary.mjs`.
  - `scripts/docs/seedShowcase.mjs` only reads trainings, so it is unchanged. This is a ruling, recorded in the ledger.
- **Backfill quotas:** Spark allows 50,000 reads and 20,000 writes a day.
  - The backfill reads each exercise and training once and writes only documents whose tokens are missing or differ.
  - It prints counts only and is idempotent: a second run writes 0.
- **Strings:** every user-facing string goes in both `src/i18n/en` and `src/i18n/it`.
- **Never commit:**
  - `serviceAccountKey.json` (or `.enc`), `*.vsbackup`, private keys, `.env.local` or `reference/`.
  - Don't push or merge, and add no new dependencies.
- **Gates per group:** `npm test`, `npm run lint` (0 errors), `npm run build`. Also `npm run test:rules` for the group that adds the emulator test.
  - Port 8080 is held by the user's dev emulator, so run `test:rules` against a temporary config on another port.
  - Delete that config afterwards and never commit it.

## Review Focus

1. **Multi-word queries.** For "rete attacco", only items containing both a word starting "rete" and one starting "attacco" are shown. The server is asked for "attacco" (the longest word). Pinned in Task 5 by "filters the other words on the client".
2. **Long words.** A query word longer than 12 characters, such as "riscaldamento", still finds "Riscaldamento a coppie" through its 12-character token. Pinned in Task 1 by "a long word is found by its 12-character prefix" and in Task 5 by "truncates the token to 12".
3. **Fast typing.** A slow response for "ser" never replaces the results for "servizio". Pinned in Task 5 by "ignores a stale response".
4. **Renaming.** After an exercise is renamed, its old name no longer finds it and its new name does. Pinned in Task 2 by "update with a new name rewrites the tokens".
5. **No section, no query.** With the trainings section off, typing sends no trainings query. Otherwise the rules would reject it and the console would fill with permission errors. Pinned in Task 6 by "sends no query for a section the person lacks".

---

## File Structure

| File | Responsibility |
|---|---|
| `src/search/searchTokens.js` + `searchTokens.d.ts` (create) | `normalize`, `words`, `searchTokens(name, extra?)`, the single source for app and scripts |
| `src/search/normalize.ts` (modify) | Re-exports `normalize` and `words` from `searchTokens.js` |
| `src/exercises/exercisesApi.ts`, `src/trainings/trainingsApi.ts` (modify) | Write tokens; `searchExercises` and `searchTrainings` queries; `getExercise`, `getTraining` |
| `src/trainings/TrainingBuilderDialog.tsx` (modify) | Passes `businessId` to `updateTraining` |
| `.claude/skills/plan-team-training/scripts/apply.mjs`, `scripts/seed/seedLibrary.mjs` (modify) | Write tokens |
| `firestore.indexes.json` (modify) | Two composites |
| `scripts/migrate/searchTokensPlan.mjs` + `.test.mjs` (create) | Pure planner |
| `scripts/migrate/searchTokensRun.mjs` (create) | I/O core |
| `scripts/migrate/2026-10-search-tokens.mjs` (create) | CLI |
| `tests/rules/searchTokens.rules.test.mjs` (create) | Emulator test of the I/O core |
| `scripts/migrate/README.md` (modify) | Runbook section |
| `src/search/useServerSearch.ts` (create) | Debounced, stale-safe server groups with paging and offline handling |
| `src/search/SearchPalette.tsx` (modify) | Exercises and Trainings groups, "Show more", offline note |
| `src/exercises/ExercisesPage.tsx`, `src/trainings/TrainingsPage.tsx` (modify) | `?exercise=<id>` and `?training=<id>` deep links open the item |

---

### Task 1: searchTokens module

**Files:**
- Create: `src/search/searchTokens.js`, `src/search/searchTokens.d.ts`
- Modify: `src/search/normalize.ts`
- Test: `src/search/searchTokens.test.ts`; `src/search/normalize.test.ts` must stay green unchanged

**Interfaces:**
- Produces (ES module, no TypeScript syntax, importable from Node `.mjs` with `import { searchTokens } from '../../src/search/searchTokens.js'`):
  - `normalize(s: string): string`
  - `words(s: string): string[]`
  - `searchTokens(name: string, extra?: string): string[]`
    - `extra` is the training `businessId`.
    - The output order is each word's prefixes in word order, shortest first. Then come the `extra` words' prefixes and the whole normalised `extra`.
    - The list is deduped and truncated to 120.
    - `#` is dropped from tokens.
  - `MAX_TOKENS = 120`, `MIN_PREFIX = 2`, `MAX_PREFIX = 12`
- `normalize.ts` keeps its exports and becomes `export { normalize, words } from './searchTokens.js'`.

- [ ] **Step 1: Failing tests** in `searchTokens.test.ts`:
  - `it('prefixes each word from 2 to 12 characters')`: `searchTokens('Muro a tre')` equals `['mu','mur','muro','tr','tre']`. The one-letter word "a" gives no token.
  - `it('ignores case and accents')`: `searchTokens('Ricezione Città')` contains `'citta'` and `'ri'`.
  - `it('a long word is found by its 12-character prefix')`: `searchTokens('Riscaldamento')` contains `'riscaldament'` and has no 13-character token.
  - `it('adds the businessId for trainings')`: `searchTokens('Attacco', 'TR-0042')` contains `'tr'`, `'0042'` and `'tr-0042'`.
  - `it('dedupes and caps at 120')`: a name of 30 distinct 12-letter words gives a result of length 120, with no duplicates.
- [ ] **Step 2:** Run `npx vitest run src/search/searchTokens.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Add JSDoc types in the `.js` file and matching declarations in the `.d.ts`.
- [ ] **Step 4:** Run `npx vitest run src/search` and `node -e "import('./src/search/searchTokens.js').then(m=>console.log(m.searchTokens('Muro a tre')))"`. Expected: PASS, and the Node call prints the array.
- [ ] **Step 5: Commit** `feat(search): searchTokens derivation shared by app and scripts`

### Task 2: Write tokens from the app, and read single items

**Files:**
- Modify: `src/exercises/exercisesApi.ts`, `src/trainings/trainingsApi.ts`, `src/trainings/TrainingBuilderDialog.tsx`
- Test: `src/exercises/exercisesApi.test.ts`, `src/trainings/trainingsApi.test.ts` (create them if missing, using the mocking style of `src/teams/teamsApi.test.ts`), plus the existing `TrainingBuilderDialog` tests

**Interfaces:**
- Consumes: `searchTokens` (Task 1).
- Writes:
  - `createExercise` and `bulkCreateExercises` add `searchTokens: searchTokens(name)`.
  - `updateExercise(id, updates)` adds `searchTokens` when `updates.name !== undefined`.
  - `createTraining` and `bulkCreateTrainings` add `searchTokens: searchTokens(name, businessId)`.
  - `updateTraining(trainingId, updates, businessId: string)` gains a required third parameter. When `updates.name !== undefined`, it adds `searchTokens(updates.name, businessId)`. `TrainingBuilderDialog` passes `training.businessId`.
- Produces:
  - `getExercise(id): Promise<Exercise | null>`
  - `getTraining(id): Promise<Training | null>`
  - Both follow the shape of `getTeam`.

- [ ] **Step 1: Failing tests:**
  - `it('create writes searchTokens from the name')` for exercise and for training. For training, assert that the transaction's `set` payload has tokens including the businessId.
  - `it('update with a new name rewrites the tokens')` for exercise and for training.
  - `it('update without a name leaves searchTokens alone')`.
  - `it('bulk create writes tokens for every row')`.
- [ ] **Step 2:** Run `npx vitest run src/exercises src/trainings`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(library): write searchTokens on exercise and training writes`

### Task 3: Scripts and indexes

**Files:**
- Modify: `.claude/skills/plan-team-training/scripts/apply.mjs` (line ~78 exercise `batch.set`, line ~99 training `tx.set`), `scripts/seed/seedLibrary.mjs` (lines ~281 and ~306), `firestore.indexes.json`
- Test: `scripts/seed/seedLibrary` has no test, so verify by running the seed against the emulator (Step 4)

**Interfaces:**
- Consumes: `searchTokens` from `src/search/searchTokens.js`, using a relative import from each script.
- Every exercise those scripts write gets `searchTokens: searchTokens(name)`. Every training gets `searchTokens: searchTokens(name, businessId)`.
- Indexes: add both composites from Global Constraints. Keep the existing entries and their order. Append the new ones.

- [ ] **Step 1:** Edit the scripts and the indexes file.
- [ ] **Step 2:** Run `node --check` on both scripts and `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8'))"`. Expected: no output, exit 0.
- [ ] **Step 3: Commit** `feat(library): searchTokens in seed and coaching scripts; search indexes`
- [ ] **Step 4:** Verify. With a temporary emulator on a free port (never the user's), run `scripts/seed/seed.mjs --emulator --reset` and `seedLibrary.mjs`, pointing `FIRESTORE_EMULATOR_HOST` at that port. Read one seeded exercise and assert it has `searchTokens`. Note the result in the report. If this is impractical, say so and rely on Task 4's emulator test.

### Task 4: Backfill migration

**Files:**
- Create: `scripts/migrate/searchTokensPlan.mjs`, `scripts/migrate/searchTokensPlan.test.mjs`, `scripts/migrate/searchTokensRun.mjs`, `scripts/migrate/2026-10-search-tokens.mjs`, `tests/rules/searchTokens.rules.test.mjs`
- Modify: `scripts/migrate/README.md`

**Interfaces:**
- Pure planner: `planSearchTokens(docs: { path: string; kind: 'exercise' | 'training'; data: object }[]): { path: string; searchTokens: string[] }[]`.
  - It returns an update only where the stored `searchTokens` is missing or differs (order-sensitive equality) from `searchTokens(data.name, kind === 'training' ? data.businessId : undefined)`.
  - It skips docs without a string `name`.
- I/O core: `backfillSearchTokens(db, clubId, { dryRun }): Promise<{ read: number; written: number; skipped: number }>`.
  - It reads `clubs/{clubId}/exercises` and `clubs/{clubId}/trainings` in pages of 300, ordered by document id.
  - It writes updates with `update({ searchTokens })` in batches of at most 450.
  - It writes nothing when `dryRun` is set.
- CLI:
  ```
  node scripts/migrate/2026-10-search-tokens.mjs (--club <id> | --all-clubs) (--emulator | --prod) [--dry-run]
  ```
  - It follows `scripts/ops/purgeClub.mjs`: `flag`, `fail`, `prodDb`/`emulatorDb`, and `refuseEmulatorHost` with `--prod`.
  - It needs `confirmTyped` before a non-dry `--prod` run.
  - `--all-clubs` iterates `clubs` docs whose status is not `deleted`.
  - It prints per-club counts only.

- [ ] **Step 1: Failing planner tests** in `searchTokensPlan.test.mjs`. Run them the way sibling `scripts/migrate/*.test.mjs` run. Check `vite.config.ts`'s test include, and if it doesn't cover them, follow `clubPlatformPlan.test.mjs`'s runner.
  - `it('plans docs with missing tokens')`.
  - `it('skips docs whose tokens already match')`.
  - `it('replans a renamed doc')`.
  - `it('uses businessId for trainings')`.
  - `it('skips docs without a name')`.
- [ ] **Step 2:** Run the planner tests. Expected: FAIL.
- [ ] **Step 3:** Implement the planner, the I/O core and the CLI.
- [ ] **Step 4: Emulator test** in `tests/rules/searchTokens.rules.test.mjs`, using `adminDb`, `put` and `getTestEnv` like `purge.rules.test.mjs`. Seed 3 exercises (one already tokenised) and 2 trainings in `clubs/demo`.
  - `it('backfills missing tokens and reports counts')`: `{ read: 5, written: 4, skipped: 1 }`, and each doc now has the planned tokens.
  - `it('is idempotent')`: a second run reports `written: 0`.
  - `it('dry run writes nothing')`.
- [ ] **Step 5:** Run `npm run test:rules -- searchTokens` on a temporary port. Expected: PASS. Then run the planner tests. Expected: PASS.
- [ ] **Step 6: README.** Add a "Search tokens backfill" section to `scripts/migrate/README.md`. It covers:
  - what it does;
  - the read and write cost (one read per exercise and training, one write per changed doc);
  - dry run first;
  - when to run it: after deploying the indexes, before or with the app deploy;
  - that unbackfilled docs simply don't appear in search.
- [ ] **Step 7: Commit** `feat(migrate): searchTokens backfill for exercises and trainings`

### Task 5: Server search hook

**Files:**
- Modify: `src/exercises/exercisesApi.ts`, `src/trainings/trainingsApi.ts`
- Create: `src/search/useServerSearch.ts`
- Test: `src/search/useServerSearch.test.tsx`, plus the api tests from Task 2

**Interfaces:**
- API functions:
  - `searchExercises(token: string, afterDoc?: QueryDocumentSnapshot | null): Promise<{ items: Exercise[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }>`
  - `searchTrainings(token, afterDoc?)`, with the same shape over `Training`.
  - Both use the exact query from Global Constraints. `hasMore` is true when the page is full (20).
- The hook: `useServerSearch(query: string, enabled: { exercises: boolean; trainings: boolean }): { exercises: ServerGroupState; trainings: ServerGroupState; offline: boolean }`.
  - `ServerGroupState = { items: SearchItem[]; loading: boolean; hasMore: boolean; showMore: () => void }`.
  - `serverToken(query)` picks the longest word of `words(query)` and truncates it to 12. It returns `null` if that word is shorter than 2 characters.
  - The fetch runs 300 ms after `query` stops changing, for each enabled group, when the token is non-null and the browser is online.
  - Each response is filtered on the client with `matchRank(query, item) !== null` (Plan 2's `match.ts`). The first 5 are shown.
  - `showMore` fetches the next page with the stored `lastDoc` and appends the matching items.
  - A request id per group drops stale responses.
  - Errors leave the group empty with `loading: false` and call `console.error`. They never throw.
  - `offline` tracks `navigator.onLine` plus the `online` and `offline` window events.
  - Item shapes:
    - **Exercise:** `{ id, group: 'exercises', label: name, sublabel: category label from the exercises i18n, to: '/exercises?exercise=' + id }`.
    - **Training:** `{ id, group: 'trainings', label: name, sublabel: businessId, keywords: [businessId], to: '/trainings?training=' + id }`.

- [ ] **Step 1: Failing tests** (mock the api functions, fake timers):
  - `it('waits 300 ms after the last keystroke')`.
  - `it('sends the longest word and filters the other words on the client')`: the query "rete attacco" sends `'attacco'`, and a returned "Attacco in diagonale" without "rete" is dropped.
  - `it('truncates the token to 12')`.
  - `it('sends nothing below 2 characters')`.
  - `it('ignores a stale response')`.
  - `it('show more appends the next page using the cursor')`.
  - `it('sends nothing while offline and reports offline')`.
  - `it('a failed query leaves the group empty')`.
- [ ] **Step 2:** Run `npx vitest run src/search/useServerSearch.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(search): debounced server search for exercises and trainings`

### Task 6: Palette groups and deep links

**Files:**
- Modify: `src/search/SearchPalette.tsx`, `src/search/types.ts` (if needed), the i18n `search` strings (en and it), `src/exercises/ExercisesPage.tsx`, `src/trainings/TrainingsPage.tsx`
- Test: `src/search/SearchPalette.test.tsx`, `src/exercises/ExercisesPage.test.tsx`, `src/trainings/TrainingsPage.test.tsx`

**Interfaces:**
- Consumes: `useServerSearch` (Task 5), `useAuth().access`, and `getExercise`/`getTraining` (Task 2).
- Palette groups:
  - Exercises and Trainings follow Matches. Labels are "Exercises" / "Esercizi" and "Trainings" / "Allenamenti".
  - `enabled = { exercises: !!access?.sections.exercises, trainings: !!access?.sections.trainings }`.
  - While a server group is loading and empty, it shows 2 skeleton rows.
  - When `hasMore`, a final "Show more" / "Mostra altri" `role="option"` row calls `showMore`. It works like Plan 2's "Show all N" row but shows no count.
  - When `offline` and the query is non-empty, the note "Exercises and trainings need a connection" (en) / "Esercizi e allenamenti richiedono una connessione" (it) appears under the local groups. It has `role="note"`.
  - "No results" counts server matches too. It must not flash while a server group is still loading: show the skeletons instead.
  - The live "N results" announcement includes the server matches shown.
- Deep links:
  - `ExercisesPage`: `?exercise=<id>` loads `getExercise(id)` once and opens `setDialog({ mode: 'edit', exercise })`, the same dialog a row click opens. It then removes the param with `setSearchParams(..., { replace: true })`. An unknown id shows nothing and logs nothing user-facing.
  - `TrainingsPage`: `?training=<id>` does the same with `getTraining(id)` and opens `{ mode: 'view', training }`. The existing `?businessId` and `?team`/`?session` behaviour is unchanged.

- [ ] **Step 1: Failing tests:**
  - `SearchPalette.test.tsx`, with `useServerSearch` mocked:
    - `it('shows exercises and trainings groups after matches')`.
    - `it('sends no query for a section the person lacks')`: `useServerSearch` is called with `trainings: false`.
    - `it('show more is a keyboard-reachable option')`.
    - `it('shows the offline note')`.
    - `it('does not flash no results while server groups load')`.
  - `ExercisesPage.test.tsx`: `it('opens the exercise from ?exercise=')`.
  - `TrainingsPage.test.tsx`: `it('opens the training from ?training=')`.
- [ ] **Step 2:** Run `npx vitest run src/search src/exercises src/trainings`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(search): exercises and trainings in the palette`

### Task 7: Carried-over fixes, gate and checklist

**Files:**
- Modify: `src/search/SearchPalette.tsx` (same-route focus), `src/auth/useSignOut.test.tsx`
- Test: as listed

These are Plan 2 parked minors (ledger):
- Opening a palette result whose URL is the current location must still move focus to the page's `h1`, like a route change. Use the same approach as the shell's same-route handling in `AppShell.tsx`. Test: `it('same-route result focuses the page heading')`.
- `useSignOut` calls `clearSearchData()` and `clearRecents()`. Pin both with a test: `it('sign-out clears the search cache and recents')`.

- [ ] **Step 1:** Write the failing tests, then implement, then run `npx vitest run src/search src/auth`. Expected: PASS.
- [ ] **Step 2: Commit** `fix(search): same-route focus and sign-out cache test`
- [ ] **Step 3: Gate.** Run `npm test`, `npm run lint`, `npm run build`, and `npm run test:rules` (temporary port). Expected: all green. Rerun flaky load-timeout files (Italian smoke, PlayerCard, MatchPage/ScoutPage "Finish match") alone and report both results.
- [ ] **Step 4: Visual checklist for the user** in the group report:
  1. Run the backfill on the emulator: `node scripts/migrate/2026-10-search-tokens.mjs --club demo --emulator`. It should print counts. Then run it again and it should write 0.
  2. Ctrl+K "pass" finds exercises; "TR-0001" finds a training.
  3. A two-word query narrows the results.
  4. "Show more" appears on a long list.
  5. Offline (DevTools → Network → Offline): local groups plus the connection note.
  6. A member without the trainings section sees no Trainings group.
  7. Opening an exercise or training result opens its sheet.
  8. Before the production deploy, the user deploys the indexes (`firebase deploy --only firestore:indexes`), then runs the backfill dry run, then the backfill. This is listed for the cleanup increment.
