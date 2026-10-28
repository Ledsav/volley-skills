# UI redesign — design

Status: **draft for approval** · Branch `feature/ui-redesign` · 2026-10-28

Companion documents:

- **Parity contract:** [`ui-redesign-inventory/`](ui-redesign-inventory/README.md). Seven documents, about 320
  must-keep invariants, written from the code on `main` at `4137f33`. This design changes the look and the
  interaction model; the inventory says what must keep working.
- **Design system and brand:** [`docs/design/`](../../design/README.md). It holds the v2 rules, the mockups (HTML and
  PNG, light and dark), and the logo kit.
- **Superseded by this document:** `2026-09-04-volley-skills-design-system.md`, which stays the reference until the
  redesign merges, and §7 of that spec on navigation. When the redesign lands, CLAUDE.md's "Design system" section points
  here and is corrected to 9 skills.

Marks used below: **(user)** means the user decided it in the brainstorming session. **(call)** means I decided it and
the user can overrule it while reading. Anything unmarked follows from those two.

---

## 1. Intent

The app works, and coaches rely on it on the court, but it looks and feels like a generic admin panel. The user wants
it to feel like a polished Apple product from the future: calm, precise, fast to the touch, with motion that responds
like a physical object, and the same care in light and dark mode. **(user)**

The redesign covers more than the look. It is also the UX: how screens are laid out, where actions live, how things
open and close, how mistakes are forgiven. **(user)**

**Why it matters.** The people using it are volunteer coaches with a phone in one hand and a match in front of them.
Every extra tap, every "Are you sure?" and every hunt for a button costs attention they don't have. The redesign
should make the app feel trustworthy and effortless enough that coaches want to open it.

## 2. Goals, non-goals, anti-goals

**Goals**

1. A single visual system ("v2") applied to every screen, light and dark equal. **(user)**
2. Apple-grade interaction: one fixed place for the main action, sheets you can drag and flick, undo instead of
   confirmation for everyday actions, context actions on rows, spring motion with press feedback, search everywhere.
   **(user)**
3. **Exact functional parity** with today's app, as recorded in the inventory, except the changes in §4. **(user)**
4. Scouting comes out *at least* as fast and as safe as today. The user named it as the area that must be perfect.
   **(user)**
5. The bugs found while writing the inventory get fixed. **(user)**
6. The outputs coaches share (award cards, story slides, summary, video, training PDF) get the new look too. **(user)**

**Non-goals**

- No new product features beyond those listed in §4: no new data, no new roles, no new pages.
- No change to the data model, except the derived `searchTokens` field in §6.1.
- No change to authorization, except what §4.4 needs; the rules already allow it.
- No native app. It stays a responsive web app.

**Anti-goals** (failures even if everything technically works)

- **Glass everywhere.** Translucency on cards, rows or content makes it look like a theme, not a product. Glass
  appears only on chrome that content scrolls under.
- **Decorative colour.** Colour carries meaning: level bands, grades, state. A blue button or a purple gradient
  dilutes that.
- **Slower scouting.** One more tap, a modal where there was none, or an animation in the recording path is a
  regression, however nice it looks.
- **Motion that makes people wait.** No animation may block input. Anything triggered from the keyboard does not
  animate.
- **A redesign that silently drops behaviour.** If an invariant in the inventory no longer holds and §4 doesn't list
  it, the redesign is wrong.

## 3. Constraints

- **Parity contract.** Every screen keeps its actions, states, permissions and written data, as stated in the
  inventory's "Must-keep invariants". The cross-cutting rules in the inventory README apply to every screen. They
  cover data access, rules, offline behaviour, accessibility contracts, frozen storage keys, SEO, i18n, privacy and
  colour meanings.
- **Tests are the safety net.** Existing tests may change selectors and markup, not assertions. A changed assertion
  is a behaviour change and must trace to §4. New behaviour gets new tests.
- **Stack stays.** React 18, TypeScript strict, Vite, Tailwind with CSS-variable tokens and no `dark:` variants,
  `lucide-react` icons, self-hosted Inter, React Router v7.
- **Dependencies.** Gestures use `@use-gesture/react`, which is already installed. Springs are a small in-house
  module (design system §6) **(call)**: no motion library, so bundle size stays flat and reduced motion is handled in one place.
  Any new dependency needs a reason written in its plan.
- **Free tier.** The app stays on the Spark plan with no Cloud Functions. Fetching discipline holds: bounded reads,
  limit plus cursor, and an index for every query.
- **i18n.** All five languages (en, it, fr, de, es) get every new string. Italian must not break layouts, so design
  for 30% longer labels.
- **Accessibility.** WCAG 2.2 AA contrast for text, 44 px touch targets, visible focus, full keyboard use on desktop,
  and screen-reader labels unchanged where tests rely on them.

## 4. Agreed behaviour changes

These are the only places where behaviour may differ from the inventory. When the redesign lands, each one is copied
into the inventory README under "Agreed changes".

### 4.1 Cross-app improvements (user)

The seven improvements are specified in §6: search, undo, phone sheets, context actions, one place for the main
action, physical motion, and respecting system settings.

### 4.2 Bug fixes (user: "fix the bugs")

| # | Bug today | Fixed behaviour | Area |
|---|---|---|---|
| B1 | Home "Next 7 days" session rows open the team's Roster tab. | A session row opens the team Calendar tab on that session's month, with the session's view sheet open (`?tab=calendar&session=<id>`). A match row keeps opening the match page. | 02 |
| B2 | The diagram editor asks "Leave without saving?" but saves on unmount anyway, so the copy is false. | The editor **autosaves**, like an Apple document. Leaving never asks. The pending save is flushed on leave and on `pagehide`. `beforeunload` warns only while a save is **failing**. In that case the toolbar shows "Not saved — Retry", and in-app navigation asks "Leave and lose the last changes?". **(call)**: this matches the code's real behaviour and drops the false prompt. | 06 |
| B3 | Undo history is cleared by every autosave. | Undo/redo history survives autosave, kept per diagram in memory for the editor session and capped at today's depth. | 06 |
| B4 | Scouting's write-error banner never clears until reload. | The banner clears when a **later** event write for this match is acknowledged by the server. "Acknowledged" means its `addEvent` promise resolved, which the code doesn't await but can observe. The banner also clears when the coach dismisses it. If writes keep being rejected (for example, a revoked permission), it stays up, because no later write succeeds. The wording stays. **(call)** "No pending writes" would clear it within milliseconds of a rejection, so that signal isn't used. | 04 |
| B5 | A device that has been taken over is never told, and its heartbeat keeps reclaiming the lock. | The scouting page adds an `onSnapshot` on the match doc. When another device claims the lock, this device **stops its heartbeat**, disables recording and shows a sheet: "Scouting moved to another device". The sheet has **Take back** (claims again, same as today's take over) and **Leave** (goes to the match page). Events already written are unaffected. Cost: one extra listener, plus one read per heartbeat write (one every 60 s) while scouting. | 04 |
| B6 | Set 1 defaults to "They serve" by accident of the alternation rule. | Set 1 has **no default**. The serve control shows two unselected options, and "Confirm set" stays disabled until one is chosen. Sets 2 and later keep the alternation default, and it can still be changed. **(call)**: forcing one deliberate tap on the fact that drives rotation is safer than either default. | 04 |
| B7 | Undo on a reopened imported match offers to delete the whole import, worded as a "text batch". | Undo keeps today's order: it pops this page's write stack first, then falls back to the last event by order. The only change is that events with `source: 'import'` are **skipped** in both steps; the fallback walks back to the last non-import event. If the match holds only imported events, Undo is disabled with the hint "Imported events can't be undone". Text batches keep their confirm, with wording that names the source ("Undo text batch (N events)?"). | 04 |
| B8 | Several dates use the UTC calendar day, so they can be off by one around midnight: Start session default (`StartSessionCard.tsx:12`), consent date and other player writes (`playersApi.ts:104,232`), and `leftClubAt` plus the retention cutoff (`players/retention.ts:28` `todayIso`, which is UTC). | All "today" dates use the device's **local** calendar date through one shared helper (`todayLocalIso()`). It replaces the three `todayIso` copies: `home/homeFeed.ts:14` and `calendar/monthGrid.ts:32` are already local, `players/retention.ts:28` is UTC. | 02, 03 |
| B9 | People & access shows only the first 50 teams in the team checklist. | The checklist pages through all teams with **Load more**, the same pattern as the other lists, and its filter covers loaded teams. | 07 |
| B10 | Leads panel: a dead "Grant access" path, and delete copy that refers to it. | The dead path is removed and the delete copy fixed. Delete becomes an undo (§6.2). | 07 |
| B11 | Guide editors save without any feedback. | The success notice is shown, and the Discard-changes guard added on dirty close, matching every other editor. | 07 |
| B12 | The player-card history overlay is not a standard dialog: no Escape, no focus trap, no phone sheet. | It becomes a standard sheet (§6.3): Escape closes it, focus is trapped and returned, and it is a bottom sheet on phones. | 03 |
| B13 | Player-card saves other than physical tests await the server, so offline they hang forever. | Offline, every player-card save behaves like physical tests do today: it closes as soon as the write is queued, shows "Saved on this device · will sync", and the row shows a pending dot until it syncs. Online, saves still await so rule errors stay inline. **(call)** | 03 |

### 4.3 Shared outputs get the new look (user: "redesign them")

This covers award cards, story slides, summary image, story video and the training PDF. Content, slide logic,
privacy gates, sizes and export formats stay exactly as the inventory states; only the visual treatment changes.
Specified in §9. The pixel-level tests (`drawAwardCard.test.ts`, `drawSlide.test.ts`, PDF tests) are updated where
they assert colours or positions, and that is allowed by this entry.

### 4.4 Club admins see every team in their club (user: "they should see them")

Rules already let a club admin read every team (`isClubAdmin()` on `teams/{id}` read). Only the listing changes:

- `/teams`, Home and search list **all club teams** for a club admin. They use a new `listClubTeams()` in
  `teamsApi.ts`: the same query as `listMyTeams` without the `where` clause (20 per page, `createdAt desc`, full
  `Team`). It does **not** use `accessApi.listAllTeams()`, which pages by 50, orders by name and returns only
  `{id, name}`. Members keep today's `adminEmails` query.
- On `/teams`, a club admin gets a segmented filter: **Mine · All**. It defaults to **All** and remembers the last
  choice in `vcb.teamsFilter`. "Mine" uses today's query.
- Home for a club admin covers the same first page of teams it does today: 20 teams, with "All teams →". This keeps
  Home's read cost bounded.
- No rules change. A **new** rules test pins it: a club admin can list teams without a `where` clause, and a
  member cannot. Today's tests only cover a single read (`tests/rules/teams.rules.test.ts:78`).

### 4.5 Never-built spec features are added (user: "add them")

From `2026-10-14-…-home-stats-awards-design.md` §3.1:

1. **Shortcuts on Home.** These are actions only, so the one-place navigation rule holds; see the memory note on
   navigation. Shown only for sections the person can access:
   - **New match**, with a team picker sheet when they have more than one team.
   - **New training**, which opens the training builder.
   - **New exercise**.

   **(call)** The spec listed "Exercises" and "Trainings" as page links, which would duplicate the sidebar. Turning
   them into *create* actions keeps each page in exactly one place.
2. **"Plan a training" on the empty Next 7 days block**, for team admins. It opens a team picker if there is more
   than one team, then that team's Calendar tab with the add-session sheet open.
3. **Player count and average level on Your teams cards.** Each card makes one aggregation query:
   `getAggregateFromServer(players, { count: count(), avg: average('avgScore') })`. That costs one read per team,
   with no new index or rules change, because the `players` list rule already allows the team admin and club admin.
   The average is shown as a `LevelPill`, and "—" when no player has a score. **(call)** The count is every player
   doc on the team, former players included, as the roster lists them. Players without a `number` are counted too,
   even though `listPlayers`' `orderBy('number')` leaves them out. That is acceptable for a summary figure.

### 4.6 Settled minor questions (call)

The inventory's minor open questions are settled as follows. All of these are parity, except where noted.

- The theme key stays `theme`.
- Signed-out unknown URLs keep redirecting to login.
- `ConfirmDialog` keeps its inert backdrop.
- Notices stay "latest wins", except that an undo notice is never replaced by a plain one while its window is open.
  The undo notice queues.
- Roster sort, search and stats keep working on loaded pages.
- The hidden "number" roster sort stays hidden.
- Session notes stay unpersisted.
- The viewer-only variants nobody can reach are restyled for parity, but get no new entry points.
- Match stats stay team-admin only.
- The identity-card level chip becomes band-coloured. This is visual only.
- There is no physical-test editing and no per-skill notes UI.
- Rotation definitions stay as two views, labelled differently.
- Hidden awards keep their PNG export.
- The "Record video" unsupported item becomes a real disabled menu item with its hint.
- The match page load error gains Retry.
- CSV headers keep following the UI language.
- Exercise rows keep opening edit.
- Diagram titles stay as stored data.
- The training builder's button-only edits (reorder, remove and similar) now mark it dirty, so the discard guard
  covers them. This is a behaviour change.
- **Cancel asks "Discard changes?" when the form is dirty**, in every sheet. This is a behaviour change. Today only
  ✕, Escape and the backdrop ask, and an explicit Cancel discards silently (`Dialog.tsx:28-29`, invariant 32 in
  inventory 03). On phones the header Cancel replaces ✕, so leaving it unguarded would make losing work easier
  than today. Clean forms still close at once.
- `/admin/guides` gets `?tab=` deep links.
- The platform shell gets "Back to app" for operators who are also members.
- Make admin and demote stay instant, and gain an undo notice instead.
- Guide thresholds 4/7/9 versus level bands 4/6/8 stay as they are; they are different things.

## 5. Visual system "v2"

The visual system now lives in its own durable document:
**[`docs/design/design-system/README.md`](../../design/design-system/README.md)**. It covers principles, colour tokens
and data colours, type, space and shape, materials, motion, layout and navigation, patterns and accessibility. The
mockups are in `docs/design/design-system/mockups/`, and the logo is in
[`docs/design/brand/`](../../design/brand/README.md). The redesign builds exactly that system. This section keeps
only what is specific to the project.

- **Theme "System" option** (behaviour change, **(call)** on storage). Today the theme is only `'light' | 'dark'`
  (`theme/theme.ts:1`) and every toggle is persisted.
  - System means the `theme` key is absent, and choosing System removes it.
  - `public/theme-init.js` and `applyTheme` then follow `prefers-color-scheme` live.
  - Existing stored `light` or `dark` values are kept as explicit choices, with no migration.
  - The key name stays frozen.
- **Token migration.** The old tokens (`navy`, `slate`, `border`, `blue` as accent) are retired screen by screen as
  screens are rebuilt, and deleted in the cleanup increment.
- **Motion module** `src/motion/` **(call)**: an in-house spring plus reduced-motion handling, with no motion
  library. Gestures use the existing `@use-gesture/react`.
- **New logo (user, 2026-10-28):** the one-colour Spin mark and Inter wordmark replace the colour Spin Ball
  everywhere. That covers the sign-in screens, favicon and app icons, the OG image and shared outputs. Files and
  rules are in `docs/design/brand/`, and the switch-over steps are in its §8.

## 6. The seven cross-app improvements

### 6.1 Search everything (⌘K / Ctrl+K)

**Entry points.**

| Device | How search opens |
|---|---|
| Desktop | ⌘K / Ctrl+K anywhere except live scouting, the diagram editor, awards present mode and while a text field has focus with an unsaved form. There is also a search field in the toolbar showing a "⌘K" hint. |
| Phone | A magnifier in the toolbar's right cluster, left of the main action. It opens a full-height sheet with the field focused. |

**What it finds.** Results come grouped in this order, at most 5 per group, with "Show all N" expanding the group.

| Group | Source | Matching | Cost |
|---|---|---|---|
| Go to | The pages in `navModel.ts` the person can access, plus Settings | Local | none |
| Actions | Create actions the person can do: New team, New training, New exercise, New match… (team picker), Add player… (team picker) | Local | none |
| Teams | Teams the person can see: the first page of `listMyTeams` or `listClubTeams`, loaded on first open (the shell loads no teams today) | Local, on name and age group | 1 query |
| Players | Rosters of those teams, loaded **once per session on the first typed character**, using the same full-roster read the Physical tab uses | Local, on name and `#number` | one roster read per team, capped at the first 20 teams |
| Matches | Each of those teams' latest 20 matches (the Matches tab's first page), loaded with players | Local, on opponent and date | one query per team, capped at 20 |
| Exercises | Firestore query `where('searchTokens','array-contains', token) orderBy('name') limit(6)` | Server, word-prefix | one query, 300 ms debounce |
| Trainings | Same pattern on trainings, also matching `businessId` | Server, word-prefix | one query |

**Matching rules.** Matching ignores case and accents, using Unicode NFD with marks stripped. A result matches if
every typed word is a prefix of some word in the item. Results are ranked:

1. exact match;
2. prefix of the first word;
3. other word prefix;
4. then most recently opened.

**Server groups and multi-word queries.** Firestore allows one `array-contains` per query, so the server gets the
**longest** typed word as its token, which is the most selective. The other words are filtered on the client.

- The query fetches `limit(20)` and shows the first 5 matches.
- "Show more" loads the next 20 with a `startAfter` cursor. Server groups show no total and run no count query.

**`searchTokens`** is a derived field. It holds every prefix of 2–12 characters of each normalised word in the name,
plus the `businessId` for trainings, and is capped at 120 entries.

- The derivation is one pure JavaScript module that both the app and the Node scripts can import (for example
  `src/search/searchTokens.js` with a `.d.ts`, or under `scripts/lib/`).
- It is written on create and update by `exercisesApi` and `trainingsApi`.
- It is also written by every script that writes exercises or trainings. All of these are in scope:
  - `.claude/skills/plan-team-training/scripts/apply.mjs`;
  - `scripts/seed/seedLibrary.mjs`;
  - `scripts/docs/seedShowcase.mjs`.

- Existing documents get it from an idempotent Admin SDK backfill script in `scripts/migrate/`, built as a pure
  planner plus an I/O core like the other migrations, and run before deploy.
- Until then, unbackfilled documents simply don't appear in search.
- Two new composite indexes: `searchTokens` array-contains plus `name` asc, on exercises and on trainings.
- Exercise and training rules have no key whitelist, so no rules change is needed. **(call)** The builder confirms
  this when writing the plan.

**Access.** Results come only from data the person can already read. Section-gated groups are hidden when the
section is off for them, and AI-only actions are hidden when the club has AI disabled.

**Recents.** The last 8 opened results are kept in `sessionStorage` (`vcb.searchRecents`), never in localStorage:
names of minors don't persist on shared club computers. They are cleared on sign-out and shown when the field is
empty. **(call)**

**Keyboard.**

| Key | Action |
|---|---|
| ↑ ↓ | move |
| Enter | open |
| ⌘Enter | open in a new tab, where it is a URL |
| Esc | clear the field, then close |
| Tab | moves between groups |

The list is a `combobox` plus `listbox` with `aria-activedescendant`, and announces "N results".

**States.** Empty query shows recents and Go to. Loading shows a skeleton row per server group (never a spinner over
everything). No results shows "No results for 'x'" plus the Actions group. Offline shows local groups only, with the
note "Exercises and trainings need a connection".

### 6.2 Undo instead of "Are you sure?"

**Mechanism.** The deletion is deferred, so nothing is ever re-created:

1. The item leaves the list at once, with the delete animation.
2. An undo notice appears: "Training T-0042 deleted · **Undo**". It lasts 6 s and is extended while hovered or
   focused.
3. The Firestore delete runs when the notice expires, or immediately when:
   - another undoable action replaces it;
   - the person navigates away (route change);
   - the page is hidden (`visibilitychange` to hidden, or `pagehide`). Phones often skip `pagehide` when the
     person switches apps, so a hidden page is the reliable signal; switching tabs therefore ends the undo window.

   If the page is killed before then, the item simply survives, which is the safe failure.
4. **Undo** restores the row and cancels the write.
5. If the delete then fails, the row comes back with the inline error the screen shows today.
6. The undo notice is a `role="status"` live region. Its Undo button is reachable by keyboard: ⌘Z / Ctrl+Z while the
   notice is up also triggers it, except inside text fields, scouting and the diagram editor, which have their own
   undo.

| Confirmation today | Becomes |
|---|---|
| Remove a calendar session (`TeamCalendarTab`) | **Undo** |
| Delete an exercise (`ExercisesPage`), including its diagrams | **Undo** |
| Delete a training (`TrainingsPage`) | **Undo** |
| Delete a physical-test entry (`PhysicalTestHistoryList`) | **Undo** |
| Delete a lead (`AccessRequestsPanel`) | **Undo** |
| Make admin / demote another admin (instant today) | Instant plus **Undo** (the undo writes the previous role back) |
| Diagram editor "Leave without saving?" | **Removed** (autosave, B2) |
| Delete match (`MatchPage`) | Stays a confirmation. It holds scouted history. |
| Delete / undo-close a testing session (`LiveSessionView`, `PastSessionDialog`) | Stays. It touches many players' records. |
| Remove player (roster), player GDPR delete, retention delete | Stay. They are irreversible and erase personal data. |
| Delete team; remove member; demote self; transfer owner; contract actions; legal acceptance | Stay. |
| Scouting: delete set start/end, undo text batch | Stay. Scouting's flow is unchanged; see §8.4. |
| Sign out with unsynced writes; awards share warning; Discard changes? | Stay. They are warnings, not "are you sure". |

Confirmations that stay are restyled as Apple alerts:

- a centred small sheet on desktop and an action sheet from the bottom on phones;
- the destructive button is red text, and the safe choice is the bold default;
- Cancel keeps initial focus, as today.

### 6.3 Sheets

One `Sheet` primitive replaces `Dialog` for every dialog, keeping the props and accessibility contract the inventory
lists: focus trap and return, topmost-layer Escape, dirty guard, and `aria-labelledby`.

- **Desktop (≥ 768 px):** a centred sheet (max 560 px wide, or 720 for builders), scaled .96→1 plus fade, with a
  scrim. Dragging is off; Escape and the close button close it.
- **Phone:** a bottom sheet with detents.
  - Small forms (fit within 60% of the viewport) open at their **content height** and can be dragged to **large**.
  - Long forms and editors open at **large** (the top inset leaves the parent's toolbar visible, dimmed and scaled).
  - The grabber, the header strip or any non-scrolling area drags it. Inner scroll content hands the drag to the
    sheet only when scrolled to the top.
  - A flick down (velocity > 0.5 px/ms) or a drag past 30% closes it.
  - **A dirty sheet doesn't close on a flick**: it rubber-bands back and the Discard changes? alert appears. This is
    today's dirty-guard behaviour moved to the gesture.
- **Header:** Cancel on the leading side, the title centred, and the confirm action (Save, Add, Done) on the trailing
  side in `headline` weight, disabled until valid.
  - **(call)** This is the Apple pattern, and it moves Save from the footer to the header for every form.
  - On desktop the same actions sit in a footer bar instead, right-aligned. Desktop sheets are wider and people
    expect footer buttons there.
- **Stacking:** a sheet opened from a sheet pushes the parent back (scale .94, dimmed) and stacks. Escape closes only
  the top one, as today.

### 6.4 Context actions and swipe

**Rule:** context menus and swipes only *expose* actions the row already has elsewhere (its kebab menu, buttons on
the row, or actions in its detail sheet). They never add new ones. The kebab button stays for discoverability and
keyboard users.

| List | Context menu (right-click / long-press 500 ms) | Phone swipe (trailing) |
|---|---|---|
| Teams list | Open, Open in new tab | — |
| Roster | Open card, Set/Unset starting, Remove… | Starting toggle (leading), Remove… (trailing, opens the confirm) |
| Calendar sessions | Open, Edit, Remove | Remove (undo) |
| Matches | Open, Scout, Report, Delete… | — |
| Trainings | Open, Edit, Duplicate (only if the menu has it today), Export PDF, Delete | Delete (undo) |
| Exercises | Edit, Edit diagram, Delete | Delete (undo) |
| Physical-test history | Delete | Delete (undo) |
| People & access | the member's existing actions | — |
| Leads | the lead's existing actions | Delete (undo) |

Details:

- The long-press menu shows a lifted preview of the row.
- A full swipe commits only undoable actions; "…" actions open their confirmation instead.
- **Scouting keeps its own 500 ms long-press (substitution)**, and no context menu exists inside live scouting.
- In the diagram editor, right-click keeps today's menu, restyled.

### 6.5 One place for the main action

Each screen has at most one main action. It sits **top-right in the toolbar** as a filled ink pill on desktop, or a
"+" or labelled button on a phone. It moves there from wherever the screen has it today. Secondary actions go in a
"⋯" menu next to it. The table records the mapping; the builder keeps the existing permission checks for each.

| Screen | Main action | "⋯" menu |
|---|---|---|
| Today (Home) | — (shortcuts live in the page) | — |
| Teams | New team (club admin) | Import teams |
| Team · Roster | Add player | Import players |
| Team · Calendar | New session | — |
| Team · Matches | New match | Import DataVolley file, Season awards |
| Team · Stats | Export CSV | — |
| Team · Plan / Physical | Edit plan / New testing session | per tab, existing |
| Player card | Edit (opens the section picker), or none for viewers | Delete player… |
| Match page (setup) | Start scouting | Delete match… |
| Match page (finished) | Awards | Reopen, Export, Delete… |
| Trainings | New training | Import JSON, AI draft (if AI on) |
| Exercises | New exercise | Import JSON, AI draft (if AI on) |
| Skill guides | Save (while dirty) | — |
| Club area | per tab: Add member / Export ZIP / — | — |
| Platform | — | — |

### 6.6 Physical motion

Specified in the design system §6: every pressable gets pointer-down feedback, and every surface that moves can be grabbed and
redirected mid-motion.

### 6.7 Respecting system settings

The behaviours are specified in the design system §2.3, §5 and §6. On top of those:

- `color-scheme` follows the theme.
- The theme switch eases the canvas colour over 200 ms, with no flash. Reduced motion makes it instant.
- Forced-colors mode keeps outlines and focus.

## 7. Layout and navigation

Defined in the design system §7. The navigation *model* is unchanged: `src/layout/navModel.ts` stays the single
list. Project-specific points:

- **Home is renamed "Today"** in the nav and the title. **(call, from the mockups the user approved)**
- The sidebar header keeps the **club switcher** (club initials tile, name, role, memberships menu, `switchClub`).
- The team page's `?tab=` URL contract and per-tab visibility stay exactly as the inventory states.

## 8. Screens

The inventory is the checklist for every screen. This section says what each area *looks and feels like*. It lists
only design decisions, not behaviour, which stays parity.

### 8.1 Shell, sign-in, gate, legal, settings (inventory 01)

- **Sign-in, request access, sign-up, finish sign-in** (new `AuthShell`; mockup approved by the user):
  - **Desktop (≥ 1100 px):** two panes.
    - The left "stage" is on `bg`: the brand, a hairline volleyball court in perspective (zones 1–6, the net in
      ink, a dashed serve trajectory from zone 1), a faint radial glow, and the tagline in display type
      ("Players. Progress." in ink, "Together." in `ink-3`) with the pitch sentence.
    - The right pane is solid `surface`, `#0D0D0F` in dark mode. It holds the language switch and a "Request
      access" pill at top-right, then a centred 340 px form, then the legal links at the bottom.
  - **Phone:** one column.
    - A top row with the brand and "Request access".
    - A cropped court strip fading into `bg`.
    - The large title, the form and the links, with the legal links at the bottom.
  - **Content and behaviour are unchanged.** That covers the email field, "Send sign-in link", "or", "Continue
    with Google", "Request early access", "Create your club", the legal links and the conditional language
    toggle.
  - The court replaces the fixed blue background and the player image, and follows the theme. It is decorative
    (`aria-hidden`).
  - Email-link states (sent, check your email, expired, signing in) and the status screens use one status layout:
    an icon tile, the title, the body, and an action where one exists today.
  - "Check your email" adds the hint "Open it on this device". It is copy only; it explains today's same-browser
    requirement.
- **ClubGate screens** (pending, locked, ended, welcome) share that status layout.
- **Legal review and legal pages:** a readable 720 px column with `body` 16/26 for long text. Clause headings keep
  their ids. Specific-approval clauses sit in a grouped box, each with its checkbox. The texts are rendered exactly
  as today, because they are hashed.
- **Settings:** grouped lists in Apple Settings style: rows with a label, a value or control on the right, and a
  chevron for subpages. Theme is a segmented control (System · Light · Dark), language a row that opens a picker
  sheet, and AI settings a subpage.
- **404 and no-access:** the status layout, rendering the same for "not found" and "no access", as today.

### 8.2 Today, teams, calendar, physical (inventory 02)

- **Today:**
  - large title "Today" with the date as an overline;
  - a **live** card at the top when a match is live (green live dot, score, "Resume");
  - **Next 7 days** as a grouped list (B1);
  - **Recent results** as compact rows with a W/L chip and the sets score;
  - **Your teams** as cards with count and level (§4.5);
  - **Shortcuts** as three tiles (§4.5).

  On desktop it is two columns, with Next and Recent side by side. Phone stacks.
- **Teams:**
  - card grid on desktop (name, age group, count, level pill);
  - grouped list on phones;
  - Mine · All filter for club admins (§4.4).
- **Team · Roster:**
  - Desktop table: a borderless table with sticky header, hairline rows, sort by column header, and the search field
    in the toolbar's secondary row.
  - Phone: grouped list rows (avatar initials, name, position, number, level pill), with swipe and context actions.
  - Stats row above it as stat tiles.
- **Team · Calendar:**
  - month grid on desktop with session pills (title plus time);
  - on phone, a week strip plus an agenda list;
  - a session opens its view sheet;
  - the date range query is unchanged.
- **Physical tab and testing sessions:** a grouped layout per quality. The live testing session view is a focused
  full-height sheet with large numeric inputs (`stat` size) and keeps the attempts input behaviour.

### 8.3 Player card (inventory 03)

The player card is **visual only**: inventory 03 wins on every behaviour.

- **Header:** large initials avatar, name in `title-1`, number, position, band-coloured level pill (§4.6), and the team
  as a footnote.
- **KPI tiles:** the same four tiles as today (Skills rated, Focus areas, Open objectives, Last physical test;
  invariant 20), restyled as stat tiles.
- **Sections:** keep today's tab semantics (`role="tab"`, "Player sections") and every section, Privacy included.
  They stay mounted, as the KPI tile depends on it. The tabs become a segmented control on desktop and a
  horizontally scrolling one on phones.
- **Skills:** 9 rows and the radar chart, both restyled. The meter keeps exactly 10 segments, the band-boundary
  marks and the ghost segments for the Adapt suggestion (invariant 6). Filled segments take the band colour of the
  score, numbers use tabular figures, and the guide text opens on tap (popover on desktop, sheet on phones).
- **Edit** opens the existing edit sheets (B13 for offline). Delete stays in "⋯" with its confirmation.
- **History** opens a standard sheet (B12).

### 8.4 Scouting (inventory 04): highest care

Scouting is redesigned for **speed, certainty and calm**. The inventory's 64 invariants, the hotkey table and the
interaction-speed table are the acceptance test. In addition:

- **Always dark.** The scouting route puts the `.dark` class (the same class `theme.ts` sets on `<html>`) on its own
  root element, so the dark tokens apply to that subtree whatever the app theme. It also sets `color-scheme: dark`
  there. Nothing else changes theme.
- **Layout keeps today's semantic grouping** (user memory: group by meaning):
  - the **header** holds state and corrections: score in `score` size, set, rotation, Undo;
  - the **bottom dock** holds match events only: Point us / Point them, with T/O under its side, mirrored;
  - **"⋯"** holds tools: Quick, Auto, Text, Keyboard, Exit.

  Nothing moves between those groups.
- **Recording path:**
  - 1–2 taps, unchanged.
  - Targets are at least 56 px on phones, and court tiles fill the space available.
  - Press feedback is an instant flash, with no scale on tiles: a scale animation on a tile you tap 300 times a
    match is noise.
  - No toast for normal records.
  - Writes stay un-awaited.
- **Grade chips** use the grade colours on black: fill tint plus the text colour, with the symbol large and the label
  small. `!` is neutral.
- **Court tiles** lead with the player's name, as on `main` today, then the number. The server or setter gets a
  subtle `surface-3` ring, not a colour.
- **Banners** (write error, inserting, between sets, match over) become a single slim status strip under the header,
  showing one at a time by priority: error > match over > between sets > inserting. Each keeps its buttons. The
  error strip now clears (B4).
- **Set start:** the lineup sheet opens automatically once, as today. The serve choice is required on set 1 (B6).
- **Takeover:** a non-dismissable sheet when another device claims the lock (B5).
- **Undo:** in the header, never disabled except in the B7 case. A single event undoes without a confirmation, a text
  batch confirms, and imports are not undone (B7).
- **Phone tabs** (Court / Live / Timeline / Text) become a segmented control at the top of the content, keeping the
  Text tab only when AI is on.
- **Long-press substitution** stays at 500 ms, with a haptic `navigator.vibrate(10)` where supported **(call)**.
  Nothing else vibrates.
- **Keyboard:** the hotkey set is unchanged, and the `?` cheat sheet is restyled. Kbd badges stay desktop-only.
- **Match page** (setup, live banner, finished report) uses the app theme, not forced dark. Setup is a grouped form.
- **Text scouting and DataVolley import** are sheets that keep their steps and states.

Acceptance for scouting includes a **tap-count and latency check** against the inventory's interaction-speed table,
run by the user on a phone, as well as tests.

### 8.5 Reports, stats, awards (inventory 05)

- **Match report:** a summary header (result, sets, date, opponent), then the sections as titled groups. Tables are
  borderless with tabular figures. Print keeps the same sections and page breaks, with a light print stylesheet
  whatever the theme.
- **Stats tab:** filters as a segmented control and menus in the toolbar's secondary row, leaderboards as grouped
  lists with bars in band colours, and both rotation views kept and labelled. CSV export is the main action.
- **Awards prepare:** a full-screen sheet on dark with steps (choose, photo, preview). Present mode stays full screen
  and its controls gain a visible "?" shortcuts hint.

### 8.6 Trainings, exercises, diagrams (inventory 06)

- **Libraries:** grouped lists with category chips as a horizontally scrolling filter row, search through the global
  palette (§6.1), "Load more" kept, and swipe and context actions per §6.4.
- **Training builder:** a large sheet, with the session plan as a reorderable list (drag handle, existing order
  behaviour). It gets the discard guard (§4.6).
- **Training view sheet:** a readable layout. The two-tap PDF share stays as it is: "Share PDF", then "Share PDF
  ready".
- **Diagram editor:**
  - full-screen with a glass floating toolbar at the top (tools) and a floating inspector on the right on desktop;
  - on phones the inspector is a bottom sheet;
  - court, gestures and shortcuts are unchanged;
  - autosave as B2/B3, and a status in the toolbar: "Saved", "Saving…", or "Not saved — Retry".

### 8.7 Club area, guides, platform (inventory 07)

- **Club area:** tabs become a segmented control (Profile, People & access, Export, Contract). People & access is a
  grouped list of members with role pills, and the team checklist pages (B9).
- **Restricted club area:** same layout, reduced tabs, as today.
- **Skill guides:** a list of skills, then an editor per skill with the range rows (B11 notice and guard).
- **Platform:** MinimalShell restyled with the same tokens, a clubs table with status pills, leads (B10), and "Back
  to app" (§4.6).

## 9. Shared outputs (award cards, story, video, training PDF)

- **Award cards and story slides (canvas):**
  - Same sizes, slides, ordering logic, text content, branding rules and privacy gates.
  - **The palette system stays exactly as it is.** That covers the five presets (including Clean Light), custom
    palettes in `vcb.awards.palettes` / `vcb.awards.palette`, the Palette editor and the per-scene colour rotation.
    Palettes keep deciding the colours.
  - What changes is the **layout and typography** drawn with those colours:
    - Inter with display tracking and tabular numbers;
    - more space, with the photo cut-out or initials on a soft radial glow in the palette's accent;
    - the club name from data in `caption` style.
  - A new preset, **"Night"** (true black, white ink, accent glow), becomes the default for coaches who never chose
    one. Stored choices are kept. **(call)**
  - The summary image and the video use the same frames, via `renderStoryFrame` as today.
- **Training PDF:**
  - Same pages, content, privacy rule ("Team notes" only) and two-tap share.
  - A light, print-first look: Inter embedded in pdfmake (loaded in the same dynamic import), `ink` and `ink-2` text,
    hairline separators, and category chips as outlined pills.
  - Diagrams are vector, as today, with light colours inlined.
  - If Inter is embedded, `fontSafe` is kept anyway: a harmless safety net.

## 10. Testing and acceptance

- **Per area:** every invariant in that inventory document holds, and its listed tests pass with only selector or
  markup changes. Any assertion change maps to an entry in §4.
- **New tests:**
  - spring maths, including interruption from the current value and velocity handoff;
  - `searchTokens` derivation and normalisation;
  - search ranking, access filtering and caps;
  - deferred-delete undo: commit on expiry, navigation and page hide, Undo restores, failure restores with an error;
  - the sheet dirty guard on flick;
  - each of B1–B13 and §4.4–4.5;
  - the reduced-motion and reduced-transparency branches;
  - the forced-dark scouting root.
- **Rules tests:** no rules change is expected. Add the club-admin team listing test (§4.4) and, if the builder finds
  a key whitelist on exercises or trainings, the `searchTokens` field test.
- **Visual check:** the user tests on their own phone and desktop (memory: no long browser audit loops). Each
  increment ends with a short list of what to look at.
- **Build gates:** `npm test`, `npm run lint`, `npm run build`, and `npm run test:rules` when rules or indexes are
  touched.

## 11. Delivery shape

This is a project of several plans, not one. Suggested increments, each ending green and reviewable:

1. **Foundation:** tokens, type, materials, the motion module, the primitives (Button, Sheet, Alert, Menu and context
   menu, SegmentedControl, grouped list and row, swipe row, Toast with undo, Toolbar), and the reduced-motion,
   transparency and contrast handling. Old primitives are kept as adapters so unconverted screens still render.
2. **Shell and navigation:** sidebar, toolbar, phone tab bar, the main-action slot, and the ⌘K palette with its local
   groups.
3. **Search data:** `searchTokens`, indexes, the backfill script, and the server groups.
4. Area by area, in risk order: **scouting** (04), then player card (03), home/teams/calendar/physical (02),
   trainings/exercises/diagrams (06), reports/stats/awards (05), club/admin/platform (07), and shell/auth/legal (01).
   Each area includes its bug fixes from §4.2.
5. **Shared outputs** (§9).
6. **Cleanup:**
   - delete the old tokens and adapters;
   - switch to the new logo (`docs/design/brand/README.md` §8);
   - update CLAUDE.md so its "Design system" section points to `docs/design/`, and fix the skill count to 9;
   - retire the old design-system spec and `docs/brand/`;
   - move the agreed changes into the inventory README.

**Merge strategy (user): all at once.**

- `feature/ui-redesign` merges to `main` once, after increment 6, so coaches never see a mixed UI.
- `main` is merged into the branch at the end of every increment, so the branch doesn't drift. Scouting commits keep
  landing on `main`.
- The user reviews each increment on the branch.

## 12. Left to the builder

- Exact component APIs, file layout under `src/components/` and `src/motion/`, and the adapter strategy during
  migration.
- Precise spring constants within the ranges given, and detent heights per sheet.
- Which icons, as long as they are lucide and consistent.
- Chart rendering details on the stats tab and report (keep the existing approach; only restyle).
- How the Calendar tab opens a session from `?session=` (B1), as long as the URL works when pasted.
- Whether `todayLocalIso()` replaces `todayIso()` or wraps it, after checking which one is already local.
- The backfill script's batching, as long as it follows the existing migration pattern: pure planner, I/O core,
  emulator test.
