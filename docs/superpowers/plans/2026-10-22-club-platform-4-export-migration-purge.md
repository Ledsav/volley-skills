# Club platform — Plan 4: export, migration, purge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Club admins can download all their club's data as one ZIP. The current production club can be moved under `clubs/{clubId}` by a rehearsed, resumable script. The operator can purge an ended club down to a tombstone. Once this plan is done, the branch is deployable.

**Architecture:**
- **Export:** runs in the browser. A loader reads every club collection with the paged `readAll` and calls `onProgress`. A pure builder turns the data into a `path → text` file map, and `fflate` zips it.
- **Scripts:** migration, legacy drop and purge are Admin SDK scripts, each a thin CLI around a pure planner (unit-tested) and an I/O core (tested against the Firestore emulator in `tests/rules/`).
- **Old offline caches:** a one-time `vcb.schemaVersion` check clears the persistent Firestore cache before the app renders.

**Tech Stack:** React 18 + TS, Vitest + Testing Library, Firebase JS SDK 12, firebase-admin 13 (scripts), `fflate` (new, ZIP), Firestore emulator via `firebase emulators:exec`.

**Spec:** `docs/superpowers/specs/2026-10-20-volley-skills-club-platform-design.md`. Sections: §7.2 (export), §7.3 (export in the restricted area), §7.4 (purge), §9 (migration, steps 1–7), §10 (testing). Plans 1–2 are built on `feature/club-platform`. Plan 3 (sign-up and legal acceptance) is not built yet; nothing here depends on it.

## Global Constraints

- **Spark plan, no Cloud Functions.** All authorization lives in `firestore.rules`. This plan changes no rules.
  - If a rules test here shows the export cannot read something, change the export (for example `get` instead of a list). Never widen the rules.
- **Rules test port.** Run the rules suite on an alternate emulator port (e.g. 8181) when 8080 is taken. Never stop a running dev emulator, which holds 8080.
- **Emails** are stored and compared lowercased everywhere (`members/{email}` ids, `adminEmails`, `viewerEmails`, `ownerEmail`).
- **Script logs** print ids and counts only, never player or guardian field values. This matches `exportProdPlayers.mjs`.
- **Production writes** need the gitignored `serviceAccountKey.json`, an explicit `--prod` and a typed confirmation.
  - A script that reads production must refuse to run while `FIRESTORE_EMULATOR_HOST` is set, as `exportProdPlayers.mjs` does.
- **Fetching discipline:** the export reads every collection through `readAll` (`src/firebase/readAll.ts`, id-ordered pages, no index needed). It never does one unbounded read.
- **Export:** free, self-service, `exporter()` only (club admin; status `active`, `suspended`, or `terminating` before `retrievalEndsAt`).
  - Timestamps are ISO strings (`toExportable`). ZIP paths use document ids, never names.
- **Copy and UI:**
  - Success goes through `useNotify()`; errors stay inline with `role="alert"`.
  - No `dark:` variants. Icons come from `lucide-react`.
  - No third-party analytics.
- **TypeScript:** `strict` + `noUnusedLocals`/`noUnusedParameters`.
- **Tests:** they sit next to the code. Scripts' pure tests are `*.test.mjs`, which the default `npm test` picks up. Emulator tests go in `tests/rules/*.test.ts`.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `serviceAccountKey.json`, `.env.local` or `reference/`.

## Review Focus

1. **A club with nothing in it.** Expect a valid ZIP with README, club, members and `null` guide files, and no `teams/` folder. Pinned in Task 2, "an empty club still builds".
2. **The retrieval window closes while the Export tab is open.** The read fails, so expect an inline error and no partial download. Pinned in Task 3, "a failed load downloads nothing".
3. **The same person under different casing in several lists.** For example `Coach@x.com` in `adminAllowlist` and `coach@x.com` in `viewerEmails`: expect one member doc, and admin wins. Pinned in Task 5.
4. **A migration stopped by the daily write quota, then re-run.** `--resume` writes only the missing docs and the final counts match. Pinned in Task 6, "resume writes only what is missing".
5. **The cache reset when another tab holds the cache, or storage is blocked.** Expect no reload loop, no thrown error, and the app still renders. Pinned in Task 4.

---

### Task 1: Rules test — everything the export reads is readable by an exporter

No rules change is expected. This pins the boundary the export relies on.

**Files:**
- Create: `tests/rules/export.rules.test.ts`

**Interfaces:**
- Consumes:
  - `getTestEnv`, `seedClub`, `seedClubTree(env, clubId, teamId, teamAdmins)`, `clubTreePaths` and `dbAs` from `tests/rules/testEnv.ts`.
  - The compat API: `firebase.firestore.FieldPath.documentId()`.
- Produces: the list of export reads, which Task 3's loader must match:
  - **Collection lists** (`orderBy(documentId()).limit(200)`) on `members`, `acceptances`, `statusLog`, `teams`, and per team `players`, `players/{p}/physicalTests`, `calendar`, `testingSessions`, `testingSessions/{s}/entries`, `matches`, `matches/{m}/events`, `awards` and `scoutProfile`. Also `exercises`, `exercises/{x}/diagrams`, `trainings`, `counters` and `sectionAccess`.
  - **Single `get`s:** the club doc, `config/skillGuide` and `config/physicalTestGuide`. A `config` list cannot pass, because its rule names the doc id.

- [ ] **Step 1: Write the test**

`describe.each` over three states: `active`, `suspended`, and `terminating` with `effectiveAt` 1 day ago and `retrievalEndsAt` in 29 days. For each state:
- Seed club `club-a` with admin `admin@example.com` and member `coach@example.com`.
- Run `seedClubTree(env, 'club-a', 'team-1', ['coach@example.com'])`.

Then:
- `it.each(LIST_PATHS)('admin can list %s')`, where `LIST_PATHS` are the collection paths above with the `clubTreePaths` ids filled in: `assertSucceeds(db.collection(path).orderBy(FieldPath.documentId()).limit(200).get())`.
- `it.each(GET_PATHS)('admin can get %s')`, with `GET_PATHS = ['clubs/club-a', 'clubs/club-a/config/skillGuide', 'clubs/club-a/config/physicalTestGuide']`.

Two more `describe`s:
- **Terminating, `retrievalEndsAt` 1 day ago:** admin listing `clubs/club-a/teams` and `clubs/club-a/members` both `assertFails`.
- **Suspended:** the coach (a plain member and team admin) listing `clubs/club-a/teams` and `clubs/club-a/teams/team-1/players` both `assertFails`.

- [ ] **Step 2: Run it**

Run: `npm run test:rules -- tests/rules/export.rules.test.ts`. If 8080 is taken, use an emulator on 8181 (see Global Constraints).
Expected: all pass with no rules change. If a list is denied, report it. The fix belongs in Task 3's loader (read by `get`), never in the rules.

- [ ] **Step 3: Commit**

```bash
git add tests/rules/export.rules.test.ts
git commit -m "test(rules): club admin export reads per lifecycle state"
```

---

### Task 2: Export file builder and ZIP (pure)

**Files:**
- Modify: `package.json` (add the dependency `fflate`, current `0.8.x`, via `npm install fflate`)
- Create: `src/clubs/export/clubExport.ts`, `src/clubs/export/exportReadme.ts`
- Test: `src/clubs/export/clubExport.test.ts`

**Interfaces:**
- Consumes:
  - `TeamExportData` from `src/teams/teamExport.ts`. Always loaded with events and calendar, so `events` and `calendar` are never null here.
  - `toExportable` and `fileSlug` from `src/export/exportJson.ts`.
  - `csvDocument` and `Cell` from `src/matches/report/reportCsv.ts`.
  - `SKILL_KEYS` and `POSITION_CATEGORIES` from `src/types/player.ts`.
- Produces:

```ts
export type ExportDoc = Record<string, unknown> & { id: string };
export interface ClubExportData {
  club: ExportDoc;
  members: ExportDoc[];
  acceptances: ExportDoc[];
  statusLog: ExportDoc[];
  teams: { data: TeamExportData; awards: ExportDoc[] }[];
  exercises: { exercise: ExportDoc; diagrams: ExportDoc[] }[];
  trainings: ExportDoc[];
  counters: ExportDoc[];
  skillGuide: ExportDoc | null;
  physicalTestGuide: ExportDoc | null;
  sectionAccess: ExportDoc[];
}
export function buildClubExportFiles(data: ClubExportData, now?: Date): Record<string, string>;
export function playersCsv(players: TeamExportData['players']): string;
export function zipClubExport(files: Record<string, string>): Uint8Array;   // fflate zipSync + strToU8
export function clubExportFileName(club: ExportDoc, now: Date): string;     // `club-${fileSlug(name ?? id)}-export-${YYYY-MM-DD}.zip`
// exportReadme.ts
export function exportReadme(club: ExportDoc, paths: string[], now: Date): string;
```

**File map (spec §7.2)**

Every JSON file is `JSON.stringify(toExportable(value), null, 2)`.

| Path | Content |
|---|---|
| `README.txt` | `exportReadme(...)` |
| `club.json` | the club doc |
| `members.json`, `acceptances.json`, `statusLog.json` | arrays of docs |
| `teams/<teamId>/team.json` | the team doc |
| `teams/<teamId>/players.json` | `[{ player, physicalTests }]` |
| `teams/<teamId>/players.csv` | `playersCsv` |
| `teams/<teamId>/calendar.json`, `awards.json`, `scoutProfile.json` | arrays |
| `teams/<teamId>/testingSessions.json` | `[{ session, entries }]` |
| `teams/<teamId>/matches/<matchId>.json` | `{ match, events }`, events sorted by `order` ascending |
| `library/exercises.json` | `[{ exercise, diagrams }]`, diagrams sorted by `order` |
| `library/trainings.json`, `library/counters.json` | arrays |
| `config/skillGuide.json`, `config/physicalTestGuide.json` | the doc, or `null` |
| `sectionAccess.json` | array |

**`players.csv`**
- Built with `csvDocument(rows, 'en')`, rows sorted by `number`.
- The header is exactly: `Number, Name, Date of birth, Nationality, Licence, Position, Shirt size, Starting, Player phone, Guardians, Viewer emails, Average, Level, Serve, Attack, Block, Set, Defence, Reception, Jump, Speed, IQ, Consent given, Consent date, Left club`.
- Position is the `POSITION_CATEGORIES` label.
- Guardians are `relation: name, phone, email` joined with ` | `. Viewer emails are joined with `, `.
- Starting and Consent given are `yes`/`no`. Missing fields are empty cells.

**README content**
- First lines:
  - `Club data export`
  - `Club: <name> (<id>)`
  - `Exported: <ISO>`
- A **Formats** paragraph:
  - JSON is UTF-8.
  - Timestamps are ISO 8601 UTC. Calendar and test dates are `YYYY-MM-DD`.
  - Every `id` is the stored document id.
  - CSV is comma-separated UTF-8 with BOM.
  - Skill scores run 1–10, and `level` is derived from `avgScore`.
  - It contains minors' personal data.
- A **Files** list: one line per path pattern (with literal `<teamId>` and `<matchId>`), each with a one-line description, plus the field notes the reader needs (`avgScore`, `level`, `viewerEmails`, `consent`, `adminEmails`).
- The implementer writes the descriptions.

- [ ] **Step 1: Write the failing tests** in `clubExport.test.ts`, using a fixture builder `fixture()`. It has one team `t1` with one player (one physical test, one guardian), one testing session with one entry, one match `m1` whose events have `order` 2 and 1, one award doc, one exercise with one diagram, and both guides.
  - `it('builds exactly the spec file set')`: `Object.keys(buildClubExportFiles(fixture())).sort()` equals the 19 paths above, with `t1`/`m1`.
  - `it('writes timestamps as ISO strings')`: a field `{ toDate: () => new Date('2026-01-02T03:04:05Z') }` on the club ends up as `"2026-01-02T03:04:05.000Z"` in `club.json`.
  - `it('sorts match events by order')`: `JSON.parse(files['teams/t1/matches/m1.json']).events.map(e => e.order)` equals `[1, 2]`.
  - `it('an empty club still builds')`: no teams, no exercises, guides `null`. The keys are exactly `README.txt, club.json, members.json, acceptances.json, statusLog.json, library/exercises.json, library/trainings.json, library/counters.json, config/skillGuide.json, config/physicalTestGuide.json, sectionAccess.json`, and `config/skillGuide.json` is `'null'`.
  - `it('README names every file')`: for each key, the README contains the key with team and match ids replaced by `<teamId>`/`<matchId>`. It also contains `avgScore`, `viewerEmails` and `consent`.
  - `it('players.csv has the fixed header and guards formulas')`:
    - The first line (BOM stripped) equals the header above, joined with `,`.
    - A player named `=HYPERLINK("x")` is written as a quoted `'=HYPERLINK(""x"")` cell.
    - The guardian cell reads `mother: Ana, 600, ana@x.com`.
  - `it('zips and unzips to the same files')`: `unzipSync(zipClubExport(files))` decoded with `strFromU8` equals `files`.
  - `it('names the file after the club and date')`: `clubExportFileName({ id: 'c1', name: 'VC Bàrça / A' }, new Date('2026-10-22T10:00:00Z'))` equals `club-VC-Bàrça-A-export-2026-10-22.zip`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/clubs/export/clubExport.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `clubExport.ts` and `exportReadme.ts`** to the interfaces above.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/clubs/export/clubExport.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/clubs/export/
git commit -m "feat(export): club export file map, players CSV, README and ZIP"
```

---

### Task 3: Export loader and the Export tab in the club area

**Files:**
- Create: `src/clubs/export/clubExportApi.ts`, `src/clubs/area/ExportTab.tsx`
- Modify:
  - `src/export/exportJson.ts`: add `downloadBlob`. `downloadText` now builds its Blob and calls it.
  - `src/clubs/area/ClubAreaPage.tsx`: add the Export tab.
- Test: `src/clubs/area/ExportTab.test.tsx`, `src/clubs/area/ClubAreaPage.test.tsx` (extend)

**Interfaces:**
- Consumes:
  - From Task 2: `ClubExportData`, `buildClubExportFiles`, `zipClubExport`, `clubExportFileName`.
  - `loadTeamExportData(teamId, { includeEvents: true, includeCalendar: true })`, `readAll`, `clubCol`, `clubDoc` (with no segments it returns the club doc), `useNotify`.
  - From Task 1: the reads list.
- Produces:
  - `loadClubExportData(onProgress: (label: string) => void): Promise<ClubExportData>`
  - `downloadBlob(fileName: string, blob: Blob): void`

**Loader**
- Collections go through `readAll` as Task 1 lists them. The club doc and the two `config` docs are read with `getDoc`; a missing guide gives `null`.
- Teams load one after another, in id order.
- Progress labels:
  - `'Club and people'`
  - `` `Team ${i + 1} of ${n}: ${name}` ``
  - `'Library'`
  - `'Guides and access'`

**Export tab copy**
- Heading: "Export your club's data".
- Body: "One ZIP file with everything your club has stored: teams, players, physical tests, matches with every scouting event, the library, guides and access lists. README.txt inside explains each file. It holds minors' personal data, so keep it somewhere safe."
- The button reads "Download export" (lucide `Download` icon).
- While running, the button is disabled and the current progress label shows in a `role="status"` line.
- **On success:** `notify('Export downloaded')`.
- **On failure:** an inline `role="alert"` reading `Export failed: <message without a trailing period>. Nothing was downloaded.`, and no download.

**Club area tabs**
- Full: Profile, People & access, Export, Contract.
- Restricted (paused club): Profile, Export, Contract.
- The default tab is unchanged: Profile, or Contract when restricted.

- [ ] **Step 1: Write the failing tests**

`ExportTab.test.tsx`, which mocks `../export/clubExportApi` and spies on `downloadBlob`:
- `it('downloads one zip named after the club')`: the loader resolves the Task 2 empty-club shape. After clicking "Download export", `downloadBlob` is called once with a name matching `/^club-.+-export-\d{4}-\d{2}-\d{2}\.zip$/` and a Blob of type `application/zip`. The notify text "Export downloaded" appears.
- `it('shows progress and disables the button while running')`: the loader calls `onProgress('Team 1 of 2: U17')` and then stays pending. The button is disabled and the status shows `Team 1 of 2: U17`.
- `it('a failed load downloads nothing')`: the loader rejects `new Error('Missing or insufficient permissions.')`. An alert shows exactly `Export failed: Missing or insufficient permissions. Nothing was downloaded.` (one trailing period is trimmed from the message), and `downloadBlob` is not called.

`ClubAreaPage.test.tsx`:
- `it('shows Export in the full and restricted club area')`: the tab names are `['Profile','People & access','Export','Contract']`, and `['Profile','Export','Contract']` when restricted.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/clubs/area`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement** the loader, `downloadBlob`, `ExportTab` and the tab wiring.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/clubs src/export src/teams`. Expected: PASS. The existing team export tests must still pass.

- [ ] **Step 5: Commit**

```bash
git add src/clubs/export/clubExportApi.ts src/clubs/area/ src/export/exportJson.ts
git commit -m "feat(export): Export tab in the club area with progress and one-click ZIP"
```

---

### Task 4: One-time offline cache reset (`vcb.schemaVersion`)

Spec §9.7. A device that used the app before the migration holds cached top-level docs, and possibly queued writes to paths that no longer exist. Clear that cache once, before Firestore is used.

`clearIndexedDbPersistence` is allowed on an instance that has not started yet, so calling it before the first render needs no terminate and no reload. That avoids reload loops entirely, including for crawlers with no storage.

**Files:**
- Create: `src/firebase/schemaVersion.ts`
- Modify: `src/main.tsx` (render only after the check settles)
- Test: `src/firebase/schemaVersion.test.ts`

**Interfaces:**
- Produces:

```ts
export const SCHEMA_VERSION = '2';
export const SCHEMA_KEY = 'vcb.schemaVersion';
export const CLEAR_TIMEOUT_MS = 3000;
export async function resetCacheIfSchemaChanged(deps?: {
  storage?: Pick<Storage, 'getItem' | 'setItem'>;  // default: window.localStorage
  clear?: () => Promise<void>;                      // default: () => clearIndexedDbPersistence(db)
}): Promise<void>;   // never rejects
```

**Behaviour**
- Stored value equals `SCHEMA_VERSION`: nothing happens.
- Otherwise, run `clear` raced against `CLEAR_TIMEOUT_MS`:
  - **It succeeds:** set the key.
  - **It fails or times out** (another open tab holds the cache): leave the key unset so a later load retries, and continue.
- A storage accessor that throws (private mode) is treated as "nothing to do".

- [ ] **Step 1: Write the failing tests**
  - `it('clears the cache once and records the version')`: an empty storage fake and a resolving `clear` spy. `clear` is called once, and `setItem` is called with `('vcb.schemaVersion', '2')`.
  - `it('does nothing when the version matches')`: storage returns `'2'`, and `clear` is not called.
  - `it('leaves the key unset when another tab holds the cache')`: `clear` rejects. The call resolves, and `setItem` is not called.
  - `it('gives up after the timeout')`: `clear` never settles; with fake timers, advance `CLEAR_TIMEOUT_MS`. The call resolves, and `setItem` is not called.
  - `it('survives blocked storage')`: `getItem` throws. The call resolves, and `clear` is not called.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/firebase/schemaVersion.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `schemaVersion.ts`**, and make `main.tsx` call `void resetCacheIfSchemaChanged().finally(() => ReactDOM.createRoot(...).render(...))`.

- [ ] **Step 4: Run the tests and the build**

Run: `npx vitest run src/firebase/schemaVersion.test.ts && npm run build`. Expected: PASS, build OK.

- [ ] **Step 5: Commit**

```bash
git add src/firebase/schemaVersion.ts src/firebase/schemaVersion.test.ts src/main.tsx
git commit -m "feat(cache): clear the pre-migration offline cache once (vcb.schemaVersion)"
```

---

### Task 5: Migration planner (pure)

**Files:**
- Modify: `scripts/seed/clubArg.mjs`. Extract `newClubDoc`; `writeClub` uses it, and its behaviour is unchanged.
- Create: `scripts/migrate/clubPlatformPlan.mjs`
- Test: `scripts/migrate/clubPlatformPlan.test.mjs`, `scripts/seed/clubArg.test.mjs` (add a `newClubDoc` case)

**Interfaces:**
- Produces:

```js
// clubArg.mjs
export function newClubDoc({ name, country, locale, ownerEmail, status, aiEnabled, growthTestsEnabled }, now)
//   -> exactly the club-doc object writeClub writes today (referenceOptOut false, statusReason/statusChangedAt/
//      statusChangedBy/lastStatusLogId null, legal null, termination all-null, billing null, createdAt now)

// clubPlatformPlan.mjs
export const LEGACY_COLLECTIONS = ['adminAllowlist', 'users', 'sectionAccess', 'skillGuide',
  'physicalTestGuide', 'teams', 'exercises', 'trainings', 'counters'];
/** source: { path, data }[] for every doc under LEGACY_COLLECTIONS (any depth); now: a timestamp sentinel. */
export function planMigration(source, { clubId, owner, operator, name, country, locale = 'en', now })
//   -> { club: { path, data }, writes: { path, data }[], members: { email, role }[],
//        expected: Record<'teams'|'exercises'|'trainings'|'counters'|'config'|'sectionAccess'|'members', number> }
```

**Rules the planner applies (spec §9.1–9.4)**

*Validation.* Each of these throws an `Error` naming the argument:
- `clubId` must match `/^[a-z0-9][a-z0-9-]{1,39}$/`.
- `owner` and `operator` must look like emails.
- `owner` must differ from `operator`, compared lowercased. The message is `owner must not be the operator`.
- `country` must match `/^[A-Z]{2}$/`.
- `locale` must be one of `en`, `it`.

*Club doc.*
- `name` defaults to the most common non-empty `team.club`; on a tie, the alphabetically first.
- No team has one and no `name` is given → throw `pass --name`.
- `club = { path: 'clubs/<clubId>', data: newClubDoc({ name, country, locale, ownerEmail: owner, status: 'active', aiEnabled: true, growthTestsEnabled: true }, now) }`.

*Members.* Emails are trimmed, lowercased, de-duplicated, and empty ones dropped.
- Admins: `adminAllowlist` doc ids plus `owner`.
- Members: every email in `teams/*.adminEmails`, `teams/*/players/*.viewerEmails` and `sectionAccess/*.adminEmails` that is not already an admin.
- Each one is written to `clubs/<id>/members/<email>` as `{ email, clubId, role, addedBy: 'migration', addedAt: now }`.

*Copied data.*
- **Library and teams:** every doc under `teams/**`, `exercises/**`, `trainings/**` and `counters/**` is copied to `clubs/<id>/<same path>`, with ids and all other values untouched. Team docs (`teams/<t>`) drop `club` and lowercase-dedupe `adminEmails`. Player docs (`teams/<t>/players/<p>`) lowercase-dedupe `viewerEmails`.
- **Section access:** `sectionAccess/<s>` becomes `clubs/<id>/sectionAccess/<s>` as `{ adminEmails }` only. A missing list becomes `[]`.
- **Guides:** `skillGuide/config` becomes `clubs/<id>/config/skillGuide`, and `physicalTestGuide/config` becomes `clubs/<id>/config/physicalTestGuide`. Other ids in those two collections are ignored.

*Top-level docs.*
- `platformAdmins/<operator>` = `{ addedBy: 'migration', addedAt: now }`.
- `users/<uid>` docs are rewritten in place without `role` (the same path, `set` replaces).
- `adminAllowlist` itself is not copied.

*Expected counts.* `expected` counts the planned docs per destination group.

**Order of `writes`:**
1. members
2. `platformAdmins`
3. `sectionAccess`
4. `config`
5. library
6. teams
7. users

`club` is separate and is written first by Task 6.

- [ ] **Step 1: Write the failing tests** in `clubPlatformPlan.test.mjs`. The fixture uses `now = 'NOW'`, `clubId 'vcb'`, owner `President@x.com`, operator `boss@x.com` and country `ES`.
  - `it('makes one member per person, admin wins')`: the source has `adminAllowlist/Boss@x.com`, team `t1` with `adminEmails ['Coach@x.com','ana@x.com','Ana@x.com']`, and player `p1` with `viewerEmails ['ANA@x.com','coach@x.com']`. `members` sorted by email equals `[{ana@x.com, member}, {boss@x.com, admin}, {coach@x.com, member}, {president@x.com, admin}]`.
  - `it('refuses the operator as owner')`: `owner: 'Boss@X.com'` throws `owner must not be the operator`.
  - `it('copies nested docs with ids preserved')`: the source doc `teams/t1/matches/m1/events/e1` with `{ order: 1, at: ts }` appears as `clubs/vcb/teams/t1/matches/m1/events/e1`, its data the same object values (`toEqual`, with `at` the same `ts` reference).
  - `it('drops team.club and lowercases team and player emails')`: on the team, `club` is absent and `adminEmails` equals `['coach@x.com','ana@x.com']`. On the player, `viewerEmails` equals `['ana@x.com','coach@x.com']`.
  - `it('writes sectionAccess with adminEmails only')`: the source `{ adminEmails: ['A@x.com'], migratedAt: 1 }` becomes exactly `{ adminEmails: ['a@x.com'] }`.
  - `it('moves the guides under config')`: the paths `clubs/vcb/config/skillGuide` and `clubs/vcb/config/physicalTestGuide`.
  - `it('names the club after the most common team.club')`: two teams `VCB` and one `Other` give `VCB`. With no `club` anywhere and no `name`, it throws `pass --name`.
  - `it('strips role from users docs in place')`: `users/u1 { email, role: 'superadmin' }` becomes a write at `users/u1` with data `{ email }`.
  - `it('makes an active club with AI and growth tests on')`:
    - `club.data`: `status` `'active'`, `ownerEmail` `'president@x.com'`, `aiEnabled` and `growthTestsEnabled` `true`, `legal` `null`, `termination.effectiveAt` `null`.
    - The `platformAdmins/boss@x.com` write exists.
  - `it('counts the expected docs per group')`: `expected.teams` equals the number of source docs under `teams/`, and `expected.members` equals `members.length`.

  In `clubArg.test.mjs`, add `it('newClubDoc matches the seeded club shape')`. Its keys equal `['name','country','locale','ownerEmail','aiEnabled','referenceOptOut','growthTestsEnabled','createdAt','status','statusReason','statusChangedAt','statusChangedBy','lastStatusLogId','legal','termination','billing']`, compared as sets.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run scripts/migrate scripts/seed/clubArg.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement** `newClubDoc` (and refactor `writeClub` to use it) and `planMigration`.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run scripts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed/clubArg.mjs scripts/seed/clubArg.test.mjs scripts/migrate/clubPlatformPlan.mjs scripts/migrate/clubPlatformPlan.test.mjs
git commit -m "feat(migrate): pure club-platform migration planner"
```

---

### Task 6: Migration runner, CLI and emulator rehearsal test

**Files:**
- Create:
  - `scripts/migrate/firestoreTree.mjs`
  - `scripts/migrate/clubPlatformRun.mjs`
  - `scripts/migrate/2026-10-club-platform.mjs` (CLI)
- Test: `tests/rules/migration.rules.test.ts`

**Interfaces:**
- Consumes: from Task 5, `planMigration` and `LEGACY_COLLECTIONS`.
- Produces:

```js
// firestoreTree.mjs (Admin SDK Firestore instances)
export async function readTree(db, collectionNames, { pageSize = 500 } = {})  // -> { path, data }[]; paged by documentId, recursing listCollections()
export async function countUnder(db, path)                                     // -> number of docs in the collection at `path`, all depths
export async function writeAll(db, writes, { resume = false, batchSize = 400, log = () => {} } = {})
//   -> { written, skipped }. With resume, existence is checked first (db.getAll in chunks of 100) and existing docs are skipped.
// clubPlatformRun.mjs
export async function runMigration({ source, target, options, resume = false, dryRun = false, log = console.log })
//   options: planMigration's options minus `now` (now = FieldValue.serverTimestamp())
//   -> { plan, written, skipped, counts: Record<group, number>, ok: boolean }
```

**`runMigration` steps**
1. If `clubs/<clubId>` exists in `target` and `!resume`, throw ``clubs/<id> already exists; pass --resume to continue a stopped run``.
2. `readTree(source, LEGACY_COLLECTIONS)`, then `planMigration`.
3. Log the expected counts and the estimated writes (`writes.length + 1`). If `dryRun`, return here with `ok: true`, `written: 0`.
4. Write `plan.club` (it is skipped under `resume` if it exists), then `writeAll(target, plan.writes, { resume })`.
5. Verify: `counts[g] = countUnder(target, 'clubs/<id>/<g>')` for each `expected` group. `ok` is true when every count is ≥ expected (≥, because the club may already hold newer docs on a resume). Log one line per group: `group expected actual`.

**The CLI** (`2026-10-club-platform.mjs`) is modelled on `seed.mjs` and `exportProdPlayers.mjs`.

| Flag | Meaning |
|---|---|
| `--rehearse` | Read production, write to the local emulator (`127.0.0.1:8080`). Never writes production. |
| `--prod` | Read and write production. |
| `--club <id>`, `--owner <email>`, `--operator <email>`, `--country <XX>` | Required. |
| `--name <text>`, `--locale <en\|it>` | Optional. |
| `--dry-run`, `--resume` | See `runMigration`. |

- **Both modes:** need `serviceAccountKey.json`, and refuse while `FIRESTORE_EMULATOR_HOST` is set.
- **`--rehearse`:** the target is a second Admin app with the same credential and `projectId: 'volley-skills'`, plus `getFirestore(app).settings({ host: '127.0.0.1:8080', ssl: false })`. Before writing, the CLI checks that the emulator answers (a `listCollections()` call) and stops with "start it with npm run emulator" if not.
- **`--prod`, unless `--dry-run`:** the user must type the club id to confirm.
- **Exit code:** 1 when `ok` is false.
- **Header comment:** usage, the Spark quota note (resume the next day after a quota stop, and do not use the app in between), and "logs ids and counts only".

- [ ] **Step 1: Write the failing emulator test** in `tests/rules/migration.rules.test.ts`.

  Set-up:
  - Use `firebase-admin` with `initializeApp({ projectId: 'volley-skills-test' }, 'migration-test')`. `FIRESTORE_EMULATOR_HOST` is set by `emulators:exec`. Call `getTestEnv()` first and `env.clearFirestore()` before each test.
  - The legacy fixture, written with the admin db:
    - `adminAllowlist/Boss@x.com` `{}`
    - `users/u1 { email: 'boss@x.com', role: 'superadmin' }`
    - `sectionAccess/exercises { adminEmails: ['Coach@x.com'], migratedAt: 1 }`
    - `skillGuide/config { skills: [] }`
    - `teams/t1 { name: 'U17', club: 'VCB', adminEmails: ['Coach@x.com'], createdBy: 'x' }`
    - `teams/t1/players/p1 { fullName: 'P', viewerEmails: ['Parent@x.com'] }`
    - `teams/t1/matches/m1 { status: 'finished' }`
    - `teams/t1/matches/m1/events/e1 { order: 1 }`
    - `exercises/x1 { name: 'X' }`, `exercises/x1/diagrams/d1 { order: 0 }`
    - `trainings/tr1 { name: 'T' }`, `counters/trainings { lastSequence: 1 }`
    - `interestSignups/s1 { name: 'L' }`
  - Options: `{ clubId: 'vcb', owner: 'president@x.com', operator: 'boss@x.com', country: 'ES' }`.

  Tests:
  - `it('migrates the legacy tree under clubs/vcb')`:
    - `ok` is true.
    - `clubs/vcb` has `name` `'VCB'` and `status` `'active'`.
    - Member roles: boss admin, president admin, coach member, parent member.
    - `clubs/vcb/teams/t1/matches/m1/events/e1` exists. `clubs/vcb/teams/t1` has no `club`.
    - `clubs/vcb/config/skillGuide` exists.
    - `users/u1` has no `role`.
    - `platformAdmins/boss@x.com` exists.
    - The legacy `teams/t1` and `interestSignups/s1` still exist.
  - `it('migrated data works under the rules')`: after migrating, `assertSucceeds(dbAs(env, 'coach@x.com').doc('clubs/vcb/teams/t1').get())`, and `assertSucceeds(dbAs(env, 'parent@x.com').doc('clubs/vcb/teams/t1/players/p1').get())`.
  - `it('refuses to run twice without --resume')`: the second `runMigration` rejects with `/already exists/`.
  - `it('resume writes only what is missing')`: migrate, delete `clubs/vcb/teams/t1/matches/m1/events/e1`, then run with `resume: true`. `written` is 1, `ok` is true, and the event exists again.
  - `it('a dry run writes nothing')`: with `dryRun: true`, `clubs/vcb` does not exist afterwards.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:rules -- tests/rules/migration.rules.test.ts` (alternate port if 8080 is taken). Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `firestoreTree.mjs`, `clubPlatformRun.mjs` and the CLI.

- [ ] **Step 4: Run it to verify it passes, plus the whole rules suite**

Run: `npm run test:rules`. Expected: all pass.

- [ ] **Step 5: Check the CLI's guards without production**

Run each and confirm the refusal message:
- `node scripts/migrate/2026-10-club-platform.mjs` refuses: neither `--rehearse` nor `--prod`.
- `FIRESTORE_EMULATOR_HOST=x node scripts/migrate/2026-10-club-platform.mjs --rehearse ...` refuses.
- Without `--owner`, it refuses.

Do not run `--rehearse` or `--prod` against production. The user does that from the runbook (Task 8).

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate/ tests/rules/migration.rules.test.ts
git commit -m "feat(migrate): resumable club-platform migration with emulator rehearsal test"
```

---

### Task 7: Legacy drop and club purge scripts

**Files:**
- Create:
  - `scripts/migrate/legacy.mjs`, `scripts/migrate/dropLegacy.mjs` (CLI)
  - `scripts/ops/purge.mjs`, `scripts/ops/purgeClub.mjs` (CLI)
- Test: `scripts/migrate/legacy.test.mjs`, `scripts/ops/purge.test.mjs`, `tests/rules/purge.rules.test.ts`

**Interfaces:**
- Consumes: `countUnder` from Task 6.
- Produces:

```js
// legacy.mjs
export const GRACE_DAYS = 14;
export const DROP_COLLECTIONS = ['adminAllowlist', 'teams', 'exercises', 'trainings', 'counters',
  'skillGuide', 'physicalTestGuide', 'sectionAccess'];          // never users, interestSignups, platformAdmins, clubs
export function dropAllowed(club /* data or null */, now /* Date */)   // -> { ok: true } | { ok: false, reason }
export async function dropLegacy(db, log)                              // -> Record<name, deletedCount>; db.recursiveDelete per collection
// purge.mjs
export const KEEP_SUBCOLLECTIONS = ['acceptances', 'statusLog'];
export function purgeAllowed(club /* data or null */, now /* Date */)  // -> { ok: true } | { ok: false, reason }
export function tombstoneOf(club, at)  // -> { name, country, ownerEmail, createdAt, status: 'deleted', statusChangedAt: at, legal: club.legal ?? null }
export async function purgeClub(db, clubId, now, log)                  // -> Record<subcollection, deletedCount>
```

**Decisions**
- **`dropAllowed`:** ok only when the club exists and `createdAt.toMillis() <= now - GRACE_DAYS days`.
  - No club: reason `clubs/<id> not found: migrate first`.
  - Too early: reason `grace period runs until <ISO date>`.
- **`purgeAllowed`** (spec §7.4):
  - ok when `status === 'deleted'`. Only a pending club rejected by the operator, or an already purged one, gets there.
  - ok when `status === 'terminating'` and `now > retrievalEndsAt`.
  - Otherwise the reason is `club is <status>` or `retrieval window open until <ISO>`.
- **`purgeClub`:**
  - Reads the club and throws the `purgeAllowed` reason if it is not allowed.
  - For each `listCollections()` of the club not in `KEEP_SUBCOLLECTIONS` (members included), counts with `countUnder`, then calls `recursiveDelete`.
  - `set`s the tombstone (no merge).
  - Adds a `statusLog` doc `{ from: <old status>, to: 'deleted', reason: 'Data purged', by: 'purge-script', at: <serverTimestamp> }`. It is evidence of the purge: `statusChangedAt` and `at` are `FieldValue.serverTimestamp()`.
- **CLIs:**
  - Both: `--club <id>`, `--emulator` (the default) or `--prod`, and prod refuses while `FIRESTORE_EMULATOR_HOST` is set.
  - `dropLegacy.mjs` prints per-collection doc counts first, then asks the user to type `delete legacy`.
  - `purgeClub.mjs` asks the user to type the club id, then prints the summary.
  - Firebase Auth accounts are never touched.

- [ ] **Step 1: Write the failing pure tests**

`legacy.test.mjs`:
- `dropAllowed` is ok at 15 days.
- At 13 days it is refused with `/grace period runs until 20/`.
- With `null` it is refused with `/migrate first/`.
- `DROP_COLLECTIONS` excludes `users` and `interestSignups`.

`purge.test.mjs` (Timestamp-like fakes `{ toMillis: () => n }`):
- **`purgeAllowed`:**
  - ok for terminating with `retrievalEndsAt` 1 ms before now.
  - Refused 1 day before, with `/retrieval window open until/`.
  - Refused for `active` with `club is active`.
  - ok for `deleted`.
  - Refused for `null`.
- **`tombstoneOf`:** its keys are exactly `name, country, ownerEmail, createdAt, status, statusChangedAt, legal`, `status` is `'deleted'`, and a missing `legal` becomes `null`.

- [ ] **Step 2: Write the failing emulator tests** in `tests/rules/purge.rules.test.ts`, with the same admin set-up as Task 6.
  - `it('purges a club whose retrieval window ended down to a tombstone')`:
    - Set-up: `seedClub(env, { id: 'gone', status: 'terminating', admins: ['a@x.com'], termination: { effectiveAt: <31 days ago>, retrievalEndsAt: <1 day ago> } })`, then `seedClubTree(env, 'gone', 't1', ['a@x.com'])`. Also seed an active club `kept` with its own tree.
    - The keys of `clubs/gone` equal the tombstone keys.
    - `clubs/gone/acceptances/v1` and `clubs/gone/statusLog/l1` remain, and `statusLog` now has 2 docs, one with `to: 'deleted'`.
    - `countUnder(db, 'clubs/gone/teams')`, `countUnder(db, 'clubs/gone/members')` and `countUnder(db, 'clubs/gone/exercises')` are 0.
    - `countUnder(db, 'clubs/kept/teams') > 0`.
  - `it('refuses an active club and deletes nothing')`: `purgeClub` on `kept` rejects with `/club is active/`, and `clubs/kept/teams/t1` still exists.
  - `it('drops the legacy collections and nothing else')`:
    - Set-up: write `teams/t1/players/p1`, `adminAllowlist/a`, `skillGuide/config`, `users/u1`, `interestSignups/s1` and `clubs/vcb { createdAt: <20 days ago> }`.
    - `dropLegacy` empties `teams` (including the nested player), `adminAllowlist` and `skillGuide`.
    - `users/u1`, `interestSignups/s1` and `clubs/vcb` remain.

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run scripts/migrate/legacy.test.mjs scripts/ops` and `npm run test:rules -- tests/rules/purge.rules.test.ts`. Expected: FAIL.

- [ ] **Step 4: Implement** both modules and both CLIs.

- [ ] **Step 5: Run them to verify they pass**

Same commands. Expected: PASS. Then run `npm run test:rules` for the whole suite; expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate/legacy.mjs scripts/migrate/legacy.test.mjs scripts/migrate/dropLegacy.mjs scripts/ops/ tests/rules/purge.rules.test.ts
git commit -m "feat(ops): purge an ended club to a tombstone; drop legacy collections after the grace period"
```

---

### Task 8: Runbook and docs

**Files:**
- Create: `scripts/migrate/README.md`
- Modify:
  - `CLAUDE.md`
  - `docs/PRODUCTION-READINESS.md`
  - `scripts/seed/README.md`
  - `docs/superpowers/specs/2026-10-20-volley-skills-club-platform-design.md` (a "Resolved (Plan 4)" note)

**Interfaces:** consumes every script and flag from Tasks 4–7, by their exact names.

- [ ] **Step 1: Write `scripts/migrate/README.md`**, the migration runbook, in this order:
  1. **Dry run:** `--rehearse --dry-run`, then read the counts.
  2. **Rehearse into the emulator:** `npm run emulator`, `--rehearse`, then `npm run dev` with `VITE_USE_EMULATOR=true`. Sign in as the owner and as a coach and check teams, players, matches and the library. The emulator now holds production personal data: stop it when done.
  3. **Freeze:** tell the club not to use the app for the window.
  4. **Production:** `--prod --dry-run`, then `--prod`. Spark allows 20,000 writes a day. If it stops on quota, re-run the next day with `--resume` and keep the freeze.
  5. **Deploy:** merge to `main`; `deploy.yml` deploys rules and the app together. On their first load, devices clear their old cache once (`vcb.schemaVersion`).
  6. **Check** by signing in to production.
  7. **After 14 days:** `node scripts/migrate/dropLegacy.mjs --prod --club <id>`.
  8. **Note:** `legal` stays `null` until Plan 3 ships its review screen. The owner (`--owner`, the club's officer, never the operator) accepts then.

  Below the runbook, add a short **Purge** section: `scripts/ops/purgeClub.mjs`, when it runs and what the tombstone keeps.

- [ ] **Step 2: Update the other docs**
  - **`CLAUDE.md`:**
    - Replace "Production data is still top-level until the Plan 4 migration, so this branch is not deployable on its own." with one sentence naming the runbook (`scripts/migrate/README.md`).
    - Add to the Architecture section:
      - one line on `src/clubs/export/` (the club ZIP export, Export tab);
      - one line on `src/firebase/schemaVersion.ts`;
      - one line on `scripts/migrate/` and `scripts/ops/purgeClub.mjs`.
  - **`PRODUCTION-READINESS.md`:**
    - Rewrite the "Club platform: migrate production before deploying this branch" item to point at the runbook.
    - Mark the "Prod seed (one-time)" and `2026-09-11-section-access.mjs` items obsolete, with one line each: production is migrated, not seeded.
  - **`scripts/seed/README.md`:** after the migration, `exportProdPlayers.mjs` needs `--club <id>`.
  - **Spec "Resolved (Plan 4)" note:** list the rulings recorded in this plan's ledger.

- [ ] **Step 3: Verify everything**

Run: `npm test && npm run lint && npm run build && npm run test:rules` (alternate port if needed). Expected: all green, and lint shows no new errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate/README.md CLAUDE.md docs/PRODUCTION-READINESS.md scripts/seed/README.md docs/superpowers/specs/2026-10-20-volley-skills-club-platform-design.md
git commit -m "docs: migration runbook, purge, export and cache reset"
```
