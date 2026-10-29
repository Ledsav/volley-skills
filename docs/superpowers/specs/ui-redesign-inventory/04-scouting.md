# Match scouting, end to end

Parity contract for the UI redesign (branch `feature/ui-redesign`, written 2026-10-28 from the code as it stands). It describes **current behaviour only**. Where something is inferred rather than read directly, it says so.

**What the area is for.** A team creates a match (date, opponent, format, roster, liberos), scouts it live rally by rally from a phone or a laptop, and gets a post-match report. Two other input paths produce the same event log: **text scouting** (free-text notes parsed by the club's AI provider) and **DataVolley `.dvw` import** (a file parsed in the browser). Everything shown (score, rotation, who is on court, stats) is derived by replaying an ordered event log (`src/matches/scoutEngine.ts`). Nothing is stored as state.

**Routes**

| Route | Component | Shell | Notes |
|---|---|---|---|
| `/teams/:teamId?tab=matches` | `TeamMatchesTab` (inside `TeamPage`) | AppShell | Match list, "New match", "Import from DataVolley (.dvw)" |
| `/teams/:teamId/matches/:matchId` | `MatchPage` | AppShell | Setup form, live banner, or finished report |
| `/teams/:teamId/matches/:matchId/scout` | `ScoutPage` (lazy, fallback text "Loading scouting…") | **Outside AppShell**, full screen, inside `RequireAuth` (so `ClubGate` applies) | Live scouting |
| `/teams/:teamId/matches/:matchId/awards` | `AwardsPage` (another agent covers it) | outside AppShell | Linked from a finished match |

Other ways in: the team calendar shows match chips (link to the match page) and a per-day "+ Match" that opens the Matches tab's create dialog with that date (`TeamPage` → `newMatchDate`). The home page's "Live now" block (`src/home/LiveNowBlock.tsx`) links straight to `/scout`.

**Who uses it, and in what context.** It is used by team admins (email in `teams/{id}.adminEmails`) and club admins. Firestore rules (`firestore.rules`, `matches/{matchId}` and `events/{eventId}`) allow read and write only to `activeMember() && teamAdmin()`, and read to `exporter()`. Typical use: one coach or assistant on a phone, held one-handed courtside in a gym with a weak connection, scouting a youth match live. The same person may use a laptop with a keyboard (hotkeys), at the bench or later from video. Text scouting suits catching up on missed rallies or scouting from notes or dictation. DataVolley import is for clubs whose analyst already scouts in DataVolley on a laptop.

i18n namespaces (English source in `src/i18n/en/`): `matches.*` (list, page, setup, event, engine, rotation, report), `scout.*` (page, header, court, rally, actionSheet, sub, correction, editEvent, live, timeline, setStart, hotkeys), `textScout.*` (panel, preview, issues), `dvw.*` (messages, review, dialog), `labels.*` (skill, grade, pointReason, competition, matchStatus, position).

---

## Screens and components

### 1. Team Matches tab (`src/matches/TeamMatchesTab.tsx`, `/teams/:teamId?tab=matches`)

- **Purpose.** Lists the team's matches and is the entry point to create a match or import a `.dvw` file.
- **Who can see / do what.** `TeamPage` shows the **Matches** tab to everyone who can open the team page, admins and non-admins alike (unlike Stats, which is admin-only). The data reads are team-admin-only in the rules. A non-admin viewer would therefore get the load error. This is inferred from the rules, and no test covers it; see Open questions. Create and import also need `firebaseUser`: the create dialog only renders when `firebaseUser` is set.
- **Elements, top to bottom:**
  1. A right-aligned toolbar:
     - While offline, the text "Connect to the internet to import." (`matches.list.offlineImport`).
     - Secondary button with a FileUp icon: "Import from DataVolley (.dvw)".
     - Primary button with a Plus icon: "New match".
  2. An inline error (`role="alert"`) on load failure: "Could not load matches." It also shows "A new match could not be saved. Check your connection." when a create write is rejected.
  3. Empty state: a dashed box reading "No matches yet."
  4. The list. Each row is a card containing:
     - A link to the match page with the date (small, tabular) above the opponent name (truncated).
     - The result `setsUs–setsThem`, large and tabular.
     - A status chip: Setup is neutral, Live is orange, Finished is green (`labels.matchStatus`).
     - For a **live** match only, a "Resume" link to `/scout`.
  5. A "Load more" secondary button when another page exists.
- **Actions → results:**
  - **New match** opens a `Dialog` titled "New match" (size lg, `mobileSheet`, `guardUnsaved`) containing `MatchSetupForm` with the submit label "Create match". The date defaults to today's **local** date (`todayIso()`).
  - **Create match** (a valid form) calls `createMatch(teamId, input, uid)`. The write is **not awaited**: the dialog closes immediately and the app navigates to `/teams/:teamId/matches/:newId`, which shows the match in setup state. If the write is later rejected, the tab's error is set, but the user has already navigated away.
  - **Calendar "+ Match"** (`newMatchDate` prop) opens the same dialog pre-filled with that date. Closing the dialog calls `onNewMatchHandled`.
  - **Import from DataVolley** opens `DvwImportDialog` (§23). When the import succeeds, the dialog closes and the app navigates to the new match page.
  - **Resume** goes to `/teams/:teamId/matches/:id/scout`.
  - **Load more** fetches the next page with a cursor (`startAfter`).
  - Closing the create dialog after editing a field asks for discard confirmation (`guardUnsaved`).
- **States:**
  - Loading: the list is empty, with no spinner. "No matches yet." can flash until the first page arrives (observed from code: `matches.length === 0 && !error`).
  - Offline: the import button is disabled and the hint is shown. Online and offline status is tracked live through window events.
  - New match works offline.
- **Data.** `listMatches`: `orderBy('date','desc').limit(20)`, with "has more" meaning exactly 20 came back.
- **Tests that lock this in:** `src/matches/TeamMatchesTab.test.tsx`:
  - "lists matches with result and status" (including the Resume href)
  - "opens the setup form, pre-filled from the calendar date"
  - "opens the setup form from the button"
  - "creates the match without waiting for the server and opens it"
  - "opens the import dialog online"
  - "disables the DataVolley import offline"
  - "uses the local calendar date, not the UTC one"

### 2. Match setup form (`src/matches/MatchSetupForm.tsx` + `matchSetup.ts`)

Used in two places: the create dialog (§1, submit label "Create match") and the setup-state match page (§3, submit label "Save setup").

- **Purpose.** Defines the match metadata, the format, the per-match roster snapshot (numbers and roles for this match only) and the liberos.
- **Elements, in order:**
  1. A 2-column grid:
     - **Date** (date input).
     - **Opponent** (text, placeholder "Team name").
     - **Competition** (League / Cup / Friendly / Tournament, default League).
     - **Venue** (Home / Away, default Home).
  2. **Format** fieldset with 5 fields:
     - **Best of**: 3 or 5 (default 5).
     - **Set points**: default 25.
     - **Deciding set**: default 15.
     - **Subs / set**: default 6.
     - **Timeouts / set**: default 2.

     All number inputs have min 0.
  3. **Match roster** fieldset:
     - A counter "N / 14 selected". It turns red and medium weight when N > 14.
     - One row per team player, in 2 columns on sm+:
       - A checkbox, aria "Include {name}".
       - "#number Full name".
       - A role select, aria "Role for {name}": S, OH, O, MB, L, U or TBD, shown as codes.
       - A number input, aria "Number for {name}", 1–99.
     - A duplicate number gives the row a red border and the red text "Duplicate #n".
  4. **Liberos** fieldset with two rows. Each row has:
     - A "Libero N" select: "None" plus the checked players, formatted "Name (#n)".
     - An "On court" mode select: Always / When we receive / When we serve.

     When at least one libero is chosen, a "Libero replaces (in the back row)" chip list appears: one checkbox "#n" per checked non-libero player.
  5. Feedback:
     - "Saved." (`role="status"`, green) after a submit.
     - An error (`role="alert"`) when validation fails or the write is rejected.
  6. Buttons: **Cancel** (ghost) and the submit button (primary).
- **Defaults (new match):**
  - Ticked players, at most 14: starters (non-L) first, then up to 2 liberos (role L), then the rest by number (`defaultRosterIds`).
  - Jersey number and role come from the player profile.
  - Liberos are pre-filled from the ticked L players, sorted by number. With one, the mode is `always`. With two, the first is `receiving` and the second is `serving`. With none, the slots stay empty, with their default modes `always` and `receiving`.
  - "Replaces" defaults to every team player whose (match) role is MB.
  - Roster order saved: starters first, then by number.
- **Defaults (editing an existing setup):** ticks, numbers and roles come from the saved roster, liberos and replaces from the saved liberos.
- **Actions → results:**
  - Any change marks the form dirty (`onDirtyChange(true)`) and clears "Saved.".
  - **Submit** first runs `validateSetup`. On failure it shows the message and calls nothing.
  - On success it calls `onSubmit(input)`, shows "Saved." **immediately** and reports clean (`onDirtyChange(false)`) without waiting for the server.
  - If the returned promise later rejects, "Saved." is hidden, "Could not save the match. Please try again." is shown and the form is dirty again.
  - The submit button stays enabled after a submit.
  - **Cancel** calls `onCancel`. In the create dialog it closes the dialog. On the match page it navigates to the team.
- **Validation (in order; messages from `matches.setup.problem`):**

  | Rule | Message |
  |---|---|
  | Date is empty | "Pick a date." |
  | Opponent is blank (after trimming) | "Enter the opponent." |
  | More than 2 liberos | "At most two liberos." |
  | Same player in both libero slots | "Pick two different players as liberos." |
  | Libero not in the roster | "Each libero must be in the match roster." |
  | Fewer than 6 non-libero players | "Pick at least 6 players besides the libero(s)." |
  | Roster over 14 | "A match roster has at most 14 players." |
  | Number not an integer from 1 to 99 | "Check the shirt number for {name}." |
  | Duplicate number | "Two players share #n." |
  | A format number not finite, below 0, or set points below 1 | "Check the match format numbers." |

  Live guards: the submit button is **disabled** while any duplicate number exists or more than 14 players are ticked.
- **States:**
  - "Loading roster…" while the team players load.
  - "Could not load the team roster." on failure. The form does not render.
- **Edge cases:**
  - Per-match role changes never touch the player profile.
  - The libero is excluded from its own `replaces`.
  - Unticking a player removes the duplicate flag.
- **Tests that lock this in:**
  - `src/matches/MatchSetupForm.test.tsx`:
    - "submits a match with all players ticked and a libero replacing the middles"
    - "stores the per-match role…"
    - "shows the validation error instead of submitting"
    - "shows Saved immediately, without waiting for the server write"
    - "surfaces a rejected write after the fact and marks the form dirty again"
    - "ticks at most 14 players, shows the counter, and pre-fills the libero"
    - "pre-fills two liberos as receiving and serving"
    - "highlights duplicate numbers live and disables submit"
    - "defaults the date to the local calendar date"
  - `src/matches/matchSetup.test.ts`: validation, roster build, default ticks, default lineup.

### 3. Match page (`src/matches/MatchPage.tsx`, `/teams/:teamId/matches/:matchId`)

- **Purpose.** Hub for one match. What it shows depends on `match.status`.
- **Common elements:**
  - A "Back to team" link (chevron).
  - A card holding a meta line "date · Home|Away · Competition" and the H1 "vs {opponent}". The page title is the same; the fallback title is "Match".
  - A **"Delete match"** button (`dangerGhost`), shown in all three states and hidden in print.
- **State `setup`:**
  - A right-aligned primary button **"Start scouting"**. It is disabled while the setup form is dirty, with the hint "Save the setup first." beside it.
  - Below it, `MatchSetupForm` with `initial = match`, submit label "Save setup", and Cancel navigating to the team page.
  - **Save setup** applies the edit to the page immediately (optimistic `setMatch`) and returns `updateMatchSetup` so the form can surface a rejection.
  - **Start scouting** calls `setMatchStatus(live)` **without awaiting** and navigates to `/scout` at once. If that write fails, `actionError` "Could not start scouting. Please try again." is set on a page that is no longer mounted (observation).
  - The event log is **not** read in setup.
- **State `live`:**
  - An orange banner reading "Scouting in progress", with a **"Finish match"** button (secondary, disabled until the replay state exists) and a **"Resume scouting"** link (navy) to `/scout`.
  - The live report (`MatchReport`) is shown below, built by replaying the events. The event log is subscribed.
- **State `finished`:**
  - An actions row: **Export** menu (Print / PDF → `window.print()`; "CSV · Excel (Belgium/EU)"; "CSV · Excel (English) / Sheets"), **Match awards** (an orange link to `/awards`) and **Reopen for editing** (secondary).
  - The report is shown below.
  - A finished match with a stored `report` does **not** read events. Older finished matches without one fall back to the event log.
  - The CSV export uses the report's selected set: the file name is `{date}-{opponent}-all.csv` or `-set{N}.csv`. The report and CSV belong to another agent; this list is the hand-off.
- **Finish match** (on this page):
  - Re-reads the usage profile. If that fails, the alert "Could not load usage history — try finishing again." appears, nothing is written and the button stays enabled.
  - Otherwise it builds the payload (`buildFinishPayload`: summary, report, usageContribution, result, updated usage profile) and calls `finishMatch` **without awaiting**.
  - The page is optimistically switched to finished.
  - A ref guard prevents double submission.
- **Reopen for editing:** optimistic switch to live, then `setMatchStatus(live)`. If rejected, it reverts to finished and shows "Could not reopen the match. Please try again.".
- **Delete:**
  - Opens a `ConfirmDialog`: "Delete this match?" / "All scouted actions for this match are deleted. This cannot be undone." / "Yes, delete". Focus starts on Cancel.
  - The delete is **awaited** (events, then the match doc). Success navigates to the team page. An error shows inside the dialog: "Could not delete the match. Please try again."
- **States:**
  - Loading: `PageSkeleton` (layout "match", "Loading match…").
  - Missing match, **or permission denied**: `NotFoundState` with "Match not found" / "It may have been deleted, or you don't have access." / "Back to team".
  - Other load error: "Could not load this match." in red.
- **Tests that lock this in:** `src/matches/MatchPage.test.tsx`:
  - "disables Start scouting while the setup has unsaved edits"
  - "starts scouting without waiting for the server (offline)"
  - "applies a setup save immediately while the write is pending"
  - "reopens a finished match immediately and reverts with an error if the write is rejected"
  - "renders a finished match from its stored report without reading events"
  - "prints and exports the selected set of a finished match as CSV"
  - "falls back to the event log for a finished match without a stored report"
  - "does not read events while the match is in setup"
  - "does not finish a live match when the usage history cannot be loaded"
  - "shows the not-found state for a missing match"
  - "shows the same state when access is denied"
  - "finished match links to match awards"

### 4. Scout page shell (`src/matches/scout/ScoutPage.tsx`, `/teams/:teamId/matches/:matchId/scout`)

- **Purpose.** Full-screen live scouting.
- **Who.** Team or club admin, on a match whose status is `live`. The text panel exists only when the club's `aiEnabled` is true (`useClubFeatures`).
- **Load sequence:**
  1. `getMatch`:
     - Missing match → `NotFoundState`.
     - Any status other than `live` → `navigate(matchPage, { replace: true })`, so a stale tab can never write into a setup or finished match.
     - Live → device-lock check (§5), otherwise `claimDevice`.
  2. `getUsageProfile` (failures ignored; an empty profile is used).
  3. `useMatchEvents` subscribes to events: `orderBy('order').limit(2000)` with `includeMetadataChanges` to count pending writes.
  - While loading: the plain text "Loading match…".
  - On a load or events error: a full-page red alert ("Could not load this match." / "Could not load match events. Check your connection.").
- **Layout: a fixed full-height frame (`h-[100dvh]`).** The header and the bottom events dock never scroll; only the middle scrolls. From top to bottom:
  1. `ScoutHeader` (§6).
  2. A write-error banner (`role="alert"`, red) when any write fails. It is **sticky until reload**: nothing clears it.
  3. An insert-anchor banner (blue): "Inserting into the timeline", with a "Back to live" button that clears the anchor.
  4. A between-sets banner (orange), shown when not in a set and the match is not over:
     - Before set 1, the text is "Set the lineup to start scouting".
     - After a set, it is "Set N over · us–them", with a ghost button **"Undo set end"**.
     - It always has a primary **"Start set {N+1}"** button.
  5. A match-over banner (green): "Match over · X–Y" with a primary **"Finish match"** button.
  6. The middle area:
     - **Desktop (≥1024 px, `min-width: 1024px`):** a 2-column grid exactly as tall as the space between the header and the dock, so the page never scrolls. Left is the court column (the court fills its height up to 30rem, both rows always visible; the action panel sits under it). Right (360 px, 400 px from xl) holds the text panel (if open), else the Live stats panel, each scrolling inside itself, and then the Timeline in a box capped at 40 % of the column with its own scroll.
     - **Phone:** a tab bar (`role="tablist"`, aria "Scouting views") with **Court / Live / Timeline / Text**. Text appears only when AI is enabled. Below the bar, the selected view.
  7. The **events dock** (`<section aria-label="Match events">`), shown only while a set is in play, on every phone tab. It contains `RallyBar` (§10). It pads for the safe area.
- **Court column:**
  - In normal mode: `CourtGrid`, then `BenchStrip` (hidden while an action panel is open), then `ActionSheet` (when a player is selected and a set is in play).
  - In **quick score** mode: the court, bench and sheet are hidden entirely.
  - When not in a set: "Start the set to record actions." under the court.
- **Overlays:**
  - `SetStartDialog`.
  - `SubDialog`.
  - `CorrectionDialog`.
  - The set-point prompt: a non-modal `role="dialog"`, fixed near the top.
  - `EditEventDialog`.
  - A confirm for deleting a set start or set end.
  - The text-batch undo confirm.
  - `HotkeyCheatSheet`.
  - The jersey-number hint toast: a fixed pill at the bottom centre, `role="status"`.
- **Auto behaviours:**
  - **The first-set lineup dialog opens automatically once** when the match has no set yet. Later sets start from the banner, so an accidental "Confirm set" can still be undone.
  - When `inSet` becomes false (set end, or before the first set), the page closes the selection, sub dialog, reason prompt and correction dialog.
  - **Result sync:** whenever the replayed result (sets won and set scores) differs from `match.result`, the page writes `updateMatchResult`, not awaited. It is skipped while locked. This keeps the list and calendar current without replaying there.
  - Device heartbeat: `claimDevice` every 60 s while loaded and not locked.
  - Auto-select after each of this device's writes (§9).
- **Recording pipeline (`record`):**
  - Every tap writes one event via `addEvent`. The id is client-generated, the write is **not awaited**, and a rejection sets the write-error banner "An action could not be saved. Check your connection and the timeline.".
  - The `order` comes from `nextOrder`:
    - Append: max(last order + 1, highest order this device wrote + 1).
    - Insert: the midpoint after the anchor, also resolving an anchor that is this device's own unsynced write.
    - So rapid taps before the snapshot lands never reuse an order.
  - Recording any event clears the reason prompt.
- **Tests that lock this in:** `src/matches/scout/ScoutPage.test.tsx`. It is the main contract file (about 50 tests) and is cited per feature below.

### 5. Device lock (`src/matches/deviceLock.ts` + `ScoutPage`)

- **Rules:**
  - The device id is a random UUID persisted in `localStorage` under `vcb.scoutDeviceId`. If storage throws, an in-memory id is used.
  - The match is "locked by another device" if `activeDevice.id !== mine` **and** `now − activeDevice.at < 2 min` (`LOCK_STALE_MS`).
  - `claimDevice` writes `{ id, at: Date.now() }` (the client clock).
- **UI.** When locked on open, the whole page is replaced by a `ConfirmDialog` (`alertdialog`):
  - "Being scouted on another device" / "Another device scouted this match in the last two minutes. Take over here? Only one device should scout at a time." / **"Take over"**.
  - Cancel navigates to the match page.
  - Take over claims the device and shows the scouting screen.
  - While the dialog shows, no heartbeat or result sync runs.
- **Edge cases:**
  - The lock is checked **only on page load**. A device that has been taken over is not told; it keeps scouting and its heartbeat keeps claiming (observation from code).
  - Opening the match page does not claim; only `/scout` does.
- **Tests that lock this in:**
  - `deviceLock.test.ts`
  - `ScoutPage.test.tsx`: "warns when another device is scouting", "keeps the device heartbeat firing while points change the result"

### 6. Scout header (`src/matches/scout/ScoutHeader.tsx`)

- **Elements, one navy row, left to right:**
  1. **Score block.** It is one button (aria "Correct score"). The first line holds the large score "us–them" and a serve/receive pill: "Serve" (orange) when we serve, "Receive" (translucent) otherwise. The second line is the status "Set N · sets X–Y · subs U/M · vs {opponent}", truncated. Set 0 displays as 1.
  2. **Rotation corrections.**
     - A ◀ button "Previous rotation" calls `prevRotation`, which is rotation + 1 (it un-does a side-out).
     - The label "Rot N", where N is the rotation number (the setter's zone, 1–6).
     - A ▶ button "Next rotation" calls `nextRotation`, which is rotation − 1 (the side-out direction).
  3. An **Undo** button with an icon, "Undo" text from sm up, and a Kbd badge "Ctrl+Z" (desktop only).
  4. **Sync status:**
     - sm+ shows "✓ synced", or a CloudOff icon with "N pending" (`aria-live="polite"`).
     - Phone shows the CloudOff icon and the number only when N > 0.
  5. The **Match tools** menu (⋯), aria "Match tools".
- **Match tools menu items:**
  1. **Quick score** (a check item).
  2. **Auto-select next player** (a check item with Kbd "Shift+A"), hidden while quick score is on.
  3. Desktop only:
     - **Text panel** (a check item), present only when AI is enabled.
     - **Keyboard shortcuts** (an action with Kbd "?").
  4. A divider.
  5. **Exit to match**, which navigates to the match page.
- **Actions → results:**
  - Score tap opens the `CorrectionDialog`.
  - The ◀ and ▶ buttons write a `correction` event `{ rotation, score: null, serving: null }` with `source: 'correction'`.
  - Undo: see §16.
- **States.** When no set is in play (`disabled`), the score button and rotation arrows are disabled, because the engine ignores corrections outside a set. **Undo is never disabled.**
- **Pending count rule.** It is the number of docs with `hasPendingWrites`. If the snapshot has pending writes but no single doc does (for example, deletes), it shows 1.
- **Tests that lock this in:**
  - `ScoutPage.test.tsx`: "keeps match events in the bottom dock, on every tab, apart from Undo" (Undo is in the header, not the dock), "puts the app tools in one Match tools menu", "rotation arrows write a correction", "between sets… Correct score is disabled"
  - `matchesApi.test.ts`: "reports pending writes from snapshot metadata"

### 7. Court grid (`src/matches/scout/CourtGrid.tsx`)

- **Purpose.** The 6 on-court players, tappable to record.
- **Layout.** Seen from behind our baseline:
  - At the top, a "Net" label between two thick bars.
  - The front row: **P4 P3 P2**.
  - A dashed attack line.
  - The back row: **P5 P6 P1**.
  - The court is framed with an orange border on an orange tint.
- **Tile content.** The same spot on every tile, for recognition at a glance: role badge and number first, then the name as the largest text; the zone stays quiet.
  - In the bottom-right corner, the quiet zone label "P{n}". The P1 tile also shows a volleyball icon while **we serve**.
  - At the top right:
    - An "auto" badge when the selection came from auto-select.
    - A form dot: red when the player has 3 or more errors this set; green when points − errors ≥ 3 this set (`playerForm`).
  - The first line: `RoleChip` as a badge (24 px, bold, `surface-3`; inverted to ink on the selected tile), which shows the per-set role (falls back to the roster role), then "#number" bold and tabular (title-2 from xl).
  - The second line: the short name (first name; plus the surname initial when two first names clash; the full name if that still clashes), the largest text on the tile (title-3, title-2 from md, title-1 from xl; headline on compact tiles), one line, truncated.
  - The active libero tile has an orange border and tint. Its chip shows "L·rec" (receiving mode), "L·def" (serving mode) or "L" (always).
  - The selected tile is filled blue with white text and a ring.
  - Tile aria-label: "#7 Ana" or "#1 Lara, libero"; `aria-pressed` reflects the selection.
  - Tile `title` tooltip: "serving" and/or "3+ errors this set" / "scoring well this set".
  - An empty zone is a dashed box with only the zone label.
- **Actions → results:**
  - **Tap** selects the player and opens the action panel (§8). Tapping the selected tile again re-selects it, which resets the panel to the first chip.
  - **Long-press of 500 ms** opens `SubDialog` for that player. A libero tile ignores long-press. After a long-press, the release does not also select. The context menu is suppressed.
  - Pointer up, leave or cancel aborts the timer.
- **States.** When disabled (no set in play), the tiles are disabled at 60 % opacity, with no select and no long-press.
- **Tests that lock this in:**
  - `CourtGrid.test.tsx`: the libero tile labels for each mode; "is inert when disabled"; "fills the selected tile and badges an auto-selection"; "shows number, name and role on each tile, and marks the server in P1 only while we serve"; "keeps the libero name on the tile next to the libero chip"
  - `ScoutPage.test.tsx`: "before set 1… nothing can be recorded"

### 8. Action panel (`src/matches/scout/ActionSheet.tsx`)

- **Purpose.** Record one action for the selected player: the fundamental chip and the grade.
- **Where.** An **inline card below the court** (`<section aria-label="Actions for #n Name">`), not a modal or bottom sheet. The bench strip is hidden while it is open.
- **Elements:**
  1. A header row:
     - The player's name (lg bold), "#number" and a `RoleChip`. For the libero the chip is "L"; otherwise it is the **roster** role, not the per-set role (observation).
     - A **Substitute** button (swap icon), hidden for liberos.
     - A **Close** button (X, aria "Close actions").
  2. Fundamental chips, horizontally scrollable, each with a Kbd letter badge on desktop. The active chip is filled blue (`aria-pressed`).
  3. A 3-column grade grid. **Only the grades valid for the active fundamental are shown.** Each button shows the large symbol, the per-skill label and a Kbd badge, colour-coded:

     | Grade | Colour |
     |---|---|
     | `#` | solid green |
     | `+` | light green |
     | `!` | neutral, bordered |
     | `-` | light orange |
     | `/` | stronger orange |
     | `=` | solid red |

     The colours live in `gradeStyles.ts`. Button aria: "{grade} {label}", for example "+ Good".
- **Chip order (`nextActions.orderSkills`):**
  - **The expected next fundamental comes first and is pre-selected.**
  - It is followed by the player's other skills, ranked by current-match counts if the player has at least one action this match, else by history averages (`scoutProfile/usage`), else by the position default.
  - Position defaults:

    | Position | Order |
    |---|---|
    | S | E, S, D, B, A |
    | L | R, D, F, E |
    | MB | B, A, S, D |
    | OH | R, A, S, D, B |
    | O | A, B, S, D |
    | Other | S, R, A, B, D, E |

  - Then the remaining skills.
  - **A libero never gets S, A or B.**
  - The position used is the per-set role (`state.roles`).
- **Expected next skill (`expectedSkill`):**
  - No action yet in the rally: Serve if we serve, Reception if we receive.
  - Otherwise, after the last action:

    | After | Expected next |
    |---|---|
    | R | E |
    | E | A |
    | A | B |
    | S | B |
    | B | D |
    | D | E |
    | F | E |

  - Overrides: after an R, D or F graded `/` (overpass), B is expected. After S `/` (free ball back), F is expected.
- **Grades and labels (`labels.grade`, `skillGrades.ts`).** "—" means the grade is not offered (no button):

  | Skill | `#` | `+` | `!` | `-` | `/` | `=` |
  |---|---|---|---|---|---|---|
  | Serve (S) | Ace | Pressure | OK | Easy | Free back | Error |
  | Reception (R) | Perfect | Good | OK | Poor | Overpass | Aced |
  | Attack (A) | Kill | Good | Covered | Easy dig | Blocked | Error |
  | Block (B) | Stuff | Touch ours | — | Touch theirs | Tooled | Net |
  | Dig (D) | Perfect | Good | OK | Poor | Overpass | Error |
  | Set (E) | Perfect | Good | OK | Poor | — | Error |
  | Free ball (F) | Perfect | Good | OK | Poor | Overpass | Error |
- **Actions → results:**
  - **Grade tap** closes the panel and writes `action { playerId, skill, grade }`.
    - If the grade ends the rally, the engine closes it: `S#`, `A#`, `B#` win; any `=`, `A/` or `B/` lose. Score, serve and rotation advance automatically.
    - After the write lands in the local snapshot, auto-select may reopen the panel on the predicted next player (§9).
  - **Chip tap** switches the fundamental. The panel is controlled by the page, so hotkeys and taps share it.
  - **Substitute** opens `SubDialog` and clears the selection.
  - **Close** clears the selection and suppresses auto-select until the next write.
- **States.** The panel only exists while a set is in play, a player is selected and quick score is off. It is re-keyed on each selection (`seq`), so every selection starts on its first chip.
- **Tests that lock this in:**
  - `ActionSheet.test.tsx`: "pre-selects the first skill and records a grade in one tap", "hides grades a skill does not have", "offers a substitution"
  - `ScoutPage.test.tsx`: "records player → grade with reception pre-selected when receiving", "hides the bench while a player actions sheet is open"
  - `nextActions.test.ts`

### 9. Auto-select (in `ScoutPage`, logic in `nextActions.predictPlayer`)

- **What.** After each event *this device* records, once that event appears in the events snapshot (the local cache snapshot, so it works offline), the page selects the most likely on-court player for the expected next fundamental and opens the panel on that chip. The tile shows the "auto" badge. The common case becomes **one tap (the grade)**.
- **Prediction (`predictPlayer`):**
  - The candidates are the players on court.
  - Liberos are never candidates for S, A or B.
  - A serve while we serve goes to the player in P1.
  - Otherwise each candidate scores this-match count of that skill + 2 × their share of the candidates' history averages.
  - Ties go to the position rank for the skill:

    | Skill | Position rank |
    |---|---|
    | R, D, F | L, then OH |
    | E | S |
    | A | OH, O, MB |
    | B | MB, O, OH |

  - Then the lowest jersey number.
  - If nobody on court can perform the skill, nothing is selected.
- **Suppressed when:**
  - The Auto-select toggle is off. It is a per-device setting (`localStorage` `vcb.scoutAutoSelect`), default **on**.
  - Quick score is on.
  - No set is in play.
  - The text panel is visible.
  - An insert anchor is active: the replayed state is the timeline's end, not the insert point, so a prediction would be wrong.
  - The user tapped a tile manually or closed the panel. Auto-select then stays off until the next write.
  - The snapshot carries no new write of ours (for example, a pending write confirming).
- **Tests that lock this in:** `ScoutPage.test.tsx` › auto-select:
  - "after a reception, selects the setter with Set pre-selected"
  - "after a point that wins the serve back, selects the new P1 with Serve"
  - "does not auto-select in quick score…"
  - "closing the sheet suppresses auto-select until the next recorded event"
  - "does nothing with the Auto toggle off, and remembers the choice on this device"
  - "starts with Auto off when the device stored that preference"
  - "does not auto-select between sets"
  - "selects the server once a set starts with us serving"
  - "does not auto-select while the text panel is open"

  Also `nextActions.test.ts` › predictPlayer.

### 10. Rally bar / events dock (`src/matches/scout/RallyBar.tsx`)

- **Purpose.** Records match events that are not player actions: points without a player stat, and timeouts.
- **Layout.** One mirrored row: **[T/O us] [Point us] [Point them] [T/O them]**.
  - The timeout buttons are outlined (a hairline border, no fill: lighter than Point), 56 px tall, each under its own point button except on landscape phones where they flank the row. Each shows a timer icon and "T/O · N left" (N = timeouts per set − used, floored at 0), with a Kbd badge (T / Shift+T) on desktop. Aria: "T/O us (2 left)". Title: "Timeout us · key T".
  - The point buttons share the remaining width. "Point us" is light green and "Point them" light red, each with a Kbd badge (P / O).
  - **Quick score** makes the row taller (`min-h-20`, text-xl).
- **Reason prompt.** After a point is recorded, a chip group appears above the row: "Why? (optional)" (aria "Point us — reason (optional)").
  - Point us: **Opp. error**, **Other**.
  - Point them: **Opp. kill**, **Opp. ace**, **Opp. block**, **Other**.
  - Each chip has a Kbd badge 1–4.
- **Actions → results:**
  - **Point us / Point them** immediately writes `point { winner, reason: null }`: one tap, the rally closes, and score, serve and rotation advance. The reason prompt then opens.
  - **Reason chip** amends that point event with `updateEvent(..., { reason })`, not awaited. The prompt closes. On error: "Could not save the point reason."
  - The prompt **auto-hides after 5 s**. It also hides as soon as any other event is recorded, on Undo, and when its event is deleted.
  - **T/O** writes `timeout { team }`. There is **no block** past the limit. The engine adds a warning ("More than N timeouts this set."), visible in the timeline.
- **State.** The dock exists only while a set is in play.
- **Tests that lock this in:** `ScoutPage.test.tsx`:
  - "lays the dock out in one mirrored row…"
  - "records a point in one tap, then amends it with an optional reason"
  - "hides the reason chips after a few seconds or when another action is recorded"
  - "keeps the events dock when switching away from the court tab"
  - "quick score hides the court and still records points"

### 11. Bench strip (`src/matches/scout/BenchStrip.tsx`)

- **Purpose.** A credit-anyone fallback: every roster player not on court (including an off-court libero) appears as a dashed chip with the short name and "#n". It scrolls horizontally and is labelled "Bench".
- **Action.** A tap selects that player and opens the action panel. The engine still counts the action but warns "Credited to a player the app shows off court." in the timeline. No blocking.
- **States.** Hidden when the bench is empty or the action panel is open. Disabled when no set is in play. Not rendered in quick score.
- **Tests that lock this in:** `ScoutPage.test.tsx`: "hides the bench while a player actions sheet is open".

### 12. Set start dialog (`src/matches/scout/SetStartDialog.tsx`)

- **Purpose.** Lineup for P1–P6, per-set roles, and first serve. "Start set" writes a `setStart` event.
- **Opened by:**
  - Automatically, once, before set 1.
  - The banner's "Start set N" button.

  Rendered only when not in a set and the match is not over. It is a `Dialog` with `mobileSheet`, titled "Start set N".
- **Elements:**
  1. A mode toggle (aria "Lineup mode"): **By role** (default) / **Manual**.
  2. **By role:**
     - Six slot selects in a 2-column grid: Setter, Opposite, Outside 1, Outside 2, Middle 1, Middle 2.
     - Options read "#n Name (ROLE)", with players whose role matches the slot first. Liberos are excluded.
     - A **"Setter starts in"** select, P1–P6.
     - A **Lineup preview** mini-court in the same orientation as the court. Each cell shows "P{n}", the short name, "#n" and the role. The role is blue with " (was X)" when the slot changes that player's role for this set.
     - The lineup is built as a 5-1 (`build51`): opposite pairs always 3 zones apart; rotation number = setter zone.
  3. **Manual:**
     - The hint "P1 is the server. Front row: P4, P3, P2."
     - Six selects in court order (aria "Position P{n}").
     - Non-blocking 5-1 warnings (`check51`, list "Lineup warnings", orange):
       - "Expected 2 outsides on court, found 3."
       - "Setter and opposite are not opposite each other." / "Middles are not opposite each other." / "Outsides are not opposite each other."
  4. **First serve** radios: "We serve" / "They serve".
  5. A blocking hint in slate (not an alert): "Fill all six slots." / "Fill all six positions." / "A player is in two slots." / "A player is in two positions."
  6. Footer: **Back** (ghost) closes the dialog; **Start set** (primary) is disabled while the hint shows.
- **Pre-fill:**
  - Lineup: the previous set's starting lineup, else the first 6 non-libero roster entries (`defaultLineup`).
  - Role mode reads the slots back if that lineup is a clean 5-1; otherwise it fills each slot with the first player of the matching role, previous-lineup players first.
  - Roles: the roster roles overlaid with the previous set's `setStart.roles`.
  - First serve: **the opposite of the previous set's first serve**. Before set 1 that comes out as **"They serve"**, because the fallback is the engine's initial `serving: 'us'`. This is inferred from `nextSetServing`; see Open questions.
  - Switching to Manual copies the current lineup (if valid). Switching to By role re-derives the slots from the manual picks.
- **On Start:**
  - Writes `setStart { set: N, lineup, serving, roles }`, where `roles` covers the full roster and a slot pick overrides the role.
  - If any role differs from the roster snapshot, the match roster is updated (`updateMatchRoster`, not awaited) so later sets default to it. On error the banner reads "The new roles could not be saved to the roster. Check your connection."
  - When the set starts with us serving, auto-select picks the P1 server with Serve.
- **Tests that lock this in:**
  - `SetStartDialog.test.tsx`: pre-fill from the previous 5-1; "an outside picked as opposite plays opposite this set…"; "places the setter in the chosen starting zone"; "blocks Start when a player is picked twice"; "manual mode warns (without blocking)…"
  - `ScoutPage.test.tsx`: "asks for the lineup before the first set"; "closing the first-set dialog keeps the scout screen usable"; "Start set writes the per-set roles and saves changed roles to the roster"; "Start set leaves the roster alone when no role changed"; "defaults the next set's first serve to the other side…"
  - `rotation.test.ts`

### 13. Substitution dialog (`src/matches/scout/SubDialog.tsx`)

- **Opened by:**
  - A long-press on a court tile (not the libero).
  - **Substitute** in the action panel.
  - **Shift+S** with a non-libero selected.

  Rendered only while a set is in play.
- **Elements.**
  - Title "Substitute #n Name".
  - A 3-column grid of candidate buttons: short name, "#n" and a role chip. Aria "Bring on #n Name".
  - Candidates: roster players not in the base lineup and not liberos, **like-for-like role first, then by number**.
  - If there are none: "Nobody on the bench."
- **Action.** One tap on a candidate writes `sub { outPlayerId, inPlayerId }` and closes the dialog.
- **Engine effects** (all warnings are non-blocking, shown in the timeline):
  - The incoming player takes the outgoing player's zone and inherits their per-set role.
  - The libero keeps replacing whoever came in for a replaced player.
  - Subs are counted per set. More than the per-set limit warns "More than N substitutions this set."
  - A re-entry for anyone other than the player who replaced them warns "A player can only re-enter for the player who replaced them."
  - A sub whose outgoing player is not in the lineup is ignored with a warning.
- **Tests that lock this in:**
  - `SubDialog.test.tsx`: "lists like-for-like candidates first, then by number"
  - `ScoutPage.test.tsx`: "substitutes a player from the action sheet", "T / Shift+T call timeouts and Shift+S opens the substitution"
  - `scoutEngine.libero.test.ts`

### 14. Correction dialog (`src/matches/scout/CorrectionDialog.tsx`)

- **Opened by** tapping the header score (only in a set).
- **Elements.**
  - Title "Correct the game state".
  - A note: "Logged as a correction — stats are not changed."
  - Fields: **Us** and **Them** score (numbers), **Serving** (Us/Them), **Rotation** (1–6).
  - Footer: Cancel / **Save correction**.
- **Action.**
  - Only the fields that changed are written, as one `correction` event with `source: 'correction'`. If nothing changed, nothing is written.
  - The engine overrides score, serving and rotation at that point in the log. A rotation correction rotates the lineup until the rotation matches, so later side-outs continue from it.
- **Tests that lock this in:**
  - `scoutEngine.test.ts`: "a rotation correction rotates the lineup…", "a serving correction changes who serves"
  - No dialog test.

### 15. Set point prompt and set or match end (in `ScoutPage`)

- **Set point.** When `setPointReached` (a side has reached the target and leads by 2 or more), a card appears near the top. It is a non-modal `role="dialog"` labelled "Set point", so hotkeys keep working.
  - Text: "Set won 25–21?" or "Set lost 21–25?".
  - **Not yet** (ghost) dismisses it for exactly this set and score. It reappears if the score changes while still at set point.
  - **Confirm set** (primary) writes `setEnd { set }`. A per-set ref guard ensures a double tap writes exactly one `setEnd`.
- **Target.** The set-points value; in the last possible set (set number = best-of) it is the deciding-set points.
- **After the set ends.** The between-sets banner shows "Set N over · X–Y" with **Undo set end** (deletes the last `setEnd`) and **Start set N+1**. Nothing can be recorded (no dock; tiles disabled), but Undo still works.
- **A tied set** cannot end: the engine ignores the `setEnd` and warns "A set cannot end tied — ignored.".
- **Match over** (one side has won ⌈bestOf/2⌉ sets):
  - A green banner "Match over · X–Y" with **Finish match**.
  - Finish re-reads the usage profile. On failure the banner reads "Could not load usage history — try finishing again." and nothing is written.
  - On success, `finishMatch` is called (not awaited) and the app navigates to the match page.
  - The match-over banner offers no "Undo set end"; header Undo still works.
- **Tests that lock this in:**
  - `ScoutPage.test.tsx`: "asks to confirm the set at set point"; "double-tapping Confirm set writes exactly one setEnd"; "after a set ends, offers Start set and Undo set end instead of a blocking dialog"; "between sets, nothing can be recorded but Undo set end still works"; "closes an open action sheet when the set ends"; "finishes the match once it is over"; "does not finish when usage history cannot be reloaded"
  - `scoutEngine.test.ts`: set point at 25–23 but not at 25–24; deciding-set points; tied set refused; match end

### 16. Undo (header button, Ctrl+Z / Cmd+Z / Backspace)

- **Semantics, exactly:**
  1. Do nothing if the match has no events.
  2. Pop this device's write stack (ids it recorded this session, newest last), skipping ids no longer in the snapshot, to find the event to remove. **Undo removes what this device just did, even an insert in the middle of the timeline.**
  3. If this device has nothing left on the stack, take the last event by `order` (written by any device).
  4. If that event has a `chunkId` shared by more than one event (a text batch, or an import), show a confirm: "Undo whole text batch (N events)?" / "This removes N events that were added together." / **"Undo batch"**. On confirm, all of them are deleted.
  5. Otherwise the single event is deleted immediately: no confirm, no success notice. The delete is not awaited; on failure the banner reads "Could not undo. Try again.".
- **Scope.** Undo is **not limited to the current set**: between sets it removes the `setEnd`, which reopens the set. It works between sets and before the first set.
- **Side effects.**
  - Clears the reason prompt.
  - Clears the insert anchor if the anchor event is removed.
  - Replay recomputes everything.
- **Tests that lock this in:** `ScoutPage.test.tsx`:
  - "undo deletes the last event"
  - "undo clears the insert anchor when the anchor event is deleted"
  - "undo after an insert deletes the inserted event, not the tail"
  - "Ctrl+Z and Backspace undo"
  - "records nothing between sets, but Undo still works"

### 17. Timeline (`src/matches/scout/TimelineDrawer.tsx`)

- **Where.**
  - Desktop: below the live stats in the right column, in a box capped at 40 % of the column.
  - Phone: the "Timeline" tab.
- **Elements.** A flat list, **newest first**. It is not grouped by set or rally.
  - `setStart` and `setEnd` rows are bold on a tinted background.
  - Each row has a description (`describeEvent`):
    - Action: "#7 Dig + Good".
    - Point: "Point us · Opp. error".
    - Sub: "Sub #5 in for #9".
    - Timeout: "Timeout us".
    - Set start: "Set 1 · we serve".
    - Set end: "Set 1 end".
    - Correction: "Correction · score 12–10, rotation 3, they serve".
  - A source icon: pen for "From text", file-down for "Imported".
  - Engine warnings inline in orange with a triangle icon.
  - A navy score pill "us–them" on each rally-ending event.
  - Buttons on every row: **Insert after** (corner arrow). **Edit** (pencil) appears on action rows only. **Delete** (trash) on every row.
  - Empty: "Nothing recorded yet."
- **Actions → results:**
  - **Insert after** sets the insert anchor and, on a phone, switches to the Court tab. The "Inserting into the timeline" banner appears with "Back to live".
    - The next taps (or text merge) get orders strictly between the anchor and the next event.
    - After each non-rally-ending insert the anchor moves to the new event, so a chain of inserts stays in sequence.
    - A rally-ending insert (a point, or a deciding grade) clears the anchor.
    - The court and score still show the **end** of the timeline, not the insert point.
  - **Edit** opens `EditEventDialog` (§18).
  - **Delete:** an action, point, sub, timeout or correction is deleted **immediately**, with no confirm. A **set start or set end** asks first: "Delete set start?" / "Delete set end?" with "This changes the score and lineup for the rest of the set." and "Yes, delete". On failure: "Could not delete. Try again.". Deleting the anchor event clears the anchor.
- **Tests that lock this in:**
  - `TimelineDrawer.test.tsx`: "lists events newest first with the score after each rally" (text icon, no ✎ glyph); "deletes, edits and inserts"
  - `ScoutPage.test.tsx`: "confirms before deleting a set start, but deletes an action immediately"; "deleting the anchor event from the timeline clears the anchor"; "rapid inserts before the snapshot lands stay in sequence after the anchor"
  - `eventOrder.test.ts`

### 18. Edit event dialog (`src/matches/scout/EditEventDialog.tsx`)

- Only for `action` events. Title "Edit action".
- Fields:
  - **Player**: every roster entry, "#n Name".
  - **Fundamental**: all 7.
  - **Grade**: valid grades for the chosen fundamental, "symbol label". If the current grade is invalid for a newly chosen fundamental, the first valid grade is used.
- **Save** calls `updateEvent(id, { playerId, skill, grade })`, not awaited. On failure: "Could not save the edit.". Replay recomputes everything after it.
- Tests: none for the dialog itself.

### 19. Live stats panel (`src/matches/scout/LiveStatsPanel.tsx`)

- **Where.**
  - Desktop: the right column, replaced by the text panel while that is visible.
  - Phone: the "Live" tab.
- **Elements:**
  1. The title "Live" and a scope toggle: **This set** (default) / **Match** (`aria-pressed`).
  2. **Alerts** (`role="alert"`, red):
     - "#7 Ana: 3 errors this set" for any player with 3 or more rally-losing actions in the **current** set.
     - "Opp run 0–N — timeout?" when the opponent has won the last N ≥ 3 rallies of the set.

     Alerts ignore the scope toggle.
  3. A table with columns:
     - **Player**: "#n" and the name; a button that expands the row.
     - **Serve**: "att · n# n=".
     - **Rec +**: "att · pct", red when below 40 %.
     - **Attack**: "kills/att eff", red when efficiency is below 0.
     - **Block**: "n#".
     - **Pts / Err**: points in green and errors, the errors red-bold when 3 or more. Under it, a green/red trend bar.

     Rows are sorted by jersey number. Only players with actions in scope appear.
  4. An expanded row shows a per-fundamental breakdown: "Reception: 3 · = 3".
  5. The footer: "Side-out X% · Break Y% · Rec + Z% · Opp errors N · Weakest rotation R".
- **Threshold source.** `statFlags.ts` (`WEAK_RECEPTION_POS = 0.4`, attack efficiency < 0, 3 or more errors per match). The same thresholds are used by the post-match report and team stats.
- **Tests that lock this in:**
  - `LiveStatsPanel.test.tsx`: "shows alerts and per-player rows"; "expands a per-fundamental breakdown and shows trend bars"; "toggles scope"
  - `statFlags.test.ts`
  - `scoutStats.test.ts` › liveAlerts and playerForm

### 20. Keyboard shortcuts (`src/matches/scout/hotkeys.ts`, `useScoutHotkeys.ts`, `HotkeyCheatSheet.tsx`)

`KEY_MAP` is the single source for the handler, the on-screen Kbd badges and the cheat sheet. **The full list:**

| Group | Key(s) | Does | Conditions |
|---|---|---|---|
| Record | `0`–`9` | Jersey-number entry: selects that player (court or bench, liberos included) and opens the panel | In a set; ignored in quick score. Selects **at once** when exactly one roster number equals the digits and no longer number starts with them. Otherwise it waits for **Enter** or **700 ms** of silence. Digits no number starts with show "No player #8" for 1.5 s. While buffering, a sticky pill shows "#1…". Shift is allowed (AZERTY digits). |
| Record | `Enter` | Commits a pending jersey number | Only while digits are buffered |
| Record | `S` `R` `A` `B` `D` `E` `F` (either case, no modifier) | Switches the fundamental on the open panel | Only with the panel open and only the skills offered (a libero has no S, A or B) |
| Record | `#` `+` `!` `-` `/` `=` | Grades the action with the active fundamental | In a set, panel open, grade valid for the skill. Matches the **produced character**, so any layout works (Shift, AltGr = Ctrl+Alt, Option allowed). Never with Cmd, and never with plain Ctrl. |
| Record | `Shift+S` | Opens the substitution for the selected player | Panel open on a non-libero |
| Record | `Esc` | Closes the action panel, or cancels a half-typed jersey number | Only when a panel or buffer exists; otherwise the key is left alone |
| Rally | `P` | Point us | In a set |
| Rally | `O` | Point them | In a set |
| Rally | `1`–`4` | Picks the point reason (chip order) while the reason chips show | Takes precedence over jersey digits. A digit from 1–4 above the chip count does nothing; 5–9 and 0 still start a jersey number. |
| Rally | `T` | Timeout us | In a set |
| Rally | `Shift+T` | Timeout them | In a set |
| General | `Ctrl+Z` / `Cmd+Z` | Undo | Works between sets too. Not with Shift (redo is left to the browser). |
| General | `Backspace` | Undo; deletes the last buffered digit if a jersey number is pending | Works between sets |
| General | `Shift+A` | Toggles auto-select | Works between sets; ignored by the handler in quick score |
| General | `?` | Shows or hides the cheat sheet | Works between sets |

- **Global gating:**
  - **Every key is ignored** while focus is in an input, select, textarea or contenteditable (so typing in the text panel never scouts).
  - Every key is ignored while a modal is open (`[role=dialog][aria-modal=true]` or `[role=alertdialog]`). The set-point prompt is not modal and does not block keys.
  - With the cheat sheet open, only `?` (toggle) and `Esc` (close) work.
  - Any command other than digits, Enter, Backspace or Esc abandons a half-typed jersey number.
  - Handled keys call `preventDefault`. Keys already `defaultPrevented` are skipped.
- **Cheat sheet.** A `Dialog` "Keyboard shortcuts" with three groups (Record / Rally / General). Each row lists its keys as `<kbd>` with a description from `scout.hotkeys.desc`. It opens with `?` anywhere, or from "Keyboard shortcuts" in the desktop tools menu.
- **Kbd badges.** `Kbd.tsx` badges are decorative and `aria-hidden`, visible only at lg+ (desktop). They appear on point buttons (P/O), chips (letters), grades (symbols), the Undo button ("Ctrl+Z", also on Mac) and tools menu items.
- **Tests that lock this in:**
  - `hotkeys.test.ts`: about 20 cases covering layouts, gating, the jersey reducer and the idle commit
  - `ScoutPage.test.tsx` › keyboard:
    - "scouts a whole receiving rally from the keyboard"
    - "switches the fundamental and ignores grades it does not have"
    - "waits on an ambiguous jersey prefix until Enter"
    - "P then 1 records a point us and amends its reason"
    - "T / Shift+T call timeouts and Shift+S opens the substitution" (and "Dialog open: keys do nothing")
    - "Ctrl+Z and Backspace undo"
    - "Shift+A toggles auto-select"
    - "ignores keys while the set start dialog is open"
    - "ignores keys while typing in an input"
    - "? opens the cheat sheet listing the keys, and ? closes it"
    - "records nothing between sets, but Undo still works"

### 21. Quick score mode (`quickScore.ts` + `ScoutPage`)

- A per-device toggle in the tools menu, stored in `localStorage` as `vcb.scout.quickScore`. The default is **off**. If storage throws, the toggle still works for that visit.
- When **on**:
  - The court, bench and action panel are hidden.
  - The dock's point and timeout buttons become large.
  - The "Auto-select" menu item is hidden.
  - Jersey hotkeys do nothing.
  - Auto-select never fires, so leaving quick score opens no panel.
- Turning it on closes any open action panel.
- Points, timeouts, Undo, corrections and the set flow all still work.
- **Tests that lock this in:**
  - `quickScore.test.ts`
  - `ScoutPage.test.tsx`: "quick score hides the court and still records points", "turning quick score on closes an open action sheet", "starts in quick score when this device chose it before", "does not auto-select in quick score…"

### 22. Text scouting panel (`src/matches/text/TextScoutPanel.tsx`, `PreviewRallyCard.tsx`, `textScout.ts`)

- **Who / where.**
  - Only when the club has `aiEnabled`.
  - Desktop: toggled by "Text panel" in the tools menu. It replaces the Live panel in the right column.
  - Phone: the "Text" tab.
  - Once opened, it **stays mounted (hidden)** so a preview or a running Process survives tab switches and closing.
  - While it is visible, the selection is cleared and auto-select is suspended. Hotkeys are suspended while the textarea has focus.
- **Elements:**
  1. The title "Text" and a **Close** button. On desktop, Close closes the panel; on a phone it returns to the Court tab.
  2. The anchor line, for example "Inserting at 12–10 · Set 2 · Rot 3 · we serve". It reads "after" instead of "at" when an insert anchor exists.
  3. Status messages:
     - "Start the set first." (orange) when the anchor state has no set.
     - "No AI provider set up." with an **Open Settings** button linking to `/settings`.
     - "Offline — your notes are saved; process them when you're back online."
  4. A **Match notes** textarea with a multi-line placeholder ("7 ace / 12 bad reception, 2 set, 9 kill / opp error · TO them · 8 in for 9"). Under it, three tips:
     - "Tip: add the result — kill, out, blocked, good…"
     - The keyboard dictation tip.
     - The privacy line: "use jersey numbers only, no names… no injury or health details".
  5. **Process** (primary, small). While running, the panel shows "Processing…" or "Processing i/n…" and a **Cancel** button.
  6. An error (`role="alert"`).
  7. **The preview**, after a successful Process:
     - The score change "12–10 → 17–13 · Rot 4 · we serve".
     - "N later event(s) get warnings after this insert — check the timeline." when inserting before existing events creates new warnings on them.
     - "Not understood:" with a list of unparsed lines.
     - One editable card per rally (`PreviewRallyCard`):
       - "Rally N" and a delete-rally button.
       - The subs and timeouts summary.
       - Per action: a **player** select (roster numbers; an unknown number shows as "#33 ?"), a **skill** select and a **grade** select (valid grades; "Pick a grade" when missing, marked `aria-invalid` with a red border; an invalid grade shows as "! ?"), and a delete-action button.
       - A **Point** select: "From the actions" / Us / Them, with the reason shown.
       - Issues in red (blocking) or orange.
       - A card with a blocking issue gets a red border.
     - **Actual score — us / them** inputs. On a mismatch: "Replay gives X–Y, actual is A–B. Check rallies with no winner." (`role="alert"`).
     - **Discard** (ghost) and **Merge** (primary).
- **Process pipeline:**
  - Disabled unless a set is in play at the anchor, a provider is configured, the device is online, nothing is running and the text is not empty.
  - The draft autosaves to `localStorage` under `vcb.textDraft.{matchId}` on each keystroke and survives reloads and remounts.
  - On Process:
    1. Roster names (first and other name parts, accent- and case-insensitive) become `#number`; an ambiguous name becomes `#?`.
    2. The text is split by lines into chunks of 1,500 characters or fewer, processed one after another.
    3. Each chunk is sent with the roster as `{ number, role (per-set), isLibero }` and the anchor situation.
    4. Replies are validated locally. A non-JSON or invalid reply is retried once.
    5. Each run is aborted after 90 s.
  - Errors keep the draft:

    | Condition | Message |
    |---|---|
    | 429 | "{Provider} rate limit reached — retry in N s." / "…try again in a moment." |
    | Key rejected | "Key rejected — check it in Settings." |
    | Unreachable | "Could not reach the AI provider. Your notes are kept." (plus a Local hint "Is Ollama / LM Studio running…") |
    | Bad response after retry | "Couldn't parse — edit the notes or enter by taps." |
    | Zero-data-retention block | The `privacyBlocked` text |
    | Timeout | "Timed out — your notes are kept." |
    | Cancel | "Cancelled." |
    | Anything else | "Something went wrong. Your notes are kept." |
- **Issues (`batchToPayloads`):**
  - Blocking:
    - "#N is not in this match's roster."
    - "Pick a grade for #N Attack."
    - "Attack has no grade "!"."
  - Non-blocking:
    - "The actions give the point to us, the notes to them."
    - "No winner for this rally."
  - A point is added only when no action already decides the rally. Subs and timeouts are placed before that rally's actions.
- **Merge:**
  - Disabled while running, while a blocking issue exists, or when there are no events.
  - Writes all events with `source: 'text'` and **one shared `chunkId`** (a random UUID), with orders strictly between the anchor and the next event (or appended). The writes are not awaited.
  - Clears the anchor.
  - The panel then drops only the text that was processed. Anything typed after Process is kept. If the processed part was edited, the whole text is kept.
  - The preview and actual-score inputs reset.
  - If the page wrote nothing, the preview and notes stay.
  - A write failure shows the page banner "Some text events could not be saved. Check your connection and the timeline."
- **Undo of a merge** confirms "Undo whole text batch (N events)?" (§16).
- **Tests that lock this in:**
  - `TextScoutPanel.test.tsx`: dictation tip; "offers an Open Settings link…"; "strips names before asking, previews the replayed score and merges in order"; "keeps the draft across remounts"; "blocks merge on unknown jersey numbers until the row is fixed"; "flags a score mismatch…"; "needs a set in play, a configured provider and a connection"; "shows provider errors and keeps the draft"; the retry tests; "blocks an invalid skill/grade pair…"; "lets the coach pick a grade the notes left out"; "does not report warnings that later events already had"; the after-merge text retention tests; the Local hint; timeout and cancel
  - `textScout.test.ts`: name privacy, the parse contract, size caps, the prompt vocabulary
  - `wording.test.ts`: issue wording in English and Italian
  - `ScoutPage.test.tsx`: "merges text events as one batch with source text and a shared chunkId"; "reports that an empty text merge wrote nothing"; "keeps the text preview when the desktop panel is closed and reopened"; "keeps the text preview across tab switches"; "hides the Text tab when the club has AI off"; "offers no Text panel on desktop when the club has AI off"

### 23. DataVolley import dialog (`src/matches/dvw/DvwImportDialog.tsx`, `DvwReview.tsx`)

- **Who / where.** Opened from the Matches tab. **Online only**: the button is disabled offline with a hint. The dialog is "Import from DataVolley (.dvw)" (size lg, `mobileSheet`). It is `dirty` (asks before closing) while an import job exists.
- **Step 1, file:**
  - A "DVW file" input (`accept=".dvw"`).
  - The help text: "Pick a DataVolley scout file (up to 2 MB). It is read on this device; the player names in it are only shown while you review. Also works with Click&Scout and VolleyStation .dvw exports."
  - A footnote: "Not affiliated with Data Project or Genius Sports. DataVolley is a trademark of its owner."
  - "Reading the file…" while busy. The input is disabled.
  - Inline errors (`role="alert"`):
    - "This file is larger than 2 MB." (checked before reading).
    - Parse errors: "This does not look like a DataVolley file." / "Unsupported regulation: only indoor rally-point matches can be imported." / "This file has no scouted rallies."
    - "Could not read this file. Check your connection and try again."
  - After an error the file input is re-created, so the same file can be picked again.
  - On success, the app parses in the browser, hashes the file (SHA-256), loads the team roster, and looks for an earlier import of the same hash.
- **Step 2, review (`DvwReview`):**
  1. The file name.
  2. A **duplicate banner** (orange) when the hash exists: "This file was already imported on {date} against {opponent}." with an "Open the existing match" link. This does not block.
  3. Match fields:
     - **Date**, prefilled from the file.
     - **Opponent**: the other team's name, editable.
     - **Competition**: default League.
     - **Format**: Best of 3/5, inferred from the file.
  4. **Which team is us**: two radios, "{team name} (home)" and "{team name} (visiting)". The preselection is the team whose name shares the most words with the club name and the app team name; a tie picks home. **Flipping** re-runs the auto-mapping, resets an edited opponent and clears the score confirmation. Edited date, competition and format are kept.
  5. **Roster**: one row per our file player seen in the scout:
     - The jersey number.
     - The file name, or "Not in the player list".
     - The file role (Libero / Outside / Opposite / Middle / Setter / Unknown), hidden on a phone.
     - A select, aria "Map #n Name": "Skip" or an app player "#n Full name". It is auto-mapped by equal jersey.
  6. A **Checks** section:
     - A table of Set / File / Point lines / Replayed scores.
     - "N score corrections (lines …)".
     - "Events:" with counts by type.
     - "N lines ignored".
     - A warnings list (parse warnings first, then mapping warnings, each naming its lines). Examples: dropped grades, actions by `$$` or unmapped players, "the rally was already decided", unmapped subs, wrong-way actions, a libero-replacement guess, an unlisted jersey, and set-number mismatches.
  7. When the replayed set scores differ from the file's: an orange box, "The replayed set scores differ from the file's set scores.", with a required checkbox **"I checked the scores"**.
  8. **Blocking issues** (a red list, each item `role="alert"`):
     - "Map or keep every starter: the app needs six players on court in set N."
     - "Two file players are mapped to the same app player (#a and #b)."
     - The more-than-two-liberos message.
     - "This match is too long to import (more than 1,900 events)."
     - Any `validateSetup` message, for example "Pick a date.".
  9. **Cancel** (secondary) and **Import** (primary). Import is enabled only with no blocking issue and (if the scores differ) the box checked.
- **Step 3, import:**
  - The dialog shows "Importing… done/total" (`role="status"`).
  - The match is written first, with a create-only `import` provenance field. Events follow in batches of 450 or fewer with pre-generated ids. The match is then finished through the same path as live scouting.
  - On success: the notice "Match imported." and navigation to the match page (finished, with a report).
  - On failure: "The import did not finish. Retry, or discard what was written." with **Discard** and **Retry**.
    - Retry resumes from the next batch with the same ids (idempotent).
    - Discard deletes the partial match and closes. If the discard fails: "Could not discard the partial import…", and the dialog stays open.
    - **Closing the dialog after a failure discards the partial match.**
- **Tests that lock this in:**
  - `DvwImportDialog.test.tsx` (about 20 tests): help and footnote; parse error inline; picker reset; the 2 MB limit; side preselect and flip remap; blocked while a starter is skipped; blocked on empty date; duplicate link; required score confirmation; never imports while blocked; edited fields kept across a flip; discard on close after a failure; discard error; parse warnings counted; the special-role L label; same-app-player block; checks content; retry then success with the "Match imported." notice; discard after failure
  - `dvwImportApi.test.ts`
  - `mapDvw.test.ts`
  - `parseDvw.test.ts`
  - `roundTrip.test.ts`
  - `pickSide.test.ts`
  - `dvwMessage.test.ts`

### Hand-off points (covered by other agents)

- `MatchReport` (`src/matches/report/`) renders on the match page for live and finished matches: set filter, KPIs, players, rotations, timeouts, source line ("N% tapped", "N% from text", "Imported from DataVolley").
- CSV export and print (`reportCsv.ts`) are reached from the match page's Export menu.
- Awards (`/teams/:teamId/matches/:matchId/awards`, and the season awards on the team page) read the finished match's stored `report` / `summary`.
- Team Stats tab and player season stats read `listFinishedMatches` summaries.
- The calendar match chips and "+ Match" are in `src/calendar/TeamCalendarTab.tsx`. The home "Live now" block links into `/scout`.
- AI provider settings (Settings page, `src/ai/aiSettings.ts`) are the "Open Settings" target from the text panel.

---

## Must-keep invariants

**Writes, offline and sync**

1. Scouting event writes (`addEvent`), timeline deletes, edits, reason amends and the match status change on "Start scouting" are **never awaited**. The UI updates from the local Firestore cache, and scouting must work fully offline. A rejected write later shows an inline banner.
2. Event ids are client-generated, so an offline replay never duplicates an event.
3. The scout header shows a sync indicator: "synced", or "N pending" from the snapshot's pending writes. On a phone the count shows only when it is above 0.
4. "Create match" closes the dialog and opens the new match page immediately, without waiting for the server.
5. "Save setup" shows "Saved." immediately. A later rejection replaces it with an error and marks the form dirty again.
6. "Start scouting" is disabled while the setup form has unsaved edits ("Save the setup first.").
7. DataVolley import needs a connection (button disabled offline, "Connect to the internet to import."). Its writes *are* awaited, because batches must be acknowledged for Retry to work.
8. Rapid taps before the snapshot lands never reuse an `order`. Chained inserts after an anchor stay in sequence (2.5, 2.75, …).

**Access and lifecycle**

9. Only team admins and club admins can read or write matches. A missing match **and** a permission-denied match both show the same "Match not found" state.
10. `/scout` writes only into a **live** match. A setup or finished match redirects (with replace) to the match page, without claiming the device.
11. The device lock: opening `/scout` while another device id heartbeated in the last 2 minutes shows "Being scouted on another device", with **Take over** or Cancel (back to the match page). Only one claim on open, then a heartbeat every 60 s.
12. A finished match with a stored report never subscribes to the event log. A match in setup never does either.
13. Finish (from the match page or the scout page) re-reads the usage profile first. If that fails, nothing is written and "Could not load usage history — try finishing again." is shown. Finish is guarded against double submission.
14. "Reopen for editing" is optimistic and reverts with an error if the write is rejected.
15. "Delete match" always asks for confirmation (focus on Cancel), deletes events then the match, and returns to the team page.

**Engine rules the user experiences**

16. A rally ends on `S#`, `A#` or `B#` (point us), on any `=`, `A/` or `B/` (point them), or on a Point us / Point them event. Every other action keeps the rally open.
17. Rotation: winning a rally we received rotates the lineup (P2→P1, P1→P6) and gives us the serve. Losing while serving gives them the serve. Nothing else rotates.
18. The rotation number shown is the setter's zone at the set start (it falls back to 1), and decreases by one per side-out (1 wraps to 6).
19. Libero: it is applied automatically after every event. The active libero is the first `always` one, else the one matching the serve state (`serving` mode when we serve, `receiving` when we receive). It replaces the first back-row player (P5, P6, then P1) in its `replaces` list, **never in P1 while we serve**. The libero never appears in the base lineup.
20. A substitute inherits the outgoing player's zone and per-set role, and the libero keeps replacing a player who came in for a replaced player.
21. Sub and timeout limits, illegal re-entry, off-court credit, unknown players and a tied set end are **warnings, never blockers**. They appear inline in the timeline with the exact engine wording.
22. Set point means a side has reached the target (the set points, or the deciding-set points in set = best-of) with a lead of 2 or more. It shows a non-modal "Set won/lost X–Y?" prompt with **Not yet** and **Confirm set**. Not yet hides it only for that exact score.
23. Double-tapping **Confirm set** writes exactly one `setEnd`.
24. A set cannot end tied.
25. Match over means a side has won ⌈bestOf/2⌉ sets. It shows a "Match over · X–Y" banner with **Finish match**.
26. Corrections (score, serving, rotation) are logged as `correction` events with `source: 'correction'`. Only changed fields are written, and nothing is written when nothing changed. The arrows write one rotation step each.
27. The match `result` (sets and set scores) is written whenever the replayed result changes, so the match list and calendar never need to replay.

**Recording UX**

28. Tapping a court tile opens an inline action panel with the **expected next fundamental pre-selected**, so the common case is player → grade (2 taps). The panel closes after the grade.
29. The expected-skill sequence: serve/receive first; R→E→A→B→D→E; S→B; F→E; R/D/F `/`→B; S `/`→F.
30. Only grades valid for the selected fundamental are shown or accepted: Block has no `!`, Set has no `/`. The grade labels per skill are exactly those in §8.
31. A libero is never offered Serve, Attack or Block, can't be substituted from the panel (no Substitute button, no long-press), and is never predicted for S, A or B.
32. Auto-select (default on, per-device) pre-selects the predicted next player once this device's last write appears in the snapshot. It is off in quick score, between sets, while the text panel is visible and while inserting. A manual tile tap or closing the panel suppresses it until the next write. The selected tile shows an "auto" badge.
33. Long-pressing a court tile for 500 ms opens the substitution dialog. The release does not also select the player.
34. Substitution candidates are bench players who are not liberos, like-for-like role first, then by number. One tap substitutes.
35. Point us / Point them record **immediately in one tap**. The optional reason chips then show for 5 s. Us: Opp. error, Other. Them: Opp. kill, Opp. ace, Opp. block, Other. A chip amends the same event. Recording anything else hides the chips.
36. The dock order is fixed and mirrored: T/O us · Point us · Point them · T/O them. Each timeout shows the number left. It stays visible on every phone tab while a set is in play, and is absent between sets.
37. Undo lives in the header, not the dock. Undo is never disabled, works between sets, and removes **this device's most recent write** (even an insert in the middle of the timeline), falling back to the last event by order. A multi-event batch (shared `chunkId`) needs confirmation ("Undo whole text batch (N events)?"). A single event is removed without confirmation.
38. Undo between sets removes the `setEnd`, which reopens the set. "Undo set end" in the between-sets banner does the same explicitly.
39. Between sets and before set 1, nothing can be recorded: court tiles and the bench are disabled, there is no dock, the score and rotation corrections are disabled, and hotkeys record nothing. "Start the set to record actions." is shown.
40. The set-1 lineup dialog opens automatically **once**. Closing it ("Back") leaves the scout screen usable, with a "Start set 1" button in the banner. Later sets never auto-open the dialog.
41. The set start dialog defaults the lineup to the previous set's starting lineup and the first serve to the opposite side of the previous set's first serve. A role picked via a slot is written as that set's role and, if it changed, saved to the match roster snapshot.
42. Set start "By role" always produces a valid 5-1 (opposites 3 zones apart, setter in the chosen zone). "Manual" warns about non-5-1 lineups but never blocks. Duplicates or empty slots block Start.
43. Ending a set (or no set yet) closes any open action panel, sub dialog, correction dialog and reason prompt.
44. The timeline lists events newest first, with the score after each rally, source icons (text, import), and inline warnings. Every row offers Insert after and Delete; action rows also offer Edit.
45. Deleting a set start or set end from the timeline asks first ("This changes the score and lineup for the rest of the set."). Other events are deleted at once.
46. "Insert after" sets an anchor: a banner reads "Inserting into the timeline · Back to live", and on a phone the app switches to the Court tab. Taps then insert after the anchor. A rally-ending insert, or deleting or undoing the anchor event, clears it.
47. Quick score (default off, per-device) hides the court, bench and panel, enlarges the dock, and still records points, timeouts, undo and corrections.
48. The live stats show set or match scope (default This set), alerts for 3 or more errors this set and an opponent run of 3 or more ("timeout?"), red thresholds (reception + below 40 %, attack efficiency below 0, 3 or more errors), and expandable per-player rows. The court tiles carry matching red (3 or more errors this set) and green (points − errors ≥ 3) dots.
49. The court orientation is seen from our baseline: front row P4 P3 P2 at the net, back row P5 P6 P1. The P1 tile carries the serve marker only while we serve.

**Keyboard**

50. Every hotkey in the §20 table behaves exactly as listed. That covers jersey entry (instant on unique, 700 ms or Enter otherwise), skill letters, grade characters by produced character (AltGr allowed, Ctrl/Cmd not), P / O, 1–4 reasons, T / Shift+T, Shift+S, Esc, Ctrl/Cmd+Z, Backspace, Shift+A and ?.
51. No hotkey fires while typing in a field or while a modal dialog is open. The cheat sheet only reacts to ? and Esc. The non-modal set-point prompt does not block keys.
52. Keyboard commands call the same handlers as the buttons, with identical results.

**Text scouting**

53. The text panel exists only when the club has AI enabled (no phone tab, no desktop menu item otherwise).
54. Player names are replaced with jersey numbers **before** anything is sent. Only numbers, per-set roles, libero flags and the anchor situation go to the provider.
55. The draft is autosaved per match on this device and is never lost on error, timeout, cancel or offline.
56. Process is disabled offline, with no provider, outside a set, while running, or with empty text. Runs are cancellable and time out at 90 s.
57. Merge is blocked while any blocking issue exists (unknown number, missing grade, invalid grade). Merged events share one `chunkId` and `source: 'text'`, and are ordered after the anchor.
58. The text panel's state (preview, running process) survives closing it and switching tabs.

**DataVolley import**

59. The file never leaves the device. Only mapped app data is written. Players' names from the file are shown only on the review screen.
60. Files over 2 MB are refused before reading. Parse errors appear inline, and the picker resets so the same file can be re-picked.
61. Import is blocked while a starter is unmapped, two file players map to one app player, there are more than 2 liberos, there are more than 1,900 events, or the match setup is invalid. Differing set scores require the "I checked the scores" confirmation.
62. A duplicate file (same SHA-256 in the team) is warned about with a link to the existing match, but not blocked.
63. Retry after a failure is idempotent (same ids, resumes from the next batch). Closing or Discard after a failure deletes the partial match.
64. A successful import shows "Match imported." and opens the finished match.

---

## Interaction-speed requirements

| Action | Taps / keys today | Notes |
|---|---|---|
| Graded action, prediction right (auto-select on) | **1 tap** (grade) / **1 key** | The panel opens by itself once the previous write hits the local snapshot (no network wait). |
| Graded action, other player | **2 taps** (tile → grade) / jersey digits + grade key | The expected chip is pre-selected. |
| Graded action, non-default fundamental | 3 taps (tile → chip → grade) / digits + letter + grade | |
| Point without stat | **1 tap** / `P` or `O` | The reason is optional: +1 tap or digit within 5 s. |
| Timeout | 1 tap / `T`, `Shift+T` | |
| Substitution | Long-press 500 ms + 1 tap; or tile → Substitute → candidate (3 taps); or tile + `Shift+S` + tap | |
| Undo | 1 tap / `Ctrl+Z` or `Backspace` | A confirm only for multi-event batches. |
| End set | 1 tap (Confirm set) | The prompt appears automatically at set point. |
| Start next set | 2 taps (Start set N → Start set) when the defaults are right | |
| Score / serving / rotation fix | Rotation: 1 tap per step. Score: tap score → edit → Save (3+). | |

- **Must not block input.**
  - No scouting write is awaited.
  - No spinner sits between taps.
  - Replay runs in a `useMemo` on every snapshot. The event list is capped at 2,000 and scouted matches are well under that.
  - The reason prompt is non-blocking and auto-dismisses.
  - The set-point prompt is non-modal, so keys still work.
  - Warnings never interrupt.
- **Hotkey coverage.** Every recording action has a key. There is no key for: corrections (score, rotation arrows), Confirm set / Not yet, Start set, Undo set end, Finish, quick score, the text panel, the Live/Timeline tabs, timeline actions, or Exit. Those are pointer-only.
- **Latency-sensitive paths.**
  - The auto-select trigger depends on the local snapshot containing this device's write. It must stay local-first.
  - Jersey entry selects instantly on an unambiguous number; ambiguous prefixes wait 700 ms.
  - The reason-chip window is 5 s.
  - Long-press is 500 ms.
- **Layout constraints that serve speed.**
  - The header and dock are fixed (`100dvh` frame); only the middle scrolls.
  - The dock pads for the bottom safe area.
  - Touch targets are 44 px or more (`min-h-11`, `h-11`) throughout. Grade buttons are 56 px tall (`min-h-14`) and tiles 80 px (`min-h-20`).
  - The bench hides while grading to make room.

---

## Current UX pain points / redesign opportunities

*Observations from the code, not requirements.*

1. **The write-error banner never clears.** Once any write fails, "An action could not be saved…" stays until reload, even after the queue drains.
2. **Errors set after navigation are invisible.** "Start scouting" and "Create match" navigate away immediately. A later rejection sets an error on an unmounted page or tab, so the user never sees it.
3. **Undo has no visible feedback.** There is no toast or "Undid: #7 Attack #", so it is easy to undo the wrong thing. Undo also removes the last event by *this device* rather than the visible last one, which can surprise when two devices write. And Undo can silently cross a set boundary (removing a `setEnd`).
4. **Undo on a reopened imported match** finds the import's shared `chunkId` and offers to delete the *whole import* (possibly hundreds of events) under the wording "Undo whole text batch". The wording is wrong for imports, and the action is very destructive behind one confirm.
5. **Timeline delete has no undo and no confirm** for normal events. A mis-tap on the trash icon loses an action.
6. **The timeline is a flat list,** not grouped by set or rally (the scouting spec §4.6 asked for grouping). It has three 44 px icon buttons on every row, which is dense on a phone and makes it hard to find a rally.
7. **Insert mode shows the wrong context.** While inserting, the court, score and auto-select reflect the timeline's end, not the insert point. Only a thin banner signals the mode.
8. **The device lock is checked only on open.** A taken-over device keeps scouting with no warning. Both devices then write, and each keeps heartbeating.
9. **Inconsistent feedback channels.** Some errors are inline alerts, some full-page, some in a banner. Success is mostly silent; only the import uses `useNotify`.
10. **The match-over banner lacks "Undo set end".** The between-sets banner has it; after the final set the user must know to use header Undo.
11. **The set-1 first serve defaults to "They serve"** (inferred from code), which is a coin-flip default the user must check every match.
12. **The action panel's role chip shows the roster role, not the per-set role** (the court tile shows the per-set role).
13. **The header is crowded:** score, pill, status line, rotation arrows, Undo, sync and tools are all in one row. The status line truncates on phones (subs and opponent are often cut). The timeouts-left count moved to the dock, away from the score.
14. **Corrections need knowledge:** Rot ◀/▶ semantics (previous = +1) are not obvious. The correction dialog uses raw number inputs and selects.
15. **Quick score and auto-select are buried** in a ⋯ menu. Quick score is a whole mode switch but has no visible indicator other than the missing court.
16. **The set start dialog is form-heavy:** six selects plus a zone select plus radios, with a separate preview. Manual mode is another six selects. A drag or tap-on-court picker would be faster. Its error hint is slate text, not visibly an error.
17. **The Live stats table** packs several numbers per cell ("3 · 1# 0="). It is hard to read at a glance courtside and scrolls horizontally on phones.
18. **The text panel is long:** notes, three tips, a privacy line, then the preview cards, each action with three selects. The preview is form-dense on a phone.
19. **The DataVolley review is one long scroll** (fields, side, roster, checks table, warnings, confirm, blocking list), and the blocking reasons sit at the bottom near the button. A step-by-step or sticky summary would help.
20. **The Matches tab:** a "No matches yet." flash while loading (no skeleton), and the tab is visible to non-admins who can't read matches (inferred).
21. **The Kbd badge for Undo always reads "Ctrl+Z"**, even on macOS, where Cmd+Z works.
22. **No confirmation or summary before Finish match**, and no reminder of unfinished sets. Finish from the live match page is available at any time, even mid-set.

---

## Open questions

1. **Matches tab visibility for non-admin viewers:** the tab is shown to anyone who can open the team page, but the rules deny reads. Is the intended UX "hide the tab" or "show an empty or locked state"? No test covers it.
2. **Set-1 first-serve default:** `nextSetServing([], 'us')` returns `'them'`. Is "They serve" by default for set 1 intended, or an accident of the alternation rule?
3. **Undo on imported matches** (invariant 37 vs pain point 4): should an import's `chunkId` be undoable as a batch at all? The current wording says "text batch".
4. **A dialog closed during an in-progress (not failed) import:** `Dialog dirty` asks to discard, then `handleClose` calls `onClose` without aborting. The import keeps running in the background and may navigate later. Intended?
5. **Device lock after a takeover:** should the original device be told, or blocked, when another device takes over mid-match? The code never re-checks.
6. **The 2,000-event subscription cap** (`MATCH_EVENTS_CAP`): events beyond it would silently drop from replay. Realistic matches are far below it, but the redesign should not lower it.
7. **Finish while offline:** `getUsageProfile` is awaited. With an uncached usage doc offline it fails, and the user sees the usage error. Is offline finishing expected to work?
8. The spec mentions header **timeout dots** and **phone tabs Court / Live / Timeline**. The code moved timeouts to the dock and added a fourth Text tab. Treat the code as current truth (this document) unless the user says otherwise.
