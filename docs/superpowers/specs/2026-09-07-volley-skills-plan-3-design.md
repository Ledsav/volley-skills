# Volley Skills App — Plan 3 Design: Calendar & Shared Training Library

Date: 2026-09-07
Status: Approved for planning
Companion to: `2026-09-04-volley-skills-app-design.md` (data model, security model), `2026-09-04-volley-skills-design-system.md` (tokens, components), `2026-09-07-volley-skills-plan-2-design.md` (component conventions established in Plan 2)

## 1. Purpose

Plan 3 implements the remaining functional scope from the app design spec that Plans 1 and 2 did not cover:

1. **Team Calendar tab** — month view; assign a training from the shared library to a date (app design spec §7; data model `teams/{teamId}/calendar/{sessionId}` in §5).
2. **Shared exercises library** (`/exercises`) — paginated list, filter by category, admin-only create/edit/delete (§5 `exercises/{exerciseId}`, §7).
3. **Shared trainings library** (`/trainings`) — paginated list, filter by age group / business ID, admin-only create/edit/delete, transactional `businessId` like `TR-0007` via `counters/trainings` (§5, §7).
4. **`/privacy`** — public static privacy policy page (§7, §10).
5. **Admin-triggered player export** — structured JSON data dump on a player record, covering GDPR access rights (§10). Hard delete already shipped in a prior session; export did not.

Also in scope, as a small isolated usability fix (not a redesign): the team roster table's horizontal-scroll problem (`src/teams/TeamRosterTable.tsx`).

Explicitly **out of scope**: the viewer invite flow (app design spec §6.4 / §14 — remains schema-only), and any visual redesign / chasing the richer dashboard mockup. This doc specifies the UI/component-level design that the app design spec left at the data-model level.

## 2. Global design decisions

### 2.1 Authorization boundaries

- **Exercises, trainings, and `counters/trainings` are club-global shared resources**, authorized on the global `users/{uid}.role == 'admin'` field via the existing `isAdmin()` helper in `firestore.rules` — **not** team membership. The `/exercises` and `/trainings` routes are wrapped in `<RequireAdmin>`, the same guard `/admin/guides` already uses.
- **Calendar sessions are team-scoped**, authorized on `isTeamAdmin()` (the signed-in email in the parent team's `adminEmails`) — identical to players and physical tests. Not accessible to viewers (app design spec §6.6).
- **Player export** performs no privileged operation: it reads only data the admin can already read under existing rules and assembles a file in the browser. No new rules, no Cloud Function.
- **`/privacy`** is a public route, rendered outside the authenticated layout (a sibling of `/login`).

### 2.2 Navigation

`/exercises` and `/trainings` are added to the navigation shell (`src/layout/AppShell.tsx`) as new destinations, following the same pattern the "Guides" item already uses: the nav item is rendered unconditionally and the route is `<RequireAdmin>`-gated. A parent-viewer would see nav items that bounce them — this dead-link wart is accepted for now and called out in Self-Review as something to revisit alongside the deferred viewer flow, rather than introducing role-conditional nav rendering in this plan.

The **Calendar is a tab on the team page** (`/teams/:teamId`), not a global nav destination — it is per-team.

### 2.3 Referential integrity — tolerate dangling references, never cascade

Trainings reference exercises by id (`training.exercises[].exerciseId`); calendar sessions reference trainings by id (`session.trainingId`). Hard delete is supported for exercises and trainings (admin only), and deletion **tolerates dangling references** rather than cascading edits into other documents:

- A deleted **exercise** still referenced by a training renders in the training builder / list as a clearly-marked, removable **"⚠ Deleted exercise"** row. It keeps its stored `order` / `durationMinutes` until the admin re-saves the training, at which point the missing entry can be dropped.
- A deleted **training** still referenced by past calendar sessions keeps its denormalized `trainingBusinessId` / `trainingName` label in the month view (see §2.4). The chip still links to `/trainings` filtered by that business ID; if the training was deleted, that page simply shows no result.
- The exercise-delete confirmation reports **how many trainings reference the exercise**, computed from a denormalized `training.exerciseIds: string[]` flat array (see §4.1).

Firestore Security Rules cannot cheaply enforce cross-document referential integrity, and the app's threat model treats admins as trusted club staff — so this is a client-side UX concern (a confirm dialog with context) plus graceful degradation in the rendering components, not a hard rules-level block.

### 2.4 Smart fetching (app design spec §8)

- **Exercises / trainings lists**: `orderBy(...).limit(25)` with cursor-based "Load more" (`startAfter(lastDoc)`), the same pattern as `TeamRosterTable` and `PhysicalTestHistoryList`. Category / age-group filters are `where()` clauses combined with the same limit+cursor pattern, backed by composite indexes.
- **Team calendar**: queries only the visible month's date range. Dates are stored as `"YYYY-MM-DD"` strings (per app design spec §5), so the month query is `where('date','>=',monthStart) && where('date','<=',monthEnd) && orderBy('date')` with a defensive `limit(200)`. Navigating months re-queries; full history is never loaded.
- **Training labels in calendar cells**: `trainingName` and `trainingBusinessId` are **denormalized onto each calendar session document at creation time** — the same denormalization precedent as player docs carrying `teamName` / `ageGroup` / `season`. The month view therefore renders session labels with zero additional reads per navigation, and the labels survive deletion of the referenced training.
- **Player export**: the physical-test history for one player is small (independent per-quality timelines, a handful of entries each — app design spec §5). It is read with a single `getDocs(query(..., orderBy('date','desc'), limit(500)))` — still `limit()`-bounded, and export is a rare admin action.

### 2.5 File-per-concern & TDD

Every new area follows the layout established by Plans 1 and 2: a `…Api.ts` data-layer module, pure logic in its own module, presentational components, each with a colocated `*.test.ts(x)`. Firestore rules tests are the highest-priority tests; every access-control claim is backed by an `assertSucceeds` / `assertFails` pair.

### 2.6 Local rules-test execution caveat

The `@firebase/rules-unit-testing` emulator requires JDK 21+. If `npm run test:rules` cannot start in the implementation environment, the rules tests are still written and committed (they are the highest-priority tests), and flagged clearly as locally unverified — the same approach every prior plan took.

## 3. Exercises library (`/exercises`)

### 3.1 Types — `src/types/exercise.ts`

- `ExerciseCategory` — union of the fixed 9 categories from the app design spec §5: `'warmup' | 'physical' | 'service' | 'setting' | 'defense' | 'reception' | 'attack' | 'compound' | 'game'`. Confirmed against the spec, not invented.
- `EXERCISE_CATEGORIES: { key: ExerciseCategory; label: string }[]` — ordered, with display labels ("Warm-up", "Physical", "Service", "Setting", "Defense", "Reception", "Attack", "Compound", "Game").
- `Exercise` — `{ id; name; description; category: ExerciseCategory; createdBy; createdAt }`.
- `NewExerciseInput` — `{ name; description; category: ExerciseCategory }`.

### 3.2 Data layer — `src/exercises/exercisesApi.ts`

- `createExercise(input: NewExerciseInput, creatorUid: string): Promise<string>` — `addDoc` to `exercises`, sets `createdBy` + `createdAt: serverTimestamp()`.
- `updateExercise(exerciseId: string, updates: Partial<NewExerciseInput>): Promise<void>`.
- `deleteExercise(exerciseId: string): Promise<void>` — plain `deleteDoc`. Referencing trainings are not touched (§2.3).
- `listExercises(afterDoc?, category?): Promise<{ exercises: Exercise[]; lastDoc: QueryDocumentSnapshot | null }>` — `orderBy('name')`, `limit(25)`, optional `where('category','==',category)`, `startAfter(afterDoc)` when paging.
- `getExercisesByIds(ids: string[]): Promise<Exercise[]>` — `Promise.all(ids.map(getDoc))`, bounded by the number of exercises in one training (small). Used by the training builder's edit mode to resolve stored ids to names; ids that no longer resolve are simply absent from the result (the builder detects the gap — §4.4).
- `countTrainingsUsingExercise(exerciseId: string): Promise<number>` — `getCountFromServer(query(collection(db,'trainings'), where('exerciseIds','array-contains', exerciseId)))`. Feeds the delete-confirm message.

### 3.3 Components

- `src/exercises/ExerciseFormDialog.tsx` — create/edit dialog: `name` (`Input`), `description` (textarea), `category` (`select`). Save calls `createExercise` or `updateExercise`. Reuses the shared `Input` / `Button` primitives and the dialog/content-card treatment from Plan 1/2.
- `src/exercises/ExercisesPage.tsx` — the `/exercises` screen:
  - Header: title + "New exercise" button.
  - Category filter: a `select` of `EXERCISE_CATEGORIES` plus "All categories"; changing it reloads the first page with the `category` argument.
  - List: hairline-separated rows inside a content card — name, a category chip, a one-line description snippet; each row opens `ExerciseFormDialog` in edit mode, and has a delete affordance.
  - Delete: opens `ConfirmDialog`; the message includes the `countTrainingsUsingExercise` result ("This exercise is used in N training(s). Deleting it will leave those trainings with a missing exercise entry.").
  - "Load more" button when `lastDoc` is non-null.

### 3.4 Rules — `firestore.rules`

Add, at the top level of `match /databases/{database}/documents` (sibling of `teams`), reusing the existing `isAdmin()` helper:

```
match /exercises/{exerciseId} {
  allow read: if isAdmin();
  allow create: if isAdmin()
    && request.resource.data.createdBy == request.auth.uid
    && request.resource.data.name is string
    && request.resource.data.name.size() > 0
    && request.resource.data.category in
       ['warmup','physical','service','setting','defense','reception','attack','compound','game'];
  allow update: if isAdmin()
    && request.resource.data.name is string
    && request.resource.data.name.size() > 0
    && request.resource.data.category in
       ['warmup','physical','service','setting','defense','reception','attack','compound','game'];
  allow delete: if isAdmin();
}
```

### 3.5 Indexes — `firestore.indexes.json`

Add a composite index for the filtered list:

```json
{
  "collectionGroup": "exercises",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "category", "order": "ASCENDING" },
    { "fieldPath": "name", "order": "ASCENDING" }
  ]
}
```

(The `exerciseIds array-contains` query in `countTrainingsUsingExercise` is a single-field array-contains query on the `trainings` collection and needs no composite index.)

## 4. Trainings library (`/trainings`)

### 4.1 Types — `src/types/training.ts`

- `TrainingExercise` — `{ exerciseId: string; order: number; durationMinutes: number }`.
- `Training` — `{ id; businessId; name; description; ageGroupTarget; exercises: TrainingExercise[]; exerciseIds: string[]; createdBy; createdAt }`.
  - `ageGroupTarget` is free text (matches the free-text `Team.ageGroup`), not an enum.
  - `exerciseIds` is a flat denormalized mirror of `exercises[].exerciseId`, maintained on every create/update, existing only to make `countTrainingsUsingExercise` a cheap indexed query (§2.3, §3.2).
- `NewTrainingInput` — `{ name; description; ageGroupTarget; exercises: TrainingExercise[] }` (`businessId` and `exerciseIds` are derived, not supplied by the caller).

### 4.2 Business ID generation — `src/trainings/businessId.ts` (pure)

- `formatBusinessId(sequence: number): string` — `` `TR-${String(sequence).padStart(4, '0')}` `` → `TR-0007`. Pure, unit-tested (app design spec §13 names "training `businessId` sequence generation" as a required unit test).

### 4.3 Data layer — `src/trainings/trainingsApi.ts`

- `createTraining(input: NewTrainingInput, creatorUid: string): Promise<{ id: string; businessId: string }>` — `runTransaction(db, …)`:
  1. `tx.get(doc(db,'counters','trainings'))`; `lastSequence = snap.exists() ? snap.data().lastSequence : 0`.
  2. `next = lastSequence + 1`; `businessId = formatBusinessId(next)`.
  3. `tx.set(counterRef, { lastSequence: next })`.
  4. `tx.set(newTrainingRef, { businessId, ...input, exerciseIds: input.exercises.map(e => e.exerciseId), createdBy: creatorUid, createdAt: serverTimestamp() })`.
  5. return `{ id: newTrainingRef.id, businessId }`.
  This is the standard Firestore auto-increment workaround (app design spec §5). The transaction guarantees uniqueness under normal contention; rules validate shape only (see §4.5) — monotonicity is a transaction-integrity property, not something the spec asks rules to enforce.
- `updateTraining(trainingId, updates: Partial<NewTrainingInput>): Promise<void>` — when `updates.exercises` is present, also writes `exerciseIds: updates.exercises.map(e => e.exerciseId)`. `businessId` is never modified.
- `deleteTraining(trainingId): Promise<void>` — plain `deleteDoc`. Referencing calendar sessions keep their denormalized labels (§2.3, §5).
- `listTrainings(afterDoc?, filters?: { ageGroupTarget?: string }): Promise<{ trainings: Training[]; lastDoc }>` — `orderBy('businessId')`, `limit(25)`, optional `where('ageGroupTarget','==',…)`, `startAfter(afterDoc)` when paging.
- `findTrainingByBusinessId(businessId: string): Promise<Training | null>` — `where('businessId','==',businessId)`, `limit(1)`. Powers the "filter by business ID" case as an exact-match lookup.
- `getTraining(trainingId): Promise<Training | null>`.

### 4.4 Components

- `src/trainings/TrainingBuilderDialog.tsx` — create/edit dialog, the critical form of this plan (app design spec §13 names "training builder (exercise picker with order/duration)" a required component test):
  - `name`, `description`, `ageGroupTarget` fields.
  - **Ordered exercise picker**: an "Add exercise" control revealing a paginated picker backed by `listExercises` (reuses the same list + "Load more"); selecting an exercise appends a row. Each row shows the exercise name, a `durationMinutes` number `Input`, **up / down** reorder buttons (array-index swap — no drag-and-drop dependency), and a remove button. `order` is recomputed from array index on save (`exercises.map((e, i) => ({ ...e, order: i + 1 }))`).
  - A running **total duration** (sum of `durationMinutes`) is displayed.
  - **Edit mode**: resolves stored `exercises[].exerciseId` to names via `getExercisesByIds`. Any id absent from the result renders as a **"⚠ Deleted exercise"** row — still shows its stored `order` / `durationMinutes`, still removable/reorderable — so a training that outlived one of its exercises stays editable and the admin can clean it up (§2.3).
  - Save → `createTraining` / `updateTraining`.
- `src/trainings/TrainingsPage.tsx` — the `/trainings` screen:
  - Header: title + "New training".
  - Filters: an age-group text `Input` (exact match) and a business-ID text `Input`. A non-empty business-ID field switches the list to the single `findTrainingByBusinessId` result; clearing it returns to the paginated/age-filtered list.
  - List rows inside a content card: `businessId` (tabular), name, `ageGroupTarget`, exercise count, total minutes. Row opens `TrainingBuilderDialog` in edit mode; each row has a delete affordance.
  - Delete → `ConfirmDialog` ("Delete TR-0007? Past calendar entries for this training keep their label but will no longer link to it.").
  - "Load more" when `lastDoc` is non-null.

### 4.5 Rules — `firestore.rules`

Add at the top level (sibling of `teams`), reusing `isAdmin()`:

```
match /trainings/{trainingId} {
  allow read: if isAdmin();
  allow create: if isAdmin()
    && request.resource.data.createdBy == request.auth.uid
    && request.resource.data.businessId is string
    && request.resource.data.name is string
    && request.resource.data.name.size() > 0
    && request.resource.data.exercises is list
    && request.resource.data.exerciseIds is list;
  allow update: if isAdmin()
    && request.resource.data.name is string
    && request.resource.data.name.size() > 0
    && request.resource.data.exercises is list
    && request.resource.data.exerciseIds is list
    && request.resource.data.businessId == resource.data.businessId;
  allow delete: if isAdmin();
}

match /counters/{counterId} {
  allow read: if isAdmin();
  allow write: if isAdmin()
    && request.resource.data.lastSequence is int
    && request.resource.data.lastSequence >= 0;
}
```

### 4.6 Indexes — `firestore.indexes.json`

```json
{
  "collectionGroup": "trainings",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "ageGroupTarget", "order": "ASCENDING" },
    { "fieldPath": "businessId", "order": "ASCENDING" }
  ]
}
```

(`orderBy('businessId')` alone and `where('businessId','==',…)` use the automatic single-field index.)

## 5. Team Calendar tab

### 5.1 Month-grid helper — `src/calendar/monthGrid.ts` (pure)

- `buildMonthGrid(year: number, month: number): { date: string; inMonth: boolean }[][]` — returns whole weeks (arrays of 7), Monday-first, each cell an ISO `"YYYY-MM-DD"` string with an `inMonth` flag for leading/trailing days of adjacent months.
- `addMonths(year: number, month: number, delta: number): { year: number; month: number }` — prev/next navigation.
- `formatMonthLabel(year: number, month: number): string` — e.g. `"September 2026"`.
- `monthRange(year: number, month: number): { start: string; end: string }` — the first and last ISO date strings of the month, for the Firestore range query.
- Pure, unit-tested — keeps all date arithmetic out of the component.

### 5.2 Types — `src/types/calendarSession.ts`

- `CalendarSession` — `{ id; date: string; trainingId: string; trainingBusinessId: string; trainingName: string; notes: string; createdBy; createdAt }`.
- `NewCalendarSessionInput` — `{ date: string; trainingId: string; trainingBusinessId: string; trainingName: string; notes: string }`.

### 5.3 Data layer — `src/calendar/calendarApi.ts`

- `listCalendarSessions(teamId: string, startDate: string, endDate: string): Promise<CalendarSession[]>` — `where('date','>=',startDate)`, `where('date','<=',endDate)`, `orderBy('date')`, `limit(200)` (defensive). Operates on `teams/{teamId}/calendar`.
- `createCalendarSession(teamId: string, input: NewCalendarSessionInput, creatorUid: string): Promise<string>` — `addDoc`, sets `createdBy` + `createdAt: serverTimestamp()`. The caller supplies `trainingBusinessId` / `trainingName` from the `Training` object the admin picked, so they are denormalized at write time (§2.4).
- `deleteCalendarSession(teamId: string, sessionId: string): Promise<void>`.
- No update function — v1 is create + view + delete only (§2.3, and the app design spec §7 describes the calendar as "assign a training to a date").

### 5.4 Components

- `src/calendar/AssignTrainingDialog.tsx` — opened from a day cell:
  - `date` field, pre-filled with the clicked day's ISO string, editable (`type="date"`).
  - Training picker: reuses `listTrainings` (paginated) plus a business-ID search box (`findTrainingByBusinessId`); selecting a training captures its `id` / `businessId` / `name`.
  - `notes` textarea.
  - Save → `createCalendarSession`.
- `src/calendar/TeamCalendarTab.tsx` — `props: { teamId: string }`:
  - Month header with `formatMonthLabel` and prev / next buttons; changing month calls `listCalendarSessions` for the new `monthRange`.
  - A 7-column grid from `buildMonthGrid`; out-of-month cells are muted.
  - Each day cell lists its sessions as chips: `"TR-0007 · Passing circuit"`, rendered from the denormalized label so they survive deletion of the training. A chip links to `/trainings` filtered by its business ID (a deleted training just yields no result there — §2.3). Each chip has a ✕ that opens `ConfirmDialog` → `deleteCalendarSession`.
  - Clicking an empty area of a day cell opens `AssignTrainingDialog` for that date.
- `src/teams/TeamPage.tsx` — add `'calendar'` to the `Tab` union and a **"Calendar"** tab button (placed after "Overview"), rendering `<TeamCalendarTab teamId={teamId} />`.

### 5.5 Rules — `firestore.rules`

Inside `match /teams/{teamId}`, add a `calendar` sub-block with its own `isTeamAdmin()` (the same per-match-block helper pattern the `players` block already uses):

```
match /calendar/{sessionId} {
  function isTeamAdmin() {
    return request.auth != null && request.auth.token.email in
      get(/databases/$(database)/documents/teams/$(teamId)).data.adminEmails;
  }
  allow read: if isTeamAdmin();
  allow create: if isTeamAdmin()
    && request.resource.data.createdBy == request.auth.uid
    && request.resource.data.date is string;
  allow update: if false;
  allow delete: if isTeamAdmin();
}
```

Viewers get nothing here (app design spec §6.6). No composite index needed — the month query is a single-field `date` range.

## 6. Player data export (compliance)

### 6.1 Data gathering

- `src/players/physicalTestsApi.ts` gains `listAllPhysicalTests(teamId: string, playerId: string): Promise<PhysicalTest[]>` — one `getDocs(query(base, orderBy('date','desc'), limit(500)))`. Bounded, and export is a rare admin action.

### 6.2 Export builder — `src/players/playerExport.ts`

- `buildPlayerExport(player: Player, physicalTests: PhysicalTest[]): PlayerExport` — pure. Returns a plain, fully-serializable object:
  ```
  {
    exportedAt: <ISO string>,
    player: { …every field of the player doc: number, fullName, dob, nationality,
              licenseNumber, position, playerPhone, guardians, teamName, ageGroup,
              season, skills (scores + notes + priority), avgScore, level,
              developmentPlan, consent, viewerEmails, createdBy, createdAt, updatedAt },
    physicalTests: [ …each physicalTest doc as stored… ]
  }
  ```
  Firestore `Timestamp` values (`createdAt`, `updatedAt`) are normalized to ISO strings; any unresolved `serverTimestamp()` sentinel is dropped. Unit-tested for completeness and JSON-serializability.
- `downloadPlayerExport(player: Player, physicalTests: PhysicalTest[]): void` — `JSON.stringify(buildPlayerExport(...), null, 2)` → `Blob` → object URL → programmatic `<a download="player-<fullName>-<date>.json">` click → revoke URL.

### 6.3 UI

- `src/players/PlayerCardPage.tsx` — in the existing admin-only "Danger zone" section (renamed to **"Data & privacy"**, since it now holds a non-destructive action too), add an **"Export data (JSON)"** button beside "Delete player". On click: `listAllPhysicalTests` then `downloadPlayerExport`. No confirmation dialog (non-destructive). A brief caption notes the export covers the full record including physical-test history.

### 6.4 Rules

None. Export reads only what the admin can already read.

## 7. `/privacy` static page

### 7.1 Component — `src/legal/PrivacyPage.tsx`

A static content page (no data layer). Sections, covering app design spec §10:

- **Draft banner** at the top: "Draft policy — pending review by the club and its legal advisor before production use." Also a file-header comment saying the same.
- **What data we collect** — the fields already in the source spreadsheet only (data minimisation): player contact & registration details, guardian contact details, volleyball skill scores and coach notes, physical-test measurements, development-plan objectives and notes. No analytics or tracking.
- **Why we collect it** — managing player development for Volley Club Belair (team rosters, skill tracking, training planning).
- **Who can see it** — club administrators; and, once the parent-access feature ships, a linked parent/guardian for their own child's record only.
- **The data subjects are minors** — players are aged 13–15; the parent or legal guardian is the party who gives consent, and consent is recorded per player.
- **Retention** — kept while the player is registered with the club; deleted on request, or when the player leaves the club.
- **Your rights / data requests** — access, correction, and erasure requests are handled by contacting the club at `<placeholder — insert real contact address>` (flagged as needing a real value before publication).
- **Security** — data is encrypted in transit (HTTPS) and at rest; access is controlled by per-record rules.

### 7.2 Routing & discoverability

- `src/App.tsx` — `<Route path="/privacy" element={<PrivacyPage />} />` as a **public** sibling of `/login` and `/finish-sign-in` (outside `AuthenticatedLayout`).
- A small "Privacy" footer link on `LoginPage` and in `AppShell` (near "Sign out").

### 7.3 Test

`PrivacyPage.test.tsx` — asserts the compliance-required sections render: headings/text for what-data, why, who-can-see-it, the minors/guardian-consent statement, retention, and the data-request contact. Guards the §10 checklist against future edits.

## 8. Roster table fix (isolated usability fix)

`src/teams/TeamRosterTable.tsx` currently renders all 8 skill scores as separate columns, forcing horizontal scroll (visible in `reference/single-team.png`). This is a usability bug, not a redesign.

Fix: remove the 8 per-skill `<th>` / `<td>` columns and the now-unused `SKILL_COLUMNS` constant and `SkillKey` import. Columns become **# · Name · Position · Skill avg · Level** — the existing "Avg" column (already `player.avgScore.toFixed(1)`) *is* the single averaged skill column the app design spec's Overview sheet uses; relabel its header "Skill avg". Five columns fit without scroll. The `overflow-x-auto` wrapper stays as a harmless guard for very narrow phones. Update `TeamRosterTable.test.tsx`, which currently asserts the per-skill column headers.

## 9. Testing strategy

Same priorities as Plans 1 and 2:

- **Firestore rules tests (highest priority)** — new files `tests/rules/exercises.rules.test.ts`, `tests/rules/trainings.rules.test.ts` (covering `trainings` and `counters/trainings`), `tests/rules/calendar.rules.test.ts`. Each access-control claim gets an `assertSucceeds` / `assertFails` pair: admin can CRUD exercises/trainings, non-admin (role `viewer`) cannot read or write either; the counter is admin-only; a team admin can read/create/delete calendar sessions, a non-team-admin and a linked viewer cannot; calendar `update` is denied for everyone.
- **Unit tests** — `businessId.test.ts` (padding + sequence), `monthGrid.test.ts` (week bucketing, leading/trailing days, `addMonths` year rollover, `monthRange`), `playerExport.test.ts` (shape completeness, Timestamp normalisation, JSON-serializability).
- **Component tests** — `TrainingBuilderDialog.test.tsx` (add / reorder / remove exercise rows, duration entry, total, deleted-exercise row, save payload with recomputed `order` + `exerciseIds`), `ExerciseFormDialog.test.tsx`, `ExercisesPage.test.tsx` (category filter, delete confirm shows usage count), `TrainingsPage.test.tsx` (business-ID filter switches to single result), `TeamCalendarTab.test.tsx` (month navigation re-queries, session chips render from denormalised labels, delete flow), `AssignTrainingDialog.test.tsx`, `PrivacyPage.test.tsx`, and updates to `PlayerCardPage.test.tsx` (export button) and `TeamRosterTable.test.tsx` (column change).

## 10. Open items / deferred

- **Viewer invite flow** — still deferred (app design spec §6.4 / §14). The nav shell showing admin-only destinations to a would-be viewer is accepted for now and should be revisited when that flow is built (role-conditional nav rendering, or a viewer-specific shell).
- **`/privacy` content** — ships as a draft; the club must supply a real data-request contact address and have the policy reviewed before it is treated as authoritative.
- **Calendar month view** — the Monday-first week layout and the mobile rendering of a 7-column grid should be checked in a real browser once built (no automated visual regression in this project).
- **`businessId` monotonicity under adversarial writes** — the transaction guarantees correctness under normal contention; a determined admin could still write a malformed counter. Accepted under the "admins are trusted club staff" threat model; not worth a Cloud Function (which would break the free-tier constraint).
- **Dark mode, full icon audit** — still deferred per the design system doc.
