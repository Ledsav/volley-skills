# Volley Skills App — Plan 3: Calendar & Shared Training Library

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the remaining functional scope from the app design spec — a per-team training calendar, the club-global shared exercise and training libraries (with a transactional `TR-0007`-style business ID), a GDPR-style player data export, a public `/privacy` page — and fix the roster table's horizontal-scroll problem.

**Architecture:** Same as Plans 1 and 2 — React + TypeScript + Vite SPA talking directly to Firestore via the client SDK, all authorization in Firestore Security Rules, no Cloud Functions. New areas follow the established file-per-concern layout: a `…Api.ts` data-layer module, pure logic in its own module, presentational components, each with a colocated `*.test.ts(x)`. Exercises/trainings are club-global and gated on the global `users/{uid}.role == 'admin'`; calendar sessions are team-scoped and gated on team `adminEmails`.

**Tech Stack:** Same as Plan 2 — React 18, TypeScript (`strict`), Vite, Tailwind, Firebase client SDK v12, react-router-dom v7, `lucide-react`, Vitest, React Testing Library, `@firebase/rules-unit-testing`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-07-volley-skills-plan-3-design.md` (companion to `2026-09-04-volley-skills-app-design.md` for the data model and security model, and `2026-09-04-volley-skills-design-system.md` for tokens/components). Executors should read the spec alongside this plan.

## Global Constraints

- Everything from Plan 1 and Plan 2 Global Constraints still applies: fixed 8-skill list, no Cloud Functions, **no unbounded reads** (`limit()` + cursor pagination everywhere), `adminAllowlist` locked, team admin membership is email-keyed, TypeScript `strict: true`, no secrets committed, **Firestore rules tests are the highest-priority tests**, UI follows the design-system doc and reuses the shared `Button` / `Input` / `Textarea` / `ConfirmDialog` primitives.
- **Two distinct "admin" concepts, never conflated:** exercises, trainings, and `counters/trainings` are **club-global** — authorized on `users/{uid}.role == 'admin'` via the existing `isAdmin()` rules helper, and their routes (`/exercises`, `/trainings`) are wrapped in `<RequireAdmin>`. Calendar sessions are **team-scoped** — authorized on `isTeamAdmin()` (signed-in email in the parent team's `adminEmails`), exactly like players; viewers get nothing.
- **`businessId`** is generated only inside a Firestore `runTransaction` over `counters/trainings`; format is `TR-` followed by the sequence zero-padded to 4 digits (`TR-0007`). It is immutable after creation. This is the standard Firestore auto-increment workaround (app design spec §5); rules validate shape only, not monotonicity.
- **Calendar month view** queries only the visible month's `"YYYY-MM-DD"` string range (`where('date','>=',start) && where('date','<=',end) && orderBy('date')`, defensive `limit(200)`), never the full subcollection. `trainingName` and `trainingBusinessId` are **denormalized onto each calendar session at creation** (same precedent as player docs carrying `teamName`/`ageGroup`/`season`) so month navigation needs no extra reads and labels survive deletion of the referenced training.
- **No calendar session edit in v1** — create + view + delete only. Rules: `allow update: if false`.
- **Hard delete is supported for exercises and trainings (admin only).** Deletion tolerates dangling references — it never cascades edits into other documents:
  - A deleted exercise still referenced by a training renders in the builder/list as a removable **"⚠ Deleted exercise"** row.
  - A deleted training still referenced by past calendar sessions keeps its denormalized label; the chip still links to `/trainings` filtered by its business ID (which then shows no result).
  - The exercise-delete confirm reports how many trainings reference it, via a denormalized `training.exerciseIds: string[]` flat array maintained on every training create/update.
- **Player export is client-side only** — it assembles a JSON blob from data the admin can already read under existing rules. No new rules, no Cloud Function.
- **`/privacy` is a public route** (outside `AuthenticatedLayout`, a sibling of `/login`). Its content is a draft carrying an explicit "pending club/legal review" banner and a placeholder data-request contact.
- **Nav:** `/exercises` and `/trainings` are added to `AppShell` as unconditional nav items with `<RequireAdmin>`-gated routes — matching the existing "Guides" pattern. The dead-link-for-viewers wart is accepted and noted for the deferred viewer flow.
- **Local rules-test caveat:** `@firebase/rules-unit-testing` needs JDK 21+. If `npm run test:rules` cannot start, still write and commit the rules tests (they are the highest priority) and flag them as locally unverified — same as every prior plan.

---

## Task 1: Exercise types, data layer, and rules

**Files:**
- Create: `src/types/exercise.ts`
- Create: `src/exercises/exercisesApi.ts`
- Test: `src/exercises/exercisesApi.test.ts`
- Modify: `firestore.rules` (add a top-level `match /exercises/{exerciseId}` block)
- Modify: `firestore.indexes.json` (add the `exercises` composite index)
- Test: `tests/rules/exercises.rules.test.ts`

**Interfaces:**
- Consumes: `db` from `src/firebase/config.ts`; the existing `isAdmin()` helper in `firestore.rules`.
- Produces:
  - From `src/types/exercise.ts`: `type ExerciseCategory` (union of the 9 fixed categories), `EXERCISE_CATEGORIES: { key: ExerciseCategory; label: string }[]`, `interface Exercise { id; name; description; category: ExerciseCategory; createdBy: string; createdAt: unknown }`, `interface NewExerciseInput { name: string; description: string; category: ExerciseCategory }`.
  - From `src/exercises/exercisesApi.ts`: `createExercise(input: NewExerciseInput, creatorUid: string): Promise<string>`, `updateExercise(exerciseId: string, updates: Partial<NewExerciseInput>): Promise<void>`, `deleteExercise(exerciseId: string): Promise<void>`, `listExercises(afterDoc?: QueryDocumentSnapshot | null, category?: ExerciseCategory | null): Promise<{ exercises: Exercise[]; lastDoc: QueryDocumentSnapshot | null }>`, `getExercisesByIds(ids: string[]): Promise<Exercise[]>`, `countTrainingsUsingExercise(exerciseId: string): Promise<number>`.

- [ ] **Step 1: Write `src/types/exercise.ts`**

```ts
export type ExerciseCategory =
  | 'warmup'
  | 'physical'
  | 'service'
  | 'setting'
  | 'defense'
  | 'reception'
  | 'attack'
  | 'compound'
  | 'game';

export const EXERCISE_CATEGORIES: { key: ExerciseCategory; label: string }[] = [
  { key: 'warmup', label: 'Warm-up' },
  { key: 'physical', label: 'Physical' },
  { key: 'service', label: 'Service' },
  { key: 'setting', label: 'Setting' },
  { key: 'defense', label: 'Defense' },
  { key: 'reception', label: 'Reception' },
  { key: 'attack', label: 'Attack' },
  { key: 'compound', label: 'Compound' },
  { key: 'game', label: 'Game' },
];

export interface Exercise {
  id: string;
  name: string;
  description: string;
  category: ExerciseCategory;
  createdBy: string;
  createdAt: unknown;
}

export interface NewExerciseInput {
  name: string;
  description: string;
  category: ExerciseCategory;
}
```

- [ ] **Step 2: Write the failing test `src/exercises/exercisesApi.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createExercise,
  updateExercise,
  deleteExercise,
  listExercises,
  getExercisesByIds,
  countTrainingsUsingExercise,
} from './exercisesApi';

const {
  mockAddDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockGetDoc,
  mockGetDocs,
  mockGetCountFromServer,
  mockCollection,
  mockDoc,
  mockWhere,
} = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockGetCountFromServer: vi.fn(),
  mockCollection: vi.fn(() => 'exercises-collection'),
  mockDoc: vi.fn(() => 'doc-ref'),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  getCountFromServer: mockGetCountFromServer,
  query: vi.fn((...args: unknown[]) => args),
  where: mockWhere,
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  startAfter: vi.fn((...args: unknown[]) => ({ type: 'startAfter', args })),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('exercisesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an exercise stamped with the creator and a server timestamp', async () => {
    mockAddDoc.mockResolvedValue({ id: 'ex-1' });

    const id = await createExercise(
      { name: 'Pepper', description: 'Two-player control drill', category: 'warmup' },
      'coach-uid'
    );

    expect(id).toBe('ex-1');
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload).toMatchObject({
      name: 'Pepper',
      category: 'warmup',
      createdBy: 'coach-uid',
      createdAt: 'server-timestamp',
    });
  });

  it('updates an exercise', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await updateExercise('ex-1', { name: 'Pepper (advanced)' });
    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { name: 'Pepper (advanced)' });
  });

  it('deletes an exercise', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    await deleteExercise('ex-1');
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref');
  });

  it('lists exercises without a category filter, paginated', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'ex-1', data: () => ({ name: 'Pepper', category: 'warmup' }) }],
    });

    const { exercises, lastDoc } = await listExercises();

    expect(exercises).toEqual([{ id: 'ex-1', name: 'Pepper', category: 'warmup' }]);
    expect(lastDoc).toEqual({ id: 'ex-1', data: expect.any(Function) });
    expect(mockWhere).not.toHaveBeenCalled();
  });

  it('adds a category where-clause when a category is given', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await listExercises(null, 'attack');
    expect(mockWhere).toHaveBeenCalledWith('category', '==', 'attack');
  });

  it('resolves a list of exercise ids, dropping ones that no longer exist', async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, id: 'ex-1', data: () => ({ name: 'Pepper' }) })
      .mockResolvedValueOnce({ exists: () => false });

    const result = await getExercisesByIds(['ex-1', 'ex-gone']);

    expect(result).toEqual([{ id: 'ex-1', name: 'Pepper' }]);
  });

  it('counts trainings that reference an exercise', async () => {
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 3 }) });

    const count = await countTrainingsUsingExercise('ex-1');

    expect(count).toBe(3);
    expect(mockWhere).toHaveBeenCalledWith('exerciseIds', 'array-contains', 'ex-1');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/exercises/exercisesApi.test.ts`
Expected: FAIL with "Cannot find module './exercisesApi'".

- [ ] **Step 4: Write `src/exercises/exercisesApi.ts`**

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Exercise, ExerciseCategory, NewExerciseInput } from '../types/exercise';

const EXERCISES_PAGE_SIZE = 25;

export async function createExercise(input: NewExerciseInput, creatorUid: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'exercises'), {
    ...input,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateExercise(exerciseId: string, updates: Partial<NewExerciseInput>): Promise<void> {
  await updateDoc(doc(db, 'exercises', exerciseId), updates);
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  await deleteDoc(doc(db, 'exercises', exerciseId));
}

export interface ExercisesPage {
  exercises: Exercise[];
  lastDoc: QueryDocumentSnapshot | null;
}

export async function listExercises(
  afterDoc: QueryDocumentSnapshot | null = null,
  category: ExerciseCategory | null = null
): Promise<ExercisesPage> {
  const base = collection(db, 'exercises');
  const constraints = [
    ...(category ? [where('category', '==', category)] : []),
    orderBy('name'),
    ...(afterDoc ? [startAfter(afterDoc)] : []),
    limit(EXERCISES_PAGE_SIZE),
  ];
  const snapshot = await getDocs(query(base, ...constraints));
  const exercises = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Exercise);
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { exercises, lastDoc };
}

export async function getExercisesByIds(ids: string[]): Promise<Exercise[]> {
  const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, 'exercises', id))));
  return snaps
    .filter((snap) => snap.exists())
    .map((snap) => ({ id: snap.id, ...snap.data() }) as Exercise);
}

export async function countTrainingsUsingExercise(exerciseId: string): Promise<number> {
  const q = query(collection(db, 'trainings'), where('exerciseIds', 'array-contains', exerciseId));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/exercises/exercisesApi.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Write the failing rules test `tests/rules/exercises.rules.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('exercises rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('users/admin-uid').set({ email: 'coach@example.com', role: 'admin' });
      await db.doc('users/viewer-uid').set({ email: 'parent@example.com', role: 'viewer' });
      await db.doc('exercises/ex-1').set({
        name: 'Pepper',
        description: '',
        category: 'warmup',
        createdBy: 'admin-uid',
      });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a global admin read, create, update, and delete exercises', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('exercises/ex-1').get());
    await assertSucceeds(
      db.collection('exercises').add({
        name: 'Serve targets',
        description: '',
        category: 'service',
        createdBy: 'admin-uid',
      })
    );
    await assertSucceeds(db.doc('exercises/ex-1').update({ name: 'Pepper v2' }));
    await assertSucceeds(db.doc('exercises/ex-1').delete());
  });

  it('denies a non-admin (viewer role) any read or write', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(db.doc('exercises/ex-1').get());
    await assertFails(
      db.collection('exercises').add({ name: 'X', description: '', category: 'warmup', createdBy: 'viewer-uid' })
    );
    await assertFails(db.doc('exercises/ex-1').delete());
  });

  it('denies creating an exercise with an unknown category or empty name', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(
      db.collection('exercises').add({ name: 'X', description: '', category: 'nonsense', createdBy: 'admin-uid' })
    );
    await assertFails(
      db.collection('exercises').add({ name: '', description: '', category: 'warmup', createdBy: 'admin-uid' })
    );
  });

  it('denies creating an exercise whose createdBy is not the caller', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(
      db.collection('exercises').add({ name: 'X', description: '', category: 'warmup', createdBy: 'someone-else' })
    );
  });
});
```

- [ ] **Step 7: Run the rules test to verify it fails**

Run: `npm run test:rules -- tests/rules/exercises.rules.test.ts`
Expected: FAIL — `exercises` is not matched by any rule yet, so every case is denied (the "lets a global admin…" case fails).
If the emulator will not start (no JDK 21+), record that the test is written but locally unverified and continue.

- [ ] **Step 8: Add the `exercises` block to `firestore.rules`**

Insert this immediately **after** the closing `}` of the `match /physicalTestGuide/config { … }` block and **before** `match /users/{uid} {`:

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

- [ ] **Step 9: Run the rules test to verify it passes**

Run: `npm run test:rules -- tests/rules/exercises.rules.test.ts`
Expected: PASS (4 tests). Also run `npm run test:rules` once to confirm no earlier rules test regressed.

- [ ] **Step 10: Add the composite index to `firestore.indexes.json`**

Append this object to the `"indexes"` array (after the `physicalTests` entry):

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

- [ ] **Step 11: Verify typecheck and full unit suite**

Run: `npx tsc -b` then `npm test`
Expected: 0 type errors; full suite passes.

- [ ] **Step 12: Commit**

```bash
git add src/types/exercise.ts src/exercises/exercisesApi.ts src/exercises/exercisesApi.test.ts tests/rules/exercises.rules.test.ts firestore.rules firestore.indexes.json
git commit -m "Add exercises data layer and club-global admin rules"
```

---

## Task 2: Exercises library UI (`/exercises`)

**Files:**
- Create: `src/exercises/ExerciseFormDialog.tsx`
- Create: `src/exercises/ExercisesPage.tsx`
- Test: `src/exercises/ExerciseFormDialog.test.tsx`
- Test: `src/exercises/ExercisesPage.test.tsx`
- Modify: `src/App.tsx` (add the `/exercises` route inside `AuthenticatedLayout`, wrapped in `<RequireAdmin>`)
- Modify: `src/layout/AppShell.tsx` (add the "Exercises" nav item)
- Modify: `src/layout/AppShell.test.tsx` (assert the new nav item renders twice)

**Interfaces:**
- Consumes: `createExercise`, `updateExercise`, `deleteExercise`, `listExercises`, `countTrainingsUsingExercise` from `src/exercises/exercisesApi.ts`; `EXERCISE_CATEGORIES`, `Exercise`, `ExerciseCategory`, `NewExerciseInput` from `src/types/exercise.ts`; `useAuth` from `src/auth/AuthContext.tsx`; `Button`, `Input`, `Textarea`, `ConfirmDialog` primitives.
- Produces: `ExercisesPage` component registered at `/exercises`; `ExerciseFormDialog` (`{ exercise?: Exercise; onClose: () => void; onSaved: () => void }`).

- [ ] **Step 1: Write `src/exercises/ExerciseFormDialog.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory } from '../types/exercise';
import { createExercise, updateExercise } from './exercisesApi';

interface ExerciseFormDialogProps {
  exercise?: Exercise;
  onClose: () => void;
  onSaved: () => void;
}

export function ExerciseFormDialog({ exercise, onClose, onSaved }: ExerciseFormDialogProps) {
  const { firebaseUser } = useAuth();
  const [name, setName] = useState(exercise?.name ?? '');
  const [description, setDescription] = useState(exercise?.description ?? '');
  const [category, setCategory] = useState<ExerciseCategory>(exercise?.category ?? 'warmup');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError(null);
    try {
      if (exercise) {
        await updateExercise(exercise.id, { name: name.trim(), description, category });
      } else {
        if (!firebaseUser) return;
        await createExercise({ name: name.trim(), description, category }, firebaseUser.uid);
      }
      onSaved();
    } catch {
      setError('Could not save the exercise. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label={exercise ? 'Edit exercise' : 'New exercise'}
        className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-pop"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">
          {exercise ? 'Edit exercise' : 'New exercise'}
        </h2>

        <label htmlFor="exercise-name" className="mb-1 block text-sm font-medium text-ink">
          Name
        </label>
        <Input id="exercise-name" value={name} onChange={(e) => setName(e.target.value)} />

        <label htmlFor="exercise-category" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Category
        </label>
        <select
          id="exercise-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-blue"
        >
          {EXERCISE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>

        <label htmlFor="exercise-description" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Description
        </label>
        <Textarea
          id="exercise-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />

        {error && (
          <p role="alert" className="mt-3 text-sm text-red">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing test `src/exercises/ExerciseFormDialog.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseFormDialog } from './ExerciseFormDialog';
import * as exercisesApi from './exercisesApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./exercisesApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

describe('ExerciseFormDialog', () => {
  it('creates a new exercise from the form fields', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockResolvedValue('ex-1');
    const onSaved = vi.fn();

    render(<ExerciseFormDialog onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pepper' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'attack' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Control drill' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createSpy).toHaveBeenCalledWith(
      { name: 'Pepper', description: 'Control drill', category: 'attack' },
      'coach-uid'
    );
  });

  it('updates an existing exercise without needing an auth uid', async () => {
    vi.mocked(useAuth).mockReturnValue({ firebaseUser: null, appUser: null, loading: false, authError: null });
    const updateSpy = vi.spyOn(exercisesApi, 'updateExercise').mockResolvedValue(undefined);

    render(
      <ExerciseFormDialog
        exercise={{ id: 'ex-1', name: 'Pepper', description: '', category: 'warmup', createdBy: 'x', createdAt: null }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pepper v2' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith('ex-1', { name: 'Pepper v2', description: '', category: 'warmup' })
    );
  });

  it('blocks submission with an empty name', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockResolvedValue('ex-1');

    render(<ExerciseFormDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));

    await screen.findByRole('alert');
    expect(createSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npm test -- src/exercises/ExerciseFormDialog.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 4: Write `src/exercises/ExercisesPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory } from '../types/exercise';
import { countTrainingsUsingExercise, deleteExercise, listExercises } from './exercisesApi';
import { ExerciseFormDialog } from './ExerciseFormDialog';

const CATEGORY_LABEL: Record<ExerciseCategory, string> = Object.fromEntries(
  EXERCISE_CATEGORIES.map((c) => [c.key, c.label])
) as Record<ExerciseCategory, string>;

export function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState<ExerciseCategory | ''>('');
  const [dialog, setDialog] = useState<{ mode: 'new' } | { mode: 'edit'; exercise: Exercise } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ exercise: Exercise; usageCount: number } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function loadFirstPage() {
    const page = await listExercises(null, category || null);
    setExercises(page.exercises);
    setLastDoc(page.lastDoc);
    setHasMore(page.exercises.length > 0 && page.lastDoc !== null);
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listExercises(lastDoc, category || null);
    setExercises((current) => [...current, ...page.exercises]);
    setLastDoc(page.lastDoc);
    setHasMore(page.exercises.length > 0 && page.lastDoc !== null);
  }

  useEffect(() => {
    void loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function askDelete(exercise: Exercise) {
    const usageCount = await countTrainingsUsingExercise(exercise.id);
    setDeleteError(null);
    setPendingDelete({ exercise, usageCount });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteExercise(pendingDelete.exercise.id);
    } catch {
      setDeleteError('Could not delete the exercise. Please try again.');
      return;
    }
    setPendingDelete(null);
    void loadFirstPage();
  }

  return (
    <div className="mx-auto max-w-2xl bg-bg p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Exercises</h1>
        <Button variant="primary" size="sm" onClick={() => setDialog({ mode: 'new' })}>
          New exercise
        </Button>
      </div>

      <label htmlFor="category-filter" className="mr-2 text-sm text-slate">
        Category
      </label>
      <select
        id="category-filter"
        value={category}
        onChange={(e) => setCategory(e.target.value as ExerciseCategory | '')}
        className="mb-4 rounded-md border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-blue"
      >
        <option value="">All categories</option>
        {EXERCISE_CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>

      <div className="divide-y divide-border rounded-lg border border-border bg-surface shadow-card">
        {exercises.length === 0 && <p className="p-4 text-slate">No exercises yet.</p>}
        {exercises.map((exercise) => (
          <div key={exercise.id} className="flex items-start justify-between gap-4 p-4">
            <button
              type="button"
              onClick={() => setDialog({ mode: 'edit', exercise })}
              className="text-left"
            >
              <span className="font-medium text-ink">{exercise.name}</span>
              <span className="ml-2 rounded-sm bg-blue/10 px-2 py-0.5 text-xs font-medium text-blue">
                {CATEGORY_LABEL[exercise.category]}
              </span>
              {exercise.description && (
                <p className="mt-1 line-clamp-1 text-sm text-slate">{exercise.description}</p>
              )}
            </button>
            <Button variant="ghost" size="sm" onClick={() => void askDelete(exercise)}>
              Delete
            </Button>
          </div>
        ))}
      </div>

      {hasMore && (
        <Button variant="secondary" size="sm" onClick={() => void loadMore()} className="mt-4">
          Load more
        </Button>
      )}

      {dialog && (
        <ExerciseFormDialog
          exercise={dialog.mode === 'edit' ? dialog.exercise : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void loadFirstPage();
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.exercise.name}?`}
          message={
            pendingDelete.usageCount > 0
              ? `This exercise is used in ${pendingDelete.usageCount} training(s). Deleting it will leave those trainings with a missing exercise entry.`
              : 'This exercise is not used in any training.'
          }
          confirmLabel="Yes, delete exercise"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
          error={deleteError}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write the failing test `src/exercises/ExercisesPage.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExercisesPage } from './ExercisesPage';
import * as exercisesApi from './exercisesApi';

vi.mock('./exercisesApi');
vi.mock('./ExerciseFormDialog', () => ({
  ExerciseFormDialog: ({ onSaved }: { onSaved: () => void }) => (
    <button onClick={onSaved}>form-dialog-stub</button>
  ),
}));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const exercise = {
  id: 'ex-1',
  name: 'Pepper',
  description: 'Control drill',
  category: 'warmup' as const,
  createdBy: 'x',
  createdAt: null,
};

describe('ExercisesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [exercise], lastDoc: null });
  });

  it('renders exercises from the first page', async () => {
    render(<ExercisesPage />);
    expect(await screen.findByText('Pepper')).toBeInTheDocument();
    expect(screen.getByText('Warm-up')).toBeInTheDocument();
  });

  it('reloads with a category filter when the dropdown changes', async () => {
    render(<ExercisesPage />);
    await screen.findByText('Pepper');

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'attack' } });

    await waitFor(() => expect(exercisesApi.listExercises).toHaveBeenLastCalledWith(null, 'attack'));
  });

  it('shows the training usage count in the delete confirmation', async () => {
    vi.mocked(exercisesApi.countTrainingsUsingExercise).mockResolvedValue(2);
    render(<ExercisesPage />);
    await screen.findByText('Pepper');

    fireEvent.click(screen.getByText('Delete'));

    expect(await screen.findByText(/used in 2 training\(s\)/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- src/exercises/ExercisesPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Register the `/exercises` route in `src/App.tsx`**

Add the import near the other page imports:

```tsx
import { ExercisesPage } from './exercises/ExercisesPage';
```

Inside the `<Route element={<AuthenticatedLayout />}>` block, directly after the `/admin/guides` route, add:

```tsx
            <Route
              path="/exercises"
              element={
                <RequireAdmin>
                  <ExercisesPage />
                </RequireAdmin>
              }
            />
```

- [ ] **Step 8: Add the "Exercises" nav item in `src/layout/AppShell.tsx`**

Update the icon import and `NAV_ITEMS`:

```tsx
import { BookOpen, Dumbbell, LogOut, Users } from 'lucide-react';
```

```tsx
const NAV_ITEMS = [
  { to: '/teams', label: 'Teams', Icon: Users },
  { to: '/exercises', label: 'Exercises', Icon: Dumbbell },
  { to: '/admin/guides', label: 'Guides', Icon: BookOpen },
];
```

If `Dumbbell` does not resolve from this project's `lucide-react` version, substitute any icon that does export (e.g. `Activity`) and note the substitution in the commit message.

- [ ] **Step 9: Update `src/layout/AppShell.test.tsx`**

In the "renders the same nav destinations…" test, add:

```tsx
    expect(screen.getAllByText('Exercises')).toHaveLength(2);
```

- [ ] **Step 10: Run the affected tests and the typecheck**

Run: `npm test -- src/layout/AppShell.test.tsx src/App.test.tsx` then `npx tsc -b`
Expected: PASS; 0 type errors.

- [ ] **Step 11: Commit**

```bash
git add src/exercises/ExerciseFormDialog.tsx src/exercises/ExerciseFormDialog.test.tsx src/exercises/ExercisesPage.tsx src/exercises/ExercisesPage.test.tsx src/App.tsx src/layout/AppShell.tsx src/layout/AppShell.test.tsx
git commit -m "Add /exercises library page, route, and nav item"
```

---

## Task 3: Training business ID, types, data layer, and rules

**Files:**
- Create: `src/trainings/businessId.ts`
- Create: `src/trainings/businessId.test.ts`
- Create: `src/types/training.ts`
- Create: `src/trainings/trainingsApi.ts`
- Test: `src/trainings/trainingsApi.test.ts`
- Modify: `firestore.rules` (add top-level `match /trainings/{trainingId}` and `match /counters/{counterId}` blocks)
- Modify: `firestore.indexes.json` (add the `trainings` composite index)
- Test: `tests/rules/trainings.rules.test.ts`

**Interfaces:**
- Consumes: `db` from `src/firebase/config.ts`; `isAdmin()` in `firestore.rules`.
- Produces:
  - From `src/trainings/businessId.ts`: `formatBusinessId(sequence: number): string`.
  - From `src/types/training.ts`: `interface TrainingExercise { exerciseId: string; order: number; durationMinutes: number }`, `interface Training { id: string; businessId: string; name: string; description: string; ageGroupTarget: string; exercises: TrainingExercise[]; exerciseIds: string[]; createdBy: string; createdAt: unknown }`, `interface NewTrainingInput { name: string; description: string; ageGroupTarget: string; exercises: TrainingExercise[] }`.
  - From `src/trainings/trainingsApi.ts`: `createTraining(input: NewTrainingInput, creatorUid: string): Promise<{ id: string; businessId: string }>`, `updateTraining(trainingId: string, updates: Partial<NewTrainingInput>): Promise<void>`, `deleteTraining(trainingId: string): Promise<void>`, `listTrainings(afterDoc?: QueryDocumentSnapshot | null, filters?: { ageGroupTarget?: string }): Promise<{ trainings: Training[]; lastDoc: QueryDocumentSnapshot | null }>`, `findTrainingByBusinessId(businessId: string): Promise<Training | null>`, `getTraining(trainingId: string): Promise<Training | null>`.

- [ ] **Step 1: Write the failing test `src/trainings/businessId.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatBusinessId } from './businessId';

describe('formatBusinessId', () => {
  it('zero-pads to four digits with a TR- prefix', () => {
    expect(formatBusinessId(7)).toBe('TR-0007');
  });

  it('does not truncate sequences beyond four digits', () => {
    expect(formatBusinessId(12345)).toBe('TR-12345');
  });

  it('handles the first sequence', () => {
    expect(formatBusinessId(1)).toBe('TR-0001');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/trainings/businessId.test.ts`
Expected: FAIL with "Cannot find module './businessId'".

- [ ] **Step 3: Write `src/trainings/businessId.ts`**

```ts
export function formatBusinessId(sequence: number): string {
  return `TR-${String(sequence).padStart(4, '0')}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/trainings/businessId.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `src/types/training.ts`**

```ts
export interface TrainingExercise {
  exerciseId: string;
  order: number;
  durationMinutes: number;
}

export interface Training {
  id: string;
  businessId: string;
  name: string;
  description: string;
  ageGroupTarget: string;
  exercises: TrainingExercise[];
  exerciseIds: string[];
  createdBy: string;
  createdAt: unknown;
}

export interface NewTrainingInput {
  name: string;
  description: string;
  ageGroupTarget: string;
  exercises: TrainingExercise[];
}
```

- [ ] **Step 6: Write the failing test `src/trainings/trainingsApi.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createTraining,
  updateTraining,
  deleteTraining,
  listTrainings,
  findTrainingByBusinessId,
} from './trainingsApi';

const {
  mockRunTransaction,
  mockCollection,
  mockDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockGetDocs,
  mockWhere,
} = vi.hoisted(() => ({
  mockRunTransaction: vi.fn(),
  mockCollection: vi.fn(() => 'trainings-collection'),
  mockDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
}));

vi.mock('firebase/firestore', () => ({
  runTransaction: mockRunTransaction,
  collection: mockCollection,
  doc: mockDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDoc: vi.fn(),
  getDocs: mockGetDocs,
  query: vi.fn((...args: unknown[]) => args),
  where: mockWhere,
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  startAfter: vi.fn((...args: unknown[]) => ({ type: 'startAfter', args })),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('trainingsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a training inside a transaction, incrementing the counter and formatting the business id', async () => {
    mockDoc.mockImplementation((...args: unknown[]) => {
      if (args[1] === 'counters') return { ref: 'counters/trainings' };
      return { id: 'training-1' };
    });
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ lastSequence: 6 }) }),
      set: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

    const result = await createTraining(
      {
        name: 'Passing circuit',
        description: '',
        ageGroupTarget: 'U17',
        exercises: [
          { exerciseId: 'ex-1', order: 1, durationMinutes: 10 },
          { exerciseId: 'ex-2', order: 2, durationMinutes: 15 },
        ],
      },
      'coach-uid'
    );

    expect(result).toEqual({ id: 'training-1', businessId: 'TR-0007' });
    expect(tx.set).toHaveBeenCalledWith({ ref: 'counters/trainings' }, { lastSequence: 7 });
    const trainingPayload = tx.set.mock.calls[1][1];
    expect(trainingPayload).toMatchObject({
      businessId: 'TR-0007',
      name: 'Passing circuit',
      ageGroupTarget: 'U17',
      exerciseIds: ['ex-1', 'ex-2'],
      createdBy: 'coach-uid',
      createdAt: 'server-timestamp',
    });
  });

  it('starts the sequence at 1 when the counter does not exist yet', async () => {
    mockDoc.mockImplementation((...args: unknown[]) =>
      args[1] === 'counters' ? { ref: 'counters/trainings' } : { id: 'training-1' }
    );
    const tx = { get: vi.fn().mockResolvedValue({ exists: () => false }), set: vi.fn() };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

    const result = await createTraining(
      { name: 'X', description: '', ageGroupTarget: '', exercises: [] },
      'coach-uid'
    );

    expect(result.businessId).toBe('TR-0001');
    expect(tx.set).toHaveBeenCalledWith({ ref: 'counters/trainings' }, { lastSequence: 1 });
  });

  it('rewrites exerciseIds when exercises are updated', async () => {
    mockDoc.mockReturnValue('doc-ref');
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateTraining('training-1', {
      name: 'Passing circuit v2',
      exercises: [{ exerciseId: 'ex-9', order: 1, durationMinutes: 20 }],
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', {
      name: 'Passing circuit v2',
      exercises: [{ exerciseId: 'ex-9', order: 1, durationMinutes: 20 }],
      exerciseIds: ['ex-9'],
    });
  });

  it('deletes a training', async () => {
    mockDoc.mockReturnValue('doc-ref');
    mockDeleteDoc.mockResolvedValue(undefined);
    await deleteTraining('training-1');
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref');
  });

  it('filters the list by ageGroupTarget when given', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await listTrainings(null, { ageGroupTarget: 'U15' });
    expect(mockWhere).toHaveBeenCalledWith('ageGroupTarget', '==', 'U15');
  });

  it('finds a single training by business id', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'training-1', data: () => ({ businessId: 'TR-0007', name: 'Passing circuit' }) }],
    });

    const found = await findTrainingByBusinessId('TR-0007');

    expect(found).toEqual({ id: 'training-1', businessId: 'TR-0007', name: 'Passing circuit' });
    expect(mockWhere).toHaveBeenCalledWith('businessId', '==', 'TR-0007');
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm test -- src/trainings/trainingsApi.test.ts`
Expected: FAIL with "Cannot find module './trainingsApi'".

- [ ] **Step 8: Write `src/trainings/trainingsApi.ts`**

```ts
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { NewTrainingInput, Training } from '../types/training';
import { formatBusinessId } from './businessId';

const TRAININGS_PAGE_SIZE = 25;

export async function createTraining(
  input: NewTrainingInput,
  creatorUid: string
): Promise<{ id: string; businessId: string }> {
  const counterRef = doc(db, 'counters', 'trainings');
  const trainingRef = doc(collection(db, 'trainings'));

  const businessId = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const lastSequence = counterSnap.exists() ? (counterSnap.data().lastSequence as number) : 0;
    const nextSequence = lastSequence + 1;
    const nextBusinessId = formatBusinessId(nextSequence);

    tx.set(counterRef, { lastSequence: nextSequence });
    tx.set(trainingRef, {
      businessId: nextBusinessId,
      ...input,
      exerciseIds: input.exercises.map((e) => e.exerciseId),
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
    });

    return nextBusinessId;
  });

  return { id: trainingRef.id, businessId };
}

export async function updateTraining(trainingId: string, updates: Partial<NewTrainingInput>): Promise<void> {
  const payload: Record<string, unknown> = { ...updates };
  if (updates.exercises) {
    payload.exerciseIds = updates.exercises.map((e) => e.exerciseId);
  }
  await updateDoc(doc(db, 'trainings', trainingId), payload);
}

export async function deleteTraining(trainingId: string): Promise<void> {
  await deleteDoc(doc(db, 'trainings', trainingId));
}

export interface TrainingsPage {
  trainings: Training[];
  lastDoc: QueryDocumentSnapshot | null;
}

export async function listTrainings(
  afterDoc: QueryDocumentSnapshot | null = null,
  filters: { ageGroupTarget?: string } = {}
): Promise<TrainingsPage> {
  const base = collection(db, 'trainings');
  const constraints = [
    ...(filters.ageGroupTarget ? [where('ageGroupTarget', '==', filters.ageGroupTarget)] : []),
    orderBy('businessId'),
    ...(afterDoc ? [startAfter(afterDoc)] : []),
    limit(TRAININGS_PAGE_SIZE),
  ];
  const snapshot = await getDocs(query(base, ...constraints));
  const trainings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Training);
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { trainings, lastDoc };
}

export async function findTrainingByBusinessId(businessId: string): Promise<Training | null> {
  const snapshot = await getDocs(
    query(collection(db, 'trainings'), where('businessId', '==', businessId), limit(1))
  );
  if (snapshot.docs.length === 0) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as Training;
}

export async function getTraining(trainingId: string): Promise<Training | null> {
  const snapshot = await getDoc(doc(db, 'trainings', trainingId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Training;
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test -- src/trainings/trainingsApi.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 10: Write the failing rules test `tests/rules/trainings.rules.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('trainings and counters rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('users/admin-uid').set({ email: 'coach@example.com', role: 'admin' });
      await db.doc('users/viewer-uid').set({ email: 'parent@example.com', role: 'viewer' });
      await db.doc('trainings/training-1').set({
        businessId: 'TR-0001',
        name: 'Passing circuit',
        description: '',
        ageGroupTarget: 'U17',
        exercises: [],
        exerciseIds: [],
        createdBy: 'admin-uid',
      });
      await db.doc('counters/trainings').set({ lastSequence: 1 });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a global admin read, create, update, and delete trainings', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('trainings/training-1').get());
    await assertSucceeds(
      db.collection('trainings').add({
        businessId: 'TR-0002',
        name: 'Serve & pass',
        description: '',
        ageGroupTarget: 'U15',
        exercises: [],
        exerciseIds: [],
        createdBy: 'admin-uid',
      })
    );
    await assertSucceeds(db.doc('trainings/training-1').update({ name: 'Passing circuit v2' }));
    await assertSucceeds(db.doc('trainings/training-1').delete());
  });

  it('denies changing a training business id on update', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(db.doc('trainings/training-1').update({ businessId: 'TR-9999' }));
  });

  it('denies a non-admin (viewer role) any read or write on trainings', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(db.doc('trainings/training-1').get());
    await assertFails(db.doc('trainings/training-1').delete());
  });

  it('lets a global admin read and write the counter, denies a non-admin', async () => {
    const env = await getTestEnv();
    const adminDb = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('counters/trainings').get());
    await assertSucceeds(adminDb.doc('counters/trainings').set({ lastSequence: 2 }));

    const viewerDb = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(viewerDb.doc('counters/trainings').get());
    await assertFails(viewerDb.doc('counters/trainings').set({ lastSequence: 999 }));
  });

  it('denies a counter write whose lastSequence is not a non-negative integer', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(db.doc('counters/trainings').set({ lastSequence: -1 }));
    await assertFails(db.doc('counters/trainings').set({ lastSequence: 'lots' }));
  });
});
```

- [ ] **Step 11: Run the rules test to verify it fails**

Run: `npm run test:rules -- tests/rules/trainings.rules.test.ts`
Expected: FAIL — no rule matches `trainings` or `counters` yet. (If the emulator will not start, record as locally unverified and continue.)

- [ ] **Step 12: Add the `trainings` and `counters` blocks to `firestore.rules`**

Insert both blocks immediately **after** the `exercises` block added in Task 1 (still a top-level sibling, before `match /users/{uid}`):

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

- [ ] **Step 13: Run the rules test to verify it passes**

Run: `npm run test:rules -- tests/rules/trainings.rules.test.ts`
Expected: PASS (5 tests). Run the full `npm run test:rules` once to confirm nothing else regressed.

- [ ] **Step 14: Add the composite index to `firestore.indexes.json`**

Append to the `"indexes"` array (after the `exercises` entry from Task 1):

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

- [ ] **Step 15: Verify typecheck and full unit suite**

Run: `npx tsc -b` then `npm test`
Expected: 0 type errors; full suite passes.

- [ ] **Step 16: Commit**

```bash
git add src/trainings/businessId.ts src/trainings/businessId.test.ts src/types/training.ts src/trainings/trainingsApi.ts src/trainings/trainingsApi.test.ts tests/rules/trainings.rules.test.ts firestore.rules firestore.indexes.json
git commit -m "Add trainings data layer with transactional business ID and rules"
```

---

## Task 4: Trainings library UI (`/trainings`) with the ordered exercise builder

**Files:**
- Create: `src/trainings/TrainingBuilderDialog.tsx`
- Create: `src/trainings/TrainingBuilderDialog.test.tsx`
- Create: `src/trainings/TrainingsPage.tsx`
- Create: `src/trainings/TrainingsPage.test.tsx`
- Modify: `src/App.tsx` (add the `/trainings` route)
- Modify: `src/layout/AppShell.tsx` (add the "Trainings" nav item)
- Modify: `src/layout/AppShell.test.tsx` (assert the new nav item)

**Interfaces:**
- Consumes: `createTraining`, `updateTraining`, `deleteTraining`, `listTrainings`, `findTrainingByBusinessId` from `src/trainings/trainingsApi.ts`; `listExercises`, `getExercisesByIds` from `src/exercises/exercisesApi.ts`; `Training`, `TrainingExercise`, `NewTrainingInput` from `src/types/training.ts`; `Exercise` from `src/types/exercise.ts`; `useAuth`; the shared primitives.
- Produces: `TrainingsPage` at `/trainings`; `TrainingBuilderDialog` (`{ training?: Training; onClose: () => void; onSaved: () => void }`).

- [ ] **Step 1: Write `src/trainings/TrainingBuilderDialog.tsx`**

```tsx
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { getExercisesByIds, listExercises } from '../exercises/exercisesApi';
import type { Exercise } from '../types/exercise';
import type { Training, TrainingExercise } from '../types/training';
import { createTraining, updateTraining } from './trainingsApi';

interface Row extends TrainingExercise {
  name: string | null; // null => the exercise no longer exists
}

interface TrainingBuilderDialogProps {
  training?: Training;
  onClose: () => void;
  onSaved: () => void;
}

export function TrainingBuilderDialog({ training, onClose, onSaved }: TrainingBuilderDialogProps) {
  const { firebaseUser } = useAuth();
  const [name, setName] = useState(training?.name ?? '');
  const [description, setDescription] = useState(training?.description ?? '');
  const [ageGroupTarget, setAgeGroupTarget] = useState(training?.ageGroupTarget ?? '');
  const [rows, setRows] = useState<Row[]>([]);
  const [picker, setPicker] = useState<Exercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!training) return;
    void getExercisesByIds(training.exercises.map((e) => e.exerciseId)).then((found) => {
      const byId = new Map(found.map((ex) => [ex.id, ex.name]));
      setRows(
        training.exercises
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((e) => ({ ...e, name: byId.get(e.exerciseId) ?? null }))
      );
    });
  }, [training]);

  async function openPicker() {
    setPickerOpen(true);
    const page = await listExercises();
    setPicker(page.exercises);
  }

  function addExercise(exercise: Exercise) {
    setRows((current) => [
      ...current,
      { exerciseId: exercise.id, order: current.length + 1, durationMinutes: 10, name: exercise.name },
    ]);
    setPickerOpen(false);
  }

  function move(index: number, delta: number) {
    setRows((current) => {
      const next = current.slice();
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function setDuration(index: number, value: number) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, durationMinutes: value } : row)));
  }

  const totalMinutes = useMemo(() => rows.reduce((sum, r) => sum + (r.durationMinutes || 0), 0), [rows]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError(null);
    const exercises: TrainingExercise[] = rows.map((row, i) => ({
      exerciseId: row.exerciseId,
      order: i + 1,
      durationMinutes: row.durationMinutes,
    }));
    try {
      if (training) {
        await updateTraining(training.id, { name: name.trim(), description, ageGroupTarget, exercises });
      } else {
        if (!firebaseUser) return;
        await createTraining({ name: name.trim(), description, ageGroupTarget, exercises }, firebaseUser.uid);
      }
      onSaved();
    } catch {
      setError('Could not save the training. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label={training ? 'Edit training' : 'New training'}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">
          {training ? `Edit ${training.businessId}` : 'New training'}
        </h2>

        <label htmlFor="training-name" className="mb-1 block text-sm font-medium text-ink">
          Name
        </label>
        <Input id="training-name" value={name} onChange={(e) => setName(e.target.value)} />

        <label htmlFor="training-age" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Age group target
        </label>
        <Input id="training-age" value={ageGroupTarget} onChange={(e) => setAgeGroupTarget(e.target.value)} />

        <label htmlFor="training-description" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Description
        </label>
        <Textarea
          id="training-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Exercises</span>
            <span className="text-sm text-slate">Total: {totalMinutes} min</span>
          </div>

          <ul className="divide-y divide-border rounded-md border border-border">
            {rows.length === 0 && <li className="p-3 text-sm text-slate">No exercises added yet.</li>}
            {rows.map((row, i) => (
              <li key={`${row.exerciseId}-${i}`} className="flex items-center gap-2 p-3">
                <span className="w-6 text-sm tabular-nums text-slate">{i + 1}</span>
                <span className={`flex-1 text-sm ${row.name ? 'text-ink' : 'text-red'}`}>
                  {row.name ?? '⚠ Deleted exercise'}
                </span>
                <input
                  type="number"
                  min={0}
                  aria-label={`Duration for exercise ${i + 1} (min)`}
                  value={row.durationMinutes}
                  onChange={(e) => setDuration(i, Number(e.target.value))}
                  className="w-20 rounded-md border border-border px-2 py-1 text-right tabular-nums"
                />
                <button
                  type="button"
                  aria-label={`Move exercise ${i + 1} up`}
                  onClick={() => move(i, -1)}
                  className="px-1 text-slate hover:text-ink"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move exercise ${i + 1} down`}
                  onClick={() => move(i, 1)}
                  className="px-1 text-slate hover:text-ink"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Remove exercise ${i + 1}`}
                  onClick={() => removeRow(i)}
                  className="px-1 text-red hover:text-red-strong"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {pickerOpen ? (
            <div className="mt-2 rounded-md border border-border p-2">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">Pick an exercise</p>
              <ul className="divide-y divide-border">
                {picker.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => addExercise(ex)}
                      className="w-full py-2 text-left text-sm text-blue hover:underline"
                    >
                      {ex.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => void openPicker()} className="mt-2">
              Add exercise
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing test `src/trainings/TrainingBuilderDialog.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TrainingBuilderDialog } from './TrainingBuilderDialog';
import * as trainingsApi from './trainingsApi';
import * as exercisesApi from '../exercises/exercisesApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./trainingsApi');
vi.mock('../exercises/exercisesApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const exOne = { id: 'ex-1', name: 'Pepper', description: '', category: 'warmup' as const, createdBy: 'x', createdAt: null };
const exTwo = { id: 'ex-2', name: 'Serve targets', description: '', category: 'service' as const, createdBy: 'x', createdAt: null };

describe('TrainingBuilderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [exOne, exTwo], lastDoc: null });
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([]);
  });

  it('builds a new training with ordered exercises and recomputed order + exerciseIds', async () => {
    const createSpy = vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't-1', businessId: 'TR-0007' });
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Passing circuit' } });
    fireEvent.change(screen.getByLabelText('Age group target'), { target: { value: 'U17' } });

    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByText('Pepper'));
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByText('Serve targets'));

    fireEvent.change(screen.getByLabelText('Duration for exercise 1 (min)'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Duration for exercise 2 (min)'), { target: { value: '18' } });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith(
        {
          name: 'Passing circuit',
          description: '',
          ageGroupTarget: 'U17',
          exercises: [
            { exerciseId: 'ex-1', order: 1, durationMinutes: 12 },
            { exerciseId: 'ex-2', order: 2, durationMinutes: 18 },
          ],
        },
        'coach-uid'
      )
    );
  });

  it('reorders rows so the moved exercise gets the new order on save', async () => {
    const createSpy = vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't-1', businessId: 'TR-0007' });
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Circuit' } });
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByText('Pepper'));
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByText('Serve targets'));

    fireEvent.click(screen.getByLabelText('Move exercise 2 up'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      const exercises = createSpy.mock.calls[0][0].exercises;
      expect(exercises).toEqual([
        { exerciseId: 'ex-2', order: 1, durationMinutes: 10 },
        { exerciseId: 'ex-1', order: 2, durationMinutes: 10 },
      ]);
    });
  });

  it('shows a "Deleted exercise" row when editing a training whose exercise is gone', async () => {
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([exOne]);
    render(
      <TrainingBuilderDialog
        training={{
          id: 't-1',
          businessId: 'TR-0007',
          name: 'Circuit',
          description: '',
          ageGroupTarget: 'U17',
          exercises: [
            { exerciseId: 'ex-1', order: 1, durationMinutes: 10 },
            { exerciseId: 'ex-gone', order: 2, durationMinutes: 10 },
          ],
          exerciseIds: ['ex-1', 'ex-gone'],
          createdBy: 'x',
          createdAt: null,
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(await screen.findByText('Pepper')).toBeInTheDocument();
    expect(screen.getByText('⚠ Deleted exercise')).toBeInTheDocument();
  });

  it('removes a row', async () => {
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Circuit' } });
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByText('Pepper'));

    const list = screen.getByRole('list');
    expect(within(list).getByText('Pepper')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Remove exercise 1'));
    expect(within(list).queryByText('Pepper')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npm test -- src/trainings/TrainingBuilderDialog.test.tsx`
Expected: PASS (4 tests). (If a `getByRole('list')` ambiguity arises because the picker also renders a list, scope with the `aria-label` on the form or use `getAllByRole('list')[0]` — adjust the test, not the component.)

- [ ] **Step 4: Write `src/trainings/TrainingsPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Input } from '../components/Input';
import type { Training } from '../types/training';
import { deleteTraining, findTrainingByBusinessId, listTrainings } from './trainingsApi';
import { TrainingBuilderDialog } from './TrainingBuilderDialog';

export function TrainingsPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [ageGroup, setAgeGroup] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [dialog, setDialog] = useState<{ mode: 'new' } | { mode: 'edit'; training: Training } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Training | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    if (businessId.trim()) {
      const found = await findTrainingByBusinessId(businessId.trim());
      setTrainings(found ? [found] : []);
      setLastDoc(null);
      setHasMore(false);
      return;
    }
    const page = await listTrainings(null, ageGroup.trim() ? { ageGroupTarget: ageGroup.trim() } : {});
    setTrainings(page.trainings);
    setLastDoc(page.lastDoc);
    setHasMore(page.trainings.length > 0 && page.lastDoc !== null);
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listTrainings(lastDoc, ageGroup.trim() ? { ageGroupTarget: ageGroup.trim() } : {});
    setTrainings((current) => [...current, ...page.trainings]);
    setLastDoc(page.lastDoc);
    setHasMore(page.trainings.length > 0 && page.lastDoc !== null);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageGroup, businessId]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteTraining(pendingDelete.id);
    } catch {
      setDeleteError('Could not delete the training. Please try again.');
      return;
    }
    setPendingDelete(null);
    void load();
  }

  return (
    <div className="mx-auto max-w-2xl bg-bg p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Trainings</h1>
        <Button variant="primary" size="sm" onClick={() => setDialog({ mode: 'new' })}>
          New training
        </Button>
      </div>

      <div className="mb-4 flex gap-3">
        <div>
          <label htmlFor="filter-age" className="mb-1 block text-sm text-slate">
            Age group
          </label>
          <Input id="filter-age" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="w-40" />
        </div>
        <div>
          <label htmlFor="filter-bid" className="mb-1 block text-sm text-slate">
            Business ID
          </label>
          <Input
            id="filter-bid"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            placeholder="TR-0007"
            className="w-40"
          />
        </div>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border bg-surface shadow-card">
        {trainings.length === 0 && <p className="p-4 text-slate">No trainings found.</p>}
        {trainings.map((training) => (
          <div key={training.id} className="flex items-center justify-between gap-4 p-4">
            <button type="button" onClick={() => setDialog({ mode: 'edit', training })} className="text-left">
              <span className="font-medium tabular-nums text-ink">{training.businessId}</span>
              <span className="ml-2 text-ink">{training.name}</span>
              <p className="mt-1 text-sm text-slate">
                {training.ageGroupTarget || '—'} · {training.exercises.length} exercise(s) ·{' '}
                {training.exercises.reduce((s, e) => s + e.durationMinutes, 0)} min
              </p>
            </button>
            <Button variant="ghost" size="sm" onClick={() => { setDeleteError(null); setPendingDelete(training); }}>
              Delete
            </Button>
          </div>
        ))}
      </div>

      {hasMore && (
        <Button variant="secondary" size="sm" onClick={() => void loadMore()} className="mt-4">
          Load more
        </Button>
      )}

      {dialog && (
        <TrainingBuilderDialog
          training={dialog.mode === 'edit' ? dialog.training : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void load();
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.businessId}?`}
          message="Past calendar entries for this training keep their label but will no longer link to it."
          confirmLabel="Yes, delete training"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
          error={deleteError}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write the failing test `src/trainings/TrainingsPage.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TrainingsPage } from './TrainingsPage';
import * as trainingsApi from './trainingsApi';

vi.mock('./trainingsApi');
vi.mock('./TrainingBuilderDialog', () => ({
  TrainingBuilderDialog: ({ onSaved }: { onSaved: () => void }) => <button onClick={onSaved}>builder-stub</button>,
}));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const training = {
  id: 't-1',
  businessId: 'TR-0007',
  name: 'Passing circuit',
  description: '',
  ageGroupTarget: 'U17',
  exercises: [{ exerciseId: 'ex-1', order: 1, durationMinutes: 10 }],
  exerciseIds: ['ex-1'],
  createdBy: 'x',
  createdAt: null,
};

describe('TrainingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trainingsApi.listTrainings).mockResolvedValue({ trainings: [training], lastDoc: null });
    vi.mocked(trainingsApi.findTrainingByBusinessId).mockResolvedValue(training);
  });

  it('lists trainings from the paginated query by default', async () => {
    render(<TrainingsPage />);
    expect(await screen.findByText('Passing circuit')).toBeInTheDocument();
    expect(screen.getByText('TR-0007')).toBeInTheDocument();
  });

  it('switches to the single business-id lookup when that field is filled', async () => {
    render(<TrainingsPage />);
    await screen.findByText('Passing circuit');

    fireEvent.change(screen.getByLabelText('Business ID'), { target: { value: 'TR-0007' } });

    await waitFor(() => expect(trainingsApi.findTrainingByBusinessId).toHaveBeenCalledWith('TR-0007'));
  });

  it('confirms before deleting a training', async () => {
    vi.mocked(trainingsApi.deleteTraining).mockResolvedValue(undefined);
    render(<TrainingsPage />);
    await screen.findByText('Passing circuit');

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Yes, delete training'));

    await waitFor(() => expect(trainingsApi.deleteTraining).toHaveBeenCalledWith('t-1'));
  });
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- src/trainings/TrainingsPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Register the `/trainings` route in `src/App.tsx`**

Add the import:

```tsx
import { TrainingsPage } from './trainings/TrainingsPage';
```

Directly after the `/exercises` route added in Task 2:

```tsx
            <Route
              path="/trainings"
              element={
                <RequireAdmin>
                  <TrainingsPage />
                </RequireAdmin>
              }
            />
```

- [ ] **Step 8: Add the "Trainings" nav item in `src/layout/AppShell.tsx`**

```tsx
import { BookOpen, ClipboardList, Dumbbell, LogOut, Users } from 'lucide-react';
```

```tsx
const NAV_ITEMS = [
  { to: '/teams', label: 'Teams', Icon: Users },
  { to: '/exercises', label: 'Exercises', Icon: Dumbbell },
  { to: '/trainings', label: 'Trainings', Icon: ClipboardList },
  { to: '/admin/guides', label: 'Guides', Icon: BookOpen },
];
```

Same fallback note as Task 2 if `ClipboardList` does not resolve.

- [ ] **Step 9: Update `src/layout/AppShell.test.tsx`**

Add to the nav-destinations test:

```tsx
    expect(screen.getAllByText('Trainings')).toHaveLength(2);
```

- [ ] **Step 10: Run affected tests and typecheck**

Run: `npm test -- src/layout/AppShell.test.tsx src/App.test.tsx` then `npx tsc -b`
Expected: PASS; 0 type errors.

- [ ] **Step 11: Commit**

```bash
git add src/trainings/TrainingBuilderDialog.tsx src/trainings/TrainingBuilderDialog.test.tsx src/trainings/TrainingsPage.tsx src/trainings/TrainingsPage.test.tsx src/App.tsx src/layout/AppShell.tsx src/layout/AppShell.test.tsx
git commit -m "Add /trainings library page with ordered exercise builder"
```

---

## Task 5: Calendar month-grid helper, types, data layer, and rules

**Files:**
- Create: `src/calendar/monthGrid.ts`
- Create: `src/calendar/monthGrid.test.ts`
- Create: `src/types/calendarSession.ts`
- Create: `src/calendar/calendarApi.ts`
- Test: `src/calendar/calendarApi.test.ts`
- Modify: `firestore.rules` (add `match /calendar/{sessionId}` inside `match /teams/{teamId}`)
- Test: `tests/rules/calendar.rules.test.ts`

**Interfaces:**
- Consumes: `db` from `src/firebase/config.ts`.
- Produces:
  - From `src/calendar/monthGrid.ts`: `buildMonthGrid(year: number, month: number): { date: string; inMonth: boolean }[][]` (month is 0-indexed; weeks are Monday-first), `addMonths(year: number, month: number, delta: number): { year: number; month: number }`, `formatMonthLabel(year: number, month: number): string`, `monthRange(year: number, month: number): { start: string; end: string }`.
  - From `src/types/calendarSession.ts`: `interface CalendarSession { id; date: string; trainingId: string; trainingBusinessId: string; trainingName: string; notes: string; createdBy: string; createdAt: unknown }`, `interface NewCalendarSessionInput { date: string; trainingId: string; trainingBusinessId: string; trainingName: string; notes: string }`.
  - From `src/calendar/calendarApi.ts`: `listCalendarSessions(teamId: string, startDate: string, endDate: string): Promise<CalendarSession[]>`, `createCalendarSession(teamId: string, input: NewCalendarSessionInput, creatorUid: string): Promise<string>`, `deleteCalendarSession(teamId: string, sessionId: string): Promise<void>`.

- [ ] **Step 1: Write the failing test `src/calendar/monthGrid.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { addMonths, buildMonthGrid, formatMonthLabel, monthRange } from './monthGrid';

describe('monthGrid', () => {
  it('builds a Monday-first grid for September 2026 with adjacent-month padding', () => {
    const grid = buildMonthGrid(2026, 8); // September (0-indexed)

    expect(grid[0][0]).toEqual({ date: '2026-08-31', inMonth: false }); // Monday before Sep 1 (a Tuesday)
    expect(grid[0][1]).toEqual({ date: '2026-09-01', inMonth: true });
    expect(grid).toHaveLength(5); // Sep 2026 spans 5 Monday-first weeks
    expect(grid[4][6]).toEqual({ date: '2026-10-04', inMonth: false });
    grid.forEach((week) => expect(week).toHaveLength(7));
  });

  it('computes the first and last ISO date of a month', () => {
    expect(monthRange(2026, 8)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(monthRange(2026, 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('adds months with year rollover in both directions', () => {
    expect(addMonths(2026, 8, 1)).toEqual({ year: 2026, month: 9 });
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('formats a human month label', () => {
    expect(formatMonthLabel(2026, 8)).toBe('September 2026');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/calendar/monthGrid.test.ts`
Expected: FAIL with "Cannot find module './monthGrid'".

- [ ] **Step 3: Write `src/calendar/monthGrid.ts`**

```ts
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return { start: iso(start), end: iso(end) };
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const base = new Date(Date.UTC(year, month + delta, 1));
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() };
}

export function formatMonthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

export function buildMonthGrid(year: number, month: number): { date: string; inMonth: boolean }[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((mondayOffset + daysInMonth) / 7);

  const grid: { date: string; inMonth: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: { date: string; inMonth: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(Date.UTC(year, month, 1 - mondayOffset + w * 7 + d));
      week.push({ date: iso(cell), inMonth: cell.getUTCMonth() === month });
    }
    grid.push(week);
  }
  return grid;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/calendar/monthGrid.test.ts`
Expected: PASS (4 tests). If the September-2026 weekday assumptions are off in this environment, correct the expected strings in the test to match the real calendar — the algorithm is what is under test.

- [ ] **Step 5: Write `src/types/calendarSession.ts`**

```ts
export interface CalendarSession {
  id: string;
  date: string;
  trainingId: string;
  trainingBusinessId: string;
  trainingName: string;
  notes: string;
  createdBy: string;
  createdAt: unknown;
}

export interface NewCalendarSessionInput {
  date: string;
  trainingId: string;
  trainingBusinessId: string;
  trainingName: string;
  notes: string;
}
```

- [ ] **Step 6: Write the failing test `src/calendar/calendarApi.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { listCalendarSessions, createCalendarSession, deleteCalendarSession } from './calendarApi';

const { mockAddDoc, mockDeleteDoc, mockGetDocs, mockCollection, mockDoc, mockWhere } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn(() => 'calendar-collection'),
  mockDoc: vi.fn(() => 'doc-ref'),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  query: vi.fn((...args: unknown[]) => args),
  where: mockWhere,
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('calendarApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries only the given date range', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 's-1', data: () => ({ date: '2026-09-10', trainingName: 'Passing circuit' }) }],
    });

    const sessions = await listCalendarSessions('team-1', '2026-09-01', '2026-09-30');

    expect(sessions).toEqual([{ id: 's-1', date: '2026-09-10', trainingName: 'Passing circuit' }]);
    expect(mockWhere).toHaveBeenCalledWith('date', '>=', '2026-09-01');
    expect(mockWhere).toHaveBeenCalledWith('date', '<=', '2026-09-30');
  });

  it('creates a session with the denormalized training label and a timestamp', async () => {
    mockAddDoc.mockResolvedValue({ id: 's-2' });

    const id = await createCalendarSession(
      'team-1',
      {
        date: '2026-09-12',
        trainingId: 't-1',
        trainingBusinessId: 'TR-0007',
        trainingName: 'Passing circuit',
        notes: 'Focus on serve receive',
      },
      'coach-uid'
    );

    expect(id).toBe('s-2');
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload).toMatchObject({
      date: '2026-09-12',
      trainingBusinessId: 'TR-0007',
      trainingName: 'Passing circuit',
      createdBy: 'coach-uid',
      createdAt: 'server-timestamp',
    });
  });

  it('deletes a session', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    await deleteCalendarSession('team-1', 's-2');
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref');
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm test -- src/calendar/calendarApi.test.ts`
Expected: FAIL with "Cannot find module './calendarApi'".

- [ ] **Step 8: Write `src/calendar/calendarApi.ts`**

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CalendarSession, NewCalendarSessionInput } from '../types/calendarSession';

const CALENDAR_MONTH_CAP = 200;

export async function listCalendarSessions(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<CalendarSession[]> {
  const base = collection(db, 'teams', teamId, 'calendar');
  const snapshot = await getDocs(
    query(
      base,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date'),
      limit(CALENDAR_MONTH_CAP)
    )
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CalendarSession);
}

export async function createCalendarSession(
  teamId: string,
  input: NewCalendarSessionInput,
  creatorUid: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'teams', teamId, 'calendar'), {
    ...input,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteCalendarSession(teamId: string, sessionId: string): Promise<void> {
  await deleteDoc(doc(db, 'teams', teamId, 'calendar', sessionId));
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test -- src/calendar/calendarApi.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 10: Write the failing rules test `tests/rules/calendar.rules.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('calendar rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
      await db.doc('teams/team-1/players/player-1').set({
        fullName: 'Test Player',
        viewerEmails: ['parent@example.com'],
      });
      await db.doc('teams/team-1/calendar/session-1').set({
        date: '2026-09-10',
        trainingId: 't-1',
        trainingBusinessId: 'TR-0007',
        trainingName: 'Passing circuit',
        notes: '',
        createdBy: 'coach-uid',
      });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets the team admin read, create, and delete calendar sessions', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1/calendar/session-1').get());
    await assertSucceeds(
      db.collection('teams/team-1/calendar').add({
        date: '2026-09-12',
        trainingId: 't-2',
        trainingBusinessId: 'TR-0008',
        trainingName: 'Serve & pass',
        notes: '',
        createdBy: 'coach-uid',
      })
    );
    await assertSucceeds(db.doc('teams/team-1/calendar/session-1').delete());
  });

  it('denies updating a calendar session (v1 has no edit)', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(db.doc('teams/team-1/calendar/session-1').update({ notes: 'changed' }));
  });

  it('denies the linked viewer and unrelated users any access', async () => {
    const env = await getTestEnv();
    const viewerDb = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(viewerDb.doc('teams/team-1/calendar/session-1').get());
    await assertFails(viewerDb.doc('teams/team-1/calendar/session-1').delete());

    const strangerDb = env.authenticatedContext('stranger-uid', { email: 'stranger@example.com' }).firestore();
    await assertFails(strangerDb.doc('teams/team-1/calendar/session-1').get());
  });

  it('denies creating a session whose createdBy is not the caller', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(
      db.collection('teams/team-1/calendar').add({
        date: '2026-09-12',
        trainingId: 't-2',
        trainingBusinessId: 'TR-0008',
        trainingName: 'Serve & pass',
        notes: '',
        createdBy: 'someone-else',
      })
    );
  });
});
```

- [ ] **Step 11: Run the rules test to verify it fails**

Run: `npm run test:rules -- tests/rules/calendar.rules.test.ts`
Expected: FAIL — `calendar` is not matched yet. (Record as locally unverified if the emulator will not start.)

- [ ] **Step 12: Add the `calendar` block to `firestore.rules`**

Inside `match /teams/{teamId} { … }`, immediately **after** the closing `}` of the `match /players/{playerId} { … }` sub-block (still inside `teams`), add:

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

- [ ] **Step 13: Run the rules test to verify it passes**

Run: `npm run test:rules -- tests/rules/calendar.rules.test.ts`
Expected: PASS (4 tests). Run the full `npm run test:rules` once to confirm no regression.

- [ ] **Step 14: Verify typecheck and full unit suite**

Run: `npx tsc -b` then `npm test`
Expected: 0 type errors; full suite passes.

- [ ] **Step 15: Commit**

```bash
git add src/calendar/monthGrid.ts src/calendar/monthGrid.test.ts src/types/calendarSession.ts src/calendar/calendarApi.ts src/calendar/calendarApi.test.ts tests/rules/calendar.rules.test.ts firestore.rules
git commit -m "Add team calendar month-grid helper, data layer, and team-admin rules"
```

---

## Task 6: Calendar tab UI wired into the team page

**Files:**
- Create: `src/calendar/AssignTrainingDialog.tsx`
- Create: `src/calendar/AssignTrainingDialog.test.tsx`
- Create: `src/calendar/TeamCalendarTab.tsx`
- Create: `src/calendar/TeamCalendarTab.test.tsx`
- Modify: `src/teams/TeamPage.tsx` (add the `'calendar'` tab)
- Modify: `src/teams/TeamPage.test.tsx` (assert the Calendar tab renders)

**Interfaces:**
- Consumes: `listCalendarSessions`, `createCalendarSession`, `deleteCalendarSession` from `src/calendar/calendarApi.ts`; `buildMonthGrid`, `addMonths`, `formatMonthLabel`, `monthRange` from `src/calendar/monthGrid.ts`; `listTrainings`, `findTrainingByBusinessId` from `src/trainings/trainingsApi.ts`; `CalendarSession` type; `useAuth`; `Button`, `Input`, `Textarea`, `ConfirmDialog`; `Link` from `react-router-dom`.
- Produces: `TeamCalendarTab` (`{ teamId: string }`); `AssignTrainingDialog` (`{ teamId: string; date: string; onClose: () => void; onSaved: () => void }`).

- [ ] **Step 1: Write `src/calendar/AssignTrainingDialog.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { findTrainingByBusinessId, listTrainings } from '../trainings/trainingsApi';
import type { Training } from '../types/training';
import { createCalendarSession } from './calendarApi';

interface AssignTrainingDialogProps {
  teamId: string;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AssignTrainingDialog({ teamId, date, onClose, onSaved }: AssignTrainingDialogProps) {
  const { firebaseUser } = useAuth();
  const [sessionDate, setSessionDate] = useState(date);
  const [options, setOptions] = useState<Training[]>([]);
  const [businessId, setBusinessId] = useState('');
  const [selected, setSelected] = useState<Training | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listTrainings().then((page) => setOptions(page.trainings));
  }, []);

  async function searchByBusinessId() {
    if (!businessId.trim()) return;
    const found = await findTrainingByBusinessId(businessId.trim());
    setOptions(found ? [found] : []);
    setSelected(found);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      setError('Pick a training to assign.');
      return;
    }
    if (!firebaseUser) return;
    setError(null);
    try {
      await createCalendarSession(
        teamId,
        {
          date: sessionDate,
          trainingId: selected.id,
          trainingBusinessId: selected.businessId,
          trainingName: selected.name,
          notes,
        },
        firebaseUser.uid
      );
      onSaved();
    } catch {
      setError('Could not assign the training. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Assign training"
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">Assign training</h2>

        <label htmlFor="session-date" className="mb-1 block text-sm font-medium text-ink">
          Date
        </label>
        <Input
          id="session-date"
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
        />

        <label htmlFor="session-bid" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Find by business ID
        </label>
        <div className="flex gap-2">
          <Input
            id="session-bid"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            placeholder="TR-0007"
          />
          <Button variant="secondary" size="sm" onClick={() => void searchByBusinessId()}>
            Find
          </Button>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-1 text-sm font-medium text-ink">Training</legend>
          <ul className="divide-y divide-border rounded-md border border-border">
            {options.length === 0 && <li className="p-2 text-sm text-slate">No trainings available.</li>}
            {options.map((training) => (
              <li key={training.id} className="p-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="training"
                    checked={selected?.id === training.id}
                    onChange={() => setSelected(training)}
                  />
                  <span className="tabular-nums text-slate">{training.businessId}</span>
                  <span className="text-ink">{training.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <label htmlFor="session-notes" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Notes
        </label>
        <Textarea id="session-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        {error && (
          <p role="alert" className="mt-3 text-sm text-red">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Assign
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing test `src/calendar/AssignTrainingDialog.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AssignTrainingDialog } from './AssignTrainingDialog';
import * as calendarApi from './calendarApi';
import * as trainingsApi from '../trainings/trainingsApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./calendarApi');
vi.mock('../trainings/trainingsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const training = {
  id: 't-1',
  businessId: 'TR-0007',
  name: 'Passing circuit',
  description: '',
  ageGroupTarget: 'U17',
  exercises: [],
  exerciseIds: [],
  createdBy: 'x',
  createdAt: null,
};

describe('AssignTrainingDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    vi.mocked(trainingsApi.listTrainings).mockResolvedValue({ trainings: [training], lastDoc: null });
  });

  it('creates a session with the picked training denormalized onto it', async () => {
    const createSpy = vi.mocked(calendarApi.createCalendarSession).mockResolvedValue('s-1');
    const onSaved = vi.fn();

    render(<AssignTrainingDialog teamId="team-1" date="2026-09-12" onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.click(await screen.findByLabelText(/Passing circuit/));
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Serve receive focus' } });
    fireEvent.click(screen.getByText('Assign'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createSpy).toHaveBeenCalledWith(
      'team-1',
      {
        date: '2026-09-12',
        trainingId: 't-1',
        trainingBusinessId: 'TR-0007',
        trainingName: 'Passing circuit',
        notes: 'Serve receive focus',
      },
      'coach-uid'
    );
  });

  it('blocks assigning when no training is selected', async () => {
    const createSpy = vi.mocked(calendarApi.createCalendarSession).mockResolvedValue('s-1');
    render(<AssignTrainingDialog teamId="team-1" date="2026-09-12" onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByText('Assign'));

    await screen.findByRole('alert');
    expect(createSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npm test -- src/calendar/AssignTrainingDialog.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 4: Write `src/calendar/TeamCalendarTab.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { CalendarSession } from '../types/calendarSession';
import { deleteCalendarSession, listCalendarSessions } from './calendarApi';
import { addMonths, buildMonthGrid, formatMonthLabel, monthRange } from './monthGrid';
import { AssignTrainingDialog } from './AssignTrainingDialog';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TeamCalendarTab({ teamId }: { teamId: string }) {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [assignDate, setAssignDate] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CalendarSession | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { start, end } = monthRange(view.year, view.month);
    setSessions(await listCalendarSessions(teamId, start, end));
  }, [teamId, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const grid = buildMonthGrid(view.year, view.month);
  const sessionsByDate = sessions.reduce<Record<string, CalendarSession[]>>((acc, session) => {
    (acc[session.date] ??= []).push(session);
    return acc;
  }, {});

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteCalendarSession(teamId, pendingDelete.id);
    } catch {
      setDeleteError('Could not remove the session. Please try again.');
      return;
    }
    setPendingDelete(null);
    void load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setView(addMonths(view.year, view.month, -1))}
          className="px-2 text-slate hover:text-ink"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-ink">{formatMonthLabel(view.year, view.month)}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setView(addMonths(view.year, view.month, 1))}
          className="px-2 text-slate hover:text-ink"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-lg border border-border bg-border text-sm">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-surface px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate">
            {d}
          </div>
        ))}
        {grid.flat().map((cell) => (
          <div
            key={cell.date}
            className={`min-h-24 bg-surface p-1 ${cell.inMonth ? '' : 'opacity-40'}`}
          >
            <button
              type="button"
              onClick={() => setAssignDate(cell.date)}
              className="block w-full text-right text-xs tabular-nums text-slate hover:text-blue"
              aria-label={`Assign training on ${cell.date}`}
            >
              {Number(cell.date.slice(-2))}
            </button>
            <ul className="mt-1 space-y-1">
              {(sessionsByDate[cell.date] ?? []).map((session) => (
                <li key={session.id} className="flex items-center gap-1 rounded-sm bg-blue/10 px-1 py-0.5 text-xs">
                  <Link
                    to={`/trainings?businessId=${session.trainingBusinessId}`}
                    className="flex-1 truncate text-blue hover:underline"
                    title={`${session.trainingBusinessId} · ${session.trainingName}`}
                  >
                    {session.trainingBusinessId} · {session.trainingName}
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remove ${session.trainingBusinessId} on ${session.date}`}
                    onClick={() => { setDeleteError(null); setPendingDelete(session); }}
                    className="text-red hover:text-red-strong"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {assignDate && (
        <AssignTrainingDialog
          teamId={teamId}
          date={assignDate}
          onClose={() => setAssignDate(null)}
          onSaved={() => {
            setAssignDate(null);
            void load();
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Remove this session?"
          message={`${pendingDelete.trainingBusinessId} · ${pendingDelete.trainingName} on ${pendingDelete.date}`}
          confirmLabel="Yes, remove"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
          error={deleteError}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write the failing test `src/calendar/TeamCalendarTab.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TeamCalendarTab } from './TeamCalendarTab';
import * as calendarApi from './calendarApi';

vi.mock('./calendarApi');
vi.mock('./AssignTrainingDialog', () => ({
  AssignTrainingDialog: ({ onSaved }: { onSaved: () => void }) => <button onClick={onSaved}>assign-stub</button>,
}));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const session = {
  id: 's-1',
  date: '2026-09-10',
  trainingId: 't-1',
  trainingBusinessId: 'TR-0007',
  trainingName: 'Passing circuit',
  notes: '',
  createdBy: 'coach-uid',
  createdAt: null,
};

describe('TeamCalendarTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    vi.mocked(calendarApi.listCalendarSessions).mockResolvedValue([session]);
  });

  it('renders sessions in the current month from their denormalized labels', async () => {
    render(
      <MemoryRouter>
        <TeamCalendarTab teamId="team-1" />
      </MemoryRouter>
    );

    expect(await screen.findByText('TR-0007 · Passing circuit')).toBeInTheDocument();
    expect(calendarApi.listCalendarSessions).toHaveBeenCalledWith('team-1', '2026-09-01', '2026-09-30');
  });

  it('re-queries when navigating to the next month', async () => {
    render(
      <MemoryRouter>
        <TeamCalendarTab teamId="team-1" />
      </MemoryRouter>
    );
    await screen.findByText('TR-0007 · Passing circuit');

    fireEvent.click(screen.getByLabelText('Next month'));

    await waitFor(() =>
      expect(calendarApi.listCalendarSessions).toHaveBeenLastCalledWith('team-1', '2026-10-01', '2026-10-31')
    );
  });

  it('removes a session after confirmation', async () => {
    vi.mocked(calendarApi.deleteCalendarSession).mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <TeamCalendarTab teamId="team-1" />
      </MemoryRouter>
    );
    await screen.findByText('TR-0007 · Passing circuit');

    fireEvent.click(screen.getByLabelText('Remove TR-0007 on 2026-09-10'));
    fireEvent.click(screen.getByText('Yes, remove'));

    await waitFor(() => expect(calendarApi.deleteCalendarSession).toHaveBeenCalledWith('team-1', 's-1'));
  });
});
```

Add `vi.useFakeTimers()` / `vi.useRealTimers()` around this suite if `vi.setSystemTime` is not already globally enabled — check `tests/setupTests.ts`; if timers are not faked there, wrap each test's body or add `beforeEach(() => vi.useFakeTimers())` and `afterEach(() => vi.useRealTimers())`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- src/calendar/TeamCalendarTab.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Wire the Calendar tab into `src/teams/TeamPage.tsx`**

- Add the import: `import { TeamCalendarTab } from '../calendar/TeamCalendarTab';`
- Change the `Tab` type to `type Tab = 'overview' | 'calendar' | 'plan' | 'settings';`
- Add a tab button after the "Overview" button:

```tsx
          <button onClick={() => setTab('calendar')} className={tabClass(tab === 'calendar')}>
            Calendar
          </button>
```

- Add the panel after the `tab === 'overview'` block:

```tsx
          {tab === 'calendar' && <TeamCalendarTab teamId={teamId} />}
```

- [ ] **Step 8: Update `src/teams/TeamPage.test.tsx`**

Add a test that clicks the Calendar tab and asserts the calendar renders. Mock the calendar API so it does not hit Firestore — add near the other `vi.mock` calls:

```tsx
vi.mock('../calendar/calendarApi', () => ({
  listCalendarSessions: vi.fn().mockResolvedValue([]),
  createCalendarSession: vi.fn(),
  deleteCalendarSession: vi.fn(),
}));
```

Then, in a test where the team has loaded:

```tsx
  it('shows the team calendar when the Calendar tab is selected', async () => {
    // ...existing team-load mock setup that renders the page...
    fireEvent.click(await screen.findByText('Calendar'));
    expect(await screen.findByLabelText('Next month')).toBeInTheDocument();
  });
```

Match the existing setup style in that file (how `getTeam` is mocked and the page is rendered).

- [ ] **Step 9: Run the affected tests and the full suite**

Run: `npm test -- src/teams/TeamPage.test.tsx src/calendar` then `npm test` and `npx tsc -b`
Expected: PASS across the board; 0 type errors.

- [ ] **Step 10: Commit**

```bash
git add src/calendar/AssignTrainingDialog.tsx src/calendar/AssignTrainingDialog.test.tsx src/calendar/TeamCalendarTab.tsx src/calendar/TeamCalendarTab.test.tsx src/teams/TeamPage.tsx src/teams/TeamPage.test.tsx
git commit -m "Add team Calendar tab with month view and training assignment"
```

---

## Task 7: Admin-triggered player data export

**Files:**
- Modify: `src/players/physicalTestsApi.ts` (add `listAllPhysicalTests`)
- Modify: `src/players/physicalTestsApi.test.ts` (test the new function)
- Create: `src/players/playerExport.ts`
- Create: `src/players/playerExport.test.ts`
- Modify: `src/players/PlayerCardPage.tsx` (rename the admin section, add the export button)
- Modify: `src/players/PlayerCardPage.test.tsx` (test the export button)

**Interfaces:**
- Consumes: `Player` from `src/types/player.ts`; `PhysicalTest` from `src/types/physicalTest.ts`; `db` from `src/firebase/config.ts`.
- Produces:
  - From `src/players/physicalTestsApi.ts`: `listAllPhysicalTests(teamId: string, playerId: string): Promise<PhysicalTest[]>`.
  - From `src/players/playerExport.ts`: `buildPlayerExport(player: Player, physicalTests: PhysicalTest[], now?: Date): PlayerExport` (with `interface PlayerExport { exportedAt: string; player: Record<string, unknown>; physicalTests: Record<string, unknown>[] }`), `downloadPlayerExport(player: Player, physicalTests: PhysicalTest[]): void`.

- [ ] **Step 1: Add the `listAllPhysicalTests` test to `src/players/physicalTestsApi.test.ts`**

Add inside the existing `describe('physicalTestsApi', …)` block:

```ts
  it('lists the entire physical-test history for a player, bounded by a defensive limit', async () => {
    const { listAllPhysicalTests } = await import('./physicalTestsApi');
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'test-1', data: () => ({ testType: 'cmj', bestCm: 34, date: '2026-09-07' }) },
        { id: 'test-2', data: () => ({ testType: 'growth', heightCm: 160, date: '2026-06-01' }) },
      ],
    });

    const all = await listAllPhysicalTests('team-1', 'player-1');

    expect(all).toEqual([
      { id: 'test-1', testType: 'cmj', bestCm: 34, date: '2026-09-07' },
      { id: 'test-2', testType: 'growth', heightCm: 160, date: '2026-06-01' },
    ]);
  });
```

The file's `vi.mock('firebase/firestore', …)` already stubs `getDocs`, `query`, `orderBy`, `limit` — no mock changes needed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/players/physicalTestsApi.test.ts`
Expected: FAIL — `listAllPhysicalTests` is not exported.

- [ ] **Step 3: Add `listAllPhysicalTests` to `src/players/physicalTestsApi.ts`**

```ts
const FULL_HISTORY_CAP = 500;

export async function listAllPhysicalTests(teamId: string, playerId: string): Promise<PhysicalTest[]> {
  const base = collection(db, 'teams', teamId, 'players', playerId, 'physicalTests');
  const snapshot = await getDocs(query(base, orderBy('date', 'desc'), limit(FULL_HISTORY_CAP)));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PhysicalTest);
}
```

(`collection`, `getDocs`, `query`, `orderBy`, `limit` are already imported in this file.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/players/physicalTestsApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test `src/players/playerExport.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildPlayerExport, downloadPlayerExport } from './playerExport';
import type { Player } from '../types/player';

const player = {
  id: 'player-1',
  number: 7,
  fullName: 'Alberto Valdes Rey',
  dob: '2011-05-01',
  nationality: 'ESP',
  licenseNumber: 'J-000123',
  position: 'L',
  playerPhone: '',
  guardians: [{ relation: 'mother', name: 'A', phone: '', email: 'mum@example.com' }],
  viewerEmails: ['mum@example.com'],
  teamName: 'U17',
  ageGroup: 'U17',
  season: '2026-27',
  skills: {
    serve: { score: 8, notes: 'strong jump serve', priority: false },
    attack: { score: 6, notes: '', priority: true },
    set: { score: null, notes: '', priority: false },
    defence: { score: null, notes: '', priority: false },
    reception: { score: null, notes: '', priority: false },
    jump: { score: null, notes: '', priority: false },
    speed: { score: null, notes: '', priority: false },
    iq: { score: null, notes: '', priority: false },
  },
  avgScore: 7,
  level: 'Advanced',
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: 'keep it up' },
  consent: { given: true, date: '2026-09-07', confirmedBy: 'coach@example.com' },
  createdBy: 'coach-uid',
  createdAt: { toDate: () => new Date('2026-01-02T03:04:05.000Z') },
  updatedAt: null,
} as unknown as Player;

describe('buildPlayerExport', () => {
  it('includes the full player record and physical-test history', () => {
    const result = buildPlayerExport(player, [{ id: 'test-1', testType: 'cmj', bestCm: 34, date: '2026-09-07' } as never], new Date('2026-09-07T10:00:00.000Z'));

    expect(result.exportedAt).toBe('2026-09-07T10:00:00.000Z');
    expect(result.player).toMatchObject({
      fullName: 'Alberto Valdes Rey',
      licenseNumber: 'J-000123',
      guardians: [{ relation: 'mother', name: 'A', phone: '', email: 'mum@example.com' }],
      skills: expect.objectContaining({ serve: { score: 8, notes: 'strong jump serve', priority: false } }),
      developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: 'keep it up' },
      consent: { given: true, date: '2026-09-07', confirmedBy: 'coach@example.com' },
    });
    expect(result.physicalTests).toEqual([{ id: 'test-1', testType: 'cmj', bestCm: 34, date: '2026-09-07' }]);
  });

  it('normalizes Firestore Timestamp fields to ISO strings and leaves nulls alone', () => {
    const result = buildPlayerExport(player, [], new Date('2026-09-07T10:00:00.000Z'));
    expect(result.player.createdAt).toBe('2026-01-02T03:04:05.000Z');
    expect(result.player.updatedAt).toBeNull();
  });

  it('produces a JSON-serializable object', () => {
    const result = buildPlayerExport(player, [], new Date('2026-09-07T10:00:00.000Z'));
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});

describe('downloadPlayerExport', () => {
  it('creates a blob URL and clicks an anchor', () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadPlayerExport(player, []);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- src/players/playerExport.test.ts`
Expected: FAIL with "Cannot find module './playerExport'".

- [ ] **Step 7: Write `src/players/playerExport.ts`**

```ts
import type { Player } from '../types/player';
import type { PhysicalTest } from '../types/physicalTest';

export interface PlayerExport {
  exportedAt: string;
  player: Record<string, unknown>;
  physicalTests: Record<string, unknown>[];
}

function normalizeTimestamp(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return null;
}

export function buildPlayerExport(
  player: Player,
  physicalTests: PhysicalTest[],
  now: Date = new Date()
): PlayerExport {
  const { createdAt, updatedAt, ...rest } = player;
  return {
    exportedAt: now.toISOString(),
    player: {
      ...rest,
      createdAt: normalizeTimestamp(createdAt),
      updatedAt: normalizeTimestamp(updatedAt),
    },
    physicalTests: physicalTests.map((test) => {
      const { createdAt: testCreatedAt, ...testRest } = test as PhysicalTest & { createdAt?: unknown };
      return { ...testRest, createdAt: normalizeTimestamp(testCreatedAt) };
    }),
  };
}

export function downloadPlayerExport(player: Player, physicalTests: PhysicalTest[]): void {
  const payload = buildPlayerExport(player, physicalTests);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `player-${player.fullName.replace(/\s+/g, '-')}-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
```

Note: the `physicalTests` mapping strips a possible `createdAt` even though `PhysicalTest` may not declare it — the `as PhysicalTest & { createdAt?: unknown }` cast keeps `strict` happy while tolerating whatever the stored doc actually carries.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- src/players/playerExport.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Add the export button to `src/players/PlayerCardPage.tsx`**

- Add the import: `import { downloadPlayerExport } from './playerExport';` and add `listAllPhysicalTests` to the existing `physicalTestsApi` import if one exists, otherwise `import { listAllPhysicalTests } from './physicalTestsApi';`
- Add a handler inside the component:

```tsx
  async function handleExport() {
    const tests = await listAllPhysicalTests(teamId!, playerId!);
    downloadPlayerExport(player!, tests);
  }
```

- In the `isAdmin` section, change the heading `Danger zone` to `Data & privacy`, update the paragraph to mention export, and add the button before "Delete player":

```tsx
      {isAdmin && (
        <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Data &amp; privacy</h2>
          <p className="mt-1 text-slate">
            Export produces a JSON file with this player&apos;s full record and physical-test history.
            Deleting a player also removes their physical-test history.
          </p>
          <div className="mt-3 flex items-center justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => void handleExport()}>
              Export data (JSON)
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              Delete player
            </Button>
          </div>
        </section>
      )}
```

- [ ] **Step 10: Add the export test to `src/players/PlayerCardPage.test.tsx`**

- Add a mock for the export module near the other `vi.mock` calls:

```tsx
vi.mock('./playerExport');
```

- Add a test in the admin `describe` context:

```tsx
  it('exports the player record as JSON when an admin clicks Export', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { email: 'coach@example.com' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);
    vi.spyOn(physicalTestsApi, 'listAllPhysicalTests').mockResolvedValue([]);
    const exportModule = await import('./playerExport');
    const exportSpy = vi.spyOn(exportModule, 'downloadPlayerExport').mockImplementation(() => {});

    renderPlayerCard();
    await screen.findByText('Test Player');

    fireEvent.click(screen.getByText('Export data (JSON)'));

    await waitFor(() => expect(exportSpy).toHaveBeenCalledWith(basePlayer, []));
  });
```

If `vi.mock('./playerExport')` auto-mocks `downloadPlayerExport` to a no-op already, the `vi.spyOn(...).mockImplementation` line is redundant but harmless — keep it explicit.

- [ ] **Step 11: Run the affected tests, the full suite, and the typecheck**

Run: `npm test -- src/players/PlayerCardPage.test.tsx src/players/playerExport.test.ts src/players/physicalTestsApi.test.ts` then `npm test` and `npx tsc -b`
Expected: PASS; 0 type errors.

- [ ] **Step 12: Commit**

```bash
git add src/players/physicalTestsApi.ts src/players/physicalTestsApi.test.ts src/players/playerExport.ts src/players/playerExport.test.ts src/players/PlayerCardPage.tsx src/players/PlayerCardPage.test.tsx
git commit -m "Add admin-triggered player JSON data export"
```

---

## Task 8: Public `/privacy` page

**Files:**
- Create: `src/legal/PrivacyPage.tsx`
- Create: `src/legal/PrivacyPage.test.tsx`
- Modify: `src/App.tsx` (public `/privacy` route)
- Modify: `src/auth/LoginPage.tsx` (footer link to `/privacy`)
- Modify: `src/layout/AppShell.tsx` (footer link to `/privacy`)

**Interfaces:**
- Consumes: `Link` from `react-router-dom`.
- Produces: `PrivacyPage` component registered at the public path `/privacy`.

- [ ] **Step 1: Write `src/legal/PrivacyPage.tsx`**

```tsx
// DRAFT privacy policy. Pending review by Volley Club Belair and its legal
// advisor before this is treated as an authoritative published policy. The
// data-request contact below is a placeholder and must be set to a real
// address before publication.
import { Link } from 'react-router-dom';

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl p-6 text-ink">
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Privacy Policy</h1>

      <p role="note" className="mt-3 rounded-md border border-orange bg-orange/10 p-3 text-sm text-ink">
        Draft policy — pending review by the club and its legal advisor before production use.
      </p>

      <h2 className="mt-6 text-lg font-semibold">What data we collect</h2>
      <p className="mt-1 text-slate">
        Only the information already recorded in the club&apos;s player spreadsheet: each player&apos;s
        contact and registration details (name, date of birth, nationality, licence number, position,
        phone), their parents&apos; or guardians&apos; contact details, volleyball skill scores and coach
        notes, physical-test measurements, and development-plan objectives and notes. We do not use
        analytics or third-party tracking.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Why we collect it</h2>
      <p className="mt-1 text-slate">
        To manage player development for Volley Club Belair — team rosters, skill tracking, physical
        testing, and training planning.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Who can see it</h2>
      <p className="mt-1 text-slate">
        Club administrators. Once parent access is available, a linked parent or guardian will be able
        to see their own child&apos;s record and nothing else.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Players are minors</h2>
      <p className="mt-1 text-slate">
        Players are aged roughly 13–15. The parent or legal guardian is the party who gives consent for
        their child&apos;s data to be stored, and that consent is recorded per player.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Retention</h2>
      <p className="mt-1 text-slate">
        Data is kept while the player is registered with the club. It is deleted on request, or when the
        player leaves the club.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Your rights and data requests</h2>
      <p className="mt-1 text-slate">
        Parents and guardians can request access to, correction of, or erasure of their child&apos;s data
        by contacting the club at{' '}
        <span className="font-medium">[insert the club&apos;s data-request contact address]</span>.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Security</h2>
      <p className="mt-1 text-slate">
        Data is encrypted in transit (HTTPS) and at rest, and access is controlled by per-record
        security rules.
      </p>

      <p className="mt-8 text-sm">
        <Link to="/login" className="text-blue hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing test `src/legal/PrivacyPage.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PrivacyPage } from './PrivacyPage';

describe('PrivacyPage', () => {
  it('renders the compliance-required sections', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/Draft policy/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What data we collect' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why we collect it' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Who can see it' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Players are minors' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Retention' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your rights and data requests' })).toBeInTheDocument();
    expect(screen.getByText(/parent or legal guardian is the party who gives consent/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npm test -- src/legal/PrivacyPage.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 4: Register the public `/privacy` route in `src/App.tsx`**

Add the import: `import { PrivacyPage } from './legal/PrivacyPage';`

Add the route as a sibling of `/login` and `/finish-sign-in` (NOT inside `AuthenticatedLayout`):

```tsx
          <Route path="/privacy" element={<PrivacyPage />} />
```

- [ ] **Step 5: Add a footer link on `src/auth/LoginPage.tsx`**

At the end of the rendered form/page (both the `sent` branch and the form branch, or a shared wrapper), add:

```tsx
      <p className="mt-6 text-sm">
        <a href="/privacy" className="text-slate hover:underline">
          Privacy
        </a>
      </p>
```

Use a plain `<a href>` here (the login page is rendered outside the router-linked shell in some flows); `/privacy` is a real route so a full navigation is acceptable. If `LoginPage` already renders inside `<BrowserRouter>` (it does, per `App.tsx`), prefer `import { Link } from 'react-router-dom'` and `<Link to="/privacy">`.

- [ ] **Step 6: Add a footer link in `src/layout/AppShell.tsx`**

In the desktop sidebar, just above or below the "Sign out" button, add:

```tsx
        <NavLink to="/privacy" className="px-3 py-2 text-xs font-medium text-white/50 hover:text-white/80">
          Privacy
        </NavLink>
```

(Bottom tab bar can stay as-is — the privacy link is a low-frequency footer affordance, not a primary destination.)

- [ ] **Step 7: Add an App-level test for the public route in `src/App.test.tsx`**

```tsx
  it('renders the public privacy page without authentication', async () => {
    window.history.pushState({}, '', '/privacy');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
  });
```

- [ ] **Step 8: Run the affected tests and the typecheck**

Run: `npm test -- src/legal/PrivacyPage.test.tsx src/App.test.tsx src/auth/LoginPage.test.tsx src/layout/AppShell.test.tsx` then `npx tsc -b`
Expected: PASS; 0 type errors. If `LoginPage.test.tsx` asserts an exact DOM shape that the footer link disturbs, adjust that assertion.

- [ ] **Step 9: Commit**

```bash
git add src/legal/PrivacyPage.tsx src/legal/PrivacyPage.test.tsx src/App.tsx src/App.test.tsx src/auth/LoginPage.tsx src/layout/AppShell.tsx
git commit -m "Add public /privacy draft policy page and footer links"
```

---

## Task 9: Roster table horizontal-scroll fix

**Files:**
- Modify: `src/teams/TeamRosterTable.tsx` (drop the 8 per-skill columns; keep a single averaged column)
- Modify: `src/teams/TeamRosterTable.test.tsx` (update assertions)

**Interfaces:**
- No interface change — `TeamRosterTable` keeps its `{ teamId: string }` prop and its behavior.

- [ ] **Step 1: Update `src/teams/TeamRosterTable.test.tsx`**

Replace the first test's body with assertions for the new column set and add a no-horizontal-scroll intent check:

```tsx
  it('renders players with a single averaged skill column and the level, not per-skill columns', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('player-1', 1, 'Test Player')],
      lastDoc: null,
    });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findByText('Test Player');
    expect(screen.getByText('Skill avg')).toBeInTheDocument();
    expect(screen.getByText('6.5')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    // per-skill column headers are gone
    expect(screen.queryByText('serve')).not.toBeInTheDocument();
    expect(screen.queryByText('reception')).not.toBeInTheDocument();
  });
```

Leave the "Load more" test unchanged.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/teams/TeamRosterTable.test.tsx`
Expected: FAIL — the current table still renders `serve`/`reception` headers and has no "Skill avg" header.

- [ ] **Step 3: Edit `src/teams/TeamRosterTable.tsx`**

- Delete the `SKILL_COLUMNS` constant and remove `SkillKey` from the `../types/player` import (keep `Level`, `Player`).
- In `<thead>`, delete the `{SKILL_COLUMNS.map(...)}` header cell block, and change the `Avg` header to `Skill avg`:

```tsx
              <th className={NUMERIC_HEADER_CLASS}>Skill avg</th>
```

- In `<tbody>`, delete the `{SKILL_COLUMNS.map((key) => ( <td …>{player.skills[key].score ?? '—'}</td> ))}` block. Keep the average cell:

```tsx
                <td className={NUMERIC_CELL_CLASS}>{player.avgScore?.toFixed(1) ?? '—'}</td>
```

- Leave the `overflow-x-auto` wrapper in place as a harmless narrow-screen guard.

The resulting columns are: `#`, `Name`, `Position`, `Skill avg`, `Level`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/teams/TeamRosterTable.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite, lint, typecheck, and build**

Run: `npm test` then `npm run lint` then `npx tsc -b` then `npm run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/teams/TeamRosterTable.tsx src/teams/TeamRosterTable.test.tsx
git commit -m "Collapse roster table's 8 skill columns into one averaged column"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-09-07-volley-skills-plan-3-design.md`):

- §2.1 Authorization boundaries — Task 1 (`exercises` on `isAdmin()`), Task 3 (`trainings`/`counters` on `isAdmin()`), Task 5 (`calendar` on `isTeamAdmin()`), Tasks 2 & 4 (`<RequireAdmin>` routes).
- §2.2 Navigation — Tasks 2 and 4 add unconditional `AppShell` nav items with route-gating; Calendar as a `TeamPage` tab in Task 6.
- §2.3 Referential integrity — Task 3 (`exerciseIds` written on every training create/update; `allow delete: if isAdmin()`), Task 4 ("⚠ Deleted exercise" row, delete confirm dialogs, business-ID-filtered chip link), Task 1 (`deleteExercise`, `countTrainingsUsingExercise`), Task 6 (chip label from denormalized fields, link to `/trainings?businessId=`).
- §2.4 Smart fetching — Task 1/3 (`limit(25)` + cursor), Task 5 (`monthRange` + date-string range query + `limit(200)`, denormalized `trainingName`/`trainingBusinessId` written by `createCalendarSession`), Task 7 (`listAllPhysicalTests` single `limit(500)` read).
- §3 Exercises library — Tasks 1 (types/data/rules/index) and 2 (UI/route/nav).
- §4 Trainings library — Tasks 3 (`businessId` pure fn + types + transactional data layer + rules + index) and 4 (builder + page + route + nav).
- §5 Team Calendar — Tasks 5 (`monthGrid` pure helper + types + data layer + rules) and 6 (`AssignTrainingDialog` + `TeamCalendarTab` + `TeamPage` wiring).
- §6 Player export — Task 7 (`listAllPhysicalTests`, `buildPlayerExport` pure, `downloadPlayerExport`, `PlayerCardPage` button, no new rules).
- §7 `/privacy` page — Task 8 (component with all required sections + draft banner + placeholder contact, public route, footer links, render test).
- §8 Roster table fix — Task 9.
- §9 Testing strategy — rules tests in Tasks 1, 3, 5 (highest priority); unit tests for `formatBusinessId` (Task 3), `monthGrid` (Task 5), `buildPlayerExport`/`downloadPlayerExport` (Task 7); component tests for `TrainingBuilderDialog` (Task 4), `ExerciseFormDialog`/`ExercisesPage` (Task 2), `TrainingsPage` (Task 4), `TeamCalendarTab`/`AssignTrainingDialog` (Task 6), `PrivacyPage` (Task 8), plus updates to `PlayerCardPage` and `TeamRosterTable` tests.
- §10 Open items — carried into this Self-Review's closing notes; nothing in §10 requires a task.

**Placeholder scan:** No "TBD"/"TODO"/"add error handling" placeholders. Every code step carries complete code. The one intentional in-copy placeholder — `[insert the club's data-request contact address]` in `PrivacyPage.tsx` — is a spec-mandated content gap (§7) flagged by the draft banner and the file-header comment, not a plan omission. `TrainingBuilderDialog`'s "⚠ Deleted exercise" row is a rendered feature, not a deferral. The Task 6 note about `vi.useFakeTimers` and the Task 2/4 notes about `lucide-react` icon-name fallback are environment-contingency instructions with a concrete action, not vague hand-waving.

**Type consistency:**
- `ExerciseCategory`, `Exercise`, `NewExerciseInput`, `EXERCISE_CATEGORIES` — defined once in `src/types/exercise.ts` (Task 1), consumed unchanged by `exercisesApi.ts` (Task 1) and the Task 2 / Task 4 components.
- `TrainingExercise`, `Training`, `NewTrainingInput` — defined once in `src/types/training.ts` (Task 3); `Training.exerciseIds` and `Training.exercises` both present and both written by `createTraining`/`updateTraining` (Task 3) and rendered/rebuilt by `TrainingBuilderDialog` (Task 4).
- `formatBusinessId(sequence: number): string` — defined in Task 3, used by `trainingsApi.createTraining` in the same task; the `TR-0007` format string matches the spec and the rules test's seed data.
- `CalendarSession` / `NewCalendarSessionInput` — defined once in `src/types/calendarSession.ts` (Task 5); the denormalized `trainingBusinessId`/`trainingName` fields are written by `createCalendarSession` (Task 5), supplied by `AssignTrainingDialog` from the picked `Training` (Task 6), and read by `TeamCalendarTab` (Task 6).
- `monthGrid.ts` exports `buildMonthGrid` / `addMonths` / `formatMonthLabel` / `monthRange` (Task 5) — all four consumed by `TeamCalendarTab` (Task 6) with matching signatures (month is 0-indexed everywhere).
- `listCalendarSessions(teamId, startDate, endDate)` — same 3-arg string signature in the data layer (Task 5), its test (Task 5), and both `TeamCalendarTab` and its test (Task 6).
- `buildPlayerExport(player, physicalTests, now?)` / `downloadPlayerExport(player, physicalTests)` — defined in Task 7, `downloadPlayerExport` consumed by `PlayerCardPage` (Task 7) with the exact `(player, tests)` argument order the `PlayerCardPage` test asserts.
- `listAllPhysicalTests(teamId, playerId)` — added to `physicalTestsApi.ts` in Task 7, mocked in both `physicalTestsApi.test.ts` and `PlayerCardPage.test.tsx` in the same task.
- Rules helper reuse: `isAdmin()` already exists at the top level of `firestore.rules` (used by `skillGuide`/`physicalTestGuide`); Tasks 1 and 3 call it without redefining it. Task 5 defines a block-local `isTeamAdmin()` inside `match /calendar/{sessionId}` mirroring the existing `match /players/{playerId}` helper — deliberately not shared, matching the codebase's per-match-block pattern.

**Scope check:** 9 tasks, each an independently testable deliverable ending in its own commit, sequenced by real dependency (exercises → trainings builder → calendar assignment; export, privacy, and the roster fix are independent and could be reordered). Comparable to Plan 1 (14) and smaller than Plan 2 (20). No task bundles two things a reviewer would want to accept/reject separately.

**Deferred / open items carried forward (spec §10):**
- Viewer invite flow remains schema-only; the `AppShell` now shows three admin-only destinations (Guides, Exercises, Trainings) to any signed-in user — acceptable while `admin` is the only end-to-end role, to be revisited (role-conditional nav or a viewer shell) when the viewer flow is built.
- `PrivacyPage` ships as a draft: the club must supply a real data-request contact and have the policy reviewed before it is authoritative.
- The Monday-first month grid and the 7-column layout on mobile should be eyeballed in a real browser once built (no visual-regression tooling in this project).
- `businessId` monotonicity is guaranteed by the transaction under normal contention only; a malformed manual counter write by an admin is out of scope under the "admins are trusted club staff" threat model, and not worth a Cloud Function.
- If `npm run test:rules` cannot run locally (no JDK 21+), Tasks 1, 3, and 5 still commit their rules tests, flagged as locally unverified — same convention as Plans 1 and 2.
