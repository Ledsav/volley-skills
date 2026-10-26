# Club Platform — Plan 2: Club Area and Platform Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give club admins a club area at `/club` (Profile, People & access with roles, Contract) and the operator a platform page at `/platform` (clubs table with lifecycle actions, leads). Close the carry-overs from Plan 1's reviews.

**Architecture:** The club area builds on Plan 1's club-scoped API modules (`clubPaths`, active club). New writes go through two modules:
- `clubAdminApi.ts`: profile, ownership, termination request.
- `membersApi.ts`: add, role change, remove from club.

The platform page uses its own `platformApi.ts` with explicit club ids, because the operator has no active club. Every status change is one batch: the club update plus a fresh `statusLog` entry. The pure helper `clubActions()` decides which actions a club row offers and their date defaults. `/platform` sits outside `ClubGate`, so an operator with no club membership can reach it.

**Tech Stack:** React 18 + TS + Vite, Tailwind, React Router v7, Firebase JS SDK 12 (Firestore), `@firebase/rules-unit-testing`, Vitest + Testing Library, firebase-admin seeds.

**Spec:** `docs/superpowers/specs/2026-10-20-volley-skills-club-platform-design.md`. This plan covers:
- §3.3 (the tenant index) and §4 (the termination timeline defaults)
- §5, rules 2 and 3 (refined)
- §7.1, §7.3 (club admins in a locked club) and §8.4
- the §2 "Day one" setup the club runs itself

**Builds on:** Plan 1, `docs/superpowers/plans/2026-10-21-club-platform-1-foundation.md`, commits `087e1c5..8140992`.

**Not in this plan:**
- Plan 3: sign-up, acceptance, the legal texts and their links.
- Plan 4: the export button, migration and purge.
- Payments.

## Global Constraints

- **Spark plan, no Cloud Functions.** All authorization lives in `firestore.rules`, and every rules change has a test in `tests/rules/`. Run the rules suite on an alternate emulator port (e.g. 8181) when 8080 is taken. Never stop a running dev emulator.
- **Lowercased emails.** Emails are stored and compared lowercased. Use `appUser.email` (already lowercased), never `firebaseUser.email`, for comparisons and writes.
- **Operator blindness.** The operator never sees club data. `/platform` reads only `clubs/{id}` docs and `interestSignups`. It never reads members, teams, the library or any other club subcollection, and never links to them.
- **Allowed transitions:**
  - pending → active | deleted
  - active → suspended | terminating
  - suspended → active | terminating
  - terminating → active | terminating (the new self-transition is only for changing the dates)
- **Termination timeline** (spec §4):
  - `effectiveAt` defaults to **now + 30 days**. This is the legal notice period, and it wins over §8.4's "now". The operator may pick any date from today on, and `effectiveAt = now` is allowed for a serious breach.
  - `retrievalEndsAt` defaults to `effectiveAt + 30 days` and must be **≥ `effectiveAt` + 30 × 86 400 000 ms**. The rules enforce this exactly.
- **Required reasons.** Deactivate (active → suspended) requires a non-empty reason, at most 300 characters. The other actions take an optional reason of at most 300 characters.
- **Status change shape.**
  - `statusChangedAt` is set to `serverTimestamp()`, and `statusChangedBy` to the operator's lowercased email.
  - The `statusLog` doc is `{ from, to, reason, by, at }`, and `reason` equals the club's new `statusReason`, so both are null or the same string.
- **Ownership.** `ownerEmail` always names an admin member. Ownership moves only to another admin.
- **Club admins' last admin.** The UI never offers to demote or remove the last admin, or the owner.
- **AI off by default.** When `club.aiEnabled` is false, the app hides every AI entry point.
- **Growth tests opt-in.** Growth tests (height, body mass) are a club opt-in. When `club.growthTestsEnabled` is false, the app offers no growth entry, and the rules refuse growth writes. Existing growth records stay and can still be deleted.
- **Design system.** UI uses `PageHeader`, `SectionTabs`, `ConfirmDialog`, `Dialog`, `Button` and `Input`. Success goes through `useNotify()`, errors are inline with `role="alert"`, and there are no `dark:` variants.
- **No unbounded reads.** Lists use `orderBy(...).limit(N)` and a cursor, or `readAll()` for small club-internal sets. Add a matching index when adding a query.
- **Commit trailer.** Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **DST at the 30-day boundary.** The operator picks dates in a date input across a daylight-saving change. Thirty calendar days of local midnights is then one hour short of the rules' exact 30 days, and the write must not be rejected. Task 7 tests that `clubActions` and the dialog date conversion produce `retrievalEndsAt − effectiveAt ≥ 30 × 86 400 000` for dates around a DST change. The dialog stores the retrieval date as the end of the local day.
2. **Timers longer than 24.8 days.** A gate timer to an `effectiveAt` more than about 24.8 days away (above 2^31−1 ms) must not fire immediately or loop. Task 3 tests that the timer delay is clamped.
3. **Demoting the last admin, or the owner.** A club with one admin, who is also the owner, must not be able to demote or remove itself through the People tab. Task 5 tests that both actions are disabled, with a hint.
4. **Operator with no club.** An operator who belongs to no club signs in and must reach `/platform` from the welcome page without a club. Task 3 tests the welcome link, and Task 8 tests the route outside `ClubGate`.
5. **Double-click.** A double-clicked status action must not send two batches, because the second would fail on the rules' fresh-log check and show a false error. Task 8 tests that the confirm button is disabled while saving.

---

### Task 1: Rules — date changes, log reason, growth opt-in, operator write denials

**Files:**
- Modify: `firestore.rules` (inside `match /clubs/{clubId}`)
- Modify: `firestore.indexes.json` (add `clubs` `status ASC, createdAt DESC`)
- Modify: `tests/rules/clubDoc.rules.test.ts`, `tests/rules/members.rules.test.ts`, `tests/rules/platformAdmin.rules.test.ts`, `tests/rules/physicalTests.rules.test.ts`, `tests/rules/testingSessions.rules.test.ts`
- Modify: `tests/rules/testEnv.ts`. `seedClub` gains `growthTestsEnabled?: boolean`, default `true`, so existing growth tests keep passing.

**Interfaces:**
- Produces:
  - **Transitions:** `transitionAllowed` also accepts `terminating → terminating`.
  - **statusLog:** create requires `keys().hasAll(['from','to','reason','by','at'])` and `reason == getAfter(club).statusReason`.
  - **Growth writes** (physicalTests create/update, testingSessions entries create/update): when `testType == 'growth'`, they require `club().growthTestsEnabled == true`.
  - **Index:** the `clubs (status, createdAt desc)` index that Task 8 queries.

- [ ] **Step 1: Write the failing tests.**

  `clubDoc.rules.test.ts`:
  - Update the 20-pair `it.each` so `terminating → terminating` is allowed.
  - `lets the operator change the dates of a terminating club with a fresh log`: a `terminating` club gets new `effectiveAt`/`retrievalEndsAt` (30 days apart) plus a `statusLog` with `from:'terminating', to:'terminating'`, and succeeds.
  - `refuses a date change under 30 days`: the same change with 29 days fails.
  - `refuses a statusLog whose reason differs from the club's statusReason`: club `statusReason:'a'` with log `reason:'b'` fails.
  - `refuses a statusLog missing the reason key`: the same write without `reason` fails.

  `platformAdmin.rules.test.ts`. As `OPERATOR`, who is not a member, each of these fails:
  - `cannot create its own member doc in a club`
  - `cannot write a team doc`
  - `cannot edit the club profile`: an update of `name`.

  `members.rules.test.ts`:
  - `lets the owner transfer ownership to another admin and then be demoted in the same batch`. Club owner `admin-a`, plus `admin-b` (admin). One batch: the club's `ownerEmail → admin-b@example.com`, then `members/admin-a.role → member`. It succeeds.

  `physicalTests.rules.test.ts`:
  - `refuses a growth test when the club has growth tests off`: seed with `growthTestsEnabled: false`. Creating a `{ testType: 'growth', … }` fails, while creating a `cmj` test succeeds.
  - `still lets a team admin delete an existing growth test when growth tests are off`

  `testingSessions.rules.test.ts`:
  - `refuses a growth entry when the club has growth tests off`
- [ ] **Step 2: Run** the rules suite on an alternate port. Expected: the new cases FAIL.
- [ ] **Step 3: Implement** the rule changes listed under Interfaces, and the index. For the growth check, the physicalTests and entries create/update rules add `&& (request.resource.data.testType != 'growth' || club().growthTestsEnabled == true)`. The `club()` doc is already read through `activeMember()`, so this costs no extra lookup.
- [ ] **Step 4: Run** the rules suite. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(rules): termination date changes, log reason binding, growth-test opt-in`.

---

### Task 2: Club features — hide AI and growth when the club turns them off

**Files:**
- Create: `src/clubs/useClubFeatures.ts` (+ test)
- Modify: `src/types/physicalTest.ts`. Add `visibleTestTypes(growthTestsEnabled: boolean): PhysicalTestType[]`, which is `PHYSICAL_TEST_ORDER` minus `'growth'` when false.
- Modify, growth: `src/physicalSessions/QualityTileGrid.tsx`, `src/physicalSessions/PlayerRosterPicker.tsx`, `src/players/PhysicalTestingSection.tsx`. These iterate `visibleTestTypes(...)` instead of `PHYSICAL_TEST_ORDER`.
- Modify, AI:
  - `src/exercises/ExercisesPage.tsx` and `src/trainings/TrainingsPage.tsx`: the "Draft with AI" buttons.
  - `src/matches/scout/ScoutPage.tsx`: the "Text" phone tab and the desktop "Text panel" menu item.
  - `src/settings/SettingsPage.tsx`: the `AiProviderSettings` section.
- Tests: each modified component's existing test file.

**Interfaces:**
- Produces: `useClubFeatures(): { aiEnabled: boolean; growthTestsEnabled: boolean }`, read from `useAuth().club`. With no club, both are `false`.

- [ ] **Step 1: Write the failing tests.**
  - `useClubFeatures.test.ts`: `reads both flags from the active club` and `is all-off without a club`.
  - ExercisesPage and TrainingsPage: `hides Draft with AI when the club has AI off`. Use `authValue({ club: testClub({ aiEnabled: false }) })`; the button is absent. The existing tests keep `testClub()` with `aiEnabled: true`, so check `testClub`'s default and set it to `true` if needed.
  - ScoutPage: `hides the Text tab when the club has AI off`.
  - SettingsPage: `hides the AI provider settings when the club has AI off`.
  - PhysicalTestingSection: `offers no Growth tile when growth tests are off`.
  - QualityTileGrid: the same, for the session tile grid.
  - `physicalTest` types: `visibleTestTypes(false)` excludes `'growth'` and `visibleTestTypes(true)` equals `PHYSICAL_TEST_ORDER`.
- [ ] **Step 2: Run** `npx vitest run src/clubs src/exercises src/trainings src/matches/scout src/settings src/players src/physicalSessions src/types`. Expected: FAIL.
- [ ] **Step 3: Implement.** `PlayerRosterPicker`'s "count/total" uses `visibleTestTypes(...).length`.
- [ ] **Step 4: Run** `npm test` and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(clubs): hide AI and growth tests when the club turns them off`.

---

### Task 3: Gate refinements — boundary timer, live access, operator without a club

**Files:**
- Modify: `src/clubs/ClubGate.tsx` (+ `src/clubs/ClubGate.test.tsx`, or extend `src/auth/RequireAuth.test.tsx`)
- Create: `src/clubs/nextBoundary.ts` (+ test)
- Modify: `src/auth/AuthContext.tsx` (+ test)
- Modify: `src/auth/RequireAuth.tsx`. Split out `RequireSignedIn`: loading, `authError` and the redirect to `/login`, without `ClubGate`. `RequireAuth` becomes `<RequireSignedIn><ClubGate>{children}</ClubGate></RequireSignedIn>`.
- Modify: `src/clubs/WelcomePage.tsx` (+ test)

**Interfaces:**
- Produces:
  - `RequireSignedIn({ children })` in `src/auth/RequireAuth.tsx`, used by Task 8.
  - `MAX_TIMER_MS = 2_147_483_647` and `nextBoundaryDelay(club: Club | null, now: Date): number | null` in `src/clubs/nextBoundary.ts`. It returns the ms until the next future `effectiveAt` or `retrievalEndsAt` of a `terminating` club, clamped to `MAX_TIMER_MS`, or `null` when there is none.

- [ ] **Step 1: Write the failing tests.**
  - `nextBoundary.test.ts`:
    - `returns ms to effectiveAt while before it`
    - `returns ms to retrievalEndsAt between the two`
    - `returns null after retrievalEndsAt or for a non-terminating club`
    - `clamps a boundary 60 days away to MAX_TIMER_MS` (Review Focus 2)
  - ClubGate: `switches from the app to the locked screen when effectiveAt passes while open`. Use fake timers and a terminating club with `effectiveAt` = now + 1000 ms. The app shows; advance 1001 ms; the locked or export-only screen shows.
  - AuthContext: `re-resolves section access when the club status becomes active`. A member signs in while the club is `pending`, so the probes are all denied. The live snapshot turns `active`, the probes now allow `exercises`, and `access.sections.exercises` becomes `true`.
  - WelcomePage: `offers the platform page to a platform admin with no club`. The link is named `Open the platform page` with href `/platform`, and it is absent for others (Review Focus 4).
- [ ] **Step 2: Run** `npx vitest run src/clubs src/auth`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **ClubGate:** in a `useEffect` keyed on `club`, schedule `setTimeout(forceRender, nextBoundaryDelay(club, new Date()))` and clear it on cleanup. When a clamped timer fires early, the effect simply reschedules.
  - **AuthContext:** re-runs `resolveAccess(role)` when `club?.status` changes, guarded by the existing generation counter.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(clubs): live gate at contract boundaries, access follows status, platform link for operators`.

---

### Task 4: Club admin API — profile, ownership, termination request, members

**Files:**
- Create: `src/clubs/clubAdminApi.ts` (+ test)
- Create: `src/access/membersApi.ts` (+ test)
- Modify: `src/access/accessApi.ts` (+ test). `saveGrants` stops creating member docs, because membership is now explicit (Task 5). `removeAllGrants` is replaced by `membersApi.removeFromClub`.

**Interfaces:**
- Consumes: `clubDoc`, `clubCol`, `getActiveClubId` and `readAll`.
- Produces, in `clubAdminApi.ts`:
  ```ts
  export interface ClubProfileInput { name: string; country: string; locale: ClubLocale; aiEnabled: boolean; referenceOptOut: boolean; growthTestsEnabled: boolean }
  export function updateClubProfile(input: ClubProfileInput): Promise<void>;     // updateDoc(clubDoc(), input)
  export function transferOwnership(toEmail: string): Promise<void>;             // updateDoc(clubDoc(), { ownerEmail: lowercased })
  export function requestTermination(byEmail: string): Promise<void>;           // updateDoc(clubDoc(), { 'termination.requestedAt': serverTimestamp(), 'termination.requestedBy': byEmail })
  export const CLUB_COUNTRY_CODES: readonly string[];                            // EU27 + GB CH NO IS US CA MX BR AR, sorted by English name
  ```
- Produces, in `membersApi.ts`:
  ```ts
  export function listMembers(): Promise<Member[]>;                              // readAll(clubCol('members')), sorted by email
  export function addMember(email: string, role: MemberRole, addedBy: string): Promise<void>; // set only if missing; throws Error('already-member') otherwise
  export function setMemberRole(email: string, role: MemberRole): Promise<void>; // updateDoc(clubDoc('members', email), { role })
  export function removeFromClub(email: string): Promise<void>;                 // one batch: team arrayRemove + sectionAccess arrayRemove + member delete
  export function canChangeRole(target: Member, members: Member[], ownerEmail: string): { demote: boolean; remove: boolean; reason: string | null };
  ```
  `canChangeRole` is pure:
  - **Owner:** demote and remove are both false, with reason `'The club owner stays an admin. Transfer ownership first.'`
  - **Last admin:** both false, with reason `'A club needs at least one admin.'`
  - **Any other admin:** remove is false, with reason `'Make them a member before removing them.'`, and demote is true.
  - **A member:** demote is not applicable (false), and remove is true.

- [ ] **Step 1: Write the failing tests** with mocked Firestore, in the style of `accessApi.test.ts`:
  - `updateClubProfile writes exactly the six profile fields to the club doc`
  - `transferOwnership lowercases the email`
  - `requestTermination writes only requestedAt/requestedBy with a server timestamp`
  - `addMember creates { email, clubId, role, addedBy, addedAt } lowercased and refuses an existing member`
  - `removeFromClub removes the email from team adminEmails and sectionAccess and deletes the member doc in one batch`
  - `canChangeRole protects the owner and the last admin`: Review Focus 3, covering every case listed under Interfaces.
  - `saveGrants no longer creates a member doc`
- [ ] **Step 2: Run** `npx vitest run src/clubs src/access`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `CLUB_COUNTRY_CODES` is sorted with `Intl.DisplayNames(['en'], { type: 'region' })`.
  - `removeFromClub` reuses `accessApi`'s grant-removal ops. Export the existing private `addGrantOps` or an equivalent, so the logic is not duplicated.
  - Delete `removeAllGrants` and its callers' use. Task 5 rewires the page.
- [ ] **Step 4: Run** `npm test` and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(clubs): club admin and members API`.

---

### Task 5: Club area — `/club` with Profile and People & access

**Files:**
- Create: `src/clubs/area/ClubAreaPage.tsx` (+ test)
- Create: `src/clubs/area/ProfileTab.tsx` (+ test)
- Create: `src/clubs/area/PeopleTab.tsx` (+ test). This is the old `AccessManagerPage` grant editor, moved and extended.
- Delete: `src/access/AccessManagerPage.tsx` and its test. Move the useful cases into `PeopleTab.test.tsx`.
- Modify: `src/App.tsx`:
  - `/club` uses `RequireClubAdmin` → `ClubAreaPage`.
  - `/admin/access` and `/admin/interest` redirect to `/club?tab=people`.
- Modify: `src/layout/AppShell.tsx` (+ test). The admin nav "Access" item and the account-menu "Access" item become "Club" → `/club`, using `KeyRound` or `Building2`.
- Modify: `src/settings/SettingsPage.tsx` (+ test). The "Access" admin link becomes "Club" → `/club`.

**Interfaces:**
- Consumes: Task 4's APIs and `useAuth()` (`club`, `appUser`, `access`).
- Produces: `ClubAreaPage({ restricted?: boolean })`, with tabs `'profile' | 'people' | 'contract'` read from and written to the `?tab=` search param. `restricted` (Task 6) shows Profile read-only plus Contract only.

- [ ] **Step 1: Write the failing tests.**

  `ProfileTab.test.tsx`:
  - `prefills the form from the active club`
  - `saves the profile and notifies 'Club details saved'`
  - `refuses a name under 2 characters inline without saving`
  - `explains AI and growth tests next to their switches`. These two help texts are fixed copy:
    - AI: `Lets your staff use AI drafting and text scouting with their own provider key. Off by default.`
    - Growth: `Height and body mass may be health data. Only switch on if your club has a lawful basis to record them.`
  - `is read-only when restricted`: no Save button, and the inputs are disabled.

  `PeopleTab.test.tsx`. Port the old AccessManagerPage cases that still apply, then add:
  - `lists every member with a role badge and the owner marked`
  - `adds a person as member or admin`, with a role select whose default is Member
  - `shows 'already a member' when adding an existing member`
  - `changes a member to admin and back`
  - `disables demote and remove for the owner and the last admin, with the reason as hint` (Review Focus 3)
  - `transfers ownership to another admin after confirmation`. The ConfirmDialog title is `Make <email> the club owner?`.
  - `Remove from club removes grants and membership after confirmation`

  `ClubAreaPage.test.tsx`:
  - `opens the tab named in ?tab=`
  - `renders Profile, People & access and Contract tabs`

  Also: the AppShell test `shows Club for club admins`, and the App routing test `redirects /admin/access to /club?tab=people`.
- [ ] **Step 2: Run** `npx vitest run src/clubs src/layout src/settings src/App.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** The page uses `PageHeader` with the title `Club` and the eyebrow `club.name`, then `SectionTabs` (label `Club sections`). Until Task 6, the Contract tab renders a placeholder that is replaced in the same plan, so the three tabs exist from this task on.
- [ ] **Step 4: Run** `npm test`, `npm run build` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(clubs): club area with profile and people & access`.

---

### Task 6: Contract tab, and the restricted club area for locked clubs

**Files:**
- Create: `src/clubs/area/ContractTab.tsx` (+ test)
- Create: `src/layout/MinimalShell.tsx` (+ test). This is a bare page frame: `Logo`, a title slot, the signed-in email and a Sign out button, with content constrained to `max-w-screen-xl`. Task 8 uses it too.
- Modify: `src/clubs/ClubGate.tsx`. For the `'exportOnly'` view, render `<MinimalShell title={club.name}><ClubAreaPage restricted /></MinimalShell>` instead of `ClubStatusScreen kind="exportOnly"`.
- Modify: `src/clubs/ClubStatusScreen.tsx`. Remove the now-unused `exportOnly` kind.
- Create: `src/legal/operator.ts`, exporting `OPERATOR_CONTACT_EMAIL: string | null = null`. It is a placeholder that is filled before launch (legal design). The UI shows the contact line only when it is set.

**Interfaces:**
- Consumes: `requestTermination` (Task 4) and `ClubAreaPage({ restricted })` (Task 5).
- Produces: `MinimalShell({ title, actions?, children })`.

- [ ] **Step 1: Write the failing tests.** `ContractTab.test.tsx` shows:
  - `the club status in words`:
    - active: `Active`
    - suspended: `Paused`, plus `statusReason` when present
    - terminating: `Ending`, with `Full use until <date>` and `Data export until <date>`
  - `the accepted legal version, or 'Not yet accepted'`. The value is `club.legal.versionKey`, with its accepted date and the email that accepted it.
  - `End our contract asks for confirmation then writes the request`. The ConfirmDialog title is `End your club's contract?` and the confirm label is `Request end of contract`. It calls `requestTermination(appUser.email)` and notifies `End of contract requested`.
  - `shows the request instead of the button once requested`: `End of contract requested on <date> by <email>`.
  - `offers no End our contract while terminating or pending`
  - `shows the operator contact only when OPERATOR_CONTACT_EMAIL is set`

  ClubGate test: `shows the restricted club area to an admin of a suspended club`. It contains a `Contract` tab, no `People & access` tab, and the Profile inputs are disabled.
- [ ] **Step 2: Run** `npx vitest run src/clubs src/layout`. Expected: FAIL.
- [ ] **Step 3: Implement.** Dates use `toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })`, as in `ContractEndingBanner`.
- [ ] **Step 4: Run** `npm test` and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(clubs): contract tab and restricted club area for paused clubs`.

---

### Task 7: Platform API and actions

**Files:**
- Create: `src/platform/platformApi.ts` (+ test)
- Create: `src/platform/clubActions.ts` (+ test)
- Create: `src/platform/dates.ts` (+ test)

**Interfaces:**
- Produces, in `platformApi.ts`. Paths are explicit: `doc(db,'clubs',clubId)` and `doc(collection(db,'clubs',clubId,'statusLog'))`. Do not use clubPaths.
  ```ts
  export const CLUBS_PAGE = 50;
  export function listClubs(opts: { status: ClubStatus | null; after: QueryDocumentSnapshot | null }): Promise<{ clubs: Club[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }>;
    // orderBy('createdAt','desc'), plus where('status','==',status) when set, limit(CLUBS_PAGE), startAfter(after)
  export interface StatusChange { clubId: string; from: ClubStatus; to: ClubStatus; reason: string | null;
    dates?: { effectiveAt: Date | null; retrievalEndsAt: Date | null } }
  export function changeClubStatus(change: StatusChange, operatorEmail: string): Promise<void>;
  ```
  `changeClubStatus` writes one batch:
  - **Club update:**
    - `status: to`, `statusReason: reason`
    - `statusChangedAt: serverTimestamp()`, `statusChangedBy: operatorEmail`
    - `lastStatusLogId: logRef.id`
    - when `dates` is given: `'termination.effectiveAt'` and `'termination.retrievalEndsAt'`, each a `Timestamp` or null
  - **Log entry:** `logRef` set to `{ from, to, reason, by: operatorEmail, at: serverTimestamp() }`.
- Produces, in `clubActions.ts`:
  ```ts
  export type ClubActionKind = 'activate' | 'deactivate' | 'endContract' | 'changeDates' | 'reject' | 'reinstate';
  export interface ClubAction { kind: ClubActionKind; label: string; to: ClubStatus; reasonRequired: boolean; needsDates: boolean; secondary: boolean }
  export function clubActions(club: Pick<Club,'status'>): ClubAction[];
  export function defaultTerminationDates(now: Date): { effectiveAt: Date; retrievalEndsAt: Date };
  ```
- Produces, in `dates.ts`:
  ```ts
  export const DAY_MS = 86_400_000;
  export const RETRIEVAL_MIN_MS = 30 * DAY_MS;
  export function startOfLocalDay(isoDate: string): Date;   // 'YYYY-MM-DD' → local 00:00:00.000
  export function endOfLocalDay(isoDate: string): Date;     // 'YYYY-MM-DD' → local 23:59:59.999
  export function retrievalLongEnough(effectiveAt: Date, retrievalEndsAt: Date): boolean; // diff >= RETRIEVAL_MIN_MS
  ```

- [ ] **Step 1: Write the failing tests.**

  `clubActions.test.ts`. A table over each status:

  | Status | Actions offered |
  |---|---|
  | pending | `activate`, `reject` (secondary) |
  | active | `deactivate` (reason required), `endContract` (dates, secondary) |
  | suspended | `activate`, `endContract` |
  | terminating | `reinstate`, `changeDates` (dates) |
  | deleted | none |

  Each action's `to` matches the Global Constraints transitions. The labels are `Activate`, `Deactivate`, `End contract`, `Change dates`, `Reject`, `Reinstate`.

  Also:
  - `defaultTerminationDates gives effectiveAt now+30 days and retrievalEndsAt effectiveAt+30 days`

  `dates.test.ts`:
  - `startOfLocalDay and endOfLocalDay parse YYYY-MM-DD in local time`
  - `a start date and an end date 30 calendar days later across a DST change are long enough` (Review Focus 1). Use `startOfLocalDay('2027-03-01')` with `endOfLocalDay('2027-03-31')`, and the reverse case across October.
  - `29 days is not long enough`

  `platformApi.test.ts` (mocked Firestore):
  - `lists clubs newest first, filtered by status when set, with a cursor`
  - `writes the status change and its log in one batch with matching reason`
  - `sets termination dates as Timestamps only when dates are given`
- [ ] **Step 2: Run** `npx vitest run src/platform`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/platform` and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(platform): clubs listing, status changes and action rules`.

---

### Task 8: Platform page — `/platform`

**Files:**
- Create: `src/platform/PlatformPage.tsx` (+ test)
- Create: `src/platform/ClubsTable.tsx` (+ test)
- Create: `src/platform/ClubActionDialog.tsx` (+ test)
- Create: `src/auth/RequirePlatformAdmin.tsx` (+ test, or extend `src/auth/guards.test.tsx`)
- Modify: `src/App.tsx`. `/platform` is a top-level route, outside `AuthenticatedLayout`: `<RequirePlatformAdmin><MinimalShell title="Platform"><PlatformPage /></MinimalShell></RequirePlatformAdmin>`.
- Modify: `src/interest/AccessRequestsPanel.tsx` (+ test). Make `onGrant` optional; without it, the "Grant access" action is not rendered.
- Modify: `src/layout/AppShell.tsx` and `src/settings/SettingsPage.tsx` (+ tests). Add a `Platform` link for `isPlatformAdmin`, carrying the pending-signups count from `usePendingSignups`.

**Interfaces:**
- Consumes:
  - from Task 7: `listClubs`, `changeClubStatus`, `clubActions`, `defaultTerminationDates`, `startOfLocalDay`, `endOfLocalDay`, `retrievalLongEnough`
  - from Task 3: `RequireSignedIn`
  - from Task 6: `MinimalShell`
- Produces: `RequirePlatformAdmin({ children })`, which is `RequireSignedIn` plus a check of `useAuth().isPlatformAdmin`. Anyone else gets the existing "You don't have access to this page." screen.

- [ ] **Step 1: Write the failing tests.**

  `PlatformPage.test.tsx`:
  - `has Clubs and Leads tabs` (via `SectionTabs`)
  - `the Leads tab shows the sign-ups panel without Grant access`

  `ClubsTable.test.tsx`:
  - `shows name, country, owner, status, created date, accepted legal version and contract dates`
  - `filters by status`: the select options are `All`, `Pending`, `Active`, `Paused`, `Ending`, `Deleted`.
  - `loads more with the cursor when hasMore`
  - `renders no link into club data`: no anchor with href `/teams`, `/exercises`, `/trainings` or `/club` in the table.
  - `shows each row's actions from clubActions, secondary ones in a More menu`

  `ClubActionDialog.test.tsx`:
  - `Deactivate requires a reason`: the confirm is disabled until a non-empty reason is entered. The reason is at most 300 characters.
  - `End contract prefills now+30 and +30 days, and refuses a retrieval date under 30 days after effectiveAt inline`. The alert text is `Data export must stay open at least 30 days after the end date.`
  - `End contract allows an effective date of today for a serious breach`
  - `converts the dates with startOfLocalDay(effective) and endOfLocalDay(retrieval)`
  - `disables Confirm while saving so a double click sends one change` (Review Focus 5)
  - `calls changeClubStatus with from, to, reason and dates, notifies '<club> is now <status word>' and refreshes the row`
  - `shows an inline error and keeps the dialog open when the change fails`

  Guard and route tests:
  - `/platform renders for a platform admin with no club membership` (Review Focus 4)
  - `/platform denies a club admin who is not a platform admin`

  AppShell: `shows a Platform link only to platform admins`.
- [ ] **Step 2: Run** `npx vitest run src/platform src/auth src/layout src/settings src/interest src/App.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Status words:** shared with ContractTab. Put `CLUB_STATUS_LABEL: Record<ClubStatus,string>` in `src/clubs/statusLabels.ts`, with these values:
    - pending: `Pending`
    - active: `Active`
    - suspended: `Paused`
    - terminating: `Ending`
    - deleted: `Deleted`

    ContractTab (Task 6) switches to it in this task if Task 6 inlined the words.
  - **Tables on phones:** the table scrolls horizontally inside its card, with no page scroll.
- [ ] **Step 4: Run** `npm test`, `npm run build` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(platform): operator page with clubs table, lifecycle actions and leads`.

---

### Task 9: Seeds, docs and full verification

**Files:**
- Modify: `scripts/seed/seedClubs.mjs`. Add `platformAdmins/operator@example.com` with **no** membership in any club. This is the operator-only account for checking operator blindness by hand. Also give `clubs/rival` `growthTestsEnabled: false` and `aiEnabled: false`, so the opt-outs can be seen by hand.
- Modify: `scripts/seed/README.md`. Add the sign-ins: `operator@example.com` reaches `/platform` only, and the rival club has AI and growth tests off.
- Modify: `CLAUDE.md`:
  - The Auth & routing section names `/club` (club area, tabs), `/platform` (outside `ClubGate`, `RequirePlatformAdmin`, `MinimalShell`) and `RequireSignedIn`.
  - Club features: `useClubFeatures` hides AI and growth.
- Modify: `docs/superpowers/specs/2026-10-20-volley-skills-club-platform-design.md`. Mark the §4 versus §8.4 `effectiveAt` default as resolved: now + 30 days, with today allowed for a breach.

- [ ] **Step 1: Write the doc and seed changes.**
- [ ] **Step 2: Run** `npx vitest run scripts/seed`, then run the seed chain against a scratch emulator on an alternate port. Check with the Admin SDK that `platformAdmins/operator@example.com` exists and that no `members` doc carries that email.
- [ ] **Step 3: Run** `npm run lint`, `npm run build`, `npm test` and the rules suite (alternate port if 8080 is taken). Expected: lint 0 errors, build OK, everything passes. Report the counts.
- [ ] **Step 4: Commit** `docs+seed: club area and platform page`.
