# Volley Skills — Design System

> **Being superseded.** The v2 design system in [`docs/design/design-system/`](../../design/design-system/README.md) replaces this document when `feature/ui-redesign` merges. Until then, this document describes the running app.

Date: 2026-09-04
Status: Living — describes the shipped app (last reconciled with the code 2026-10-15). Originally distilled from `reference/ChatGPT Image Sep 4, 2026, 03_34_44 PM (1).png`.
Companion to: `2026-09-04-volley-skills-app-design.md`

## 1. Purpose

Formalizes the visual concept in `reference/` into precise, implementable tokens for the React + Tailwind CSS frontend described in the app design spec (Section 4). The reference image fixed the direction — navy/blue/orange/green, Inter, card-based UI, mobile-first scaling to desktop — this document makes it exact and consistent, and resolves the places the concept was ambiguous or internally inconsistent.

A live, browsable version of this system (all tokens and components rendered, light and dark) is published as an Artifact for visual review alongside this doc.

## 2. Color

### 2.1 Brand

| Token | Hex | Usage |
|---|---|---|
| `navy` | `#2356A8` | Primary buttons, sidebar, logo mark, auth court background — highest-emphasis surfaces. Brightened from `#0F2D5B` on 2026-09-17 to match the auth page. Dark theme uses `#1C4586`. |
| `blue` | `#2865F6` | Links, active tab/nav indicator, secondary buttons — the interactive accent |
| `orange` | `#F97316` | Priority flags, "Attention" status — signal, never decoration |

**Text in a brand hue (2026-10-14).** `orange` (2.8:1) and `green` (3.7:1) are too light for text on white, and the plain hues on their own `/10` tints also miss WCAG AA. They are fills, dots and meter segments only. Any text or small icon in those hues — level pills, status chips, warnings, badges — uses the `-strong` token: `red-strong` `#B91C1C`, `orange-strong` `#C2410C` (darkened from `#DC5F0A`), `blue-strong` `#1E4FDC`, `green-strong` `#0C7C4F`; all are ≥ 4.5:1 on white and on their `/10` tint. White text sits on `orange-strong`, never on `orange`. Guarded by `src/theme/contrast.test.ts`.
| `green` | `#109861` | Success, on-track, elite skill band |
| `red` | `#DC2626` | Destructive actions (delete player), Beginner skill band. Not in the source image — added to cover the app's real destructive-action and validation-error needs. |

### 2.2 Neutrals

| Token | Hex | Usage |
|---|---|---|
| `ink` | `#0F172A` | Body text, headings |
| `slate` | `#64748B` | Secondary text, captions |
| `border` | `#E2E8F0` | Card and input borders |
| `bg` | `#F8FAFC` | App canvas behind cards |
| `surface` | `#FFFFFF` | Cards, sheets, inputs |

### 2.3 Dark mode (shipped)

Every token is a CSS variable (`--color-*`, RGB triplets) defined per theme in `src/index.css`; `tailwind.config.js` maps each Tailwind color to `rgb(var(--color-x) / <alpha-value>)`, so the same class (`bg-navy`, `text-ink`, `bg-blue/10`) repaints when the `dark` class toggles on `<html>`. Components never use `dark:` variants — if a color needs to differ by theme, it becomes a token. The toggle lives in the account menu (desktop) and on the Settings page (both widths).

| Token | Dark value |
|---|---|
| `navy` | `#1C4586` |
| `blue` / `blue-strong` | `#7095FF` / `#93B0FF` |
| `orange` / `orange-strong` | `#FB923C` / `#FDBA74` |
| `green` / `green-strong` | `#34C98A` / `#6EDCAE` |
| `red` / `red-strong` | `#F87171` / `#FCA5A5` |
| `ink` | `#EAF0FB` |
| `slate` | `#93A3BE` |
| `border` | `#243252` |
| `bg` / `surface` | `#0B1220` / `#121B2E` |

In dark mode `-strong` means *lighter* (more contrast on a dark ground), so the "text in a brand hue uses `-strong`" rule holds in both themes. Do not invert navy/white — navy stays the darkest structural color in both themes.

### 2.4 Skill-level bands

Maps directly to the `level` field computed in the data model (app design spec §5): `avgScore < 4` Beginner, `< 6` Developing, `< 8` Advanced, else Elite. Same four colors are reused everywhere a level appears — the skill meter, the level pill in roster tables, priority dots.

| Level | Score range | Color |
|---|---|---|
| Beginner | 1–3 | `red` |
| Developing | 4–5 | `orange` |
| Advanced | 6–7 | `blue` |
| Elite | 8–10 | `green` |

## 3. Typography

Single family: **Inter**. One face carries both the marketing header and dense roster tables — it stays legible at small sizes and reads well on a phone in daylight, which matters more here than typographic variety. Numeric data (scores, dates, counts) always renders with tabular figures (`font-variant-numeric: tabular-nums`) so columns of numbers align.

| Role | Size / line-height | Weight |
|---|---|---|
| Large title | 28 / 36 | SemiBold (600) |
| Page title | 22 / 28 | SemiBold (600) |
| Section title | 18 / 24 | SemiBold (600) |
| Body | 16 / 24 | Regular (400) |
| Small | 14 / 20 | Regular (400) |
| Caption | 12 / 16 | Medium (500) |
| Stat number | 30 / 34 | ExtraBold (800), tabular |

Large/page/section titles use a slight negative tracking (`-0.01em`) — the only typographic embellishment in the system.

**Tokens (2026-10-15).** The display roles are Tailwind font sizes with their line height and tracking built in: `text-large-title` (28/36), `text-title` (22/28), `text-section` (18/24), `text-stat` (30/34, pair with `font-extrabold tabular-nums`). Body/small/caption use Tailwind's `text-base` / `text-sm` / `text-xs`. Never `text-2xl` or `text-[22px]` for a title.

**Page titles** always come from `PageHeader` (`src/layout/PageHeader.tsx`): optional eyebrow line, the `h1`, optional description, and page actions (right of the title from `sm`, an equal-width row under it on phones). It renders a `<div>`, not `<header>` — the print stylesheet hides `<header>` elements as app chrome. Exceptions: centred titles (auth card, 404) and the navy player identity card use `text-title` directly; the awards presentation slide is deliberately oversized.

**Minimum size: 11px**, including SVG chart labels. An SVG's text scales with its viewBox, so a chart whose viewBox is much wider than a phone must narrow it on small screens (see `TeamTrendChart`) or its labels shrink below the minimum.

**Logo (2026-10-13, replaces the 2026-09-17 V badge).** The mark is the **Spin Ball**: a volleyball reduced to three swirling panels in deep navy `#12295A`, navy `#2356A8` and ball yellow `#F5C518`, with a halftone-dot crescent shadow inside the ball, centred on the point where the yellow and navy panels meet at the left edge (light from the right). The wordmark is "VOLLEY / SKILLS" in Barlow Condensed Black Italic, **converted to outlines**, with SKILLS tracked to the width of VOLLEY — no font is loaded at runtime, and Barlow is not used anywhere else in the UI. All artwork is fixed SVG in `src/assets/brand/` (so it never shifts with dark mode), rendered by `Logo` / `LogoMark` in `src/components/Logo.tsx`; below ~32 px use the dot-free `-small` mark (that is what `public/favicon.svg` is). Variants, clear space, minimum sizes and misuse: `docs/brand/README.md`.

## 4. Spacing, radius, elevation

**Spacing** — 4px base unit: `4, 8, 12, 16, 24, 32, 48, 64`.

**Radius**

| Token | Value | Usage |
|---|---|---|
| `sm` | 6px | Chips, tags |
| `md` | 9px | Buttons, inputs |
| `lg` | 14px | Cards |
| `full` | 999px | Pills, avatars |

**Elevation** — border-first, not shadow-first: a hairline `border` plus a whisper of shadow, so cards read as content regions rather than tiles floating over the page.

| Level | Shadow | Usage |
|---|---|---|
| Flat | none (border only) | Table rows, list rows |
| Card | `0 1px 2px rgba(15,23,42,.06), 0 1px 0 rgba(15,23,42,.03)` | Default card resting state |
| Popover | `0 8px 24px rgba(15,23,42,.14), 0 2px 6px rgba(15,23,42,.08)` | Menus, dropdowns, modals |

## 5. Iconography

Line icons, 1.5px stroke, rounded joins, drawn on a 24px grid (matches Inter's weight at small sizes). [Lucide](https://lucide.dev) is a good source — free, MIT-licensed, matches this stroke style, has a React package.

## 6. Status vocabulary

Five statuses cover every workflow state (development-plan objectives, training sessions). Always pair color with a label — never color alone, so status still reads correctly on a phone screen outdoors.

| Status | Color | Fill style |
|---|---|---|
| Active | `green` | Pale tint background, colored text |
| In progress | `blue` | Pale tint background, colored text |
| Completed | `ink` | Solid fill, white text — the one filled chip, signaling "closed" |
| Not started | `slate` | Pale tint background, muted text |
| Attention | `orange` | Pale tint background, colored text |

Priority rankings (e.g. a team's top focus areas) use a numbered list (1, 2, 3…) plus a colored dot — numbering is legitimate here because it's a real rank order, not decoration.

## 7. Components

Full specs and live states for each are in the Artifact; summarized here for implementation reference.

- **Buttons** — `primary` (navy fill), `secondary` (white, blue outline/text), `ghost` (text-only, blue), `destructive` (red fill, white text — new, for delete-player flows). States: default, hover, disabled, `:focus-visible` ring.
- **Inputs** — text/select, 1.5px border, blue focus ring, error state shown as a red border *and* helper text below (never color alone).
- **Skill meter** — the one purpose-built component. Ten equal segments (1–10 scale) filled left-to-right, colored by the level band the score falls into (Section 2.4), with band-boundary reference marks at 3|5|7. This is the app's core data surface, so it gets a dedicated component rather than a generic progress bar.
- **Cards** — three distinct treatments, not one radius/shadow everywhere: stat tiles (flat, dense, big tabular number), content cards (full border+shadow, holds a screen region), list rows inside a card (hairline-separated, not nested cards).
- **Tabs** — underline style; active tab takes `blue` (matches links/active-nav), keeping `navy` reserved for the sidebar and primary actions. On phones `SectionTabs` collapses to a select. Page title and tabs sit on the canvas; each tab panel brings its own cards — never wrap a whole tabbed page in one card (that nests every card inside it).
- **Navigation** — one vocabulary, two shells: navy sidebar (desktop, ≥1024px), white bottom tab bar (mobile). Same items, same order, same icon in both — this is the literal implementation of the app design spec's mobile-first requirement (§7 screens list, responsive across `/teams`, `/players`, etc.).
  - **Deliberate differences (2026-10-15).** The bottom bar holds at most four primary destinations plus **Settings**. On desktop, Settings lives in the account menu at the foot of the sidebar instead (with dark mode, privacy and sign-out). The **Admin** group (Guides, Access) is in the sidebar on desktop and on the Settings page on phones, and the pending-access badge follows it — onto the Settings tab on phones. Anything reachable on one shell must be reachable on the other.
- **Success notice** — `useNotify()` from `src/components/Notice.tsx` (provider mounted once in `App`) is the only way to confirm that something worked: a dark toast above the bottom bar, polite live region, auto-dismiss (4s default). Errors are never toasts: they stay inline beside what failed, with `role="alert"`.
- **Focus** — `Button` draws a 2px `blue` ring on `:focus-visible`; a base rule in `src/index.css` gives every other focusable element the same outline, so custom controls (calendar cells, chips, toolbar icons) need no extra classes.
- **Table** — used for team rosters. Header row: small, medium-weight, uppercase with slight letter-spacing (a functional data-table convention, not a decorative eyebrow). Numeric columns right-aligned with tabular figures. Row hover uses `bg` (the app-canvas neutral, since no `surface-2` token is defined), no border added on hover (avoids layout shift).

## 8. Tailwind implementation notes

`tailwind.config.js` is the implementation of Sections 2–4 and is the reference — this section only explains its shape:

- **Colors** read CSS variables (`navy: 'rgb(var(--color-navy) / <alpha-value>)'`, `blue: { DEFAULT, strong }`, likewise `orange`, `green`, `red`; plus `ink`, `slate`, `border`, `bg`, `surface`). Values per theme live in `src/index.css` (light under `:root`, dark under `.dark`); light `orange-strong` is `#C2410C`. Contrast pairs are guarded by `src/theme/contrast.test.ts`.
- **Font sizes** add the §3 roles: `large-title`, `title`, `section`, `stat`.
- **Radius** `sm 6px / md 9px / lg 14px`; **shadow** `card` / `pop` exactly as §4.

Inter is self-hosted via `@fontsource/inter` (weights 400/500/600/700/800). Use Tailwind's `tabular-nums` on every numeric column and stat tile.

## 9. Open items / deferred

- ~~Dark mode~~ — shipped via CSS-variable tokens (Section 2.3).
- ~~Icon set~~ — `lucide-react` is installed and used throughout.
- **Destructive button, error input state** — specified here to cover real app needs (player deletion, license-number validation per the app design spec's data model) that the source concept image didn't depict. Shipped as `Button` variants `destructive` / `dangerGhost`.
