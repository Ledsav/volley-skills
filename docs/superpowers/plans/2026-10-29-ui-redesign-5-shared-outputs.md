# UI Redesign 5: Shared Outputs (Award Cards, Story, Video, Training PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the outputs coaches share the v2 look (spec §9): the canvas award cards, story slides, summary PNG and video get v2 type, space and an accent glow, plus a new default "Night" preset. The training PDF gets a light, print-first Inter look with hairlines and outlined category pills. Content, slide logic, sizes, formats, timings and privacy gates stay exactly as they are.

**Precondition:** plans 4d (trainings, exercises, diagrams) and 4e (reports, stats, awards) are merged into the branch. This plan doesn't touch `AwardsPrepare`, `AwardsPresent`, `PaletteEditor`, `AwardsPage` or `TrainingViewSheet`. Before Task 1, record `BASE=$(git rev-parse HEAD)` for the Task 9 greps.

**Execution groups** (tasks inside a group run in order, because they share files):
- **A:** Tasks 1–2 (palette, canvas type).
- **B:** Tasks 3–5 (card and slide drawing).
- **C:** Tasks 6–8 (PDF). C can run before or after B.
- **D:** Task 9 (gate).

**Architecture:**
- **One drawing path.** Everything visual changes inside `src/awards/card/*`. `renderStoryFrame` and `drawAwardCard` still draw the live show, `CardThumbnail`, the PNGs (at `t = 1`) and every video frame, so all four change together. Nothing there reads CSS, the theme or the DOM (invariant 29).
- **A canvas type scale.** A new `card/type.ts` maps five roles (display, title, headline, body, caption) to Inter weights 500–700 and negative tracking. Tracking goes through `ctx.letterSpacing` where the browser has it. `textAt` gains a letter-spacing argument, and a new `fillTabular` lays the counting stat number out in fixed digit cells (a canvas can't use `tabular-nums`).
- **Glow, not discs.** A shared `drawGlow` (radial gradient in the slide's accent) replaces the background's solid accent disc and sits behind the player, the photo circle and the summary circles. The photo ring goes. With no photo, the jersey number stays; initials replace today's empty circle when there is no number either.
- **Night.** A new preset of four `#000000` colours is first in `PRESET_PALETTES`, so it is the default for anyone with no stored choice. The unchanged contrast rule gives it white ink and a white accent, which makes the glow white: a monochrome spotlight that matches the brand.
- **PDF.** Inter 4.1 static TTFs (Regular, SemiBold; OFL) are vendored under `src/trainings/pdf/fonts/` and fetched as hashed same-origin assets inside the already lazy `generateTrainingPdf`. Roboto's `vfs_fonts` is dropped. The pure builder gets v2 colours and hairline tables. Its category pills are sized by an injected `measure` (canvas `measureText` with the page's Inter in the browser, an estimate in tests). `fontSafe` stays as it is.
- **Brand.** The outputs carry no Volley Skills mark today, and they get none now or at cleanup. Cards carry only the club's logo, name and sponsors from data; the PDF carries no club or app branding (inventory 06, content boundary). Brand README §8 (cleanup) only touches in-app assets.

**Not in this plan:** the Prepare/Present screens and the palette editor (4e), the Present progress bar and controls, video timings and MIME, PNG and video file names, photo, cut-out and consent logic, story slide selection (`buildStory`, `storyStats`), the PDF's pages, order, page breaks, strings and file name, and the diagram renderer itself (`DiagramSvg`).

**Tech Stack:** TypeScript strict (noUnusedLocals/Parameters), Canvas 2D (`letterSpacing`, radial gradients), pdfmake 0.3.12 (`addVirtualFileSystem`, `addFonts`, `canvas` nodes), Vite `?url` assets, Vitest (jsdom; one node-environment test using pdfkit's bundled `fontkit` 2.0.4).

**Spec:**
- `docs/superpowers/specs/2026-10-28-ui-redesign-design.md`: §9 (shared outputs), §4.3 (pixel-level tests may change where they assert colours or positions), §5 (logo note), §10, §11 (increment 5).
- Parity contract: `docs/superpowers/specs/ui-redesign-inventory/05-reports-stats-awards.md` §16, §17, §19, invariants 24–38; `06-trainings-exercises-diagrams.md` "Training PDF".
- Design rules: `docs/design/design-system/README.md` §2.1, §2.2, §3 (type roles and tracking, never uppercase), §10 (brand in outputs); `docs/design/brand/README.md` §4, §8.

## Global Constraints

**Parity**
- `renderStoryFrame` stays the single path for the show, the summary PNG and the video, and `drawAwardCard` stays the path for card PNGs and thumbnails. Signatures of `renderStoryFrame`, `drawAwardCard`, `drawTitleCard`, `drawBackground`, `drawHeaderRow`, `drawSponsorRow`, `slideDurationMs`, `recordStory` and `buildTrainingDocDefinition` are unchanged, apart from the optional `measure` input in Task 7.
- Drawing stays deterministic for the same `t` (seeded confetti, no `Math.random`, no `Date`). The same calls are made for the same inputs.
- Card size 1080×1920, margin 60, header row, sponsor row (y 1740–1860, divider 1712), the 920 px text area and the beat timings are unchanged. No text leaves the card, crosses 920 px or enters the sponsor row.
- Photo consent gate, memory-only photos, cut-outs and logos, and the share warning are untouched. No new data reaches any output; the PDF's only player data stays the Team notes page.
- PDF: A4 portrait, margins `[40, 56, 40, 48]`, page order (cover, team notes, one page per unique existing exercise), page breaks, strings, file name, the two-tap share and `setUrlAccessPolicy(() => false)` are unchanged. `fontSafe` still runs on every printed string and the header and `info.title`, with the same mapping.
- Palettes: the five presets keep their ids and colours; `slideColors`, custom palettes and the keys `vcb.awards.palettes`, `vcb.awards.palette` and `vcb.awards.theme` keep working. A stored choice is never replaced.

**Visual (canvas)**
- Font family string stays `Inter, system-ui, sans-serif`. Weights are 500, 600 and 700 only (Inter 900 isn't even loaded today).
- Tracking is never positive. Fitting measures untracked text, so tracked text is never wider than measured.
- No `toUpperCase` on drawn text. The header row and stat kicker print as stored (sentence case, design system §3). This replaces invariant 31's "uppercase" under §4.3/§9.

**Visual (PDF)**
- Light only: ink `#1D1D1F`, ink-2 `#6E6E73`, ink-3 `#8E8E93`, separator `#DEDEE0`, warning `#C93400`. Level text colours come from `src/index.css` `:root` `-strong`: Beginner `#CD0014`, Developing `#C93400`, Advanced `#0040DD`, Elite `#1E7D37`. No blue outside the Advanced band, no header fills, no italics.

**Strings, data, gates**
- New strings go in `src/i18n/en/*.ts` and `src/i18n/it/*.ts` (the repo's only catalogs). The only new string is the Night preset name.
- No Firestore, rules or index change. No new npm dependency: the Inter TTFs are vendored assets under the SIL OFL, with `OFL.txt` next to them.
- Never commit `serviceAccountKey.json` (or `.enc`), `*.vsbackup`, private keys, `.env.local` or `reference/`. Commit only as the steps say; don't push or merge.
- Gates per group: `npm test`, `npm run lint` (0 errors), `npm run build`.

## Review Focus

1. **A coach who already chose a palette, or still has the legacy `vcb.awards.theme`, opens awards after the update.** They keep their palette; only a coach with nothing stored gets Night. A legacy theme with an unknown preset still migrates onto Navy, as it did before.
   - Pinned in Task 1 by "a stored preset choice is kept" and "a legacy theme with an unknown preset still migrates onto Navy".
2. **Very long names, Italian kickers and long opponent names after the type change.** No line leaves the 920 px area, goes off the card or enters the sponsor row.
   - Pinned by the existing "long text never leaves the card" tests in `drawSlide.test.ts`, which must pass unchanged (Tasks 3–5), and by "tracking is never positive" in Task 2.
3. **A browser whose canvas has no `letterSpacing` (older Safari on a coach's iPad).** Text draws untracked; nothing throws, and show, PNG and video still work.
   - Pinned in Task 2 by "textAt draws untracked when the context has no letterSpacing".
4. **Player names outside basic Latin (Łukasz, Dvořák, Ștefan) and arrows typed by coaches, in the PDF.** Every letter prints in Inter, and arrows are still swapped by `fontSafe`.
   - Pinned in Task 6 by "the bundled Inter covers the letters and marks the PDF prints", and by the existing arrows test.
5. **The font files fail to load while building a PDF (offline, flaky network).** `generateTrainingPdf` rejects, so the sheet shows its existing error. No half-built PDF and no remote URL.
   - Pinned in Task 6 by "a font that fails to load rejects and builds nothing" and "a failed font response rejects".

---

## File Structure

| File | Responsibility |
|---|---|
| `src/awards/palette.ts` (modify), `src/i18n/{en,it}/awards.ts` (modify) | Night preset first; legacy fallback by id |
| `src/awards/card/type.ts` (create) | Canvas roles: weight, tracking, `fontFor`, `trackPx` |
| `src/awards/card/wrapText.ts` (modify) | `textAt` letter spacing; `fillTabular` |
| `src/awards/card/testCtx.ts` (modify) | `letterSpacing` state, `charWidth`, `runs()` |
| `src/awards/exportCards.ts` (modify) | `ensureCardFonts` loads 500/600/700 |
| `src/awards/card/glow.ts` (create) | `drawGlow`, `hexAlpha` |
| `src/awards/card/branding.ts` (modify) | Sentence-case caption header row |
| `src/awards/card/drawAwardCard.ts` (modify) | Glow background, v2 card and title card |
| `src/awards/card/initials.ts` (create) | `initialsOf` |
| `src/awards/card/drawSlide.ts` (modify) | v2 intro, stat (tabular count-up), summary |
| `src/trainings/pdf/fonts/{Inter-Regular.ttf,Inter-SemiBold.ttf,OFL.txt,fontkit.d.ts}` (create) | Vendored PDF font and its licence |
| `src/trainings/pdf/pdfFonts.ts` (create) | Font family, file map, VFS loader |
| `src/trainings/pdf/measureText.ts` (create) | Browser text measure for pills |
| `src/trainings/pdf/exportTrainingPdf.ts` (modify) | Inter instead of Roboto; passes `measure` |
| `src/trainings/pdf/buildTrainingPdf.ts` (modify) | v2 colours, styles, hairlines, pills |
| `src/trainings/pdf/diagramToPdfSvg.ts` (modify) | `LIGHT_TOKENS` synced to v2 `:root` |

---

### Task 1: The Night preset

**Files:**
- Modify: `src/awards/palette.ts`, `src/i18n/en/awards.ts`, `src/i18n/it/awards.ts`
- Test: `src/awards/palette.test.ts`, `src/awards/card/drawAwardCard.test.ts`, `src/awards/card/drawSlide.test.ts`, `src/awards/card/branding.test.ts`

**Interfaces:**
- Produces: `PRESET_PALETTES[0]` is `{ id: 'night', name: 'Night', colors: ['#000000', '#000000', '#000000', '#000000'] }`, followed by navy, gold, court, light and wrapped, unchanged. So `readPalettePrefs()` with nothing stored, and AwardsPrepare's "Delete palette", select Night without any code change there.
- `migrateOldTheme` falls back to `PRESET_PALETTES.find((p) => p.id === 'navy')!` instead of index 0. Legacy users had Navy as their default.
- `paletteNames.night`: en `'Night'`, it `'Notte'`.

- [ ] **Step 1: Failing tests** in `palette.test.ts`:
  - `it('a coach who never chose a palette gets Night')`: `readPalettePrefs().selectedId === 'night'`.
  - `it('Night is true black with white ink and a white accent')`: for i 0–3, `slideColors(night, i)` is `{ bg: '#000000', text: '#FFFFFF', accent: '#FFFFFF' }`.
  - `it('a stored preset choice is kept')`: `vcb.awards.palette = 'navy'` and `vcb.awards.palettes = '[]'` give `selectedId 'navy'`.
  - `it('a legacy theme with an unknown preset still migrates onto Navy')`:
    - `{ presetId: 'ghost', custom: null }` gives `selectedId 'navy'`;
    - `{ presetId: 'ghost', custom: { from: '#123456', to: '#654321' } }` gives a custom palette whose `colors.slice(2)` equals navy's `colors.slice(2)`.
- [ ] **Step 2:** Run `npx vitest run src/awards/palette.test.ts`. Expected: FAIL on the first, second and fourth tests.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Pin card tests to Navy.** In `drawAwardCard.test.ts`, `drawSlide.test.ts` and `branding.test.ts`, replace `PRESET_PALETTES[0]` with `const NAVY = PRESET_PALETTES.find((p) => p.id === 'navy')!` so they keep testing a colourful rotation (selector-level change, no assertion change).
- [ ] **Step 5:** Run `npx vitest run src/awards src/i18n`. Expected: PASS. If `AwardsPresent.test.tsx`, `exportVideo.test.ts` or `AwardsPrepare.test.tsx` fail only because the first preset is now black, pin them to `NAVY` the same way and change nothing else.
- [ ] **Step 6: Commit** `feat(awards): Night preset, the default for coaches who never chose one (§9)`

### Task 2: Canvas type roles, tracking and tabular digits

**Files:**
- Create: `src/awards/card/type.ts`, `src/awards/card/type.test.ts`
- Modify: `src/awards/card/wrapText.ts`, `src/awards/card/testCtx.ts`, `src/awards/exportCards.ts`
- Test: `src/awards/card/wrapText.test.ts`

**Interfaces:**
- Produces (`type.ts`):
  ```ts
  export const FAMILY = 'Inter, system-ui, sans-serif';
  export type Role = 'display' | 'title' | 'headline' | 'body' | 'caption';
  export const ROLE: Record<Role, { weight: 500 | 600 | 700; tracking: number }>;
  // display 700 −0.035 · title 700 −0.02 · headline 600 −0.01 · body 500 −0.005 · caption 500 0
  export function fontFor(role: Role, size: number): string; // `${weight} ${size}px ${FAMILY}`
  export function trackPx(role: Role, size: number): number; // Math.round(tracking * size * 10) / 10, never > 0
  ```
- `wrapText.ts`:
  - `FAMILY` is imported from `type.ts` (one family string).
  - `textAt(ctx, s, x, y, font, color, alpha, align = 'left', letterSpacing = 0)`. Inside its existing `save`/`restore`, it sets `ctx.letterSpacing = `${letterSpacing}px`` only when `letterSpacing !== 0 && 'letterSpacing' in ctx`.
  - New `fillTabular(ctx, s, x, y, font, color, alpha, align: 'left' | 'center' | 'right', letterSpacing = 0): void`. It sets `font`, then `cell = measureText('0').width + letterSpacing`. A digit advances `cell` and draws `textAlign 'center'` at its cell's middle; any other character advances `measureText(ch).width + letterSpacing` and draws `textAlign 'left'`. The run starts at `x`, `x − total/2` or `x − total` by `align`. It uses `save`/`restore` and `globalAlpha`, and draws nothing when `alpha <= 0`. It never sets `letterSpacing` (spacing is manual).
- `testCtx.ts`: `recordingCtx(opts: { charWidth?: (ch: string) => number; noLetterSpacing?: boolean } = {})`.
  - `measureText` sums `charWidth(ch) * size` (default `0.55` for every character).
  - The initial state has `letterSpacing: '0px'` unless `noLetterSpacing` is set, so `'letterSpacing' in ctx` holds and `set:letterSpacing` is recorded.
  - It also returns `runs(): string[]`: consecutive `fillText` calls with the same `y` joined into one string.
- `ensureCardFonts` loads `['700 120px Inter', '600 52px Inter', '500 36px Inter']`.

- [ ] **Step 1: Failing tests.**
  - `type.test.ts`:
    - `it('maps roles to Inter at 500–700')`: `fontFor('display', 120) === '700 120px Inter, system-ui, sans-serif'` and `fontFor('caption', 32)` starts with `'500 '`.
    - `it('tracking is never positive')`: for every role and the sizes 30, 120 and 320, `trackPx(role, size) <= 0`; `trackPx('display', 120) === -4.2`.
  - `wrapText.test.ts`:
    - `it('textAt applies letter spacing inside save/restore')`: `set:letterSpacing` `'-4.2px'` sits between a `save` and the `fillText`.
    - `it('textAt draws untracked when the context has no letterSpacing')`: `recordingCtx({ noLetterSpacing: true })` gives a `fillText` and no `set:letterSpacing`, with no throw.
    - `it('fillTabular keeps every digit in a fixed-width cell')`: use `charWidth: (c) => (c === '1' ? 0.3 : 0.55)`. Left-aligned at x 0 and the same font, `'11%'` and `'40%'` draw `'%'` at the same x, and each character is its own `fillText`.
    - `it('fillTabular centres the run on x')`: for `'68%'` centred at 540 (cell 0.55 × size, `'%'` 0.55 × size), the `'6'` is drawn at `540 − total/2 + cell/2`.
- [ ] **Step 2:** Run `npx vitest run src/awards/card/type.test.ts src/awards/card/wrapText.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/awards`. Expected: PASS, with every existing test unchanged.
- [ ] **Step 5: Commit** `feat(awards): canvas type roles, tracking and tabular digits (§9)`

### Task 3: Accent glow and the caption header row

**Files:**
- Create: `src/awards/card/glow.ts`, `src/awards/card/glow.test.ts`
- Modify: `src/awards/card/drawAwardCard.ts` (`drawBackground` only), `src/awards/card/branding.ts` (`drawHeaderRow` only)
- Test: `src/awards/card/branding.test.ts`, `src/awards/card/drawAwardCard.test.ts`

**Interfaces:**
- Consumes `fontFor`, `trackPx` and `textAt(…, letterSpacing)` (Task 2).
- Produces:
  ```ts
  export function hexAlpha(hex: string, alpha: number): string; // '#RRGGBB' → '#RRGGBBAA', alpha clamped 0–1
  export function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number): void;
  // nothing when alpha <= 0; radial gradient (x,y,0)→(x,y,radius), stops hexAlpha(color, alpha) → hexAlpha(color, 0), fills its bounding square
  ```
- `drawBackground`: the flat `colors.bg` fill and the optional texture (35% × alpha, cover-fit) stay. The solid `0.18` accent disc becomes `drawGlow(ctx, sameX, sameY, 620, colors.accent, 0.22)` at today's seeded position.
- `drawHeaderRow`: no `toUpperCase`. Left text `fitBlock(…, ROLE.caption.weight, 32, …)` in `colors.text`; right text `fitBlock(…, ROLE.caption.weight, 30, …)` in `colors.muted`. Same row, logo rule and widths.

- [ ] **Step 1: Failing tests.**
  - `glow.test.ts`:
    - `it('hexAlpha appends the alpha byte')`: `hexAlpha('#F97316', 0.4) === '#F9731666'`.
    - `it('drawGlow paints a radial gradient and skips a zero alpha')`.
  - `drawAwardCard.test.ts`: `it('the background glows softly in the accent instead of a solid disc')`: `createRadialGradient` is recorded and no `set:globalAlpha` is `0.18`.
- [ ] **Step 2:** Run `npx vitest run src/awards/card`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Assertion changes mapped to §9** (caption style, sentence case):
  - `branding.test.ts` "header row…": `['U17 Girls', 'Season 2026-27']` and `['Demo VC · U17 Girls']`.
  - `drawAwardCard.test.ts` "at t=1…": `'Demo VC · U17 Girls'` and `'vs Rivals · 12 Oct 2026'`; "header shows only the team…": `'U17 Girls'`.
  - The "a background image…" `0.35` assertion is unchanged.
- [ ] **Step 5:** Run `npx vitest run src/awards`. Expected: PASS, including both "long text never leaves the card" tests unchanged.
- [ ] **Step 6: Commit** `feat(awards): accent glow background and sentence-case caption header (§9)`

### Task 4: The award card and title card in v2

**Files:**
- Create: `src/awards/card/initials.ts`, `src/awards/card/initials.test.ts`
- Modify: `src/awards/card/drawAwardCard.ts`
- Test: `src/awards/card/drawAwardCard.test.ts`

**Interfaces:**
- Consumes `ROLE`, `fontFor`, `trackPx`, `textAt` (Task 2) and `drawGlow` (Task 3).
- Produces `initialsOf(name: string): string`: the first letter (`\p{L}`) of each of the first two words, uppercased; `''` when there is none. `'Lena P.'` gives `'LP'`, `'Ana'` gives `'A'`.
- **`drawAwardCard`** layout values; everything not listed is unchanged:
  - `TITLE_TOP` 280. The award title uses `fitBlock(…, 700, 112, TITLE_W, 3)`, line height `size * 1.04`, `colors.accent`, tracking `trackPx('display', size)`.
  - Name: `fitBlock(…, 700, 100, NAME_W, 2)`, `colors.text`, tracking `trackPx('title', size)`. The letter-by-letter reveal is unchanged.
  - Stat or note: `fitBlock(…, 500, 46, STAT_W, 1 | 2)` with the same one-line rule (keep one line when size ≥ 34), `colors.muted`, tracking `trackPx('body', size)`.
  - Cut-out: before the strips, `drawGlow(ctx, x + w / 2, top + h * 0.45, h * 0.62, colors.accent, 0.42 * e)`.
  - Photo circle: before it, `drawGlow(ctx, cx, cy, r * 1.7, colors.accent, 0.42 * Math.min(1, s))`. The circle clips the photo, with no accent fill and no ring (`stroke` removed). The light sweep stays (photo only).
  - No photo: no circle. The text is `String(number)` or, when `number === null`, `initialsOf(card.name)`. It is drawn in `fontFor('display', round(r))`, `colors.text`, centred at (cx, cy) inside the same scale transform, on the glow.
  - Confetti, beats, sponsor row and header are unchanged.
- **`drawTitleCard`**: the title is `fitBlock(…, 700, 112, CARD_W − 2·MARGIN − 40, 3)` in `colors.text` with `trackPx('display', size)`. Glow pulse and layout are unchanged.

- [ ] **Step 1: Failing tests.**
  - `initials.test.ts`: `it('takes the first letters of the first two words')`, using `'Lena P.'`, `'ana maría lópez'` (`'AM'`), `'  '` (`''`) and `'Łukasz Nowak'` (`'ŁN'`).
  - `drawAwardCard.test.ts`:
    - `it('draws only 500–700 weights')`: every `set:font` matches `/^(500|600|700) [\d.]+px Inter, system-ui, sans-serif$/`, for the card at t=1 with and without a cut-out, and for `drawTitleCard`.
    - `it('draws the award title with display tracking')`: the last `set:letterSpacing` before the `'MVP'` `fillText` parses below 0.
    - `it('the player stands on a soft accent glow')`: a `createRadialGradient` is recorded before the first cut-out `drawImage`, and its x lies inside that draw's x range.
    - `it('the photo circle has no ring')`: with `photo: fakeImage`, there is no `stroke` call.
    - `it('with no photo and no number the card shows the initials')`: `number: null` gives `texts()` containing `'LP'`.
- [ ] **Step 2:** Run `npx vitest run src/awards/card`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/awards`. Expected: PASS. These must pass unchanged: "name and stat share one row", "with sponsors…", "draws the jersey number when there is no photo…", "shows the whole cut-out player…", "is deterministic for the same t", "at t=0 nothing but the background", "omits the stat line…", "title card shows only the award title", `CardThumbnail` users, and all of `drawSlide.test.ts`.
- [ ] **Step 5: Commit** `feat(awards): v2 award card — display type, glow behind the player, initials fallback (§9)`

### Task 5: Story slides in v2

**Files:**
- Modify: `src/awards/card/drawSlide.ts`, `src/awards/card/drawAwardCard.ts` (the `text` helper only)
- Test: `src/awards/card/drawSlide.test.ts`

**Interfaces:**
- Consumes Task 2's roles, `textAt` and `fillTabular`, Task 3's `drawGlow`, Task 4's `initialsOf` and `drawTitleCard`.
- `text()` (the centred helper in `drawAwardCard.ts`) gains an optional `letterSpacing = 0` passed to `textAt`. Values per slide; slide order, durations, wipe, `done` and reduced motion are unchanged:
  - **intro:**
    - words / wrapped lines `fitBlock(…, 700, 170, TEXT_W, 4)` and the same punch-in rule (`fitFontSize(ctx, w, 700, 170, TEXT_W) === 170`), tracking `trackPx('display', rowSize)`; the last line is in accent;
    - subtitle `fitBlock(…, 500, 56, TEXT_W, 1)`, muted, `trackPx('body', …)`.
  - **stat:**
    - kicker as stored (no `toUpperCase`) `fitBlock(…, 500, 56, TEXT_W, 1)` in accent;
    - big number `finalSize = fitFontSize(ctx, finalString.replace(/\d/g, '0'), 700, 320, TEXT_W)`, drawn with `fillTabular(…, 'center', trackPx('display', finalSize))`, count-up unchanged;
    - caption `fitBlock(…, 600, 60, TEXT_W, 3)`, text colour, `trackPx('headline', …)`;
    - detail `fitBlock(…, 500, 44, TEXT_W, 2)`, muted.
  - **summary:**
    - `winnersTitle` `fontFor('title', 112)`, accent, `trackPx('title', 112)`;
    - per winner, `drawGlow(ctx, cx, cy, r * 1.6, colors.accent, 0.35 * clamp(appear))` before the circle; the circle clips the cut-out or photo, with no accent fill;
    - with no image, `String(number)` or `initialsOf(name)` in `fontFor('display', round(r))`, text colour;
    - award title `fitBlock(…, 500, 34, …)` muted; name `fitBlock(…, 600, 46, …)` text colour.

- [ ] **Step 1: Failing tests.**
  - `it('every slide draws only 500–700 weights')`: for every index of `slides` and `longSlides` at `1e9` with reduced motion, every `set:font` matches the Task 4 regex.
  - `it('the stat kicker prints as stored, not uppercased')`: `'Side-out'` is present and `'SIDE-OUT'` absent.
  - `it('the counting number is laid out digit by digit')`: at `10_000`, `runs()` contains `'68%'` and `texts()` contains `'6'`, `'8'` and `'%'` as separate calls.
  - `it('summary winners sit on accent glows')`: the summary frame records at least `deps.cards.length` `createRadialGradient` calls beyond the background's one.
- [ ] **Step 2:** Run `npx vitest run src/awards/card/drawSlide.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Assertion changes mapped to §9.** "stat: counts up…" reads `runs()` instead of `texts()` (selector) and expects `['Side-out', '68%']` (sentence case). `'0%'` is read through `runs()`.
- [ ] **Step 5:** Run `npx vitest run src/awards`. Expected: PASS. These must pass unchanged: "intro: every word…", "long caption wraps…", "reduced motion…", "suspense never reports done…", "reveal shows the winner name; summary lists…", "wipes from the previous colour…", "durations…", both "long text never leaves the card" tests, `exportVideo.test.ts`, `exportCards.test.ts`, `AwardsPresent.test.tsx` and `AwardsPage.test.tsx`.
- [ ] **Step 6: Commit** `feat(awards): v2 story slides — display type, tabular count-up, glowing summary (§9)`

### Task 6: Inter in the PDF

**Files:**
- Create: `src/trainings/pdf/fonts/Inter-Regular.ttf`, `src/trainings/pdf/fonts/Inter-SemiBold.ttf`, `src/trainings/pdf/fonts/OFL.txt`, `src/trainings/pdf/fonts/fontkit.d.ts`, `src/trainings/pdf/fonts/coverage.test.ts`, `src/trainings/pdf/pdfFonts.ts`, `src/trainings/pdf/pdfFonts.test.ts`
- Modify: `src/trainings/pdf/exportTrainingPdf.ts`, `src/trainings/pdf/buildTrainingPdf.ts` (`defaultStyle.font` only)
- Test: `src/trainings/pdf/exportTrainingPdf.test.ts`

**Interfaces:**
- Produces (`pdfFonts.ts`):
  ```ts
  export const PDF_FONT = 'Inter';
  export const PDF_FONT_FILES = { normal: 'Inter-Regular.ttf', bold: 'Inter-SemiBold.ttf', italics: 'Inter-Regular.ttf', bolditalics: 'Inter-SemiBold.ttf' } as const;
  export function toBase64(bytes: Uint8Array): string; // chunked String.fromCharCode + btoa
  export async function loadPdfFontVfs(fetchBytes?: (url: string) => Promise<ArrayBuffer>): Promise<Record<string, string>>;
  // keys 'Inter-Regular.ttf' and 'Inter-SemiBold.ttf'; URLs from `import x from './fonts/Inter-Regular.ttf?url'`
  // default fetchBytes: fetch(url), throws on !res.ok, then res.arrayBuffer()
  ```
- `fontkit.d.ts`: `declare module 'fontkit' { export function create(buffer: Uint8Array): { hasGlyphForCodePoint(codePoint: number): boolean } }`. The test uses pdfkit's own `fontkit` 2.0.4; no dependency is added.
- `generateTrainingPdf` runs `Promise.all([getExercisesByIds(ids), import('pdfmake/build/pdfmake'), loadPdfFontVfs()])`, then `pdfMake.addVirtualFileSystem(vfs)` and `pdfMake.addFonts({ [PDF_FONT]: PDF_FONT_FILES })`. The `vfs_fonts` import is removed. `setUrlAccessPolicy(() => false)` stays.
- The builder's `defaultStyle` gains `font: PDF_FONT`, so pdfmake also gives SVG text (zone and player labels) Inter.
- Bold is SemiBold (600), matching v2's weights. Italic maps to the upright files (Task 7 removes the two italic uses).

- [ ] **Step 1: Vendor the font.** Download `https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip` into the scratchpad. Copy `extras/ttf/Inter-Regular.ttf` and `extras/ttf/Inter-SemiBold.ttf` into `src/trainings/pdf/fonts/`, and `LICENSE.txt` in as `OFL.txt`. Use the static TTFs, never the variable font. If the download fails, stop and report BLOCKED; never substitute another font.
- [ ] **Step 2: Failing tests.**
  - `coverage.test.ts` (`// @vitest-environment node`): `it('the bundled Inter covers the letters and marks the PDF prints')`. Each file is read with `readFileSync`; `fontkit.create` gives `hasGlyphForCodePoint` true for every code point of `'AaZz09àèéìòùçñßäöüÀÉÈÇÑłŁřŘőŐșțğĞčšžąęėÿЖжΩω‹›·–—‘’“”…•€%#&'`.
  - `pdfFonts.test.ts`:
    - `it('reads both font files once and stores them as base64')`: the fake `fetchBytes` returns `new Uint8Array([0, 1, 2]).buffer`; both keys are `'AAEC'`, and it is called twice with different URLs.
    - `it('a failed font response rejects')`: `vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))`, and the default loader rejects.
  - `exportTrainingPdf.test.ts`:
    - replace the `vfs_fonts` mock with `vi.mock('./pdfFonts', async (orig) => ({ ...(await orig<typeof import('./pdfFonts')>()), loadPdfFontVfs: vi.fn() }))`, resolving `{ 'Inter-Regular.ttf': 'r', 'Inter-SemiBold.ttf': 's' }`;
    - add `addFonts` to the pdfmake mock;
    - `it('embeds Inter from the bundled font files')`: `addVirtualFileSystem` is called with that object; `addFonts` with `{ Inter: PDF_FONT_FILES }`; `createPdf.mock.calls[0][0].defaultStyle.font === 'Inter'`;
    - `it('a font that fails to load rejects and builds nothing')`: the loader rejects, `generateTrainingPdf` rejects and `createPdf` is not called.
- [ ] **Step 3:** Run `npx vitest run src/trainings/pdf`. Expected: FAIL.
- [ ] **Step 4:** Implement as specified above.
- [ ] **Step 5:** Run `npx vitest run src/trainings`. Expected: PASS. Every existing `exportTrainingPdf`, `buildTrainingPdf` and `TrainingViewSheet` test passes unchanged, including "never lets pdfmake fetch anything from a URL".
- [ ] **Step 6: Commit** `feat(trainings): embed Inter in the training PDF (§9)`

### Task 7: The PDF's v2 look and category pills

**Files:**
- Create: `src/trainings/pdf/measureText.ts`, `src/trainings/pdf/measureText.test.ts`
- Modify: `src/trainings/pdf/buildTrainingPdf.ts`, `src/trainings/pdf/exportTrainingPdf.ts`
- Test: `src/trainings/pdf/buildTrainingPdf.test.ts`, `src/trainings/pdf/exportTrainingPdf.test.ts`

**Interfaces:**
- `TrainingPdfInput` gains `measure?: (text: string, fontSize: number) => number`, the width in pt of regular-weight Inter. The default is `(s, size) => s.length * size * 0.56`.
- `measureText.ts`: `export async function pdfTextMeasure(): Promise<(text: string, fontSize: number) => number>`. It awaits `document.fonts?.load('400 8px Inter')` (errors swallowed) and uses one offscreen canvas 2D context (`ctx.font = `400 ${size}px Inter``, returning `measureText(s).width`). With no context it returns the default estimate. `generateTrainingPdf` passes `measure: await pdfTextMeasure()`.
- **Colours and styles:**
  - constants `INK '#1D1D1F'`, `INK_2 '#6E6E73'`, `INK_3 '#8E8E93'`, `SEPARATOR '#DEDEE0'`, `WARN '#C93400'`; `LEVEL_COLOR` per Global Constraints;
  - `BLUE`, `SLATE`, `BORDER` and `BG` are deleted;
  - `label { fontSize 9, bold, color INK_2 }`;
  - `title { 24, bold, characterSpacing −0.48 }`, `h1 { 18, bold, characterSpacing −0.31 }`, `h2 { 13, bold, characterSpacing −0.16 }` (margins unchanged);
  - `facts`, `muted`, `th`, `caption`, header and footer use `INK_2`;
  - `defaultStyle { font: PDF_FONT, fontSize 10, color INK, lineHeight 1.25 }`.
- **Tables:** one shared layout `HAIRLINE: { hLineWidth: (i) => (i === 0 ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => SEPARATOR, paddingTop: () => 6, paddingBottom: () => 6 }`, with no `fillColor`. The cover table widths become `[18, '*', 80, 52, 30, 50]`. The team notes widths are unchanged.
- **No italics:** "Deleted exercise" is `{ color: WARN }` and "Not rated" is `{ color: INK_2 }`.
- **Pills.** `chip(label: string, measure, maxWidth?: number): Content`:
  - `w = Math.ceil(measure(label, 8)) + 11` (padding 5 each side, plus 1);
  - when `maxWidth !== undefined && w > maxWidth`, it is `{ text: label }`;
  - otherwise `{ stack: [{ canvas: [{ type: 'rect', x: 0, y: 0, w, h: 13, r: 6.5, lineWidth: 0.5, lineColor: INK_3 }] }, { text: label, fontSize: 8, color: INK, margin: [5, -10.5, 0, 0] }], width: w, unbreakable: true }`.

  Pills are used in three places:
  - the cover table Category cell: `chip(label, measure, 72)`;
  - the Targets row: `{ columns: [{ text: p.targets, bold: true, width: 'auto' }, ...targets.map((x) => chip(label, measure))], columnGap: 4, style: 'facts' }`;
  - the exercise page: the category leaves the facts string, and the row is `{ columns: [chip(category, measure), { text: facts, style: 'facts', width: '*' }], columnGap: 8 }`.

  Labels stay inside `text`, so `fontSafeTree` still covers them.

- [ ] **Step 1: Failing tests.**
  - `buildTrainingPdf.test.ts` (reusing `walk`):
    - `it('prints in Inter on a light, monochrome page')`: `def.defaultStyle` includes `{ font: 'Inter', color: '#1D1D1F' }`; `JSON.stringify(def)` contains none of `'#2865F6'`, `'#F8FAFC'`, `'#0F172A'` or `'"italics":true'`.
    - `it('separates table rows with hairlines and no header fill')`: every node with a `table` has `layout.hLineColor()` `'#DEDEE0'` and no `layout.fillColor`.
    - `it('draws categories as outlined pills sized to the label')`: with `measure: (s, n) => s.length * n * 0.5`, a stack holds `text 'Service'` with `canvas[0]` matching `{ type: 'rect', w: 39, h: 13, r: 6.5, lineWidth: 0.5, lineColor: '#8E8E93' }`.
    - `it('falls back to plain text when a pill would not fit its column')`: with `measure: () => 500`, the cover table has no `rect` canvas and still prints `'Service'`.
    - `it('colours level labels with the v2 band text colours')`: the team notes node with text `'Advanced'` has color `'#0040DD'`.
  - `measureText.test.ts`:
    - `it('measures with Inter on a canvas')`: stub `HTMLCanvasElement.prototype.getContext` to return `{ font: '', measureText: (s: string) => ({ width: s.length * 3 }) }`; `(await pdfTextMeasure())('abc', 8) === 9`, and the context's font is `'400 8px Inter'`.
    - `it('falls back to the estimate without a canvas')`: `getContext` returns null, and `('abc', 10)` is `toBeCloseTo(16.8)`.
  - `exportTrainingPdf.test.ts`: mock `./measureText`. `it('sizes pills with the browser measure')`: `createPdf` is called after `pdfTextMeasure` resolved, with the cover table's chip `w` computed from the mocked measure.
- [ ] **Step 2:** Run `npx vitest run src/trainings/pdf`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/trainings src/i18n`. Expected: PASS. These must pass unchanged:
  - "starts one new page per unique existing exercise…" (2 page breaks, `'Deleted exercise'`);
  - "leaves out…" and "shows suggested players, targets…" (`'Targets'`, `'Reception'`);
  - "exports a cover page only…", "is A4 portrait…", every team notes test (3 page breaks, `'U17  ·  2026-10-24  ·  2 expected players'`, "Not rated"), "turns arrows into a glyph the font has…";
  - every Italian test.
- [ ] **Step 5: Commit** `feat(trainings): v2 training PDF — ink text, hairlines, outlined category pills (§9)`

### Task 8: Diagram colours in step with v2

**Files:**
- Modify: `src/trainings/pdf/diagramToPdfSvg.ts`
- Test: `src/trainings/pdf/diagramToPdfSvg.test.ts`

**Interfaces:**
- `LIGHT_TOKENS` is set to the `:root` values in `src/index.css`:
  - `navy 35 86 168`, `bg 245 245 247`, `surface 255 255 255`, `surface-2 242 242 247`, `surface-3 229 229 234`;
  - `ink 29 29 31`, `ink-2 110 110 115`, `ink-3 142 142 147`, `separator 222 222 224`;
  - `slate 110 110 115`, `border 222 222 224`;
  - `red 255 59 48`, `red-strong 205 0 20`, `orange 255 149 0`, `orange-strong 201 52 0`;
  - `blue 0 122 255`, `blue-strong 0 64 221`, `green 52 199 89`, `green-strong 30 125 55`.

  It had drifted: ink was still `#0F172A`. The unknown-token fallback stays ink.

- [ ] **Step 1: Failing tests.**
  - `it('every inlined colour matches the light theme in index.css')`:
    - read `src/index.css` with `readFileSync(fileURLToPath(new URL('../../index.css', import.meta.url)), 'utf8')`;
    - take the text from `:root {` to the first `\n}`, and parse `--color-([a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)`;
    - for every key of `LIGHT_TOKENS`, the parsed triplet equals it.
  - `it('covers every colour a diagram can draw')`: every `PALETTE_COLORS` entry, plus `'surface'`, is a key of `LIGHT_TOKENS`.
- [ ] **Step 2:** Run `npx vitest run src/trainings/pdf/diagramToPdfSvg.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Assertion changes mapped to §9** ("light colours inlined", now the v2 light theme):
  - "replaces a theme colour…" expects `rgb(29,29,31)`;
  - "turns a colour with alpha…" expects `rgba(0,122,255,0.1)`;
  - "falls back to ink…" expects `rgb(29,29,31)`;
  - "keeps ink in step with index.css" is deleted (superseded by the parity test).
- [ ] **Step 5:** Run `npx vitest run src/trainings src/diagrams`. Expected: PASS, and every `diagramToPdfSvg` crop test is unchanged.
- [ ] **Step 6: Commit** `fix(trainings): PDF diagram colours follow the v2 light theme`

### Task 9: Gate and user checklist

**Files:** none new.

- [ ] **Step 1:** Run `npm test`, `npm run lint` and `npm run build`. Expected: all green, with 0 lint errors.
- [ ] **Step 2: Greps.** Each should print nothing:
  - `grep -rnE "(800|900) \\$\\{|'(800|900) " src/awards/card src/awards/exportCards.ts --include=*.ts | grep -v test | grep -v fitName` (fitName is unused and out of scope);
  - `grep -rn "toUpperCase" src/awards/card --include=*.ts | grep -v test | grep -v initials.ts`;
  - `grep -rn "vfs_fonts" src` and `ls dist/assets | grep -i vfs_fonts`;
  - `git diff --stat $BASE -- src/awards/story src/awards/AwardsPresent.tsx src/awards/AwardsPrepare.tsx src/awards/PaletteEditor.tsx src/awards/exportVideo.ts src/awards/photoGate.ts src/awards/cutout firestore.rules firestore.indexes.json`.
- [ ] **Step 3:** `ls dist/assets | grep -E "Inter-(Regular|SemiBold).*\.ttf"` prints two files. The PDF's JS chunk no longer embeds Roboto.
- [ ] **Step 4: Commit** any lint-only fix-ups as `chore(outputs): gate fix-ups`, if there are any.
- [ ] **Step 5: User checklist** for the group report. The user runs it on a phone and a desktop.
  - **Night.** In a fresh browser profile (or after clearing `vcb.awards.palette*`), awards open on Night: black slides, white type, a soft white glow behind the player. A profile that had Navy keeps Navy.
  - **Cards.** For a winner with a cut-out: a large tracked title, the player on a glow, and the name and stat on one row. For a winner with no consent, the jersey number sits on a glow; with no number either, the initials. With 6 sponsors, nothing enters the sponsor row. Try Clean Light and Wrapped too.
  - **Story.** The header reads "Demo VC · U17 Girls" in sentence case. The stat kicker isn't uppercased, and the counting number doesn't wobble. The summary shows winners on glows. Then try Present on an iPad/Safari.
  - **Exports.** Share one card PNG, the summary PNG and a recorded video: they match what Present shows.
  - **PDF.** Share a training PDF from a calendar session with team notes, and open it on a phone. Check:
    - Inter everywhere, ink text, hairline table rows, no blue label;
    - outlined category pills in the session plan, the Targets row and each exercise page;
    - levels coloured by band;
    - a player named "Łukasz Dvořák" prints correctly;
    - arrows typed in an exercise print as ›;
    - diagrams render in the v2 colours.
  - **Italian.** "Notte" in the palette list; the PDF in Italian with "Riscaldamento" fitting its pill.
