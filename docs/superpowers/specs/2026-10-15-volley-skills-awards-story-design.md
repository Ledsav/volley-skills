# Volley Skills — Awards "story" presentation (Wrapped-style)

Date: 2026-10-15
Status: Implemented (2026-10-15) — see `plans/2026-10-15-awards-story.md`
Companion to: `2026-10-14-volley-skills-home-stats-awards-design.md` (awards §), `2026-09-04-volley-skills-design-system.md`

## 1. Intent

**What the user asked for:** make the awards presentation feel like Spotify Wrapped. The setting is **a coach presenting to the room** (projector or TV at an end-of-season or post-match event). The coach must be able to **pick a palette or create their own**. A short **season story** before the awards is wanted, but it must be **toggleable**. Winners' photos should be able to have their **background removed on the device**, and nothing about a photo may leave the device or be saved. The result should be **shareable with players** without storing photos. For now that means files exported from the coach's device.

**Assumptions (accepted when the user approved the design):**
- The coach controls the pace; there is no auto-advance.
- Three story slides: record, one team strength, best rotation. The toggle defaults to on.
- Photos and cut-outs are only allowed for players whose consent is marked as given.

**Out of scope:** per-player personal Wrapped on players' own phones, any live share link, storing photos (see §8).

**Success:** a coach can run a full story (intro → stats → awards → summary) with their own palette and cut-out winners, export cards and a video, and send them to the team chat. The photos stay on their device the whole time.

## 2. Slide sequence

One 9:16 story. A segmented progress bar sits at the top, one segment per slide, filling as the coach advances.

| # | Slide | Shown when |
|---|---|---|
| 1 | **Intro** — "Season 2026-27" / "vs {opponent}" + team name | story on |
| 2 | **Record** — season: "**7** wins out of 10 matches"; match: final score "**3–1**" + set scores | story on, ≥ 1 finished match |
| 3 | **Team strength** — the single best stat, phrased positively (§2.1) | story on, a stat qualifies |
| 4 | **Best rotation** — "Rotation **4** won **62%** of its rallies" | story on, season scope, best rotation has ≥ 20 rallies |
| 5… | **Award** × N — title → suspense → reveal (same three steps as today) | always |
| last | **Closing summary** — every winner on one card | always (if ≥ 1 award) |

### 2.1 Choosing the "team strength" stat

Candidates come from `teamSeason()` (`src/teams/stats/teamSeason.ts`), run over the season's finished matches, or over `[match]` for a match:
- side-out %, scored as `sideOut − 0.5`
- reception + %, scored as `receptionPos − WEAK_RECEPTION_POS` (from `src/matches/statFlags.ts`)

The highest positive score wins. If neither is positive, use aces when `aces > 0` ("**14** aces"). Otherwise skip the slide. Null stats (no scouted matches) are never candidates. A slide is never shown with "0%" or "—".

### 2.2 Toggle

"Include season story" checkbox on the prepare screen (wording: "Include match story" for a match). Defaults to **on**. Remembered per device in `localStorage` key `vcb.awards.story` (`'0'` / `'1'`), read inside try/catch like the other awards prefs.

## 3. Palettes

A **palette** is `{ id, name, colors: string[] }` with 4–5 `#RRGGBB` colours.

**Per-slide colours (pure function `slideColors(palette, slideIndex)`):**
- background = `colors[i % n]`
- accent = `colors[(i + 2) % n]`
- text = `#FFFFFF` or `#0F172A`, whichever has the higher WCAG contrast against the background
- if the accent's contrast against the background is < 3:1, the accent falls back to the text colour

Every slide stays readable whatever colours the coach picks.

**Presets (5):**
- Navy, Gold Night, Court Orange, Clean Light (today's four looks, each expanded to a full palette)
- **Wrapped** (high-contrast: neon green `#1ED760`, hot pink `#FF4FA3`, violet `#5B2EFF`, orange `#FF7A1A`, near-black `#121212`)

**Custom palettes:** "New palette" opens an editor with 4–5 colour inputs (add or remove down to 4), a name field, and a live strip of mini slide previews. Saved palettes can be edited and deleted.
- Storage: `vcb.awards.palettes` (array of custom palettes) and `vcb.awards.palette` (selected id), both in localStorage.
- Migration: an existing `vcb.awards.theme` preference selects the matching preset. A custom two-colour gradient becomes a custom palette `[from, to, …]`, padded to 4 colours with that preset's remaining colours.
- `CardTheme` / `PRESETS` in `card/cardTheme.ts` are replaced by the palette module.

The optional uploaded background image remains, drawn as a texture at reduced opacity on top of the slide colour.

## 4. Player cut-outs (on-device background removal)

**Library:** `@mediapipe/tasks-vision` (Apache-2.0, v1.1.x) `ImageSegmenter` with the **selfie segmenter** model (`selfie_segmenter.tflite`, ≈ 250 KB, Apache-2.0).

**Ruled out:**
- `@imgly/background-removal`: AGPL-3.0, which would oblige publishing the whole app's source
- RMBG-1.4: non-commercial model licence

**Self-hosted, no third-party requests:**
- the WASM runtime files are copied from `node_modules/@mediapipe/tasks-vision/wasm` into `public/mediapipe/` by a small `scripts/copy-mediapipe.mjs`, run from `predev` / `prebuild` (git-ignored output)
- the model is committed at `public/models/selfie_segmenter.tflite`
- the runtime loads with `FilesetResolver.forVisionTasks('/mediapipe')`

**Lazy:** `src/awards/cutout/segment.ts` dynamic-imports the library on the first "Remove background" click (prepare screen only). The rest of the app's bundle is unchanged.

**Pipeline (`removeBackground(photo: HTMLCanvasElement): Promise<HTMLCanvasElement>`):**
1. Run the segmenter in `IMAGE` mode, CPU delegate (predictable everywhere), on the already-cropped photo.
2. Apply the confidence mask as alpha with a 1–2 px feather.
3. Trim to the opaque bounding box.
4. Return a new canvas.

The result lives in the same in-memory map as today's photos and is released on leave (existing cleanup). Nothing is uploaded or persisted.

**UI:**
- "Remove background" / "Use original" toggle per winner photo
- a spinner and "Preparing on this device…" on the first model load
- on failure: inline error, keep the original

**CSP:** `firebase.json` `script-src` gains `'wasm-unsafe-eval'` (allows WebAssembly compilation only; JS `eval` stays blocked). `connect-src 'self'` already covers the self-hosted files.

**Reveal layout with a cut-out:**
- the player is drawn large: bottom-anchored, roughly 70% of card height
- they overlap the award title, poster-style
- the name and stat line sit over a bottom gradient for legibility

Fallbacks: no cut-out → today's circle photo; no photo → jersey number.

## 5. Consent gating

AwardsPage already loads the roster (`loadTeamRoster`). A `consentGiven(playerId)` lookup is built from `player.consent.given`. Former players not in the current roster count as **not given**.
- For a winner without consent, photo upload and cut-out are disabled, with the note: "No photo consent on file — the card shows the jersey number."
- Custom awards whose winner is free text (not a rostered player) follow the same rule: no photo.
- The first export or video in a browser session shows a one-time confirm: "You're about to share images of minors. Share them only within the team."

## 6. Rendering and motion

Everything stays on the existing **canvas renderer** (1080×1920), so exported PNGs and video frames are identical to what the room sees. New module `card/drawSlide.ts` dispatches on slide kind:

| Kind | Motion (reduced motion → final frame, no confetti) |
|---|---|
| intro | words punch in one by one (scale 1.15→1 + fade, `easeOutBack`), ~1.2 s |
| stat | big number **counts up** from 0 (`easeOutCubic`, ~1.4 s), caption slides up after |
| award title / suspense | as today (pulse), in the slide's palette colours |
| award reveal | as today's beats, with the cut-out sliding up from the bottom edge |
| summary | grid of winners pops in staggered (80 ms apart) |

Colour change between slides: a 250 ms wipe from the previous slide's background, drawn by the renderer.

The progress bar is a **DOM overlay**: it shows on screen but is not part of exports. The existing controls (prev/next, fullscreen, exit, auto-hide after 2 s), keyboard shortcuts, wake lock and the `aria-live` announcement stay. The announcement covers story slides too (e.g. "7 wins out of 10 matches").

## 7. Sharing (export on the device)

The prepare screen's export menu has three items:
- **Winner cards:** one PNG per award, as today, in the new design
- **Summary card:** one PNG
- **Record video:** plays the whole story once on an off-screen canvas, using fixed timings, and records it

Video timings: intro 2 s, stat 3 s, award title 1.5 s, suspense 1.5 s, reveal 4 s, summary 4 s. The video uses no progress bar and no controls.

Recording details (`src/awards/exportVideo.ts`):
- `canvas.captureStream(30)` + `MediaRecorder`, first supported of `video/mp4;codecs=avc1`, `video/mp4`, `video/webm;codecs=vp9`, `video/webm`
- a progress indicator and a Cancel button while recording
- the result goes through the existing `shareOrDownload` (Web Share API, otherwise download)
- if `MediaRecorder` is unavailable, the item is disabled with "Video export isn't supported in this browser"

## 8. Not now (recorded for later)

- **Live link without photos:** players or guardians open the story in-app, rebuilt from saved award choices and match stats, with jersey numbers instead of photos. Depends on the viewer invite flow.
- **Live link with photos:** needs photo storage (Firebase Storage needs the paid Blaze plan; compressed images in Firestore are possible), guardian photo consent, retention and deletion, and privacy-policy changes. Avoid unless clearly needed.
- **Per-player personal Wrapped.**

## 9. Code structure

| Unit | Responsibility |
|---|---|
| `src/awards/palette.ts` | palette type, presets, `slideColors`, contrast pick, localStorage read/write + migration from `vcb.awards.theme` |
| `src/awards/story/buildStory.ts` | pure: `(scope, matches, people, team, awards, includeStory) → Slide[]` (replaces `presentSteps.ts`; navigation becomes `index ± 1` over the array) |
| `src/awards/story/storyStats.ts` | pure: record / team-strength / best-rotation selection and skip rules (§2.1) |
| `src/awards/card/drawSlide.ts` (+ `drawStatSlide`, `drawIntroSlide`, `drawSummaryCard`) | canvas drawing per slide kind; `drawAwardCard` gains the cut-out layout |
| `src/awards/cutout/segment.ts` | lazy MediaPipe load + `removeBackground` |
| `src/awards/exportVideo.ts` | mime pick, record story, cancel |
| `src/awards/PaletteEditor.tsx` | custom palette dialog |
| `AwardsPresent.tsx` | iterates `Slide[]`, progress-bar overlay |
| `AwardsPrepare.tsx` | palette picker, story toggle, cut-out buttons, consent notes, export menu |

Unchanged: Firestore data, security rules, award ranking (`awardRules.ts`, `resolveAwards.ts`).

## 10. Testing

**Unit tests (pure):**
- `slideColors` cycling and contrast fallback (including a light palette)
- palette storage round-trip, invalid input → defaults, migration from `vcb.awards.theme`
- `storyStats`: each skip rule (no scouted matches, no positive stat, < 20 rotation rallies), positive-phrasing choice, match scope
- `buildStory`: toggle off → awards + summary only; zero awards; slide order
- video mime selection with a stubbed `MediaRecorder.isTypeSupported`

**Drawing:** the existing mock-context pattern (`card/testCtx.ts`) checks that each slide kind draws its text and that reduced motion draws the final frame.

**Segmentation:** `segment.ts` is tested with the MediaPipe module mocked, covering mask-to-alpha, trimming, and that the failure path keeps the original. The real model is checked manually.

**Components:**
- prepare screen: story toggle persists, palette create/edit/delete, consent gating disables the photo controls, one-time share warning
- `AwardsPresent`: progress bar segment count and keyboard navigation over story slides

**CSP:** a test asserts that `firebase.json`'s `script-src` contains `'wasm-unsafe-eval'` and still no `'unsafe-eval'`.

**Manual (user):** the real cut-out quality on team photos, and video playback in WhatsApp on iPhone and Android.
