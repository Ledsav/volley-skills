# Physical Testing Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Physical Session" tab to the team page that lets a coach run a live, multi-player physical-testing session — recording attempts for whichever quality/player combination is in front of them, in any order, with crash-safe draft persistence and on-screen stopwatches for the two timed qualities.

**Architecture:** A new `teams/{teamId}/testingSessions/{sessionId}/entries/{entryId}` Firestore subtree holds in-progress drafts (one entry per player+quality), separate from the existing `physicalTests` collection which stays write-once/complete-only. At most one open session per team is enforced via a transaction on a new `teams/{teamId}.activeTestingSessionId` field, mirroring the codebase's existing `counters/trainings` transactional pattern. A new `src/physicalSessions/` feature folder holds the API and UI; a small extraction (`physicalTestFieldLogic.ts`) pulls the per-quality field-construction/validation logic already inside `AddPhysicalTestDialog` into a shared pure module so the new recording panel doesn't duplicate it.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind CSS, Firebase Firestore (client SDK: `addDoc`/`setDoc`/`getDoc`/`getDocs`/`runTransaction`), Vitest + Testing Library, `firebase/rules-unit-testing` for rules tests, `lucide-react` icons.

**Spec:** `docs/superpowers/specs/2026-09-16-volley-skills-physical-testing-session-design.md`

## Global Constraints

- TypeScript `strict`, plus `noUnusedLocals`/`noUnusedParameters` — unused symbols fail the build.
- Tests sit next to the code they cover (`foo.ts` / `foo.test.ts`).
- No view does an unbounded collection read; every list query is `orderBy(...).limit(N)` (see CLAUDE.md "Fetching discipline"). All reads in this plan are bounded to a single session's data or capped page sizes.
- Firestore document types live in `src/types/`; feature code lives in `src/<feature>/`; components never call `firebase/firestore` directly — only `<feature>Api.ts` modules do.
- Writes use `serverTimestamp()`; computed fields are derived on write, not in the UI.
- Any `firestore.rules` change needs a corresponding test in `tests/rules/` — those tests are the real verification of the security boundary. Rules tests run only via `npm run test:rules` (not `npm test`).
- Dates are ISO `"YYYY-MM-DD"` strings, never `Timestamp`.
- Admin-only feature: every new collection/subcollection here is gated the same way `physicalTests` is today — `isTeamAdmin()`, no viewer access.

---

## Task 1: Extract shared physical-test field logic

Pulls the per-quality "is this complete?" and "build the Firestore input" logic out of `AddPhysicalTestDialog` into a pure, tested module, so both the existing dialog and the new session recording panel (Task 7) share one implementation instead of duplicating ~90 lines of if/else.

**Files:**
- Create: `src/players/physicalTestFieldLogic.ts`
- Create: `src/players/physicalTestFieldLogic.test.ts`
- Modify: `src/players/AddPhysicalTestDialog.tsx:63-154` (`handleSubmit`)

**Interfaces:**
- Produces:
  ```ts
  export interface PhysicalTestFields {
    heightCm: string;
    bodyMassKg: string;
    cmjAttempts: number[];
    broadJumpAttempts: number[];
    standingReachCm: string;
    touchAttempts: number[];
    sprintAttempts: number[];
    rightFirstSeconds: string;
    leftFirstSeconds: string;
    reactionAttempts: number[];
    strengthMode: 'weighted' | 'bodyweight';
    weightedExercise: WeightedExercise;
    weightKg: string;
    bodyweightExercise: BodyweightExercise;
    reps: string;
  }
  export function isPhysicalTestReady(testType: PhysicalTestType, fields: PhysicalTestFields): boolean;
  export function buildPhysicalTestInput(
    testType: PhysicalTestType,
    fields: PhysicalTestFields,
    date: string,
    notes: string,
    latestBodyMassKg: number | null
  ): NewPhysicalTestInput;
  ```
  Task 7 (`SessionQualityPanel`) and Task 4 (`testingSessionsApi`) consume both functions.

- [ ] **Step 1: Write the failing tests**

```ts
// src/players/physicalTestFieldLogic.test.ts
import { describe, expect, it } from 'vitest';
import { isPhysicalTestReady, buildPhysicalTestInput, type PhysicalTestFields } from './physicalTestFieldLogic';

const BASE: PhysicalTestFields = {
  heightCm: '',
  bodyMassKg: '',
  cmjAttempts: [],
  broadJumpAttempts: [],
  standingReachCm: '',
  touchAttempts: [],
  sprintAttempts: [],
  rightFirstSeconds: '',
  leftFirstSeconds: '',
  reactionAttempts: [],
  strengthMode: 'weighted',
  weightedExercise: 'trapBarDeadlift',
  weightKg: '',
  bodyweightExercise: 'pushUps',
  reps: '',
};

describe('isPhysicalTestReady', () => {
  it('growth needs both height and body mass', () => {
    expect(isPhysicalTestReady('growth', BASE)).toBe(false);
    expect(isPhysicalTestReady('growth', { ...BASE, heightCm: '160', bodyMassKg: '50' })).toBe(true);
  });

  it('cmj needs at least 3 attempts', () => {
    expect(isPhysicalTestReady('cmj', { ...BASE, cmjAttempts: [30, 34] })).toBe(false);
    expect(isPhysicalTestReady('cmj', { ...BASE, cmjAttempts: [30, 34, 32] })).toBe(true);
  });

  it('sprint10m needs at least 2 attempts', () => {
    expect(isPhysicalTestReady('sprint10m', { ...BASE, sprintAttempts: [2.1] })).toBe(false);
    expect(isPhysicalTestReady('sprint10m', { ...BASE, sprintAttempts: [2.1, 2.05] })).toBe(true);
  });

  it('shuttle5105 needs both sides', () => {
    expect(isPhysicalTestReady('shuttle5105', { ...BASE, rightFirstSeconds: '5.1' })).toBe(false);
    expect(
      isPhysicalTestReady('shuttle5105', { ...BASE, rightFirstSeconds: '5.1', leftFirstSeconds: '5.3' })
    ).toBe(true);
  });

  it('reaction needs at least 5 attempts', () => {
    expect(isPhysicalTestReady('reaction', { ...BASE, reactionAttempts: [1, 2, 3, 4] })).toBe(false);
    expect(isPhysicalTestReady('reaction', { ...BASE, reactionAttempts: [1, 2, 3, 4, 5] })).toBe(true);
  });

  it('strength needs weightKg when weighted, reps when bodyweight', () => {
    expect(isPhysicalTestReady('strength', { ...BASE, strengthMode: 'weighted' })).toBe(false);
    expect(isPhysicalTestReady('strength', { ...BASE, strengthMode: 'weighted', weightKg: '80' })).toBe(true);
    expect(isPhysicalTestReady('strength', { ...BASE, strengthMode: 'bodyweight' })).toBe(false);
    expect(isPhysicalTestReady('strength', { ...BASE, strengthMode: 'bodyweight', reps: '12' })).toBe(true);
  });
});

describe('buildPhysicalTestInput', () => {
  it('builds a cmj input with the computed best', () => {
    const input = buildPhysicalTestInput('cmj', { ...BASE, cmjAttempts: [30, 34, 32] }, '2026-09-07', '', null);
    expect(input).toEqual({ testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34, date: '2026-09-07', notes: '' });
  });

  it('builds an approachJump input with derived jump height', () => {
    const input = buildPhysicalTestInput(
      'approachJump',
      { ...BASE, standingReachCm: '210', touchAttempts: [260, 265, 258] },
      '2026-09-07',
      '',
      null
    );
    expect(input).toEqual({
      testType: 'approachJump',
      standingReachCm: 210,
      attemptsTouchCm: [260, 265, 258],
      bestTouchCm: 265,
      approachJumpCm: 55,
      date: '2026-09-07',
      notes: '',
    });
  });

  it('builds a weighted strength input with a body-mass ratio when known', () => {
    const input = buildPhysicalTestInput(
      'strength',
      { ...BASE, strengthMode: 'weighted', weightedExercise: 'squat', weightKg: '80' },
      '2026-09-07',
      '',
      50
    );
    expect(input).toEqual({
      testType: 'strength',
      mode: 'weighted',
      exercise: 'squat',
      weightKg: 80,
      reps6RM: 6,
      bodyMassRatio: 1.6,
      date: '2026-09-07',
      notes: '',
    });
  });

  it('builds a bodyweight strength input', () => {
    const input = buildPhysicalTestInput(
      'strength',
      { ...BASE, strengthMode: 'bodyweight', bodyweightExercise: 'splitSquat', reps: '15' },
      '2026-09-07',
      '',
      null
    );
    expect(input).toEqual({
      testType: 'strength',
      mode: 'bodyweight',
      exercise: 'splitSquat',
      reps: 15,
      date: '2026-09-07',
      notes: '',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/players/physicalTestFieldLogic.test.ts`
Expected: FAIL — `Cannot find module './physicalTestFieldLogic'`

- [ ] **Step 3: Implement the module**

```ts
// src/players/physicalTestFieldLogic.ts
import { bestOf, computeApproachJump, computeReaction, computeBodyMassRatio } from './physicalTestMath';
import type {
  BodyweightExercise,
  NewPhysicalTestInput,
  PhysicalTestType,
  WeightedExercise,
} from '../types/physicalTest';

export interface PhysicalTestFields {
  heightCm: string;
  bodyMassKg: string;
  cmjAttempts: number[];
  broadJumpAttempts: number[];
  standingReachCm: string;
  touchAttempts: number[];
  sprintAttempts: number[];
  rightFirstSeconds: string;
  leftFirstSeconds: string;
  reactionAttempts: number[];
  strengthMode: 'weighted' | 'bodyweight';
  weightedExercise: WeightedExercise;
  weightKg: string;
  bodyweightExercise: BodyweightExercise;
  reps: string;
}

function filled(attempts: number[], min: number): boolean {
  return attempts.length >= min && attempts.every((v) => !Number.isNaN(v));
}

export function isPhysicalTestReady(testType: PhysicalTestType, fields: PhysicalTestFields): boolean {
  switch (testType) {
    case 'growth':
      return fields.heightCm !== '' && fields.bodyMassKg !== '';
    case 'cmj':
      return filled(fields.cmjAttempts, 3);
    case 'broadJump':
      return filled(fields.broadJumpAttempts, 3);
    case 'approachJump':
      return fields.standingReachCm !== '' && filled(fields.touchAttempts, 3);
    case 'sprint10m':
      return filled(fields.sprintAttempts, 2);
    case 'shuttle5105':
      return fields.rightFirstSeconds !== '' && fields.leftFirstSeconds !== '';
    case 'reaction':
      return filled(fields.reactionAttempts, 5);
    case 'strength':
      return fields.strengthMode === 'weighted' ? fields.weightKg !== '' : fields.reps !== '';
    default:
      return false;
  }
}

export function buildPhysicalTestInput(
  testType: PhysicalTestType,
  fields: PhysicalTestFields,
  date: string,
  notes: string,
  latestBodyMassKg: number | null
): NewPhysicalTestInput {
  if (testType === 'growth') {
    return { testType: 'growth', heightCm: Number(fields.heightCm), bodyMassKg: Number(fields.bodyMassKg), date, notes };
  }
  if (testType === 'cmj') {
    return { testType: 'cmj', attemptsCm: fields.cmjAttempts, bestCm: bestOf(fields.cmjAttempts, 'max'), date, notes };
  }
  if (testType === 'broadJump') {
    return {
      testType: 'broadJump',
      attemptsCm: fields.broadJumpAttempts,
      bestCm: bestOf(fields.broadJumpAttempts, 'max'),
      date,
      notes,
    };
  }
  if (testType === 'approachJump') {
    const { bestTouchCm, approachJumpCm } = computeApproachJump(Number(fields.standingReachCm), fields.touchAttempts);
    return {
      testType: 'approachJump',
      standingReachCm: Number(fields.standingReachCm),
      attemptsTouchCm: fields.touchAttempts,
      bestTouchCm,
      approachJumpCm,
      date,
      notes,
    };
  }
  if (testType === 'sprint10m') {
    return {
      testType: 'sprint10m',
      attemptsSeconds: fields.sprintAttempts,
      bestSeconds: bestOf(fields.sprintAttempts, 'min'),
      date,
      notes,
    };
  }
  if (testType === 'shuttle5105') {
    return {
      testType: 'shuttle5105',
      rightFirstSeconds: Number(fields.rightFirstSeconds),
      leftFirstSeconds: Number(fields.leftFirstSeconds),
      date,
      notes,
    };
  }
  if (testType === 'reaction') {
    const { averageCm, reactionTimeMs } = computeReaction(fields.reactionAttempts);
    return { testType: 'reaction', attemptsCm: fields.reactionAttempts, averageCm, reactionTimeMs, date, notes };
  }
  if (fields.strengthMode === 'weighted') {
    const bodyMassRatio =
      latestBodyMassKg !== null ? computeBodyMassRatio(Number(fields.weightKg), latestBodyMassKg) : null;
    return {
      testType: 'strength',
      mode: 'weighted',
      exercise: fields.weightedExercise,
      weightKg: Number(fields.weightKg),
      reps6RM: 6,
      bodyMassRatio,
      date,
      notes,
    };
  }
  return {
    testType: 'strength',
    mode: 'bodyweight',
    exercise: fields.bodyweightExercise,
    reps: Number(fields.reps),
    date,
    notes,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/players/physicalTestFieldLogic.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Delegate `AddPhysicalTestDialog.handleSubmit` to the shared module**

In `src/players/AddPhysicalTestDialog.tsx`, replace line 5's import:

```tsx
import { bestOf, computeApproachJump, computeReaction, computeBodyMassRatio } from './physicalTestMath';
```

with:

```tsx
import { computeBodyMassRatio } from './physicalTestMath';
import { isPhysicalTestReady, buildPhysicalTestInput, type PhysicalTestFields } from './physicalTestFieldLogic';
```

(`computeBodyMassRatio` stays — it's still called directly in the JSX body-mass-ratio preview text around line 348. `bestOf`, `computeApproachJump`, and `computeReaction` are no longer used in this file once `handleSubmit` is replaced below.)

Then replace the body of `handleSubmit` (currently lines 63-154) with:

```tsx
async function handleSubmit(event: FormEvent) {
  event.preventDefault();
  setError(null);

  const fields: PhysicalTestFields = {
    heightCm,
    bodyMassKg,
    cmjAttempts,
    broadJumpAttempts,
    standingReachCm,
    touchAttempts,
    sprintAttempts,
    rightFirstSeconds,
    leftFirstSeconds,
    reactionAttempts,
    strengthMode,
    weightedExercise,
    weightKg,
    bodyweightExercise,
    reps,
  };

  if (!isPhysicalTestReady(testType, fields)) {
    setError('Please fill in every attempt before saving.');
    return;
  }

  const input = buildPhysicalTestInput(testType, fields, date, notes, latestBodyMassKg);

  try {
    await createPhysicalTest(teamId, playerId, input, recordedByUid);
  } catch {
    setError('Could not save the test entry. Please try again.');
    return;
  }
  onSaved();
}
```

Remove the now-unused `bestOf`, `computeApproachJump`, `computeReaction`, `computeBodyMassRatio` import from `AddPhysicalTestDialog.tsx` (they're only used inside the JSX body-mass-ratio preview text on line ~348 — keep `computeBodyMassRatio` imported since that preview still calls it directly; drop the other three).

- [ ] **Step 6: Run the existing dialog tests to confirm no regression**

Run: `npx vitest run src/players/AddPhysicalTestDialog.test.tsx`
Expected: PASS (all pre-existing cases, unchanged)

- [ ] **Step 7: Commit**

```bash
git add src/players/physicalTestFieldLogic.ts src/players/physicalTestFieldLogic.test.ts src/players/AddPhysicalTestDialog.tsx
git commit -m "$(cat <<'EOF'
Extract shared physical-test field logic from AddPhysicalTestDialog

Pulls the per-quality readiness check and input-building switch into a
pure, tested module so the upcoming session recording panel can reuse
it instead of duplicating it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Uf4tfLfdRpLAvmYg9SW1Jt
EOF
)"
```

---

## Task 2: Testing session types

**Files:**
- Create: `src/types/testingSession.ts`
- Modify: `src/types/team.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TestingSession {
    id: string;
    date: string;
    status: 'open' | 'closed';
    createdBy: string;
    createdAt: unknown;
    closedAt: unknown | null;
  }
  export interface TestingSessionEntry {
    id: string;
    playerId: string;
    testType: PhysicalTestType;
    status: 'in_progress' | 'complete';
    data: Record<string, unknown>;
    resultTestId: string | null;
    updatedAt: unknown;
  }
  export function buildEntryId(playerId: string, testType: PhysicalTestType): string;
  ```
  Consumed by Tasks 3, 4, 6, 7, 8, 9, 10, 11.

- [ ] **Step 1: Write the failing test**

```ts
// src/types/testingSession.test.ts
import { describe, expect, it } from 'vitest';
import { buildEntryId } from './testingSession';

describe('buildEntryId', () => {
  it('joins playerId and testType with a double underscore', () => {
    expect(buildEntryId('player-1', 'cmj')).toBe('player-1__cmj');
  });

  it('produces distinct ids for every known test type on the same player', () => {
    const types = ['growth', 'cmj', 'approachJump', 'broadJump', 'sprint10m', 'shuttle5105', 'reaction', 'strength'] as const;
    const ids = types.map((t) => buildEntryId('player-1', t));
    expect(new Set(ids).size).toBe(types.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/types/testingSession.test.ts`
Expected: FAIL — `Cannot find module './testingSession'`

- [ ] **Step 3: Implement the types**

```ts
// src/types/testingSession.ts
import type { PhysicalTestType } from './physicalTest';

export interface TestingSession {
  id: string;
  date: string;
  status: 'open' | 'closed';
  createdBy: string;
  createdAt: unknown;
  closedAt: unknown | null;
}

export interface TestingSessionEntry {
  id: string;
  playerId: string;
  testType: PhysicalTestType;
  status: 'in_progress' | 'complete';
  data: Record<string, unknown>;
  resultTestId: string | null;
  updatedAt: unknown;
}

export function buildEntryId(playerId: string, testType: PhysicalTestType): string {
  return `${playerId}__${testType}`;
}
```

Add the new team field in `src/types/team.ts`:

```ts
export interface Team {
  id: string;
  name: string;
  club: string;
  ageGroup: string;
  season: string;
  description: string;
  notes: string;
  adminEmails: string[];
  developmentPlan: DevelopmentPlan;
  createdBy: string;
  createdAt: unknown;
  activeTestingSessionId: string | null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/types/testingSession.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/testingSession.ts src/types/testingSession.test.ts src/types/team.ts
git commit -m "$(cat <<'EOF'
Add TestingSession/TestingSessionEntry types and Team.activeTestingSessionId

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Uf4tfLfdRpLAvmYg9SW1Jt
EOF
)"
```

---

## Task 3: Session lifecycle API (start / close / read)

**Files:**
- Create: `src/physicalSessions/testingSessionsApi.ts`
- Create: `src/physicalSessions/testingSessionsApi.test.ts`

**Interfaces:**
- Consumes: `Team`, `TestingSession` from Task 2; `db` from `src/firebase/config`; `withBackoff` from `src/firebase/withBackoff`.
- Produces:
  ```ts
  export async function startSession(teamId: string, date: string, creatorUid: string): Promise<string>;
  export async function closeSession(teamId: string, sessionId: string): Promise<void>;
  export async function getSession(teamId: string, sessionId: string): Promise<TestingSession | null>;
  export async function listPastSessions(teamId: string): Promise<TestingSession[]>;
  ```
  Consumed by Task 11 (`StartSessionCard`) and Task 12 (`TeamPhysicalSessionTab`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/physicalSessions/testingSessionsApi.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startSession, closeSession, getSession, listPastSessions } from './testingSessionsApi';

const { mockRunTransaction, mockCollection, mockDoc, mockGetDoc, mockGetDocs, mockQuery } = vi.hoisted(() => ({
  mockRunTransaction: vi.fn(),
  mockCollection: vi.fn(() => 'sessions-collection'),
  mockDoc: vi.fn((...args: unknown[]) => ({ type: 'doc', args, id: 'session-1' })),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn((...args: unknown[]) => args),
}));

vi.mock('firebase/firestore', () => ({
  runTransaction: mockRunTransaction,
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('testingSessionsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockImplementation((...args: unknown[]) => ({ type: 'doc', args, id: 'session-1' }));
  });

  it('starts a session inside a transaction when the team has no active session', async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ data: () => ({ activeTestingSessionId: null }) }),
      set: vi.fn(),
      update: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

    const id = await startSession('team-1', '2026-09-16', 'coach-uid');

    expect(id).toBe('session-1');
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1' }),
      expect.objectContaining({ date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: 'server-timestamp', closedAt: null })
    );
    expect(tx.update).toHaveBeenCalledWith(expect.anything(), { activeTestingSessionId: 'session-1' });
  });

  it('refuses to start a session when the team already has one open', async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ data: () => ({ activeTestingSessionId: 'session-existing' }) }),
      set: vi.fn(),
      update: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

    await expect(startSession('team-1', '2026-09-16', 'coach-uid')).rejects.toThrow(
      'A testing session is already open for this team.'
    );
    expect(tx.set).not.toHaveBeenCalled();
  });

  it('closes a session inside a transaction and clears the team pointer', async () => {
    const tx = { update: vi.fn() };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

    await closeSession('team-1', 'session-1');

    expect(tx.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'closed', closedAt: 'server-timestamp' })
    );
    expect(tx.update).toHaveBeenCalledWith(expect.anything(), { activeTestingSessionId: null });
  });

  it('gets a session by id', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, id: 'session-1', data: () => ({ date: '2026-09-16', status: 'open' }) });

    const session = await getSession('team-1', 'session-1');

    expect(session).toEqual({ id: 'session-1', date: '2026-09-16', status: 'open' });
  });

  it('returns null when the session does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    expect(await getSession('team-1', 'missing')).toBeNull();
  });

  it('lists closed sessions, most recent first, bounded to 50', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'session-1', data: () => ({ date: '2026-09-10', status: 'closed' }) }],
    });

    const sessions = await listPastSessions('team-1');

    expect(sessions).toEqual([{ id: 'session-1', date: '2026-09-10', status: 'closed' }]);
    const queryArgs = mockQuery.mock.calls[0];
    expect(queryArgs).toContainEqual({ type: 'where', args: ['status', '==', 'closed'] });
    expect(queryArgs).toContainEqual({ type: 'orderBy', args: ['date', 'desc'] });
    expect(queryArgs).toContainEqual({ type: 'limit', args: [50] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/physicalSessions/testingSessionsApi.test.ts`
Expected: FAIL — module does not exist yet

- [ ] **Step 3: Implement the lifecycle functions**

```ts
// src/physicalSessions/testingSessionsApi.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { TestingSession } from '../types/testingSession';

const PAST_SESSIONS_CAP = 50;

export async function startSession(teamId: string, date: string, creatorUid: string): Promise<string> {
  const teamRef = doc(db, 'teams', teamId);
  const sessionRef = doc(collection(db, 'teams', teamId, 'testingSessions'));

  await runTransaction(db, async (tx) => {
    const teamSnap = await tx.get(teamRef);
    const activeId = (teamSnap.data() as { activeTestingSessionId?: string | null } | undefined)?.activeTestingSessionId;
    if (activeId) {
      throw new Error('A testing session is already open for this team.');
    }
    tx.set(sessionRef, {
      date,
      status: 'open',
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
      closedAt: null,
    });
    tx.update(teamRef, { activeTestingSessionId: sessionRef.id });
  });

  return sessionRef.id;
}

export async function closeSession(teamId: string, sessionId: string): Promise<void> {
  const teamRef = doc(db, 'teams', teamId);
  const sessionRef = doc(db, 'teams', teamId, 'testingSessions', sessionId);

  await runTransaction(db, async (tx) => {
    tx.update(sessionRef, { status: 'closed', closedAt: serverTimestamp() });
    tx.update(teamRef, { activeTestingSessionId: null });
  });
}

export async function getSession(teamId: string, sessionId: string): Promise<TestingSession | null> {
  const snapshot = await getDoc(doc(db, 'teams', teamId, 'testingSessions', sessionId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as TestingSession;
}

export async function listPastSessions(teamId: string): Promise<TestingSession[]> {
  const base = collection(db, 'teams', teamId, 'testingSessions');
  const snapshot = await getDocs(
    query(base, where('status', '==', 'closed'), orderBy('date', 'desc'), limit(PAST_SESSIONS_CAP))
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TestingSession);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/physicalSessions/testingSessionsApi.test.ts`
Expected: PASS (all 6 cases)

- [ ] **Step 5: Commit**

```bash
git add src/physicalSessions/testingSessionsApi.ts src/physicalSessions/testingSessionsApi.test.ts
git commit -m "$(cat <<'EOF'
Add testing session lifecycle API (start/close/get/list)

At-most-one-open-session-per-team is enforced by a transaction on
teams/{teamId}.activeTestingSessionId, the same pattern this codebase
already uses for training businessId sequencing.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Uf4tfLfdRpLAvmYg9SW1Jt
EOF
)"
```

---

## Task 4: Session entry API (draft save / finish / list)

**Files:**
- Modify: `src/physicalSessions/testingSessionsApi.ts`
- Modify: `src/physicalSessions/testingSessionsApi.test.ts`

**Interfaces:**
- Consumes: `buildEntryId` from Task 2; `createPhysicalTest` from `src/players/physicalTestsApi.ts`; `TestingSessionEntry` from Task 2.
- Produces:
  ```ts
  export async function getEntries(teamId: string, sessionId: string): Promise<TestingSessionEntry[]>;
  export async function saveEntryProgress(
    teamId: string,
    sessionId: string,
    playerId: string,
    testType: PhysicalTestType,
    data: Record<string, unknown>
  ): Promise<void>;
  export async function finishEntry(
    teamId: string,
    sessionId: string,
    playerId: string,
    testType: PhysicalTestType,
    input: NewPhysicalTestInput,
    recordedByUid: string
  ): Promise<string>;
  ```
  Consumed by Task 7 (`SessionQualityPanel`) and Task 9 (`LiveSessionView`).

- [ ] **Step 1: Add the failing tests**

Append to `src/physicalSessions/testingSessionsApi.test.ts` (extend the `vi.mock('firebase/firestore', ...)` factory to also export `setDoc: mockSetDoc` and `getDocs` is already mocked; add `mockSetDoc` to the `vi.hoisted` block, and mock `../players/physicalTestsApi`):

```ts
// add to the vi.hoisted(...) block:
mockSetDoc: vi.fn(),

// add to the firebase/firestore mock factory:
setDoc: mockSetDoc,

// add near the top of the file, alongside the other vi.mock calls:
vi.mock('../players/physicalTestsApi', () => ({ createPhysicalTest: vi.fn() }));

// new describe block, appended to the file:
describe('testingSessionsApi entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockImplementation((...args: unknown[]) => ({ type: 'doc', args, id: 'player-1__cmj' }));
  });

  it('lists entries for a session', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'player-1__cmj', data: () => ({ playerId: 'player-1', testType: 'cmj', status: 'in_progress', data: {}, resultTestId: null }) }],
    });

    const entries = await getEntries('team-1', 'session-1');

    expect(entries).toEqual([
      { id: 'player-1__cmj', playerId: 'player-1', testType: 'cmj', status: 'in_progress', data: {}, resultTestId: null },
    ]);
  });

  it('saves in-progress draft data for one player+quality', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    await saveEntryProgress('team-1', 'session-1', 'player-1', 'cmj', { cmjAttempts: [30] });

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        playerId: 'player-1',
        testType: 'cmj',
        status: 'in_progress',
        data: { cmjAttempts: [30] },
        updatedAt: 'server-timestamp',
      }),
      { merge: true }
    );
  });

  it('finishes an entry: writes the physicalTest and marks the entry complete', async () => {
    const { createPhysicalTest } = await import('../players/physicalTestsApi');
    vi.mocked(createPhysicalTest).mockResolvedValue('test-99');
    mockSetDoc.mockResolvedValue(undefined);

    const input = { testType: 'cmj' as const, attemptsCm: [30, 34, 32], bestCm: 34, date: '2026-09-16', notes: '' };
    const resultId = await finishEntry('team-1', 'session-1', 'player-1', 'cmj', input, 'coach-uid');

    expect(resultId).toBe('test-99');
    expect(createPhysicalTest).toHaveBeenCalledWith('team-1', 'player-1', input, 'coach-uid');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'complete', resultTestId: 'test-99', updatedAt: 'server-timestamp' }),
      { merge: true }
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/physicalSessions/testingSessionsApi.test.ts`
Expected: FAIL — `getEntries`/`saveEntryProgress`/`finishEntry` not exported yet

- [ ] **Step 3: Implement the entry functions**

Append to `src/physicalSessions/testingSessionsApi.ts` (add `setDoc` and `collection`/`doc` already imported; add the new import and functions):

```ts
// add to the existing firebase/firestore import:
import { /* ...existing..., */ setDoc } from 'firebase/firestore';
import { createPhysicalTest } from '../players/physicalTestsApi';
import { buildEntryId, type TestingSessionEntry } from '../types/testingSession';
import type { NewPhysicalTestInput, PhysicalTestType } from '../types/physicalTest';

export async function getEntries(teamId: string, sessionId: string): Promise<TestingSessionEntry[]> {
  const snapshot = await getDocs(collection(db, 'teams', teamId, 'testingSessions', sessionId, 'entries'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TestingSessionEntry);
}

export async function saveEntryProgress(
  teamId: string,
  sessionId: string,
  playerId: string,
  testType: PhysicalTestType,
  data: Record<string, unknown>
): Promise<void> {
  const entryId = buildEntryId(playerId, testType);
  const ref = doc(db, 'teams', teamId, 'testingSessions', sessionId, 'entries', entryId);
  await setDoc(
    ref,
    { playerId, testType, status: 'in_progress', data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function finishEntry(
  teamId: string,
  sessionId: string,
  playerId: string,
  testType: PhysicalTestType,
  input: NewPhysicalTestInput,
  recordedByUid: string
): Promise<string> {
  const resultTestId = await createPhysicalTest(teamId, playerId, input, recordedByUid);
  const entryId = buildEntryId(playerId, testType);
  const ref = doc(db, 'teams', teamId, 'testingSessions', sessionId, 'entries', entryId);
  await setDoc(ref, { status: 'complete', resultTestId, updatedAt: serverTimestamp() }, { merge: true });
  return resultTestId;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/physicalSessions/testingSessionsApi.test.ts`
Expected: PASS (all 9 cases)

- [ ] **Step 5: Commit**

```bash
git add src/physicalSessions/testingSessionsApi.ts src/physicalSessions/testingSessionsApi.test.ts
git commit -m "$(cat <<'EOF'
Add testing session entry API (draft save, finish, list)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Uf4tfLfdRpLAvmYg9SW1Jt
EOF
)"
```

---

## Task 5: Firestore rules and index for testing sessions

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Create: `tests/rules/testingSessions.rules.test.ts`

**Interfaces:**
- None (rules-only; consumed implicitly by every write in Tasks 3-4 once deployed to the emulator/prod).

- [ ] **Step 1: Write the failing rules tests**

```ts
// tests/rules/testingSessions.rules.test.ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

async function seedTeam(env: Awaited<ReturnType<typeof getTestEnv>>) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'], activeTestingSessionId: null });
    await db.doc('teams/team-2').set({ name: 'U15', adminEmails: ['other-coach@example.com'], activeTestingSessionId: null });
    await db.doc('teams/team-1/testingSessions/session-1').set({
      date: '2026-09-16',
      status: 'open',
      createdBy: 'coach-uid',
    });
    await db.doc('teams/team-1/testingSessions/session-closed').set({
      date: '2026-09-10',
      status: 'closed',
      createdBy: 'coach-uid',
    });
  });
}

describe('testingSessions rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedTeam(env);
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets the team admin read and create sessions, and update the team pointer', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1/testingSessions/session-1').get());
    await assertSucceeds(
      db.collection('teams/team-1/testingSessions').add({ date: '2026-09-17', status: 'open', createdBy: 'coach-uid' })
    );
    await assertSucceeds(db.doc('teams/team-1').update({ activeTestingSessionId: 'session-1' }));
  });

  it('denies a non-admin from reading or creating sessions', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('stranger-uid', { email: 'stranger@example.com' }).firestore();
    await assertFails(db.doc('teams/team-1/testingSessions/session-1').get());
    await assertFails(
      db.collection('teams/team-1/testingSessions').add({ date: '2026-09-17', status: 'open', createdBy: 'stranger-uid' })
    );
  });

  it('isolates sessions across teams', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('other-coach-uid', { email: 'other-coach@example.com' }).firestore();
    await assertFails(db.doc('teams/team-1/testingSessions/session-1').get());
  });

  it('lets the team admin create and update an entry while the parent session is open', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(
      db.doc('teams/team-1/testingSessions/session-1/entries/player-1__cmj').set({
        playerId: 'player-1',
        testType: 'cmj',
        status: 'in_progress',
        data: { cmjAttempts: [30] },
        resultTestId: null,
      })
    );
    await assertSucceeds(
      db.doc('teams/team-1/testingSessions/session-1/entries/player-1__cmj').update({ status: 'complete' })
    );
  });

  it('denies writing an entry once the parent session is closed', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(
      db.doc('teams/team-1/testingSessions/session-closed/entries/player-1__cmj').set({
        playerId: 'player-1',
        testType: 'cmj',
        status: 'in_progress',
        data: {},
        resultTestId: null,
      })
    );
  });

  it('denies a non-admin from reading or writing entries', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('stranger-uid', { email: 'stranger@example.com' }).firestore();
    await assertFails(db.doc('teams/team-1/testingSessions/session-1/entries/player-1__cmj').get());
    await assertFails(
      db.doc('teams/team-1/testingSessions/session-1/entries/player-1__cmj').set({
        playerId: 'player-1',
        testType: 'cmj',
        status: 'in_progress',
        data: {},
        resultTestId: null,
      })
    );
  });
});
```

- [ ] **Step 2: Run rules tests to verify they fail**

Run: `npm run test:rules`
Expected: FAIL — no rule yet matches `teams/{teamId}/testingSessions/...`, so every `assertSucceeds` above fails (default-deny)

- [ ] **Step 3: Add the rules**

In `firestore.rules`, inside `match /teams/{teamId} { ... }`, after the closing brace of the `match /calendar/{sessionId} { ... }` block (currently ending at line 172) and before the outer closing `}` (line 173), add:

```
      match /testingSessions/{sessionId} {
        function isTeamAdmin() {
          return request.auth != null && (isSuperAdmin() || request.auth.token.email in
            get(/databases/$(database)/documents/teams/$(teamId)).data.adminEmails);
        }
        allow read: if isTeamAdmin();
        allow create, update: if isTeamAdmin();

        match /entries/{entryId} {
          function isTeamAdmin() {
            return request.auth != null && (isSuperAdmin() || request.auth.token.email in
              get(/databases/$(database)/documents/teams/$(teamId)).data.adminEmails);
          }
          allow read: if isTeamAdmin();
          allow create, update: if isTeamAdmin()
            && get(/databases/$(database)/documents/teams/$(teamId)/testingSessions/$(sessionId)).data.status == 'open';
        }
      }
```

No change is needed to the `match /teams/{teamId}` `update` rule (line 113-116) — it already allows an admin to update any field as long as `adminEmails` is unchanged, which covers `activeTestingSessionId`.

- [ ] **Step 4: Add the composite index**

In `firestore.indexes.json`, add to the `indexes` array (after the `physicalTests` entry):

```json
    {
      "collectionGroup": "testingSessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
```

- [ ] **Step 5: Run rules tests to verify they pass**

Run: `npm run test:rules`
Expected: PASS (all 6 new cases, plus all pre-existing rules tests still pass)

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firestore.indexes.json tests/rules/testingSessions.rules.test.ts
git commit -m "$(cat <<'EOF'
Add Firestore rules and index for testing sessions

testingSessions and their entries are team-admin-only, matching the
existing physicalTests posture; entries additionally require the
parent session to still be open. No change needed to the team update
rule — it already permits any field change as long as adminEmails is
unchanged, which covers the new activeTestingSessionId pointer.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Uf4tfLfdRpLAvmYg9SW1Jt
EOF
)"
```

---

## Task 6: Stopwatch component

**Files:**
- Create: `src/physicalSessions/Stopwatch.tsx`
- Create: `src/physicalSessions/Stopwatch.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface StopwatchProps {
    onRecord: (seconds: number) => void;
  }
  export function Stopwatch(props: StopwatchProps): JSX.Element;
  ```
  Consumed by Task 7 (`SessionQualityPanel`, for `sprint10m` and `shuttle5105`).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/physicalSessions/Stopwatch.test.tsx
import { act, render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Stopwatch } from './Stopwatch';

describe('Stopwatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts, runs, and records the elapsed seconds on stop', () => {
    const onRecord = vi.fn();
    render(<Stopwatch onRecord={onRecord} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord.mock.calls[0][0]).toBeCloseTo(2, 1);
  });

  it('resets to zero and is ready to start again after stopping', () => {
    const onRecord = vi.fn();
    render(<Stopwatch onRecord={onRecord} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByText('0.0s')).toBeInTheDocument();
  });

  it('requires a second tap on Reset within the confirm window before clearing a running timer', () => {
    const onRecord = vi.fn();
    render(<Stopwatch onRecord={onRecord} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => vi.advanceTimersByTime(3000));

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(onRecord).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm reset' }));
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByText('0.0s')).toBeInTheDocument();
    expect(onRecord).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/physicalSessions/Stopwatch.test.tsx`
Expected: FAIL — module does not exist yet

- [ ] **Step 3: Implement the component**

```tsx
// src/physicalSessions/Stopwatch.tsx
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';

interface StopwatchProps {
  onRecord: (seconds: number) => void;
}

export function Stopwatch({ onRecord }: StopwatchProps) {
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  function start() {
    startedAtRef.current = Date.now() - elapsedMs;
    setRunning(true);
  }

  function stop() {
    setRunning(false);
    onRecord(Math.round(elapsedMs) / 1000);
    setElapsedMs(0);
  }

  function reset() {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setRunning(false);
    setElapsedMs(0);
    setConfirmingReset(false);
  }

  return (
    <div className="flex items-center gap-3">
      <span className="tabular-nums text-lg font-semibold text-ink">{(elapsedMs / 1000).toFixed(1)}s</span>
      {!running ? (
        <Button variant="primary" size="md" onClick={start}>
          Start
        </Button>
      ) : (
        <Button variant="destructive" size="md" onClick={stop}>
          Stop
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={reset}
        onBlur={() => setConfirmingReset(false)}
      >
        {confirmingReset ? 'Confirm reset' : 'Reset'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/physicalSessions/Stopwatch.test.tsx`
Expected: PASS (all 3 cases)

- [ ] **Step 5: Commit**

```bash
git add src/physicalSessions/Stopwatch.tsx src/physicalSessions/Stopwatch.test.tsx
git commit -m "$(cat <<'EOF'
Add Stopwatch component for sprint/shuttle attempt timing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Uf4tfLfdRpLAvmYg9SW1Jt
EOF
)"
```

---

## Task 7: SessionQualityPanel (recording panel)

The core recording UI: shows one player+quality's fields, persists on blur / on each attempt add, and finishes the quality (writing the real `physicalTests` doc) once ready. Attempt-array qualities use an "add one at a time" list rather than `AttemptsInput`'s fixed-slot editor, since a live session records discrete events, not a fixed batch — each add/remove call persists immediately, so there's no keystroke-level write spam to debounce around.

**Files:**
- Create: `src/physicalSessions/SessionQualityPanel.tsx`
- Create: `src/physicalSessions/SessionQualityPanel.test.tsx`

**Interfaces:**
- Consumes: `PhysicalTestFields`, `isPhysicalTestReady`, `buildPhysicalTestInput` (Task 1); `saveEntryProgress`, `finishEntry` (Task 4); `getLatestByType` (`src/players/physicalTestsApi.ts`, existing); `Stopwatch` (Task 6); `TestingSessionEntry` (Task 2); `PHYSICAL_TEST_LABELS` (`src/types/physicalTest.ts`, existing).
- Produces:
  ```ts
  interface SessionQualityPanelProps {
    teamId: string;
    sessionId: string;
    sessionDate: string;
    playerId: string;
    testType: PhysicalTestType;
    entry: TestingSessionEntry | null;
    recordedByUid: string;
    onClose: () => void;
    onFinished: () => void;
  }
  export function SessionQualityPanel(props: SessionQualityPanelProps): JSX.Element;
  ```
  Consumed by Task 8 (`QualityTileGrid`).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/physicalSessions/SessionQualityPanel.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionQualityPanel } from './SessionQualityPanel';
import * as testingSessionsApi from './testingSessionsApi';
import * as physicalTestsApi from '../players/physicalTestsApi';

vi.mock('./testingSessionsApi');
vi.mock('../players/physicalTestsApi');

describe('SessionQualityPanel', () => {
  it('adds attempts one at a time, persisting each addition, and finishes once ready', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);
    const saveSpy = vi.spyOn(testingSessionsApi, 'saveEntryProgress').mockResolvedValue(undefined);
    const finishSpy = vi.spyOn(testingSessionsApi, 'finishEntry').mockResolvedValue('test-1');
    const onFinished = vi.fn();

    render(
      <SessionQualityPanel
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        testType="cmj"
        entry={null}
        recordedByUid="coach-uid"
        onClose={vi.fn()}
        onFinished={onFinished}
      />
    );

    expect(screen.getByRole('button', { name: 'Finish' })).toBeDisabled();

    for (const value of ['30', '34', '32']) {
      fireEvent.change(screen.getByLabelText('New attempt (cm)'), { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: '+ Add attempt' }));
    }

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(3));
    expect(saveSpy).toHaveBeenLastCalledWith(
      'team-1',
      'session-1',
      'player-1',
      'cmj',
      expect.objectContaining({ cmjAttempts: [30, 34, 32] })
    );

    expect(screen.getByRole('button', { name: 'Finish' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    await waitFor(() => expect(onFinished).toHaveBeenCalled());
    expect(finishSpy).toHaveBeenCalledWith(
      'team-1',
      'session-1',
      'player-1',
      'cmj',
      { testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34, date: '2026-09-16', notes: '' },
      'coach-uid'
    );
  });

  it('resumes from an existing draft entry', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);

    render(
      <SessionQualityPanel
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        testType="cmj"
        entry={{
          id: 'player-1__cmj',
          playerId: 'player-1',
          testType: 'cmj',
          status: 'in_progress',
          data: { cmjAttempts: [30] },
          resultTestId: null,
          updatedAt: null,
        }}
        recordedByUid="coach-uid"
        onClose={vi.fn()}
        onFinished={vi.fn()}
      />
    );

    expect(screen.getByText('30 cm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeDisabled();
  });

  it('persists a single-value field on blur, for a non-attempts quality', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);
    const saveSpy = vi.spyOn(testingSessionsApi, 'saveEntryProgress').mockResolvedValue(undefined);

    render(
      <SessionQualityPanel
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        testType="growth"
        entry={null}
        recordedByUid="coach-uid"
        onClose={vi.fn()}
        onFinished={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Height (cm)'), { target: { value: '160' } });
    fireEvent.blur(screen.getByLabelText('Height (cm)'));

    await waitFor(() =>
      expect(saveSpy).toHaveBeenCalledWith(
        'team-1',
        'session-1',
        'player-1',
        'growth',
        expect.objectContaining({ heightCm: '160' })
      )
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/physicalSessions/SessionQualityPanel.test.tsx`
Expected: FAIL — module does not exist yet

- [ ] **Step 3: Implement the component**

```tsx
// src/physicalSessions/SessionQualityPanel.tsx
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Input, Textarea, FIELD_CLASS } from '../components/Input';
import { Stopwatch } from './Stopwatch';
import { isPhysicalTestReady, buildPhysicalTestInput, type PhysicalTestFields } from '../players/physicalTestFieldLogic';
import { getLatestByType } from '../players/physicalTestsApi';
import { saveEntryProgress, finishEntry } from './testingSessionsApi';
import { PHYSICAL_TEST_LABELS } from '../types/physicalTest';
import type { PhysicalTestType } from '../types/physicalTest';
import type { TestingSessionEntry } from '../types/testingSession';

const DEFAULT_FIELDS: PhysicalTestFields = {
  heightCm: '',
  bodyMassKg: '',
  cmjAttempts: [],
  broadJumpAttempts: [],
  standingReachCm: '',
  touchAttempts: [],
  sprintAttempts: [],
  rightFirstSeconds: '',
  leftFirstSeconds: '',
  reactionAttempts: [],
  strengthMode: 'weighted',
  weightedExercise: 'trapBarDeadlift',
  weightKg: '',
  bodyweightExercise: 'pushUps',
  reps: '',
};

interface SessionQualityPanelProps {
  teamId: string;
  sessionId: string;
  sessionDate: string;
  playerId: string;
  testType: PhysicalTestType;
  entry: TestingSessionEntry | null;
  recordedByUid: string;
  onClose: () => void;
  onFinished: () => void;
}

const ATTEMPT_FIELD: Partial<Record<PhysicalTestType, { key: keyof PhysicalTestFields; label: string; unit: string }>> = {
  cmj: { key: 'cmjAttempts', label: 'New attempt (cm)', unit: 'cm' },
  broadJump: { key: 'broadJumpAttempts', label: 'New attempt (cm)', unit: 'cm' },
  approachJump: { key: 'touchAttempts', label: 'New touch attempt (cm)', unit: 'cm' },
  sprint10m: { key: 'sprintAttempts', label: 'New attempt (s)', unit: 's' },
  reaction: { key: 'reactionAttempts', label: 'New drop attempt (cm)', unit: 'cm' },
};

export function SessionQualityPanel({
  teamId,
  sessionId,
  sessionDate,
  playerId,
  testType,
  entry,
  recordedByUid,
  onClose,
  onFinished,
}: SessionQualityPanelProps) {
  const [fields, setFields] = useState<PhysicalTestFields>({ ...DEFAULT_FIELDS, ...(entry?.data ?? {}) });
  const [notes, setNotes] = useState('');
  const [newAttempt, setNewAttempt] = useState('');
  const [latestBodyMassKg, setLatestBodyMassKg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (testType !== 'strength') return;
    void getLatestByType(teamId, playerId, 'growth').then((latest) => {
      setLatestBodyMassKg(latest && latest.testType === 'growth' ? latest.bodyMassKg : null);
    });
  }, [teamId, playerId, testType]);

  function persist(next: PhysicalTestFields) {
    setFields(next);
    void saveEntryProgress(teamId, sessionId, playerId, testType, next);
  }

  const attemptConfig = ATTEMPT_FIELD[testType];

  function addAttempt() {
    if (!attemptConfig || newAttempt === '') return;
    const value = Number(newAttempt);
    if (Number.isNaN(value)) return;
    const nextArray = [...(fields[attemptConfig.key] as number[]), value];
    persist({ ...fields, [attemptConfig.key]: nextArray });
    setNewAttempt('');
  }

  function removeAttempt(index: number) {
    if (!attemptConfig) return;
    const nextArray = (fields[attemptConfig.key] as number[]).filter((_, i) => i !== index);
    persist({ ...fields, [attemptConfig.key]: nextArray });
  }

  async function handleFinish() {
    setError(null);
    const input = buildPhysicalTestInput(testType, fields, sessionDate, notes, latestBodyMassKg);
    try {
      await finishEntry(teamId, sessionId, playerId, testType, input, recordedByUid);
    } catch {
      setError('Could not save this quality. Please try again.');
      return;
    }
    onFinished();
  }

  const ready = isPhysicalTestReady(testType, fields);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop [scrollbar-gutter:stable]">
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">{PHYSICAL_TEST_LABELS[testType]}</h2>

        {testType === 'growth' && (
          <>
            <div className="mb-4">
              <label htmlFor="height" className="mb-1 block text-sm font-medium text-ink">Height (cm)</label>
              <Input
                id="height"
                type="number"
                inputMode="decimal"
                step="any"
                value={fields.heightCm}
                onChange={(e) => setFields({ ...fields, heightCm: e.target.value })}
                onBlur={() => persist(fields)}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="body-mass" className="mb-1 block text-sm font-medium text-ink">Body mass (kg)</label>
              <Input
                id="body-mass"
                type="number"
                inputMode="decimal"
                step="any"
                value={fields.bodyMassKg}
                onChange={(e) => setFields({ ...fields, bodyMassKg: e.target.value })}
                onBlur={() => persist(fields)}
              />
            </div>
          </>
        )}

        {testType === 'approachJump' && (
          <div className="mb-4">
            <label htmlFor="standing-reach" className="mb-1 block text-sm font-medium text-ink">Standing reach (cm)</label>
            <Input
              id="standing-reach"
              type="number"
              inputMode="decimal"
              step="any"
              value={fields.standingReachCm}
              onChange={(e) => setFields({ ...fields, standingReachCm: e.target.value })}
              onBlur={() => persist(fields)}
            />
          </div>
        )}

        {testType === 'shuttle5105' && (
          <>
            <div className="mb-4">
              <label htmlFor="shuttle-right" className="mb-1 block text-sm font-medium text-ink">Right-first (s)</label>
              <div className="flex items-center gap-3">
                <Input
                  id="shuttle-right"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className="w-24"
                  value={fields.rightFirstSeconds}
                  onChange={(e) => setFields({ ...fields, rightFirstSeconds: e.target.value })}
                  onBlur={() => persist(fields)}
                />
                <Stopwatch onRecord={(s) => persist({ ...fields, rightFirstSeconds: String(s) })} />
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="shuttle-left" className="mb-1 block text-sm font-medium text-ink">Left-first (s)</label>
              <div className="flex items-center gap-3">
                <Input
                  id="shuttle-left"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className="w-24"
                  value={fields.leftFirstSeconds}
                  onChange={(e) => setFields({ ...fields, leftFirstSeconds: e.target.value })}
                  onBlur={() => persist(fields)}
                />
                <Stopwatch onRecord={(s) => persist({ ...fields, leftFirstSeconds: String(s) })} />
              </div>
            </div>
          </>
        )}

        {testType === 'strength' && (
          <>
            <div className="mb-4">
              <label htmlFor="strength-mode" className="mb-1 block text-sm font-medium text-ink">Mode</label>
              <select
                id="strength-mode"
                className={`${FIELD_CLASS} w-full`}
                value={fields.strengthMode}
                onChange={(e) => persist({ ...fields, strengthMode: e.target.value as 'weighted' | 'bodyweight' })}
              >
                <option value="weighted">Weighted</option>
                <option value="bodyweight">Bodyweight</option>
              </select>
            </div>
            {fields.strengthMode === 'weighted' ? (
              <div className="mb-4">
                <label htmlFor="strength-weight" className="mb-1 block text-sm font-medium text-ink">Weight (kg)</label>
                <Input
                  id="strength-weight"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={fields.weightKg}
                  onChange={(e) => setFields({ ...fields, weightKg: e.target.value })}
                  onBlur={() => persist(fields)}
                />
              </div>
            ) : (
              <div className="mb-4">
                <label htmlFor="strength-reps" className="mb-1 block text-sm font-medium text-ink">Reps</label>
                <Input
                  id="strength-reps"
                  type="number"
                  inputMode="numeric"
                  value={fields.reps}
                  onChange={(e) => setFields({ ...fields, reps: e.target.value })}
                  onBlur={() => persist(fields)}
                />
              </div>
            )}
          </>
        )}

        {attemptConfig && (
          <div className="mb-4">
            <ul className="mb-3 flex flex-wrap gap-2">
              {(fields[attemptConfig.key] as number[]).map((value, index) => (
                <li key={index} className="flex items-center gap-1 rounded-full bg-blue/10 py-1 pl-3 pr-1 text-sm text-ink">
                  {value} {attemptConfig.unit}
                  <button
                    type="button"
                    aria-label={`Remove attempt ${index + 1}`}
                    onClick={() => removeAttempt(index)}
                    className="rounded-full p-1 text-red hover:bg-red/10"
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3">
              <label htmlFor="new-attempt" className="sr-only">{attemptConfig.label}</label>
              <Input
                id="new-attempt"
                aria-label={attemptConfig.label}
                type="number"
                inputMode="decimal"
                step="any"
                className="w-28"
                value={newAttempt}
                onChange={(e) => setNewAttempt(e.target.value)}
              />
              <Button variant="secondary" size="md" onClick={addAttempt}>
                + Add attempt
              </Button>
              {(testType === 'sprint10m') && (
                <Stopwatch onRecord={(s) => { setNewAttempt(String(s)); }} />
              )}
            </div>
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-ink">Notes</label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => persist(fields)} />
        </div>

        <div className="flex justify-between gap-3">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => void handleFinish()} disabled={!ready}>
            Finish
          </Button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/physicalSessions/SessionQualityPanel.test.tsx`
Expected: PASS (all 3 cases)

- [ ] **Step 5: Commit**

```bash
git add src/physicalSessions/SessionQualityPanel.tsx src/physicalSessions/SessionQualityPanel.test.tsx
git commit -m "$(cat <<'EOF'
Add SessionQualityPanel: per-quality recording UI with crash-safe drafts

Attempts persist one at a time as they're recorded; single-value
fields persist on blur. Sprint/shuttle get an inline Stopwatch. Finish
is disabled until the quality's required attempts/fields are in.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Uf4tfLfdRpLAvmYg9SW1Jt
EOF
)"
```

---

## Task 8: QualityTileGrid

**Files:**
- Create: `src/physicalSessions/QualityTileGrid.tsx`
- Create: `src/physicalSessions/QualityTileGrid.test.tsx`

**Interfaces:**
- Consumes: `SessionQualityPanel` (Task 7); `PHYSICAL_TEST_ORDER`, `PHYSICAL_TEST_LABELS` (existing); `TestingSessionEntry`, `buildEntryId` (Task 2).
- Produces:
  ```ts
  interface QualityTileGridProps {
    teamId: string;
    sessionId: string;
    sessionDate: string;
    playerId: string;
    entriesByPlayerAndType: Map<string, TestingSessionEntry>;
    recordedByUid: string;
    onEntryChanged: () => void;
  }
  export function QualityTileGrid(props: QualityTileGridProps): JSX.Element;
  ```
  Consumed by Task 9 (`LiveSessionView`).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/physicalSessions/QualityTileGrid.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QualityTileGrid } from './QualityTileGrid';
import type { TestingSessionEntry } from '../types/testingSession';

vi.mock('./SessionQualityPanel', () => ({
  SessionQualityPanel: ({ testType, onClose }: { testType: string; onClose: () => void }) => (
    <div>
      <span>Panel for {testType}</span>
      <button onClick={onClose}>Close panel</button>
    </div>
  ),
}));

function buildEntry(overrides: Partial<TestingSessionEntry>): TestingSessionEntry {
  return {
    id: 'player-1__cmj',
    playerId: 'player-1',
    testType: 'cmj',
    status: 'in_progress',
    data: {},
    resultTestId: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('QualityTileGrid', () => {
  it('shows Not started, In progress, and Done tiles based on entries', () => {
    const entries = new Map<string, TestingSessionEntry>([
      ['player-1__cmj', buildEntry({ status: 'in_progress' })],
      ['player-1__sprint10m', buildEntry({ id: 'player-1__sprint10m', testType: 'sprint10m', status: 'complete' })],
    ]);

    render(
      <QualityTileGrid
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        entriesByPlayerAndType={entries}
        recordedByUid="coach-uid"
        onEntryChanged={vi.fn()}
      />
    );

    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getAllByText('Not started').length).toBe(6);
  });

  it('opens the recording panel for the tapped quality', () => {
    render(
      <QualityTileGrid
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        entriesByPlayerAndType={new Map()}
        recordedByUid="coach-uid"
        onEntryChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /10m Sprint/ }));

    expect(screen.getByText('Panel for sprint10m')).toBeInTheDocument();
  });

  it('does not reopen a quality that is already Done, to avoid recording a duplicate result', () => {
    const entries = new Map([['player-1__sprint10m', buildEntry({ id: 'player-1__sprint10m', testType: 'sprint10m', status: 'complete' })]]);

    render(
      <QualityTileGrid
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        entriesByPlayerAndType={entries}
        recordedByUid="coach-uid"
        onEntryChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /10m Sprint/ }));

    expect(screen.queryByText('Panel for sprint10m')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/physicalSessions/QualityTileGrid.test.tsx`
Expected: FAIL — module does not exist yet

- [ ] **Step 3: Implement the component**

```tsx
// src/physicalSessions/QualityTileGrid.tsx
import { useState } from 'react';
import { PHYSICAL_TEST_LABELS, PHYSICAL_TEST_ORDER } from '../types/physicalTest';
import type { PhysicalTestType } from '../types/physicalTest';
import { buildEntryId, type TestingSessionEntry } from '../types/testingSession';
import { SessionQualityPanel } from './SessionQualityPanel';

interface QualityTileGridProps {
  teamId: string;
  sessionId: string;
  sessionDate: string;
  playerId: string;
  entriesByPlayerAndType: Map<string, TestingSessionEntry>;
  recordedByUid: string;
  onEntryChanged: () => void;
}

function statusLabel(entry: TestingSessionEntry | undefined): string {
  if (!entry) return 'Not started';
  return entry.status === 'complete' ? 'Done' : 'In progress';
}

export function QualityTileGrid({
  teamId,
  sessionId,
  sessionDate,
  playerId,
  entriesByPlayerAndType,
  recordedByUid,
  onEntryChanged,
}: QualityTileGridProps) {
  const [openType, setOpenType] = useState<PhysicalTestType | null>(null);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PHYSICAL_TEST_ORDER.map((testType) => {
          const entry = entriesByPlayerAndType.get(buildEntryId(playerId, testType));
          const status = statusLabel(entry);
          const done = status === 'Done';
          return (
            <button
              key={testType}
              type="button"
              disabled={done}
              onClick={() => {
                if (done) return;
                setOpenType(testType);
              }}
              className={`flex min-h-11 flex-col items-start rounded-md border border-border bg-surface p-3 text-left ${
                done ? 'cursor-default opacity-70' : 'hover:bg-blue/5'
              }`}
            >
              <span className="text-sm font-medium text-ink">{PHYSICAL_TEST_LABELS[testType]}</span>
              <span
                className={`text-xs ${done ? 'text-green' : status === 'In progress' ? 'text-orange' : 'text-slate'}`}
              >
                {status}
              </span>
            </button>
          );
        })}
      </div>

      {openType && (
        <SessionQualityPanel
          teamId={teamId}
          sessionId={sessionId}
          sessionDate={sessionDate}
          playerId={playerId}
          testType={openType}
          entry={entriesByPlayerAndType.get(buildEntryId(playerId, openType)) ?? null}
          recordedByUid={recordedByUid}
          onClose={() => setOpenType(null)}
          onFinished={() => {
            setOpenType(null);
            onEntryChanged();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/physicalSessions/QualityTileGrid.test.tsx`
Expected: PASS (both cases)

- [ ] **Step 5: Commit**

```bash
git add src/physicalSessions/QualityTileGrid.tsx src/physicalSessions/QualityTileGrid.test.tsx
git commit -m "$(cat <<'EOF'
Add QualityTileGrid: 8-quality status grid for the selected player

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Uf4tfLfdRpLAvmYg9SW1Jt
EOF
)"
```

---

## Task 9: PlayerRosterPicker

**Files:**
- Create: `src/physicalSessions/PlayerRosterPicker.tsx`
- Create: `src/physicalSessions/PlayerRosterPicker.test.tsx`

**Interfaces:**
- Consumes: `Player` (`src/types/player.ts`, existing); `TestingSessionEntry`, `buildEntryId` (Task 2); `PHYSICAL_TEST_ORDER` (existing).
- Produces:
  ```ts
  interface PlayerRosterPickerProps {
    players: Player[];
    entries: TestingSessionEntry[];
    selectedPlayerId: string | null;
    onSelect: (playerId: string) => void;
  }
  export function PlayerRosterPicker(props: PlayerRosterPickerProps): JSX.Element;
  ```
  Consumed by Task 10 (`LiveSessionView`).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/physicalSessions/PlayerRosterPicker.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayerRosterPicker } from './PlayerRosterPicker';
import type { Player } from '../types/player';
import type { TestingSessionEntry } from '../types/testingSession';

function buildPlayer(overrides: Partial<Player>): Player {
  return { id: 'player-1', number: 7, fullName: 'Jane Doe', ...overrides } as Player;
}

function buildEntry(overrides: Partial<TestingSessionEntry>): TestingSessionEntry {
  return {
    id: 'player-1__cmj',
    playerId: 'player-1',
    testType: 'cmj',
    status: 'complete',
    data: {},
    resultTestId: 'test-1',
    updatedAt: null,
    ...overrides,
  };
}

describe('PlayerRosterPicker', () => {
  it('shows every player with a completed-quality-count chip', () => {
    const players = [buildPlayer({ id: 'player-1', fullName: 'Jane Doe' }), buildPlayer({ id: 'player-2', fullName: 'Amy Lee', number: 9 })];
    const entries = [buildEntry({ status: 'complete' }), buildEntry({ id: 'player-1__sprint10m', testType: 'sprint10m', status: 'in_progress' })];

    render(<PlayerRosterPicker players={players} entries={entries} selectedPlayerId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('1/8')).toBeInTheDocument();
    expect(screen.getByText('0/8')).toBeInTheDocument();
  });

  it('filters by search text', () => {
    const players = [buildPlayer({ id: 'player-1', fullName: 'Jane Doe' }), buildPlayer({ id: 'player-2', fullName: 'Amy Lee', number: 9 })];

    render(<PlayerRosterPicker players={players} entries={[]} selectedPlayerId={null} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search players'), { target: { value: 'amy' } });

    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Amy Lee')).toBeInTheDocument();
  });

  it('calls onSelect when a player row is tapped', () => {
    const onSelect = vi.fn();
    const players = [buildPlayer({ id: 'player-1', fullName: 'Jane Doe' })];

    render(<PlayerRosterPicker players={players} entries={[]} selectedPlayerId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Jane Doe'));

    expect(onSelect).toHaveBeenCalledWith('player-1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/physicalSessions/PlayerRosterPicker.test.tsx`
Expected: FAIL — module does not exist yet

- [ ] **Step 3: Implement the component**

```tsx
// src/physicalSessions/PlayerRosterPicker.tsx
import { useState } from 'react';
import { Input } from '../components/Input';
import { PHYSICAL_TEST_ORDER } from '../types/physicalTest';
import type { Player } from '../types/player';
import type { TestingSessionEntry } from '../types/testingSession';

interface PlayerRosterPickerProps {
  players: Player[];
  entries: TestingSessionEntry[];
  selectedPlayerId: string | null;
  onSelect: (playerId: string) => void;
}

export function PlayerRosterPicker({ players, entries, selectedPlayerId, onSelect }: PlayerRosterPickerProps) {
  const [search, setSearch] = useState('');

  const completedCountByPlayer = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status === 'complete') {
      completedCountByPlayer.set(entry.playerId, (completedCountByPlayer.get(entry.playerId) ?? 0) + 1);
    }
  }

  const filtered = players.filter((p) => p.fullName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full sm:w-64 sm:shrink-0">
      <label htmlFor="roster-search" className="sr-only">Search players</label>
      <Input
        id="roster-search"
        aria-label="Search players"
        placeholder="Search players..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 w-full"
      />
      <ul className="divide-y divide-border">
        {filtered.map((player) => {
          const count = completedCountByPlayer.get(player.id) ?? 0;
          return (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => onSelect(player.id)}
                className={`flex min-h-11 w-full items-center justify-between gap-2 px-2 py-2 text-left ${
                  selectedPlayerId === player.id ? 'bg-blue/10' : 'hover:bg-blue/5'
                }`}
              >
                <span className="truncate text-sm text-ink">
                  #{player.number} {player.fullName}
                </span>
                <span className="shrink-0 tabular-nums text-xs text-slate">
                  {count}/{PHYSICAL_TEST_ORDER.length}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/physicalSessions/PlayerRosterPicker.test.tsx`
Expected: PASS (all 3 cases)

- [ ] **Step 5: Commit**

```bash
git add src/physicalSessions/PlayerRosterPicker.tsx src/physicalSessions/PlayerRosterPicker.test.tsx
git commit -m "$(cat <<'EOF'
Add PlayerRosterPicker: searchable roster list with progress chips

Stacks full-width above the quality grid on mobile, sits as a fixed
sidebar on larger screens (sm:w-64 sm:shrink-0).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Uf4tfLfdRpLAvmYg9SW1Jt
EOF
)"
```

---

## Task 10: LiveSessionView

**Files:**
- Create: `src/physicalSessions/LiveSessionView.tsx`
- Create: `src/physicalSessions/LiveSessionView.test.tsx`

**Interfaces:**
- Consumes: `PlayerRosterPicker` (Task 9), `QualityTileGrid` (Task 8), `getEntries` (Task 4), `closeSession` (Task 3), `buildEntryId` (Task 2), `ConfirmDialog` (existing, `src/components/ConfirmDialog.tsx`).
- Produces:
  ```ts
  interface LiveSessionViewProps {
    teamId: string;
    session: TestingSession;
    players: Player[];
    recordedByUid: string;
    onSessionClosed: () => void;
  }
  export function LiveSessionView(props: LiveSessionViewProps): JSX.Element;
  ```
  Consumed by Task 12 (`TeamPhysicalSessionTab`).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/physicalSessions/LiveSessionView.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LiveSessionView } from './LiveSessionView';
import * as testingSessionsApi from './testingSessionsApi';
import type { Player } from '../types/player';
import type { TestingSession } from '../types/testingSession';

vi.mock('./testingSessionsApi');
vi.mock('./QualityTileGrid', () => ({
  QualityTileGrid: ({ playerId }: { playerId: string }) => <div>Qualities for {playerId}</div>,
}));

const SESSION: TestingSession = { id: 'session-1', date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: null, closedAt: null };
const PLAYERS: Player[] = [{ id: 'player-1', number: 7, fullName: 'Jane Doe' } as Player];

describe('LiveSessionView', () => {
  it('loads entries on mount and shows the quality grid once a player is selected', async () => {
    vi.spyOn(testingSessionsApi, 'getEntries').mockResolvedValue([]);

    render(<LiveSessionView teamId="team-1" session={SESSION} players={PLAYERS} recordedByUid="coach-uid" onSessionClosed={vi.fn()} />);

    await waitFor(() => expect(testingSessionsApi.getEntries).toHaveBeenCalledWith('team-1', 'session-1'));
    fireEvent.click(screen.getByText('Jane Doe'));

    expect(screen.getByText('Qualities for player-1')).toBeInTheDocument();
  });

  it('closes the session after confirmation', async () => {
    vi.spyOn(testingSessionsApi, 'getEntries').mockResolvedValue([]);
    const closeSpy = vi.spyOn(testingSessionsApi, 'closeSession').mockResolvedValue(undefined);
    const onSessionClosed = vi.fn();

    render(<LiveSessionView teamId="team-1" session={SESSION} players={PLAYERS} recordedByUid="coach-uid" onSessionClosed={onSessionClosed} />);
    await waitFor(() => expect(testingSessionsApi.getEntries).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Close session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, close' }));

    await waitFor(() => expect(closeSpy).toHaveBeenCalledWith('team-1', 'session-1'));
    expect(onSessionClosed).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/physicalSessions/LiveSessionView.test.tsx`
Expected: FAIL — module does not exist yet

- [ ] **Step 3: Implement the component**

```tsx
// src/physicalSessions/LiveSessionView.tsx
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PlayerRosterPicker } from './PlayerRosterPicker';
import { QualityTileGrid } from './QualityTileGrid';
import { getEntries, closeSession } from './testingSessionsApi';
import { buildEntryId } from '../types/testingSession';
import type { TestingSession, TestingSessionEntry } from '../types/testingSession';
import type { Player } from '../types/player';

interface LiveSessionViewProps {
  teamId: string;
  session: TestingSession;
  players: Player[];
  recordedByUid: string;
  onSessionClosed: () => void;
}

export function LiveSessionView({ teamId, session, players, recordedByUid, onSessionClosed }: LiveSessionViewProps) {
  const [entries, setEntries] = useState<TestingSessionEntry[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEntries(await getEntries(teamId, session.id));
  }, [teamId, session.id]);

  useEffect(() => {
    setLoadError(null);
    load().catch(() => setLoadError('Could not load session progress. Please refresh the page.'));
  }, [load]);

  const entriesByPlayerAndType = new Map<string, TestingSessionEntry>();
  for (const entry of entries) {
    entriesByPlayerAndType.set(buildEntryId(entry.playerId, entry.testType), entry);
  }

  async function confirmClose() {
    try {
      await closeSession(teamId, session.id);
    } catch {
      setCloseError('Could not close the session. Please try again.');
      return;
    }
    setConfirmingClose(false);
    onSessionClosed();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate">Session started {session.date}</p>
        <Button variant="dangerGhost" size="sm" onClick={() => { setCloseError(null); setConfirmingClose(true); }}>
          Close session
        </Button>
      </div>

      {loadError && <p role="alert" className="mb-3 text-sm text-red">{loadError}</p>}

      <div className="flex flex-col gap-4 sm:flex-row">
        <PlayerRosterPicker players={players} entries={entries} selectedPlayerId={selectedPlayerId} onSelect={setSelectedPlayerId} />
        {selectedPlayerId ? (
          <div className="flex-1">
            <QualityTileGrid
              teamId={teamId}
              sessionId={session.id}
              sessionDate={session.date}
              playerId={selectedPlayerId}
              entriesByPlayerAndType={entriesByPlayerAndType}
              recordedByUid={recordedByUid}
              onEntryChanged={() => void load()}
            />
          </div>
        ) : (
          <p className="flex-1 text-sm text-slate">Select a player to start recording.</p>
        )}
      </div>

      {confirmingClose && (
        <ConfirmDialog
          title="Close this session?"
          message="Entries already finished stay on each player's card. This can't be reopened."
          confirmLabel="Yes, close"
          onConfirm={() => void confirmClose()}
          onCancel={() => setConfirmingClose(false)}
          error={closeError}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/physicalSessions/LiveSessionView.test.tsx`
Expected: PASS (both cases)

- [ ] **Step 5: Commit**

```bash
git add src/physicalSessions/LiveSessionView.tsx src/physicalSessions/LiveSessionView.test.tsx
git commit -m "$(cat <<'EOF'
Add LiveSessionView: roster + quality grid + close-session flow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Uf4tfLfdRpLAvmYg9SW1Jt
EOF
)"
```

---

## Task 11: StartSessionCard (no-open-session state + past sessions)

**Files:**
- Create: `src/physicalSessions/StartSessionCard.tsx`
- Create: `src/physicalSessions/StartSessionCard.test.tsx`

**Interfaces:**
- Consumes: `startSession`, `listPastSessions` (Task 3).
- Produces:
  ```ts
  interface StartSessionCardProps {
    teamId: string;
    creatorUid: string;
    onStarted: (sessionId: string) => void;
  }
  export function StartSessionCard(props: StartSessionCardProps): JSX.Element;
  ```
  Consumed by Task 12 (`TeamPhysicalSessionTab`).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/physicalSessions/StartSessionCard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StartSessionCard } from './StartSessionCard';
import * as testingSessionsApi from './testingSessionsApi';

vi.mock('./testingSessionsApi');

describe('StartSessionCard', () => {
  it('lists past closed sessions on mount', async () => {
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([
      { id: 'session-old', date: '2026-09-10', status: 'closed', createdBy: 'coach-uid', createdAt: null, closedAt: null },
    ]);

    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('2026-09-10')).toBeInTheDocument());
  });

  it('starts a new session with the chosen date and notifies the parent', async () => {
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([]);
    const startSpy = vi.spyOn(testingSessionsApi, 'startSession').mockResolvedValue('session-new');
    const onStarted = vi.fn();

    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={onStarted} />);
    await waitFor(() => expect(testingSessionsApi.listPastSessions).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start new session' }));

    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('team-1', '2026-09-16', 'coach-uid'));
    expect(onStarted).toHaveBeenCalledWith('session-new');
  });

  it('shows an error and does not call onStarted when starting fails', async () => {
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([]);
    vi.spyOn(testingSessionsApi, 'startSession').mockRejectedValue(new Error('A testing session is already open for this team.'));
    const onStarted = vi.fn();

    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={onStarted} />);
    await waitFor(() => expect(testingSessionsApi.listPastSessions).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start new session' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('A testing session is already open for this team.'));
    expect(onStarted).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/physicalSessions/StartSessionCard.test.tsx`
Expected: FAIL — module does not exist yet

- [ ] **Step 3: Implement the component**

```tsx
// src/physicalSessions/StartSessionCard.tsx
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { startSession, listPastSessions } from './testingSessionsApi';
import type { TestingSession } from '../types/testingSession';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface StartSessionCardProps {
  teamId: string;
  creatorUid: string;
  onStarted: (sessionId: string) => void;
}

export function StartSessionCard({ teamId, creatorUid, onStarted }: StartSessionCardProps) {
  const [date, setDate] = useState(todayIso());
  const [pastSessions, setPastSessions] = useState<TestingSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    listPastSessions(teamId)
      .then(setPastSessions)
      .catch(() => setLoadError('Could not load past sessions.'));
  }, [teamId]);

  async function handleStart() {
    setError(null);
    try {
      const id = await startSession(teamId, date, creatorUid);
      onStarted(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the session. Please try again.');
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <label htmlFor="session-date" className="mb-1 block text-sm font-medium text-ink">Date</label>
        <Input id="session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mb-3 w-full sm:w-48" />
        <Button variant="primary" onClick={() => void handleStart()}>Start new session</Button>
        {error && <p role="alert" className="mt-3 text-sm text-red">{error}</p>}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-ink">Past sessions</h3>
      {loadError && <p role="alert" className="text-sm text-red">{loadError}</p>}
      {!loadError && pastSessions.length === 0 && <p className="text-sm text-slate">No sessions yet.</p>}
      <ul className="divide-y divide-border">
        {pastSessions.map((s) => (
          <li key={s.id} className="py-2 text-sm text-ink">{s.date}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/physicalSessions/StartSessionCard.test.tsx`
Expected: PASS (all 3 cases)

- [ ] **Step 5: Commit**

```bash
git add src/physicalSessions/StartSessionCard.tsx src/physicalSessions/StartSessionCard.test.tsx
git commit -m "$(cat <<'EOF'
Add StartSessionCard: start-new-session form + past sessions list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Uf4tfLfdRpLAvmYg9SW1Jt
EOF
)"
```

---

## Task 12: TeamPhysicalSessionTab and wiring into TeamPage

**Files:**
- Create: `src/physicalSessions/TeamPhysicalSessionTab.tsx`
- Create: `src/physicalSessions/TeamPhysicalSessionTab.test.tsx`
- Modify: `src/teams/TeamPage.tsx`

**Interfaces:**
- Consumes: `StartSessionCard` (Task 11), `LiveSessionView` (Task 10), `getSession` (Task 3); `Team.activeTestingSessionId` (Task 2); `useAuth` (existing, `src/auth/AuthContext.tsx`).
- Produces:
  ```ts
  interface TeamPhysicalSessionTabProps {
    teamId: string;
    team: Team;
    players: Player[];
    onTeamChanged: (team: Team) => void;
  }
  export function TeamPhysicalSessionTab(props: TeamPhysicalSessionTabProps): JSX.Element;
  ```
  Consumed directly by `TeamPage`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/physicalSessions/TeamPhysicalSessionTab.test.tsx
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamPhysicalSessionTab } from './TeamPhysicalSessionTab';
import * as testingSessionsApi from './testingSessionsApi';
import type { Team } from '../types/team';

vi.mock('./testingSessionsApi');
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: { uid: 'coach-uid' } }) }));
vi.mock('./StartSessionCard', () => ({
  StartSessionCard: ({ onStarted }: { onStarted: (id: string) => void }) => (
    <button onClick={() => onStarted('session-new')}>Start new session</button>
  ),
}));
vi.mock('./LiveSessionView', () => ({
  LiveSessionView: ({ session, onSessionClosed }: { session: { id: string }; onSessionClosed: () => void }) => (
    <div>
      <span>Live: {session.id}</span>
      <button onClick={onSessionClosed}>Close session</button>
    </div>
  ),
}));

function buildTeam(overrides: Partial<Team>): Team {
  return { id: 'team-1', activeTestingSessionId: null, name: 'U17', ...overrides } as Team;
}

// TeamPhysicalSessionTab renders off the `team` PROP, exactly like TeamPage
// will use it (team lives in the parent's state; onTeamChanged asks the
// parent to update and re-render with the new team). This harness mirrors
// that parent so the start/close transitions are tested the way they'll
// really happen, not by asserting on a prop the component doesn't own.
function Harness({ initialTeam, onTeamChanged }: { initialTeam: Team; onTeamChanged: (t: Team) => void }) {
  const [team, setTeam] = useState(initialTeam);
  return (
    <TeamPhysicalSessionTab
      teamId="team-1"
      team={team}
      players={[]}
      onTeamChanged={(t) => {
        setTeam(t);
        onTeamChanged(t);
      }}
    />
  );
}

describe('TeamPhysicalSessionTab', () => {
  it('shows the start card when there is no active session', () => {
    render(<TeamPhysicalSessionTab teamId="team-1" team={buildTeam({})} players={[]} onTeamChanged={vi.fn()} />);
    expect(screen.getByText('Start new session')).toBeInTheDocument();
  });

  it('loads and shows the live view when the team has an active session', async () => {
    vi.spyOn(testingSessionsApi, 'getSession').mockResolvedValue({
      id: 'session-1', date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: null, closedAt: null,
    });

    render(<TeamPhysicalSessionTab teamId="team-1" team={buildTeam({ activeTestingSessionId: 'session-1' })} players={[]} onTeamChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Live: session-1')).toBeInTheDocument());
  });

  it('switches to the live view after starting a session, and updates the parent team', async () => {
    vi.spyOn(testingSessionsApi, 'getSession').mockResolvedValue({
      id: 'session-new', date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: null, closedAt: null,
    });
    const onTeamChanged = vi.fn();

    render(<Harness initialTeam={buildTeam({})} onTeamChanged={onTeamChanged} />);
    screen.getByText('Start new session').click();

    await waitFor(() => expect(screen.getByText('Live: session-new')).toBeInTheDocument());
    expect(onTeamChanged).toHaveBeenCalledWith(expect.objectContaining({ activeTestingSessionId: 'session-new' }));
  });

  it('switches back to the start card after closing the session', async () => {
    vi.spyOn(testingSessionsApi, 'getSession').mockResolvedValue({
      id: 'session-1', date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: null, closedAt: null,
    });
    const onTeamChanged = vi.fn();

    render(<Harness initialTeam={buildTeam({ activeTestingSessionId: 'session-1' })} onTeamChanged={onTeamChanged} />);
    await waitFor(() => screen.getByText('Close session').click());

    await waitFor(() => expect(screen.getByText('Start new session')).toBeInTheDocument());
    expect(onTeamChanged).toHaveBeenCalledWith(expect.objectContaining({ activeTestingSessionId: null }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/physicalSessions/TeamPhysicalSessionTab.test.tsx`
Expected: FAIL — module does not exist yet

- [ ] **Step 3: Implement the component**

```tsx
// src/physicalSessions/TeamPhysicalSessionTab.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getSession } from './testingSessionsApi';
import { StartSessionCard } from './StartSessionCard';
import { LiveSessionView } from './LiveSessionView';
import type { Team } from '../types/team';
import type { Player } from '../types/player';
import type { TestingSession } from '../types/testingSession';

interface TeamPhysicalSessionTabProps {
  teamId: string;
  team: Team;
  players: Player[];
  onTeamChanged: (team: Team) => void;
}

export function TeamPhysicalSessionTab({ teamId, team, players, onTeamChanged }: TeamPhysicalSessionTabProps) {
  const { firebaseUser } = useAuth();
  const [session, setSession] = useState<TestingSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!team.activeTestingSessionId) {
      setSession(null);
      return;
    }
    setError(null);
    getSession(teamId, team.activeTestingSessionId)
      .then(setSession)
      .catch(() => setError('Could not load the active session. Please refresh the page.'));
  }, [teamId, team.activeTestingSessionId]);

  if (!firebaseUser) return null;

  if (error) {
    return <p role="alert" className="text-sm text-red">{error}</p>;
  }

  if (team.activeTestingSessionId && session) {
    return (
      <LiveSessionView
        teamId={teamId}
        session={session}
        players={players}
        recordedByUid={firebaseUser.uid}
        onSessionClosed={() => {
          setSession(null);
          onTeamChanged({ ...team, activeTestingSessionId: null });
        }}
      />
    );
  }

  if (team.activeTestingSessionId) {
    return <p className="text-sm text-slate">Loading session...</p>;
  }

  return (
    <StartSessionCard
      teamId={teamId}
      creatorUid={firebaseUser.uid}
      onStarted={(sessionId) => onTeamChanged({ ...team, activeTestingSessionId: sessionId })}
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/physicalSessions/TeamPhysicalSessionTab.test.tsx`
Expected: PASS (all 4 cases)

- [ ] **Step 5: Wire the tab into `TeamPage.tsx`**

```tsx
// src/teams/TeamPage.tsx
// 1. Add the import:
import { TeamPhysicalSessionTab } from '../physicalSessions/TeamPhysicalSessionTab';

// 2. Extend the tab union:
type TeamTab = 'overview' | 'calendar' | 'plan' | 'settings' | 'physicalSession';

// 3. Add a nav item, after the Settings Tab (inside the <nav> block):
          <Tab active={activeTab === 'physicalSession'} onClick={() => setTab('physicalSession')}>
            Physical Session
          </Tab>

// 4. Add the tab body, alongside the other activeTab branches:
          {activeTab === 'physicalSession' && (
            <TeamPhysicalSessionTab
              teamId={teamId}
              team={team}
              players={rosterPlayers}
              onTeamChanged={setTeam}
            />
          )}
```

No new access check is needed: `getTeam` (line 37) already fails for anyone who isn't a team admin or superadmin (the `teams/{teamId}` read rule), so every tab on this page — including this new one — is implicitly admin-only, the same way `plan` and `settings` are today.

- [ ] **Step 6: Manually verify in the emulator**

Run: `npm run dev:emulator`, sign in as a seeded team admin, open a team, click the new "Physical Session" tab, start a session, record a couple of sprint attempts with the stopwatch, finish a quality, switch players, close the session, and confirm the finished quality shows up on that player's card under Physical Testing.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS (no regressions anywhere)

Run: `npm run lint`
Expected: no errors

Run: `npm run build`
Expected: succeeds (typecheck + build)

- [ ] **Step 8: Commit**

```bash
git add src/physicalSessions/TeamPhysicalSessionTab.tsx src/physicalSessions/TeamPhysicalSessionTab.test.tsx src/teams/TeamPage.tsx
git commit -m "$(cat <<'EOF'
Wire Physical Session tab into the team page

Completes the physical testing session feature: a coach can now start
a session, record attempts for any player/quality in any order with
crash-safe drafts and stopwatches for the timed qualities, and close
the session when done.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Uf4tfLfdRpLAvmYg9SW1Jt
EOF
)"
```
