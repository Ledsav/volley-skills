# UI Redesign 4a: Scouting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the scouting area (inventory 04) in the v2 system. Live scouting becomes an always-dark instrument: header for state and corrections, one status strip, the court, and a dock for match events. It fixes B4–B7. The Matches tab and the Match page move their actions to the toolbar. Recording stays exactly as fast and as safe as it is today.

**Architecture:**
- **Bug fixes get their own small units, tested first.** ScoutPage already has 790 lines, so the new logic does not go into it:
  - `undoTarget.ts` is pure (B7);
  - `useWriteError.ts` is a hook (B4);
  - `statusStrip.ts` is pure, and `StatusStrip.tsx` renders it (B4);
  - `useDeviceTakeover.ts` is a hook that also owns the heartbeat (B5).
- **Forced dark.** `ScoutRoot` puts `.dark` and `color-scheme: dark` on the scouting subtree only. Menus, sheets and alerts in scouting render inline (only `ContextMenu` and `InfoTooltip` use portals), so they inherit the dark theme.
- **Toolbar ownership.** The Match page publishes its main action through `PageHeader`. A team tab can own the toolbar because `PageHeader` gains `publishChrome`. `MenuItem` gains `disabled`, for the offline import.

**Not in this plan:**
- Match report, CSV, print stylesheet and the Stats tab (area 05). `GRADE_CLASS` (the report's) stays as it is.
- Removing "Season awards" from the Stats tab (area 05). This plan only adds it to the Matches "⋯".
- The team page's segmented tabs, and the other tabs' main actions (area 02).
- Insert-mode context, timeline grouping and a Finish summary (pain points 6, 7, 22). They are not agreed changes.

**Tech Stack:** React 18, TypeScript strict (noUnusedLocals/Parameters), React Router v7, Tailwind with CSS-variable tokens (no `dark:`), Vitest + Testing Library (jsdom), Firestore web SDK, lucide-react.

**Spec:**
- `docs/superpowers/specs/2026-10-28-ui-redesign-design.md`:
  - §8.4 (scouting);
  - §4.2 B4, B5, B6, B7;
  - §6.3 sheets, §6.4 context menu (Matches row), §6.5 main action (Match page setup and finished, Team · Matches);
  - §10 testing, §11 item 4.
- Parity contract: `docs/superpowers/specs/ui-redesign-inventory/04-scouting.md`, with all 64 invariants, the §20 hotkey table and the interaction-speed table. Read its README's cross-cutting rules too.
- Design rules: `docs/design/design-system/README.md` §2–§9. Mockup: `docs/design/design-system/mockups/volley-skills-v2.html`, phone "live scouting" (`.scout` CSS at lines 179–205, markup at 476–500).

## Global Constraints

**Parity**
- Every inventory-04 invariant holds. Existing tests change selectors or markup only. Assertion changes are allowed only where a task maps them to B4–B7 or §6.5.
- Hotkeys are unchanged. `KEY_MAP` stays the single source.
- Kbd badges stay desktop-only (`hidden lg:inline-flex`).
- Event writes (`addEvent`, deletes, edits, reason amends, Start scouting) stay **un-awaited**. Nothing new blocks on the network.
- No toast or notice for normal records. Undo shows no success notice.

**Scouting layout**
- Grouping is fixed (user memory: group by meaning). Nothing moves between groups:
  - the **header** holds state and corrections: score, set, rotation arrows and Undo, plus the "⋯" trigger;
  - the **dock** holds match events only: Point us, Point them and the two T/O buttons;
  - **"⋯"** holds tools: Quick score, Auto-select, Text panel, Keyboard shortcuts, Exit.
- **Undo never goes next to the timeouts.**
- **Theme.** The scouting route root carries the class `dark` and `style={{ colorScheme: 'dark' }}`. `document.documentElement` is never touched.
  - The Match page and the Matches tab use the app theme.
- **Recording targets** are at least 56 px tall on phones (`min-h-14`): court tiles, fundamental chips, grade chips, Point us/them, T/O, reason chips and bench chips. Other controls are at least 44 px.
- **Press feedback on recording targets** is `tapFlash` (80 ms `surface-3`), never `.pressable` or any scale. Keyboard-triggered records never flash.
- `navigator.vibrate?.(10)` is called **only** when the 500 ms long-press substitution fires. Nothing else vibrates.
- The desktop breakpoint for scouting stays `(min-width: 1024px)`, which is parity.

**Visual**
- Colour comes only from tokens. Legacy tokens are retired in every file this plan touches under `src/matches/` (except `report/`):
  - `navy`, `slate`, `border-border`;
  - `blue` as an accent;
  - `text-white`.
- Text in a data colour uses `-strong`. `src/theme/dataColourText.test.ts` stays green.
- Type roles:
  - the score is `text-score tabular-nums`;
  - the status line is `text-footnote text-ink-2`;
  - group headers are sentence case and never uppercase.

**Strings, data, gates**
- Every new string goes in `src/i18n/en/*.ts` and `src/i18n/it/*.ts`. Those are the shipped languages.
- `src/i18n/italianLabelBudget.test.ts` stays green, and Task 6 adds the scouting dock and tab labels to it.
- Rules: no change. B5 only reads the match doc, which `allow read: if (activeMember() && teamAdmin()) || exporter()` already permits. `activeDevice` writes already pass the `update` rule. No index changes either, because a single-doc listener needs none.
- Never commit `serviceAccountKey.json` (or `.enc`), `*.vsbackup`, private keys, `.env.local` or `reference/`.
- Commit only as the steps say. Don't push or merge, and add no dependency.
- Gates per group: `npm test`, `npm run lint` (0 errors) and `npm run build`. `npm run test:rules` is not needed, because nothing touches rules or indexes.

## Review Focus

1. **A rejected write, then rapid taps.** The coach taps on, writes already in flight are acknowledged, and the error strip must not vanish within milliseconds. It clears only when a write issued *after* the strip appeared is acknowledged, or on Dismiss.
   - Pinned in Task 3 by "a write issued before the error does not clear it".
2. **A takeover while the action panel is open.** Taps on grades or points, and keys, must write nothing. The heartbeat stops.
   - Pinned in Task 4 by "a takeover blocks taps and keys even with the action panel open".
3. **A reopened imported match with a few new taps.** Undo removes the taps one by one, then disables at the import boundary. It never offers to delete the import.
   - Pinned in Task 1 by "undo on a reopened import removes taps, then stops at the import".
4. **The error strip hides Finish.** After "Could not load usage history…", the error outranks match over. Dismiss must bring Finish match back.
   - Pinned in Task 3 by "after a usage error, Dismiss brings back Finish match".
5. **Overlays in forced dark.** The tools menu, the set-start sheet and the confirm alerts must render inside the dark root, not in the app theme. Leaving scouting must restore the app theme with nothing left on `<html>`.
   - Pinned in Task 5 by "menus and sheets render inside the dark root" and "never touches the html element's theme".

---

## File Structure

| File | Responsibility |
|---|---|
| `src/matches/scout/undoTarget.ts` (create) | B7: which events Undo removes; `onlyImports` |
| `src/matches/scout/useWriteError.ts` (create) | B4: error message, write sequence, clear on a later ack, dismiss |
| `src/matches/scout/statusStrip.ts` (create) | B4: `pickStrip` priority (error > match over > between sets > inserting) |
| `src/matches/scout/StatusStrip.tsx` (create) | The single slim strip with each kind's buttons |
| `src/matches/matchesApi.ts` (modify) | `subscribeMatch` (match doc listener) |
| `src/matches/scout/useDeviceTakeover.ts` (create) | B5: listener, takeover state, heartbeat, take back |
| `src/matches/scout/TakeoverSheet.tsx` (create) | B5: the non-dismissable "Scouting moved to another device" alert |
| `src/matches/scout/ScoutRoot.tsx` (create) | The forced-dark root (`.dark` + `color-scheme`) |
| `src/motion/tapFlash.ts` (create) | `tapFlash(el)`: an 80 ms `data-flash` attribute, with no React state |
| `src/index.css` (modify) | The `[data-flash]` rule |
| `src/matches/scout/ScoutPage.tsx` (modify) | Wires all of the above; frame, phone segmented tabs, set-point prompt |
| `src/matches/scout/{ScoutHeader,RallyBar,CourtGrid,BenchStrip,ActionSheet,gradeStyles,Kbd,HotkeyCheatSheet,SetStartDialog,SubDialog,CorrectionDialog,EditEventDialog,LiveStatsPanel,TimelineDrawer,RoleChip}.tsx` (modify) | v2 dark restyle; B6 in SetStartDialog |
| `src/matches/text/{TextScoutPanel,PreviewRallyCard}.tsx`, `src/matches/dvw/{DvwImportDialog,DvwReview}.tsx` (modify) | v2 restyle, steps and states unchanged |
| `src/components/{Menu,MenuList}.tsx`, `src/layout/{PageChrome,PageHeader}.tsx`, `src/test/chromeProbe.tsx` (modify) | `MenuItem.disabled`; `publishChrome` / `enabled` |
| `src/matches/TeamMatchesTab.tsx`, `src/teams/TeamPage.tsx` (modify) | Toolbar main action and "⋯"; grouped rows; row context menu |
| `src/matches/{MatchPage,MatchSetupForm}.tsx` (modify) | Toolbar per state; grouped setup form |
| `src/App.tsx` (modify) | Scouting lazy fallback inside `ScoutRoot` |

---

### Task 1: B7: Undo skips imported events

**Files:**
- Create: `src/matches/scout/undoTarget.ts`, `src/matches/scout/undoTarget.test.ts`
- Modify: `src/matches/scout/ScoutPage.tsx` (`undo()`), `src/matches/scout/ScoutHeader.tsx`, `src/i18n/en/scout.ts`, `src/i18n/it/scout.ts`
- Test: `src/matches/scout/ScoutPage.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface UndoTarget { kind: 'none' | 'importOnly' | 'single' | 'batch'; ids: string[]; stack: string[] }
  export function undoTarget(events: MatchEvent[], stack: readonly string[]): UndoTarget;
  export function onlyImports(events: MatchEvent[]): boolean; // events.length > 0 && every source === 'import'
  ```
- The rules for `undoTarget`:
  - It pops `stack` from the end, skipping ids that are missing from `events` **or** whose event has `source: 'import'`.
  - Otherwise it takes the last event by `order` (`sortEvents`) whose source is not `'import'`.
  - If that event's `chunkId` is shared by more than one non-import event, the result is `batch` with all of them. Otherwise it is `single`.
  - `stack` in the result is what remains after popping.
  - The result is `none` when `events` is empty, and `importOnly` when only imports remain.
- `ScoutHeader` gains `undoHint: string | null`. When it is non-null:
  - the Undo button is `disabled`;
  - it has `aria-describedby` pointing to a visible `text-caption text-ink-2` line holding the hint.
- Strings:
  - New `scout.page.undoImportHint`: en `"Imported events can't be undone"`, it `"Gli eventi importati non si possono annullare"`.
  - Changed `undoBatchTitle`:
    - en `` (n) => `Undo text batch (${n} events)?` ``;
    - it `` (n) => `Annullare il blocco di testo (${plural('it', n, { one: '1 evento', other: `${n} eventi` })})?` ``.

- [ ] **Step 1: Failing unit tests** in `undoTarget.test.ts`, with fixtures built from `MatchEvent` literals:
  - `it('pops this device\'s stack first, skipping ids no longer in the snapshot')`: with stack `['e2', 'gone']` and events e1–e3, `'gone'` is skipped and the result is `{ kind: 'single', ids: ['e2'], stack: [] }`.
  - `it('falls back to the last event by order')`: an empty stack gives `ids ['e3']`.
  - `it('skips imported events in the stack and in the fallback')`: events i1–i3 (`source: 'import'`, `chunkId: 'imp'`) and t4 (tap). Stack `['i3']` gives `{ kind: 'single', ids: ['t4'] }`.
  - `it('a text batch returns every event of its chunk')`: two `source: 'text'` events sharing `chunkId: 'c'` give `kind: 'batch'` with both ids.
  - `it('only imports left is importOnly; no events is none')`. Also check `onlyImports([])` is `false`.
- [ ] **Step 2: Failing page tests** in `ScoutPage.test.tsx`:
  - `it('undo on a reopened import removes taps, then stops at the import')`:
    - The events are `setStart` and two actions, all `source: 'import'` with `chunkId: 'imp'`, plus one tap timeout `t1`.
    - Undo calls `deleteEvents` with `['t1']` and no `alertdialog` appears.
    - Then `pushEvents` without `t1`. The Undo button is disabled and described by "Imported events can't be undone". Ctrl+Z calls nothing.
  - `it('a text batch confirms with wording that names the source')`: two text events with a shared chunk. Undo opens an `alertdialog` named `'Undo text batch (2 events)?'`.
- [ ] **Step 3:** Run `npx vitest run src/matches/scout/undoTarget.test.ts src/matches/scout/ScoutPage.test.tsx`. Expected: FAIL.
- [ ] **Step 4: Implement.**
  - `undo()` becomes:
    - `const t = undoTarget(events, writtenRef.current); writtenRef.current = t.stack;`
    - then the same branches as today: confirm for `batch`, delete un-awaited for `single`, anchor clearing, reason-prompt clearing.
    - `none` and `importOnly` return early.
  - Pass `undoHint={onlyImports(events ?? []) ? sp.undoImportHint : null}` to the header.
- [ ] **Step 5:** Run `npx vitest run src/matches src/i18n`. Expected: PASS. These existing tests must pass unchanged:
  - "undo deletes the last event";
  - "undo after an insert deletes the inserted event, not the tail";
  - "undo clears the insert anchor when the anchor event is deleted";
  - "Ctrl+Z and Backspace undo";
  - "records nothing between sets, but Undo still works";
  - `wording.test.ts`.
- [ ] **Step 6: Commit** `fix(scout): undo skips imported events and names text batches (B7)`

### Task 2: B6: Set 1 has no serve default

**Files:**
- Modify: `src/matches/scout/SetStartDialog.tsx`, `src/matches/scout/ScoutPage.tsx` (`nextSetServing`), `src/i18n/en/scout.ts`, `src/i18n/it/scout.ts`
- Test: `src/matches/scout/SetStartDialog.test.tsx`, `src/matches/scout/ScoutPage.test.tsx`

**Interfaces:**
- `SetStartDialogProps.initialServing: Side | null`. The local state is `Side | null`.
- Start is disabled while the lineup hint shows **or** `serving === null`.
- The hint shown is `error ?? (serving === null ? t.chooseServe : null)`, in the same slate-to-`ink-2` hint spot. It is not an alert, which is parity.
- `nextSetServing(events: MatchEvent[]): Side | null`:
  - It returns `null` when no `setStart` exists.
  - Otherwise it returns the opposite of the last `setStart.serving`.
  - The `fallbackServing` parameter is removed.
- New `scout.setStart.chooseServe`: en `'Choose who serves first.'`, it `'Scegli chi batte per primo.'`.
- The serve control keeps two `<input type="radio" name="serving">` with the labels "We serve" and "They serve", restyled in Task 7. With `null`, neither is checked.

- [ ] **Step 1: Failing tests.**
  - `SetStartDialog.test.tsx`: `it('with no serve default, Start stays disabled until a side is chosen')`, rendered with `initialServing={null}`:
    - neither radio is checked;
    - Start is disabled;
    - the text `'Choose who serves first.'` is shown;
    - clicking "We serve" enables Start, and clicking it calls `onStart` with `serving` `'us'`.
  - `ScoutPage.test.tsx`: `it('set 1 has no serve default')`. In `renderPage([])`'s dialog, both radios are unchecked and "Start set" is disabled.
- [ ] **Step 2:** Run `npx vitest run src/matches/scout`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Update the existing set-1 tests.** These tests click "Start set" in the set-1 dialog, so B6 adds one serve click before it. That is a step change mapped to §4.2 B6, not an assertion change:
  - "Start set writes the per-set roles…": click "They serve".
  - "Start set leaves the roster alone…": click "They serve".
  - "selects the server once a set starts with us serving": click "We serve".
  - "scouts a whole receiving rally from the keyboard": click "They serve".

  "defaults the next set's first serve to the other side…" stays unchanged: set 2 still alternates.
- [ ] **Step 5:** Run `npx vitest run src/matches`. Expected: PASS.
- [ ] **Step 6: Commit** `fix(scout): set 1 requires a first-serve choice (B6)`

### Task 3: B4: Status strip and the clearing write error

**Files:**
- Create: `src/matches/scout/useWriteError.ts`, `src/matches/scout/useWriteError.test.ts`, `src/matches/scout/statusStrip.ts`, `src/matches/scout/statusStrip.test.ts`, `src/matches/scout/StatusStrip.tsx`
- Modify: `src/matches/scout/ScoutPage.tsx`, `src/i18n/en/scout.ts`, `src/i18n/it/scout.ts`
- Test: `src/matches/scout/ScoutPage.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface WriteErrorApi {
    error: string | null;
    show(message: string): void;                         // stamps the current write sequence
    track(written: Promise<unknown>, message: string): void; // one event write: next sequence number
    dismiss(): void;
  }
  export function useWriteError(): WriteErrorApi;
  ```
- How `useWriteError` works:
  - `track` assigns `seq = ++counter`.
    - When it resolves, the error clears if one is shown and `seq > stamp`.
    - When it rejects, it calls `show(message)`.
  - `show` sets the message and `stamp = counter`.
  - Only `addEvent` writes (`record` and `mergeText`) use `track`. Deletes, edits, reasons, roster and usage failures use `show`.
  - Refs hold the counter and stamp, so a `track` costs no re-render.
- Produces the strip:
  ```ts
  export type StripKind = 'error' | 'matchOver' | 'betweenSets' | 'inserting';
  export function pickStrip(f: { error: boolean; matchOver: boolean; betweenSets: boolean; inserting: boolean }): StripKind | null;
  ```
- `StatusStrip` takes one discriminated prop per kind:
  - **`error`** has `role="alert"`, the message and a **Dismiss** button.
  - **`matchOver`** shows "Match over · X–Y" with **Finish match**.
  - **`betweenSets`** shows `setLineup` or `setOver(...)`, plus **Undo set end** (only after set 1) and **Start set N**.
  - **`inserting`** shows "Inserting into the timeline" with **Back to live**.
- Strip visuals:
  - one slim row, `min-h-11`, under the header;
  - error is `bg-red-tint text-red-strong` and match over is `bg-green-tint`;
  - between sets and inserting are neutral `bg-surface-2`;
  - buttons are 44 px.
- New `scout.page.dismiss`: en `'Dismiss'`, it `'Chiudi'`.

- [ ] **Step 1: Failing unit tests.**
  - `useWriteError.test.ts` (`renderHook`, with deferred promises):
    - `it('a rejected write shows the message')`.
    - `it('a write issued after the error clears it once acknowledged')`.
    - `it('a write issued before the error does not clear it')`: w1 pending, w2 rejects (shown), w1 resolves (still shown), w3 resolves (cleared).
    - `it('stays while later writes are also rejected')`.
    - `it('dismiss clears it')`.
  - `statusStrip.test.ts`:
    - `it('error outranks match over, which outranks between sets, which outranks inserting')`;
    - `it('nothing to show is null')`.
- [ ] **Step 2: Failing page tests** in `ScoutPage.test.tsx`:
  - `it('the write-error strip clears when a later write is acknowledged')`:
    - the first `addEvent` returns `written: Promise.reject(...)`, so the alert "An action could not be saved…" shows;
    - the next tap resolves, and the alert is gone (`waitFor`).
  - `it('after a usage error, Dismiss brings back Finish match')`: as in "does not finish when usage history cannot be reloaded". Then click Dismiss, and the "Finish match" button is back.
  - `it('shows one strip at a time')`: an insert anchor plus a write error shows only the alert. Dismiss shows "Inserting into the timeline".
- [ ] **Step 3:** Run `npx vitest run src/matches/scout`. Expected: FAIL.
- [ ] **Step 4: Implement.**
  - Replace `writeError` state and the four banner blocks in ScoutPage with `useWriteError()` plus one `<StatusStrip>` chosen by `pickStrip`.
  - `betweenSets` = `!state.inSet && !state.matchOver`.
- [ ] **Step 5:** Run `npx vitest run src/matches/scout`. Expected: PASS. These existing tests must pass unchanged:
  - "after a set ends, offers Start set and Undo set end…";
  - "between sets, nothing can be recorded but Undo set end still works";
  - "finishes the match once it is over";
  - "does not finish when usage history cannot be reloaded";
  - "undo clears the insert anchor…";
  - "deleting the anchor event from the timeline clears the anchor";
  - "closing the first-set dialog keeps the scout screen usable".
- [ ] **Step 6: Commit** `fix(scout): one status strip; the write error clears on a later ack (B4)`

### Task 4: B5: Takeover sheet

**Files:**
- Create: `src/matches/scout/useDeviceTakeover.ts`, `src/matches/scout/useDeviceTakeover.test.ts`, `src/matches/scout/TakeoverSheet.tsx`
- Modify: `src/matches/matchesApi.ts`, `src/matches/matchesApi.test.ts`, `src/matches/scout/ScoutPage.tsx`, `src/i18n/en/scout.ts`, `src/i18n/it/scout.ts`
- Test: `src/matches/scout/ScoutPage.test.tsx`

**Interfaces:**
- Produces `subscribeMatch(teamId: string, matchId: string, onChange: (m: Match | null) => void, onError: (e: Error) => void): () => void`. It is `onSnapshot(matchDoc(...))` mapped with `toMatch`, and gives `null` when the doc doesn't exist.
- Produces `useDeviceTakeover(o: { teamId: string; matchId: string; deviceId: string; active: boolean }): { takenOver: boolean; takeBack: () => void }`.
  - While `active`, it subscribes. It sets `takenOver` when `isLockedByOther(m.activeDevice, deviceId, Date.now())`: another id whose heartbeat is less than 2 minutes old.
  - The **heartbeat moves here**: `setInterval(claimDevice, 60_000)` while `active && !takenOver`. The effect deps are only `[active, takenOver, teamId, matchId, deviceId]`.
  - `takeBack()` calls `claimDevice` (un-awaited, errors ignored) and sets `takenOver` to false.
  - Errors from the listener are ignored, so scouting continues.
- `<TakeoverSheet onTakeBack onLeave />`:
  - It is a `role="alertdialog" aria-modal="true"`, laid out like `ConfirmDialog`: a centred alert on desktop and an action sheet on phones.
  - It is registered with `useModalLayer(() => {}, panelRef)`, so Escape does nothing.
  - It has no scrim close and no ✕.
  - Initial focus is on **Leave**.
  - The buttons are **Take back** and **Leave**.
- ScoutPage:
  - `active = matchLoaded && !locked`, and the old heartbeat effect is deleted.
  - While `takenOver`:
    - `record()` and `mergeText()` return `null` or `false` before writing;
    - result sync is skipped, like `locked`;
    - `<TakeoverSheet>` renders. Leave goes to `/teams/:teamId/matches/:matchId`.
- Strings under `scout.page`, en / it:
  - `takenOverTitle`: `'Scouting moved to another device'` / `'Lo scouting è passato a un altro dispositivo'`;
  - `takenOverMessage`: `'Another device took over this match. Everything recorded here is kept.'` / `'Un altro dispositivo ha preso questa partita. Tutto ciò che hai registrato qui resta salvato.'`;
  - `takeBack`: `'Take back'` / `'Riprendi'`;
  - `leave`: `'Leave'` / `'Esci'`.

- [ ] **Step 1: Failing tests.**
  - `matchesApi.test.ts`: `it('subscribes to the match doc and maps a missing doc to null')`.
  - `useDeviceTakeover.test.ts`, with `vi.mock('../matchesApi')` and fake timers:
    - `it('stops the heartbeat once another device claims')`;
    - `it('ignores its own claim and a stale claim from another device')`;
    - `it('take back claims again and resumes the heartbeat')`.
  - `ScoutPage.test.tsx`. In `beforeEach`, set `vi.mocked(api.subscribeMatch).mockImplementation((_t, _m, cb) => { pushMatch = cb; return () => undefined; })`.
    - `it('a takeover blocks taps and keys even with the action panel open')`:
      - open the panel on #7 Ana;
      - push `{ ...match, activeDevice: { id: 'other', at: Date.now() } }`;
      - the alertdialog `'Scouting moved to another device'` shows;
      - clicking `'+ Good'` and `'Point us'`, and pressing `p`, writes no `addEvent`.
    - `it('Take back claims the device and closes the sheet; Leave opens the match page')`.
- [ ] **Step 2:** Run `npx vitest run src/matches`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/matches`. Expected: PASS. These existing tests must pass unchanged:
  - "warns when another device is scouting";
  - "keeps the device heartbeat firing while points change the result";
  - "sends a match that is not live back to the match page";
  - `deviceLock.test.ts`.
- [ ] **Step 5: Commit** `fix(scout): tell a taken-over device and stop its heartbeat (B5)`

### Task 5: Forced-dark root, tap flash and the court

**Files:**
- Create: `src/matches/scout/ScoutRoot.tsx`, `src/motion/tapFlash.ts`, `src/motion/tapFlash.test.ts`
- Modify: `src/index.css`, `src/App.tsx` (`LazyFallback what="scouting"` rendered inside `ScoutRoot`), `src/matches/scout/ScoutPage.tsx` (every return path wrapped), `src/matches/scout/CourtGrid.tsx`, `src/matches/scout/BenchStrip.tsx`, `src/matches/scout/RoleChip.tsx`
- Test: `src/matches/scout/CourtGrid.test.tsx`, `src/matches/scout/ScoutPage.test.tsx`

**Interfaces:**
- `ScoutRoot({ children }: { children: ReactNode })` renders `<div data-scout-root className="dark flex h-[100dvh] flex-col overflow-hidden bg-bg text-ink" style={{ colorScheme: 'dark' }}>`.
- `TAP_FLASH_MS = 80`, and `tapFlash(el: HTMLElement): void`:
  - It sets `data-flash` and removes it after 80 ms.
  - A repeat call restarts the timer, which is kept per element in a `WeakMap`.
- CSS: `[data-flash] { background-color: rgb(var(--color-surface-3)) !important; transition: none; }`. It is unchanged under reduced motion, because it is a colour state.
- The court (design spec §8.4, mockup `.court`/`.ct`):
  - The court sits on `bg`. The "Net" bar is `bg-ink`, the attack line is dashed `border-separator`, and there is no orange frame.
  - The grid grows to fill the column (`flex-1`, rows `1fr`).
  - Tiles are `min-h-[72px] md:min-h-20`, `rounded-md bg-surface`. A tile leads with the name (`text-headline`), then `#n` and the role chip (`text-ink-2`).
  - Selected tile: `bg-surface-3 ring-2 ring-ink`.
  - The **server ring** (`ring-2 ring-inset ring-surface-3`) goes on the P1 tile while we serve, and otherwise on the on-court player whose per-set role is `S`. The volleyball icon and the `title="serving"` stay exactly as today.
  - The libero tile keeps `bg-orange-tint` with its L chip. Form dots stay `bg-red` / `bg-green`. The "auto" badge is `bg-ink text-on-ink`.
  - Bench chips are `min-h-14 md:min-h-11`, dashed `border-separator`.
- Press and long-press:
  - `onPointerDown` on an enabled tile or bench chip calls `tapFlash(e.currentTarget)`.
  - When the long-press timer fires, it calls `navigator.vibrate?.(10)` before `onLongPress`.

- [ ] **Step 1: Failing tests.**
  - `tapFlash.test.ts`: `it('sets data-flash and clears it after 80 ms')` and `it('a second flash restarts the timer')`.
  - `CourtGrid.test.tsx`:
    - `it('tiles flash on press and never scale')`: after `pointerDown` the tile has `data-flash`, and its class has no `pressable` and no `scale`.
    - `it('a long-press vibrates once for 10 ms; a tap does not')`: use fake timers and `Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true })`.
  - `ScoutPage.test.tsx`:
    - `it('forces dark on its own root')`: `container.querySelector('[data-scout-root]')` has class `dark` and `style.colorScheme === 'dark'`, both while loading and once loaded.
    - `it('never touches the html element\'s theme')`: `document.documentElement.classList.contains('dark')` is the same before and after mount and unmount.
    - `it('menus and sheets render inside the dark root')`:
      - the "Match tools" menu, the "Start set 1" dialog and the "Delete set start?" alertdialog are each descendants of `[data-scout-root]`;
      - the locked "Being scouted on another device" alert also renders inside it.
- [ ] **Step 2:** Run `npx vitest run src/motion src/matches/scout`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Selector updates.** In `CourtGrid.test.tsx` "fills the selected tile and badges an auto-selection", the class assertions change from `bg-blue-strong` and `text-on-ink` to `bg-surface-3`. This is markup only; `aria-pressed` and "auto" are unchanged.
- [ ] **Step 5:** Run `npx vitest run src/motion src/matches src/theme`. Expected: PASS. These existing tests must pass unchanged:
  - every other `CourtGrid.test.tsx` test;
  - "before set 1, with the dialog closed, nothing can be recorded";
  - "substitutes a player from the action sheet".
- [ ] **Step 6: Commit** `feat(scout): forced-dark root, instant tap flash and the v2 court`

### Task 6: Header, dock, action panel and grade chips

**Files:**
- Modify: `src/matches/scout/ScoutHeader.tsx`, `src/matches/scout/RallyBar.tsx`, `src/matches/scout/ActionSheet.tsx`, `src/matches/scout/gradeStyles.ts`, `src/matches/scout/Kbd.tsx`, `src/matches/scout/ScoutPage.tsx` (dock section, jersey hint pill), `src/i18n/italianLabelBudget.test.ts`
- Test: `src/matches/scout/ActionSheet.test.tsx`, `src/matches/scout/ScoutPage.test.tsx`

**Interfaces:**
- **Header** (`<header>`, so the banner role stays). It is `bg-bg`, with a bottom `border-separator` hairline and `pt-[env(safe-area-inset-top)]`.
  - **Row 1 (`h-11`):**
    - the sync status, which keeps today's text, live region and the phone rule;
    - the status line (`t.status(...)`, `text-footnote text-ink-2 truncate`, `flex-1`);
    - the "Match tools" `Menu` (44 px).
  - **Row 2:**
    - leading: the rotation corrections (◀, "Rot N", ▶, each 44 px);
    - centre: the **score button** (aria "Correct score") with the us score in `text-score text-ink`, an en dash, the them score in `text-score text-ink-2`, and under them the Serve/Receive pill (`text-caption`). Serve is `bg-ink text-on-ink` and Receive is `bg-surface-2 text-ink-2`;
    - trailing: the **Undo** pill (`bg-surface-2`, `min-h-11`, Undo2 icon plus the label from `sm`, and the Kbd) with Task 1's hint line.
  - Disabled rules are unchanged.
- **Dock** (`RallyBar`). The `<section aria-label="Match events">` is `bg-bg` with a top `border-separator` hairline and keeps its safe-area padding.
  - The buttons sit in a 2-column grid with `grid-template-areas: "pu pt" "tu tt"`. Each side's T/O sits **under** its point.
  - **DOM order stays T/O us · Point us · Point them · T/O them**, through `[grid-area:tu]` and so on, so invariant 36 and its test hold.
  - Point us is `bg-ink text-on-ink`, Point them is `bg-surface-2 text-ink`, both `min-h-14 text-headline`. Quick score makes them `min-h-24 text-title-2`.
  - T/O buttons are `min-h-14 bg-surface text-callout`, reading `` `${timeoutShort} · ${left(n)}` ``. The aria-label and title are unchanged.
  - Reason chips are `min-h-14 bg-surface-2` with Kbd 1–4. The group role and label are unchanged.
  - Every dock button calls `tapFlash` on pointer-down.
- **Action panel:**
  - `section` with `bg-surface rounded-lg p-3`. The header row is the name (`text-headline`), `#n`, the RoleChip, Substitute (44 px, `text-ink`) and Close.
  - Fundamental chips are `min-h-14 md:min-h-11 rounded-full`. The active chip is `bg-ink text-on-ink`, idle chips `bg-surface-2 text-ink`, and `aria-pressed` stays.
  - Grades are a 3-column grid of `min-h-14` buttons in `validGrades` order. Each shows the symbol in `text-title-2` and the label in `text-caption`, with the Kbd at top-right.
  - Chips and grades call `tapFlash`.
- Produces `SCOUT_GRADE_CLASS: Record<Grade, string>` in `gradeStyles.ts`. `GRADE_CLASS` is untouched (the report uses it):
  ```ts
  '#': 'bg-green/40 text-green-strong', '+': 'bg-green-tint text-green-strong', '!': 'bg-surface-2 text-ink-2',
  '-': 'bg-orange-tint text-orange-strong', '/': 'bg-orange/40 text-orange-strong', '=': 'bg-red/40 text-red-strong',
  ```
- `Kbd`: `border-separator bg-surface-2 text-ink-2`, still `hidden lg:inline-flex` and `aria-hidden`.
- The jersey hint pill: `bg-ink text-on-ink`.

- [ ] **Step 1: Failing tests.**
  - `ActionSheet.test.tsx`: `it('grade chips use the grade colours: tint plus strong text, ! neutral')`. The `'# Perfect'`-style buttons carry the `SCOUT_GRADE_CLASS` classes, and `!` has `text-ink-2`.
  - `ScoutPage.test.tsx`: `it('header holds score, rotation and Undo; tools stay in the menu')`. Within `banner` you find "Correct score", "Previous rotation", "Next rotation", Undo and "Match tools". The dock has none of them.
  - `italianLabelBudget.test.ts`: add pairs for these, and the test still passes:
    - `scout.page.tabCourt`, `tabLive`, `tabTimeline`, `tabText`;
    - `scout.rally.timeoutShort`;
    - `scout.page.dismiss`, `takeBack`, `leave`.
- [ ] **Step 2:** Run `npx vitest run src/matches/scout src/i18n`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/matches src/i18n src/theme`. Expected: PASS. These existing tests must pass unchanged:
  - "keeps match events in the bottom dock, on every tab, apart from Undo";
  - "lays the dock out in one mirrored row…";
  - "puts the app tools in one Match tools menu";
  - "rotation arrows write a correction";
  - "records a point in one tap, then amends it…";
  - "hides the reason chips after a few seconds…";
  - "quick score hides the court and still records points";
  - all three `ActionSheet.test.tsx` tests;
  - the whole keyboard `describe`.
- [ ] **Step 5: Commit** `feat(scout): v2 header, mirrored dock and grade chips`

### Task 7: Frame, phone segmented tabs, prompts, cheat sheet and dialogs

**Files:**
- Modify:
  - `src/matches/scout/ScoutPage.tsx`;
  - `src/matches/scout/HotkeyCheatSheet.tsx`, `SetStartDialog.tsx` (visuals), `SubDialog.tsx`, `CorrectionDialog.tsx`, `EditEventDialog.tsx`, `LiveStatsPanel.tsx`, `TimelineDrawer.tsx`.
- Test: `src/matches/scout/ScoutPage.test.tsx`, plus the component tests listed in Step 4.

**Interfaces:**
- **Frame.** `ScoutRoot` is the 100 dvh frame. Inside it, in order:
  - the header;
  - the strip;
  - on phones, `<SegmentedControl semantics="tabs" label={sp.views} options={court, live, timeline, …(aiEnabled ? text : [])} value={phoneTab} onChange={setPhoneTab} className="mx-3 mt-2">`;
  - `<main>` (the only scrolling part);
  - the dock.

  The desktop grid is as today, with `bg-surface rounded-lg` panels and the timeline capped at `max-h-[50vh]`.
- **Set-point prompt.** Still a non-modal `role="dialog" aria-label={sp.setPoint}`, `fixed inset-x-3 top-28 z-40 md:inset-x-auto md:left-1/2 md:w-[420px] md:-translate-x-1/2 rounded-xl bg-surface p-4 shadow-pop`.
  - "Not yet" is secondary and "Confirm set" is primary, both `min-h-14`.
  - It is not glass and has no `aria-modal`.
- **Cheat sheet.**
  - It is a `Dialog` titled "Keyboard shortcuts", which the adapter renders as a Sheet.
  - Each group is a `section aria-label` with a sentence-case `text-footnote font-semibold text-ink-2` heading, without `uppercase`.
  - Keys render as `<kbd>` chips (`bg-surface-2 rounded-sm text-ink`), and descriptions in `text-ink-2`.
- **SetStartDialog.**
  - The two serve options are 56 px labelled radio tiles: the `<input>` is kept and visually replaced, and the checked tile is `bg-surface-3 ring-2 ring-ink`.
  - The lineup-mode toggle keeps its `aria-pressed` buttons, styled as a segmented track.
  - The preview cells use the Task 5 tile tokens. The changed-role colour moves from blue to `text-ink font-semibold`.
- **LiveStatsPanel.**
  - The scope buttons keep `aria-pressed` and are styled as a segmented track.
  - The table is borderless with hairline rows and `tabular-nums`.
  - Red thresholds use `text-red-strong`, and the alerts use `bg-red-tint`.
- **TimelineDrawer.** Hairline rows. `setStart`/`setEnd` rows are on `bg-surface-2`. The score pill is `bg-surface-3 text-ink`. Warnings use `text-orange-strong`, and the icon buttons are 44 px.
- **SubDialog, CorrectionDialog, EditEventDialog.** Token swaps only. Candidates in `SubDialog` are 56 px tiles.

- [ ] **Step 1: Failing test** in `ScoutPage.test.tsx`, under `on a phone-width screen`: `it('phone views are a segmented control at the top of the content')`. The `tablist` "Scouting views" holds the `tab`s Court, Live, Timeline, Text, with Court `aria-selected="true"`. It sits before `main` in document order.
- [ ] **Step 2:** Run `npx vitest run src/matches/scout/ScoutPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/matches`. Expected: PASS, with every test unchanged except where a selector change is noted. In particular these must pass unchanged:
  - the phone `describe` ("keeps the events dock when switching away…", "hides the Text tab…", "keeps the text preview across tab switches");
  - "asks to confirm the set at set point";
  - "double-tapping Confirm set writes exactly one setEnd";
  - "? opens the cheat sheet listing the keys, and ? closes it";
  - "ignores keys while the set start dialog is open";
  - `SetStartDialog.test.tsx`, `SubDialog.test.tsx`, `LiveStatsPanel.test.tsx` and `TimelineDrawer.test.tsx`.
- [ ] **Step 5: Commit** `feat(scout): phone segmented views, set-point prompt, cheat sheet and dialogs in v2`

### Task 8: Text scouting and DataVolley import

**Files:**
- Modify: `src/matches/text/TextScoutPanel.tsx`, `src/matches/text/PreviewRallyCard.tsx`, `src/matches/dvw/DvwImportDialog.tsx`, `src/matches/dvw/DvwReview.tsx`
- Test: `src/matches/text/TextScoutPanel.test.tsx`, `src/matches/dvw/DvwImportDialog.test.tsx` (unchanged)

**Interfaces:**
- **The text panel stays a panel**: the right column on desktop and the Text tab on phones. It stays mounted while hidden. It takes the sheet *surface* language:
  - a `bg-surface rounded-xl` card, with the title (`text-headline`) and Close (44 px, `text-ink`);
  - the anchor line in `text-footnote text-ink-2 tabular-nums`;
  - status messages as inline rows (orange uses `text-orange-strong`);
  - the three tips as one `text-footnote text-ink-2` list under the textarea;
  - Open Settings as a secondary `Button`-styled `Link`.

  Preview cards are `bg-surface-2 rounded-lg`. Cards with a blocking issue get `ring-1 ring-red`, and issues use `text-red-strong` or `text-orange-strong`.
  - Discard and Merge keep their order and their disabled rules.
- **DVW** stays the `Dialog` (Sheet) with every step, state and string as listed in inventory §23.
  - `DvwReview` becomes grouped sections, each a `bg-surface rounded-lg` group with a `text-footnote text-ink-2` header: File · Match · Which team is us · Roster · Checks.
  - The duplicate banner is `bg-orange-tint`, and the blocking list is `text-red-strong` items with `role="alert"`.
  - Cancel and Import stay at the end, where they are today.
  - The file input and the help, disclaimer and progress lines are restyled with tokens only.

- [ ] **Step 1:** Restyle as specified above. No behavioural line changes. Retire `slate`, `border-border`, `blue` and `navy` in these four files.
- [ ] **Step 2:** Run `npx vitest run src/matches/text src/matches/dvw src/matches/scout src/theme`. Expected: PASS. Every `TextScoutPanel.test.tsx`, `textScout.test.ts`, `wording.test.ts`, `DvwImportDialog.test.tsx` and `dvw/*.test.ts` test passes unchanged. If one needs a selector change, the change is markup only, and you note it in the commit body.
- [ ] **Step 3: Commit** `feat(scout): v2 text scouting panel and DataVolley review`

### Task 9: Matches tab: toolbar, grouped rows and the row menu

**Files:**
- Modify:
  - `src/components/Menu.tsx` (type), `src/components/MenuList.tsx`, `src/test/chromeProbe.tsx`;
  - `src/layout/PageChrome.tsx`, `src/layout/PageHeader.tsx`;
  - `src/matches/TeamMatchesTab.tsx`, `src/teams/TeamPage.tsx`;
  - `src/i18n/en/matches.ts`, `src/i18n/it/matches.ts`.
- Test: `src/components/Menu.test.tsx`, `src/layout/PageChrome.test.tsx`, `src/matches/TeamMatchesTab.test.tsx`, `src/teams/TeamPage.test.tsx`

**Interfaces:**
- **`MenuItem` gains `disabled?: boolean`** on the `action` kind.
  - `MenuList` renders `aria-disabled="true"` and `text-ink-3`, and clicking does nothing (the menu stays open). It remains focusable by the arrow keys.
  - `sameMore` compares `disabled`.
  - `chromeProbe` passes `disabled` to its buttons.
- **Chrome ownership:**
  - `usePublishPageChrome(state, enabled = true)`. When disabled it doesn't publish, and it releases only chrome it owns.
  - `PageHeader` gains `publishChrome?: boolean` (default `true`) and passes it on.
  - `TeamPage` passes `publishChrome={activeTab !== 'matches'}`, and `admin` to `TeamMatchesTab`.
- **`TeamMatchesTab`** (new prop `admin?: boolean`) publishes:
  - `title: teamName`;
  - `mainAction: { label: l.newMatch, icon: Plus, onSelect: () => setCreatingDate(todayIso()) }`;
  - `more`, in this order:
    - `{ label: l.importDvw, icon: <FileUp/>, disabled: !online, onSelect: open import }`;
    - for `admin` only, `{ label: t.teams.stats.seasonAwards, icon: <Trophy/>, onSelect: navigate('/teams/:teamId/awards') }`.

  The content keeps the offline hint `l.offlineImport` while offline. The in-content buttons go.
- **Rows:**
  - A grouped list: `bg-surface rounded-lg`, hairlines inset, rows `min-h-[52px]`.
  - Each `<li>` has one `Link` to the match page holding the date (`text-footnote tabular-nums text-ink-2`), the opponent (`text-headline`, truncated), the result (`text-title-3 tabular-nums`) and the status chip.
  - Status chip colours:
    - Live: `bg-green-tint text-green-strong`, the design system's live colour;
    - Finished and Setup: `bg-surface-3 text-ink-2`.
  - For live matches there is a separate trailing "Resume" link (not nested).
  - Until the first page resolves, 3 `Skeleton` rows show in place of "No matches yet.".
- **Row context menu.** `useContextMenu` with `label: l.rowMenu(opponent)`, spread on the row `<li>`. The items depend on status:
  - setup: `Open`;
  - live: `Open`, `Scout`;
  - finished: `Report`.

  Every status then gets a divider and `Delete…` (`danger`).
  - Open and Report go to the match page, and Scout to `/scout`.
  - Delete… opens `ConfirmDialog` with `matches.page.deleteTitle`, `deleteMessage` and `deleteConfirm`.
    - The confirm awaits `deleteMatch(teamId, id)`, then removes the row.
    - On failure it shows `matches.page.deleteError` inside the dialog, and the row stays.
- Strings `matches.list.menu.*` and `rowMenu`, en / it:
  - `open` `'Open'` / `'Apri'`;
  - `scout` `'Scout'` / `'Scouting'`;
  - `report` `'Report'` / `'Report'`;
  - `delete` `'Delete…'` / `'Elimina…'`;
  - `rowMenu` `` (o) => `Actions for vs ${o}` `` / `` (o) => `Azioni per vs ${o}` ``.

- [ ] **Step 1: Failing tests.**
  - `Menu.test.tsx`: `it('a disabled item is announced and does nothing')`.
  - `PageChrome.test.tsx`: `it('a disabled publisher releases its own chrome and leaves another publisher\'s alone')`.
  - `TeamMatchesTab.test.tsx`, wrapping the renders in `WithChrome`:
    - `it('season awards is in More for a team admin only')`.
    - `it('a live row offers Open and Scout; Delete asks first and removes the row after the delete')`. Open it with `fireEvent.contextMenu` on the row.
    - `it('a failed delete keeps the row and shows the error in the dialog')`.
    - `it('shows skeleton rows, not the empty text, until the first page arrives')`.
  - `TeamPage.test.tsx`: `it('the Matches tab owns the toolbar; other tabs show the team title')`, checked through `WithChrome`.
- [ ] **Step 2:** Run `npx vitest run src/components src/layout src/matches/TeamMatchesTab.test.tsx src/teams`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Selector updates** in `TeamMatchesTab.test.tsx`, with the same assertions. The renders are wrapped in `WithChrome`, and these tests now click the probe's buttons:
  - "opens the setup form from the button";
  - "creates the match without waiting for the server and opens it";
  - "opens the import dialog online";
  - "disables the DataVolley import offline", which asserts that the probe button is disabled and the hint is shown.
- [ ] **Step 5:** Run `npx vitest run src/components src/layout src/matches src/teams src/search`. Expected: PASS. "lists matches with result and status", "opens the setup form, pre-filled from the calendar date", "opens the setup form from a pending action" and "uses the local calendar date…" pass unchanged.
- [ ] **Step 6: Commit** `feat(matches): toolbar actions, grouped rows and row menu on the Matches tab`

### Task 10: Match page: toolbar per state and the grouped setup form

**Files:**
- Modify: `src/matches/MatchPage.tsx`, `src/matches/MatchSetupForm.tsx`, `src/i18n/en/matches.ts`, `src/i18n/it/matches.ts`
- Test: `src/matches/MatchPage.test.tsx`, `src/matches/MatchSetupForm.test.tsx`

**Interfaces:**
- **Header.** `PageHeader` with `title={p.title(opponent)}` and `eyebrow` (the date, home or away, and competition line). The "Back to team" link stays above it, `text-ink-2`.
- **Main action and "⋯" per status.** The card wrapper goes, so the content sits on the canvas.

  | Status | `mainAction` | `more` |
  |---|---|---|
  | setup | `{ label: p.startScouting, icon: Play, disabled: dirty, onSelect: startScouting }` | `[Delete match…]` |
  | live | none | `[Delete match…]` |
  | finished | `{ label: p.awards, icon: Trophy, onSelect: navigate('/awards') }` | Print / PDF · CSV EU · CSV EN · divider · `p.reopen` · divider · Delete match… |

  - Delete match… is `{ label: p.deleteMenu, danger: true, onSelect: () => setConfirmDelete(true) }`.
  - The Print and CSV items keep today's labels, icons and handlers. `exportCsv` still uses `reportSet`.
- **Content per status:**
  - **Setup:** while `dirty`, the hint `p.saveFirst` (`text-footnote text-ink-2`) above the form, and the `actionError` alert. Then the form.
  - **Live:** the banner `bg-green-tint rounded-lg p-3`, holding "Scouting in progress", **Finish match** (secondary, disabled until `state`) and the **Resume scouting** link (primary-styled), then the alert and the report.
  - **Finished:** the alert and the report. The in-content Delete button, the Export menu, the awards link and Reopen all go.
- New `matches.page.deleteMenu`: en `'Delete match…'`, it `'Elimina partita…'`.
- **`MatchSetupForm` becomes a grouped form.** Each fieldset is a `bg-surface rounded-lg` group with a sentence-case `text-footnote text-ink-2` header:
  - Details (Date, Opponent, Competition, Venue);
  - Format;
  - Match roster (the counter turns `text-red-strong` over 14);
  - Liberos.

  Inputs are 16 px on touch. Every label, aria-label, order and validation is unchanged. Duplicate rows get `ring-1 ring-red` and `text-red-strong`. Cancel and submit stay at the end.

- [ ] **Step 1: Failing test** in `MatchPage.test.tsx`, with renders wrapped in `WithChrome`: `it('Delete match… is in More in every state and confirms with focus on Cancel')`.
- [ ] **Step 2:** Run `npx vitest run src/matches/MatchPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Selector updates** in `MatchPage.test.tsx`, with the assertions unchanged:
  - "disables Start scouting…" and "starts scouting…" click the probe's "Start scouting".
  - "reopens a finished match…" clicks the probe's "Reopen for editing".
  - "prints and exports…" clicks the probe buttons `'Print / PDF'` and the two CSV labels instead of opening an Export menu.
  - "finished match links to match awards" becomes a click on the probe's "Match awards" that lands on an `/awards` route stub. That is §6.5: the main action moved to the toolbar.
- [ ] **Step 5:** Run `npx vitest run src/matches`. Expected: PASS. Every `MatchSetupForm.test.tsx` test, "applies a setup save immediately…", "renders a finished match from its stored report…", "falls back to the event log…", "does not read events while the match is in setup", "does not finish a live match when the usage history cannot be loaded" and both not-found tests pass unchanged.
- [ ] **Step 6: Commit** `feat(matches): Match page toolbar actions and grouped setup form`

### Task 11: Gate and user checklist

**Files:** none new.

- [ ] **Step 1:** Run `npm test`, `npm run lint` and `npm run build`. Expected: all green, with 0 lint errors. If a known flaky load-timeout test fails (the Italian smoke test or PlayerCard), rerun that file alone and report both results.
- [ ] **Step 2: Greps.** Each should print nothing:
  - `grep -rn "vibrate" src --include=*.ts --include=*.tsx | grep -v test | grep -v CourtGrid.tsx`;
  - `grep -rnE "dark:|bg-navy|text-slate|border-border|text-white|bg-blue|text-blue-strong" src/matches --include=*.tsx | grep -v "/report/" | grep -v test`;
  - `grep -rn "pressable" src/matches/scout`.
- [ ] **Step 3: Commit** any lint-only fix-ups as `chore(scout): gate fix-ups`, if there are any.
- [ ] **Step 4: User checklist** for the group report. The user runs it on a real phone, and on a desktop with a keyboard.
  - **Tap count and latency against inventory 04's interaction-speed table.** Each row must match or beat today:

    | Action | Expected |
    |---|---|
    | Graded action, prediction right | 1 tap / 1 key; the panel opens with no visible wait |
    | Graded action, other player | 2 taps / digits + grade key |
    | Non-default fundamental | 3 taps |
    | Point without stat | 1 tap / P or O; reason chip +1 within 5 s |
    | Timeout | 1 tap / T, Shift+T |
    | Substitution | long-press 500 ms (one short vibration) + 1 tap; or 3 taps; or tile + Shift+S + tap |
    | Undo | 1 tap / Ctrl+Z or Backspace; a confirm only for text batches |
    | End set | 1 tap (Confirm set) |
    | Start next set | 2 taps with the defaults right; set 1 needs the serve tap (B6) |
    | Rotation fix / score fix | 1 tap per step / score → edit → Save |

  - **Latency.** There is no spinner and no animation between taps. The tile, grade and point flash is instant. The score changes without animating. Airplane mode: record a rally, and the pending count rises and then syncs.
  - **Layout.** The header, strip and dock stay fixed and only the middle scrolls. Check the dock height with T/O under each point, and that the court fits with the action panel open on a small phone (about 375×667). Every recording target is at least 56 px. Italian labels fit in the dock and the segmented tabs.
  - **Dark.** Scouting is dark with the app on Light. Back on the Match page, the app theme returns with no flash.
  - **B4 to B7:**
    - **B4:** with a write rejected, the strip clears after the next tap syncs, and Dismiss works.
    - **B5:** open `/scout` on two devices. Take over on the second; the first shows the sheet, and Take back and Leave work.
    - **B6:** set 1 asks for the serve.
    - **B7:** reopen an imported match and Undo stops at the import.
  - **Toolbar.** Match page setup: Start scouting, and "⋯" Delete match…. Finished: Match awards, and "⋯" Print, CSV, Reopen, Delete. Matches tab: New match, and "⋯" Import (disabled offline) and Season awards. Long-press or right-click a match row.
  - **Keyboard.** `?` opens the cheat sheet in sentence-case groups. Kbd badges show only on desktop.
  - `tailwind.config.js` did not change, so no dev-server restart is needed. If it did change, restart.
