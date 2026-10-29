# UI Redesign 4d: Trainings, Exercises and the Diagram Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild area 06 (trainings library and builder, training view, exercise library, exercise sheets, AI draft sheets, court-diagram editor) in the v2 system to match mockup screens 6 and 7. It fixes B2 and B3, turns the training and exercise deletes into undo (§6.2), adds row menus and swipe (§6.4), and makes the builder's button edits arm the discard guard (§4.6). Every inventory-06 invariant holds except where a task maps a change to §4.

**Architecture:**
- **Editor bugs first, in the hook.** `useDiagramEditor` keeps per-diagram undo stacks that survive saves (B3). It also takes over the whole save pipeline: autosave, `flush()` on unmount, `pagehide` and hidden, `beforeunload` only while failing, and a `status` (B2). The page then only renders.
- **Editor frame.** The route moves out of `AppShell` (design system §7: full screen, outside the shell). Desktop gets a floating glass toolbar (back, status, the palette as tools, undo/redo), a floating tab strip, a floating glass inspector on the right holding the court settings and properties, and floating zoom buttons. Phone keeps its header, tab strip, bottom tool bar and non-modal bottom panels, restyled as sheets.
- **Libraries.** Rows are `div role="button"` items (invariant 7), each with a kebab `Menu`, the same items on right-click or long-press (`useContextMenu`) and a trailing swipe Delete. Deletes are `useUndoable`. Exercises are a grouped list on phones and a card gallery that leads with the diagram from `md` (screen 7), from one markup. Trainings are a grouped list (screen 6).
- **Sheets.** The builder, the exercise form and the view sheets move from the `Dialog` adapter to `Sheet`. Two small `Sheet` additions are needed: `variant="view"` (Done, no Cancel, in the phone header) and `SheetCancelButton` (a guarded Cancel for custom footers). The builder gets a drag handle reorder through a small pure helper.

**Not in this plan:**
- **The training PDF output** (`src/trainings/pdf/**`): shared outputs plan (§9). `TrainingViewSheet` is restyled and its two-tap share and `TeamNotesDialog` flow are kept as they are.
- **`BulkImportDialog`**: plan 4c owns it, tokens only. Area 06 keeps passing the same props.
- **Things the mockups show that the spec text does not agree to** (the text wins, design README line 21):
  - Screen 6's two-pane builder with the library on the right: the builder is a 720 px builder sheet (§6.3), so the picker stays inline under the plan.
  - Screen 6's "Suggest parts" button merging AI draft into the builder: this is a new flow (§2). AI draft stays in "⋯".
  - Screen 6's in-page "Search trainings" field and screen 7's toolbar search: search is the global palette (§8.6), which is already built. The Age group and Business ID filters stay (invariants 1–3).
  - Screen 7's exercise count ("214") would need a count query. Its "20′" duration doesn't exist, because exercises have no duration.
  - Category chips on trainings would need a new query and index.
- **Pain points not agreed:**
  - The editor still returns to `/exercises`.
  - "Edit diagrams" still navigates without asking.
  - Diagram-tab delete gets no confirm or undo.
  - There are still no keyboard nudges.
  - Undo is still one frame per drag move.
  - The hardcoded "Diagram N", "AI draft", "AI training" and "Untitled" stay as stored data (§4.6).
  - There is still no "skip team notes" path.
- **Diagram item colours** (`navy`, `blue`, `orange`, `green`, `red`, `ink` in scenes) are stored data drawn with `--color-<name>`. They stay as they are. The cleanup increment must keep `--color-navy` and `--color-blue` for them (handoff note).

**Tech Stack:** React 18, TypeScript strict (noUnusedLocals/Parameters), React Router v7 (`BrowserRouter`, so no `useBlocker`), Tailwind with CSS-variable tokens (no `dark:`), Vitest + Testing Library (jsdom), Firestore web SDK with the persistent cache, lucide-react, `@use-gesture/react` (already used by `Sheet`, `SwipeRow` and `CanvasStage`).

**Spec:**
- `docs/superpowers/specs/2026-10-28-ui-redesign-design.md`:
  - §8.6;
  - §4.2 B2, B3;
  - §4.6 (Cancel asks "Discard changes?" when dirty; the builder's button-only edits mark it dirty; exercise rows keep opening edit; diagram titles stay data);
  - §6.2 (training and exercise delete become Undo; the editor's "Leave without saving?" is removed), §6.3 (builder sheet 720 px), §6.4 (Trainings and Exercises rows; the editor's right-click menu restyled), §6.5 (already built);
  - §10, §11.
- Parity contract: `docs/superpowers/specs/ui-redesign-inventory/06-trainings-exercises-diagrams.md`, all 41 invariants, plus the README's cross-cutting rules.
- Visual target: `docs/design/design-system/mockups/screens-set.html`, screen 6 (lines 297–329) and screen 7 (lines 341–356), and `screens-set.png`. Design rules: `docs/design/design-system/README.md` §2–§9.

## Global Constraints

**Parity**
- Every inventory-06 invariant holds. Existing tests change selectors or markup only. An assertion changes only where a task maps it to B2, B3, §4.6, §6.2, §6.4 or §8.6.
- **Fetching discipline (invariants 1–5).** `listTrainings` and `listExercises` are unchanged: limit 25, cursor, filters as `where` clauses on the indexed queries. No new query, no new index, no count query. After a delete commits, the row is dropped from local state, so loaded pages and the cursor survive.
- **URL contracts stay.** `?businessId=`, `&team=&session=` (once, only when the session points at the training), `?training=<id>`, `?exercise=<id>`, and the palette pending actions `'new-training'` and `'new-exercise'`.
- **The two-tap PDF share is byte-for-byte the same flow** (invariant 16). `pdfmake` is only reached through the existing dynamic import. `TeamNotesDialog` keeps its data, sort, left-player exclusion and "Create PDF disabled until loaded".
- **Editor gestures, shortcuts, limits, clipboard, selection and drag geometry are unchanged** (invariants 23–27, 30, 32). The shortcut handler still ignores `<input>` and `<textarea>` targets.
- There is no read-only role in these sections. Every row action shows for anyone who can open the page, as today. "Draft with AI" still needs `aiEnabled`. "Allow new exercises" still needs `access.sections.exercises`.

**Visual**
- Colour comes only from tokens. Legacy `navy`, `slate`, `border-border`, `text-white`, `bg-black/…`, `bg-blue…` and `text-blue…` are retired in every file this plan touches. The exceptions are the diagram item colours above, and `bg-blue-tint`/`text-blue-strong` inside `LevelPill` (the Advanced band).
- **Blue is never a UI accent.**
  - Chips, the selected tab and links are ink.
  - Category badges are neutral (`bg-surface-3 text-ink-2`).
  - The editor's selection outline, handles and marquee use `--color-focus`.
- Orange means warning only: PlayersNote "Needs N", "Deleted exercise" stays red, and the AI total that is off by more than 10 %. Text in a data colour uses `-strong`.
- Type roles:
  - row titles `text-headline`;
  - metadata `text-footnote text-ink-2`;
  - section headers `text-title-3`;
  - group headers sentence case, never `uppercase`;
  - `tabular-nums` on every business id, minute, count and timing.
- Touch targets are at least 44 px (`min-h-11`). Inputs are 16 px on touch. Glass (`.glass`, `.glass-pop` in `src/index.css`) goes only on the editor's floating chrome and sheets/menus.

**Strings, data, gates**
- Every new string goes in `src/i18n/en/*.ts` and `src/i18n/it/*.ts`, the shipped catalogs. Keys this plan makes unused are removed from both, after a grep shows no other reference.
- **No rules or index changes.** The undo deletes call the same `deleteTraining` and `deleteExercise`. The editor calls the same `saveDiagramSet`. So `npm run test:rules` isn't needed. If a task ever touches `firestore.rules` or `firestore.indexes.json`, add a rules test and run it on a temporary port, never 8080, which is the user's emulator.
- Never commit `serviceAccountKey.json` (or `.enc`), `*.vsbackup`, private keys, `.env.local` or `reference/`. Commit only as the steps say. Don't push or merge, add no dependency, and don't touch `src/matches/`, `src/players/` or `src/teams/`.
- Gates per group: `npm test`, `npm run lint` (0 errors), `npm run build`.

## Review Focus

1. **The coach leaves the editor, or the tab hides, while an autosave is in flight and newer edits exist.** Those edits must still be written, with the real ids from the first save, never as duplicate diagrams.
   - Pinned in Task 2 by "unmount during an in-flight save writes the later edits under the real ids".
2. **Undo after an autosave, then leave.** The restored scene must be what is stored.
   - Pinned in Task 1 by "undo history survives a save and undo marks the diagram dirty again".
   - Pinned in Task 2 by "an undo after a save is autosaved".
3. **Two deletes in a row, or a delete then a route change, inside the undo window.** Each delete commits exactly once, its row never comes back, and a failed commit brings that row back with the inline error.
   - Pinned in Task 6 by "a second delete commits the first at once" and "a failed delete brings the card back with the error".
   - Pinned in Task 7 by the same two tests for trainings.
4. **The builder was opened from an AI draft ("Open in builder"), then Cancel.** The new exercises are already saved and the plan would be lost, so Cancel must ask "Discard changes?" before any edit.
   - Pinned in Task 8 by "a builder prefilled from a draft asks before Cancel discards it".
5. **The kebab or a menu item inside a clickable row.** Clicking the kebab, choosing an item, or pressing Enter on the kebab must not also open the row (invariant 7).
   - Pinned in Task 6 by "the kebab and its items never open the edit sheet".
   - Pinned in Task 7 by "the kebab and its items never open the plan".

---

## File Structure

| File | Responsibility |
|---|---|
| `src/diagrams/useDiagramEditor.ts` (modify) | B3 per-diagram history; B2 pipeline: autosave, `flush`, page-hide, `beforeunload`, `status` |
| `src/App.tsx` (modify) | Editor route outside `AuthenticatedLayout` |
| `src/diagrams/DiagramEditorPage.tsx`, `src/diagrams/Palette.tsx`, `src/diagrams/SaveStatus.tsx` (create) | Floating glass frame, status and Retry, leave flow, inspector, phone panels |
| `src/diagrams/{DiagramTabs,PropertiesPanel,CanvasContextMenu,CanvasStage,DiagramSvg,DiagramLightbox,DiagramThumbnail}.tsx` (modify) | Token restyle; selection in `--color-focus` |
| `src/components/Chip.tsx` (create) | `chipClass`, `FilterChips`, `ToggleChip` |
| `src/components/Sheet.tsx` (modify) | `variant="view"`, `SheetCancelButton` |
| `src/exercises/ExercisesPage.tsx`, `src/exercises/ExerciseRow.tsx` (create) | Chips, list/gallery, row actions, undo delete |
| `src/trainings/TrainingsPage.tsx`, `src/trainings/TrainingRow.tsx` (create) | Filter row, grouped list, row actions, undo delete, Export PDF |
| `src/trainings/reorder.ts` (create), `src/trainings/TrainingBuilderDialog.tsx` (modify) | Drag reorder helpers and hook; builder as a sheet |
| `src/trainings/{TrainingViewSheet,TeamNotesDialog,PlayersNote}.tsx`, `src/exercises/ExerciseDetailSheet.tsx` (modify) | View sheets restyled |
| `src/exercises/ExerciseFormDialog.tsx`, `src/aiDraft/{ExerciseDraftDialog,TrainingDraftDialog,ExerciseProposalReview,TrainingProposalReview,DraftDiagramPreview}.tsx` (modify) | Form sheet; AI sheets with guarded Cancel |
| `src/i18n/{en,it}/{diagrams,exercises,trainings}.ts`, `src/i18n/italianLabelBudget.test.ts` (modify) | Strings; budget pairs |

**Groups.** Tasks inside a group run in the listed order where they share a file; otherwise they are independent.

| Group | Tasks | Note |
|---|---|---|
| 1 | 1, 2 | Both change `useDiagramEditor.ts`, so they run in order |
| 2 | 3, 4 | Disjoint files |
| 3 | 5, then 6 and 7 | 6 and 7 consume 5 |
| 4 | 8, 9, 10, then 11 | 8–10 are disjoint |

---

### Task 1: B3: undo history survives saves, per diagram

**Files:**
- Modify: `src/diagrams/useDiagramEditor.ts`
- Test: `src/diagrams/useDiagramEditor.test.ts`

**Interfaces:**
- `EditorState` gains `history: Record<string, { undo: Scene[]; redo: Scene[] }>`, the stashed stacks of **inactive** diagrams. `undo` and `redo` stay the active diagram's stacks, so every existing reader and test keeps working. `initialEditorState.history = {}`.
- Each stack is capped at `UNDO_LIMIT` (30), today's depth.
- Reducer changes:

  | Action | New behaviour |
  |---|---|
  | `selectDiagram` | Stash the active diagram's `undo`/`redo` under its id, load the target's stash (or empty), remove the target's key. Selection still clears. |
  | `addDiagram` | Stash the active diagram's stacks. The new diagram starts empty. |
  | `deleteDiagram` | Drop the deleted id's stash. If it was active, load the new active diagram's stash (and remove that key); otherwise keep the current stacks. |
  | `saved` | **Keeps** `undo`, `redo` and `history`. History keys are remapped through `idMap`. |
  | `loaded` | Resets everything (unchanged). |

- Export `isEditorDirty(state: EditorState): boolean`, which is `dirtyIds.size > 0 || deletedIds.length > 0`. Task 2 and the hook use it.

- [ ] **Step 1: Failing tests** in `useDiagramEditor.test.ts`, in a new `describe('history (B3)')`:
  - `it('undo history survives a save and undo marks the diagram dirty again')`: add 2 cones, then `saved` with `committedIds: ['d1']`. Now `undo` has length 2 and `dirtyIds` is empty. After `undo`, the scene has 1 cone and `dirtyIds.has('d1')` is true.
  - `it('each diagram keeps its own undo history across tab switches')`: add a cone on d1, `addDiagram`, add a ball on d2, select d1. `undo` has length 1, and undoing removes the cone. Select d2: `undo` has length 1 and it holds d2's frame.
  - `it('a saved new diagram keeps its history under its real id')`: on temp id `t`, add an item, select d1, then `saved` with `idMap: { [t]: 'real-2' }`. Select `'real-2'`: `undo` has length 1.
  - `it('deleting a diagram drops its history')`: the deleted id's key is gone from `history`.
  - `it('stacks stay capped at 30 per diagram')`.
- [ ] **Step 2:** Run `npx vitest run src/diagrams/useDiagramEditor.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/diagrams`. Expected: PASS. Every existing reducer test passes unchanged, including "undo restores the previous scene and redo reapplies; stack caps at 30", both `saved` tests and "selectDiagram resets the selection to empty".
- [ ] **Step 5: Commit** `fix(diagrams): undo history survives autosave, kept per diagram (B3)`

### Task 2: B2: the save pipeline lives in the hook

**Files:**
- Modify: `src/diagrams/useDiagramEditor.ts`
- Test: `src/diagrams/useDiagramEditorSave.test.ts`

**Interfaces:**
- `useDiagramEditor(exerciseId, uid)` additionally returns:
  ```ts
  status: 'saved' | 'saving' | 'failed'; // failed: saveError set and still dirty; saving: a save in flight or dirty; else saved
  flush: () => Promise<void>;            // save now; if a save is in flight, wait for it, then save what is still dirty
  ```
  `save` and `saveError` stay, and Retry calls `save`. `dirty` stays.
- **The hook owns:**
  - the 3 s autosave timer (reset on every `state` change while dirty);
  - `pagehide`, and `visibilitychange` to `hidden`, both calling `flush()`;
  - a `beforeunload` handler that calls `preventDefault()` and sets `returnValue = ''` **only while `status === 'failed'`**;
  - an unmount cleanup that calls `flush()`.

  The page's own autosave, unmount and `beforeunload` effects are deleted in Task 3.
- **Flush after an in-flight save** (the algorithm the tests don't spell out):
  - `stateRef.current` mirrors `state` on every render.
  - `inFlight` is a ref holding the running save's promise, which resolves to its `saved` action, or to `null` when there was nothing to save.
  - The save computes `buildSaveOps(stateRef.current)` and awaits `saveDiagramSet`. It then dispatches `saved` if still mounted, **and** sets `stateRef.current = diagramReducer(stateRef.current, saved)`, so a flush after unmount sees the real ids and the committed set.
  - A second `save()` while one is in flight returns the same `inFlight` (still one save at a time, invariant 29).
  - `flush()` awaits `inFlight`, ignoring its error, then calls `save()` again if `isEditorDirty(stateRef.current)`.
- Validation before any write, the repaired scene, the batch, the stamps, thumbnail invalidation and the error texts are all unchanged.

- [ ] **Step 1: Failing tests** in `useDiagramEditorSave.test.ts`. Use `vi.useFakeTimers({ shouldAdvanceTime: true })` where timers advance.
  - `it('autosaves 3 s after the last change, once')`.
  - `it('pagehide flushes a pending change at once')`: dispatch `new Event('pagehide')` on `window` before 3 s. `saveDiagramSet` is called once.
  - `it('a hidden page flushes too')`: `visibilityState` is mocked `'hidden'`, then dispatch `visibilitychange` on `document`.
  - `it('beforeunload warns only while a save is failing')`:
    - while dirty with no failure, a dispatched `beforeunload` event (cancelable) has `defaultPrevented === false`;
    - after a rejected save, it is `true`.
  - `it('status is saving while dirty, failed after a rejected save, saved after a success')`.
  - `it('unmount during an in-flight save writes the later edits under the real ids')`. Steps:
    - `saveDiagramSet` is a deferred promise;
    - `addDiagram` (temp `t`), then `act(() => flush())`;
    - add a cone to `t` while the save is in flight;
    - `unmount()`, then resolve the first call with `{ idMap: { [t]: 'real-2' } }`;
    - the 2nd call's ops are `creates: []` and `updates: [{ id: 'real-2', … }]` with the cone in its scene.
  - `it('an undo after a save is autosaved')`: add, let it save, undo, advance 3 s. The 2nd call writes the scene without the item.
- [ ] **Step 2:** Run `npx vitest run src/diagrams/useDiagramEditorSave.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/diagrams`. Expected: PASS. The 2 existing save-failure tests and every `DiagramEditorPage` test pass. The page still has its own timer until Task 3; the in-flight guard keeps it to one save at a time, and "flushes an unsaved change to saveDiagramSet when the editor unmounts" passes.
- [ ] **Step 5: Commit** `fix(diagrams): autosave pipeline with flush on leave and page hide (B2)`

### Task 3: Editor frame: full screen, floating glass chrome, status and leave (B2)

**Files:**
- Create: `src/diagrams/SaveStatus.tsx`
- Modify: `src/App.tsx`, `src/diagrams/DiagramEditorPage.tsx`, `src/diagrams/Palette.tsx`, `src/i18n/en/diagrams.ts`, `src/i18n/it/diagrams.ts`, `src/i18n/italianLabelBudget.test.ts`
- Test: `src/diagrams/DiagramEditorPage.test.tsx`

**Interfaces:**
- Consumes Task 2: `status`, `flush`, `save`, `saveError`.
- **Route.** Move the `/exercises/:exerciseId/diagram` route out of `<Route element={<AuthenticatedLayout />}>` to sit beside the scouting route, keeping `RequireSection section="exercises"` and the same `Suspense`/`LazyFallback`. That means no sidebar, no tab bar, no ⌘K palette and no `PageChromeProvider`. The editor publishes no chrome.
- **Root.** `<div data-own-undo className="fixed inset-0 flex flex-col bg-bg">`. `data-own-undo` makes `NoticeProvider`'s Ctrl+Z ignore the editor.
- **`SaveStatus({ status, onRetry }: { status: 'saved' | 'saving' | 'failed'; onRetry: () => void })`:**
  - `saved` renders `ed.status.saved` and `saving` renders `ed.status.saving`, as `<span className="text-footnote text-ink-2">`;
  - `failed` renders `<button className="min-h-11 rounded-full px-3 text-footnote font-semibold text-red-strong hover:bg-red-tint">{ed.status.retry}</button>`, which calls `onRetry`.
  - There is no live region (it would announce every 3 s). The detailed `saveError` stays a `role="alert"` line: under the desktop toolbar in a `glass rounded-lg px-3 py-1 text-footnote text-red-strong` pill, and on its own line on phones.
- **The manual Save button is removed** on both layouts. The status replaces it (§8.6: "a status in the toolbar").
- **Leaving.** The back control is `aria-label={ed.backToExercises}`, with ChevronLeft and, on desktop, the visible text `ed.exercisesLink`.
  - When `status !== 'failed'` it calls `navigate('/exercises')`, and the hook's unmount flush saves.
  - When failing, it opens `ConfirmDialog` with `title={ed.leaveFailingTitle}`, `message={ed.leaveFailingMessage}` and `confirmLabel={ed.leave}`. Leave navigates.
  - Browser Back can't be blocked under `BrowserRouter`, so it relies on the unmount flush.
- **Desktop (≥ 1024 px).** The canvas is `absolute inset-0`. Over it float:
  - **Toolbar:** `absolute inset-x-3 top-3 z-10 flex items-center gap-2 rounded-xl glass-pop px-2 min-h-[52px]`. It holds:
    - the back control and `SaveStatus`;
    - `<Palette variant="toolbar">`: the same 10 buttons and names, `flex gap-1 overflow-x-auto`, `min-h-11 rounded-md px-3 text-callout text-ink hover:bg-surface-2`;
    - Undo and Redo as 44 px icon buttons (`Undo2`, `Redo2`) with `aria-label` "Undo" / "Redo" and the same disabled rules.
  - **Tabs:** `DiagramTabs` in a `glass-pop rounded-xl` strip at `left-3 top-[76px]`.
  - **Inspector:** `<aside className="absolute bottom-3 right-3 top-[132px] w-[280px] overflow-y-auto rounded-xl glass-pop">`. A "Court" group (`text-caption text-ink-2` header; Snap, the Court select, Zones) comes first, which keeps court settings inline on desktop (invariant 32). Then `PropertiesPanel`.
  - **Zoom group:** `absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-xl glass-pop`, with 44 px buttons and the same labels.
  - **Empty state** (no diagrams): centred "No diagrams yet." and **Add the first diagram** (primary), with the toolbar still shown.
- **Phone.**
  - **Header:** `glass` with `pt-[env(safe-area-inset-top)]`. It holds the back chevron, `SaveStatus` (`flex-1`), Undo, Redo and the Court settings toggle (`aria-expanded`, a `bg-surface-3` pressed state), and no Save.
  - The settings row, the tab strip and the canvas are unchanged in structure.
  - **Bottom tool bar:** the same 6 buttons and enablement. It is `glass`, with `aria-pressed:bg-surface-3 aria-pressed:text-ink`, and Delete in `text-red-strong`.
  - **`BottomPanel`** stays a non-modal `<section aria-label>` (the court stays live above it). Restyled: `rounded-t-xl bg-surface shadow-sheet`, with a grabber bar (`mx-auto h-1 w-9 rounded-full bg-ink-3/40`, `aria-hidden`), a `text-headline` title and a 44 px close X.
  - Zoom stays top-right of the canvas.
- **Strings** under `diagrams.editor`:

  | Key | en | it |
  |---|---|---|
  | `status.saved` | `'Saved'` | `'Salvato'` |
  | `status.saving` | `'Saving…'` | `'Salvataggio…'` |
  | `status.retry` | `'Not saved — Retry'` | `'Non salvato — Riprova'` |
  | `exercisesLink` | `'Exercises'` | `'Esercizi'` |
  | `leaveFailingTitle` | `'Leave and lose the last changes?'` | `'Uscire e perdere le ultime modifiche?'` |
  | `leaveFailingMessage` | `'The last changes could not be saved.'` | `'Le ultime modifiche non sono state salvate.'` |
  | `court` (group header, already exists) | reused | reused |

  - **Remove** `exercises`, `saving`, `unsaved`, `allSaved`, `leaveTitle` and `leaveMessage` in en and it.
  - The budget test adds pairs for `diagrams.editor.status.{saved,saving,retry}`.

- [ ] **Step 1: Failing tests** in `DiagramEditorPage.test.tsx`. Use fake timers with `shouldAdvanceTime: true` where 3 s pass.
  - `it('shows Saved, then Saving… after a change, and autosaves once')`: "Saved" shows; after "Ball", "Saving…" shows; advance 3 s. `saveDiagramSet` has been called once, and "Saved" shows again.
  - `it('leaving a dirty editor never asks and saves the change (B2)')`: after "Ball", click "Back to exercises". "Exercises list" shows, no `alertdialog` appears, and `saveDiagramSet` has been called.
  - `it('while a save is failing, the toolbar offers Retry and leaving asks first (B2)')`:
    - `saveDiagramSet` rejects;
    - after "Ball" and 3 s, the button "Not saved — Retry" shows;
    - clicking it calls `saveDiagramSet` again;
    - "Back to exercises" opens the `alertdialog` "Leave and lose the last changes?". Cancel stays put; Leave shows "Exercises list".
  - `it('the editor owns Ctrl+Z, not the undo notice')`: the stage sits inside `[data-own-undo]`.
- [ ] **Step 2:** Run `npx vitest run src/diagrams/DiagramEditorPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Update tests (mapped to B2).**
  - "keeps Save disabled until a change, then calls saveDiagramSet once" is replaced by the first new test.
  - "confirms in-app before leaving via ‹ Exercises when the editor is dirty" is replaced by the two leave tests.
  - "changes the court to half … enabling Save" and "toggles zone labels … and enables Save" assert "Saving…" instead of an enabled Save. Their backdrop and zones assertions are unchanged.
  - "flushes an unsaved change … when the editor unmounts" waits for "Saving…" instead of an enabled Save.
- [ ] **Step 5:** Run `npx vitest run src/diagrams src/search src/i18n src/App.test.tsx`. Expected: PASS. Every other editor test passes unchanged: palette, undo/redo, the transform handle, endpoints, the clipboard keys, right-click, multi-select, marquee, title-focus no-ops, and all three phone tests. So do `SearchProvider.test.tsx` and `diagramsItalian.test.tsx`.
- [ ] **Step 6: Commit** `feat(diagrams): full-screen editor with floating glass chrome and an honest save status (B2)`

### Task 4: Editor parts in tokens

**Files:**
- Modify: `src/diagrams/DiagramTabs.tsx`, `src/diagrams/PropertiesPanel.tsx`, `src/diagrams/CanvasContextMenu.tsx`, `src/diagrams/CanvasStage.tsx`, `src/diagrams/DiagramSvg.tsx`, `src/diagrams/DiagramLightbox.tsx`, `src/diagrams/DiagramThumbnail.tsx`
- Test: `src/diagrams/DiagramSvg.test.tsx`, `src/diagrams/DiagramTabs.test.tsx`

**Interfaces:**
- **`DiagramSvg`:** the selection outline, the endpoint and transform handles and the marquee use `rgb(var(--color-focus))` (marquee fill `/ 0.1`). Court lines, items and markers are unchanged, so the PDF (static render, no selection) is unaffected.
- **`DiagramTabs`:**
  - the strip is `flex gap-1.5 overflow-x-auto px-2 py-1.5`, wrapping from `lg`, with no border or background of its own (the parent supplies glass);
  - the active tab is `bg-surface-3 rounded-lg` holding the title input (`text-callout text-ink`, `focus-visible:ring-focus`);
  - inactive tabs are `min-h-11 rounded-lg px-3 text-callout text-ink-2 hover:bg-surface-2`;
  - the pending-save dot is `bg-ink-2` (a pending save is not a warning);
  - icons are `text-ink-2`, Delete is `text-red-strong`, and "+" is a 44 px ghost.
- **`PropertiesPanel`:**
  - section labels are `text-caption text-ink-2`, sentence case;
  - selects and inputs use the field tokens, at 16 px on touch;
  - colour swatches keep `aria-pressed`, with the pressed ring in `ring-ink`;
  - nudge, Back/Forward and Delete are 44 px; Delete element is `dangerGhost`;
  - sliders use `accent-[rgb(var(--color-ink))]`.
- **`CanvasContextMenu`:** `glass-pop rounded-xl p-1 min-w-48`. Items are `min-h-11 rounded-md px-3 text-callout text-ink hover:bg-surface-2 disabled:text-ink-3`, with Delete in `text-red-strong`. Roles, order, close rules and positioning are unchanged.
- **`CanvasStage`:** the background is `bg-bg`. Nothing else changes.
- **`DiagramLightbox`:**
  - the scrim is `bg-[var(--scrim)]`;
  - the title sits on a `glass rounded-full px-4` pill in `text-headline text-ink`;
  - the diagram box is `bg-surface rounded-xl shadow-pop`;
  - Prev/Next are 44 px icon buttons in `glass rounded-full`, keeping their aria labels;
  - close X is 44 px glass.

  Wrap-around, Escape, backdrop close and focus-on-open are unchanged.
- **`DiagramThumbnail`:** the frame is `rounded-md bg-surface-2` with no border. Caching and the lightbox are unchanged.

- [ ] **Step 1: Failing tests.**
  - `DiagramSvg.test.tsx`: `it('draws selection, handles and the marquee in the focus colour, never the Advanced blue')`. Every `[data-selection-outline]`, `[data-transform-handle]` and `[data-marquee-rect]` stroke contains `--color-focus` and not `--color-blue`.
  - `DiagramTabs.test.tsx`: `it('marks a diagram waiting to save with a neutral dot')`. The dot has `bg-ink-2`.
- [ ] **Step 2:** Run `npx vitest run src/diagrams/DiagramSvg.test.tsx src/diagrams/DiagramTabs.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/diagrams src/trainings/pdf`. Expected: PASS. Every other diagram test passes unchanged, including `CanvasContextMenu`, `DiagramLightbox`, `DiagramThumbnail`, `PropertiesPanel`, `primitives`, and `diagramToPdfSvg.test.ts` (no `var(--` left).
- [ ] **Step 5: Commit** `feat(diagrams): editor parts in v2 tokens; selection in the focus colour`

### Task 5: Shared chips, view sheets and a guarded footer Cancel

**Files:**
- Create: `src/components/Chip.tsx`, `src/components/Chip.test.tsx`
- Modify: `src/components/Sheet.tsx`
- Test: `src/components/Sheet.test.tsx`

**Interfaces:**
- **`Chip.tsx`:**
  ```ts
  export function chipClass(active: boolean): string;
  // 'pressable inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-4 text-callout font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-focus '
  //   + (active ? 'bg-ink text-on-ink' : 'bg-surface-2 text-ink-2 hover:bg-surface-3')
  export function FilterChips<T extends string>(props: {
    label: string;                                   // role="group" aria-label
    options: readonly { id: T; label: string }[];
    value: T; onChange: (id: T) => void; className?: string;
  }): JSX.Element;                                   // one line, overflow-x-auto, -mx-4 px-4 bleed on phones; each chip a <button aria-pressed>
  export function ToggleChip(props: {
    pressed: boolean; onToggle: () => void; label: string; ariaLabel?: string; icon?: ReactNode;
  }): JSX.Element;
  ```
- **`Sheet`** gains `variant?: 'form' | 'view'` (default `'form'`).
  - `'view'`: the phone header has no leading Cancel, and its trailing slot is always a `t.done` button (`requestClose`), even when `footer` is set.
  - Desktop is unchanged (X close).
- **`SheetCancelButton({ className }: { className?: string })`** is exported from `Sheet.tsx`. It renders `<Button variant="ghost" onClick={useSheetClose()}>{t.cancel}</Button>`. Custom footers use it, so Cancel is guarded (§4.6).

- [ ] **Step 1: Failing tests.**
  - `Chip.test.tsx`:
    - `it('FilterChips is a labelled group with one pressed chip')`;
    - `it('a chip is a 44 px pill, ink when pressed')`;
    - `it('ToggleChip toggles and exposes its aria label')`.
  - `Sheet.test.tsx`, mocking `matchMedia` as the file already does:
    - `it('a view sheet shows Done and no Cancel in the phone header, even with a footer')`;
    - `it('SheetCancelButton asks to discard when the sheet is dirty and closes at once when clean')`.
- [ ] **Step 2:** Run `npx vitest run src/components/Chip.test.tsx src/components/Sheet.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/components`. Expected: PASS. Every existing `Sheet`, `Dialog` and `SegmentedControl` test passes unchanged.
- [ ] **Step 5: Commit** `feat(components): filter chips, view sheets and a guarded footer Cancel`

### Task 6: Exercise library: chips, list and gallery, row actions, undo delete (screen 7)

**Files:**
- Create: `src/exercises/ExerciseRow.tsx`
- Modify: `src/exercises/ExercisesPage.tsx`, `src/i18n/en/exercises.ts`, `src/i18n/it/exercises.ts`
- Test: `src/exercises/ExercisesPage.test.tsx`

**Interfaces:**
- Consumes Task 5: `FilterChips`.
- **Page.** The `PageHeader` and toolbar (New exercise; "⋯" with Import and AI draft) are unchanged. The content sits in `mx-auto max-w-[1080px]`.
  - `<FilterChips label={p.filterByCategory} options={[{ id: '', label: p.all }, …categories]} value={category} onChange={setCategory} />`. The query behaviour is unchanged.
  - While `!loaded && !error`: `<div role="status" aria-label={t.common.loading}>` with 3 `SkeletonBlock className="h-[72px]"` rows.
- **`ExerciseRow({ exercise, onOpen, onEditDiagram, onDelete })`.** It renders an `<li>` holding:
  - a `SwipeRow trailing={[{ label: t.common.delete, tone: 'destructive', undoable: true, onAction: onDelete }]}`;
  - inside it, the item: `div role="button" tabIndex=0`, with click, and Enter/Space on itself only, calling `onOpen`.

  The responsive shape comes from one markup:
  - **Phone (< 768):** a grouped-list row (`min-h-[72px] flex gap-3 px-4 py-3`, inset hairline). It holds:
    - the 64 px **interactive** `DiagramThumbnail`, inside a wrapper that stops click and keydown;
    - the name in `text-headline`;
    - the footnote: the category label and, when set, `t.trainings.playersNote.min(minPlayers)`;
    - the description, clamped to 2 lines;
    - trailing, the kebab.
  - **From `md`:** the list becomes `md:grid md:grid-cols-3 lg:grid-cols-4 md:gap-3`, and each item a card (`md:flex-col md:rounded-lg md:bg-surface md:shadow-card md:overflow-hidden`). The card leads with an `aspect-[4/3] bg-surface-2` frame holding the interactive thumbnail (`className="block h-full w-full"`, or nothing when there's no diagram). Below it: the name, the footnote, a 1-line clamped description, and the kebab at the top-right of the text block.
  - **Kebab:** `<Menu label={p.rowMenu(name)} trigger={<MoreHorizontal size={20}/>} triggerClassName="h-11 w-11 …" items={items} />`, wrapped in a `span` that stops click and keydown propagation.
  - **The same items** go to `useContextMenu({ label: p.rowMenu(name), items })`. Its `targetProps` are spread on the item, and its `menu` is rendered as a sibling of the item, never inside it.
  - **Items** (§6.4 Exercises):
    - Edit (`p.edit`), which calls `onOpen`;
    - Edit diagram (`t.exercises.form.editDiagrams`), which navigates to `/exercises/{id}/diagram`;
    - Delete (`t.common.delete`, danger, Trash2), which calls `onDelete`.
- **Undo delete (§6.2).** `requestDelete(exercise)` adds the id to a hidden `Set` (the row leaves at once), clears `deleteError`, then calls `useUndoable()` with:
  ```ts
  { message: p.deletedNotice(exercise.name),
    commit: async () => { await deleteExercise(exercise.id); if (mounted.current) dropFromList(exercise.id); },
    onUndo: () => unhide(exercise.id),
    onCommitError: () => { if (mounted.current) { unhide(exercise.id); setDeleteError(p.deleteError); } } }
  ```
  - `deleteError` renders as `role="alert"` above the list. The empty state counts visible rows.
  - **`countTrainingsUsingExercise` is no longer called from the page** (see the decisions). The `ConfirmDialog`, `pendingDelete` and `USAGE_UNKNOWN` go.
- **Strings** under `exercises.page`:

  | Key | en | it |
  |---|---|---|
  | `deletedNotice` | `` (n) => `Exercise “${n}” deleted` `` | `` (n) => `Esercizio “${n}” eliminato` `` |
  | `rowMenu` | `` (n) => `Actions for ${n}` `` | `` (n) => `Azioni per ${n}` `` |
  | `edit` | `'Edit'` | `'Modifica'` |

  **Remove** `deleteTitle`, `usageUnknown`, `usedIn`, `notUsed` and `confirmDelete` in en and it.

- [ ] **Step 1: Failing tests** in `ExercisesPage.test.tsx`. Wrap `renderPage` in `NoticeProvider`, and use `vi.useFakeTimers({ shouldAdvanceTime: true })` where `UNDO_MS` passes.
  - `it('delete is an undo: the card leaves at once and the delete runs when the notice expires')`: the row is gone right after the menu's Delete, `deleteExercise` hasn't been called, and no `alertdialog` appears. Advance `UNDO_MS`: it has been called with `'ex-1'`, and `listExercises` was not called again.
  - `it('Undo restores the card and never deletes')`.
  - `it('a second delete commits the first at once')`.
  - `it('a failed delete brings the card back with the error')`: the alert reads "Could not delete the exercise. Please try again.".
  - `it('right-click offers Edit, Edit diagrams and Delete')`, using `fireEvent.contextMenu`.
  - `it('the kebab and its items never open the edit sheet')`: click the kebab, press Enter on it, then choose Delete. No "Edit exercise" dialog appears.
  - `it('Edit diagrams from the row menu opens the editor')`.
  - `it('the category filter is a horizontally scrolling chip row')`: the group "Filter by category" has `overflow-x-auto`.
- [ ] **Step 2:** Run `npx vitest run src/exercises/ExercisesPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Update tests.**
  - "shows the training usage count in the delete confirmation" and "still opens the delete confirmation when the usage count read fails" are replaced by the undo tests. This is mapped to §6.2 (exercise delete becomes Undo).
  - "stacks each exercise entry as a card on mobile, with the description un-clamped" is replaced by an assertion that the item has `md:flex-col` and that the description has `line-clamp-2`. That is markup, mapped to §8.6.
  - "opens the edit dialog when the row is clicked, but not when Delete is clicked" and "…on keyboard Enter…" use the kebab instead of the Delete button, with unchanged assertions.
- [ ] **Step 5:** Run `npx vitest run src/exercises src/components src/i18n`. Expected: PASS. These pass unchanged:
  - `?exercise=` open and unknown;
  - AI hidden;
  - the main action;
  - first page;
  - chip reload and active chip;
  - the load-error alert;
  - the pending action;
  - Import;
  - AI save reload;
  - `exercisesItalian.test.tsx`.
- [ ] **Step 6: Commit** `feat(exercises): v2 library with a diagram gallery, row actions and undo delete`

### Task 7: Training library: filter row, grouped list, row actions, undo delete (screen 6)

**Files:**
- Create: `src/trainings/TrainingRow.tsx`
- Modify: `src/trainings/TrainingsPage.tsx`, `src/trainings/TrainingViewSheet.tsx` (one prop only), `src/i18n/en/trainings.ts`, `src/i18n/it/trainings.ts`
- Test: `src/trainings/TrainingsPage.test.tsx`, `src/trainings/TrainingViewSheet.test.tsx`

**Interfaces:**
- **Page.** The toolbar is unchanged. The content sits in `mx-auto max-w-[1080px]`.
  - The filter row keeps its markup classes (`flex flex-wrap gap-3`; fields `w-full sm:w-40`), its labels and its debounce. Labels are `text-footnote text-ink-2`.
  - The skeleton is the same as in Task 6.
  - The list is a grouped list (`rounded-lg bg-surface shadow-card`) of `TrainingRow`s.
- **`TrainingRow({ training, onOpen, onEdit, onExportPdf, onDelete })`.** The `li` holds a `SwipeRow` (trailing Delete, undoable), which holds the `div role="button"` item (`min-h-[60px] flex items-center gap-3 px-4 py-2`). The item shows:
  - a title line: `businessId` (`text-callout tabular-nums text-ink-2`) then the name (`text-headline`);
  - the existing `p.summary(…)` footnote;
  - a trailing kebab, with the same wrapper, context-menu and sibling-`menu` rules as Task 6.
- **Items** (§6.4 Trainings):
  - Open (`p.open`), which calls `onOpen`;
  - Edit (`p.edit`), which opens the builder with `fromView: false`;
  - Export PDF (`p.exportPdf`), which opens the view sheet with `autoBuildPdf`;
  - Delete (`p.delete`, danger), which calls `onDelete`.

  There is no Duplicate, because there is none today.
- **`TrainingViewSheet`** gains `autoBuildPdf?: boolean`. On mount, when set and there's no `teamContext`, it calls `buildPdf()` once. Sharing still takes the "Share PDF ready" tap, so the two-tap flow holds. The page's `dialog` view state carries `autoPdf?: boolean`.
- **Undo delete:**
  - the pattern is the same as Task 6, with `deleteTraining(id)`, `p.deletedNotice(training.businessId)` and `p.deleteError`;
  - the commit drops the row locally (no reload);
  - the Business ID lookup view (0 or 1 row) hides that row the same way.
- **Strings** under `trainings.page`:

  | Key | en | it |
  |---|---|---|
  | `deletedNotice` | `` (b) => `Training ${b} deleted` `` | `` (b) => `Allenamento ${b} eliminato` `` |
  | `rowMenu` | `` (b) => `Actions for ${b}` `` | `` (b) => `Azioni per ${b}` `` |
  | `open` | `'Open'` | `'Apri'` |
  | `edit` | `'Edit'` | `'Modifica'` |
  | `exportPdf` | `'Export PDF'` | `'Esporta PDF'` |

  **Remove** `deleteTitle`, `deleteMessage` and `deleteConfirm` in en and it.

- [ ] **Step 1: Failing tests.** `TrainingsPage.test.tsx` wraps in `NoticeProvider`.
  - `it('delete is an undo: the row leaves at once and the delete runs when the notice expires')`: `deleteTraining` is called with `'t-1'` after `UNDO_MS`, and there is no reload.
  - `it('Undo restores the row and never deletes')`.
  - `it('a second delete commits the first at once')`.
  - `it('a failed delete brings the row back with the error')`.
  - `it('the kebab and its items never open the plan')`.
  - `it('right-click offers Open, Edit, Export PDF and Delete')`.
  - `it('Edit from the row menu opens the builder; closing it returns to the list')`.
  - `it('Export PDF from the row menu opens the plan and starts building')`: with `TrainingViewSheet` mocked to record props, `autoBuildPdf` is `true`.
  - `TrainingViewSheet.test.tsx`: `it('autoBuildPdf starts building once and still needs the Share PDF ready tap')`. `generateTrainingPdf` is called once, then "Share PDF ready" shows, and `shareOrDownload` hasn't been called.
- [ ] **Step 2:** Run `npx vitest run src/trainings/TrainingsPage.test.tsx src/trainings/TrainingViewSheet.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Update tests.**
  - "confirms before deleting a training" is replaced by the undo test (§6.2).
  - "stacks each training entry as a card on mobile, with Delete on its own row" is replaced by an assertion that the row is inside the grouped list (`rounded-lg bg-surface`). That is markup, §8.6.
  - "opens the read-only plan when the row is clicked (not on Delete)…" uses the kebab, with unchanged assertions.
- [ ] **Step 5:** Run `npx vitest run src/trainings src/components src/i18n`. Expected: PASS. These pass unchanged:
  - `?training=`;
  - the paginated list;
  - "adapts the page header, gutter, and filter row for mobile";
  - the Business ID lookup and seed;
  - the load-error alert;
  - Import;
  - the age-group debounce (one query);
  - the "⋯" menus;
  - the pending action;
  - AI hidden;
  - the AI prefill;
  - the calendar session context;
  - every other `TrainingViewSheet` test.
- [ ] **Step 6: Commit** `feat(trainings): v2 library with row actions, Export PDF and undo delete`

### Task 8: Training builder as a sheet, with drag reorder and a full discard guard (§4.6)

**Files:**
- Create: `src/trainings/reorder.ts`, `src/trainings/reorder.test.ts`
- Modify: `src/trainings/TrainingBuilderDialog.tsx`
- Test: `src/trainings/TrainingBuilderDialog.test.tsx`

**Interfaces:**
- Consumes Task 5: `FilterChips`, `ToggleChip`.
- **`reorder.ts`:**
  ```ts
  export function moveRow<T>(list: readonly T[], from: number, to: number): T[];
  /** Index the dragged row lands on: how many other rows' midpoints lie above `y`. */
  export function dropIndex(mids: readonly number[], from: number, y: number): number;
  export function useRowReorder(opts: { count: number; onMove: (from: number, to: number) => void }): {
    listRef: RefObject<HTMLUListElement>;
    handleProps: (index: number) => ReturnType<ReturnType<typeof useDrag>>; // spread on the handle
    rowStyle: (index: number) => CSSProperties | undefined;                  // translateY + lift while dragging
  };
  ```
  - `useRowReorder` uses `useDrag` from `@use-gesture/react`.
  - On start it reads the midpoints of `listRef.current.children`.
  - While moving, the dragged row gets `transform: translateY(my) scale(1.02)`, `shadow-pop` and `z-10`. With reduced motion there is no scale.
  - On release it calls `onMove(from, dropIndex(mids, from, mids[from] + my))` when the index changes.
- **Shell:**
  ```tsx
  <Sheet title={…unchanged} size="lg" detent="large" guardUnsaved dirty={touched} onClose={onClose}
    confirm={{ label: saving ? m.saving : m.save, form: FORM_ID, disabled: saving }}>
  ```
  - On phones this gives Cancel · title · Save in the header. On desktop it gives a Cancel + Save footer, and Cancel is guarded.
  - The old footer goes. The live summary `m.summary(n, minutes)` moves to the right of the "Exercises" section header (`text-callout tabular-nums text-ink-2`).
- **`touched`** starts as `true` when `initial` holds rows or a name (a draft is unsaved work), and `false` otherwise. Add, Move up/down, Remove, a drag move and a target toggle set it (§4.6). Field edits arm the guard through `guardUnsaved`.
- **Layout** (screen 6, left pane):
  - **Name:** the input at `text-title-3 font-semibold`, with the hint unchanged.
  - Age group and Suggested players side by side from `sm`.
  - **Targets:** `ToggleChip`s, with the same group label, aria-labels, ✓ and category order.
  - **Description.**
  - **Plan:** the `<ul aria-label={m.exercisesList} ref={listRef}>` grouped list (`rounded-lg bg-surface-2`, inset hairlines). Each `li` has:
    - **Line 1:**
      - the drag handle (`GripVertical`, `aria-hidden`, `touch-none cursor-grab text-ink-3 h-11 w-8`, `{...handleProps(i)}`);
      - then the existing view button: a number badge (`h-7 w-7 rounded-full bg-surface-3 text-caption font-semibold tabular-nums text-ink`), the 56 px thumbnail, the name or a red ⚠ "Deleted exercise", category · timing, the PlayersNote, and the chevron (`text-ink-3`).
    - **Line 2:** the minutes input (`w-16 text-right tabular-nums`, 16 px), "min", then Move up, Move down and Remove as 44 px icon buttons (Remove `text-red-strong`). The `sm:h-9` shrink goes; it is 44 px everywhere.
  - **Picker:** a `rounded-lg bg-surface-2 p-3` panel. "Pick an exercise" is `text-headline`, sentence case. Done is a ghost `min-h-11` button. The category `FilterChips` scroll on one line at every width.
    - The suggested and all sections keep their order, headings, empty texts, Load more rules and `sortByFit`.
    - Items have a 44 px expand chevron, the name, a neutral category chip and the PlayersNote, then Add (secondary). The expanded thumbnail is 96 px.
- Validation, offline block, double submit, the prefill, the stale-suggestions guard and the write payloads are all unchanged.

- [ ] **Step 1: Failing tests.**
  - `reorder.test.ts`:
    - `it('moveRow moves one item and keeps the rest in order')`;
    - `it('dropIndex counts the other midpoints above the pointer')`. With `mids [10,30,50,70]`:
      - `(from 0, y 35)` gives 1;
      - `(0, 75)` gives 3;
      - `(3, 5)` gives 0;
      - `(2, 50)` gives 2.
  - `TrainingBuilderDialog.test.tsx`:
    - `it('Cancel after only reordering asks to discard')`: in edit mode with 2 rows, click "Move exercise 1 down", then Cancel. The `alertdialog` "Discard changes?" shows.
    - `it('Cancel after adding an exercise asks to discard')`.
    - `it('Cancel on an untouched builder closes at once')`.
    - `it('a builder prefilled from a draft asks before Cancel discards it')`.
    - `it('each plan row has a drag handle hidden from assistive tech')`.
- [ ] **Step 2:** Run `npx vitest run src/trainings/reorder.test.ts src/trainings/TrainingBuilderDialog.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/trainings src/aiDraft src/exercises`. Expected: PASS. Every existing builder test passes unchanged, which proves the order, payloads, picker, suggestions and offline behaviour are intact. That includes "creates the training once even when Save is clicked twice" and "reorders rows so the moved exercise gets the new order on save". So do `namingItalian.test.tsx` and the `TrainingsPage` builder hand-offs.
- [ ] **Step 5: Commit** `feat(trainings): builder sheet with drag reorder; every edit arms the discard guard`

### Task 9: Training view, exercise detail and team notes sheets

**Files:**
- Modify: `src/trainings/TrainingViewSheet.tsx`, `src/exercises/ExerciseDetailSheet.tsx`, `src/trainings/TeamNotesDialog.tsx`, `src/trainings/PlayersNote.tsx`
- Test: `src/trainings/TrainingViewSheet.test.tsx`, `src/exercises/ExerciseDetailSheet.test.tsx`

**Interfaces:**
- Consumes Task 5: `variant="view"` and `SheetCancelButton`.
- **`TrainingViewSheet`:** `<Sheet variant="view" size="lg" detent="large" title=… footer=…>`. The footer is unchanged in content, order and two-tap logic: Share PDF / Share PDF ready (secondary), Edit (secondary), Start (primary), each `flex-1` on phones.
  - **Meta row:** the age group as a neutral chip (`bg-surface-3 text-ink-2 text-caption rounded-full px-2.5`); the Clock and Users lines in `text-footnote tabular-nums text-ink-2`. Targets are neutral chips.
  - The description is `text-body text-ink whitespace-pre-wrap`.
  - The plan `<ol>` is a grouped list (`rounded-lg bg-surface-2`), with rows `min-h-[60px]`: the badge as in Task 8, the 64 px thumbnail, the name or ⚠, the timing footnote, and the chevron.
  - "Edit team notes" is `text-callout font-medium text-ink underline-offset-2 hover:underline`.
  - The live region, the alerts and "Loading exercises…" (`text-ink-2`) are unchanged.
- **`ExerciseDetailSheet`:** `variant="view"`. The meta pills are neutral chips.
  - The diagram box is `rounded-lg bg-surface-2`. Prev/Next diagram are 44 px ghost icon buttons, and the `i / n` counter is `tabular-nums text-ink-2`.
  - The "Description" label is `text-title-3`, sentence case, not uppercase.
  - The footer's Prev/Next exercise are unchanged.
- **`TeamNotesDialog`:** the footer Cancel becomes `<SheetCancelButton className="hidden md:inline-flex" />`. It has no dirty state, so it closes at once, as today. The intro is `text-callout text-ink-2`. Player rows are inset grouped rows, and the checkbox uses `accent-[rgb(var(--color-ink))]`.
- **`PlayersNote`:** the warning is `bg-orange-tint text-orange-strong rounded-full px-2 text-caption`. The plain "Min N players" is `text-footnote text-ink-2`.

- [ ] **Step 1: Failing tests.**
  - `TrainingViewSheet.test.tsx`: `it('reads as a view on phones: Done, no Cancel')`, mocking `matchMedia` to a phone.
  - `ExerciseDetailSheet.test.tsx`: `it('labels the description section in sentence case')`. The heading "Description" has no `uppercase` class.
- [ ] **Step 2:** Run `npx vitest run src/trainings/TrainingViewSheet.test.tsx src/exercises/ExerciseDetailSheet.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/trainings src/exercises src/aiDraft`. Expected: PASS. These pass unchanged:
  - every `TrainingViewSheet` test (order and timings, Start, Escape, Edit hand-off, players/targets, build-then-share without rebuild, live region, error reset, download notice, cancelled share, team-notes payload);
  - `TeamNotesDialog.test.tsx`;
  - every `ExerciseDetailSheet` test (arrow keys, swipe, wrap, cache, draft scene);
  - `buildTrainingPdf.test.ts`, `exportTrainingPdf.test.ts`.
- [ ] **Step 5: Commit** `feat(trainings): v2 training view, exercise detail and team notes sheets`

### Task 10: Exercise form and AI draft sheets

**Files:**
- Modify: `src/exercises/ExerciseFormDialog.tsx`, `src/aiDraft/ExerciseDraftDialog.tsx`, `src/aiDraft/TrainingDraftDialog.tsx`, `src/aiDraft/ExerciseProposalReview.tsx`, `src/aiDraft/TrainingProposalReview.tsx`, `src/aiDraft/DraftDiagramPreview.tsx`
- Test: `src/exercises/ExerciseFormDialog.test.tsx`, `src/aiDraft/ExerciseDraftDialog.test.tsx`

**Interfaces:**
- Consumes Task 5: `SheetCancelButton`, `ToggleChip`.
- **`ExerciseFormDialog`:** `<Sheet guardUnsaved detent="large" title=… confirm={{ label: saving ? f.saving : t.common.save, form: FORM_ID, disabled: saving }}>`. The custom footer goes.
  - In create mode, **Create & add diagrams** moves to the end of the body as a full-width secondary button, before the error. Its behaviour, offline block and navigation are unchanged.
  - In edit mode, "Diagrams" is a `text-title-3` header. **Edit diagrams** is a grouped row button with the same accessible name, `min-h-11` and a chevron; it navigates as today. The preview strip tiles are `rounded-md bg-surface-2`.
  - The category select uses the field tokens.
- **AI sheets.** They keep the `Dialog` adapter and their footers, because their steps change the footer. Only:
  - each desktop Cancel in review or the request form becomes `<SheetCancelButton className="hidden md:inline-flex" />`, so it is guarded once proposals or a draft exist (§4.6). Cancel **while generating** still aborts the request (unchanged);
  - targets use `ToggleChip`;
  - the "AI draft" badge, Library badge and category badges are neutral chips. The **New** badge is `bg-ink text-on-ink` (not a warning). "Added to library" is `text-green-strong`. The off-by-more-than-10 % total stays `text-orange-strong`;
  - cards and step rows are grouped rows on `bg-surface-2 rounded-lg`, with 44 px Move, Remove and Edit buttons;
  - `DraftDiagramPreview`'s dashed "No diagram" box is `border-separator text-ink-2`.

  Steps, prompts, validation, payloads, retries and the locked cards are unchanged.

- [ ] **Step 1: Failing tests.**
  - `ExerciseFormDialog.test.tsx`: `it('Cancel on an edited exercise asks to discard')`: type in Name, click Cancel, and the `alertdialog` "Discard changes?" shows.
  - `ExerciseDraftDialog.test.tsx`: `it('Cancel in review asks before discarding the proposals')`.
- [ ] **Step 2:** Run `npx vitest run src/exercises/ExerciseFormDialog.test.tsx src/aiDraft/ExerciseDraftDialog.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/exercises src/aiDraft src/trainings`. Expected: PASS. These pass unchanged:
  - every `ExerciseFormDialog` test (create, edit, `minPlayers` null, double submit, Create & add diagrams offline and navigation, the lightbox);
  - `exercisesItalian.test.tsx`;
  - every `ExerciseDraftDialog` and `TrainingDraftDialog` test (abort, retry, regenerate, locked cards, Open in builder, `NumberField`);
  - `aiDraftItalian.test.tsx`.
- [ ] **Step 5: Commit** `feat(exercises): exercise form and AI draft sheets in v2 with a guarded Cancel`

### Task 11: Gate and user checklist

**Files:** none new.

- [ ] **Step 1:** Run `npm test`, `npm run lint` and `npm run build`. Expected: all green, with 0 lint errors. If a known flaky load-timeout test fails, rerun that file alone and report both results.
- [ ] **Step 2: Greps.** Each should print nothing:
  - `grep -rnE "dark:|navy|slate|border-border|text-white|bg-black/|bg-blue|text-blue|ring-blue" src/trainings src/exercises src/aiDraft src/diagrams --include=*.tsx | grep -v test | grep -v "src/trainings/pdf" | grep -v "src/diagrams/primitives"`
  - `grep -n "<Dialog" src/trainings/TrainingBuilderDialog.tsx src/trainings/TrainingViewSheet.tsx src/exercises/ExerciseFormDialog.tsx src/exercises/ExerciseDetailSheet.tsx`
  - `grep -n "ConfirmDialog" src/trainings/TrainingsPage.tsx src/exercises/ExercisesPage.tsx`
  - `grep -n "beforeunload\|setTimeout" src/diagrams/DiagramEditorPage.tsx`
- [ ] **Step 3: Commit** any lint-only fix-ups as `chore(trainings): gate fix-ups`, if there are any.
- [ ] **Step 4: User checklist** for the group report. The user runs it on a real phone and a desktop, in light and dark mode.
  - **Screen 7.** Exercises: the chips scroll on one line; cards lead with the court diagram from tablet up; a phone shows rows with a thumbnail. The thumbnail opens the lightbox; the card opens edit. Right-click or long-press and the "⋯" offer Edit, Edit diagrams and Delete; swipe left deletes. Delete, then Undo: it comes back. Delete and wait 6 s: it is gone, and the list keeps its scroll and loaded pages.
  - **Screen 6.** Trainings: grouped rows with `TR-0007 · name`; the same row actions plus Export PDF (it opens the plan and prepares the PDF, then "Share PDF ready" shares). New training opens a 720 px sheet. On a phone: Cancel · New training · Save. Drag a row by its grip to reorder. Reorder, then Cancel: it asks.
  - **View sheet.** Phone header "Done". Share PDF, then Share PDF ready, still works. From a calendar session, team notes come first.
  - **Diagram editor (B2/B3).** It is full screen with no sidebar or tab bar. Desktop: the glass toolbar holds the tools; the glass inspector holds Court and the properties. Draw something: "Saving…" then "Saved". Undo still works after "Saved", and after switching tabs and back. Leave at once after a change: no prompt, and reopening shows the change. In airplane mode the status stays "Saving…"; with a rejected save (for example a title cleared to empty), "Not saved — Retry" shows, closing the tab warns, and Back asks "Leave and lose the last changes?".
  - **Phone editor.** The bottom tool bar and bottom panels; the court stays live above the panels; the court settings toggle.
  - Italian: the chips, the row menus, "Non salvato — Riprova" and the toolbar tools fit.
  - `tailwind.config.js` did not change, so no dev-server restart is needed. If it did change, restart.
