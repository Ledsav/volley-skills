# UI Redesign 6: Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the redesign (spec §11 item 6). Delete the legacy tokens, the dead primitives and the `Dialog` adapter. Switch the app, favicons, PWA icons and OG image to the new one-colour Spin mark. Make CLAUDE.md, the design docs, the spec and the inventory describe the app as it now is. The only visible change is the logo.

**Precondition:** the 4g fix-ups and plan 5 (shared outputs, including any PDF tasks the user unblocked) are committed, and `git status` is clean. Record `BASE=$(git rev-parse HEAD)` before Task 1, for the Task 9 greps.

**Execution groups** (tasks inside a group run in order):
- **A:** Tasks 1–4 (code cleanup), in order: Task 1 removes `Tab.tsx`, which Task 2's guard test would otherwise flag.
- **B:** Tasks 5–6 (logo switch-over).
- **C:** Tasks 7–8 (docs). Runs after B, because the docs describe B's result.
- **D:** Task 9 (gate, user checklists).

**Architecture:**
- **Tokens.** Tailwind loses `navy`, `slate`, `border` and the `title`/`section` type roles. `index.css` loses `--color-slate` and `--color-border` in `:root`, `.dark` and the print block. `--color-navy` and `--color-blue` **stay**: stored diagram item colours resolve through `tokenColor()` to `rgb(var(--color-<name>))` (`PaletteColor` includes `navy`). `bg` is a v2 token (design system §2.1) that sits under the legacy comment by mistake; it stays.
- **Adapters.** `SectionTabs`, `Tab` and `ThemeToggle` have no importers and are deleted, along with `useTheme()` and the `theme` catalog. `Dialog` forwards to `Sheet` in 11 files; they now render `Sheet` directly and its tests move to `Sheet.test.tsx`.
- **One logo swap point.** `BrandMark` in `src/components/Logo.tsx` is the only component that renders the app mark. `MinimalShell` uses it too. The old `Logo` lockup is deleted.
- **OG image without new dependencies.** A small script composes `public/og-image.svg` from the brand kit's white lockup. It then screenshots that SVG to `public/og-image.png` with the headless Chrome that `scripts/docs/buildBrochure.mjs` already uses. On this machine, `--headless=new --window-size=1200,630 --screenshot` was checked to give exactly 1200×630. The script checks the PNG's IHDR and fails otherwise. Both files are committed; the build doesn't run Chrome.

**Not in this plan:** README banner (`docs/readme/banner.png`) and `docs/marketing/*` artwork (marketing, not the app); historical specs that mention the old design-system spec in passing (records, left as written); the `vcb.*` key names; `docs/design/brand/exploration/`.

**Tech Stack:** Tailwind 3 (CSS-variable tokens), React 18 + TypeScript strict, Vitest (jsdom, Node 20 `fs`), headless Chrome via `child_process` (no new dependency).

**Spec:**
- `docs/superpowers/specs/2026-10-28-ui-redesign-design.md`: §3, §4 (copied into the inventory), §5 (token migration, new logo), §10, §11 item 6.
- `docs/design/brand/README.md` §6 (dark tile edge), §8 (switch-over steps); `docs/design/design-system/README.md` §2, §3, §10.
- Redesign handover notes (the "CLEANUP" lines, all folded in below).

## Global Constraints

- Pure cleanup: no behaviour change except the logo swap. Existing tests may change imports and selectors, never assertions, except where a task names the change.
- Never delete `--color-navy` or `--color-blue` (stored diagram colours), or the `theme` storage key and `getInitialTheme` (mirrored by `public/theme-init.js`).
- Brand artwork is copied from `docs/design/brand/logo/` byte for byte. Never redraw it, retype the wordmark or re-export the PNGs.
- No new npm dependency, no Firestore, rules or index change.
- New or changed UI strings go in `src/i18n/en` and `src/i18n/it` only (the UI's only catalogs).
- Never commit `serviceAccountKey.json` (or `.enc`), `*.vsbackup`, private keys, `.env.local` or `reference/`. Commit only as the steps say; never push or merge.
- Gates per group: `npm test`, `npm run lint` (0 errors), `npm run build`. Task 9 adds `npm run test:rules` on a temporary port, because 8080 belongs to the user's emulator.

## Review Focus

1. **A diagram saved with a `navy` or `blue` item, after the token deletion.** It draws the same colour in the editor, thumbnails and the training PDF. Pinned in Task 2 by "index.css keeps navy and blue for stored diagram colours".
2. **The black app tile on a black dark-mode surface** (sign-in, legal header, minimal shell). It must not vanish; brand §6 asks for a 1 px `rgba(255,255,255,.16)` edge. Pinned in Task 5 by "the mark tile carries the dark-mode edge".
3. **A person with `theme` stored as `light` or `dark` after `useTheme()` goes.** They keep their theme, and Settings' System · Light · Dark still works. Pinned by `theme.test.ts` and `useThemePreference.test.tsx` passing unchanged (Task 1).
4. **A picker that hands over to an edit sheet, and a later sheet whose opener is gone.** The hand-over still returns focus to the original button. A later layer never sends focus to an old, unrelated element. Pinned in Task 4.
5. **Home-screen install and link previews after the icon swap.** Every manifest and `<link>` icon exists at its declared size, and the OG image is 1200×630. Pinned in Task 6 by `publicAssets.test.mjs`.

---

## File Structure

| File | Responsibility |
|---|---|
| `tailwind.config.js`, `src/index.css` (modify) | Legacy tokens out; navy/blue vars kept; `--brand-tile-edge` |
| `src/theme/legacyTokens.test.ts` (create) | Guard: no legacy tokens or classes come back |
| `src/components/{CodeBlock,HealthHint,EditButton}.tsx` (modify) | Last legacy and blue-accent classes |
| `src/trainings/pdf/diagramToPdfSvg.ts` (modify) | `LIGHT_TOKENS` without slate/border |
| `src/components/{SectionTabs,Tab,Dialog}.tsx` + tests, `src/theme/ThemeToggle.tsx` + test, `src/i18n/{en,it}/theme.ts` (delete) | Dead primitives and the adapter |
| 11 `Dialog` callers (modify), `src/components/Sheet.test.tsx` (modify) | Render `Sheet` directly; ported tests |
| `src/components/useModalLayer.ts` + test (modify) | The focus fallback is consumed on open |
| `src/assets/brand/*` (replace), `src/components/Logo.tsx` + test, `src/layout/MinimalShell.tsx` + test (modify) | New mark through `BrandMark` only |
| `public/*` icons, `public/manifest.webmanifest`, `index.html` (modify) | Web icons from the brand kit |
| `scripts/docs/ogImage.mjs`, `scripts/docs/buildOgImage.mjs`, `scripts/docs/publicAssets.test.mjs` (create); `public/og-image.{svg,png}` (regenerate) | OG image and public-asset checks |
| `CLAUDE.md`, `README.md`, `docs/design/**/README.md` (modify); old design-system spec and `docs/brand/` (retire) | Docs point to `docs/design/` |
| Redesign spec, inventory README, `06-trainings-exercises-diagrams.md`, `05-reports-stats-awards.md` (modify) | Agreed changes recorded; superseded wording fixed |

---

### Task 1: Delete the dead primitives and the old theme toggle

**Files:**
- Delete: `src/components/SectionTabs.tsx`, `src/components/SectionTabs.test.tsx`, `src/components/Tab.tsx`, `src/components/Tab.test.tsx`, `src/theme/ThemeToggle.tsx`, `src/theme/ThemeToggle.test.tsx`, `src/i18n/en/theme.ts`, `src/i18n/it/theme.ts`
- Modify: `src/theme/useTheme.ts` (delete `useTheme()` only), `src/i18n/en/index.ts`, `src/i18n/it/index.ts` (drop the `theme` import and key)

**Interfaces:** `useThemePreference()`, `getInitialTheme`, `applyTheme`, `setThemePreference` and `startSystemThemeSync` are unchanged. `Catalog` loses the `theme` key.

- [ ] **Step 1:** `grep -rn "SectionTabs\|components/Tab'\|ThemeToggle\|useTheme()\|\.theme\.\(dark\|light\)" src`. Expected: hits only in the files listed above.
- [ ] **Step 2:** Delete and modify as listed. In `useTheme.ts`, remove imports that only `useTheme` used (`getInitialTheme`, `applyTheme`, `Theme` if unused), since `noUnusedLocals` fails the build.
- [ ] **Step 3:** Run `npm test`. Expected: PASS, with `theme.test.ts`, `useThemePreference.test.tsx`, `SettingsPage` tests and the i18n tests green.
- [ ] **Step 4:** Run `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `chore(ui): delete SectionTabs, Tab, ThemeToggle, useTheme and the theme strings`

### Task 2: Delete the legacy tokens

**Files:**
- Create: `src/theme/legacyTokens.test.ts`
- Modify: `tailwind.config.js`, `src/index.css`, `src/components/CodeBlock.tsx`, `src/components/HealthHint.tsx`, `src/components/EditButton.tsx`, `src/trainings/pdf/diagramToPdfSvg.ts`

**Interfaces:** none produced. `tokenColor()` and `PALETTE_COLORS` are unchanged.

- [ ] **Step 1: Failing test** `legacyTokens.test.ts`. Read files with `readFileSync(resolve(process.cwd(), …), 'utf8')`; walk `src` with `readdirSync('src', { recursive: true })`.
  - `it('tailwind has no legacy colour or type roles')`: the config text has no `/^\s*(navy|slate|border):/m`, no `/^\s*(title|section):\s*\[/m`, and no `'removed in increment 6'`.
  - `it('index.css keeps navy and blue for stored diagram colours but no slate or border')`: no `--color-slate` or `--color-border` anywhere. The `:root` block and the `.dark` block each still define `--color-navy` and `--color-blue`.
  - `it('no source file uses a legacy token class')`: over every `.ts`/`.tsx` under `src` except `*.test.*`, none matches
    `/(?:^|[\s"'\`:])(?:text|bg|border|divide|ring|outline|fill|stroke)-(?:slate|border|navy)(?![\w-])|(?:^|[\s"'\`:])text-(?:title|section)(?![\w-])|(?:ring|outline)-blue(?![\w-])/m`.
    The failure message lists the files.
- [ ] **Step 2:** Run `npx vitest run src/theme/legacyTokens.test.ts`. Expected: FAIL, naming `tailwind.config.js`, `index.css`, `CodeBlock.tsx`, `HealthHint.tsx`, `EditButton.tsx`.
- [ ] **Step 3: Implement.**
  - `tailwind.config.js`:
    - remove `navy`, `slate` and `border` from `colors`, and move `bg` up next to `surface` with no legacy comment;
    - remove the `title` and `section` font sizes and their comment.
  - `index.css`:
    - delete the `--color-slate` and `--color-border` lines in `:root`, `.dark` and `@media print .dark`, plus the "Legacy aliases" comment;
    - change the `--color-navy` comment to `/* kept: stored diagram item colours resolve to it (tokenColor) */`.
  - Class swaps:
    - `CodeBlock`: `border-border` → `border-separator`, `text-slate` → `text-ink-2`, `focus-visible:ring-blue` → `focus-visible:ring-focus`;
    - `HealthHint`: `text-slate` → `text-ink-2`;
    - `EditButton`: `text-blue-strong hover:bg-blue/10 focus-visible:ring-blue` → `text-ink hover:bg-surface-3 focus-visible:ring-focus`. Blue is only the Advanced band (design system §2.2).
  - `diagramToPdfSvg.ts`: drop the `slate` and `border` keys from `LIGHT_TOKENS`. No diagram colour uses them; unknown tokens already fall back to ink.
- [ ] **Step 4:** Run `npx vitest run src/theme src/components src/trainings src/diagrams`. Expected: PASS, with `printTheme.test.ts`, `contrast.test.ts` and the `diagramToPdfSvg` parity test unchanged.
- [ ] **Step 5: Commit** `chore(ui): delete the legacy tokens and type roles; navy and blue stay for diagram colours`

### Task 3: Replace the Dialog adapter with Sheet

**Files:**
- Delete: `src/components/Dialog.tsx`, `src/components/Dialog.test.tsx`
- Modify: `src/aiDraft/ExerciseDraftDialog.tsx`, `src/aiDraft/TrainingDraftDialog.tsx`, `src/bulkImport/BulkImportDialog.tsx`, `src/matches/dvw/DvwImportDialog.tsx`, `src/matches/scout/CorrectionDialog.tsx`, `src/matches/scout/EditEventDialog.tsx`, `src/matches/scout/HotkeyCheatSheet.tsx`, `src/matches/scout/SetStartDialog.tsx`, `src/matches/scout/SubDialog.tsx`, `src/matches/TeamMatchesTab.tsx`, `src/trainings/TeamNotesDialog.tsx`
- Test: `src/components/Sheet.test.tsx`

**Interfaces:** the mapping is mechanical. `<Dialog …>` becomes `<Sheet …>` from `../components/Sheet` (path per file). `mobileSheet` becomes `detent="large"`, and an absent `mobileSheet` becomes no `detent`, since Sheet defaults to `'content'`, as Dialog did. `title`, `onClose`, `size`, `footer`, `dirty` and `guardUnsaved` pass through unchanged.

- [ ] **Step 1: Port the tests.** Move all ten `Dialog.test.tsx` cases into a new `describe('Sheet (desktop dialog)')` in `Sheet.test.tsx`, rendering `<Sheet>` with the same props and the same assertions. The one rename: `'opens the large detent when mobileSheet is set…'` becomes `it('opens the large detent when detent is large, the content detent otherwise')`, asserting `data-detent` `'large'` / `'content'`.
- [ ] **Step 2:** Run `npx vitest run src/components/Sheet.test.tsx`. Expected: PASS (Sheet already behaves this way; the move keeps the coverage).
- [ ] **Step 3:** Change the 11 callers, then delete `Dialog.tsx` and `Dialog.test.tsx`.
- [ ] **Step 4:** Run `grep -rn "components/Dialog'\|<Dialog\b\|mobileSheet" src`. Expected: nothing. Then run `npm test` and `npm run build`. Expected: PASS; every scouting, DVW, AI draft, bulk import, matches and team notes test passes unchanged.
- [ ] **Step 5: Commit** `refactor(ui): render Sheet directly; delete the Dialog adapter`

### Task 4: The focus fallback is consumed when a layer opens

**Files:**
- Modify: `src/components/useModalLayer.ts`
- Test: `src/components/useModalLayer.test.tsx`

**Interfaces:** `useModalLayer(onEscape, panelRef?)` is unchanged. Internally, the mount effect reads `opener = recorded connected ? recorded : lastReturnedTo` and then sets `lastReturnedTo = null` at once. The cleanup still sets it after returning focus. So the fallback serves only the layer that opens right after another closed, which is the hand-over it exists for, and is never left holding an old element.

- [ ] **Step 1: Failing test.** In the test file, give `Layer` an optional `panel = true` prop (`useModalLayer(onClose, panel ? ref : undefined)`). Add a `Harness2` with buttons `Open A` and `Open picker`. `Open A` shows Layer `a`. `Open picker` shows a panel-less Layer `picker`, plus a `swap` button that replaces it with Layer `edit`.
  - `it('a replacing layer never returns focus to an element from an earlier, unrelated layer')`:
    - focus and click `Open A`, then click `close a` (focus is back on `Open A`);
    - focus and click `Open picker`, focus and click `swap`, then click `close edit`;
    - expect `Open A` **not** to have focus.
- [ ] **Step 2:** Run `npx vitest run src/components/useModalLayer.test.tsx`. Expected: the new test FAILS (focus jumps back to `Open A`), and the existing two pass.
- [ ] **Step 3:** Implement as specified above, and update the `lastReturnedTo` comment to say it is consumed on open.
- [ ] **Step 4:** Run `npx vitest run src/components src/players src/teams src/trainings`. Expected: PASS, including "a layer that replaces another falls back to where the previous layer returned focus".
- [ ] **Step 5:** Commit `fix(ui): the modal focus fallback is consumed when a layer opens`. Then run the group A gate: `npm test`, `npm run lint`, `npm run build`.

### Task 5: The new mark in the app

**Files:**
- Delete: all 11 files in `src/assets/brand/`
- Create: `src/assets/brand/*.svg`, copied from `docs/design/brand/logo/*.svg` (11 files, `web-icons/` excluded)
- Modify: `src/components/Logo.tsx`, `src/layout/MinimalShell.tsx`, `src/index.css`
- Test: `src/components/Logo.test.tsx`, `src/layout/MinimalShell.test.tsx`

**Interfaces:**
- `Logo.tsx` exports only `BrandMark({ className = '', wordmark = true }: { className?: string; wordmark?: boolean })`. The old `Logo` lockup is deleted.
  - The mark is `img` with `src` `../assets/brand/volley-skills-mark-app-icon.svg` (white mark on the black tile, design system §10), `h-7 w-7 rounded-[22.5%] shadow-[0_0_0_1px_var(--brand-tile-edge)]`.
  - With `wordmark`, the image is decorative (`alt=""`) and the text "Volley Skills" sits beside it in `text-headline text-ink`, as today.
  - With `wordmark={false}`, the image carries `alt="Volley Skills"`.
  - The header comment points to `docs/design/brand/README.md` and says this is the only place the app mark is rendered.
- `index.css`: `--brand-tile-edge` is `transparent` in `:root` and in the print `.dark` block, and `rgb(255 255 255 / 0.16)` in `.dark` (brand §6).
- `MinimalShell`: the `mark` import and its `img` become `<BrandMark wordmark={false} className="shrink-0" />` before the title.

- [ ] **Step 1: Failing tests.**
  - `Logo.test.tsx` (the existing test stays):
    - `it('shows the app icon tile')`: the img `src` contains `volley-skills-mark-app-icon`.
    - `it('the mark tile carries the dark-mode edge')`: the img has class `shadow-[0_0_0_1px_var(--brand-tile-edge)]`. `index.css`'s `.dark` block defines `--brand-tile-edge: rgb(255 255 255 / 0.16)`, and `:root` defines it `transparent`.
    - `it('without the wordmark the mark carries the name')`: `render(<BrandMark wordmark={false} />)` gives `getByRole('img', { name: 'Volley Skills' })` and no text "Volley Skills".
    - `it('src/assets/brand holds exactly the brand kit masters')`: the sorted file list of `src/assets/brand` equals the sorted `*.svg` list of `docs/design/brand/logo`, and every pair is byte-identical (`readFileSync(...).equals(...)`).
  - `MinimalShell.test.tsx`: `it('shows the app mark through BrandMark')`: `getByRole('img', { name: 'Volley Skills' })` has a `src` containing `volley-skills-mark-app-icon`.
- [ ] **Step 2:** Run `npx vitest run src/components/Logo.test.tsx src/layout/MinimalShell.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Swap the assets (`git rm` the old 11, copy the new 11) and implement as specified above.
- [ ] **Step 4:** Run `grep -rn "assets/brand" src --include=*.ts --include=*.tsx | grep -v test`. Expected: only `src/components/Logo.tsx`. Then run `npm test`. Expected: PASS, including `printTheme.test.ts` (the new variable has a print value), `AuthShell` and `LegalDocPage` tests.
- [ ] **Step 5: Commit** `feat(brand): the one-colour Spin mark in the app, through BrandMark only`

### Task 6: Web icons, manifest and OG image

**Files:**
- Replace (byte copies from `docs/design/brand/logo/web-icons/`): `public/favicon.svg`, `public/favicon.ico`, `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png`, and `public/icon-maskable-512.png` (from `maskable-512.png`; the public name stays so the manifest path is stable)
- Delete: `public/icon-maskable.svg` (nothing references it)
- Modify: `public/manifest.webmanifest`, `index.html`
- Create: `scripts/docs/ogImage.mjs`, `scripts/docs/buildOgImage.mjs`, `scripts/docs/publicAssets.test.mjs`
- Regenerate: `public/og-image.svg`, `public/og-image.png`

**Interfaces:**
- `ogImage.mjs` (pure):
  ```js
  export const OG = { width: 1200, height: 630, bg: '#000000', lockupWidth: 720 };
  export function ogImageSvg(lockupSvg: string): string;
  // the lockup's viewBox (946×256) and inner markup (outer <svg> and <title> stripped), nested as
  // <svg x="240" y="217.6" width="720" height="194.8" viewBox="0 0 946 256"> on a full-size black rect;
  // root svg has width/height 1200/630, role="img", aria-label="Volley Skills"
  export function pngSize(buf: Buffer): { width: number; height: number }; // IHDR: readUInt32BE(16), (20); throws if the PNG signature is wrong
  ```
- `buildOgImage.mjs` (CLI, `node scripts/docs/buildOgImage.mjs [--chrome <path>]`):
  - it reads `docs/design/brand/logo/volley-skills-lockup-white.svg` and writes `public/og-image.svg`;
  - it runs Chrome, found exactly as in `buildBrochure.mjs`, with `--headless=new --disable-gpu --no-first-run --hide-scrollbars --window-size=1200,630 --screenshot=<abs public/og-image.png> <file URL of og-image.svg>`;
  - it exits 1 unless `pngSize` is 1200×630.
- `manifest.webmanifest`: `name`, `short_name`, `start_url`, `scope` and `display` stay. `theme_color` becomes `#000000` (from `site.webmanifest`). `background_color` becomes `#F5F5F7` (the v2 `bg`, replacing the old slate `#F8FAFC`). The three icons keep their paths and purposes.
- `index.html`: `<link rel="icon" href="/favicon.ico" sizes="48x48">` (the new ico holds 16/32/48). The two `theme-color` metas become light `#F5F5F7` and dark `#000000`, so the browser bar matches the v2 page canvas instead of the old navy. The other links stay.

- [ ] **Step 1: Failing tests** in `publicAssets.test.mjs`:
  - `it('ogImageSvg centres the white lockup on black at 1200×630')`, using the real lockup file:
    - output contains `width="1200" height="630"`, `fill="#000000"`, `viewBox="0 0 946 256"` and `x="240"`;
    - it holds as many `<path` as the lockup;
    - it holds exactly one `<title` or none.
  - `it('pngSize reads the IHDR and rejects a non-PNG')`.
  - `it('every manifest icon exists at its declared size')`: each `icons[].src` under `public/` has `pngSize` equal to `sizes`. One icon has `purpose: 'maskable'`, and `theme_color === '#000000'`.
  - `it('public web icons are the brand kit files')`: byte equality for the six pairs listed under Files.
  - `it('every icon and manifest link in index.html resolves to a file in public')`.
  - `it('the OG image is 1200×630')`: `pngSize(public/og-image.png)`.
- [ ] **Step 2:** Run `npx vitest run scripts/docs/publicAssets.test.mjs`. Expected: FAIL (module missing, icons differ).
- [ ] **Step 3:** Copy the icons, delete `icon-maskable.svg`, edit the manifest and `index.html`, and write `ogImage.mjs` and `buildOgImage.mjs`.
- [ ] **Step 4:** Run `node scripts/docs/buildOgImage.mjs`. Expected: `Wrote public/og-image.png (1200×630)`. Open the PNG with the Read tool and check it is a white lockup, centred on black.
- [ ] **Step 5:** Run `npx vitest run scripts/docs` and `npm run build`. Expected: PASS; `dist/` contains the new icons and `og-image.png`.
- [ ] **Step 6:** Commit `feat(brand): web icons, manifest and OG image from the brand kit`. Then run the group B gate: `npm test`, `npm run lint`, `npm run build`.

### Task 7: CLAUDE.md, README and the design docs point to docs/design

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/design/README.md`, `docs/design/design-system/README.md`, `docs/design/brand/README.md`
- Move: `git mv docs/brand/README.md docs/design/brand/history-colour-spin-ball.md` (`docs/brand/` is then gone)
- Delete: `docs/superpowers/specs/2026-09-04-volley-skills-design-system.md` (git history keeps it)

**Interfaces:** none (docs only). Every edit describes code that exists after Tasks 1–6, so check each claim against the code as you write it.

- [ ] **Step 1: CLAUDE.md.**
  - Replace the spec-table row for `2026-09-04-volley-skills-design-system.md` with a `docs/design/` row: "**Design system and brand (v2)** — `design-system/README.md` (rules: tokens, type roles, materials, motion, patterns), `design-system/mockups/`, `brand/README.md` (logo kit). The source of truth for any UI work."
  - Add a row for `specs/2026-10-28-ui-redesign-design.md` + `ui-redesign-inventory/`: "UI redesign: agreed behaviour changes, pattern behaviour, parity contract".
  - Rewrite "### Design system":
    - **9 skills** (`SKILL_KEYS` in `src/types/player.ts`), the 1–10 scale and the level bands are unchanged;
    - colours are semantic CSS variables in `src/index.css` (`bg`, `surface`/`-2`/`-3`, `ink`/`-2`/`-3`, `on-ink`, `separator`, `focus`, `sidebar`), plus data colours `red`/`orange`/`blue`/`green` with `-strong` text forms. Blue is only the Advanced band;
    - `--color-navy`/`--color-blue` stay because stored diagram colours resolve to them;
    - type roles `large-title` … `display` live in `tailwind.config.js`;
    - motion is `src/motion/`; the primitives are `Sheet`, `Button`, `Menu`/`ContextMenu`, `SegmentedControl`, `GroupedList`, `SwipeRow` and `Toolbar`, and `useNotify()` for success and undo;
    - page titles come from `PageHeader` (`text-large-title`, `md:text-title-1`);
    - the app mark renders only through `BrandMark` (`src/components/Logo.tsx`);
    - the theme is System · Light · Dark (key `theme`, absent = System).
  - "Training PDF": if `vfs_fonts` is gone (plan 5 Task 6 shipped), replace "Roboto lacks arrow glyphs" with the shipped font. Otherwise leave it.
- [ ] **Step 2: README.md** "Design system": link `docs/design/design-system/README.md` and `docs/design/brand/README.md`. Replace the navy/blue colour bullet with "monochrome chrome; colour only for levels, grades and states". Point the logo bullet to `src/assets/brand` (copied from `docs/design/brand/logo`).
- [ ] **Step 3: docs/design.**
  - `design-system/README.md`:
    - status: "approved 2026-10-28; built by the UI redesign; the source of truth for every UI decision" (drop the old-spec sentence);
    - §2.2 text column: light Beginner `#CD0014` and Elite `#1E7D37`, each with a note "(`#D70015` / `#248A3D` darkened one step for AA on the 14% tint)". Add the solid destructive fill `#D70015` with white content (swipe actions);
    - §3: `title-1` use reads "the team name, the player name, desktop page titles"; add "Sheet titles: `headline` in the phone sheet bar, `title-2` in the desktop sheet header", which is what `Sheet.tsx` renders.
  - `brand/README.md`: status "In the app since the redesign's cleanup (2026-10-29). The previous colour Spin Ball is in [`history-colour-spin-ball.md`](history-colour-spin-ball.md)". Mark §8 "Done in the cleanup increment", with step 3's maskable file kept as `public/icon-maskable-512.png`.
  - `history-colour-spin-ball.md`: replace the "Being replaced" banner with "**History.** The 2026-10-13 colour Spin Ball, replaced on 2026-10-29 by the one-colour mark in [`README.md`](README.md). Its files are no longer in the app."
  - `docs/design/README.md`: replace the "current design system and logo, in force until…" bullet with the history file.
- [ ] **Step 4:** Delete the old spec. Run `grep -rn "2026-09-04-volley-skills-design-system\|docs/brand/\|\.\./brand/README" CLAUDE.md README.md docs/design src`. Expected: nothing. Historical specs may still mention it; leave them.
- [ ] **Step 5: Commit** `docs: design system and brand live in docs/design; CLAUDE.md says 9 skills`

### Task 8: Spec and inventory record what shipped

**Files:**
- Modify: `docs/superpowers/specs/2026-10-28-ui-redesign-design.md`, `docs/superpowers/specs/ui-redesign-inventory/README.md`, `docs/superpowers/specs/ui-redesign-inventory/06-trainings-exercises-diagrams.md`, `docs/superpowers/specs/ui-redesign-inventory/05-reports-stats-awards.md`

**Interfaces:** none (docs only). Verify each "built" sentence against the code before writing it, and drop any ruling the code doesn't show.

- [ ] **Step 1: Spec.**
  - Status: "**built** (increments 1–6)".
  - The "Superseded" bullet: the old design-system spec was retired at increment 6 (deleted, in git history), and CLAUDE.md points to `docs/design/`.
  - §3 i18n becomes: "**i18n.** The UI ships English and Italian catalogs (`src/i18n/en`, `src/i18n/it`); every new UI string goes in both. French, German and Spanish exist only for the legal texts. Italian must not break layouts, so design for 30% longer labels."
  - B2, the fixed-behaviour cell: replace "The pending save is flushed on leave and on `pagehide`." with "Each save is queued as its own commit, so saves may overlap (this replaces 'one save at a time'). The pending save is flushed on leave, when the page is hidden (`visibilitychange`) and on `beforeunload`. The `pagehide` flush is best effort, because Firestore's own `pagehide` handler runs first."
- [ ] **Step 2: Inventory README.**
  - Under "Agreed changes to behaviour", add "### In full (copied from the design doc at increment 6)". Copy spec §4.2 (the B1–B13 table), §4.3, §4.4, §4.5 and §4.6 verbatim, plus §5's "Theme System option" bullet, with links rebased to `../`.
  - Add "### Rulings made while building (user-approved, 2026-10-29)", one line each:
    - player card: one Edit picker (Skills, Development plan, Contact & registration, Guardians) replaces the per-section Edit buttons; Delete player only in "⋯"; neutral "Waiting to sync" dot; a rejected offline write shows one page alert;
    - Today: no navy band, greeting or club line; "Plan a training" only with trainings access;
    - roster on phones: no Starting checkbox (row menu, long-press, right swipe and a "Starting" chip; desktop keeps the checkbox);
    - team header: season · age group, with no Average/Record figures;
    - exercises: delete is an undo when the exercise is unused, and a confirm naming the usage count when it is used in trainings (write the failed-count path as the code does it);
    - diagram editor: no Save button (status instead); an AI-prefilled builder starts dirty;
    - Stats: "Season awards →" link; "Export" menu (Print/PDF + two CSVs); print forces light tokens;
    - club area: role changes are written at once with Undo (demote self, make owner and remove keep their confirms); guide Save sits in the toolbar;
    - legal review: each of the 13 specific-approval clauses has its own checkbox, Approve stays disabled until all are ticked, ticks reset on a language or version change and are never stored; AI settings at `/settings?view=ai`;
    - shared outputs: Night is the default palette for coaches with nothing stored, and canvas text is no longer uppercased;
    - scouting: one row of six grades on phones; substitution stays on long-press, not in the dock.
  - "Facts": "CLAUDE.md's '8 skills' is out of date" becomes "(CLAUDE.md corrected at increment 6)".
- [ ] **Step 3: Superseded invariants.** Append one "**Superseded:** …" sentence to each of these, keeping the original text for history:
  - 06 invariant 8: trainings delete with undo (§6.2); exercises as in the README ruling.
  - 06 invariant 28: history survives autosave (B3).
  - 06 invariant 29: autosave, no manual Save, queued overlapping commits, `beforeunload` only while a save fails (B2).
  - 06 invariant 31: leaving never asks, except "Leave and lose the last changes?" while a save is failing (B2).
  - 05 invariant 31: canvas header and kicker in sentence case (§4.3, §9).
- [ ] **Step 4:** Run `grep -n "All five languages\|flushed on leave and on \`pagehide\`" docs/superpowers/specs/2026-10-28-ui-redesign-design.md`. Expected: nothing.
- [ ] **Step 5: Commit** `docs(spec): record the agreed changes in the inventory; fix i18n and B2 wording`

### Task 9: Gate and user checklists

**Files:** `docs/superpowers/plans/2026-10-29-ui-redesign-4g-auth-legal-settings.md` and `…-5-shared-outputs.md` are deleted (built). Nothing else is new.

- [ ] **Step 1:** Run `npm test`, `npm run lint` and `npm run build`. Expected: all green, with 0 lint errors.
- [ ] **Step 2: Rules on a temporary port.**
  - Write a temporary `firebase.rules-tmp.json` at the repo root (its paths resolve from there); it is never committed. It is `firebase.json` with `emulators.firestore.port` 8180, `emulators.firestore.websocketPort` 9160, `emulators.hub.port` 4410, `emulators.logging.port` 4510 and `emulators.ui.enabled` false.
  - Run `npx firebase emulators:exec --config firebase.rules-tmp.json --only firestore "vitest run --config vitest.rules.config.ts"`. Expected: all rules files PASS (`testEnv.ts` follows `FIRESTORE_EMULATOR_HOST`).
  - Delete the temp file. `git status` must not list it.
- [ ] **Step 3: Greps.** Each should print nothing:
  - `git diff --stat $BASE -- firestore.rules firestore.indexes.json 'src/*Api.ts' src/types`;
  - `grep -rn "volley-skills-lockup-on-navy\|2356A8\|1C4586" src index.html public --include=*.ts --include=*.tsx --include=*.html --include=*.webmanifest --include=*.svg | grep -v src/awards/palette.ts` (award palettes are data);
  - `ls docs/brand src/components/Dialog.tsx src/theme/ThemeToggle.tsx 2>/dev/null`.
- [ ] **Step 4:** Delete the two built plans and commit `docs(plans): remove the built 4g and 5 plans`, plus any lint-only fix-ups as `chore(cleanup): gate fix-ups`.
- [ ] **Step 5: User checklist** for the group report:
  - **Restart the dev server** (`tailwind.config.js` changed).
  - **Logo:** the sign-in screens, the legal page header and `/platform` show the black tile with the white Spin mark, in light and in dark (where the tile has a faint edge). The browser tab shows the new favicon in a light and a dark tab strip.
  - **Phone install:** remove and re-add the home-screen app. The icon is the black tile, and the maskable icon isn't cropped on Android.
  - **Link preview:** after deploy, paste the `/login` URL into a chat app (caches may need a day, or use a preview debugger).
  - **No visual drift:** the code block in AI settings, the health hint under free-text fields and the development plan's Edit buttons now use ink rather than blue. Scouting's correction, edit-event, set-start, sub and shortcut dialogs look and behave as before.
  - **Focus:** a team or player picker that opens an edit sheet still returns focus to the button that started it.
- [ ] **Step 6: Pre-production checklist** for the user. The user does every item; the agent never does.
  1. Emulator rehearsal of the search backfill: `node scripts/migrate/2026-10-search-tokens.mjs --club demo --emulator`, run twice; the second run writes 0.
  2. Deploy the indexes: `firebase deploy --only firestore:indexes`, and wait until the console shows them **Enabled** (searchTokens + name on exercises and trainings).
  3. Backfill dry run: `node scripts/migrate/2026-10-search-tokens.mjs --all-clubs --prod --dry-run`. It needs the encrypted service-account key's passphrase. Check the planned counts.
  4. Backfill: the same command without `--dry-run`. A second dry run plans 0 writes.
  5. If you want it, merge `main` into `feature/ui-redesign` (spec §11) and re-run `npm test`, `npm run lint`, `npm run build`.
  6. Approve and merge `feature/ui-redesign` into `main`. After that, delete this plan (`docs(plans): remove the built cleanup plan`).
  7. Deploy (`npm run build`, then the usual `firebase deploy`). Smoke-test sign-in, ⌘K search, a scouting session and a training PDF on production.
