# Volley Skills — Club platform (multi-club, self-service, tenant admin)

Date: 2026-10-20
Status: Design — awaiting approval
Supersedes: the deferred multi-club design of 2026-10-15 (removed; in git history) — its target model is the starting point and is refined here
Companions (same programme, same branch `feature/club-platform`):
- `2026-10-20-volley-skills-legal-documents-design.md` — Terms, DPA, sub-processors, privacy notice, the signature step's content
- `2026-10-20-volley-skills-italian-design.md` — Italian translation
- `2026-10-20-volley-skills-dvw-import-design.md` — DataVolley file import
Evidence: `docs/research/2026-10-20-legal-framework.md`, `docs/research/2026-10-20-pricing-and-competitors.md` (research, not legal advice)

## 1. Intent

The app becomes something other clubs can sign up for. A club arrives on its own, creates its club, accepts the Terms and the data-processing agreement, and waits. The operator (Alberto) activates it — today by hand, later by a confirmed subscription payment. From then on the club runs itself: creates teams, fills its exercise and training library, sets who can see and edit what. The operator runs a tenant page with clubs and their status, and **never sees a club's data**.

Why now: the pricing research points at a first sales window of June–September 2027, and multi-club is the critical path. The legal research turns three things into design requirements: a logged, signed acceptance (GDPR Art. 28(9), Italian art. 1341 c.c. + Cass. ord. 20945/2026), a data exit that survives deactivation (EU Data Act Ch. VI, GDPR Art. 28(3)(g)), and operator isolation from club data enforced in the security rules.

### What success looks like
- A second club can go from the sign-up page to "pending" without the operator, and from "active" to a working library and calendar without the operator.
- The existing club keeps working, migrated in as the first tenant; its users notice only the new club menu and a one-time legal acceptance by its admin.
- Rules tests prove: a person in club A cannot read or write anything in club B; the platform admin cannot read any club's teams, players, library, matches, guides or members.

### Goals
1. Clubs as a data dimension in one Firebase project (`clubs/{clubId}` root).
2. Self-service club creation that lands in `pending`; nobody can create teams or data until activation.
3. Tenant lifecycle: pending → active ⇄ suspended → terminating → deleted, enforced in rules.
4. Club-scoped administration: club admins manage members, team admins and section access for their club only.
5. Platform admin page: list clubs, activate, deactivate (suspend), end the contract. Nothing else.
6. Logged acceptance of Terms + DPA, with a specific-approval "signature" step for the operator-favourable clauses.
7. Free full self-service export for club admins (also the Data Act retrieval path).
8. Migration of the current single-club data with ids preserved.

### Non-goals (this increment)
- Payment, subscriptions, invoicing (the `billing` slot is reserved, §3.1; Paddle or Stripe comes later).
- Support access to a club's data (a separate, consented, time-limited mechanism, designed later).
- Guided onboarding (later; this increment ships empty-state hints only).
- Free trials (no `trial` state now; the enum stays extensible).
- Guardian/parent access (still TBD in the access model).
- Cloud Functions. Everything stays rules-enforced on the Spark plan (memory: Blaze is acceptable later if free; payment webhooks will need it).
- Per-club branding beyond the name (logo etc. stay session-only in awards as today).

### Anti-goals (would make this a failure even if it works)
- Any path where the operator can read club data through the app, the rules, or a "convenience" query.
- A club admin of club A ever being able to grant themselves or anyone access in club B.
- Deactivation that destroys data or blocks a club's legal right to retrieve it.
- A sign-up that writes club data before the DPA is accepted.
- Breaking today's club: lost ids, broken calendar/match links, broken `businessId`s.

## 2. Decisions the operator made (as stated in conversation)

| Topic | Decision |
|---|---|
| Who gets in | Self-service sign-up, gated: a new club is **pending** until the operator activates it. Later, a confirmed subscription is the only gate. |
| Operator reach | Tenant page can only **activate and deactivate**. No access to club data. Support access is a separate GDPR-compliant line, later. |
| Deactivate | The club **loses access to the app**. (Refined below, §4, because the Data Act and GDPR require a retrieval path — the operator was told this; marked as builder's interpretation pending confirmation.) |
| Day one for a club | Create teams, populate exercises and trainings, set access rules. Onboarding later. |
| DPA | Click-through at sign-up, terms as operator-favourable as lawful. |
| Operator entity | Alberto as an individual (Luxembourg-resident) for now; a company later → contracts must be assignable. |

## 3. Data model

### 3.1 Collections

```
clubs/{clubId}                              club profile + lifecycle (see below)
clubs/{clubId}/members/{email}              { email, clubId, role: 'admin'|'member', addedBy, addedAt }
clubs/{clubId}/acceptances/{versionKey}     immutable legal acceptance record (§6)
clubs/{clubId}/statusLog/{logId}            immutable lifecycle log (§5)
clubs/{clubId}/teams/{teamId}/...           today's teams subtree, unchanged inside
clubs/{clubId}/exercises/{id}/diagrams/{id}
clubs/{clubId}/trainings/{id}
clubs/{clubId}/counters/trainings
clubs/{clubId}/config/skillGuide            (was skillGuide/config)
clubs/{clubId}/config/physicalTestGuide     (was physicalTestGuide/config)
clubs/{clubId}/sectionAccess/{section}
users/{uid}                                 { email, createdAt }  (role removed — roles are per club)
platformAdmins/{email}                      operator allowlist; readable only by that email
interestSignups/{id}                        operator's lead list (unchanged shape; read by platform admin)
```

Removed after migration: `adminAllowlist`, top-level `teams`, `exercises`, `trainings`, `counters`, `skillGuide`, `physicalTestGuide`, `sectionAccess`.

**`clubs/{clubId}` fields**

| Field | Type | Written by |
|---|---|---|
| `name` | string 2–80 | creator, club admin |
| `country` | ISO 3166-1 alpha-2 | creator, club admin |
| `locale` | `'en' \| 'it'` — the club's language, used as a live fallback when a person has not picked one (resolution order in the Italian design §3) | creator, club admin |
| `ownerEmail` | string — the club's contact admin (shown on the tenant page; receives the operator's notices) | creator; club admin may transfer it to another admin member |
| `aiEnabled` | boolean — the club, as controller, decides whether its staff may use AI features with their own provider keys (legal design T17). Default `false` for new clubs, `true` for the migrated club. When false the app hides every AI entry point. | creator, club admin |
| `referenceOptOut` | boolean, default false — legal design T15 | club admin |
| `growthTestsEnabled` | boolean — growth tests (height, body mass) may be health data; **off by default**, the club admin switches them on (operator decision 2026-10-20, legal design §6). `true` for the migrated club. | creator, club admin |
| `createdAt` | timestamp == request.time | creator |
| `status` | `'pending' \| 'active' \| 'suspended' \| 'terminating' \| 'deleted'` | creator (`pending` only), platform admin |
| `statusReason` | string ≤ 300 \| null | platform admin |
| `statusChangedAt`, `statusChangedBy` | timestamp, email | platform admin |
| `lastStatusLogId` | string — id of the log entry written in the same batch | platform admin |
| `legal` | `{ versionKey, acceptedAt, acceptedBy }` — the current accepted version | creator, club admin (re-accept) |
| `termination` | `{ requestedAt, requestedBy, effectiveAt, retrievalEndsAt }` all nullable | `requested*`: club admin; `effectiveAt`/`retrievalEndsAt`: platform admin |
| `billing` | `null` now; reserved for plan / paid-through / provider ids | platform admin (later: webhook) |

`team.club` (free text) is dropped; the club name comes from `clubs/{clubId}.name` everywhere it is read today (`homeFeed.clubName`, `AwardsPage` card/story, `TeamsListPage` subtitle). Player denormalized fields stay.

**Emails** are stored and compared **lowercased** everywhere (member ids, `adminEmails`, `viewerEmails`, `ownerEmail`). The migration lowercases existing arrays; the rules compare against `request.auth.token.email` (Firebase lowercases email-link accounts — builder verifies with the emulator and adds a test).

### 3.2 Finding "my clubs" without a users-doc list

The deferred design kept `users.clubIds`. That needs a write to another person's user doc whenever a club admin adds them, which the rules cannot allow safely. Instead (builder's call, recorded here): every member doc carries `email` and `clubId`, and the client runs one **collection-group query** `members where email == me`. A collection-group rule lets a person read only member docs carrying their own email. Needs a single-field collection-group index override on `members.email` in `firestore.indexes.json`. Collection-group use in the **scripts** (`backfillPlayers`, `backfillSummaries`, `snapshotSkills`) must be scoped to a club path (`--club`).

### 3.3 Queries and indexes
- Tenant page: `clubs orderBy createdAt desc limit 50` + cursor; filter `where status == X` → composite index `(status, createdAt desc)`.
- Everything else keeps its shape under the new parent; collection-scoped composite indexes keep working (§3.1 of the deferred design).
- Firestore caches identical `get()`s within one rule evaluation; the club doc and the caller's member doc are each one billed lookup per request.

## 4. Lifecycle

| State | Entered by | Members (coaches) | Club admins | Data |
|---|---|---|---|---|
| `pending` | sign-up | see "waiting for activation" | same; can edit club profile; can read their acceptance | only the club doc, members, acceptance |
| `active` | platform admin (manual now, payment later) | full use per grants | full use | normal |
| `suspended` ("Deactivate") | platform admin | **locked out** — "Your club's access is paused" | **export-only**: club profile, export page, status and contact info | kept, reversible |
| `terminating` | platform admin ("End contract"), after a club request or end of season | **full use until `termination.effectiveAt`** (notice + transition period), then locked out | full use until `effectiveAt`, then export-only until `retrievalEndsAt` | kept until `retrievalEndsAt` |
| `deleted` | purge script after `retrievalEndsAt` | nothing | nothing | subtree hard-deleted; club doc reduced to a tombstone (§7.4) |

Allowed transitions (enforced in rules): pending → active | deleted (reject); active → suspended | terminating; suspended → active | terminating; terminating → active (reinstated). `terminating → deleted` happens only in the purge script after `retrievalEndsAt` (§7.4); client rules never set `deleted` on a club that was ever active.

**Termination timeline** (Data Act Art. 25 via legal design T10): `termination.effectiveAt` is the end of the notice + transition period — the club keeps **full use** until then (rules: `isActive()` is time-aware, §5). `retrievalEndsAt` ≥ `effectiveAt + 30 days`; between the two, club admins are export-only. The platform page defaults: `effectiveAt` = the later of now + 30 days or the club's requested date; `retrievalEndsAt` = `effectiveAt` + 30 days; for an immediate termination for serious breach (Terms T9) the operator may set `effectiveAt` = now, never shortening `retrievalEndsAt` below 30 days after it.

**Resolved (Plan 2):** the §4 default and the §8.4 default ("now") differ; the shipped default is now + 30 days, and today is allowed only for a serious breach. The "club's requested date" in the default above is dropped: a termination request carries no requested end date (only `requestedAt`/`requestedBy`), so the operator agrees the date with the club and types it. Ending a **paused** (`suspended`) club defaults `effectiveAt` to today instead, because any later date gives the club full use again until then (the dialog says so). Enforced bound: the rules refuse an `effectiveAt` earlier than one day before now (`request.time − 1 day`; the day of tolerance covers "today" in the operator's local time). The one exception is a date change (terminating → terminating) that keeps the stored `effectiveAt` unchanged: an end date that has already passed may stay while only `retrievalEndsAt` moves, and the new `retrievalEndsAt` must still be ≥ `effectiveAt + 30 days`. Reinstating (terminating → active) clears the dates and the club's request (`requestedAt`/`requestedBy` to `null`, never to another value), so the club can ask again later.

**Why "export-only" instead of "lose everything":** the operator wanted deactivation to cut a club off completely. The app is cut off completely; the data is not, because (a) the Data Act gives a customer a retrieval period of at least 30 days after a transition period, free of charge from 12 Jan 2027, with no SME exemption in force, and (b) GDPR lets the controller choose return over deletion. Export-only for club admins is the narrowest access that satisfies both. `retrievalEndsAt` defaults to `effectiveAt + 30 days` (UI enforces ≥ 30). This interpretation was raised with the operator and is the builder's default until the operator confirms or changes the window.

**Season contracts:** the Terms (legal design) make the term one season without tacit renewal. At season end the operator moves non-renewing clubs to `terminating`. No automation now.

## 5. Security rules

All authorization stays in `firestore.rules`. Structure:

```
function email()            { return request.auth.token.email; }
function isPlatformAdmin()  { return exists(/…/platformAdmins/$(email())); }

match /platformAdmins/{e}   { allow get: if request.auth != null && e == email(); allow list, write: if false; }

match /{path=**}/members/{e} { allow read: if request.auth != null && resource.data.email == email(); }

match /clubs/{clubId} {
  function club()        { return get(/…/clubs/$(clubId)).data; }
  function memberDoc()   { return /…/clubs/$(clubId)/members/$(email()); }
  function isMember()    { return request.auth != null && exists(memberDoc()); }
  function isClubAdmin() { return isMember() && get(memberDoc()).data.role == 'admin'; }
  function isActive()    { return club().status == 'active'
                               || (club().status == 'terminating' && request.time < club().termination.effectiveAt); }
  function activeMember(){ return isMember() && isActive(); }
  function activeAdmin() { return isClubAdmin() && isActive(); }
  function exporter()    { return isClubAdmin() && (club().status in ['active','suspended']
                               || (club().status == 'terminating' && request.time < club().termination.retrievalEndsAt)); }

  allow get:  if isMember() || isPlatformAdmin();
  allow list: if isPlatformAdmin();
  allow create: if <sign-up rule, §6.3>;
  allow update: if <platform status transition> || <club admin profile / re-accept / termination request>;
  allow delete: if false;

  match /members/{e}      { read: isMember(); write: activeAdmin() + shape; sign-up create (§6.3); an admin cannot delete or demote themselves if they are the last admin — enforced in UI; rules require at least ownerEmail to stay admin }
  match /acceptances/{v}  { read: isClubAdmin() || isPlatformAdmin(); create: §6.3/§6.4; update, delete: false }
  match /statusLog/{id}   { read: isClubAdmin() || isPlatformAdmin(); create: isPlatformAdmin() + shape; update, delete: false }

  match /teams/{teamId} …  every existing rule, with its superadmin check replaced by isClubAdmin(),
                           every write additionally requiring activeMember(),
                           every read requiring activeMember() || exporter()
  match /exercises/…, /trainings/…, /counters/…, /config/{doc}, /sectionAccess/{s}   same treatment
}
```

Rules for the operator, stated explicitly so a test can hold each one:
1. `isPlatformAdmin()` appears **only** in rules on `clubs/{clubId}` itself, `acceptances`, `statusLog`, `interestSignups`. Never inside `teams`, library, config, sectionAccess or members.
2. Platform admin club updates may change only `status`, `statusReason`, `statusChangedAt` (== request.time), `statusChangedBy` (== email()), `lastStatusLogId` (with `existsAfter` on that log doc), `termination.effectiveAt`, `termination.retrievalEndsAt`, `billing`. Transition must be in the allowed table (§4). On reinstate (terminating → active) only, `termination.requestedAt/requestedBy` may also change, and only to `null`.
3. Club admin club updates may change only `name`, `country`, `locale`, `aiEnabled`, `referenceOptOut`, `growthTestsEnabled`, `legal` (with `existsAfter` on the matching acceptance), `ownerEmail` (only to another member with role `admin` — ownership transfer), `termination.requestedAt/requestedBy` (while `active` or `suspended`; a suspended club, e.g. for non-payment, can still ask to leave).
4. If the operator is also a member of a club (the operator is, of the migrated club), the operator gets that club's data through membership like any member — not through platform admin.

The deferred design's lookup budget still holds: the heaviest existing rules use 3 lookups; adding club + member makes 5 (club and member docs are shared across the helpers), under the limit of 10. The team-local `isTeamAdmin()` copy-pasted 8 times becomes one function inside the `teams/{teamId}` match.

`sectionAccess` writes keep requiring `adminEmails is list` and now forbid extra keys.

## 6. Sign-up and the legal acceptance

### 6.1 Flow
1. **Entry.** `/login` gains "Create your club" next to sign-in; the public page `/signup` explains the steps (name the club → accept terms → wait for activation) and links the legal documents.
2. **Sign in** with the existing email link.
3. **Club details** (`/signup/club`, signed in, user has no pending club): club name, country, default language, the person's name, and a required checkbox "I am authorised to act for this club and accept these terms on its behalf".
4. **Read and accept** Terms and DPA (rendered from the versioned legal documents; both must be scrolled/opened — a link to each, a checkbox for each).
5. **Specific approval ("sign").** A dedicated screen lists the clauses that need specific approval (list comes from the legal design, §5 there), each with its number, heading and full text, and a single "Approve these clauses specifically" action. That action **re-authenticates by a fresh email link** ("We've sent a confirmation link to x@club.it — open it to sign"). Returning from the link completes the batch in §6.3 within 15 minutes of that fresh sign-in. The link is a one-time code sent to the signer's email, which is the e-signature step the Cassazione ruling asks for; whether it is sufficient is **flagged for the Italian lawyer** (legal design §8).
6. **Pending screen** (§8.3).

The same specific-approval step is used for all clubs, not only Italian ones (one flow, no country branching; the legal research recommends building it now to avoid re-papering after the Italy move).

### 6.2 The acceptance record — `clubs/{clubId}/acceptances/{versionKey}`

| Field | Value |
|---|---|
| `versionKey` | e.g. `terms-2026-11-01_dpa-2026-11-01` (doc id) |
| `termsVersion`, `dpaVersion` | version strings |
| `language` | language of the texts shown (`en`/`it`) |
| `termsSha256`, `dpaSha256`, `clausesSha256` | SHA-256 (Web Crypto) of the exact texts shown, computed client-side from the same strings rendered |
| `specificClauses` | array of clause ids approved |
| `acceptedBy` | == email() |
| `acceptedByName` | string |
| `authorityConfirmed` | true |
| `acceptedAt` | == request.time |
| `authTime` | == `request.auth.token.auth_time`; rules require `auth_time` within 15 min of request.time |
| `userAgent` | navigator.userAgent (≤ 300 chars) |

**The operator never signs for a club**: acceptance creates are refused when `exists(platformAdmins/email())`, so the operator cannot be on both sides of the contract, including for the operator's home club (rules test).

Not captured: the IP address (no server on Spark). Recorded as a known gap; revisit when Cloud Functions arrive with payments. The operator keeps acceptance records as the operator's own controller data (evidence), so they survive club deletion in the tombstone (§7.4).

The app also keeps the hashed texts reproducible: every published version's text stays in the repo (`src/legal/content/<lang>/<doc>-<version>.md`), so a hash can be re-verified later.

### 6.3 The sign-up batch (one atomic write)
- `clubs/{clubId}` with `status: 'pending'`, `ownerEmail == email()`, `createdAt == request.time`, `legal.versionKey` set, `termination` all null, `billing: null`.
- `clubs/{clubId}/members/{email}` with `role: 'admin'`, `email == email()`, `clubId == clubId`.
- `clubs/{clubId}/acceptances/{versionKey}` as above.

Rules: club create requires `!exists(club)`, the shape above, `existsAfter` + `getAfter` checks on the member doc (admin, own email) and the acceptance doc (fresh auth, own email, matching `versionKey`). Member and acceptance creates during sign-up are allowed only when `getAfter(club).status == 'pending' && getAfter(club).ownerEmail == email() && !exists(club)` — so nobody can attach themselves to an existing club this way.

Spam: anyone signed in can create pending clubs; a pending club holds nothing but a name and the creator's email, and the operator rejects it. The client prevents a second pending club per person (collection-group query result); rules do not (no query in rules). Accepted risk, noted.

### 6.4 New legal versions
Each published version in `src/legal/versions.ts` carries `{ version, announcedAt, effectiveFrom, material: boolean }` (legal design §9). Behaviour:
- **From `announcedAt` to `effectiveFrom`** (≥ 30 days for Terms/DPA changes): club admins see a non-blocking banner "Updated terms take effect on <date> — review" linking to the new text and a diff summary. This is the in-app notice the Terms promise; the email notice is the operator's manual email to each club's `ownerEmail` (the texts say exactly that).
- **From `effectiveFrom`**, if `material`: club admins get the blocking review screen with the accept + specific-approval flow, writing a new acceptance doc and updating `club.legal`. Members keep working; the club is not suspended. Rejecting offers "End our contract" (termination right on changes).
- If not `material` (typos, clarifications): no re-acceptance; the version in force is recorded by date.
- The **sub-processor list is versioned separately** (`subprocessors` version with its own `announcedAt`/`effectiveFrom`) and is **not** part of the hashed DPA, so adding a sub-processor triggers the 30-day notice banner and the objection route, not a re-signature. The acceptance record stores the sub-processor list version in force at signing (`subprocessorsVersion`).

> **Resolved (Plan 3, 2026-10-23).** Sign-up and legal acceptance are built as §6 describes, with these decisions:
> version ids are ISO dates and `versionKey = terms-<terms>_dpa-<dpa>` (P1, P2); the signer re-authenticates by a fresh
> email-link sign-in (`auth_time` at most 15 minutes old and `firebase.sign_in_provider == 'password'`, which is how the Auth
> SDK reports an email-link sign-in; the provider cannot be turned off while email links are on, so the rules require
> `email_verified` on every request) and the client commits within
> 14 minutes (P6, P8); the new club id is a 20-character auto id kept in the draft (P7, P11); new clubs start with AI,
> growth tests and reference opt-out off; after the commit the app reloads at `/` (P9); club admins with an outdated accepted
> version get the blocking review screen, except a platform admin (non-blocking notice naming `ownerEmail`) and a club that
> already asked to terminate (non-blocking notice) (P10); the signing language is chosen on the signing screens and stored in
> the acceptance (P13); award photos of minors need `player.photoConsent` (P12). The acceptance record gained
> `authTime`, `userAgent`, `acceptedByName`, `authorityConfirmed` and `clausesSha256`.

## 7. Club administration, export, deletion

### 7.1 Club area (club admins)
`/club` (replaces `/admin/access`), with tabs:
- **Profile** — name, country, default language.
- **People & access** — today's AccessManager, scoped to the active club, with one addition: adding a person creates their `members/{email}` doc (role admin/member) in the same batch as their grants; removing a person removes the member doc and their grants. The last admin cannot be removed or demoted (UI; rules keep `ownerEmail` admin — builder may relax with an "ownership transfer" later).
- **Guides** stays at `/admin/guides` (section-gated, unchanged).
- **Export** — §7.2.
- **Contract** — status, accepted versions (with links to the texts), "End our contract" (writes `termination.requestedAt/By`; the operator then sets the dates), contact email of the operator.

`interestSignups` panel moves out of the club area to the platform area.

### 7.2 Export (free, self-service)
One button builds a ZIP in the browser (small dependency such as `fflate`; builder's choice) containing:
- `README.txt` — what each file is, field meanings, formats (this doubles as the Data Act "data structures and formats" information);
- `club.json`, `members.json`, `acceptances.json`, `statusLog.json`;
- `teams/<teamId>/team.json`, `players.json` (with `physicalTests`), `players.csv`, `calendar.json`, `testingSessions.json` (with entries), `awards.json`, `scoutProfile.json`, `matches/<matchId>.json` (match + all events);
- `library/exercises.json` (with diagrams), `library/trainings.json`, `library/counters.json`;
- `config/skillGuide.json`, `config/physicalTestGuide.json`, `sectionAccess.json`.

Builds on `src/teams/teamExportApi.ts`. Export is the one sanctioned "read everything" operation: it reads in paginated chunks (`limit(500)` + cursor), shows progress, and runs only for `exporter()`. Timestamps as ISO strings. Works in `active`, `suspended`, `terminating`. The same export serves GDPR access/portability requests the club receives and later FERPA return-of-data clauses.

### 7.3 Suspended / terminating experience
- Members: a full-page notice, sign-out button, nothing else routed.
- Club admins: the club area restricted to Profile (read-only), Export, Contract; a banner with `retrievalEndsAt` when terminating.

### 7.4 Deletion (operator script)
`scripts/ops/purgeClub.mjs --club <id>` (Admin SDK, service account, like seeding):
- refuses unless (`status == 'terminating'` and now > `retrievalEndsAt`) or (`status == 'deleted'` and the club was rejected while pending — it holds only the club doc, the creator's member doc and the acceptance), and asks for typed confirmation;
- deletes every subcollection under the club (recursive delete), the member docs, then reduces `clubs/{clubId}` to a **tombstone** `{ name, country, ownerEmail, createdAt, status: 'deleted', statusChangedAt, legal }` and keeps `acceptances` and `statusLog` (operator's evidence of the contract, no player data);
- prints a summary for the operator's records.
Firebase Auth accounts are not deleted (a person may belong to other clubs).

**A person's own deletion request** (not in this increment's code): a person's member doc and grants are club data, so removing them is the club's act (People & access). The operator handles only what is the operator's: once the person has no memberships left, the operator deletes their Auth account and `users/{uid}` by hand in the console. Acceptance records and status logs keep the email as contract evidence (legal basis: legitimate interest / legal claims, stated in the privacy notice). A script can come later if volume demands it.
Backups: the operator's encrypted backups are kept at most 35 days, the window the DPA states (legal design D8; `docs/superpowers/specs/2026-10-22-volley-skills-backup-and-operator-access-design.md`). If Google-managed backups are enabled later, their retention must be ≤ that window.

## 8. App changes

### 8.1 Path helper
`src/firebase/clubPaths.ts`: `clubCol(...segments)` / `clubDoc(...segments)` build paths under `clubs/{activeClubId}`. The active club id is set by `AuthProvider` through a module-level setter (Api modules are not hooks). Every path in the 18 files listed by the exploration (17 `*Api.ts` + `src/auth/access.ts`) goes through it. `users`, `platformAdmins`, `interestSignups`, `clubs` (list) stay top-level helpers. Phase 1 of the plan can land the helper returning today's top-level paths (no behaviour change) before the rules switch.

### 8.2 Auth context
`useAuth()` gains:
- `memberships: { clubId, role }[]` (collection-group query on sign-in),
- `club: Club | null` (the active club doc, subscribed live so a status change reaches open tabs),
- `activeClubId`, `switchClub(id)` (stores `vcb.activeClub` in localStorage, then reloads the page so every subscription and cursor resets),
- `isPlatformAdmin` (probe `getDoc(platformAdmins/{email})`),
- `access` resolved for the active club: `isClubAdmin` (replaces `isSuperAdmin`), `sections` (probe as today, under the club path), team admin as today.

`ensureUserDoc` stops writing `role` (the frozen-role gotcha from the exploration disappears with it).

### 8.3 Routing and guards
| Situation | Shown |
|---|---|
| Signed in, no memberships | `/welcome`: "Create a club" (→ `/signup/club`) or "Ask your club admin to add <email>" |
| Active club `pending` | pending screen: club name, accepted documents, "We'll email you when it's active", sign out |
| Active club `suspended`, or `terminating` after `effectiveAt` | §7.3 |
| Active club `terminating` before `effectiveAt` | today's app + banner "Your contract ends on <date>; export your data before <retrievalEndsAt>" |
| Active club `deleted` (or membership gone) | drop `vcb.activeClub`, fall back to another membership or `/welcome`, with a one-time notice |
| Active club `active` | today's app |
| Legal version outdated, user is club admin | review screen (§6.4) before the app |

Guards: `RequireSuperAdmin` → `RequireClubAdmin`; new `RequirePlatformAdmin`; `RequireSection` unchanged in shape. A club switcher in the account menu appears only when `memberships.length > 1`.

**URLs stay club-less** (builder's call): the active club lives in `vcb.activeClub`, not the path, so every existing link keeps working for single-club users (nearly everyone). For a person in several clubs, a link from another club ends in a not-found/permission state; that page shows "This may belong to another of your clubs" with the club switcher. A `/c/:clubId` prefix can come later if cross-club links become common.

### 8.4 Platform area (`/platform`, `RequirePlatformAdmin`)
- **Clubs**: table — name, country, owner email, status, created, accepted legal version, termination dates. Filter by status. Actions per row:
  - **Activate** (pending or suspended → active),
  - **Deactivate** (active → suspended; reason required),
  - **End contract** (active/suspended → terminating; `effectiveAt` default now, `retrievalEndsAt` default +30 days, ≥ 30 enforced in UI),
  - **Reject** (pending → deleted; a pending club has no data, so this is a direct status change plus a later tombstone purge),
  - **Reinstate** (terminating → active).
  Each action writes the club update and a `statusLog` entry in one batch, with a confirm dialog. The page never shows or links to club data. "End contract" and "Reject" go beyond "activate/deactivate" because the law requires an end-of-contract path (§4); kept visually secondary.
- **Leads**: the existing `AccessRequestsPanel` (interest sign-ups), moved here.
- Operator notification to clubs is manual (email from the operator's own mailbox) — no email sending without a server.

### 8.5 Club name reads
`homeFeed.clubName` and the awards card/story read `club.name`. `TeamsListPage` stops showing `team.club`. Team forms drop the club field.

### 8.6 SEO
`/signup`, `/legal/terms`, `/legal/dpa`, `/legal/subprocessors` are public and indexable alongside `/login`, `/privacy`, `/request-access` (update `src/seo/seoRoutes.ts`, `firebase.json` headers and the home-stats spec's list).

## 9. Migration of the current club

One-off script `scripts/migrate/2026-xx-club-platform.mjs` (service account), rehearsed on the emulator with a production export first:
1. Create `clubs/{clubId}` (id chosen by operator, e.g. a slug) with `status: 'active'`, `name` = the most common `team.club`, `country`, `locale`, `aiEnabled: true`, `growthTestsEnabled: true`, `legal: null` (forces the §6.4 review for its admins on first visit — the club signs the DPA like everyone else). `ownerEmail` is a **run-time argument** (`--owner <email>`): an officer authorised by the club (president, secretary or technical director), **never the operator** — the operator decided to name that person at migration time. Until that person accepts, the club stays active and its admins see the review screen; the operator's own account is a plain member/admin of the club and cannot accept (§6.2).
2. Members: every `adminAllowlist` email → `admin`; every email in any `teams.adminEmails`, `players.viewerEmails` or `sectionAccess.*.adminEmails` → `member` (lowercased, de-duplicated).
3. `platformAdmins/{operator email}`.
4. Copy every top-level club-global collection and every `teams/**` subtree under the club root, **preserving document ids**; lowercase email arrays; drop `team.club`. Strip `role` from `users` docs.
5. Verify counts per collection (printed), then deploy rules + app together.
6. Keep the old top-level collections denied-by-rules (not deleted) for a grace period of two weeks; then a second script deletes them.
7. Offline caches: the release bumps a `vcb.schemaVersion` key; on mismatch the app runs the existing terminate + `clearIndexedDbPersistence` path once.

Free-tier write quota: if document count × 2 exceeds the daily write quota, the script resumes from a checkpoint the next day.

Seeds: `seed.mjs`, `seedLibrary.mjs`, `seedMatch.mjs`, `seedMen1.mjs`, `backfillSummaries.ts`, `applyNumbers`, `import/exportPlayers` take `--club` (default `demo`). `npm run seed:emulator` creates: club `demo` (active, operator as admin, today's seed data), club `rival` (active, a different admin, a little data) so isolation can be seen by hand, one `pending` club, and `platformAdmins/<operator>`. `scripts/seed/README.md` updated.

**Resolved (Plan 4):**
- **Script names.** The migration is `scripts/migrate/2026-10-club-platform.mjs`. Its modes:
  - `--rehearse` reads production and writes only to the local emulator (its `--dry-run` needs no emulator), which is the "rehearsed on the emulator with a production export" step;
  - `--prod`;
  - `--dry-run`;
  - `--resume`.
- **The checkpoint is the destination itself.** `--resume` skips docs that already exist, so no local checkpoint file is kept.
- **Verification** counts the docs under each `clubs/<id>/<group>` against the plan. On a resume, a count may be higher than planned.
- **Old top-level data.** `scripts/migrate/dropLegacy.mjs` deletes it once `clubs/<id>.createdAt` is 14 days old.
- **Cache reset (step 7).** The app clears the persistent Firestore cache once, before the first render. Firestore has not started yet at that point, so neither terminate nor reload is needed. Other open tabs are asked to let go of the cache and stop syncing until reloaded. A tab that does not answer (frozen in the background) holds the delete: after 3 s the app renders anyway but waits on Firestore until that tab is closed, and a later load retries.
- **Read quota.** The scripts walk the known subcollections instead of listing each doc's subcollections, and verification counts leaf collections with `count()` aggregations, so a pass costs about one read per doc. The dry run prints the figure, and the runbook spreads passes over days when it is large.
- **Export reads come from the server only** (`readAllFromServer`, `getDocFromServer`), so an export taken while offline fails instead of zipping the cache.
- **Purge.** It also writes a "Data purged" `statusLog` entry, as evidence. A `deleted` club may always be purged: the lifecycle reaches `deleted` only by rejection while pending, or by an earlier purge.
- **Export.**
  - `config` is read by document id, because its rule names the ids and a list would be denied. Every other collection is read in id-ordered pages of 200 (`readAll`).
  - The ZIP also carries `players.csv` per team. Its README lists every file and the key fields.
- **Rehearsal tests.** The emulator tests of the scripts live in `tests/rules/*.test.mjs`.

## 10. Testing

Rules tests are the real verification (CLAUDE.md). All 18 existing files move to club paths using one fixture `seedClub(env, { id, status, admins, members, teams })` in `tests/rules/testEnv.ts`. New files:
- `crossClub.rules.test.ts` — a matrix over every collection under `clubs/{id}`: admin of A cannot get/list/create/update/delete in B; member of A likewise; a team admin email listed on a B team without B membership gets nothing.
- `platformAdmin.rules.test.ts` — can list/get clubs, write allowed status transitions only, write statusLog; **cannot** read members, teams, players, matches, events, library, config, sectionAccess of any club; cannot change profile or legal fields; disallowed transitions fail.
- `lifecycle.rules.test.ts` — per state × role: what reads/writes succeed (pending: nothing but club/member/acceptance; suspended: admin reads only, member nothing, no writes; terminating **before** `effectiveAt`: full use; between `effectiveAt` and `retrievalEndsAt`: admin reads only; after `retrievalEndsAt`: nothing; deleted: nothing). Time cases are set by seeding `effectiveAt`/`retrievalEndsAt` relative to now.
- `signup.rules.test.ts` — valid batch passes; missing acceptance, stale `auth_time`, wrong email, non-pending status, existing club id, attaching to someone else's club, extra keys: all fail.
- `members.rules.test.ts` — collection-group read only of own email; admins manage members; members cannot self-promote.
- `acceptances.rules.test.ts` — immutable; readable by club admins and platform admin only.

Unit/component tests: `clubPaths`, the auth context's routing table (§8.3), sign-up form validation, the specific-approval screen (lists exactly the clauses from the legal content), export file builder (pure: docs in → file map out), platform page actions (confirm + batch shape). Migration script: an emulator rehearsal test or a documented manual checklist (builder's call).

## 11. Constraints and facts the builder must check first
- **Firestore region — verified 2026-10-20:** `firebase firestore:databases:get "(default)" --project volley-skills` reports `eur3` (EU multi-region). The DPA's EU-storage promise holds. Record it in `docs/PRODUCTION-READINESS.md`.
- Firebase Auth data location and reCAPTCHA (App Check) processing are Google US services under the DPF; they go on the sub-processor list (legal design).
- `request.auth.token.auth_time` behaviour with email-link re-auth (fresh value after `signInWithEmailLink`) — verify in the emulator before building §6.1 step 5 on it.

## 12. Left to the builder
- ZIP library and file layout details inside the export.
- Exact UI of the club area, platform table and pending screen, within the design-system spec.
- Whether Phase 1 (path helper with top-level paths) ships as its own commit before the rules switch.
- Migration rehearsal approach.
- Copy for every new screen (English source; Italian per the Italian design).

## 13. Suggested build order (the plan decides)
1. Path helper + types (no behaviour change). 2. Rules + rules tests under `clubs/`. 3. Auth context, active club, guards, routing table. 4. Club area (profile, people & access, contract). 5. Sign-up + acceptance + specific approval (needs legal content v1). 6. Platform area. 7. Lifecycle screens + export. 8. Seeds, migration script, rehearsal. 9. Docs: CLAUDE.md architecture section, access-model spec, seed README.

Programme order across the four designs: club platform → legal documents (content can be drafted in parallel; the sign-up step consumes it) → DataVolley import → Italian (last, because it touches every screen, including the new ones from the first three).
