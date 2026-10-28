# UI Redesign · Increment 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the v2 design system in place:

- tokens, type, materials and the theme System option;
- the motion module;
- every shared primitive the redesigned screens need.

The old primitives are rebuilt on the new ones, so every existing screen renders in the new look with unchanged
behaviour.

**Architecture:**

- Tokens stay CSS variables in `src/index.css`, exposed through `tailwind.config.js`. Existing token names keep
  working, so unconverted screens still render, and the old ones are deleted in increment 6.
- New primitives live in `src/components/` next to the old ones.
- `Dialog`, `ConfirmDialog`, `Menu`, `NoticeProvider`, `SectionTabs`, `Button` and `LevelPill` keep their public
  props and become thin adapters over the new primitives.
- Motion is one small in-house module, `src/motion/`. Gestures use the existing `@use-gesture/react`.

**Tech Stack:** React 18, TypeScript strict, Tailwind 3 (CSS-variable tokens), Vitest + Testing Library (jsdom),
`@use-gesture/react`, `lucide-react`.

**Spec:** these documents travel with the plan; executors read the first two:

- `docs/design/design-system/README.md`: the rules. Every value below comes from there.
- `docs/superpowers/specs/2026-10-28-ui-redesign-design.md`: the project. This plan covers §11 increment 1, and §6.2,
  §6.3 and §6.4 for the pattern behaviour.
- `docs/superpowers/specs/ui-redesign-inventory/01-shell-auth-settings.md`: the Button, Dialog, Menu, Notice and theme
  invariants.

**Branch:** `feature/ui-redesign`, already checked out. Commit after every task.

## Global Constraints

- **No product behaviour changes in this increment,** except:
  - the theme System option (spec §5);
  - Cancel/Done in sheets asking "Discard changes?" when dirty (spec §4.6);
  - SectionTabs becoming a segmented control on phones (spec §7).
- **No data changes.** No Firestore, rules, index or `*Api.ts` changes.
- **No new npm dependencies.** Gestures use `@use-gesture/react`, which is already installed.
- **Styling is tokens only.** Components never use `dark:` variants or literal hex colours. Theme values live in
  `src/index.css`.
- **Colour tokens** are `--color-<name>: R G B;` triplets in `:root` and `.dark`, so Tailwind alpha modifiers keep
  working.
- **Motion** animates only `transform` and `opacity`. Every animation has a `prefers-reduced-motion: reduce` branch.
- **Touch targets** are at least 44 px (`min-h-11`).
- **Focus:** every interactive element shows `focus-visible` with the `focus` token.
- **i18n:** every new user-visible string is added to `src/i18n/en/components.ts` and
  `src/i18n/it/components.ts`; the `Catalog` type enforces parity.
- **TypeScript:** strict, plus `noUnusedLocals` and `noUnusedParameters`.
- **Tests** sit next to the code they cover.
- **Accessibility contracts stay** (inventory 01 invariants):
  - dialog focus trap and return;
  - Escape closes only the topmost layer;
  - `ConfirmDialog` opens with Cancel focused;
  - one polite `role="status"` region for success;
  - inline errors use `role="alert"`.
- **Gates for every task:** `npm test` and `npm run lint` pass. The last task also runs `npm run build`.
- Never commit `serviceAccountKey.json*`, `*.vsbackup`, `.env.local` or `reference/`.

## Review Focus

1. **Stacked layers.** A sheet with the "Discard changes?" alert on top: Escape closes only the alert, and the sheet
   stays open with focus back inside it. Pinned in Task 5.
2. **Native undo in text fields.** Ctrl+Z / ⌘Z in an input or textarea must keep its native undo while an undo
   notice is showing. Pinned in Task 11.
3. **A pending undoable delete when the person leaves.** Navigating to another route or closing the tab commits it
   exactly once, and never twice. Pinned in Task 11.
4. **Long-press on a link row.** The click that follows a long-press must not also navigate, and moving the finger
   more than 10 px cancels the long-press. Pinned in Task 7.
5. **Long Italian labels in a segmented control.** It scrolls horizontally instead of clipping or wrapping, and the
   selected option stays in view. Pinned in Task 8.

---

## File map

| File | Responsibility |
|---|---|
| `src/index.css` | v2 tokens (light, dark), material vars, tint/glass/pressable utilities, system-setting media queries |
| `tailwind.config.js` | Exposes tokens, type roles, radii, shadows, easings |
| `src/theme/theme.ts`, `useTheme.ts` | Theme preference (`system`/`light`/`dark`) plus live system sync |
| `src/motion/spring.ts`, `gesture.ts`, `useReducedMotion.ts` | Spring integrator, momentum projection, rubber-band, reduced motion |
| `src/components/Button.tsx` | v2 button variants (adapter, same props) |
| `src/components/Sheet.tsx` | New sheet primitive (centred on desktop, bottom sheet with detents on phone) |
| `src/components/Dialog.tsx` | Adapter: renders `Sheet` |
| `src/components/ConfirmDialog.tsx` | Apple-style alert (action sheet on phone), same props |
| `src/components/MenuList.tsx` | Shared menu item list and keyboard model |
| `src/components/Menu.tsx` | Menu button on `MenuList` (same props) |
| `src/components/ContextMenu.tsx` | `useContextMenu`: right-click and long-press menus |
| `src/components/SegmentedControl.tsx` | New segmented control (radio or tabs semantics) |
| `src/components/SectionTabs.tsx` | Adapter: renders `SegmentedControl` with tabs semantics |
| `src/components/GroupedList.tsx` | `GroupedList` and `ListRow` |
| `src/components/SwipeRow.tsx` | Phone swipe actions |
| `src/components/Notice.tsx` | `useNotify` (unchanged API) plus new `useUndoable` |
| `src/components/Toolbar.tsx` | Toolbar with scroll-edge glass and the main-action slot |
| `src/components/LevelPill.tsx`, `StatTile.tsx`, `Skeleton.tsx`, `Input.tsx`, `StatusChip.tsx` | Restyled to v2, same props |
| `src/dev/UiGallery.tsx` | Dev-only `/dev/ui` page showing every primitive, for the user's visual check |

---

### Task 1: v2 tokens, type, materials

**Files:**
- Modify: `src/index.css`
- Modify: `tailwind.config.js`
- Modify: `src/theme/contrast.test.ts`
- Create: `src/theme/systemSettings.test.ts`

**Interfaces:**
- **Produces (Tailwind classes):**
  - `bg-bg`, `bg-surface`, `bg-surface-2`, `bg-surface-3`, `bg-sidebar`, `bg-ink`;
  - `text-ink`, `text-ink-2`, `text-ink-3`, `text-on-ink`;
  - `border-separator`, `ring-focus`;
  - the colour fills `red`, `orange`, `blue`, `green` (DEFAULT is the fill) and their text forms `*-strong`;
  - type roles `text-large-title`, `text-title-1`, `text-title-2`, `text-title-3`, `text-headline`, `text-body`,
    `text-callout`, `text-footnote`, `text-caption`, `text-stat`, `text-score`, `text-display`;
  - radii `rounded-sm` (8), `rounded-md` (12), `rounded-lg` (16), `rounded-xl` (22);
  - shadows `shadow-card`, `shadow-pop`, `shadow-sheet`;
  - easings `ease-out-strong`, `ease-drawer`.
- **Produces (CSS utilities):**
  - `.glass`;
  - `.bg-red-tint`, `.bg-orange-tint`, `.bg-blue-tint`, `.bg-green-tint` (the fill at `--tint-alpha`, which is .14
    light and .22 dark);
  - `.pressable` (scale .97 on `:active`, 100 ms; off under reduced motion).
- **Produces (CSS vars):** `--glass`, `--glass-edge`, `--scrim`, `--tint-alpha`, `--ease-out`, `--ease-drawer`.
- **Kept as aliases until increment 6:** `navy` (unchanged), `slate` (= `ink-2` values), `border` (= `separator`
  values).

- [ ] **Step 1: Update `contrast.test.ts` for the v2 pairs (failing first)**

The pairs the test must assert, in both themes, at ≥ 4.5:

- `ink-2` on `surface` and on `bg`;
- `on-ink` on `ink`;
- each of `red-strong`, `orange-strong`, `blue-strong` and `green-strong` on `surface`;
- each level pill: `levelPillClass(level)` text token on its tint, with the tint computed as the fill at alpha .14
  (light) or .22 (dark) over `surface`.

Add a token-presence test: `surface-2`, `surface-3`, `ink-3`, `on-ink`, `separator`, `focus` and `sidebar` exist in
both blocks, with the exact light and dark values from design system §2.1. For example, `token('light','bg')` equals
`[245,245,247]` and `token('dark','bg')` equals `[0,0,0]`.

- [ ] **Step 2: Write `systemSettings.test.ts`**

It reads `src/index.css` from disk, like `contrast.test.ts`, and asserts the stylesheet contains:

- `@media (prefers-reduced-transparency: reduce)`, with a rule that sets `--glass` to the surface colour and
  `backdrop-filter: none` for `.glass`;
- `@media (prefers-contrast: more)`, overriding `--color-separator` to `198 198 200` (light) and `56 56 58` (dark);
- `@media (prefers-reduced-motion: reduce)`, containing `.pressable:active` with `transform: none`.

- [ ] **Step 3: Run both tests and confirm they fail**

Run: `npx vitest run src/theme/contrast.test.ts src/theme/systemSettings.test.ts`
Expected: FAIL (missing tokens or values).

- [ ] **Step 4: Rewrite the token blocks in `src/index.css`**

- Take the values from design system §2.1 (chrome) and §2.2 (data: DEFAULT = fill, `-strong` = text).
- `border` and `separator` are opaque: light `222 222 224`, dark `55 55 58`.
- Add the three media queries from Step 2, the utilities listed under Produces, and point the `:focus-visible`
  outline at `--color-focus`.
- **If a contrast pair fails:** adjust that text hue one step darker (light) or lighter (dark). Never change which
  colour means what.

- [ ] **Step 5: Extend `tailwind.config.js`**

- `surface` and `ink` become objects (`DEFAULT`, `2`, `3`), and `on-ink`, `separator`, `focus` and `sidebar` are
  added.
- The type roles use the sizes, line heights and tracking from design system §3, in `rem`.
- Radii: `sm` 8 px, `md` 12, `lg` 16, `xl` 22.
- Shadows:
  - `card`: `0 1px 2px rgba(0,0,0,.04)`;
  - `pop`: `0 8px 32px rgba(0,0,0,.12)`;
  - `sheet`: `0 -8px 40px rgba(0,0,0,.18)`.
- `transitionTimingFunction` gets `out-strong: var(--ease-out)` and `drawer: var(--ease-drawer)`.

- [ ] **Step 6: Run the tests until they pass, then run the full suite**

Run: `npx vitest run src/theme && npm test`
Expected: PASS. If other tests assert old class names that no longer exist, they don't exist yet; nothing is removed
in this task.

- [ ] **Step 7: Commit**

```bash
git add src/index.css tailwind.config.js src/theme/contrast.test.ts src/theme/systemSettings.test.ts
git commit -m "feat(design): v2 tokens, type roles, materials and system-setting media queries"
```

---

### Task 2: Theme System option

**Files:**
- Modify: `src/theme/theme.ts`, `src/theme/useTheme.ts`, `src/main.tsx`
- Test: `src/theme/theme.test.ts`

**Interfaces:**
- **Produces:**
  - `type ThemePreference = 'system' | 'light' | 'dark'`;
  - `getThemePreference(): ThemePreference`: the stored `light` or `dark`, otherwise `'system'`, including when
    storage is corrupt or unavailable;
  - `resolveTheme(pref: ThemePreference): Theme`;
  - `setThemePreference(pref: ThemePreference): void`. `'system'` removes the `theme` key and applies the resolved
    theme without persisting; `light` or `dark` calls `applyTheme`;
  - `startSystemThemeSync(): () => void`. While the preference is `'system'`, a `prefers-color-scheme` change toggles
    `.dark` and fires `THEME_CHANGED_EVENT`. It returns an unsubscribe function;
  - `useThemePreference(): [ThemePreference, (p: ThemePreference) => void]`.
- **Unchanged:** `Theme`, `getInitialTheme`, `applyTheme`, `useTheme`, `THEME_CHANGED_EVENT`, the `theme` key,
  `public/theme-init.js` (it already treats a missing key as "follow the system").

- [ ] **Step 1: Add the failing tests to `theme.test.ts`**

- `getThemePreference()` returns `'system'` when nothing is stored, and `'dark'` when `'dark'` is stored.
- `setThemePreference('system')` removes `localStorage.theme`, and the `.dark` class follows the mocked
  `matchMedia('(prefers-color-scheme: dark)').matches`.
- After `startSystemThemeSync()` with the preference at `'system'`, firing the mocked media-query `change` with
  `matches: true` adds `.dark`.
- With the preference at `'light'`, that same change leaves `.dark` off.

- [ ] **Step 2: Run and confirm they fail**

Run: `npx vitest run src/theme/theme.test.ts`
Expected: FAIL (`getThemePreference` is not exported).

- [ ] **Step 3: Implement the interfaces above**

Call `startSystemThemeSync()` once in `src/main.tsx` before render.

- [ ] **Step 4: Run the theme tests and the full suite**

Run: `npx vitest run src/theme && npm test`
Expected: PASS. The existing ThemeToggle tests still pass, because the toggle persists an explicit choice.

- [ ] **Step 5: Commit**

```bash
git add src/theme src/main.tsx
git commit -m "feat(theme): System preference that follows the OS live"
```

---

### Task 3: Motion module

**Files:**
- Create: `src/motion/spring.ts`, `src/motion/gesture.ts`, `src/motion/useReducedMotion.ts`
- Test: `src/motion/spring.test.ts`, `src/motion/gesture.test.ts`

**Interfaces:**
- **Produces from `spring.ts`:**
  - `interface SpringParams { response: number; damping: number }`;
  - `SPRING_DEFAULT = { response: 0.35, damping: 1 }`, `SPRING_FLICK = { response: 0.35, damping: 0.85 }`,
    `SPRING_SNAPPY = { response: 0.3, damping: 1 }`;
  - `springStep(x: number, v: number, target: number, p: SpringParams, dt: number): [number, number]`. It is
    semi-implicit Euler with `k = (2π / response)²` and `c = 4π · damping / response` (unit mass);
  - `animateSpring(o: { from: number; to: number; velocity?: number; params?: SpringParams; onUpdate: (x: number) => void; onComplete?: () => void }): { stop: () => number }`.
    It is driven by `requestAnimationFrame` and settles when `|x − to| < 0.5` and `|v| < 5`, snapping to `to` and
    calling `onComplete`. `stop()` cancels and returns the current value, so an interruption can start from it;
- **Produces from `gesture.ts`:**
  - `project(velocity: number, decelerationRate = 0.998): number`, which is `(velocity / 1000) * rate / (1 − rate)`;
  - `rubberband(overshoot: number, dimension: number, constant = 0.55): number`;
  - `nearest(points: number[], x: number): number`.
- **Produces from `useReducedMotion.ts`:** `prefersReducedMotion(): boolean` and `useReducedMotion(): boolean`, which
  stays live through `matchMedia` change and is `false` when `matchMedia` is missing.

- [ ] **Step 1: Write the failing tests**

In `spring.test.ts`:

- `springStep` iterated at `dt = 1/60` for 90 steps from 0 to 100 with `SPRING_DEFAULT` ends within 0.5 of 100 and
  never exceeds 100.001, so there is no overshoot at damping 1.
- With `SPRING_FLICK`, the maximum x is above 100: there is overshoot.
- With an initial velocity of −2000 towards 0, starting at 0 with target 100, x first goes negative. Velocity is
  carried.
- `animateSpring` with `vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance'] })`:
  - `onComplete` fires and the last `onUpdate` value is exactly `to`;
  - `stop()` partway through returns a value strictly between `from` and `to`.

In `gesture.test.ts`:

- `project(1000)` is 499 to 6 digits, and `project(0)` is 0.
- `rubberband(0, 300)` is 0. `rubberband` is increasing in `overshoot` and always less than `overshoot` for
  `overshoot > 0`.
- `nearest([0, 300, 600], 420)` is 300.

- [ ] **Step 2: Run and confirm they fail**

Run: `npx vitest run src/motion`
Expected: FAIL (the modules don't exist).

- [ ] **Step 3: Implement the three files to the interfaces above**

- [ ] **Step 4: Run and confirm they pass**

Run: `npx vitest run src/motion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/motion
git commit -m "feat(motion): interruptible spring, momentum projection, rubber-band, reduced motion"
```

---

### Task 4: Button v2

**Files:**
- Modify: `src/components/Button.tsx`
- Test: `src/components/Button.test.tsx`

**Interfaces:**
- **Unchanged props:** `variant: 'primary' | 'secondary' | 'ghost' | 'dangerGhost' | 'destructive'`, `size`,
  `forwardRef`, defaults to `type="button"`.
- **Adds:** `size: 'pill'`, which is `min-h-9 rounded-full px-4 text-callout font-semibold` and is used later for the
  toolbar main action.
- **Produces the v2 variant classes:**

  | Variant | Classes |
  |---|---|
  | `primary` | `bg-ink text-on-ink hover:bg-ink/90` |
  | `secondary` | `bg-surface-2 text-ink hover:bg-surface-3` |
  | `ghost` | `text-ink hover:bg-surface-2` |
  | `dangerGhost` | `text-red-strong hover:bg-red-tint` |
  | `destructive` | `font-semibold text-red-strong hover:bg-red-tint` (red text, per design system §8) |

- **Base classes:** `rounded-md font-semibold tracking-[-0.01em] pressable transition-[transform,background-color]
  duration-150 focus-visible:ring-2 focus-visible:ring-focus`.

- [ ] **Step 1: Update the tests (failing first)**

- The dangerGhost test now expects `text-red-strong`.
- The focus test expects `focus-visible:ring-focus`.
- New tests:
  - "primary is an ink fill with on-ink text" (`bg-ink`, `text-on-ink`);
  - "every button gets press feedback" (`pressable`);
  - "pill size is a rounded-full compact button".

- [ ] **Step 2: Run and confirm the tests fail**

Run: `npx vitest run src/components/Button.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the class maps**

- [ ] **Step 4: Run the Button tests and the full suite**

Run: `npx vitest run src/components/Button.test.tsx && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Button.tsx src/components/Button.test.tsx
git commit -m "feat(ui): v2 buttons — ink primary, tinted secondary, press feedback"
```

---

### Task 5: Sheet, and Dialog as its adapter

**Files:**
- Create: `src/components/Sheet.tsx`
- Modify: `src/components/Dialog.tsx` (adapter), `src/i18n/en/components.ts`, `src/i18n/it/components.ts`
- Test: `src/components/Sheet.test.tsx`; `src/components/Dialog.test.tsx` must keep passing unchanged

**Interfaces:**
- **Consumes:**
  - `useModalLayer` (unchanged);
  - `ConfirmDialog` (Task 6 restyles it, with the same props);
  - `useMediaQuery('(max-width: 767px)', false)`;
  - `animateSpring`, `SPRING_DEFAULT`, `SPRING_FLICK` and `project` (Task 3);
  - `useReducedMotion` (Task 3);
  - `useDrag` from `@use-gesture/react`.
- **Produces:**

  ```ts
  interface SheetProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
    size?: 'md' | 'lg';                 // desktop max width 560 / 720 px
    footer?: ReactNode;                 // pinned bottom bar (adapter path; desktop and phone)
    confirm?: { label: string; onConfirm?: () => void; form?: string; disabled?: boolean };
    dirty?: boolean;
    guardUnsaved?: boolean;             // same meaning as Dialog's
    detent?: 'content' | 'large';       // phone starting detent, default 'content'
  }
  export function Sheet(props: SheetProps): JSX.Element;
  export function useSheetClose(): () => void;   // the guarded close, for Cancel buttons inside a sheet
  export function decideRelease(i: { offset: number; velocity: number; height: number; dirty: boolean }): 'close' | 'guard' | 'snap';
  ```

  - `decideRelease` decides close when `velocity > 0.5` (px/ms, downward) or `offset > 0.3 * height`. A close on a
    dirty sheet becomes `'guard'`. Anything else is `'snap'`.
  - `Dialog` keeps its exact `DialogProps` and renders
    `<Sheet … detent={mobileSheet ? 'large' : 'content'}>`.
  - New i18n keys: `components.done` ('Done' / 'Fine') and `components.cancel` ('Cancel' / 'Annulla').

**Layout:**

- **Desktop:**
  - a scrim (`data-testid="dialog-backdrop"`, click asks close);
  - a centred panel `role="dialog"`, `aria-modal="true"`, `aria-label={title}`, `rounded-xl bg-surface shadow-pop`;
  - a header with the title and a ✕ button (`aria-label` = `components.close`);
  - a scrolling body;
  - a footer bar, where `footer` renders, or Cancel plus a primary `confirm` when `confirm` is given;
  - entry: opacity 0→1 and scale .96→1 over 200 ms `ease-out-strong`; reduced motion uses opacity only.
- **Phone:**
  - a bottom sheet with a grabber and the header `Cancel · title · confirm`. Without `confirm`, the trailing button
    is `Done`. Both call the guarded close; confirm calls `onConfirm` or submits `form`.
  - The ✕ button is not shown. A visually hidden button with `aria-label` = `components.close` keeps the accessible
    contract.
  - Drag is bound to the grabber and header only, never the scrolling body **(call: simpler than scroll handoff,
    same safety)**.
  - On drag release: `project()` picks the detent for `content`/`large`, and `decideRelease` picks close, guard or
    snap.
  - Movement uses `animateSpring` on `transform: translateY`. Reduced motion snaps without a spring.
- Every close path goes through one guarded `requestClose`: ✕, scrim, Escape, Cancel, Done, flick and
  `useSheetClose()`. When the sheet is dirty, it opens the existing discard `ConfirmDialog`.

- [ ] **Step 1: Write the failing `Sheet.test.tsx`**

`decideRelease` cases:

| Input | Expected |
|---|---|
| `{offset: 10, velocity: 0.8, height: 500, dirty: false}` | `'close'` |
| `{offset: 200, velocity: 0, height: 500, dirty: false}` | `'close'` |
| `{offset: 200, velocity: 0, height: 500, dirty: true}` | `'guard'` |
| `{offset: 50, velocity: 0.1, height: 500, dirty: false}` | `'snap'` |

Component tests:

- "Cancel inside a dirty sheet asks Discard changes? and keeps the sheet open". A child button calls
  `useSheetClose()`; with `dirty`, clicking it shows an alertdialog named "Discard changes?" and `onClose` is not
  called.
- "a clean sheet closes on Cancel" (`onClose` called once).
- "Escape with the discard alert open closes only the alert" (Review Focus 1). After the second Escape the sheet is
  still in the document and `onClose` was not called.
- "confirm in the header submits its form". On phone (mock `matchMedia` so `(max-width: 767px)` matches), the
  `confirm={{label:'Save', form:'f'}}` button has `type="submit"` and `form="f"`.
- "phone layout shows Cancel and Done instead of ✕, keeping an accessible Close".

- [ ] **Step 2: Run and confirm they fail**

Run: `npx vitest run src/components/Sheet.test.tsx`
Expected: FAIL (no module).

- [ ] **Step 3: Implement `Sheet.tsx` and turn `Dialog.tsx` into the adapter**

Add the two i18n keys in both languages.

- [ ] **Step 4: Run the Sheet and Dialog tests, then the full suite**

Run: `npx vitest run src/components/Sheet.test.tsx src/components/Dialog.test.tsx && npm test`
Expected: PASS. Page tests that find dialogs by role and name keep passing. If one relied on old markup, such as a
class name, update the selector only, never an assertion about behaviour.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sheet.tsx src/components/Sheet.test.tsx src/components/Dialog.tsx src/i18n/en/components.ts src/i18n/it/components.ts
git commit -m "feat(ui): Sheet with phone detents and guarded close; Dialog renders it"
```

---

### Task 6: Alert (ConfirmDialog v2)

**Files:**
- Modify: `src/components/ConfirmDialog.tsx`
- Create: `src/components/ConfirmDialog.test.tsx`

**Interfaces:**
- **Unchanged props:** `title`, `message`, `confirmLabel`, `onConfirm`, `onCancel`, `error`.
- **Adds:** `tone?: 'destructive' | 'default'`. The default is `'destructive'`, because every current caller is one.
- **Desktop layout:** a centred `max-w-sm rounded-xl bg-surface shadow-pop` panel, with the title (`text-headline`,
  centred) and the message (`text-footnote text-ink-2`, centred).
  - Two equal buttons side by side: Cancel in semibold `text-ink`, and confirm in `text-red-strong` for destructive or
    `text-ink` for default.
  - The scrim uses `--scrim`, and the backdrop stays inert (inventory 01 Q6, parity).
- **Phone layout:** an action sheet pinned to the bottom (`data-layout="sheet"`): the title and message group with the
  confirm row, then a separate rounded Cancel button.
- **Kept:** `role="alertdialog"`, `aria-modal`, `aria-label={title}`, Cancel focused on mount, `useModalLayer`, and
  the error as `role="alert"`.

- [ ] **Step 1: Write the failing tests**

- "is an alertdialog named by its title with Cancel focused".
- "confirm calls onConfirm, Cancel and Escape call onCancel".
- "the destructive confirm uses the red text token" (`text-red-strong`).
- "shows the error as an alert".
- "on a phone it renders as an action sheet" (`matchMedia` mocked, `data-layout="sheet"`).

- [ ] **Step 2: Run and confirm they fail**

Run: `npx vitest run src/components/ConfirmDialog.test.tsx`
Expected: FAIL on the layout and tone tests.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests and the full suite**

Run: `npx vitest run src/components/ConfirmDialog.test.tsx && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ConfirmDialog.tsx src/components/ConfirmDialog.test.tsx
git commit -m "feat(ui): Apple-style alert and phone action sheet for confirmations"
```

---

### Task 7: Menu v2 and context menus

**Files:**
- Create: `src/components/MenuList.tsx`, `src/components/ContextMenu.tsx`
- Modify: `src/components/Menu.tsx`
- Test: `src/components/Menu.test.tsx` (unchanged, must pass), `src/components/ContextMenu.test.tsx`

**Interfaces:**
- **Produces:**

  ```ts
  // MenuList.tsx: the items and keyboard model taken out of Menu.tsx unchanged (arrows, Home/End, Escape, Tab)
  export function MenuList(p: { id: string; label: string; items: MenuItem[]; onClose: (refocus: boolean) => void; className?: string; style?: CSSProperties }): JSX.Element;
  // ContextMenu.tsx
  export function useContextMenu(o: { label: string; items: MenuItem[] | (() => MenuItem[]); disabled?: boolean }): {
    targetProps: Pick<HTMLAttributes<HTMLElement>, 'onContextMenu' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onClickCapture'>;
    menu: ReactNode;   // render once, anywhere; portals to document.body
  };
  export const LONG_PRESS_MS = 500;
  ```

- **`MenuItem` is unchanged** (exported from `Menu.tsx`).
- **Menu look:** `.glass`, `rounded-[14px]`, `shadow-pop`, 44 px rows, danger items `text-red-strong`, check icon in
  `text-ink`.
  - It enters from the trigger: `transform-origin` is top-right or top-left, flipped to the bottom for
    `placement="up"`.
  - Motion: scale .96→1 plus opacity over 160 ms, and out over 120 ms. Reduced motion uses opacity only.
- **Context menu behaviour:**
  - Right-click calls `preventDefault` and opens at the pointer, clamped to the viewport with 8 px of margin.
  - Touch or pen held for `LONG_PRESS_MS` without moving more than 10 px opens it at the press point. Moving further,
    or lifting early, cancels.
  - While a press is held, the target gets `user-select: none; -webkit-touch-callout: none`.
  - The click that ends a long-press that opened a menu is swallowed (`onClickCapture` stops it).
  - Escape or an outside pointer-down closes it. Focus goes to the first item and returns to the target on close.

- [ ] **Step 1: Write the failing `ContextMenu.test.tsx`**

The harness is a `<a href="/x">` row spread with `targetProps`, and `menu` rendered.

- "right-click opens a labelled menu at the pointer and runs an item".
- "a touch long-press of 500 ms opens the menu" (fake timers; `pointerDown` with `pointerType: 'touch'`, advance
  500).
- "moving more than 10 px cancels the long-press" (`pointerMove` 12 px, then advance 500: no menu).
- "the click after a long-press does not activate the row" (Review Focus 4). A click spy on the anchor's parent sees
  `defaultPrevented` or no click.
- "Escape closes and returns focus to the row".

- [ ] **Step 2: Run and confirm they fail**

Run: `npx vitest run src/components/ContextMenu.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Extract `MenuList` from `Menu.tsx`, restyle, implement `useContextMenu`**

- [ ] **Step 4: Run the menu tests and the full suite**

Run: `npx vitest run src/components/Menu.test.tsx src/components/ContextMenu.test.tsx && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MenuList.tsx src/components/Menu.tsx src/components/ContextMenu.tsx src/components/ContextMenu.test.tsx
git commit -m "feat(ui): glass menus from their trigger; right-click and long-press context menus"
```

---

### Task 8: SegmentedControl, and SectionTabs as its adapter

**Files:**
- Create: `src/components/SegmentedControl.tsx`, `src/components/SegmentedControl.test.tsx`
- Modify: `src/components/SectionTabs.tsx`, `src/components/SectionTabs.test.tsx`

**Interfaces:**
- **Produces:**

  ```ts
  export function SegmentedControl<T extends string>(p: {
    label: string;
    options: readonly { id: T; label: string }[];
    value: T;
    onChange: (id: T) => void;
    semantics?: 'radio' | 'tabs';   // default 'radio'
    className?: string;
  }): JSX.Element;
  ```

- **Semantics:**
  - `radio` renders `role="radiogroup"` with `role="radio"` and `aria-checked`.
  - `tabs` renders `role="tablist"` with `role="tab"` and `aria-selected`.
  - In both, the selected option has `tabIndex` 0 and the others −1. Arrow keys and Home/End move and select.
- **Look:**
  - a `bg-surface-2 rounded-[10px] p-0.5` track;
  - one absolutely positioned thumb (`bg-[rgb(var(--color-segment-thumb))] shadow-card`). Add the
    `--color-segment-thumb` token to the `src/index.css` blocks: `255 255 255` in light and `99 99 102` in dark;
  - the thumb moves with `transform` over 300 ms `ease-drawer`, instantly under reduced motion.
- **Overflow:** the track is `overflow-x-auto` with `whitespace-nowrap` and no scrollbar. On change, the selected
  option calls `scrollIntoView?.({ inline: 'nearest', block: 'nearest' })` (guarded for jsdom).
- **SectionTabs** keeps its props (`label`, `tabs`, `active`, `onChange`, `className`) and renders
  `<SegmentedControl semantics="tabs" …>` at every width. The phone `<select>` is removed (spec §7: segmented
  replaces tab rows).

- [ ] **Step 1: Write the failing tests**

`SegmentedControl.test.tsx`:

- "radio semantics: one checked radio, click selects".
- "tabs semantics: tablist with the selected tab".
- "ArrowRight moves selection and focus; End selects the last".
- "long labels never wrap: the track keeps nowrap and horizontal scrolling" (Review Focus 5). Assert the
  `whitespace-nowrap` and `overflow-x-auto` classes, and that `scrollIntoView` is called on the newly selected
  option.

`SectionTabs.test.tsx`: the existing test becomes "offers the sections as tabs that switch sections". Same sections,
same order and the same `onChange` calls; the assertions about the phone picker are dropped.

- [ ] **Step 2: Run and confirm they fail**

Run: `npx vitest run src/components/SegmentedControl.test.tsx src/components/SectionTabs.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement both**

- [ ] **Step 4: Run the tests and the full suite**

Run: `npx vitest run src/components && npm test`
Expected: PASS. Page tests that picked a section through the phone `<select>` (`combobox`) switch to
`getByRole('tab', { name })`: a selector change only.

- [ ] **Step 5: Commit**

```bash
git add src/components/SegmentedControl.tsx src/components/SegmentedControl.test.tsx src/components/SectionTabs.tsx src/components/SectionTabs.test.tsx src/index.css
git commit -m "feat(ui): segmented control; section tabs use it at every width"
```

---

### Task 9: Grouped lists and the display primitives

**Files:**
- Create: `src/components/GroupedList.tsx`, `src/components/GroupedList.test.tsx`
- Modify: `src/components/LevelPill.tsx`, `StatTile.tsx`, `Skeleton.tsx`, `Input.tsx` (`FIELD_CLASS`),
  `StatusChip.tsx`

**Interfaces:**
- **Produces:**

  ```ts
  export function GroupedList(p: { header?: string; footer?: ReactNode; children: ReactNode; className?: string }): JSX.Element;
  export function ListRow(p: {
    title: ReactNode; subtitle?: ReactNode; leading?: ReactNode; trailing?: ReactNode;
    to?: string;              // renders a react-router <Link> and a chevron
    onClick?: () => void;     // renders a <button>, no chevron
    rowProps?: HTMLAttributes<HTMLElement>;   // e.g. useContextMenu().targetProps
  }): JSX.Element;
  ```

- **`GroupedList`:**
  - an optional header `<h3 className="text-caption text-ink-2 px-4 pb-2">` in sentence case;
  - a `<ul className="rounded-lg bg-surface shadow-card overflow-hidden">`;
  - an optional footer as `text-footnote text-ink-2`.
- **`ListRow`:**
  - `<li>` with `min-h-[52px]`, `px-4` and `gap-3`;
  - a hairline separator inset to the text (`::before` from `left: 56px` when there is a leading element, otherwise
    `16px`), not on the first row;
  - the pressed state is `active:bg-surface-3`, with no scale;
  - the title is `text-headline`, truncated; the subtitle is `text-footnote text-ink-2`.
- **`LevelPill`:** `levelPillClass` returns `bg-<colour>-tint text-<colour>-strong`. With no level it returns
  `bg-surface-2 text-ink-2`, and the layout is `rounded-full px-2 py-0.5 text-caption tabular-nums`.
- **`StatTile`:** `rounded-lg bg-surface shadow-card p-4`. The label is `text-caption text-ink-2` and the value is
  `text-stat tabular-nums`.
- **`Skeleton`:** a `bg-surface-2` block with an opacity pulse every 1.6 s, static under reduced motion.
- **`FIELD_CLASS`:** `rounded-[12px] bg-surface-2 border border-transparent px-3.5 py-3 text-body`. It is 16 px on
  touch through `text-base sm:text-body`, with `focus:border-focus focus:ring-2 focus:ring-focus/20`.
  `formFieldSize.test.ts` must still pass.
- **`StatusChip`:** the tint plus the text token per status, and `rounded-full text-caption`.

- [ ] **Step 1: Write the failing `GroupedList.test.tsx`**

- "a row with `to` is a link with a chevron" (wrapped in `MemoryRouter`).
- "a row with `onClick` is a button without a chevron".
- "a plain row has no interactive role".
- "the header renders as a heading in sentence case".

`contrast.test.ts` already pins the pill colours (Task 1).

- [ ] **Step 2: Run and confirm they fail**

Run: `npx vitest run src/components/GroupedList.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `GroupedList` and restyle the five primitives**

- [ ] **Step 4: Run the tests and the full suite**

Run: `npx vitest run src/components src/theme && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GroupedList.tsx src/components/GroupedList.test.tsx src/components/LevelPill.tsx src/components/StatTile.tsx src/components/Skeleton.tsx src/components/Input.tsx src/components/StatusChip.tsx
git commit -m "feat(ui): grouped lists and rows; v2 pills, tiles, fields and skeletons"
```

---

### Task 10: Swipe rows

**Files:**
- Create: `src/components/SwipeRow.tsx`, `src/components/SwipeRow.test.tsx`

**Interfaces:**
- **Consumes:** `useDrag` (`@use-gesture/react`), `animateSpring` and `SPRING_DEFAULT` (Task 3), `useReducedMotion`,
  `useMediaQuery('(pointer: coarse)', false)`.
- **Produces:**

  ```ts
  export interface SwipeAction { label: string; icon?: ReactNode; tone: 'destructive' | 'neutral'; undoable: boolean; onAction: () => void }
  export function SwipeRow(p: { children: ReactNode; trailing?: SwipeAction[]; leading?: SwipeAction; disabled?: boolean }): JSX.Element;
  export function swipeRelease(i: { offset: number; velocity: number; width: number; actionsWidth: number; fullSwipe: boolean }): 'commit' | 'open' | 'closed';
  ```

  - `swipeRelease` returns `'commit'` when `fullSwipe` and `|offset| > 0.5 * width`.
  - It returns `'open'` when `|offset| > actionsWidth / 2`, or when `|velocity| > 0.3` (px/ms) in the opening
    direction.
  - Otherwise it returns `'closed'`.
  - `fullSwipe` is true only when the first trailing action (or the leading action) is `undoable`. A "…" action opens
    its confirmation instead, so it never full-swipe commits.
- **Behaviour:**
  - Swipe is enabled only on coarse pointers, when not `disabled`.
  - The content follows the finger 1:1 after 10 px of horizontal movement. Vertical movement past 10 px first leaves
    the gesture to the page scroll.
  - Action buttons are 76 px each: `bg-red` with white text for destructive, `bg-surface-3 text-ink` for neutral.
  - The action buttons are real `<button>`s. They are `tabIndex=-1` and `aria-hidden` while closed, because keyboard
    and screen-reader users reach the same actions through the row's "⋯" menu (spec §6.4).

- [ ] **Step 1: Write the failing tests**

- A `swipeRelease` table:

  | Input | Expected |
  |---|---|
  | `{offset: -200, velocity: 0, width: 360, actionsWidth: 76, fullSwipe: true}` | `'commit'` |
  | `{offset: -200, velocity: 0, width: 360, actionsWidth: 76, fullSwipe: false}` | `'open'` |
  | `{offset: -20, velocity: -0.5, width: 360, actionsWidth: 76, fullSwipe: false}` | `'open'` |
  | `{offset: -20, velocity: 0, width: 360, actionsWidth: 76, fullSwipe: true}` | `'closed'` |

- "renders trailing actions as hidden buttons until opened". They are `aria-hidden`; clicking one after a forced
  open state calls `onAction`. Expose a `data-state` attribute on the row for the test to read.
- "does nothing on fine pointers" (no drag binding; the content has no transform).

- [ ] **Step 2: Run and confirm they fail**

Run: `npx vitest run src/components/SwipeRow.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/SwipeRow.test.tsx && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SwipeRow.tsx src/components/SwipeRow.test.tsx
git commit -m "feat(ui): phone swipe actions with full-swipe only for undoable actions"
```

---

### Task 11: Undo notices

**Files:**
- Modify: `src/components/Notice.tsx`, `src/i18n/en/components.ts`, `src/i18n/it/components.ts`
- Test: `src/components/Notice.test.tsx` (existing tests unchanged), `src/components/Undoable.test.tsx`

**Interfaces:**
- **Unchanged:** `useNotify(): (message, opts?) => void`, `NoticeProvider`, the always-mounted `role="status"`
  region.
- **Produces:**

  ```ts
  export interface UndoableOptions {
    message: string;
    commit: () => void | Promise<void>;   // the real write, run once
    onUndo?: () => void;                  // restore UI state
    onCommitError?: (error: unknown) => void;
  }
  export function useUndoable(): (o: UndoableOptions) => void;
  export const UNDO_MS = 6000;
  ```

- New i18n key: `components.undo` ('Undo' / 'Annulla').
- **Rules** (spec §6.2):
  1. Showing an undoable starts a `UNDO_MS` timer, and expiry runs `commit`.
  2. Pointer-over or focus-within the notice pauses the timer, and leaving restarts it at `UNDO_MS`.
  3. **Undo** cancels the timer, never runs `commit`, calls `onUndo` and hides the notice.
  4. A second undoable while one is pending commits the first immediately, then shows the second.
  5. A route change commits the pending one.
     - Detect it with a child `<RouteCommit/>` that reads `useLocation().pathname`.
     - Render that child only when `useInRouterContext()` is true, so the existing tests without a router keep
       working.
  6. `pagehide` on `window` commits the pending one.
  7. Unmounting the provider commits the pending one.
  8. `commit` runs **at most once** per undoable, across all of rules 1 and 4–7.
  9. A rejected or thrown commit calls `onCommitError`.
  10. Ctrl+Z / ⌘Z on `window` triggers Undo while the notice is showing, unless any of these holds:
      - the event target is an `input`, `textarea` or `select`, or is `isContentEditable`;
      - the target is inside `[data-own-undo]`;
      - `event.defaultPrevented` is already true.

      Handled keys call `preventDefault`.
  11. A plain `notify()` while an undoable is showing is queued and shown after it closes. It never replaces the
      undo notice.
- **Look:** an ink pill (`bg-ink text-on-ink rounded-full shadow-pop`), with the message and an **Undo** button
  (`bg-on-ink/15`). It rises 12 px plus opacity over 200 ms; reduced motion uses opacity only.

- [ ] **Step 1: Write the failing `Undoable.test.tsx` (fake timers)**

- "commits after 6 seconds" (`commit` called once at 6000 and not at 5999).
- "Undo restores and never commits".
- "a second undoable commits the first at once".
- "leaving the route commits the pending delete exactly once" (Review Focus 3). Use `MemoryRouter` and a button that
  calls `navigate('/b')`; after the timers run, `commit` has been called once.
- "pagehide commits exactly once".
- "Ctrl+Z triggers undo, but not inside a text field" (Review Focus 2). A `keyDown` on an `<input>` leaves the
  notice showing and `onUndo` uncalled; a `keyDown` on `document.body` calls `onUndo`.
- "hovering pauses the timer".
- "a plain notice waits for the undo notice to close".
- "a failed commit reports through onCommitError".

- [ ] **Step 2: Run and confirm they fail**

Run: `npx vitest run src/components/Undoable.test.tsx`
Expected: FAIL (`useUndoable` is not exported).

- [ ] **Step 3: Implement it in `Notice.tsx` and add the i18n key**

- [ ] **Step 4: Run both notice test files and the full suite**

Run: `npx vitest run src/components/Notice.test.tsx src/components/Undoable.test.tsx && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Notice.tsx src/components/Undoable.test.tsx src/i18n/en/components.ts src/i18n/it/components.ts
git commit -m "feat(ui): undo notices with deferred commit (expiry, navigation, pagehide, Ctrl+Z)"
```

---

### Task 12: Toolbar and main-action slot

**Files:**
- Create: `src/components/Toolbar.tsx`, `src/components/Toolbar.test.tsx`

**Interfaces:**
- **Consumes:** `Button` with `size="pill"` (Task 4).
- **Produces:**

  ```ts
  export function Toolbar(p: {
    title: string;                       // inline title (shown once scrolled; the page's large title shows at rest)
    leading?: ReactNode;                 // e.g. back, sidebar toggle
    actions?: ReactNode;                 // secondary icons, the "⋯" menu, search
    mainAction?: ReactNode;              // always last, top-right
    scrollContainer?: RefObject<HTMLElement>;  // default: window
  }): JSX.Element;
  export function MainAction(p: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }): JSX.Element; // Button primary, size pill
  ```

- **Behaviour:**
  - A `<header>` (no explicit `banner` role, since the shell may have its own) is sticky at
    `top: env(safe-area-inset-top, 0px)`, `h-[52px]`.
  - `data-scrolled` is `"false"` at scroll 0, with a transparent background and no edge.
  - Once scrolled past 0 it is `"true"`: `.glass` plus a bottom `glass-edge`, and the inline title fades in over
    150 ms.
  - The slot order is leading, title, actions, then mainAction.

- [ ] **Step 1: Write the failing tests**

- "is transparent at the top and glass once scrolled". Set `window.scrollY = 24` and fire `scroll`; `data-scrolled`
  becomes `"true"`.
- "renders the main action last, after the actions".
- "MainAction is a primary pill button" (`bg-ink`, `rounded-full`).

- [ ] **Step 2: Run and confirm they fail**

Run: `npx vitest run src/components/Toolbar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Use a passive scroll listener. Read the initial state on mount.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/Toolbar.test.tsx && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar.tsx src/components/Toolbar.test.tsx
git commit -m "feat(ui): toolbar with scroll-edge glass and a fixed main-action slot"
```

---

### Task 13: Dev gallery and final gate

**Files:**
- Create: `src/dev/UiGallery.tsx`, `src/dev/UiGallery.test.tsx`
- Modify: `src/App.tsx` (one lazy route, DEV only)

**Interfaces:**
- **Consumes:** every primitive from Tasks 4–12, plus `useThemePreference` (Task 2).
- **Produces:**
  - a `/dev/ui` route, registered only when `import.meta.env.DEV` is true. It is lazy-loaded and outside `ClubGate`,
    behind `RequireSignedIn`, so it needs no club.
  - The page shows:
    - a theme `SegmentedControl` (System · Light · Dark);
    - buttons in every variant;
    - a segmented control with long Italian labels;
    - a grouped list with level pills for all four bands plus "no level", with rows wired to `useContextMenu` and
      wrapped in `SwipeRow`;
    - a button that opens a `Sheet` (with `guardUnsaved` and a text field) and one that opens a `ConfirmDialog`;
    - a "Delete sample" row that uses `useUndoable`;
    - a `Toolbar` with a `MainAction`;
    - `StatTile`s, a `Skeleton` and a `StatusChip`.
  - All sample names are visibly marked as sample data. No Firestore reads.

- [ ] **Step 1: Write a smoke test**

`UiGallery.test.tsx`:

- it renders inside `MemoryRouter`, `I18nProvider` and `NoticeProvider` without throwing;
- it shows a heading "UI gallery";
- clicking "Delete sample" shows an Undo button.

- [ ] **Step 2: Implement the page and the DEV-only route**

- [ ] **Step 3: Run every gate**

Run: `npm test && npm run lint && npm run build`
Expected: all three succeed. The build must not include `UiGallery` in the production bundle; check with
`grep -r "UI gallery" dist/assets || echo "not in prod bundle"`, which should print `not in prod bundle`.

- [ ] **Step 4: Commit**

```bash
git add src/dev src/App.tsx
git commit -m "chore(dev): /dev/ui gallery of the v2 primitives"
```

- [ ] **Step 5: Hand over for the user's visual check (no long browser audit; they test UI themselves)**

Tell the user to run `npm run dev:emulator`, sign in, open `http://localhost:5173/dev/ui`, and check:

- light, dark and System, then switch the OS theme while System is selected;
- button press feedback;
- the segmented thumb sliding, and scrolling with the long labels;
- right-click on desktop and long-press on a phone for the context menu;
- swiping a row on a phone;
- the sheet: dragging, flicking it closed, and flicking with text typed (it should ask "Discard changes?");
- Undo after "Delete sample", and Ctrl+Z;
- the toolbar turning to glass on scroll;
- reduce motion and reduce transparency turned on in the OS.

The existing screens also pick up the new tokens, buttons, dialogs, menus and tabs. A quick look at Home, a team page
and a player card confirms nothing is broken; their full redesign comes in later increments.

---

## What comes next (separate plans)

These are written after this increment is reviewed, against the real primitives:

- **Plan 2:** shell and navigation (sidebar, phone tab bar, toolbar in `AppShell`, the ⌘K palette with its local
  groups).
- **Plan 3:** search data (`searchTokens`, indexes, backfill, server groups).
- **Then one plan per area, in the spec §11 order:** scouting, player card, home/teams/calendar/physical,
  trainings/exercises/diagrams, reports/stats/awards, club/admin/platform, shell/auth/legal; then shared outputs, then
  cleanup.
