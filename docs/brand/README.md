# Volley Skills — logo guide

The mark is the **Spin Ball**: a volleyball reduced to three swirling panels, with a
halftone-dot crescent shadow inside the ball. The wordmark is "VOLLEY / SKILLS" in
Barlow Condensed Black Italic, converted to outlines, with SKILLS tracked to the width
of VOLLEY. Adopted 2026-10-13; it replaces the V badge.

All artwork lives in `src/assets/brand/`. Use the files; don't redraw or retype them.

## Files

| File | Use |
|---|---|
| `volley-skills-lockup.svg` | Primary lockup on white / light surfaces |
| `volley-skills-lockup-on-navy.svg` | Lockup on navy `#2356A8` or darker (sidebar, sign-in header) — what `Logo` renders |
| `volley-skills-lockup-mono.svg` / `-white.svg` | One-colour (deep navy / white): embroidery, single-colour print, photos |
| `volley-skills-mark.svg` | Ball with shadow, light surfaces — what `LogoMark` renders |
| `volley-skills-mark-on-navy.svg` | Ball with shadow, navy surfaces |
| `volley-skills-mark-small.svg` / `-small-on-navy.svg` | Dot-free ball for **anything under 48 px** |
| `volley-skills-mark-mono.svg` / `-white.svg` | One-colour ball |
| `volley-skills-app-icon.svg` | Rounded deep-navy tile (app icon, social avatar) |

Web icons in `public/`: `favicon.svg` (dot-free ball), `favicon.ico` (16/32/48),
`apple-touch-icon.png` (180).

## Colours

| Role | HEX | RGB |
|---|---|---|
| Navy (panel, SKILLS on light) | `#2356A8` | 35 86 168 |
| Deep navy (panel, VOLLEY on light, app tile) | `#12295A` | 18 41 90 |
| Ball yellow (panel, SKILLS on navy) | `#F5C518` | 245 197 24 |
| Light blue (navy panel, reversed) | `#9EB9EA` | 158 185 234 |
| Shadow dots on light: yellow / navy / deep | `#C99300` / `#12295A` / `#081634` | — |
| Shadow dots on navy: white / light blue | `#BFD0EF` / `#6F90CF` | — |

For print, have the printer match the HEX values. No CMYK or Pantone equivalents have
been specified yet.

## Clear space and minimum size

- **Clear space:** keep at least a quarter of the ball's diameter free on every side.
- **Lockup:** at least 96 px wide on screen, 30 mm in print.
- **Ball with dots:** 48 px or larger. Below that, use the `-small` mark: the dots turn to
  fuzz, and the favicon already uses the small mark.

## Don't

- Don't rotate the ball or change the panel colours or their order.
- Don't move the shadow, recolour the dots, or swap them for a blur or drop shadow.
- Don't retype the wordmark in a live font or change its tracking.
- Don't put the light lockup on navy or the on-navy lockup on white; use the matching file.
- Don't add outlines, glows or effects, and don't place the logo on busy photos
  without a solid backing.

## Trademark

A web search (2026-10-13) found no registered "Volley Skills" mark and no matching
three-panel blue/yellow volleyball logo. That is not a clearance. Before printing
merchandise, search TMview (EU) and the Benelux register (BOIP), or ask a trademark
attorney.
