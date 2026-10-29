# UI Redesign 4c: Today, Teams, Calendar and Physical Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild area 02 (Today, the teams list, the team page and its Roster, Calendar, Plan, Physical and Settings tabs) in the v2 system to match the mockups. It fixes B1 and the StartSessionCard part of B8, ships §4.4 (club admins see every team, Mine · All) and §4.5 (Today shortcuts, "Plan a training", player count and level on team cards), and turns the calendar session remove into an undo. Every inventory-02 invariant holds.

**Precondition:** plan 4b is merged. This plan uses its `todayLocalIso()` (`src/dates/today.ts`) and its `DevelopmentPlanEditor` sheet. `home/homeFeed.ts` and `calendar/monthGrid.ts` already delegate to `todayLocalIso`.

**Architecture:**
- **Data first.** `getTeamSummary()` (one `getAggregateFromServer` per team card) and a shared `TeamCard` feed both Today and `/teams`. Today and `/teams` list `listClubTeams()` for a club admin. `/teams` gets a Mine · All filter stored in `vcb.teamsFilter`.
- **Today** drops the navy band for a large title with the date overline, then the live card, two grouped columns (Next 7 days, Recent results), Your teams cards and the Shortcuts tiles. A new pending action `new-session` lets "Plan a training" open a team's Calendar tab with the assign sheet.
- **Team page.** The team name is the large title with a `season · age group` eyebrow. `SectionTabs` gives way to a `SegmentedControl semantics="tabs"` pinned under the toolbar. Each tab owns one toolbar main action (§6.5): Roster Add player (⋯ Import players), Calendar New session, Matches (already 4a), Plan Edit plan, Physical New testing session.
- **Calendar.** A session opens a `CalendarSessionSheet`. `?session=<id>` deep-links to it (B1), and Remove becomes an undo. Desktop keeps the month grid, with ink session pills and outlined match pills. Phones get a week strip and the selected day's agenda.
- **Physical.** Starting a session moves into a sheet (B8 local date). The quality panel becomes a focused full-height sheet with `stat`-size inputs and an identity block (screen 8).

**Not in this plan:**
- The Stats tab internals and its Export CSV main action (inventory 05). The Matches tab (4a). The player card and `AddPhysicalTestDialog` (4b).
- Things the mockups show that the spec text doesn't agree to (the text wins):
  - Today's "New match" toolbar action and its Team level / Players tiles (§6.5: Today has no main action);
  - the team header's Average and Record figures;
  - session times (no time field exists; §2 no new data);
  - the calendar panel's exercise parts and "Share PDF" (they stay in the training view);
  - a "Today" jump button;
  - screen 8's Best, New personal best, Reset/Save circles and Previous/Next player.
- No calendar session editing (none exists; §6.4's "Edit" is not added). The bulk-import dialog stays without an unsaved guard (parity).

**Tech Stack:** React 18, TypeScript strict (noUnusedLocals/Parameters), React Router v7, Tailwind with CSS-variable tokens (no `dark:`), Vitest + Testing Library (jsdom), Firestore web SDK (`getAggregateFromServer`, `count`, `average`), lucide-react, `@use-gesture/react` (inside `Sheet`/`SwipeRow`).

**Spec:**
- `docs/superpowers/specs/2026-10-28-ui-redesign-design.md`:
  - §8.2 (Today, teams, calendar, physical); §7 (Today title, pinned segmented team tabs, `?tab=` kept);
  - §4.2 B1, B8 (StartSessionCard); §4.4; §4.5; §4.6 (Cancel asks "Discard changes?"; roster sort/search on loaded pages; session notes unpersisted);
  - §6.2 (calendar session remove becomes undo; roster remove, retention delete, session close/delete stay confirmations), §6.3, §6.4 (Teams, Roster, Calendar rows), §6.5 (Today, Teams, Roster, Calendar, Plan / Physical);
  - §10, §11.
- Parity contract: `docs/superpowers/specs/ui-redesign-inventory/02-home-teams-calendar-physical.md` (39 invariants) plus the README's cross-cutting rules.
- Visual target: `docs/design/design-system/mockups/volley-skills-v2.html` ("Today, on desktop" lines 372–435, "On the phone" 437–498), `screens-set.html` screens 1 (77–112), 3 (177–220) and 8 (361–378), `screens-set.png`, `volley-skills-v2-light.png`. Design rules: `docs/design/design-system/README.md` §2, §7, §8.

## Global Constraints

**Parity**
- Every inventory-02 invariant holds. Existing tests change selectors or markup only. An assertion changes only where a task maps it to B1, B8, §4.4, §4.5, §6.2, §6.5, §7 or §8.2.
- Level bands and colours are unchanged: `avgScore < 4` Beginner red, `< 6` Developing orange, `< 8` Advanced blue, else Elite green; boundaries belong to the higher band (`computeLevel` in `src/players/skillMath.ts`).
- `?tab=` contract (invariant 18), tab order and visibility (17), page sizes and cursors (8), visible-month calendar queries (9) and session links `/trainings?businessId=<bid>&team=<teamId>&session=<sessionId>` (11) are untouched.
- `useTakePendingAction('new-team')` on Teams and `'add-player'` on the team page keep working.

**Visual**
- Colour comes only from tokens. Legacy `navy`, `slate`, `border-border`, `bg-blue/…`, `text-white`, `bg-black/…` are retired in every file this plan touches.
- Blue appears only as the Advanced band. Links, selection, today markers and session pills are ink. Red appears only on destructive actions, the Beginner band and the L chip. Green is live, success, Done and the W chip.
- Type roles:
  - large title via `PageHeader`;
  - section headers `text-title-3`;
  - row titles `text-headline`;
  - metadata `text-footnote text-ink-2`;
  - figures `text-stat`.

  Sentence case, never `uppercase`. `tabular-nums` on every number and date.
- Touch targets at least 44 px (`min-h-11`); grouped rows at least 52 px.

**Data, strings, gates**
- No unbounded reads. The only new reads are:
  - one aggregation per team card shown;
  - `listClubTeams()` (first page of 20) instead of `listMyTeams` for a club admin on Today and `/teams`;
  - one `getCalendarSession` for a `?session=` link.

  No new query shapes, so no index changes.
- No rules change: the aggregation runs under the existing `players` list rule (team admin or club admin), and the unfiltered team listing is already pinned by `tests/rules/teams.rules.test.ts:99`. `npm run test:rules` is not needed. If a task ever touches `firestore.rules` or `firestore.indexes.json`, add a rules test and run it on a temporary port, never 8080 (the user's emulator).
- Every new string goes in `src/i18n/en/*.ts` and `src/i18n/it/*.ts`. Player wording is gendered in Italian with `agree(...)` and `plural('it', …)`, like `teams.page.playersImported`.
- `vcb.teamsFilter` is a per-device preference ('mine' | 'all'). It is not cleared on sign-out, like `vcb.awards.story`. Every storage access is wrapped in try/catch.
- Never commit `serviceAccountKey.json` (or `.enc`), `*.vsbackup`, private keys, `.env.local` or `reference/`. Commit only as the steps say. Don't push or merge, add no dependency, and don't touch `src/matches/` except where a task names it, or `src/players/` beyond `AddPlayerDialog`.
- Gates per group: `npm test`, `npm run lint` (0 errors), `npm run build`.

## Review Focus

1. **Switching Mine · All while a page is loading** (or pressing Load more right after switching). A late page from the old filter must never replace or mix into the new list.
   - Pinned in Task 4 by "a slow All page that lands after switching to Mine is dropped" and "Load more pages the current filter".
2. **A pasted `?tab=calendar&session=<id>`** for a session in another month, or one already deleted. The first opens that month with the sheet. The second shows the normal calendar with the param stripped and no error.
   - Pinned in Task 7 by "a session link opens that session's month and sheet" and "a link to a missing session is dropped quietly".
3. **Removing a session, then changing month or tab before the undo expires.** The delete still commits, the row never comes back, and Undo never deletes.
   - Pinned in Task 7 by "changing month during the undo window still deletes the session" and "Undo restores the session and never deletes".
4. **"Next week" from the last week of a month** (and "Previous week" from the first). The view moves to the adjacent month, re-queries only that month's range, and selects an in-month day.
   - Pinned in Task 8 by "Next week from the month's last week moves to the next month".
5. **A team card's aggregation fails** (offline, or rules refuse it). The card still shows name, age group and season, with no count, no pill and no alert; other cards are unaffected.
   - Pinned in Task 1 by "a failed summary leaves the card without count or level".

---

## File Structure

| File | Responsibility |
|---|---|
| `src/teams/teamsApi.ts` (modify) | `getTeamSummary` |
| `src/teams/TeamCard.tsx` (create) | Shared team card / row with summary and optional context menu |
| `src/teams/teamsFilter.ts` (create) | `vcb.teamsFilter` read/write |
| `src/home/useHomeFeed.ts`, `src/home/HomePage.tsx`, `src/home/{LiveNowBlock,NextUpBlock,RecentResultsBlock}.tsx` (modify) | Today layout, club-admin listing, B1 links |
| `src/home/Shortcuts.tsx`, `src/home/TeamPickerSheet.tsx` (create) | §4.5 shortcuts and team picker |
| `src/search/types.ts`, `src/search/localSources.ts` (modify) | `new-session` pending action and its tab |
| `src/teams/TeamsListPage.tsx`, `src/teams/CreateTeamDialog.tsx` (modify) | Mine · All, card grid / phone list, create sheet |
| `src/teams/TeamPage.tsx`, `src/layout/useWindowScrolled.ts` (create), `src/teams/{TeamSettingsTab,RetentionNotice,TeamGenderPrompt}.tsx`, `src/components/Skeleton.tsx` (modify) | Header, pinned tabs, per-tab chrome, restyles |
| `src/teams/TeamRosterTable.tsx`, `src/teams/TeamStatsRow.tsx`, `src/players/AddPlayerDialog.tsx`, `src/bulkImport/BulkImportDialog.tsx` (modify) | Roster table and phone rows; add sheet; import restyle |
| `src/calendar/CalendarSessionSheet.tsx` (create), `src/calendar/TeamCalendarTab.tsx`, `src/calendar/monthGrid.ts`, `src/calendar/AssignTrainingDialog.tsx` (modify) | Session sheet, undo, deep link, layouts, assign sheet |
| `src/physicalSessions/*.tsx` (modify) | Start sheet (B8), past sessions, live view, focused quality sheet |
| `src/i18n/{en,it}/{home,teams,calendar,physicalSessions}.ts`, `src/i18n/italianLabelBudget.test.ts` (modify) | Strings; budget pairs |

---

### Task 1: Team summary and the shared team card

**Files:**
- Create: `src/teams/TeamCard.tsx`, `src/teams/TeamCard.test.tsx`
- Modify: `src/teams/teamsApi.ts`, `src/i18n/en/teams.ts`, `src/i18n/it/teams.ts`
- Test: `src/teams/teamsApi.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TeamSummary { players: number; avgScore: number | null }
  export async function getTeamSummary(teamId: string): Promise<TeamSummary>;
  // getAggregateFromServer(clubCol('teams', teamId, 'players'), { count: count(), avg: average('avgScore') })
  export function TeamCard(props: { team: Team; layout: 'card' | 'responsive'; withMenu?: boolean }): JSX.Element; // renders an <li>
  ```
- The count is every player doc, former players and players without a `number` included (§4.5). `avg` null (no scored player) gives `avgScore: null`.
- **`TeamCard`.** One `getTeamSummary` call per mount; a late result after unmount is ignored. The `<li>` contains one `Link` to `/teams/:id` with:
  - a monogram tile (`h-10 w-10 rounded-md bg-surface-3 text-footnote font-semibold text-ink-2`, `aria-hidden`). The monogram rule moves here from `TeamsListPage`: initials of the first two words, or the first two letters of one word, uppercase; "?" when empty;
  - the name (`text-headline truncate`);
  - the subtitle `{ageGroup} · {t.teams.list.season(season)}` (`text-footnote text-ink-2 tabular-nums`);
  - the summary line: `t.teams.summary.players(n, teamGender(team))` (`text-footnote text-ink-2 tabular-nums`) plus `<LevelPill level={computeLevel(avgScore)} gender>`, which shows "—" when null. While pending: `SkeletonBlock h-4 w-24`. On failure: nothing, and no alert;
  - for `layout="responsive"`, the description (`line-clamp-2 text-footnote text-ink-2`), shown from `md` only.
- **Layouts.**
  - `card`: `rounded-lg bg-surface p-4 shadow-card pressable`.
  - `responsive`: a 52 px grouped row on phones (hairline `before:` inset like `ListRow`, chevron `text-ink-3`). From `md` it is the card. The parent `ul` carries the matching responsive classes (Task 4).
- **`withMenu`:** `useContextMenu({ label: t.teams.list.rowMenu(name), items: [Open → navigate, Open in new tab → window.open(path, '_blank', 'noopener')] })`, spread on the link (§6.4).
- Strings:
  - `teams.summary.players`: en `` (n) => n === 1 ? '1 player' : `${n} players` `` (the `Gender` argument is ignored); it `plural('it', n, { one: `1 ${agree(g,'giocatore','giocatrice','giocatore/trice')}`, other: `${n} ${agree(g,'giocatori','giocatrici','giocatori/trici')}` })`.
  - `teams.list.rowMenu`: en `` (n) => `Actions for ${n}` ``, it `` (n) => `Azioni per ${n}` ``.
  - `teams.list.open`: `'Open'` / `'Apri'`. `teams.list.openNewTab`: `'Open in new tab'` / `'Apri in una nuova scheda'`.

- [ ] **Step 1: Failing tests.**
  - `teamsApi.test.ts`: add `getAggregateFromServer`, `count`, `average` to the `firebase/firestore` mock.
    - `it('summarises a team with one aggregation over its players')`: `average` is called with `'avgScore'`; the collection path ends `'teams', 't1', 'players'`; `{ count: 14, avg: 6.43 }` gives `{ players: 14, avgScore: 6.43 }`.
    - `it('reports no average when no player has a score')`: `avg: null` gives `avgScore: null`.
  - `TeamCard.test.tsx` (`vi.mock('./teamsApi')`):
    - `it('shows the player count and a band-coloured level pill')`: 14 and 6.4 give "14 players" and "Advanced" with `bg-blue-tint`.
    - `it('shows a dash pill when no player has a score')`.
    - `it('a failed summary leaves the card without count or level')`: rejected; name, "U17 · Season 2026-27" and the link show; no "players" text, no `alert`.
    - `it('offers Open and Open in new tab on right-click when withMenu is set')`.
- [ ] **Step 2:** Run `npx vitest run src/teams/teamsApi.test.ts src/teams/TeamCard.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run the same command. Expected: PASS, with every existing `teamsApi` test unchanged.
- [ ] **Step 5: Commit** `feat(teams): team summary aggregation and a shared team card (§4.5)`

### Task 2: Today: layout, club-admin teams and B1

**Files:**
- Modify: `src/home/useHomeFeed.ts`, `src/home/HomePage.tsx`, `src/home/LiveNowBlock.tsx`, `src/home/NextUpBlock.tsx`, `src/home/RecentResultsBlock.tsx`, `src/i18n/{en,it}/home.ts`
- Test: `src/home/HomePage.test.tsx`, `src/i18n/italian.smoke.test.tsx`

**Interfaces:**
- Consumes `TeamCard` (Task 1).
- `useHomeFeed(email: string | null, scope: 'mine' | 'club' | null)`:
  - `'club'` calls `listClubTeams()`; `'mine'` calls `listMyTeams(email)`;
  - `null` (access unknown) stays loading and reads nothing;
  - the effect depends on `[email, scope]`.
  - Everything else is unchanged: per-team calendar and match windows, error isolation, `hasMoreTeams`.
- The page passes `scope = access ? (access.isClubAdmin ? 'club' : 'mine') : null`.
- **Header** (mockup "Today, on desktop"): `PageHeader title={t.title} eyebrow={formatDateValue(new Date(), 'full')}`. That publishes "Today" with no main action (§6.5). The navy welcome band, the court SVG, the greeting and the club eyebrow are removed (§7, §8.2; the club name stays in the sidebar switcher).
- **Body order:** live card(s); a `grid grid-cols-1 gap-6 lg:grid-cols-2` with Next 7 days and Recent results; Your teams; then the Shortcuts slot that Task 3 fills. Loading, teams error and the no-access card keep their conditions. The no-access card becomes `bg-surface rounded-lg shadow-card`, with Request access as an ink pill link.
- **`LiveNowBlock`:** `h2` "Live now" (`text-title-3`). Each match is a `bg-surface rounded-lg shadow-card p-4` tile:
  - caption: `<span className="h-2 w-2 rounded-full bg-green" aria-hidden/>` plus `{team.name}` (`text-caption text-ink-2`);
  - `vs {opponent}` (`text-headline`);
  - `setsUs–setsThem` (`text-stat tabular-nums`);
  - the "Resume scouting" `Link` as an ink pill (`min-h-11`).
  - The grid is `grid-cols-1 sm:grid-cols-2`.
- **`NextUpBlock`:** `h2` plus a `GroupedList` of `ListRow`s: title = training name or `vs {opponent}`; subtitle = `{formatDate(date,'weekday')} · {team.name}` (tabular). The error line sits above the list. The empty text stays, and Task 3 adds its action.
  - **B1:** a session row's `to` is `` `/teams/${teamId}?tab=calendar&session=${session.id}` ``. A match row is unchanged.
- **`RecentResultsBlock`:** the same group surface. Each `li` is a flex row of:
  - the main `Link` (min 52 px): W/L chip (`h-6 w-6 rounded-sm text-caption font-bold`, W `bg-green-tint text-green-strong`, L `bg-red-tint text-red-strong`), then `setsUs–setsThem vs {opponent}` (`text-headline tabular-nums`) over `{team.name} · {date}` (footnote);
  - the sibling MVP link (`text-footnote text-ink-2 hover:underline`), never nested.
- **Your teams:** `h2` with "All teams →" (`text-callout text-ink-2`) and "Showing your first N teams." under the same `hasMoreTeams` rule. Then `ul grid gap-3 sm:grid-cols-2 lg:grid-cols-3` of `<TeamCard layout="card" />`.

- [ ] **Step 1: Failing tests** in `HomePage.test.tsx`. `teamsApi` is auto-mocked there, so `beforeEach` adds `vi.mocked(teamsApi.getTeamSummary).mockResolvedValue({ players: 0, avgScore: null })`. Do the same in the `italian.smoke.test.tsx` setup.
  - `it('is titled Today with the date as overline')`: the h1 is "Today", and `formatDateValue(new Date(2026, 9, 14, 18), 'full')` shows.
  - `it('a session in Next 7 days opens the team calendar on that session (B1)')`: a session `s1` on `2026-10-15` links to `/teams/t1?tab=calendar&session=s1`; a setup match still links to `/teams/t1/matches/m2`.
  - `it('a club admin sees the first page of every club team')`: `clubAdminAccess` calls `listClubTeams` and not `listMyTeams`.
  - `it('a member sees only their teams')`: `listMyTeams` is called with the email, and `listClubTeams` is not.
  - `it('team cards show the player count')`: mock `getTeamSummary` resolves `{ players: 3, avgScore: null }` and "3 players" shows.
- [ ] **Step 2:** Run `npx vitest run src/home`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Assertion changes mapped to §7/§8.2** (the title is Today; the welcome band, greeting and club eyebrow are gone):
  - "greets and shows a live match to resume" becomes "shows a live match to resume" (the `Good evening` heading assertion is dropped; the Resume href stays);
  - "shows the club name from the active club" is removed;
  - in `italian.smoke.test.tsx` "Home", the greeting regex becomes `expectItalianAndClean([itCat.home.title])`;
  - unused strings `greetingMorning`, `greetingAfternoon`, `greetingEvening`, `welcome` are deleted in en and it.
- [ ] **Step 5:** Run `npx vitest run src/home src/i18n src/teams`. Expected: PASS. These must pass unchanged: "shows the no-access card…", "a failing calendar does not hide matches", "recent results show the MVP", all of `homeFeed.test.ts`.
- [ ] **Step 6: Commit** `feat(home): Today in v2, club admins see club teams, sessions open the calendar (B1, §4.4)`

### Task 3: Today shortcuts and "Plan a training"

**Files:**
- Create: `src/home/Shortcuts.tsx`, `src/home/TeamPickerSheet.tsx`, `src/home/Shortcuts.test.tsx`
- Modify: `src/home/HomePage.tsx`, `src/home/NextUpBlock.tsx`, `src/search/types.ts`, `src/search/localSources.ts`, `src/i18n/{en,it}/home.ts`, `src/i18n/italianLabelBudget.test.ts`
- Test: `src/search/localSources.test.ts`, `src/home/HomePage.test.tsx`

**Interfaces:**
- `PendingActionId` gains `'new-session'`. `teamActionPath('new-session', id)` returns `/teams/${id}?tab=calendar`; `add-player` → roster, otherwise matches, as today. Task 7 consumes it.
- `TeamPickerSheet({ title, teams, onPick, onClose }: { title: string; teams: Team[]; onPick: (team: Team) => void; onClose: () => void })`: a `Sheet` (content detent) holding a `GroupedList` of `ListRow onClick` rows (name, subtitle age group).
- `useTeamAction(teams: Team[], action: 'new-match' | 'new-session')` in `Shortcuts.tsx` returns `{ start(): void; picker: ReactNode }`.
  - One team navigates at once to `teamActionPath(action, id)` with `withPendingAction(action)`.
  - Several teams open the picker, which navigates the same way.
- **`Shortcuts({ teams, access })`:** `h2` "Shortcuts", then `grid grid-cols-3 gap-3` of tile buttons (`rounded-lg bg-surface p-4 shadow-card pressable min-h-[88px]`, a lucide icon in a `bg-surface-3 rounded-md` tile, label `text-callout font-semibold`). Each tile shows only when allowed:
  - **New match** when `teams.length > 0` (Home's teams: theirs, or every club team for a club admin);
  - **New training** when `access.sections.trainings`: `navigate('/trainings', withPendingAction('new-training'))`;
  - **New exercise** when `access.sections.exercises`: `navigate('/exercises', withPendingAction('new-exercise'))`.

  No tiles means no section.
- **"Plan a training"** (§4.5 item 2): `NextUpBlock` gains `onPlan?: () => void`. When the list is empty and `onPlan` is set, a secondary button "Plan a training" sits under the empty text. Home passes it only when `teams.length > 0 && access.sections.trainings`; the Calendar tab needs trainings access. It uses `useTeamAction(teams, 'new-session')`.
- Strings `home.shortcuts`, en / it:
  - `title`: `'Shortcuts'` / `'Scorciatoie'`;
  - `newMatch`: `'New match'` / `'Nuova partita'`;
  - `newTraining`: `'New training'` / `'Nuovo allenamento'`;
  - `newExercise`: `'New exercise'` / `'Nuovo esercizio'`.

  Also `home.planTraining`: `'Plan a training'` / `'Pianifica un allenamento'`, and `home.pickTeam`: `'Choose a team'` / `'Scegli una squadra'`. Budget pairs for the three tile labels.

- [ ] **Step 1: Failing tests.**
  - `localSources.test.ts`: `it('new-session lands on the team calendar')`.
  - `Shortcuts.test.tsx`, with a `LocationProbe` showing pathname, search and `state.pendingAction`:
    - `it('shows only the shortcuts the person can use')`: member with trainings only and no teams gives "New training" only.
    - `it('New match with one team goes straight to its Matches tab')`: `/teams/t1?tab=matches`, state `new-match`.
    - `it('New match with several teams asks which team first')`: the dialog "Choose a team"; picking "U15" goes to `/teams/t2?tab=matches`.
    - `it('New exercise opens the exercise form')`: `/exercises`, state `new-exercise`.
  - `HomePage.test.tsx`:
    - `it('offers Plan a training on an empty week to a team admin with trainings access')`: with one team it goes to `/teams/t1?tab=calendar`, state `new-session`.
    - `it('does not offer Plan a training without trainings access')`.
- [ ] **Step 2:** Run `npx vitest run src/home src/search/localSources.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/home src/search src/i18n`. Expected: PASS, including `SearchPalette.test.tsx` and `pendingAction.test.tsx` unchanged.
- [ ] **Step 5: Commit** `feat(home): Today shortcuts and Plan a training (§4.5)`

### Task 4: Teams list: Mine · All, team cards, create sheet

**Files:**
- Create: `src/teams/teamsFilter.ts`, `src/teams/teamsFilter.test.ts`
- Modify: `src/teams/TeamsListPage.tsx`, `src/teams/CreateTeamDialog.tsx`, `src/i18n/{en,it}/teams.ts`
- Test: `src/teams/TeamsListPage.test.tsx`, `src/teams/CreateTeamDialog.test.tsx`

**Interfaces:**
- Consumes `TeamCard` (Task 1).
- `export type TeamsFilter = 'mine' | 'all'; readTeamsFilter(): TeamsFilter` (key `vcb.teamsFilter`; missing, invalid or throwing gives `'all'`); `writeTeamsFilter(f: TeamsFilter): void`.
- **Page:**
  - The `PageHeader` chrome is unchanged: New team for club admins, ⋯ Import teams.
  - For a club admin: `<SegmentedControl label={l.filterLabel} options={[mine, all]} value={filter} onChange={…writeTeamsFilter…} className="mb-4 w-full sm:w-auto" />`.
  - Query: club admin plus `all` uses `listClubTeams(cursor)`; everyone else uses `listMyTeams(email, cursor)`.
  - A `useRef` request counter drops any page whose request is not the latest. A filter change clears the list and loads page 1. Load more uses the current filter's cursor.
- **States:** before the first page, 4 `SkeletonBlock` rows in the list shape (`role="status"`, sr-only `t.teams.shared.loading`). Then the empty card (`bg-surface rounded-lg shadow-card text-callout text-ink-2`): `none` for a club admin on All; new `noneMine` for a club admin on Mine; `noneAssigned` for a member. A failed load still leaves the list empty (parity).
- **List:** `ul` with classes `overflow-hidden rounded-lg bg-surface shadow-card md:grid md:grid-cols-2 md:gap-3 md:overflow-visible md:rounded-none md:bg-transparent md:shadow-none lg:grid-cols-3 xl:grid-cols-4`, holding `<TeamCard layout="responsive" withMenu />` per team. Load more stays a centred secondary button under `hasMore`.
- **`CreateTeamDialog`** becomes `<Sheet title guardUnsaved confirm={{ label: saving ? saving : create, form: 'create-team-form', disabled: saving || gender === '' }}>`.
  - The form gets that id and keeps its `aria-label`.
  - The in-body Cancel and Create go; Cancel through the sheet is guarded (§4.6).
  - Fields, required rules, the error and the English code saved are unchanged.
- Strings `teams.list`, en / it:
  - `filterLabel`: `'Show teams'` / `'Mostra squadre'`;
  - `filterMine`: `'Mine'` / `'Mie'`;
  - `filterAll`: `'All'` / `'Tutte'`;
  - `noneMine`: `"You're not listed on any team yet."` / `'Non sei ancora in nessuna squadra.'`.

  Also `teams.shared.loading`: `'Loading teams…'` / `'Caricamento squadre…'`.

- [ ] **Step 1: Failing tests.**
  - `teamsFilter.test.ts`:
    - `it('defaults to all and ignores junk')`;
    - `it('remembers the last choice')`;
    - `it('survives blocked storage')` (`getItem` throws).
  - `TeamsListPage.test.tsx` (mock `getTeamSummary`):
    - `it('a club admin lists every club team by default')`;
    - `it('Mine switches to the teams they are listed on and is remembered')`: `listMyTeams` is called, and `localStorage['vcb.teamsFilter'] === 'mine'`;
    - `it('starts on Mine when that was the last choice')`;
    - `it('a member gets no filter and only their teams')`;
    - `it('a slow All page that lands after switching to Mine is dropped')`: deferred `listClubTeams`, switch, resolve it late; only the Mine teams show;
    - `it('Load more pages the current filter')`;
    - `it('shows skeleton rows until the first page arrives, not "No teams yet."')`.
  - `CreateTeamDialog.test.tsx`: `it('Cancel after typing asks to discard')`.
- [ ] **Step 2:** Run `npx vitest run src/teams/teamsFilter.test.ts src/teams/TeamsListPage.test.tsx src/teams/CreateTeamDialog.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Selector updates.**
  - "renders each team as a card with its age group and season" now reads the subtitle "U17 · Season 2026-27".
  - "adapts the page header and gutter for mobile…" asserts the gutter only; the action row now lives in the toolbar (§6.5).
- [ ] **Step 5:** Run `npx vitest run src/teams src/i18n`. Expected: PASS. These must pass unchanged:
  - the import, main-action, pending-action and member tests in `TeamsListPage.test.tsx`;
  - every other `CreateTeamDialog` test ("Create disabled until a team type…", Escape behaviour, single write);
  - `teamsItalian.test.tsx`.
- [ ] **Step 6: Commit** `feat(teams): Mine · All for club admins, team cards with count and level (§4.4, §4.5)`

### Task 5: Team page frame: header, pinned tabs, per-tab chrome

**Files:**
- Create: `src/layout/useWindowScrolled.ts`, `src/layout/useWindowScrolled.test.ts`
- Modify: `src/teams/TeamPage.tsx`, `src/teams/TeamSettingsTab.tsx`, `src/teams/RetentionNotice.tsx`, `src/teams/TeamGenderPrompt.tsx`, `src/components/Skeleton.tsx` (`team` layout), `src/i18n/{en,it}/teams.ts`, `src/i18n/italianLabelBudget.test.ts`
- Test: `src/teams/TeamPage.test.tsx`, `src/layout/useWindowScrolled.test.ts`

**Interfaces:**
- `useWindowScrolled(): boolean` is `window.scrollY > 0`, listening to passive `scroll`. It is the same signal the toolbar turns glass on.
- **Header:** `PageHeader title={team.name} eyebrow={`${team.season} · ${team.ageGroup}`}`, with the description as today (print-hidden). It has:
  - `publishChrome={!OWN_CHROME.has(activeTab)}`, where `const OWN_CHROME = new Set<TeamTab>(['matches'])`. Task 7 adds `'calendar'` and Task 9 adds `'physical'`;
  - `mainAction` / `more` by tab:
    - roster: `{ label: t.teams.page.addPlayer(gender), icon: UserPlus, onSelect: () => setShowAddPlayer(true) }` plus `[{ kind: 'action', label: t.teams.page.importPlayers, icon: <Upload size={16}/>, onSelect: () => setShowImportPlayers(true) }]`;
    - plan: `{ label: t.teams.page.editPlan, icon: Pencil, onSelect: () => setPlanEditing(true) }`;
    - stats, settings: none.
- **Pinned tabs:**
  ```tsx
  <div style={{ top: 'calc(52px + env(safe-area-inset-top, 0px))' }}
       className={`sticky z-20 -mx-4 flex h-16 items-center px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 print:hidden ${scrolled ? 'glass' : 'bg-bg'}`}>
    <SegmentedControl semantics="tabs" label={t.teams.page.sectionLabel} options={tabs} value={activeTab} onChange={changeTab} className="w-full md:w-auto" />
  </div>
  ```
  It scrolls horizontally on phones (built in). The content below is `<div role="tabpanel" aria-label={activeLabel} className="mt-4">`.
- **`changeTab`** also deletes `session` (it belongs to the Calendar tab, B1). Everything else is unchanged: `replace: true`, stats params stripped.
- The inline roster action row is removed. The roster keeps gender prompt → retention → stats row → table.
- **Plan tab:** `<section className="rounded-lg bg-surface p-4 shadow-card sm:p-6"><DevelopmentPlanEditor plan onSave isAdmin editing={planEditing} onEditingChange={setPlanEditing} /></section>`. `isAdmin` stays `true` (parity).
- **Restyles, behaviour unchanged:**
  - **Settings:** three `section`s (`rounded-lg bg-surface p-4 shadow-card`, `h2 text-title-3`, body `text-callout text-ink-2`): Team info form, Export, Danger zone (club admin). There is no main action.
  - **RetentionNotice:** `rounded-lg bg-orange-tint p-4`, heading `text-headline`, body `text-callout text-ink-2`, hairline rows, name link `text-ink underline-offset-2 hover:underline`, Delete `destructive`.
  - **TeamGenderPrompt:** `bg-surface rounded-lg shadow-card`, three `secondary` buttons.
  - **`team` skeleton:** a title line, a 64 px segmented bar, 2 stat tiles, 5 grouped rows. It keeps `role="status"` and its label.
- Strings `teams.page`:
  - `addPlayer` becomes `(g: Gender) => string`: en `sameForAll('Add player')`, it `agree(g, 'Aggiungi giocatore', 'Aggiungi giocatrice', 'Aggiungi giocatore/trice')`;
  - new `editPlan`: `'Edit plan'` / `'Modifica piano'`.

  Budget pairs for `teams.page.tabs.*`.

- [ ] **Step 1: Failing tests** in `TeamPage.test.tsx`. Render through `WithChrome` (`src/test/chromeProbe.tsx`).
  - `it('the roster publishes Add player, with Import players in More')`.
  - `it('Import players from More opens the player import')`: the dialog "Import players" shows.
  - `it('Edit plan in the toolbar opens the plan editor')`: on `?tab=plan`, the dialog "Edit development plan" shows.
  - `it('the team tabs are a segmented control pinned under the toolbar')`: the `tablist` "Team section" sits in an element with `sticky`; the h1 is "U17 Boys"; the eyebrow "2026 · U17" shows.
  - `it('a tab change drops the calendar session param')`: `?tab=calendar&session=s1`, then Matches, gives `?tab=matches`.
  - `useWindowScrolled.test.ts`: `it('turns true once the window scrolls')`.
- [ ] **Step 2:** Run `npx vitest run src/teams/TeamPage.test.tsx src/layout/useWindowScrolled.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Test updates.**
  - Assertion changes mapped to §6.5:
    - "tightens the page chrome and stacks the roster action buttons on mobile" keeps its gutter and heading-not-in-card checks; its action-row assertions are replaced by the first new test;
    - "the Matches tab owns the toolbar…": Roster now reads `{ title: 'U17 Boys', action: 'Add player', more: ['Import players'] }`; Settings stays `{ title, null, [] }`.
  - Selector changes:
    - "opens the player bulk-import dialog…" and "shows a consent-reminder notice after a successful player import" click the probe's "Import players";
    - "add-player pending action…" is unchanged;
    - the plan-tab tests click the probe "Edit plan" instead of "Edit".
- [ ] **Step 5:** Run `npx vitest run src/teams src/components src/layout src/i18n`. Expected: PASS. These must pass unchanged:
  - every `?tab=` test (open, legacy ids, stats fallback, Calendar visibility, order);
  - not-found and retry;
  - gender prompt;
  - `TeamSettingsTab.test.tsx` (including "has no admin-management UI");
  - `RetentionNotice.test.tsx`;
  - `Skeleton.test.tsx`;
  - `italian.smoke.test.tsx` "a team page".
- [ ] **Step 6: Commit** `feat(teams): v2 team header, pinned segmented tabs and per-tab main actions`

### Task 6: Roster: borderless table, phone rows, row actions, add sheet

**Files:**
- Modify: `src/teams/TeamRosterTable.tsx`, `src/teams/TeamStatsRow.tsx`, `src/players/AddPlayerDialog.tsx`, `src/bulkImport/BulkImportDialog.tsx`, `src/i18n/{en,it}/teams.ts`
- Test: `src/teams/TeamRosterTable.test.tsx`, `src/players/AddPlayerDialog.test.tsx`

**Interfaces:**
- **Controls row:** the search field (sr-only label and placeholder unchanged, `FIELD_CLASS`) and, below `xl`, the sort select (`aria-label` "Sort roster", `xl:hidden`).
- **Desktop table (`xl`):**
  - The wrapper is `relative hidden rounded-lg bg-surface shadow-card xl:block`, with no border and no `overflow-x-auto` (it fits at `xl`).
  - `th`: `sticky z-10 bg-surface text-caption text-ink-2`, `style={{ top: 'calc(env(safe-area-inset-top, 0px) + 116px)' }}` (52 px toolbar plus the 64 px tab strip). Sentence case.
  - Sort by column header: Start → `lineup`, Born → `birthdate`, Skill avg → `skill`. Each is a `<button>` inside its `th`, and the active `th` has `aria-sort="descending"` (skill) or `"ascending"` (lineup, birthdate). The same `sort` state drives the select.
  - Rows are hairlines (`divide-y divide-separator`, `min-h-[52px]`), the name link `text-headline text-ink hover:underline`, and the Remove button stays.
  - Each row is a `RosterTableRow` with `useContextMenu` (the row actions below) spread on the `tr`.
- **Phone and tablet (`< xl`):** a grouped `ul` (`xl:hidden overflow-hidden rounded-lg bg-surface shadow-card`). One `li data-testid="roster-mobile-card"` per player, wrapped in:
  ```tsx
  <SwipeRow leading={{ label: p.starting ? tr.unsetStarting : tr.setStarting, tone: 'neutral', undoable: true, onAction: () => void toggleStarting(p, !p.starting) }}
            trailing={[{ label: tr.removeMenu, tone: 'destructive', undoable: false, onAction: () => setPendingDelete(p) }]}>
  ```
  - The row content is:
    - the player `Link`: an avatar with initials (`h-10 w-10 rounded-full bg-surface-3 text-footnote font-semibold text-ink-2`), the name (`text-headline`), and the subtitle `{position} · #{number} · {age}` (footnote, tabular; each part omitted when missing);
    - outside the link: a "Starting" chip (`rounded-full bg-surface-3 px-2 text-caption text-ink`) when starting, the average (`text-callout tabular-nums text-ink-2`, or "—"), the `LevelPill`, and a `Menu` kebab (`MoreHorizontal`, 44 px, label `tr.rowMenu(name)`).
  - Row actions (kebab, and the context menu on the `li`), §6.4:
    - `tr.openCard` → navigate to the card;
    - `setStarting` / `unsetStarting` → `toggleStarting`;
    - divider;
    - `tr.removeMenu` (danger) → `setPendingDelete`.
  - The Remove confirm, the optimistic starting toggle with revert, the empty texts and Load more are unchanged.
- **`TeamStatsRow`:** the same two `StatTile`s in `grid grid-cols-2 gap-3 sm:max-w-sm`.
- **`AddPlayerDialog`** becomes `<Sheet title size="lg" detent="large" guardUnsaved confirm={{ label: saving ? saving : create, form: 'add-player-form', disabled: saving }}>`.
  - The form gets that id; in-body Cancel and Create go.
  - Guardian blocks become `bg-surface-2 rounded-lg p-3` with no border.
  - Fields, consent and payload are unchanged.
- **`BulkImportDialog`:** tokens only. It keeps its own footer and `Dialog`, so Cancel stays disabled while committing (parity). The success line is `text-green-strong`; errors are `role="alert"` `text-red-strong`.
- Strings `teams.roster`, en / it:
  - `rowMenu`: `` (n) => `Actions for ${n}` `` / `` (n) => `Azioni per ${n}` ``;
  - `openCard`: `'Open card'` / `'Apri scheda'`;
  - `setStarting`: `'Set as starting'` / `'Metti tra i titolari'`;
  - `unsetStarting`: `'Remove from starting'` / `'Togli dai titolari'`;
  - `removeMenu`: `'Remove…'` / `'Rimuovi…'`.

- [ ] **Step 1: Failing tests** in `TeamRosterTable.test.tsx`:
  - `it('the row menu sets a player as starting')`: open "Actions for Test Player", choose "Set as starting"; `setPlayerStarting('team-1','p1',true)`.
  - `it('right-click on a phone row offers Open card, Set as starting and Remove…')`.
  - `it('Remove… from a row menu opens the confirmation and never deletes directly')`.
  - `it('a column header sorts by skill and marks aria-sort')`: clicking the "Skill avg" header orders the table rows by skill, and its `th` has `aria-sort="descending"`.
  - `it('shows a Starting chip on a starting player\'s row')`.
  - `AddPlayerDialog.test.tsx`: `it('Cancel after typing asks to discard')`.
- [ ] **Step 2:** Run `npx vitest run src/teams/TeamRosterTable.test.tsx src/players/AddPlayerDialog.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Markup assertions mapped to §8.2** (phone grouped rows replace the card grid):
  - "keeps the wide table for screens it fits and uses a card grid below that" keeps `xl:hidden`, `xl:block` and `relative`, and drops `sm:grid-cols-2`;
  - "lays out the mobile card as labelled fields…" becomes "the phone row shows position, number, age, average and level": `/Middle · #7/`, "6.5" and "Developing" inside the row.
- [ ] **Step 5:** Run `npx vitest run src/teams src/players/AddPlayerDialog.test.tsx src/bulkImport src/i18n`. Expected: PASS. These must pass unchanged:
  - the table tests: single averaged skill column, position label, remove after confirm, remove failure, Remove outside the link, search, birthdate sorts, skill sort via the select, lineup default, checkbox toggle, Load more;
  - `TeamStatsRow.test.tsx`;
  - every `AddPlayerDialog` payload, consent and double-click test;
  - `BulkImportDialog.test.tsx`;
  - `rosterSort.test.ts`.
- [ ] **Step 6: Commit** `feat(teams): v2 roster table and phone rows with row menu and swipe`

### Task 7: Calendar: session sheet, undo remove, deep link, New session

**Files:**
- Create: `src/calendar/CalendarSessionSheet.tsx`
- Modify: `src/calendar/TeamCalendarTab.tsx`, `src/teams/TeamPage.tsx` (passes `teamName`, adds `'calendar'` to `OWN_CHROME`), `src/i18n/{en,it}/calendar.ts`
- Test: `src/calendar/TeamCalendarTab.test.tsx`, `src/teams/TeamPage.test.tsx`

**Interfaces:**
- Consumes `'new-session'` (Task 3).
- `TeamCalendarTab({ teamId, teamName, onNewMatch })` publishes `usePublishPageChrome({ title: teamName, mainAction: { label: c.newSession, icon: Plus, onSelect: () => setAssignDate(selectedDate) } })`. `useTakePendingAction('new-session', () => setAssignDate(selectedDate))`.
- **`CalendarSessionSheet({ teamId, session, onClose, onRemove })`:** `<Sheet title={session.trainingName} footer={…}>`.
  - Body: `formatDayLabel(date)` (`text-callout text-ink-2 tabular-nums`), `trainingBusinessId` (`text-footnote text-ink-2`), and the notes if any (`whitespace-pre-line text-body`).
  - Footer:
    - a `Link` "Open training" to `sessionLink(teamId, session)`, as an ink pill (invariant 11);
    - a `dangerGhost` "Remove" with `aria-label={c.removeSession(businessId, date)}`, which calls `onRemove(session)`.
- **Opening.** Session pills (desktop) and agenda rows (phone) become `button`s with the label `sessionLabel(session)` that open the sheet. The × buttons go; Remove lives in the sheet, the context menu and the swipe.
- **Row actions (§6.4):** `useContextMenu({ label: c.sessionMenu(sessionLabel(s)), items: [Open → sheet, Remove → requestRemove] })` on pills and agenda rows. The phone agenda row is wrapped in `SwipeRow trailing={[{ label: c.remove, tone: 'destructive', undoable: true, onAction }]}`. There is no Edit (none exists).
- **Undo remove (§6.2).** `requestRemove(s)` adds `s.id` to a hidden `Set`, closes the sheet if it shows `s`, and calls:
  ```ts
  undoable({ message: c.removed(sessionLabel(s), s.date),
    commit: async () => { await deleteCalendarSession(teamId, s.id); if (mounted.current) await load(); },
    onUndo: () => unhide(s.id),
    onCommitError: () => { if (mounted.current) { unhide(s.id); setError(c.removeError); } } })
  ```
  The `ConfirmDialog`, `pendingDelete` and `deleteError` go. The error shows in the existing `role="alert"` slot.
- **Deep link (B1).** On mount and whenever `?session` changes:
  - a session already loaded opens at once;
  - otherwise `getCalendarSession(teamId, id)`. If found, `setView` to its month, `setSelectedDate(date)` and open it. If it is null or rejects, delete the param (`replace: true`) with no error.
  - Closing the sheet deletes `session` (`replace: true`) and keeps `tab`.
- Strings `calendar.tab`, en / it:
  - `newSession`: `'New session'` / `'Nuova sessione'`;
  - `openTraining`: `'Open training'` / `'Apri allenamento'`;
  - `remove`: `'Remove'` / `'Rimuovi'`;
  - `removed`: `` (l, d) => `${l} on ${d} removed` `` / `` (l, d) => `${l} del ${d} rimossa` ``;
  - `sessionMenu`: `` (l) => `Actions for ${l}` `` / `` (l) => `Azioni per ${l}` ``.

  Remove `removeTitle`, `removeMessage` and `removeConfirm` in en and it.

- [ ] **Step 1: Failing tests** in `TeamCalendarTab.test.tsx`, wrapped in `NoticeProvider` and `WithChrome`, using `vi.useFakeTimers({ shouldAdvanceTime: true })` where `UNDO_MS` advances.
  - `it('a session opens its sheet with a link to the training')`: click "TR-0007 · Passing circuit"; the dialog "Passing circuit" has "Open training" → `/trainings?businessId=TR-0007&team=team-1&session=s1`.
  - `it('removing is an undo: the session leaves at once and is deleted when the notice expires')`: no `alertdialog`; `deleteCalendarSession` is not called before `UNDO_MS`; after it, it is called with `('team-1','s1')` and `listCalendarSessions` runs again.
  - `it('Undo restores the session and never deletes')`.
  - `it('a failed remove brings the session back with the error')`: "Could not remove the session. Please try again.".
  - `it('changing month during the undo window still deletes the session')`.
  - `it('a session link opens that session\'s month and sheet')`: route `?tab=calendar&session=s9`; `getCalendarSession` → `2026-11-03`; `listCalendarSessions('team-1','2026-11-01','2026-11-30')` is called and the sheet shows.
  - `it('a link to a missing session is dropped quietly')`: null; no dialog, no alert, and the location has no `session`.
  - `it('New session in the toolbar opens the assign sheet for the selected day')`.
  - `it('Plan a training lands with the assign sheet open')`: location state `{ pendingAction: 'new-session' }`.
- [ ] **Step 2:** Run `npx vitest run src/calendar/TeamCalendarTab.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Test changes.**
  - "removes a session after confirmation" is replaced by the undo test (§6.2).
  - Mapped to §8.2 ("a session opens its view sheet"):
    - "links each session to its training…" reads the link from the sheet;
    - the phone test's `Remove TR-0007 on 2026-09-10` lookup opens the sheet first;
    - `TeamPage.test.tsx` "the Matches tab owns the toolbar…" adds: on Calendar, the action reads "New session".
- [ ] **Step 5:** Run `npx vitest run src/calendar src/teams src/home`. Expected: PASS. These must pass unchanged:
  - "renders sessions in the current month…", "re-queries when navigating…", "shows an alert but keeps the grid…", "highlights today's cell", "offers no add affordance on out-of-month padding cells", "opens the assign dialog from the add button…", "shows matches in the month as links…", "offers adding a match on a day";
  - `calendarApi.test.ts`.
- [ ] **Step 6: Commit** `feat(calendar): session sheet, undo remove and session deep links (B1, §6.2)`

### Task 8: Calendar layouts and the assign sheet

**Files:**
- Modify: `src/calendar/TeamCalendarTab.tsx`, `src/calendar/monthGrid.ts`, `src/calendar/AssignTrainingDialog.tsx`, `src/i18n/{en,it}/calendar.ts`
- Test: `src/calendar/monthGrid.test.ts`, `src/calendar/TeamCalendarTab.test.tsx`, `src/calendar/AssignTrainingDialog.test.tsx`

**Interfaces:**
- `export function shiftDate(iso: string, days: number): string` in `monthGrid.ts`. It is UTC arithmetic like `buildMonthGrid`.
- **Month header:**
  - "Previous month" / "Next month" icon buttons (44 px, `text-ink-2 hover:bg-surface-2`);
  - the month label as `text-title-2`: `formatMonthLabel` with the year in `text-ink-2 font-medium` (mockup).
- **Desktop grid (≥ 768):**
  - Shape: `grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-separator`, cells `bg-surface min-h-24 p-1.5`, weekday header `text-caption text-ink-2` (sentence case).
  - Today: the day number in a `bg-ink text-on-ink` circle, keeping `aria-label="Today, YYYY-MM-DD"`.
  - Out-of-month cells: `text-ink-3`, day number only, no controls.
  - Match pills: `Link` with `ring-1 ring-inset ring-ink text-ink rounded-full px-2 text-caption truncate`, the label and `title` unchanged.
  - Session pills: `button` with `bg-ink text-on-ink rounded-full px-2 text-caption truncate`.
  - Per-cell "Add training on {date}" (`Plus`) and "Add match on {date}" (`Trophy`): icon buttons beside the day number, `h-7 w-7` with a 44 px hit area (`relative before:absolute before:-inset-2`). They are `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100`, and stay in the DOM.
- **Phone (< 768): week strip plus agenda.**
  - The strip is the `buildMonthGrid` row that contains `selectedDate`, with "Previous week" / "Next week" icon buttons around it.
  - `shiftWeek(d)`: `next = shiftDate(selectedDate, 7 * d)`. If `next` leaves the viewed month, `setView` to `next`'s month. Then `setSelectedDate(next)`.
  - Day buttons keep the `aria-label` / `aria-pressed` contract and out-of-month inertness.
  - Selected: `bg-ink text-on-ink`. Today unselected: `ring-1 ring-inset ring-ink font-semibold`.
  - Dots (max 3): sessions `bg-ink`, matches `ring-1 ring-ink`.
  - Under the strip, `<section aria-label={trainingsOn(day)}>`:
    - the day label (`text-title-3`) with the "Add match on {date}" button (`secondary`, Trophy). The day's "Add training" button goes; New session in the toolbar uses the selected day (§6.5);
    - match rows as `Link`s (`min-h-11`, outlined pill style);
    - the session agenda as a grouped list of the Task 7 rows (title = training name, subtitle = business id plus truncated notes);
    - empty: "No trainings scheduled." in `rounded-lg border border-dashed border-separator`.
- **`AssignTrainingDialog`** becomes `<Sheet title detent="large" guardUnsaved confirm={{ label: saving ? saving : assign, form: 'assign-training-form', disabled: saving }}>`.
  - In-body Cancel and Assign go.
  - The training radio list is a grouped list (`bg-surface-2 rounded-lg`, 52 px rows, checked row `bg-surface-3`).
  - Exercise rows use `text-ink-3` chevrons; "Deleted exercise" stays `text-red-strong`.
  - Find, Load more, every error and the payload are unchanged.
- Strings: `calendar.tab.previousWeek` `'Previous week'` / `'Settimana precedente'`; `nextWeek` `'Next week'` / `'Settimana successiva'`. Remove `addTraining` and `add` if they end up unused.

- [ ] **Step 1: Failing tests.**
  - `monthGrid.test.ts`: `it('shiftDate crosses month and year ends')`: `('2026-09-28', 7)` gives `'2026-10-05'`; `('2027-01-03', -7)` gives `'2026-12-27'`.
  - `TeamCalendarTab.test.tsx` phone describe:
    - `it('Next week from the month\'s last week moves to the next month')`: from today `2026-09-29`, Next week calls `listCalendarSessions('team-1','2026-10-01','2026-10-31')` and selects "Tuesday 6 October" (`aria-pressed` true);
    - `it('the week strip shows only the selected week')`: "Thursday 10 September" is absent until Previous week.
  - `AssignTrainingDialog.test.tsx`: `it('Cancel after picking a training asks to discard')`.
- [ ] **Step 2:** Run `npx vitest run src/calendar`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Step changes mapped to §8.2** (week strip). Each test adds one click on "Previous week" before tapping its day; the assertions are unchanged:
  - "selects today by default and lists the tapped day's sessions…" (Thursday 10 September);
  - "gives the match chip of the tapped day a 44px touch target" (Saturday 12 September).

  "opens the assign dialog for the selected day" clicks the probe "New session" instead of "Add training on 2026-09-20" (§6.5).
- [ ] **Step 5:** Run `npx vitest run src/calendar src/teams src/i18n`. Expected: PASS. These must pass unchanged: every desktop-grid test, the `monthGrid` `todayIso`/range/grid tests, every other `AssignTrainingDialog` test (find, load more, errors, single write).
- [ ] **Step 6: Commit** `feat(calendar): v2 month grid, phone week strip and agenda, assign sheet`

### Task 9: Physical tab: start sheet (B8), past sessions, live view

**Files:**
- Modify:
  - `src/physicalSessions/TeamPhysicalSessionTab.tsx`, `StartSessionCard.tsx`, `PastSessionDialog.tsx`, `LiveSessionView.tsx`, `PlayerRosterPicker.tsx`, `QualityTileGrid.tsx`;
  - `src/teams/TeamPage.tsx` (adds `'physical'` to `OWN_CHROME`);
  - `src/i18n/{en,it}/physicalSessions.ts`.
- Test: `src/physicalSessions/StartSessionCard.test.tsx`, `TeamPhysicalSessionTab.test.tsx`, `src/teams/TeamPage.test.tsx`

**Interfaces:**
- **`TeamPhysicalSessionTab`** owns `starting: boolean` and publishes `usePublishPageChrome({ title: team.name, mainAction: showingStart ? { label: s.start.newSession, icon: Plus, onSelect: () => setStarting(true) } : undefined })`. `showingStart` is true when no session is active and the roster has loaded. The live view has no main action; its Delete and Close session stay in its header (§6.5 "per tab, existing").
- **`StartSessionCard({ teamId, creatorUid, onStarted, starting, onCloseStart })`:**
  - The inline date box goes.
  - While `starting`: `<Sheet title={s.start.newSession} confirm={{ label: s.start.startNew, onConfirm: handleStart, disabled: busy }}>` with the Date `Input` (default `todayLocalIso()`, **B8**) and the inline error. `SessionAlreadyOpenError` and other failures keep their copy.
  - Past sessions: `h2 text-title-3` plus a `GroupedList` of `ListRow onClick` rows (date `tabular-nums`, chevron by `onClick` row styling). Empty, error and the delete notice are unchanged.
  - `StartSessionCard.tsx`'s own `todayIso` is deleted.
- **`PastSessionDialog`** uses `Sheet` directly (`size="lg" detent="large" footer`). Results are a grouped list (`dt text-ink-2`, Not finished `text-orange-strong`).
- **`LiveSessionView`:**
  - header: "Session started {date}" (`text-footnote text-ink-2`), then Delete session (`ghost`) and Close session (`dangerGhost`) as today;
  - picker and tiles side by side from `md`;
  - it passes `playerNumber` of the selected player to `QualityTileGrid`.
- **`PlayerRosterPicker`:**
  - a grouped list with 52 px rows: `#n` (`text-footnote text-ink-2 tabular-nums`), name (`text-headline`), `done/total` (footnote);
  - selected row `bg-surface-3`, `aria-pressed` kept, max heights kept.
- **`QualityTileGrid`:**
  - tiles `rounded-lg bg-surface shadow-card p-3 min-h-[72px]`;
  - status Not started `text-ink-2`, In progress `text-orange-strong`, Done `text-green-strong`;
  - the Done tile stays disabled;
  - it gains optional `playerNumber?: number`, forwarded to the panel.
- Strings: `physicalSessions.start.newSession`: `'New testing session'` / `'Nuova sessione di test'`.

- [ ] **Step 1: Failing tests.**
  - `StartSessionCard.test.tsx` (top of file `process.env.TZ = 'Europe/Rome'`):
    - `it('defaults the start date to the local day just after midnight (B8)')`: `vi.setSystemTime(new Date('2026-10-14T22:30:00Z'))` with `shouldAdvanceTime: true`; the Date field in the sheet is `'2026-10-15'`.
    - `it('starts from the sheet and reports an open session')`.
  - `TeamPhysicalSessionTab.test.tsx` (wrapped in `WithChrome`):
    - `it('New testing session in the toolbar opens the start sheet')`;
    - `it('an active session publishes no main action')`.
- [ ] **Step 2:** Run `npx vitest run src/physicalSessions`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Selector updates.** The existing start tests render `starting` and click the sheet's "Start new session"; their assertions are unchanged.
- [ ] **Step 5:** Run `npx vitest run src/physicalSessions src/teams`. Expected: PASS. These must pass unchanged:
  - `TeamPhysicalSessionTab` state-order tests (roster error, loading, session error, left-club exclusion, every page loaded);
  - `LiveSessionView.test.tsx` (close and delete confirmations, listener cleanup);
  - `PastSessionDialog.test.tsx`;
  - `PlayerRosterPicker.test.tsx` (8 vs 7 denominators);
  - `QualityTileGrid.test.tsx` (Done disabled);
  - `testingSessionsApi.test.ts`.
- [ ] **Step 6: Commit** `fix(physical): start session in a sheet with the local date; v2 physical tab (B8)`

### Task 10: The focused quality sheet (screen 8)

**Files:**
- Modify: `src/physicalSessions/SessionQualityPanel.tsx`, `src/physicalSessions/Stopwatch.tsx`
- Test: `src/physicalSessions/SessionQualityPanel.test.tsx`, `src/physicalSessions/Stopwatch.test.tsx`, `src/physicalSessions/physicalSessionsItalian.test.tsx`

**Interfaces:**
- `SessionQualityPanel` gains optional `playerNumber?: number`. Its root is `<Sheet title={`${label} — ${playerName}`} detent="large" size="md" footer={…}>`, with no `guardUnsaved` (parity: fields persist on blur).
  - Footer: Close (`secondary`) and Finish (`primary`, disabled while `!ready || saving`), both `min-h-12 flex-1`.
  - The Finish error moves into the body, above the footer, as `role="alert"`.
- **Identity block (screen 8):** centred;
  - avatar `h-14 w-14 rounded-full bg-surface-3 text-ink-2` with initials;
  - name `text-headline`;
  - `#{playerNumber}` in `text-footnote text-ink-2 tabular-nums` when > 0.
- **Inputs:**
  - Height, Body mass, Standing reach, both shuttle sides, Weight, Reps and the new-attempt input are `text-stat tabular-nums text-center h-16`, with `inputMode` unchanged (`decimal`; `numeric` for reps);
  - labels `text-footnote text-ink-2`;
  - selects and Notes stay body size; HealthHint is unchanged.
- **Attempt pills:** `bg-surface-2 text-ink`, the value tabular; the remove "x" keeps `aria-label` "Remove attempt N". "+ Add attempt" is `secondary min-h-12`.
- **`Stopwatch`:**
  - the readout is `text-display tabular-nums text-center`;
  - Start (`primary`) / Stop (`destructive`) are full width, `min-h-14`;
  - Reset's two-tap and blur behaviour is unchanged.

- [ ] **Step 1: Failing test** in `SessionQualityPanel.test.tsx`: `it('shows who is being tested in a full-height sheet')`. With `playerName="Giulia Bianchi"` and `playerNumber={9}`, it shows "GB", "Giulia Bianchi" and "#9", and the attempt input has `text-stat`.
- [ ] **Step 2:** Run `npx vitest run src/physicalSessions/SessionQualityPanel.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/physicalSessions src/players/physicalTestFieldLogic.test.ts`. Expected: PASS. These must pass unchanged:
  - every `SessionQualityPanel` test (draft merge-writes, skip unchanged, resume, readiness thresholds, Finish once, failure warning, notes not in the draft);
  - `Stopwatch.test.tsx` (exact elapsed at Stop, two-tap reset, blur cancel);
  - `physicalSessionsItalian.test.tsx` (decimal comma).
- [ ] **Step 5: Commit** `feat(physical): focused full-height quality sheet with stat-size inputs`

### Task 11: Gate and user checklist

**Files:** none new.

- [ ] **Step 1:** Run `npm test`, `npm run lint` and `npm run build`. Expected: all green, with 0 lint errors. If a known flaky load-timeout test fails (the Italian smoke test), rerun that file alone and report both results.
- [ ] **Step 2: Greps.** Each should print nothing:
  - `grep -rnE "dark:|navy|slate|border-border|bg-blue/|text-white|bg-black/" src/home src/teams src/calendar src/physicalSessions src/players/AddPlayerDialog.tsx src/bulkImport --include=*.tsx | grep -v test | grep -v "teams/stats/"`;
  - `grep -n "toISOString" src/physicalSessions/StartSessionCard.tsx`;
  - `grep -rn "SectionTabs" src/teams`;
  - `git diff --stat main -- firestore.rules firestore.indexes.json` (no rules or index change).
- [ ] **Step 3: Commit** any lint-only fix-ups as `chore(teams): gate fix-ups`, if there are any.
- [ ] **Step 4: User checklist** for the group report. The user runs it on a real phone and a desktop, in light and dark mode.
  - **Today vs the mockup.** Check the "Today" title with the date overline; the live tile with its green dot and Resume; Next 7 days and Recent results side by side on desktop and stacked on a phone; team cards with count and level pill; Shortcuts. No toolbar main action.
  - **B1.** Tap a session in Next 7 days: the team Calendar opens on that month with the session sheet. Paste that URL in a new tab: the same.
  - **§4.5.**
    - New match with several teams asks for the team.
    - New training opens the builder.
    - New exercise opens the form.
    - On an empty week, Plan a training opens the team Calendar with the assign sheet.
  - **§4.4.** As a club admin, `/teams` shows All by default; Mine narrows the list; reload keeps the choice. Today lists club teams.
  - **Team page vs screen 1.** The large title with the season · age group eyebrow, and the segmented tabs pinned under the glass toolbar while scrolling (they scroll sideways on a phone). Add player and ⋯ Import players are in the toolbar.
  - **Roster.** On a phone: avatar rows; swipe right toggles Starting; swipe left offers Remove…, which confirms; long-press gives the menu. On desktop: a borderless table, a sticky header, and clicking Born or Skill avg sorts.
  - **Calendar vs screen 3.** Ink session pills and outlined match pills. Hover a day for + and the trophy; on an iPad they are always visible. Tap a session: the sheet with Open training and Remove. Remove, then Undo; remove and wait 6 s. On a phone: the week strip, Previous/Next week crossing months, and New session in the toolbar.
  - **Physical vs screen 8.** New testing session in the toolbar opens the start sheet (just after midnight it shows today's local date). On a phone, a quality opens full height with the player block, large numeric fields and a decimal keypad, with Close and Finish at the bottom.
  - **Italian.** The team tabs, Shortcuts tiles and "Aggiungi giocatrice" fit.
  - `tailwind.config.js` did not change, so no dev-server restart is needed.
