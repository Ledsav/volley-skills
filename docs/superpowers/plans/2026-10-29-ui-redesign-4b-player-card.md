# UI Redesign 4b: Player Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the player card (inventory 03) in the v2 system to match mockup screen 2, with the Add physical test sheet matching screen 8 on phones. It fixes B8 (the player-card dates), B12 and B13. The toolbar gets Edit (a section picker) and "⋯" Delete player…. Every inventory-03 behaviour stays.

**Architecture:**
- **Bug fixes come first, in small tested units:**
  - `src/dates/today.ts` holds `todayLocalIso()` (B8);
  - `useSave` gains `onQueued`, and `src/players/playerSync.tsx` keeps the pending keys, the offline notice and the sync-failed flag (B13). With no provider it behaves like today (await, no dots), so the section tests keep passing.
- **B12** turns the history overlay into the standard `Sheet`. It also gets the §6.2 undo delete and the §6.4 row menu and swipe.
- **Page frame.** `PlayerCardPage` publishes its toolbar through `usePublishPageChrome`. The identity card becomes the page header (h1, so `focusPageHeading` still works). `Tile` becomes a `Section` with an `h2` header and a `surface` group. `SectionTabs` gives way to `SegmentedControl semantics="tabs"`, and every panel stays mounted.
- **Editors** move from the `Dialog` adapter to `Sheet` with `confirm`. On phones the Cancel · Title · Save header comes for free, and Cancel is guarded (§4.6).

**Not in this plan:**
- The roster, Add player, the bulk import, the team Plan and Physical tabs, and the live testing session (area 02). `StartSessionCard`'s UTC `todayIso` also stays for area 02: it is that area's B8 line and needs its own test. `EditButton` stays as it is for the team Plan tab.
- Things the mockup shows that the spec doesn't agree to, because the spec text wins:
  - Overall, Last match, CMJ and Height tiles: the four KPI tiles stay (invariant 20).
  - Tap-to-score in place: Edit still opens the existing sheets (§8.3).
  - Screen 8's "New personal best", Reset and Previous/Next player: no new features (§2).
- A URL for the section, the player's name in the document title, physical-test editing and per-skill notes UI (§4.6 and pain points; none of them agreed).

**Tech Stack:** React 18, TypeScript strict (noUnusedLocals/Parameters), React Router v7, Tailwind with CSS-variable tokens (no `dark:`), Vitest + Testing Library (jsdom), Firestore web SDK with the persistent cache, lucide-react, `@use-gesture/react` (already used by `Sheet` and `SwipeRow`).

**Spec:**
- `docs/superpowers/specs/2026-10-28-ui-redesign-design.md`:
  - §8.3 (player card);
  - §4.2 B8 (player-card part), B12, B13; §4.6 (band-coloured level chip, Cancel asks "Discard changes?");
  - §6.2 (physical-test entry delete becomes undo), §6.3 sheets, §6.4 (physical-test history row), §6.5 (Player card row);
  - §10, §11 item 4.
- Parity contract: `docs/superpowers/specs/ui-redesign-inventory/03-player-card.md`, all 45 invariants, plus the README's cross-cutting rules.
- Visual target: `docs/design/design-system/mockups/screens-set.html`, screen 2 (lines 114–175) and screen 8 (lines 366–378), and `screens-set.png`. Design rules: `docs/design/design-system/README.md` §2–§9. Where the mockup and the text disagree, the text wins (README line 21).

## Global Constraints

**Parity**
- Every inventory-03 invariant holds. Existing tests change selectors or markup only. An assertion changes only where a task maps it to B8, B12, B13, §4.6, §6.2 or §6.5.
- The **9 skills** (`SKILL_KEYS`: Serve, Attack, Block, Set, Defence, Reception, Jump, Speed, IQ) and the 1–10 scale stay hardcoded. CLAUDE.md's "8 skills" is out of date (inventory README, "Facts").
- Level bands and colours are unchanged:
  - `avgScore < 4` Beginner red;
  - `< 6` Developing orange;
  - `< 8` Advanced blue;
  - else Elite green;
  - boundaries belong to the higher band.

  The meter colours by the score's own band, and the radar by `player.level`.
- Every section stays mounted with `hidden` (invariant 16). Physical keeps feeding the "Last physical test" KPI.
- Viewers: no Edit, no Adapt, no Add new, no Delete entry (button, menu or swipe), no Privacy, no Matches, and no `listFinishedMatches` call.
- **Online saves still await**, so rule errors stay inline. Only an offline save (`navigator.onLine === false` at the moment of saving) closes at once (B13).
- The player delete stays a confirmation with Cancel focused and the GDPR order unchanged. Export is unchanged. Neither is a "save" under B13: both still await.

**Visual**
- Colour comes only from tokens. Legacy `navy`, `slate`, `border-border`, `text-white` and `bg-black/50` are retired in every file this plan touches.
- Blue appears only for the Advanced band (meter, radar, `LevelPill`) and the existing "In progress" status chip.
- Text in a data colour uses `-strong`. `src/theme/dataColourText.test.ts` stays green.
- Type roles:
  - name `text-title-1`;
  - section headers `text-title-3`;
  - row titles `text-headline`;
  - metadata `text-footnote text-ink-2`;
  - KPI `text-stat`.

  Group headers and `dt` labels are sentence case and never `uppercase`. `tabular-nums` goes on every number and date (invariant 45).
- Touch targets are at least 44 px (`min-h-11`). Inputs are 16 px on touch (`FIELD_CLASS` already does this).

**Strings, data, gates**
- Every new string goes in `src/i18n/en/*.ts` and `src/i18n/it/*.ts`, the shipped languages. Gendered player wording uses `agree(...)` in Italian, like `deleteButton`.
- Privacy: no new data leaves the device and no analytics. Guardian, consent and photo-consent rules are unchanged.
- No rules or index changes: B13 writes the same fields, and the undo delete calls the same `deletePhysicalTest`. So `npm run test:rules` isn't needed. If a task ever touches `firestore.rules`, add a rules test and run it on a temporary port, never 8080, which is the user's emulator.
- Never commit `serviceAccountKey.json` (or `.enc`), `*.vsbackup`, private keys, `.env.local` or `reference/`. Commit only as the steps say. Don't push or merge, add no dependency, and don't touch `src/matches/`.
- Gates per group: `npm test`, `npm run lint` (0 errors), `npm run build`.

## Review Focus

1. **A queued offline save is later rejected** (for example, access revoked while offline). The pending dot must clear, and the page must say so inline, not leave a dot forever or fail silently.
   - Pinned in Task 2 by "a rejected queued write clears the key and raises syncFailed".
   - Pinned in Task 3 by "a queued save rejected on sync shows the sync-failed alert".
2. **Deleting a test entry, then closing the history sheet (or leaving the page) before the undo expires.** The delete must still commit and the latest row must refresh. Undo must never delete.
   - Pinned in Task 4 by "closing the sheet during the undo window still deletes and refreshes the latest row".
3. **A viewer on the new chrome.** No Edit main action, no "⋯", and no right-click or swipe Delete on history rows.
   - Pinned in Task 5 by "a viewer gets no toolbar actions".
   - Pinned in Task 4 by "a viewer's history rows have no context menu".
4. **Cancel on an edited sheet, and a double-tapped header Save.** Cancel asks "Discard changes?" when the form is dirty and closes at once when it is clean. Save writes once.
   - Pinned in Task 7 by "Cancel on an edited skills sheet asks to discard" and "a second Save while saving writes once".
5. **"Today" just after local midnight** (22:30 UTC is 00:30 in Rome). Left-club and consent dates must be the local day.
   - Pinned in Task 1 by "uses the local calendar date, not UTC" and "records consent with the local date".

---

## File Structure

| File | Responsibility |
|---|---|
| `src/dates/today.ts` (create) | B8: `todayLocalIso(now?)` |
| `src/players/retention.ts`, `src/players/playersApi.ts`, `src/teams/RetentionNotice.tsx`, `src/home/homeFeed.ts`, `src/calendar/monthGrid.ts` (modify) | B8: use or delegate to `todayLocalIso` |
| `src/components/useSave.ts` (modify) | B13: the `onQueued` hook |
| `src/players/playerSync.tsx` (create) | B13: `PlayerSyncProvider`, `usePlayerSync`, `PendingDot` |
| `src/players/PhysicalTestHistoryList.tsx` (modify) | B12 Sheet; undo delete; row context menu and swipe |
| `src/players/PlayerCardPage.tsx` (modify) | Frame, toolbar, picker, sections, Privacy groups, B13 page saves |
| `src/players/EditPickerSheet.tsx` (create) | §6.5 section picker |
| `src/players/PlayerIdentityCard.tsx`, `src/components/Skeleton.tsx` (modify) | Header; skeleton in the new shape |
| `src/players/{PlayerSkillsSection,SkillRadarChart,SuggestionToggle,PlayerMatchStatsSection}.tsx`, `src/components/{SkillMeter,InfoTooltip}.tsx` (modify) | Skills and Matches panels; guide opens on tap |
| `src/components/DevelopmentPlanEditor.tsx`, `src/players/{PlayerContactSection,GuardiansSection}.tsx` (modify) | Editors as sheets; grouped read views |
| `src/players/{PhysicalTestingSection,AddPhysicalTestDialog,PhysicalTestTrendChart}.tsx`, `src/components/AttemptsInput.tsx` (modify) | Physical rows; screen-8 add sheet |
| `src/i18n/{en,it}/players.ts`, `src/i18n/italianLabelBudget.test.ts` (modify) | Strings; budget pairs |

---

### Task 1: B8: local "today"

**Files:**
- Create: `src/dates/today.ts`, `src/dates/today.test.ts`
- Modify:
  - `src/players/retention.ts` (delete `todayIso`);
  - `src/players/PlayerCardPage.tsx` (import);
  - `src/teams/RetentionNotice.tsx` (one import and one call);
  - `src/players/playersApi.ts` (lines 104 and 232);
  - `src/home/homeFeed.ts` and `src/calendar/monthGrid.ts` (bodies delegate; exports and signatures kept).
- Test: `src/players/playersApi.test.ts`, `src/players/PlayerCardPage.test.tsx`

**Interfaces:**
- Produces `todayLocalIso(now: Date = new Date()): string`. It returns `YYYY-MM-DD` from `getFullYear` / `getMonth` / `getDate`, zero-padded.
- `recordPlayerConsent(teamId, playerId, confirmedByEmail, today: string = todayLocalIso()): Promise<Player['consent']>`. The extra parameter lets the page keep its local state in step (Task 3).
- `createPlayer`'s consent date comes from `todayLocalIso()`.
- `monthGrid.todayIso()` returns `todayLocalIso()`. `homeFeed.todayIso(now)` returns `todayLocalIso(now)`. Both are already local, so this is a pure dedupe.
- `StartSessionCard.tsx` is **left for area 02** (see "Not in this plan").

- [ ] **Step 1: Failing tests.**
  - `today.test.ts`, which starts with `process.env.TZ = 'Europe/Rome'` (precedent: `src/platform/dates.test.ts`):
    - `it('uses the local calendar date, not UTC')`: `todayLocalIso(new Date('2026-10-14T22:30:00Z'))` is `'2026-10-15'`.
    - `it('zero-pads month and day')`: `todayLocalIso(new Date(2026, 0, 5, 9))` is `'2026-01-05'`.
  - `playersApi.test.ts`: `it('records consent with the local date')`. Use `vi.useFakeTimers()`, `vi.setSystemTime(new Date('2026-10-14T22:30:00Z'))` and TZ Rome at the file top. The consent is `{ given: true, date: '2026-10-15', confirmedBy: 'coach@example.com' }`. Passing `'2026-01-02'` as the 4th argument stores that date.
  - `PlayerCardPage.test.tsx`: `it('marks left with the local date just after midnight')`. Add `process.env.TZ = 'Europe/Rome'` at that file's top too. With the same system time, Mark as left calls `setPlayerLeftClub('team-1', 'player-1', '2026-10-15')`. Use fake timers with `shouldAdvanceTime: true` so `findBy` still works.
- [ ] **Step 2:** Run `npx vitest run src/dates src/players/playersApi.test.ts src/players/PlayerCardPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/dates src/players src/home src/calendar src/teams`. Expected: PASS. These existing tests must pass unchanged:
  - `retention.test.ts`;
  - the `monthGrid.test.ts` `todayIso` describe;
  - `homeFeed.test.ts` "todayIso…";
  - "records guardian consent with today and the confirming admin";
  - "marks a player as having left the club and shows the deletion date";
  - the `RetentionNotice` tests in `src/teams`.
- [ ] **Step 5: Commit** `fix(players): consent and left-club dates use the local day (B8)`

### Task 2: B13: queued-save plumbing

**Files:**
- Create: `src/players/playerSync.tsx`, `src/players/playerSync.test.tsx`
- Modify: `src/components/useSave.ts`, `src/components/useSave.test.tsx`, `src/i18n/en/players.ts`, `src/i18n/it/players.ts`

**Interfaces:**
- `SaveOptions` gains `onQueued?: (written: Promise<unknown>) => void`. In the offline `queue` branch, it is called with the write's promise before `save` resolves `true`. The existing `.catch(() => undefined)` stays, so nothing is unhandled.
- Produces:
  ```ts
  export type SyncKey = 'skills' | 'plan' | 'contact' | 'guardians' | 'consent' | 'photo' | 'leftClub' | `test:${PhysicalTestType}`;
  export interface PlayerSync {
    queued(key: SyncKey, written: Promise<unknown>): void; // notify(savedOffline); key pending until settled
    isPending(key: SyncKey): boolean;
    syncFailed: boolean; // a queued write was rejected later
  }
  export function PlayerSyncProvider({ children }: { children: ReactNode }): JSX.Element;
  export function usePlayerSync(): PlayerSync; // no provider: queued no-op, isPending false, syncFailed false
  export function PendingDot({ pending }: { pending: boolean }): JSX.Element | null;
  ```
- How the sync state works:
  - Pending is a `Map<SyncKey, number>` count, so two queued writes on the same key clear only after both settle.
  - It lives in state, so dots re-render.
  - `PendingDot` renders `<span role="img" aria-label={waiting} title={waiting} className="inline-block h-2 w-2 shrink-0 rounded-full bg-ink-2" />`, and `null` when not pending.
- Strings under `players.card.sync`, en / it:
  - `savedOffline`: `'Saved on this device · will sync'` / `'Salvato su questo dispositivo · si sincronizzerà'`;
  - `waiting`: `'Waiting to sync'` / `'In attesa di sincronizzazione'`;
  - `failed`: `'Some changes made offline could not be saved. Reload the page to see the stored card.'` / `'Alcune modifiche fatte offline non sono state salvate. Ricarica la pagina per vedere la scheda salvata.'`.

- [ ] **Step 1: Failing tests.**
  - `useSave.test.tsx`: `it('offline, hands the queued write to onQueued')`. Offline, `onQueued` receives the same promise `write()` returned, and `save` resolves `true` while that promise is still pending.
  - `playerSync.test.tsx`, rendered inside `NoticeProvider`:
    - `it('queued shows the offline notice and marks the key pending until it settles')`: the status text is "Saved on this device · will sync". `isPending('skills')` is true until the deferred resolves.
    - `it('a key stays pending until every queued write on it settles')`.
    - `it('a rejected queued write clears the key and raises syncFailed')`.
    - `it('without a provider it is inert')`.
    - `it('PendingDot is labelled "Waiting to sync" and renders nothing when not pending')`.
- [ ] **Step 2:** Run `npx vitest run src/components/useSave.test.tsx src/players/playerSync.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run the same command. Expected: PASS. The 4 existing `useSave` tests must pass unchanged.
- [ ] **Step 5: Commit** `feat(players): queued-save tracking for offline player-card saves (B13)`

### Task 3: B13: every player-card save queues offline

**Files:**
- Modify:
  - `src/players/PlayerSkillsSection.tsx`, `src/players/PlayerContactSection.tsx`, `src/players/GuardiansSection.tsx`;
  - `src/players/PlayerCardPage.tsx`;
  - `src/players/AddPhysicalTestDialog.tsx`, `src/players/PhysicalTestingSection.tsx`.
- Test: `src/players/PlayerSkillsSection.test.tsx`, `PlayerContactSection.test.tsx`, `GuardiansSection.test.tsx`, `PlayerCardPage.test.tsx`, `PhysicalTestingSection.test.tsx`

**Interfaces:**
- Consumes Task 2. Every write below goes through a `useSave()` instance with `{ onQueued: (w) => sync.queued(KEY, w) }`, keeps its existing try/catch and inline error, and returns early when `save` returns `false`:

  | Write | Owner | Key |
  |---|---|---|
  | Save skills | `PlayerSkillsSection.handleSave` | `skills` |
  | Adapt | `PlayerSkillsSection.adapt` (same instance) | `skills` |
  | Contact | `PlayerContactSection.handleSave` | `contact` |
  | Guardians | `GuardiansSection.handleSave` | `guardians` |
  | Plan | the page's `onSave` for `DevelopmentPlanEditor` (it resolves when saved or queued) | `plan` |
  | Record consent | page: `const today = todayLocalIso()`, then `recordPlayerConsent(…, today)`, then local `consent = { given: true, date: today, confirmedBy: email }` | `consent` |
  | Photo consent | page | `photo` |
  | Left club / Still in club | page | `leftClub` |
  | Add physical test | `AddPhysicalTestDialog` (already `useSave`) | `` `test:${testType}` `` |

  - Each page control group gets its own `useSave` instance, so one group never blocks another.
  - Offline, **Adapt** shows only the offline notice. Its "{Skill} set to {n}" toast is skipped, using a local `queued` flag set inside `onQueued`.
- The page wraps its content in `PlayerSyncProvider` and renders:
  - `<PendingDot pending={sync.isPending(key)} />` beside the Skills, Development plan, Contact and Guardians tile titles (`Tile` gains `pending?: boolean`);
  - the same dot on the consent, photo and left-club lines;
  - `{sync.syncFailed && <p role="alert" className="text-callout text-red-strong">{c.sync.failed}</p>}` at the top of the content.

  The provider must sit above the sections, so split the page into `PlayerCardPage` (provider) and `PlayerCardContent`.
- `PhysicalTestingSection` puts a `PendingDot` beside each row's test name (`isPending(\`test:${type}\`)`).

- [ ] **Step 1: Failing tests.** Each runs offline (`vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)`) with a deferred API promise, inside `NoticeProvider` and `PlayerSyncProvider`.
  - `PlayerSkillsSection.test.tsx`:
    - `it('offline, the skills sheet closes as soon as the write is queued')`: the dialog is gone and "Saved on this device · will sync" shows.
    - `it('offline, Adapt shows the offline notice, not the adapted toast')`.
  - `PlayerContactSection.test.tsx`: `it('offline, the contact sheet closes as soon as the write is queued')`.
  - `GuardiansSection.test.tsx`: `it('offline, the guardians sheet closes as soon as the write is queued')`.
  - `PlayerCardPage.test.tsx`:
    - `it('offline, a skills save shows a pending dot on Skills until it syncs')`: a `Waiting to sync` img sits inside the Skills section, and it is gone after the deferred resolves.
    - `it('offline, the plan, consent, photo and left-club saves apply at once with pending dots')`.
    - `it('a queued save rejected on sync shows the sync-failed alert')`.
  - `PhysicalTestingSection.test.tsx`: `it('offline, a new entry closes the sheet and dots its row until it syncs')`.
- [ ] **Step 2:** Run `npx vitest run src/players`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/players src/components src/i18n`. Expected: PASS. These existing tests must pass unchanged, which proves online saves still await and errors stay inline:
  - "shows an error message when the save is rejected";
  - "Adapt applies the suggestion and saves at once";
  - "shows an error message and stays in edit mode when the save is rejected";
  - "edits a guardian and saves";
  - "lets a team admin give and withdraw guardian photo consent for a minor";
  - "lets an admin record guardian consent…";
  - "saves the entry once even when Save is clicked twice";
  - "opens the add-test dialog for the clicked quality and refreshes on save";
  - `italian.smoke.test.tsx`.
- [ ] **Step 5: Commit** `fix(players): offline player-card saves close when queued and show a pending dot (B13)`

### Task 4: B12: history as a standard sheet, undo delete, row actions

**Files:**
- Modify: `src/players/PhysicalTestHistoryList.tsx`, `src/players/PhysicalTestingSection.tsx`, `src/i18n/en/players.ts`, `src/i18n/it/players.ts`
- Test: `src/players/PhysicalTestHistoryList.test.tsx`, `src/players/PhysicalTestingSection.test.tsx`

**Interfaces:**
- **The sheet.** The root is `<Sheet title={h.title(testName)} onClose={onClose} size="lg" detent="large">`. That brings `role="dialog"`, Escape, the focus trap and return, and a bottom sheet on phones.
  - The custom overlay and its bottom "Close" button go.
- **Content.**
  - The trend chart first.
  - While `!loaded`, 3 `SkeletonBlock` rows (`h-11`).
  - Then a grouped list (`bg-surface-2 rounded-lg`, hairlines `divide-separator`). Each row keeps the toggle `button` with `aria-expanded`, the chevron (`text-ink-3`), and "`{date} — {summary}`" in `tabular-nums`, at `min-h-11`.
  - The expanded panel: the same `dl` (`dt text-ink-2`), Notes, and for admins "Delete entry" (`dangerGhost`, Trash2).
  - "Load more" stays secondary, under the same `hasMore` rule.
- **Undo delete (§6.2).**
  - Delete entry, the context-menu item and the swipe action all call `requestDelete(test)`. It hides the row at once (a `Set<string>` of hidden ids), collapses it and clears any error.
  - Then it calls `useUndoable()` with:
    ```ts
    { message: h.deletedNotice(test.date),
      commit: async () => { await deletePhysicalTest(teamId, playerId, test.id); onDeleted?.(); if (mounted.current) await Promise.all([loadFirstPage(), loadSeries()]); },
      onUndo: () => unhide(test.id),
      onCommitError: () => mounted.current ? (unhide(test.id), setDeleteError(h.deleteError)) : onDeleteFailed?.() }
    ```
  - The `ConfirmDialog` and `pendingDeleteId` go. `deleteError` renders as `role="alert"` above the list.
- New prop `onDeleteFailed?: () => void`. `PhysicalTestingSection` uses it to show `h.deleteError` (`role="alert"`) above its rows.
- **Row actions (§6.4), admin only.** Each row is a `HistoryRow` component, because the hook is per row:
  - `useContextMenu({ label: h.rowMenu(test.date), items: [{ kind: 'action', label: h.deleteEntry, danger: true, icon: <Trash2/>, onSelect }], disabled: !isAdmin })`, spread on the `<li>`;
  - `<SwipeRow trailing={[{ label: t.common.delete, tone: 'destructive', undoable: true, onAction }]} disabled={!isAdmin}>`.
- **Strings** under `players.physical.history`:
  - new `deletedNotice`: en `` (d) => `Entry from ${d} deleted` ``, it `` (d) => `Voce del ${d} eliminata` ``;
  - new `rowMenu`: en `` (d) => `Actions for the entry from ${d}` ``, it `` (d) => `Azioni per la voce del ${d}` ``;
  - **remove** `deleteTitle` and `deleteMessage` in en and it. They are unused now.

- [ ] **Step 1: Failing tests.**
  - `PhysicalTestHistoryList.test.tsx`. Wrap renders in `NoticeProvider`. Use `vi.useFakeTimers({ shouldAdvanceTime: true })` where `UNDO_MS` is advanced.
    - `it('is a modal sheet: Escape closes it')`: the `dialog` is named "Countermovement Jump history", and Escape calls `onClose`.
    - `it('delete is an undo: the row leaves at once and the delete runs when the notice expires')`:
      - the row is gone right after "Delete entry";
      - `deletePhysicalTest` has not been called yet;
      - advance `UNDO_MS`: it is called with `('team-1', 'player-1', 'test-1')`, and "No entries yet." shows;
      - no `alertdialog` ever appears.
    - `it('Undo restores the row and never deletes')`.
    - `it('a failed delete brings the row back with the error')`: the alert reads "Could not delete this entry. Please try again.".
    - `it('right-click on a row offers Delete entry to an admin')`, using `fireEvent.contextMenu`.
    - `it('a viewer\'s history rows have no context menu')`: no `menu` role appears after a right-click.
  - `PhysicalTestingSection.test.tsx`:
    - `it('history opens as a sheet and Escape returns focus to View history')`.
    - `it('closing the sheet during the undo window still deletes and refreshes the latest row')`: delete, Escape, advance `UNDO_MS`. `deletePhysicalTest` is called and `fetchLatestTests` is called again.
- [ ] **Step 2:** Run `npx vitest run src/players/PhysicalTestHistoryList.test.tsx src/players/PhysicalTestingSection.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Replace a test.** "deletes an entry after admin confirms, then refetches the list and chart" is replaced by the undo test above. That is an assertion change mapped to §6.2 (the physical-test entry delete becomes Undo).
- [ ] **Step 5:** Run `npx vitest run src/players src/components`. Expected: PASS. These must pass unchanged:
  - "shows \"No entries yet.\" when history is empty";
  - "loads the next page when \"Load more\" is clicked";
  - "expands a row to show every stored measurement and notes";
  - "does not show a delete button for non-admins";
  - all of `PhysicalTestTrendChart.test.tsx`.
- [ ] **Step 6: Commit** `fix(players): physical-test history is a standard sheet with undo delete (B12)`

### Task 5: Page frame, header, toolbar and Privacy (mockup screen 2)

**Files:**
- Create: `src/players/EditPickerSheet.tsx`
- Modify:
  - `src/players/PlayerCardPage.tsx`, `src/players/PlayerIdentityCard.tsx`, `src/components/Skeleton.tsx` (the `player` layout);
  - `src/i18n/en/players.ts`, `src/i18n/it/players.ts`, `src/i18n/italianLabelBudget.test.ts`.
- Test: `src/players/PlayerCardPage.test.tsx`, `src/players/PlayerIdentityCard.test.tsx`, `src/i18n/italian.smoke.test.tsx`

**Interfaces:**
- **Toolbar** (`usePublishPageChrome`):
  - `title: player.fullName`;
  - `mainAction: isAdmin ? { label: c.edit, icon: Pencil, onSelect: () => setPicking(true) } : undefined`;
  - `more: isAdmin ? [{ kind: 'action', label: c.deleteMenu(gender), danger: true, icon: <Trash2/>, onSelect: () => setShowDeleteConfirm(true) }] : []`.

  Nothing is published while loading, not found or errored.
- **`EditPickerSheet({ onPick, onClose })`, where `onPick: (s: 'skills' | 'plan' | 'contact' | 'guardians') => void`:**
  - `Sheet title={c.edit}` (content detent) holds a `GroupedList` of four `ListRow`s with `onClick`: `c.tiles.skills`, `developmentPlan`, `contact`, `guardians`.
  - Picking closes the picker, sets `editingSection`, and switches the segmented control to that section's panel (guardians → contact).
  - The tile-header `EditButton`s are removed. Edit now lives in one place (§6.5).
- **Header**, replacing `PlayerIdentityCard`'s markup. The props stay the same.
  - Above it, a `Link` to `/teams/${teamId}`: ChevronLeft plus `c.backToTeam`, `text-callout text-ink-2 min-h-11`.
  - **Desktop:** a row with
    - the avatar (`h-16 w-16 rounded-full bg-surface-3 text-title-3 text-ink-2`, initials);
    - the `h1 text-title-1 break-words`;
    - the subline `#n · Position · Starting` (`text-callout text-ink-2 tabular-nums`; the number is omitted when 0);
    - the team footnote (`player.teamName`, `text-footnote text-ink-2`);
    - trailing: the average (`text-title-2 tabular-nums text-ink`, `formatNumber(avg, 1)` or `—`), its caption `p.identity.avgSkillScore` (sentence case), and either `<LevelPill level gender>` (band-coloured, §4.6) or "No scores yet".
  - **Phone (< 768):** the same pieces in a centred column, with a 72 px avatar.
  - Under the header, the registration `dl` in a `bg-surface rounded-lg shadow-card` group: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`, `dt text-caption text-ink-2`, `dd text-callout text-ink`. It covers Team, Age group, Season, DOB, Nationality and License, with `—` rules unchanged.
- **Body**, in this order: KPI tiles (`grid-cols-2 lg:grid-cols-4 gap-3`, `PlayerKpiTiles` unchanged), then `<SegmentedControl semantics="tabs" label={c.sectionsLabel} options={sections} value={section} onChange={setSection} className="md:self-start" />`, then the six `role="tabpanel"` panels. It scrolls horizontally on phones and is inline-width from `md`.
- **`Section`** replaces `Tile`:
  - `<section aria-labelledby>`;
  - the header row is `min-h-11`: `h2 text-title-3 text-ink`, the `PendingDot`, then an optional trailing slot;
  - the body is `bg-surface rounded-lg shadow-card p-4`.
- **Privacy panel**, `max-w-[720px]`, as grouped groups:
  1. Guardian consent: the recorded line, or the missing box (`bg-orange-tint rounded-lg`) with the checkbox and Record consent, then the error.
  2. Photo consent: the adult note, or the checkbox, the recorded-by caption and the error.
  3. Membership: the left line with Still in the club, or Mark as left, then the error.
  4. Export: the info paragraph, Export data (JSON) (secondary), then the error.

  The Delete player button is **removed** from the panel; it is in "⋯".
- **Page width and skeleton.** The content is capped at `max-w-[1080px]`. The `player` `PageSkeleton` becomes:
  - a header row (circle plus two lines);
  - 4 tiles;
  - a segmented bar;
  - one group.

  It keeps `role="status"` and the sr-only label.
- New `players.card.deleteMenu`: en `sameForAll('Delete player…')`, it `(g) => agree(g, 'Elimina giocatore…', 'Elimina giocatrice…', 'Elimina giocatore/trice…')`.
- The budget test adds pairs for `players.card.sections.{skills,matches,physical,plan,contact,privacy}`.

- [ ] **Step 1: Failing tests** in `PlayerCardPage.test.tsx`. `renderPlayerCard` now wraps in `WithChrome` and `NoticeProvider`.
  - `it('Edit opens the section picker, and picking Guardians opens that sheet on the Contact panel')`: click the probe "Edit", then the row "Guardians". The dialog "Edit guardians" shows, and the tab "Contact" is selected.
  - `it('Delete player… is in More and still confirms with focus on Cancel')`.
  - `it('a viewer gets no toolbar actions')`: the probe has no buttons.
  - `it('the level pill takes its band colour')`: "Advanced" has `bg-blue-tint`.
  - `it('links back to the team')`.
- [ ] **Step 2:** Run `npx vitest run src/players/PlayerCardPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Update tests.**
  - "lets a team admin delete the player…" clicks the probe "Delete player…" instead of "Delete player". The assertions are unchanged.
  - "splits the profile into sections…" has an assertion change mapped to §6.5. Delete is now the probe's "Delete player…", and there is no in-content "Delete player" button in any panel. The tab order, default and headings are unchanged.
  - "renders the player card in read-only mode…" is unchanged (no "Edit" and no "Delete player" text).
- [ ] **Step 5:** Run `npx vitest run src/players src/components src/i18n src/layout`. Expected: PASS. These must pass unchanged:
  - "shows an avatar with initials and a level badge next to the name";
  - "shows a viewer only the sections they can use";
  - "does not load or show match stats for a viewer";
  - "shows the not-found state…";
  - the export and export-failure tests;
  - the consent, photo and left-club tests;
  - both `PlayerIdentityCard.test.tsx` tests;
  - `PlayerKpiTiles.test.tsx`;
  - `Skeleton.test.tsx`;
  - the `italian.smoke.test.tsx` player card (the tablist name);
  - `playersItalian.test.tsx` "words the position and level by the team gender".
- [ ] **Step 6: Commit** `feat(players): v2 player header, toolbar Edit picker and segmented sections`

### Task 6: Skills, Next objective and Matches panels

**Files:**
- Modify:
  - `src/players/PlayerSkillsSection.tsx` (read view), `src/players/SkillRadarChart.tsx`, `src/players/SuggestionToggle.tsx`, `src/players/PlayerMatchStatsSection.tsx`, `src/players/PlayerCardPage.tsx` (Next objective);
  - `src/components/SkillMeter.tsx`, `src/components/InfoTooltip.tsx`.
- Create: `src/components/InfoTooltip.test.tsx`
- Test: `src/components/SkillMeter.test.tsx`, `src/players/PlayerSkillsSection.test.tsx`

**Interfaces:**
- **Skills read view** (mockup `.gi` rows):
  - the radar, then the average line, on top on phones and left from `sm`;
  - then a list of 9 rows, `min-h-[52px]`, hairlines inset (`divide-y divide-separator`), each a grid of:
    - the label (`text-callout`, `text-orange-strong` plus Target when `priority`, then ⓘ);
    - the meter (`flex-1`);
    - the score (`text-headline tabular-nums`, right-aligned);
    - the Adapt cell.
  - The label-column widths per locale are kept.
- **Adapt** keeps its aria-label and arrows, now `min-h-11 rounded-full px-3 text-footnote` with `bg-green-tint text-green-strong` or `bg-orange-tint text-orange-strong`.
- **SuggestionToggle:** on is `bg-surface-3 text-ink`, off is `text-ink-2 hover:bg-surface-2`. It is `min-h-11`; `aria-pressed`, title and label are unchanged.
- **SkillMeter:** filled segments keep `bg-{band}`. Unfilled are `bg-surface-2 border-separator`; the ghosts are unchanged. The segment height is `h-2`, and the boundary gaps after 3, 5 and 7 stay.
- **SkillRadarChart:** the no-level stroke is `stroke-ink-3` and the no-level fill `fill-ink/10`. Grid rings use `stroke-separator`, labels `fill-ink-2`. The band fills and strokes are unchanged.
- **InfoTooltip (§8.3 "guide text opens on tap"):**
  - The trigger keeps its 16 px icon but gets a 44 px hit area (`relative` plus `before:absolute before:-inset-3.5`), `text-ink-2 focus-visible:ring-focus`.
  - Desktop: hover and focus open it as today. A click **pins** it open; a second click, Escape or a pointer-down outside closes it.
  - Phone (`(max-width: 767px)`): a click opens `<Sheet title={label}>{children}</Sheet>`, and no tooltip is shown.
  - The panel tokens: `rounded-xl bg-surface p-3 text-footnote text-ink shadow-pop`, no border.
- **SkillGuideHint:** the ranges and how-to-evaluate use `text-ink-2`.
- **Next objective:**
  - the objective in `text-headline`, then the `StatusChip`;
  - `c.due(date)` or `c.noTargetDate` in `text-footnote text-ink-2 tabular-nums`;
  - the comment in `text-callout text-ink-2`;
  - the empty text in `text-ink-2`.
- **Match stats:**
  - the 5 boxes become `StatTile`s (`grid-cols-2 sm:grid-cols-5`, labels unchanged);
  - the table is borderless, with hairline rows, a sticky `text-caption text-ink-2` header and `tabular-nums`;
  - the opponent link is `text-ink underline-offset-2 hover:underline`;
  - loading, error and empty texts are unchanged.

- [ ] **Step 1: Failing tests.**
  - `InfoTooltip.test.tsx`:
    - `it('a click pins the popover open; a second click or Escape closes it')`;
    - `it('on a phone a tap opens the guide in a sheet titled by its label')`, mocking `matchMedia` like `Sheet.test.tsx`.
  - `PlayerSkillsSection.test.tsx`: `it('Adapt is a 44 px pill in the suggestion\'s colour')`. It has `min-h-11`, and `text-green-strong` for an upward suggestion.
- [ ] **Step 2:** Run `npx vitest run src/components/InfoTooltip.test.tsx src/players/PlayerSkillsSection.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Selector update.** `SkillMeter.test.tsx` "renders unfilled segments with a neutral border color…" changes `border-border` to `border-separator`. That is markup only; the "no band colour" assertion stays.
- [ ] **Step 5:** Run `npx vitest run src/players src/components src/theme`. Expected: PASS. These must pass unchanged:
  - every other `SkillMeter` test;
  - "reveals a guide-definition tooltip when the info button is focused";
  - "marks a priority skill with an inline focus-area icon…";
  - the whole `match suggestions` describe;
  - `SkillRadarChart.test.tsx`, `skillRadar.test.ts`;
  - `PlayerMatchStatsSection.test.tsx`;
  - `SuggestionToggle.test.tsx`;
  - `skillGuideFallbackItalian.test.tsx`;
  - "shows match stats and skill suggestions to a team admin".
- [ ] **Step 6: Commit** `feat(players): v2 skills rows, meter and radar; guide opens on tap`

### Task 7: Section editors as sheets, and grouped read views

**Files:**
- Modify: `src/players/PlayerSkillsSection.tsx` (editor), `src/components/DevelopmentPlanEditor.tsx`, `src/players/PlayerContactSection.tsx`, `src/players/GuardiansSection.tsx`
- Test: `src/players/PlayerSkillsSection.test.tsx`, `src/components/DevelopmentPlanEditor.test.tsx`, `src/players/GuardiansSection.test.tsx`, `src/players/PlayerContactSection.test.tsx`

**Interfaces:**
- **Every editor becomes a `Sheet` with `guardUnsaved` and a `confirm`.** The in-body Cancel and Save buttons are removed.
  - The Sheet's own header (phone) or footer (desktop) Cancel is guarded, so a dirty Cancel asks "Discard changes?" (§4.6) and a clean one closes at once.
  - The error stays an inline `role="alert"` in the body, under the fields.

  | Editor | Sheet | `confirm` |
  |---|---|---|
  | Skills | `title={p.skills.editTitle}`, `detent="large"` | `{ label: p.skills.saveSkills, onConfirm: handleSave, disabled: saving }` |
  | Plan | `size="lg"`, `detent="large"`, `onClose={handleCancel}` | `{ label: c.save, form: 'development-plan-form', disabled: saving }` (the existing `<form>` gets the id) |
  | Contact | `title={p.contact.dialogTitle}` | `{ label: t.common.save, form: 'player-contact-form', disabled: saving }` |
  | Guardians | `onClose={handleCancel}` | `{ label: t.common.save, form: 'player-guardians-form', disabled: saving }` |

  - `DevelopmentPlanEditor` gains a `saving` state with a ref guard around `onSave`. A second submit while one is in flight is ignored, which also covers the team Plan tab.
  - Cancel through the guard still resets each draft, because `onClose` is the existing reset handler.
- **Editor body styling.** Each skill is a block with label plus ⓘ, a 16 px number `Input w-20`, the live meter and the Focus area checkbox (`accent-[rgb(var(--color-ink))]`). Hairlines are `border-separator`. The preview average line is `text-callout text-ink-2`.
- **Read views** become label/value grouped rows (`min-h-11`, hairlines, `dt text-ink-2`, `dd text-ink tabular-nums`):
  - **Contact:** Number, Position (plus "Starting" as `bg-green-tint text-green-strong`), Shirt size, Phone, License, Nationality.
  - **Guardians:** one row per guardian: the name in `text-headline` with the relation in `text-ink-2`, then the phone and email (`break-all`).
  - **Plan:** the objective cards keep their status accent (Not started `ink-3`, others unchanged), on `bg-surface-2 rounded-lg`. Group headers are sentence case `text-title-3`.
- Labels, aria-labels, field order, HealthHints, "Remove guardian" rule and the stored English codes are unchanged.

- [ ] **Step 1: Failing tests.**
  - `PlayerSkillsSection.test.tsx`:
    - `it('Cancel on an edited skills sheet asks to discard; a clean Cancel closes at once')`;
    - `it('a second Save while saving writes once')`: double-click "Save skills" with a deferred write; `updatePlayerSkills` is called once.
  - `DevelopmentPlanEditor.test.tsx`: `it('a second Save while the plan is saving is ignored')`.
- [ ] **Step 2:** Run `npx vitest run src/players/PlayerSkillsSection.test.tsx src/components/DevelopmentPlanEditor.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Step changes mapped to §4.6** (Cancel asks "Discard changes?" when dirty). Each test adds one click on "Discard" after "Cancel", and the rest of its assertions are unchanged:
  - `GuardiansSection.test.tsx` "discards edits when Cancel is clicked…";
  - `DevelopmentPlanEditor.test.tsx` "discards edits when Cancel is clicked…".
- [ ] **Step 5:** Run `npx vitest run src/players src/components src/teams src/i18n`. Expected: PASS. These must pass unchanged:
  - "sets a score, computes avg/level, and saves";
  - "shows an error message when the save is rejected";
  - "marks a skill as a focus area via the priority checkbox";
  - "in the editor, Use fills the score without saving…";
  - all of `PlayerContactSection.test.tsx`;
  - "edits a guardian and saves";
  - "adds a short-term objective and saves the whole plan";
  - "shows a save error without discarding edits";
  - "manages its own edit state when the editing prop is omitted (team plan tab)";
  - `playersItalian.test.tsx` "saves the English position code…" and "saves the English objective status…";
  - the `TeamPage.test.tsx` plan-tab tests;
  - `Dialog.test.tsx`.
- [ ] **Step 6: Commit** `feat(players): editors are sheets with a guarded Cancel; grouped read views`

### Task 8: Physical panel and the screen-8 add sheet

**Files:**
- Modify: `src/players/PhysicalTestingSection.tsx`, `src/players/AddPhysicalTestDialog.tsx`, `src/components/AttemptsInput.tsx`, `src/players/PhysicalTestTrendChart.tsx`, `src/players/PlayerCardPage.tsx` (passes the identity props)
- Test: `src/players/AddPhysicalTestDialog.test.tsx`, `src/components/AttemptsInput.test.tsx`, `src/players/PhysicalTestingSection.test.tsx`

**Interfaces:**
- **Physical rows.** A grouped list with rows `min-h-[52px]`:
  - the test name (`text-headline`) plus the `PendingDot`;
  - the subline "`{summary} — {date}`" or `p.noData` (`text-footnote text-ink-2 tabular-nums`);
  - trailing: View history (`ghost`) and Add new (`secondary`, admin plus visible type only).

  The load-error alert still replaces the list.
- `PhysicalTestingSection` gains `player?: { fullName: string; number: number }`, passed from the page, and forwards it with `latestByType[type]` to the add sheet.
- **`AddPhysicalTestDialog`** gains optional `player?: { fullName: string; number: number }` and `latest?: PhysicalTest | null`. They are optional, so the existing tests render unchanged.
  - **Shell:** `<Sheet title={a.title(testName)} detent="large" guardUnsaved confirm={{ label: saving ? t.players.shared.saving : t.common.save, form: 'physical-test-form', disabled: saving }}>`.
    - The form gets `id="physical-test-form"` and keeps its `aria-label`.
    - The in-body Cancel and Save are removed.
  - **Identity block (screen 8), only when `player` is given:**
    - centred on phones and leading on desktop;
    - the avatar (`h-14 w-14 rounded-full bg-surface-3 text-ink-2`, initials);
    - the name in `text-headline`;
    - `#n · {formatPhysicalTestSummary(latest)}`, or `#n · {p.noData}`, in `text-footnote text-ink-2 tabular-nums`. The number is omitted when 0.
  - **Measurement inputs** (Height, Body mass, Standing reach, Shuttle, Weight, Reps, and every attempt) are `text-stat tabular-nums text-center`. Their `inputMode` is `"decimal"`, or `"numeric"` for reps. Their labels (`text-footnote text-ink-2`) are unchanged.
  - Date, Notes, the mode select and the exercise selects stay `body` size.
  - The ratio line is `text-callout text-ink-2 tabular-nums`.
- **`AttemptsInput`** gains `size?: 'md' | 'stat'` (default `'md'`). `'stat'` puts the attempts in a `grid-cols-3 gap-2` grid of stat-size inputs. "+ Add attempt" and "Remove last attempt" are secondary and `min-h-11`. Ids and labels are unchanged.
- **Trend chart:**
  - the line is `stroke-ink`, the dots `fill-ink`, the callouts and dates `fill-ink-2`;
  - the box is `bg-surface-2 rounded-lg` with no border;
  - the one-point box is styled the same.

  Values, orientation and copy are unchanged.

- [ ] **Step 1: Failing tests.**
  - `AddPhysicalTestDialog.test.tsx`: `it('shows who is being tested and their latest result')`. With `player={{ fullName: 'Giulia Bianchi', number: 9 }}` and a sprint `latest`, it shows "GB", "Giulia Bianchi" and "#9 · 1.79 s".
  - `AttemptsInput.test.tsx`: `it('stat size lays attempts out in a grid of large inputs')`.
- [ ] **Step 2:** Run `npx vitest run src/players/AddPhysicalTestDialog.test.tsx src/components/AttemptsInput.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/players src/components`. Expected: PASS. These must pass unchanged:
  - every `AddPhysicalTestDialog.test.tsx` payload test;
  - "blocks submission…";
  - "saves the entry once even when Save is clicked twice";
  - "is a modal dialog: Escape closes it untouched, and asks before discarding typed changes";
  - every `PhysicalTestingSection` test;
  - `AttemptsInput.test.tsx`;
  - `PhysicalTestTrendChart.test.tsx`;
  - `HealthHint.test.tsx`;
  - `physicalTestFormat*.test.ts*`.
- [ ] **Step 5: Commit** `feat(players): v2 physical rows and a focused add-test sheet`

### Task 9: Gate and user checklist

**Files:** none new.

- [ ] **Step 1:** Run `npm test`, `npm run lint` and `npm run build`. Expected: all green, with 0 lint errors. If a known flaky load-timeout test fails (the Italian smoke test or PlayerCard), rerun that file alone and report both results.
- [ ] **Step 2: Greps.** Each should print nothing:
  - `grep -rnE "dark:|navy|slate|border-border|text-white|bg-black/" src/players src/components/{SkillMeter,InfoTooltip,AttemptsInput,DevelopmentPlanEditor}.tsx --include=*.tsx | grep -v test | grep -v AddPlayerDialog`;
  - `grep -rn "todayIso" src/players`;
  - `grep -n "fixed inset-0" src/players/PhysicalTestHistoryList.tsx`.
- [ ] **Step 3: Commit** any lint-only fix-ups as `chore(players): gate fix-ups`, if there are any.
- [ ] **Step 4: User checklist** for the group report. The user runs it on a real phone and a desktop, in light and dark mode.
  - **Against the mockup (screen 2).** Check the back link, the avatar, name, number and position line, and the band-coloured level pill with the average. Then the four KPI tiles, the segmented sections (scrolling on a phone), and skills as rows with 10-segment meters in band colours. The toolbar shows Edit and "⋯". Nothing is blue except the Advanced band.
  - **Edit picker.** Edit opens Skills / Development plan / Contact & registration / Guardians, and each opens its sheet. On a phone: the header reads Cancel · title · Save; a dirty Cancel asks; flick down is refused while dirty.
  - **Guide.** Tap ⓘ: a popover on desktop, a sheet on a phone.
  - **B13.** In airplane mode, save skills, the plan, contact, guardians, consent, photo, left club and a physical test. Each closes at once with "Saved on this device · will sync" and shows a dot. Reconnect: the dots clear. Online, a save still waits, and a rejected one keeps the sheet open with its error.
  - **B12 and undo.** View history opens a sheet: Escape closes it, and it is a bottom sheet on a phone. Delete an entry, then Undo: it comes back. Delete, wait 6 s: it is gone and the latest row updates. Long-press or right-click a row (admin), and swipe on a phone.
  - **Screen 8.** On a phone, Add new opens a full-height sheet with the player block and large numeric fields; the decimal keypad shows.
  - **B8.** Just after local midnight, Mark as left and Record consent store today's local date.
  - **Viewer.** If one can be reached: no Edit, no "⋯", no Privacy or Matches, and no Delete on history.
  - Italian: the section tabs, the picker rows and "Elimina giocatore…" fit.
  - `tailwind.config.js` did not change, so no dev-server restart is needed. If it did change, restart.
