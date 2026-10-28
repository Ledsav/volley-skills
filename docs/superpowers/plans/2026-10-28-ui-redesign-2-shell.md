# UI Redesign 2: Shell and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the navy shell with the v2 shell: a solid sidebar on desktop, an overlay sidebar on tablets, a glass tab bar on phones, a glass toolbar on every page with the page title, search and the one main action, and the ⌘K search palette with its local groups (Go to, Actions, Teams, Players, Matches).

**Architecture:**
- Pages publish their title, main action and "⋯" items to the shell through a small context (`PageChrome`), via the existing `PageHeader`. The shell's toolbar renders them.
- Search is split in two:
  - a pure core (normalise, match, rank, recents);
  - a React layer (sources, palette UI, shortcut).
- Plan 3 adds the server groups (Exercises, Trainings) to the same source list.

**Not in this plan:**
- The team page's tabs as a segmented control pinned under the toolbar, and the per-tab main actions. Both are area plan 02.
- The server groups (Exercises, Trainings) and `searchTokens`. Both are Plan 3.
- The logo. It is Plan 6.

**Tech Stack:** React 18, TypeScript strict (noUnusedLocals/Parameters), React Router v7, Tailwind with CSS-variable tokens (no `dark:` variants), Vitest + Testing Library (jsdom), Firestore rules tests (`npm run test:rules`), lucide-react.

**Spec:**
- `docs/superpowers/specs/2026-10-28-ui-redesign-design.md`: §4.4, §6.1, §6.5, §7, §8.1, §11 item 2.
- `docs/design/design-system/README.md`: §5, §7, §8.
- The parity inventory: `docs/superpowers/specs/ui-redesign-inventory/01-shell-auth-settings.md` §1–§3.

## Global Constraints

**Visual system**
- Colour comes only from tokens in `src/index.css`/`tailwind.config.js`, and components never use `dark:`.
  - Chrome is monochrome: `ink`, `ink-2`, `ink-3`, `surface`, `surface-2`, `surface-3`, `bg`, `separator`, `sidebar`.
  - Data colours appear only as data.
  - Text in a data colour uses its `-strong` form. `src/theme/dataColourText.test.ts` enforces this.
- Glass (`.glass`, `.glass-pop`) is used only on floating chrome: the toolbar once scrolled, the phone tab bar, the overlay sidebar and the palette on desktop. Never on content.
- Breakpoints are design system §7.
  - Phone `< 768` (`md`).
  - Tablet 768–1279: the overlay sidebar is opened from the toolbar.
  - Desktop `≥ 1280` (`xl`): a solid 248 px sidebar, always visible.
- Motion:
  - Pressables use `.pressable`.
  - Surfaces that move use `src/motion` springs.
  - Everything honours `useReducedMotion()`.
  - The search palette opens **without animation** (design system §8).
- Type roles: page titles use `text-large-title` on phones and `text-title-1` from `md`, and the toolbar inline title is `text-headline`.
- Touch targets are at least 44 px.

**Strings and storage**
- Every user-facing string is in the i18n catalog, in both `src/i18n/en/*.ts` and `src/i18n/it/*.ts`. The Italian label budget test (`src/i18n/italianLabelBudget.test.ts`) must stay green.
- Storage keys keep the `vcb.` prefix.
  - Search recents live in `sessionStorage` under `vcb.searchRecents`, at most 8.
  - They are cleared on sign-out and never written to localStorage.

**Parity**
- `navModel.ts` stays the single list of pages.
- These invariants from inventory 01 §1–§3 stay as written there:
  - the skip link;
  - `aria-label="Main"` and `"Main (phone)"`;
  - `aria-current` via `NavLink`;
  - focus moves to the `h1` on a route change;
  - the dropped-club notice is shown once;
  - the pending sign-ups badge;
  - the account menu items and their order;
  - the club switcher only when there are other usable clubs, and a switch reloads the page;
  - `ContractEndingBanner` then `LegalNoticeBanner` above `<main id="main">`;
  - `print:hidden` on chrome;
  - `min-w-0` on the content column.
- The tab bar shows an icon **and** a label, with at most 5 tabs.
- **Fetching:** no unbounded reads.
  - Teams: the first page only (20).
  - Players: `loadTeamRoster` per team, capped at the first 20 teams, loaded once per session on the first typed character.
  - Matches: `listMatches` first page (20) per team, capped at 20 teams, loaded with players.

**Constraints that never change**
- No third-party analytics.
- Never commit `serviceAccountKey.json` (or `.enc`), `*.vsbackup`, private keys, `.env.local` or `reference/`.
- Commit or push only as the steps say. No merge.
- Gates per group: `npm test`, `npm run lint`, `npm run build`. Also `npm run test:rules` for Task 2.

## Review Focus

1. **Typing before data arrives.** Someone types "mar" before the rosters load. The Players group shows skeleton rows, then results for the *current* query once loaded. A slower, older load never overwrites newer results. Pinned in Task 8 by "late roster load renders against the current query".
2. **⌘K over an unsaved sheet.** A sheet with an edited form is open and the person presses Ctrl+K. Nothing opens, and the browser's own Ctrl+K is not triggered while the palette can open (`preventDefault` only when it opens). Pinned in Task 9 by "does not open while a modal dialog is open".
3. **The narrowest member.** A member with no sections and no teams sees only Go to: Today, Teams, Settings. They see no club or platform items and no create actions they can't do. Pinned in Task 7 by "member with no sections".
4. **Switching club or signing out.** After this, no recents, rosters or matches from the previous club or person appear. Pinned in Task 8 by "cache is keyed by club id and cleared on sign-out", and in Task 6 by "sign-out clears recents".
5. **The tablet overlay sidebar.** Choosing a destination in the overlay closes it and focus goes to the new page's `h1`. Esc or the scrim closes it and returns focus to the toolbar button. Pinned in Task 4 by "overlay closes on navigation" and "Esc returns focus to the trigger".

---

## File Structure

| File | Responsibility |
|---|---|
| `src/layout/navModel.ts` (modify) | Home → Today label; `goToDestinations()` for search |
| `src/teams/teamsApi.ts` (modify) | `listClubTeams()` (spec §4.4) |
| `src/layout/PageChrome.tsx` (create) | Context: a page publishes `{ title, mainAction, more }`; the shell reads it |
| `src/layout/PageHeader.tsx` (modify) | Large title; publishes to `PageChrome`; new `mainAction` / `more` props |
| `src/layout/Sidebar.tsx` (create) | Club header, nav groups, account row (shared by desktop and the tablet overlay) |
| `src/layout/ShellToolbar.tsx` (create) | The toolbar in the shell: sidebar button (tablet), inline title, search entry, "⋯", main action |
| `src/layout/TabBar.tsx` (create) | Phone glass tab bar |
| `src/layout/AppShell.tsx` (modify) | Composes the above; keeps the inventory invariants |
| `src/layout/MorePage.tsx` (modify) | Grouped-list restyle (same items) |
| `src/search/normalize.ts` (create) | `normalize`, `words` |
| `src/search/match.ts` (create) | `matchRank`, `rankItems` |
| `src/search/recents.ts` (create) | sessionStorage recents |
| `src/search/types.ts` (create) | `SearchItem`, `SearchGroup`, `SearchGroupId` |
| `src/search/localSources.ts` (create) | Pure builders for Go to and Actions items from access |
| `src/search/useSearchData.ts` (create) | Session cache and loaders for teams, players and matches |
| `src/search/SearchPalette.tsx` (create) | Combobox UI (desktop panel, phone sheet) |
| `src/search/SearchProvider.tsx` (create) | Open state, the ⌘K shortcut, `useSearch()` |
| `src/search/pendingAction.ts` (create) | Hands a palette action to the page it opens (router state) |
| Pages (modify) | Teams, Trainings, Exercises: main action and "⋯" in the toolbar; Teams/Trainings/Exercises/Roster/Matches honour palette actions |

---

### Task 1: Today label and Go to destinations

**Files:**
- Modify: `src/layout/navModel.ts`, `src/i18n/en/layout.ts`, `src/i18n/it/layout.ts`, `src/i18n/en/home.ts`, `src/i18n/it/home.ts`
- Test: `src/layout/navModel.test.ts`

**Interfaces:**
- Produces: `goToDestinations(access: Access | null, isPlatformAdmin: boolean): NavItem[]`. It returns every `navGroups` item in order, then `{ to: '/settings', label: t.appShell.settings, Icon: Settings }`.

- [ ] **Step 1: Failing tests** in `navModel.test.ts`:
  - `it('labels the first item Today')`: `navGroups(fullAccess, false)[0].items[0]` has `label` `'Today'` and `to` `'/'`.
  - `it('goToDestinations ends with Settings and repeats no path')`: the paths for full access plus platform admin are `['/', '/teams', '/trainings', '/exercises', '/admin/guides', '/club', '/platform', '/settings']`, and they are unique.
- [ ] **Step 2:** Run `npx vitest run src/layout/navModel.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Labels, Today:
    - en `layout.nav.home: 'Today'` and `home.title: 'Today'`;
    - it `layout.nav.home: 'Oggi'` and `home.title: 'Oggi'`.
    - Keep the key name `home` so no caller changes.
  - Add `goToDestinations` to `navModel.ts`.
  - Update `navModel.ts`'s doc comment: the sidebar, More and search all render from it.
- [ ] **Step 4:** Run `npx vitest run src/layout src/i18n src/home`. Expected: PASS. Fix any test that asserted "Home" as the page or nav text. Those are selector changes per spec §10.
- [ ] **Step 5: Commit** `feat(nav): rename Home to Today and add search destinations`

### Task 2: listClubTeams for club admins

**Files:**
- Modify: `src/teams/teamsApi.ts`
- Test: `src/teams/teamsApi.test.ts` (create it if missing, following the mocking style of sibling `*Api.test.ts` files), `tests/rules/teams.rules.test.ts`

**Interfaces:**
- Produces: `listClubTeams(afterDoc?: QueryDocumentSnapshot | null): Promise<TeamsPage>`. It is the same as `listMyTeams` without the `where`: `orderBy('createdAt','desc')`, `limit(20)`, and the cursor via `startAfter`. Export the `TeamsPage` type.

- [ ] **Step 1: Failing rules test** in `tests/rules/teams.rules.test.ts`: `it('a club admin can list teams without a where clause; a member cannot')`.
  - A club admin's `getDocs(query(collection(db,'clubs/demo/teams'), orderBy('createdAt','desc'), limit(20)))` gives `assertSucceeds`.
  - A member who is in no team's `adminEmails`, running the same query, gives `assertFails`.
  - Use the file's existing helpers.
- [ ] **Step 2:** Run `npm run test:rules -- teams`. Expected: the admin case passes already, because rules allow it (spec §4.4). If the member case wrongly succeeds, stop and report. Rules must not change in this plan.
- [ ] **Step 3: Unit test, then implement `listClubTeams`.** The unit test asserts that the query has no `where` constraint and has `limit(20)`. Use the same mock approach as the existing api tests.
- [ ] **Step 4:** Run `npx vitest run src/teams/teamsApi.test.ts` and `npm run test:rules -- teams`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(teams): listClubTeams for club admins (spec 4.4)`

### Task 3: PageChrome and PageHeader

**Files:**
- Create: `src/layout/PageChrome.tsx`
- Modify: `src/layout/PageHeader.tsx`
- Test: `src/layout/PageChrome.test.tsx`, `src/layout/PageHeader.test.tsx`

**Interfaces:**
- Produces the types:
  ```ts
  export interface PageMainAction { label: string; onSelect: () => void; icon?: LucideIcon; disabled?: boolean }
  export interface PageChromeState { title: string | null; mainAction: PageMainAction | null; more: MenuItem[] }
  ```
- Produces the components and hooks:
  - `<PageChromeProvider>`.
  - `usePageChromeState(): PageChromeState`, which the shell reads.
  - `usePublishPageChrome(state: Partial<PageChromeState>): void`, which a page writes through.
    - It publishes on mount and on change, and resets to empty on unmount.
    - If two components publish, the last mounted wins. This is documented, not guarded.
- `PageHeader` gains `mainAction?: PageMainAction`, `more?: MenuItem[]` and `chromeTitle?: string`.
  - The published title is `chromeTitle ?? (typeof title === 'string' ? title : null)`.
  - When `mainAction` or `more` is given, it is **not** rendered in the content. The toolbar shows it.
  - `actions` keeps rendering in the content exactly as today, so unconverted pages are unchanged.
- `MenuItem` comes from `src/components/Menu.tsx`.

- [ ] **Step 1: Failing tests.**
  - `PageChrome.test.tsx`:
    - `it('publishes title and main action and clears them on unmount')`: a probe reading `usePageChromeState()` sees `title: 'Teams'`, then `title: null` and `mainAction: null` after the publisher unmounts.
    - `it('updates when the published label changes')`.
  - `PageHeader.test.tsx`:
    - `it('renders the title as the large title h1')`: the h1 has the classes `text-large-title` and `md:text-title-1`.
    - `it('does not render mainAction in the content')`.
    - `it('publishes a string title, or chromeTitle for a node title')`.
- [ ] **Step 2:** Run `npx vitest run src/layout/PageChrome.test.tsx src/layout/PageHeader.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `PageChrome.tsx`:
    - Hold one state object in a context.
    - The setter context is stable, so publishers don't re-render on every shell render.
    - When nothing is mounted, `usePublishPageChrome` is a no-op. That keeps PageHeader usable in tests without a provider.
  - `PageHeader`:
    - Change the h1 class to `text-large-title md:text-title-1 text-ink break-words`.
    - Keep the `<div data-page-header>`, not `<header>` (print).
- [ ] **Step 4:** Run `npx vitest run src/layout`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(layout): page chrome context for title and main action`

### Task 4: Sidebar (desktop and tablet overlay)

**Files:**
- Create: `src/layout/Sidebar.tsx`
- Modify: `src/i18n/en/layout.ts`, `src/i18n/it/layout.ts`
- Test: `src/layout/Sidebar.test.tsx`

**Interfaces:**
- Consumes:
  - `navGroups`;
  - `useAuth()` (`club`, `role`, `memberships`, `activeClubId`, `switchClub`, `firebaseUser`, `isPlatformAdmin`, `access`);
  - `otherUsableClubs`;
  - `usePendingSignups`;
  - `useSignOut`;
  - `Menu`.
- Produces:
  - `<Sidebar onNavigate?: () => void />`, the content of a 248 px column, with no positioning.
  - `<SidebarOverlay open: boolean; onClose: () => void; returnFocusTo: RefObject<HTMLElement> />`.
- The `Sidebar` layout:
  - **Header:** the club switcher.
    - A 32 px rounded `surface-3` tile with the club's initials. Initials are the first letters of the first two words of `club.name`, upper-cased.
    - Then the club name (`text-headline`) and the role (`text-footnote text-ink-2`), using `clubs.admin` or `clubs.member` from the catalog, or a new `layout.appShell.roleAdmin`/`roleMember` if that namespace isn't reachable.
    - With other usable clubs, the whole header is the `Menu` trigger with label `Club: <name>` and items `Switch to <club>`, exactly as today. Otherwise it is static.
    - The logo moves out of the sidebar. Plan 6 puts the new mark in. Keep a visually hidden `NavLink to="/" aria-label={t.appShell.homeLabel}` so the inventory's "logo link to /" stays reachable.
  - **Nav:**
    - `<nav aria-label="Main">`.
    - The same groups and `role="group"` labelling as today.
    - Headings are `text-footnote font-semibold text-ink-3`, in sentence case, not uppercase.
    - Items are `NavLink`, 36 px, `rounded-md`, icon 18 at stroke 1.75, `text-callout`.
      - Active: `bg-surface-3 text-ink font-semibold`.
      - Idle: `text-ink-2 hover:bg-surface-2`.
    - Pending badge: `bg-orange-strong text-on-ink`.
    - Clicking a link calls `onNavigate`.
  - **Footer:** the account `Menu`, unchanged in label, placement (up), items and order. The trigger shows a 28 px `surface-3` initials avatar, the email (truncated) and chevrons.
  - **Surface:** the sidebar uses `bg-sidebar` with a right `border-separator` hairline.
- `SidebarOverlay`:
  - A `role="dialog" aria-modal="true"` with `aria-label` `t.appShell.mainNav`.
  - The panel is 248 px on the left with `.glass-pop`, over a scrim of `bg-black/20`.
  - It slides in with `animateSpring` (`SPRING_DEFAULT`) from −248 px, and appears instantly with reduced motion.
  - Closes on Esc, a scrim click or `onNavigate`.
  - Focus:
    - Opening focuses the first nav link, and Tab is trapped in the panel.
    - Closing by Esc or the scrim returns focus to `returnFocusTo`.
    - Closing by navigation leaves focus to the shell's route-change focus.

- [ ] **Step 1: Failing tests** in `Sidebar.test.tsx`. Render with the same `AuthContext` test helper `AppShell.test.tsx` uses.
  - `it('shows club initials, name and role')`: for "Volley Club Bologna" with role admin, the header shows `VC`, `Volley Club Bologna` and `Admin`.
  - `it('club header is a switcher only with other usable clubs')`: with one other club there is a button named `Club: Volley Club Bologna`; with none there is no button.
  - `it('marks the active item with aria-current')` at `/teams`.
  - `it('overlay closes on navigation')`: open, click "Teams", `onClose` is called.
  - `it('Esc returns focus to the trigger')`.
  - `it('keeps the account menu items in order')`: Settings, Terms & privacy, Sign out.
- [ ] **Step 2:** Run `npx vitest run src/layout/Sidebar.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/layout/Sidebar.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(layout): v2 sidebar with club header and tablet overlay`

### Task 5: Shell toolbar, tab bar and AppShell

**Files:**
- Create: `src/layout/ShellToolbar.tsx`, `src/layout/TabBar.tsx`
- Modify: `src/layout/AppShell.tsx`, `src/App.tsx` (wrap the authenticated layout in `PageChromeProvider` and `SearchProvider`), `src/i18n/en/layout.ts`, `src/i18n/it/layout.ts`
- Test: `src/layout/AppShell.test.tsx` (keep every existing test and adjust only selectors), `src/layout/ShellToolbar.test.tsx`

**Interfaces:**
- Consumes:
  - `Toolbar`, `MainAction` (`src/components/Toolbar.tsx`);
  - `usePageChromeState`;
  - `Sidebar`, `SidebarOverlay`;
  - `useSearch()` from Task 9, which yields `{ open(): void }`.
- Task 9 lands after this one. For now, create `src/search/SearchProvider.tsx` with a stub `SearchProvider` and `useSearch()` returning `{ open: () => {} }`, and Task 9 replaces it. List the stub in the commit message.
- `ShellToolbar`:
  - `leading`: on tablet only (`md:flex xl:hidden`), a 44 px icon button "Open navigation" (`PanelLeft` icon) that opens the overlay.
  - `title`: from `usePageChromeState().title ?? ''`.
  - `actions`, in this order:
    - **Desktop (`xl`):** a 220 px search field button with role `button` and label `Search`. It shows a magnifier, "Search" in `ink-3`, and a `⌘K` hint, or `Ctrl K` on non-Mac (`navigator.platform` contains `Mac`). It calls `open()`.
    - **Phone and tablet:** a 44 px magnifier icon button labelled `Search`.
    - When `more.length > 0`: a "⋯" `Menu` with label `t.appShell.moreActions`, the `MoreHorizontal` icon and the `more` items.
  - `mainAction`:
    - When published: `MainAction` with `onClick={onSelect}`.
    - On phones (`< md`), if `icon` is given it shows only the icon, with `aria-label={label}`. Otherwise it shows the label.
- `TabBar`:
  - `<nav aria-label="Main (phone)">`, fixed at the bottom, `.glass`, a top `border-separator` hairline, and padding `pb-[env(safe-area-inset-bottom)]`. It is `md:hidden print:hidden`.
  - Tabs come from `phoneTabs` plus More. Each tab has icon 24 at stroke 1.75 and a label of `text-[10px] font-medium`, with a minimum height of 49 px.
    - Active: `text-ink`.
    - Idle: `text-ink-3`.
  - The More badge works as today.
- `AppShell`:
  - Layout is `xl:flex`.
  - The desktop sidebar is `hidden xl:flex`, `w-[248px]`, sticky, `h-screen`, with overflow scrolling.
  - The content column holds:
    - the banners;
    - `ShellToolbar`;
    - `<main id="main">`;
    - bottom padding `pb-[calc(49px+env(safe-area-inset-bottom))] md:pb-0`.
  - Everything else listed in Global Constraints › Parity stays.
  - The overlay's open state lives in `AppShell` and closes on `pathname` change.
- Pages keep their own `p-4 sm:p-6 lg:p-8` wrappers. Only the shell changes here.

- [ ] **Step 1: Failing tests.**
  - `ShellToolbar.test.tsx`:
    - `it('shows the published title and main action')`.
    - `it('shows the more menu only with items')`.
    - `it('phone main action with icon is icon-only with an accessible name')`. Stub `matchMedia` the way `Sheet.test.tsx` does.
    - `it('search entry calls open')`.
  - `AppShell.test.tsx`: add `it('tab bar has at most 5 tabs with visible labels')`.
- [ ] **Step 2:** Run `npx vitest run src/layout`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run src/layout src/App.test.tsx` (if `App.test.tsx` exists). Expected: PASS. Every pre-existing AppShell test still passes, with selector-only edits.
- [ ] **Step 5: Commit** `feat(layout): v2 shell with toolbar and glass tab bar`

### Task 6: More page and recents clearing on sign-out

**Files:**
- Modify: `src/layout/MorePage.tsx`, `src/auth/useSignOut.tsx`
- Create: `src/search/recents.ts`
- Test: `src/layout/MorePage.test.tsx`, `src/search/recents.test.ts`, `src/auth/useSignOut.test.tsx` (extend it, or create it if missing)

**Interfaces:**
- Produces:
  - `RECENTS_KEY = 'vcb.searchRecents'`;
  - `readRecents(): Recent[]`;
  - `pushRecent(r: Recent): void`, which dedupes by `id`, puts the newest first and keeps at most 8;
  - `clearRecents(): void`.
- `Recent` is `{ id: string; group: SearchGroupId; label: string; sublabel?: string; to: string }`. Define `SearchGroupId = 'goto' | 'actions' | 'teams' | 'players' | 'matches' | 'exercises' | 'trainings'` in `src/search/types.ts` now. Task 7 extends that file.
- Every storage access is wrapped in try/catch. A failure gives `[]` or a no-op.
- `MorePage`:
  - Same items, order and links as today.
  - Restyled as the v2 grouped list:
    - a `surface` group, `rounded-lg` (16), rows at least 52 px;
    - hairlines `border-separator` inset to the text (`ml-12`);
    - a chevron on each row;
    - group headings `text-footnote text-ink-3` in sentence case.
  - The title is the large title. Its `h1` remains the club name.

- [ ] **Step 1: Failing tests.**
  - `recents.test.ts`:
    - `it('keeps the newest 8, deduped by id')`.
    - `it('uses sessionStorage, never localStorage')`.
    - `it('survives a throwing storage')`.
  - `useSignOut` test: `it('sign-out clears recents')`.
  - `MorePage.test.tsx`: existing tests pass, and add `it('rows are at least 52px and show a chevron')` by asserting the `min-h-[52px]` class and an svg with `aria-hidden`.
- [ ] **Step 2:** Run `npx vitest run src/search/recents.test.ts src/layout/MorePage.test.tsx src/auth`. Expected: FAIL.
- [ ] **Step 3:** Implement. Call `clearRecents()` in `useSignOut` next to `clearSignDraft()`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(search): session recents, cleared on sign-out; v2 More page`

### Task 7: Search core: normalise, match, rank, local sources

**Files:**
- Create: `src/search/normalize.ts`, `src/search/match.ts`, `src/search/localSources.ts`
- Modify: `src/search/types.ts`, `src/i18n/en/layout.ts` (or a new `search.ts` namespace registered in `catalog.ts` and `index.ts`), and the `it` equivalent
- Test: `src/search/normalize.test.ts`, `src/search/match.test.ts`, `src/search/localSources.test.ts`

**Interfaces:**
- Types:
  ```ts
  export interface SearchItem {
    id: string;                 // unique within its group
    group: SearchGroupId;
    label: string;
    sublabel?: string;          // e.g. team name for a player, date for a match
    keywords?: string[];        // extra matchable text (age group, "#7", opponent)
    to?: string;                // URL; enables ⌘Enter
    run?: () => void;           // for actions without a URL
    icon?: LucideIcon;
    pick?: 'team';              // action needs a team picker first
  }
  export interface SearchGroup { id: SearchGroupId; label: string; items: SearchItem[]; total: number; loading: boolean }
  ```
- Normalising:
  - `normalize(s: string): string` lowercases and applies NFD with combining marks stripped (`/\p{M}/gu`).
  - `words(s: string): string[]` splits the normalised string on `/[^\p{L}\p{N}#]+/u` and drops empties. Keep `#` so `#7` is a word.
- Ranking:
  - `matchRank(query: string, item: SearchItem): number | null` returns 0, 1, 2 or `null`:
    - **0, exact:** the normalised query equals the normalised label.
    - **1:** every query word is a prefix of some item word, and the first query word is a prefix of the label's first word.
    - **2:** every query word is a prefix of some word in the label or keywords.
    - **`null`:** no match.
    - An empty query gives `null`.
  - `rankItems(query: string, items: SearchItem[], recentIds: string[]): SearchItem[]` returns the matches only. They are sorted by rank, then by position in `recentIds` (lower index first, and absent ones last), then by label with `localeCompare`.
- Local sources:
  - `goToItems(access, isPlatformAdmin): SearchItem[]` maps `goToDestinations` to `group 'goto'` with `id = to`.
  - `actionItems(access, aiEnabled): SearchItem[]`, in this order, each only when permitted:
    - `new-team` "New team", if `access.isClubAdmin`, going to `/teams`;
    - `new-training` "New training", if `sections.trainings`, going to `/trainings`;
    - `new-exercise` "New exercise", if `sections.exercises`, going to `/exercises`;
    - `new-match` "New match…", `pick: 'team'`, when the person admins at least one team or is a club admin;
    - `add-player` "Add player…", `pick: 'team'`, under the same condition.
    - Reuse the existing permission predicates in `src/auth/access.ts` for "can create a match / add a player on team X". The team picker filters with them.
    - AI actions are not in Plan 2. They are hidden when AI is off, as spec §6.1 says, so `aiEnabled` is accepted for Plan 3 and unused now.
  - Actions carry `to` plus a pending action (Task 10). Here they only describe it: `action: PendingActionId` as an extra optional field `action?: PendingActionId` on `SearchItem`. Export `type PendingActionId = 'new-team' | 'new-training' | 'new-exercise' | 'new-match' | 'add-player'` from `src/search/types.ts`.

- [ ] **Step 1: Failing tests.**
  - `normalize.test.ts`:
    - `normalize('Nicolò ÀLVAREZ')` is `'nicolo alvarez'`.
    - `words('U17 – Femminile #7')` is `['u17','femminile','#7']`.
  - `match.test.ts`:
    - `it('exact beats first-word prefix beats other-word prefix')`: for query `mar` against `Mar`, `Marco Rossi` and `Anna Marino`, the ranks are `0`, `1` and `2`.
    - `it('every typed word must match')`: `mar ro` matches `Marco Rossi` but not `Marco Bianchi`.
    - `it('ignores accents both ways')`: `nicolo` matches `Nicolò`, and `nicolò` matches `Nicolo`.
    - `it('matches #number keywords')`: `#7` matches an item with `keywords: ['#7']`.
    - `it('recents break ties')`.
  - `localSources.test.ts`:
    - `it('member with no sections')`: Go to gives `['/','/teams','/settings']`, and Actions is empty when the member admins no team.
    - `it('club admin gets New team')`.
    - `it('section admin gets New training but not New team')`.
- [ ] **Step 2:** Run `npx vitest run src/search`. Expected: FAIL.
- [ ] **Step 3:** Implement. Group labels and action labels go in the catalog:
  | Key | English | Italian |
  |---|---|---|
  | group: Go to | "Go to" | "Vai a" |
  | group: Actions | "Actions" | "Azioni" |
  | group: Teams | "Teams" | "Squadre" |
  | group: Players | "Players" | "Giocatori" |
  | group: Matches | "Matches" | "Partite" |

  Action labels reuse existing catalog strings where they exist, such as `teams.list.create`.
- [ ] **Step 4:** Run `npx vitest run src/search`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(search): normalise, match, rank and local sources`

### Task 8: Search data: teams, players, matches

**Files:**
- Create: `src/search/useSearchData.ts`
- Modify: `src/auth/useSignOut.tsx` (call `clearSearchData()`)
- Test: `src/search/useSearchData.test.tsx`

**Interfaces:**
- Consumes:
  - `listClubTeams` (Task 2);
  - `listMyTeams`;
  - `loadTeamRoster` (`src/matches/matchesApi.ts`);
  - `listMatches`;
  - `useAuth()` (`activeClubId`, `access`, `appUser` or `firebaseUser` email).
- Produces `useSearchData({ opened: boolean; typed: boolean }): { teams: SearchItem[]; players: SearchItem[]; matches: SearchItem[]; loading: { teams: boolean; players: boolean; matches: boolean } }`.
- Loading:
  - Teams load when `opened` first becomes true. A club admin gets `listClubTeams()`, and everyone else `listMyTeams(email)`.
  - Players and matches load when `typed` first becomes true, for the first 20 teams.
    - `loadTeamRoster(teamId)` and `listMatches(teamId)`, with up to 4 teams in flight at once.
    - Each team's results merge in as they arrive.
- Item shape:
  - **Team:** `label: team.name`, `sublabel: ageGroup · season`, `keywords: [ageGroup]`, `to: /teams/:id`.
  - **Player:** `label: name`, `sublabel: team.name`, `keywords: ['#' + number]`, `to: /teams/:teamId/players/:playerId`. Use the same name fields the roster shows.
  - **Match:** `label: 'vs ' + opponent`, `sublabel: formatted date · team.name`, `keywords: [opponent, date]`, `to: /teams/:teamId/matches/:matchId`. Date formatting uses `src/i18n/format.ts`.
- Cache:
  - A module-level cache keyed by `activeClubId + email`, so a second open in the same session re-reads nothing.
  - `clearSearchData()` is exported. `useSignOut` calls it next to `clearRecents`.
  - A different key discards the cache.
- Errors:
  - A failed load leaves that group empty and logs `console.error`.
  - It never throws to the palette.

- [ ] **Step 1: Failing tests** (mock the api modules with `vi.mock`):
  - `it('loads teams once on first open, players and matches on first typed char')`.
  - `it('club admin uses listClubTeams, member uses listMyTeams')`.
  - `it('caps rosters and matches at the first 20 teams')`: 25 teams lead to 20 `loadTeamRoster` calls.
  - `it('late roster load renders against the current query')`. The hook only supplies items and the palette ranks them, so assert that items appended after a delay appear in the returned list, with no stale replacement.
  - `it('cache is keyed by club id and cleared on sign-out')`.
- [ ] **Step 2:** Run `npx vitest run src/search/useSearchData.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(search): session-cached teams, rosters and matches`

### Task 9: Search palette and ⌘K

**Files:**
- Create: `src/search/SearchPalette.tsx`
- Replace the stub: `src/search/SearchProvider.tsx`
- Modify: the i18n `search` strings
- Test: `src/search/SearchPalette.test.tsx`, `src/search/SearchProvider.test.tsx`

**Interfaces:**
- Consumes:
  - Tasks 6–8;
  - `Sheet` (`src/components/Sheet.tsx`) on phones;
  - `useMediaQuery('(min-width: 768px)')`;
  - `useNavigate`.
- Produces:
  - `<SearchProvider>`, wrapping the authenticated layout (already placed in Task 5).
  - `useSearch(): { open(): void; close(): void; isOpen: boolean }`.
- The shortcut:
  - `keydown` on `window`, for `(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'`.
  - It opens unless:
    - the path matches `/exercises/:id/diagram`;
    - or `document.querySelector('[role="dialog"][aria-modal="true"]')` exists and is not the palette itself. That covers open sheets, so unsaved forms are never interrupted.
  - It calls `preventDefault()` only when it opens.
  - While open, ⌘K closes it.
- The desktop panel:
  - Fixed, centred at 18vh from the top, 640 px wide, `.glass-pop`, `rounded-xl`, over a scrim of `bg-black/20`.
  - **No open or close animation.**
- The phone view is a full-height `Sheet` (large detent) with the field focused.
- The field:
  - An `<input role="combobox" aria-expanded aria-controls={listId} aria-activedescendant={activeId} aria-autocomplete="list">`.
  - Placeholder: "Search teams, players, matches…" / "Cerca squadre, giocatori, partite…".
- The results:
  - The list is `role="listbox"`. Group headings are `role="presentation"` with visible text, and options are `role="option"` with `aria-selected`.
  - Group order: Go to, Actions, Teams, Players, Matches.
  - Each group shows at most 5 items. A "Show all N" button (the count is the group's match total) expands that group in place.
  - A visually hidden `aria-live="polite"` region announces "N results" / "N risultati" after each query settles, debounced 300 ms.
- Keyboard:
  | Key | Action |
  |---|---|
  | ↑ / ↓ | Move through options, wrapping |
  | Enter | Open the active option |
  | ⌘Enter / Ctrl+Enter | When the option has `to`, `window.open(to, '_blank', 'noopener')` and close |
  | Esc | Clears the field when it has text, otherwise closes |
  | Tab / Shift+Tab | Move the active option to the first item of the next or previous group (`preventDefault`) |
- Opening an option:
  - `pushRecent(...)`, then close.
  - Then navigate to `to`, passing the pending action (Task 10) for action items.
  - If the option has `pick: 'team'`, the palette switches to a "Choose a team" step instead: the teams the action is permitted on, with Esc going back.
- States:
  - **Empty query:** Recents (only when there are any, labelled "Recent" / "Recenti"), then Go to.
  - **Typing:** the ranked groups.
    - While `loading.players` or `loading.matches` is true and the group is still empty, show 2 skeleton rows (`Skeleton`) in that group. Never a spinner.
  - **No results:** "No results for ‘x’" / "Nessun risultato per ‘x’", followed by the Actions group, unfiltered.
- Closing restores focus to the element that had it before opening.

- [ ] **Step 1: Failing tests.**
  - `SearchProvider.test.tsx`:
    - `it('Ctrl+K opens and Ctrl+K again closes')`.
    - `it('does not open while a modal dialog is open')`: render a `[role=dialog][aria-modal=true]` element, press Ctrl+K, the palette is absent, and `defaultPrevented` is false.
    - `it('does not open on the diagram editor route')`.
  - `SearchPalette.test.tsx`, with `useSearchData` mocked to fixed items:
    - `it('empty query shows recents then Go to')`.
    - `it('arrow keys move aria-activedescendant and Enter navigates')`.
    - `it('Tab jumps to the next group')`.
    - `it('Esc clears then closes')`.
    - `it('caps groups at 5 with Show all N')`: 7 players matching "a" show 5 options and "Show all 7".
    - `it('no results shows the message and Actions')`.
    - `it('a team-picker action asks for a team first')`.
    - `it('announces the result count')`.
    - `it('shows skeleton rows while players load')`.
- [ ] **Step 2:** Run `npx vitest run src/search`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/search src/layout`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(search): ⌘K palette with local groups`

### Task 10: Pages adopt the toolbar and palette actions

**Files:**
- Create: `src/search/pendingAction.ts`
- Modify: `src/teams/TeamsListPage.tsx`, `src/trainings/TrainingsPage.tsx`, `src/exercises/ExercisesPage.tsx`, the Roster and Matches tabs inside `src/teams/TeamPage.tsx` (or their tab components)
- Test: the existing page tests (`TeamsListPage.test.tsx`, `TrainingsPage.test.tsx`, `ExercisesPage.test.tsx`, `TeamPage.test.tsx`), plus `src/search/pendingAction.test.ts`

**Interfaces:**
- Consumes: `PendingActionId` from `src/search/types.ts` (Task 7).
- Produces:
  - `withPendingAction(id): { state: { pendingAction: PendingActionId } }`, for `navigate(to, withPendingAction(id))`;
  - `useTakePendingAction(id: PendingActionId, run: () => void): void`.
    - On mount or a location change, if `location.state?.pendingAction === id`, it calls `run()` once.
    - It then clears the state with `navigate(location.pathname + location.search, { replace: true, state: null })`, so a reload or Back doesn't reopen the dialog.
- These pages move their main action and "⋯" items to the toolbar via the `PageHeader` `mainAction`/`more` props. The permission checks are unchanged.
  | Page | Main action | "⋯" items |
  |---|---|---|
  | Teams | "New team" (club admin), with the `Plus` icon | "Import teams" (club admin) |
  | Trainings | "New training", with the `Plus` icon | "Import" and "Draft with AI" (when AI is on, with the `Sparkles` icon) |
  | Exercises | "New exercise", with the `Plus` icon | "Import" and "Draft with AI" (when AI is on) |
- They also honour the palette's pending actions:
  - `new-team`, `new-training` and `new-exercise` on those three pages, opening the same dialog as the main action;
  - `add-player` on the team page's Roster tab, opening the Add player dialog;
  - `new-match` on the Matches tab, opening the New match dialog.
- The palette navigates:
  - `add-player` to `/teams/:id?tab=roster`;
  - `new-match` to `/teams/:id?tab=matches`.
- Team page tabs keep their in-content buttons. Plan 4's area work moves them.

- [ ] **Step 1: Failing tests.**
  - `pendingAction.test.ts`: `it('runs once and clears the state')`.
  - Teams page: `it('opens create team from a pending action')`.
  - Trainings page: `it('more menu holds import and AI draft')`, with AI on and with AI off.
  - TeamPage test: `it('add-player pending action opens the add player dialog')`.
- [ ] **Step 2:** Run `npx vitest run src/search/pendingAction.test.ts src/teams src/trainings src/exercises`. Expected: the new tests FAIL. Existing tests that clicked the old in-content "New team" button now find it in the toolbar. Since tests render the page without the shell, they assert on the published chrome through a test `PageChromeProvider` probe instead. These are selector changes.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/search src/teams src/trainings src/exercises src/layout`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): toolbar main actions on library pages and palette actions`

### Task 11: Gate, gallery entry and checklist

**Files:**
- Modify: `src/dev/UiGallery.tsx` (add a "Shell" section with a link to `/` and a button that calls `useSearch().open()`)
- Test: none new

- [ ] **Step 1:** Run `npm test`, `npm run lint`, `npm run build` and `npm run test:rules`. Expected: all green, with lint showing 0 errors. If the flaky load-timeout tests (Italian, PlayerCard) fail, rerun those files alone and report both results.
- [ ] **Step 2:** Check that `dist/` doesn't contain the gallery strings: `grep -r "UiGallery\|Level pills" dist/assets | wc -l` should print `0`.
- [ ] **Step 3: Commit** `chore(dev): gallery shell section`
- [ ] **Step 4:** Write the visual checklist for the user in the group report. It covers:
  - the desktop sidebar at 1280 px and over;
  - the tablet overlay between 768 and 1279 px;
  - the phone glass tab bar and safe area;
  - the toolbar inline title on scroll;
  - ⌘K and Ctrl+K;
  - keyboard navigation in the palette;
  - the phone search sheet;
  - the Teams/Trainings/Exercises main action and "⋯";
  - "New match…" through the team picker;
  - Italian labels in the tab bar.
  - Remind the user that `tailwind.config.js` didn't change, so no dev-server restart is needed. If it did change, they must restart.
