# Club Platform — Plan 1: Multi-club Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every club's data under `clubs/{clubId}`, enforce club isolation, the tenant lifecycle and operator blindness in `firestore.rules`, and make the app run against an active club. The result works end to end in the emulator with two seeded clubs and a pending one.

**Architecture:** API modules build every path through one helper, `clubPaths.ts`, which reads a module-level active club id. `AuthProvider` sets that id after loading the person's memberships with a collection-group query on `members`. The rules gain a `clubs/{clubId}` block with shared helpers: `isMember`, `isClubAdmin`, a time-aware `isActive`, and `exporter`. Every existing rule moves inside that block with `superadmin` replaced by club admin. A pure `clubView()` function decides what a signed-in person sees: the app, the welcome page, the pending screen or the locked screen. `ClubGate` renders that decision inside `RequireAuth`.

**Tech Stack:** React 18 + TS + Vite, Firebase JS SDK 12 (Firestore with persistent cache, Auth email link), `@firebase/rules-unit-testing` + Firestore emulator, Vitest + Testing Library, firebase-admin for the seed scripts.

**Spec:** `docs/superpowers/specs/2026-10-20-volley-skills-club-platform-design.md`. This plan covers spec §3 and §5, the club-status part of §4, §8.1–8.3 and §8.5, the seed part of §9, and the matching part of §10.

**Programme (later plans, not in this one):**
- Plan 2: club area `/club` with Profile, People & access with roles, and Contract, plus the platform area `/platform`, the `clubs (status, createdAt)` index, and the UI gating of `aiEnabled` and `growthTestsEnabled`.
- Plan 3: legal content v1, sign-up, acceptance, specific approval and legal-version review (including its row in the spec §8.3 routing table), plus the public legal routes and SEO (§8.6). This is where the acceptance `create` and the club `create` rules land, after the `auth_time` emulator check in spec §11.
- Plan 4: export, the export action on the locked screen, the purge script, the migration script with rehearsal, and `vcb.schemaVersion`.

## Global Constraints

- **Spark plan, no Cloud Functions.** All authorization lives in `firestore.rules`, and every rules change is covered by a test in `tests/rules/`.
- **Lowercased emails.** Emails are stored and compared lowercased everywhere: member doc ids, `adminEmails`, `viewerEmails`, `ownerEmail`. The rules use `request.auth.token.email.lower()`, and the client lowercases `user.email` once in `AuthProvider`.
- **Club states:** `'pending' | 'active' | 'suspended' | 'terminating' | 'deleted'`. Allowed transitions:
  - pending → active | deleted
  - active → suspended | terminating
  - suspended → active | terminating
  - terminating → active
- **`retrievalEndsAt` ≥ `effectiveAt` + 30 days.** The rules enforce it (stricter than the spec's "UI enforces"; my call).
- **Operator blindness.** `isPlatformAdmin()` appears only in the rules for `platformAdmins`, `clubs/{clubId}` itself, `acceptances`, `statusLog` and `interestSignups`. It never appears inside teams, the library, config, `sectionAccess` or `members`.
- **Not a platform admin's signature.** The operator never signs for a club. That rule lands in Plan 3; this plan keeps acceptance writes at `false`.
- **Local storage keys.** The active club is stored under `vcb.activeClub`. Keep the `vcb.` prefix.
- **Existing conventions.** UI follows the design-system spec (tokens, `PageHeader`, `useNotify`, inline `role="alert"` errors). There is no third-party tracking.
- **Commit trailer.** Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Club-less URLs.** URLs carry no club id.

## Review Focus

1. **Mixed-case sign-in email.** A person signs in as `Coach@Example.com` while their member doc is `coach@example.com`. They must get in. Task 2 adds a rules test with a mixed-case token email, and Task 7 adds a context test that the query uses the lowercased email.
2. **Stale stored club.** `vcb.activeClub` points at a club the person was removed from, or one that was rejected. The app must fall back to another membership, or to the welcome page, and say so once. Task 7 tests `pickActiveClub` and Task 8 tests the notice.
3. **Status change while the app is open.** The operator suspends a club while a coach has it open. The open tab must switch to the locked screen without a reload. Task 7 adds a context test that `club` follows the live snapshot, and Task 8 adds a `ClubGate` re-render test.
4. **The exact boundary instant.** At `now == effectiveAt` the app and the rules must agree that full use has ended, because the rules use `request.time < effectiveAt`. Task 8 tests `clubView` at `effectiveAt` and at `retrievalEndsAt`, and Task 5 tests the lifecycle before and after each.
5. **Removing the club's owner.** A club admin removes the club's `ownerEmail` (or the last admin) in Access. The rules forbid deleting the owner's member doc, so the UI must not attempt it and must not fail half-way. Task 10 tests that `removeAllGrants` keeps admin member docs, and Task 2 tests that the rules refuse owner deletion and demotion.

---

### Task 1: Club types and the path helper

**Files:**
- Create: `src/types/club.ts`
- Create: `src/firebase/clubPaths.ts`
- Test: `src/firebase/clubPaths.test.ts`
- Modify: `tests/setupTests.ts` (set active club `club-1` for every unit test)

**Interfaces:**
- Produces, in `src/types/club.ts`:
  ```ts
  export type ClubStatus = 'pending' | 'active' | 'suspended' | 'terminating' | 'deleted';
  export type MemberRole = 'admin' | 'member';
  export type ClubLocale = 'en' | 'it';
  export interface ClubTermination {
    requestedAt: Timestamp | null; requestedBy: string | null;
    effectiveAt: Timestamp | null; retrievalEndsAt: Timestamp | null;
  }
  export interface ClubLegal { versionKey: string; acceptedAt: Timestamp; acceptedBy: string }
  export interface Club {
    id: string; name: string; country: string; locale: ClubLocale; ownerEmail: string;
    aiEnabled: boolean; referenceOptOut: boolean; growthTestsEnabled: boolean;
    createdAt: Timestamp; status: ClubStatus; statusReason: string | null;
    statusChangedAt: Timestamp | null; statusChangedBy: string | null; lastStatusLogId: string | null;
    legal: ClubLegal | null; termination: ClubTermination; billing: null;
  }
  export interface Member { email: string; clubId: string; role: MemberRole; addedBy: string; addedAt: Timestamp }
  export interface Membership { clubId: string; role: MemberRole; clubName: string; status: ClubStatus }
  ```
  `Timestamp` is imported as a type from `firebase/firestore`.
- Produces, in `src/firebase/clubPaths.ts`:
  - `setActiveClubId(id: string | null): void`
  - `getActiveClubId(): string`, which throws `Error('No active club')` when unset
  - `clubCol(...segments: string[]): CollectionReference`, which builds `collection(db, 'clubs', id, ...segments)`
  - `clubDoc(...segments: string[]): DocumentReference`, which builds `doc(db, 'clubs', id, ...segments)`. With no segments it returns the club doc itself.

- [ ] **Step 1: Write the failing tests** in `src/firebase/clubPaths.test.ts`. Mock `firebase/firestore` (`collection`, `doc` as `vi.fn((...args) => ({ args }))`) and `./config` (`db: {}`), as the API tests do.
  - `it('builds collection paths under the active club')`: after `setActiveClubId('c-9')`, `clubCol('teams', 't-1', 'players')` returns args `[{}, 'clubs', 'c-9', 'teams', 't-1', 'players']`.
  - `it('builds the club doc itself with no segments')`: `clubDoc()` gives args `[{}, 'clubs', 'c-9']`.
  - `it('throws without an active club')`: after `setActiveClubId(null)`, `clubCol('teams')` throws `'No active club'`.
- [ ] **Step 2: Run** `npx vitest run src/firebase/clubPaths.test.ts`. Expected: FAIL, because the module is not found.
- [ ] **Step 3: Implement** `src/types/club.ts` and `src/firebase/clubPaths.ts` per the Interfaces above. Then add `setActiveClubId('club-1')` to `tests/setupTests.ts`, inside a `beforeEach`, so a test that clears it cannot leak into the next.
- [ ] **Step 4: Run** `npx vitest run src/firebase/clubPaths.test.ts`, then `npm test`. Expected: PASS, and the full suite is still green because nothing uses the helper yet.
- [ ] **Step 5: Commit** `feat(clubs): club types and club-scoped path helper`.

---

### Task 2: Rules — club core (club doc, members, status log, acceptances)

Add a new `match /clubs/{clubId}` block **alongside** today's top-level rules; Task 5 removes those. Every task stays green this way.

**Files:**
- Modify: `firestore.rules`
- Modify: `tests/rules/testEnv.ts` (fixtures)
- Modify: `vitest.rules.config.ts`: add `hookTimeout: 30000`. Seeding grows, and the matches suite already timed out once in `beforeEach` at the 10 s default.
- Create: `tests/rules/members.rules.test.ts`, `tests/rules/clubDoc.rules.test.ts`, `tests/rules/acceptances.rules.test.ts`

**Interfaces:**
- Produces, in `tests/rules/testEnv.ts`, the fixtures every later rules task uses:
  ```ts
  export interface SeedClubOptions {
    id: string;
    status?: ClubStatus;               // default 'active'
    admins?: string[];                 // member docs with role 'admin'
    members?: string[];                // member docs with role 'member'
    ownerEmail?: string;               // default admins[0] ?? 'owner@example.com'
    termination?: { effectiveAt: Date | null; retrievalEndsAt: Date | null; requestedAt?: Date | null; requestedBy?: string | null };
    sections?: Partial<Record<'exercises' | 'trainings' | 'guides', string[]>>; // sectionAccess docs; all three are always written, default []
  }
  export async function seedClub(env: RulesTestEnvironment, opts: SeedClubOptions): Promise<void>;
  export async function seedPlatformAdmin(env: RulesTestEnvironment, email: string): Promise<void>;
  export function dbAs(env: RulesTestEnvironment, email: string): Firestore; // authenticatedContext(`uid-${email}`, { email }).firestore()
  export const OPERATOR = 'operator@example.com';
  ```
  `seedClub` writes a full club doc with the shape of Task 1's `Club`, with `termination` always a map whose missing fields are `null`. It writes member docs with the fields `{ email, clubId, role, addedBy: 'seed', addedAt }` and the three `sectionAccess` docs.
- Produces, in `firestore.rules`:
  - top-level `email()` (lowercased token email)
  - `isPlatformAdmin()`
  - inside the clubs match: `club()`, `isMember()`, `isClubAdmin()`, `isActive()`, `activeMember()`, `activeAdmin()`, `exporter()`, `changed()`, `inSection(s)`, `canReadExercises()`, `canWriteExercises()`, `canTrainings()`, `canGuides()`

  Tasks 3 and 4 use the club-scoped helpers.

- [ ] **Step 1: Write the fixtures** in `testEnv.ts` and add `hookTimeout: 30000` to `vitest.rules.config.ts`.
- [ ] **Step 2: Write the failing tests.** Each file clears Firestore in `beforeEach` and seeds through `seedClub`. Club `club-a` has admin `admin-a@example.com`, owner `admin-a@example.com` and member `coach-a@example.com`.

  `members.rules.test.ts`:
  - `reads its own member docs across clubs with a collection-group query`: `coach-a` runs `collectionGroup('members').where('email','==','coach-a@example.com')` and succeeds. The same query with `admin-a@example.com` fails.
  - `matches a mixed-case sign-in email to the lowercased member doc`: `dbAs(env, 'Coach-A@Example.com')` can `get` `clubs/club-a`.
  - `lets members of an active club list the club's members; outsiders cannot`
  - `lets an active club admin add a member with a valid shape`: a set of `{ email:'new@example.com', clubId:'club-a', role:'member', addedBy:'admin-a@example.com', addedAt: serverTimestamp() }` at `members/new@example.com` succeeds. Each of these fails:
    - a doc id that differs from `email`
    - an upper-case id
    - `clubId: 'club-b'`
    - `role: 'owner'`
    - an extra key
    - `addedBy` set to someone else
  - `refuses member writes from a plain member, including self-promotion`: `coach-a` updating their own role to `admin` fails.
  - `lets an admin change only the role, never demote or delete the owner`: updating `coach-a` to `admin` succeeds. Updating `admin-a`'s role to `member` fails, and so does deleting it.
  - `refuses member writes when the club is not active`: run the add-member case with `status: 'suspended'` and with `status: 'pending'`. Both fail.

  `clubDoc.rules.test.ts`. Seed `seedPlatformAdmin(env, OPERATOR)`. Each status change writes the club update and `statusLog/{id}` in one batch from `dbAs(env, OPERATOR)`:
  - `lets a member and the platform admin get the club; others cannot`
  - `lets only the platform admin list clubs`
  - `allows every transition in the table and refuses the rest`. This is a table-driven `it.each` over all 20 ordered pairs of the five states. The allowed pairs succeed and the rest fail. Each batch sets these fields:
    - `status`
    - `statusReason: 'r'`
    - `statusChangedAt: serverTimestamp()`
    - `statusChangedBy: OPERATOR`
    - `lastStatusLogId: 'log-1'`
    - termination dates when the target is `terminating`

    It also writes `statusLog/log-1` as `{ from, to, reason:'r', by: OPERATOR, at: serverTimestamp() }`.
  - `refuses a status change without its statusLog entry in the same batch`
  - `refuses a statusLog whose from/to do not match the club change`
  - `refuses suspending without a reason`
  - `refuses terminating with retrievalEndsAt under 30 days after effectiveAt`. The test uses 29 days. A second case at exactly 30 days succeeds.
  - `refuses the platform admin changing profile, legal or owner fields`. This covers `name`, `legal`, `ownerEmail` and `aiEnabled`.
  - `lets an active club admin edit the profile`:
    - `name`, `country: 'IT'`, `locale: 'it'`, `aiEnabled`, `referenceOptOut` and `growthTestsEnabled` succeed.
    - `name: 'X'` (too short) fails.
    - `country: 'ita'` fails.
    - `locale: 'fr'` fails.
    - `status: 'active'` (a status field) fails.
  - `lets a pending club's admin edit the profile; a suspended club's admin cannot`
  - `lets an admin transfer ownership only to another admin member`
  - `lets a club admin request termination while active or suspended`. A `termination` with `requestedAt: serverTimestamp()` and `requestedBy` set to their own email succeeds. Setting `effectiveAt` fails, and so does a request while `terminating`.
  - `refuses a plain member any club update`
  - `refuses creating or deleting a club doc from the client`

  `acceptances.rules.test.ts`. Seed `clubs/club-a/acceptances/terms-x_dpa-x` with rules disabled:
  - `lets club admins and the platform admin read acceptances; members cannot`
  - `refuses every client create, update and delete, including for club admins and the platform admin`
- [ ] **Step 3: Run** `npm run test:rules`. Expected: the three new files FAIL with permission denied. The existing files still pass.
- [ ] **Step 4: Implement the rules.** Add these at the top of `match /databases/{database}/documents`:
  ```
  function signedIn()        { return request.auth != null; }
  function email()           { return request.auth.token.email.lower(); }
  function isPlatformAdmin() { return signedIn() && exists(/databases/$(database)/documents/platformAdmins/$(email())); }

  match /platformAdmins/{e} { allow get: if signedIn() && e == email(); allow list, write: if false; }
  match /{path=**}/members/{e} { allow read: if signedIn() && resource.data.email == email(); }
  ```
  Then add a `match /clubs/{clubId}` block containing:
  - **Helpers:**
    - `club()`, `isMember()`, `isClubAdmin()` and `isActive()`, as in spec §5.
    - `activeMember()` and `activeAdmin()`.
    - `exporter()`, exactly as in spec §5.
    - `changed()`, which is `request.resource.data.diff(resource.data).affectedKeys()`.
    - `inSection(s)`, which is `email() in get(…/clubs/$(clubId)/sectionAccess/$(s)).data.adminEmails`.
    - The four `can*` section helpers, with `isSuperAdmin()` replaced by `isClubAdmin()`.
  - **Club doc:**
    - `get` is allowed for `isMember() || isPlatformAdmin()`; `list` only for `isPlatformAdmin()`.
    - `create, delete: if false`. The comment says the sign-up create arrives in Plan 3.
    - `update` is allowed for `platformStatusChange() || clubAdminProfileChange() || terminationRequest()`.
  - **The three update functions.** The truth table is in the tests above; these are the non-obvious parts:
    - **`platformStatusChange()`:**
      - `changed().hasOnly(['status','statusReason','statusChangedAt','statusChangedBy','lastStatusLogId','termination'])`.
      - A `transitionAllowed(from, to)` per Global Constraints.
      - `statusChangedAt == request.time` and `statusChangedBy == email()`.
      - `statusReason` is null or a string ≤ 300, and a non-empty string when the new status is `suspended`.
      - `existsAfter(…/statusLog/$(next.lastStatusLogId))`.
      - `termination.requestedAt` and `requestedBy` are unchanged.
      - When the new status is `terminating`: `effectiveAt is timestamp && retrievalEndsAt >= effectiveAt + duration.value(30, 'd')`.
      - `billing` is deliberately absent and comes with payments.
    - **`clubAdminProfileChange()`:**
      - `isClubAdmin() && (isActive() || resource.data.status == 'pending')`.
      - `changed().hasOnly(['name','country','locale','aiEnabled','referenceOptOut','growthTestsEnabled','ownerEmail'])`.
      - `name` is a string of 2–80 characters, and `country.matches('^[A-Z]{2}$')`.
      - `locale in ['en','it']`, and the three booleans are `is bool`.
      - `ownerEmail` is unchanged, or `get(…/members/$(next.ownerEmail)).data.role == 'admin'`.
      - `legal` is not editable until Plan 3.
    - **`terminationRequest()`:**
      - `isClubAdmin() && resource.data.status in ['active','suspended'] && changed().hasOnly(['termination'])`.
      - Within the termination map, only `requestedAt` and `requestedBy` change: `requestedAt == request.time`, `requestedBy == email()`.
  - **Subcollections:**
    - `match /members/{e}`:
      - `read` is allowed for `activeMember() || exporter() || (isMember() && club().status == 'pending')`.
      - `create` requires `activeAdmin()`, the `validMember()` shape, `addedBy == email()` and `addedAt == request.time`.
      - `update` requires `activeAdmin() && changed().hasOnly(['role']) && role in ['admin','member'] && (e != club().ownerEmail || role == 'admin')`.
      - `delete` requires `activeAdmin() && e != club().ownerEmail`.
      - `validMember()` checks:
        - keys `hasOnly(['email','clubId','role','addedBy','addedAt'])`
        - `email == e && e == e.lower()`
        - `clubId == clubId` (the path variable)
        - `role in ['admin','member']`
    - `match /statusLog/{id}`:
      - `read` is allowed for `isClubAdmin() || isPlatformAdmin()`.
      - `create` requires `isPlatformAdmin()`, keys `hasOnly(['from','to','reason','by','at'])`, `from == club().status` (`get` sees the pre-batch state), `to == getAfter(…/clubs/$(clubId)).data.status`, `by == email()` and `at == request.time`.
      - `update, delete: if false`.
    - `match /acceptances/{v}`: `read` is allowed for `isClubAdmin() || isPlatformAdmin()`, and `write: if false`. The comment says create arrives in Plan 3.
- [ ] **Step 5: Run** `npm run test:rules`. Expected: all files PASS, old and new.
- [ ] **Step 6: Commit** `feat(rules): clubs root with members, lifecycle transitions, status log and acceptances`.

---

### Task 3: Rules — team subtree under clubs

**Files:**
- Modify: `firestore.rules` (inside `match /clubs/{clubId}`)
- Modify, moving to club paths: `tests/rules/teams.rules.test.ts`, `players.rules.test.ts`, `physicalTests.rules.test.ts`, `calendar.rules.test.ts`, `testingSessions.rules.test.ts`, `matches.rules.test.ts`, `awards.rules.test.ts`, and the team/player cases of `bulkImport.rules.test.ts`

**Interfaces:**
- Consumes: Task 2's helpers and fixtures.
- Produces: `teamAdmin()` defined once inside `match /teams/{teamId}`:
  ```
  function teamAdmin() { return isClubAdmin()
    || email() in get(/databases/$(database)/documents/clubs/$(clubId)/teams/$(teamId)).data.adminEmails; }
  ```

- [ ] **Step 1: Move the tests.** In each listed file:
  - Replace the `adminAllowlist/super@example.com` + `users/*` seeding with `seedClub(env, { id: 'club-a', admins: ['super@example.com'], members: [<every email the file signs in as that should belong to the club>] })` — emails a test treats as outsiders stay non-members.
  - Prefix every path with `clubs/club-a/`.
  - Rename "super-admin" in test names to "club admin".
  - Use `dbAs(env, email)`.

  Keep every existing assertion. Add one case per file:
  - `teams`: `denies a team admin who is not a member of the club`. Their email is in `adminEmails` but has no member doc.
  - `players`: `denies a viewer listed in viewerEmails who is not a club member`.
  - `matches`: `refuses scouting writes once the club is suspended`. Event create fails after `status: 'suspended'`.
- [ ] **Step 2: Run** `npm run test:rules`. Expected: the moved files FAIL with permission denied; the other files pass.
- [ ] **Step 3: Implement.** Copy the `teams` match tree inside `match /clubs/{clubId}`. Delete the eight local `isTeamAdmin()` copies and use the single `teamAdmin()`. Rewrite each rule per this table, keeping every existing shape check:

  | Old condition | New condition |
  |---|---|
  | read: `C` | `(activeMember() && C') \|\| exporter()` |
  | create / update / delete: `C` | `activeMember() && C'` |

  `C'` is `C` with three substitutions:
  - `isSuperAdmin()` becomes `isClubAdmin()`
  - `isTeamAdmin()` becomes `teamAdmin()`
  - `request.auth.token.email` becomes `email()`

  All doc paths change to `…/clubs/$(clubId)/teams/…`. Leave the top-level `teams` block in place until Task 5.
- [ ] **Step 4: Run** `npm run test:rules`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(rules): team subtree under clubs with lifecycle gating`.

---

### Task 4: Rules — library, guides and section access under clubs

**Files:**
- Modify: `firestore.rules`
- Modify, moving to club paths: `tests/rules/exercises.rules.test.ts`, `diagrams.rules.test.ts`, `trainings.rules.test.ts`, `skillGuide.rules.test.ts`, `physicalTestGuide.rules.test.ts`, `sectionAccess.rules.test.ts`, and the library cases of `bulkImport.rules.test.ts`

**Interfaces:**
- Consumes: Task 2's helpers.
- Path renames: `skillGuide/config` → `clubs/{id}/config/skillGuide`; `physicalTestGuide/config` → `clubs/{id}/config/physicalTestGuide`. `counters/{id}`, `exercises/**`, `trainings/{id}` and `sectionAccess/{s}` keep their names under the club.

- [ ] **Step 1: Move the tests** the way Task 3 did, using `seedClub`'s `sections` option instead of raw `sectionAccess` writes. Add two cases:
  - `sectionAccess`: `refuses a sectionAccess write with extra keys`. `{ adminEmails: [], note: 'x' }` fails.
  - `skillGuide`: `refuses reading the guide to a signed-in non-member`. Today any signed-in user can read it.
- [ ] **Step 2: Run** `npm run test:rules`. Expected: the moved files FAIL.
- [ ] **Step 3: Implement** the `exercises` (with `diagrams`), `trainings`, `counters`, `config/{doc}` and `sectionAccess/{s}` matches inside the clubs block, applying Task 3's table.
  - **`config/{doc}`:**
    - `read` requires `doc in ['skillGuide','physicalTestGuide']`, and either `activeMember()` or `exporter()`.
    - `write` requires `activeMember() && canGuides() && doc in […]`.
  - **`sectionAccess`:**
    - `read` is allowed for `(activeMember() && (isClubAdmin() || email() in resource.data.adminEmails)) || exporter()`.
    - `write` requires `activeAdmin()`, `adminEmails is list` and `keys().hasOnly(['adminEmails'])`.
- [ ] **Step 4: Run** `npm run test:rules`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(rules): exercise/training library, guides and section access under clubs`.

---

### Task 5: Rules — retire the top-level model; isolation, lifecycle and operator tests

**Files:**
- Modify: `firestore.rules`:
  - Delete the top-level `adminAllowlist`, `sectionAccess`, `skillGuide`, `physicalTestGuide`, `exercises`, `trainings`, `counters` and `teams` matches, and the top-level `isSuperAdmin`, `inSection` and `can*` functions. The default deny covers the grace period in spec §9 step 6.
  - Rewrite `users/{uid}` and `interestSignups`.
- Modify: `tests/rules/users.rules.test.ts`, `interestSignups.rules.test.ts`, `smoke.test.ts`
- Create: `tests/rules/crossClub.rules.test.ts`, `lifecycle.rules.test.ts`, `platformAdmin.rules.test.ts`
- Modify: `firestore.indexes.json`. Add a `fieldOverrides` entry for `members.email` with both `COLLECTION` and `COLLECTION_GROUP` ascending indexes.

**Interfaces:**
- Produces:
  - `users/{uid}` accepts creates of exactly `{ email, createdAt }`, where `email == email()` and `createdAt == request.time`. There is no `role` field. Task 7's `ensureUserDoc` relies on this.
  - `interestSignups` allows read, update and delete for `isPlatformAdmin()` only, and keeps its create shape.

- [ ] **Step 1: Write the failing tests.**

  `crossClub.rules.test.ts`:
  - **Setup.** Seed `club-a` (admin `admin-a`, member `coach-a`) and `club-b` (admin `admin-b`). Under rules disabled, give `club-b` one doc at every path below. Its team `team-b` lists `coach-a@example.com` in `adminEmails`, and its sectionAccess lists `coach-a` in all three sections.
  - **Paths:**
    - `clubs/club-b`
    - `members/admin-b@example.com`
    - `acceptances/v1`
    - `statusLog/l1`
    - `teams/team-b`
    - `teams/team-b/players/p1`
    - `players/p1/physicalTests/t1`
    - `teams/team-b/calendar/s1`
    - `teams/team-b/testingSessions/ts1`
    - `testingSessions/ts1/entries/e1`
    - `teams/team-b/matches/m1`
    - `matches/m1/events/ev1`
    - `teams/team-b/awards/season`
    - `teams/team-b/scoutProfile/usage`
    - `exercises/x1`
    - `exercises/x1/diagrams/d1`
    - `trainings/tr1`
    - `counters/trainings`
    - `config/skillGuide`
    - `config/physicalTestGuide`
    - `sectionAccess/exercises`
  - **The matrix.** `it.each` over `admin-a@example.com` and `coach-a@example.com` crossed with every path. `get` fails, a `set` of `{ x: 1 }` (merge) fails, and `delete` fails.
  - `denies listing club-b collections from club-a`: `teams`, `exercises`, `trainings` and `members` list queries fail.
  - `denies a club-a admin adding themselves as a club-b member`

  `lifecycle.rules.test.ts`. Table-driven over the state, with `admin@example.com` (admin) and `coach@example.com` (member and team admin of `team-1`). The probes are:
  - read `teams/team-1`
  - write `teams/team-1` `{ name }`
  - read `config/skillGuide`
  - read `members`

  | State | Coach (member) | Admin |
  |---|---|---|
  | `pending` | reads members only; no team or guide reads; no writes | same as the coach |
  | `active` | everything | everything |
  | `suspended` | nothing | reads everything; no writes |
  | `terminating`, `effectiveAt` = now + 1 day | everything | everything |
  | `terminating`, `effectiveAt` = now − 1 day, `retrievalEndsAt` = now + 29 days | nothing | reads only |
  | `terminating`, `retrievalEndsAt` = now − 1 day | nothing | nothing |
  | `deleted` | nothing | nothing |

  Club-doc `get` stays allowed for members in every state, so the app can show the status screen.

  `platformAdmin.rules.test.ts`. The operator is not a member of `club-a`:
  - `cannot read anything inside a club`: every path from the cross-club list except `clubs/club-a`, `acceptances` and `statusLog` fails for `OPERATOR`.
  - `cannot list members or run the members collection-group query for another email`
  - `can read its own platformAdmins doc only; nobody can write platformAdmins`
  - `reads and updates interestSignups; a club admin cannot`
  - `reads club data only through membership when it is also a member`: seed `club-a` with `members: [OPERATOR]` and team `team-1` listing `OPERATOR`. A team read succeeds.

  `users.rules.test.ts`: replace the role cases:
  - `creates its own user doc with email and createdAt only`
  - `refuses a role field`
  - `refuses another uid`
  - `refuses updates`

  `interestSignups.rules.test.ts`: the superadmin cases become platform-admin cases. Add `denies a club admin reading sign-ups`.
- [ ] **Step 2: Run** `npm run test:rules`. Expected: the new and changed files FAIL.
- [ ] **Step 3: Implement.** Delete the top-level blocks listed under Files, rewrite `users` and `interestSignups`, and add the index override.
- [ ] **Step 4: Run** `npm run test:rules`. Expected: all PASS. Then `grep -n "isPlatformAdmin()" firestore.rules`. Expected: hits only in the function definition, the `clubs/{clubId}` doc rules, `statusLog`, `acceptances` and `interestSignups`. This is the anti-goal check from Global Constraints.
- [ ] **Step 5: Commit** `feat(rules): drop the single-club model; cross-club, lifecycle and operator isolation tests`.

---

### Task 6: API modules on club paths

**Files:**
- Modify: every path built with `collection(db, …)`, `doc(db, …)` or `doc(collection(db, …))` in these files moves to `clubCol(…)` / `clubDoc(…)` / `doc(clubCol(…))`:
  - `src/access/accessApi.ts`
  - `src/auth/access.ts`
  - `src/awards/awardsApi.ts`
  - `src/calendar/calendarApi.ts`
  - `src/diagrams/diagramsApi.ts`
  - `src/exercises/exercisesApi.ts`
  - `src/matches/matchesApi.ts`
  - `src/physicalSessions/testingSessionsApi.ts`
  - `src/physicalTestGuide/physicalTestGuideApi.ts` (now `clubDoc('config', 'physicalTestGuide')`)
  - `src/players/physicalTestsApi.ts`
  - `src/players/playerFootprintApi.ts`
  - `src/players/playersApi.ts`
  - `src/skillGuide/skillGuideApi.ts` (now `clubDoc('config', 'skillGuide')`)
  - `src/teams/teamExportApi.ts`
  - `src/teams/teamsApi.ts`
  - `src/trainings/trainingsApi.ts`
- Unchanged: `users`, `interestSignups`, `writeBatch(db)` and `runTransaction(db)`.
- Modify: the unit tests that assert paths:
  - `src/calendar/calendarApi.test.ts`
  - `src/physicalSessions/testingSessionsApi.test.ts`
  - `src/players/physicalTestsApi.test.ts`
  - the other test files that `grep -rln "'teams'\|'exercises'\|'trainings'\|'skillGuide'\|'physicalTestGuide'\|'sectionAccess'\|'counters'" src --include=*.test.*` lists

**Interfaces:**
- Consumes: `clubCol` and `clubDoc` from Task 1. The active club is `club-1` in unit tests.
- Produces: no signature changes; every exported API function keeps its signature.

- [ ] **Step 1: Update the path assertions first.** In each test above, `({}, 'teams', 'team-1', …)` becomes `({}, 'clubs', 'club-1', 'teams', 'team-1', …)`, and guide paths become `({}, 'clubs', 'club-1', 'config', 'skillGuide')`.
- [ ] **Step 2: Run** `npm test`. Expected: those assertions FAIL.
- [ ] **Step 3: Implement.** Swap each path in the listed modules. Local helpers such as `matchesCol` and the `sub(...)` closures in `teamsApi.deleteTeam` and `teamExportApi` call `clubCol` and `clubDoc`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS. Then run the same `grep` as in the Files list, restricted to `"(db, '(teams|exercises|trainings|counters|sectionAccess|skillGuide|physicalTestGuide)'"` across `src`. Expected: no hits outside tests.
- [ ] **Step 5: Commit** `refactor(api): build every club path through clubPaths`.

---

### Task 7: Auth context — memberships, active club, platform admin, club-admin access

**Files:**
- Create: `src/clubs/clubsApi.ts`, `src/clubs/clubsApi.test.ts`
- Create: `src/clubs/activeClub.ts`, `src/clubs/activeClub.test.ts`
- Modify: `src/auth/usersApi.ts` (+ test), `src/types/auth.ts`, `src/auth/access.ts` (+ test), `src/auth/AuthContext.tsx` (+ test), `src/test/authValue.ts`
- Rename: `src/auth/RequireSuperAdmin.tsx` → `src/auth/RequireClubAdmin.tsx`, plus `src/App.tsx` and `src/auth/guards.test.tsx`
- Modify: every `isSuperAdmin` / `superAdminAccess` consumer (`grep -rln "isSuperAdmin\|superAdminAccess" src`), including:
  - `src/layout/AppShell.tsx`
  - `src/settings/SettingsPage.tsx`
  - `src/teams/teamAccess.ts`
  - `src/teams/TeamSettingsTab.tsx`
  - `src/teams/TeamsListPage.tsx`
  - `src/home/HomePage.tsx`
  - 18 test files

**Interfaces:**
- Consumes: Task 1's types and `setActiveClubId`; Task 5's `users` rule.
- Produces:
  - `src/types/auth.ts`: `AppUser = { uid: string; email: string }`. `UserRole` is deleted.
  - **`src/clubs/clubsApi.ts`:**
    - `listMyMemberships(email: string): Promise<Membership[]>` runs the collection-group query `members where email == email`, then a `getDoc(doc(db,'clubs',clubId))` per hit. Clubs that fail to load are skipped.
    - `probePlatformAdmin(email: string): Promise<boolean>`: `getDoc(platformAdmins/{email})` reports whether the doc exists. A `permission-denied` error returns `false`.
    - `subscribeClub(clubId: string, onClub: (c: Club | null) => void): Unsubscribe` uses `onSnapshot`. An error or a missing doc calls `onClub(null)`.
  - **`src/clubs/activeClub.ts`:**
    - `ACTIVE_CLUB_KEY = 'vcb.activeClub'`
    - `pickActiveClub(memberships: Membership[], stored: string | null): { clubId: string | null; dropped: boolean }`:
      - Ignore memberships whose status is `deleted`.
      - Prefer `stored` if it is still usable; otherwise take the first usable membership by `clubName` with `localeCompare`.
      - `dropped` is `stored !== null && stored !== clubId`.
    - `readStoredClub(): string | null` and `storeClub(id: string | null): void`, both with try/catch around `localStorage`.
  - **`src/auth/access.ts`:**
    - `Access = { isClubAdmin: boolean; sections: Record<SectionKey, boolean> }`
    - `resolveAccess(role: MemberRole): Promise<Access>`. An admin gets every section without probing. A member probes `getDoc(clubDoc('sectionAccess', s))` as today.
  - **`src/auth/AuthContext.tsx`:** `AuthContextValue` gains these fields:
    - `memberships: Membership[]`
    - `activeClubId: string | null`
    - `club: Club | null`
    - `role: MemberRole | null`
    - `isPlatformAdmin: boolean`
    - `droppedClub: boolean`
    - `switchClub(clubId: string): void`, which calls `storeClub(id)` and then `window.location.reload()`
  - **`usersApi.ts`:** `ensureUserDoc(uid, email): Promise<AppUser>`. If the doc is missing it calls `setDoc(users/{uid}, { email, createdAt: serverTimestamp() })`. There is no role and no superadmin attempt.
  - **`src/test/authValue.ts`:**
    - Exports `clubAdminAccess` (renamed from `superAdminAccess`) and `testClub(over?: Partial<Club>): Club` (an active club `club-1` named `Test Club`).
    - `authValue()` now defaults to: `memberships: [{ clubId:'club-1', role:'member', clubName:'Test Club', status:'active' }]`, `activeClubId: 'club-1'`, `club: testClub()`, `role: 'member'`, `isPlatformAdmin: false`, `droppedClub: false`, `switchClub: vi.fn()`.

- [ ] **Step 1: Write the failing tests.**
  - **`activeClub.test.ts`:**
    - `keeps a stored club that is still a membership`
    - `falls back to the first club by name when the stored one is gone, and reports dropped`
    - `ignores memberships in deleted clubs`
    - `returns null when there are no usable memberships`: `dropped` is true if something was stored and false if nothing was.
  - **`clubsApi.test.ts`** (mocked Firestore, as in the API tests):
    - `queries members by email across clubs and loads each club`: asserts `collectionGroup(db,'members')` and `where('email','==','a@b.c')`.
    - `skips a club that cannot be read`
    - `treats a denied platformAdmins probe as not an admin`
  - **`access.test.ts`:**
    - `gives a club admin every section without probing`
    - `probes the three sections under the active club for a member`
  - **`usersApi.test.ts`:** `creates the user doc with email and createdAt only`. This replaces the superadmin/fallback cases.
  - **`AuthContext.test.tsx`:**
    - `lowercases the email before loading memberships`
    - `sets the active club id for the API layer`: asserts `setActiveClubId('club-a')`.
    - `follows live club updates`: the mocked `subscribeClub` callback fires with `status: 'suspended'`, and the context `club.status` updates.
    - `has no active club and no access when the person has no memberships`
    - `exposes isPlatformAdmin`
- [ ] **Step 2: Run** `npx vitest run src/clubs src/auth`. Expected: FAIL.
- [ ] **Step 3: Implement.** The `AuthProvider` sign-in sequence:
  1. Lowercase the email.
  2. Call `ensureUserDoc`.
  3. Run `Promise.all([listMyMemberships, probePlatformAdmin])`.
  4. Call `pickActiveClub(memberships, readStoredClub())`, then `storeClub(clubId)` and `setActiveClubId(clubId)`.
  5. Set `access = clubId ? await resolveAccess(role) : null`.
  6. Call `subscribeClub(clubId, setClub)`. Unsubscribe on sign-out and on the next auth change.

  `loading` stays true until the first club snapshot arrives, or until there is no club. Then do the mechanical renames across consumers:
  - `isSuperAdmin` → `isClubAdmin`
  - `superAdminAccess` → `clubAdminAccess`
  - `RequireSuperAdmin` → `RequireClubAdmin`

  The comment in `teamAccess.ts` becomes "listed in adminEmails, or a club admin".
- [ ] **Step 4: Run** `npm test` and `npm run build`. Expected: PASS. TypeScript catches any missed rename.
- [ ] **Step 5: Commit** `feat(auth): club memberships, active club and club-admin access`.

---

### Task 8: Club gate — welcome, pending, locked, ending, switcher

**Files:**
- Create: `src/clubs/clubView.ts` (+ test)
- Create: `src/clubs/ClubGate.tsx` (+ test)
- Create: `src/clubs/WelcomePage.tsx`
- Create: `src/clubs/ClubStatusScreen.tsx`
- Create: `src/clubs/ContractEndingBanner.tsx`
- Modify: `src/auth/RequireAuth.tsx`: after the auth checks, render `<ClubGate>{children}</ClubGate>`
- Modify: `src/layout/AppShell.tsx`: the banner, the dropped-club notice and the switcher items in the account menu
- Modify: `src/components/NotFoundState.tsx` (the other-club hint)
- Test: `src/auth/RequireAuth.test.tsx`, `src/layout/AppShell.test.tsx`, `src/components/NotFoundState.test.tsx` (create or extend)

**Interfaces:**
- Consumes: Task 7's context fields.
- Produces:
  - `type ClubView = 'none' | 'pending' | 'app' | 'ending' | 'exportOnly' | 'locked'`
  - `clubView(club: Club | null, role: MemberRole | null, now: Date): ClubView`, with these rules:
    - **`'none'`:** `club` is null, or its status is `deleted`.
    - **`'pending'`:** status is `pending`.
    - **`'app'`:** status is `active`.
    - **`'ending'`:** status is `terminating` and `now < effectiveAt`.
    - **`'exportOnly'`** (admin) **/ `'locked'`** (member): status is `suspended`, or `terminating` with `effectiveAt <= now < retrievalEndsAt`.
    - **`'locked'`** (everyone): status is `terminating` and `now >= retrievalEndsAt`.
  - `ClubStatusScreen({ kind: 'pending' | 'locked' | 'exportOnly' | 'ended' })`

- [ ] **Step 1: Write the failing tests.**

  `clubView.test.ts`. An `it.each` over the rules above, including the Review Focus boundaries:
  - at `now == effectiveAt`: `exportOnly` for an admin and `locked` for a member
  - at `now == retrievalEndsAt`: `locked` for both

  `ClubGate` tests through `RequireAuth` with `authValue()`. Each test renders a stub child, `<p>App</p>`:
  - `renders the app for an active club`
  - `shows the welcome page with the person's email when there is no club`: the heading is `Welcome to Volley Skills`, the text contains `Ask your club admin to add user@example.com`, and there is a `Sign out` button.
  - `shows the pending screen`: the heading is `Your club is waiting for activation` and the text contains the club name.
  - `locks out a member of a suspended club`: the heading is `Your club's access is paused`, and `App` is absent.
  - `shows the export-only screen to an admin of a suspended club`: same heading, plus the text `Your club's data is kept`.
  - `switches to the locked screen when the club changes while open`: rerender with a suspended club, and `App` disappears.

  `AppShell` tests:
  - `shows the contract-ending banner while terminating`. Admins see `Your contract ends on <date>. Export your data before <date>.` Members see `Your club's contract ends on <date>.` Dates use `toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })`.
  - `offers Switch to <club> for each other club only when there is more than one`
  - `notifies once when the stored club was dropped`: `useNotify` receives `You no longer have access to your previous club.`

  `NotFoundState` test: `hints at another club when the person has several`. The text is `This may belong to another of your clubs.` with the switch actions; there is no hint for a single club.
- [ ] **Step 2: Run** `npx vitest run src/clubs src/auth src/layout src/components`. Expected: FAIL.
- [ ] **Step 3: Implement.** The screens use `AuthShell` and the design-system components. `ClubStatusScreen`'s `ended` kind uses the heading `Your club's contract has ended`. The `exportOnly` screen gets its Export action in Plan 4 (note this in a code comment). Compute `now` once per render with `new Date()`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(clubs): club gate with welcome, pending, locked and contract-ending states`.

---

### Task 9: The club name comes from the club

**Files:**
- Modify: `src/types/team.ts` (drop `club`)
- Modify: `src/teams/teamsApi.ts` (drop `NewTeamInput.club`)
- Modify: `src/teams/CreateTeamDialog.tsx` (+ test; drop the Club field)
- Modify: `src/teams/teamsImport.ts` (+ test). Drop `club` from the template and `OPTIONAL_TEXT_FIELDS`, and ignore a `club` key in imported JSON, as already happens for unknown keys.
- Modify: `src/teams/TeamsListPage.tsx`. The subtitle becomes `{team.ageGroup}`.
- Modify: `src/home/homeFeed.ts`. Delete `clubName()` and its tests.
- Modify: `src/home/HomePage.tsx`. The header reads `useAuth().club?.name`.
- Modify: `src/awards/AwardsPage.tsx`. Both `clubName` reads become `club?.name ?? ''`, from `useAuth()`.

**Interfaces:**
- Consumes: `useAuth().club` from Task 7.

- [ ] **Step 1: Update the tests.**
  - `CreateTeamDialog.test.tsx`: the expected `createTeam` input has no `club`, and the form has no "Club" label.
  - `HomePage.test.tsx`: `shows the club name from the active club`, using `authValue({ club: testClub({ name: 'Volley Demo' }) })`.
  - `AwardsPage` test: the card `clubName` comes from the context club.
  - `teamsImport.test.ts`: a `club` key is ignored.
- [ ] **Step 2: Run** `npx vitest run src/teams src/home src/awards`. Expected: FAIL.
- [ ] **Step 3: Implement** the changes listed under Files.
- [ ] **Step 4: Run** `npm test` and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(clubs): club name from the club doc, team.club dropped`.

---

### Task 10: Access manager adds and removes club members

The full People & access screen with roles is Plan 2. This task keeps today's Access page working under the new rules: a person granted anything becomes a club member.

**Files:**
- Modify: `src/access/accessApi.ts` (+ test)
- Modify: `src/access/AccessManagerPage.tsx`. `AccessRequestsPanel` renders only when `isPlatformAdmin`.
- Modify: `src/layout/AppShell.tsx` and `src/settings/SettingsPage.tsx`. `usePendingSignups(isPlatformAdmin)`.

**Interfaces:**
- Consumes: `clubDoc`, `getActiveClubId` and `useAuth().isPlatformAdmin`.
- Produces: signature changes in `src/access/accessApi.ts`:
  - `saveGrants(email: string, next: GrantSet, prev: GrantSet, grantedBy: string): Promise<void>` now takes a `grantedBy` parameter.
  - `removeAllGrants(email: string): Promise<void>` keeps its signature.

- [ ] **Step 1: Write the failing tests** in `accessApi.test.ts`:
  - `lowercases the email before writing grants`
  - `creates the member doc in the same batch when the person is not yet a member`: `batch.set(clubDoc('members','new@x.y'), { email, clubId: 'club-1', role: 'member', addedBy, addedAt: serverTimestamp() })`.
  - `does not rewrite an existing member doc`
  - `removeAllGrants deletes a plain member's doc but keeps an admin's`: this is Review Focus 5.
- [ ] **Step 2: Run** `npx vitest run src/access`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `saveGrants` reads `getDoc(clubDoc('members', email))` before building the batch.
  - `removeAllGrants` reads the member doc and adds `batch.delete` only when `role === 'member'`.
  - Update the callers in `AccessManagerPage` to pass `firebaseUser.email` lowercased.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(access): grants create and remove club membership`.

---

### Task 11: Seeds — clubs in the emulator

**Files:**
- Create: `scripts/seed/clubArg.mjs`
- Modify: these scripts move from `db.collection('teams')` to `clubRoot(db, club).collection('teams')`, and likewise for every club-scoped path:
  - `scripts/seed/seed.mjs`
  - `seedLibrary.mjs`
  - `seedMatch.mjs`
  - `seedMen1.mjs`
  - `applyNumbers.mjs`
  - `backfillSummaries.ts`
  - `backfillPlayers.mjs`
  - `snapshotSkills.mjs`
  - `importPlayers.mjs`
- `exportProdPlayers.mjs`: reads top-level by default (prod is not migrated until Plan 4); `--club <id>` reads under a club.
- Create: `scripts/seed/seedClubs.mjs`
- Modify: `scripts/seed/dev.mjs` (chain `seedClubs.mjs` after `seed.mjs`), `scripts/seed/README.md`

**Interfaces:**
- Produces, in `clubArg.mjs`:
  - `parseClubArg(argv: string[]): string`: the value after `--club`, default `'demo'`.
  - `clubRoot(db, clubId): DocumentReference`.
  - `writeClub(db, { id, name, status, admins, members, country = 'IT', locale = 'en' }): Promise<void>`:
    - Writes the club doc with the Task 1 shape: `aiEnabled: true`, `growthTestsEnabled: true`, `referenceOptOut: false`, `legal: null`, `termination` all null, and `billing: null`.
    - Writes the member docs with the field set `addedBy: 'seed-script'`.
    - Writes the three `sectionAccess` docs with every admin listed.

**Seed results:**
- **`seed.mjs`:**
  - Writes `clubs/demo` (`Volley Demo`, active) with `--admin` (default `coach@example.com`) as club admin and owner, and `platformAdmins/<admin>`.
  - Writes today's data under the club. Guides go to `config/skillGuide`.
  - `adminAllowlist` is no longer written.
  - `--reset` uses `db.recursiveDelete(clubRoot(db, club))`.
  - The `--prod` guard checks `clubs/<club>` instead of `teams`.
- **`seedClubs.mjs`:**
  - `clubs/rival` (`Rival Volley`, active, admin `rival@example.com`, one team `Rival U17` with two players, one exercise)
  - `clubs/newclub` (`New Club`, pending, admin `pending@example.com`)
- **Collection-group scripts** (`backfillSummaries`, `backfillPlayers`, `snapshotSkills`): keep only docs whose `ref.path` starts with `clubs/${club}/`.

- [ ] **Step 1: Implement** the scripts and update `README.md`'s "What gets written" and the flags tables.
- [ ] **Step 2: Verify by hand.** Run `npm run dev:emulator`, then sign in as each user in turn:
  - `coach@example.com` sees the demo club working, including the Teams, Exercises, Trainings and match Stats pages.
  - `rival@example.com` sees only Rival U17.
  - `pending@example.com` sees the pending screen.
  - `nobody@example.com` sees the welcome page.

  In the Emulator UI, confirm there are no top-level `teams`, `exercises` or `trainings` collections. Record what you saw in the commit body.
- [ ] **Step 3: Run** `node --test scripts/seed/*.test.mjs`. Expected: PASS.
- [ ] **Step 4: Commit** `feat(seed): seed demo, rival and pending clubs under clubs/{clubId}`.

---

### Task 12: Docs and full verification

**Files:**
- Modify: `CLAUDE.md`:
  - "What this is": one project serves many clubs.
  - The roles and access paragraph in "Auth & routing": club admin and member, platform admin, `RequireClubAdmin`, `ClubGate`.
  - "Firestore model shape": the `clubs/{clubId}` root, `members`, `config/*`, `platformAdmins`.
  - The `vcb.activeClub` key.
- Modify: `docs/superpowers/specs/2026-09-11-volley-skills-access-model.md`. Add a "Superseded in part by the club platform design" note at the top, naming the replaced pieces: `superadmin`, `adminAllowlist`, and top-level sections.
- Modify: `docs/PRODUCTION-READINESS.md`. Record the verified `eur3` Firestore region (spec §11).

- [ ] **Step 1: Write the doc changes.**
- [ ] **Step 2: Run** `npm run lint`, `npm run build`, `npm test` and `npm run test:rules`. Expected: lint 0 errors, build OK, all unit tests pass, all rules tests pass. Report the counts.
- [ ] **Step 3: Commit** `docs: club platform foundation in CLAUDE.md, access model and readiness`.
