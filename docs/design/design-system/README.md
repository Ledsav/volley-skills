# Volley Skills design system (v2)

**Status:** approved 2026-10-28; built by the UI redesign; the source of truth for every UI decision.

This document is the *rules*. The redesign project that applies them is
[`2026-10-28-ui-redesign-design.md`](../../superpowers/specs/2026-10-28-ui-redesign-design.md). It covers agreed
behaviour changes, exact interaction behaviour per pattern, per-screen design and delivery. The logo and identity are
in [`../brand/`](../brand/README.md).

**See it:** [`mockups/`](mockups/). Open the `.html` files in a browser, or look at the `.png` screenshots.

| Mockup | Shows |
|---|---|
| [`volley-skills-v2.html`](mockups/volley-skills-v2.html) ([light](mockups/volley-skills-v2-light.png), [dark](mockups/volley-skills-v2-dark.png)) | **Reference page:** colour, type, controls, Today on desktop, phone roster, sheet, live scouting, sign-in on desktop and phone |
| [`screens-set.html`](mockups/screens-set.html) ([png](mockups/screens-set.png)) | Nine full screens in light and dark, from the exploration round |
| [`direction-v2.html`](mockups/direction-v2.html) ([png](mockups/direction-v2.png)) | The first "v2" direction board the user approved |

Where the mockups and this text disagree, the text wins. The mockups are illustrations, and their sample names and
scores are made up.

---

## 1. Principles

1. **Monochrome chrome, coloured data.** Buttons, navigation, selection and focus are ink on surface. Colour appears
   only where it means something:
   - a level band;
   - a scouting grade;
   - a state: live, error, warning or success;
   - a destructive action.
2. **Content first, chrome floats.** Pages are flat. Toolbars, the phone tab bar, sheets and menus float over the
   content, with glass only where content actually scrolls under them.
3. **Hierarchy from type, not boxes.** Large titles, weight and spacing do the work of borders and cards. Grouped
   (inset) lists replace bordered tables on narrow screens.
4. **Light and dark are equal.** Neither theme is the "real" one; both get the same care. The app follows the system
   by default, and Settings offers System · Light · Dark.
5. **Live scouting is always dark.** It is a focused instrument, used in bright gyms and dim stands alike, and the
   grade colours read best on black.
6. **Fast beats pretty.** Nothing that animates may slow down input. Scouting's recording path never animates.
7. **Forgive, don't interrogate.** Offer undo for reversible actions. Confirmations are only for irreversible or
   high-impact ones.
8. **One place for everything.** Every page lives in exactly one place in the navigation. The main action of a screen
   always sits top-right in its toolbar.

## 2. Colour

Colours are CSS variables per theme in `src/index.css`, exposed to Tailwind as semantic names. Components never use
`dark:` variants.

### 2.1 Chrome tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F5F5F7` | `#000000` | Page canvas |
| `surface` | `#FFFFFF` | `#1C1C1E` | Grouped lists, cards, the solid part of sheets |
| `surface-2` | `#F2F2F7` | `#2C2C2E` | Inset fields, segmented track, secondary fills |
| `surface-3` | `#E5E5EA` | `#3A3A3C` | Pressed fills, selected nav item, chips |
| `ink` | `#1D1D1F` | `#F5F5F7` | Primary text, primary button fill |
| `ink-2` | `#6E6E73` | `#A1A1A6` | Secondary text (AA on `surface` and `bg`) |
| `ink-3` | `#8E8E93` | `#6E6E73` | Placeholders, disabled, decoration; never body text |
| `on-ink` | `#FFFFFF` | `#000000` | Text on a primary (ink) button |
| `separator` | `rgba(60,60,67,.14)` | `rgba(84,84,88,.48)` | Hairlines inside groups, inset from the leading edge |
| `glass` | `rgba(255,255,255,.72)` | `rgba(28,28,30,.70)` | Floating chrome |
| `glass-edge` | `rgba(255,255,255,.9)` top, `rgba(0,0,0,.06)` bottom | `rgba(255,255,255,.08)` | Material edge |
| `scrim` | `rgba(0,0,0,.28)` | `rgba(0,0,0,.56)` | Behind modal sheets |
| `focus` | `#0071E3` | `#409CFF` | Focus ring only |
| `sidebar` | `#FFFFFF` | `#0D0D0F` | Solid sidebar and the sign-in form pane |

### 2.2 Data colours

Each data colour has two forms:

- a **fill** for dots, bars, charts and tinted chips;
- a **text** form that meets AA as text on `surface`.

| Meaning | Fill light / dark | Text light / dark |
|---|---|---|
| Beginner (avg < 4), error, grade `=`, destructive | `#FF3B30` / `#FF453A` | `#CD0014` / `#FF6961` (`#D70015` darkened one step for AA on the 14% tint) |
| Developing (< 6), warning, grades `/` `-` | `#FF9500` / `#FF9F0A` | `#C93400` / `#FFB340` |
| Advanced (< 8), info | `#007AFF` / `#0A84FF` | `#0040DD` / `#409CFF` |
| Elite (≥ 8), success, grades `+` `#`, live | `#34C759` / `#30D158` | `#1E7D37` / `#30DB5B` (`#248A3D` darkened one step for AA on the 14% tint) |

- The grade `!` is neutral (`ink-2`).
- Tints (pills, banners) are the fill at 14% on light and 22% on dark.
- Blue is **only** the Advanced band. It is never a UI accent: links, selection and buttons are ink.
- Red is the one non-data use, and only on a destructive action, always with a destructive label.
- The solid destructive fill is `#D70015` with white content (swipe actions).
- The meanings are fixed. Only the hues above may be tuned.

### 2.3 High contrast

`prefers-contrast: more`:

- separators become solid (`#C6C6C8` / `#38383A`);
- `ink-2` moves one step towards `ink`;
- glass becomes solid `surface`;
- every control gets a 1 px `ink-3` outline.

## 3. Typography

Inter, self-hosted through `@fontsource/inter`. Tabular numerals on every number column, score and stat. Tracking
depends on size: tighter as text grows. Sizes are in `rem`, so the browser's text size scales the layout.

| Role | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `large-title` | 34/40 (phone 30/36) | 700 | −0.022em | Page titles ("Today", "Teams") |
| `title-1` | 28/34 | 700 | −0.020em | The team name, the player name, desktop page titles |
| `title-2` | 22/28 | 600 | −0.017em | Section headers; the title in the desktop sheet header |
| `title-3` | 19/24 | 600 | −0.012em | Card titles |
| `headline` | 16/22 | 600 | −0.010em | Row titles, emphasised body; the title in the phone sheet bar |
| `body` | 15/22 (inputs 16 on touch) | 400 | −0.005em | Default |
| `callout` | 14/20 | 400 | −0.003em | Secondary row text |
| `footnote` | 13/18 | 400 | 0 | Metadata, helper text |
| `caption` | 12/16 | 500 | +0.01em | Group headers, badges |
| `stat` | 40/44 | 700 | −0.030em | KPI numbers |
| `score` | 72/72 (phone 56) | 700 | −0.040em | Live scouting score |
| `display` | 44/46 | 700 | −0.035em | Sign-in tagline only |

- Group headers are sentence case in `ink-2`, never uppercase. Uppercase breaks Italian and German lengths.
- Inputs are 16 px on touch devices, so iOS doesn't zoom the page.
- Design every label for 30% longer text (Italian, German).

## 4. Space, shape, depth, icons

- **Spacing** is a 4 px base.
  - 32 px between groups, and 8 px between a group header and its group.
  - Page gutters are 20 px on phones and 32 px on desktop.
  - Content is at most 1080 px wide; forms and long text at most 720 px.
- **Radii:**

  | Radius | Use |
  |---|---|
  | 8 | chips, fields |
  | 12 | buttons, segmented control, menu rows |
  | 16 | grouped lists, cards |
  | 22 | sheets, popovers |
  | full | pills, avatars |

  No fake squircles.
- **Elevation:**
  - Content is flat. Cards get a hairline shadow (`0 1px 2px rgba(0,0,0,.04)`) in light mode and none in dark.
  - Floating chrome uses `0 8px 32px rgba(0,0,0,.12)` in light mode and a 1 px `glass-edge` in dark.
  - Sheets use `0 -8px 40px rgba(0,0,0,.18)`.
- **Icons:** `lucide-react` at 1.75 stroke; 20 px in toolbars and rows, 17 px inline. Icons are `ink-2` unless they
  are the main action.
- **Touch targets** are at least 44 px. Scouting targets are at least 56 px on phones.

## 5. Materials

- **Glass recipe:** `background: var(--glass); backdrop-filter: blur(24px) saturate(180%)` plus the `glass-edge`.
- **Where glass goes:**
  - the toolbar, only once content scrolls under it; at scroll top it is transparent with no edge;
  - the phone tab bar;
  - sheets, as the header strip of a large sheet or the whole of a small sheet;
  - menus, popovers and the search palette.
- **Never glass:**
  - the sidebar, which is solid `sidebar`;
  - cards, rows and content;
  - anything stacked on another glass layer.
- **Modal sheets** pair with the scrim. On phones the page behind scales to 0.98.
- **`prefers-reduced-transparency: reduce`:** glass becomes solid `surface`, with the edge kept and the blur dropped.

## 6. Motion

All motion lives in one module (`src/motion/`):

- an interruptible spring (critically damped by default) that writes only `transform` and `opacity`, starts from the
  current on-screen value and takes the gesture's release velocity;
- `useReducedMotion()`;
- the CSS easings `--ease-out: cubic-bezier(.23,1,.32,1)` and `--ease-drawer: cubic-bezier(.32,.72,0,1)`.

| Interaction | Motion |
|---|---|
| Press on any pressable | `scale(.97)` on pointer-down, 100 ms ease-out; release 160 ms. Rows dim to `surface-3` instead of scaling. |
| Menu / popover / context menu | From the trigger's origin: scale .96→1 plus opacity, 160 ms in, 120 ms out. Never from `scale(0)`. |
| Sheet open / close | Spring, response .35, damping 1. After a flick, damping .85 (a small overshoot only after a throw). |
| Sheet drag | 1:1 from the grab point. Rubber-band past the top detent. The projected end (Apple's `project()`, deceleration .998) picks the detent. |
| Swipe actions | 1:1 tracking. A full swipe past 50% commits the trailing action. Release springs to open or closed. |
| Page change | The content area fades in and rises 6 px over 180 ms. Chrome doesn't move. |
| Segmented control | The selection pill slides with a spring (response .3). |
| List insert / delete | Height collapse plus fade, 200 ms. Undo reverses it. |
| Toast / undo notice | Rises 12 px plus fade, 200 ms; leaves the same way. |
| Search palette (⌘K) | **No animation** from the keyboard. Opened by tap on a phone, it uses the sheet motion. |
| Live scouting recording taps | **No animation.** An instant `surface-3` flash for 80 ms. Scores change without animating. |

`prefers-reduced-motion: reduce`:

- springs and slides become 150 ms opacity cross-fades;
- press scale is off, but the colour press state stays;
- swipe still follows the finger, but releases snap without overshoot.

Nothing loops in the background. The live dot pulses at most once per 2 s, and not at all with reduced motion.

## 7. Layout and navigation

`src/layout/navModel.ts` is the single list of pages. Every page lives in exactly one place. The account menu holds
only personal items (Settings, Terms & privacy, Sign out). Phones get **More**.

| Width | Shell |
|---|---|
| < 768 | **Phone.** A glass bottom tab bar (Today, the coaching pages, More), and a glass toolbar with a large title that collapses on scroll, search, and the main action. |
| 768–1279 | **Tablet.** The sidebar is an overlay, opened from the toolbar; content is full width. |
| ≥ 1280 | **Desktop.** A solid 248 px sidebar, always visible, and a glass toolbar with the title, a search field (⌘K hint) and the main action. |

- **Sidebar:**
  - **Header:** the club switcher (club initials tile, club name, role).
  - **Groups:** Today · Coaching (Teams, Trainings, Exercises) · Club (Skill guides, Members & settings) · Platform
    (operator only).
  - **Footer:** the account row.
  - The selected item is `surface-3` with ink text.
- **Team page:** the team name is the large title. Its tabs are a segmented control pinned under the toolbar: all
  permitted tabs on desktop, scrolling horizontally on a phone. `?tab=` deep links stay.
- **Live scouting, awards present mode and the diagram editor** are full-screen, outside the shell.

## 8. Patterns

The exact behaviour of each pattern, and which screen uses what, is in the redesign spec §6.

| Pattern | Rule |
|---|---|
| **Main action** | At most one per screen, top-right in the toolbar: a filled ink pill on desktop, "+" or a short label on a phone. Secondary actions go in a "⋯" menu beside it. |
| **Buttons** | Primary is filled `ink` with `on-ink` text. Secondary is a `surface-2` fill. Plain is text only. Destructive is red text. Minimum 44 px high. |
| **Segmented control** | Replaces tab rows: a `surface-2` track with a sliding `surface` pill (`#636366` in dark). |
| **Grouped list** | `surface` group, radius 16, rows at least 52 px, hairlines inset to the text. Chevron only when the row navigates. |
| **Level pill** | The band's tint plus its text colour, with the number in tabular figures. |
| **Sheet** | Replaces every dialog. Desktop: centred, 560 px (720 for builders), with footer actions. Phone: bottom sheet with detents, grabber, Cancel · Title · Confirm in the header. A dirty sheet never closes on a flick; it asks "Discard changes?". |
| **Alert** | Only for irreversible or high-impact actions. The destructive button is red text, the safe choice is bold, and Cancel has initial focus. It is an action sheet on phones. |
| **Undo notice** | For reversible deletes and changes: an ink pill toast with **Undo**, lasting 6 s. The write is deferred until it expires. |
| **Context menu and swipe** | Right-click or long-press (500 ms) on a row, and swipe on phone lists. They only expose actions the row already has; the "⋯" button stays. A full swipe commits only undoable actions. |
| **Search (⌘K)** | Grouped results (Go to, Actions, Teams, Players, Matches, Exercises, Trainings), keyboard-first, opening without animation. |
| **Status layout** | Icon tile, title, body and an optional action, for empty, error, sign-in states and club status screens. |
| **Loading** | Skeleton rows in the shape of the content. No full-page spinners. |
| **Errors** | Inline with `role="alert"`, next to what failed, saying what to do. Success goes through the notice. |

## 9. Accessibility

- WCAG 2.2 AA contrast for all text. `ink-3` is never used for text people need to read.
- A visible `focus` ring on every control. Full keyboard use on desktop.
- Dialogs and sheets trap focus, return it on close, and let Escape close only the topmost layer.
- Respect `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast` and forced colours.
- One polite live region for success, `role="alert"` for errors, and focus moves to the page heading on route change.

## 10. Brand in the UI

The logo, its variants and the rules for using it are in [`../brand/README.md`](../brand/README.md). In the UI:

- The **sign-in screens** show the mark on an ink tile with the name "Volley Skills" beside it.
- The **sidebar** shows the *club's* initials tile, not the app mark. The app is the tool; the club owns the space.
- **Shared outputs** carry the club's name from data, never a hardcoded club. This applies to award cards, story
  slides and video, and the training PDF.
- The **favicon and app icons** are the files in `../brand/logo/web-icons/`.
