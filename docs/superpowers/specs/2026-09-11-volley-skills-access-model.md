# Volley Skills — Section-scoped access model

**Status:** design, pending review
**Supersedes:** authorization model in `2026-09-04-volley-skills-app-design.md` §6
**Date:** 2026-09-11

## 1. Problem

Today authorization is all-or-nothing at the top and unmanaged at the team level:

- `adminAllowlist/{email}` gates a one-time global `role: 'admin'` written to
  `users/{uid}` on first sign-in. A global admin can read/write **every** team,
  the entire exercises + trainings libraries, the guides, and can create teams.
- Team membership lives in `teams/{teamId}.adminEmails` and is editable by **any**
  current team admin, from that team's Settings tab.

Consequences:

- There is no way to give someone one team, or the trainings library only,
  without handing them everything.
- A team admin who is not a global admin can open a team's **Calendar** tab but
  `AssignTrainingDialog` calls `listTrainings()` / `findTrainingByBusinessId()`,
  both gated by `isAdmin()`, so every read fails and no session can be created.
  `RequireAdmin` also hides `/trainings` and `/exercises` from them entirely.
- Granting access means editing `adminAllowlist` in Firestore by hand or adding
  emails ad hoc to team docs; there is no admin surface for it.

## 2. Goals

- Two clear tiers: **super-admin** (everything + grants) and **member** (only
  what they are granted).
- Grants are section-scoped: any subset of teams, plus independent
  **exercises**, **trainings**, **guides** grants.
- One super-admin-only **Access** page to manage all grants per person.
- Calendar is hidden (UI and rules) when the user has no trainings access.
- Keep the security-critical, high-frequency team/player/physicalTest rules
  byte-for-byte identical — a team grant still means exactly what it means now.
- No Cloud Functions; stays on the Spark plan. All enforcement in
  `firestore.rules`.

Non-goals: the parent/viewer invite flow (`viewerEmails`) stays deferred and
untouched (app-design spec §6.4).

## 3. Model

| Concept | Meaning | Source of truth |
|---|---|---|
| **Super-admin** | Full access to every team + section; the only role that can grant access and create/delete teams | `adminAllowlist/{email}` exists (server-only, unchanged) |
| **Member** | Regular user; access = union of their grants | `users/{uid}` doc, `role: 'member'` |
| **Team grant** | Manage one team: roster, players, physical tests, development plan, team-info edit | email ∈ `teams/{teamId}.adminEmails` |
| **Section grant** | Manage one club-wide section | email ∈ `sectionAccess/{section}.adminEmails`, `section ∈ {exercises, trainings, guides}` |

Derived rules:

- **Trainings grant ⇒ exercise-library _read_** (the training builder's exercise
  picker and training detail must work). Editing exercises/diagrams still needs
  the **exercises** grant.
- **Calendar** is available for a team only if the user is a team admin of it
  **and** has trainings access.
- A member with **zero** grants: Teams nav only; `/teams` empty with
  "No teams assigned yet — ask your club admin"; `/settings` works; every other
  route → "You don't have access to this page."

`UserRole` changes from `'admin' | 'viewer'` to `'superadmin' | 'member'`. The
`AppUser` shape keeps `{ uid, email, role }`.

## 4. Firestore shape

```
adminAllowlist/{email}       # unchanged, server-only — the super-admins
sectionAccess/exercises      # { adminEmails: string[] }
sectionAccess/trainings      # { adminEmails: string[] }
sectionAccess/guides         # { adminEmails: string[] }
teams/{teamId}.adminEmails   # unchanged shape; now only a super-admin may edit it
users/{uid}                  # { email, role: 'superadmin' | 'member' }
```

Indexes (`firestore.indexes.json`): add a `teams` single-field index on `name`
(ascending) for the Access page's team checklist (`listAllTeams`). No other new
indexes — `sectionAccess/*` are single-document reads.

## 5. Security rules

`isAdmin()` is deleted. New helpers at the top of the match block:

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

### 5.1 `sectionAccess/{section}`

```
allow read:  if isSuperAdmin()
             || (request.auth != null && request.auth.token.email in resource.data.adminEmails);
allow write: if isSuperAdmin()
             && request.resource.data.adminEmails is list;
```

A member reading a section they are not in gets `permission-denied`; the client
treats that as "not granted" (§6.2), not an error.

Extra audit-metadata fields (`addedBy`/`addedAt` from `scripts/seed/seed.mjs`,
`migratedAt` from `scripts/migrate/2026-09-11-section-access.mjs`) are
intentionally permitted on write — there is no `keys().hasOnly(...)` clause —
since only a super-admin can ever write here and such fields carry no
privilege. (An earlier version of this rule did restrict to `['adminEmails']`
only; that broke every client write once a doc carried seed/migration metadata,
because `update()` binds `request.resource.data` to the full post-merge
document. Fixed 2026-09-11.)

### 5.2 Libraries

| Path | read | write (create/update/delete) |
|---|---|---|
| `exercises/{id}` | `canReadExercises()` | `canWriteExercises()` + existing `name`/`category` shape checks |
| `exercises/{id}/diagrams/{d}` | `canReadExercises()` | `canWriteExercises()` + existing scene shape checks |
| `trainings/{id}` | `canTrainings()` | `canTrainings()` + existing shape checks |
| `counters/trainings` | `canTrainings()` | `canTrainings()` + `lastSequence` int ≥ 0 |

### 5.3 Guides

```
match /skillGuide/config, /physicalTestGuide/config {
  allow read:  if request.auth != null;   // unchanged — player cards show guide text
  allow write: if canGuides();
}
```

### 5.4 `users/{uid}`

```
allow read: if request.auth != null && request.auth.uid == uid;   // unchanged
allow create: if request.auth != null
  && request.auth.uid == uid
  && request.resource.data.email == request.auth.token.email
  && request.resource.data.keys().hasOnly(['email', 'role'])
  && (
    request.resource.data.role == 'member' ||
    (request.resource.data.role == 'superadmin' && isSuperAdmin())
  );
allow update, delete: if false;   // unchanged
```

### 5.5 `teams/{teamId}` — membership split

```
allow read:   if isSuperAdmin()
              || (request.auth != null && request.auth.token.email in resource.data.adminEmails);
allow create: if isSuperAdmin()
              && request.resource.data.createdBy == request.auth.uid
              && request.resource.data.adminEmails is list;
allow update: if isSuperAdmin()                       // may change anything, incl. adminEmails
              || (request.auth != null
                  && request.auth.token.email in resource.data.adminEmails
                  && request.resource.data.adminEmails == resource.data.adminEmails);
allow delete: if isSuperAdmin();
```

A team admin can still edit name/description/notes/developmentPlan; any write
that changes `adminEmails` from a non-super-admin is denied. `adminEmails` is
never required to be non-empty in rules any more (a super-admin can leave a team
with no team admins); the Access page warns but permits it.

`createTeam` (client) still seeds `adminEmails: [creatorEmail]` so the
super-admin who creates a team is also its first team admin; a super-admin can
remove themselves later from the Access page. The rule only requires
`adminEmails is list`, so `[]` is also valid if the client ever chooses it.

### 5.6 `teams/{teamId}/players/**` and `physicalTests/**`

`isTeamAdmin()` still `get()`s `teams/{teamId}.adminEmails`; a team grant is
unchanged in meaning. Viewer read paths via `viewerEmails` unchanged.

`isTeamAdmin()` (defined locally inside `players/{playerId}`) now also accepts
`isSuperAdmin()`:

```
function isTeamAdmin() {
  return isSuperAdmin() || request.auth.token.email in
    get(/databases/$(database)/documents/teams/$(teamId)).data.adminEmails;
}
```

This resolves the contradiction with §3 ("Super-admin: full access to every
team + section") — without it, a super-admin who isn't also listed in a given
team's `adminEmails` was denied on that team's players/physicalTests, which
broke `deleteTeam` (deletes all players before the team doc) for any
super-admin not personally in `adminEmails`. Fixed 2026-09-11.

### 5.7 `teams/{teamId}/calendar/{sessionId}`

```
function isTeamAdmin() {                // local to this match block
  return request.auth != null && (isSuperAdmin() || request.auth.token.email in
    get(/databases/$(database)/documents/teams/$(teamId)).data.adminEmails);
}
allow read, create, delete: if isTeamAdmin() && canTrainings();
allow update: if false;                 // unchanged
```

Same super-admin escape hatch as §5.6, fixed 2026-09-11. A super-admin also
automatically satisfies `canTrainings()`, so this match block needs no other
change.

`create` keeps `createdBy == request.auth.uid && date is string`. Heaviest
rule-eval on this path: `get(team)` + `get(sectionAccess/trainings)` = 2 `get()`s,
well under the limit of 10.

## 6. Client

### 6.1 Route guards (`src/auth/`)

- Remove `RequireAdmin`.
- Add `RequireSuperAdmin` → `/admin/access`.
- Add `RequireSection` (prop `section: 'exercises' | 'trainings' | 'guides'`) →
  `/exercises`, `/exercises/:exerciseId/diagram`, `/trainings`, `/admin/guides`.
- Both render the existing "You don't have access to this page." `AuthShell`
  message on failure.

### 6.2 Access context

Extend `AuthContext` (or a nested `AccessProvider`) to resolve once per sign-in,
after `ensureUserDoc`:

```
access = {
  isSuperAdmin: appUser.role === 'superadmin',
  sections: {
    exercises: boolean,   // super-admin OR readable sectionAccess/exercises
    trainings: boolean,
    guides:    boolean,
  },
}
```

`sections.*` is resolved by attempting `getDoc(sectionAccess/<s>)`: success ⇒
`true`, `permission-denied` ⇒ `false`, any other error ⇒ surface as auth error.
A super-admin short-circuits all three to `true` without reads. Per-team access
stays page-local via the existing `listMyTeams(email)` / `getTeam` calls.

### 6.3 Nav (`AppShell`)

`NAV_ITEMS` filtered by `access`:

| Item | Shown when |
|---|---|
| Teams (`Users`) | always |
| Exercises (`Dumbbell`) | `access.sections.exercises` |
| Trainings (`ClipboardList`) | `access.sections.trainings` |
| Guides (`BookOpen`) | `access.sections.guides` |
| **Access** (`KeyRound`), route `/admin/access`, placed right after Guides | `access.isSuperAdmin` |

Both the desktop sidebar and the mobile bottom bar honor the filter. The mobile
bar already carries a Settings entry; if the visible count would exceed 5,
Guides/Access fall to an overflow — out of scope, revisit only if it happens.

### 6.4 Access page — `/admin/access` (`AccessManagerPage`)

New feature folder `src/access/`: `AccessManagerPage.tsx`, `accessApi.ts`,
`AccessManagerPage.test.tsx`, `accessApi.test.ts`.

- **People list** — the union of every `teams/*.adminEmails` (from
  `listAllTeams`) and the three `sectionAccess/*.adminEmails`, de-duplicated and
  sorted. Plus an **"Add person by email"** field: trims + lowercases + validates
  shape (same normalization as today's `addTeamAdmin`), then opens the edit panel
  for that email with everything unchecked.
- **"Full access (super-admins)"** — a read-only note. The client cannot read
  `adminAllowlist`, so this lists only the current user ("You") and states that
  super-admins are managed directly in Firestore. (If a visible full list is
  wanted later, mirror allowlist emails into a readable doc during seed/migration
  — deferred.)
- **Edit panel for a selected email:**
  - Checklist of **all teams** (`listAllTeams()` — `orderBy('name')`,
    `limit(N)` + `startAfter` cursor pagination per app-design spec §8).
  - Toggles: **Exercises**, **Trainings**, **Guides**.
  - **Save** — one `writeBatch`: `arrayUnion`/`arrayRemove` of the email on each
    `teams/{id}` and `sectionAccess/{section}` doc whose membership changed;
    untouched docs are not written.
  - **Remove all access** — a batch that `arrayRemove`s the email from every team
    and section list.
- All writes are super-admin-only at the rules level (§5.1, §5.5).

`accessApi.ts` owns:
- `listAllTeams(cursor?)` → `{ teams, lastDoc, hasMore }` (super-admin read).
- `listGrantHolders()` → `{ email, teamIds: string[], sections: {...} }[]`.
  Builds the union by paging `listAllTeams` to completion plus three
  single-doc `sectionAccess` reads. Single club, tens of teams — acceptable;
  if team count ever grows large this becomes a denormalized index, not a scan.
- `saveGrants(email, { teamIds, sections }, previous)` → diffs against `previous`
  and commits the minimal batch.
- `removeAllGrants(email)`.

### 6.5 `TeamPage` / `TeamSettingsTab`

- Remove the **Admins** `<section>`, the add-admin `<form>`, and delete
  `addTeamAdmin` / `removeTeamAdmin` from `teamsApi.ts`.
- Keep **Team info** editing (name/description/notes) for team admins.
- **Danger zone / Delete team** renders only when `access.isSuperAdmin`.
- The **Calendar** `<Tab>` and its panel render only when the user is a team
  admin of this team **and** `access.sections.trainings`.

### 6.6 `TeamsListPage`

- **Create team** button renders only when `access.isSuperAdmin`.
- Empty-state copy for a member with no teams: "No teams assigned yet — ask your
  club admin."

## 7. Migration & seeding

### 7.1 One-time prod migration

`scripts/migrate/2026-09-11-section-access.mjs` (Admin SDK, guarded to run once,
same shape as `scripts/seed/seed.mjs --prod`):

1. Create `sectionAccess/{exercises,trainings,guides}`, each
   `{ adminEmails: [...], migratedAt: <serverTimestamp> }`.
2. **Back-fill:** the set of every email in a `users` doc with `role == 'admin'`
   **plus** every email in any `teams/*.adminEmails` → write that set as the
   `adminEmails` of all three section docs. Existing global admins keep the
   libraries + guides; existing team admins keep their teams (those docs are not
   touched).
3. Relabel `users` docs: `role: 'admin'` → `'superadmin'`, `'viewer'` →
   `'member'`. Safe because a historical `role: 'admin'` was only writable when
   `adminAllowlist/{email}` existed.
4. Print a summary: section docs created, emails back-filled, users relabelled.

### 7.2 `ensureUserDoc`

Tolerate legacy values on read (`'admin'` → `'superadmin'`, `'viewer'` →
`'member'`) so a pre-migration doc still works. The first-sign-in probe writes
`role: 'superadmin'` and falls back to `'member'` on `permission-denied`
(unchanged pattern).

### 7.3 Seed

`scripts/seed/seed.mjs`: also write the three `sectionAccess/*` docs.
`--admin <email>` puts that email in `adminAllowlist` (unchanged) **and** in all
three section docs so the dev/emulator admin is fully functional. Update
`scripts/seed/README.md` and its data table.

## 8. Testing (spec §13 order)

### 8.1 Rules (`tests/rules/`) — primary verification

- `sectionAccess/{s}`: super-admin reads + writes; a listed member reads only;
  an unlisted member is denied both; a write with a non-list `adminEmails` or
  extra keys is rejected.
- `exercises` / `trainings` / `counters`: a granted member does full CRUD; a
  trainings-only member **reads** exercises but **cannot write** them; an
  ungranted member is fully denied; super-admin bypasses all.
- `guides`: a guides-granted member writes both config docs; any signed-in user
  still reads them.
- `teams`: super-admin creates + deletes; a team admin updates name/notes; any
  non-super-admin write that changes `adminEmails` is denied; a super-admin
  changes `adminEmails` freely.
- `calendar/{sessionId}`: a team admin **with** trainings access reads/creates/
  deletes; a team admin **without** trainings access is denied; a non-member is
  denied.
- Regression: existing player / physicalTest / viewer rule tests still pass
  unchanged.

### 8.2 Logic (unit)

- `accessApi`: `listGrantHolders` builds the correct union; `saveGrants` diffs
  against `previous` and emits the minimal `arrayUnion`/`arrayRemove` batch;
  `removeAllGrants` strips every list.

### 8.3 Components

- `AccessManagerPage`: renders the people list; add-by-email normalizes; toggling
  a team/section then saving issues the expected writes; "remove all access"
  clears every list.
- `TeamSettingsTab`: no Admins section / add-admin form; Delete team hidden for a
  member, shown for a super-admin.
- `AppShell`: nav items appear/hide per `access`; Access item only for
  super-admin; mobile + desktop.
- `TeamPage`: Calendar tab hidden without trainings access, shown with it.
- `TeamsListPage`: Create team hidden for a member; empty-state copy.
- Guards: `RequireSuperAdmin` / `RequireSection` block and allow correctly.

## 9. Rollout order

Development order (this repo, before any prod deploy): rules + rules tests,
`sectionAccess` seed + migration script, types (`UserRole`)/`ensureUserDoc`/
access context, route guards + nav, `AccessManagerPage` + `accessApi`,
`TeamSettingsTab`/`TeamsListPage`/`TeamPage` (Calendar tab) edits, then remove
`RequireAdmin`, `addTeamAdmin`, `removeTeamAdmin`.

**Prod deploy order is the reverse of "rules first": the migration script
(§7.1) must run BEFORE the new `firestore.rules` are deployed, never after.**
The migration uses the Admin SDK, so it bypasses rules entirely and works fine
against the *old* rules. If the new rules land first, there is a window —
until the migration creates `sectionAccess/*` and relabels `users.role` —
where `inSection()` denies everyone, and (more severely) the `users/{uid}`
create rule only accepts `role: 'member'`/`'superadmin'`, so the old client
(still being served) trying `role: 'admin'` then falling back to `role:
'viewer'` gets both denied and a brand-new user can't sign in at all. So the
order is: **1) run the migration script against prod, 2) deploy the new
`firestore.rules`, 3) ship the new client build.** See
`docs/PRODUCTION-READINESS.md` for the operational checklist item.

## 10. Open questions

- Mobile bottom bar with 6 possible entries (Teams, Exercises, Trainings, Guides,
  Access, Settings) for a super-admin — needs an overflow or a different mobile
  treatment. Deferred until a super-admin actually has all of them.
- Whether to surface the full super-admin list on the Access page (needs a
  readable mirror of `adminAllowlist`). Deferred.
