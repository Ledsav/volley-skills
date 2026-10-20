# Volley Skills — Multi-club (multi-tenant) design

Date: 2026-10-15
Status: **Superseded** by `2026-10-20-volley-skills-club-platform-design.md` (2026-10-20). Kept for the reasoning behind option B.
Companion to: `2026-09-04-volley-skills-app-design.md` (data model §5), `2026-09-11-volley-skills-access-model.md`

## 1. Where we are

One deployment (one Firebase project, `volley-skills`) serves one club. The app is already **club-agnostic**: no club name is hardcoded; a club's identity only comes from data (`team.club`). Everything that isn't team-scoped is **club-global by being top-level**:

| Collection | Scope today |
|---|---|
| `teams/{teamId}` (+ `players`, `physicalTests`, `calendar`, `testingSessions`, `matches`, `events`, `awards`, `scoutProfile`) | per team |
| `exercises/{id}` (+ `diagrams`), `trainings/{id}`, `counters/trainings` | whole club |
| `skillGuide/config`, `physicalTestGuide/config` | whole club |
| `sectionAccess/{exercises,trainings,guides}` | whole club |
| `adminAllowlist/{email}` | whole deployment (= club) |
| `interestSignups/{id}` | whole deployment |
| `users/{uid}` | per person |

"Superadmin" therefore means "admin of the club" and "admin of the platform" at the same time.

## 2. Decision

Two ways to serve more than one club were considered:

- **A. One Firebase project per club** — zero code change, a deployment per club. **Ruled out** (2026-10-15): not an option for the operator.
- **B. One project, clubs as a data dimension** — the path if multi-club is ever needed. Described below.

Not done now because it is a large change (rules, access model, data migration) with no second club in sight.

## 3. Target model (option B)

### 3.1 Data

Everything club-global moves under one club root; team-scoped data moves with its team. `users` stays top-level (a person can belong to several clubs).

```
clubs/{clubId}                         name, branding, createdAt   (club profile)
clubs/{clubId}/members/{email}         role: 'admin' | 'member'    (replaces adminAllowlist + users.role for that club)
clubs/{clubId}/teams/{teamId}/...      unchanged subtree
clubs/{clubId}/exercises/{id}/diagrams/{id}
clubs/{clubId}/trainings/{id}
clubs/{clubId}/counters/trainings
clubs/{clubId}/config/skillGuide
clubs/{clubId}/config/physicalTestGuide
clubs/{clubId}/sectionAccess/{section}
clubs/{clubId}/interestSignups/{id}
users/{uid}                            profile + clubIds: string[] (for the club switcher)
platformAdmins/{email}                 the operator; never client-readable (as adminAllowlist today)
```

`team.club` (free text) is replaced by the club profile's `name`. Denormalized fields on player docs (`teamName`, `ageGroup`, `season`) stay as they are.

There are **no collection-group queries** in the app today, so every query keeps its shape; only the path prefix changes. Composite indexes in `firestore.indexes.json` are collection-scoped by name and keep working under the new parent.

### 3.2 Security rules

Every rule gains a club check. With no Cloud Functions (Spark plan) there are no custom claims, so membership is a document lookup:

```
function member(clubId)  { return exists(/databases/$(database)/documents/clubs/$(clubId)/members/$(request.auth.token.email)); }
function clubAdmin(clubId) { return get(/databases/$(database)/documents/clubs/$(clubId)/members/$(request.auth.token.email)).data.role == 'admin'; }
```

Costs to keep in mind:
- each `get`/`exists` is a billed read and counts toward the **10 lookups per request** limit (20 for batched writes) — the existing team-admin checks already use some of that budget;
- every rule in `firestore.rules` (~270 lines) and every file in `tests/rules/` (18) must be rewritten and extended with cross-club tests ("an admin of club X cannot read club Y").

### 3.3 Access model

| Today | Multi-club |
|---|---|
| `superadmin` (via `adminAllowlist`) | **club admin** (`members/{email}.role == 'admin'`) — everything inside one club |
| — | **platform admin** (`platformAdmins`) — creates clubs, appoints the first club admin; no implicit access to club data |
| team `adminEmails` / `viewerEmails` | unchanged, inside the club |
| `sectionAccess` | unchanged, per club |

`resolveAccess` (`src/auth/access.ts`) becomes per club: `useAuth().access` describes the *active* club.

### 3.4 App / UI

- **Active club** in the auth context; a club switcher in the account menu when `users.clubIds.length > 1` (hidden otherwise — single-club users see no change).
- Routes keep their shape; the active club lives in context (and localStorage), not in the URL. If deep links across clubs are needed later, prefix routes with `/c/:clubId`.
- **Request access** asks which club (or is reached through a per-club link).
- Home welcome band and award cards read the club profile `name` (today: derived from `team.club`).
- A minimal platform-admin page: create club, set name, appoint first admin.

### 3.5 Code

All Firestore paths are built in the `<feature>Api.ts` modules (≈18 files reference `collection(db, …)` / `doc(db, …)`). Introduce one path helper (`clubCol('teams')`, `clubDoc('config', 'skillGuide')`) reading the active club id, and route every path through it. Seed scripts (`scripts/seed/`) and `backfillSummaries.ts` take a `--club` argument.

### 3.6 Data migration

One-off admin script (service account, like `scripts/seed`):
1. create `clubs/{clubId}` from the current club; write `members` from `adminAllowlist` + current users;
2. copy every top-level club-global collection and every `teams/**` subtree under the club root, preserving document ids (calendar/match links and `businessId`s stay valid);
3. deploy the new rules and app together; keep the old collections read-only for a grace period, then delete.

Firestore has no server-side move, so this is read + write per document (fine at single-club volumes; mind daily free-tier write quotas — run it over two days if needed). Offline caches on users' devices hold old paths: the release must clear the persistent cache once (sign-out flow already knows how to).

### 3.7 Legal (EU)

Each club becomes the **data controller** for its players and guardians; the operator becomes a **processor** → a data-processing agreement per club, and the privacy page explains per-club responsibility. Cross-club isolation (rules + tests) is what makes that claim true.

## 4. Effort

Roughly one plan increment, comparable to the scouting feature:

| Part | Size |
|---|---|
| Path helper + Api modules + seeds | small (mechanical) |
| Rules + rules tests (incl. cross-club) | **large** — the real work |
| Access model, active club, switcher, platform-admin page | medium |
| Migration script + rehearsal on the emulator | medium |
| Legal copy + DPA template | small (writing) |

## 5. Cheap preparation (optional, any time)

None of this is required; each step only lowers the future cost:
1. Store the club profile at `clubs/{clubId}` (one doc) instead of reading `team.club`.
2. Route Firestore paths through one helper that today returns the current top-level paths.
3. Don't add new top-level club-global collections without noting them in §3.1.

## 6. When to revisit

- A second club wants to use the app, or
- one club needs isolated sub-organisations (e.g. separate sections with separate admins) that `sectionAccess` + team admins can't express.
