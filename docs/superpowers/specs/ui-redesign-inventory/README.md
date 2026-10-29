# UI redesign — feature inventory (parity contract)

Branch: `feature/ui-redesign` · Written 2026-10-28 from the code and tests on `main` at `4137f33`.

The whole UI is being redesigned (visual language and UX, "Apple, 2050"), **keeping exactly the same
functionality**. These documents record what the app does today, screen by screen, so every redesigned
screen can be checked against them. They describe current behaviour only; they are not the new design.

## How to use this

- **Default rule: parity.** If a behaviour is listed here, the redesign keeps it — same actions, same
  results, same states, same permissions, same data written — unless it appears under
  [Agreed changes](#agreed-changes-to-behaviour) below. Layout, styling, wording tone and component
  choice are free to change; behaviour is not.
- **Each area has a "Must-keep invariants" list.** Those are the acceptance checklist for that area. A
  redesigned area is done when every invariant holds and its listed tests pass (updated only for
  markup/selector changes, never for behaviour).
- **"Pain points" are observations, not requirements.** They are input for the design, and become
  behaviour changes only once moved into [Agreed changes](#agreed-changes-to-behaviour).
- **Existing tests are the safety net.** Tests query by role and label, so most survive a restyle. A
  test that has to change its *assertion* (not just its selector) signals a behaviour change and needs
  an entry below.

## The documents

| # | Area | Screens | Invariants | Highest-risk items |
|---|---|---|---|---|
| [01](01-shell-auth-settings.md) | App shell, navigation, sign-in, club gate, legal signing, settings, shared primitives | 58 + route table | 58 | ClubGate status/time branches; legal texts hashed exactly as shown; Dialog/Menu/notify accessibility contracts; `vcb.*` storage keys |
| [02](02-home-teams-calendar-physical.md) | Home, teams list, team page tabs (roster, calendar, plan, physical, settings), add player, bulk import | 22 | 39 | Per-tab visibility and `?tab=` URL contract; bounded reads (month range, page sizes); consent defaults on add/import |
| [03](03-player-card.md) | Player card: identity, KPIs, 9 skills, plan, match stats, physical tests, contact, guardians, delete | 21 | 45 | Sections stay mounted (KPI tile depends on it); admin-only/privacy gating; derived fields computed on write; GDPR delete order |
| [04](04-scouting.md) | Matches tab, match setup/page, **live scouting**, text scouting, DataVolley import | 23 | 64 | Undo semantics; never-awaited writes (offline); hotkeys table; non-modal set-point prompt; 1–2 tap recording |
| [05](05-reports-stats-awards.md) | Match report, team stats tab, awards (prepare, present, cards, video) | 22 | 39 | Canvas output independent of app CSS; photo consent gate, photos never stored; two different rotation definitions |
| [06](06-trainings-exercises-diagrams.md) | Trainings library + builder, view sheet + PDF, exercises, court-diagram editor, AI drafting | 20 | 41 | Diagram editor gestures/shortcuts/autosave; PDF content and privacy rules; two-tap share; limit+cursor paging |
| [07](07-club-admin-platform.md) | Club area (profile, people & access, export, contract), guides, platform operator, leads | 14 | 35 | Lifecycle/date rules mirror `firestore.rules`; restricted club area lock-down; operator never sees club data; owner/last-admin safeguards |

## Cross-cutting rules (apply to every screen)

1. **No new data access patterns.** Components never call Firestore directly; `<feature>Api.ts` modules
   keep owning reads and writes. No unbounded collection reads; pagination stays limit + cursor; any new
   query ships with its index (CLAUDE.md "Fetching discipline").
2. **Authorization is enforced by the rules; the UI must not offer what the rules refuse**, and must not
   reveal existence: "not found" and "no access" render the same state wherever they do today.
3. **Offline behaviour stays as is.** Writes that are not awaited today (scouting events, physical tests)
   stay un-awaited; nothing new may block on the network in those paths.
4. **Accessibility contracts stay:** focus trap and return in dialogs, topmost-layer Escape, "Discard
   changes?" on dirty dialogs, ConfirmDialog opening on Cancel, one polite live region for success,
   inline `role="alert"` errors, focus to the page heading on route change, 44 px touch targets.
5. **Storage keys are frozen:** `vcb.*`, `theme`, `emailForSignIn`, and their sign-out cleanup.
6. **SEO:** `noindex` everywhere except `/login`, `/privacy`, `/request-access`.
7. **i18n:** every string stays translated in all shipped languages; number/date formats keep following
   the UI language (Italian decimal commas etc.).
8. **Privacy:** no third-party analytics; guardian data, photos and AI payloads keep their current limits
   (names stripped to jersey numbers, only library text sent, photos memory-only).
9. **Level bands and grade colours keep their meaning:** avg < 4 Beginner (red), < 6 Developing (orange),
   < 8 Advanced (blue), else Elite (green); scouting grades `=` red, `/` `-` orange, `!` neutral, `+` `#`
   green. Only the exact hues may change.
10. **Canvas outputs** (award cards, story slides, PNG, video) and the **training PDF** are outputs coaches
    share; they are *not* restyled by the app redesign unless listed under agreed changes.

## Facts the redesign must use (corrections to older docs)

- There are **9 skills**, not 8: serve, attack, block, set, defence, reception, jump, speed, iq
  (`SKILL_KEYS` in `src/types/player.ts`). (CLAUDE.md corrected at increment 6.)
- The calendar is **per team** (a team tab), not a top-level destination.
- Navigation today: sidebar groups Home · Coaching (Teams, Trainings, Exercises) · Club (Skill guides,
  Members & settings) · Platform; the phone bar is Home + coaching pages + **More**. Design-system spec §7
  is out of date on this.
- There is **no free-text search** anywhere today (exercises filter by category chips only).

## Agreed changes to behaviour

Agreed with the user on 2026-10-28 (brainstorming session). Everything else is parity.

1. **Search everything** (Spotlight-style, ⌘K / Ctrl+K): players, exercises, trainings, matches. Must
   respect fetching discipline and permissions — the design doc defines exactly what it can match.
2. **Undo instead of "Are you sure?"** for everyday, reversible actions; confirmations stay for
   irreversible or high-impact ones (remove member, delete team/club, lifecycle actions, GDPR deletes).
   The design doc lists which confirm becomes an undo.
3. **Phone sheets** with detents: drag up to full height, flick down to close.
4. **Context actions:** right-click (desktop) and long-press (phone) on rows; swipe actions on phone lists.
   Scouting keeps its own long-press (500 ms → substitution).
5. **One place for the main action:** top-right of the toolbar, on every screen.
6. **Physical motion:** spring-based, interruptible, press feedback on every control.
7. **Respect system settings:** `prefers-reduced-motion`, `prefers-reduced-transparency`,
   `prefers-contrast`.

Visual direction agreed: "v2" — monochrome chrome, colour reserved for data (levels, grades), glass only on
floating chrome where content scrolls underneath (toolbar, phone tab bar, sheets, menus), true-black dark
mode, light and dark equal, Inter with size-specific tracking. Live scouting is always dark.

Further decisions, 2026-10-28 (user), specified in the design doc
[`2026-10-28-ui-redesign-design.md`](../2026-10-28-ui-redesign-design.md) §4:

8. **Fix the bugs found** (§4.2, B1–B13): Home session rows open the calendar; diagram editor autosaves
   honestly and keeps undo history; scouting error banner clears, a taken-over device is told, set 1 has no
   serve default, imports are not undoable; local (not UTC) "today" dates; People & access pages all teams;
   dead "Grant access" path removed; guide editors confirm saves; history overlay becomes a standard sheet;
   offline player-card saves queue.
9. **Shared outputs are redesigned** (award cards, story, video, training PDF), keeping content, sizes and
   privacy rules (§4.3, §9). This overrides cross-cutting rule 10.
10. **Never-built spec features are added:** Home shortcuts (as create actions), "Plan a training", player
    count and average level on team cards (§4.5).
11. **Club admins see every team in their club** (§4.4).

The minor open questions in each document are settled in the design doc §4.6.

### In full (copied from the design doc at increment 6)

#### 4.2 Bug fixes (user: "fix the bugs")

| # | Bug today | Fixed behaviour | Area |
|---|---|---|---|
| B1 | Home "Next 7 days" session rows open the team's Roster tab. | A session row opens the team Calendar tab on that session's month, with the session's view sheet open (`?tab=calendar&session=<id>`). A match row keeps opening the match page. | 02 |
| B2 | The diagram editor asks "Leave without saving?" but saves on unmount anyway, so the copy is false. | The editor **autosaves**, like an Apple document. Leaving never asks. Each save is queued as its own commit, so saves may overlap (this replaces "one save at a time"). The pending save is flushed on leave, when the page is hidden (`visibilitychange`) and on `beforeunload`. The `pagehide` flush is best effort, because Firestore's own `pagehide` handler runs first. `beforeunload` warns only while a save is **failing**. In that case the toolbar shows "Not saved — Retry", and in-app navigation asks "Leave and lose the last changes?". **(call)**: this matches the code's real behaviour and drops the false prompt. | 06 |
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

#### 4.3 Shared outputs get the new look (user: "redesign them")

This covers award cards, story slides, summary image, story video and the training PDF. Content, slide logic,
privacy gates, sizes and export formats stay exactly as the inventory states; only the visual treatment changes.
Specified in §9. The pixel-level tests (`drawAwardCard.test.ts`, `drawSlide.test.ts`, PDF tests) are updated where
they assert colours or positions, and that is allowed by this entry.

#### 4.4 Club admins see every team in their club (user: "they should see them")

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

#### 4.5 Never-built spec features are added (user: "add them")

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

#### 4.6 Settled minor questions (call)

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

#### Theme "System" option (design doc §5)

- **Theme "System" option** (behaviour change, **(call)** on storage). Today the theme is only `'light' | 'dark'`
  (`theme/theme.ts:1`) and every toggle is persisted.
  - System means the `theme` key is absent, and choosing System removes it.
  - `public/theme-init.js` and `applyTheme` then follow `prefers-color-scheme` live.
  - Existing stored `light` or `dark` values are kept as explicit choices, with no migration.
  - The key name stays frozen.

### Rulings made while building (user-approved, 2026-10-29)

- **Player card:** one Edit picker (Skills, Development plan, Contact & registration, Guardians) replaces the per-section Edit buttons. Delete player lives only in "⋯". A neutral "Waiting to sync" dot marks queued saves, and a rejected offline write shows one page alert.
- **Today:** no navy band, greeting or club line. "Plan a training" shows only with trainings access.
- **Roster on phones:** no Starting checkbox. Use the row menu, long-press, right swipe and a "Starting" chip. Desktop keeps the checkbox.
- **Team header:** season · age group, with no Average or Record figures.
- **Exercises:** deleting an unused exercise is an undo. If it is used in trainings, a confirm names the usage count. If the usage count cannot be read, the confirm still opens and says the count could not be determined.
- **Diagram editor:** no Save button, a status line instead. An AI-prefilled builder starts dirty.
- **Stats:** a "Season awards →" link, and an "Export" menu (Print/PDF plus two CSVs). Print forces light tokens.
- **Club area:** role changes are written at once with Undo (demote self, make owner and remove keep their confirms). Guide Save sits in the toolbar.
- **Legal review:** each of the 13 specific-approval clauses has its own checkbox. Approve stays disabled until all are ticked. Ticks reset on a language or version change and are never stored. AI settings live at `/settings?view=ai`.
- **Shared outputs:** Night is the default palette for coaches with nothing stored, and canvas text is no longer uppercased.
- **Scouting:** one row of six grades on phones. Substitution stays on long-press, not in the dock.
- **Training PDF (open deviation):** it keeps Roboto until the user approves downloading Inter. `fontSafe` stays.

