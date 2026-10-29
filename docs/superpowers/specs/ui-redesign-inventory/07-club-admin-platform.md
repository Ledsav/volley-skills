# Club administration, guides and platform operator

This area covers three groups of screens:

1. **Club area** (`/club`): how a club admin runs their own club. It has four tabs: Profile, People & access, Export and Contract. There is also a **restricted club area**, shown instead of the whole app to club admins of a paused club, or of a club whose contract has passed its end date.
2. **Guides** (`/admin/guides`): club-wide editors for the skill guide (the text for each score range of each skill) and the physical test guide (the protocol text for each test).
3. **Platform** (`/platform`): the operator's page. It has a Clubs tab (lifecycle actions on club profile docs) and a Leads tab (public "request access" sign-ups). The public `/request-access` form that feeds the leads list is covered here too.

Routes and redirects in this area (`src/App.tsx`):

| Route | Guard / shell | Notes |
|---|---|---|
| `/club` (`?tab=profile\|people\|export\|contract`) | `RequireClubAdmin` inside `AuthenticatedLayout` (`RequireAuth` → `ClubGate` → `AppShell`) | Nav label "Members & settings" (KeyRound icon), in the sidebar "Club" group and on the phone **More** page |
| `/admin/access` | redirect → `/club?tab=people` (`replace`) | Inside `AuthenticatedLayout`, so it needs a signed-in member |
| `/admin/guides` | `RequireSection section="guides"` inside `AppShell` | Nav label "Guides" (BookOpen icon), "Club" group |
| `/platform` (`?tab=clubs\|leads`) | `RequirePlatformAdmin` (signed in + `isPlatformAdmin`, **no `ClubGate`**), rendered in `MinimalShell` titled "Platform" | Nav label "Clubs & sign-ups" (Building2 icon), sidebar "Platform" group, with a pending-count badge |
| `/admin/interest` | redirect → `/platform?tab=leads` (`replace`) | Outside `AuthenticatedLayout`, so it works for an operator with no club |
| `/request-access` | public | Indexable (`robots: 'index'`, canonical `/request-access`) |
| (any authenticated route) | `ClubGate` → `exportOnly` view | Renders `MinimalShell` (title = club name) + `ClubAreaPage restricted`, whatever the URL |

Who uses it:

- **Club admin** (`members/{email}.role == 'admin'`; `access.isClubAdmin`): `/club`, `/admin/guides`, and the restricted area when the club is paused or ended.
- **Section admin** (email in `sectionAccess/guides.adminEmails`): `/admin/guides` only.
- **Member**: nothing in this area, except that they see the `ContractEndingBanner` and the status screens produced by `ClubGate`.
- **Platform operator** (`platformAdmins/{email}` exists): `/platform`. They see only club profile/lifecycle fields and leads, never members, teams, players or the library.
- **Anonymous visitor**: `/request-access`.

---

## Screens and components

### Club area shell (`src/clubs/area/ClubAreaPage.tsx`, `/club`)

- **Purpose**: the tabbed container for club administration.
- **Who can see / do what**:
  - Full mode (`restricted=false`): any club admin (`access.isClubAdmin`). This applies when `clubView` is `app` (active) or `ending` (terminating, before `effectiveAt`). Anyone else gets `RequireClubAdmin`'s denied screen: an `AuthShell` with the red `role="alert"` text "You don't have access to this page."
  - Restricted mode (`restricted=true`): `ClubGate` renders it for `clubView === 'exportOnly'`, meaning a club admin of a `suspended` club, or of a `terminating` club with `effectiveAt <= now < retrievalEndsAt`. It is not reached through `/club`. It replaces the whole app at **any** URL and is wrapped in `MinimalShell` (logo, club name as title, signed-in email, "Sign out" button; no nav).
- **Elements**:
  - `PageHeader` with title "Club" and the club name as an eyebrow.
  - `SectionTabs` labelled "Club sections". On phones (`< sm`) this is a native `<select>` picker; from `sm` up it is underline tabs (`role="tablist"`, `role="tab"`, `aria-selected`).
  - Tabs in full mode: **Profile, People & access, Export, Contract**, in that order. Restricted mode: **Profile, Export, Contract** (no People & access).
  - The page sets the document title to "Club" (`usePageMeta`).
- **Actions → results**:
  - Choosing a tab calls `setParams({ tab: id }, { replace: true })`. The URL query changes without adding history entries.
  - `?tab=<id>` on load opens that tab. An unknown or disallowed id falls back to the default.
- **States**:
  - Default tab: `profile` in full mode, `contract` in restricted mode.
  - In restricted mode, `?tab=people` is ignored: it falls back to Contract and the People tab label is absent.
- **Edge cases**: tab state is URL-driven only (no local state). In restricted mode `ClubAreaPage` renders on whatever path the person opened, so `?tab=` works on any path. This is inferred from `ClubGate` rendering it regardless of route.
- **Tests that lock this in**: `src/clubs/area/ClubAreaPage.test.tsx`, `src/clubs/ClubGate.test.tsx`, `src/clubs/clubView.test.ts`.

### Profile tab (`src/clubs/area/ProfileTab.tsx`, `/club?tab=profile`)

- **Purpose**: edit the club profile and its feature switches.
- **Who can see / do what**:
  - Club admins edit (full mode).
  - In restricted mode every field is `disabled` and the Save button is **not rendered**.
  - Rules: `clubAdminProfileChange()` allows the update only while `isActive()` (active, or terminating before `effectiveAt`) or `pending`. A suspended club's admin is refused (`clubDoc.rules.test.ts`). The operator cannot edit profile fields.
- **Elements** (one card form, `max-w-xl`):
  - **Club name** (`#club-name`, text input).
  - **Country** (`#club-country` select): 36 ISO codes (`CLUB_COUNTRY_CODES`: EU27 + GB, CH, NO, IS, US, CA, MX, BR, AR). Options are labelled with `Intl.DisplayNames` in the **UI locale** and sorted by that label in the UI locale. If the stored country is not in the list, it is added as an extra option showing the raw code.
  - **Language** (`#club-locale`, label "Language" from `t.settings.languageLabel`): "English", plus "Italiano" only if `ITALIAN_ENABLED` (currently `false`) or the club already stores `it`.
  - Three checkboxes, each with a title and a description:
    - **AI features**: "Lets your staff use AI drafting and text scouting with their own provider key. Off by default."
    - **Growth tests**: "Height and body mass may be health data. Only switch on if your club has a lawful basis to record them."
    - **Don't name our club as a customer**: "We won't list your club as a reference customer." (this is `referenceOptOut`).
  - **Save** (primary; full width on phones, auto width from `sm`).
- **Actions → results**:
  - Save is a form submit, so Enter in the name field also submits. Steps:
    1. Trim the name. If its length is under 2 or over 80, show an inline error and do not save.
    2. Otherwise call `updateClubProfile({ name, country, locale, aiEnabled, referenceOptOut, growthTestsEnabled })`. This is one `updateDoc` on `clubs/{clubId}` with exactly those six keys; stray keys are stripped.
    3. On success the field is set to the trimmed name and the success notice "Club details saved" is shown.
  - Save is disabled while saving.
  - Turning AI or growth tests off takes effect app-wide via `useClubFeatures()`: AI features and growth tests are hidden. The rules then refuse growth-test creates and updates.
- **States**:
  - Prefilled once from `useAuth().club` on mount (`useState` initial values).
  - Renders nothing if there is no club.
  - Read-only in restricted mode.
- **Validation & messages**:
  - Name length error (inline, `role="alert"`, `aria-invalid`, `aria-describedby="club-name-error"`): "The club name must be between 2 and 80 characters."
  - Save failure: "Could not save. Please try again." (inline red `role="alert"`).
  - The form is `noValidate`.
- **Edge cases**:
  - The field values do **not** follow later live updates of the club doc (state is initialised once). This is inferred from the code.
  - The rules also require `country` to match `^[A-Z]{2}$` and `locale` to be `en` or `it`.
  - `ownerEmail` is changed only through People & access (Make owner).
- **Tests that lock this in**: `src/clubs/area/ProfileTab.test.tsx`, `src/clubs/area/ProfileTabItalian.test.tsx`, `src/clubs/clubAdminApi.test.ts` (six fields only; 36 country codes), `src/clubs/useClubFeatures.test.ts`, `tests/rules/clubDoc.rules.test.ts`.

### People & access tab (`src/clubs/area/PeopleTab.tsx`, `/club?tab=people`)

- **Purpose**: explicit club membership (add a person, remove them from the club), roles (admin/member), ownership transfer, and each member's grants (team admin, and the Exercises / Trainings / Guides sections). It replaces the old `/admin/access` page.
- **Who can see / do what**:
  - Club admins in full mode only. The tab does not exist in restricted mode.
  - Rules: member create, update and delete need `activeAdmin()` (an admin of an active club, or of a terminating club before `effectiveAt`). Team `adminEmails` changes need a club admin. `sectionAccess` writes need `activeAdmin()`.
- **Elements**: two-column grid from `lg` (20rem left, flexible right); stacked on smaller screens.
  - **Left card**:
    - "Add person by email" (`#new-person`, `type=email`).
    - "Role" select (Member is the default, or Admin).
    - **Add person** button (primary, small, full width).
    - A "People" heading and the list of **all members**, sorted by email. Each row is a button with:
      - the email, truncated, with a `title` tooltip;
      - an **Owner** pill (navy) when the email is `club.ownerEmail`;
      - a role pill, **Admin** or **Member**.
    - The selected row is highlighted and has `aria-current`.
  - **Right card**:
    - Nothing selected: "Select a person to manage their access."
    - Selected: the email as an `h2`, then:
      - **If the person is an admin**: "Admins have full access to every team and section." No grant checkboxes.
      - **If the person is a member**:
        - a "Sections" fieldset with checkboxes Exercises, Trainings, Guides;
        - a "Teams" fieldset with one checkbox per team (name);
        - **Save**, disabled while busy or when the draft equals the stored grants.
      - An action row:
        - admin → **Make member**, or member → **Make admin**;
        - **Make owner** (only for an admin who is not the owner);
        - **Remove from club** (danger ghost button).
      - Under the row, a grey hint giving the reason a button is disabled.
- **Actions → results**:
  - **Add person**:
    1. Trim and lowercase the email. An empty value does nothing.
    2. Check its shape with `^[^\s@]+@[^\s@]+\.[^\s@]+$`. A malformed email shows "Enter a valid email address."
    3. `addMember(email, role, myEmail)`: reads `members/{email}` first. If it exists, it throws `already-member` → "<email> is already a member."
    4. Otherwise it creates `{ email, clubId, role, addedBy (lowercased), addedAt: serverTimestamp }`.
    5. On success: the field clears, the role resets to Member, the lists reload, and the new person is **auto-selected**.
    6. Any other failure shows "Could not add this person. Please try again."
    - No success notice.
  - **Toggle grants + Save**: `saveGrants(email, draft, original)` builds one batch that writes only the docs whose membership changed:
    - `arrayUnion` / `arrayRemove` on `teams/{id}.adminEmails`;
    - `set(..., {merge:true})` on `sectionAccess/{section}.adminEmails`.
    - Then the page reloads. Failure shows "Could not save. Please try again." No success notice.
  - **Make admin** (on a member): `setMemberRole(email,'admin')`, which updates only `role`, then reloads. No confirmation. Failure: "Could not change the role. Please try again."
  - **Make member** (on another admin): same call with `'member'`, no confirmation.
  - **Make member on yourself**: opens a confirmation:
    - title "Stop being an admin?", message "You lose admin access to this club, including this page. The page reloads afterwards.", confirm button "Make me a member";
    - on success: `window.location.reload()`.
  - **Make owner**: opens a confirmation:
    - title "Make <email> the club owner?", message "The owner receives billing and contract contact. You stay an admin.", confirm button "Make owner";
    - calls `transferOwnership(email)` (`updateDoc` of `club.ownerEmail`, lowercased), then reloads;
    - failure: "Could not transfer ownership. Please try again.", shown inside the dialog.
    - Any admin, not only the current owner, can make another admin the owner.
  - **Remove from club**: opens a confirmation:
    - title "Remove <email> from the club?", message "They lose all access to this club's teams and sections right away.", confirm button "Remove";
    - `removeFromClub(email)` runs one batch that removes the email from every team's `adminEmails` and every section list where present, and deletes `members/{email}`;
    - on success the selection clears and the list reloads;
    - failure: "Could not remove this person. Please try again.", shown inside the dialog.
  - Every confirmation dialog: Cancel (focused first), Escape and Tab-trap via `useModalLayer`. The confirm button is styled destructive.
- **States**:
  - Loading: the lists are empty until `listAllTeams()`, `listGrantHolders()` and `listMembers()` resolve. There is no spinner.
  - Load error: "Could not load people. Please refresh the page." (page-level `role="alert"`).
  - While a confirmation is open, the page-level error is hidden and the error shows inside the dialog.
  - `busy` disables the Add, Save and action buttons. The confirm button inside `ConfirmDialog` is **not** disabled while busy.
- **Validation & messages**: `canChangeRole(target, members, ownerEmail)` decides the disabled states and the hint:
  - Target is the **owner**: demote and remove are disabled. Hint: "The club owner stays an admin. Transfer ownership first."
  - Target is the **last admin**: demote and remove are disabled. Hint: "A club needs at least one admin."
  - Target is **another admin** (not the owner, not the last): demote is allowed, remove is disabled. Hint: "Make them a member before removing them."
  - Target is a **member**: remove is allowed, no hint. Make admin is always enabled for a member.
- **Edge cases**:
  - The team checklist shows only the **first 50 teams** by name: `listAllTeams()` is called once and `hasMore` is ignored. `listGrantHolders()` pages all teams, though.
  - Grant holders who are not members are not listed (the list comes from `members`).
  - An admin's stored grants are kept but hidden while they are admin. When demoted, their old grants reappear.
  - Emails are compared lowercased everywhere.
  - Rules: the owner can never be demoted or deleted, judged after the batch, so a promote-then-transfer in one batch works. Ownership can only move to an admin member.
  - Rules let an active admin delete any non-owner member doc, including another admin. The UI is stricter (demote first).
- **Tests that lock this in**: `src/clubs/area/PeopleTab.test.tsx`, `src/access/membersApi.test.ts`, `src/access/accessApi.test.ts`, `src/clubs/clubAdminApi.test.ts`, `tests/rules/members.rules.test.ts`, `tests/rules/sectionAccess.rules.test.ts`, `tests/rules/teams.rules.test.ts`, `tests/rules/clubDoc.rules.test.ts` (ownership transfer).

### Export tab (`src/clubs/area/ExportTab.tsx`, `src/clubs/export/*`, `/club?tab=export`)

- **Purpose**: free self-service export of everything the club stores, as one ZIP built in the browser (club-platform spec §7.2; it also serves the Data Act and GDPR portability).
- **Who can see / do what**: club admins, in both full and restricted mode. Rules: `exporter()` = club admin while the club is `active` or `suspended`, or `terminating` before `retrievalEndsAt`. After `retrievalEndsAt` the reads fail; the admin is locked out by `ClubGate` anyway.
- **Elements**:
  - Card with the heading "Export your club's data".
  - Description: "One ZIP file with everything your club has stored: teams, players, physical tests, matches with every scouting event, the library, guides and access lists. README.txt inside explains each file. It holds minors' personal data, so keep it somewhere safe."
  - **Download export** button (primary, Download icon).
  - A progress line (`role="status"`) while running.
  - An error line (`role="alert"`) when the export fails.
- **Actions → results**: **Download export**:
  1. Sets progress to "Starting".
  2. `loadClubExportData(onProgress)` reads **from the server only** (`getDocFromServer`, `readAllFromServer`, paged at 200 per page; it never uses the offline cache). Progress labels, in order:
     - "Club and people": club doc, members, acceptances, statusLog;
     - "Team i of n: <team name or id>": for each team, `loadTeamExportData(teamId, { includeEvents: true, includeCalendar: true })` plus `teams/{id}/awards`;
     - "Library": exercises (each with its `diagrams`), trainings, counters;
     - "Guides and access": `config/skillGuide` and `config/physicalTestGuide` read by id, then `sectionAccess`.
  3. `buildClubExportFiles(data, now)` builds the file map. Paths use document ids, never names:
     - `README.txt`, `club.json`, `members.json`, `acceptances.json`, `statusLog.json`;
     - per team: `teams/<teamId>/{team.json, players.json, players.csv, calendar.json, testingSessions.json, awards.json, scoutProfile.json, matches/<matchId>.json}`;
     - `library/{exercises,trainings,counters}.json`;
     - `config/{skillGuide,physicalTestGuide}.json` (`null` if the guide was never saved);
     - `sectionAccess.json`.
  4. `zipSync` (fflate) builds the ZIP, which is downloaded through `downloadBlob` as `club-<slug>-export-<YYYY-MM-DD>.zip`:
     - the slug comes from the club name with non-letters/digits turned into `-` (falls back to the club id);
     - the date is the UTC date from `toISOString`.
  5. Success notice "Export downloaded".
  - Content details:
    - Timestamps become ISO strings and `undefined` fields are dropped.
    - Match events are sorted by `order`. Diagrams are sorted by `order`.
    - `players.csv` has a UTF-8 BOM, CRLF line endings, a fixed English header (Number … Left club), rows sorted by shirt number, guardians as `relation: name, phone, email | …`, and spreadsheet formula injection guarded (prefix `'`).
    - `README.txt` starts with `Club data export\nClub: <name> (<id>)\nExported: <ISO>`, then a formats section, a minors' data warning, one entry per file pattern present, and field meanings.
- **States**:
  - Running: the button is disabled and the progress text is shown. The last label stays visible during zipping.
  - Error: shows "Export failed: <Firebase/Error message without trailing period>. Nothing was downloaded." and re-enables the button. Nothing is downloaded.
  - Offline: fails, because server-only reads throw (for example "Failed to get documents from server").
- **Validation & messages**: as above. The error embeds the raw `Error.message`, which is English Firebase text.
- **Edge cases**:
  - An empty club still builds (no team folders).
  - If the club doc is missing, it throws "club not found".
  - `config` is read by id because the rules name the doc ids, so a list would fail.
  - Everything happens in memory on the main thread. This is inferred to be heavy for big clubs.
- **Tests that lock this in**: `src/clubs/area/ExportTab.test.tsx`, `src/clubs/export/clubExport.test.ts`, `src/clubs/export/clubExportApi.test.ts`, `src/export/exportJson.test.ts`, `tests/rules/export.rules.test.ts`.

> `src/export/` is **not** a feature screen. It holds shared helpers: `exportJson.ts` (`toExportable`, `fileSlug`, `downloadText`, `downloadBlob` with a 60 s delayed revoke for Safari, `downloadJson`) and `shareFile.ts` (`shareOrDownload` through `navigator.share` with a download fallback). The awards and training-PDF features use them; this area uses only `downloadBlob`, `toExportable` and `fileSlug`.

### Contract tab (`src/clubs/area/ContractTab.tsx`, `/club?tab=contract`)

- **Purpose**: contract status, termination dates, the accepted legal versions with links, the "End our contract" request, and the operator contact.
- **Who can see / do what**:
  - Club admins in full and restricted mode. It is the default tab when restricted.
  - "End our contract" is offered only when `status` is `active` or `suspended` **and** `termination.requestedAt` is not set. This matches the rule `terminationRequest()`.
- **Elements** (definition list in a card):
  - **Status**: the status in words: Pending / Active / Paused / Ending / Deleted.
    - When `suspended` and a `statusReason` exists, the reason appears under it.
    - When `termination.effectiveAt` is set: "Full use until <long date>".
    - When `retrievalEndsAt` is set: "Data export until <long date>".
  - **Accepted terms**:
    - "<versionKey>, accepted <long date> by <email>". The date is omitted while `acceptedAt` is a pending server timestamp. Shows "Not yet accepted" if there is no `legal`.
    - Links: **Terms** → `/legal/terms?v=<termsVersion>` and **DPA** → `/legal/dpa?v=<dpaVersion>` (only when the key parses as `terms-<t>_dpa-<d>`); **Sub-processors** → `/legal/subprocessors` (always).
  - If a request exists: "End of contract requested on <long date> by <email>".
  - **End our contract** (destructive button), when offered.
  - If `OPERATOR_CONTACT_EMAIL` is set: "Questions about your contract? Contact <mailto link>."
- **Actions → results**: **End our contract** opens a `ConfirmDialog`:
  - title "End your club's contract?", message "We'll be told you want to leave. Your club keeps full use and a window to export your data until the end date we confirm.", confirm button "Request end of contract";
  - confirming calls `requestTermination(myEmail)`, which writes only `termination.requestedAt = serverTimestamp()` and `termination.requestedBy = <lowercased email>`;
  - success: the dialog closes and the notice "End of contract requested" is shown. The button then disappears (live club doc) and the "requested on" line appears;
  - failure: "Couldn't send the request. Try again." inside the dialog;
  - Cancel clears the error.
- **States**:
  - No button while `terminating` or `pending`, or once a request exists.
  - Dates are formatted with `formatDateValue(d,'long')` in the UI locale.
- **Edge cases**:
  - The club cannot pick an end date. The operator sets the dates (Platform → End contract).
  - Reinstating clears the request, so the club can ask again.
  - If an admin with outdated terms has a pending request, `ClubGate` shows a non-blocking banner ("Your club ended the contract instead of accepting the updated terms…") instead of the blocking review screen.
- **Tests that lock this in**: `src/clubs/area/ContractTab.test.tsx`, `src/clubs/clubAdminApi.test.ts`, `tests/rules/clubDoc.rules.test.ts` ("lets a club admin request termination while active or suspended", "refuses the platform admin changing the club's termination request").

### Club gate, status views and ending banner (context: `src/clubs/ClubGate.tsx`, `clubView.ts`, `nextBoundary.ts`, `ContractEndingBanner.tsx`)

`ClubStatusScreen` and `WelcomePage` are only summarised here because they decide whether the club area is reachable.

- **`clubView(club, role, now)`** uses the same strict comparisons as the rules:

  | Club state | Club admin sees | Member sees |
  |---|---|---|
  | no club, or `deleted` | `none` → WelcomePage | `none` → WelcomePage |
  | `pending` | `pending` → pending screen | `pending` → pending screen |
  | `active` | `app` | `app` |
  | `suspended` | `exportOnly` | `locked` |
  | `terminating`, `effectiveAt` missing or `now < effectiveAt` | `ending` (full app plus banner) | `ending` (full app plus banner) |
  | `terminating`, `effectiveAt <= now < retrievalEndsAt` | `exportOnly` | `locked` |
  | `terminating`, `now >= retrievalEndsAt` (or `retrievalEndsAt` missing) | `locked`, shown as the "ended" screen | `locked`, shown as the "ended" screen |

- **Boundary timer**: `nextBoundaryDelay` returns the ms until the next future boundary (`effectiveAt`, then `retrievalEndsAt`) of a terminating club, clamped to 2,147,483,647 ms. `ClubGate` re-renders on it, so an open tab flips view at the exact moment without a reload.
- **ContractEndingBanner** (in `AppShell`, `role="status"`, orange, hidden in print) shows only when `status === 'terminating'` and `effectiveAt` is set:
  - admin, when `retrievalEndsAt` is also set: "Your contract ends on <date>. Export your data before <date>."
  - everyone else: "Your club's contract ends on <date>."
- **Tests**: `src/clubs/clubView.test.ts`, `src/clubs/nextBoundary.test.ts`, `src/clubs/ClubGate.test.tsx`, `src/clubs/ClubStatusScreen.test.tsx`, `tests/rules/lifecycle.rules.test.ts`.

### Guides page (`src/admin/GuidesPage.tsx`, `/admin/guides`)

- **Purpose**: container for the two guide editors.
- **Who can see / do what**:
  - Club admins and guides-section admins (`RequireSection section="guides"`). Others get "You don't have access to this page."
  - Rules: writes need `activeMember() && canGuides()`. Reads are open to any active member (other screens show the guide text) and to `exporter()`.
- **Elements**:
  - `PageHeader` "Guides"; document title "Guides".
  - A plain `role="tablist"` (aria-label "Guides") with two `Tab`s: **Skill Guide** and **Physical Test Guide**.
- **Actions → results**: clicking a tab switches the panel. This is **local state** only: no `?tab=` param, and unlike the other tabbed pages there is no phone picker.
- **States**: defaults to Skill Guide.
- **Tests that lock this in**: `src/admin/GuidesPage.test.tsx` (no dedicated `RequireSection`/`RequireClubAdmin` test file exists), `tests/rules/skillGuide.rules.test.ts`, `tests/rules/physicalTestGuide.rules.test.ts`, `tests/rules/sectionAccess.rules.test.ts`.

### Skill guide editor (`src/skillGuide/SkillGuideEditor.tsx`, `skillGuideApi.ts`, `bandColor.ts`)

- **Purpose**: edit the text of each score range and the "How to evaluate" text for each skill. Skills and ranges are fixed; only the text is editable.
- **Elements**:
  - One card per skill, in stored order. The fallback has **9 skills**: serve, attack, block, set, defence, reception, jump, speed, iq.
  - The heading uses the translated skill label `t.labels.playerSkill[key]`, falling back to the stored `label`.
  - Each range (fallback: 1-3, 4-6, 7-8, 9-10) is a textarea labelled "<min>-<max>", in a two-column grid from `sm`.
  - Each range block has a coloured left border from `bandBorderClass(min)`: `min < 4` red, `< 7` orange, `< 9` blue, else green.
  - A "How to evaluate" textarea per skill.
  - One **Save** button at the bottom.
- **Actions → results**: **Save** calls `updateSkillGuide(skills, firebaseUser.uid)`:
  - `setDoc` of `config/skillGuide` = `{ skills, updatedBy: uid, updatedAt: serverTimestamp() }`. The whole guide is replaced.
  - **No success notice.**
  - Failure: "Could not save the skill guide. Please try again." (`role="alert"` under the button).
  - Does nothing without `firebaseUser`.
- **States**:
  - Loading: an empty list with Save **disabled** until loaded. There is no loading text.
  - Load error: only "Could not load the skill guide. Please refresh the page." (`role="alert"`). No form and no Save.
  - Unsaved club: shows the fallback in the **active UI language** (for example Italian), and reloads when the catalog changes. Nothing is written until an explicit save.
  - Saved club: shown exactly as stored, never translated.
- **Edge cases**:
  - No unsaved-changes guard; leaving the page loses edits.
  - Saving an untouched fallback persists the fallback text in the current UI language.
  - The band colours of the guide ranges (4-6 orange, 7-8 blue) are not the same thresholds as the player level bands (`< 6` Developing, `< 8` Advanced).
- **Tests that lock this in**: `src/skillGuide/SkillGuideEditor.test.tsx`, `src/skillGuide/skillGuideItalian.test.tsx`, `src/skillGuide/skillGuideApi.test.ts`, `src/skillGuide/bandColor.test.ts`, `tests/rules/skillGuide.rules.test.ts`.

### Physical test guide editor (`src/physicalTestGuide/PhysicalTestGuideEditor.tsx`, `physicalTestGuideApi.ts`)

- **Purpose**: edit the protocol text for each physical test.
- **Elements**:
  - One card per test. The fallback has **8 tests**.
  - The heading uses `t.labels.physicalTest[key]`, falling back to the stored label.
  - A "Protocol" textarea per test (min height 100px).
  - One **Save** button.
- **Actions → results**: **Save** calls `updatePhysicalTestGuide(tests, uid)` (`setDoc` of `config/physicalTestGuide` = `{ tests, updatedBy, updatedAt }`).
  - No success notice.
  - Failure: "Could not save the physical test guide. Please try again."
- **States**: the same pattern as the skill guide: Save disabled until loaded; on load error only "Could not load the physical test guide. Please refresh the page." and no form; fallback shown in the UI language until saved; a saved guide is shown as stored.
- **Tests that lock this in**: `src/physicalTestGuide/PhysicalTestGuideEditor.test.tsx`, `src/physicalTestGuide/physicalTestGuideItalian.test.tsx`, `src/physicalTestGuide/physicalTestGuideApi.test.ts`, `tests/rules/physicalTestGuide.rules.test.ts`.

### Platform page (`src/platform/PlatformPage.tsx`, `/platform`)

- **Purpose**: the operator's console.
- **Who can see / do what**:
  - Only a signed-in user whose `platformAdmins/{email}` doc exists. `RequirePlatformAdmin` → `RequireSignedIn` handles loading, auth error and the redirect to `/login`. Anyone else sees "You don't have access to this page."
  - No club membership is needed, and it is **outside `ClubGate`**, so the club status never affects it.
- **Elements**:
  - `MinimalShell` titled "Platform": logo (not a link), signed-in email, Sign out. There is no nav back into the app.
  - `PageHeader` "Platform"; document title "Platform".
  - `SectionTabs` labelled "Platform sections" with **Clubs** and **Leads**.
- **Actions → results**: tab choice → `?tab=clubs|leads` (`replace`). The default is Clubs.
- **Entry points**:
  - Sidebar / More page item "Clubs & sign-ups", with the unreviewed-lead count badge (orange pill; on More it carries the screen-reader suffix `t.morePage.pendingSignups`).
  - WelcomePage "Open the platform page" button for an operator with no club.
  - `/admin/interest` redirect.
- **Tests that lock this in**: `src/platform/PlatformPage.test.tsx`, `src/auth/RequirePlatformAdmin.test.tsx`, `tests/rules/platformAdmin.rules.test.ts`.

### Clubs table (`src/platform/ClubsTable.tsx`, `platformApi.listClubs`)

- **Purpose**: list clubs and launch lifecycle actions.
- **Who can see / do what**: the operator. Rules: `clubs` list and get are allowed for `isPlatformAdmin()`. The operator **cannot** read anything inside a club (members, teams, players, library), cannot edit profile, legal, owner or the termination request, and cannot create their own member doc.
- **Elements**:
  - A "Status" filter `<select>` with the options All / Pending / Active / Paused / Ending / Deleted.
  - A table with **5 columns**: Club, Owner, Status, Terms, Actions. It wraps and is not forced full-width; it is horizontally scrollable, with bottom padding so the row menu can open.
  - **Club** (row header): the club name, with "<country> · created <numeric date or —>" under it.
  - **Owner**: `ownerEmail`, which can break anywhere.
  - **Status**: the status in words. For `terminating` it adds "Ends <date> · export until <date>".
  - **Terms**: "Accepted <version>" (for a `terms-YYYY-MM-DD_…` key it shows the terms date, otherwise the key as stored), or a grey "Not accepted".
  - **Actions**: the primary actions as ghost buttons. Secondary actions sit in a "More actions for <club>" menu (MoreHorizontal trigger, 44px target; `role="menu"`/`menuitem`; arrow keys and Escape).
  - **Load more** button when `hasMore`.
  - **No links at all** (no `<a>`).
- **Actions → results**:
  - Changing the filter reloads the first page: `orderBy('createdAt','desc')`, plus `where status ==` if filtered, `limit(50)`. A request counter discards stale responses.
  - Load more uses the `startAfter(lastDoc)` cursor and appends.
  - Choosing an action opens `ClubActionDialog`. On success the row is patched locally with the new status, reason and dates. There is no refetch.
- **States**:
  - Loading: an empty table and no text.
  - Empty, after load: "No clubs yet." (unfiltered) or "No clubs with this status." (filtered).
  - Load error: "Could not load clubs. Please refresh the page."
  - Load-more error: "Could not load more clubs. Please try again."
- **Edge cases**:
  - A `deleted` club shows no actions.
  - After a status change under a filter, the row stays visible with its new status until the filter changes (inferred).
  - The operator email is lowercased before it is passed on.
- **Tests that lock this in**: `src/platform/ClubsTable.test.tsx`, `src/platform/platformApi.test.ts`, `tests/rules/clubDoc.rules.test.ts`, `tests/rules/platformAdmin.rules.test.ts`.

### Club lifecycle actions (`src/platform/clubActions.ts`, `dates.ts`)

Actions offered by status (labels follow the UI language at call time):

| From status | Primary | Secondary (More menu) |
|---|---|---|
| `pending` | **Activate** → `active` | **Reject** → `deleted` |
| `active` | **Deactivate** → `suspended` (reason required) | **End contract** → `terminating` (needs dates) |
| `suspended` | **Activate** → `active` | **End contract** → `terminating` (needs dates) |
| `terminating` | **Reinstate** → `active` (clears the dates and the request) | **Change dates** → `terminating` (needs dates) |
| `deleted` | none | none |

This matches the rules' `transitionAllowed`: pending→active|deleted; active→suspended|terminating; suspended→active|terminating; terminating→active|terminating.

Default dates (`defaultTerminationDates(now, status)`):

- `effectiveAt` = now + 30 days. For a `suspended` club it is **today** instead, because any later date would give the club full use again.
- `retrievalEndsAt` = `effectiveAt` + 30 days.

Date helpers:

- `startOfLocalDay` / `endOfLocalDay` turn `YYYY-MM-DD` into local midnight and 23:59:59.999.
- `retrievalLongEnough` requires `retrievalEndsAt - effectiveAt >= 30 × 86,400,000 ms`. Tests cover DST: the start of day N to the end of day N+30 is enough across both DST changes.

Tests: `src/platform/clubActions.test.ts`, `src/platform/dates.test.ts`.

### Club action dialog (`src/platform/ClubActionDialog.tsx`, `platformApi.changeClubStatus`)

- **Purpose**: confirm one lifecycle action and collect a reason and, where needed, dates.
- **Elements** (`Dialog`, `role="dialog"`, title "<Action>: <club name>"):
  - **Intro text**:
    - Activate: "The club will be able to use the app."
    - Deactivate: "The club is paused: its people can no longer use the app. You can activate it again later."
    - Reject: "The club request is rejected."
    - Reinstate: "The end of the contract is cancelled and the club becomes active again."
    - End contract / Change dates: "The club keeps full use until the end date, then can only export its data until the export date."
  - End contract on a **paused** club adds: "A later end date gives the club full use again until then."
  - For dated actions: two date inputs, **End date** and **Data export open until** (two columns from `sm`).
    - End contract prefills the defaults above.
    - Change dates prefills the stored dates (falling back to the defaults if either is missing).
  - **Reason** textarea, labelled "Reason" when required (Deactivate) or "Reason (optional)" otherwise. `maxLength=300`, with an `n/300` counter.
  - Footer: **Cancel** (ghost) and the confirm button, labelled with the action name. It is primary for Activate and Reinstate, destructive for Deactivate, End contract, Change dates and Reject.
- **Actions → results**: **Confirm** calls `changeClubStatus({clubId, from, to, reason: trimmed || null, dates?}, operatorEmail)`, **one batch**:
  - `clubs/{id}` update:
    - `status`, `statusReason`, `statusChangedAt = serverTimestamp`, `statusChangedBy = operator email`, `lastStatusLogId = new log id`;
    - for dated actions: `termination.effectiveAt` = `startOfLocalDay(end)` as a Timestamp, or the **stored Timestamp unchanged** if the end date was not edited in Change dates; `termination.retrievalEndsAt` = `endOfLocalDay(export)`;
    - Reinstate: sets `termination.effectiveAt`, `retrievalEndsAt`, `requestedAt` and `requestedBy` all to `null`;
  - plus `clubs/{id}/statusLog/{newId}` = `{ from, to, reason, by, at }`.
  - On success:
    - notice "<club> is now <Status>", or "Dates updated" for Change dates;
    - the row is patched;
    - the dialog closes.
  - Double clicks send one change (`inFlight` ref, and the button is disabled while saving).
  - **Cancel**, Escape or a backdrop click closes without writing. There is **no** dirty guard.
- **States / validation** (inline `role="alert"`; any error disables confirm):
  - Deactivate: confirm is disabled until the trimmed reason is non-empty.
  - Either date empty: "Choose both dates."
  - End date before today (local), unless it is the unchanged stored end date in Change dates: "The end date can't be in the past."
  - Export date less than 30 days after the end date: "Data export must stay open at least 30 days after the end date."
  - Today is allowed as the end date (serious breach).
  - Write failure: "Could not update the club. Please try again." The dialog stays open, confirm is re-enabled, and there is no notice and no row change.
- **Edge cases**:
  - Change dates may keep an end date that has already passed and move only the export date.
  - Moving the end date to another past date is refused.
  - Reasons are trimmed. An empty optional reason writes `statusReason: null`, which overwrites any previous reason (for example, Activate after a pause clears the pause reason).
  - Rules mirror all of this, with one day of tolerance for "today": statusReason ≤ 300 characters, required for suspended, and the log must be fresh, written in the same batch and match from/to/reason.
- **Tests that lock this in**: `src/platform/ClubActionDialog.test.tsx`, `src/platform/platformApi.test.ts`, `tests/rules/clubDoc.rules.test.ts` (all status-change, date, log and reinstate cases).

### Leads tab: access requests panel (`src/interest/AccessRequestsPanel.tsx`, `interestApi.ts`, `signupEvents.ts`, `usePendingSignups.ts`; `/platform?tab=leads`)

- **Purpose**: a permanent list of everyone who asked for access on `/request-access`.
- **Who can see / do what**: the operator only (rules: read, update and delete need `isPlatformAdmin()`; a club admin is denied).
- **Elements**:
  - A card headed "Access requests" with an orange "<n> new" pill when there are unreviewed requests (the count comes from the server: `getCountFromServer` on `reviewed == false`).
  - A list (max height 24rem, scrolls), newest first, 50 per page. Each row shows:
    - the name (bold while unreviewed);
    - a role chip: Coach / Guardian / Player / Other;
    - an orange **New** badge while unreviewed;
    - "<email> · <numeric date>" (the date only when `createdAt` is a Timestamp).
  - Row buttons:
    - **Mark reviewed** (only while unreviewed);
    - **Delete**;
    - **Grant access**, only when the `onGrant` prop is given. The platform page does **not** pass it, so it never shows there.
  - **Load more** when `hasMore`.
- **Actions → results**:
  - **Mark reviewed**: `updateDoc({reviewed:true})`. The row stays listed, its New badge goes, the count drops by 1, and the `interest-signups-changed` window event fires so the nav badge recounts.
  - **Delete**: opens a confirmation:
    - title "Delete <name>'s request?", message "Their name and email are removed for good. Grant access first if they should keep it.", confirm button "Delete request";
    - confirming calls `deleteDoc`, removes the row, decrements the count if the request was unreviewed, and fires the event.
  - The row's buttons are disabled while that row is saving.
- **States**:
  - Empty: "No one has requested access yet."
  - Errors:
    - "Could not load access requests. Please refresh the page."
    - "Could not load more requests. Please try again."
    - "Could not update this request. Please try again."
    - Delete error inside the dialog: "Could not delete this request. Please try again."
- **Nav badge**: `usePendingSignups(enabled)` counts on mount and recounts on the event. It is always 0 when not the operator. The badge appears in the `AppShell` sidebar and on the More page, but not in `MinimalShell`.
- **Tests that lock this in**: `src/interest/AccessRequestsPanel.test.tsx`, `src/platform/PlatformPage.test.tsx` (no Grant access on Leads), `tests/rules/interestSignups.rules.test.ts`, `tests/rules/platformAdmin.rules.test.ts`.

### Request access page (`src/interest/RequestAccessPage.tsx`, `/request-access`, public)

- **Purpose**: the public lead form.
- **Elements**:
  - `AuthShell` headed "Let's get you set up", with a "Sign in" nav action (→ `/login`).
  - Intro text.
  - **Name** (required, placeholder "Jamie Smith").
  - **Email** (`type=email`, required).
  - **I am a...** select: Coach (default) / Guardian / Player / Other.
  - Privacy text linking "privacy policy" (→ `/privacy`), with an under-16 notice.
  - **Request access** button (arrow icon).
  - "Already have access? Sign in" link and `LegalLinks`.
- **Actions → results**:
  - Submit calls `addDoc(interestSignups, { name: trimmed, email: trimmed, role, reviewed:false, createdAt })`.
  - Success replaces the form with "Thanks!" / "We've got your request and will be in touch about early access." / "Back to sign in".
  - Failure: "Could not submit your request. Please try again." (`role="alert"`).
  - The button is disabled while submitting.
- **Validation**: only HTML `required` and `type=email`. Rules: name 1–200 characters, email 1–200 characters, valid role, `reviewed == false`, no extra keys.
- **Tests that lock this in**: `src/interest/RequestAccessPage.test.tsx`, `tests/rules/interestSignups.rules.test.ts`.

---

## Must-keep invariants

1. `/club` is reachable only by club admins (`access.isClubAdmin`). Others see "You don't have access to this page." `/admin/access` redirects to `/club?tab=people`.
2. The club area tabs are, in order, Profile, People & access, Export, Contract. The tab is driven by `?tab=` with `replace` navigation, and an unknown tab falls back to the default.
3. A club admin of a `suspended` club, or of a `terminating` club with `effectiveAt <= now < retrievalEndsAt`, gets **only** the restricted club area: Profile read-only (no Save), Export, Contract; default tab Contract; no People & access; no app nav. This applies at any URL.
4. A member (non-admin) in the states of invariant 3 gets the "paused" lock screen. After `retrievalEndsAt` everyone gets the "ended" screen. Before `effectiveAt` a terminating club keeps the full app, plus a banner.
5. View changes at `effectiveAt` and `retrievalEndsAt` happen live, without a reload (boundary timer). Comparisons are strict: full use only while `now < effectiveAt`, export only while `now < retrievalEndsAt`.
6. Profile saves write exactly six fields: name, country, locale, aiEnabled, referenceOptOut, growthTestsEnabled. The name is trimmed and must be 2–80 characters (checked inline before any write). Success notice: "Club details saved".
7. The country list is the fixed 36 codes. A stored country outside the list stays selectable. Italiano is offered only when Italian is enabled or the club already stores `it`.
8. Membership is explicit. Adding a person creates `members/{email}` with a lowercased email, a role, `addedBy` and `addedAt`. Adding an existing member is refused with "<email> is already a member." A malformed email is refused before any write.
9. The owner can never be demoted or removed. The last admin can never be demoted or removed. Another admin must be demoted before removal. Each disabled state shows its reason text.
10. Remove from club, Make owner, and demoting **yourself** each require a confirmation dialog, with focus starting on Cancel. Demoting yourself reloads the page afterwards.
11. Remove from club deletes the member doc **and** strips the email from every team `adminEmails` and every `sectionAccess` list, in one batch.
12. Grant saves write only the team and section docs whose membership changed, and the email is lowercased. Save is disabled when nothing changed. Admins show no grant controls ("Admins have full access to every team and section.").
13. Ownership can be transferred only to an existing admin. Any admin may do it.
14. The export reads from the server only and never ships a partial ZIP from the offline cache. A failure shows "Export failed: … Nothing was downloaded." and downloads nothing.
15. The export ZIP contains exactly the spec §7.2 file set, with id-based paths, ISO timestamps, events and diagrams sorted by `order`, a BOM-prefixed CSV with formula guarding, and a README that names every file. The file name is `club-<slug>-export-<YYYY-MM-DD>.zip`.
16. Export shows step-by-step progress ("Club and people", "Team i of n: <name>", "Library", "Guides and access"), and the button is disabled while it runs.
17. Export is available in both the full and the restricted club area.
18. "End our contract" appears only for `active` or `suspended` clubs with no existing request, requires confirmation, writes only `termination.requestedAt` (server time) and `requestedBy` (lowercased), and is then replaced by "End of contract requested on <date> by <email>". The club never chooses dates.
19. The Contract tab always links Sub-processors. It links Terms and DPA at the **accepted** versions when the version key parses. It shows the operator contact only when `OPERATOR_CONTACT_EMAIL` is configured.
20. `/admin/guides` is open to club admins and guides-section admins only. Each guide saves the whole document with `updatedBy` (uid) and `updatedAt` (server time). Save is disabled until the guide has loaded. A load error shows only the error, with no editable form.
21. An unsaved guide shows the fallback in the active UI language and is never written automatically. A saved guide is shown exactly as stored, never translated. Skill and test headings use translated labels.
22. Skills, ranges and tests are fixed. Only the range descriptions, "How to evaluate" and "Protocol" texts are editable. Range colours follow `bandBorderClass`.
23. `/platform` needs only a signed-in operator (no club membership, outside `ClubGate`) and renders in a minimal shell with sign-out. `/admin/interest` redirects to `/platform?tab=leads`.
24. The operator UI shows club-doc fields only (name, country, created, owner, status, termination dates, accepted terms version) and **contains no links** into club data.
25. Lifecycle actions offered per status exactly match the transition table above. Deleted clubs offer none. End contract, Change dates and Reject are visually secondary (More menu).
26. Every lifecycle action goes through a confirmation dialog and writes the club update and a fresh `statusLog` entry in **one batch**, with matching from, to and reason, and the operator's lowercased email.
27. Deactivate requires a non-empty reason. Every reason is at most 300 characters, with a visible counter.
28. Date rules:
    - both dates required;
    - the end date may not be before today (local), except that Change dates may keep the unchanged stored end date even if it has passed;
    - the export date must be at least 30 days after the end date, computed with start of day for the end date and end of day for the export date;
    - today is allowed as the end date.
    - The end date defaults to now + 30 days, or today for a paused club; the export date defaults to end + 30 days.
29. Reinstate sends no dates and clears `effectiveAt`, `retrievalEndsAt`, `requestedAt` and `requestedBy` to null. No other action touches the termination request.
30. A lifecycle write failure keeps the dialog open with "Could not update the club. Please try again." and changes nothing. A double click sends one change.
31. The clubs list is newest first, paged by 50 with a cursor, and filterable by status (All plus the five statuses).
32. Leads are visible to the operator only. Mark reviewed keeps the row but clears its New badge and decrements the count. Delete requires confirmation and removes the row. Both update the nav badge live (`interest-signups-changed`).
33. The pending-leads badge shows only for the operator, on the "Clubs & sign-ups" nav item (sidebar and More page).
34. `/request-access` is public and indexable. It creates `{name, email, role, reviewed:false, createdAt}` with trimmed fields and confirms with "Thanks!".
35. Success feedback goes through `useNotify()`; errors stay inline with `role="alert"` (inside the dialog while a dialog is open).

---

## Current UX pain points / redesign opportunities

*Observations only. None of these are requirements.*

- **Guide saves give no success feedback.** The skill and physical-test guide Save buttons are silent on success. There is also no dirty or unsaved-changes guard, and no loading indicator: the page is empty with Save disabled until the guide loads.
- **The Guides page is inconsistent with the other tabbed pages.** It uses plain `Tab`s with local state, so there is no `?tab=` deep link and no phone picker. `/club` and `/platform` use `SectionTabs` with `?tab=`.
- **The People tab caps the team checklist at 50 teams.** `listAllTeams()` is called once and `hasMore` is ignored. This is a silent functional gap for big clubs.
- **The People tab has no success notices** for add, save grants or role changes. The only feedback is the list refresh or the auto-selection.
- **Role changes are inconsistent about confirmation.** Make admin and demoting another admin happen instantly; demoting yourself, Make owner and Remove are confirmed.
- **`ConfirmDialog`'s confirm button is not disabled while the action runs.** A double tap on Remove or Make owner could fire twice (the platform dialog guards against this; the club ones do not).
- **The People tab has no loading or empty states.** Both lists render empty until all three loads finish.
- **The person list is just emails**, with no search or filter. It may become long.
- **Profile form fields do not follow live club-doc updates** (state is initialised once). Edits made in another tab or by another admin are not reflected until a reload.
- **The export error embeds raw, English Firebase error text** (for example "Missing or insufficient permissions"), even in Italian. During zipping the progress stays on "Guides and access" and the UI may freeze for large clubs, because `zipSync` runs on the main thread.
- **The export file date is UTC** (`toISOString`), so near midnight the name can show a different day than local time.
- **The restricted club area has no explanation header.** It drops straight into the Contract tab inside a minimal shell. The ending banner exists only in `AppShell`, so restricted admins see the dates only on the Contract tab.
- **Platform shell has no way back to the app.** An operator who is also a club member must navigate manually (logo is not a link, no nav).
- **The clubs table has no loading indicator.** Rows patched after an action may no longer match the active filter, but they stay listed.
- **The club action dialog has no dirty guard.** Escape or a backdrop click discards a typed reason or chosen dates. Date errors appear inline and disable confirm immediately.
- **The Leads delete message says "Grant access first if they should keep it"**, but no Grant access action exists on the platform page (`onGrant` is not passed). The `onGrant` and Grant access code path is effectively dead.
- **Leads list rows have three buttons each**, all small ghost buttons on phones, and nothing makes Delete look destructive.
- **The skill-guide band colours (thresholds 4/7/9) differ from the player level bands (4/6/8)**, so the same score can show different colours on different screens.
- **Nav naming differs from page titles.** The nav item "Members & settings" opens a page titled "Club"; "Clubs & sign-ups" opens "Platform", whose tab is "Leads".

---

## Open questions

1. Should the redesign fix the 50-team cap in People & access (page through all teams), or keep it as current behaviour to preserve "exact functionality"?
2. Should the guide editors and the People tab gain success notices and unsaved-changes guards, which would change feedback behaviour? Or is silent success part of the contract?
3. The "Grant access" path in `AccessRequestsPanel` (`onGrant`) is never used. Can the redesign drop it, and fix the delete-confirmation copy that refers to it?
4. Should `/admin/guides` adopt `?tab=` deep links and the phone picker like `/club` and `/platform`?
5. Restricted club area: should it show the ending banner or a status header (dates, reason) above the tabs, or keep Contract as the only place for that information?
6. Should the platform shell offer a link back to the app for operators who are also club members?
7. Should Make admin and demoting another admin get confirmations for consistency? Today they are instant.
8. Export error text: should Firebase messages be mapped to localised messages?
9. Is the difference between the skill-guide band thresholds (4/7/9) and the level bands (4/6/8) intended (range-based versus average-based), or a bug to align?
10. CLAUDE.md says "The 8 skills"; the code and fallback guide have 9 (with `iq`), and the CSV and rules list 9. Which count should the redesign spec treat as canonical? The code says 9.
