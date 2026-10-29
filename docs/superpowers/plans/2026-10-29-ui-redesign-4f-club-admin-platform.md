# UI Redesign 4f: Club Area, Guides and the Platform Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild area 07 (club area with Profile, People & access, Export and Contract; the restricted club area; `/admin/guides`; `/platform` with Clubs and Leads) in the v2 system. It fixes B9, B10 and B11, ships the §4.6 items for this area (guides `?tab=`, "Back to app" on the platform shell, instant role changes with an undo), the §6.2 lead-delete undo, the §6.4 People and Leads row actions and the §6.5 main actions. Every inventory-07 invariant holds.

**Precondition:** increments 1–3 are merged (the `Sheet`, `SegmentedControl`, `GroupedList`/`ListRow`, `useContextMenu`, `SwipeRow`, `useUndoable`, `Skeleton`, `PageChrome` primitives). Nothing from 4c–4e is needed.

**Architecture:**
- **Shells.** `MinimalShell` gets v2 tokens and its own `PageChromeProvider`, and renders the published main action in its header. This is what lets the restricted club area (rendered by `ClubGate` outside `AppShell`) still show Export's main action. The platform shell moves to `src/platform/PlatformShell.tsx` and gains "Back to app".
- **Club area.** The tabs become a `SegmentedControl semantics="tabs"` (still `?tab=` with `replace`). As on the team page, the tab that owns a main action publishes the chrome: Export publishes "Download export", and People publishes "Add person". `ClubAreaPage`'s header publishes for Profile and Contract, with no main action. Profile and Contract become Settings-style grouped surfaces with the same fields.
- **People & access.** Members are a grouped list with Owner and role pills and a context menu. The selected person's access is a side panel from `lg` and a sheet below it. Teams load once, in pages of 50, through `useTeamPages()`, with Load more and a filter over loaded teams (B9). Add person is a sheet opened from the toolbar. Make admin and Make member (on another admin) stay instant and show an undo notice that writes the previous role back.
- **Guides.** `GuidesPage` keeps both editors mounted under a `?tab=` segmented control. Each editor is a grouped list (skills or tests) where a row opens a guarded per-item sheet; Done applies the edit to a page draft. One hook, `useGuideEditor`, owns load, draft, the toolbar Save (enabled while dirty or never saved), the success notice and `beforeunload` (B11).
- **Platform.** Segmented Clubs · Leads tabs, a borderless clubs table with status pills and skeleton rows, and `ClubActionDialog` on `Sheet`. The Leads list drops the dead Grant-access path, and its Delete becomes an undo with swipe and context menu (B10).

**Not in this plan:**
- `ClubGate`, `ClubStatusScreen`, `WelcomePage`, `ContractEndingBanner`, `LegalReviewScreen`, `/request-access` (`AuthShell`) and the nav badge: these are §8.1 / inventory 01. `LegalReviewScreen` and `SignupPage` simply inherit the restyled `MinimalShell`.
- Pain points that §4 doesn't adopt: People success notices for add or grant save; a status header in the restricted area; export error mapping; the UTC export file date; the Profile form following live club-doc updates; a dirty guard on `ClubActionDialog`; confirmations for Make admin.
- Guide band thresholds stay 4/7/9 (§4.6).

**Tech Stack:** React 18, TypeScript strict (noUnusedLocals/Parameters), React Router v7 (`BrowserRouter`, so no `useBlocker`), Tailwind with CSS-variable tokens (no `dark:`), Vitest + Testing Library (jsdom), Firestore web SDK, lucide-react.

**Spec:**
- `docs/superpowers/specs/2026-10-28-ui-redesign-design.md`:
  - §8.7;
  - §4.2 B9, B10, B11;
  - §4.6 (guides `?tab=`, platform "Back to app", make admin/demote instant plus undo, Cancel asks "Discard changes?" when dirty);
  - §6.2 (lead delete becomes undo; role change instant plus undo; remove member, demote self, transfer owner, contract and lifecycle actions stay confirmations), §6.3, §6.4 (People & access, Leads), §6.5 (Skill guides, Club area, Platform);
  - §10, §11.
- Parity contract: `docs/superpowers/specs/ui-redesign-inventory/07-club-admin-platform.md` (35 invariants) plus the README's cross-cutting rules.
- Visual target: there is no mockup for these screens. They follow `docs/design/design-system/README.md` §7–§8 (grouped lists, segmented controls, sheets, the toolbar main action, skeleton loading) in the language of `docs/design/design-system/mockups/screens-set.png`.

## Global Constraints

**Parity**
- Every inventory-07 invariant holds. Existing tests change selectors, wrappers (`WithChrome`, `NoticeProvider`) or flow (open a sheet first) only. An assertion changes only where a task maps it to B9, B10, B11, §4.6, §6.2, §6.5 or §8.7.
- Security boundary untouched:
  - the operator UI shows club-doc fields only and contains no `<a>` (invariant 24);
  - no new query shapes (the team checklist reuses `listAllTeams`'s `orderBy('name') limit(50)` with its cursor);
  - no `firestore.rules` or `firestore.indexes.json` change, so `npm run test:rules` is not needed. If a task ever touches either, add a rules test and run it on a temporary port, never 8080 (the user's emulator).
- No legal text is rendered in this area; the Contract tab only links to `/legal/*` at the accepted versions (invariant 19).
- Writes are byte-identical to today: six Profile fields; `saveGrants` diffs; member create, update and delete batches; whole-document guide `setDoc` with `updatedBy`/`updatedAt`; the lifecycle batch; the lead `updateDoc`/`deleteDoc`.

**Visual**
- Colour comes only from tokens. Legacy `navy`, `slate`, `border-border`, `bg-blue/…`, `text-blue-strong` (as a link colour), `bg-orange/10`, `text-white`, `uppercase` are retired in every file this plan touches.
- Links and selection are ink. Colour means state:
  - green is Active;
  - orange is New, Paused and Ending;
  - red is destructive;
  - guide range borders keep `bandBorderClass`.
- Type roles:
  - large title via `PageHeader`;
  - section and card headers `text-title-3`;
  - row titles `text-headline`;
  - metadata `text-footnote text-ink-2`;
  - group headers `text-caption text-ink-2`, sentence case.

  `tabular-nums` on every date and count.
- Touch targets at least 44 px; grouped rows at least 52 px.

**Strings, storage, gates**
- Every new string goes in `src/i18n/en/*.ts` and `src/i18n/it/*.ts` (the UI ships these two catalogs). Removed keys are removed from both.
- No new storage keys.
- Never commit `serviceAccountKey.json` (or `.enc`), `*.vsbackup`, private keys, `.env.local` or `reference/`. Commit only as the steps say. Don't push or merge, and add no dependency.
- Gates per group: `npm test`, `npm run lint` (0 errors), `npm run build`.

## Review Focus

1. **Saving grants for a member who admins a team on a page not loaded yet.** The save must keep that team, and only the toggled ones change.
   - Pinned in Task 5 by "keeps grants on teams not loaded yet when saving (B9)".
2. **A guide edit, then a tab switch, a reload or closing the tab.** Switching guide tabs keeps the draft; unloading asks the browser's leave prompt; a dirty per-item sheet asks "Discard changes?".
   - Pinned in Task 3 by "switching guide tabs keeps an unsaved skill edit" and "warns before unload while there are unsaved changes", and "Cancel on a skill sheet with edits asks to discard (B11)".
3. **Undo of a role change that the rules now refuse** (for example, the person was made owner in the meantime). The error shows inline, the list reloads, and nothing pretends it worked.
   - Pinned in Task 7 by "a refused undo shows the role error and reloads".
4. **Deleting a new lead, then Undo, or the delete failing.** The "n new" pill drops at once, comes back on Undo or failure, and the nav badge recounts only after a real delete.
   - Pinned in Task 4 by "deleting a new request lowers the count at once and tells the nav badge only after the delete" and "a failed delete brings the row back with the error".
5. **Exporting from the restricted club area** (the club is paused, `MinimalShell`, no `AppShell`). The Download export action must be visible, run once, and be disabled while running.
   - Pinned in Task 1 by "shows the main action a page publishes inside it", and in Task 6 by "the Export tab publishes Download export, disabled while running".

---

## Execution groups

| Group | Tasks (run in parallel) | Why together |
|---|---|---|
| A | 1, 2, 3, 4 | Disjoint files: shells, Profile/Contract, skill guide, leads |
| B | 5, 6, 8, 9 | People paging, club frame + Export, physical guide, platform table |
| C | 7, then 10 | People actions build on Task 5 and Task 6's `OWN_CHROME`; then the gate |

## File Structure

| File | Responsibility |
|---|---|
| `src/layout/MinimalShell.tsx` (modify) | v2 header, own chrome provider, main action slot |
| `src/platform/PlatformShell.tsx` (create), `src/App.tsx` (modify) | Platform frame with "Back to app" |
| `src/clubs/area/ClubAreaPage.tsx`, `ExportTab.tsx`, `ProfileTab.tsx`, `ContractTab.tsx` (modify) | Segmented tabs, per-tab chrome, grouped surfaces |
| `src/clubs/area/useTeamPages.ts`, `src/clubs/area/TeamGrantList.tsx`, `src/clubs/area/AddPersonSheet.tsx` (create) | B9 paging/filter; add sheet |
| `src/clubs/area/PeopleTab.tsx`, `src/components/GroupedList.tsx` (modify) | Member list, detail panel/sheet, undo, context menu; `ListRow selected` |
| `src/admin/useGuideEditor.ts`, `src/skillGuide/SkillGuideSheet.tsx`, `src/physicalTestGuide/PhysicalTestSheet.tsx` (create) | Shared guide draft/save; per-item sheets |
| `src/admin/GuidesPage.tsx`, `src/skillGuide/SkillGuideEditor.tsx`, `src/physicalTestGuide/PhysicalTestGuideEditor.tsx` (modify) | `?tab=`, lists |
| `src/platform/PlatformPage.tsx`, `ClubsTable.tsx`, `ClubActionDialog.tsx` (modify) | Tabs, table restyle, sheet |
| `src/interest/AccessRequestsPanel.tsx` (modify) | B10 |
| `src/i18n/{en,it}/{admin,skillGuide,physicalTestGuide,clubs,interest,platform}.ts`, `src/i18n/italianLabelBudget.test.ts` (modify) | Strings; budget pairs |

---

### Task 1: MinimalShell v2 and the platform shell's "Back to app"

**Files:**
- Create: `src/platform/PlatformShell.tsx`, `src/platform/PlatformShell.test.tsx`
- Modify: `src/layout/MinimalShell.tsx`, `src/App.tsx` (import `PlatformShell`, delete the local one), `src/i18n/{en,it}/platform.ts`
- Test: `src/layout/MinimalShell.test.tsx`

**Interfaces:**
- Produces:
  - `MinimalShell({ title, actions, children })`: same props. It renders `<PageChromeProvider><Frame …/></PageChromeProvider>`, where `Frame` reads `usePageChromeState().mainAction` and renders it as a `MainAction` (from `components/Toolbar`) after `actions` (icon plus label, `disabled` honoured).
  - `PlatformShell({ children })`: `MinimalShell title={t.layout.nav.platform}`. Its `actions` is a `Link to="/"` labelled `t.platform.backToApp` (`Button`-like `secondary` pill classes) when `useAuth().memberships.length > 0`.
- **Header** (`print:hidden`):
  - `sticky top-0 z-30 glass` with a hairline bottom (`shadow-[inset_0_-1px_0_rgb(var(--color-separator))]` or the toolbar's existing edge class);
  - the logo (not a link), the title `text-headline truncate`;
  - on the right: actions, the email (`text-footnote text-ink-2 truncate`, `hidden sm:inline`), Sign out (`secondary`), then the main action.
- **Body:** `main` keeps `max-w-screen-xl` and `bg-bg`.
- Strings: `platform.backToApp`: `'Back to app'` / `"Torna all'app"`.

- [ ] **Step 1: Failing tests.**
  - `MinimalShell.test.tsx`:
    - `it('shows the main action a page publishes inside it')`: a child calls `usePublishPageChrome({ title: 'Club', mainAction: { label: 'Download export', onSelect } })`; clicking the header's "Download export" calls `onSelect`; with `disabled: true` it is disabled.
    - `it('uses v2 tokens, not the navy band')`: no element has `bg-navy` or `text-white`.
  - `PlatformShell.test.tsx`:
    - `it('offers Back to app to an operator who is also a club member')`: a link "Back to app" to `/`.
    - `it('offers no Back to app to an operator with no club')`.
- [ ] **Step 2:** Run `npx vitest run src/layout/MinimalShell.test.tsx src/platform/PlatformShell.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/layout src/platform src/clubs src/legal src/signup src/auth`. Expected: PASS. These must pass unchanged: "shows the title, email, content and signs out", `ClubGate.test.tsx`, `RequirePlatformAdmin.test.tsx`, `LegalReviewScreen` and `SignupPage` tests.
- [ ] **Step 5: Commit** `feat(layout): v2 minimal shell with a main action slot; platform Back to app (§4.6)`

### Task 2: Profile and Contract as grouped surfaces

**Files:**
- Modify: `src/clubs/area/ProfileTab.tsx`, `src/clubs/area/ContractTab.tsx`
- Test: `src/clubs/area/ProfileTab.test.tsx`, `src/clubs/area/ContractTab.test.tsx`

**Interfaces:**
- No new strings and no behaviour change. Profile has no toolbar main action (§6.5 "—"). Its Save stays the form's submit button, so Enter in the name field still saves (invariant 6).
- **Profile** (`form noValidate max-w-xl flex flex-col gap-6`), three `rounded-lg bg-surface shadow-card` groups:
  - Group 1, 52 px rows with hairlines inset like `ListRow`:
    - Club name: label `text-callout text-ink-2` above a `FIELD_CLASS` input; the inline error is unchanged (`#club-name-error`, `aria-invalid`);
    - Country select;
    - Language select.
  - Group 2: AI features and Growth tests rows. Each is a `label` row (min 52 px) with the title `text-headline`, the description `text-footnote text-ink-2`, and the native checkbox trailing (`h-5 w-5 accent-[rgb(var(--color-ink))]`). The `id`s and labels are unchanged.
  - Group 3: "Don't name our club as a customer", the same row shape.
  - The save error (`role="alert"`, `text-red-strong`), then Save (`primary`, `w-full sm:w-auto sm:self-start`, hidden when restricted).
- **Contract** (`max-w-xl flex flex-col gap-6`):
  - one group with two rows:
    - Status: label `text-caption text-ink-2`, the value `text-headline`, then the reason and dates as `text-footnote text-ink-2 tabular-nums`;
    - Accepted terms: the summary `text-callout`, then the links Terms, DPA and Sub-processors as `text-callout text-ink underline underline-offset-2`;
  - the request line `text-footnote text-ink-2`;
  - End our contract (`destructive`, inside its own group as a full-width row button);
  - the operator contact as `text-footnote text-ink-2`, with an ink-underlined `mailto` link.
  - The `ConfirmDialog` is unchanged.

- [ ] **Step 1: Failing tests.**
  - `ProfileTab.test.tsx`: `it('saves on Enter in the club name field')`: `fireEvent.submit` from the name input's form calls `updateClubProfile` once, with the six fields.
  - `ContractTab.test.tsx`: `it('styles the legal links in ink, not blue')`: the "Terms" link has `text-ink` and no `text-blue-strong`.
- [ ] **Step 2:** Run `npx vitest run src/clubs/area/ProfileTab.test.tsx src/clubs/area/ContractTab.test.tsx`. Expected: the ContractTab test FAILS. The Enter test may already pass; keep it as a guard.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/clubs`. Expected: PASS. Every existing Profile, ProfileItalian and Contract test passes unchanged.
- [ ] **Step 5: Commit** `feat(clubs): v2 grouped Profile and Contract tabs`

### Task 3: Guides: `?tab=`, the shared draft hook, and the skill guide list and sheet (B11)

**Files:**
- Create: `src/admin/useGuideEditor.ts`, `src/skillGuide/SkillGuideSheet.tsx`
- Modify: `src/admin/GuidesPage.tsx`, `src/skillGuide/SkillGuideEditor.tsx`, `src/i18n/{en,it}/{admin,skillGuide}.ts`, `src/i18n/italianLabelBudget.test.ts`
- Test: `src/admin/GuidesPage.test.tsx`, `src/skillGuide/SkillGuideEditor.test.tsx`, `src/skillGuide/skillGuideItalian.test.tsx`

**Interfaces:**
- Produces (Task 8 consumes the hook):
  ```ts
  export function useGuideEditor<T extends { key: string }>(o: {
    load: () => Promise<{ items: T[]; stored: boolean }>;
    save: (items: T[], uid: string) => Promise<void>;
    reloadOn: unknown;            // the catalog slice: reload when the language catalog arrives (parity)
    messages: { loadError: string; saveError: string; saved: string };
    active: boolean;              // only the visible editor publishes the toolbar
  }): {
    items: T[]; loaded: boolean; loadError: string | null; saveError: string | null;
    isEdited(key: string): boolean; replace(item: T): void;
  };
  ```
  - **State.** It keeps `baseline` (the last loaded or saved items) and `draft`. `dirty` is `JSON.stringify(draft) !== JSON.stringify(baseline)`.
  - **Toolbar.** `usePublishPageChrome({ title: t.admin.guidesPage.title, mainAction }, active)`:
    - `mainAction` is `{ label: t.common.save, icon: Save, onSelect: save, disabled: !loaded || saving || !(dirty || !stored) }`;
    - it is `null` while `loadError` is set, so a load error shows no Save (invariant 20).
  - **Saving.** `save()` does nothing without `firebaseUser`. One write per click (an `inFlight` ref). On success: `baseline = draft`, `stored = true`, `notify(messages.saved)`. On failure: `saveError` (`role="alert"`, rendered by the editor).
  - **Unload.** While `dirty`, a `beforeunload` listener calls `preventDefault()` and sets `returnValue = ''`.
- **`GuidesPage`:**
  - `PageHeader title publishChrome={false}`;
  - `SegmentedControl semantics="tabs" label={t.title} options={[{id:'skills'},{id:'physical'}]}`, value from `?tab=` (unknown or missing gives `skills`), `onChange` → `setParams({ tab }, { replace: true })`;
  - **both** editors stay mounted, each in `<div role="tabpanel" hidden={!active}>`, and each gets `active`.
- **`SkillGuideEditor({ active = true }: { active?: boolean })`:**
  - `load` maps `getSkillGuide()` to `{ items: g.skills, stored: g.updatedBy !== '' || g.updatedAt !== null }`.
  - The body is a `GroupedList` of `ListRow onClick` rows, one per skill in stored order: title `t.labels.playerSkill[key] ?? label`; subtitle `howToEvaluate`; trailing an unsaved dot (`h-2 w-2 rounded-full bg-ink`, `aria-hidden`, plus sr-only `t.admin.guidesPage.unsaved`) when `isEdited(key)`.
  - Before load: 9 `SkeletonBlock` rows (`role="status"`, sr-only `t.admin.guidesPage.loading`). A load error shows only its alert.
- **`SkillGuideSheet({ skill, onApply, onClose })`:** `<Sheet title={label} size="lg" detent="large" guardUnsaved confirm={{ label: t.components.done, onConfirm: () => { onApply(local); onClose(); } }}>`.
  - The range blocks are a `grid gap-3 sm:grid-cols-2`, each `rounded-md border-l-4 bg-surface-2 p-3 ${bandBorderClass(min)}`. The label is `"<min>-<max>"` on a `Textarea` with id `${key}-range-${i}`.
  - Then "How to evaluate" (id `${key}-how-to-evaluate`). Only text is editable (invariant 22).
- Strings:
  - `admin.guidesPage`:
    - `skillGuide` becomes `'Skill guide'` and `physicalTestGuide` becomes `'Physical test guide'` (sentence case; it unchanged);
    - new `unsaved`: `'Unsaved changes'` / `'Modifiche non salvate'`;
    - new `loading`: `'Loading guide…'` / `'Caricamento guida…'`.
  - `skillGuide.saved`: `'Skill guide saved'` / `'Guida alle abilità salvata'`.
  - Budget pairs for both `admin.guidesPage` tab labels.

- [ ] **Step 1: Failing tests.**
  - `GuidesPage.test.tsx` (MemoryRouter plus a `LocationProbe`):
    - `it('opens the tab named in ?tab= and writes the choice with replace')`: `?tab=physical` selects "Physical test guide"; choosing "Skill guide" gives `?tab=skills` with no new history entry;
    - `it('falls back to the skill guide for an unknown tab')`;
    - `it('keeps both guides mounted and shows only the active one')`: the mocked physical content is inside a `hidden` tabpanel.
  - `SkillGuideEditor.test.tsx` (render in `NoticeProvider` + `WithChrome`):
    - `it('lists the skills and opens an editor per skill')`: the row "Serve" opens the dialog "Serve" with the "1-3" field;
    - `it('Done applies the edit and Save in the toolbar saves the whole guide with a notice (B11)')`: `updateSkillGuide` is called with the edited skills and `'coach-uid'`, and "Skill guide saved" shows;
    - `it('Cancel on a skill sheet with edits asks to discard (B11)')`: the alert "Discard changes?" appears, and confirming leaves the draft untouched;
    - `it('Save is disabled for a stored guide until something changes')`;
    - `it('keeps the range band colours in the sheet')`: the 4-6 block has `border-orange`;
    - `it('warns before unload while there are unsaved changes')`: a dispatched `beforeunload` event is `defaultPrevented` after a Done, and not before;
    - `it('switching guide tabs keeps an unsaved skill edit')`: in `GuidesPage` with the real editors and both APIs mocked, edit plus Done, switch to Physical and back; the dot and the edited text remain.
- [ ] **Step 2:** Run `npx vitest run src/admin src/skillGuide`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Test changes mapped to §8.7 / B11** (list then per-skill editor; Save in the toolbar):
  - "loads the guide, edits a range description, and saves": open the "Serve" row, edit, Done, then click the probe's Save; the `updateSkillGuide` assertion is unchanged;
  - "shows an error message when the save is rejected": the same flow;
  - "shows an error and no form when loading the guide fails" and "disables Save until the guide has loaded" read Save from the probe (the never-stored fallback enables it after load, as asserted today);
  - `skillGuideItalian.test.tsx`: "shows the Italian fallback…" asserts 9 rows and the row "Battuta", then opens it and finds `Irregolare, molti errori.` and "Come valutare"; "shows a saved guide as stored…" opens "Battuta" first;
  - `GuidesPage` "shows the skill guide tab by default…" clicks "Physical test guide".
- [ ] **Step 5:** Run `npx vitest run src/admin src/skillGuide src/i18n`. Expected: PASS, with `skillGuideApi.test.ts` and `bandColor.test.ts` unchanged.
- [ ] **Step 6: Commit** `feat(guides): skill list with per-skill sheets, toolbar Save, notice and discard guard (B11, §4.6)`

### Task 4: Leads: Grant access removed, delete becomes an undo (B10)

**Files:**
- Modify: `src/interest/AccessRequestsPanel.tsx`, `src/i18n/{en,it}/interest.ts`
- Test: `src/interest/AccessRequestsPanel.test.tsx`, `src/platform/PlatformPage.test.tsx` (its `Notice` mock adds `useUndoable: () => vi.fn()`)

**Interfaces:**
- `AccessRequestsPanel()` takes **no props**. `onGrant`, `grant()` and the Grant access button are deleted.
- **Layout:** `GroupedList`-style section, `aria-labelledby="access-requests-heading"`. The `h2` "Access requests" is `text-title-3`, with the count pill `bg-orange-tint text-orange-strong text-caption`. There is no inner `max-h` scroll.
- **Each row** is wrapped in `SwipeRow trailing={[{ label: t.delete, tone: 'destructive', undoable: true, onAction: () => requestDelete(s) }]}`.
  - The row holds the name (`text-headline`, bold while unreviewed), the role chip (`bg-surface-3 text-ink-2 text-caption`), the New badge (orange tint) and `email · date` (footnote, tabular).
  - Trailing: "Mark reviewed" (`secondary`, small, only while unreviewed), then a kebab `Menu` (label `t.rowMenu(name)`) with Mark reviewed (only while unreviewed) and Delete (danger).
  - The same items go on `useContextMenu` on the `li` (§6.4).
- **`requestDelete(s)`** adds `s.id` to a hidden `Set` and calls:
  ```ts
  undoable({ message: t.deleted(s.name),
    commit: async () => { await deleteInterestSignup(s.id);
      if (!mounted.current) return;
      setSignups(c => c.filter(x => x.id !== s.id)); unhide(s.id);
      if (!s.reviewed) setPending(n => Math.max(0, n - 1)); notifySignupsChanged(); },
    onUndo: () => unhide(s.id),
    onCommitError: () => { if (mounted.current) { unhide(s.id); setError('deleteError'); } } })
  ```
  - The pill shows `pending − (hidden unreviewed rows)`.
  - The `ConfirmDialog`, `pendingDelete` and `deleteError` state go; `'deleteError'` joins the panel's error union.
- Strings `interest.panel`:
  - remove `grantAccess`, `deleteTitle`, `deleteMessage` and `deleteConfirm` (en and it);
  - add `deleted`: `` (n) => `${n}'s request deleted` `` / `` (n) => `Richiesta di ${n} eliminata` ``;
  - add `rowMenu`: `` (n) => `Actions for ${n}` `` / `` (n) => `Azioni per ${n}` ``.

- [ ] **Step 1: Failing tests** in `AccessRequestsPanel.test.tsx`, wrapped in `NoticeProvider`, with `vi.useFakeTimers({ shouldAdvanceTime: true })` where `UNDO_MS` advances.
  - `it('offers no Grant access (B10)')`.
  - `it('Delete is an undo: the row leaves at once and is deleted when the notice expires (B10)')`: no `alertdialog`; `deleteInterestSignup` is not called before `UNDO_MS` and is called with `'a'` after it.
  - `it('Undo brings the request back and never deletes')`.
  - `it('a failed delete brings the row back with the error')`: "Could not delete this request. Please try again.".
  - `it('deleting a new request lowers the count at once and tells the nav badge only after the delete')`: "1 new" goes on click; the `SIGNUPS_CHANGED_EVENT` listener is not called before expiry and is called after.
  - `it('right-click offers Mark reviewed and Delete')`.
- [ ] **Step 2:** Run `npx vitest run src/interest/AccessRequestsPanel.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Test changes mapped to B10:**
  - "renders no Grant access action without onGrant, and one per request with it" is replaced by the first new test;
  - "deletes a request only after confirmation…" is replaced by the undo test;
  - the other tests drop the `onGrant` prop. "lists reviewed and new…", "clears the notification…" and "shows an empty state…" are otherwise unchanged.
- [ ] **Step 5:** Run `npx vitest run src/interest src/platform`. Expected: PASS, including `RequestAccessPage.test.tsx` and both `PlatformPage` tests.
- [ ] **Step 6: Commit** `fix(leads): drop the dead Grant access path; delete becomes an undo with swipe and menu (B10, §6.2)`

### Task 5: People & access: grouped member list and the paged team checklist (B9)

**Files:**
- Create: `src/clubs/area/useTeamPages.ts`, `src/clubs/area/TeamGrantList.tsx`
- Modify: `src/clubs/area/PeopleTab.tsx`, `src/components/GroupedList.tsx`, `src/i18n/{en,it}/clubs.ts`
- Test: `src/clubs/area/PeopleTab.test.tsx`, `src/components/GroupedList.test.tsx`

**Interfaces:**
- Produces (Task 7 consumes):
  ```ts
  export function useTeamPages(): {
    teams: TeamRow[]; hasMore: boolean; loadingMore: boolean;
    error: 'load' | 'more' | null; loadMore(): Promise<void>;
  };
  export function TeamGrantList(props: {
    teams: TeamRow[]; hasMore: boolean; loadingMore: boolean; loadMoreFailed: boolean;
    onLoadMore: () => void; selected: string[]; onToggle: (teamId: string) => void;
  }): JSX.Element;
  ```
  - **`useTeamPages`** calls `listAllTeams()` once on mount, then `listAllTeams(lastDoc)` on `loadMore`. It appends pages; a second call while `loadingMore` is ignored; a result after unmount is dropped.
  - **`TeamGrantList`:**
    - the "Teams" fieldset;
    - a search `Input` (`aria-label`/placeholder `p.filterTeams`) when any team is loaded;
    - one checkbox row per loaded team whose `normalize(name)` (from `src/search/searchTokens`) includes `normalize(filter)`;
    - `p.noTeamsMatch` when a non-empty filter matches none;
    - then "Load more teams" (`secondary`, disabled while `loadingMore`) under `hasMore`, with `p.loadMoreTeamsFailed` (`role="alert"`) when the last page failed.
- `ListRow` gains `selected?: boolean`: it adds `aria-current="true"` and `bg-surface-3` to the interactive element.
- **`PeopleTab`:**
  - **Reloads.** `reload()` now loads only `listGrantHolders()` and `listMembers()`; teams come from `useTeamPages()`. `useTeamPages().error === 'load'` shows the page alert `p.loadFailed`, as a failed `reload()` does.
  - **Member list.** It becomes a `GroupedList header={p.people}` of `ListRow onClick` rows: title = email; `rowProps={{ title: email }}`; `selected`; trailing = an Owner pill (`bg-ink text-on-ink`) when owner, then the role pill (`bg-surface-3 text-ink-2`), both `rounded-full px-2 text-caption`. Until the first `reload()` resolves: 4 `SkeletonBlock` rows.
  - **Layout.** `grid gap-6 lg:grid-cols-[20rem_1fr]`. The add form stays in the left column for now (Task 7 moves it). The right panel is `rounded-lg bg-surface p-4 shadow-card`.
  - **Panel content.**
    - The email is `text-title-3 break-all`.
    - Sections are a fieldset of checkbox rows (52 px).
    - Teams use `<TeamGrantList selected={draft.teamIds} …/>`.
    - Save (`primary`) keeps its disabled rule.
    - The action row's buttons and the reason hint (`text-footnote text-ink-2`) are unchanged.
  - `draft.teamIds` keeps ids of teams not loaded yet; `saveGrants` diffs ids, so their grants survive.
- Strings `clubs.people`, en / it:
  - `filterTeams`: `'Filter teams'` / `'Filtra squadre'`;
  - `noTeamsMatch`: `'No loaded team matches.'` / `'Nessuna squadra caricata corrisponde.'`;
  - `loadMoreTeams`: `'Load more teams'` / `'Carica altre squadre'`;
  - `loadMoreTeamsFailed`: `'Could not load more teams. Please try again.'` / `'Impossibile caricare altre squadre. Riprova.'`.

- [ ] **Step 1: Failing tests.**
  - `GroupedList.test.tsx`: `it('marks a selected row with aria-current')`.
  - `PeopleTab.test.tsx`:
    - `it('pages the team checklist with Load more (B9)')`: page 1 `[U15, U17]` with `hasMore: true` and `lastDoc: c1`, page 2 `[U19]`; open coach; "Load more teams" adds the checkbox "U19"; `listAllTeams` was last called with `c1`; the button is gone;
    - `it('the filter narrows only the loaded teams')`: "17" leaves only U17; "zz" shows "No loaded team matches."; Load more stays offered;
    - `it('keeps grants on teams not loaded yet when saving (B9)')`: holder grants `['t1','t99']`; toggling U17 saves next `['t1','t99','t2']` against prev `['t1','t99']`;
    - `it('loads the team list once, not on every reload')`: after a grant Save, `listAllTeams` has been called once;
    - `it('a failed Load more keeps the loaded teams and says so')`;
    - `it('marks the selected person')`: the coach row has `aria-current="true"`.
- [ ] **Step 2:** Run `npx vitest run src/clubs/area/PeopleTab.test.tsx src/components/GroupedList.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/clubs src/access src/components`. Expected: PASS. Every existing `PeopleTab` test passes unchanged, including "surfaces an error if data fails to load", plus `accessApi.test.ts` and `membersApi.test.ts`.
- [ ] **Step 5: Commit** `fix(clubs): People & access pages every team with Load more and a filter (B9)`

### Task 6: Club area frame: segmented tabs and the Export main action

**Files:**
- Modify: `src/clubs/area/ClubAreaPage.tsx`, `src/clubs/area/ExportTab.tsx`, `src/i18n/italianLabelBudget.test.ts`
- Test: `src/clubs/area/ClubAreaPage.test.tsx`, `src/clubs/area/ExportTab.test.tsx`

**Interfaces:**
- Produces: `OWN_CHROME = new Set<ClubTab>(['export'])` in `ClubAreaPage`. Task 7 adds `'people'`.
- **`ClubAreaPage`:**
  - `PageHeader title eyebrow={club?.name} publishChrome={!OWN_CHROME.has(active)}`;
  - `<SegmentedControl semantics="tabs" label={t.sectionsLabel} options={tabs} value={active} onChange={(id) => setParams({ tab: id }, { replace: true })} className="mb-6 w-full sm:w-auto" />`;
  - the panel is `<div role="tabpanel" aria-label={activeLabel}>`.
  - Tab filtering, the defaults (`profile`, or `contract` when restricted) and the fallback are unchanged (invariants 2, 3).
- **`ExportTab`** publishes `usePublishPageChrome({ title: t.clubs.area.pageTitle, mainAction: { label: e.download, icon: Download, onSelect: () => void run(), disabled: running } })`.
  - The in-page button goes.
  - The card is `rounded-lg bg-surface p-4 shadow-card max-w-xl`, with the `h2` `text-title-3`, the description `text-callout text-ink-2`, progress `role="status"` `text-footnote text-ink-2`, and the error `role="alert"`.
  - In the restricted area the action shows in `MinimalShell`'s header (Task 1).
- Budget pairs: `clubs.area.tabs.*` and `platform.tabs.*`.

- [ ] **Step 1: Failing tests.**
  - `ClubAreaPage.test.tsx` (`WithChrome`):
    - `it('the Export tab publishes Download export, disabled while running')`: a deferred `loadClubExportData`; the probe button is disabled until it settles;
    - `it('Profile and Contract publish the title and no main action')`;
    - `it('choosing a tab replaces ?tab= without a new history entry')`.
- [ ] **Step 2:** Run `npx vitest run src/clubs/area/ClubAreaPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Selector changes:** the `ExportTab.test.tsx` tests render inside `WithChrome` and click the probe's "Download export". Their assertions (file name, progress and disabled, nothing downloaded on failure) are unchanged.
- [ ] **Step 5:** Run `npx vitest run src/clubs src/i18n`. Expected: PASS. Every `ClubAreaPage` tab test, `ClubGate.test.tsx` ("shows the restricted club area…"), `clubExport.test.ts` and `clubExportApi.test.ts` pass unchanged.
- [ ] **Step 6: Commit** `feat(clubs): segmented club tabs; Export runs from the toolbar (§6.5)`

### Task 7: People & access: Add person sheet, role undo, phone sheet, row menu

**Files:**
- Create: `src/clubs/area/AddPersonSheet.tsx`
- Modify: `src/clubs/area/PeopleTab.tsx`, `src/clubs/area/ClubAreaPage.tsx` (adds `'people'` to `OWN_CHROME`), `src/i18n/{en,it}/clubs.ts`
- Test: `src/clubs/area/PeopleTab.test.tsx`, `src/clubs/area/ClubAreaPage.test.tsx`

**Interfaces:**
- Consumes `useTeamPages` and `TeamGrantList` (Task 5) and `OWN_CHROME` (Task 6).
- **`AddPersonSheet({ myEmail, onAdded, onClose }: { myEmail: string; onAdded: (email: string) => void; onClose: () => void })`:** `<Sheet title={p.addPerson} guardUnsaved confirm={{ label: p.addPerson, form: 'add-person-form', disabled: busy }}>`.
  - The form (`noValidate`) holds `#new-person` (label `p.addByEmail`, `type=email`) and `#new-role` (label `p.role`, Member default).
  - The submit logic moves here unchanged: trim and lowercase; empty does nothing; the shape check gives `p.invalidEmail`; `addMember(email, role, myEmail)`; `already-member` gives `p.alreadyMember`; anything else gives `p.addFailed`.
  - Errors are `role="alert"` inside the sheet. On success, `onAdded(email)` runs; the parent closes the sheet, reloads and selects the email.
- **`PeopleTab`:**
  - It publishes `usePublishPageChrome({ title: t.clubs.area.pageTitle, mainAction: { label: p.addPerson, icon: UserPlus, onSelect: () => setAdding(true), disabled: busy } })`. The left-column add form is removed.
  - **Role undo (§4.6, §6.2):** `changeRole(role)` for another person keeps its write and reload, then calls:
    ```ts
    undoable({ message: role === 'admin' ? p.madeAdmin(email) : p.madeMember(email),
      commit: () => {},
      onUndo: () => void run(async () => { await setMemberRole(email, previous); await reload(); },
                             t.common.couldNotChangeRole) })
    ```
    If the undo write fails, `run` shows the error; also call `reload()` in that failure path. Demoting yourself, Make owner and Remove keep their confirmations (invariant 10).
  - **Detail placement:** `const narrow = useMediaQuery('(max-width: 1023px)', false)`. From `lg` the detail panel is inline. Below it, a selection opens `<Sheet title={email} size="md" detent="large" dirty={!sameGrants(draft, original)} onClose={() => setSelected(null)}>` around the same detail JSX, and the right column is not rendered. The `ConfirmDialog`s stack above the sheet.
  - **Row menu (§6.4):** each member row gets `useContextMenu({ label: p.rowMenu(email), items })`, spread through `ListRow rowProps`. The items are the detail's existing actions for that person, run after selecting them:
    - Make admin, or Make member;
    - Make owner (only for a non-owner admin);
    - Remove from club… (danger).

    They are disabled with `hint: p.reason[rules.reason]` exactly where the detail buttons are disabled. A row component (`MemberRow`) inside `PeopleTab.tsx` holds the hook.
- Strings `clubs.people`, en / it:
  - `madeAdmin`: `` (e) => `${e} is now an admin` `` / `` (e) => `${e} ora è admin` ``;
  - `madeMember`: `` (e) => `${e} is now a member` `` / `` (e) => `${e} ora è membro` ``;
  - `rowMenu`: `` (e) => `Actions for ${e}` `` / `` (e) => `Azioni per ${e}` ``.

- [ ] **Step 1: Failing tests** in `PeopleTab.test.tsx`, rendered in `NoticeProvider` + `WithChrome`, with `vi.mock('../../components/useMediaQuery', () => ({ useMediaQuery: vi.fn(() => false) }))`.
  - `it('Add person in the toolbar opens the add sheet')`.
  - `it('Cancel after typing an email asks to discard')`.
  - `it('Make admin is instant and offers Undo, which writes the previous role back')`: `setMemberRole('coach@example.com','admin')`, then "coach@example.com is now an admin" shows; Undo calls `setMemberRole('coach@example.com','member')`.
  - `it('demoting another admin offers Undo')`.
  - `it('a refused undo shows the role error and reloads')`: the second `setMemberRole` rejects; the alert reads "Could not change the role. Please try again."; `listMembers` runs again.
  - `it('on a narrow screen, choosing a person opens their access in a sheet')`: `useMediaQuery` returns true; the dialog "coach@example.com" holds the checkbox "U15".
  - `it('closing the person sheet with unsaved grants asks to discard')`.
  - `it('right-click on the owner offers Make member disabled with the reason')`: the menu item "Make member" is disabled, and "The club owner stays an admin. Transfer ownership first." shows.
  - `ClubAreaPage.test.tsx`: `it('People & access publishes Add person')`.
- [ ] **Step 2:** Run `npx vitest run src/clubs/area`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Selector changes:**
  - "adds a person as member or admin", "shows 'already a member'…" and "refuses to add a malformed email" open the sheet from the probe's "Add person", then submit with the sheet's confirm (`within(dialog)`). Their assertions are unchanged; after the first add the second opens the sheet again.
  - "changes a member to admin and back" is unchanged.
- [ ] **Step 5:** Run `npx vitest run src/clubs src/access src/components`. Expected: PASS. These must pass unchanged: owner and last-admin disabled states, transfer ownership (both), Remove from club, demote-self reload, load error, and every Task 5 test.
- [ ] **Step 6: Commit** `feat(clubs): Add person sheet, instant role changes with undo, person sheet and row menu (§4.6, §6.4)`

### Task 8: Physical test guide list and sheet (B11)

**Files:**
- Create: `src/physicalTestGuide/PhysicalTestSheet.tsx`
- Modify: `src/physicalTestGuide/PhysicalTestGuideEditor.tsx`, `src/i18n/{en,it}/physicalTestGuide.ts`
- Test: `src/physicalTestGuide/PhysicalTestGuideEditor.test.tsx`, `src/physicalTestGuide/physicalTestGuideItalian.test.tsx`

**Interfaces:**
- Consumes `useGuideEditor` (Task 3).
- `PhysicalTestGuideEditor({ active = true }: { active?: boolean })`: `load` maps `getPhysicalTestGuide()` to `{ items: g.tests, stored: g.updatedBy !== '' || g.updatedAt !== null }`.
  - The body is a `GroupedList` of rows: title `t.labels.physicalTest[key] ?? label`; subtitle `protocol`; the unsaved dot as in Task 3. There are 8 skeleton rows before load.
- `PhysicalTestSheet({ test, onApply, onClose })`: `<Sheet title={label} size="md" detent="large" guardUnsaved confirm={{ label: t.components.done, … }}>` with the "Protocol" `Textarea` (id `${key}-protocol`, `min-h-[160px]`).
- Strings: `physicalTestGuide.saved`: `'Physical test guide saved'` / `'Guida ai test atletici salvata'`.

- [ ] **Step 1: Failing tests** in `PhysicalTestGuideEditor.test.tsx` (`NoticeProvider` + `WithChrome`):
  - `it('Done applies the protocol and Save in the toolbar saves the whole guide with a notice (B11)')`;
  - `it('Cancel on a test sheet with edits asks to discard (B11)')`;
  - `it('shows a skeleton until the guide loads, then one row per test')`.
- [ ] **Step 2:** Run `npx vitest run src/physicalTestGuide`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Test changes mapped to §8.7 / B11:**
  - "loads the guide, edits a protocol, and saves" opens the row first and saves from the probe; its write assertion is unchanged;
  - "shows an error and no form…" finds no probe Save;
  - the Italian tests open the row before reading display values, and count 8 rows where they counted fields.
- [ ] **Step 5:** Run `npx vitest run src/physicalTestGuide src/admin`. Expected: PASS, with `physicalTestGuideApi.test.ts` unchanged.
- [ ] **Step 6: Commit** `feat(guides): physical test list with per-test sheets, toolbar Save and notice (B11)`

### Task 9: Platform page, clubs table and the action sheet

**Files:**
- Modify: `src/platform/PlatformPage.tsx`, `src/platform/ClubsTable.tsx`, `src/platform/ClubActionDialog.tsx`, `src/i18n/{en,it}/platform.ts`
- Test: `src/platform/PlatformPage.test.tsx`, `src/platform/ClubsTable.test.tsx`

**Interfaces:**
- **`PlatformPage`:** `PageHeader title` (it publishes to `MinimalShell`'s provider with no main action, §6.5), then `SegmentedControl semantics="tabs" label={t.sectionsLabel}` Clubs · Leads, with `?tab=` and `replace`; the default is `clubs`.
- **`ClubsTable`:**
  - **Filter.** It stays the labelled "Status" `select` (`FIELD_CLASS min-h-11`).
  - **Table frame.** The wrapper is `overflow-x-auto rounded-lg bg-surface shadow-card pb-24`, with no border and no `min-w-max`. Headers are `text-caption text-ink-2 text-left px-3 py-2`, sentence case. Rows are `divide-y divide-separator`.
  - **Status cell.** It is a pill `rounded-full px-2 text-caption` from `STATUS_PILL: Record<ClubStatus, string>`:
    - pending `bg-surface-3 text-ink`;
    - active `bg-green-tint text-green-strong`;
    - suspended and terminating `bg-orange-tint text-orange-strong`;
    - deleted `bg-surface-3 text-ink-2`.

    The dates line sits under it (`text-footnote text-ink-2 tabular-nums`).
  - **Terms.** "Not accepted" is `text-ink-2`.
  - **Actions.** Primary actions stay `ghost` buttons; the More menu trigger is `text-ink-2 hover:bg-surface-2`.
  - **Loading.** Before the first page of a filter: 3 skeleton `tr`s (`SkeletonBlock` cells) and a sr-only `role="status"` `t.platform.table.loading`.
  - Everything else is unchanged: no `<a>`, the request counter, Load more, the row patch.
- **`ClubActionDialog`** renders `Sheet` directly (`title`, `onClose`, `footer`), with the same footer: Cancel `ghost`, and the confirm `primary` or `destructive`.
  - It has no `guardUnsaved` (parity: closing never asks).
  - Intro text `text-callout text-ink-2`; date and reason labels `text-footnote text-ink-2`; the counter `text-caption text-ink-2 tabular-nums`.
  - Behaviour is unchanged.
- Strings: `platform.table.loading`: `'Loading clubs…'` / `'Caricamento club…'`.

- [ ] **Step 1: Failing tests.**
  - `ClubsTable.test.tsx`:
    - `it('shows the status as a pill coloured by meaning')`: Active has `bg-green-tint`, Ending `bg-orange-tint`, Pending `bg-surface-3`;
    - `it('shows skeleton rows until the first page arrives, then "No clubs yet."')`: a deferred `listClubs`.
  - `PlatformPage.test.tsx`: `it('opens Leads from ?tab=leads')` (`MemoryRouter initialEntries`).
- [ ] **Step 2:** Run `npx vitest run src/platform`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/platform src/interest`. Expected: PASS. These must pass unchanged:
  - every `ClubsTable` test (five columns and no `min-w-max`, filter options, cursor, no links, More menu, lowercased operator, load error);
  - every `ClubActionDialog` test (reason, dates, today allowed, double click, failure keeps it open);
  - `clubActions.test.ts`, `dates.test.ts`, `platformApi.test.ts`;
  - both existing `PlatformPage` tests.
- [ ] **Step 5: Commit** `feat(platform): segmented tabs, borderless clubs table with status pills, action sheet`

### Task 10: Gate and user checklist

**Files:** none new.

- [ ] **Step 1:** Run `npm test`, `npm run lint` and `npm run build`. Expected: all green, with 0 lint errors. If a known flaky load-timeout test fails (the Italian smoke test), rerun that file alone and report both results.
- [ ] **Step 2: Greps.** Each should print nothing:
  - `grep -rnE "dark:|navy|slate|border-border|bg-blue/|text-blue-strong|bg-orange/|text-white|uppercase" src/clubs/area src/admin src/skillGuide src/physicalTestGuide src/platform src/interest/AccessRequestsPanel.tsx src/layout/MinimalShell.tsx --include=*.tsx | grep -v test`;
  - `grep -rn "SectionTabs\|components/Tab'" src/clubs/area src/platform src/admin`;
  - `grep -rn "onGrant\|grantAccess" src`;
  - `git diff --stat main -- firestore.rules firestore.indexes.json` (no rules or index change).
- [ ] **Step 3: Commit** any lint-only fix-ups as `chore(clubs): gate fix-ups`, if there are any.
- [ ] **Step 4: User checklist** for the group report. The user runs it on a phone and a desktop, in light and dark mode.
  - **Club area.** Check the segmented tabs and that `?tab=` survives a reload. Profile and Contract are grouped Settings-style surfaces. Enter in the club name saves. The Terms, DPA and Sub-processors links are ink.
  - **Export.** Download export is in the toolbar and disabled while it runs. Pause a club (seed `rival` or the platform) and sign in as its admin: the minimal shell shows the same Download export in its header, with Profile read-only, Export and Contract.
  - **People & access.** Check the grouped members with Owner and role pills. Add person from the toolbar is a sheet (Cancel after typing asks). Make admin shows the undo pill, and Undo restores the role. On a phone or a narrow window, a person opens as a sheet. Right-click a person for their actions. With more than 50 teams (seed extra), Load more teams appears and the filter narrows loaded teams.
  - **Guides (B11).** `?tab=physical` opens that guide. Tap a skill, edit, then Cancel asks Discard changes?. Done then Save in the toolbar shows "Skill guide saved". Switch tabs and back with an unsaved edit: it is kept. Reload with an unsaved edit: the browser asks.
  - **Platform.** Back to app shows for `president@example.com`-style operators with a club, and not for `operator@example.com`. Check the status pills, the skeleton on filter change and the action sheet. On Leads: no Grant access; Delete leaves at once with Undo, the "n new" pill updates, and swiping left on a phone deletes with undo.
  - **Italian.** The club tabs, guide tabs and "Carica altre squadre" fit.
