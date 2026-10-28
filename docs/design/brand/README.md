# Volley Skills brand identity

**Status:** approved on 2026-10-28 (the "Spin" direction). It ships with the UI redesign on branch
`feature/ui-redesign`. Until that branch merges, the app still uses the 2026-10-13 colour Spin Ball documented in
[`docs/brand/README.md`](../../brand/README.md).

This document covers the identity: the mark, the wordmark, colour, icons and how to use them. The UI rules are in the
[design system](../design-system/README.md).

## 1. The idea

**The Spin Ball, in one colour.** A solid ball with three curved seams cut out of it, so the seams read as spin. It
keeps the shape the app has used since October 2026. The three colours and the halftone shadow are gone, so the mark:

- works as a single ink on any surface;
- reads at 16 px;
- sits on a black tile like a native app icon.

The wordmark is "Volley Skills" in Inter SemiBold, the same family as the interface, converted to outlines.

Brand voice in one line: **Players. Progress. Together.** It is calm, precise and coach-to-coach. Words describe what
happens, without hype.

## 2. Files

All masters are SVG in [`logo/`](logo/). Use the files; don't redraw them, retype the wordmark or rebuild the seams.

| File | Use |
|---|---|
| `volley-skills-mark.svg` | **The mark**, in ink `#1D1D1F`. Use it above 32 px. |
| `volley-skills-mark-small.svg` | **Small cut**: wider seams for **32 px and below** (favicon, tab, small avatars). |
| `volley-skills-mark-black.svg` / `-white.svg` | One colour, pure black or white (print, embroidery, photos, dark surfaces). |
| `volley-skills-mark-app-icon.svg` | White mark on a black rounded tile (app icon, social avatar). |
| `volley-skills-lockup.svg` (+ `-black`, `-white`) | **Horizontal lockup**: mark plus wordmark. The default whenever the name is shown. |
| `volley-skills-lockup-stacked.svg` (+ `-black`, `-white`) | **Stacked lockup**: mark above the wordmark, for square spaces such as posters and splash screens. |
| `web-icons/` | `favicon.svg` (adapts to light and dark tabs), `favicon.ico` (16/32/48), PNG favicons, `apple-touch-icon.png` (180), `icon-192/512.png`, `maskable-512.png`, `site.webmanifest`, `head-snippet.html` |

The design exploration that led here is kept in [`exploration/`](exploration/): the three concepts (Spin, Serve, Set)
and how each looked in context.

## 3. Construction

How the mark is built:

- A ball of radius 106 in a 256 grid, centred.
- Three seams. Each is a band around a circle of radius 56 whose centre sits 56 from the ball's centre, so every seam
  passes through the middle. The three are placed 120° apart.
- Each band is 16 wide (radius ±8). The **small cut** widens them to 24 (±12) so they stay open at 16 px.
- The seams cut straight through the rim. Where they meet, they leave a small three-pointed opening at the centre.
- The panels are real filled paths (12 anchors, one colour), not white shapes painted on top. The mark works on any
  colour, photo or material.

The lockup:

- The wordmark's cap height is 40% of the ball's diameter (84 on a 212 ball).
- The cap height is centred on the ball.
- The gap from the ball to the "V" is a quarter of the diameter (52).
- Inter's own kerning is applied, with −0.02 em tracking.

## 4. Colour

The identity is monochrome. Colour in the product means data (see design system §2.2), so the brand doesn't claim any
of it.

| Role | HEX | RGB | Use |
|---|---|---|---|
| Ink | `#1D1D1F` | 29 29 31 | The mark and wordmark on light surfaces |
| Black | `#000000` | 0 0 0 | The app icon tile, pure one-colour print |
| White | `#FFFFFF` | 255 255 255 | The mark on black, the app icon, dark surfaces |
| Paper | `#F5F5F7` | 245 245 247 | Light backgrounds for brand material |

For print: ink is near-black. Use rich black only on large tiles, and 100% K for the mark on paper. No Pantone or
CMYK values are specified yet; ask the printer to match the HEX.

## 5. Clear space and minimum size

- **Clear space:** a quarter of the ball's diameter on every side (the same as the gap between the mark and the
  wordmark).
- **Minimum size:**

  | Version | Screen | Print |
  |---|---|---|
  | Mark | 16 px (small cut) | 6 mm |
  | Horizontal lockup | 96 px wide | 25 mm |
  | Stacked lockup | 64 px wide | 18 mm |

- At 32 px and below, always use the small cut. The favicon already does.

## 6. Backgrounds

| Surface | Use |
|---|---|
| White, paper, light greys | Ink mark or lockup |
| Black, dark greys (the app's dark mode) | White mark or lockup |
| Photos | White or black mark on a calm area, or on the black tile. Never on a busy area. |
| App icon / avatar | The black tile with the white mark. In dark contexts, give the tile a 1 px `rgba(255,255,255,.16)` edge so it doesn't vanish. |

## 7. Don't

- Don't colour the mark with the data colours (red, orange, blue, green). Those mean levels and grades in the product.
- Don't bring back the blue/yellow panels or the halftone shadow of the old Spin Ball.
- Don't rotate the ball, change the number of seams, or thin the seams below the small cut at small sizes.
- Don't retype the wordmark in a live font, change its weight, or track it differently.
- Don't add outlines, glows, gradients, drop shadows or glass effects to the mark.
- Don't put the club's name inside the Volley Skills lockup. Clubs appear next to it, from data.

## 8. Moving into the app

Done during the redesign's cleanup increment, not before:

1. Copy `logo/*.svg` into `src/assets/brand/`, replacing the old Spin Ball files.
2. Update `Logo` / `LogoMark` in `src/components/Logo.tsx`. The lockup now sits on light and dark surfaces through
   the ink and white files, not an on-navy version.
3. Replace `public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and the
   maskable icon with the files in `logo/web-icons/`. Keep the existing `manifest.webmanifest` name and merge
   `theme_color` and icons from `site.webmanifest`.
4. Regenerate `public/og-image` with the new lockup.
5. Move `docs/brand/README.md` here as the history of the old mark, and point CLAUDE.md to this folder.

## 9. Trademark

A web search on 2026-10-13 found no registered "Volley Skills" mark and no matching ball logo. That search covered
the previous colour version, and it is not a clearance.
Three-seam ball marks are common in volleyball. Before printing merchandise, search TMview (EU) and BOIP (Benelux), or
ask a trademark attorney. Inter is under the SIL Open Font License, which allows use in a logo; the wordmark is
outlined.
