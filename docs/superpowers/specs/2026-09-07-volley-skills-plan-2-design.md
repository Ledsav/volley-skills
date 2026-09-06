# Volley Skills App — Plan 2 Design: Backlog Cleanup, Development Plans, Physical Testing

Date: 2026-09-07
Status: Approved for planning
Companion to: `2026-09-04-volley-skills-app-design.md` (data model, security model), `2026-09-04-volley-skills-design-system.md` (tokens, components)

## 1. Purpose

Plan 2 closes gaps surfaced by Plan 1's final review and builds the next two features from the original app design spec: development plans (team + player) and physical testing. This doc specifies the UI/component-level design that the app design spec left at the data-model level.

## 2. Backlog Cleanup (opens Plan 2)

### 2.1 Add-player form

A new form on the team page (Overview tab or a "+ Add player" affordance near the roster table) collecting:
- `number`, `fullName`, `dob`, `nationality`, `licenseNumber`, `position`, `playerPhone` — same fields as `PlayerContactSection`'s existing edit form.
- **Guardians**: at least one guardian required, each with `relation` (mother/father/other), `name`, `phone`, `email`. Support adding multiple guardians (the data model already supports an array).
- **Consent checkbox** (required to submit): "I confirm parental/guardian consent has been obtained to store this player's data." On submit, sets `consent: { given: true, date: <today as "YYYY-MM-DD">, confirmedBy: <admin's email> }`.

This closes a real gap from the original spec (Section 10, Legal & Compliance): consent was modeled but had no UI path to ever become `true`.

### 2.2 Guardians on the player card

`PlayerContactSection` gains a Guardians sub-section (list of guardian cards, each editable: relation/name/phone/email; add/remove a guardian). Same edit-mode pattern already established (Edit → form → Save/Cancel), reusing the shared `Input`/`Button` primitives from Plan 1's fix wave.

### 2.3 Navigation shell

Per the design system's Section 7 ("Navigation — one vocabulary, two shells"): a navy sidebar for desktop (≥1024px) and a white bottom tab bar for mobile, same items/order/icons in both. Icons via `lucide-react` (MIT-licensed, matches the design system's 1.5px stroke / 24px grid spec).

Initial destinations: **Teams** (home), **Guides** (skill guide + physical test guide, tabbed), **Sign out** (action, not a route). This is deliberately minimal now; Plan 3 adds Trainings/Calendar as new destinations to the same shell.

Sign out calls Firebase Auth's `signOut(auth)` and redirects to `/login`.

### 2.4 Parked fixes from Plan 1's final review

- **Role-gate mismatch**: `PlayerCardPage` currently gates editing on `appUser?.role === 'admin'` (global role), but `firestore.rules` authorizes player writes on team membership (`isTeamAdmin()` via `adminEmails`). Fix: `PlayerCardPage` should instead determine admin status by checking whether the signed-in user's email is in the parent team's `adminEmails` (already denormalized-adjacent — the team doc is fetched via `TeamPage`, but `PlayerCardPage` doesn't currently fetch the team; it will need to, or receive `isTeamAdmin` via a prop/route context). Simplest fix: `PlayerCardPage` fetches the team doc (already have `getTeam`) and computes `isAdmin = team.adminEmails.includes(firebaseUser.email)`, replacing the global-role check.
- **`getSkillGuide()` error handling**: add a `.catch` in `SkillGuidePage`'s load effect, and disable the "Save" button until a successful load has occurred (a ref/state flag `loaded: boolean`), so a failed read can never be silently overwritten with an empty guide.

## 3. Development Plans

### 3.1 Shared type

Consolidate the duplicated `DevelopmentPlan`/`DevelopmentPlanObjective` types (currently defined identically in both `src/types/team.ts` and `src/types/player.ts`) into `src/types/developmentPlan.ts`, imported by both.

### 3.2 Status vocabulary

Per the design system's Section 6 ("Status vocabulary"), objective status is a fixed 5-value select, not free text: **Active** (green), **In progress** (blue), **Completed** (ink, solid fill — the one filled chip), **Not started** (slate), **Attention** (orange). Always paired with the label text, never color alone.

### 3.3 `DevelopmentPlanEditor` component

One reusable component: props `{ plan: DevelopmentPlan; onSave: (plan: DevelopmentPlan) => Promise<void> }`. Renders:
- Short-term objectives (1-3 months): a list of rows (objective text, target date, status select, coach comment), add/remove row.
- Season-long objectives: same shape, `target` field instead of `targetDate`.
- General notes: a textarea.
- One "Save" button for the whole plan (matches the existing player-card pattern of section-level save, not per-field).

Used on: a new "Development Plan" tab on `TeamPage` (alongside Overview/Settings), and a new section on `PlayerCardPage` (alongside Contact, Skills, Guardians, Physical Testing).

## 4. Physical Testing

Implements the protocol and data model already fully specified in the app design spec (Section 5) and the coach's own testing protocol notes. This section specifies the UI/component breakdown.

### 4.1 Pure computation module

`src/players/physicalTestMath.ts`:
- `bestOf(attempts: number[], mode: 'max' | 'min'): number | null` — generic best-of-N (max for jumps/broad jump, min for sprint).
- `computeApproachJump(standingReachCm: number, attemptsTouchCm: number[]): { bestTouchCm: number; approachJumpCm: number }`.
- `computeReaction(attemptsCm: number[]): { averageCm: number; reactionTimeMs: number }` — discards min and max of the 5 attempts, averages the middle 3, converts via `t = sqrt(2d/9.81)` (d in metres).
- `computeBodyMassRatio(weightKg: number, bodyMassKg: number): number`.

### 4.2 Data layer

`src/players/physicalTestsApi.ts`, operating on `teams/{teamId}/players/{playerId}/physicalTests/{testId}`:
- `createPhysicalTest(teamId, playerId, entry)` — `entry` shaped per `testType` exactly as the app design spec's Section 5 schema.
- `getLatestByType(teamId, playerId, testType)` — one query per call (`where('testType','==',x).orderBy('date','desc').limit(1)`); the Physical Testing section calls this once per the 8 test types (8 small queries, never a full-collection fetch, per the smart-fetching rule).
- `listHistoryByType(teamId, playerId, testType, afterDoc)` — paginated (`limit` + `startAfter`), scoped to one `testType`.

### 4.3 `PhysicalTestingSection` (player card)

8 rows, one per quality (growth, CMJ, approach jump, broad jump, 10m sprint, 5-10-5 shuttle, reaction, strength). Each row shows:
- The latest computed value + date (e.g. "34 cm — 2026-08-15"), or "No data yet".
- "Add new" — opens a test-specific entry dialog (see 4.4).
- "View history" — opens a paginated list of past entries for that one quality.

### 4.4 Entry dialogs (per test type, following the exact protocol)

- **Growth**: two fields, height (cm) + body mass (kg). Single measurement, no attempts.
- **CMJ**: 3 fixed attempt inputs (cm). Shows computed best live.
- **Approach jump**: standing reach (cm, single field) + 3 fixed touch-height attempt inputs (cm). Shows computed best touch and approach jump (best touch − reach) live.
- **Broad jump**: 3 fixed attempt inputs (cm).
- **10m sprint**: 2-3 attempt inputs (start with 2, "+ add attempt" for a 3rd, per the protocol's "two or three attempts"). Shows computed best (min) live.
- **5-10-5 shuttle**: two fields, right-first seconds + left-first seconds. No computed "best" — both values are the point.
- **Reaction**: 5 fixed attempt inputs (cm dropped). Shows computed average-of-middle-3 and the converted ms live.
- **Strength**: a mode toggle (Weighted / Bodyweight). Weighted: exercise select (trap-bar deadlift/squat/goblet squat) + weight (kg) — body-mass ratio computed live by calling `getLatestByType(teamId, playerId, 'growth')` (Section 4.2's generic lookup, no new API needed) to get the most recent body mass, then `computeBodyMassRatio`. If no Growth entry exists yet, show the weight only and note that body mass is needed for the ratio. Bodyweight: exercise select (push-ups/split-squat) + reps.

All entry dialogs share the same `Input`/`Button` primitives and the content-card/dialog treatment already established in Plan 1.

### 4.5 History view

A simple paginated table (date, the type-appropriate value columns) scoped to one `testType`, reusing the same cursor-pagination "Load more" pattern as the team roster and library lists.

### 4.6 Physical Test Guide editor

Mirrors `SkillGuidePage` exactly: same page (`/admin/guides`), a second tab, editing `physicalTestGuide/config`'s 8 entries (protocol text per test), using `DEFAULT_PHYSICAL_TEST_GUIDE` seed data (from the coach's own written protocol, condensed) following the same fallback pattern established for the skill guide in Plan 1's fix wave.

## 5. Security Rules Additions

- `teams/{teamId}/players/{playerId}/physicalTests/{testId}`: same access pattern as the parent player doc (team admins read/write; linked viewer read-only via the parent's `viewerEmails`) — already specified in the app design spec Section 6.5, not yet implemented.
- `physicalTestGuide/config`: same pattern as `skillGuide/config` (any signed-in user reads, `isAdmin()` writes) — already specified, not yet implemented.
- No changes needed for development plans — they're fields on already-covered `teams`/`players` documents, governed by the existing team/player write rules.

## 6. Testing Strategy

Same priorities as Plan 1: Firestore rules tests for the two new rule additions (physicalTests access, physicalTestGuide access) are the highest priority; unit tests for `physicalTestMath.ts`'s 4 functions (covering each protocol's exact worked examples from the coach's notes, e.g. CMJ = 34cm, approach jump standing reach 222cm / touch 267cm = 45cm, reaction 20cm ≈ 202ms); component tests for the entry dialogs and `DevelopmentPlanEditor`.

## 7. Open Items / Deferred

- Dark mode, full icon audit — still deferred per the design system doc.
- Viewer invite flow — still deferred per the app design spec.
- The nav shell's mobile bottom-tab-bar breakpoint behavior should be manually verified in a real browser once built (no automated visual regression testing in this project).
