# Volley Skills — Bulk Import Design Spec

Date: 2026-09-08
Status: Approved for planning

## 1. Purpose

Add a **bulk import** feature so an admin can create many entries at once by
pasting or uploading a JSON array, for four entity types: **exercises**,
**trainings**, **teams**, and **players**.

Driving use cases:

- **AI-generated content** — paste a JSON array produced by an LLM (e.g. "generate
  15 U17 defense exercises").
- **Sharing a library** — load a JSON pack of exercises/trainings from another
  coach or club.
- **Migrating / seeding** — occasional load of real data prepared outside the app.

Round-tripping the app's own export format is explicitly *not* a goal; the input
shapes below are optimised for hand- and AI-authoring, not for symmetry with
`playerExport`.

## 2. Scope Decisions

- **Per-page entry point.** An "Import" button sits next to the existing "New X"
  button on each entity's page. There is no global importer screen.
- **Bare JSON array.** Each import accepts a top-level JSON array of objects of the
  one entity type implied by the page. No wrapper object, no `type` tag.
- **Paste or file.** The dialog offers a `<textarea>` and a `.json` file picker;
  both produce the same string that is then parsed.
- **Always create new.** No duplicate detection or matching. Every array element
  becomes a new document even if an identical one already exists.
- **All-or-nothing.** The entire array is validated first. If any element is
  invalid, nothing is written and every error is listed. The admin fixes the JSON
  and retries.
- **Admin only.** Exercises/trainings/teams import is gated by the existing
  `RequireAdmin` routes; player import additionally requires team-admin rights on
  the target team (enforced by existing rules).
- **No `firestore.rules` changes.** Writes go through batched/transactional
  `create`s that each already satisfy the current create constraints.

### Out of scope

- Updating or merging into existing documents.
- Importing player `physicalTests`, `calendar` sessions, skill/physical-test
  guides.
- Exporting (already covered for players by `playerExport`; not extended here).
- Undo / rollback of a completed import beyond per-entry manual delete.
- CSV or spreadsheet input.

## 3. Architecture

New feature folder `src/bulkImport/` holds the shared, entity-agnostic pieces.
Each existing feature folder gains a small, pure per-entity adapter and one new
data-access function in its existing `<feature>Api.ts`.

```
src/bulkImport/
  parseJsonArray.ts        pure: string -> unknown[] | error
  parseJsonArray.test.ts
  BulkImportDialog.tsx      generic modal (textarea + file + validate + commit)
  BulkImportDialog.test.tsx
  types.ts                 shared ImportAdapter / ValidationResult types

src/exercises/
  exercisesImport.ts        validateExerciseRows(rows) -> { inputs, errors }
  exercisesImport.test.ts
  exercisesApi.ts           + bulkCreateExercises(inputs, uid)

src/teams/
  teamsImport.ts            validateTeamRows(rows) -> { inputs, errors }
  teamsImport.test.ts
  teamsApi.ts               + bulkCreateTeams(inputs, uid, creatorEmail)

src/players/
  playersImport.ts          validatePlayerRows(rows) -> { inputs, errors }
  playersImport.test.ts
  playersApi.ts             + bulkCreatePlayers(teamId, team, inputs, uid)

src/trainings/
  trainingsImport.ts        validateTrainingRows(rows, nameToId) -> { inputs, errors }
  trainingsImport.test.ts
  trainingsApi.ts           + resolveExerciseNames(names) -> Map<string, string[]>
                            + bulkCreateTrainings(inputs, uid)
```

### 3.1 Responsibilities

- **`parseJsonArray(text)`** — pure. Returns `{ ok: true, rows: unknown[] }` or
  `{ ok: false, error: string }`. Rejects: invalid JSON, a non-array top level, an
  empty array, and an array longer than `MAX_IMPORT` (100). The error string is
  shown verbatim in the dialog.

- **`BulkImportDialog`** — generic modal styled like the existing dialogs
  (`ExerciseFormDialog` etc.). Props:

  ```ts
  interface BulkImportDialogProps {
    title: string;                       // e.g. "Import exercises"
    exampleJson: string;                 // shown in a collapsible <details>
    validate: (rows: unknown[]) => ValidationResult;   // sync, pure per entity
    commit: () => Promise<void>;          // closure already bound to parsed inputs
    onClose: () => void;
    onImported: (count: number) => void;
  }
  ```

  Flow: paste/upload → **Validate** button runs `parseJsonArray` then `validate`
  → shows "`N` entries ready" or a numbered `<ul>` of errors → **Import N
  entries** button (enabled only when parse + validate are clean) runs `commit`
  → on success calls `onImported(count)`; on failure shows a single ret/write
  error and leaves the dialog open.

  Because `validate` needs the parsed inputs and `commit` needs them too, the
  page component owns a small piece of state: it re-derives `{ inputs, errors }`
  on each Validate press and builds the `commit` closure from the last clean
  `inputs`. (Detail for the plan, not a hard contract.)

- **`validateXRows(rows)`** — pure, one per entity. Returns:

  ```ts
  interface ValidationResult<TInput> {
    inputs: TInput[];     // parsed + normalised, order preserved; empty if errors
    errors: string[];     // human-readable, row-numbered; empty on success
  }
  ```

  Error messages are 1-indexed and name the field:
  `row 3: "category" must be one of warmup, physical, service, …`.

- **`bulkCreateX(...)`** — in the existing api module. Owns the Firestore write.
  Returns the created count (or ids). See §5 for the write strategy per entity.

### 3.2 Atomicity and the 100-entry cap

All-or-nothing is implemented with a single Firestore `writeBatch` (exercises,
teams, players) or a single `runTransaction` (trainings — needs a counter read).
Both are capped by Firestore at 500 writes. `MAX_IMPORT = 100` keeps every import
comfortably under that with no chunking, so a partial write is impossible. Pastes
over 100 entries are rejected by `parseJsonArray` with
`"Import is limited to 100 entries at a time; split the file into smaller batches."`

## 4. Input formats

All examples are the literal top-level JSON. Unknown keys in an element are
ignored (not an error) so AI output with extra prose fields still imports.

### 4.1 Exercises — page: `/exercises`

```json
[
  { "name": "Butterfly passing", "description": "3-player weave, continuous", "category": "reception" },
  { "name": "Block footwork ladder", "category": "defense" }
]
```

| Field | Rule |
|---|---|
| `name` | required, non-empty string |
| `category` | required, one of `warmup`, `physical`, `service`, `setting`, `defense`, `reception`, `attack`, `compound`, `game` |
| `description` | optional string, defaults to `""` |

Written doc: `{ name, description, category, createdBy: uid, createdAt: serverTimestamp() }`.

### 4.2 Teams — page: `/` (teams list)

```json
[
  { "name": "VCB U15 Girls", "club": "Volley Club Belair", "ageGroup": "U15", "season": "2026-27", "description": "" }
]
```

| Field | Rule |
|---|---|
| `name` | required, non-empty string |
| `club` | optional string, defaults to `""` |
| `ageGroup` | optional string, defaults to `""` — recommended, because players later denormalise it |
| `season` | optional string, defaults to `""` — recommended, same reason |
| `description` | optional string, defaults to `""` |

Written doc mirrors `createTeam`: the five fields above plus
`notes: ""`, `adminEmails: [creatorEmail]`,
`developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: "" }`,
`createdBy: uid`, `createdAt: serverTimestamp()`.

### 4.3 Players — page: team roster tab (`teamId` from the route)

```json
[
  {
    "number": 7,
    "fullName": "Jane Doe",
    "dob": "2010-04-12",
    "nationality": "LU",
    "licenseNumber": "12345",
    "position": "Outside hitter",
    "playerPhone": "",
    "guardians": [
      { "relation": "mother", "name": "Mary Doe", "phone": "+352 000", "email": "mary@example.com" }
    ],
    "skills": { "serve": 5, "attack": 6, "set": null, "defence": 4, "reception": 7, "jump": 5, "speed": 6, "iq": 5 }
  }
]
```

| Field | Rule |
|---|---|
| `number` | required, finite number |
| `fullName` | required, non-empty string |
| `dob` | optional; when absent, stored as `""`; when present, must match `^\d{4}-\d{2}-\d{2}$` (a malformed value is a validation error, not coerced) |
| `nationality`, `licenseNumber`, `position`, `playerPhone` | optional strings, default `""` |
| `guardians` | optional array; each entry needs `relation` in `mother`/`father`/`other` and a non-empty `name`; `phone`/`email` default `""`. Defaults to `[]` |
| `skills` | optional object; keys are a subset of `serve, attack, set, defence, reception, jump, speed, iq`; each value is `null` or a number `1`–`10`. Missing keys are treated as `null`. Unknown keys are an error |

Importer-controlled fields (any value in the JSON is ignored):

- `skills` expanded to the full `Record<SkillKey, { score, notes: "", priority: false }>` shape.
- `avgScore` / `level` computed via `computeAvgScore` / `computeLevel`.
- `teamName` / `ageGroup` / `season` copied from the target team doc.
- `viewerEmails: []`.
- `consent: { given: false, date: null, confirmedBy: null }` — matches the
  migration rule in the app design spec §9. An admin confirms consent per player
  afterward through the existing player-card flow.
- `developmentPlan` empty, `createdBy: uid`, `createdAt` / `updatedAt`
  `serverTimestamp()`.

### 4.4 Trainings — page: `/trainings`

```json
[
  {
    "name": "U17 defense circuit",
    "description": "Rotational blocking + dig transition",
    "ageGroupTarget": "U17",
    "exercises": [
      { "name": "Butterfly passing", "durationMinutes": 15 },
      { "name": "Block footwork ladder", "durationMinutes": 10 }
    ]
  }
]
```

| Field | Rule |
|---|---|
| `name` | required, non-empty string |
| `description` | optional string, default `""` |
| `ageGroupTarget` | optional string, default `""` |
| `exercises` | optional array, default `[]`; each entry needs a non-empty `name` and a `durationMinutes` number `> 0` |

Each `exercises` entry becomes `{ exerciseId, order, durationMinutes }` where
`order` is the 1-based position in the array. `exerciseIds` is derived as the
list of resolved ids (matching `createTraining`).

**Exercise-name resolution.** Before validation, `resolveExerciseNames` collects
the distinct exercise names across the whole paste and queries
`where('name', 'in', chunk)` on `/exercises` in chunks of 30, returning
`Map<name, string[]>` (ids per name). `validateTrainingRows(rows, nameToId)` then:

- 0 ids for a name → `row N: exercise "X" not found`.
- more than 1 id for a name → `row N: exercise "X" is ambiguous (3 exercises share that name)`.
  This is a direct consequence of "always create new" allowing duplicate exercise
  names; the admin renames or removes duplicates and retries.

## 5. Write strategy per entity

| Entity | Mechanism | Notes |
|---|---|---|
| Exercises | one `writeBatch` of `set` on fresh `doc(collection(db,'exercises'))` refs | ≤ 100 writes |
| Teams | one `writeBatch` | ≤ 100 writes; `adminEmails: [creatorEmail]` so the creator passes the team `create` rule |
| Players | one `writeBatch` under `teams/{teamId}/players` | ≤ 100 writes; each doc satisfies `validSkills` since scores are pre-validated to `null` or 1–10 |
| Trainings | one `runTransaction` | reads `counters/trainings` once, writes `lastSequence + N`, then N training docs with `businessId = formatBusinessId(lastSequence + i)` for `i` in `1..N`. ≤ 101 writes. Same counter contention profile as a single `createTraining` |

`resolveExerciseNames` runs before the transaction (reads are cheap, bounded
`in` queries) so the transaction body does no exercise reads.

## 6. UI

Each list page gains a secondary "Import" button beside "New X":

- `ExercisesPage` — header actions row.
- `TrainingsPage` — header actions row.
- `TeamsListPage` — header actions row.
- Team roster tab (`TeamRosterTable` / its container in `TeamPage`) — beside the
  existing add-player affordance.

Clicking opens `BulkImportDialog` with that entity's `exampleJson`, `validate`,
and a `commit` closure. On success the dialog closes and the page reloads its
first page of results (same pattern as the existing `onSaved` handlers), showing
a transient "Imported N exercises" message.

Player and training dialogs additionally show a one-line hint:

- Players: "Imported players start with consent not given — confirm each one on
  their card."
- Trainings: "Exercises are matched by name against the existing library."

## 7. Testing

Priority order per the app design spec §13: rules, then pure logic, then
components.

**Rules (`tests/rules/`)**

- A `writeBatch` creating several valid `exercises` in one commit is accepted for
  an admin.
- A `writeBatch` where one element violates a create constraint (e.g. bad
  `category`, missing `createdBy`) rejects the **whole** batch.
- The equivalent accept/reject pair for a `players` batch (team-admin +
  `validSkills`).

**Pure unit tests**

- `parseJsonArray`: invalid JSON, object at top level, empty array, 101 entries,
  100 entries OK, happy path.
- `validateExerciseRows`: missing `name`, empty `name`, missing/invalid
  `category`, description defaulting, unknown keys ignored.
- `validateTeamRows`: missing `name`, defaults applied.
- `validatePlayerRows`: missing `number`, non-numeric `number`, missing
  `fullName`, bad `dob` format, guardian missing `relation` / bad `relation` /
  missing `name`, `skills` value out of 1–10, `skills` unknown key, `skills`
  partial map expands with `null`s, `avgScore` / `level` computed.
- `validateTrainingRows` (with an injected `nameToId` map): missing `name`,
  `exercises` entry missing `name`, `durationMinutes` ≤ 0 or non-numeric,
  unknown exercise name, ambiguous exercise name, `order` assigned by position.
- `businessId` sequencing: N trainings get consecutive ids from a given
  `lastSequence`.

**Component tests**

- `BulkImportDialog`: invalid paste shows the error list and disables Import;
  valid paste enables Import and calls `commit` exactly once; a rejected
  `commit` promise surfaces an error and keeps the dialog open.

## 8. Known limitations (documented, not addressed here)

- Two players with the same `number` on one team are allowed (true of the
  existing single-add flow too).
- Exercise-name ambiguity blocks a training import until duplicates are resolved.
- Imports over 100 entries must be split by the admin.
- No dry-run preview table; validation output is the error list only.
- A `commit` that fails mid-flight (network) writes nothing, but the admin must
  re-press Import — there is no auto-retry.
