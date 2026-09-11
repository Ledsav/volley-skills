# Section-scoped Access Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the all-or-nothing global `admin` role with two tiers — super-admin (everything + grants) and member (only what they are granted) — where grants are per-team plus per-section (exercises / trainings / guides), managed from one super-admin-only Access page.

**Architecture:** All enforcement stays in `firestore.rules` (no Cloud Functions). Team access still lives in `teams/{id}.adminEmails` (only a super-admin may now edit it); three new global docs `sectionAccess/{exercises,trainings,guides}` hold section grant lists. Super-admin identity = email in the existing server-only `adminAllowlist`. The client resolves an `access` object once on sign-in and uses it to gate nav, routes, and the Calendar tab.

**Tech Stack:** React 18 + TypeScript + Vite, React Router v7, Firebase Auth (email-link) + Firestore, Tailwind, Vitest (`npm test`) + `@firebase/rules-unit-testing` (`npm run test:rules`, needs JDK 21+).

**Spec:** `docs/superpowers/specs/2026-09-11-volley-skills-access-model.md`

## Global Constraints

- TypeScript `strict`, plus `noUnusedLocals` / `noUnusedParameters` — unused symbols fail `npm run build`.
- Tests sit next to the code (`foo.ts` / `foo.test.ts`). Rules tests live in `tests/rules/*.rules.test.ts`, run only by `npm run test:rules`, forced serial.
- Data-access lives in `<feature>/<feature>Api.ts`; components never import `firebase/firestore` directly. Writes use `serverTimestamp()`.
- Firestore dates are ISO `"YYYY-MM-DD"` strings. Emails are stored lowercased (`email.trim().toLowerCase()`).
- Section keys are exactly `'exercises' | 'trainings' | 'guides'`. The `sectionAccess` doc shape is exactly `{ adminEmails: string[] }`.
- `UserRole` becomes `'superadmin' | 'member'` (was `'admin' | 'viewer'`).
- No third-party analytics. Never commit `serviceAccountKey.json`, `.env.local`, `reference/`.
- Every `firestore.rules` change must be covered by a `tests/rules/` test.
- Run `npm run lint` and `npm run build` before every commit that touches `src/`.

---

## File structure

**Created**

| File | Responsibility |
|---|---|
| `src/auth/access.ts` | `Access` type + `resolveAccess(appUser)` — reads `sectionAccess/*` to build the client access object |
| `src/auth/access.test.ts` | unit tests for `resolveAccess` |
| `src/auth/RequireSuperAdmin.tsx` | route guard: super-admin only |
| `src/auth/RequireSection.tsx` | route guard: `section` grant required |
| `src/auth/guards.test.tsx` | tests for both new guards |
| `src/test/authValue.ts` | `authValue(partial)` test factory for `useAuth()` mocks |
| `src/access/accessApi.ts` | grant data-access: `listAllTeams`, `listGrantHolders`, `saveGrants`, `removeAllGrants` |
| `src/access/accessApi.test.ts` | unit tests for `accessApi` |
| `src/access/AccessManagerPage.tsx` | the `/admin/access` page |
| `src/access/AccessManagerPage.test.tsx` | component tests |
| `tests/rules/sectionAccess.rules.test.ts` | rules tests for `sectionAccess/*` + section-gated libraries |
| `scripts/migrate/2026-09-11-section-access.mjs` | one-time prod migration |

**Modified**

| File | Change |
|---|---|
| `firestore.rules` | delete `isAdmin()`; add `isSuperAdmin()`/`inSection()`/`can*()`; rewire `sectionAccess`, `exercises`, `diagrams`, `trainings`, `counters`, guides, `users`, `teams`, `calendar` |
| `src/types/auth.ts` | `UserRole = 'superadmin' \| 'member'` |
| `src/auth/usersApi.ts` | `ensureUserDoc` writes `superadmin`/`member`, tolerates legacy `admin`/`viewer` on read |
| `src/auth/usersApi.test.ts` | update expectations |
| `src/auth/AuthContext.tsx` | resolve + expose `access: Access \| null` |
| `src/auth/AuthContext.test.tsx` | update |
| `src/auth/RequireAdmin.tsx`, `src/auth/RequireAdmin.test.tsx` | **delete** |
| `src/App.tsx` | swap guards; add `/admin/access` route |
| `src/layout/AppShell.tsx` | filter `NAV_ITEMS` by `access`; add Access item |
| `src/layout/AppShell.test.tsx` | update |
| `src/teams/teamsApi.ts` | remove `addTeamAdmin` / `removeTeamAdmin` |
| `src/teams/teamsApi.test.ts` | drop those tests |
| `src/teams/TeamSettingsTab.tsx` / `.test.tsx` | remove Admins section + form; gate Delete on super-admin |
| `src/teams/TeamsListPage.tsx` / `.test.tsx` | Create/Import gated on `access.isSuperAdmin`; empty-state copy |
| `src/teams/TeamPage.tsx` / `.test.tsx` | Calendar tab gated on `access.sections.trainings` |
| `src/exercises/ExercisesPage.test.tsx`, `src/trainings/TrainingsPage.test.tsx`, `src/players/PlayerCardPage.test.tsx`, `src/skillGuide/SkillGuideEditor.test.tsx`, `src/physicalTestGuide/PhysicalTestGuideEditor.test.tsx` | update `useAuth` mocks to the new shape via `authValue()` |
| `tests/rules/*.rules.test.ts` (exercises, trainings, diagrams, skillGuide, physicalTestGuide, users, teams, calendar, players, physicalTests, bulkImport) | update seed blocks: `role: 'admin'` → `'superadmin'`, add `sectionAccess/*` + `adminAllowlist/*` docs where the actor needs library/guide access |
| `scripts/seed/seed.mjs`, `scripts/seed/README.md` | write `sectionAccess/*`; put `--admin` email in all three |
| `docs/PRODUCTION-READINESS.md` | note the migration step |

---

## Task 1: Rules — helpers, `sectionAccess`, libraries, guides

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/sectionAccess.rules.test.ts`
- Modify: `tests/rules/exercises.rules.test.ts`, `tests/rules/trainings.rules.test.ts`, `tests/rules/diagrams.rules.test.ts`, `tests/rules/skillGuide.rules.test.ts`, `tests/rules/physicalTestGuide.rules.test.ts` (seed blocks only)

**Interfaces:**
- Produces (rules helpers, usable by later rules): `isSuperAdmin()`, `inSection(section)`, `canReadExercises()`, `canWriteExercises()`, `canTrainings()`, `canGuides()`.
- Produces (doc): `sectionAccess/{section}` with `{ adminEmails: string[] }`, `section ∈ {exercises,trainings,guides}`.

- [ ] **Step 1: Write the failing rules test file**

Create `tests/rules/sectionAccess.rules.test.ts`:

```typescript
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('sectionAccess + section-gated libraries', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('adminAllowlist/super@example.com').set({});
      await db.doc('users/super-uid').set({ email: 'super@example.com', role: 'superadmin' });
      await db.doc('users/ex-uid').set({ email: 'ex@example.com', role: 'member' });
      await db.doc('users/tr-uid').set({ email: 'tr@example.com', role: 'member' });
      await db.doc('users/none-uid').set({ email: 'none@example.com', role: 'member' });
      await db.doc('sectionAccess/exercises').set({ adminEmails: ['ex@example.com'] });
      await db.doc('sectionAccess/trainings').set({ adminEmails: ['tr@example.com'] });
      await db.doc('sectionAccess/guides').set({ adminEmails: [] });
      await db.doc('exercises/e-1').set({ name: 'Pepper', description: '', category: 'warmup', createdBy: 'x' });
      await db.doc('trainings/t-1').set({
        name: 'Passing circuit', businessId: 'TR-0007', description: '',
        exercises: [], exerciseIds: [], createdBy: 'x',
      });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  function ctx(uid: string, email: string) {
    return getTestEnv().then((env) => env.authenticatedContext(uid, { email }).firestore());
  }

  it('lets a super-admin read and write any section doc', async () => {
    const db = await ctx('super-uid', 'super@example.com');
    await assertSucceeds(db.doc('sectionAccess/exercises').get());
    await assertSucceeds(db.doc('sectionAccess/guides').update({ adminEmails: ['x@example.com'] }));
  });

  it('lets a listed member read its own section doc but not write it', async () => {
    const db = await ctx('ex-uid', 'ex@example.com');
    await assertSucceeds(db.doc('sectionAccess/exercises').get());
    await assertFails(db.doc('sectionAccess/exercises').update({ adminEmails: [] }));
  });

  it('denies an unlisted member reading a section doc', async () => {
    const db = await ctx('none-uid', 'none@example.com');
    await assertFails(db.doc('sectionAccess/trainings').get());
  });

  it('rejects a super-admin write with a bad shape', async () => {
    const db = await ctx('super-uid', 'super@example.com');
    await assertFails(db.doc('sectionAccess/guides').update({ adminEmails: 'nope' }));
    await assertFails(db.doc('sectionAccess/guides').update({ adminEmails: [], extra: 1 }));
  });

  it('grants exercises CRUD to an exercises-granted member', async () => {
    const db = await ctx('ex-uid', 'ex@example.com');
    await assertSucceeds(db.doc('exercises/e-1').get());
    await assertSucceeds(db.doc('exercises/e-1').update({ name: 'Pepper 2', category: 'warmup' }));
  });

  it('lets a trainings-granted member READ exercises but not write them', async () => {
    const db = await ctx('tr-uid', 'tr@example.com');
    await assertSucceeds(db.doc('exercises/e-1').get());
    await assertFails(db.doc('exercises/e-1').update({ name: 'nope', category: 'warmup' }));
  });

  it('denies a member with no library grant any exercise or training read', async () => {
    const db = await ctx('none-uid', 'none@example.com');
    await assertFails(db.doc('exercises/e-1').get());
    await assertFails(db.doc('trainings/t-1').get());
  });

  it('grants trainings CRUD + counters to a trainings-granted member', async () => {
    const db = await ctx('tr-uid', 'tr@example.com');
    await assertSucceeds(db.doc('trainings/t-1').get());
    await assertSucceeds(
      db.doc('trainings/t-1').update({
        name: 'Passing circuit v2', businessId: 'TR-0007',
        exercises: [], exerciseIds: [],
      })
    );
    await assertSucceeds(db.doc('counters/trainings').set({ lastSequence: 7 }));
  });

  it('lets a guides-granted member write the guide configs; any signed-in user reads them', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (c) =>
      c.firestore().doc('sectionAccess/guides').set({ adminEmails: ['g@example.com'] })
    );
    await env.withSecurityRulesDisabled(async (c) =>
      c.firestore().doc('users/g-uid').set({ email: 'g@example.com', role: 'member' })
    );
    const gdb = await ctx('g-uid', 'g@example.com');
    await assertSucceeds(gdb.doc('skillGuide/config').set({ skills: {}, updatedBy: 'g-uid' }));
    await assertSucceeds(gdb.doc('physicalTestGuide/config').set({ tests: {}, updatedBy: 'g-uid' }));

    const ndb = await ctx('none-uid', 'none@example.com');
    await assertSucceeds(ndb.doc('skillGuide/config').get());
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npm run test:rules`
Expected: the new file fails (rules still use `isAdmin()`; `sectionAccess` has no rule so all access denied → the "grants … to a granted member" cases fail).

- [ ] **Step 3: Rewrite the top of `firestore.rules` and the library/guide blocks**

Replace lines 4–7 (`isAdmin()`) with:

```
function isSuperAdmin() {
  return request.auth != null
    && exists(/databases/$(database)/documents/adminAllowlist/$(request.auth.token.email));
}
function inSection(section) {
  return request.auth != null && request.auth.token.email in
    get(/databases/$(database)/documents/sectionAccess/$(section)).data.adminEmails;
}
function canReadExercises() { return isSuperAdmin() || inSection('exercises') || inSection('trainings'); }
function canWriteExercises() { return isSuperAdmin() || inSection('exercises'); }
function canTrainings()      { return isSuperAdmin() || inSection('trainings'); }
function canGuides()         { return isSuperAdmin() || inSection('guides'); }
```

Immediately after the `adminAllowlist` block add:

```
match /sectionAccess/{section} {
  allow read: if isSuperAdmin()
    || (request.auth != null && request.auth.token.email in resource.data.adminEmails);
  allow write: if isSuperAdmin()
    && request.resource.data.keys().hasOnly(['adminEmails'])
    && request.resource.data.adminEmails is list;
}
```

In `skillGuide/config` and `physicalTestGuide/config`: change `allow write: if isAdmin();` → `allow write: if canGuides();` (leave `allow read: if request.auth != null;`).

In `exercises/{exerciseId}`: `allow read: if canReadExercises();`; `allow create/update/delete`: replace `isAdmin()` with `canWriteExercises()` (keep every existing `&& …` shape check).

In `exercises/{exerciseId}/diagrams/{diagramId}`: `allow read: if canReadExercises();`; `allow create, update` and `allow delete`: replace `isAdmin()` with `canWriteExercises()` (keep shape checks).

In `trainings/{trainingId}`: replace all four `isAdmin()` with `canTrainings()` (keep shape checks).

In `counters/{counterId}`: replace both `isAdmin()` with `canTrainings()` (keep `lastSequence` check).

- [ ] **Step 4: Update the seed blocks of the other affected rules tests**

In each of `tests/rules/exercises.rules.test.ts`, `trainings.rules.test.ts`, `diagrams.rules.test.ts`, `skillGuide.rules.test.ts`, `physicalTestGuide.rules.test.ts`: in the `withSecurityRulesDisabled` setup, for every actor that must have library/guide access, replace `role: 'admin'` with `role: 'superadmin'` **and** add `await db.doc('adminAllowlist/<that email>').set({});`. Keep any `role: 'viewer'` actor as `role: 'member'`. Add `await db.doc('sectionAccess/exercises').set({ adminEmails: [] });` (and `trainings`, `guides`) so `inSection()` never dereferences a missing doc. Non-admin/denied assertions stay as-is.

- [ ] **Step 5: Run all rules tests — verify pass**

Run: `npm run test:rules`
Expected: PASS (all files).

- [ ] **Step 6: Commit**

```bash
git add firestore.rules tests/rules/sectionAccess.rules.test.ts tests/rules/exercises.rules.test.ts tests/rules/trainings.rules.test.ts tests/rules/diagrams.rules.test.ts tests/rules/skillGuide.rules.test.ts tests/rules/physicalTestGuide.rules.test.ts
git commit -m "feat(rules): section-scoped access for the libraries and guides"
```

---

## Task 2: Rules — `users` role rename, `teams` membership split, `calendar` trainings gate

**Files:**
- Modify: `firestore.rules`
- Modify: `tests/rules/users.rules.test.ts`, `tests/rules/teams.rules.test.ts`, `tests/rules/calendar.rules.test.ts`, `tests/rules/players.rules.test.ts`, `tests/rules/physicalTests.rules.test.ts`, `tests/rules/bulkImport.rules.test.ts`

**Interfaces:**
- Consumes: `isSuperAdmin()` (Task 1), `canTrainings()` (Task 1).
- Produces (rules contract): only a super-admin creates/deletes a team or changes `teams/{id}.adminEmails`; a team admin may update every other team field. `calendar/{sessionId}` needs `isTeamAdmin() && canTrainings()`.

- [ ] **Step 1: Update `tests/rules/users.rules.test.ts`**

Replace the three `role` literals: `'admin'` → `'superadmin'`, `'viewer'` → `'member'`. Rename the describe/it text accordingly (e.g. "allows an allowlisted email to create their own user doc with role superadmin"). Keep the self-promotion test but change it to `db.doc('users/parent-uid').update({ role: 'superadmin' })` still failing.

- [ ] **Step 2: Add `teams` membership-split cases to `tests/rules/teams.rules.test.ts`**

In the setup add `await db.doc('adminAllowlist/super@example.com').set({});` and `await db.doc('users/super-uid').set({ email: 'super@example.com', role: 'superadmin' });`. Wherever the existing setup gives the team creator `role: 'admin'`, change to `role: 'superadmin'` + an `adminAllowlist` doc. Add:

```typescript
it('lets a super-admin create and delete a team', async () => {
  const env = await getTestEnv();
  const db = env.authenticatedContext('super-uid', { email: 'super@example.com' }).firestore();
  const ref = db.collection('teams').doc('new-team');
  await assertSucceeds(ref.set({ name: 'U19', adminEmails: ['coach@example.com'], createdBy: 'super-uid' }));
  await assertSucceeds(ref.delete());
});

it('denies a non-super-admin creating or deleting a team', async () => {
  const env = await getTestEnv();
  const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
  await assertFails(
    db.collection('teams').doc('x').set({ name: 'X', adminEmails: ['coach@example.com'], createdBy: 'coach-uid' })
  );
  await assertFails(db.doc('teams/team-1').delete());
});

it('lets a team admin edit team info but not adminEmails', async () => {
  const env = await getTestEnv();
  const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
  await assertSucceeds(db.doc('teams/team-1').update({ name: 'U17 renamed' }));
  await assertFails(db.doc('teams/team-1').update({ adminEmails: ['coach@example.com', 'intruder@example.com'] }));
});

it('lets a super-admin change adminEmails on any team', async () => {
  const env = await getTestEnv();
  const db = env.authenticatedContext('super-uid', { email: 'super@example.com' }).firestore();
  await assertSucceeds(db.doc('teams/team-1').update({ adminEmails: ['coach@example.com', 'assistant@example.com'] }));
});
```

- [ ] **Step 3: Add the calendar trainings-gate cases to `tests/rules/calendar.rules.test.ts`**

In setup add `await db.doc('sectionAccess/trainings').set({ adminEmails: ['coach@example.com'] });` and `await db.doc('adminAllowlist/x').set({})`-style docs only if needed. Change the "denies the linked viewer and unrelated users" block to also assert a team admin **without** trainings access is denied:

```typescript
it('denies a team admin who has no trainings access', async () => {
  const env = await getTestEnv();
  await env.withSecurityRulesDisabled(async (c) =>
    c.firestore().doc('sectionAccess/trainings').set({ adminEmails: [] })  // revoke
  );
  const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
  await assertFails(db.doc('teams/team-1/calendar/session-1').get());
  await assertFails(
    db.collection('teams/team-1/calendar').add({
      date: '2026-09-12', trainingId: 't-2', trainingBusinessId: 'TR-0008',
      trainingName: 'x', notes: '', createdBy: 'coach-uid',
    })
  );
});
```

Ensure the existing "lets the team admin read, create, and delete" test's setup grants `sectionAccess/trainings` to `coach@example.com`.

- [ ] **Step 4: Update seed blocks in `players`, `physicalTests`, `bulkImport` rules tests**

Replace `role: 'admin'` → `role: 'superadmin'` (+ `adminAllowlist` doc) for any actor that needs library access; `role: 'viewer'` → `role: 'member'`. Add `sectionAccess/*` docs with `adminEmails: []` to the setup so `get()` never misses. The player/physicalTest assertions themselves are unchanged (team-admin access is unchanged).

- [ ] **Step 5: Run all rules tests — verify they fail on the new cases**

Run: `npm run test:rules`
Expected: FAIL on the Task-2 assertions (rules still use old `teams` update + `isTeamAdmin()`-only calendar).

- [ ] **Step 6: Edit `firestore.rules`**

`users/{uid}` create clause: change `'viewer'` → `'member'` and `('admin' … exists(adminAllowlist…))` → `('superadmin' && isSuperAdmin())`. Keep `keys().hasOnly(['email','role'])`, `update, delete: if false`.

`teams/{teamId}`:

```
allow read:   if isSuperAdmin()
              || (request.auth != null && request.auth.token.email in resource.data.adminEmails);
allow create: if isSuperAdmin()
              && request.resource.data.createdBy == request.auth.uid
              && request.resource.data.adminEmails is list;
allow update: if isSuperAdmin()
              || (request.auth != null
                  && request.auth.token.email in resource.data.adminEmails
                  && request.resource.data.adminEmails == resource.data.adminEmails);
allow delete: if isSuperAdmin();
```

`teams/{teamId}/calendar/{sessionId}`: change `allow read`, `allow create`, `allow delete` from `isTeamAdmin()` to `isTeamAdmin() && canTrainings()` (keep `allow update: if false;` and the `createdBy` / `date is string` checks on create).

- [ ] **Step 7: Run all rules tests — verify pass**

Run: `npm run test:rules`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add firestore.rules tests/rules/users.rules.test.ts tests/rules/teams.rules.test.ts tests/rules/calendar.rules.test.ts tests/rules/players.rules.test.ts tests/rules/physicalTests.rules.test.ts tests/rules/bulkImport.rules.test.ts
git commit -m "feat(rules): super-admin team lifecycle, membership split, calendar trainings gate"
```

---

## Task 3: `UserRole` + `ensureUserDoc` + mechanical role-literal sweep

**Files:**
- Modify: `src/types/auth.ts`
- Modify: `src/auth/usersApi.ts`, `src/auth/usersApi.test.ts`
- Modify: `src/auth/RequireAdmin.tsx`, `src/teams/TeamsListPage.tsx` (keep the build green — later tasks replace these `role` checks with `access` checks)

**Interfaces:**
- Produces: `UserRole = 'superadmin' | 'member'`; `AppUser = { uid, email, role: UserRole }`; `ensureUserDoc(uid, email) => Promise<AppUser>` — writes `role: 'superadmin'`, falls back to `'member'` on `permission-denied`, and maps a legacy stored `'admin'`→`'superadmin'` / `'viewer'`→`'member'`.
- Note: `RequireAdmin` and `TeamsListPage` are left comparing `role === 'superadmin'` here; Tasks 6, 7, 12 replace them with `access`-based checks. This step is only to keep `npm run build` green (comparing `'superadmin' | 'member'` to the literal `'admin'` is a TS2367 error).

- [ ] **Step 1: Update the test**

In `src/auth/usersApi.test.ts`:
- "returns the existing user doc…" — stored `role: 'admin'` should now come back as `role: 'superadmin'` (legacy mapping). Change the expectation to `role: 'superadmin'`.
- Add a case: stored `role: 'viewer'` → returns `role: 'member'`.
- "creates a role admin doc when the write succeeds" → expect `role: 'superadmin'`; assert `mockSetDoc` called with `{ email, role: 'superadmin' }`.
- "falls back to role viewer…" → expect `role: 'member'`; second `setDoc` called with `{ email, role: 'member' }`.

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/auth/usersApi.test.ts`
Expected: FAIL (`'admin'` !== `'superadmin'`).

- [ ] **Step 3: Update `src/types/auth.ts`**

```typescript
export type UserRole = 'superadmin' | 'member';

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
}
```

- [ ] **Step 4: Update `src/auth/usersApi.ts`**

```typescript
import { doc, getDoc, setDoc, type FirestoreError } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AppUser, UserRole } from '../types/auth';

function normalizeRole(raw: string): UserRole {
  if (raw === 'superadmin' || raw === 'admin') return 'superadmin';
  return 'member';
}

export async function ensureUserDoc(uid: string, email: string): Promise<AppUser> {
  const userRef = doc(db, 'users', uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    const data = existing.data() as { email: string; role: string };
    return { uid, email: data.email, role: normalizeRole(data.role) };
  }

  try {
    await setDoc(userRef, { email, role: 'superadmin' });
    return { uid, email, role: 'superadmin' };
  } catch (error) {
    if ((error as FirestoreError).code !== 'permission-denied') {
      throw error;
    }
    await setDoc(userRef, { email, role: 'member' });
    return { uid, email, role: 'member' };
  }
}
```

- [ ] **Step 5: Run — verify pass**

Run: `npx vitest run src/auth/usersApi.test.ts`
Expected: PASS.

- [ ] **Step 6: Repo-wide role-literal sweep to keep the build green**

`tsconfig.json` includes `tests`, so `npm run build` (`tsc -b`) typechecks every `.test.tsx`. Changing `UserRole` makes every `role: 'admin'` / `role: 'viewer'` literal a type error. Do a mechanical find/replace — **only the literals**, no behavior change:

- Source: `src/auth/RequireAdmin.tsx:9` `!== 'admin'` → `!== 'superadmin'`; `src/teams/TeamsListPage.tsx:56,59` `=== 'admin'` → `=== 'superadmin'`.
- Tests (in every file): `role: 'admin'` → `role: 'superadmin'`, `role: 'viewer'` → `role: 'member'`. Files:
  `src/auth/AuthContext.test.tsx`, `src/auth/RequireAdmin.test.tsx`, `src/auth/RequireAuth.test.tsx`, `src/auth/usersApi.test.ts` (already handled in Step 1 — skip), `src/exercises/ExercisesPage.test.tsx`, `src/physicalTestGuide/PhysicalTestGuideEditor.test.tsx`, `src/players/PlayerCardPage.test.tsx`, `src/skillGuide/SkillGuideEditor.test.tsx`, `src/teams/TeamPage.test.tsx`, `src/teams/TeamsListPage.test.tsx`, `src/trainings/TrainingsPage.test.tsx`.
- `RequireAdmin.test.tsx`: also rename "renders the page for a global admin" → "…for a super-admin" and "denies an authenticated viewer" → "denies a member". (`RequireAdmin` and both `TeamsListPage` checks get replaced with `access`-based logic in Tasks 6 & 12.)

- [ ] **Step 7: Lint, build, full test, commit**

```bash
npm run lint && npm run build && npm test
git add -A src/types/auth.ts src/auth src/teams/TeamsListPage.tsx src/exercises src/physicalTestGuide src/players/PlayerCardPage.test.tsx src/skillGuide src/teams/TeamPage.test.tsx src/teams/TeamsListPage.test.tsx src/trainings
git commit -m "feat(auth): UserRole becomes superadmin | member"
```

---

## Task 4: `resolveAccess` + `Access` type

**Files:**
- Create: `src/auth/access.ts`, `src/auth/access.test.ts`

**Interfaces:**
- Consumes: `AppUser` (Task 3).
- Produces:
  ```typescript
  export type SectionKey = 'exercises' | 'trainings' | 'guides';
  export interface Access {
    isSuperAdmin: boolean;
    sections: Record<SectionKey, boolean>;
  }
  export const SECTION_KEYS: readonly SectionKey[]; // ['exercises','trainings','guides']
  export function resolveAccess(appUser: AppUser): Promise<Access>;
  ```

- [ ] **Step 1: Write the failing test**

`src/auth/access.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveAccess } from './access';

const mockGetDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _c, id) => id),
  getDoc: (...a: unknown[]) => mockGetDoc(...a),
}));
vi.mock('../firebase/config', () => ({ db: {} }));

describe('resolveAccess', () => {
  beforeEach(() => mockGetDoc.mockReset());

  it('gives a super-admin every section without any reads', async () => {
    const access = await resolveAccess({ uid: 'u', email: 'a@b.com', role: 'superadmin' });
    expect(access).toEqual({
      isSuperAdmin: true,
      sections: { exercises: true, trainings: true, guides: true },
    });
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('marks a section true when its doc reads successfully, false on permission-denied', async () => {
    mockGetDoc.mockImplementation((id: string) => {
      if (id === 'exercises') return Promise.resolve({ exists: () => true });
      if (id === 'trainings') return Promise.reject({ code: 'permission-denied' });
      if (id === 'guides') return Promise.reject({ code: 'permission-denied' });
      throw new Error('unexpected ' + id);
    });
    const access = await resolveAccess({ uid: 'u', email: 'm@b.com', role: 'member' });
    expect(access).toEqual({
      isSuperAdmin: false,
      sections: { exercises: true, trainings: false, guides: false },
    });
  });

  it('rethrows a non-permission error', async () => {
    mockGetDoc.mockRejectedValue({ code: 'unavailable' });
    await expect(
      resolveAccess({ uid: 'u', email: 'm@b.com', role: 'member' })
    ).rejects.toEqual({ code: 'unavailable' });
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/auth/access.test.ts`
Expected: FAIL ("resolveAccess is not a function").

- [ ] **Step 3: Implement `src/auth/access.ts`**

```typescript
import { doc, getDoc, type FirestoreError } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AppUser } from '../types/auth';

export type SectionKey = 'exercises' | 'trainings' | 'guides';
export const SECTION_KEYS: readonly SectionKey[] = ['exercises', 'trainings', 'guides'];

export interface Access {
  isSuperAdmin: boolean;
  sections: Record<SectionKey, boolean>;
}

async function canReadSection(section: SectionKey): Promise<boolean> {
  try {
    await getDoc(doc(db, 'sectionAccess', section));
    return true;
  } catch (error) {
    if ((error as FirestoreError).code === 'permission-denied') return false;
    throw error;
  }
}

export async function resolveAccess(appUser: AppUser): Promise<Access> {
  if (appUser.role === 'superadmin') {
    return { isSuperAdmin: true, sections: { exercises: true, trainings: true, guides: true } };
  }
  const results = await Promise.all(SECTION_KEYS.map((s) => canReadSection(s)));
  return {
    isSuperAdmin: false,
    sections: {
      exercises: results[0],
      trainings: results[1],
      guides: results[2],
    },
  };
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/auth/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/access.ts src/auth/access.test.ts
git commit -m "feat(auth): resolveAccess builds the client access object from sectionAccess"
```

---

## Task 5: `AuthContext` exposes `access` + `authValue` test factory

**Files:**
- Modify: `src/auth/AuthContext.tsx`, `src/auth/AuthContext.test.tsx`
- Create: `src/test/authValue.ts`

**Interfaces:**
- Consumes: `resolveAccess` + `Access` (Task 4), `ensureUserDoc` (Task 3).
- Produces:
  - `AuthContextValue` now has `access: Access | null`.
  - `src/test/authValue.ts`: `export function authValue(over?: Partial<AuthContextValue>): AuthContextValue` — defaults to a signed-out state (`firebaseUser: null, appUser: null, access: null, loading: false, authError: null`).

- [ ] **Step 1: Update `src/auth/AuthContext.test.tsx`**

Add a `resolveAccess` mock next to the existing mocks:

```typescript
const mockResolveAccess = vi.fn();
vi.mock('./access', () => ({
  resolveAccess: (...args: unknown[]) => mockResolveAccess(...args),
  SECTION_KEYS: ['exercises', 'trainings', 'guides'],
}));
```

Extend `Probe` to also render access:

```typescript
function Probe() {
  const { loading, appUser, access, authError } = useAuth();
  return (
    <div>
      <p>loading: {String(loading)}</p>
      <p>appUser: {appUser ? appUser.role : 'none'}</p>
      <p>access: {access ? (access.isSuperAdmin ? 'super' : Object.entries(access.sections).filter(([, v]) => v).map(([k]) => k).join(',') || 'member') : 'none'}</p>
      <p>authError: {authError ?? 'none'}</p>
    </div>
  );
}
```

Change the success test's stored role to `'superadmin'` and assert access:

```typescript
it('resolves the app user and access, leaving authError null on success', async () => {
  mockEnsureUserDoc.mockResolvedValueOnce({ uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' });
  mockResolveAccess.mockResolvedValueOnce({
    isSuperAdmin: true, sections: { exercises: true, trainings: true, guides: true },
  });

  render(<AuthProvider><Probe /></AuthProvider>);

  await waitFor(() => expect(screen.getByText('appUser: superadmin')).toBeInTheDocument());
  expect(screen.getByText('access: super')).toBeInTheDocument();
  expect(screen.getByText('authError: none')).toBeInTheDocument();
});
```

The rethrow test also needs `access: none` after failure — add `expect(screen.getByText('access: none')).toBeInTheDocument();` to it.

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/auth/AuthContext.test.tsx`
Expected: FAIL (`access` undefined).

- [ ] **Step 3: Update `src/auth/AuthContext.tsx`**

```typescript
import { resolveAccess } from './access';
import type { Access } from './access';

export interface AuthContextValue {   // NB: now exported — the test factory imports it
  firebaseUser: User | null;
  appUser: AppUser | null;
  access: Access | null;
  loading: boolean;
  authError: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  appUser: null,
  access: null,
  loading: true,
  authError: null,
});

// inside AuthProvider:
const [access, setAccess] = useState<Access | null>(null);
// ...
if (user && user.email) {
  const resolved = await ensureUserDoc(user.uid, user.email);
  setAppUser(resolved);
  setAccess(await resolveAccess(resolved));
} else {
  setAppUser(null);
  setAccess(null);
}
// ...
// on catch: setAppUser(null); setAccess(null);
// provider value adds `access`
```

- [ ] **Step 4: Create `src/test/authValue.ts`**

```typescript
import type { User } from 'firebase/auth';
import type { Access } from '../auth/access';
import type { AuthContextValue } from '../auth/AuthContext';

const MEMBER_ACCESS: Access = {
  isSuperAdmin: false,
  sections: { exercises: false, trainings: false, guides: false },
};

export const superAdminAccess: Access = {
  isSuperAdmin: true,
  sections: { exercises: true, trainings: true, guides: true },
};

export function authValue(over: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    firebaseUser: { uid: 'u-1', email: 'user@example.com' } as User,
    appUser: { uid: 'u-1', email: 'user@example.com', role: 'member' },
    access: MEMBER_ACCESS,
    loading: false,
    authError: null,
    ...over,
  };
}
```

- [ ] **Step 5: Run — verify the AuthContext test passes; build now fails**

Run: `npx vitest run src/auth/AuthContext.test.tsx` → PASS.
Run: `npm run build` → **FAIL**: `access` is now a required field of `AuthContextValue`, so every other test file that does `vi.mocked(useAuth).mockReturnValue({...})` is missing it. The next step fixes them all.

- [ ] **Step 6: Migrate every `useAuth` mock to `authValue()`**

In each file below, replace the object literal passed to `vi.mocked(useAuth).mockReturnValue(...)` (or the inline `useAuth: () => ({...})` factory) with `authValue({ ...only the fields that test needs to override... })`, importing `import { authValue, superAdminAccess } from '<relative>/test/authValue';`. Default `authValue()` is a signed-in **member with no grants**; pass `{ appUser: { uid, email, role: 'superadmin' }, access: superAdminAccess }` for tests that were exercising the old global admin. Do **not** change assertions.

Files (all currently mock `useAuth`):
`src/auth/RequireAuth.test.tsx`, `src/calendar/AssignTrainingDialog.test.tsx`, `src/diagrams/DiagramEditorPage.test.tsx`, `src/exercises/ExerciseFormDialog.test.tsx`, `src/exercises/ExercisesPage.test.tsx`, `src/physicalTestGuide/PhysicalTestGuideEditor.test.tsx`, `src/players/AddPlayerDialog.test.tsx`, `src/players/PhysicalTestingSection.test.tsx`, `src/players/PlayerCardPage.test.tsx`, `src/skillGuide/SkillGuideEditor.test.tsx`, `src/teams/CreateTeamDialog.test.tsx`, `src/teams/TeamPage.test.tsx`, `src/teams/TeamsListPage.test.tsx`, `src/trainings/TrainingBuilderDialog.test.tsx`, `src/trainings/TrainingsPage.test.tsx`.

(`RequireAdmin.test.tsx` is deleted in Task 6; skip it here. `AuthContext.test.tsx` is handled in Step 1.)

- [ ] **Step 7: Run — verify green**

Run: `npm run lint && npm run build && npm test`
Expected: PASS across the board. Any straggler `mockReturnValue` the sweep missed shows up here — fix with `authValue()`.

- [ ] **Step 8: Commit**

```bash
git add -A src/auth src/test src/calendar src/diagrams src/exercises src/physicalTestGuide src/players src/skillGuide src/teams src/trainings
git commit -m "feat(auth): AuthContext resolves and exposes access; migrate useAuth mocks"
```

---

## Task 6: Route guards `RequireSuperAdmin` + `RequireSection`; delete `RequireAdmin`

**Files:**
- Create: `src/auth/RequireSuperAdmin.tsx`, `src/auth/RequireSection.tsx`, `src/auth/guards.test.tsx`
- Delete: `src/auth/RequireAdmin.tsx`, `src/auth/RequireAdmin.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `access` (Task 5); `SectionKey` (Task 4); `RequireAuth`, `AuthShell` (existing).
- Produces:
  - `RequireSuperAdmin({ children }): JSX` — renders children iff `access?.isSuperAdmin`, else the standard "You don't have access to this page." `AuthShell`.
  - `RequireSection({ section, children }): JSX` — `section: SectionKey`; renders children iff `access?.sections[section]`.

- [ ] **Step 1: Write the failing test**

`src/auth/guards.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireSuperAdmin } from './RequireSuperAdmin';
import { RequireSection } from './RequireSection';
import { useAuth } from './AuthContext';
import { authValue, superAdminAccess } from '../test/authValue';

vi.mock('./AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function renderWith(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('RequireSuperAdmin', () => {
  it('renders for a super-admin', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ access: superAdminAccess }));
    renderWith(<RequireSuperAdmin><p>secret</p></RequireSuperAdmin>);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
  it('blocks a member', () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    renderWith(<RequireSuperAdmin><p>secret</p></RequireSuperAdmin>);
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("You don't have access to this page.");
  });
});

describe('RequireSection', () => {
  it('renders when the section is granted', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: { isSuperAdmin: false, sections: { exercises: true, trainings: false, guides: false } } })
    );
    renderWith(<RequireSection section="exercises"><p>lib</p></RequireSection>);
    expect(screen.getByText('lib')).toBeInTheDocument();
  });
  it('blocks when the section is not granted', () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    renderWith(<RequireSection section="trainings"><p>lib</p></RequireSection>);
    expect(screen.queryByText('lib')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/auth/guards.test.tsx`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the two guards**

`src/auth/RequireSuperAdmin.tsx`:

```typescript
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { AuthShell } from './AuthShell';
import { RequireAuth } from './RequireAuth';

function Denied() {
  return (
    <AuthShell>
      <p role="alert" className="text-red">You don&apos;t have access to this page.</p>
    </AuthShell>
  );
}

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <Gate>{children}</Gate>
    </RequireAuth>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { access } = useAuth();
  return access?.isSuperAdmin ? <>{children}</> : <Denied />;
}
```

`src/auth/RequireSection.tsx`:

```typescript
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { AuthShell } from './AuthShell';
import { RequireAuth } from './RequireAuth';
import type { SectionKey } from './access';

export function RequireSection({ section, children }: { section: SectionKey; children: ReactNode }) {
  return (
    <RequireAuth>
      <Gate section={section}>{children}</Gate>
    </RequireAuth>
  );
}

function Gate({ section, children }: { section: SectionKey; children: ReactNode }) {
  const { access } = useAuth();
  if (access?.sections[section]) return <>{children}</>;
  return (
    <AuthShell>
      <p role="alert" className="text-red">You don&apos;t have access to this page.</p>
    </AuthShell>
  );
}
```

- [ ] **Step 4: Delete the old guard**

```bash
git rm src/auth/RequireAdmin.tsx src/auth/RequireAdmin.test.tsx
```

- [ ] **Step 5: Run — verify pass**

Run: `npx vitest run src/auth/guards.test.tsx`
Expected: PASS. (`npm run build` will fail until Task 7 removes the `RequireAdmin` import in `App.tsx` — that's expected; do not commit yet if build is red. To keep this task's commit green, do Task 7's `App.tsx` edit now as part of Step 6.)

- [ ] **Step 6: Update `src/App.tsx` imports/guards and commit**

In `src/App.tsx`: remove `import { RequireAdmin }`; add `import { RequireSuperAdmin } from './auth/RequireSuperAdmin';` and `import { RequireSection } from './auth/RequireSection';`. Wrap `/exercises` and `/exercises/:exerciseId/diagram` in `<RequireSection section="exercises">`, `/trainings` in `<RequireSection section="trainings">`, `/admin/guides` in `<RequireSection section="guides">`. Add:

```tsx
import { AccessManagerPage } from './access/AccessManagerPage';
// ...
<Route
  path="/admin/access"
  element={<RequireSuperAdmin><AccessManagerPage /></RequireSuperAdmin>}
/>
```

(`AccessManagerPage` does not exist yet — add a one-line placeholder `export function AccessManagerPage() { return null; }` in `src/access/AccessManagerPage.tsx` so the build passes; Task 9 replaces it.)

```bash
npm run lint && npm run build && npm test
git add -A src/auth src/App.tsx src/access/AccessManagerPage.tsx
git commit -m "feat(auth): RequireSuperAdmin + RequireSection guards, wire routes"
```

---

## Task 7: `AppShell` nav filtered by access

**Files:**
- Modify: `src/layout/AppShell.tsx`, `src/layout/AppShell.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `access` (Task 5).
- Produces: nav renders Teams always; Exercises/Trainings/Guides iff the matching `access.sections.*`; an **Access** item (`to="/admin/access"`, `KeyRound` icon, positioned after Guides) iff `access.isSuperAdmin`. Same filter for the desktop sidebar and the mobile bottom bar.

- [ ] **Step 1: Rewrite `src/layout/AppShell.test.tsx`**

The file has no `useAuth` mock today and its one nav test asserts every item is present. Add the mock and split the assertions by access:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppShell } from './AppShell';
import { useAuth } from '../auth/AuthContext';
import { authValue, superAdminAccess } from '../test/authValue';

const mockSignOut = vi.fn();
vi.mock('firebase/auth', () => ({ signOut: (...args: unknown[]) => mockSignOut(...args) }));
vi.mock('../firebase/config', () => ({ auth: {} }));
vi.mock('../auth/AuthContext');

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/teams']}>
      <AppShell><p>Page content</p></AppShell>
    </MemoryRouter>
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(authValue({ access: superAdminAccess }));
  });

  it('shows every nav destination in both shells for a super-admin', () => {
    renderShell();
    for (const label of ['Teams', 'Exercises', 'Trainings', 'Guides', 'Access']) {
      expect(screen.getAllByText(label)).toHaveLength(2);
    }
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('shows only granted sections for a member', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: { isSuperAdmin: false, sections: { exercises: true, trainings: false, guides: false } } })
    );
    renderShell();
    expect(screen.getAllByText('Teams')).toHaveLength(2);
    expect(screen.getAllByText('Exercises')).toHaveLength(2);
    expect(screen.queryByText('Trainings')).not.toBeInTheDocument();
    expect(screen.queryByText('Guides')).not.toBeInTheDocument();
    expect(screen.queryByText('Access')).not.toBeInTheDocument();
  });

  it('signs out and redirects to /login when a sign-out button is clicked', async () => {
    mockSignOut.mockResolvedValue(undefined);
    renderShell();
    fireEvent.click(screen.getAllByText('Sign out')[0]);
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/layout/AppShell.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `src/layout/AppShell.tsx`**

```typescript
import { BookOpen, ClipboardList, Dumbbell, KeyRound, LogOut, Settings, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

// inside AppShell():
const { access } = useAuth();
const navItems = [
  { to: '/teams', label: 'Teams', Icon: Users, show: true },
  { to: '/exercises', label: 'Exercises', Icon: Dumbbell, show: !!access?.sections.exercises },
  { to: '/trainings', label: 'Trainings', Icon: ClipboardList, show: !!access?.sections.trainings },
  { to: '/admin/guides', label: 'Guides', Icon: BookOpen, show: !!access?.sections.guides },
  { to: '/admin/access', label: 'Access', Icon: KeyRound, show: !!access?.isSuperAdmin },
].filter((i) => i.show);
```

Replace both `NAV_ITEMS.map(...)` uses with `navItems.map(...)`. Delete the module-level `NAV_ITEMS` const.

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/layout/AppShell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint, build, commit**

```bash
npm run lint && npm run build
git add src/layout/AppShell.tsx src/layout/AppShell.test.tsx
git commit -m "feat(nav): filter nav items by resolved access; add Access entry"
```

---

## Task 8: `accessApi`

**Files:**
- Create: `src/access/accessApi.ts`, `src/access/accessApi.test.ts`

**Interfaces:**
- Consumes: `SECTION_KEYS`, `SectionKey` (Task 4); `Team` type (existing `src/types/team.ts`).
- Produces:
  ```typescript
  export interface GrantSet { teamIds: string[]; sections: Record<SectionKey, boolean>; }
  export interface GrantHolder { email: string; grants: GrantSet; }
  export interface TeamRow { id: string; name: string; }
  export function listAllTeams(afterDoc?: QueryDocumentSnapshot | null):
    Promise<{ teams: TeamRow[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }>;
  export function listGrantHolders(): Promise<GrantHolder[]>;
  export function saveGrants(email: string, next: GrantSet, prev: GrantSet): Promise<void>;
  export function removeAllGrants(email: string): Promise<void>;
  export function emptyGrantSet(): GrantSet;
  ```
- `listAllTeams` uses `query(collection(db,'teams'), orderBy('name'), limit(50), [startAfter(afterDoc)])`. A single-field ascending `orderBy` needs **no** composite index (Firestore auto-indexes single fields) — do not touch `firestore.indexes.json`.

- [ ] **Step 1: Write the failing test**

`src/access/accessApi.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { saveGrants, emptyGrantSet, listGrantHolders } from './accessApi';

const arrayUnion = vi.fn((...v: string[]) => ({ __op: 'union', v }));
const arrayRemove = vi.fn((...v: string[]) => ({ __op: 'remove', v }));
const update = vi.fn();
const commit = vi.fn().mockResolvedValue(undefined);
const getDocs = vi.fn();
const getDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'col'),
  doc: vi.fn((_db, c, id) => `${c}/${id}`),
  query: vi.fn((...a) => a),
  orderBy: vi.fn(() => 'orderBy'),
  limit: vi.fn(() => 'limit'),
  startAfter: vi.fn(() => 'startAfter'),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  arrayUnion: (...v: string[]) => arrayUnion(...v),
  arrayRemove: (...v: string[]) => arrayRemove(...v),
  writeBatch: () => ({ update, commit }),
  type: {},
}));
vi.mock('../firebase/config', () => ({ db: {} }));

beforeEach(() => { update.mockReset(); commit.mockReset().mockResolvedValue(undefined); });

describe('saveGrants', () => {
  it('only writes docs whose membership changed', async () => {
    const prev = { teamIds: ['t1', 't2'], sections: { exercises: true, trainings: false, guides: false } };
    const next = { teamIds: ['t2', 't3'], sections: { exercises: false, trainings: true, guides: false } };
    await saveGrants('coach@example.com', next, prev);

    expect(update).toHaveBeenCalledWith('teams/t3', { adminEmails: { __op: 'union', v: ['coach@example.com'] } });
    expect(update).toHaveBeenCalledWith('teams/t1', { adminEmails: { __op: 'remove', v: ['coach@example.com'] } });
    expect(update).toHaveBeenCalledWith('sectionAccess/trainings', { adminEmails: { __op: 'union', v: ['coach@example.com'] } });
    expect(update).toHaveBeenCalledWith('sectionAccess/exercises', { adminEmails: { __op: 'remove', v: ['coach@example.com'] } });
    // t2 unchanged, guides unchanged → not written
    expect(update).not.toHaveBeenCalledWith('teams/t2', expect.anything());
    expect(update).not.toHaveBeenCalledWith('sectionAccess/guides', expect.anything());
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('emptyGrantSet has no teams and all sections false', () => {
    expect(emptyGrantSet()).toEqual({ teamIds: [], sections: { exercises: false, trainings: false, guides: false } });
  });
});

describe('listGrantHolders', () => {
  it('unions team adminEmails and section adminEmails per person, sorted', async () => {
    getDocs.mockResolvedValue({
      docs: [
        { id: 't1', data: () => ({ name: 'A', adminEmails: ['b@x.com', 'a@x.com'] }) },
        { id: 't2', data: () => ({ name: 'B', adminEmails: ['a@x.com'] }) },
      ],
    });
    getDoc.mockImplementation((path: string) => {
      const map: Record<string, string[]> = {
        'sectionAccess/exercises': ['a@x.com'],
        'sectionAccess/trainings': [],
        'sectionAccess/guides': ['c@x.com'],
      };
      return Promise.resolve({ data: () => ({ adminEmails: map[path] ?? [] }) });
    });

    const holders = await listGrantHolders();
    expect(holders.map((h) => h.email)).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
    expect(holders[0].grants).toEqual({
      teamIds: ['t1', 't2'],
      sections: { exercises: true, trainings: false, guides: false },
    });
    expect(holders[2].grants).toEqual({
      teamIds: [],
      sections: { exercises: false, trainings: false, guides: true },
    });
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/access/accessApi.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/access/accessApi.ts`**

```typescript
import {
  arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, limit, orderBy,
  query, startAfter, writeBatch, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { SECTION_KEYS, type SectionKey } from '../auth/access';

const TEAMS_PAGE = 50;

export interface GrantSet {
  teamIds: string[];
  sections: Record<SectionKey, boolean>;
}
export interface GrantHolder { email: string; grants: GrantSet; }
export interface TeamRow { id: string; name: string }

export function emptyGrantSet(): GrantSet {
  return { teamIds: [], sections: { exercises: false, trainings: false, guides: false } };
}

export async function listAllTeams(
  afterDoc: QueryDocumentSnapshot | null = null,
): Promise<{ teams: TeamRow[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const base = collection(db, 'teams');
  const q = afterDoc
    ? query(base, orderBy('name'), startAfter(afterDoc), limit(TEAMS_PAGE))
    : query(base, orderBy('name'), limit(TEAMS_PAGE));
  const snap = await getDocs(q);
  return {
    teams: snap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) ?? d.id })),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === TEAMS_PAGE,
  };
}

export async function listGrantHolders(): Promise<GrantHolder[]> {
  const map = new Map<string, GrantSet>();
  const ensure = (email: string) => {
    if (!map.has(email)) map.set(email, emptyGrantSet());
    return map.get(email)!;
  };

  // all teams (paged to completion)
  let cursor: QueryDocumentSnapshot | null = null;
  do {
    const base = collection(db, 'teams');
    const q = cursor
      ? query(base, orderBy('name'), startAfter(cursor), limit(TEAMS_PAGE))
      : query(base, orderBy('name'), limit(TEAMS_PAGE));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      for (const email of (d.data().adminEmails as string[] | undefined) ?? []) {
        ensure(email).teamIds.push(d.id);
      }
    }
    cursor = snap.docs.length === TEAMS_PAGE ? snap.docs[snap.docs.length - 1] : null;
  } while (cursor);

  // sections
  for (const section of SECTION_KEYS) {
    const snap = await getDoc(doc(db, 'sectionAccess', section));
    for (const email of (snap.data()?.adminEmails as string[] | undefined) ?? []) {
      ensure(email).sections[section] = true;
    }
  }

  return [...map.entries()]
    .map(([email, grants]) => ({ email, grants }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function saveGrants(email: string, next: GrantSet, prev: GrantSet): Promise<void> {
  const batch = writeBatch(db);
  const prevTeams = new Set(prev.teamIds);
  const nextTeams = new Set(next.teamIds);
  for (const id of nextTeams) {
    if (!prevTeams.has(id)) batch.update(doc(db, 'teams', id), { adminEmails: arrayUnion(email) });
  }
  for (const id of prevTeams) {
    if (!nextTeams.has(id)) batch.update(doc(db, 'teams', id), { adminEmails: arrayRemove(email) });
  }
  for (const section of SECTION_KEYS) {
    if (next.sections[section] && !prev.sections[section]) {
      batch.update(doc(db, 'sectionAccess', section), { adminEmails: arrayUnion(email) });
    }
    if (!next.sections[section] && prev.sections[section]) {
      batch.update(doc(db, 'sectionAccess', section), { adminEmails: arrayRemove(email) });
    }
  }
  await batch.commit();
}

export async function removeAllGrants(email: string): Promise<void> {
  const holder = (await listGrantHolders()).find((h) => h.email === email);
  if (!holder) return;
  await saveGrants(email, emptyGrantSet(), holder.grants);
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/access/accessApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint, build, commit**

```bash
npm run lint && npm run build
git add src/access/accessApi.ts src/access/accessApi.test.ts
git commit -m "feat(access): accessApi — list teams/grant-holders, save/remove grants"
```

---

## Task 9: `AccessManagerPage`

**Files:**
- Modify: `src/access/AccessManagerPage.tsx` (replace the placeholder)
- Create: `src/access/AccessManagerPage.test.tsx`

**Interfaces:**
- Consumes: `listAllTeams`, `listGrantHolders`, `saveGrants`, `removeAllGrants`, `emptyGrantSet`, `GrantSet`, `GrantHolder`, `TeamRow` (Task 8); `Button` (`src/components/Button`), `Input` (`src/components/Input`).
- Produces: the `/admin/access` page (default export not required; named `AccessManagerPage`).

- [ ] **Step 1: Write the failing test**

`src/access/AccessManagerPage.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AccessManagerPage } from './AccessManagerPage';
import * as accessApi from './accessApi';

vi.mock('./accessApi');
vi.mock('../firebase/config', () => ({ db: {} }));

const teams = [
  { id: 't1', name: 'U15' },
  { id: 't2', name: 'U17' },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(accessApi.emptyGrantSet).mockReturnValue({
    teamIds: [], sections: { exercises: false, trainings: false, guides: false },
  });
  vi.mocked(accessApi.listAllTeams).mockResolvedValue({ teams, lastDoc: null, hasMore: false });
  vi.mocked(accessApi.listGrantHolders).mockResolvedValue([
    { email: 'coach@example.com', grants: { teamIds: ['t1'], sections: { exercises: true, trainings: false, guides: false } } },
  ]);
  vi.mocked(accessApi.saveGrants).mockResolvedValue(undefined);
  vi.mocked(accessApi.removeAllGrants).mockResolvedValue(undefined);
});

describe('AccessManagerPage', () => {
  it('lists existing grant holders', async () => {
    render(<AccessManagerPage />);
    expect(await screen.findByText('coach@example.com')).toBeInTheDocument();
  });

  it('adds a person by email, lowercased, and opens an empty grant panel', async () => {
    render(<AccessManagerPage />);
    await screen.findByText('coach@example.com');
    fireEvent.change(screen.getByLabelText('Add person by email'), { target: { value: '  NEW@Example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }));
    expect(await screen.findByRole('heading', { name: 'new@example.com' })).toBeInTheDocument();
  });

  it('saves a diff of the toggled grants', async () => {
    render(<AccessManagerPage />);
    fireEvent.click(await screen.findByText('coach@example.com'));

    // grant U17 and trainings, revoke exercises
    fireEvent.click(await screen.findByRole('checkbox', { name: 'U17' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trainings' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exercises' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(accessApi.saveGrants).toHaveBeenCalledWith(
        'coach@example.com',
        { teamIds: ['t1', 't2'], sections: { exercises: false, trainings: true, guides: false } },
        { teamIds: ['t1'], sections: { exercises: true, trainings: false, guides: false } },
      )
    );
  });

  it('removes all access for a person', async () => {
    render(<AccessManagerPage />);
    fireEvent.click(await screen.findByText('coach@example.com'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove all access' }));
    await waitFor(() => expect(accessApi.removeAllGrants).toHaveBeenCalledWith('coach@example.com'));
  });

  it('surfaces an error if teams fail to load', async () => {
    vi.mocked(accessApi.listAllTeams).mockRejectedValueOnce(new Error('permission-denied'));
    render(<AccessManagerPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/access/AccessManagerPage.test.tsx`
Expected: FAIL (placeholder renders `null`).

- [ ] **Step 3: Implement `src/access/AccessManagerPage.tsx`**

```typescript
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SECTION_KEYS, type SectionKey } from '../auth/access';
import {
  emptyGrantSet, listAllTeams, listGrantHolders, removeAllGrants, saveGrants,
  type GrantHolder, type GrantSet, type TeamRow,
} from './accessApi';

const SECTION_LABEL: Record<SectionKey, string> = {
  exercises: 'Exercises', trainings: 'Trainings', guides: 'Guides',
};

function sameGrants(a: GrantSet, b: GrantSet): boolean {
  const sa = [...a.teamIds].sort().join(',');
  const sb = [...b.teamIds].sort().join(',');
  return sa === sb && SECTION_KEYS.every((s) => a.sections[s] === b.sections[s]);
}

export function AccessManagerPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [holders, setHolders] = useState<GrantHolder[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<GrantSet>(emptyGrantSet());
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setError(null);
    try {
      const [{ teams: allTeams }, allHolders] = await Promise.all([listAllTeams(), listGrantHolders()]);
      setTeams(allTeams);
      setHolders(allHolders);
    } catch {
      setError('Could not load access data. Please refresh the page.');
    }
  }
  useEffect(() => { void reload(); }, []);

  const original = useMemo<GrantSet>(
    () => holders.find((h) => h.email === selected)?.grants ?? emptyGrantSet(),
    [holders, selected],
  );

  function select(email: string) {
    setSelected(email);
    setDraft(holders.find((h) => h.email === email)?.grants ?? emptyGrantSet());
  }

  function addPerson() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setNewEmail('');
    if (!holders.some((h) => h.email === email)) {
      setHolders((cur) => [...cur, { email, grants: emptyGrantSet() }].sort((a, b) => a.email.localeCompare(b.email)));
    }
    setSelected(email);
    setDraft(emptyGrantSet());
  }

  function toggleTeam(id: string) {
    setDraft((d) => ({
      ...d,
      teamIds: d.teamIds.includes(id) ? d.teamIds.filter((t) => t !== id) : [...d.teamIds, id],
    }));
  }
  function toggleSection(s: SectionKey) {
    setDraft((d) => ({ ...d, sections: { ...d.sections, [s]: !d.sections[s] } }));
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await saveGrants(selected, draft, original);
      await reload();
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function removeAll() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await removeAllGrants(selected);
      await reload();
      setSelected(null);
    } catch {
      setError('Could not remove access. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Access</h1>
      {error && <p role="alert" className="mb-4 text-red">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex flex-col gap-2">
            <label htmlFor="new-person" className="text-sm font-medium text-ink">Add person by email</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="new-person" type="email" value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)} className="w-full sm:w-auto sm:flex-1" />
              <Button variant="primary" size="sm" className="w-full sm:w-auto" onClick={addPerson}>Add person</Button>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {holders.map((h) => (
              <li key={h.email}>
                <button type="button" onClick={() => select(h.email)}
                  className={`w-full px-1 py-2 text-left text-sm ${selected === h.email ? 'font-semibold text-blue' : 'text-ink'}`}>
                  {h.email}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-xs text-slate">
            Super-admins (full access) are managed directly in Firestore
            (<code>adminAllowlist</code>) and are not listed here.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          {!selected ? (
            <p className="text-sm text-slate">Select a person to manage their access.</p>
          ) : (
            <>
              <h2 className="mb-4 text-lg font-semibold text-ink">{selected}</h2>

              <fieldset className="mb-4">
                <legend className="mb-2 text-sm font-medium text-ink">Sections</legend>
                <div className="flex flex-col gap-2">
                  {SECTION_KEYS.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" aria-label={SECTION_LABEL[s]}
                        checked={draft.sections[s]} onChange={() => toggleSection(s)} />
                      {SECTION_LABEL[s]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mb-4">
                <legend className="mb-2 text-sm font-medium text-ink">Teams</legend>
                <div className="flex flex-col gap-2">
                  {teams.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" aria-label={t.name}
                        checked={draft.teamIds.includes(t.id)} onChange={() => toggleTeam(t.id)} />
                      {t.name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button variant="primary" size="sm" className="w-full sm:w-auto"
                  disabled={saving || sameGrants(draft, original)} onClick={() => void save()}>
                  Save
                </Button>
                <Button variant="dangerGhost" size="sm" className="w-full sm:w-auto"
                  disabled={saving} onClick={() => void removeAll()}>
                  Remove all access
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/access/AccessManagerPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint, build, commit**

```bash
npm run lint && npm run build
git add src/access/AccessManagerPage.tsx src/access/AccessManagerPage.test.tsx
git commit -m "feat(access): the /admin/access manager page"
```

---

## Task 10: Remove `addTeamAdmin` / `removeTeamAdmin`

**Files:**
- Modify: `src/teams/teamsApi.ts`, `src/teams/teamsApi.test.ts`

**Interfaces:**
- Produces: `teamsApi` no longer exports `addTeamAdmin` / `removeTeamAdmin`. `updateTeamInfo`, `createTeam`, `listMyTeams`, `getTeam`, `deleteTeam` unchanged.

- [ ] **Step 1: Delete the tests for those two functions**

In `src/teams/teamsApi.test.ts` remove the `describe`/`it` blocks that exercise `addTeamAdmin` and `removeTeamAdmin`.

- [ ] **Step 2: Delete the two functions**

In `src/teams/teamsApi.ts` remove `export async function addTeamAdmin(...)` and `export async function removeTeamAdmin(...)`.

- [ ] **Step 3: Run — verify pass (and no dangling imports)**

Run: `npx vitest run src/teams/teamsApi.test.ts && npm run build`
Expected: PASS / build clean (build fails if anything still imports the removed functions — Task 11 handles `TeamSettingsTab`; do Task 11 before committing if build is red, or temporarily comment the import — but prefer to sequence Task 11 immediately).

- [ ] **Step 4: Commit (together with Task 11 if needed for a green build)**

```bash
git add src/teams/teamsApi.ts src/teams/teamsApi.test.ts
git commit -m "refactor(teams): drop client add/removeTeamAdmin (grants move to Access page)"
```

---

## Task 11: `TeamSettingsTab` — replace Admins section with a Team-info form; gate Delete on super-admin

**Files:**
- Modify: `src/teams/TeamSettingsTab.tsx`, `src/teams/TeamSettingsTab.test.tsx`

**Context:** the current `TeamSettingsTab` has three sections — Admins list, add-admin form, Danger zone. There is **no** team-info edit UI anywhere in the app today (`teamsApi.updateTeamInfo` exists but is unused). Removing the two admin sections would leave a non-super-admin's Settings tab empty, so this task also adds the small team-info form the spec (§6.5) calls for.

**Interfaces:**
- Consumes: `useAuth()` → `access` (Task 5); `updateTeamInfo(teamId, { name?, description?, notes? })` (existing, `src/teams/teamsApi.ts`); `Input`, `Textarea` (`src/components/Input`).
- Produces: `TeamSettingsTab` renders **Team info** (name/description/notes → `updateTeamInfo` → `onTeamUpdated`) for anyone who can see the tab, and, when `access?.isSuperAdmin`, the **Danger zone / Delete team** section. No Admins list, no add-admin form.

- [ ] **Step 1: Update the test**

Rewrite `src/teams/TeamSettingsTab.test.tsx`:
- Keep the existing mocks; add `vi.mock('../auth/AuthContext')` and `import { authValue, superAdminAccess } from '../test/authValue';` and `import { useAuth } from '../auth/AuthContext';`.
- In `renderSettings`, first line: `vi.mocked(useAuth).mockReturnValue(authValue({ access: superAdminAccess }));` (callers can override before rendering by re-mocking — simplest is to set it inside each test before `renderSettings`; move the default into a `beforeEach`).
- Delete every admin-management test (`adds a new admin email…`, `trims and lowercases…`, `does not re-add…`, `shows an error message when granting…`, `does not show a remove button…`).
- Keep the two delete-flow tests (`does nothing until the delete team confirmation…`, `deletes the team and navigates…`, `shows an error message when deleting…`) — they run as the default super-admin.
- Add:

```typescript
it('has no admin-management UI', () => {
  renderSettings(baseTeam, vi.fn());
  expect(screen.queryByLabelText('Add admin by email')).not.toBeInTheDocument();
  expect(screen.queryByText('Admins')).not.toBeInTheDocument();
});

it('saves edited team info', async () => {
  const updateSpy = vi.spyOn(teamsApi, 'updateTeamInfo').mockResolvedValue(undefined);
  const onTeamUpdated = vi.fn();
  renderSettings(baseTeam, onTeamUpdated);

  fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'U17 Elite' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save team info' }));

  await waitFor(() =>
    expect(updateSpy).toHaveBeenCalledWith('team-1', { name: 'U17 Elite', description: '', notes: '' })
  );
  expect(onTeamUpdated).toHaveBeenCalledWith(expect.objectContaining({ name: 'U17 Elite' }));
});

it('shows Delete team to a super-admin', () => {
  renderSettings(baseTeam, vi.fn());
  expect(screen.getByRole('button', { name: 'Delete team' })).toBeInTheDocument();
});

it('hides Delete team from a non-super-admin', () => {
  vi.mocked(useAuth).mockReturnValue(authValue());
  renderSettings(baseTeam, vi.fn());
  expect(screen.queryByRole('button', { name: 'Delete team' })).not.toBeInTheDocument();
});
```

(`baseTeam` needs `description: ''` and `notes: ''` — it already has `notes: ''`; add `description: ''` if missing.)

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/teams/TeamSettingsTab.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/teams/TeamSettingsTab.tsx`**

```typescript
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../auth/AuthContext';
import { deleteTeam, updateTeamInfo } from './teamsApi';
import type { Team } from '../types/team';

interface TeamSettingsTabProps {
  team: Team;
  onTeamUpdated: (team: Team) => void;
}

export function TeamSettingsTab({ team, onTeamUpdated }: TeamSettingsTabProps) {
  const navigate = useNavigate();
  const { access } = useAuth();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? '');
  const [notes, setNotes] = useState(team.notes ?? '');
  const [infoError, setInfoError] = useState<string | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSaveInfo(event: FormEvent) {
    event.preventDefault();
    setInfoError(null);
    setSavingInfo(true);
    const updates = { name: name.trim(), description: description.trim(), notes: notes.trim() };
    try {
      await updateTeamInfo(team.id, updates);
    } catch {
      setInfoError('Could not save team info. Please try again.');
      setSavingInfo(false);
      return;
    }
    onTeamUpdated({ ...team, ...updates });
    setSavingInfo(false);
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteTeam(team.id);
    } catch {
      setDeleteError('Could not delete the team. Please try again.');
      return;
    }
    navigate('/teams', { replace: true });
  }

  return (
    <div>
      <div className="divide-y divide-border rounded-lg border border-border bg-surface shadow-card">
        <form onSubmit={handleSaveInfo} className="p-4">
          <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">Team info</h2>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Team name
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Description
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Notes
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </label>
          </div>
          {infoError && <p role="alert" className="mt-3 text-sm text-red">{infoError}</p>}
          <Button variant="primary" size="sm" type="submit" className="mt-3 w-full sm:w-auto" disabled={savingInfo}>
            Save team info
          </Button>
        </form>

        {access?.isSuperAdmin && (
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Danger zone</h2>
              <p className="mt-1 text-sm text-slate">
                Deleting a team also removes its roster and every player's records.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete team
            </Button>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title={`Delete ${team.name}?`}
          message="This will permanently delete the team, its roster, and every player's records, including their physical test history. This cannot be undone."
          confirmLabel="Yes, delete team"
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
          error={deleteError}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/teams/TeamSettingsTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint, build, full test, commit**

```bash
npm run lint && npm run build && npm test
git add src/teams/TeamSettingsTab.tsx src/teams/TeamSettingsTab.test.tsx src/teams/teamsApi.ts src/teams/teamsApi.test.ts
git commit -m "feat(teams): Settings tab — team-info form replaces admin management; Delete is super-admin only"
```

---

## Task 12: `TeamsListPage` — gate Create/Import, empty-state copy

**Files:**
- Modify: `src/teams/TeamsListPage.tsx`, `src/teams/TeamsListPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `access` (Task 5).
- Produces: the **Import** and **Create team** buttons render only when `access?.isSuperAdmin`. The zero-team empty state reads `"No teams assigned yet — ask your club admin."` for a non-super-admin, and keeps the current copy for a super-admin.

- [ ] **Step 1: Update the test**

The `useAuth` mock is already `authValue`-based (Task 5 Step 6). Ensure the existing "opens the bulk-import dialog from the Import button" test and any Create-team test set `authValue({ appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' }, access: superAdminAccess })`. Add:

```typescript
it('hides Create team and Import from a member', async () => {
  vi.mocked(useAuth).mockReturnValue(authValue());
  vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue({ teams: [], lastDoc: null, hasMore: false });
  render(<MemoryRouter><TeamsListPage /></MemoryRouter>);
  await screen.findByText('No teams assigned yet — ask your club admin.');
  expect(screen.queryByRole('button', { name: 'Create team' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/teams/TeamsListPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Edit `src/teams/TeamsListPage.tsx`**

- `const { appUser, access } = useAuth();`
- The action-group `grid-cols` expression and the two `appUser?.role === 'admin'` checks → `access?.isSuperAdmin`.
- Empty-state block:

```tsx
<div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-slate shadow-card">
  {access?.isSuperAdmin ? 'No teams yet.' : 'No teams assigned yet — ask your club admin.'}
</div>
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/teams/TeamsListPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint, build, commit**

```bash
npm run lint && npm run build
git add src/teams/TeamsListPage.tsx src/teams/TeamsListPage.test.tsx
git commit -m "feat(teams): Create/Import gated to super-admin; member empty-state copy"
```

---

## Task 13: `TeamPage` — Calendar tab gated on trainings access

**Files:**
- Modify: `src/teams/TeamPage.tsx`, `src/teams/TeamPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `access` (Task 5).
- Produces: the Calendar `<Tab>` and its panel render only when `access?.sections.trainings`. If the current tab is `'calendar'` and access is lost, fall back to `'overview'`.

- [ ] **Step 1: Update the test**

`src/teams/TeamPage.test.tsx` — its `beforeEach` `useAuth` mock is already `authValue`-based (Task 5 Step 6); make its default `authValue({ appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' }, access: superAdminAccess })` so the existing tests that click "Calendar" keep working. Add:

```typescript
it('hides the Calendar tab when the user has no trainings access', async () => {
  vi.mocked(useAuth).mockReturnValue(authValue()); // member, no sections
  vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
  vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
  renderTeamPage();
  await screen.findByRole('heading', { name: 'U17 Boys' });
  expect(screen.queryByText('Calendar')).not.toBeInTheDocument();
});

it('shows the Calendar tab with trainings access', async () => {
  vi.mocked(useAuth).mockReturnValue(
    authValue({ access: { isSuperAdmin: false, sections: { exercises: false, trainings: true, guides: false } } })
  );
  vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
  vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
  renderTeamPage();
  expect(await screen.findByText('Calendar')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/teams/TeamPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Edit `src/teams/TeamPage.tsx`**

```tsx
import { useAuth } from '../auth/AuthContext';
// ...
const { firebaseUser, access } = useAuth();
const canCalendar = !!access?.sections.trainings;

// when computing which tab to show:
const activeTab = tab === 'calendar' && !canCalendar ? 'overview' : tab;

// in the <nav>:
{canCalendar && (
  <Tab active={activeTab === 'calendar'} onClick={() => setTab('calendar')}>Calendar</Tab>
)}

// in the panel switch: use `activeTab` instead of `tab`, and guard:
{activeTab === 'calendar' && canCalendar && <TeamCalendarTab teamId={teamId} />}
```

(Replace the existing `tab === 'overview'` / `tab === 'calendar'` / `tab === 'plan'` / `tab === 'settings'` checks with `activeTab === …`.)

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/teams/TeamPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint, build, commit**

```bash
npm run lint && npm run build
git add src/teams/TeamPage.tsx src/teams/TeamPage.test.tsx
git commit -m "feat(teams): Calendar tab requires trainings access"
```

---

## Task 14: Seed, migration script, docs

**Files:**
- Modify: `scripts/seed/seed.mjs`, `scripts/seed/README.md`, `docs/PRODUCTION-READINESS.md`
- Create: `scripts/migrate/2026-09-11-section-access.mjs`

**Interfaces:**
- Produces: `npm run seed:emulator` writes `sectionAccess/{exercises,trainings,guides}` and puts `--admin` in all three; a runnable, idempotent migration script for prod.

- [ ] **Step 1: Update `scripts/seed/seed.mjs`**

In the write batch, after the `adminAllowlist` line add:

```javascript
for (const section of ['exercises', 'trainings', 'guides']) {
  batch.set(db.doc(`sectionAccess/${section}`), {
    adminEmails: [args.admin],
    addedBy: 'seed-script',
    addedAt: now,
  });
}
```

In the `--reset` block (emulator), also delete the three `sectionAccess/*` docs.
Update the final `console.log` to mention `sectionAccess/*`.

- [ ] **Step 2: Write the migration script**

`scripts/migrate/2026-09-11-section-access.mjs`:

```javascript
// One-time: create sectionAccess/* docs, back-fill from existing admins,
// relabel user roles. Safe to re-run (idempotent set/merge).
// Usage: node scripts/migrate/2026-09-11-section-access.mjs --prod
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const isProd = process.argv.includes('--prod');
if (!isProd) { console.error('Pass --prod to run.'); process.exit(1); }

const key = JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const emails = new Set();

// existing global admins
const users = await db.collection('users').get();
let relabelled = 0;
const batch = db.batch();
for (const u of users.docs) {
  const role = u.data().role;
  if (role === 'admin') { emails.add(u.data().email); batch.update(u.ref, { role: 'superadmin' }); relabelled++; }
  else if (role === 'viewer') { batch.update(u.ref, { role: 'member' }); relabelled++; }
}

// existing team admins
const teams = await db.collection('teams').get();
for (const t of teams.docs) for (const e of (t.data().adminEmails ?? [])) emails.add(e);

const list = [...emails];
for (const section of ['exercises', 'trainings', 'guides']) {
  batch.set(db.doc(`sectionAccess/${section}`), { adminEmails: list, migratedAt: FieldValue.serverTimestamp() }, { merge: true });
}

await batch.commit();
console.log(`Done. sectionAccess/* created with ${list.length} email(s); ${relabelled} user doc(s) relabelled.`);
process.exit(0);
```

- [ ] **Step 3: Update docs**

`scripts/seed/README.md`: in the seeded-docs table add rows for `sectionAccess/{exercises,trainings,guides}` (`{ adminEmails: [<--admin>] }`).
`docs/PRODUCTION-READINESS.md`: add a checklist item — "Run `node scripts/migrate/2026-09-11-section-access.mjs --prod` after deploying the new `firestore.rules` and before shipping the new client (creates `sectionAccess/*`, back-fills existing admins, relabels `users.role`)."

- [ ] **Step 4: Smoke-test the seed on the emulator**

Run: `npm run emulator` (separate shell) then `npm run seed:emulator`
Expected: output mentions `sectionAccess/exercises/trainings/guides`; Emulator UI shows the three docs with the admin email.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed/seed.mjs scripts/seed/README.md scripts/migrate/2026-09-11-section-access.mjs docs/PRODUCTION-READINESS.md
git commit -m "chore(access): seed sectionAccess docs + one-time prod migration"
```

---

## Task 15: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Rules**

Run: `npm run test:rules`
Expected: PASS, all files.

- [ ] **Step 2: Unit + component**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 3: Lint + typecheck/build**

Run: `npm run lint && npm run build`
Expected: 0 errors.

- [ ] **Step 4: Manual smoke (emulator)**

Run: `npm run dev:emulator`. As the seeded super-admin: open `/admin/access`, grant a second email one team + Trainings, Save. Sign in as that email (email-link in the Auth emulator console): confirm Teams shows the one team, Trainings nav is present, Exercises/Guides/Access are hidden, the team's Calendar tab is visible, and `/admin/access` shows "You don't have access to this page."

- [ ] **Step 5: Commit any doc fixups and open the PR**

```bash
git add -A
git commit -m "docs: access-model rollout notes" --allow-empty
```

---

## Self-review notes

- **Spec §5 (rules)** → Tasks 1–2. Every helper and every path in the spec table is edited and covered by a rules test.
- **Spec §6.1 (guards)** → Task 6. **§6.2 (access context)** → Tasks 4–5. **§6.3 (nav)** → Task 7. **§6.4 (Access page)** → Tasks 8–9. **§6.5 (Settings/Calendar)** → Tasks 11, 13. **§6.6 (Teams list)** → Task 12.
- **Spec §7 (migration/seed)** → Task 14. **§8 (testing)** → folded into every task, plus Task 15.
- **§9 rollout order** — Task order follows it (rules → types/context → guards/nav → Access page → team edits → cleanup → migration). The migration script (Task 14) is written near the end but *run* against prod between merge and client ship, per the spec.
- The old "Task 14: fix remaining useAuth mocks" is absorbed into Task 5 Step 6 (the mock migration is unavoidable the moment `access` becomes a required context field).
- Known deviation from spec §4: no `firestore.indexes.json` change — `orderBy('name')` on a single field is auto-indexed by Firestore; add an entry only if the emulator demands one during Task 8/15.
- `authValue()` factory (Task 5) makes the ~15 `useAuth` mock migrations mechanical and consistent.
- Build-order hazard handled: `tsconfig` typechecks `tests/`, so changing `UserRole` (Task 3) and adding required `access` to the context (Task 5) both break test-file mocks. Task 3 Step 6 does the role-literal sweep; Task 5 Step 6 does the `authValue()` migration. Neither leaves a red build across a commit.
- Spec §6.5 said "keep Team info editing" but no such UI exists today — Task 11 builds the minimal form (wiring the already-present, unused `updateTeamInfo`) so a non-super-admin's Settings tab isn't empty after the Admins section is removed.
