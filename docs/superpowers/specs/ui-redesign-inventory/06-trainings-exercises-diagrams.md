# Training library, training builder, exercise library, court-diagram editor, training PDF, AI drafting

Parity inventory for the UI redesign (branch `feature/ui-redesign`, written 2026-10-28 from the code and its tests).
It describes what the code does **today**. Where something is inferred rather than read directly or locked by a test,
it is marked *(inferred)*. English strings are quoted from `src/i18n/en/*.ts`. Italian text is a full parallel catalog
(`src/i18n/it/*.ts`); the redesign must keep both.

**What the area is for.** A club-wide library of **exercises** (drills), each with up to 12 **court diagrams** drawn in
an in-app editor, and a library of **trainings** (ordered lists of exercises with minutes, numbered `TR-0001`, `TR-0002`,
…). Coaches build trainings by hand, import them as JSON, or draft them with an AI provider. A training can be viewed
"at practice" (step through its exercises full-screen) and shared as a PDF to a coach who is not in the app. When it is
opened from a team calendar session, the PDF can carry a "Team notes" page about the expected players.

**Routes**

| Route | Component | Gate | Notes |
|---|---|---|---|
| `/exercises` | `ExercisesPage` | `RequireSection section="exercises"` | Eagerly loaded, inside `AppShell`. Page title "Exercises". |
| `/exercises/:exerciseId/diagram` | `DiagramEditorPage` | `RequireSection section="exercises"` | **Lazy** (`React.lazy`), `Suspense` fallback "Loading editor…". Page title "Court diagram". On phones it is a full-screen layer (`fixed inset-0 z-40`) over the app's tab bar. On desktop (≥1024 px) it is a normal page inside the shell. |
| `/trainings` | `TrainingsPage` | `RequireSection section="trainings"` | Eagerly loaded. Page title "Trainings". Query params: `?businessId=`, `&team=`, `&session=`. |

`/exercises` and `/trainings` are in the `noindex` SEO list (`src/seo/seoRoutes.ts`).

**Who uses it.** Access is per section and all-or-nothing (`src/auth/access.ts`, `firestore.rules`):

| Person | `/exercises` + editor | `/trainings` | Can read exercises (builder picker, detail sheet, PDF) | Can write exercises/diagrams |
|---|---|---|---|---|
| Club admin | yes | yes | yes | yes |
| Member in `sectionAccess/exercises.adminEmails` | yes | only if also in trainings | yes | yes |
| Member in `sectionAccess/trainings.adminEmails` | no (sees "You don't have access to this page.") | yes | **yes** (rules: `canReadExercises = admin ∨ exercises ∨ trainings`) | no |
| Other member | no | no | no | no |

There is **no read-only role** in these sections: anyone who can open a page can create, edit and delete
everything on it. The nav items "Trainings" and "Exercises" only appear when `access.sections.trainings` /
`.exercises` is true (`src/layout/navModel.ts`). `RequireSection` wraps `RequireAuth`; without access it renders
`AuthShell` with `<p role="alert">You don't have access to this page.</p>`.

**Feature flag.** `useClubFeatures().aiEnabled` (the club doc's `aiEnabled`) shows or hides both "Draft with AI"
buttons and their dialogs. AI provider settings (`src/ai/aiSettings.ts`) do **not** hide anything. A missing or bad
provider surfaces as an error inside the draft dialog, with an "Open Settings" link.

---

## Screens and components

### TrainingsPage (`src/trainings/TrainingsPage.tsx`, route `/trainings`)

- **Purpose.** Lists the club's trainings. You can open one, delete one, create a new one, bulk-import JSON, or draft
  one with AI. It is also the landing target of a team calendar session link.
- **Who can see / do what.** Anyone with the trainings section has full CRUD. "Draft with AI" only shows when `aiEnabled`.
  The Import dialog only renders when `firebaseUser` is set.
- **Elements**
  - `PageHeader` with title "Trainings" and actions: **Import** (secondary), **Draft with AI** (secondary, `Sparkles`
    icon, only when `aiEnabled`), **New training** (primary). On mobile the header stacks into a column and the actions
    become a full-width grid row (`grid-flow-col`, then `sm:flex`). This is locked by a test.
  - Filter row (wraps on phones, fields full-width there and `sm:w-40` from `sm` up):
    - **Age group** text input (`#filter-age`).
    - **Business ID** text input (`#filter-bid`, placeholder `TR-0007`).
  - Inline error `<p role="alert">`.
  - List. On mobile each entry is a separate card (own border and shadow). From `sm` up it is one bordered container
    with hairline dividers. Each row is a `div role="button" tabIndex=0` with:
    - `businessId` (medium, `tabular-nums`) followed by `name`.
    - Summary line `"{age} · {n} exercise(s) · {minutes} min"`. Age falls back to `—`. Minutes are the sum of
      `durationMinutes`.
    - **Delete** button (`dangerGhost`), on its own bottom row on mobile.
  - Empty state "No trainings found." (only after a successful load).
  - **Load more** button when `hasMore`.
- **Actions → results**
  - Typing in Age group: debounced 350 ms, then reloads page 1 with `where('ageGroupTarget','==', trimmed)`. The
    match is exact and case-sensitive.
  - Typing in Business ID: debounced 350 ms. A non-empty trimmed value switches to the single lookup
    `findTrainingByBusinessId` (`where('businessId','==',v), limit(1)`). The list shows 0 or 1 result, pagination is
    off, and the age filter is ignored while the Business ID field is filled.
  - `?businessId=TR-0007` seeds the Business ID field on mount.
  - `?businessId=…&team=…&session=…` comes from the team calendar (`TeamCalendarTab.sessionLink`). After the lookup
    finds the training, the page reads `getCalendarSession(team, session)`, **once per page mount**. If that session's
    `trainingId` equals the found training's id, the page opens `TrainingViewSheet` with
    `teamContext = { teamId, date: session.date, notes: session.notes ?? '' }`. A failed session read is swallowed:
    nothing opens.
  - Click a row, or press Enter/Space while the row itself is focused: opens **TrainingViewSheet** (read-only plan).
    Enter/Space bubbling from the nested Delete button does not open it.
  - **Delete** stops propagation, clears any earlier delete error and opens a `ConfirmDialog`:
    - title "Delete {businessId}?"
    - message "Past calendar entries for this training keep their label but will no longer link to it."
    - confirm "Yes, delete training", plus Cancel.

    Confirm calls `deleteTraining(id)`. Success closes the dialog and reloads page 1. Failure shows the inline error
    "Could not delete the training. Please try again." inside the confirm dialog.
  - **New training** opens `TrainingBuilderDialog` in new mode.
  - Builder close: from Edit-via-View it returns to the View sheet, keeping `teamContext`; otherwise it closes.
    Builder `onSaved` closes and reloads page 1.
  - **Import** opens `BulkImportDialog` (see *Training JSON import*). Success closes it, notifies
    "Imported N training(s)." and reloads.
  - **Draft with AI** opens `TrainingDraftDialog`.
    - On save: the dialog closes, the notice "Saved training {businessId}." appears and the list reloads.
    - On "Open in builder": the dialog closes and `TrainingBuilderDialog` opens in new mode, prefilled with `initial`.
  - **Load more** appends the next page (`startAfter(lastDoc)`).
- **States**
  - Loading: no spinner. The list is empty and the empty state is hidden until `loaded`.
  - Load error: `role="alert"` "Could not load trainings. Please refresh the page." The empty state stays hidden.
  - Load-more error: "Could not load more trainings. Please try again."
  - Offline *(inferred)*: reads come from the Firestore persistent cache. There is no offline banner.
- **Fetching.** `listTrainings`: optional `where('ageGroupTarget','==',…)`, `orderBy('businessId')`, optional
  `startAfter`, `limit(25)`. `hasMore = docs.length === 25`. It is backed by the composite index
  `(ageGroupTarget ASC, businessId ASC)`.
- **Edge cases**
  - The session link only opens if the session still points at that training.
  - The Business ID lookup is exact, so `tr-0007` will not match.
  - After any save, delete or import the page reloads from page 1, which drops pages already loaded.
- **Tests that lock this in:** `src/trainings/TrainingsPage.test.tsx`, `src/trainings/trainingsApi.test.ts`.

### TrainingBuilderDialog (`src/trainings/TrainingBuilderDialog.tsx`)

- **Purpose.** Create or edit a training: header fields, an ordered exercise list with minutes, and an exercise
  picker with suggestions.
- **Who.** Trainings section. It reads exercises; it never writes them.
- **Shell.** `Dialog` with `guardUnsaved`, `size="lg"`, `mobileSheet` (full screen on phones).
  - Title: "New training", or `"{businessId} · {name}"` when editing.
  - Form `aria-label`: "New training" or "Edit training".
  - Footer: a live summary `"{n} exercise(s) · {minutes} min"` (left, `tabular-nums`); **Cancel** (ghost, hidden on
    phones); **Save** (primary, `type=submit`, label "Saving…" while saving, disabled while saving).
- **Elements (top to bottom)**
  1. **Name** (`#training-name`). The placeholder is the training name example ("Reception + free ball: control and
     convert"). The hint below reads: `Name it "Focus + focus: objective", e.g. "…". Age group and players have their
     own fields.`
  2. **Age group target** (free text).
  3. **Suggested players**: a *text* input with `inputMode=numeric`, deliberately not `type=number` so that "7,5"
     shows an error instead of reading as blank. Hint: "Roughly how many players this session is designed for.
     Optional."
  4. **Targets**: a toggle chip group (`role=group`, `aria-label` "Training targets") with the 9 categories in fixed
     order: Warm-up, Physical, Service, Setting, Defense, Reception, Attack, Compound, Game. Each chip is
     `aria-pressed`. A target that a selected exercise's category already covers shows a ✓ icon and the aria-label
     "{Category} (covered)". Selection is always stored in category order, not click order.
  5. **Description** (textarea, 3 rows).
  6. **Exercises** list (`<ul aria-label="Training exercises">`). Empty state: "No exercises added yet." Each row has:
     - One full-width tap target (`aria-label` "View exercise {n}: {name|deleted exercise}") showing:
       - a number badge;
       - a 56 px diagram thumbnail (non-interactive);
       - the name, or a red ⚠ "Deleted exercise" when the exercise no longer exists;
       - a second line `"{Category} · min {start}–{end}"` (cumulative minutes);
       - a players warning (see *PlayersNote*) only when the drill needs more than the suggested players;
       - a chevron.

       Tapping it opens `ExerciseDetailSheet` over all rows, starting at this one.
     - A controls row:
       - minutes `<input type=number min=0>` (`aria-label` "Duration for exercise {n} (min)") followed by "min";
       - Move up (disabled on the first row) and Move down (disabled on the last row), aria "Move exercise {n} up/down";
       - Remove (trash icon, red), aria "Remove exercise {n}".

       The touch targets are 44 px (`h-11 w-11`), 36 px from `sm` up.
  7. **Add exercise** (secondary) opens the inline **picker**. The picker panel has:
     - the heading "Pick an exercise" and a **Done** link that closes it;
     - category chips: **All** plus the 9 categories, single-select, `aria-pressed`, group `aria-label` "Filter
       exercises by category". The chip strip scrolls horizontally on phones and wraps from `sm` up;
     - when targets are set **and** the category filter is All: a "Suggested for your targets" section listing
       exercises whose category is in the targets (`where('category','in',targets)`, ordered by name, 25 per page),
       with empty text "No exercises match these targets yet." and **Load more suggestions** only when the query
       reports more. Then an "All exercises" sub-heading;
     - the main list (`listExercises(after, category|null)`), empty text "No exercises in this category.", and
       **Load more**;
     - each picker item shows:
       - an expand/collapse chevron (`aria-expanded`, aria "Expand {name}" / "Collapse {name}");
       - the name, a category badge and the players note;
       - a one-line clamped description when collapsed;
       - **Add** (aria "Add {name}").

       Expanding shows a 96 px interactive diagram thumbnail (opens the lightbox) and the full description, or "No
       description.". Only one item is expanded at a time; the expand key is per section (suggested vs all).
  8. Inline error `<p role="alert">`.
- **Actions → results**
  - Add: appends a row with `durationMinutes: 10` and `order = length+1`. **The picker stays open** so several
    exercises can be added in one pass. The same exercise can be added more than once.
  - Changing the category chip resets the expanded item and the pagination, then loads page 1.
  - Changing targets while the picker is open reloads suggestions from page 1. A late answer from an older targets
    query is dropped (request counter).
  - Both picker lists use `sortByFit`: when suggested players is set, drills whose `minPlayers` is greater than it are
    moved after the others. The sort is stable and nothing is hidden, so those drills stay addable.
  - Move up/down swaps rows. Remove deletes a row.
  - Submit (Save):
    1. An empty trimmed name gives "Name is required.".
    2. Suggested players is parsed with `parseOptionalInt` within 1–60. An invalid or unparseable value gives
       "Suggested players must be a whole number from 1 to 60."
    3. `exercises` is rebuilt with `order = index+1`.
    4. **Edit** calls `updateTraining(id, {name, description, ageGroupTarget, exercises, suggestedPlayers: n|null,
       targets: [...]|null})`. A null value deletes the optional field. The default offline mode `queue` applies.
    5. **Create** calls `createTraining(...)` with `{ offline: 'block' }`. It runs a transaction that reads and bumps
       `counters/trainings` and writes `businessId = formatBusinessId(n)`. Offline it shows "You're offline. A new
       training gets its number from the server, so creating one needs a connection." and makes no write.
    6. Other errors show "Could not save the training. Please try again."

    Double submit is ignored by `useSave`, so only one create happens.
  - Edit mode on open: fetches the row exercises with `getExercisesByIds` and sorts by `order`. Failure shows "Could not
    load the exercises for this training. Please reopen the dialog."
  - `initial` (from AI "Open in builder") prefills a **new** training: name, description, age group, suggested
    players, targets and rows. It is read once only.
  - Close (X, backdrop, Escape) after any field `onChange` asks "Discard changes?" / "Your changes haven't been saved."
    / **Discard**. The footer Cancel calls `onClose` directly, without the guard *(inferred from `Dialog.tsx`)*.
    Button-only edits (add/move/remove rows, target chips) fire no `onChange`, so they do not arm the guard
    *(inferred)*.
- **Validation and messages.** "Name is required."; "Suggested players must be a whole number from {min} to {max}.";
  the offline text; "Could not save the training. Please try again."; "Could not load more exercises. Please try
  again."; "Could not load exercises to pick from. Please try again."; "Could not load suggested exercises. Please try
  again.".
- **Edge cases**
  - The duration input accepts 0. An empty value becomes 0 (`Number('')`). There is no validation *(inferred)*.
  - The main picker's `hasMore` is `exercises.length > 0 && lastDoc !== null`, not the 25-item rule. So "Load more"
    can show after a short page and then return nothing *(inferred)*.
  - Rows for deleted exercises keep their minutes and save as they are.
  - `exerciseIds` is always recomputed on write.
- **Tests that lock this in:** `src/trainings/TrainingBuilderDialog.test.tsx` (ordering, reorder, deleted row,
  picker pagination, category filter, alerts, double submit, offline, prefill, suggested players/targets
  save/clear/invalid, suggestions section, sink and flag, covered target, stale suggestions, more suggestions, naming
  hint); `src/trainings/suggestions.test.ts`; `src/trainings/trainingsApi.test.ts`; `src/trainings/businessId.test.ts`.

### PlayersNote (`src/trainings/PlayersNote.tsx`)

- Renders nothing when `minPlayers` is undefined or null.
- If `minPlayers > suggested` (both known), it shows an orange chip with ⚠ and "Needs {min} · suggested {suggested}".
- Otherwise it shows a slate "Min {min} players" with a users icon.
- Used in the builder picker and rows, both AI review components, and (with `suggested: null`) the exercise proposals.
- **Tests:** covered through `TrainingBuilderDialog.test.tsx`, `TrainingDraftDialog.test.tsx`, `suggestions.test.ts`.

### TrainingViewSheet (`src/trainings/TrainingViewSheet.tsx`)

- **Purpose.** The read-only "use at practice" view of a training: plan, timings, a full-screen step-through, PDF
  share, and a jump to edit.
- **Shell.** `Dialog size="lg" mobileSheet`, title `"{businessId} · {name}"`. There is no unsaved guard.
- **Elements**
  - A meta row:
    - age group pill (if set);
    - clock icon with `"{n} exercise(s) · {total} min"`;
    - users icon with `"{n} players"`, only if `suggestedPlayers` is defined.
  - A targets list (`aria-label` "Targets", pill per category), only when targets exist.
  - The description (`whitespace-pre-wrap`), if set.
  - Alerts:
    - load failure: "Could not load the exercises for this training. Please try again.";
    - PDF failure: "Could not create the PDF. Please try again.".
  - **Edit team notes** link: only with `teamContext` and after a PDF is built.
  - A screen-reader live region (`data-testid="pdf-status"`, `aria-live=polite`): "Preparing the PDF…", then "PDF
    ready. Tap Share PDF ready to send it."
  - "Loading exercises…" while loading.
  - An ordered plan (`<ol aria-label="Training plan">`, sorted by `order`). Each item is a button (aria "View exercise
    {n}: {name|deleted exercise}") showing:
    - a number badge;
    - a 64 px thumbnail;
    - the name or a red ⚠ "Deleted exercise";
    - `"{Category} · {minutes} min · min {start}–{end}"`;
    - a chevron.

    Empty state: "No exercises in this training."
  - Footer: **PDF button**, **Edit** (pencil), **Start** (primary, play icon). On phones each takes `flex-1`; on
    desktop the PDF button sits on the left (`sm:mr-auto`).
- **Actions → results**
  - Plan item: opens `ExerciseDetailSheet(entries, startIndex=i)`.
  - **Start**: opens `ExerciseDetailSheet` at index 0. It is disabled while entries are loading or when there are none.
  - **Edit**: calls `onEdit()`, so the page swaps to the builder (and returns to this sheet on cancel).
  - **Two-tap PDF flow** (browsers only open the share sheet right after a tap):
    1. With no `teamContext`, **"Share PDF"** sets the state to `building`. The button shows "Preparing PDF…" and is
       disabled. It lazy-imports `./pdf/exportTrainingPdf` and calls `generateTrainingPdf(training)`.
    2. On success the button becomes **"Share PDF ready"** (share icon). Tapping it calls
       `shareOrDownload([file], training.name)`:
       - `'shared'`: nothing else happens;
       - `'cancelled'`: nothing happens and the button stays ready;
       - `'downloaded'`: notice "PDF downloaded".

       Further taps reshare the **same** file without rebuilding.
    3. On failure: the state goes back to null, the inline alert appears and the button is enabled again.
    4. A built PDF is discarded when the `training` prop changes.
  - With `teamContext` (opened from a calendar session), **"Share PDF"** first opens `TeamNotesDialog`. Its
    **Create PDF** builds the PDF with those notes. The typed draft (general note, absent set, per-player notes) is
    kept, so **Edit team notes** reopens the dialog prefilled and rebuilds on confirm.
- **States.** Loading text; load error; PDF building, ready or error; the Start button disabled.
- **Tests that lock this in:** `src/trainings/TrainingViewSheet.test.tsx` (order and timings, detail and Start,
  Escape, Edit hand-off, players/targets only when set, build-then-share without rebuild, live region, error reset,
  download notice and cancelled share, team-notes flow and payload).

### TeamNotesDialog (`src/trainings/TeamNotesDialog.tsx`)

- **Purpose.** The team step of a calendar session's PDF export: which players are expected and what to look at for
  each. Names, positions and levels go into the shared PDF.
- **Shell.** `Dialog size="lg" mobileSheet`. Title "Team notes · {teamName}", or "Team notes" before the team loads.
  Footer: **Cancel** (ghost, hidden on phones) and **Create PDF** (primary, disabled until the roster has loaded).
- **Elements**
  - Intro (gendered catalog function): "These notes go into the shared PDF, with each expected player's name and level."
  - **General notes** textarea (2 rows), prefilled from the calendar session's `notes`, or from the saved draft.
    Below it is the `HealthHint`: "Don't record health, injury or medical information."
  - Inline error "Could not load the team. Please try again."; "Loading the team…".
  - "Expected players ({n} of {total})" and `<ul aria-label="Expected players">`. Each player row is a label with:
    - a checkbox (checked = expected; all are checked by default);
    - the full name;
    - the position label (gendered by team gender; omitted for `TBD`);
    - a `LevelPill`.

    An expected player also gets a one-row textarea (aria "What to look at for {name}", placeholder "What to look
    at"). Unchecking hides the textarea; the typed note stays in state. A `HealthHint` appears under the list.
- **Data.** Reads **every** roster page (`listPlayers` loop; a team is small) and then `getTeam`.
  - Players with `leftClubAt` are excluded.
  - The roster is sorted with `sortRoster(…, 'lineup')`: starters first, then position rank, then number and name.
  - Team gender comes from `teamGender(team)`. With no team doc it is `'mixed'`.
- **Confirm output (`TeamNotes`).**
  `{ teamName, gender, date, general, players: [{ name: fullName, position: localized label or '' for TBD, level, note: trimmed }] }`
  for the expected players only, plus a draft `{ general, absent[], notes{} }` for the caller.
- **Edge cases.** If the roster fails to load, Create PDF stays disabled, so a session PDF cannot be built at all from
  this path *(inferred)*.
- **Tests:** `src/trainings/TeamNotesDialog.test.tsx`, plus `TrainingViewSheet.test.tsx` (integration).

### Training PDF (`src/trainings/pdf/buildTrainingPdf.ts`, `diagramToPdfSvg.ts`, `exportTrainingPdf.ts`)

User-visible output that must stay identical unless a change is stated.

- **Generation (`generateTrainingPdf`).**
  - Exercises are read once each (`getExercisesByIds` on the distinct ids).
  - `listDiagrams` runs only for exercises that exist.
  - `pdfmake` and `vfs_fonts` are dynamically imported (their own chunk).
  - `setUrlAccessPolicy(() => false)`: pdfmake may never fetch a URL.
  - The catalog is `getT()`, so the PDF prints in the active language (English or Italian).
  - Returns a `File` of type `application/pdf`.
- **File name.** `{businessId}-{fileSlug(name)}.pdf`, with `-{YYYY-MM-DD}` added when built with team notes that
  carry a date. Example: `TR-0007-Serve-receive-2026-10-24.pdf`.
- **Document.**
  - A4 portrait; margins `[40, 56, 40, 48]`; default font size 10, ink `#0F172A`; always the light palette.
  - `info.title` is `"{businessId} · {name}"`.
  - Every page has a header in 8 pt slate (`"{businessId} · {name}"`) and a right-aligned footer "Page X of Y" (Italian
    "Pagina X di Y").
- **Cover page**
  - Label: `businessId` (9 pt, bold, blue).
  - Title: name (24 pt, bold).
  - Facts row joined by `"  ·  "`, each only if set: age group, "{n} suggested players", "{total} min",
    "{n} exercise(s)".
  - When targets exist: a bold "Targets  " followed by the category labels.
  - Description (11 pt), if non-blank.
  - "Session plan" (h2). With zero exercises: "No exercises in this training." and **the cover is the only page**
    (with a team notes page if notes were given).
  - Otherwise a table with a repeated header row and `dontBreakRows`:
    - columns `# | Exercise | Category | Min players | Min | Time`, widths `[18,'*',70,52,30,50]`;
    - right-aligned from "Min players" onward;
    - deleted exercises print as italic orange "Deleted exercise";
    - Time is `start–end` (cumulative minutes, same math as the view);
    - a bold Total row with the minute sum.
- **Team notes page** (only when team notes are given; placed right after the cover, page break before)
  - "Team notes" (h1).
  - Facts: `teamName · date · "{n} expected players"`. The count is gendered in Italian, e.g. "2 giocatrici attese".
  - The general note, if non-blank.
  - When there is at least one player, a table `Player | Position | Level | What to look at`, widths `[110,90,60,'*']`:
    - name bold; position slate;
    - level label gendered by team gender, coloured by band (Beginner `#DC2626`, Developing `#C2410C`, Advanced
      `#2865F6`, Elite `#0C7C4F`);
    - a player without a level prints italic "Not rated";
    - then the note.

  **This is the only player data the PDF carries, by club decision.**
- **Exercise pages.** One page per **unique existing** exercise, in order of first appearance, each with a page break
  before. A repeated exercise lists all its slots.
  - Heading: `"#1, #3 · {name}"` (h1). The numbers match the cover table, so deleted exercises get no page and leave a
    gap in the numbers.
  - Facts: category, the slot timings `"{m} min ({start}–{end})"` joined by ", ", and "Min {n} players" if set.
  - A warning when `minPlayers > suggestedPlayers`: "Needs {min} — suggested {suggested} players" (bold orange).
  - Description (11 pt), if non-blank.
  - Diagrams in saved order, each as a vector SVG with its title caption (9 pt, centred, slate); every block is
    unbreakable:
    - 1 diagram: width 340, centred;
    - 2 or more: a two-column grid, width 250, gap 15, 12 pt between rows.
- **fontSafe.** Roboto (the embedded font) has no arrow glyphs. Every printed `text` string in the tree, plus the
  header and `info.title`, gets `↔`→`‹›`, `→ ⇒ ➔`→`›`, `← ⇐`→`‹`. SVG markup is not touched.
- **Diagram SVG for print (`diagramToPdfSvg`).**
  - `DiagramSvg` is rendered statically.
  - Every `rgb(var(--color-x))` / `rgb(var(--color-x) / a)` is resolved to the light-theme `rgb()` / `rgba()`
    (table `LIGHT_TOKENS`, unknown token falls back to ink). The output contains no `var(--`.
  - Markers and patterns are kept.
  - A **half court** is cropped to height 78, or lower if an item extends further down (lowest bbox + 2, capped at
    100).
  - Full and blank courts stay 100×100.
- **Content boundary.** No `createdBy`, uid, email or club name/branding. The test asserts `secret-uid` never appears.
- **Tests that lock this in:** `src/trainings/pdf/buildTrainingPdf.test.ts` (lineup math, pages, deleted, suggested
  and targets on/off, needs-more warning, cover-only, A4/footer/no account data, team notes position/content/Not
  rated/absent, file names, arrows, Italian text and gendered levels, Italian footer),
  `src/trainings/pdf/diagramToPdfSvg.test.ts`, `src/trainings/pdf/exportTrainingPdf.test.ts`.

### Training JSON import (BulkImportDialog usage in `TrainingsPage`; `src/trainings/trainingsImport.ts`, `trainingsImportMessages.ts`)

- **Dialog (shared `src/bulkImport/BulkImportDialog.tsx`).**
  - Title "Import trainings"; hint "Exercises are matched by name against the existing library."
  - A collapsible "Example format" code block.
  - A "Paste JSON" textarea and a "…or choose a file" input (`.json`).
  - **Validate** ("Checking…" while async). Any text or file change resets the results; a superseded async validation
    is dropped.
  - Results: parse errors, or a list of row errors (`role=alert`), or "{n} entries ready to import."
  - Then **Import** ("Importing…"). Commit failure: "Could not import. Nothing was saved. Please try again."
  - Top-level JSON checks: blank, invalid JSON, not an array, empty array, more than `MAX_IMPORT` entries.
- **Validation (async).**
  1. Collect the distinct trimmed exercise names. More than 500 gives "too many distinct exercise names to resolve at
     once (max 500) — split the import into smaller files".
  2. Resolve names with `where('name','in', chunk of 30)` (with backoff).
  3. Per row:
     - `name` is required;
     - `description` and `ageGroupTarget` must be text if present;
     - `suggestedPlayers` must be an integer from 1 to 60;
     - `targets` must be a list of category keys (de-duplicated);
     - `exercises` must be an array of at most 50 items, each `{name, durationMinutes > 0}`;
     - a name not found gives "…was not found in the library"; a name shared by more than one exercise gives "…is
       ambiguous — N exercises share that name; rename or remove duplicates".

     Order is taken from the position in the array. **Any error rejects the whole import** (`inputs: []`).
- **Commit.** `bulkCreateTrainings` uses one transaction that bumps the counter by N, so business ids are sequential.
  It is all-or-nothing, retried with backoff, and capped at `MAX_IMPORT`.
- **Messages.** One English or Italian string per issue code (`t.trainings.import.*`), e.g. `row 3: exercise 2
  "durationMinutes" must be a number greater than 0`.
- **Tests:** `src/trainings/trainingsImport.test.ts`, `src/trainings/trainingsApi.test.ts`.

### ExercisesPage (`src/exercises/ExercisesPage.tsx`, route `/exercises`)

- **Purpose.** Browse the exercise library by category. Open an exercise to edit it, delete it, create one,
  bulk-import JSON, or draft with AI.
- **Who.** Exercises section (full CRUD). "Draft with AI" only shows when `aiEnabled`.
- **Elements**
  - `PageHeader` "Exercises" with **Import**, **Draft with AI** (when `aiEnabled`) and **New exercise**. The mobile
    layout matches the Trainings page (locked by a test).
  - Category chips (`role=group`, aria "Filter by category"): **All** plus the 9 categories, single-select,
    `aria-pressed`, wrapping. **There is no free-text search** in the current UI.
  - List rows (card per entry on mobile, divided container from `sm` up), each a `div role="button"` with:
    - a 64 px **interactive** diagram thumbnail. Its click is stopped from reaching the row and opens the
      `DiagramLightbox` with all the exercise's diagrams. Nothing renders if the exercise has no diagram;
    - the name and a category badge;
    - the description, clamped to 2 lines on phones and 1 line from `sm` up (only if present);
    - **Delete** (`dangerGhost`).
  - Empty state "No exercises yet." (after load). **Load more** when `hasMore`.
- **Actions → results**
  - Chip: reloads page 1 with `where('category','==',c)` (All means no filter), `orderBy('name')`, `limit(25)`, backed
    by the composite index `(category ASC, name ASC)`.
  - Row click, or Enter/Space on the row itself: opens **ExerciseFormDialog** in **edit** mode. There is no read-only
    detail view from this page.
  - Delete:
    1. Calls `countTrainingsUsingExercise` (`getCountFromServer` on `where('exerciseIds','array-contains',id)`) first.
    2. Opens `ConfirmDialog` "Delete {name}?" with one of three messages:
       - count > 0: "This exercise is used in N training(s). Deleting it will leave those trainings with a missing
         exercise entry.";
       - count = 0: "This exercise is not used in any training.";
       - count read failed: "The number of trainings using this exercise could not be determined. Deleting it may
         leave some trainings with a missing exercise entry."
    3. Confirm "Yes, delete exercise" runs `deleteExercise`: one batch deleting up to 12 diagram docs plus the exercise,
       with backoff. Success reloads; failure shows "Could not delete the exercise. Please try again." in the dialog.
  - **New exercise** opens ExerciseFormDialog in create mode. `onSaved` closes and reloads page 1.
  - **Import** opens BulkImportDialog. Success notifies "Imported N exercise(s)." and reloads.
  - **Draft with AI** opens ExerciseDraftDialog. Save closes it, notifies "Added N exercise(s)." and reloads.
- **States.** Load error "Could not load exercises. Please refresh the page." (empty state hidden); load-more error
  "Could not load more exercises. Please try again.".
- **Tests that lock this in:** `src/exercises/ExercisesPage.test.tsx`, `src/exercises/exercisesApi.test.ts`.

### ExerciseFormDialog (`src/exercises/ExerciseFormDialog.tsx`)

- **Purpose.** Create or edit an exercise. It is the doorway to the diagram editor.
- **Shell.** `Dialog guardUnsaved mobileSheet`. Title "New exercise" or "Edit exercise".
  - Footer: **Cancel** (ghost, hidden on phones).
  - **Create & add diagrams** (secondary, **create mode only**).
  - **Save** (primary, label "Saving…" while saving).
- **Fields**
  - **Name**: placeholder "Reception: mixed serves to target". Hint: `Name it "Focus: what it trains", e.g. "…". Focus
    is one of: Warm-up, Physical, Test, Serve, Reception, Free ball, Setting, Attack, Defense, Transition, Combination,
    Game.` (focus words come from the active language). The convention is **advisory only**:
    `followsExerciseNaming` is not used by any production code.
  - **Category** native `<select>`, default `warmup`. Labels are localized but the stored value is always the English
    code (Italian test).
  - **Minimum players**: text with `inputMode=numeric`, optional, 1–30. Hint "Fewest people needed to run it.
    Optional."
  - **Description**: textarea, 4 rows.
  - **Edit mode only**: a "Diagrams" heading with an **Edit diagrams** `EditButton` that navigates to
    `/exercises/{id}/diagram`, and a strip of diagram previews (3-column grid on phones, wrapping 80 px tiles from `sm`
    up, each with its title). Each preview is a button (aria "Open diagram {title}") that opens `DiagramLightbox` at
    that index.
- **Actions → results**
  - Save:
    - Validates name ("Name is required.") and min players ("Minimum players must be a whole number from 1 to 30.").
    - Create: `createExercise` (`addDoc`, default offline `queue`).
    - Edit: `updateExercise`. A blank min players sends `minPlayers: null` (deletes the field) only if the exercise had
      one.
    - Failure shows "Could not save the exercise. Please try again."
    - A double submit creates once.
  - Create & add diagrams: same validation, then `createExercise` with `offline: 'block'`, then navigates to
    `/exercises/{newId}/diagram` (`onSaved` is **not** called).
    - Offline: "You're offline. Creating an exercise and opening its diagram editor needs a connection; use Save
      instead, or try again when online."
    - Other failure: "Could not create the exercise. Please try again."
  - Edit diagrams navigates away immediately. Unsaved form edits are lost without a prompt *(inferred: navigation
    unmounts the dialog; the guard only covers close actions)*.
- **Tests that lock this in:** `src/exercises/ExerciseFormDialog.test.tsx`, `src/exercises/exercisesItalian.test.tsx`,
  `src/exercises/exercisesImportMessages.test.ts` (name hint), `src/trainings/naming.test.ts`,
  `src/trainings/namingItalian.test.tsx`.

### ExerciseDetailSheet (`src/exercises/ExerciseDetailSheet.tsx`)

- **Purpose.** A read-only, full-screen-on-phones view of one exercise, with all its diagrams at full width and the
  description. With several entries it steps through a training's exercises.
- **Used by.** `TrainingViewSheet` (plan and Start), `TrainingBuilderDialog` (row tap), `TrainingDraftDialog` (step
  name; draft scenes).
- **Shell.** `Dialog size="lg" mobileSheet`. The title is the exercise name, or "Deleted exercise".
- **Elements**
  - Meta row:
    - "Exercise {i} of {n}", only when n > 1;
    - category pill;
    - clock pill `"{d} min · min {from}–{to}"`, only when `durationMinutes` is set (training step);
    - users pill "Min {n} players", only when set.
  - A deleted entry shows only the red "This exercise was deleted from the library."
  - Otherwise, a "Diagrams" section:
    - a square placeholder "Loading diagrams…";
    - "Could not load the diagrams." on error;
    - a dashed "No diagrams for this exercise." when there are none;
    - else the current diagram (square, max `min(100%, 70vh)`) with a caption (title) and, when there are 2 or more
      diagrams, **Previous diagram** / **Next diagram** icon buttons (44 px) and an `i / n` counter. Stepping diagrams
      wraps around.
  - A "Description" section (uppercase label); the text is `pre-wrap`, or "No description.".
  - Footer only when n > 1: a 2-column grid with **Previous exercise** (secondary; label is the previous name or
    "Previous") and **Next exercise** (primary; label is the next name or "Next"). Each is disabled at its end.
- **Gestures and keys**
  - **ArrowLeft / ArrowRight** (on `window`) step between **exercises**. Changing exercise resets to the first diagram.
  - A **horizontal swipe** of more than 50 px on the diagram steps between **diagrams** (right swipe = previous). The
    diagram box keeps `touch-pan-y` so vertical scrolling still works.
  - **Escape** closes (via `Dialog`).
- **Data.** Diagrams are fetched per exercise with `listDiagrams` and cached for the sheet's lifetime (no refetch when
  stepping back). An entry with a `scene` field (AI draft) renders that scene as a single diagram titled "AI draft"
  (`sceneAsDiagram`) and fetches nothing. `scene: null` shows "No diagrams for this exercise.".
- **Tests:** `src/exercises/ExerciseDetailSheet.test.tsx`, plus integration in `TrainingViewSheet.test.tsx`,
  `TrainingBuilderDialog.test.tsx`, `TrainingDraftDialog.test.tsx`.

### Exercise JSON import (BulkImportDialog usage in `ExercisesPage`; `src/exercises/exercisesImport.ts`, `exercisesImportMessages.ts`)

- Title "Import exercises", with no hint. The example shows one exercise with an inline diagram and one without.
- **Per row:**
  - `name` is required (trimmed);
  - `category` must be one of the 9 keys;
  - `description` must be text;
  - `minPlayers` must be an integer from 1 to 30;
  - optional `diagrams` array, at most 12 items, each `{title: 1–40 chars trimmed, scene}`. The scene is checked with
    `parseScene` and the **repaired** scene is the one stored (clamped values persist).

  The scene reason is translated (`sceneIssueText`), e.g. `row 1: diagram 2: scene is invalid (a scene may hold at
  most 60 items)`. A row contributes only if it is fully clean. **Any error rejects the whole import.**
- **Commit.** `bulkCreateExercises`:
  1. One batch creates all exercise docs (pre-generated refs, with backoff).
  2. Then, sequentially per exercise, `saveDiagramSet` writes its diagrams.

  If phase 2 fails, the exercises stay committed with no rollback.
- **Tests:** `src/exercises/exercisesImport.test.ts`, `src/exercises/exercisesImportMessages.test.ts`,
  `src/exercises/exercisesApi.test.ts`.

### DiagramEditorPage (`src/diagrams/DiagramEditorPage.tsx`, route `/exercises/:exerciseId/diagram`, lazy)

- **Purpose.** Draw and edit an exercise's set of court diagrams (up to 12). Each diagram has a title, a court preset,
  zone numbers and up to 60 items.
- **Who.** Exercises section only (route gate, and rules `canWriteExercises`).
- **Load.** `listDiagrams(exerciseId)` (`orderBy('order'), limit(12)`). Each scene goes through `parseScene`; a
  malformed doc becomes an empty full court and a missing title becomes "Untitled". The first diagram becomes active.
  - Load error `permission-denied` or `not-found`: `NotFoundState` "Exercise not found" / "It may have been deleted, or
    you don't have access." with the back link "All exercises" to `/exercises`.
  - Any other error: `role=alert` "Could not load diagrams. Please refresh." plus the link "Back to exercises".
- **Layout**
  - **Desktop (≥1024 px)**:
    - Header: **‹ Exercises** (text button); then the court settings inline (Snap checkbox, Court select, Zones
      checkbox); the save error (`role=alert`, red, small); **Undo** and **Redo** (text buttons, disabled when their
      stack is empty); **Save** (primary, "Saving…" while saving, disabled unless dirty and not saving).
    - Then `DiagramTabs`.
    - Then a 3-column grid `160px | canvas | 260px`: a Palette rail on the left and the PropertiesPanel on the right.
  - **Phone**:
    - Header (safe-area aware): a back chevron (aria "Back to exercises"); the status text "Saving…", "Unsaved
      changes" or "All changes saved"; Undo and Redo icon buttons; a **Court settings** toggle (gear, `aria-expanded`,
      only when a diagram is active); **Save** (always labelled "Save").
    - The save error on its own line.
    - When the toggle is on, the court settings in a row under the header.
    - Then the tabs and the canvas.
    - A bottom **tool bar** (`<nav aria-label="Diagram tools">`, safe-area padded) with 6 buttons, each icon + label:
      **Add** (toggle, `aria-pressed`), **Multi** (sticky multi-select toggle, `aria-pressed`), **Edit** (toggle,
      disabled with nothing selected), **Duplicate** (disabled with nothing selected), **Forward** (enabled only with
      exactly 1 selected), **Delete** (red, disabled with nothing selected).
    - Bottom panels are non-modal `<section>`s pinned to the canvas bottom (max 55 % height, scrollable, closable with
      an X labelled "Close {title}"):
      - **Add element**: the Palette as a 3-column grid;
      - **Edit element**, or "{n} elements" when more than one is selected: the PropertiesPanel.

      The court stays visible and editable above them.
  - Canvas overlay (both layouts): a top-right vertical button group: **Zoom in** (×1.25 around the stage centre),
    **Zoom out** (×0.8), **Fit court** (reset pan and zoom).
  - No diagrams: centred "No diagrams yet." and **Add the first diagram**. The court settings are hidden.
- **Court settings**
  - **Snap** (checkbox, default on, not persisted).
  - **Court** select (aria "Court preset"): Full / Half / Blank.
  - **Zones** checkbox: shows zone numbers 1–6 on the backdrop.

  Court and Zones are scene mutations (undoable, mark the diagram dirty). Snap is UI state.
- **Palette (`Palette.tsx`).** Ten buttons in fixed order: Player, Ball, Cone, Ladder, Net, Pole, Line, Arrow, Text,
  Zone #.
  - Each click adds the item at the **court point under the stage centre**, accounting for the current pan and zoom,
    and makes it the sole selection.
  - On a phone the add panel then closes.
  - Defaults (`createItem`):
    - player: blue, top-down view (`above`), empty label, circle shape;
    - ball: orange, `plain`;
    - cone: orange;
    - ladder: 5 rungs, length 20;
    - net: length 30;
    - text: "Text", font size 4;
    - zone label: zone 1;
    - line: from the point to +15 x, solid, thickness 2;
    - arrow: from the point to (+15, −10), straight, pass, single head;
    - all items: size 1, rotation 0, colour ink unless stated.
  - Adding is refused silently at 60 items.
- **Canvas gestures (`CanvasStage.tsx` + page handlers)**
  - **Drag on empty background** pans (`@use-gesture` drag). Ignored while pinching, when the drag starts on an item or
    handle (`startedOnItem`: `[data-item-id],[data-endpoint-handle],[data-transform-handle],[data-handle-hit]`), or
    when Shift is held.
  - **Pointer-down on empty background**, without Shift, clears the selection (this also happens at the start of a
    pan).
  - **Shift + drag on empty background** draws a rubber-band **marquee** (blue tinted, dashed). On release every item
    whose bbox intersects it is **added** to the selection. An empty marquee changes nothing and does not clear the
    current selection.
  - **Pinch** zooms from the current scale, clamped to 0.5–4.
  - **Mouse wheel** zooms (`scale − dy·0.001`, clamped 0.5–4) around the transform origin (0,0), not the cursor
    *(inferred from the code)*.
  - **Pointer-down on an item**:
    - If **additive** (phone Multi toggle on, or Shift / Cmd / Ctrl held), it toggles that item in the selection and
      does **not** drag.
    - Otherwise, an unselected item becomes the sole selection; an already-selected item keeps the whole selection.
      Then **drag moves the whole selection**. Each pointer move dispatches `translateSelected` by the delta; with
      Snap on each delta is rounded to the 2.5 grid, and sub-grid motion accumulates. Lines and arrows move all their
      points.
  - **Endpoint handles** (a single selected line or arrow; a 1.8-radius visible dot with a 4-radius invisible touch
    target): dragging selects the item and sets that endpoint to the absolute pointer position (snapped to 2.5 with
    Snap on). Arrows have from/to; lines have every point.
  - **Transform handle** (a single selected point item, i.e. not a line or arrow; a dot at the bbox top-right corner):
    dragging scales `size` by the distance ratio from the item centre (clamped 0.5–2) and rotates by the angle swept
    around the centre (normalized to (−180, 180]). Snap on rounds rotation to 15°. Moves that change nothing are
    skipped.
  - Selection visuals: a dashed blue outline per selected item. Handles show only for a single selection.
  - **Right-click (contextmenu) on the canvas**: if the target item is outside the current selection, it becomes the
    sole selection (right-clicking inside a multi-selection keeps it). Opens `CanvasContextMenu` at the pointer.
- **Context menu (`CanvasContextMenu.tsx`).** Fixed position, `role=menu`, items `role=menuitem`. It closes on an
  outside pointer-down, Escape, any window scroll, or resize; selecting an item runs it and closes the menu. Items, in
  order:
  1. **Copy** (" (n)" suffix when n > 1): disabled with no selection. Copies the selection to the module clipboard.
  2. **Paste**: disabled when the clipboard is empty. Pastes clones offset by (+2.5, +2.5) and selects them.
  3. **Duplicate** (n): disabled with no selection. Clones the selection at +2.5/+2.5 and selects the clones.
  4. **Delete** (n): disabled with no selection.
  5. **Bring forward**: enabled only with exactly 1 selected. Moves it one step up in z-order.
  6. **Send backward**: enabled only with exactly 1 selected. Moves it one step down.
- **Keyboard shortcuts** (on `window`; **ignored when the event target is an `<input>` or `<textarea>`**, e.g. the
  diagram title):

  | Keys | Effect |
  |---|---|
  | `Delete` or `Backspace` | Delete every selected item (only when something is selected; default prevented). |
  | `Ctrl/Cmd + A` | Select every item on the active diagram. |
  | `Ctrl/Cmd + Z` | Undo. |
  | `Ctrl/Cmd + Shift + Z`, `Ctrl/Cmd + Y` | Redo. |
  | `Ctrl/Cmd + C` | Copy the selection to the diagram clipboard (only when something is selected). |
  | `Ctrl/Cmd + V` | Paste the clipboard as clones offset +2.5/+2.5, selected (only when the clipboard is non-empty). |
  | `Ctrl/Cmd + D` | Duplicate the selection at +2.5/+2.5, selected. |
  | `Escape` | Closes the context menu (the menu's own handler). |

  There are no arrow-key nudges, no Escape-to-deselect, and no zoom keys. A focused `<select>` is not excluded
  *(inferred)*.
- **Clipboard (`diagramClipboard.ts`).** A module-level list that lives outside React, so a copy made in one diagram
  tab can be pasted into another, or into another exercise's editor in the same session *(inferred)*. Paste and
  duplicate only add what fits under the 60-item cap.
- **Undo / redo (`useDiagramEditor.ts`).**
  - Scene snapshots of the **active diagram**, capped at 30 each way.
  - Every scene mutation pushes one frame and clears redo: add, paste, move, translate, endpoint, transform, property
    change, delete, reorder z, court, zones. Each pointer-move step of a drag and each slider change is **its own
    frame** *(inferred: one dispatch per move)*.
  - No-op mutations push nothing: zero-delta translate, an endpoint already at its position, an unchanged court.
  - Undo and redo clear the selection and mark the diagram dirty.
  - **Both stacks are cleared** on: switching diagram tab, adding a diagram, deleting a diagram, loading, and **after
    every successful save (including autosave)**.
  - Diagram-level actions (add, rename, reorder, delete tab) are not undoable.
- **Tabs (`DiagramTabs.tsx`).** A horizontal scroll strip on phones that wraps on desktop.
  - The active tab is an inline **title input** (aria "Diagram title", `maxLength` 40; rename also slices to 40) with
    **Move diagram left**, **Move diagram right** and **Delete diagram** icon buttons (44 px targets).
  - Inactive tabs are buttons that select that diagram. A dirty diagram shows an orange dot.
  - The trailing **+** (aria "Add diagram") is disabled at 12.
  - A new diagram is titled "Diagram {n+1}" (hardcoded English), empty full court, and becomes active.
  - Delete has no confirmation. Persisted ids are queued for deletion and survivors renumber their order (and become
    dirty).
- **Properties panel (`PropertiesPanel.tsx`)**
  - Nothing selected: "Select an element to edit its properties."
  - **More than one selected**: "{n} elements selected", nudge ← → ↑ ↓ (1 unit each, aria "Nudge left/right/up/down"),
    and **Delete**.
  - **One selected**, controls in order, shown when applicable:
    - **Colour**: swatches navy, blue, orange, green, red, ink (`aria-pressed`; aria label is the colour name), for
      items that have a colour (all types).
    - Player: **Role** text (max 3 chars); **View** select (Token (disc), Top-down, Top-down — male, Top-down — female,
      Front view, Bagher / dig, Spike, Set); **Shape** (Circle/Square) only for the Token view.
    - Ball: **Style** (Plain / Mikasa).
    - Text: **Text** (max 60 chars); **Font size: n** slider 2–8.
    - Ladder: **Rungs: n** slider 3–10.
    - Arrow: **Style** (Pass / Shot / Run); **Curved** checkbox; **Arrowhead** (Single / Double).
    - Zone #: **Zone** select 1–6.
    - **Size** slider 0.5–2 (step 0.1). For lines and arrows the label adds "— scales the width".
    - **Rotation** slider −180…180, for every type except ball, pole, line and arrow.
    - Nudge ← → ↑ ↓ (1 unit; moves line points and arrow ends too).
    - **Back** / **Forward** (z-order one step).
    - **Delete element**.
- **Save behaviour**
  - **Autosave 3 s** after the last change while dirty (timer resets on every state change).
  - **Manual Save** button.
  - **Save on unmount** if still dirty (refs mirror the latest `dirty`/`save`). This is the in-app navigation safety
    net.
  - `beforeunload` warns on tab close or reload while dirty.
  - Only one save at a time (in-flight guard). Edits made during a save stay dirty for the next one; new diagrams keep
    their temp id until committed.
  - `saveDiagramSet`:
    1. Validates every create and update title (trimmed length ≥ 1, length ≤ 40) and scene (`parseScene`) **before any
       write**.
    2. Writes the **repaired** scene.
    3. One batch with creates, updates and deletes, stamped with `updatedBy: uid` and `updatedAt: serverTimestamp()`,
       with backoff.
    4. Returns a temp→real `idMap`.

    After success the exercise's cached list thumbnail is invalidated.
  - Errors:
    - title: `Diagram "{title|(untitled)}" needs a title of 1–40 characters.`
    - scene: `Diagram "{title}" is invalid: {reason}`
    - anything else: "Could not save diagrams. Please try again." (also logged with `console.error`).

    The error shows in the header and the editor stays dirty. Autosave does not retry until the next change
    *(inferred)*.
- **Leaving.** The back control ("‹ Exercises" on desktop, chevron on phone) goes straight to `/exercises` when clean.
  When dirty it opens the in-app `ConfirmDialog` "Leave without saving?" / "You have unsaved diagram changes." /
  **Leave** (no `window.confirm`). Leave navigates to `/exercises`, and the unmount safety net then **saves** the dirty
  state anyway *(inferred from code; see Open questions)*. It always returns to `/exercises`, never to the exercise
  dialog the coach came from.
- **Item rendering (`primitives/`, `DiagramSvg.tsx`).**
  - SVG `viewBox 0 0 100 100`, `xMidYMid meet`, theme colours via `rgb(var(--color-*))` (works in dark mode).
  - Court backdrop: x 10–90.
    - Full court: y 6–94, net across the middle, dashed attack lines both sides.
    - Half court: y 6–72, net at the top edge, one attack line.
    - Blank: draws nothing.
    - Zones: numbers 1–6 at 40 % ink.
  - Items render in array order (later = on top). The marker defs `arrowhead-single`, `arrowhead-double` and the
    `netHatch` pattern are required (the PDF also relies on them).
  - Line and arrow stroke widths scale with size; text and other items scale through the group transform.
  - Player views draw multi-part figures with skin/outline tones; the role label sits under the figure with a
    background only when non-empty.
- **Tests that lock this in:** `src/diagrams/DiagramEditorPage.test.tsx` (load, palette add and select, Save
  enable/once, undo/redo, unmount flush, load error, transform-handle resize/rotate, arrow endpoint drag, Ctrl+C/V/D,
  Delete key, right-click Duplicate, shortcuts ignored in title input, in-app leave confirm, court select/half/zones,
  no court select without diagrams, shift-click multi, multi Delete, Ctrl+A, multi copy/paste, title-focus no-ops,
  right-click inside multi plus Delete (n), marquee follow/clear/select/empty; phone: add panel closes, Edit/Delete
  from the toolbar, court settings toggle); `src/diagrams/useDiagramEditor.test.ts`;
  `src/diagrams/useDiagramEditorSave.test.ts`; `src/diagrams/CanvasStage.test.tsx`;
  `src/diagrams/CanvasContextMenu.test.tsx`; `src/diagrams/DiagramTabs.test.tsx`;
  `src/diagrams/PropertiesPanel.test.tsx`; `src/diagrams/DiagramSvg.test.tsx`;
  `src/diagrams/primitives/primitives.test.tsx`; `src/diagrams/transformMath.test.ts`;
  `src/diagrams/sceneFactory.test.ts`; `src/diagrams/diagramClipboard.test.ts`; `src/diagrams/diagramsApi.test.ts`;
  `src/diagrams/diagramsItalian.test.tsx`; `src/diagrams/tokenColor.test.ts`; `src/diagrams/courtGeometry.test.ts`.

### DiagramThumbnail (`src/diagrams/DiagramThumbnail.tsx`)

- Shows the exercise's **first** diagram (`getFirstDiagram`: `orderBy('order'), limit(1)`) and renders nothing when
  there is none or the read fails.
- Results are cached per exercise for the whole session. A second mount does not refetch. The cache entry is dropped
  after a diagram save.
- `interactive` (default true) renders a button (aria "Expand diagram {title}"). Clicking it loads **all** the
  exercise's diagrams into `DiagramLightbox`, falling back to just the preview if listing fails.
- `interactive={false}` renders a plain `aria-hidden` span, used inside other buttons (builder rows, view plan, AI
  review).
- **Tests:** `src/diagrams/DiagramThumbnail.test.tsx`.

### DiagramLightbox (`src/diagrams/DiagramLightbox.tsx`)

- A full-screen black/70 overlay (`role=dialog`, `aria-modal`; `aria-label` is the current title; `z-[60]`).
  - Title and a close X at the top (focused on open).
  - The diagram in a square white box (max `min(90vw, 70vh)`).
  - With 2 or more diagrams: "‹ Prev" / "Next ›" text buttons (aria "Previous diagram" / "Next diagram").
- Arrow keys step with **wrap-around**. Escape closes (`useModalLayer`). A click on the backdrop closes; clicks on the
  title text or the diagram do not.
- **Tests:** `src/diagrams/DiagramLightbox.test.tsx`.

### parseScene and sceneIssueText (`src/diagrams/parseScene.ts`, `sceneIssueText.ts`)

- The single validator and repairer for scenes, shared by JSON import, the editor save, Firestore reads and AI drafts.
- **Rejects** with a code (never text):
  - `notObject`; `unsupportedVersion` (`v !== 1`); `badCourt` (not full, half or blank); `itemsNotArray`;
  - `tooManyItems` (more than 60);
  - `itemMissingField`: e.g. a ladder without numeric rungs and length, a net without length, empty text content, a
    zone label without a zone, a line with fewer than 2 valid points, an arrow without from/to.
- **Repairs:**
  - unknown item types are dropped silently;
  - numbers are clamped: x/y −20…120, rotation ±180, size 0.5–2, rungs 3–10, ladder length 5–40, net length 5–60,
    fontSize 2–8, zone 1–6, thickness 1–4;
  - strings are truncated: id 12, label 3, text 60; line points are capped at the first 12;
  - an unknown colour becomes ink;
  - a missing or unknown player view becomes `token`, so old diagrams look unchanged;
  - shape defaults to circle, ball style to plain;
  - an arrow's `curved` is true only when literally `true`;
  - `showZones` is true only when literally `true`.
- `sceneIssueText` gives the localized reason, e.g. "a scene may hold at most 60 items".
- **Tests:** `src/diagrams/parseScene.test.ts`, `src/exercises/exercisesImportMessages.test.ts`,
  `src/diagrams/diagramsItalian.test.tsx`.

### ExerciseDraftDialog (`src/aiDraft/ExerciseDraftDialog.tsx`)

- **Purpose.** Ask the coach's AI provider for N exercise proposals (with diagrams), review and edit them, and save
  the kept ones to the library.
- **Who.** Opened only from `ExercisesPage` (exercises section) when `aiEnabled`.
- **Shell.** `Dialog size="lg" mobileSheet`, title "Draft exercises with AI". `dirty` is true once proposals exist, so
  X, backdrop or Escape asks "Discard changes?".
- **Step 1, request form**
  - **What do you need?** textarea (max 500; placeholder "Serve-receive drills for 9 players, U15, one court"). The
    privacy note below: "Don't type names or other personal details — this text is sent to your AI provider."
  - **Category** select: Any plus the 9 categories.
  - **How many** number input (1–5, default 3, clamped on change).
  - Footer: Cancel (ghost, hidden on phones) and **Generate** (disabled until the request is non-blank).
- **Generating.** `role=status` "Drafting…". The footer shows only **Cancel**, which aborts the request.
  Unmounting also aborts.
- **What is sent** (`buildExerciseMessages`):
  - The system prompt: role text; the JSON shape `{"exercises":[{name,category,minPlayers,description,diagram}]}`; the
    rules (category list, name ≤ 80 plus the naming hint, minPlayers 1–30, a description structure of Purpose / Setup /
    How it runs / Coaching points / Easier / Harder in the active language, "Never include names of real people.", and
    the diagram format guide with item types player, ball, cone, arrow, text and zone label only); a language
    directive (none for English, e.g. "Write all names and descriptions in Italiano."); and **up to 50 existing library
    names** in the chosen category (at most 2 pages), "do not repeat them".
  - The user prompt: the request, the count, the category or "any", and the names already proposed and kept.
  - Request settings: `temperature 0.7`, `max_tokens 4000` (`AI_MAX_TOKENS.draft`).
- **Validation** (`validateExerciseProposals`):
  - Proposals without a name are dropped; the list is capped at the requested count.
  - Name ≤ 80 and description ≤ 2000 (trimmed).
  - An unknown category becomes null and adds the issue "Pick a category.".
  - `minPlayers` is kept only if it is an integer from 1 to 30.
  - The diagram goes through `toDraftScene`: unknown court becomes full; only allowed types are kept, each checked
    alone with `parseScene` and given a fresh id; issues "N diagram items were dropped." or "The diagram could not be
    used." / "No diagram was proposed.".
  - Nothing usable raises `badResponse`. `runDraft` retries **once silently** on `badResponse`.
- **Step 2, review** (`ExerciseProposalReview`). One card per proposal:
  - a 128 px diagram preview button (aria "Diagram for {name}") that opens `DiagramLightbox` with the draft scene
    titled "AI draft"; a dashed "No diagram" box when there is no scene;
  - an "AI draft" badge;
  - name, category badge, PlayersNote (no suggested value) and "Added to library" (green) once saved;
  - the description (`pre-line`);
  - the repair issues;
  - a **Keep** checkbox (aria "Keep {name}", all kept by default);
  - **Edit** / **Done** (aria "Edit {name}" / "Done editing {name}"), which turns the card into Name (max 80),
    Category select ("Pick a category" plus the categories) and Description (max 2000, 6 rows) fields. Picking a
    category clears the "Pick a category." issue.

  Cards already added by an earlier, partly failed save are **locked**: Keep and Edit are disabled.
- **Footer in review**
  - **Regenerate** (left): keeps the kept proposals and asks only for `count − kept` more, passing the kept names as
    "already proposed". Disabled when kept ≥ count.
  - Cancel (ghost, hidden on phones).
  - **Save {n} kept** ("Saving…"): disabled unless at least one kept, not-yet-added proposal exists and all of them
    have a name and a category.
- **Save** (`saveExerciseDrafts`, `offline: 'block'`):
  - Sequential, stopping at the first failure. Each proposal gets `createExercise` and then, if it has a scene,
    `saveDiagramSet` with one diagram titled "AI draft".
  - A key→id map survives failures, so Retry never duplicates.
  - Errors:
    - "“{name}” needs a category."
    - "Could not add “{name}”."
    - "“{name}” was added without its diagram — add one in the diagram editor."

    Each is followed by "Already added: A, B." when some went in. Offline: "You're offline. Saving drafts needs a
    connection." Anything else: the generic could-not-save text.
  - Success calls `onSaved(total created by this dialog)`.
- **Errors from the model** (`draftErrorText`):
  - "Set up an AI provider in Settings first." (`notConfigured`)
  - "Key rejected — check it in Settings." (`unauthorized`)
  - "Rate limit reached — try again in a moment." / "…in {s} s."
  - "Could not reach the AI provider."
  - "The model's answer could not be used. Try again or rephrase the request."
  - "No provider for this model keeps requests private (zero data retention). Pick another model in Settings."
    (`privacyBlocked`)
  - "The AI provider returned an error."
  - "Something went wrong. Please try again."

  For `notConfigured`, `unauthorized` and `privacyBlocked` an **Open Settings** link to `/settings` follows the text.
- **Tests:** `src/aiDraft/ExerciseDraftDialog.test.tsx`, `src/aiDraft/validateDraft.test.ts`,
  `src/aiDraft/draftRunner.test.ts`, `src/aiDraft/exercisePrompt.test.ts`, `src/aiDraft/diagramPrompt.test.ts`,
  `src/aiDraft/libraryIndex.test.ts`, `src/aiDraft/saveDrafts.test.ts`, `src/aiDraft/aiDraftItalian.test.tsx`.

### TrainingDraftDialog (`src/aiDraft/TrainingDraftDialog.tsx`)

- **Purpose.** Ask the AI for a whole training built from the club library (optionally inventing new exercises),
  review and edit it, then save it, or open it in the builder.
- **Who.** Opened only from `TrainingsPage` (trainings section) when `aiEnabled`. **"Allow new exercises" only shows
  when `access.sections.exercises`.** Without it, new exercises are never requested and any the model returns are
  dropped.
- **Shell.** `Dialog size="lg" mobileSheet`, title "Draft a training with AI". `dirty` is true once a draft exists.
- **Step 1 form**
  - **Goal** (textarea, max 500, placeholder "Serve receive under pressure, 12 players, one court"), with the privacy
    note.
  - **Age group** (text).
  - **Total minutes** (`NumberField`, 30–180, default 90; the coach can clear and retype, a value commits only when it
    is a valid integer in range, and leaving the field restores the last committed value).
  - **Suggested players** (text, numeric keyboard, optional; hint "Optional. The draft only uses drills this many
    players (±3) can run."). An invalid value is silently treated as not set.
  - **Targets** chips (toggle, stored in category order).
  - **Allow new exercises** checkbox (default on, exercises section only).
  - Footer: Cancel and **Generate** (disabled until the goal is non-blank).
- **What is sent** (`loadLibraryIndex` + `buildTrainingMessages`):
  - Library index (bounded, at most 150 entries):
    - with targets: those categories plus warm-up and game;
    - without targets: categories matched from goal words (e.g. "serve" → service, "dig"/"block" → defense) plus
      warm-up and game;
    - with no match: the whole library, paged until 150.
  - Each library line is `id | name | category | min N|- | first 80 chars of the description (one line)`. **No
    `createdBy`/uid, no other fields.**
  - System prompt: role; the JSON shape (steps are `{exerciseId, minutes}`, or `{new:{…}, minutes}` when new exercises
    are allowed); the training naming hint; "use library ids, start with warm-up, end with a game", minutes 1–60, at
    most 20 steps, total close to the target; guidance on targets and players; the new-exercise rules or "Use only
    library exercises."; the language directive; the library, or "(the library is empty)".
  - User prompt: goal, age group, total minutes, targets, and "Players: N (plan for N−3…N+3)".
- **Validation** (`validateTrainingProposal`):
  - Library steps must match an index id exactly; unknown ids are dropped ("N steps used exercises that are not in the
    library and were dropped.").
  - New steps are dropped when new exercises are off ("…dropped because new exercises are off.") or when they have no
    valid category ("…had no valid category and were dropped.").
  - Minutes are rounded and clamped to 1–60 (default 10). At most 20 steps.
  - The name defaults to "AI training" (hardcoded English). **The coach's age group wins** over the model's.
  - The coach's targets and suggested players are carried over.
  - No steps at all raises `badResponse`, with one silent retry.
- **Step 2, review** (`TrainingProposalReview`):
  - "AI draft" badge.
  - Editable **Training name** (max 80), **Age group target** and **Description** (max 2000).
  - `"{total} / {target} min"`, orange when off by more than 10 %.
  - Issue notes.
  - Ordered **Steps** (`<ol aria-label="Steps">`). Each step has:
    - a thumbnail (library) or a draft preview (new);
    - a name button (aria "View {name}") that opens `ExerciseDetailSheet` at that step over all steps (draft scenes
      rendered, nothing fetched for new ones);
    - a **New** (orange) or **Library** badge, a category badge and a PlayersNote against the suggested players;
    - a minutes `NumberField` 1–60 (aria "Minutes for {name}");
    - Move up / Move down / Remove (aria "Move {name} up/down", "Remove {name}"). Removing a new step drops its
      exercise too.
- **Footer in review.** **Regenerate** (replaces the whole draft; edits are lost), Cancel, **Open in builder**
  (secondary), **Save** (primary). Both save actions are disabled unless the name is non-blank, there is at least one
  step, nothing is saving or generating, and a user is signed in.
- **Save** (`saveTrainingDraft`, `offline: 'block'`):
  1. Creates the new exercises first (same rules and dedupe map as above).
  2. Then calls `createTraining` with real ids, in order.

  Training failure with new exercises: "The new exercises were saved, but the training was not. Try Save again."
  Without: "Could not save the training. Please try again." Offline: "You're offline. Saving needs a connection."
  Success calls `onSaved(businessId)`.
- **Open in builder.** Saves only the new exercises (`offline: 'block'`), then calls `onOpenInBuilder(input)` with
  real exercise ids, targets and suggested players. Nothing is written for the training itself until the builder's
  Save.
- **Tests:** `src/aiDraft/TrainingDraftDialog.test.tsx`, `src/aiDraft/trainingPrompt.test.ts`,
  `src/aiDraft/trainingDraftOps.test.ts`, `src/aiDraft/validateDraft.test.ts`, `src/aiDraft/libraryIndex.test.ts`,
  `src/aiDraft/saveDrafts.test.ts`, `src/aiDraft/aiDraftItalian.test.tsx`.

### DraftDiagramPreview and NumberField (`src/aiDraft/DraftDiagramPreview.tsx`, `NumberField.tsx`)

- `DraftDiagramPreview`:
  - a null scene gives a dashed "No diagram" box;
  - without `onOpen` it is a plain preview;
  - with `onOpen` it is a button (aria = label) that opens the lightbox.

  The default size is 128 px.
- `NumberField`: `type=number` with min/max. It keeps the typed text and only calls `onChange` for a whole number in
  range; on blur it restores the last committed value. Tests cover typing digit by digit, clearing and retyping, and
  restore on blur (`TrainingDraftDialog.test.tsx`).

---

## Must-keep invariants

1. **Fetching discipline: trainings list.** `orderBy('businessId')` + `limit(25)` + `startAfter(lastDoc)` cursor
   paging, never offset. The age-group filter is a `where('ageGroupTarget','==',…)` on the same query (index
   `ageGroupTarget, businessId`). `hasMore` means the page was full.
2. **Business ID lookup** is a single `where('businessId','==',v).limit(1)`, exact match, trimmed. When it is set,
   pagination is off and the age filter is ignored.
3. **Free-text filters are debounced** (350 ms). Typing "U", "U1", "U17" quickly produces exactly one query.
4. **Exercises list.** `orderBy('name')` + `limit(25)` + cursor. The category filter is a `where('category','==',c)`
   on the same query (index `category, name`). The builder's "suggested for targets" query is
   `where('category','in',targets)` + `orderBy('name')` + `limit(25)` + cursor, accepting 1–30 categories.
5. **No unbounded reads anywhere in the area.**
   - Diagrams: `limit(12)`. Thumbnails: `limit(1)`, cached per exercise per session.
   - Exercise-by-id reads: one `getDoc` per id.
   - Delete cascade: `limit(12)`.
   - Import name resolution: `in` chunks of 30, at most 500 names.
   - AI library index: at most 150. AI existing names: at most 50 / 2 pages.
   - The team roster for notes reads every page; this is accepted because a roster is one team.
6. **URL contract.** `/trainings?businessId=TR-xxxx` pre-fills the lookup. `&team=&session=` opens the view sheet with
   team context **once**, only when the calendar session's `trainingId` equals the found training. The calendar builds
   this link (`TeamCalendarTab.sessionLink`).
7. **Row interaction.** Clicking a list row or pressing Enter/Space on the focused row opens it: the view sheet for
   trainings, the edit form for exercises. Delete (and the exercise thumbnail) must not trigger the row action,
   neither by click nor by a bubbling Enter.
8. **Delete confirmations.**
   - Trainings: "Delete {businessId}?" with the calendar-label note.
   - Exercises: the usage count is fetched first; the confirm still opens when the count fails, with the "could not be
     determined" text. Deleting an exercise removes its diagrams in the same batch.
9. **Training creation is server-numbered.** A transaction on `counters/trainings` gives `TR-` plus a 4-digit,
   zero-padded number (longer numbers are not truncated). It is blocked offline with the specific message, never
   queued. Bulk import bumps the counter by N in one all-or-nothing transaction. `businessId` is immutable on update
   (rules).
10. **`exerciseIds` is derived on every create and update** from `exercises`, which is re-ordered `1..n` on save.
    Optional `suggestedPlayers` / `targets` are omitted on create when unset and deleted (null) on update when cleared.
    Targets are stored in category order.
11. **Double-submit safety.** A second Save or Create while one is in flight is ignored (`useSave`), for the training
    builder, the exercise form and the AI saves.
12. **Builder suggestions never hide options.** `sortByFit` only moves drills needing more than the suggested players
    to the end (stable). They stay addable and show "Needs N · suggested M". Covered targets get ✓ and the
    "(covered)" aria label. A late suggestions answer for older targets is ignored.
13. **The builder picker stays open after Add.** The same exercise may be added more than once. A new row defaults to
    10 minutes.
14. **Deleted exercises** show as a red ⚠ "Deleted exercise" in the builder, the view and the detail sheet ("This
    exercise was deleted from the library."). In the PDF they appear in the lineup as "Deleted exercise" and get no
    page, and the numbering is kept.
15. **Timing math is identical everywhere.** Start is the sum of earlier durations, end is start + duration. This holds
    in the builder ("min s–e"), the view ("m min · min s–e"), the detail sheet, and the PDF table (`s–e`) and exercise
    facts (`m min (s–e)`).
16. **Two-tap PDF share.**
    - The first tap builds ("Preparing PDF…", disabled, live region "Preparing the PDF…").
    - The second tap ("Share PDF ready") calls `shareOrDownload`.
    - Taps after that reshare the same file without rebuilding.
    - A cancelled share keeps it ready; the download fallback notifies "PDF downloaded"; a build failure gives an
      inline alert and resets.
    - The built file is dropped when the training changes.
    - pdfmake and its fonts are loaded only through the dynamic import at export time, as their own chunk.
17. **The calendar-session PDF asks for team notes first.** It lists current players only (left players excluded),
    all expected by default, sorted by lineup, each with a note when expected. The draft is remembered for "Edit team
    notes". Create PDF stays disabled until the roster has loaded. A health hint sits under the free-text fields.
18. **PDF content rules.**
    - A4 portrait, light colours only.
    - Header `businessId · name` and footer "Page X of Y" on every page.
    - A cover with the facts (only those set), targets, the description, and a "Session plan" table with a Total row.
    - The team notes page right after the cover, only when notes are given.
    - One page per unique existing exercise, in first-appearance order, headed `#a, #b · name`, with facts, the
      needs-more warning, the description, and diagrams (1 large or a 2-column grid, never split, captioned).
    - A cover-only PDF for an empty training.
    - The file name is `{businessId}-{slug}[-{date}].pdf`.
19. **The only player data in the PDF is the team notes page** (name, position, level, note of expected players).
    There is no `createdBy`, uid, email, club name or logo anywhere in the PDF.
20. **fontSafe.** Every printed PDF string (content, header, title) replaces `↔ → ⇒ ➔ ← ⇐` with `‹› › › › ‹ ‹`. SVG
    markup is never altered. pdfmake must never fetch a URL (`setUrlAccessPolicy(() => false)`).
21. **PDF diagrams are vector SVG with theme variables inlined to the light palette** (no `var(--` left). A half court
    is cropped to 78 high unless an item lies lower. Full and blank courts stay square.
22. **The PDF prints in the active language**, with Italian level labels gendered by team gender ("Avanzata",
    "Avanzato", "Avanzato/a"). The raw stored value ("Advanced") is never printed in Italian. "Not rated" / "Senza
    livello" is used for a player without a level.
23. **Diagram editor keyboard shortcuts** (see the table): Delete/Backspace, Ctrl/Cmd+A, +Z, +Shift+Z, +Y, +C, +V, +D.
    All of them are ignored while typing in an input or textarea (title, role, text).
24. **Paste and duplicate offset is +2.5/+2.5**, and the pasted or duplicated items become the selection. Clones have
    fresh ids and deep-copied points. The clipboard is module-level, so it works across diagram tabs. Paste only adds
    what fits under 60 items.
25. **Selection model.**
    - A plain click selects one item; clicking an already-selected item keeps the group so it can be dragged.
    - Shift/Cmd/Ctrl-click, or the phone Multi toggle, adds or removes an item without dragging.
    - Shift-drag on the background draws a marquee that **adds** intersecting items; an empty marquee keeps the
      selection.
    - A background click clears the selection.
    - Right-click outside the selection selects that item; right-click inside a multi-selection keeps it.
    - Transform and endpoint handles appear only for a single selection.
26. **Drag geometry.** The whole selection moves together. With Snap on, translation snaps to 2.5 units, endpoints
    snap to the 2.5 grid, and rotation snaps to 15°. Size is clamped to 0.5–2. Dragging an item or handle never pans
    the stage. Pinch, wheel and the zoom buttons clamp scale to 0.5–4. Zoom buttons zoom around the stage centre.
    "Fit court" resets the view.
27. **Palette adds at the visible centre of the stage** with the documented defaults, and the new item becomes the
    selection. On a phone the add panel closes after adding.
28. **Undo/redo.** 30-step cap. No-op actions push no frame. Undo and redo clear the selection. Stacks reset on tab
    switch, adding or deleting a diagram, and after each save. The Undo and Redo buttons are disabled when their stack
    is empty.
29. **Diagram save pipeline.**
    - Autosave 3 s after the last change, a manual Save, save on unmount when dirty, and a `beforeunload` warning when
      dirty.
    - Only one save at a time. Edits made during a save stay dirty.
    - Validation (title 1–40 trimmed, `parseScene`) runs before any write, and the repaired scene is what is written.
    - One batch, stamped with `updatedBy`/`updatedAt`.
    - Temp ids are swapped for real ids; the thumbnail cache is invalidated.
    - Errors are localized ("needs a title of 1–40 characters", "is invalid: {reason}", or the generic text).
30. **Limits enforced in the UI and the API:** 12 diagrams per exercise (the + button is disabled), 60 items per
    scene, title 40, role label 3, text 60, 12 line points. Scenes read from Firestore are repaired, never crash.
    Unknown item types are dropped. Player view defaults to `token` for old data.
31. **Leaving a dirty editor** shows the in-app "Leave without saving?" confirm (never `window.confirm`). A clean
    editor leaves immediately to `/exercises`.
32. **Phone editor.** The court stays visible above non-modal bottom panels. The bottom toolbar has Add, Multi, Edit,
    Duplicate, Forward, Delete with the enablement rules above. Deselecting closes the Edit panel; Delete closes it
    too. Court settings sit behind a toggle on phones and are inline on desktop.
33. **ExerciseDetailSheet navigation.** Arrow keys move between exercises. A horizontal swipe of more than 50 px on the
    diagram moves between diagrams (with wrap). The Prev/Next footer shows only for 2 or more entries and is disabled
    at the ends. Diagrams are cached per sheet. Draft scenes render without fetching.
34. **AI gating.** The "Draft with AI" buttons and dialogs exist only when the club's `aiEnabled` is true. Missing or
    invalid provider settings show the error with an "Open Settings" link (`notConfigured`, `unauthorized`,
    `privacyBlocked`). The privacy note under the request or goal fields stays.
35. **What the AI receives.**
    - Exercises: the coach's request plus up to 50 existing names (same category).
    - Trainings: the goal, age group, minutes, targets, players, and library lines `id | name | category | min | 80-char
      description`.
    - Never uids, `createdBy`, emails, players or team data.
    - The prompt is English with a language directive for other locales. Requests use temperature 0.7 and max tokens
      4000. There is one silent retry on an unusable answer.
36. **AI output passes the same validators as import** (`parseScene` per item, an allowed item-type subset, the
    category set, minPlayers 1–30, minutes 1–60, at most 20 steps, at most 5 proposals). Saves go through the normal
    `createExercise` / `saveDiagramSet` / `createTraining`, blocked offline. Retrying never duplicates exercises. Cards
    already added are locked. "Allow new exercises" requires the exercises section.
37. **Training draft carries the coach's choices.** The coach's age group overrides the model's. Targets and suggested
    players go onto the saved training or the builder prefill. "Open in builder" saves new exercises first so the
    builder only receives real ids.
38. **Bulk imports are all-or-nothing at validation.** Any row error means nothing is imported, and every error is
    listed with its row number and localized text. Exercise import stores repaired scenes. Training import resolves
    exercise names exactly and rejects unknown or ambiguous names.
39. **Section gating.** `/exercises` and the diagram editor need the exercises section; `/trainings` needs the
    trainings section. A trainings-only coach can still read exercises in the builder, view and PDF, but has no route
    into the exercise library or editor.
40. **Localized category labels, stored English codes.** Categories, palette, properties, PDF and AI texts follow the
    active language (English or Italian). Stored values (category keys, typed role labels) are unchanged.
41. **Naming hints.** The exercise and training name fields show the club convention hint and example placeholders,
    and the AI prompts include the same convention. The convention is advisory and is not enforced on save.

## Current UX pain points / redesign opportunities

*Observations only. None of these are requirements; each change would need an explicit decision.*

- **Undo history is wiped by autosave.** `saved` clears both stacks, so 3 s after the last edit Undo is gone. Combined
  with one undo frame per drag-move step and per slider tick, undo is both too fine-grained and too short-lived.
- **"Leave without saving?" is misleading.** After Leave, the unmount safety net saves the dirty state anyway
  *(inferred)*. Either the copy or the behaviour is wrong.
- **The editor always returns to `/exercises`**, not to the exercise the coach came from. The diagram strip in the
  form does not refresh until reopened *(inferred)*.
- **Unsaved-changes guards are partial.**
  - The footer Cancel bypasses the discard guard.
  - Button-only edits (rows, chips) in the builder do not arm it.
  - "Edit diagrams" in the exercise form navigates away without asking.
- **Exercise rows open straight into edit**: there is no read-only detail view from the library. Trainings, by
  contrast, open read-only first.
- **No text search** in either library. The age-group and Business ID filters are exact and case-sensitive.
- **The builder picker's "Load more"** can appear after a short page and then load nothing.
- **Duration accepts 0** and an empty value becomes 0 without feedback. Reordering exercises is up/down buttons only;
  there is no drag-to-reorder.
- **Diagram tab delete has no confirmation and no undo.** Desktop and phone save labels differ ("Saving…" vs a status
  line).
- **Wheel zoom scales around the stage origin**, not the cursor. There are no keyboard nudges in the editor. On phones
  the long-press context menu depends on the browser *(inferred)*.
- **Many hardcoded English strings reach users or data:** "Diagram N" (new tab titles), "AI draft" (diagram title in
  the viewer and the saved diagram title), "AI training" (fallback name), "Untitled" (missing title), "Text" (new text
  item).
- **The session PDF cannot be built without a roster.** If the team fails to load, Create PDF stays disabled with no
  "skip team notes" path.
- **PDF share is a two-tap dance.** It is a platform constraint, but the "ready" state is only a label change on the
  same button.
- **After every save, delete or import, the list reloads from page 1**, losing scroll position and loaded pages.
- **The training AI Regenerate discards all review edits**; the exercise AI keeps the kept cards.
- **`followsExerciseNaming` is dead code in production.** The naming convention is only a hint.

## Open questions

1. When a coach confirms "Leave" in a dirty diagram editor, should changes be discarded (as the copy says) or saved
   (as the unmount safety net does)? The redesign must pick one and test it.
2. Should undo history survive autosave? Today it does not, and a parity check would keep that.
3. Should exercise library rows open a read-only detail (like trainings) instead of the edit form? Parity says edit.
4. Is free-text exercise search expected? The brief mentions "search", but the current exercises page has only
   category chips, and there is no search query or index.
5. Should the hardcoded English titles ("Diagram N", "AI draft", "AI training", "Untitled", "Text") be localized in
   the redesign, or stay as stored data?
6. In a session PDF, is a path without team notes wanted when the roster cannot load?
7. Is the module-level diagram clipboard meant to work across exercises? It does today within a session
   *(inferred)*.
8. Should the builder's Cancel and its button-only edits get the discard guard? This is a deliberate parity break if
   changed.
