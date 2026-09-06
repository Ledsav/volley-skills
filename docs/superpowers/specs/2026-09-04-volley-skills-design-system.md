# Volley Skills — Design System

Date: 2026-09-04
Status: Draft — distilled from `reference/ChatGPT Image Sep 4, 2026, 03_34_44 PM (1).png`, pending review
Companion to: `2026-09-04-volley-skills-app-design.md`

## 1. Purpose

Formalizes the visual concept in `reference/` into precise, implementable tokens for the React + Tailwind CSS frontend described in the app design spec (Section 4). The reference image fixed the direction — navy/blue/orange/green, Inter, card-based UI, mobile-first scaling to desktop — this document makes it exact and consistent, and resolves the places the concept was ambiguous or internally inconsistent.

A live, browsable version of this system (all tokens and components rendered, light and dark) is published as an Artifact for visual review alongside this doc.

## 2. Color

### 2.1 Brand

| Token | Hex | Usage |
|---|---|---|
| `navy` | `#0F2D5B` | Primary buttons, sidebar, logo mark — highest-emphasis surfaces |
| `blue` | `#2865F6` | Links, active tab/nav indicator, secondary buttons — the interactive accent |
| `orange` | `#F97316` | Priority flags, "Attention" status — signal, never decoration |
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

### 2.3 Dark mode

Dark mode is documented (see Artifact) but not required for MVP — see Section 9. If shipped: background `#0B1220`, surface `#121B2E`, brand hues lightened (e.g. `blue` → `#7095FF`) to hold contrast on a dark ground; semantic roles stay identical, only the underlying hex changes. Do not invert navy/white — navy stays the darkest structural color in both themes.

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
- **Tabs** — underline style; active tab takes `blue` (matches links/active-nav), keeping `navy` reserved for the sidebar and primary actions.
- **Navigation** — one vocabulary, two shells: navy sidebar (desktop, ≥1024px), white bottom tab bar (mobile). Same items, same order, same icon in both — this is the literal implementation of the app design spec's mobile-first requirement (§7 screens list, responsive across `/teams`, `/players`, etc.).
- **Table** — used for team rosters. Header row: small, medium-weight, uppercase with slight letter-spacing (a functional data-table convention, not a decorative eyebrow). Numeric columns right-aligned with tabular figures. Row hover uses `surface-2`, no border added on hover (avoids layout shift).

## 8. Tailwind implementation notes

Suggested `tailwind.config.ts` token extension (values from Section 2–4):

```ts
theme: {
  extend: {
    colors: {
      navy: '#0F2D5B',
      blue: { DEFAULT: '#2865F6', strong: '#1E4FDC' },
      orange: { DEFAULT: '#F97316', strong: '#DC5F0A' },
      green: { DEFAULT: '#109861', strong: '#0C7C4F' },
      red: { DEFAULT: '#DC2626', strong: '#B91C1C' },
      ink: '#0F172A',
    },
    fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    borderRadius: { sm: '6px', md: '9px', lg: '14px' },
    boxShadow: {
      card: '0 1px 2px rgba(15,23,42,.06), 0 1px 0 rgba(15,23,42,.03)',
      pop:  '0 8px 24px rgba(15,23,42,.14), 0 2px 6px rgba(15,23,42,.08)',
    },
  },
}
```

Load Inter via `@fontsource/inter` (self-hosted, no external request at runtime — preferable to a Google Fonts `<link>` for a Vite app) with weights 400/500/600/700/800. Apply `tabular-nums` via Tailwind's `tabular-nums` utility (built in) on every numeric column and stat tile.

## 9. Open items / deferred

- **Dark mode** — fully specified (Artifact + Section 2.3) but not required for MVP; ship light-only first, add the `dark:` variant pass once the light UI is stable.
- **Icon set** — Lucide recommended (Section 5) but not yet installed/verified against every icon the final screens need.
- **Destructive button, error input state** — specified here to cover real app needs (player deletion, license-number validation per the app design spec's data model) that the source concept image didn't depict.
