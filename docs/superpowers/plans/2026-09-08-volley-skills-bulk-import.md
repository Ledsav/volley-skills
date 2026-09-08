# Bulk Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin create many exercises, trainings, teams, or players at once by pasting or uploading a bare JSON array from a per-page "Import" dialog.

**Architecture:** A shared, entity-agnostic `src/bulkImport/` folder holds a pure `parseJsonArray` helper and a generic `BulkImportDialog` component. Each feature folder gains a pure `validate<Entity>Rows` function (row-numbered error strings, no I/O) and one `bulkCreate<Entity>` function in its existing `<feature>Api.ts` that commits every row in a single Firestore `writeBatch` (or, for trainings, a single `runTransaction` that also bumps the `counters/trainings` sequence). Validation is all-or-nothing: any bad row means nothing is written.

**Tech Stack:** React 18, TypeScript (strict), Vite, Firebase Firestore client SDK v10 (modular), Vitest, React Testing Library (`fireEvent`, no user-event), `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-09-08-volley-skills-bulk-import-design.md`

## Global Constraints

- **No `firestore.rules` changes.** Every document a `bulkCreate` writes must already satisfy the existing `create` rule for its collection (`createdBy == request.auth.uid`, category enums, `validSkills`, team-admin membership). Task 9 proves this with rules tests.
- **All-or-nothing.** `validate<Entity>Rows` returns `{ inputs: [], errors: [...] }` if *any* row is invalid. `bulkCreate<Entity>` is a single batch/transaction — Firestore commits it atomically or not at all.
- **`MAX_IMPORT = 100`.** `parseJsonArray` rejects longer arrays. Keeps every commit under Firestore's 500-write batch/transaction ceiling with no chunking.
- **Always create new.** No duplicate detection. Every array element becomes a fresh document.
- **Error message style:** 1-indexed, field-named, lower-case, no trailing period: `row 3: "category" must be one of warmup, physical, service, setting, defense, reception, attack, compound, game`.
- **Optional field typing:** an absent optional field takes its default (`""` / `[]` / `null`); an optional field present with the wrong JSON type is a validation error, never silently coerced.
- **Unknown top-level keys on a row are ignored** (AI output often carries extra prose fields). Unknown keys *inside* a structured sub-object (`skills`) are an error.
- TypeScript `strict`, plus `noUnusedLocals` / `noUnusedParameters` — no unused symbols.
- Tests sit next to the code (`foo.ts` / `foo.test.ts`). Rules tests live in `tests/rules/` and run only via `npm run test:rules`.
- UI follows the design system: `Button` (`variant`/`size`), `Textarea` from `src/components/Input`, tokens `ink`/`slate`/`red`/`green`/`border`/`surface`/`bg`, radius `lg`/`md`, shadow `pop`. Modal overlay matches `ExerciseFormDialog` (`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4`).

---

## Task 1: Shared foundation — `parseJsonArray` + shared types

**Files:**
- Create: `src/bulkImport/types.ts`
- Create: `src/bulkImport/parseJsonArray.ts`
- Test: `src/bulkImport/parseJsonArray.test.ts`

**Interfaces:**
- Produces:
  - `interface ValidationResult<TInput> { inputs: TInput[]; errors: string[] }` (from `types.ts`)
  - `const MAX_IMPORT = 100`
  - `type ParseResult = { ok: true; rows: unknown[] } | { ok: false; error: string }`
  - `function parseJsonArray(text: string): ParseResult`
  - `function isPlainObject(value: unknown): value is Record<string, unknown>`

- [ ] **Step 1: Write `src/bulkImport/types.ts`**

```ts
export interface ValidationResult<TInput> {
  /** Parsed + normalised rows, order preserved. Empty when `errors` is non-empty. */
  inputs: TInput[];
  /** Human-readable, 1-indexed messages. Empty on success. */
  errors: string[];
}
```

- [ ] **Step 2: Write the failing test `src/bulkImport/parseJsonArray.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { parseJsonArray, isPlainObject, MAX_IMPORT } from './parseJsonArray';

describe('parseJsonArray', () => {
  it('rejects blank input', () => {
    expect(parseJsonArray('   ')).toEqual({ ok: false, error: 'paste or upload some JSON first' });
  });

  it('rejects invalid JSON with the parser message', () => {
    const result = parseJsonArray('[{bad}]');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^that is not valid JSON: /i);
  });

  it('rejects a non-array top level', () => {
    expect(parseJsonArray('{"name":"x"}')).toEqual({
      ok: false,
      error: 'the top level must be a JSON array (square brackets)',
    });
  });

  it('rejects an empty array', () => {
    expect(parseJsonArray('[]')).toEqual({ ok: false, error: 'the array is empty — nothing to import' });
  });

  it('rejects more than MAX_IMPORT entries', () => {
    const many = JSON.stringify(new Array(MAX_IMPORT + 1).fill({ a: 1 }));
    expect(parseJsonArray(many)).toEqual({
      ok: false,
      error: 'import is limited to 100 entries at a time; split the file into smaller batches',
    });
  });

  it('accepts exactly MAX_IMPORT entries', () => {
    const many = JSON.stringify(new Array(MAX_IMPORT).fill({ a: 1 }));
    const result = parseJsonArray(many);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toHaveLength(MAX_IMPORT);
  });

  it('returns the parsed rows on success', () => {
    expect(parseJsonArray('[{"name":"x"},{"name":"y"}]')).toEqual({
      ok: true,
      rows: [{ name: 'x' }, { name: 'y' }],
    });
  });
});

describe('isPlainObject', () => {
  it('is true for a non-null non-array object', () => {
    expect(isPlainObject({ a: 1 })).toBe(true);
  });
  it('is false for null, arrays, and primitives', () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject([1, 2])).toBe(false);
    expect(isPlainObject('x')).toBe(false);
    expect(isPlainObject(3)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test — expect failure**

Run: `npx vitest run src/bulkImport/parseJsonArray.test.ts`
Expected: FAIL — `Failed to resolve import "./parseJsonArray"`.

- [ ] **Step 4: Write `src/bulkImport/parseJsonArray.ts`**

```ts
export const MAX_IMPORT = 100;

export type ParseResult = { ok: true; rows: unknown[] } | { ok: false; error: string };

export function parseJsonArray(text: string): ParseResult {
  if (text.trim() === '') {
    return { ok: false, error: 'paste or upload some JSON first' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `that is not valid JSON: ${message}` };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'the top level must be a JSON array (square brackets)' };
  }
  if (parsed.length === 0) {
    return { ok: false, error: 'the array is empty — nothing to import' };
  }
  if (parsed.length > MAX_IMPORT) {
    return {
      ok: false,
      error: `import is limited to ${MAX_IMPORT} entries at a time; split the file into smaller batches`,
    };
  }
  return { ok: true, rows: parsed };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 5: Run the test — expect pass**

Run: `npx vitest run src/bulkImport/parseJsonArray.test.ts`
Expected: PASS (7 + 2 assertions).

- [ ] **Step 6: Typecheck & lint**

Run: `npm run lint && npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/bulkImport/types.ts src/bulkImport/parseJsonArray.ts src/bulkImport/parseJsonArray.test.ts
git commit -m "feat: add parseJsonArray + shared bulk-import types"
```

---

## Task 2: Exercises — validator + `bulkCreateExercises`

**Files:**
- Create: `src/exercises/exercisesImport.ts`
- Test: `src/exercises/exercisesImport.test.ts`
- Modify: `src/exercises/exercisesApi.ts` (add `bulkCreateExercises`; add `writeBatch` to the `firebase/firestore` import)
- Modify: `src/exercises/exercisesApi.test.ts` (add `writeBatch` to the mock + a `bulkCreateExercises` test)

**Interfaces:**
- Consumes: `ValidationResult` from `src/bulkImport/types`; `isPlainObject` from `src/bulkImport/parseJsonArray`; `NewExerciseInput`, `EXERCISE_CATEGORIES` from `src/types/exercise`; `db` from `src/firebase/config`.
- Produces:
  - `const EXERCISE_IMPORT_EXAMPLE: string`
  - `function validateExerciseRows(rows: unknown[]): ValidationResult<NewExerciseInput>`
  - `async function bulkCreateExercises(inputs: NewExerciseInput[], creatorUid: string): Promise<number>` (returns count written)

- [ ] **Step 1: Write the failing validator test `src/exercises/exercisesImport.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { validateExerciseRows } from './exercisesImport';

describe('validateExerciseRows', () => {
  it('accepts a valid row and defaults description to empty', () => {
    const result = validateExerciseRows([{ name: 'Butterfly', category: 'reception' }]);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual([{ name: 'Butterfly', description: '', category: 'reception' }]);
  });

  it('trims the name and keeps a provided description', () => {
    const result = validateExerciseRows([{ name: '  Pepper  ', description: 'control', category: 'warmup' }]);
    expect(result.inputs).toEqual([{ name: 'Pepper', description: 'control', category: 'warmup' }]);
  });

  it('ignores unknown top-level keys', () => {
    const result = validateExerciseRows([{ name: 'X', category: 'game', notes: 'ignore me' }]);
    expect(result.errors).toEqual([]);
  });

  it('reports a missing or empty name', () => {
    const result = validateExerciseRows([{ category: 'warmup' }, { name: '   ', category: 'warmup' }]);
    expect(result.errors).toEqual(['row 1: "name" is required', 'row 2: "name" is required']);
    expect(result.inputs).toEqual([]);
  });

  it('reports an unknown category', () => {
    const result = validateExerciseRows([{ name: 'X', category: 'nonsense' }]);
    expect(result.errors).toEqual([
      'row 1: "category" must be one of warmup, physical, service, setting, defense, reception, attack, compound, game',
    ]);
  });

  it('reports a non-object row', () => {
    const result = validateExerciseRows(['nope', 42]);
    expect(result.errors).toEqual(['row 1: each entry must be a JSON object', 'row 2: each entry must be a JSON object']);
  });

  it('reports a wrong-typed description', () => {
    const result = validateExerciseRows([{ name: 'X', category: 'warmup', description: 5 }]);
    expect(result.errors).toEqual(['row 1: "description" must be text']);
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run: `npx vitest run src/exercises/exercisesImport.test.ts`
Expected: FAIL — cannot resolve `./exercisesImport`.

- [ ] **Step 3: Write `src/exercises/exercisesImport.ts`**

```ts
import { isPlainObject } from '../bulkImport/parseJsonArray';
import type { ValidationResult } from '../bulkImport/types';
import { EXERCISE_CATEGORIES, type NewExerciseInput } from '../types/exercise';

const CATEGORY_KEYS = EXERCISE_CATEGORIES.map((c) => c.key);

export const EXERCISE_IMPORT_EXAMPLE = `[
  {
    "name": "Butterfly passing",
    "description": "3-player weave, continuous",
    "category": "reception"
  },
  {
    "name": "Block footwork ladder",
    "category": "defense"
  }
]`;

export function validateExerciseRows(rows: unknown[]): ValidationResult<NewExerciseInput> {
  const inputs: NewExerciseInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const n = index + 1;
    if (!isPlainObject(row)) {
      errors.push(`row ${n}: each entry must be a JSON object`);
      return;
    }

    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (name === '') errors.push(`row ${n}: "name" is required`);

    if (!(typeof row.category === 'string' && (CATEGORY_KEYS as string[]).includes(row.category))) {
      errors.push(`row ${n}: "category" must be one of ${CATEGORY_KEYS.join(', ')}`);
    }

    let description = '';
    if (row.description !== undefined) {
      if (typeof row.description === 'string') description = row.description;
      else errors.push(`row ${n}: "description" must be text`);
    }

    if (name !== '' && typeof row.category === 'string' && (CATEGORY_KEYS as string[]).includes(row.category)) {
      inputs.push({ name, description, category: row.category as NewExerciseInput['category'] });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run src/exercises/exercisesImport.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `bulkCreateExercises` to `src/exercises/exercisesApi.ts`**

Add `writeBatch` to the existing `firebase/firestore` import list, then append:

```ts
import type { Exercise, ExerciseCategory, NewExerciseInput } from '../types/exercise';

export async function bulkCreateExercises(
  inputs: NewExerciseInput[],
  creatorUid: string
): Promise<number> {
  const batch = writeBatch(db);
  for (const input of inputs) {
    const ref = doc(collection(db, 'exercises'));
    batch.set(ref, { ...input, createdBy: creatorUid, createdAt: serverTimestamp() });
  }
  await batch.commit();
  return inputs.length;
}
```

- [ ] **Step 6: Write the failing api test — add to `src/exercises/exercisesApi.test.ts`**

In the `vi.hoisted` block add `mockWriteBatch: vi.fn(),`. In the `vi.mock('firebase/firestore', …)` factory add `writeBatch: mockWriteBatch,`. Add this test inside `describe('exercisesApi', …)`:

```ts
it('bulk-creates exercises in a single batch stamped with creator + timestamp', async () => {
  const batchSet = vi.fn();
  const batchCommit = vi.fn().mockResolvedValue(undefined);
  mockWriteBatch.mockReturnValue({ set: batchSet, commit: batchCommit });

  const count = await bulkCreateExercises(
    [
      { name: 'A', description: '', category: 'warmup' },
      { name: 'B', description: 'x', category: 'attack' },
    ],
    'coach-uid'
  );

  expect(count).toBe(2);
  expect(batchSet).toHaveBeenCalledTimes(2);
  expect(batchSet.mock.calls[0][1]).toMatchObject({
    name: 'A',
    category: 'warmup',
    createdBy: 'coach-uid',
    createdAt: 'server-timestamp',
  });
  expect(batchCommit).toHaveBeenCalledTimes(1);
});
```

Add `bulkCreateExercises` to the import at the top of the test file.

- [ ] **Step 7: Run all exercise tests — expect pass**

Run: `npx vitest run src/exercises/`
Expected: PASS (existing + 2 new).

- [ ] **Step 8: Typecheck & lint**

Run: `npm run lint && npx tsc -b`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/exercises/exercisesImport.ts src/exercises/exercisesImport.test.ts src/exercises/exercisesApi.ts src/exercises/exercisesApi.test.ts
git commit -m "feat: add exercise bulk-import validator and bulkCreateExercises"
```

---

## Task 3: Teams — validator + `bulkCreateTeams`

**Files:**
- Create: `src/teams/teamsImport.ts`
- Test: `src/teams/teamsImport.test.ts`
- Modify: `src/teams/teamsApi.ts` (add `bulkCreateTeams`; add `writeBatch` to the `firebase/firestore` import)
- Modify: `src/teams/teamsApi.test.ts` (add `writeBatch` to the mock + a `bulkCreateTeams` test)

**Interfaces:**
- Consumes: `ValidationResult` from `src/bulkImport/types`; `isPlainObject` from `src/bulkImport/parseJsonArray`; `NewTeamInput` from `src/teams/teamsApi`.
- Produces:
  - `const TEAM_IMPORT_EXAMPLE: string`
  - `function validateTeamRows(rows: unknown[]): ValidationResult<NewTeamInput>`
  - `async function bulkCreateTeams(inputs: NewTeamInput[], creatorUid: string, creatorEmail: string): Promise<number>`

- [ ] **Step 1: Write the failing validator test `src/teams/teamsImport.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { validateTeamRows } from './teamsImport';

describe('validateTeamRows', () => {
  it('accepts a full row', () => {
    const result = validateTeamRows([
      { name: 'VCB U15', club: 'VCB', ageGroup: 'U15', season: '2026-27', description: 'girls' },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual([
      { name: 'VCB U15', club: 'VCB', ageGroup: 'U15', season: '2026-27', description: 'girls' },
    ]);
  });

  it('defaults every optional field to an empty string', () => {
    const result = validateTeamRows([{ name: 'Solo' }]);
    expect(result.inputs).toEqual([{ name: 'Solo', club: '', ageGroup: '', season: '', description: '' }]);
  });

  it('trims the name and reports it when missing', () => {
    const result = validateTeamRows([{ name: '  ' }, {}]);
    expect(result.errors).toEqual(['row 1: "name" is required', 'row 2: "name" is required']);
    expect(result.inputs).toEqual([]);
  });

  it('reports a wrong-typed optional field', () => {
    const result = validateTeamRows([{ name: 'X', season: 2026 }]);
    expect(result.errors).toEqual(['row 1: "season" must be text']);
  });

  it('reports a non-object row', () => {
    const result = validateTeamRows(['x']);
    expect(result.errors).toEqual(['row 1: each entry must be a JSON object']);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/teams/teamsImport.test.ts`
Expected: FAIL — cannot resolve `./teamsImport`.

- [ ] **Step 3: Write `src/teams/teamsImport.ts`**

```ts
import { isPlainObject } from '../bulkImport/parseJsonArray';
import type { ValidationResult } from '../bulkImport/types';
import type { NewTeamInput } from './teamsApi';

export const TEAM_IMPORT_EXAMPLE = `[
  {
    "name": "VCB U15 Girls",
    "club": "Volley Club Belair",
    "ageGroup": "U15",
    "season": "2026-27",
    "description": ""
  }
]`;

const OPTIONAL_TEXT_FIELDS = ['club', 'ageGroup', 'season', 'description'] as const;

export function validateTeamRows(rows: unknown[]): ValidationResult<NewTeamInput> {
  const inputs: NewTeamInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const n = index + 1;
    if (!isPlainObject(row)) {
      errors.push(`row ${n}: each entry must be a JSON object`);
      return;
    }

    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (name === '') errors.push(`row ${n}: "name" is required`);

    const optionals: Record<string, string> = {};
    for (const field of OPTIONAL_TEXT_FIELDS) {
      if (row[field] === undefined) {
        optionals[field] = '';
      } else if (typeof row[field] === 'string') {
        optionals[field] = row[field] as string;
      } else {
        errors.push(`row ${n}: "${field}" must be text`);
      }
    }

    if (name !== '' && Object.keys(optionals).length === OPTIONAL_TEXT_FIELDS.length) {
      inputs.push({
        name,
        club: optionals.club,
        ageGroup: optionals.ageGroup,
        season: optionals.season,
        description: optionals.description,
      });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/teams/teamsImport.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `bulkCreateTeams` to `src/teams/teamsApi.ts`**

Add `writeBatch` to the `firebase/firestore` import list, then append:

```ts
export async function bulkCreateTeams(
  inputs: NewTeamInput[],
  creatorUid: string,
  creatorEmail: string
): Promise<number> {
  const batch = writeBatch(db);
  for (const input of inputs) {
    const ref = doc(collection(db, 'teams'));
    batch.set(ref, {
      ...input,
      notes: '',
      adminEmails: [creatorEmail],
      developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return inputs.length;
}
```

- [ ] **Step 6: Write the failing api test — add to `src/teams/teamsApi.test.ts`**

Add `mockWriteBatch: vi.fn(),` to the `vi.hoisted` block and `writeBatch: mockWriteBatch,` to the `firebase/firestore` mock factory (match the shapes already in that file). Import `bulkCreateTeams`. Add:

```ts
it('bulk-creates teams in one batch with creator as sole admin', async () => {
  const batchSet = vi.fn();
  const batchCommit = vi.fn().mockResolvedValue(undefined);
  mockWriteBatch.mockReturnValue({ set: batchSet, commit: batchCommit });

  const count = await bulkCreateTeams(
    [{ name: 'A', club: '', ageGroup: '', season: '', description: '' }],
    'coach-uid',
    'coach@example.com'
  );

  expect(count).toBe(1);
  expect(batchSet.mock.calls[0][1]).toMatchObject({
    name: 'A',
    notes: '',
    adminEmails: ['coach@example.com'],
    createdBy: 'coach-uid',
    createdAt: 'server-timestamp',
  });
  expect(batchCommit).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 7: Run all team tests — expect pass**

Run: `npx vitest run src/teams/`
Expected: PASS.

- [ ] **Step 8: Typecheck & lint**

Run: `npm run lint && npx tsc -b`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/teams/teamsImport.ts src/teams/teamsImport.test.ts src/teams/teamsApi.ts src/teams/teamsApi.test.ts
git commit -m "feat: add team bulk-import validator and bulkCreateTeams"
```

---

## Task 4: Players — `SKILL_KEYS`, validator, `bulkCreatePlayers`

**Files:**
- Modify: `src/types/player.ts` (export `SKILL_KEYS`)
- Create: `src/players/playersImport.ts`
- Test: `src/players/playersImport.test.ts`
- Modify: `src/players/playersApi.ts` (add `bulkCreatePlayers`; add `writeBatch` to the `firebase/firestore` import; import `computeAvgScore`/`computeLevel`, `SKILL_KEYS`, `Skills`)
- Modify: `src/players/playersApi.test.ts` (add `writeBatch` to the mock + a `bulkCreatePlayers` test)

**Interfaces:**
- Consumes: `ValidationResult` from `src/bulkImport/types`; `isPlainObject` from `src/bulkImport/parseJsonArray`; `Guardian`, `SkillKey`, `Skills`, `SKILL_KEYS`, `Player` from `src/types/player`; `Team` from `src/types/team`; `computeAvgScore`, `computeLevel` from `src/players/skillMath`.
- Produces:
  - `const SKILL_KEYS: SkillKey[]` (in `src/types/player.ts`)
  - `interface PlayerImportInput { number: number; fullName: string; dob: string; nationality: string; licenseNumber: string; position: string; playerPhone: string; guardians: Guardian[]; skills: Record<SkillKey, number | null> }`
  - `const PLAYER_IMPORT_EXAMPLE: string`
  - `function validatePlayerRows(rows: unknown[]): ValidationResult<PlayerImportInput>`
  - `async function bulkCreatePlayers(teamId: string, team: Team, inputs: PlayerImportInput[], creatorUid: string): Promise<number>`

- [ ] **Step 1: Add `SKILL_KEYS` to `src/types/player.ts`**

Below the `SkillKey` type:

```ts
export const SKILL_KEYS: SkillKey[] = [
  'serve', 'attack', 'set', 'defence', 'reception', 'jump', 'speed', 'iq',
];
```

- [ ] **Step 2: Write the failing validator test `src/players/playersImport.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { validatePlayerRows } from './playersImport';

const NULL_SKILLS = {
  serve: null, attack: null, set: null, defence: null,
  reception: null, jump: null, speed: null, iq: null,
};

describe('validatePlayerRows', () => {
  it('accepts a minimal row and fills defaults', () => {
    const result = validatePlayerRows([{ number: 7, fullName: 'Jane Doe' }]);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual([
      {
        number: 7,
        fullName: 'Jane Doe',
        dob: '',
        nationality: '',
        licenseNumber: '',
        position: '',
        playerPhone: '',
        guardians: [],
        skills: NULL_SKILLS,
      },
    ]);
  });

  it('reports a missing or non-numeric number', () => {
    const result = validatePlayerRows([{ fullName: 'A' }, { number: '3', fullName: 'B' }]);
    expect(result.errors).toEqual([
      'row 1: "number" is required and must be a number',
      'row 2: "number" is required and must be a number',
    ]);
  });

  it('reports a missing fullName', () => {
    const result = validatePlayerRows([{ number: 1 }]);
    expect(result.errors).toEqual(['row 1: "fullName" is required']);
  });

  it('reports a malformed dob but accepts YYYY-MM-DD', () => {
    expect(validatePlayerRows([{ number: 1, fullName: 'A', dob: '12/03/2010' }]).errors).toEqual([
      'row 1: "dob" must be YYYY-MM-DD',
    ]);
    expect(validatePlayerRows([{ number: 1, fullName: 'A', dob: '2010-03-12' }]).errors).toEqual([]);
  });

  it('validates guardians', () => {
    const result = validatePlayerRows([
      { number: 1, fullName: 'A', guardians: [{ relation: 'aunt', name: '' }] },
    ]);
    expect(result.errors).toEqual([
      'row 1: guardian 1 "relation" must be mother, father, or other',
      'row 1: guardian 1 "name" is required',
    ]);
  });

  it('expands a partial skills map and rejects out-of-range or unknown keys', () => {
    const ok = validatePlayerRows([{ number: 1, fullName: 'A', skills: { serve: 5, iq: null } }]);
    expect(ok.errors).toEqual([]);
    expect(ok.inputs[0].skills).toEqual({ ...NULL_SKILLS, serve: 5 });

    const bad = validatePlayerRows([
      { number: 1, fullName: 'A', skills: { serve: 0, attack: 11, made_up: 5 } },
    ]);
    expect(bad.errors).toEqual([
      'row 1: "skills.serve" must be a number from 1 to 10, or null',
      'row 1: "skills.attack" must be a number from 1 to 10, or null',
      'row 1: "skills" has an unknown key "made_up"',
    ]);
  });

  it('reports a non-object row', () => {
    expect(validatePlayerRows([5]).errors).toEqual(['row 1: each entry must be a JSON object']);
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npx vitest run src/players/playersImport.test.ts`
Expected: FAIL — cannot resolve `./playersImport`.

- [ ] **Step 4: Write `src/players/playersImport.ts`**

```ts
import { isPlainObject } from '../bulkImport/parseJsonArray';
import type { ValidationResult } from '../bulkImport/types';
import { SKILL_KEYS, type Guardian, type SkillKey } from '../types/player';

export interface PlayerImportInput {
  number: number;
  fullName: string;
  dob: string;
  nationality: string;
  licenseNumber: string;
  position: string;
  playerPhone: string;
  guardians: Guardian[];
  skills: Record<SkillKey, number | null>;
}

const RELATIONS: Guardian['relation'][] = ['mother', 'father', 'other'];
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const OPTIONAL_TEXT_FIELDS = ['nationality', 'licenseNumber', 'position', 'playerPhone'] as const;

export const PLAYER_IMPORT_EXAMPLE = `[
  {
    "number": 7,
    "fullName": "Jane Doe",
    "dob": "2010-04-12",
    "nationality": "LU",
    "licenseNumber": "12345",
    "position": "Outside hitter",
    "playerPhone": "",
    "guardians": [
      { "relation": "mother", "name": "Mary Doe", "phone": "+352 000 000", "email": "mary@example.com" }
    ],
    "skills": { "serve": 5, "attack": 6, "set": null, "defence": 4, "reception": 7, "jump": 5, "speed": 6, "iq": 5 }
  }
]`;

function nullSkills(): Record<SkillKey, number | null> {
  return SKILL_KEYS.reduce(
    (acc, key) => {
      acc[key] = null;
      return acc;
    },
    {} as Record<SkillKey, number | null>
  );
}

export function validatePlayerRows(rows: unknown[]): ValidationResult<PlayerImportInput> {
  const inputs: PlayerImportInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const n = index + 1;
    if (!isPlainObject(row)) {
      errors.push(`row ${n}: each entry must be a JSON object`);
      return;
    }
    let rowOk = true;
    const fail = (msg: string) => {
      errors.push(msg);
      rowOk = false;
    };

    if (!(typeof row.number === 'number' && Number.isFinite(row.number))) {
      fail(`row ${n}: "number" is required and must be a number`);
    }

    const fullName = typeof row.fullName === 'string' ? row.fullName.trim() : '';
    if (fullName === '') fail(`row ${n}: "fullName" is required`);

    let dob = '';
    if (row.dob !== undefined) {
      if (typeof row.dob === 'string' && DOB_RE.test(row.dob)) dob = row.dob;
      else fail(`row ${n}: "dob" must be YYYY-MM-DD`);
    }

    const text: Record<string, string> = {};
    for (const field of OPTIONAL_TEXT_FIELDS) {
      if (row[field] === undefined) text[field] = '';
      else if (typeof row[field] === 'string') text[field] = row[field] as string;
      else fail(`row ${n}: "${field}" must be text`);
    }

    const guardians: Guardian[] = [];
    if (row.guardians !== undefined) {
      if (!Array.isArray(row.guardians)) {
        fail(`row ${n}: "guardians" must be an array`);
      } else {
        row.guardians.forEach((g, j) => {
          const gn = j + 1;
          if (!isPlainObject(g)) {
            fail(`row ${n}: guardian ${gn} must be an object`);
            return;
          }
          if (!(typeof g.relation === 'string' && RELATIONS.includes(g.relation as Guardian['relation']))) {
            fail(`row ${n}: guardian ${gn} "relation" must be mother, father, or other`);
          }
          const gName = typeof g.name === 'string' ? g.name.trim() : '';
          if (gName === '') fail(`row ${n}: guardian ${gn} "name" is required`);
          const gPhone = typeof g.phone === 'string' ? g.phone : '';
          const gEmail = typeof g.email === 'string' ? g.email : '';
          if (rowOk) {
            guardians.push({ relation: g.relation as Guardian['relation'], name: gName, phone: gPhone, email: gEmail });
          }
        });
      }
    }

    const skills = nullSkills();
    if (row.skills !== undefined) {
      if (!isPlainObject(row.skills)) {
        fail(`row ${n}: "skills" must be an object`);
      } else {
        for (const [key, value] of Object.entries(row.skills)) {
          if (!(SKILL_KEYS as string[]).includes(key)) {
            fail(`row ${n}: "skills" has an unknown key "${key}"`);
            continue;
          }
          if (value === null) {
            skills[key as SkillKey] = null;
          } else if (typeof value === 'number' && value >= 1 && value <= 10) {
            skills[key as SkillKey] = value;
          } else {
            fail(`row ${n}: "skills.${key}" must be a number from 1 to 10, or null`);
          }
        }
      }
    }

    if (rowOk) {
      inputs.push({
        number: row.number as number,
        fullName,
        dob,
        nationality: text.nationality,
        licenseNumber: text.licenseNumber,
        position: text.position,
        playerPhone: text.playerPhone,
        guardians,
        skills,
      });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npx vitest run src/players/playersImport.test.ts`
Expected: PASS. (Note: the "unknown key" test expects `made_up` reported *after* the range errors — `Object.entries` preserves insertion order, so `serve`, `attack`, `made_up` come in that order. If the assertion order differs, reorder the test's `expected` array to match actual `Object.entries` order rather than changing the implementation.)

- [ ] **Step 6: Add `bulkCreatePlayers` to `src/players/playersApi.ts`**

Add `writeBatch` to the `firebase/firestore` import. Add imports:

```ts
import { computeAvgScore, computeLevel } from './skillMath';
import { SKILL_KEYS, type Player, type SkillKey, type Guardian, type Skills } from '../types/player';
import type { PlayerImportInput } from './playersImport';
```

(Adjust the existing `../types/player` import line rather than adding a duplicate.) Append:

```ts
export async function bulkCreatePlayers(
  teamId: string,
  team: Team,
  inputs: PlayerImportInput[],
  creatorUid: string
): Promise<number> {
  const batch = writeBatch(db);
  for (const input of inputs) {
    const skills = SKILL_KEYS.reduce(
      (acc, key) => {
        acc[key] = { score: input.skills[key], notes: '', priority: false };
        return acc;
      },
      {} as Skills
    );
    const avgScore = computeAvgScore(skills);
    const level = computeLevel(avgScore);
    const { skills: _skills, ...contact } = input;
    const ref = doc(collection(db, 'teams', teamId, 'players'));
    batch.set(ref, {
      ...contact,
      viewerEmails: [],
      teamName: team.name,
      ageGroup: team.ageGroup,
      season: team.season,
      skills,
      avgScore,
      level,
      developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
      consent: { given: false, date: null, confirmedBy: null },
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return inputs.length;
}
```

If `noUnusedLocals` flags `_skills`, use `const { skills: _omit, ...contact } = input; void _omit;` or `delete`-free destructuring with an eslint-disable line consistent with the file's style — check how the codebase handles intentional unused destructured keys and match it.

- [ ] **Step 7: Write the failing api test — add to `src/players/playersApi.test.ts`**

Add `mockWriteBatch` to the mock (same pattern as Tasks 2–3). Import `bulkCreatePlayers`. Add:

```ts
it('bulk-creates players with computed skills, forced consent-not-given, and denormalised team fields', async () => {
  const batchSet = vi.fn();
  const batchCommit = vi.fn().mockResolvedValue(undefined);
  mockWriteBatch.mockReturnValue({ set: batchSet, commit: batchCommit });

  const team = { id: 'team-1', name: 'U17', ageGroup: 'U17', season: '2026-27' } as never;
  const count = await bulkCreatePlayers(
    'team-1',
    team,
    [
      {
        number: 7,
        fullName: 'Jane Doe',
        dob: '',
        nationality: '',
        licenseNumber: '',
        position: '',
        playerPhone: '',
        guardians: [],
        skills: {
          serve: 6, attack: 6, set: 6, defence: 6,
          reception: 6, jump: 6, speed: 6, iq: 6,
        },
      },
    ],
    'coach-uid'
  );

  expect(count).toBe(1);
  const payload = batchSet.mock.calls[0][1];
  expect(payload).toMatchObject({
    number: 7,
    fullName: 'Jane Doe',
    teamName: 'U17',
    ageGroup: 'U17',
    season: '2026-27',
    avgScore: 6,
    level: 'Advanced',
    viewerEmails: [],
    consent: { given: false, date: null, confirmedBy: null },
    createdBy: 'coach-uid',
  });
  expect(payload.skills.serve).toEqual({ score: 6, notes: '', priority: false });
  expect(batchCommit).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 8: Run all player tests — expect pass**

Run: `npx vitest run src/players/`
Expected: PASS.

- [ ] **Step 9: Typecheck & lint**

Run: `npm run lint && npx tsc -b`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/types/player.ts src/players/playersImport.ts src/players/playersImport.test.ts src/players/playersApi.ts src/players/playersApi.test.ts
git commit -m "feat: add player bulk-import validator and bulkCreatePlayers"
```

---

## Task 5: Trainings — name resolution, validator, `bulkCreateTrainings`

**Files:**
- Create: `src/trainings/trainingsImport.ts`
- Test: `src/trainings/trainingsImport.test.ts`
- Modify: `src/trainings/trainingsApi.ts` (add `resolveExerciseNames` + `bulkCreateTrainings`; add `writeBatch` to the `firebase/firestore` import)
- Modify: `src/trainings/trainingsApi.test.ts` (add a `resolveExerciseNames` test + a `bulkCreateTrainings` test)

**Interfaces:**
- Consumes: `ValidationResult` from `src/bulkImport/types`; `isPlainObject` from `src/bulkImport/parseJsonArray`; `NewTrainingInput`, `TrainingExercise` from `src/types/training`; `formatBusinessId` from `src/trainings/businessId`; `db` from `src/firebase/config`.
- Produces:
  - `const TRAINING_IMPORT_EXAMPLE: string`
  - `function collectExerciseNames(rows: unknown[]): string[]` — defensively pulls every `row.exercises[].name` string out of untrusted rows
  - `function validateTrainingRows(rows: unknown[], nameToIds: Map<string, string[]>): ValidationResult<NewTrainingInput>`
  - `async function resolveExerciseNames(names: string[]): Promise<Map<string, string[]>>` — key = exact exercise name, value = ids of exercises with that name
  - `async function bulkCreateTrainings(inputs: NewTrainingInput[], creatorUid: string): Promise<number>`

- [ ] **Step 1: Write the failing validator/collector test `src/trainings/trainingsImport.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { collectExerciseNames, validateTrainingRows } from './trainingsImport';

describe('collectExerciseNames', () => {
  it('pulls distinct trimmed names out of untrusted rows, skipping junk', () => {
    const names = collectExerciseNames([
      { exercises: [{ name: '  Butterfly  ' }, { name: 'Serve' }, { name: 5 }, 'nope'] },
      { exercises: 'not-an-array' },
      'row-is-a-string',
      { exercises: [{ name: 'Butterfly' }] },
    ]);
    expect(names.sort()).toEqual(['Butterfly', 'Serve']);
  });
});

describe('validateTrainingRows', () => {
  const map = new Map<string, string[]>([
    ['Butterfly', ['ex-1']],
    ['Serve targets', ['ex-2']],
    ['Dig', ['ex-3', 'ex-4']],
  ]);

  it('accepts a valid row, assigns order by position, defaults description/ageGroupTarget', () => {
    const result = validateTrainingRows(
      [
        {
          name: 'Circuit',
          exercises: [
            { name: 'Serve targets', durationMinutes: 10 },
            { name: 'Butterfly', durationMinutes: 15 },
          ],
        },
      ],
      map
    );
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual([
      {
        name: 'Circuit',
        description: '',
        ageGroupTarget: '',
        exercises: [
          { exerciseId: 'ex-2', order: 1, durationMinutes: 10 },
          { exerciseId: 'ex-1', order: 2, durationMinutes: 15 },
        ],
      },
    ]);
  });

  it('accepts a row with no exercises', () => {
    const result = validateTrainingRows([{ name: 'Empty' }], map);
    expect(result.inputs).toEqual([{ name: 'Empty', description: '', ageGroupTarget: '', exercises: [] }]);
  });

  it('reports a missing name', () => {
    expect(validateTrainingRows([{ exercises: [] }], map).errors).toEqual(['row 1: "name" is required']);
  });

  it('reports a bad durationMinutes', () => {
    const result = validateTrainingRows(
      [{ name: 'X', exercises: [{ name: 'Butterfly', durationMinutes: 0 }] }],
      map
    );
    expect(result.errors).toEqual(['row 1: exercise 1 "durationMinutes" must be a number greater than 0']);
  });

  it('reports an unknown exercise name', () => {
    const result = validateTrainingRows(
      [{ name: 'X', exercises: [{ name: 'Ghost', durationMinutes: 5 }] }],
      map
    );
    expect(result.errors).toEqual(['row 1: exercise "Ghost" was not found in the library']);
  });

  it('reports an ambiguous exercise name', () => {
    const result = validateTrainingRows(
      [{ name: 'X', exercises: [{ name: 'Dig', durationMinutes: 5 }] }],
      map
    );
    expect(result.errors).toEqual([
      'row 1: exercise "Dig" is ambiguous — 2 exercises share that name; rename or remove duplicates',
    ]);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/trainings/trainingsImport.test.ts`
Expected: FAIL — cannot resolve `./trainingsImport`.

- [ ] **Step 3: Write `src/trainings/trainingsImport.ts`**

```ts
import { isPlainObject } from '../bulkImport/parseJsonArray';
import type { ValidationResult } from '../bulkImport/types';
import type { NewTrainingInput, TrainingExercise } from '../types/training';

export const TRAINING_IMPORT_EXAMPLE = `[
  {
    "name": "U17 defense circuit",
    "description": "Rotational blocking + dig transition",
    "ageGroupTarget": "U17",
    "exercises": [
      { "name": "Butterfly passing", "durationMinutes": 15 },
      { "name": "Block footwork ladder", "durationMinutes": 10 }
    ]
  }
]`;

export function collectExerciseNames(rows: unknown[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!isPlainObject(row) || !Array.isArray(row.exercises)) continue;
    for (const entry of row.exercises) {
      if (isPlainObject(entry) && typeof entry.name === 'string' && entry.name.trim() !== '') {
        seen.add(entry.name.trim());
      }
    }
  }
  return [...seen];
}

export function validateTrainingRows(
  rows: unknown[],
  nameToIds: Map<string, string[]>
): ValidationResult<NewTrainingInput> {
  const inputs: NewTrainingInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const n = index + 1;
    if (!isPlainObject(row)) {
      errors.push(`row ${n}: each entry must be a JSON object`);
      return;
    }
    let rowOk = true;
    const fail = (msg: string) => {
      errors.push(msg);
      rowOk = false;
    };

    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (name === '') fail(`row ${n}: "name" is required`);

    let description = '';
    if (row.description !== undefined) {
      if (typeof row.description === 'string') description = row.description;
      else fail(`row ${n}: "description" must be text`);
    }
    let ageGroupTarget = '';
    if (row.ageGroupTarget !== undefined) {
      if (typeof row.ageGroupTarget === 'string') ageGroupTarget = row.ageGroupTarget;
      else fail(`row ${n}: "ageGroupTarget" must be text`);
    }

    const exercises: TrainingExercise[] = [];
    if (row.exercises !== undefined) {
      if (!Array.isArray(row.exercises)) {
        fail(`row ${n}: "exercises" must be an array`);
      } else {
        row.exercises.forEach((entry, k) => {
          const m = k + 1;
          if (!isPlainObject(entry)) {
            fail(`row ${n}: exercise ${m} must be an object`);
            return;
          }
          const exName = typeof entry.name === 'string' ? entry.name.trim() : '';
          if (exName === '') fail(`row ${n}: exercise ${m} "name" is required`);
          const duration = entry.durationMinutes;
          if (!(typeof duration === 'number' && Number.isFinite(duration) && duration > 0)) {
            fail(`row ${n}: exercise ${m} "durationMinutes" must be a number greater than 0`);
          }
          if (exName !== '') {
            const ids = nameToIds.get(exName);
            if (!ids || ids.length === 0) {
              fail(`row ${n}: exercise "${exName}" was not found in the library`);
            } else if (ids.length > 1) {
              fail(
                `row ${n}: exercise "${exName}" is ambiguous — ${ids.length} exercises share that name; rename or remove duplicates`
              );
            } else if (typeof duration === 'number' && duration > 0) {
              exercises.push({ exerciseId: ids[0], order: m, durationMinutes: duration });
            }
          }
        });
      }
    }

    if (rowOk) {
      inputs.push({ name, description, ageGroupTarget, exercises });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/trainings/trainingsImport.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `resolveExerciseNames` + `bulkCreateTrainings` to `src/trainings/trainingsApi.ts`**

Add `writeBatch` to the `firebase/firestore` import (`getDocs`, `query`, `collection`, `where`, `doc`, `runTransaction`, `serverTimestamp` are already imported). Append:

```ts
/**
 * Maps each requested exercise name to the ids of exercises with that exact
 * name. Bounded reads: one `where('name','in', chunk)` per 30 distinct names.
 */
export async function resolveExerciseNames(names: string[]): Promise<Map<string, string[]>> {
  const distinct = [...new Set(names.map((s) => s.trim()).filter((s) => s.length > 0))];
  const map = new Map<string, string[]>();
  for (let i = 0; i < distinct.length; i += 30) {
    const chunk = distinct.slice(i, i + 30);
    const snap = await getDocs(query(collection(db, 'exercises'), where('name', 'in', chunk)));
    for (const d of snap.docs) {
      const name = d.data().name as string;
      map.set(name, [...(map.get(name) ?? []), d.id]);
    }
  }
  return map;
}

/**
 * Writes N trainings in one transaction, bumping counters/trainings by N so
 * every training gets a sequential businessId. All-or-nothing.
 */
export async function bulkCreateTrainings(
  inputs: NewTrainingInput[],
  creatorUid: string
): Promise<number> {
  if (inputs.length === 0) return 0;
  const counterRef = doc(db, 'counters', 'trainings');

  await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const lastSequence = counterSnap.exists() ? (counterSnap.data().lastSequence as number) : 0;

    inputs.forEach((input, i) => {
      const trainingRef = doc(collection(db, 'trainings'));
      tx.set(trainingRef, {
        businessId: formatBusinessId(lastSequence + i + 1),
        ...input,
        exerciseIds: input.exercises.map((e) => e.exerciseId),
        createdBy: creatorUid,
        createdAt: serverTimestamp(),
      });
    });

    tx.set(counterRef, { lastSequence: lastSequence + inputs.length });
  });

  return inputs.length;
}
```

- [ ] **Step 6: Write the failing api tests — add to `src/trainings/trainingsApi.test.ts`**

Import `resolveExerciseNames`, `bulkCreateTrainings`. Add:

```ts
it('resolves exercise names to id lists, grouping duplicates', async () => {
  mockGetDocs.mockResolvedValue({
    docs: [
      { id: 'ex-1', data: () => ({ name: 'Butterfly' }) },
      { id: 'ex-2', data: () => ({ name: 'Dig' }) },
      { id: 'ex-3', data: () => ({ name: 'Dig' }) },
    ],
  });

  const map = await resolveExerciseNames(['Butterfly', 'Dig', 'Butterfly', '  ']);

  expect(map.get('Butterfly')).toEqual(['ex-1']);
  expect(map.get('Dig')).toEqual(['ex-2', 'ex-3']);
  expect(mockWhere).toHaveBeenCalledWith('name', 'in', ['Butterfly', 'Dig']);
});

it('bulk-creates trainings in one transaction with sequential business ids', async () => {
  mockDoc.mockImplementation((...args: unknown[]) => {
    if (args[1] === 'counters') return { ref: 'counters/trainings' };
    return { id: 'training-x' };
  });
  const tx = {
    get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ lastSequence: 6 }) }),
    set: vi.fn(),
  };
  mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

  const count = await bulkCreateTrainings(
    [
      { name: 'A', description: '', ageGroupTarget: 'U17', exercises: [{ exerciseId: 'ex-1', order: 1, durationMinutes: 10 }] },
      { name: 'B', description: '', ageGroupTarget: '', exercises: [] },
    ],
    'coach-uid'
  );

  expect(count).toBe(2);
  // 2 training sets + 1 counter set
  expect(tx.set).toHaveBeenCalledTimes(3);
  expect(tx.set.mock.calls[0][1]).toMatchObject({ businessId: 'TR-0007', name: 'A', exerciseIds: ['ex-1'], createdBy: 'coach-uid' });
  expect(tx.set.mock.calls[1][1]).toMatchObject({ businessId: 'TR-0008', name: 'B', exerciseIds: [] });
  expect(tx.set.mock.calls[2][1]).toEqual({ lastSequence: 8 });
});
```

If `mockWhere` is not already in this test file's hoisted mock, add `where: vi.fn((...a) => ({ type: 'where', args: a }))` to the factory and capture it as `mockWhere` the same way the exercises test does.

- [ ] **Step 7: Run all training tests — expect pass**

Run: `npx vitest run src/trainings/`
Expected: PASS.

- [ ] **Step 8: Typecheck & lint**

Run: `npm run lint && npx tsc -b`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/trainings/trainingsImport.ts src/trainings/trainingsImport.test.ts src/trainings/trainingsApi.ts src/trainings/trainingsApi.test.ts
git commit -m "feat: add training bulk-import validator, name resolution, bulkCreateTrainings"
```

---

## Task 6: `BulkImportDialog` generic component

**Files:**
- Create: `src/bulkImport/BulkImportDialog.tsx`
- Test: `src/bulkImport/BulkImportDialog.test.tsx`

**Interfaces:**
- Consumes: `parseJsonArray` from `./parseJsonArray`; `ValidationResult` from `./types`; `Button` from `src/components/Button`; `Textarea` from `src/components/Input`.
- Produces:
  - ```ts
    interface BulkImportDialogProps<TInput> {
      title: string;
      hint?: string;
      exampleJson: string;
      validate: (rows: unknown[]) => ValidationResult<TInput> | Promise<ValidationResult<TInput>>;
      commit: (inputs: TInput[]) => Promise<number>;
      onClose: () => void;
      onImported: (count: number) => void;
    }
    function BulkImportDialog<TInput>(props: BulkImportDialogProps<TInput>): JSX.Element
    ```

- [ ] **Step 1: Write the failing test `src/bulkImport/BulkImportDialog.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkImportDialog } from './BulkImportDialog';
import type { ValidationResult } from './types';

type Row = { v: number };

function setup(overrides: Partial<Parameters<typeof BulkImportDialog<Row>>[0]> = {}) {
  const onClose = vi.fn();
  const onImported = vi.fn();
  const validate = vi.fn(
    (rows: unknown[]): ValidationResult<Row> => ({ inputs: rows.map((_, i) => ({ v: i })), errors: [] })
  );
  const commit = vi.fn().mockResolvedValue(2);
  render(
    <BulkImportDialog<Row>
      title="Import things"
      exampleJson="[]"
      validate={validate}
      commit={commit}
      onClose={onClose}
      onImported={onImported}
      {...overrides}
    />
  );
  return { onClose, onImported, validate, commit };
}

function paste(text: string) {
  fireEvent.change(screen.getByLabelText('Paste JSON'), { target: { value: text } });
}

describe('BulkImportDialog', () => {
  it('shows a parse error and keeps Import disabled', () => {
    setup();
    paste('{bad}');
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/not valid JSON/i);
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('lists validator errors and keeps Import disabled', () => {
    const validate = vi.fn((): ValidationResult<Row> => ({ inputs: [], errors: ['row 1: bad', 'row 2: worse'] }));
    setup({ validate });
    paste('[1,2]');
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    expect(screen.getByText('row 1: bad')).toBeInTheDocument();
    expect(screen.getByText('row 2: worse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('enables Import after a clean validate and commits the parsed inputs', async () => {
    const { commit, onImported } = setup();
    paste('[1,2,3]');
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await screen.findByText('3 entries ready to import.');
    const importBtn = screen.getByRole('button', { name: 'Import' });
    expect(importBtn).toBeEnabled();
    fireEvent.click(importBtn);
    await waitFor(() => expect(commit).toHaveBeenCalledWith([{ v: 0 }, { v: 1 }, { v: 2 }]));
    expect(onImported).toHaveBeenCalledWith(2);
  });

  it('surfaces a commit failure and does not call onImported', async () => {
    const commit = vi.fn().mockRejectedValue(new Error('boom'));
    const { onImported } = setup({ commit });
    paste('[1]');
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await screen.findByText('1 entry ready to import.');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByText(/nothing was saved/i);
    expect(onImported).not.toHaveBeenCalled();
  });

  it('awaits an async validator', async () => {
    const validate = vi.fn(
      async (): Promise<ValidationResult<Row>> => ({ inputs: [{ v: 0 }], errors: [] })
    );
    setup({ validate });
    paste('[1]');
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await screen.findByText('1 entry ready to import.');
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/bulkImport/BulkImportDialog.test.tsx`
Expected: FAIL — cannot resolve `./BulkImportDialog`.

- [ ] **Step 3: Write `src/bulkImport/BulkImportDialog.tsx`**

```tsx
import { useState, type ChangeEvent } from 'react';
import { Button } from '../components/Button';
import { Textarea } from '../components/Input';
import { parseJsonArray } from './parseJsonArray';
import type { ValidationResult } from './types';

interface BulkImportDialogProps<TInput> {
  title: string;
  hint?: string;
  exampleJson: string;
  validate: (rows: unknown[]) => ValidationResult<TInput> | Promise<ValidationResult<TInput>>;
  commit: (inputs: TInput[]) => Promise<number>;
  onClose: () => void;
  onImported: (count: number) => void;
}

export function BulkImportDialog<TInput>({
  title,
  hint,
  exampleJson,
  validate,
  commit,
  onClose,
  onImported,
}: BulkImportDialogProps<TInput>) {
  const [text, setText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [ready, setReady] = useState<TInput[] | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  function resetResults() {
    setParseError(null);
    setErrors([]);
    setReady(null);
    setCommitError(null);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    resetResults();
  }

  async function handleValidate() {
    resetResults();
    const parsed = parseJsonArray(text);
    if (!parsed.ok) {
      setParseError(parsed.error);
      return;
    }
    setValidating(true);
    try {
      const result = await Promise.resolve(validate(parsed.rows));
      if (result.errors.length > 0) setErrors(result.errors);
      else setReady(result.inputs);
    } catch {
      setParseError('could not validate the data — please try again');
    } finally {
      setValidating(false);
    }
  }

  async function handleImport() {
    if (!ready) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const count = await commit(ready);
      onImported(count);
    } catch {
      setCommitError('Could not import. Nothing was saved. Please try again.');
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-label={title} className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-pop">
        <h2 className="mb-1 text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {hint && <p className="mb-3 text-sm text-slate">{hint}</p>}

        <details className="mb-3 text-sm text-slate">
          <summary className="cursor-pointer select-none">Example format</summary>
          <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-bg p-3 text-xs text-ink">{exampleJson}</pre>
        </details>

        <label htmlFor="bulk-json" className="mb-1 block text-sm font-medium text-ink">
          Paste JSON
        </label>
        <Textarea
          id="bulk-json"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            resetResults();
          }}
          rows={10}
        />

        <label htmlFor="bulk-file" className="mt-3 block text-sm text-slate">
          …or choose a file
        </label>
        <input
          id="bulk-file"
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="mt-1 block text-sm text-slate"
        />

        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={handleValidate} disabled={validating || committing}>
            {validating ? 'Checking…' : 'Validate'}
          </Button>
        </div>

        {parseError && (
          <p role="alert" className="mt-3 text-sm text-red">
            {parseError}
          </p>
        )}

        {errors.length > 0 && (
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm text-red">
            {errors.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        )}

        {ready && (
          <p className="mt-3 text-sm text-green">
            {ready.length} {ready.length === 1 ? 'entry' : 'entries'} ready to import.
          </p>
        )}

        {commitError && (
          <p role="alert" className="mt-3 text-sm text-red">
            {commitError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={committing}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleImport} disabled={!ready || committing}>
            {committing ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/bulkImport/BulkImportDialog.test.tsx`
Expected: PASS. If the generic-in-JSX `Parameters<typeof BulkImportDialog<Row>>` helper trips the test's tsconfig, simplify the test's `setup` typing to a hand-written props type — do not change the component signature.

- [ ] **Step 5: Typecheck & lint**

Run: `npm run lint && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/bulkImport/BulkImportDialog.tsx src/bulkImport/BulkImportDialog.test.tsx
git commit -m "feat: add generic BulkImportDialog component"
```

---

## Task 7: Wire import into Exercises, Trainings, and Teams pages

**Files:**
- Modify: `src/exercises/ExercisesPage.tsx`
- Modify: `src/exercises/ExercisesPage.test.tsx`
- Modify: `src/trainings/TrainingsPage.tsx`
- Modify: `src/trainings/TrainingsPage.test.tsx`
- Modify: `src/teams/TeamsListPage.tsx`
- Modify: `src/teams/TeamsListPage.test.tsx`

**Interfaces:**
- Consumes: `BulkImportDialog` (Task 6); `validateExerciseRows`, `EXERCISE_IMPORT_EXAMPLE`, `bulkCreateExercises` (Task 2); `validateTrainingRows`, `collectExerciseNames`, `TRAINING_IMPORT_EXAMPLE`, `resolveExerciseNames`, `bulkCreateTrainings` (Task 5); `validateTeamRows`, `TEAM_IMPORT_EXAMPLE`, `bulkCreateTeams` (Task 3); `useAuth` from `src/auth/AuthContext`.

- [ ] **Step 1: Wire `ExercisesPage.tsx`**

Add imports:

```ts
import { useAuth } from '../auth/AuthContext';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { EXERCISE_IMPORT_EXAMPLE, validateExerciseRows } from './exercisesImport';
```

Add `bulkCreateExercises` to the existing `./exercisesApi` import. Inside the component:

```ts
const { firebaseUser } = useAuth();
const [showImport, setShowImport] = useState(false);
const [notice, setNotice] = useState<string | null>(null);
```

In the header actions, before the "New exercise" button:

```tsx
<Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
  Import
</Button>
```

Wrap the two buttons in a `<div className="flex gap-2">` if not already grouped. Render the notice under the `error` block:

```tsx
{notice && <p className="mb-4 text-sm text-green">{notice}</p>}
```

Render the dialog near the existing `ExerciseFormDialog` block:

```tsx
{showImport && firebaseUser && (
  <BulkImportDialog
    title="Import exercises"
    exampleJson={EXERCISE_IMPORT_EXAMPLE}
    validate={validateExerciseRows}
    commit={(inputs) => bulkCreateExercises(inputs, firebaseUser.uid)}
    onClose={() => setShowImport(false)}
    onImported={(n) => {
      setShowImport(false);
      setNotice(`Imported ${n} exercise${n === 1 ? '' : 's'}.`);
      window.setTimeout(() => setNotice(null), 4000);
      void loadFirstPage();
    }}
  />
)}
```

- [ ] **Step 2: Wire `TrainingsPage.tsx`**

Add imports:

```ts
import { useAuth } from '../auth/AuthContext';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import {
  TRAINING_IMPORT_EXAMPLE,
  collectExerciseNames,
  validateTrainingRows,
} from './trainingsImport';
```

Add `bulkCreateTrainings`, `resolveExerciseNames` to the existing `./trainingsApi` import. Inside the component add the same `firebaseUser` / `showImport` / `notice` state. Add an "Import" secondary button beside "New training". Render:

```tsx
{showImport && firebaseUser && (
  <BulkImportDialog
    title="Import trainings"
    hint="Exercises are matched by name against the existing library."
    exampleJson={TRAINING_IMPORT_EXAMPLE}
    validate={async (rows) => {
      const map = await resolveExerciseNames(collectExerciseNames(rows));
      return validateTrainingRows(rows, map);
    }}
    commit={(inputs) => bulkCreateTrainings(inputs, firebaseUser.uid)}
    onClose={() => setShowImport(false)}
    onImported={(n) => {
      setShowImport(false);
      setNotice(`Imported ${n} training${n === 1 ? '' : 's'}.`);
      window.setTimeout(() => setNotice(null), 4000);
      void load();
    }}
  />
)}
```

Render `{notice && <p className="mb-4 text-sm text-green">{notice}</p>}` under the `error` block.

- [ ] **Step 3: Wire `TeamsListPage.tsx`**

Add imports:

```ts
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { TEAM_IMPORT_EXAMPLE, validateTeamRows } from './teamsImport';
```

Add `bulkCreateTeams` to the existing `./teamsApi` import. Inside the component add `const [showImport, setShowImport] = useState(false);` and `const [notice, setNotice] = useState<string | null>(null);`. `appUser` is already read. In the header, add — only for admins — an "Import" secondary button before "Create team":

```tsx
{appUser?.role === 'admin' && (
  <Button variant="secondary" onClick={() => setShowImport(true)}>
    Import
  </Button>
)}
```

Wrap the header buttons in `<div className="flex gap-2">`. Render:

```tsx
{showImport && appUser && (
  <BulkImportDialog
    title="Import teams"
    exampleJson={TEAM_IMPORT_EXAMPLE}
    validate={validateTeamRows}
    commit={(inputs) => bulkCreateTeams(inputs, appUser.uid, appUser.email)}
    onClose={() => setShowImport(false)}
    onImported={(n) => {
      setShowImport(false);
      setNotice(`Imported ${n} team${n === 1 ? '' : 's'}.`);
      window.setTimeout(() => setNotice(null), 4000);
      void loadFirstPage();
    }}
  />
)}
```

Render `{notice && <p className="mb-4 text-sm text-green">{notice}</p>}` above the teams grid.

- [ ] **Step 4: Update the three page tests**

For each of `ExercisesPage.test.tsx`, `TrainingsPage.test.tsx`, `TeamsListPage.test.tsx`:

1. If the test does not already mock `useAuth`, add `vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: { uid: 'coach-uid' }, appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' } }) }));` (match whatever shape the other tests in the file already use — many mock `AuthContext` already; extend rather than duplicate).
2. Add `bulkCreateExercises` / `bulkCreateTrainings` + `resolveExerciseNames` / `bulkCreateTeams` to the existing api-module `vi.mock` for that page, as `vi.fn()`.
3. Add one test per page:

```tsx
it('opens the bulk-import dialog from the Import button', async () => {
  render(/* the page, with the router/providers the other tests in this file use */);
  fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
  expect(screen.getByRole('dialog', { name: /Import (exercises|trainings|teams)/ })).toBeInTheDocument();
});
```

Use the same render helper / wrapper the sibling tests in each file already use. For `TeamsListPage`, the mocked `appUser.role` must be `'admin'` for the button to render.

- [ ] **Step 5: Run the affected suites**

Run: `npx vitest run src/exercises/ src/trainings/ src/teams/`
Expected: PASS.

- [ ] **Step 6: Typecheck & lint**

Run: `npm run lint && npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/exercises/ExercisesPage.tsx src/exercises/ExercisesPage.test.tsx src/trainings/TrainingsPage.tsx src/trainings/TrainingsPage.test.tsx src/teams/TeamsListPage.tsx src/teams/TeamsListPage.test.tsx
git commit -m "feat: wire bulk import into exercises, trainings, and teams pages"
```

---

## Task 8: Wire player import into the team page

**Files:**
- Modify: `src/teams/TeamPage.tsx`
- Modify: `src/teams/TeamPage.test.tsx`

**Interfaces:**
- Consumes: `BulkImportDialog` (Task 6); `validatePlayerRows`, `PLAYER_IMPORT_EXAMPLE`, `bulkCreatePlayers` (Task 4); `useAuth` from `src/auth/AuthContext`.

- [ ] **Step 1: Wire `TeamPage.tsx`**

Add imports:

```ts
import { useAuth } from '../auth/AuthContext';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { PLAYER_IMPORT_EXAMPLE, validatePlayerRows } from '../players/playersImport';
import { bulkCreatePlayers } from '../players/playersApi';
```

Inside the component:

```ts
const { firebaseUser } = useAuth();
const [showImportPlayers, setShowImportPlayers] = useState(false);
```

In the overview tab, next to the existing `+ Add player` button, inside the same flex container:

```tsx
<Button variant="secondary" size="sm" onClick={() => setShowImportPlayers(true)}>
  Import players
</Button>
```

Change that wrapper from `flex justify-end` to `flex justify-end gap-2` if needed. After the existing `AddPlayerDialog` block:

```tsx
{showImportPlayers && firebaseUser && (
  <BulkImportDialog
    title="Import players"
    hint="Imported players start with consent not given — confirm each one on their card."
    exampleJson={PLAYER_IMPORT_EXAMPLE}
    validate={validatePlayerRows}
    commit={(inputs) => bulkCreatePlayers(teamId, team, inputs, firebaseUser.uid)}
    onClose={() => setShowImportPlayers(false)}
    onImported={() => {
      setShowImportPlayers(false);
      setRosterRefreshKey((k) => k + 1);
    }}
  />
)}
```

(`teamId` and `team` are already in scope and guaranteed non-null past the `if (!team || !teamId)` guard.)

- [ ] **Step 2: Update `src/teams/TeamPage.test.tsx`**

1. Ensure `useAuth` is mocked to return `{ firebaseUser: { uid: 'coach-uid' }, appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' } }` (extend the file's existing `AuthContext` mock).
2. Add `bulkCreatePlayers: vi.fn()` to the existing `../players/playersApi` mock.
3. Add:

```tsx
it('opens the player bulk-import dialog from the overview tab', async () => {
  render(/* TeamPage with the router + params wrapper the other tests use */);
  fireEvent.click(await screen.findByRole('button', { name: 'Import players' }));
  expect(screen.getByRole('dialog', { name: 'Import players' })).toBeInTheDocument();
  expect(screen.getByText(/consent not given/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run team tests**

Run: `npx vitest run src/teams/`
Expected: PASS.

- [ ] **Step 4: Typecheck & lint**

Run: `npm run lint && npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/teams/TeamPage.tsx src/teams/TeamPage.test.tsx
git commit -m "feat: wire player bulk import into team page"
```

---

## Task 9: Firestore rules tests for batched imports

**Files:**
- Create: `tests/rules/bulkImport.rules.test.ts`

**Interfaces:**
- Consumes: `getTestEnv` from `tests/rules/testEnv`; `assertFails`, `assertSucceeds` from `@firebase/rules-unit-testing`.
- Produces: nothing importable — verification only. No change to `firestore.rules`.

**Context:** This proves the Global Constraint "no rules changes needed". Firestore evaluates every write in a batch against the rules independently and rejects the whole `commit()` if any one fails — so a batch of good creates succeeds, and a batch with one bad create fails entirely. The rules-unit-testing context exposes the Firestore **compat** API, so batches are `db.batch()` / `batch.set(ref, data)` / `batch.commit()` (see the modular vs compat usage already in `tests/rules/`).

- [ ] **Step 1: Write `tests/rules/bulkImport.rules.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

const NULL_SKILLS = {
  serve: { score: null }, attack: { score: null }, set: { score: null }, defence: { score: null },
  reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
};

describe('bulk import rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('users/admin-uid').set({ email: 'coach@example.com', role: 'admin' });
      await db.doc('users/viewer-uid').set({ email: 'parent@example.com', role: 'viewer' });
      await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('accepts a batch that creates several valid exercises', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    const batch = db.batch();
    for (const name of ['A', 'B', 'C']) {
      batch.set(db.collection('exercises').doc(), {
        name,
        description: '',
        category: 'warmup',
        createdBy: 'admin-uid',
      });
    }
    await assertSucceeds(batch.commit());
  });

  it('rejects the whole batch when one exercise is invalid', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    const batch = db.batch();
    batch.set(db.collection('exercises').doc(), { name: 'ok', description: '', category: 'warmup', createdBy: 'admin-uid' });
    batch.set(db.collection('exercises').doc(), { name: 'bad', description: '', category: 'nonsense', createdBy: 'admin-uid' });
    await assertFails(batch.commit());
  });

  it('denies a non-admin a batch of exercise creates', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    const batch = db.batch();
    batch.set(db.collection('exercises').doc(), { name: 'x', description: '', category: 'warmup', createdBy: 'viewer-uid' });
    await assertFails(batch.commit());
  });

  it('accepts a team-admin batch of valid players', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    const batch = db.batch();
    for (const number of [4, 5]) {
      batch.set(db.collection('teams/team-1/players').doc(), {
        number,
        fullName: `Player ${number}`,
        skills: NULL_SKILLS,
        viewerEmails: [],
        consent: { given: false, date: null, confirmedBy: null },
        createdBy: 'admin-uid',
      });
    }
    await assertSucceeds(batch.commit());
  });

  it('rejects a player batch when one skill score is out of range', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    const batch = db.batch();
    batch.set(db.collection('teams/team-1/players').doc(), {
      number: 6,
      fullName: 'Bad Skills',
      skills: { ...NULL_SKILLS, serve: { score: 42 } },
      viewerEmails: [],
      consent: { given: false, date: null, confirmedBy: null },
      createdBy: 'admin-uid',
    });
    await assertFails(batch.commit());
  });
});
```

- [ ] **Step 2: Run the rules suite**

Run: `npm run test:rules`
Expected: PASS (needs JDK 21+; the script boots the Firestore emulator). All 5 new assertions green alongside the existing rules tests.

- [ ] **Step 3: Commit**

```bash
git add tests/rules/bulkImport.rules.test.ts
git commit -m "test: rules coverage for batched bulk-import writes"
```

---

## Task 10: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full unit + component suite**

Run: `npm test`
Expected: PASS, no skips beyond the pre-existing ones.

- [ ] **Step 2: Rules suite**

Run: `npm run test:rules`
Expected: PASS.

- [ ] **Step 3: Lint + typecheck + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Manual smoke against the emulator**

Run: `npm run dev:emulator`. For each of the four pages: click **Import**, paste the dialog's own "Example format" JSON, click **Validate** (expect "N entries ready"), click **Import**, confirm the new rows appear after reload. Then paste a deliberately broken array (missing `name`) and confirm every bad row is listed and nothing is written.

- [ ] **Step 5: Commit any doc touch-ups**

If anything in the spec proved wrong during implementation, update
`docs/superpowers/specs/2026-09-08-volley-skills-bulk-import-design.md` to match and commit:

```bash
git add docs/superpowers/specs/2026-09-08-volley-skills-bulk-import-design.md
git commit -m "docs: reconcile bulk-import spec with implementation"
```

---

## Self-Review

**Spec coverage:**

- §2 per-page entry point, bare array, paste/file → Tasks 6 (dialog), 7, 8 (buttons on all four pages).
- §2 always-create-new → no matching logic in any validator; `bulkCreate*` always `set` on a fresh `doc()`.
- §2 all-or-nothing → every `validate*Rows` returns `{ inputs: [], errors }` on any error; single batch/transaction per `bulkCreate*`; Task 9 proves batch atomicity in rules.
- §2 admin-only / no rules changes → Task 9; team import button gated on `appUser.role === 'admin'` (Task 7 Step 3).
- §3.1 `parseJsonArray`, `BulkImportDialog` contract → Tasks 1, 6.
- §3.2 100-entry cap / atomicity → `MAX_IMPORT` in Task 1; transaction write-count checked in Task 5 test.
- §4.1 exercises format → Task 2 (`validateExerciseRows`, `EXERCISE_IMPORT_EXAMPLE`).
- §4.2 teams format → Task 3.
- §4.3 players format incl. forced `viewerEmails`/denormalised team fields/`consent:false`/skills expansion/`avgScore`/`level` → Task 4 (`validatePlayerRows` + `bulkCreatePlayers`).
- §4.4 trainings format + name resolution (0 → not found, >1 → ambiguous) → Task 5 (`collectExerciseNames`, `resolveExerciseNames`, `validateTrainingRows`).
- §5 write strategy table → `bulkCreateExercises`/`bulkCreateTeams`/`bulkCreatePlayers` use `writeBatch`; `bulkCreateTrainings` uses `runTransaction` reading the counter once and writing `lastSequence + N`.
- §6 UI: Import button per page, reload on success, hint lines for players & trainings → Tasks 7, 8 (`hint` prop set for trainings and players).
- §7 testing: rules (Task 9), pure unit (Tasks 1–5), component (Task 6) — matches the priority order.
- §8 limitations are inherent (no code needed): duplicate `number` not prevented (no check added), ambiguity blocks import (Task 5 error), >100 rejected (Task 1), no dry-run table (dialog shows error list only), manual retry on commit failure (dialog keeps state, shows `commitError`).

**Placeholder scan:** every code step contains full source; every test step contains full assertions; no "similar to Task N", no "add validation" hand-waves. Task 7/8 test steps say "use the render helper the sibling tests use" rather than inlining a router wrapper that may not match the file — acceptable because the exact wrapper is file-specific and already exists in each test file.

**Type consistency:**

- `ValidationResult<TInput>` — `{ inputs, errors }` used identically in Tasks 1, 2, 3, 4, 5, 6.
- `validateExerciseRows` → `ValidationResult<NewExerciseInput>`; `bulkCreateExercises(inputs: NewExerciseInput[], creatorUid)` — match.
- `validateTeamRows` → `ValidationResult<NewTeamInput>` (imported from `teamsApi`); `bulkCreateTeams(inputs: NewTeamInput[], creatorUid, creatorEmail)` — match.
- `validatePlayerRows` → `ValidationResult<PlayerImportInput>`; `bulkCreatePlayers(teamId, team, inputs: PlayerImportInput[], creatorUid)` — match. `PlayerImportInput.skills` is `Record<SkillKey, number | null>`; `bulkCreatePlayers` expands it to `Skills` before writing. `SKILL_KEYS` added in Task 4 Step 1, consumed in `playersImport.ts` and `playersApi.ts`.
- `validateTrainingRows(rows, nameToIds: Map<string, string[]>)` → `ValidationResult<NewTrainingInput>`; `resolveExerciseNames(names: string[]) => Promise<Map<string, string[]>>` — key/value types line up; `collectExerciseNames(rows) => string[]` feeds `resolveExerciseNames`. `bulkCreateTrainings(inputs: NewTrainingInput[], creatorUid)` — match. `NewTrainingInput.exercises` is `TrainingExercise[]` = `{ exerciseId, order, durationMinutes }`, exactly what the validator pushes.
- `BulkImportDialog` props `validate: (rows) => ValidationResult<TInput> | Promise<...>` and `commit: (inputs: TInput[]) => Promise<number>` — Task 7's async training `validate` closure and every `commit` closure returning `bulkCreate*`'s `Promise<number>` conform.
- `onImported(count: number)` — every call site uses the count (or ignores it, for players) and closes the dialog + refreshes.
