# UI/UX Audit — Volley Skills

Date: 2026-10-14 · Branch audited: `feature/match-insights` (includes the new match-insights UI)
Method: code audit of `src/` against `docs/superpowers/specs/2026-09-04-volley-skills-design-system.md`
plus WCAG 2.2 AA and mobile/touch heuristics. Contrast ratios are computed from the real token hex
values in `src/index.css`. Nothing was rendered in a browser — items marked **(check on device)**
need a quick look on a phone.

## Status — 2026-10-14 (branch `fix/ui-ux-audit`)

All items below are fixed except where noted:

| # | Item | Status |
|---|---|---|
| 1 | Light-mode contrast | Fixed — `orange-strong` → `#C2410C`; pills, chips, warnings, badges use `-strong`; guarded by `src/theme/contrast.test.ts` |
| 2 | Double submit + offline hang | Fixed — `useSave` in all six create dialogs; offline plain writes queue and close, new trainings and create-and-draw explain they need a connection |
| 3 | Dialog focus / unsaved forms | Fixed — focus trap + return in `useModalLayer`; `Dialog guardUnsaved` asks "Discard changes?"; the four hand-built create forms moved onto `Dialog` (they had no `role="dialog"`, Escape or scroll lock) |
| 4 | iOS focus zoom | Fixed — `text-base sm:text-sm`; guarded by `src/theme/formFieldSize.test.ts` |
| 5 | Hand-rolled fields | Fixed — on `FIELD_CLASS` (blue focus ring) |
| 6 | Icon-only bottom nav | Fixed — 11px labels at every width |
| 7 | Roster table on phones | **No change needed — audit was wrong.** The roster already renders a card per player below 1280px; the code grep only saw the desktop table. |
| 8 | Loading layout jump | Fixed — `PageSkeleton` on player, team and match pages (`motion-safe` pulse) |
| 9 | Destructive row action | No change needed — Remove sits in the card footer behind a confirm (see 7) |
| 10 | Glyph icons | Fixed — Lucide `TriangleAlert` / `PenLine` |
| 11 | `window.confirm` | Fixed — `ConfirmDialog` ("Leave without saving?") |
| 12 | Table semantics | Fixed — `scope="col"`, no row `aria-label`; guarded by `src/theme/tableSemantics.test.ts` |
| 13 | Tab semantics | Fixed — `role="tablist"` / `role="tab"` + `aria-selected` |
| 14 | Tiny nav badge | Fixed — 11px on `orange-strong` |
| 15 | Reduced motion | Fixed for the one new animation (skeleton pulse is `motion-safe:`) |

## Summary

The foundations are strong: tokenized colors with a working dark theme, `Button`/`Input`/`Dialog`
primitives that already enforce 44 px targets and visible focus rings, `role="alert"` on 60 error
messages, a phone-first scouting screen, and consistent Lucide icons. The problems cluster in three
places:

1. **Light-mode color contrast** — every level pill and status chip, and most orange/green text,
   fails WCAG AA. This is the app's core data vocabulary, read on phones outdoors.
2. **Form safety** — create dialogs can be submitted twice (duplicate players/teams on slow gym
   Wi-Fi), and any dialog loses its unsaved form on a stray backdrop tap or Escape.
3. **Phone ergonomics** — 14 px form fields zoom the page on iPhone, the bottom nav is icon-only,
   and the roster is a 7-column table that scrolls sideways.

Dark mode passes everywhere checked (every token ≥ 6:1 on the dark surface).

## P1 — fix first

### 1. Light-mode contrast of chips, pills and signal text (WCAG 1.4.3 / 1.4.11)

Measured on white / on the `/10` tint the chips use (AA needs 4.5:1 for text, 3:1 for icons):

| Usage | Ratio | |
|---|---|---|
| `text-orange` (Developing pill, Attention chip, focus-area label, access-request chips) | 2.80 / **2.53** | fail |
| `text-orange-strong` (timeline warnings, text-scout notices) | 3.69 / 3.34 | fail |
| `text-green` (Elite pill, Active chip) | 3.69 / **3.29** | fail |
| `text-red` on `red/10` (Beginner pill) | 4.13 | fail |
| `text-blue` on `blue/10` (Advanced pill, In-progress chip) | 4.30 | fail |
| white on `bg-orange` (nav badges) | 2.80 | fail |
| `text-white/70` inactive sidebar links on navy | 4.36 | fail (just) |
| `text-white/50` sidebar Privacy link | 3.00 | fail |
| `text-slate/50` calendar "+ add" affordance | 1.96 | fail |
| orange `ArrowDown` "suggests lower" icon (new) | 2.80 | fail (icon needs 3:1) |

**Fix (keeps every hue in the design system):**
- Light theme: darken `--color-orange-strong` from `#DC5F0A` to `#C2410C` (5.18 on white, 4.68 on
  `orange/10`). Dark theme unchanged.
- `LevelPill` / `StatusChip`: use the `-strong` text tokens on the `/10` tints → red 5.54, orange
  4.68, blue 5.74, green 4.66. All pass.
- Signal text and small icons: `text-orange` → `text-orange-strong`, `text-green` → `text-green-strong`.
- Badges: `bg-orange text-white` → `bg-orange-strong text-white` (5.18).
- Sidebar: inactive `text-white/80` (5.17), Privacy `text-white/80`. Calendar add: `text-slate`.
- Update design-system spec §2.1 with the new `orange-strong` value and a rule: *orange and green
  are fills and dots; text in those hues always uses the `-strong` token.*

Locations: `components/LevelPill.tsx:4-7`, `components/StatusChip.tsx:6-12`,
`layout/AppShell.tsx:13,72-80,95`, `interest/AccessRequestsPanel.tsx:111,135`,
`players/PlayerSkillsSection.tsx:150,161,171`, `matches/scout/TimelineDrawer.tsx:36`,
`matches/text/TextScoutPanel.tsx:227,276`, `matches/text/PreviewRallyCard.tsx:100`,
`matches/scout/SetStartDialog.tsx:218`, `matches/TeamMatchesTab.tsx:16`,
`calendar/TeamCalendarTab.tsx:58,263,273`, `physicalSessions/QualityTileGrid.tsx:63`,
`exercises/ExercisesPage.tsx:137`, `trainings/TrainingsPage.tsx:155`, `teams/TeamPage.tsx:129`,
`teams/TeamsListPage.tsx:82`, `bulkImport/BulkImportDialog.tsx:181`,
`players/PlayerIdentityCard.tsx:21-67` (check: white/70 on navy).

### 2. Create dialogs can be submitted twice

None of these disable Save while the write is in flight; a double tap on slow Wi-Fi creates a
duplicate record:

`players/AddPlayerDialog.tsx`, `teams/CreateTeamDialog.tsx`, `players/AddPhysicalTestDialog.tsx`,
`exercises/ExerciseFormDialog.tsx`, `trainings/TrainingBuilderDialog.tsx`,
`calendar/AssignTrainingDialog.tsx`.

**Fix:** a `saving` state per dialog — set before the write, submit button
`disabled={saving}` with label "Saving…", cleared in `finally`. Add one component test per dialog
("second click does not create twice").

Related **(check on device)**: these dialogs `await` the write. With Firestore's persistent cache a
write made offline only resolves when the server acknowledges it, so offline the dialog waits
forever (the scouting code avoids this by not awaiting). Once the busy guard exists this becomes a
stuck "Saving…" button. Consider closing optimistically when `!navigator.onLine` with an
"Saved — will sync when online" toast.

### 3. Dialogs: focus escapes, focus isn't restored, unsaved forms are discarded silently

`components/Dialog.tsx` + `components/useModalLayer.ts`:
- **No focus trap:** Tab walks out of the modal into the page behind it (WCAG 2.4.3).
- **No focus restore:** after closing, focus lands on `<body>`, not the button that opened it.
- **Backdrop tap / Escape always closes:** a half-filled training builder, skills edit or player
  form is lost with no warning. On a phone a stray tap outside a centered card is common.

**Fix:** in `Dialog`, trap Tab/Shift+Tab within the panel and restore focus to
`document.activeElement` captured on mount. Add an optional `dirty?: boolean` prop: when true,
backdrop/Escape/✕ open the existing `ConfirmDialog` ("Discard changes?") instead of closing.
Pass `dirty` from the long forms (training builder, exercise form, add player, skills, development
plan).

## P2 — phone ergonomics and polish

### 4. Form fields under 16 px zoom the page on iPhone
iOS Safari zooms when focusing an input with font-size < 16 px. Affected:
`matches/MatchPage.tsx:152` (CSV format select), `matches/MatchSetupForm.tsx:214`,
`matches/text/PreviewRallyCard.tsx:16` (grade selects in text scouting),
`players/PlayerContactSection.tsx:138,154`, `teams/TeamRosterTable.tsx:135,144`.
**Fix:** `text-base sm:text-sm` on these (16 px on phones, 14 px from `sm`).

### 5. Hand-rolled fields bypass `FIELD_CLASS` and lose the focus ring
`players/PlayerContactSection.tsx:138,154`, `teams/TeamRosterTable.tsx:135,144`,
`diagrams/DiagramTabs.tsx:32` use `focus:outline-none` with only a border-color change — a
color-only, 1 px focus indicator. **Fix:** use `<Input>` / `FIELD_CLASS`.

### 6. Bottom nav is icon-only on phones
`layout/AppShell.tsx:19-23` hides labels below 640 px. Teams/Exercises/Trainings/Guides/Access/
Settings as Users/Dumbbell/ClipboardList/BookOpen/KeyRound/Settings icons are ambiguous (two
clipboard-ish icons), and the design-system spec §7 describes the bar as "same items, same order"
as the labelled sidebar. **Fix:** always show 11–12 px labels under the icons (6 items fit at
375 px with `flex-1`).

### 7. Roster table on phones
`teams/TeamRosterTable.tsx` renders 7 columns with a delete button per row; on a phone it scrolls
sideways and the name column scrolls away. **Fix:** below `sm`, render a list of rows (number +
name + position on the left, level pill + avg on the right, row tap → player), and move Delete into
the player page or an overflow menu.

### 8. Loading states shift the layout
All 11 loading states are plain "Loading…" text; the player card, roster and report then pop in
and push content down. **Fix:** a small `Skeleton` block component (pulsing `bg-border/60`,
`motion-safe:animate-pulse`) sized like the final tiles, starting with `PlayerCardPage`,
`TeamPage` roster and `MatchPage`.

### 9. Destructive row actions sit next to navigation
The roster's per-row Delete (`TeamRosterTable.tsx:213,282`) is one tap away from opening the
player. It is confirmed by a dialog, which is good; moving it off the row (see 7) also removes the
mis-tap.

## P3 — consistency

10. **Glyph icons in text:** `⚠` in `scout/LiveStatsPanel.tsx:41,43`, `scout/TimelineDrawer.tsx:36`,
    `calendar/AssignTrainingDialog.tsx:232`, `trainings/TrainingBuilderDialog.tsx:236`,
    `trainings/TrainingViewSheet.tsx:141`; `✎` in `scout/TimelineDrawer.tsx:33`. Use Lucide
    `TriangleAlert` / `PenLine` (`aria-hidden`, with the text carrying the meaning) — matches §5.
11. **Native `window.confirm`** in `diagrams/DiagramEditorPage.tsx:181` — unstyled and blocking;
    use `ConfirmDialog` (note: route-leave guards need React Router's `useBlocker`).
12. **Table semantics:** the four tables (`MatchReport`, `LiveStatsPanel`, `PlayerMatchStatsSection`,
    `TeamRosterTable`) have no `scope="col"` on headers; `PlayerMatchStatsSection` puts
    `aria-label` on `<tr>`, which some screen readers read instead of the cells — drop it and query
    cells in tests.
13. **Tabs semantics:** `components/Tab.tsx` uses `aria-current="page"` on buttons that switch
    in-page panels. Either `role="tablist"/"tab"` + `aria-selected`, or keep as-is (it works, it
    just announces as navigation).
14. **Tiny text:** 10 px nav badge (`AppShell.tsx:95`) and 10–11 px court/diagram labels. Court
    zone labels are secondary and fine; raise the badge to 11–12 px.
15. **Reduced motion:** motion is minimal (11 transitions, no large animations), so this is low
    risk; add `motion-safe:` to any future animation (skeletons in 8).

## What is already good (keep doing it)

- Token system with `rgb(var(--…) / <alpha>)` — opacity modifiers and dark mode both work.
- `Button` and the Dialog close button guarantee 44 px targets; `Button` sets `cursor-pointer`,
  `focus-visible` ring and disabled styles centrally.
- `Dialog` has pinned footers on phones, scroll lock, Escape layering for stacked modals, and a
  full-screen sheet variant.
- Errors are announced (`role="alert"` ×60) and placed next to the action that failed.
- Team tabs collapse to a `<select>` on phones instead of overflowing.
- `tabular-nums` used consistently on stats; color is paired with text labels on statuses and
  levels (spec §6).
- Dark theme contrast is good across all tokens.

## Suggested order

1. P1.1 contrast (token + two components + find/replace) — one small PR, biggest reach.
2. P1.2 double-submit guards — mechanical, test per dialog.
3. P1.3 Dialog trap/restore/dirty — one component, then opt in the long forms.
4. P2.4–2.6 (zoom, field rings, nav labels) — one PR.
5. P2.7–2.8 (roster list, skeletons) — design a little first.
6. P3 as a cleanup sweep.

**(Check on device)** after P1–P2: player card and roster at 375 px, the bottom nav labels, a
text-scouting grade select on iPhone (no zoom), and a level pill outdoors.
