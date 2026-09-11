# Volley Skills App — Design Spec

Date: 2026-09-04
Status: Approved for planning

## 1. Purpose

Replace the `VCB_U17_PlayerCards_2026-27.xlsx` spreadsheet with a web application for Volley Club Belair (VCB) to manage teams, player profiles (skills + development plans), a shared exercise/training library, and per-team training calendars. Single club, not multi-tenant.

## 2. Source Data (reference)

`reference/VCB_U17_PlayerCards_2026-27.xlsx` contains, per U17 2026-27 team:
- An **Overview** sheet: roster with per-player skill scores, average, and level, auto-aggregated.
- A **Skills Guide** sheet: for each of 8 fixed skills, a text description of what a 1-3 / 4-6 / 7-8 / 9-10 score means, plus "how to evaluate" notes.
- One **player sheet** per player: contact & registration (name, DOB, nationality, license #, position, phone, guardians' name/phone/email), 8 skill scores (1-10) with coach notes and a priority flag, an auto-computed average and level label, and a development plan (short-term objectives, season-long objectives, general notes).

The 20 existing players are migrated into the app as seed data (Section 9).

Players are minors (ages 13-15) and the data includes parental contact details — this drives the legal/compliance requirements in Section 7.

## 3. Scope Decisions

- **Single club** — no multi-tenant organization concept. Any admin can create teams within this one club.
- **Fixed skill list** — the 8 skills and 1-10 scale are hardcoded in the app. Admins can only edit the guide *text* per score range, not the skill set itself.
- **Two roles**: `admin` (can create/manage teams, players, the skill guide, and the exercise/training library) and `viewer` (read-only access to exactly one player card — their own child's). Viewer-to-player linking mechanism is a known TBD (Section 6.4).
- **Admin provisioning**: manual allowlist of emails maintained by the club owner (via Firebase console/admin script), not self-serve signup.

## 4. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite |
| Routing | React Router, `BrowserRouter` (clean URLs — see Section 8) |
| Styling | Tailwind CSS |
| Auth | Firebase Auth, Email Link (passwordless) sign-in |
| Database | Firestore |
| Authorization | Firestore Security Rules only — no Cloud Functions, stays on Firebase's free Spark plan |
| Hosting | Firebase Hosting |
| CI/CD | GitHub Actions → Firebase Hosting on merge to `main` |
| Testing | Vitest, React Testing Library, `@firebase/rules-unit-testing` |

### Why Firebase Hosting instead of GitHub Pages

The original plan was GitHub Pages, but plain GitHub Pages can't do server-side rewrites, so clean URLs (`/teams/123` instead of `/#/teams/123`) require either hash routing or a 404-redirect hack. Since the app already depends on Firebase for Auth + Firestore, Firebase Hosting gives real SPA rewrites, free HTTPS/CDN, and one platform/console to manage — so GitHub Pages is dropped entirely. GitHub remains the source-control host and CI runner.

## 5. Data Model (Firestore)

```
adminAllowlist/{email}                — allowed admin emails. No client access at all (read/write: false).
                                          Managed only via Firebase console or an admin script.

users/{uid}
  email, role: 'admin' | 'viewer'
  — created on first sign-in. A user may only set role='admin' on their own doc if
    their email exists in adminAllowlist (checked in rules); otherwise role='viewer'.

teams/{teamId}
  name, club, ageGroup, season, description, notes
  adminEmails: [email, ...]           — who has admin access to this team (team settings).
                                         Email-keyed (not uid-keyed) so granting access
                                         never requires looking up another user's uid —
                                         same pattern as a player's viewerEmails below.
  developmentPlan: {
    shortTermObjectives: [{ objective, targetDate, status, coachComment }],
    seasonObjectives:    [{ objective, target, status, coachComment }],
    generalNotes
  }
  createdBy, createdAt

teams/{teamId}/players/{playerId}
  number, fullName, dob, nationality, licenseNumber, position (free text — source
    spreadsheet uses inconsistent values like "OH", "OH/OP", "Beginner", "All-round
    (developing)", so this is not a fixed enum), playerPhone
  guardians: [{ relation, name, phone, email }]
  viewerEmails: []                    — reserved; invite flow TBD (Section 6.4)
  teamName, ageGroup, season           — denormalized from the parent team so a viewer
                                          never needs read access to the team doc
  skills: {
    serve:     { score, notes, priority },
    attack:    { score, notes, priority },
    set:       { score, notes, priority },
    defence:   { score, notes, priority },
    reception: { score, notes, priority },
    jump:      { score, notes, priority },
    speed:     { score, notes, priority },
    iq:        { score, notes, priority }
  }
  avgScore, level                     — computed on write: avgScore = mean of the 8
    skill scores (blank/unset skills excluded); level = 'Beginner' if avgScore < 4,
    'Developing' if < 6, 'Advanced' if < 8, else 'Elite' (matches the spreadsheet's
    existing formula)
  developmentPlan: { same shape as team's developmentPlan }
  consent: { given: bool, date, confirmedBy }
  createdBy, createdAt, updatedAt

teams/{teamId}/players/{playerId}/physicalTests/{testId}
  — one doc per single measurement event. Each of the 8 test qualities has its own
    independent timeline (not a combined "battery session"), so a player can have
    e.g. a new sprint time logged in March and a new jump height logged in June,
    unrelated to each other.
  testType: 'growth' | 'cmj' | 'approachJump' | 'broadJump' | 'sprint10m'
          | 'shuttle5105' | 'reaction' | 'strength'
  date (ISO string "YYYY-MM-DD")
  — fields present depend on testType. Where a test protocol calls for multiple
    attempts, the raw attempts are stored and the app computes the best (max, or
    min for time-based tests) — never the coach doing that comparison by hand:
      growth:       { heightCm, bodyMassKg }                    // single measurement
      cmj:          { attemptsCm: [n, n, n], bestCm }           // countermovement jump,
                                                                 // hands on hips; bestCm = max(attemptsCm)
      approachJump: { standingReachCm,                          // measured once
                       attemptsTouchCm: [n, n, n], bestTouchCm, // max(attemptsTouchCm)
                       approachJumpCm }                         // bestTouchCm - standingReachCm
      broadJump:    { attemptsCm: [n, n, n], bestCm }           // standing broad jump; bestCm = max(attemptsCm)
      sprint10m:    { attemptsSeconds: [n, n, ...], bestSeconds } // bestSeconds = min(attemptsSeconds)
      shuttle5105:  { rightFirstSeconds, leftFirstSeconds }     // run both directions; no
                                                                 // combined "best" — the
                                                                 // asymmetry between the two
                                                                 // is itself the useful signal
      reaction:     { attemptsCm: [n, n, n, n, n],              // 5 raw drops
                       averageCm,                               // mean of the middle 3 after
                                                                 // discarding the best and worst
                       reactionTimeMs }                          // computed from averageCm via
                                                                 // t = sqrt(2d/9.81), d in metres
      strength:     { mode: 'weighted' | 'bodyweight',
                       // mode: 'weighted' (gym available) —
                       exercise: 'trapBarDeadlift' | 'squat' | 'gobletSquat',
                       weightKg, reps6RM: 6,
                       bodyMassRatio,                            // weightKg / most recent known
                                                                  // bodyMassKg, snapshotted at
                                                                  // entry time so it doesn't
                                                                  // silently drift if a later
                                                                  // growth entry changes body mass
                       // mode: 'bodyweight' (no gym) — muscular-endurance fallback,
                       // never a lower-quality invented weighted test:
                       exercise: 'pushUps' | 'splitSquat', reps }
  notes, recordedBy, createdAt

skillGuide/config                     — single global doc
  skills: [
    { key, label,
      ranges: [{ min, max, description }, ...],   // 1-3, 4-6, 7-8, 9-10
      howToEvaluate }
    , ... 8 entries
  ]
  updatedBy, updatedAt

physicalTestGuide/config              — single global doc, same admin-editable-text
                                         pattern as skillGuide/config, but for testing
                                         protocol instead of scoring bands
  tests: [
    { key, label, protocol }             // protocol = free text describing how to
                                          // administer that test (setup, attempt count,
                                          // rest periods, equipment) — e.g. seeded from
                                          // the coach's own written testing protocol
    , ... 8 entries (growth, cmj, approachJump, broadJump, sprint10m,
                      shuttle5105, reaction, strength)
  ]
  updatedBy, updatedAt

exercises/{exerciseId}                — global shared library
  name, description
  category: 'warmup' | 'physical' | 'service' | 'setting' | 'defense'
          | 'reception' | 'attack' | 'compound' | 'game'
  createdBy, createdAt

trainings/{trainingId}                — global shared library
  businessId                          — e.g. "TR-0007", auto-generated (see counters/trainings)
  name, description, ageGroupTarget
  exercises: [{ exerciseId, order, durationMinutes }]
  createdBy, createdAt

counters/trainings                    — { lastSequence: number }
  — incremented inside a Firestore transaction on training creation to produce businessId.
    Firestore has no native auto-increment; this is the standard pattern for it.

teams/{teamId}/calendar/{sessionId}   — subcollection per team
  date (ISO string "YYYY-MM-DD", not a Timestamp — enables simple lexicographic
    range queries for the month view), trainingId, notes, createdBy, createdAt
  — multiple sessions may share the same date.
```

## 6. Authorization Model

> **Superseded** by `docs/superpowers/specs/2026-09-11-volley-skills-access-model.md` (the section-scoped access model — `superadmin`/`member` roles, per-team + per-section grants). The section below describes the original `admin`/`viewer` design and is kept for history only.

All authorization is enforced in **Firestore Security Rules**, reading role/membership data directly from documents (no custom auth claims, no Cloud Functions — keeps the whole app on Firebase's free tier).

1. **`adminAllowlist`**: never readable or writable by any client. Sole gate on who can become an admin.
2. **`users/{uid}`**: a user can read/write their own doc; may only write `role: 'admin'` if `adminAllowlist/{their email}` exists.
3. **`teams/{teamId}`**: read/write only if `request.auth.token.email` is in `resource.data.adminEmails`.
4. **`teams/{teamId}/players/{playerId}`**: admins of the parent team can read/write. A viewer can read a single player doc only if their auth email is in that doc's `viewerEmails` (Section 6.4).
5. **`teams/{teamId}/players/{playerId}/physicalTests/{testId}`**: same access as the parent player doc — team admins read/write; the linked viewer gets read-only (checked via `get()` on the parent player doc's `viewerEmails`).
6. **`teams/{teamId}/calendar/{sessionId}`**: same as players — team admins only. Out of scope for viewers.
7. **`exercises`, `trainings`, `counters/trainings`**: readable/writable by any user with `role == 'admin'` (club-wide shared resource, not team-scoped).
8. **`skillGuide/config`, `physicalTestGuide/config`**: readable by any signed-in user (so a viewer can see what their player's scores/tests mean); writable by admins only.
9. All rules additionally validate data shape on write (e.g. `score` must be a number 1-10, required fields present) as defense in depth beyond client-side form validation.

### 6.4 Viewer invite flow — TBD

How a parent's email actually gets added to a player's `viewerEmails` (and how they're told to sign in) is **explicitly deferred**. The schema field exists; the invite UI/flow ships in a later iteration. Until then, the `admin` role is the only functioning one end-to-end.

## 7. Screens

- `/login` — email-link sign-in.
- `/teams` — teams the signed-in admin has access to; "Create team."
- `/teams/:teamId` — description/notes, roster overview (mirrors the spreadsheet's Overview tab: number, name, position, age, 8 skill scores, average, level), team development plan, **Calendar** tab (month view; assign a training from the shared library to a date), **Settings** tab (manage `adminEmails`, edit team info).
- `/teams/:teamId/players/:playerId` — full player card (contact info, skills with guide text shown inline, coach notes, priority flags, development plan, **Physical Testing** section). Edit mode for team admins; read-only render when accessed by that player's linked viewer.
  - Physical Testing shows the 8 test qualities as rows, each with its latest computed value (e.g. best CMJ, approach jump height, reaction ms) + date, an "Add new" action opening a test-specific entry form (raw attempts in, computed result shown immediately), and a "View history" action opening a paginated timeline for that one quality (cursor pagination, per Section 8).
- `/exercises` — paginated library list, filter by category, create/edit (admin only).
- `/trainings` — paginated library list, filter by age group / business ID, create/edit with an ordered exercise picker (order + duration), admin only.
- `/admin/guides` — two tabs: **Skill Guide** (edit the 8 skills' range descriptions and how-to-evaluate text) and **Physical Test Guide** (edit the 8 tests' protocol text). Admin only.
- `/privacy` — public static privacy policy page.

## 8. Smart Fetching

No view performs an unbounded collection read. Specifically:

- **Exercises / Trainings libraries**: `orderBy(...).limit(25)`, with a "Load more" button using cursor pagination (`startAfter(lastVisibleDoc)`) — not offset-based paging, which Firestore doesn't support cheaply. Category/age-group/business-ID filters are `where()` clauses combined with the same limit+cursor pattern, backed by composite indexes.
- **Team calendar**: queries only the visible date range (e.g. the current month); navigating months re-queries rather than loading full history.
- **Teams list / team roster**: inherently small per user (a handful of teams, ~20 players per team) — fetched in full for that scope, but still capped with a defensive `limit()`.
- **Physical Testing "latest" row per quality**: rendered via up to 8 small indexed queries (`where('testType','==',x).orderBy('date','desc').limit(1)`), one per quality — not a fetch of the whole `physicalTests` subcollection. "View history" for one quality then paginates that single `testType` with the same limit+cursor pattern.

## 9. Migration

A one-time Node.js script (using the `firebase-admin` SDK with a locally-held, gitignored service-account key — never committed) reads `VCB_U17_PlayerCards_2026-27.xlsx` and writes: one `teams` doc, the `skillGuide/config` doc (from the Skills Guide sheet), and 20 `players` docs (from the 20 player sheets). Run manually once against the live Firestore project.

Imported players are seeded with `consent: { given: false }` — the spreadsheet predates the app's consent flow, so consent is not assumed on migration. An admin must explicitly confirm consent per player (via the same UI flow as new players) after import.

## 10. Legal & Compliance (baseline)

- Public privacy policy page describing what data is collected, why, who can see it, retention, and a contact point for data requests — explicitly addressing that subjects are minors and guardians are the consent-giving party.
- A required consent checkbox when a player record is created ("I confirm parental/guardian consent has been obtained to store this player's data"), stored as `consent.given/date/confirmedBy` on the player doc.
- Data minimization: only the fields already present in the source spreadsheet are collected — nothing additional.
- Admin-triggered **export** (structured data dump) and **hard delete** on any player record, covering GDPR access/erasure rights without a formal ticketing workflow.
- No third-party analytics or tracking scripts in the app, given minors' data is involved.
- Encryption in transit (HTTPS, enforced by Firebase Hosting) and at rest (Firestore default).

## 11. Security Hardening (cyber)

- Deny-by-default Firestore rules (Section 6) as the actual access-control boundary, with data-shape validation on write.
- Firebase App Check enabled (free) to block traffic that isn't coming from the real app.
- Dependabot enabled on the GitHub repo for dependency vulnerability alerts.
- No secrets committed to the repo: the migration script's service-account key stays local and gitignored; the CI deploy service account lives only in GitHub Actions secrets.
- CSP headers configured via `firebase.json`.
- Repo is public (acceptable — no proprietary logic, and Firebase web config is not a secret; security comes entirely from Firestore rules).

## 12. CI/CD

GitHub Actions:
- On every pull request: install, lint, typecheck, build, run tests (Vitest + rules tests).
- On merge to `main`: same checks, then deploy to Firebase Hosting.

## 13. Testing Strategy

- **Firestore rules tests** (`@firebase/rules-unit-testing`) are the highest priority — they verify the actual security boundary: a viewer cannot read another player, cannot write anywhere, an admin cannot access a team they're not in `adminEmails` for, etc.
- **Unit tests** (Vitest) for pure logic: skill average/level computation, training `businessId` sequence generation, and the physical test computations (best-of-attempts for CMJ/broad jump/sprint, approach-jump subtraction, reaction time discard-extremes-and-average plus the ms conversion formula, strength body-mass ratio).
- **Component tests** (React Testing Library) for the critical forms: player card edit, skill guide edit, training builder (exercise picker with order/duration).

## 14. Open Items / Deferred

- Viewer invite flow (Section 6.4) — schema exists, UI/flow deferred to a later iteration.
- Firebase Hosting PR preview channels — nice-to-have, not required for MVP.
