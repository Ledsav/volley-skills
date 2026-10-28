# Player card (`/teams/:teamId/players/:playerId`)

Parity inventory for the UI redesign. It describes what the code on branch `feature/ui-redesign` does today (2026-10-28).
Strings are quoted from the English catalog (`src/i18n/en/players.ts`, `components.ts`, `labels.ts`). Where a statement
is inferred rather than read directly from code or tests, it says **(inferred)**.

The player card is one player's whole profile. It shows identity, the 9 skill scores (with radar, meters, scoring-guide
hints and match-data suggestions), the next objective, season match stats, physical testing (latest per quality, history,
trend chart, entry dialogs), the development plan, contact and registration data, guardians, and the GDPR controls
(guardian consent, photo consent, left-club/retention, JSON export, hard delete).

- **Route:** `/teams/:teamId/players/:playerId` (`src/App.tsx`), inside `RequireAuth` → `ClubGate` → `AppShell`. No
  `RequireSection` gate. You usually arrive from the team roster.
- **Page title:** `usePageMeta({ title: 'Player' })` → document title `Player · Volley Skills`, `noindex, nofollow`. The
  title is fixed. It does not include the player's name.
- **Who uses it:**
  - **Team admin.** Email is in `teams/{teamId}.adminEmails`, or the person is a **club admin**
    (`isTeamAdmin()` in `src/teams/teamAccess.ts`, which mirrors the rules' `teamAdmin()`). Has full read and write.
  - **Linked viewer.** Email is in `players/{id}.viewerEmails` and the person is an active club member. Gets a read-only
    card with fewer sections. No UI in the app sets `viewerEmails`. It is only ever `[]` on create and import, so in
    practice only admins use the page today **(inferred from a grep of `viewerEmails`)**.
  - **Any other member.** The player read is denied, so they see the "Player not found" state.
- **Data:** `clubs/{clubId}/teams/{teamId}/players/{playerId}` (+ `physicalTests/{testId}` subcollection). Reads come
  from `getPlayer`, `getTeam` and `listFinishedMatches` (admins only). Physical-test reads come from the
  denormalised `player.latestTests` map or per-type `limit(1)` queries.

---

## Screens and components

### 1. Page shell and section switcher (`src/players/PlayerCardPage.tsx`)

- **Purpose**
  - Loads the player and the team.
  - Works out `isAdmin` and the team's grammatical `gender`.
  - Lays out an always-visible header (identity card and KPI tiles), a section switcher and six section panels.
  - Owns the Privacy panel and the delete confirmation directly.
- **Who can see / do what**
  - `isAdmin = !!team && isTeamAdmin(team, appUser.email, access)`.
    - If `getTeam` fails for any reason (`.catch(() => null)`), `isAdmin` is `false` and `gender` is `'mixed'`.
    - A linked viewer's team read is always denied (team read rule: admins only). So viewers always get
      `gender = 'mixed'` wording.
  - **Sections in order:** `skills, matches, physical, plan, contact, privacy`.
    - Labels: "Skills", "Matches", "Physical", "Plan", "Contact", "Privacy".
    - Admins see all 6.
    - Non-admins see `Skills, Physical, Plan, Contact`. `matches` and `privacy` are in `ADMIN_SECTIONS` and are left out
      of the switcher and not rendered at all.
- **Elements**
  - **Top row (always visible):** `PlayerIdentityCard` (4/12 cols on `lg`) + `PlayerKpiTiles` (8/12 cols). Stacked on
    smaller screens.
  - **`SectionTabs`** with accessible name "Player sections". On phones (<`sm`) it is a native `<select>` (combobox
    labelled "Player sections"). From `sm` up it is underline tabs (`role="tablist"`, each `role="tab"` with
    `aria-selected`).
  - **Six panels**, each `role="tabpanel"` with `aria-label` = section label. **All panels stay mounted.** Inactive ones
    carry the `hidden` attribute (comment: "switching never refetches, and Physical keeps feeding the KPI tiles above").
  - **Panel contents:**
    - Skills panel: "Skills" tile (2/3 width on `lg`) + "Next objective" tile (1/3).
    - Matches panel: "Match stats" tile.
    - Physical panel: "Physical testing" tile.
    - Plan panel: "Development plan" tile.
    - Contact panel: "Contact & registration" tile + "Guardians" tile (2 columns from `md`).
    - Privacy panel: "Data & privacy" tile (`max-w-xl`).
  - **`Tile`** (local component): a `<section>` card with a header row (an `h2` title on the left, an optional action
    on the right) and a padded body.
- **Actions → results**
  - Choosing a tab or select option sets `section` (local state only; **not in the URL**). It defaults to `'skills'` on
    every mount.
  - Each tile's header `EditButton` is admin-only (`editAction` returns `undefined` for non-admins). It sets
    `editingSection`, which is one of `'skills' | 'plan' | 'contact' | 'guardians' | null`. Only one edit dialog can be
    open at a time.
  - Button labels: Skills tile "Edit skills", Plan tile "Edit plan", Contact and Guardians tiles "Edit". The Physical,
    Next objective, Match stats and Privacy tiles have no header edit action.
- **States**
  - **Loading** (`!player`): `PageSkeleton layout="player"`. Skeleton blocks shaped like the identity card, 4 KPI tiles
    and one big block. `role="status"` with the sr-only label "Loading player...".
  - **Not found:** `getPlayer` returned `null`, or an error with code `permission-denied` / `not-found`
    (`isNotFoundError`). Shows `NotFoundState`:
    - Heading "Player not found".
    - Message "It may have been deleted, or you don't have access."
    - Link "Back to team" → `/teams/{teamId}`.
    - If the person has other usable clubs: "This may belong to another of your clubs." plus one "Switch to {club}"
      button per club.
    - Existence is deliberately not leaked: a denied read looks the same as a missing doc.
  - **Error** (any other load failure): `<p role="alert">` "Could not load this player."
  - **Refetch:** the load effect re-runs when `teamId`, `playerId`, `appUser.email` or `access` change.
- **Edge cases**
  - The match-stats effect runs only when `isAdmin` is true. Viewers never query matches (test: `listFinishedMatches`
    is not called).
  - Local `player` state is the single source for every section. Each successful save updates it optimistically from
    the values written (no refetch).
- **Tests that lock this in:** `src/players/PlayerCardPage.test.tsx` (sections for admin vs viewer, not-found on a
  rejected read, read-only viewer, delete, export, export failure, consent, photo consent, left club, suggestions toggle,
  avatar + level), `src/components/SectionTabs.test.tsx`, `src/components/Tab.test.tsx`,
  `src/components/NotFoundState.test.tsx`, `src/components/Skeleton.test.tsx`, `src/i18n/italian.smoke.test.tsx`
  (tablist name in Italian).

### 2. Identity card (`src/players/PlayerIdentityCard.tsx`)

- **Purpose:** an always-visible "who is this" summary.
- **Who:** everyone who can open the card. It has no actions.
- **Elements** (navy card, white text)
  - Round avatar with **initials** (`getInitials`: first letter of the first and last word, uppercased; one word gives
    one letter; empty name gives `''`; extra whitespace is ignored).
  - `h1` full name (wraps with `break-words`).
  - Sub-line: `#{number} · {Position}` plus ` · Starting` when `starting`. The number part is **omitted when the number
    is 0 or falsy**. Position labels come from `labels.position`: Setter, Outside, Opposite, Middle, Libero, Universal,
    TBD. They are gendered in Italian by the team gender.
  - **Average block:**
    - A big number = `avgScore` with **1 decimal**, using the locale decimal separator (`formatNumber(avg, 1)`), or `—`.
    - Caption "Avg skill score".
    - When scored and a `level` exists: a level chip with the gendered label (Beginner / Developing / Advanced / Elite).
      The chip is **neutral** (white/15 on navy), not band-coloured.
    - Otherwise: "No scores yet".
  - **Definition list (2 columns):**
    - Team (`teamName`), Age group (`ageGroup`), Season (`season`): all denormalised on the player doc.
    - Date of birth: the raw ISO `YYYY-MM-DD`, or `—`.
    - Nationality: `—` when empty.
    - License: `—` when empty.
- **States:** no scores → `—` + "No scores yet". The level is shown only when `avgScore !== null` **and** `level` is set.
- **Edge cases:** a viewer sees DOB, nationality and license too. Numbers and dates use `tabular-nums`.
- **Tests:** `PlayerIdentityCard.test.tsx`, `nameFormat.test.ts`, `playersItalian.test.tsx` (gendered position and
  level), `PlayerCardPage.test.tsx` (initials "TP" + "Advanced").

### 3. KPI tiles (`src/players/PlayerKpiTiles.tsx` + `src/players/playerDashboard.ts` + `src/components/StatTile.tsx`)

- **Purpose:** four numbers at a glance. 2 columns on mobile, 4 on `lg`.
- **Who:** everyone. Read-only.
- **Elements** (`StatTile`: uppercase label, big tabular value truncated to one line, optional hint, optional native
  `title`)

  | Label | Value | Hint |
  |---|---|---|
  | "Skills rated" | `{rated} / 9`. `ratedSkillCount` counts skills whose score is not null/undefined; a score of 0 counts. | "Complete" when all 9 are rated, else "In progress" |
  | "Focus areas" | the number of skills with `priority: true` | "None flagged" when 0, else "Priority skills" |
  | "Open objectives" | the number of short-term **and** season objectives whose status is not `Completed` | "Not yet completed" |
  | "Last physical test" | the newest `date` across all latest-per-type tests, shown as `"{day} {short month}"` (e.g. "12 Aug", localised month names) | the year (e.g. "2026"); `title` attribute = full ISO date. No tests: value `—`, hint "No entries yet" |

- **Edge cases**
  - The ISO date is split into day/month and year on purpose: the full ISO date wrapped at its hyphens in a
    quarter-width tile.
  - The "Last physical test" value comes from `PhysicalTestingSection` through `onLatestLoaded`. It only fills in after
    that (hidden but mounted) section has loaded.
- **Tests:** `PlayerKpiTiles.test.tsx`, `playerDashboard.test.ts`.

### 4. Skills tile: read view (`src/players/PlayerSkillsSection.tsx`)

- **Purpose:** the core data surface. Shows the 9 skill scores, the average and level, a radar chart and per-skill
  meters, with scoring-guide hints and match-data suggestions for admins.
- **Who can see / do what**
  - Everyone sees the radar, the average, the rows and the guide tooltips.
  - Match suggestions (ghost segments, the meter tooltip and the Adapt button) need `ratings`. Ratings are passed only
    when `isAdmin`, and only after the admin's match stats have loaded.
  - The "Adapt" button is shown only when `suggested !== null && isAdmin`.
- **Elements**
  - **Left:** `SkillRadarChart` (section 5). Below it, centred: "Average: **{avg 1-dp or —}** ({gendered level or 'No
    scores yet'})".
  - **Right:** a list of 9 rows in the fixed order **Serve, Attack, Block, Set, Defence, Reception, Jump, Speed, IQ**
    (`SKILL_KEYS`). Each row is a 4-column grid:
    1. **Label.**
       - Skill name in `text-orange-strong` when `priority`, otherwise `text-ink`.
       - Followed by an ⓘ `InfoTooltip` (accessible name "{Skill} scoring guide"), only when the scoring-guide entry
         for that key has loaded.
       - Followed by a **Target** icon (`role="img"`, `aria-label="Focus area"`) when `priority`. The icon is inline on
         the label line.
    2. **Score:** a number or `—`, right-aligned, tabular.
    3. **`SkillMeter`** (section 6) with `suggested`. When a suggestion exists, the wrapper has the native `title`
       "Match 7.8 · 20 att. — suggests 8".
    4. **Adapt button** (admin + suggestion only), otherwise an empty cell.
       - Ghost, small, shows an ↑ or ↓ arrow and the suggested number.
       - Green-strong when the suggestion is higher than the current score (`score ?? 0`), orange-strong when lower.
       - `aria-label` "Adapt {Skill} to {n}".
  - **Italian:** wider label column (`9.5rem` vs `6.5rem`) because Italian skill names are longer (e.g. "Lettura del
    gioco").
- **Scoring guide hint content (`SkillGuideHint`)**
  - Bold label, then one line per range ("1–3 Inconsistent, many faults."), then `howToEvaluate` in slate when present.
  - The guide comes from `getSkillGuide()` (`config/skillGuide`). If nothing is saved it falls back to the defaults
    **in the active UI language**. The guide is re-fetched when the catalog changes, and a late answer for the old
    language is ignored.
  - A failed guide load is silent: tooltips just do not render.
- **Actions → results**
  - **Hover or focus ⓘ:** opens the tooltip (`role="tooltip"`, portalled to `<body>`, fixed-positioned, flips above
    when there is no room below, max 256 px wide). Mouse leave or blur closes it. There is no click or tap toggle.
  - **Adapt (admin):**
    - Builds `next = player.skills` with that skill's score set to the suggestion.
    - Computes `avgScore = computeAvgScore(next)` and `level = computeLevel(avg)`.
    - Calls `updatePlayerSkills(teamId, playerId, next, avg, level)`, which writes `{skills, avgScore, level,
      updatedAt: serverTimestamp()}`.
    - Success: updates local player state and shows the toast `"{Skill} set to {n}"` via `useNotify()`.
    - Failure: inline `role="alert"` "Could not save skills. Please try again."
    - It saves immediately; there is no confirmation.
- **States**
  - Unrated skill: `—` and an empty meter.
  - No player scores: average `—` (No scores yet). The radar polygon collapses to the centre with a neutral colour.
  - Viewer: no edit button, no Adapt, no dialog.
- **Edge cases**
  - A suggestion equal to the current score is hidden: no ghost, no title, no Adapt.
  - A rating with fewer than 15 attempts (`rating: null`) draws nothing.
  - Jump, Speed and IQ never get suggestions (no scouted source).
  - Suggestions show only while the header toggle is on.
- **Tests:** `PlayerSkillsSection.test.tsx`, `skillGuideFallbackItalian.test.tsx`, `playersItalian.test.tsx`,
  `PlayerCardPage.test.tsx` ("Adapt Serve to 10").

### 5. Skill radar chart (`src/players/SkillRadarChart.tsx` + `src/players/skillRadar.ts`)

- **Purpose:** the shape of the player's 9 scores.
- **Elements** (SVG, viewBox 320×320, max-width 280/320/360 px by breakpoint)
  - One axis per skill. The first points straight up and the rest go clockwise.
  - 4 grid rings at scores **4, 6, 8, 10** (the band boundaries).
  - Value polygon + 3 px dots.
  - Axis labels anchored away from the centre (top/bottom `middle`, right `start`, left `end`).
  - Colour by **`player.level`**:

    | Level | Fill | Stroke |
    |---|---|---|
    | Beginner | red/15 | red |
    | Developing | orange/15 | orange |
    | Advanced | blue/15 | blue |
    | Elite | green/15 | green |
    | none | ink/10 | slate |

- **Geometry rules:** an unrated (null) score plots at the centre. Scores are clamped to 0..10. The radius is linear in
  `score/10` (max radius 74, labels at radius 98).
- **Accessibility:** `role="img"`, `aria-label` "Skills radar chart: Serve 7, Attack not rated, …".
- **Tests:** `skillRadar.test.ts`, `SkillRadarChart.test.tsx`.

### 6. Skill meter (`src/components/SkillMeter.tsx`)

- **Purpose:** the purpose-built 1–10 meter (design-system §2.4, §7).
- **Elements**
  - **10 equal segments**, filled left to right up to `score`.
  - Filled segments take the **band colour of the score**: `<4` red, `<6` orange, `<8` blue, else green.
  - Unfilled segments are transparent with a neutral `border-border`.
  - Extra gap after segments **3, 5 and 7** (band-boundary marks).
  - `role="meter"`, `aria-valuemin=1`, `aria-valuemax=10`, `aria-valuenow=score` (omitted when null).
- **Suggestion ghosts** (`suggested` prop)
  - Segments a higher suggestion would add are marked `data-ghost="up"`: green/40 fill, green border, pulsing.
  - Segments a lower suggestion would remove keep their fill, get an orange-strong border and pulse
    (`data-ghost="down"`).
  - The pulse only runs with `motion-safe`.
  - No ghost when the suggestion is null or equal to the score.
- **Tests:** `src/components/SkillMeter.test.tsx`.

### 7. Match suggestions toggle (`src/players/SuggestionToggle.tsx` + `src/players/suggestionPref.ts`)

- **Purpose:** show or hide match-data suggestions on the skills tile.
- **Who:** rendered in the Skills tile header (left of "Edit skills") only when `hasSuggestions`. That means `isAdmin`,
  ratings are loaded, and at least one rating is non-null.
- **Elements:** a pill button with a Sparkles icon and the label "Suggestions".
  - `aria-label` "Match suggestions", `aria-pressed` = on.
  - `title` "Hide match suggestions" when on, "Show match suggestions" when off.
  - Blue tint when on, slate when off.
- **Actions → results:** a click flips the state and persists it per device in localStorage key
  **`vcb.skills.suggestions`** (`'1'` or `'0'`). Read and write are wrapped in try/catch. **The default is on**
  (anything except `'0'`).
- **Tests:** `SuggestionToggle.test.tsx`, `PlayerCardPage.test.tsx` (pressed state, hides Adapt, writes `'0'`).

### 8. Edit skills dialog (in `PlayerSkillsSection.tsx`, opened by "Edit skills")

- **Who:** admins only (`editing && isAdmin`).
- **Elements** (`Dialog` titled "Edit skills", `guardUnsaved`, default `md` width)
  - **Live preview line:** "Average: {preview avg 1-dp or —} ({gendered preview level or 'No scores yet'})". It is
    recomputed from the draft on every keystroke.
  - **Per skill, in fixed order:**
    - Label (`<label for="skill-{key}">`) + ⓘ guide tooltip.
    - Number input (`type=number`, `min=1`, `max=10`, `w-20`). An empty input stores `null`.
    - A live `SkillMeter` of the draft score.
    - A checkbox labelled "Focus area" that toggles `priority`.
  - **Suggestion row** (admins with ratings, suggestions on, and suggestion ≠ the draft score): a small meter with ghost
    segments (title = match line) and a **"Use"** button showing ↑/↓ and the number (`aria-label` "Use {n} for
    {Skill}").
  - **Footer:** "Cancel" (ghost) and "Save skills" (primary). Error line below.
- **Actions → results**
  - Opening the dialog resets the draft to `player.skills` and clears the error.
  - **Use:** fills the input with the suggestion. It **does not save**. The suggestion row then disappears because it
    equals the draft.
  - **Save skills:**
    - Computes `avgScore = computeAvgScore(draft)` (mean of the non-null scores, unrounded) and
      `level = computeLevel(avg)`.
    - Calls `updatePlayerSkills(...)`.
    - Success: updates local player state and closes the dialog. There is **no toast**.
    - Failure: shows the alert "Could not save skills. Check that every score is between 1 and 10, then try again."
      The dialog stays open.
  - **Cancel / ✕ / Escape / backdrop:** close. ✕, Escape and backdrop ask "Discard changes?" once any field has changed
    (`guardUnsaved`). The explicit Cancel button closes directly.
- **Validation**
  - There is **no client-side range check**. The `min`/`max` attributes are not enforced because Save is a button, not
    a form submit **(inferred)**.
  - Firestore rules `validScore` reject anything outside `null | 1..10`. A rejected save shows the range message above,
    whatever the actual cause.
  - Decimals (e.g. 6.5) pass the rules and would be saved **(inferred)**.
- **Edge cases**
  - The focus-area checkbox exists only in edit mode.
  - Per-skill `notes` exist in the data but are **not shown or editable anywhere on the card**.
  - There is no saving state on the button, so a double click can send two identical writes.
  - Offline, `updateDoc` resolves only on server ack, so the dialog would stay open until reconnect **(inferred)**.
- **Tests:** `PlayerSkillsSection.test.tsx` (save → avg 7 / Advanced, rejected save shows alert, focus area checkbox,
  Use fills without saving, suggestions off hides Use), `src/components/Dialog.test.tsx`.

### 9. Next objective tile (in `PlayerCardPage.tsx` + `nextObjective` in `playerDashboard.ts`)

- **Purpose:** the one short-term objective to look at next.
- **Logic:** take the **short-term** objectives that are not `Completed` and sort them by `targetDate` ascending, with
  undated ones last. Show the first. Season objectives are ignored.
- **Elements:**
  - Objective text.
  - A `StatusChip`. Statuses and colours: Not started (neutral), In progress (blue), Active (green), Attention (orange),
    Completed (solid ink).
  - "Due {raw ISO date}" or "No target date".
  - The coach comment, when present.
  - Empty state: "No open short-term objectives."
- **Who:** everyone. Read-only. Editing goes through the Plan section.
- **Tests:** `playerDashboard.test.ts`, `src/components/StatusChip.test.tsx`.

### 10. Matches panel: Match stats (`src/players/PlayerMatchStatsSection.tsx` + `src/players/matchRating.ts`)

- **Purpose:** the player's scouted season, and the source of the skill suggestions.
- **Who:** team admins only. Both the panel and the data fetch are admin-gated.
- **Data:**
  - `listFinishedMatches(teamId)`: `status == 'finished'`, newest first, capped at **60**. Then
    `seasonStats(matches, playerId)`:
    - Uses only each match's saved `summary` (never events).
    - A match counts as played only if the player has at least one action with attempts > 0.
    - Grade counts are summed per fundamental across matches.
    - Season efficiencies are **recomputed from the summed totals**, not averaged:
      - attack eff = (# − = − /) / attempts
      - serve eff = (# − =) / attempts
      - reception positive = (# + +) / attempts
      - reception perfect = # / attempts
    - Points and errors are summed.
    - Rows are sorted newest first.
- **Elements**
  - **5 stat boxes** (2 columns mobile, 5 from `sm`):
    - "Matches"
    - "Attack eff." (`fmtEff`: signed whole percent, `+30%`, `-10%`, `0%`, or `—`)
    - "Serve eff."
    - "Reception +" (`fmtPct`: whole percent or `—`)
    - "Pts / Err" (`14 / 6`)
  - **Table** (horizontal scroll), columns Date | Opponent | Att. eff | Serve eff | Rec + | Pts / Err.
    - Date is raw ISO.
    - Opponent is a **link** to `/teams/{teamId}/matches/{matchId}`.
    - Per-row values come from that match's saved summary.
- **States**
  - Loading (season null): "Loading match stats…".
  - Error: `role="alert"` "Could not load match stats.".
  - Empty (`matchesPlayed === 0`): "No scouted matches for this player yet.".
- **Match ratings (`matchRatings`, feeds the skills tile)**
  - Sources: serve ← S, reception ← R, attack ← A, block ← B, set ← E, defence ← D + F (merged). Jump, speed and IQ have
    none.
  - Skipped when there are no attempts.
  - Under **15 attempts**: `{rating: null, attempts}`, shown as "not enough data" in titles.
  - Otherwise `rating = 1 + 9 × Σ(grade count × weight) / attempts`, with weights `# 1, + 0.75, ! 0.5, - 0.25, / 0, = 0`.
  - The suggested score is `clamp(round(rating), 1, 10)`.
  - Match-line strings: "Match {rating 1-dp} · {n} att." or "Match — · {n} att. (not enough data)".
- **Tests:** `PlayerMatchStatsSection.test.tsx`, `matchRating.test.ts`, `PlayerCardPage.test.tsx` (admin sees the
  link, viewer never queries).

### 11. Physical panel: Physical testing (`src/players/PhysicalTestingSection.tsx`)

- **Purpose:** the latest result per physical quality, with entry to the history and add dialogs.
- **Who can see / do what**
  - Everyone sees the rows and "View history".
  - **"Add new"** appears only when `isAdmin` **and** the type is currently visible.
  - The add dialog also needs a `firebaseUser`; without one, clicking does nothing visible.
- **Feature flag:** `useClubFeatures().growthTestsEnabled`.
  - When off, `growth` is not offered: no row unless the player already has a growth record, and never an "Add new".
  - An existing growth record stays visible and reachable through "View history".
  - The rules also refuse growth creates and updates (including relabelling) while the flag is off. Deletes stay
    allowed.
- **Elements:** a divided list of rows in fixed order:
  1. Growth
  2. Countermovement Jump
  3. Approach Jump
  4. Standing Broad Jump
  5. 10m Sprint
  6. 5-10-5 Shuttle
  7. Reaction Time
  8. Strength

  A row is shown when its type is visible or it has a latest record. Each row shows the test name, the subline
  `"{summary} — {ISO date}"` or "No data yet", "View history" (ghost) and "Add new" (secondary).
- **Data loading**
  - On mount (only when the player changes): `loadLatestTests(teamId, playerId, player.latestTests, isAdmin)`.
    - If the player doc already carries the `latestTests` map, it is used with **0 extra reads**.
    - Otherwise it runs 8 `limit(1)` queries (one per type), and an **admin backfills** the map onto the player doc.
      A backfill failure is ignored. Viewers never write.
  - After an add or a delete: `fetchLatestTests` re-reads the player doc's map.
  - Each load calls `onLatestLoaded`, which feeds the "Last physical test" KPI.
- **States**
  - Load failure: `role="alert"` "Could not load physical testing data. Please refresh the page." This **replaces** the
    list, so there are no misleading "No data yet" rows.
  - There is no loading indicator. The list shows "No data yet" rows until data arrives **(inferred from initial empty
    state)**.
- **Tests:** `PhysicalTestingSection.test.tsx` (8 rows, 7 with growth off, history-only growth row when off, viewer has
  no Add, load error, opens dialog), `physicalTestsApi.test.ts`, `tests/rules/physicalTests.rules.test.ts`.

### 12. Add physical test dialog (`src/players/AddPhysicalTestDialog.tsx` + `physicalTestFieldLogic.ts` + `physicalTestMath.ts` + `src/components/AttemptsInput.tsx`)

- **Who:** team admins (opened from "Add new").
- **Shell:**
  - `Dialog` titled "Add {Test name}" with `guardUnsaved` and **`mobileSheet`** (full screen below `sm`).
  - The form's `aria-label` is "Add {Test name} entry".
  - Every type has **Date** (`type=date`, `required`) first and **Notes** (textarea) last. Notes carries a `HealthHint`
    linked by `aria-describedby`: "Don't record health, injury or medical information."
  - Footer: "Cancel", then "Save", which reads "Saving…" and is disabled while saving.
- **Fields per type** (all numeric inputs are `type=number step="any" required` unless noted)

  | Type | Inputs | Stored (computed on write) |
  |---|---|---|
  | Growth | Height (cm), Body mass (kg) | `heightCm`, `bodyMassKg` |
  | CMJ | 3 × "Attempt (cm) 1..3" (fixed) | `attemptsCm`, `bestCm = max` |
  | Standing broad jump | 3 × "Attempt (cm)" (fixed) | `attemptsCm`, `bestCm = max` |
  | Approach jump | Standing reach (cm) + 3 × "Touch attempt (cm)" | `standingReachCm`, `attemptsTouchCm`, `bestTouchCm = max`, `approachJumpCm = bestTouch − reach` |
  | 10m sprint | 2 × "Attempt (s)"; "+ Add attempt" up to 3; "Remove last attempt" when more than 2 | `attemptsSeconds`, `bestSeconds = min` |
  | 5-10-5 shuttle | Right-first (s), Left-first (s) | both raw; no "best" |
  | Reaction | 5 × "Drop attempt (cm)" (fixed) | `attemptsCm`, `averageCm` = mean of the middle 3 after dropping the min and max, `reactionTimeMs = √(2·(avg/100)/9.81)·1000` |
  | Strength | Mode select (Weighted / Bodyweight). **Weighted:** Exercise (Trap-bar deadlift / Squat / Goblet squat), Weight (kg). **Bodyweight:** Exercise (Push-ups / Split squat), Reps (`type=number`, no `step="any"`) | Weighted: `mode, exercise, weightKg, reps6RM: 6, bodyMassRatio = weight / latest growth body mass, or null`. Bodyweight: `mode, exercise, reps` |

- **Strength body-mass ratio:**
  - On open, the dialog reads the latest **growth** test (`getLatestByType(...,'growth')`).
  - Live text: "Body-mass ratio: 1.10" (2 dp, locale decimal) when a weight is typed and a body mass is known.
  - Otherwise: "Body-mass ratio needs a Growth entry with body mass on file."
  - The default mode is Weighted, with Trap-bar deadlift and Push-ups as the default exercises.
- **Actions → results**
  - **Submit:**
    - `isPhysicalTestReady` checks that every required value or attempt is present and not NaN. If not, it shows the
      alert "Please fill in every attempt before saving." (used for every missing field, not just attempts).
    - Otherwise `buildPhysicalTestInput`, then `createPhysicalTest` through `useSave()`:
      - Writes the test doc with `recordedBy: uid` and `createdAt: serverTimestamp()`.
      - In the **same batch**, refreshes `player.latestTests.{type}` when this test's date is ≥ the stored latest date
        (backdated tests keep the old latest).
      - If the player doc cannot be read (offline with no cache), it deletes `latestTests` so the next view rebuilds
        it.
      - A player with no map is left alone (the backfill builds it).
    - On success: `onSaved` closes the dialog and reloads the latest map.
    - On failure: "Could not save the test entry. Please try again."
  - **Double submit:** a second Save while in flight is ignored; the button shows "Saving…" disabled.
  - **Offline:** `useSave` starts the write and reports done straight away. Firestore's persistent cache syncs it later.
  - **Escape / ✕ / backdrop:** close immediately when untouched. Once a field has changed, "Discard changes?" appears
    (`alertdialog`).
- **Validation**
  - The date is guarded by native `required` only. The JS readiness check does not look at it.
  - Native `required` on the inputs means the browser's own validation bubble normally shows before the JS message
    **(inferred)**.
  - There is no range or sign validation (negative or zero values are accepted).
- **Spec deviation:** plan-2 spec §4.4 says CMJ, approach jump, sprint and reaction "show computed best/average live".
  The code shows only the strength ratio live.
- **Tests:** `AddPhysicalTestDialog.test.tsx` (every type's payload, blank attempt blocks, ratio 1.10, double click,
  Escape and discard), `physicalTestFieldLogic.test.ts`, `physicalTestMath.test.ts`, `AttemptsInput.test.tsx`,
  `physicalTestsApi.test.ts`, `HealthHint.test.tsx`.

### 13. Physical test history (`src/players/PhysicalTestHistoryList.tsx`)

- **Purpose:** every entry of one test type, with a trend chart. Admins can delete entries.
- **Who:** everyone with access (from "View history"). "Delete entry" is admin-only.
- **Shell:** a **custom fixed overlay**, not the shared `Dialog`.
  - Black/50 backdrop, panel `max-w-2xl`, `max-h-[80vh]` with scrolling, `h2` "{Test name} history", "Close" button at
    the bottom.
  - No `role="dialog"`, no Escape handling, no focus trap, and a backdrop click does nothing **(inferred from code)**.
- **Elements**
  - A trend chart at the top (section 14). It uses `listSeriesByType`, which returns up to **60** entries oldest first.
  - A list of entries, **10 per page**, newest first (`listHistoryByType`, cursor pagination with `startAfter`).
    - Each row is a toggle button with a chevron (`aria-expanded`) showing "{ISO date} — {summary}".
    - **Expanded:** a definition list of every stored measurement (`formatPhysicalTestDetail`) plus "Notes" when
      present. Admins also get a "Delete entry" button (dangerGhost + trash icon).
  - "Load more" (secondary) while `hasMore`.
  - Empty, once loaded: "No entries yet."
- **Actions → results**
  - A row click expands it; clicking again collapses it. Only one row is open at a time.
  - **Load more** appends the next page.
    - `hasMore` = the page had more than 0 tests and `lastDoc` is not null.
    - The API returns `lastDoc` whenever the page is non-empty, so "Load more" **appears after any non-empty page**,
      even with fewer than 10 results. It disappears after a click that returns nothing **(inferred)**.
  - **Delete entry:** opens a `ConfirmDialog`:
    - Title "Delete this entry?", message "This can't be undone.", confirm "Delete". Focus starts on Cancel.
    - Confirm calls `deletePhysicalTest`. If that entry was the type's latest, the next-newest replaces it in
      `player.latestTests`; if none remains, the type is removed from the map.
    - Then collapses the row, calls `onDeleted` (the section reloads the latest map) and reloads the first page and the
      chart.
    - Failure: "Could not delete this entry. Please try again." inside the confirm dialog.
  - **Close:** `onClose`.
- **States:** there is no loading indicator and no error message for failed history or series loads (the promises are
  `void`ed) **(inferred)**.
- **Tests:** `PhysicalTestHistoryList.test.tsx` (empty, load more with a cursor, expand shows attempts and notes, no
  delete for a viewer, admin delete refetches).

### 14. Physical test trend chart (`src/players/PhysicalTestTrendChart.tsx` + `src/players/physicalTestChart.ts`)

- **Series (`buildTrendSeries`):** entries are sorted by date ascending and one value is plotted per entry:

  | Type | Plotted value | Unit | Better is |
  |---|---|---|---|
  | growth | height | cm | higher |
  | cmj | best | cm | higher |
  | approachJump | approach jump height | cm | higher |
  | broadJump | best | cm | higher |
  | sprint10m | best | s | lower |
  | shuttle5105 | mean of right-first and left-first | s | lower |
  | reaction | reaction time | ms | lower |
  | strength | weight (kg) or reps | kg or reps | higher |

  Strength **charts only the most recent entry's mode** (weighted vs bodyweight) and the unit follows that mode. "reps"
  is translated; cm, kg, s and ms are not.
- **Rendering**
  - 0 points: nothing.
  - 1 point: a box with "{date}: **{value} {unit}**" and "Add another entry to see a trend."
  - 2+ points: an SVG polyline in blue.
    - Y is oriented so that **a better result always plots higher** (lower-is-better metrics are flipped).
    - The latest dot is larger and has a bold "{value} {unit}" label.
    - Max and min callouts are skipped when they coincide with the latest point (or max = min).
    - First and last dates sit at the bottom.
    - "Lower is better" caption for time metrics.
  - `role="img"`, `aria-label` "Trend: {date}: {value} {unit}, …".
- **Edge cases:** values are printed raw. They are not rounded or locale-formatted (e.g. a reaction time such as
  201.9342… ms, or a decimal point in Italian) **(inferred)**.
- **Tests:** `PhysicalTestTrendChart.test.tsx`, `physicalTestChart.test.ts`.

### 15. Physical test formatting (`src/players/physicalTestFormat.ts`)

- **Summary (latest row, history row)**, English examples:
  - Growth `160 cm, 50 kg`
  - CMJ / broad jump `34 cm`
  - Approach jump `45 cm (touch 267 cm)`
  - Sprint `1.79 s`
  - Shuttle `R 5.12s / L 5.48s`
  - Reaction `202 ms` (0 dp)
  - Strength weighted `55 kg (1.10)`, or `(—)` with no ratio
  - Bodyweight `25 reps`
- **Detail rows (expanded history):**
  - Growth: Height, Body mass.
  - CMJ and broad jump: Attempts, Best.
  - Approach jump: Standing reach, Touch attempts, Best touch, Approach jump.
  - Sprint: Attempts, Best.
  - Shuttle: Right first, Left first.
  - Reaction: Attempts, Average (≤ 1 dp, trailing `.0` dropped, e.g. `22.3 cm`, `20 cm`), Reaction time (0 dp ms).
  - Strength weighted: Exercise (translated name), Weight, Reps (6RM) = 6, Body-mass ratio (2 dp or `—`).
  - Strength bodyweight: Exercise, Reps.
- **Locale:**
  - Numbers keep their typed precision (`formatDecimal`) with the locale separator (Italian `1,85 s`).
  - Attempt lists are joined with `", "` in English and **`"; "` in Italian** (a comma decimal cannot also separate
    attempts).
- **Tests:** `physicalTestFormat.test.ts`, `physicalTestFormatItalian.test.tsx`, `skillGuideFallbackItalian.test.tsx`.

### 16. Plan panel: Development plan (`src/components/DevelopmentPlanEditor.tsx`, controlled mode)

- **Purpose:** short-term objectives, season objectives and general notes. The same component serves the team plan tab
  in uncontrolled mode with its own Edit button.
- **Who:** everyone reads. Admins edit through the tile header "Edit plan".
- **Read view**
  - "Short-term objectives" with a count, then one card per objective:
    - Left accent by status: Active green, In progress blue, Completed ink, Not started slate, Attention orange.
    - Title, or "Untitled objective" when empty.
    - `StatusChip`.
    - Calendar icon + "Target date {ISO}" / "No target date".
    - Coach comment below a divider, only when present.
    - Empty list: "No short-term objectives yet."
  - "Season objectives" with a count, same cards but with "Target {text}" / "No target set". Empty list: "No season
    objectives yet."
  - "General notes": pre-wrapped text, or "No notes yet."
- **Edit dialog** ("Edit development plan", `size="lg"`, `guardUnsaved`)
  - Short-term objective blocks: Objective, Target date (`type=date`), Status select, Coach comment (+ HealthHint),
    "Remove".
  - Status options, in order: Not started, In progress, Active, Attention, Completed. Labels are translated; the stored
    value is always the English code.
  - "+ Add short-term objective". New objectives start empty with status "Not started".
  - Season objective blocks: Objective, Target (text), Status, Coach comment (+ HealthHint), "Remove". Then
    "+ Add season objective".
  - General notes textarea (+ HealthHint).
  - "Cancel" / "Save".
- **Actions → results**
  - **Save:** calls `onSave(plan)`, which in the page is `updatePlayerDevelopmentPlan` (writes `{developmentPlan,
    updatedAt}`) and then updates local state.
    - Success closes the dialog. There is no toast.
    - Failure: alert "Could not save the development plan. Please try again." Edits are kept.
  - **Cancel:** resets the draft to the stored plan and closes. Abandoned edits never leak into the next session.
- **Validation:** none. Empty objectives are allowed and show as "Untitled objective".
- **Tests:** `src/components/DevelopmentPlanEditor.test.tsx`, `playersItalian.test.tsx` (status saved as the English
  code), `StatusChip.test.tsx`, `playersApi.test.ts`.

### 17. Contact panel: Contact & registration (`src/players/PlayerContactSection.tsx`)

- **Who:** everyone reads. Admins edit through "Edit".
- **Read view** (label/value list):
  - Number: `#7` or `—`.
  - Position: gendered label, plus a green "Starting" badge when `starting`.
  - Shirt size: `—` when `''`.
  - Phone, License, Nationality: `—` when empty.
- **Edit dialog** ("Edit contact & registration", form `aria-label` "Edit contact information", `guardUnsaved`)
  - Name (`required`).
  - Shirt number (`type=number min=0`; empty or invalid → saved as `0`, which shows as `—`).
  - Position select: Setter, Outside, Opposite, Middle, Libero, Universal, TBD. Gendered labels; stores the English
    code.
  - Shirt size select: "Not set" + XS, S, M, L, XL, XXL, 3XL.
  - "Starting player" checkbox.
  - Phone.
  - "Cancel" / "Save".
- **Actions → results**
  - **Save** (native submit): `updatePlayerContact(teamId, playerId, {fullName, number, positionCategory, shirtSize,
    starting, playerPhone})` plus `updatedAt`.
    - Success: local update and close.
    - Failure: alert "Could not save contact information. Please try again." The dialog stays open.
- **Not editable anywhere on the card:** date of birth, nationality and license number. They are set only by Add player
  or import **(inferred: no other writer in `src/players`)**.
- **Tests:** `PlayerContactSection.test.tsx`, `playersItalian.test.tsx`, `playersApi.test.ts`.

### 18. Contact panel: Guardians (`src/players/GuardiansSection.tsx`)

- **Purpose:** guardian contact data (players are minors).
- **Who:** team admins read and edit. **Linked viewers also see the guardians list** (the Contact section is not
  admin-only).
- **Read view**
  - Per guardian: **name** + relation in slate (Mother / Father / Other), then phone or `—`, then email or `—`
    (`break-all`).
  - Empty: "No guardians on file."
- **Edit dialog** ("Edit guardians", `guardUnsaved`)
  - Per guardian block: Relation select (default Mother for new rows), Guardian name (`required`), Guardian phone,
    Guardian email (`type=email`).
  - "Remove guardian" appears only when there is more than one guardian, so the last remaining guardian cannot be
    removed in the dialog.
  - "+ Add guardian".
  - "Cancel" / "Save".
- **Actions → results**
  - **Save:** `updatePlayerGuardians` writes `{guardians, updatedAt}`.
    - Success: local update and close.
    - Failure: "Could not save guardians. Please try again."
  - **Cancel** (and ✕/Escape after the discard check): resets the draft.
- **Edge cases:** a player with 0 guardians (possible after import) opens the dialog with only "+ Add guardian".
- **Tests:** `GuardiansSection.test.tsx`.

### 19. Privacy panel: Data & privacy (in `PlayerCardPage.tsx` + `playersApi.ts` + `retention.ts` + `age.ts`)

- **Who:** team admins only. The tab and the panel are not rendered for others.
- **Elements, top to bottom**
  1. **Guardian consent**
     - **Recorded** (`consent.given`): "Guardian consent recorded on {YYYY-MM-DD} by {email}." The date and email
       parts appear only when present.
     - **Missing** (players from bulk import): an orange-bordered box.
       - Heading "Guardian consent not recorded".
       - Checkbox with the full consent text: "I confirm a parent or legal guardian has consented to storing this
         player's data, including physical-test measurements and match statistics."
       - "Record consent" (secondary) is **disabled until the box is checked**.
       - Error line below.
  2. **Photo consent**
     - **Adult** (`ageFromDob(dob) >= 18`): the note "Adult: photos follow the club's own agreement with the player".
       No toggle.
     - **Minor, or DOB missing or invalid** (`?? 0`, counts as a minor): checkbox "Guardian consent to use photos in
       award cards", checked when `photoConsent === true`.
       - When given: caption "Recorded by {email}."
       - Error line below.
  3. **Export info:** "Export produces a JSON file with everything stored about this player: their record, physical
     tests, testing-session entries and match stats. Deleting a player erases all of it and removes their name and
     number from past match reports."
  4. **Left the club**
     - If `leftClubAt` is set: "Left the club on {date}. Their data is due for deletion on {date + 12 months}." plus a
       "Still in the club" button (ghost).
     - Otherwise a "Mark as left the club" button (ghost).
     - Error line below.
  5. **Bottom actions** (stacked): "Export data (JSON)" (secondary) and "Delete player" (destructive). Export error
     below.
- **Actions → results**
  - **Record consent:** `recordPlayerConsent` writes `consent = {given: true, date: today (UTC ISO), confirmedBy:
    email}` plus `updatedAt`, then updates local state.
    - Failure: "Could not record consent. Please try again."
    - Does nothing if there is no `appUser.email`.
  - **Photo checkbox:** `setPhotoConsent(given)`.
    - Giving writes `{photoConsent: true, photoConsentAt: serverTimestamp(), photoConsentBy: email}`.
    - Withdrawing writes `{photoConsent: false, photoConsentAt: null, photoConsentBy: null}`.
    - The local state updates **after** the write resolves; the checkbox is controlled by the stored value.
    - Failure: "Could not update photo consent. Please try again."
    - Rules: only a team admin can write it; `photoConsentBy` must be the writer's own email and `photoConsentAt` must
      be the request time.
  - **Mark as left the club:** `setPlayerLeftClub(todayIso())` writes `leftClubAt` (UTC ISO date) and `updatedAt`.
    **Still in the club** writes `leftClubAt: null`. Failure: "Could not update membership. Please try again."
  - **Export data (JSON):**
    - Fetches `listAllPhysicalTests` (newest first, cap 500) and `loadPlayerFootprint` in parallel:
      - testing-session entries: scans every team testing session's `entries` where `playerId ==`;
      - matches: reads every team match and keeps those whose roster has the player.
    - Then `downloadPlayerExport` downloads `player-{slug of fullName}-{YYYY-MM-DD}.json`. The payload is
      `{exportedAt, player (full doc, Timestamps → ISO, undefined dropped), physicalTests, testingSessionEntries:
      [{sessionId, sessionDate, entry}], matches: [{matchId, date, opponent, competition, homeAway, status,
      rosterEntry, libero, stats, statsBySet}]}`.
    - Failure: alert "Could not export this player's data. Please try again." and **no download**.
    - There is no progress indicator.
  - **Delete player:** opens the confirm dialog (section 20).
- **Retention rule (`retention.ts`):** `RETENTION_MONTHS = 12`. The due date is `leftClubAt + 12 months`, with the day
  clamped to the month's last day (2028-02-29 → 2029-02-28). Players with `leftClubAt ≤ today − 12 months` are listed
  as due elsewhere (team page) **(the due list is not on this card)**.
- **Tests:** `PlayerCardPage.test.tsx` (consent disabled → enabled → recorded; photo give and withdraw; adult note;
  left club and back; export payload and failure), `retention.test.ts`, `age.test.ts`, `playerExport.test.ts`,
  `playerFootprint.test.ts`, `playerFootprintApi.test.ts`, `playersApi.test.ts`, `tests/rules/players.rules.test.ts`
  (photo consent rules, left club query), `tests/rules/export.rules.test.ts`.

### 20. Delete player confirmation (`ConfirmDialog` in `PlayerCardPage.tsx`; `deletePlayer` in `playersApi.ts`; `erasePlayerFootprint` in `playerFootprintApi.ts`)

- **Who:** team admins (from the Privacy panel). The rules allow delete for team admins and club admins only.
- **Elements:** an `alertdialog` with z-index above dialogs.
  - Title "Delete {fullName}?".
  - Message "This will permanently delete this player's card (contact info, skills, development plan), their physical
    tests and testing-session entries, and remove their name and number from past match reports. This cannot be
    undone."
  - "Cancel" (ghost, **focused on open**) and "Yes, delete player" (destructive).
  - Escape cancels; focus is trapped in the dialog.
- **Actions → results**
  - **Confirm:** `deletePlayer` runs a GDPR erasure in this order:
    1. Delete the player's testing-session entries (one batch per session).
    2. In every match whose roster has the player, replace their roster entry's name with "Removed player" and the
       number with `0`. Stats stay keyed by the now-orphaned id, so team totals still add up.
    3. Remove `players.{id}` from `scoutProfile/usage`.
    4. Delete the whole `physicalTests` subcollection.
    5. Delete the player doc **last**, so a failed run can be retried from the still-visible player.
  - Success: `navigate('/teams/{teamId}', { replace: true })`.
  - Failure: the error "Could not delete this player. Please try again." shows inside the confirm dialog, which stays
    open.
- **Edge cases:** the confirm button is not disabled while deleting, so a double click starts two deletions
  **(inferred)**. Offline, the reads in the footprint step would block **(inferred)**.
- **Tests:** `PlayerCardPage.test.tsx` (delete + navigate), `playersApi.test.ts` (order: footprint → tests → doc),
  `playerFootprintApi.test.ts`, `playerFootprint.test.ts`, `tests/rules/players.rules.test.ts`.

### 21. Shared primitives used on the card

- **`EditButton`** (`src/components/EditButton.tsx`): a pencil icon + label (default "Edit"), small, blue, sized for a
  tile header. Tests: `EditButton.test.tsx`.
- **`HealthHint`** (`src/components/HealthHint.tsx`): a caption with the exact text "Don't record health, injury or
  medical information.", linked to its field with `aria-describedby`. It is used under physical-test Notes, every coach
  comment and the general notes. Tests: `HealthHint.test.tsx`, `DevelopmentPlanEditor.test.tsx`,
  `AddPhysicalTestDialog.test.tsx`.
- **`InfoTooltip`** (`src/components/InfoTooltip.tsx`): an ⓘ button with an accessible label. It opens on hover or
  focus and is portalled with fixed positioning (never clipped). Tests: via `PlayerSkillsSection.test.tsx`.
- **`StatTile`** (`src/components/StatTile.tsx`): label, big tabular value, hint. Flat (border, no shadow).
- **`LevelPill`** (`src/components/LevelPill.tsx`): **not used on the player card**. The identity card has its own
  neutral chip. It is used in roster tables and team notes with band colours: Beginner red-strong on red/10,
  Developing orange-strong, Advanced blue-strong, Elite green-strong, none `—`.
- **`Dialog`** (`src/components/Dialog.tsx`):
  - Modal with `role="dialog"`, a ✕ close button ("Close"), Escape and backdrop close, a focus trap, and focus return.
  - `guardUnsaved` asks "Discard changes?" before closing once any field has changed.
  - `mobileSheet` makes it full screen on phones.
  - Tests: `Dialog.test.tsx`.
- **`ConfirmDialog`**: an `alertdialog` with Cancel focused first and an inline error slot.
- **`useSave`**: one save at a time, with offline queueing. Used **only** by the Add physical test dialog on this page.

---

## Must-keep invariants

1. **The skill set is fixed:** 9 skills in this order: Serve, Attack, Block, Set, Defence, Reception, Jump, Speed, IQ
   (`SKILL_KEYS`). This order is used for the list, the radar axes (first axis straight up, clockwise) and the editor.
   (CLAUDE.md still says "8 skills"; the code has 9.)
2. **The scale is 1–10.** A score is a number or `null` (unrated). The rules reject any score outside `null | 1..10`.
3. **The average is computed on write:** `avgScore` is the mean of the non-null scores only, unrounded, or `null` when
   none are rated. It is written together with `skills` and `level` in one `updateDoc` (`updatePlayerSkills`). The UI
   never derives the stored level itself.
4. **Level bands:** `avg < 4` Beginner, `< 6` Developing, `< 8` Advanced, else Elite, and `null` → no level (boundaries
   4, 6 and 8 belong to the higher band).
5. **Band colours** are red, orange, blue and green for Beginner, Developing, Advanced and Elite. The meter colours its
   filled segments by the **score's own band**; the radar uses the **player's level** (neutral ink/slate when there is
   none). Text in these hues uses the `-strong` tokens.
6. **Skill meter:** exactly 10 segments, filled up to the score, with visible band-boundary marks after 3, 5 and 7. Null
   means 0 filled, all neutral. `role="meter"` with aria values 1..10.
7. **Displayed averages** use **1 decimal** with the locale decimal separator (`6.8`, Italian `6,8`), or `—` when null.
8. **The level label is gendered by the team's gender** (Italian). A failed team read falls back to `mixed`.
9. **Focus areas:** `priority` is set only in the editor ("Focus area" checkbox). The read view marks it with
   orange-strong label text and a Target icon (accessible name "Focus area"). The "Focus areas" KPI counts the flagged
   skills.
10. **Scoring-guide hints:** one ⓘ per skill, accessible name "{Skill} scoring guide". The content is the label, every
    range "min–max description", then "how to evaluate". A saved guide wins; otherwise the defaults in the active
    language. A guide load failure is silent.
11. **Match ratings:** a minimum of 15 attempts. `rating = 1 + 9 × weighted quality`, with weights
    `#1 +.75 !.5 -.25 /0 =0`. Defence = dig + free ball. Jump, Speed and IQ never get a rating. The suggested score is
    `clamp(round(rating),1,10)`.
12. **Suggestions are admin-only, opt-out and per device.** They show only when the toggle is on (localStorage
    `vcb.skills.suggestions`, default on) and the suggestion differs from the current score. **Adapt** saves at once
    (with recomputed avg/level) and shows a toast "{Skill} set to {n}". **Use** in the editor only fills the field.
13. **Match data is never fetched for non-admins.** The Matches and Privacy sections are not rendered for them.
14. **Season stats** come only from finished matches' saved summaries (max 60). A match counts only when the player has
    at least one action. Efficiencies are recomputed from summed grade counts (never averaged per match). Rows are
    newest first. The opponent links to the match page.
15. **Eff/percent formats:** efficiency is a signed whole percent (`+30%`, `-10%`, `0%`); reception is a whole percent;
    `—` when null; points/errors as `P / E`.
16. **Every section stays mounted** (switching tabs never refetches). The physical section loads on page load and feeds
    the "Last physical test" KPI, even while hidden.
17. **Sections:** admins get Skills, Matches, Physical, Plan, Contact, Privacy, in that order. Non-admins get Skills,
    Physical, Plan, Contact. The default is Skills. The control's accessible name is "Player sections". Phones get an
    equivalent picker with the same sections and order.
18. **A denied or missing player shows "Player not found"** (with a back link to the team and switch-club options),
    never an access-denied message. Other errors show "Could not load this player."
19. **Viewers are read-only:** no Edit buttons, no Adapt, no "Add new", no "Delete entry", no Privacy panel.
20. **KPI definitions:** "Skills rated" = non-null scores out of 9 ("Complete" when 9/9). "Open objectives" = short-term
    + season objectives not Completed. "Last physical test" = the newest date across all types, shown as "D Mon" +
    year, with the full ISO date in the title.
21. **Next objective** = the earliest-dated short-term objective that is not Completed. Undated ones sort last; season
    objectives are ignored. When none: "No open short-term objectives."
22. **Physical test types** and their order: Growth, CMJ, Approach jump, Standing broad jump, 10m sprint, 5-10-5
    shuttle, Reaction, Strength.
23. **Growth gating:** with `growthTestsEnabled` off there is no Growth row and no add, but an existing growth record
    keeps a history-only row. The rules mirror this for creates and updates; deletes stay allowed.
24. **Entry protocols:**
    - CMJ, broad jump and approach jump touch: exactly 3 attempts.
    - Sprint: 2 attempts, up to 3.
    - Reaction: exactly 5.
    - Growth and shuttle: two single fields each.
    - Strength: Weighted (3 exercises, fixed 6RM) or Bodyweight (2 exercises, reps).
    - Every value is required. Save is blocked with "Please fill in every attempt before saving."
25. **Derived physical values are computed on write:**
    - best = max for jumps, min for sprint;
    - approach jump = best touch − standing reach;
    - reaction average = mean of the middle 3 of 5 (min and max dropped), and ms = √(2·avg_m/9.81)·1000;
    - body-mass ratio = weight / latest growth body mass, or `null` without one.
26. **`latestTests` denormalisation:**
    - A create updates `latestTests.{type}` in the same batch, only when the new date is ≥ the stored one.
    - A delete of the latest promotes the next newest, or removes the key.
    - A missing map triggers 8 `limit(1)` queries plus an admin-only backfill.
    - An unreadable player doc on create drops the map.
27. **The Add physical test dialog saves once** under double tap, shows "Saving…" while busy, and queues offline (closes
    straight away).
28. **History:** 10 per page, newest first, cursor "Load more". Each row expands to every stored measurement plus notes.
    Delete needs a confirmation and refreshes the list, the chart and the latest row.
29. **Trend chart:** up to 60 entries oldest first. Better always plots higher. "Lower is better" for sprint, shuttle and
    reaction. Shuttle plots the mean of both directions. Strength charts only the latest mode. One point gives "Add
    another entry to see a trend."; zero points give nothing.
30. **Summary and detail formats** follow §15 exactly. This includes reaction at 0 dp ms, the ratio at 2 dp, the
    reaction average at ≤1 dp without a trailing `.0`, and Italian decimal commas with `"; "` as the attempt separator.
31. **Health hint:** "Don't record health, injury or medical information." under every free-text coaching field on
    this page (physical-test Notes, each coach comment, general notes), linked with `aria-describedby`.
32. **Edit dialogs** (skills, plan, contact, guardians, add test) guard unsaved changes: ✕, Escape and backdrop ask
    "Discard changes?". Cancel discards the draft, so the next open starts from the stored data.
33. **Failed saves** keep the dialog open with an inline `role="alert"` message. Successful skill, plan, contact and
    guardian saves close silently. The only success toast on the page is Adapt.
34. **Position, objective status, relation and exercise values are stored as English codes** whatever the UI language.
35. **The shirt number** is shown as `#n` and omitted or `—` when 0. Clearing it saves `0`.
36. **Guardians:** at least the existing rows' name is required. "Remove guardian" only appears when there is more than
    one guardian. Guardian data is visible to viewers of the card.
37. **Guardian consent:** "Record consent" stays disabled until the exact consent statement is ticked. It writes
    `{given: true, date: today, confirmedBy: admin email}`.
38. **Photo consent:**
    - The toggle exists only for minors. A **missing or invalid DOB counts as a minor**. 18+ sees the club-agreement
      note instead.
    - Giving records the admin's email and the server time; withdrawing clears both.
    - The rules enforce that the recorder is the writer.
    - Award photos depend on this field (`src/awards/photoGate.ts`).
39. **Retention:** marking someone as left stores today's ISO date. The due date shown is exactly 12 months later, with
    the day clamped to the month's end. "Still in the club" clears it.
40. **Export:** a single JSON download `player-{slug}-{YYYY-MM-DD}.json` containing the full player doc, all physical
    tests (cap 500), testing-session entries and match records (roster entry, libero flag, stats, by-set stats).
    Timestamps are converted to ISO. Nothing is downloaded when any read fails, and the error is shown.
41. **Delete is a GDPR erasure:**
    - A confirmation is required, with focus starting on Cancel.
    - Order: session entries → match rosters anonymised to "Removed player" #0 → scout usage line → physical tests →
      player doc **last**.
    - On success, navigate to the team page with `replace`.
    - On failure, the error shows in the dialog.
42. **No unbounded reads:** every query on this page has a limit (60 finished matches, 10-entry history pages, a
    60-point series, 500 tests for export). The one exception is the export footprint (scans of team testing sessions
    and matches via `readAll`), which is deliberate and only on demand.
43. **Initials:** first letter of the first and last word, uppercased (one word gives one letter).
44. **Ages** are whole years with no birthday rounding. A malformed or impossible date gives `null`.
45. **`tabular-nums`** on every number, date and score on the card.

---

## Current UX pain points / redesign opportunities

*Observations only. Not requirements.*

- **The section is not in the URL.** A reload or shared link always lands on Skills. A deep link (e.g. `?section=physical`)
  would help, but must keep "admin-only sections not addressable by viewers".
- **The page title is just "Player".** The tab title and breadcrumbs don't show the player's name.
- **Inconsistent level display.** The identity card's level chip is neutral (white/15). The radar uses band colours. The
  `LevelPill` used elsewhere is band-coloured. A redesign could unify these (keeping invariant 5).
- **The skills editor has no client-side validation.** Any rules rejection shows the range message, even for a network or
  permission error. Decimals can slip through. There is no "Saving…" state or double-submit guard (unlike the
  physical-test dialog).
- **Offline:** skills, plan, contact, guardians, consent, photo, left-club and delete await server acks, so they would
  hang offline with no feedback **(inferred)**. Only Add physical test queues properly. The photo checkbox doesn't
  reflect a click until the write resolves.
- **The history modal is a custom overlay:** no Escape, no focus trap, no `role="dialog"`, and a backdrop click does
  nothing. "Load more" appears even when fewer than 10 entries exist. There are no loading or error states for history
  and series.
- **Trend chart labels are raw numbers.** They are not rounded or localised (long floats for reaction and shuttle,
  decimal points in Italian). The chart has no axes or grid.
- **Live computed values promised by spec 4.4 are missing** (CMJ best, approach jump, sprint best, reaction average/ms).
  Only the strength ratio is shown live.
- **The physical "Load error" says "refresh the page"** and has no retry. There is no loading skeleton, so rows show
  "No data yet" until data arrives.
- **Tooltips are hover/focus only.** Touch users have to tap to focus the ⓘ. The skill-meter suggestion explanation is a
  native `title` (invisible on touch). The KPI full date is also only a `title`.
- **The Adapt button is a tiny ghost control** that saves immediately with no undo. Only the toast confirms it.
- **DOB, nationality and license can't be edited anywhere** after creation. The contact dialog omits them.
- **Per-skill `notes` are stored but never shown or edited** on the card.
- **Silent saves** (no success feedback) for skills, plan, contact and guardians, while Adapt has a toast.
- **Next objective shows a raw ISO date** ("Due 2026-11-01"), while the KPI uses "12 Aug / 2026". Date formats are mixed
  across the card (ISO in identity, match rows, history, plan cards).
- **The Privacy panel is dense:** consent, photo, info paragraph, membership, export and delete are stacked in one
  narrow tile, and destructive Delete sits right below Export. Export has no progress feedback, and its footprint scan
  can be slow on large teams.
- **The delete confirm button isn't disabled while deleting.** Double activation is possible.
- **Tabs have no arrow-key navigation** and no `aria-controls` (tabpanels are labelled by `aria-label` only).
- **Guardian data is visible to linked viewers.** This is probably intended (a guardian viewing their own child), but
  worth confirming for the privacy review.
- **A failed team read (e.g. a network blip) silently downgrades an admin to read-only** with `mixed` wording, with no
  message.

---

## Open questions

1. **Linked viewers:** there is no UI to add `viewerEmails`. Should the redesign still design and test the viewer
   variant of the card (4 sections, read-only)? The code and rules fully support it.
2. **Skill count:** CLAUDE.md says "8 skills" but the code, rules and tests have 9 (IQ added; Block was added later).
   Should the docs be updated?
3. **Should Matches (match stats) stay team-admin-only** in the redesign, or is it an artefact of the "matches are
   team-admin data" rule? It is currently enforced in both the UI and the fetch.
4. **Should the identity-card level chip become band-coloured** like `LevelPill`? That would be a visual change, not a
   functional one.
5. **Is the missing live "best/average" preview** in the physical-test dialogs (spec 4.4) a deliberate simplification
   or a gap the redesign should fill?
6. **UTC dates:** consent date and `leftClubAt` use the UTC calendar date (`toISOString().slice(0,10)`), which can be off
   by one near midnight in CET/CEST. Should this be preserved exactly, or switched to local dates?
7. **Should the history overlay become a standard `Dialog`** (Escape, focus trap, mobile sheet)? That would change
   behaviour (Escape would close it), so it is a parity decision.
8. **Delete entry from history** is admin-only, but there is no way to **edit** a physical-test entry (the rules allow
   update). Is editing out of scope?
9. **Per-skill notes** from the original spreadsheet are kept in the data model but have no UI. Are they meant to stay
   hidden?
