# Onboarding Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A welcome sheet shown once per user, a self-ticking "Get started" checklist on Today, one-time tips in
place, and a "Show tips again" setting. Seen state lives on `users/{uid}.onboarding`.

**Architecture:**
- **Seen state:** a pure state module (`src/onboarding/onboardingState.ts`) owns the `onboarding` map: parse, apply a
  change, reset. `usersApi` reads it at sign-in and writes changes with un-awaited field-path updates, and
  `AuthContext` exposes it with an optimistic `updateOnboarding`.
- **Checklist progress:** worked out from tiny aggregation and `limit(1)` reads while the card is visible. It is
  never stored.
- **Tips:** a `useTip(id)` hook plus one `Tip` card, placed on five screens.

**Tech Stack:** React 18, TypeScript strict, Tailwind tokens, Firestore (persistent cache), Vitest/jsdom, Firestore
rules tests (`npm run test:rules`).

**Spec:** `docs/superpowers/specs/2026-10-30-onboarding-tutorial-design.md`. The mockup is
`docs/design/design-system/mockups/onboarding.html`.

## Global Constraints

- Everything shows once per **user**, across devices. State is `users/{uid}.onboarding =
  { welcomed: boolean, tips: string[], hiddenChecklists: string[] }`, with `tips` ≤ 32 and `hiddenChecklists` ≤ 64
  entries.
- Rules: the owner may update only the `onboarding` key. Create is unchanged, delete stays `false`, `email` and
  `createdAt` stay immutable. Every rules change gets a test in `tests/rules/users.rules.test.ts`.
- No analytics and no server-side tracking. Nobody but the user reads the map.
- Strings go in `src/i18n/en/onboarding.ts` and `src/i18n/it/onboarding.ts`. Italian must be complete, and the
  parity and label-budget tests apply.
- Only existing primitives: `Sheet`, `GroupedList`/`ListRow`, `Menu`, `Button`, `useNotify`/`useUndoable`,
  `src/motion`. No new dependency.
- Design system v2: monochrome chrome, no `dark:` variants, tokens only (`surface`, `surface-2`, `surface-3`, `ink`,
  `ink-2`, `ink-3`, `on-ink`, `separator`), 44 px minimum targets, reduced motion respected.
- Fetching: no collection scans; the checklist's reads are `count()`/aggregation or `limit(1)`, only on teams
  already loaded on Today, and only while the card is visible. A failed check counts as not done, with no error UI.
- Live scouting's recording path never animates.
- Gates before each commit: `npx vitest run <touched tests>`. Before each group ends: `npm test`, `npm run lint`
  and `npm run build`. After Task 1, also `npm run test:rules`.

## Rulings on the spec (designer's calls, recorded here and in the spec by Task 6)

1. **The `undo` tip is dropped.** The undo notice already shows its own Undo button, and tracking "the first
   undoable delete" would couple `Notice` to onboarding for little gain.
2. **The `pdf-share` tip sits inside the training view sheet.** The rule becomes: never over a sheet; inside a sheet
   only in a read-only `variant="view"` sheet.
3. **The completion line** reads "Your club is ready." for a club admin and "You're all set." for everyone else. It
   is shown once: when the facts first come back all done and the club is not yet in `hiddenChecklists`, the card
   shows the line and writes `hideChecklist(clubId)`. On the next visit nothing renders.
4. **Team admin:** someone counts as a team admin when they are a club admin or Today's `mine` team list is not
   empty. That list holds exactly the teams they admin, so `Access` needs no change.

## Review Focus

1. **Existing users docs have no `onboarding` field**, which is every production user today. The first field-path
   write (`onboarding.welcomed`) creates a partial map, and the rule must accept it. *(Task 1 rules test.)*
2. **A malformed or partial `onboarding` value** must parse to safe defaults and never crash sign-in. Examples:
   `tips: "x"`, `welcomed: "yes"`, extra keys. *(Task 1 `parseOnboarding` test.)*
3. **A pending or failed write must not bring anything back.** Once Continue, × or Hide is used, the local state has
   changed, and a rerender before or after a rejected write doesn't re-show the item. *(Task 4 and Task 6 tests.)*
4. **While Today is loading, or for the operator on `/platform`,** neither the welcome sheet nor the checklist
   renders, and the welcome sheet waits for both the onboarding map and Today's teams. *(Task 4 test.)*
5. **A failing fact query** (permission or offline) leaves its step open with no alert, and the other steps still
   resolve. *(Task 5 test.)*

---

## Group 1: data and legal

### Task 1: Onboarding state, users rule, API and auth context

**Files:**
- Create: `src/onboarding/onboardingState.ts`, `src/onboarding/onboardingState.test.ts`
- Modify: `firestore.rules` (`match /users/{uid}`, ~line 605), `tests/rules/users.rules.test.ts`,
  `src/types/auth.ts`, `src/auth/usersApi.ts`, `src/auth/AuthContext.tsx`
- Test: the above, plus `src/auth/usersApi.test.ts` (create if absent)

**Interfaces:**
- Produces, in `src/onboarding/onboardingState.ts`:
  ```ts
  export type TipId = 'search' | 'row-actions' | 'scout-start' | 'pdf-share' | 'diagram';
  export interface OnboardingState { welcomed: boolean; tips: string[]; hiddenChecklists: string[] }
  export const EMPTY_ONBOARDING: OnboardingState; // { welcomed: false, tips: [], hiddenChecklists: [] }
  export type OnboardingChange =
    | { kind: 'welcomed' }
    | { kind: 'tip'; id: TipId }
    | { kind: 'hideChecklist'; clubId: string }
    | { kind: 'showChecklist'; clubId: string }
    | { kind: 'reset'; clubId: string };
  export function parseOnboarding(raw: unknown): OnboardingState;
  export function applyOnboarding(state: OnboardingState, change: OnboardingChange): OnboardingState;
  ```
- Produces, in `src/types/auth.ts`: `AppUser` gains `onboarding: OnboardingState`.
- Produces, in `src/auth/usersApi.ts`: `ensureUserDoc` returns `onboarding` (parsed, or `EMPTY_ONBOARDING` for a
  new doc), plus `export function writeOnboarding(uid: string, change: OnboardingChange): Promise<void>`.
- Produces on `useAuth()`: `onboarding: OnboardingState | null` (`null` until the user doc is read, and when signed
  out) and `updateOnboarding: (change: OnboardingChange) => void`. `updateOnboarding` applies `applyOnboarding` to
  the session state at once, then calls `writeOnboarding` without awaiting, swallowing errors with `.catch(() => {})`.

- [ ] **Step 1: Write the failing pure tests** (`onboardingState.test.ts`):
  - `parseOnboarding(undefined)`, `parseOnboarding(null)` and `parseOnboarding('x')` equal `EMPTY_ONBOARDING`.
  - `parseOnboarding({ welcomed: 'yes', tips: 'x', hiddenChecklists: [1, 'c1'], extra: 1 })` equals
    `{ welcomed: false, tips: [], hiddenChecklists: ['c1'] }`.
  - `applyOnboarding(EMPTY, { kind: 'tip', id: 'search' })` applied twice gives `tips: ['search']` (idempotent).
  - `hideChecklist` then `showChecklist` for `'c1'` leaves `hiddenChecklists: []`.
  - `reset` with `clubId 'c1'` on `{ welcomed: true, tips: ['search'], hiddenChecklists: ['c1', 'c2'] }` gives
    `{ welcomed: false, tips: [], hiddenChecklists: ['c2'] }`.
  - `applyOnboarding` never returns more than 32 `tips` or 64 `hiddenChecklists`; it keeps the newest.
- [ ] **Step 2: Run them; they fail.** `npx vitest run src/onboarding/onboardingState.test.ts`, failing on missing
  exports.
- [ ] **Step 3: Implement `onboardingState.ts`.** `applyOnboarding` returns a new object and never mutates its input.
- [ ] **Step 4: Run them; they pass.**
- [ ] **Step 5: Write the failing rules tests** in `users.rules.test.ts`. Rename `'refuses updates'` to
  `'refuses updates outside onboarding'`, keep its three assertions, and add:
  - *the owner sets onboarding on a doc that has none:* seed `{ email, createdAt }` with rules disabled;
    `update({ 'onboarding.welcomed': true })` succeeds, then `update({ 'onboarding.tips': ['search'] })` and
    `update({ 'onboarding.hiddenChecklists': ['club-a'] })` succeed.
  - *another user cannot:* `dbAs(env, 'other@example.com').doc(`users/${UID}`).update({ 'onboarding.welcomed': true })`
    fails.
  - *email and createdAt can't change alongside:* `update({ 'onboarding.welcomed': true, email: 'x@example.com' })`
    fails.
  - *unknown keys, wrong types and oversized lists are refused:* each of these fails:
    - `{ 'onboarding.role': 'admin' }`
    - `{ 'onboarding.welcomed': 'yes' }`
    - `{ 'onboarding.tips': 'search' }`
    - `{ 'onboarding.tips': Array(33).fill('t') }`
    - `{ 'onboarding.hiddenChecklists': Array(65).fill('c') }`
    - `{ onboarding: 'x' }`
  - *an unverified email gets nothing:*
    `env.authenticatedContext(UID, { email: PARENT, email_verified: false })` → the update fails.
- [ ] **Step 6: Run them; the new allow cases fail.** `npm run test:rules -- tests/rules/users.rules.test.ts`, which
  fails because updates are denied.
- [ ] **Step 7: Add the rule.** Inside `match /users/{uid}`, replace `allow update, delete: if false;` with
  `allow delete: if false;` and an update rule built from this predicate (the implementer names the helper):
  ```
  signedIn() && request.auth.uid == uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['onboarding'])
    && request.resource.data.onboarding is map
    && request.resource.data.onboarding.keys().hasOnly(['welcomed', 'tips', 'hiddenChecklists'])
    && (!('welcomed' in request.resource.data.onboarding) || request.resource.data.onboarding.welcomed is bool)
    && (!('tips' in request.resource.data.onboarding)
        || (request.resource.data.onboarding.tips is list && request.resource.data.onboarding.tips.size() <= 32))
    && (!('hiddenChecklists' in request.resource.data.onboarding)
        || (request.resource.data.onboarding.hiddenChecklists is list
            && request.resource.data.onboarding.hiddenChecklists.size() <= 64))
  ```
- [ ] **Step 8: Run all the rules tests; they pass.** `npm run test:rules`
- [ ] **Step 9: Write the failing `usersApi` tests.** Mock `firebase/firestore` in the style of the existing API
  tests. Assert that:
  - `writeOnboarding(uid, { kind: 'welcomed' })` calls `updateDoc` with `{ 'onboarding.welcomed': true }`;
  - `tip` uses `arrayUnion(id)` on `onboarding.tips`;
  - `hideChecklist` uses `arrayUnion` and `showChecklist` uses `arrayRemove` on `onboarding.hiddenChecklists`;
  - `reset` sends `{ 'onboarding.welcomed': false, 'onboarding.tips': [], 'onboarding.hiddenChecklists':
    arrayRemove(clubId) }`;
  - `ensureUserDoc` on an existing doc returns `parseOnboarding(data.onboarding)`, and on a new doc returns
    `EMPTY_ONBOARDING`.
- [ ] **Step 10: Implement `writeOnboarding`, extend `ensureUserDoc` and the `AppUser` type, and wire `AuthContext`.**
  - Add `onboarding` to `Session` and `SIGNED_OUT` (`null`) and to the context default.
  - Add `updateOnboarding` to the context value. It is a no-op while signed out.
  - Fix every `AppUser` literal that the build flags, test fixtures included, by adding
    `onboarding: EMPTY_ONBOARDING`.
- [ ] **Step 11: Run `npx vitest run src/auth src/onboarding`, then `npm test`, `npm run lint` and `npm run build`;
  all pass.**
- [ ] **Step 12: Commit.**
  `git commit -m "feat(onboarding): onboarding state on the user doc, owner-only rule and auth context"`

### Task 2: Privacy notice version 2026-10-30

**Files:**
- Create: `src/legal/content/{en,it,fr,de,es}/privacy-2026-10-30.md`
- Modify: `src/legal/versions.ts` (`CURRENT_DOC_VERSION.privacy`), `src/legal/published.test.ts`

**Interfaces:** none produced. `/privacy` serves the new version, and `/privacy?v=2026-10-22` still serves the old
one.

- [ ] **Step 1: Copy each `privacy-2026-10-22.md` to `privacy-2026-10-30.md`.** In each copy change only two things:
  - The version line becomes `Version 2026-10-30.` in that language's own form.
  - The first cell of the "Accounts of club staff and members" row gains, after "sign-in times and other sign-in
    metadata", the clause *", and which onboarding tips you have seen or dismissed"*, translated in each language in
    the register of that file.
- [ ] **Step 2: Set `CURRENT_DOC_VERSION.privacy` to `'2026-10-30'`.**
- [ ] **Step 3: Allow per-document versions in `published.test.ts`.** Each version entry pins only the texts that
  exist for that version, and the count test checks `DOCS × LEGAL_LANGS` filtered by `rawLegalText(doc, version,
  lang) !== null`.
  - Add `'2026-10-30': { 'privacy/en': …, 'privacy/it': …, 'privacy/fr': …, 'privacy/de': …, 'privacy/es': … }`
    with the computed SHA-256 values. Get them by running the test once and copying the received hashes.
  - Leave every `2026-10-22` pin untouched.
- [ ] **Step 4: Run `npx vitest run src/legal`; it passes**, and the old pins are unchanged.
- [ ] **Step 5: Commit.**
  `git commit -m "docs(legal): privacy notice 2026-10-30 lists onboarding progress on the account"`

## Group 2: strings, rules of who sees what, welcome sheet

### Task 3: Strings and the step and row logic

**Files:**
- Create: `src/i18n/en/onboarding.ts`, `src/i18n/it/onboarding.ts`, `src/onboarding/steps.ts`,
  `src/onboarding/steps.test.ts`
- Modify: `src/i18n/en/index.ts`, `src/i18n/it/index.ts` (register `onboarding`)

**Interfaces:**
- Produces, in `src/onboarding/steps.ts`:
  ```ts
  export type StepId = 'team' | 'players' | 'coach' | 'session' | 'match';
  export type WelcomeRowId = 'teams' | 'coaches' | 'sessions' | 'scouting' | 'library' | 'view';
  export interface Who { access: Access; adminsAnyTeam: boolean } // adminsAnyTeam per Ruling 4
  export interface StepFacts { teams: number; anyPlayers: boolean; members: number; anySession: boolean; anyMatch: boolean }
  export function welcomeRows(who: Who): WelcomeRowId[];
  export function checklistSteps(who: Who, facts: Pick<StepFacts, 'anyPlayers'> | null): StepId[];
  export function stepDone(id: StepId, facts: StepFacts): boolean;
  ```
- Produces `useT().onboarding`, with the spec's exact English copy:
  - **`welcome`:** `title(club: string)` → `Welcome to ${club}`, `subtitle: 'Volley Skills'`, `continue: 'Continue'`,
    and one `{ title, line }` per `WelcomeRowId`, as in spec §3.1. `view` is "See your teams" / "Follow the teams
    and players you've been given access to."
  - **`checklist`:** `title: 'Get started'`, `progress(done, total)` → `${done} of ${total}`, `more: 'More'`,
    `hide: 'Hide'`, `hidden: 'Get started hidden'`, `readyClub: 'Your club is ready.'`, `readyYou: "You're all set."`,
    and per step `{ title, help }`, where `help` is the spec §3.2 help line. The accessible name pattern is
    `stepDone(title)` → `${title}, done`.
  - **`tips`:** per `TipId`, `{ title, line }`. Where the copy differs, there are variants:
    - `search.lineMac` / `search.lineOther` / `search.linePhone`;
    - `rowActions.lineTouch` / `rowActions.linePointer`.
  - **`dismiss`:** `'Dismiss tip'`.
  - **`settings`:** `showAgain: 'Show tips again'`, `showAgainHelp: 'Welcome, Get started and tips, on all your
    devices'`, `shown: 'Tips will show again.'`

- [ ] **Step 1: Write the failing `steps.test.ts`:**
  - A club admin's welcome rows are `['teams', 'coaches', 'sessions', 'scouting']`.
  - A coach (`isClubAdmin: false`, `adminsAnyTeam: true`, trainings section) gets
    `['sessions', 'scouting', 'library']`.
  - A member with no team and no sections gets `['view']`.
  - A member with only the exercises section gets `['library']`.
  - The rows never exceed four.
  - `checklistSteps` for a club admin returns `['team', 'players', 'coach', 'session', 'match']`.
  - For a coach with `anyPlayers: true` it returns `['session', 'match']`; with `anyPlayers: false` or `null` it
    returns `['players', 'session', 'match']`.
  - With `adminsAnyTeam: false` and not a club admin it returns `[]`.
  - `stepDone`: `team` iff `teams > 0`; `coach` iff `members >= 2`; the others follow their boolean.
- [ ] **Step 2: Run it; it fails.** `npx vitest run src/onboarding/steps.test.ts`
- [ ] **Step 3: Implement `steps.ts` and both string files.** Then run `npx vitest run src/i18n`; the parity and
  label-budget tests pass, and Italian is written in full.
- [ ] **Step 4: Run it; it passes.**
- [ ] **Step 5: Commit.** `git commit -m "feat(onboarding): strings and who-sees-what step logic"`

### Task 4: Welcome sheet on Today

**Files:**
- Create: `src/onboarding/WelcomeSheet.tsx`, `src/onboarding/WelcomeSheet.test.tsx`
- Modify: `src/home/HomePage.tsx`

**Interfaces:**
- Consumes `useAuth().onboarding`, `updateOnboarding`, `club`, `access` (Task 1) and `welcomeRows` (Task 3).
- Produces `export function WelcomeSheet({ adminsAnyTeam }: { adminsAnyTeam: boolean }): JSX.Element | null`.

- [ ] **Step 1: Write the failing component tests.** Wrap in `AuthContext` and `I18n` test providers as existing
  component tests do.
  - It renders nothing while `onboarding` is `null`, when `onboarding.welcomed` is true, or when `club` is `null`.
  - With `welcomed: false`, a club admin sees the title "Welcome to {club.name}", four rows in the spec order, and a
    Continue button with initial focus.
  - Clicking Continue calls `updateOnboarding({ kind: 'welcomed' })` once and the sheet is gone. The sheet also
    stays gone on rerender when the mocked write rejects, because the local state already changed.
  - Pressing Escape counts as Continue: the same single call.
  - A double click on Continue still produces one call.
- [ ] **Step 2: Run them; they fail.**
- [ ] **Step 3: Implement `WelcomeSheet`.**
  - Use `Sheet` with `variant="view"` and `detent="large"`, and the title from the strings. Its `onClose` calls
    `updateOnboarding({ kind: 'welcomed' })` behind a ref guard.
  - **Body:** the club initials tile (64 px, radius 16, `bg-ink text-on-ink`, initials from the same helper the
    sidebar club switcher uses), `text-title-1` title, `ink-2` subtitle, then the rows: 28 px lucide icon in `ink`,
    `headline` title, `subhead` `ink-2` line. Icons: `teams`→`Users`, `coaches`→`UserPlus`,
    `sessions`→`CalendarDays`, `scouting`→`Activity`, `library`→`Dumbbell`, `view`→`Eye`.
  - **Footer:** one full-width primary `Button` labelled Continue that closes through `useSheetClose()`.
  - Match the mockup's section 1.
- [ ] **Step 4: Mount it in `HomePage`.** Render `<WelcomeSheet adminsAnyTeam={!!access?.isClubAdmin ||
  state.teams.length > 0} />` only once `!state.loading`. Add a HomePage test: while loading, no dialog named
  "Welcome to …" is present.
- [ ] **Step 5: Run `npx vitest run src/onboarding src/home`; it passes.**
- [ ] **Step 6: Commit.** `git commit -m "feat(onboarding): welcome sheet, once per user"`

## Group 3: Get started

### Task 5: The Get started card, its facts, and Show tips again

**Files:**
- Create: `src/onboarding/useStepFacts.ts`, `src/onboarding/useStepFacts.test.ts`,
  `src/onboarding/GetStartedCard.tsx`, `src/onboarding/GetStartedCard.test.tsx`
- Modify: `src/calendar/calendarApi.ts` (+ `hasAnySession`), `src/matches/matchesApi.ts` (+ `hasAnyMatch`),
  `src/clubs/clubsApi.ts` (+ `countClubMembers`), `src/home/HomePage.tsx`, `src/settings/SettingsPage.tsx`, the
  matching API tests

**Interfaces:**
- Produces:
  - `hasAnySession(teamId: string): Promise<boolean>`: `query(clubCol('teams', teamId, 'calendar'), limit(1))`.
  - `hasAnyMatch(teamId: string): Promise<boolean>`: the same on `matches`.
  - `countClubMembers(): Promise<number>`: `getCountFromServer(clubCol('members'))`.

  None of these needs an index.
- Produces `export function useStepFacts(teams: Team[], steps: StepId[], enabled: boolean): StepFacts | null`.
  - It returns `null` until every requested check has settled.
  - It queries only what `steps` needs: `getTeamSummary` per team for `players`, `countClubMembers` for `coach`,
    and `hasAnySession` / `hasAnyMatch` per team.
  - A rejected check counts as `false` / `0`.
  - It runs nothing when `enabled` is false.
- Produces `export function GetStartedCard({ teams, adminsAnyTeam }: { teams: Team[]; adminsAnyTeam: boolean }):
  JSX.Element | null`.

- [ ] **Step 1: Write the failing `useStepFacts` tests** (mock the API modules):
  - With `steps: ['session', 'match']` it never calls `countClubMembers` or `getTeamSummary`.
  - `hasAnySession` rejecting for team A and resolving true for team B gives `anySession: true`.
  - All of them rejecting gives `anySession: false` and `anyMatch: false`, with no throw.
  - `enabled: false` makes no calls and returns `null`.
- [ ] **Step 2: Write the failing `GetStartedCard` tests:**
  - It renders nothing while `onboarding` or the facts are `null`, when the club id is in `hiddenChecklists`, or
    when `checklistSteps` is empty.
  - With 2 of 5 done it shows "Get started", "2 of 5", done rows named "Create your first team, done", and help text
    only on open rows.
  - Clicking the open "Plan a training" row with one team navigates to that team's calendar with pending action
    `new-session`. With two teams it opens the team picker; reuse `useTeamAction` from `src/home/Shortcuts.tsx`.
  - "Create your first team" navigates to `/teams` with `new-team`. "Add a coach" navigates to `/club?tab=people`.
    "Add your players" uses `useTeamAction` with the roster action `add-player`. "Scout a match" uses `new-match`.
  - **Hide (menu):** the card disappears and `useUndoable` is called with message "Get started hidden". Its `commit`
    calls `updateOnboarding({ kind: 'hideChecklist', clubId })`, and `onUndo` brings the card back.
  - **All done on first load and not hidden:** it shows "Your club is ready." for a club admin ("You're all set."
    otherwise) and calls `updateOnboarding({ kind: 'hideChecklist', clubId })` once (Ruling 3).
  - A failing fact leaves that step open, and the card has no `role="alert"`.
- [ ] **Step 3: Run them; they fail.**
- [ ] **Step 4: Implement the three API helpers, `useStepFacts` and `GetStartedCard`.**
  - **Card:** `surface`, radius 16, `shadow-card`.
  - **Header:** `headline` title, `footnote` `ink-2` tabular progress, and the "⋯" `Menu` with Hide.
  - **Progress bar:** 4 px, `surface-3` track, `ink` fill, radius 2.
  - **Rows:** `GroupedList`/`ListRow` rows with the 22 px circle. Open is `border-ink-3`; done is `bg-ink` with a
    `Check` in `on-ink`. Done titles are `ink-2`.
  - Steps keep the order from `checklistSteps` and never re-sort.
  - Match the mockup's section 2.
  - Widen `useTeamAction`'s `action` type in `src/home/Shortcuts.tsx` to `'new-match' | 'new-session' |
    'add-player'`. `teamActionPath` already maps `add-player` to the roster tab.
  - Add pending action `add-member` only if `PeopleTab` can take it cleanly. That means
    `useTakePendingAction('add-member', () => setAdding(true))` and extending `PendingActionId`; otherwise plain
    navigation.
- [ ] **Step 5: Mount the card first on Today,** inside the non-empty branch above `LiveNowBlock`:
  `<GetStartedCard teams={state.teams} adminsAnyTeam={…same as Task 4…} />`.
- [ ] **Step 6: Add Show tips again to Settings.** Put a `ListRow` with title `showAgain` and subtitle
  `showAgainHelp` in its own `GroupedList` after Appearance. On click it calls
  `updateOnboarding({ kind: 'reset', clubId: activeClubId })` and `notify(shown)`. It is hidden when there is no
  active club. Add a SettingsPage test for that call.
- [ ] **Step 7: Run `npx vitest run src/onboarding src/home src/settings src/calendar src/matches src/clubs`, then
  `npm test`, `npm run lint` and `npm run build`; all pass.**
- [ ] **Step 8: Commit.**
  `git commit -m "feat(onboarding): Get started checklist on Today from real data; Show tips again"`

## Group 4: tips and docs

### Task 6: Tips in place, and the docs

**Files:**
- Create: `src/onboarding/Tip.tsx`, `src/onboarding/useTip.ts`, `src/onboarding/Tip.test.tsx`
- Modify: `src/home/HomePage.tsx` (`search`), `src/teams/TeamRosterTable.tsx` or its roster tab parent
  (`row-actions`), the scouting screen under `src/matches/scout/` (`scout-start`),
  `src/trainings/TrainingViewSheet.tsx` (`pdf-share`), `src/diagrams/DiagramEditorView.tsx` or its container
  (`diagram`), `CLAUDE.md`, `docs/superpowers/specs/2026-10-30-onboarding-tutorial-design.md`

**Interfaces:**
- Produces `export function useTip(id: TipId): { visible: boolean; dismiss: () => void }`. A tip is visible when all
  of these hold:
  - `onboarding` is loaded;
  - `onboarding.welcomed` is true;
  - `id` is not in `onboarding.tips`;
  - it has not been dismissed in this render tree.

  `dismiss` calls `updateOnboarding({ kind: 'tip', id })` and is used both for × and for "ends when".
- Produces `export function Tip({ id, icon, title, line }: { id: TipId; icon: LucideIcon; title: string; line:
  ReactNode }): JSX.Element | null`.
  - **Look:** `surface-2`, radius 12, a 20 px icon in `ink-2`, a bold `subhead` title, a `footnote` `ink-2` line,
    and a 44 px × button with `aria-label` "Dismiss tip".
  - **Motion:** it enters with the page-change motion and leaves with the list-delete motion from `src/motion`; with
    reduced motion it cross-fades.
  - **`scout-start`** uses no motion at all.

- [ ] **Step 1: Write the failing `Tip.test.tsx`:**
  - With `welcomed: false` the tip is not rendered.
  - With `welcomed: true` and the id not in `tips` it is rendered.
  - Clicking × calls `updateOnboarding({ kind: 'tip', id })` and the tip is gone, and it stays gone on rerender after
    a rejected write.
  - With the id already in `tips` it is not rendered.
- [ ] **Step 2: Run it; it fails.**
- [ ] **Step 3: Implement `useTip` and `Tip`.**
- [ ] **Step 4: Place the tips.** Each tip goes at the top of its screen's content. For each one, first confirm the
  behaviour exists exactly as the copy says; if it doesn't, leave that tip out and note why in the report.
  - **`search`** on Today, inside the content and below the checklist. The copy depends on the device:
    - `lineMac` with ⌘K, using the same `isMac` test as `src/layout/ShellToolbar.tsx`;
    - `lineOther` with Ctrl K;
    - `linePhone` under 768 px, using `useMediaQuery('(max-width: 767px)')`.

    It ends when `useSearch().isOpen` becomes true.
  - **`row-actions`** above the roster list. It uses `lineTouch` on `(pointer: coarse)` and `linePointer`
    otherwise. It ends when a roster row's context menu or swipe actions open.
  - **`scout-start`** above the court, rendered only while the current match has no recorded events and only if this
    is the user's first scouted match (the tip id not yet in `tips` is enough). It ends, with no animation, on the
    first recorded event. It never re-renders the recording controls.
  - **`pdf-share`** inside `TrainingViewSheet` (Ruling 2), above the PDF actions. It ends when a PDF has been built.
  - **`diagram`** in the diagram editor above the canvas. It ends on the first element added.

  Add one test per placement: it renders in its screen's test with a welcomed user, and its "ends when" trigger calls
  `updateOnboarding({ kind: 'tip', id })`.
- [ ] **Step 5: Update the docs.**
  - **Spec:** set the status to "approved and built", drop the `undo` row, and record Rulings 1–3 where they apply
    (§3.2 completion and §3.3 rules).
  - **CLAUDE.md:** a short **Onboarding** paragraph under Architecture covering:
    - `src/onboarding/`;
    - `users/{uid}.onboarding` and its owner-only rule;
    - the checklist working from data;
    - tips via `useTip`;
    - Show tips again.
- [ ] **Step 6: Run `npm test`, `npm run lint`, `npm run build` and `npm run test:rules`; all pass.**
- [ ] **Step 7: Commit.** `git commit -m "feat(onboarding): tips in place; docs"`
