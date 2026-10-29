# Home dashboard, teams, team page, calendar and physical testing

Parity inventory for the UI redesign (branch `feature/ui-redesign`, written 2026-10-28). It records
what the code does **today**. Where something is inferred rather than read directly from code or
tests, it says so.

**What this area is for.** A coach opens the app on the home dashboard (`/`). It shows live matches
to resume, the next 7 days, recent results and the coach's teams. From there they open the teams
list (`/teams`) and a team page (`/teams/:teamId`). The team page has seven tabs: Roster, Calendar,
Matches, Stats, Development plan, Physical testing, Settings. On those tabs the coach manages players
(add one, bulk-import, mark starters, remove), assigns trainings to calendar days, edits the team
development plan, runs a live physical-testing session, and edits, exports or deletes the team.

**Routes covered**

| Route | Component | Gate |
|---|---|---|
| `/` | `src/home/HomePage.tsx` | `RequireAuth` + `ClubGate`, inside `AppShell` |
| `/teams` | `src/teams/TeamsListPage.tsx` | same |
| `/teams/:teamId` (`?tab=…`) | `src/teams/TeamPage.tsx` | same; Firestore rules decide whether the team can be read |

**Who uses it**

- **Club admin**: everything in the club. Only club admins can create, bulk-import or delete teams.
- **Team admin**: an email in `teams/{id}.adminEmails`. Can read and work on that team.
- **Member** with section access: the `trainings` section adds the Calendar tab and calendar export.
- Anyone else gets no team access. Rules allow a team read only for club admins or listed emails.
  So in practice **everyone who reaches a team page is a team admin or a club admin**. The code
  still has viewer branches (the Stats tab is hidden for non-admins). This was inferred from
  `firestore.rules` `match /teams/{teamId}` and `listMyTeams`.

Matches tab and Stats tab internals are covered by other inventory files. Only their entry points
are described here.

---

## Screens and components

### Home dashboard (`src/home/HomePage.tsx`, route `/`)

- **Purpose**: personal landing page that combines data from all the user's teams. It shows what is
  live, what is coming up, recent results and shortcuts to teams.
- **Who can see / do what**
  - Every signed-in member of an active club sees it.
  - Content is limited to the teams returned by `listMyTeams(email)`: teams whose `adminEmails`
    contains the user's (lowercased) email, first page only (20).
  - The "no access" card shows only when the user has **no teams and no section access**. Section
    access means `access.sections.exercises || trainings || guides || access.isClubAdmin`.
- **Elements (top to bottom)**
  1. **Welcome band**: `<section aria-label="Welcome">`, navy background (`bg-navy`). It is the one
     branded surface in the app. A half-court line drawing (`CourtLines` SVG, `aria-hidden`) bleeds
     off the right edge.
     - The club name (`club.name` from the active club doc) shows as an uppercase eyebrow, only if
       present.
     - The `<h1>` greeting is time-based: hour < 12 gives "Good morning", < 18 "Good afternoon",
       else "Good evening". It is followed by `, Name` when a name can be derived.
     - Name derivation: the part of the email before `@`, split on `.`, `_` or `-`, first chunk,
       first letter capitalised. For example `john.doe@x` gives "John".
     - Below that, today's date in the full locale format (`formatDateValue(new Date(), 'full')`).
  2. **Body**, chosen by state:
     - Loading: `PageSkeleton layout="team"` with the label "Loading your dashboard...".
     - Teams query failed: `role="alert"` "Could not load your teams." No other blocks render.
     - No teams and no sections: the no-access card. Heading "You don't have access to any team yet".
       Body: "A club administrator grants access to teams and sections. Ask them, or send a
       request." Button-styled link **Request access** to `/request-access`.
     - Otherwise:
       - **Live now** (`LiveNowBlock`)
       - A 2-column grid on `lg` (1 column below) holding **Next 7 days** (`NextUpBlock`) and
         **Recent results** (`RecentResultsBlock`)
       - **Your teams**, only if the user has at least one team
  3. **Your teams**: heading "Your teams".
     - When there are more teams than the first page (`hasMoreTeams`), a link "All teams →" to
       `/teams` and the line "Showing your first N teams." appear.
     - Grid of team cards: 1, 2 or 3 columns. Each card links to `/teams/:id` and shows the name,
       then "ageGroup · season".
     - Order: as returned by `listMyTeams` (`createdAt desc`).
- **Actions → results**
  - "Request access" goes to `/request-access`.
  - A team card goes to `/teams/:id`.
  - "All teams →" goes to `/teams`.
  - Block actions are listed under the sub-blocks below.
- **States**
  - No email (signed-out edge): loading ends with no data.
  - Each sub-block has its own error line, so one failing team or query does not blank the page.
  - Page title (`usePageMeta`): "Home".
- **Data fetching (`useHomeFeed`)**
  1. `listMyTeams(email)`: first page only (`TEAMS_PAGE_SIZE = 20`, `orderBy createdAt desc`).
  2. For each team, in parallel:
     - `listCalendarSessions(teamId, today, today+7)`
     - `listMatchesInRange(teamId, today−30, today+7)`
  3. "Today" is the **local** calendar date (`todayIso` in `homeFeed.ts`).
  4. If any team's sessions query fails, `errors.sessions` is set. If any matches query fails,
     `errors.matches` is set. A failing team contributes empty arrays.
  5. The effect is cancelled on unmount or when the email changes.
- **Edge cases**
  - A failing calendar query does not hide matches (test).
  - The greeting depends on the device clock.
  - The Live-now and Next-up blocks are computed from the same match query (`status` filter).
- **Tests that lock this in**: `src/home/HomePage.test.tsx`, `src/home/homeFeed.test.ts`

#### Live now block (`src/home/LiveNowBlock.tsx`)

- Renders **nothing** when there are no live matches.
- Header: "Live now" with a radio icon, uppercase, red.
- A grid (1 column, 2 from `sm`) of cards with a red 2px border. Each card shows:
  - the team name (small)
  - "vs {opponent}"
  - the set score `setsUs–setsThem` (large, tabular, en dash)
  - a red button-styled link **Resume scouting** to `/teams/:teamId/matches/:matchId/scout`
- Source: `liveMatches()` returns every match with `status === 'live'` across teams, in team order
  and then query order.

#### Next 7 days block (`src/home/NextUpBlock.tsx`)

- Title "Next 7 days". On failure, `role="alert"` "Could not load upcoming sessions." appears
  *above* whatever items did load.
- Empty: "Nothing in the next 7 days."
- Items come from `nextUp(feed, today, 7)`:
  - calendar sessions with `today ≤ date ≤ today+7`
  - matches with `status === 'setup'` and a date in the same window
  - sorted by date ascending, then by team name
- Each row is one link, at least 44px tall:
  - the weekday-formatted date (`formatDate(iso,'weekday')`, fixed width)
  - the title: the training name, or "vs Opponent" for a match
  - a team-name chip
  - On phones the title sits above the chip. From `sm` they share one row, chip first.
- Link targets:
  - a session goes to `/teams/:teamId`, which lands on the **Roster** tab, not the calendar
  - a match goes to `/teams/:teamId/matches/:matchId`

#### Recent results block (`src/home/RecentResultsBlock.tsx`)

- Title "Recent results". On failure, alert "Could not load matches.". Empty: "No finished matches
  yet."
- Items come from `recentResults(feed, 5)`: finished matches across all teams, newest date first,
  at most 5. Only matches dated within the last 30 days can appear, because of the query window.
- Each row has a main link to `/teams/:teamId/matches/:matchId` containing:
  - a W/L pill: "W" in green when `setsUs > setsThem`, otherwise "L" in red. A tie counts as L.
  - the set score
  - "vs Opponent"
  - "team name · ISO date"
- An optional **separate** sibling link "MVP: #7 A. Name" goes to
  `/teams/:teamId/matches/:matchId/awards`.
  - The MVP comes from `matchMvpLabel`: the saved `awards.picks.mvp` override, else computed by
    `rankAward('mvp', …)`. It is hidden if the pick is `hidden`, or if no MVP can be determined.
  - The two links are **never nested** (a test asserts there is no `a a`).

### Teams list (`src/teams/TeamsListPage.tsx`, route `/teams`)

- **Purpose**: browse every team the user administers. Club admins can also create teams and
  bulk-import them.
- **Who can see / do what**
  - Every member sees the page.
  - The **Import** and **Create team** buttons appear only for a **club admin**
    (`access.isClubAdmin`).
  - The list query is `adminEmails array-contains email` for everyone, club admins included. A club
    admin therefore sees only the teams they are listed on (inferred from `listMyTeams`).
- **Elements**
  - `PageHeader` titled "Teams". The header stacks on mobile: title above, and the action row is a
    full-width grid. From `sm` it is a flex row (test).
  - Empty card:
    - club admin: "No teams yet."
    - others: "No teams assigned yet — ask your club admin."
  - Grid of team cards: 1, 2, 3 or 4 columns at `sm`, `lg` and `xl`. Each card links to
    `/teams/:id` and shows:
    - a 2-letter monogram: initials of the first two words, or the first two letters of a single
      word, uppercase; "?" when the name is empty
    - the name (truncated)
    - the age group
    - a "Season {season}" pill
    - the description, clamped to 2 lines, if present
  - Order: `createdAt desc`.
  - **Load more** button (centred) when `hasMore`. `hasMore` is true when the last page came back
    full: 20 docs.
- **Actions → results**
  - **Create team** opens `CreateTeamDialog`. On success the dialog closes and the first page
    reloads. There is no notice.
  - **Import** opens `BulkImportDialog` with:
    - title "Import teams"
    - `TEAM_IMPORT_EXAMPLE`
    - `validateTeamRows`
    - commit through `bulkCreateTeams(inputs, uid, email)`
    - On success: the dialog closes, a notice "Imported N team(s)." shows, and the first page
      reloads.
  - **Load more** appends the next page (cursor `startAfter(lastDoc)`).
- **States**
  - No loading indicator: the empty card shows until the first page arrives. Inferred: an empty
    flash.
  - No error state: a failed load leaves the list empty.
  - Page title: "Teams".
- **Tests that lock this in**: `src/teams/TeamsListPage.test.tsx`, `src/teams/teamsApi.test.ts`,
  `src/teams/teamsImport.test.ts`, `src/teams/teamsImportMessages.test.ts`

### Create team dialog (`src/teams/CreateTeamDialog.tsx`)

- **Who**: club admin only (opened from the teams list; rules require `isClubAdmin`).
- **Elements**: modal `Dialog` titled "Create team" with `guardUnsaved`. Fields in order:
  1. Name (required)
  2. Age group (required)
  3. Season (required, free text, for example "2026-27")
  4. Team type: a select with a disabled "Choose…", then Women, Men, Mixed (required)
  5. Description (textarea, optional)

  Buttons: **Cancel** (ghost) and **Create** (primary).
- **Actions → results**
  - Create calls `createTeam({name, ageGroup, season, description, gender}, uid, appUser.email)`.
  - The doc written to `clubs/{c}/teams` holds: the input, `notes: ''`,
    `adminEmails: [creatorEmail]` (lowercased `appUser.email`), an empty development plan,
    `createdBy`, and `createdAt: serverTimestamp()`.
  - Then `onCreated()` runs.
- **Validation & messages**
  - Create stays **disabled until a team type is chosen**. Native `required` covers the other
    fields.
  - The button reads "Saving…" and is disabled while saving. `useSave` guarantees a single write
    on a double click.
  - Error: `role="alert"` "Could not create the team. Please try again."
- **Edge cases**
  - Escape on an untouched form closes it.
  - Escape after typing opens the "Discard changes?" alertdialog.
  - Italian: the labels are translated but the English code (`women`) is saved.
- **Tests**: `src/teams/CreateTeamDialog.test.tsx`, `src/teams/teamsItalian.test.tsx`

### Bulk import dialog (generic) (`src/bulkImport/BulkImportDialog.tsx`)

Used for teams (teams list) and players (roster tab).

- **Elements**: `Dialog` size `lg`. **No** `guardUnsaved`, so Escape or the backdrop closes it even
  with text pasted. In order:
  1. An optional hint line. For players: "Imported players start with consent not given — confirm
     each one on their card."
  2. A collapsible `<details>` "Example format" holding a `CodeBlock` with the example JSON and
     copy buttons ("Copy code", "Copied", "Copy failed").
  3. "Paste JSON" textarea (10 rows, id `bulk-json`).
  4. "…or choose a file": a file input accepting `application/json,.json`. Its text replaces the
     textarea.
  5. **Validate** (secondary). It reads "Checking…" while an async validation runs.
  6. Result areas:
     - parse error (`role="alert"`)
     - row errors as a `role="alert"` list, scrolling with max height 48
     - success line "N entries ready to import." in green
     - commit error (`role="alert"`)
  7. Footer: **Cancel** and **Import** (primary). Import reads "Importing…" while committing.
- **Flow**
  1. Validate runs `parseJsonArray(text)`, then the feature validator.
  2. Parse issues (from `bulkImport.issues`):
     - blank: "paste or upload some JSON first"
     - invalid JSON: "that is not valid JSON: {parser message}"
     - not an array: "the top level must be a JSON array (square brackets)"
     - empty array: "the array is empty — nothing to import"
     - more than 100 rows: "import is limited to 100 entries at a time; split the file into
       smaller batches" (`MAX_IMPORT = 100`; exactly 100 is accepted)
  3. A validator that throws or rejects shows "Could not validate the data. Please try again."
  4. Row errors are listed one per issue, 1-indexed ("row 3: …"). If **any** row has an error,
     **nothing** is importable: all or nothing.
  5. Import is enabled only after a clean validation with at least one row. "0 entries ready to
     import." keeps it disabled.
  6. Import calls `commit(inputs)`, then `onImported(count)`.
  7. A commit failure shows "Could not import. Nothing was saved. Please try again."
  8. Cancel is disabled while committing. Validate is disabled while validating or committing.
- **Edge cases**
  - Any textarea edit or file change resets every result and bumps a generation counter. A stale
    async validation result is dropped, and the "Checking…" spinner is cleared so Validate stays
    usable.
- **Writes**: one `writeBatch` per import, wrapped in `withBackoff` (one retry on a transient error
  such as `resource-exhausted`). Both APIs refuse more than 100 inputs before writing.
- **Team rows** (`validateTeamRows`)
  - `name`: required, trimmed.
  - `gender`: required, one of women/men/mixed. Case and surrounding spaces are ignored.
  - `ageGroup`, `season`, `description`: optional text, default `''`.
  - Unknown keys (for example `club`) are ignored.
  - Messages:
    - `row n: each entry must be a JSON object`
    - `row n: "name" is required`
    - `row n: "gender" is required (women, men or mixed)`
    - `row n: "gender" must be women, men or mixed`
    - `row n: "{field}" must be text`
- **Player rows** (`validatePlayerRows`)
  - `number`: required, a finite number.
  - `fullName`: required, trimmed.
  - `dob`: optional, must match `YYYY-MM-DD`.
  - `nationality`, `licenseNumber`, `playerPhone`: optional text.
  - `positionCategory`: one of S, OH, O, MB, L, U, TBD. Defaults to TBD.
  - `shirtSize`: one of XS, S, M, L, XL, XXL, 3XL, or `''`.
  - `guardians`: an array of `{relation: mother|father|other, name (required), phone?, email?}`.
  - `skills`: an object whose keys are skill keys, each value 1–10 or null. Partial maps are
    expanded with nulls. Unknown keys are rejected.
  - Messages are in `t.players.import` (for example `row n: "dob" must be YYYY-MM-DD` and
    `row n: "skills.{key}" must be a number from 1 to 10, or null`).
  - Imported players get:
    - `consent: {given:false, date:null, confirmedBy:null}`
    - `starting: false`
    - `viewerEmails: []`
    - `teamName`, `ageGroup` and `season` denormalised from the team
    - `avgScore` and `level` computed from the imported skills
- **Tests**: `src/bulkImport/BulkImportDialog.test.tsx`, `parseJsonArray.test.ts`,
  `importMessages.test.ts`, `src/players/playersImport.test.ts`,
  `src/players/playersImportMessages.test.ts`, `src/teams/teamsImport*.test.ts`,
  `src/teams/TeamPage.test.tsx` (end-to-end player import notice)

### Team page shell (`src/teams/TeamPage.tsx`, route `/teams/:teamId`)

- **Purpose**: one team's workspace, split into tabs.
- **Loading the team**
  - `getTeam(teamId)` reruns when `teamId` changes or on retry.
  - Missing doc, or an error with code `permission-denied` / `not-found`: `NotFoundState`.
    - Heading "Team not found", message "It may have been deleted, or you don't have access."
    - Link button "All teams" to `/teams`.
    - When the user belongs to other usable clubs: "This may belong to another of your clubs." plus
      a "Switch to {club}" button per club (`switchClub`).
  - Any other error (for example `unavailable`): `role="alert"` "Could not load this team." with a
    **Try again** button that refetches.
  - While loading: `PageSkeleton layout="team"` labelled "Loading team...".
  - Page title: the team name, or "Team" before it loads.
- **Elements**
  - `PageHeader` with the team name as the title. The description, if any, shows as the header
    description and is hidden in print.
  - The title sits on the page canvas, not inside a card (test).
  - Then `SectionTabs`, labelled "Team section":
    - phones (`< sm`): a full-width native `<select>` (combobox "Team section")
    - `sm` and up: an underline `role="tablist"` with `role="tab"` items
    - hidden in print
- **Tabs, in this order** (test: "ordered by how often a coach uses them, Settings last")

  | id | Label | Visible when |
  |---|---|---|
  | `roster` | Roster | always (default) |
  | `calendar` | Calendar | `access.sections.trainings` (club admins have every section) |
  | `matches` | Matches | always |
  | `stats` | Stats | team admin (`isTeamAdmin`: listed email **or** club admin) |
  | `plan` | Development plan | always |
  | `physical` | Physical testing | always |
  | `settings` | Settings | always |

- **URL behaviour**
  - The active tab is `?tab=<id>`. An unknown or missing value shows `roster`.
  - Legacy ids map to new ones: `overview` → `roster`, `physicalSession` → `physical`.
  - `?tab=calendar` without trainings access, or `?tab=stats` for a non-admin, falls back to
    **roster**. The hidden tab is not listed.
  - Changing tab replaces the history entry (`replace: true`), keeps other params, and **deletes the
    Stats filter params** `comp`, `ha`, `range`, `from`, `to`.
  - Example: `?tab=stats&comp=cup&range=last5`, then clicking Matches, gives `?tab=matches` (test).
- **Team-admin check**: uses the lowercased `appUser.email`, not the raw sign-in email (test).
- **Cross-tab flows**
  - Calendar "Match" on a day sets `newMatchDate` and switches to Matches. `TeamMatchesTab` opens
    its create-match flow prefilled with that date, then calls `onNewMatchHandled` to clear it.
  - Development-plan save updates the in-memory team.
  - The Settings save and the physical session start/close update the team through
    `onTeamUpdated` / `onTeamChanged`.
- **Matches tab entry point**: `<TeamMatchesTab teamId teamName gender newMatchDate
  onNewMatchHandled />`. Covered elsewhere.
- **Stats tab entry point**: lazy `TeamStatsTab` (`./stats/TeamStatsTab`) with the fallback
  "Loading team stats…", rendered only for team admins. Covered elsewhere.
- **Tests**: `src/teams/TeamPage.test.tsx`, `src/teams/teamAccess.test.ts`,
  `src/components/SectionTabs.test.tsx`, `src/components/NotFoundState.test.tsx`

### Roster tab (inside `TeamPage`; `TeamRosterTable.tsx`, `TeamStatsRow.tsx`, `RetentionNotice.tsx`, `TeamGenderPrompt.tsx`)

**Who can see / do what**: anyone who can open the team page (team admins and club admins). There
is no UI gating on add, import, starting or remove; rules enforce team-admin rights.

**Elements, top to bottom**

1. **Team gender prompt** (`TeamGenderPrompt`)
   - Shown only when **all** of these hold:
     - Italian is enabled (`ITALIAN_ENABLED`)
     - the user is a team admin
     - the team has no `gender`
   - Content: heading "Is this a women's, men's or mixed team?", hint "Used for wording in Italian.
     You can change it later in Settings.", and three buttons Women / Men / Mixed.
   - A tap calls `updateTeamInfo(teamId, {gender})`. On success the prompt disappears and the team
     state updates.
   - On failure: alert "Could not save the team type. Please try again." Buttons are disabled while
     saving.
   - Teams without a gender read as `mixed` everywhere (`teamGender`).
2. **Retention notice** (`RetentionNotice`)
   - Queries `listPlayersDueForDeletion(teamId, cutoff)`:
     - `cutoff = today − 12 months` (`RETENTION_MONTHS = 12`, UTC date, day clamped)
     - `where leftClubAt <= cutoff`, `orderBy leftClubAt`, `limit 50`
   - Renders **nothing** when no one is due, or when the query fails (silently).
   - Otherwise an orange box:
     - heading "1 player is due for deletion" / "N players are due for deletion" (gendered in
       Italian)
     - body "They left the club more than 12 months ago, so their data should be deleted. Export it
       first from their card if the family asked for a copy."
     - a list: player name (link to `/teams/:teamId/players/:id`), "· left {leftClubAt}", and a red
       **Delete** button
   - Delete opens a ConfirmDialog:
     - title "Delete {name}?"
     - message "This permanently deletes their player card, skills, development plan, physical tests
       and testing-session entries, and removes their name and number from past match reports.
       This cannot be undone."
     - confirm label "Yes, delete player"
     - focus starts on Cancel
   - On confirm, `deletePlayer` runs (see erasure below). The row is removed, and the roster table
     remounts (`rosterRefreshKey`).
   - Error inside the dialog: "Could not delete this player. Please try again."
3. **Stats row** (`TeamStatsRow`)
   - Two `StatTile`s: **Players** (count) and **Avg. skill** (`computeTeamAvgScore` to 1 decimal,
     "—" when no player has a score).
   - Computed from the **loaded** roster pages only (fed by `onPlayersChange`).
4. **Action buttons**, right-aligned. On mobile they form a 2-column full-width grid (test).
   - **Import players** (secondary) opens BulkImportDialog for players.
     - On success: notice "Imported N player(s) with consent not given — confirm each one on their
       card." for **6000 ms** (the default notice lasts 4000 ms), and the roster remounts.
   - **+ Add player** (primary) opens AddPlayerDialog. On success the dialog closes and the roster
     remounts. There is no notice.
5. **Roster** (`TeamRosterTable`)

**Roster: loading and controls**

- Data: `listPlayers(teamId)`, `orderBy('number')`, page size **25**. A **Load more** button appears
  when the page was full and uses cursor paging.
- **Search** input (type search, sr-only label "Search players", placeholder "Search name, position,
  number")
  - Case-insensitive substring match on full name, position code (for example "mb") and shirt
    number.
  - Client-side, over the **loaded** players only.
- **Sort** select (aria-label "Sort roster")
  - **Lineup** (default): starters first, then position rank S < OH < O < MB < L < TBD < U, then
    number (0 or missing numbers last), then name.
  - **Skill level**: `avgScore` descending, nulls last, ties broken by number.
  - **Birthdate**: oldest first by actual ISO date. Missing or invalid dates go last.
  - A `number` sort exists in `rosterSort.ts` but is **not offered** in the UI.
  - Sorting is client-side over loaded players.

**Roster: two layouts**

- **Below `xl` (< 1280px)**: a card grid, 1 column (2 from `sm`), each card marked
  `data-testid="roster-mobile-card"`.
  - Header: a link to the player card (`/teams/:teamId/players/:id`) containing "#number" (if not
    null) and the full name. A `LevelPill` sits on the right, gendered.
  - A `<dl>` with Position (label gendered for Italian), Born ("YYYY-MM-DD · Ny", or "—"), and
    Skill avg (1 decimal, or "—").
  - Footer:
    - a **Starting** checkbox with a visible label (sr-only text "Starting: {name}")
    - a **Remove** button (`dangerGhost`, aria-label "Remove {name}"), kept outside the link (test)
- **`xl` and up**: a table with columns:
  1. Start (checkbox)
  2. Name (blue link)
  3. Position (truncated to 10rem)
  4. Born
  5. Skill avg (right-aligned, tabular)
  6. Level (pill)
  7. actions: a Remove button, with sr-only header text "Actions"

  The table wrapper is `relative overflow-x-auto`.
- Empty: "No players yet." (no players loaded), or "No players match your search." (filtered to
  zero).

**Roster: actions**

- **Starting checkbox**
  - Optimistic update.
  - Writes `setPlayerStarting(teamId, playerId, bool)`.
  - On failure: reverts and shows alert "Could not update the lineup. Please try again."
  - The lineup sort re-sorts immediately.
- **Remove** opens a ConfirmDialog:
  - title "Remove {name}?"
  - the same erasure message as the retention notice
  - confirm label "Yes, remove player"
- On confirm, `deletePlayer` runs:
  1. erase the player's footprint: testing-session entries, match roster names, scouting usage
  2. delete the `physicalTests` subcollection
  3. delete the player doc last
- On success: the row disappears, `onPlayersChange` fires, and TeamPage shows the notice "Player
  removed."
- On failure: "Could not remove this player. Please try again." in the dialog, and the player stays.
- Cancel clears the error.

**Tests**: `src/teams/TeamRosterTable.test.tsx`, `src/players/rosterSort.test.ts`,
`src/teams/TeamStatsRow.test.tsx`, `src/teams/RetentionNotice.test.tsx`,
`src/players/retention.test.ts`, `src/teams/teamGender.test.ts`, `src/teams/TeamPage.test.tsx`,
`src/teams/teamsItalian.test.tsx`

### Add player dialog (`src/players/AddPlayerDialog.tsx`)

- **Elements**: `Dialog` titled "Add player", size `lg`, `mobileSheet` (full-screen sheet on
  phones), `guardUnsaved`. Fields in order:
  1. Number (type number, required)
  2. Full name (required)
  3. Date of birth (type date, required)
  4. Nationality
  5. License #
  6. Position: a select with values S, OH, O, MB, L, U, TBD, labelled Setter, Outside, Opposite,
     Middle, Libero, Universal, TBD (gendered in Italian). Default TBD.
  7. Shirt size: "Not set", XS, S, M, L, XL, XXL, 3XL.
  8. Phone.
  9. A **Guardians** heading, then one bordered block per guardian, starting with one:
     - Relation: Mother, Father or Other (default Mother)
     - Guardian name (required)
     - Guardian phone
     - Guardian email (type email)
     - **Remove guardian** (only when there is more than one guardian)
  10. A **+ Add guardian** button.
  11. A consent checkbox (required) with the `CONSENT_TEXT` copy. Tests match `/guardian has
      consented to storing this player's data/i`.

  Buttons: **Cancel** and **Create** ("Saving…" while saving).
- **Actions → results**
  - Submit runs only if consent is ticked; otherwise there is no write (tests).
  - It calls `createPlayer(teamId, team, {number: Number(number), fullName, dob, nationality,
    licenseNumber, positionCategory, shirtSize, playerPhone, guardians}, uid, email)`.
  - The doc gets:
    - `consent {given:true, date: today (UTC ISO), confirmedBy: email}`
    - `starting: false`, `viewerEmails: []`
    - empty skills, `avgScore: null`, `level: null`, an empty development plan
    - the denormalised `teamName`, `ageGroup` and `season`
    - timestamps
  - Then `onCreated()`.
- **Validation**
  - Native `required` on number, full name, date of birth, each guardian name, and consent.
  - A single write on a double click (`useSave`).
  - Error: "Could not create the player. Please try again."
  - Escape when untouched closes; once edited it asks "Discard changes?".
- **Tests**: `src/players/AddPlayerDialog.test.tsx`

### Calendar tab (`src/calendar/TeamCalendarTab.tsx`)

- **Who**: only users with **trainings** section access; club admins included. Everyone else has no
  tab, and a deep link falls back to Roster.
- **Purpose**: month view of training sessions, each one an assigned club training, plus the team's
  matches. Training assignment starts here.
- **Data**
  - Visible month only:
    - `listCalendarSessions(teamId, monthStart, monthEnd)`: `where date >= start`,
      `where date <= end`, `orderBy date`, `limit 200`
    - `listMatchesInRange(teamId, start, end)`: `limit 50`, failures swallowed to `[]`
  - Month bounds come from `monthRange(year, month)`, first and last ISO day.
  - Re-queried on month navigation and after any add or delete.
  - The initial month is the device's current local month.
- **Header**: chevron buttons "Previous month" and "Next month" (44×44) around the month label
  (`formatMonth`, for example "September 2026").
- **Error**: `role="alert"` "Could not load calendar sessions. Please refresh the page." The grid
  stays visible (test).
- **Desktop layout (`min-width: 768px`, `useMediaQuery`)**: a 7-column grid with Monday first.
  - Weekday header row uses short names ("Mon"…).
  - The grid always has whole weeks; padding days come from the adjacent months.
  - **Out-of-month cells**: dimmed (40% opacity), day number only, **no add buttons** (test).
  - **In-month cells**, top to bottom:
    1. The day number, right-aligned. Today's number sits in a blue filled circle, the cell has a
       blue inset ring, and the label reads `aria-label="Today, YYYY-MM-DD"`.
    2. **Match chips**: orange, trophy icon, linking to `/teams/:teamId/matches/:matchId`.
       - The label is "vs Opponent" for a `setup` match.
       - Otherwise it is "vs Opponent 3–1" (`setsUs–setsThem`).
       - A `title` tooltip repeats the label.
    3. **Session chips**: blue. Each one is:
       - a link with the label "{trainingBusinessId} · {trainingName}" (for example
         "TR-0007 · Passing circuit"), going to
         `/trainings?businessId=<id>&team=<teamId>&session=<sessionId>`
       - a small red × button, aria "Remove {businessId} on {date}"
    4. A full-width **+ Add** button, aria "Add training on {date}". It highlights on cell hover.
    5. A **Match** button with a trophy icon, aria "Add match on {date}". Only shown when the
       `onNewMatch` prop is passed (always, from TeamPage).
- **Mobile layout (< 768px)**: compact month plus a day list.
  - Weekday initials (narrow names).
  - Each in-month day is a 48px-tall button with `aria-pressed` for the selection.
    - The aria-label is `"[Today, ]Tuesday 15 September[, N training(s)]"`.
    - Below the number: up to **3 dots** in total. Blue dots for sessions come first, then orange
      dots for matches in the remaining slots.
    - Selected day: navy filled circle. Today (unselected): blue ring.
  - Out-of-month days are faded and inert.
  - **Default selection**: today if it is in the viewed month, otherwise the 1st. It resets on month
    change.
  - Below the grid, a `<section aria-label="Trainings on {day label}">` with:
    - heading: the day label (for example "Tuesday 15 September")
    - buttons **Add training** (aria "Add training on {date}") and **Match** (aria "Add match on
      {date}")
    - match chips at touch size (`min-h-11`)
    - session cards (left blue border). Each card is a link showing the business id, training name
      and notes (truncated), plus a 44×44 × remove button.
    - Empty: dashed box "No trainings scheduled."
- **Actions → results**
  - Add / Add training opens `AssignTrainingDialog` for that date. On save the dialog closes and the
    month reloads. There is no notice.
  - × / remove opens a ConfirmDialog:
    - title "Remove this session?"
    - message "{businessId · name} on {date}"
    - confirm label "Yes, remove"
  - On confirm, `deleteCalendarSession` runs and the month reloads.
  - On failure: "Could not remove the session. Please try again." in the dialog.
  - Match calls `onNewMatch(date)`, which switches to the Matches tab with the create flow prefilled.
  - A session link opens the training in the Trainings library with team context. There the PDF
    export asks for team notes (covered by the trainings inventory).
- **There is no edit of an existing calendar session.** Sessions are created and deleted only; the
  API has no update function.
- **Tests**: `src/calendar/TeamCalendarTab.test.tsx`, `src/calendar/monthGrid.test.ts`,
  `src/calendar/calendarApi.test.ts`

### Assign training dialog (`src/calendar/AssignTrainingDialog.tsx`)

- **Elements**: `Dialog` titled "Assign training", `mobileSheet`, `guardUnsaved`. In order:
  1. **Date**: a date input prefilled with the tapped day. It can be changed, so the session may be
     saved on another day.
  2. **Find by business ID**: a text input (placeholder "TR-0007") plus a **Find** button.
  3. **Training** fieldset: a radio list showing "businessId name".
     - Loaded with `listTrainings()`: club library ordered by `businessId`, page size 25.
     - **Load more** appears while the last page returned at least one row. This is not the API's
       `hasMore` flag (see pain points).
     - Empty: "No trainings available.", shown only after a successful load.
  4. Once a training is selected, "Exercises in {name}": a list (aria "Training exercises") in
     `order`. Each row has:
     - an expand chevron (aria "Expand / Collapse {name}") that shows the description, or "No
       description."
     - a diagram thumbnail
     - the exercise name, or a red warning "Deleted exercise" when the exercise doc is gone. The
       chevron is disabled in that case.
     - "N min"
     - Only one row is expanded at a time. Exercises are loaded with `getExercisesByIds`, one read
       per id.
  5. **Notes** textarea with a `HealthHint`: "Don't record health, injury or medical information."
  6. Buttons: **Cancel** and **Assign** ("Saving…" while saving).
- **Actions → results**
  - **Find** with a non-blank id calls `findTrainingByBusinessId(trimmed)` (`limit 1`).
    - The list is replaced by the single result, or by nothing.
    - The result is auto-selected; a miss clears the selection.
    - Load more is hidden afterwards.
  - **Assign** with no selection shows "Pick a training to assign.".
  - Otherwise it calls `createCalendarSession(teamId, {date, trainingId, trainingBusinessId,
    trainingName, notes}, uid)`. The training label is denormalised and `createdAt` is a server
    timestamp. Then `onSaved()`.
  - A single write on a double click.
- **Errors (all inline `role="alert"`)**
  - "Could not load trainings. Please try again." (and the empty state is hidden)
  - "Could not load more trainings. Please try again."
  - "Could not search for that training. Please try again."
  - "Could not assign the training. Please try again."
- **Tests**: `src/calendar/AssignTrainingDialog.test.tsx`

### Development plan tab (inside `TeamPage`; `src/components/DevelopmentPlanEditor.tsx`)

- **Who**: anyone on the team page. TeamPage passes `isAdmin={true}` unconditionally, so the Edit
  button always shows; rules enforce rights.
- **Container**: one card (`rounded-lg border bg-surface shadow-card`).
- **Read view**, uncontrolled mode:
  1. "Short-term objectives" with a count, then objective cards or "No short-term objectives yet.".
  2. "Season objectives" with a count, then cards or "No season objectives yet.".
  3. "General notes": the text with line breaks preserved, or "No notes yet.".
  4. An **Edit** button (`EditButton`).
- **Objective card**
  - The title, or "Untitled objective".
  - A `StatusChip`.
  - A left accent colour by status: Active green, In progress blue, Completed ink, Not started
    slate, Attention orange.
  - A calendar icon with the target:
    - short-term: "Target date {date}" or "No target date"
    - season: "Target {text}" or "No target set"
  - The coach comment under a divider, only if present (no dangling separator; test).
- **Edit dialog**: titled "Edit development plan", size `lg`, `guardUnsaved`. It edits a copy of the
  plan, reset from the saved plan each time the dialog opens.
  - Short-term rows: Objective, Target date (date), Status (Active / In progress / Completed / Not
    started / Attention), Coach comment (with HealthHint), **Remove**.
  - **+ Add short-term objective** adds a row with status "Not started".
  - Season rows: Objective, Target (text), Status, Coach comment (with HealthHint), Remove.
  - **+ Add season objective**.
  - General notes textarea with HealthHint.
  - **Cancel** discards the edits. **Save** calls
    `updateTeamDevelopmentPlan(teamId, plan)`, which writes the whole `developmentPlan` field. Then
    the local team updates and the dialog closes.
  - On failure: "Could not save the development plan. Please try again." The edits are kept.
  - No validation; empty objectives are allowed.
- **Tests**: `src/components/DevelopmentPlanEditor.test.tsx`, `src/teams/teamsApi.test.ts`
  ("updates the team development plan")

### Physical testing tab (`src/physicalSessions/TeamPhysicalSessionTab.tsx`)

- **Who**: anyone on the team page. Club feature flag `growthTestsEnabled` (`useClubFeatures`):
  when false, the **Growth** quality is hidden everywhere in the session UI. Rules also refuse growth
  writes in that case.
- **Data**
  - The **whole roster**: loops through `listPlayers` pages (25 each) until `hasMore` is false.
  - Players with `leftClubAt` set are **excluded**.
  - When `team.activeTestingSessionId` is set, `getSession(teamId, id)`.
- **Render order of states**
  1. No firebase user: nothing.
  2. Roster error: alert "Could not load the roster. Please refresh the page."
  3. Roster loading: "Loading roster..."
  4. Session load error: alert "Could not load the active session. Please refresh the page."
  5. Active session loaded: `LiveSessionView`.
  6. Active id but session not yet loaded: "Loading session...".
  7. No active session: `StartSessionCard`.
- **Tests**: `src/physicalSessions/TeamPhysicalSessionTab.test.tsx`

#### Start session card (`StartSessionCard.tsx`)

- A box with a **Date** input (default "today" as a **UTC** date, `toISOString().slice(0,10)`) and a
  primary **Start new session** button.
  - Start calls `startSession(teamId, date, uid)` in a transaction:
    - if the team already has `activeTestingSessionId`, it throws `SessionAlreadyOpenError` and shows
      "A testing session is already open for this team."
    - otherwise it creates `testingSessions/{id} {date, status:'open', createdBy, createdAt,
      closedAt:null}` and sets `team.activeTestingSessionId`
  - Then the parent team updates and the live view shows.
  - Other failures: "Could not start the session. Please try again."
- **Past sessions** list: `listPastSessions` returns `status=='closed'`, `orderBy date desc`,
  `limit 50`.
  - Each row is a button showing the date with a chevron. A tap opens `PastSessionDialog`.
  - Empty: "No sessions yet.". On failure: alert "Could not load past sessions.".
- After a deletion inside the past-session dialog, the row is removed from the list and the notice
  "Session deleted." shows.
- **Tests**: `StartSessionCard.test.tsx`, `testingSessionsApi.test.ts`

#### Live session view (`LiveSessionView.tsx`)

- **Header**:
  - "Session started {date}"
  - **Delete session** (ghost) and **Close session** (`dangerGhost`)
- **Entries**: one live `onSnapshot` listener on `testingSessions/{id}/entries`, unsubscribed on
  unmount. Updates arrive without re-reading. On listener error: alert "Could not load session
  progress. Please refresh the page."
- **Layout**: `PlayerRosterPicker`, then a `QualityTileGrid` for the selected player when one is
  selected. Side by side from `sm`.
- **Close session** opens a ConfirmDialog:
  - title "Close this session?"
  - message "Entries already finished stay on each player's card. This can't be reopened."
  - confirm label "Yes, close"
- Close calls `closeSession`, a transaction setting `status:'closed'`, `closedAt`, and
  `team.activeTestingSessionId = null`. Back to the start card.
- Close error: "Could not close the session. Please try again."
- **Delete session** opens a ConfirmDialog:
  - title "Delete this session?"
  - message "This also removes the N result(s) recorded in it from the players' cards. This can't be
    undone.", where N is the count of `complete` entries
  - confirm label "Yes, delete"
- Delete calls `deleteSession`:
  1. delete each complete entry's physical test from the player's history
  2. in one batch: delete the entries and the session, and clear the team pointer if this was the
     open session
  3. notice "Session deleted.", then back to the start card
- Delete error: "Could not delete the session. Please try again."
- **Tests**: `LiveSessionView.test.tsx`

#### Player roster picker (`PlayerRosterPicker.tsx`)

- Empty team: "No players in this team yet. Add them in the Roster tab." Shown instead of the search
  box.
- A search input (aria "Search players", placeholder "Search players...") filters by name. It is
  case-insensitive and the list is always visible.
- A list (aria "Players", scrollable, max height 20rem, 32rem from `sm`) of buttons with
  `aria-pressed`. Each shows:
  - "#number" (only if number > 0)
  - the name (truncated)
  - "done/total": completed qualities out of the visible test count, **8** with growth or **7**
    without
  - A legacy growth entry is not counted when growth is off.
- No match: "No players match.".
- Selection highlight: `bg-blue/10`.
- **Tests**: `PlayerRosterPicker.test.tsx`

#### Quality tile grid (`QualityTileGrid.tsx`)

- Tiles: 2 columns (4 from `sm`), one per visible test type, in `PHYSICAL_TEST_ORDER`:
  1. Growth
  2. Countermovement Jump. The tile label carries a soft hyphen ("Counter­movement Jump").
  3. Approach Jump
  4. Standing Broad Jump
  5. 10m Sprint
  6. 5-10-5 Shuttle
  7. Reaction Time
  8. Strength
- Each tile shows a status:
  - "Not started" (slate)
  - "In progress" (orange): an entry exists that is not complete
  - "Done" (green)
- A **Done tile is disabled** and cannot be reopened, so a duplicate result cannot be recorded.
- A tap on another tile opens `SessionQualityPanel` for that player and quality, with the existing
  draft entry if any.
- **Tests**: `QualityTileGrid.test.tsx`

#### Session quality panel (`SessionQualityPanel.tsx`)

- `Dialog` titled "{Test label} — {Player name}", `mobileSheet`. It has **no** `guardUnsaved`.
- Fields per test type. Number inputs use `inputMode="decimal"`.

  | Type | Fields |
  |---|---|
  | growth | Height (cm), Body mass (kg) |
  | cmj | attempts list "New attempt (cm)" |
  | approachJump | Standing reach (cm), attempts "New touch attempt (cm)" |
  | broadJump | attempts "New attempt (cm)" |
  | sprint10m | Stopwatch (records into the new-attempt box), attempts "New attempt (s)" |
  | shuttle5105 | Right-first (s) with its own Stopwatch, Left-first (s) with its own Stopwatch |
  | reaction | attempts "New drop attempt (cm)" |
  | strength | Mode (Weighted / Bodyweight), then for weighted: Exercise (Trap-bar deadlift / Squat / Goblet squat) and Weight (kg); for bodyweight: Exercise (Push-ups / Split squat) and Reps |

  Then **Notes** (with HealthHint) and the buttons **Close** (ghost) and **Finish** (primary).
- **Attempts UI**
  - Recorded attempts show as pills "{value} {unit}". The value uses a locale decimal (a comma in
    Italian).
  - Each pill has an "x" button with aria "Remove attempt N".
  - Below: the number input plus **+ Add attempt**. A blank or NaN value is ignored. Adding clears
    the input.
- **Draft persistence**: `saveEntryProgress` merge-writes the entry `{playerId, testType,
  status:'in_progress', data, updatedAt}`. Entry id is `buildEntryId(playerId, testType)`.
  - A save happens on every blur of a single-value field, every attempt add or remove, every select
    change, and every stopwatch record.
  - The write is **skipped when nothing changed** since the last save (serialised comparison).
  - The panel resumes from `entry.data` when reopened.
  - **Notes are not saved in the draft.** Blurring Notes persists only the fields.
- **Finish is enabled when the quality is ready** (`isPhysicalTestReady`):

  | Type | Ready when |
  |---|---|
  | growth | height and mass filled |
  | cmj | at least 3 attempts |
  | broadJump | at least 3 attempts |
  | approachJump | reach plus at least 3 touches |
  | sprint10m | at least 2 attempts |
  | shuttle5105 | both sides filled |
  | reaction | at least 5 attempts |
  | strength | weight (weighted) or reps (bodyweight) |

- **Finish** runs `finishEntry`:
  1. creates a permanent `physicalTests` doc on the player, with the session date and notes. Strength
     uses the latest growth body mass for the ratio (`getLatestByType(..., 'growth')`).
  2. marks the entry `complete` with `resultTestId`
  3. closes the panel
- Finish is disabled while in flight, so a double tap cannot duplicate.
- On failure: "Could not confirm this was saved — check the player card before recording it again."
  Finish becomes enabled again.
- **Tests**: `SessionQualityPanel.test.tsx`, `physicalSessionsItalian.test.tsx`,
  `src/players/physicalTestFieldLogic.test.ts`

#### Stopwatch (`Stopwatch.tsx`)

- A large readout "{seconds to 1 decimal}s", ticking every 100 ms.
- **Start** (primary, full width) / **Stop** (destructive, full width).
  - Stop records the exact elapsed time at the instant of the tap, not the last tick:
    `round(ms)/1000` seconds is passed to `onRecord`, then the readout resets to 0.
- **Reset** (ghost) needs two taps: the first shows "Confirm reset", the second clears the timer and
  stops it. Blurring the button cancels the confirmation.
- **Tests**: `Stopwatch.test.tsx`

#### Past session dialog (`PastSessionDialog.tsx`)

- `Dialog` titled "Physical testing · {date}", size `lg`, `mobileSheet`, read-only.
- The footer has **Delete session** (`dangerGhost`), disabled while loading.
- Loads `listSessionEntries` once. Then, per tested player, `getPlayer`, and per complete entry,
  `getPhysicalTest`. These reads are bounded.
- States:
  - "Loading results…"
  - error alert "Could not load this session. Please try again."
  - empty "No results were recorded in this session."
- Otherwise:
  - "N player(s) tested"
  - a list (aria "Results") sorted by name. A deleted player reads "Removed player".
  - Each player has a `<dl>` of test label and value, in test order. The value is one of:
    - the formatted summary (`formatPhysicalTestSummary`)
    - "Not finished" (orange)
    - "Result deleted"
- Delete opens the same confirm as the live view. N counts the shown values. Then `deleteSession`,
  `onDeleted`, and the parent shows the notice.
- **Tests**: `PastSessionDialog.test.tsx`

#### AttemptsInput (shared, `src/components/AttemptsInput.tsx`)

- Not used by the session panel. It is used by `AddPhysicalTestDialog` on the player card, which is
  covered elsewhere.
- One labelled number input per value ("{label} N"), each `required`. A blank value is stored as NaN.
- With `maxCount`: **+ Add attempt** below the max, and **Remove last attempt** above `minCount`.
  Without `maxCount`, neither control shows.
- **Tests**: `src/components/AttemptsInput.test.tsx`

### Team settings tab (`src/teams/TeamSettingsTab.tsx`)

- **Who**
  - Everyone on the team page sees Team info and Export.
  - Only a **club admin** sees the Danger zone (Delete team).
  - There is **no admin/viewer management UI** on this tab (test "has no admin-management UI").
    Team admins are managed in the club area (`src/access/accessApi.ts`).
- **One card with three dividers**
  1. **Team info** form:
     - Team name (required)
     - Team type (select: "Choose…" disabled, Women, Men, Mixed; required)
     - Description (2 rows)
     - Notes (3 rows, with HealthHint)
     - **Save team info**. Disabled while saving **or when no team type is chosen**, which happens
       on legacy teams without a gender.
     - Save calls `updateTeamInfo(team.id, {name, description, notes, gender})`, all trimmed. Then
       the parent team updates, so the page header renames.
     - There is no success notice. On failure: "Could not save team info. Please try again."
     - Season and age group are **not editable** here.
  2. **Export team data**:
     - Body text: "One JSON file with the team, every player's record and physical tests, testing
       sessions, matches and their reports[, and the calendar]. It holds minors' personal data:
       store it securely." The calendar clause appears only with trainings access.
     - A checkbox "Include raw scouting events (one read per event, slower)".
     - **Export team (JSON)**. It reads "Exporting…" and is disabled while running.
     - It calls `loadTeamExportData(teamId, {includeEvents, includeCalendar:
       !!access.sections.trainings})`.
       - Every collection is read **from the server** and **paged** (`readAllFromServer`).
       - Sections: team, players with their physical tests, testing sessions with entries, matches
         (raw events only if ticked), calendar (or null), scout profile.
     - Then `downloadTeamExport`: a file `team-{slug}-{YYYY-MM-DD}.json` containing `exportedAt`,
       `notes[]` (what was left out: raw events, calendar), and the data with timestamps converted
       to ISO.
     - On failure: "Could not export this team's data. Please try again."
  3. **Danger zone** (club admin only):
     - "Deleting a team also removes its roster and every player's records."
     - **Delete team** (destructive) opens a ConfirmDialog:
       - title "Delete {name}?"
       - message "This will permanently delete the team, its roster, and every player's records,
         including their physical test history. This cannot be undone."
       - confirm label "Yes, delete team"
     - Confirm calls `deleteTeam`. It clears players (and their physicalTests), matches (and
       events), testingSessions (and entries), calendar and scoutProfile, children first. The team
       doc goes last.
     - Then it navigates to `/` with `replace: true`.
     - On failure: "Could not delete the team. Please try again." in the dialog, with no navigation.
- **Tests**: `src/teams/TeamSettingsTab.test.tsx`, `src/teams/teamExport.test.ts`,
  `src/teams/teamsApi.test.ts`

---

## Must-keep invariants

**Fetching and data**

1. **Home fetching**:
   - only the first page of `listMyTeams` (20, `createdAt desc`)
   - per team, exactly one calendar query `[today, today+7]` and one match query
     `[today−30, today+7]`
   - "today" is the local date
   - no other reads
2. **Home error isolation**:
   - a teams failure shows "Could not load your teams." and nothing else
   - a sessions failure shows its error line in Next 7 days, but matches still render, and the
     reverse
3. **Home no-access card** shows only when the user has zero teams **and** no section access (club
   admin counts as access). It links to `/request-access`.
4. **Live now** is omitted entirely when no match is `live`. Each live match has "Resume scouting"
   linking to `/teams/:teamId/matches/:matchId/scout`.
5. **Next 7 days** contains sessions and only `setup` matches, dated `today…today+7` inclusive,
   sorted by date and then team name.
6. **Recent results**:
   - finished only, newest first, at most 5
   - W only when `setsUs > setsThem`
   - the MVP link goes to `/awards` and is never nested inside the match link
   - the MVP is hidden when the pick is hidden or no MVP can be determined
7. "Showing your first N teams." and "All teams →" appear only when the first page was full.
8. **The teams list and roster use cursor pagination** (`startAfter(lastDoc)`, never offset):
   - teams 20 per page
   - players 25 per page, `orderBy number`
   - "Load more" appears only when the last page was full
9. **Calendar queries only the visible month**:
   - sessions: `date` between the first and last day of the month, `limit 200`
   - matches: the same range, `limit 50`
   - re-queried on month change, after assign, and after delete
10. **Calendar grid**:
    - Monday-first, whole weeks
    - out-of-month cells have no add, remove or match controls
    - today is marked (desktop `aria-label="Today, YYYY-MM-DD"`, mobile day label prefix "Today, ")
11. **Session links** are exactly `/trainings?businessId=<bid>&team=<teamId>&session=<sessionId>`.
    The trainings PDF team-notes flow depends on this.
12. **Calendar sessions** store denormalised `trainingBusinessId` and `trainingName` (labels come
    from these, with no training read), plus `trainingId`, `date` (ISO string), `notes`,
    `createdBy` and `createdAt`.
13. **Team export** reads every collection paged and from the server. Raw events are opt-in. The
    calendar is included only with trainings access. `notes[]` records what was left out.
14. **Team deletion** clears every subcollection, children first (players → physicalTests,
    matches → events, testingSessions → entries, calendar, scoutProfile), then the team doc.
    Afterwards it navigates to `/` (replace).
15. **Player deletion** (roster Remove and retention Delete):
    1. erase the footprint (testing entries, match roster names, scouting usage)
    2. delete physicalTests
    3. delete the player doc last

    Always behind a ConfirmDialog with focus on Cancel.
16. **Retention notice**:
    - cutoff is today − 12 months
    - query `leftClubAt <= cutoff`, `orderBy leftClubAt`, `limit 50`
    - renders nothing when empty or on error
    - each deletion is confirmed individually

**Access and URL**

17. **Tab visibility**:
    - Calendar only with trainings access
    - Stats only for team admins (listed email or club admin, using the lowercased `appUser.email`)
    - Roster, Matches, Development plan, Physical testing and Settings always
    - fixed order: Roster, Calendar, Matches, Stats, Development plan, Physical testing, Settings
18. **Tab URL contract**:
    - `?tab=<id>`, defaulting to roster
    - legacy `overview` → roster and `physicalSession` → physical
    - an inaccessible tab falls back to roster
    - a tab change uses `replace: true`, keeps other params, and strips `comp`, `ha`, `range`,
      `from` and `to`
19. Calendar "Match" on a day opens the Matches tab with the create-match flow prefilled with that
    date (`newMatchDate`).
20. **Team not found / no access** (`permission-denied` or `not-found`) shows `NotFoundState` with
    "All teams" → `/teams` and club-switch buttons, so existence is not leaked. Other errors show a
    retryable "Could not load this team." with "Try again".
21. **Create team and Import teams** are visible only to club admins. **Delete team** is visible
    only to club admins. Team Settings has no admin-management UI.

**Writes and forms**

22. **Create team**:
    - requires a team type (women/men/mixed); Create is disabled until one is chosen
    - the creator's lowercased email is the sole `adminEmails` entry
    - one write even on a double click
23. **Team gender**:
    - teams without one read as `mixed`
    - the one-time gender prompt shows only with Italian enabled, for team admins, on teams without
      a gender
    - Settings save is blocked until a type is chosen
24. **Bulk import**:
    - JSON array of 1–100 rows
    - all-or-nothing validation, with row-numbered errors in the active language
    - Import disabled until a clean validation with at least 1 row
    - stale async validations dropped
    - one batch with backoff
    - imported players get `consent.given = false`, and the 6-second notice tells the coach to
      confirm consent on each card
25. **Add player**:
    - cannot submit without the consent checkbox
    - number, full name, date of birth and every guardian name are required
    - consent is recorded as `{given:true, date, confirmedBy: email}`
    - position defaults to TBD
    - one write on a double click
    - unsaved-change guard on close
26. **Roster default sort is Lineup** (starters, then position rank S, OH, O, MB, L, TBD, U, then
    number, then name). Skill and Birthdate sorts behave as described. Search matches name, position
    code and number.
27. **The Starting toggle** is optimistic, with a revert and error on failure. It is reachable in
    both layouts, and the card layout shows a visible "Starting" label.
28. **The Remove control is never inside the player link.** The player name always links to
    `/teams/:teamId/players/:playerId`.

**Physical testing**

29. **At most one open testing session per team**, enforced in a transaction. The second start shows
    "A testing session is already open for this team."
30. **Physical session roster**: every page of players is loaded, and players who left the club are
    excluded.
31. **Live entries** use one `onSnapshot` listener, unsubscribed on unmount. Past sessions are capped
    at 50, closed only, newest first.
32. **A Done quality cannot be reopened.** Finish is disabled while in flight. A Finish failure warns
    to check the player card before recording again.
33. **Draft entries** are merge-written on blur or change and skipped when unchanged. The panel
    resumes from a draft.
34. **Readiness thresholds** per test (table above) gate Finish.
35. **Growth** is hidden (tile, roster count denominator 7 instead of 8, legacy growth entries
    uncounted) when `growthTestsEnabled` is false.
36. **Close session** requires a confirmation and cannot be reopened. **Delete session** requires a
    confirmation stating how many results will be removed, and removes those results from the
    players' histories.
37. **Stopwatch**: Stop records the exact elapsed time at the tap. Reset needs a second tap; blur
    cancels it.

**Development plan**

38. The plan edits a copy. Cancel discards. A save failure keeps the edits. Save writes the whole
    `developmentPlan`. A HealthHint sits under every coach comment and general notes.

**Free text everywhere**

39. **HealthHint** ("Don't record health, injury or medical information.") sits under every
    free-text notes field in this area:
    - team notes
    - calendar session notes
    - testing notes
    - plan comments and notes

---

## Current UX pain points / redesign opportunities

*Observations only. None of these are requirements. Changing any behaviour above needs an explicit
decision.*

- **Next 7 days → session** links to `/teams/:id` (the Roster tab), not the calendar or the
  training. A coach tapping "Passing circuit" lands on the roster.
- **Home vs spec**: the spec (§3.1) has things the code does not:
  - a "Plan a training" link on the empty Next-up block
  - player count and average level on the Your-teams cards
  - a **Shortcuts** block (New match, Exercises, Trainings)
- **Teams list**:
  - no loading or error state; it flashes "No teams yet." before the data arrives
  - club admins see only teams they are listed on, so "No teams yet." can be wrong for them
- **Roster**:
  - search, sort and the stats row work only on *loaded* pages (25). With more than 25 players, the
    sort and "Avg. skill" are partial until "Load more" is pressed.
  - the roster table only appears at ≥ 1280px; laptops get cards
- **Mobile roster**: Remove sits next to Starting on every card; one-tap access to a destructive
  action (though it is confirmed).
- **No success feedback** for:
  - saving team info
  - adding a single player
  - creating a team
  - assigning or removing a calendar session
  - saving the development plan

  Other actions (player removed, import, session deleted) do show a notice. Inconsistent.
- **No calendar session edit**: changing notes or the date means delete and re-assign.
- **Assign dialog Load more** shows whenever the last page had rows. It does not use `hasMore`, so it
  is offered once more than needed (the last click loads nothing).
- **Development plan Edit** shows for everyone on the page (`isAdmin={true}` hard-coded). It works
  today only because every visitor is a team admin.
- **Session quality panel**:
  - Notes are not part of the draft and are lost if the panel is closed
  - Close has no unsaved guard, although the fields themselves were persisted
- **Start session date** defaults to the UTC date. Near midnight it can be off by one day from the
  local date. Home and the calendar use the local date.
- **Bulk import dialog** has no unsaved guard. A pasted file is lost on Escape or a backdrop tap.
- **Desktop calendar cells** stack "+ Add" and "Match" in every day cell, which makes the grid look
  dense. On mobile, the day list is good but the add buttons are small secondary buttons.
- **Tab navigation** on phones is a native `<select>`. That is functional, but hides the tab set.
- **Physical session**: the roster picker and tiles sit side by side from `sm`, and the panel is a
  modal sheet. There is no "next player" flow. Each quality needs a separate open and Finish.
- **Retention notice** gives no feedback when its query fails (silent by design).
- **Team settings** cannot edit season or age group after creation. Player docs denormalise them, so
  inferred: this is intentional.

## Open questions

1. Should Next-7-days session rows deep-link to `?tab=calendar` (or the training) instead of the
   roster? Is that a parity bug to keep, or a fix to make during the redesign?
2. Are the spec-only home features (Shortcuts block, "Plan a training", player count on team cards)
   in scope for the redesign, or deliberately dropped?
3. Should club admins see *all* club teams on `/teams` and Home? Today they see only teams where
   they are in `adminEmails`.
4. Should the viewer-only branches (Stats hidden for non-admins, an always-shown plan Edit button)
   be kept as-is? Rules make the team page unreachable for non-admins.
5. Should roster sort, search and stats keep working on loaded pages only? Or should the redesign
   load the full roster, as the physical tab already does?
6. Should the "number" roster sort (implemented but hidden) be exposed?
7. Is the UTC default date on Start session intentional?
8. Should Notes in the session quality panel be persisted with the draft?
