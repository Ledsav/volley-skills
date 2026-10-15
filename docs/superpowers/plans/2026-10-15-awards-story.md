# Awards Story Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the awards presentation into a Wrapped-style story — optional season/match story slides, rotating palettes (preset or custom), on-device player cut-outs, consent gating, and PNG + video export.

**Architecture:** Pure modules decide *what* to show (`palette.ts` → per-slide colours, `story/storyStats.ts` + `story/buildStory.ts` → an ordered `Slide[]`). One canvas renderer (`card/drawSlide.ts`, `renderStoryFrame`) draws any slide at any elapsed time; the live presenter, the thumbnails, the PNG export and the video recorder all call it, so every output matches the room. Background removal is a lazily loaded, self-hosted MediaPipe segmenter (`cutout/segment.ts`) whose result lives in memory only.

**Tech Stack:** React 18 + TypeScript (strict, `noUnused*`), Vite, Vitest + Testing Library (jsdom — `getContext` returns `null`, so canvas logic is tested through `card/testCtx.ts`'s `recordingCtx()`), Tailwind tokens, `@mediapipe/tasks-vision` (new, Apache-2.0), `MediaRecorder` / `canvas.captureStream`.

**Spec:** `docs/superpowers/specs/2026-10-15-volley-skills-awards-story-design.md`

## Global Constraints

- Coach-led pacing: no auto-advance in the live presentation.
- Story toggle defaults to **on**; key `vcb.awards.story` (`'0'`/`'1'`); every localStorage/sessionStorage access wrapped in try/catch.
- Palettes: 4–5 `#RRGGBB` colours; keys `vcb.awards.palettes` (custom list) and `vcb.awards.palette` (selected id); migrate from `vcb.awards.theme`.
- Per slide: background `colors[i % n]`, accent `colors[(i + 2) % n]`, text `#FFFFFF` or `#0F172A` by higher WCAG contrast; accent < 3:1 against background → accent = text.
- Team-strength candidates: side-out scored `sideOut − 0.5`, reception scored `receptionPos − WEAK_RECEPTION_POS`; highest positive wins; else aces if `> 0`; else skip. Never render "0%" or "—" on a story slide.
- Best-rotation slide: season scope only, best rotation needs ≥ 20 rallies.
- Photos/cut-outs never leave the device and are never persisted; only players with `player.consent.given === true` may have one; former players count as not given.
- One-time (per browser session) share warning: "You're about to share images of minors. Share them only within the team."
- MediaPipe runtime and model are **self-hosted** (`/mediapipe/`, `/models/selfie_segmenter.tflite`); no third-party requests. CSP `script-src` gains `'wasm-unsafe-eval'` and must not contain `'unsafe-eval'`.
- Video: mime preference `video/mp4;codecs=avc1`, `video/mp4`, `video/webm;codecs=vp9`, `video/webm`; timings intro 2000, stat 3000, awardTitle 1500, awardSuspense 1500, awardReveal 4000, summary 4000 ms; no progress bar/controls in the video.
- No club name hardcoded anywhere (club-agnostic); user-facing copy stays generic.
- Tests sit next to the code; `npm test`, `npm run lint`, `npm run build` must pass at the end of every task.

## Review Focus

1. **A season with finished but unscouted matches** (score only, no `summary`) — record slide still shows, strength/rotation slides are skipped, nothing renders `NaN`, `0%` or `null`. → Task 2 test "score-only season".
2. **A winner changed to a player without consent after a photo was added** — the old photo/cut-out must stop appearing on cards, thumbnails and exports. → Task 7 test "photo dropped when winner loses consent".
3. **Very long award titles / team names / captions on 1080-wide slides** — text must shrink or wrap, never overflow the card. → Task 4 test "long caption wraps".
4. **Corrupt or hand-edited palette storage** (bad hex, 2 colours, non-array) — fall back to presets, never crash the prepare screen. → Task 1 test "invalid stored palettes".
5. **Cancelling a video recording or the model failing to load** — UI returns to a usable state, original photo kept, a retry works. → Task 8 test "retry after load failure", Task 9 test "abort rejects with AbortError".

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/awards/palette.ts` (+ test) | create | Palette type, presets, contrast, `slideColors`, storage + migration |
| `src/awards/story/storyStats.ts` (+ test) | create | Record / strength / rotation stat selection |
| `src/awards/story/buildStory.ts` (+ test) | create | `Slide` type, `buildStory`, `colorIndexForAward`, `sceneProgress` |
| `src/awards/story/storyPref.ts` (+ test) | create | story toggle persistence |
| `src/awards/card/drawAwardCard.ts` (+ test) | modify | take `SlideColors`, cut-out layout |
| `src/awards/card/drawSlide.ts` (+ test) | create | intro / stat / summary drawers, wipe, `renderStoryFrame` |
| `src/awards/card/wrapText.ts` (+ test) | create | word wrap + shrink-to-fit |
| `src/awards/card/cardTheme.ts` (+ test), `src/awards/presentSteps.ts` (+ test) | delete | replaced by palette / buildStory |
| `src/awards/CardThumbnail.tsx`, `src/awards/exportCards.ts` (+ test) | modify | colours instead of theme; `renderPng` |
| `src/awards/AwardsPresent.tsx` (+ test) | rewrite | iterate `Slide[]`, progress bar |
| `src/awards/PaletteEditor.tsx` (+ test) | create | custom palette dialog |
| `src/awards/AwardsPrepare.tsx` (+ test), `src/awards/AwardsPage.tsx` (+ test) | modify | palette picker, story toggle, consent, cut-outs, export menu |
| `src/awards/cutout/segment.ts` (+ test), `src/awards/cutout/csp.test.ts` | create | MediaPipe load, mask → alpha, trim; CSP guard |
| `src/awards/exportVideo.ts` (+ test) | create | mime pick, timeline, recorder |
| `vite.config.ts`, `firebase.json`, `.gitignore`, `package.json`, `public/models/selfie_segmenter.tflite` | modify/create | self-hosting + CSP |

---

### Task 1: Palette module

**Files:**
- Create: `src/awards/palette.ts`
- Test: `src/awards/palette.test.ts`

**Interfaces:**
- Produces:
  - `interface Palette { id: string; name: string; colors: string[] }`
  - `interface SlideColors { bg: string; accent: string; text: string; muted: string }`
  - `const PRESET_PALETTES: Palette[]`, `const MIN_COLORS = 4`, `const MAX_COLORS = 5`
  - `function contrast(a: string, b: string): number`
  - `function slideColors(p: Palette, i: number): SlideColors`
  - `interface PalettePrefs { selectedId: string; custom: Palette[] }`
  - `function readPalettePrefs(): PalettePrefs`, `function writePalettePrefs(p: PalettePrefs): void`
  - `function allPalettes(p: PalettePrefs): Palette[]`, `function selectedPalette(p: PalettePrefs): Palette`
  - `function isValidPalette(x: unknown): x is Palette`, `function newPaletteId(): string`

- [ ] **Step 1: Write the failing tests**

```ts
// src/awards/palette.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import {
  PRESET_PALETTES, allPalettes, contrast, isValidPalette, readPalettePrefs, selectedPalette, slideColors, writePalettePrefs, type Palette,
} from './palette';

const p = (colors: string[]): Palette => ({ id: 'x', name: 'X', colors });

describe('palette', () => {
  afterEach(() => localStorage.clear());

  it('computes WCAG contrast', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('cycles background and takes the accent two colours later', () => {
    const pal = p(['#111111', '#222222', '#FFFFFF', '#EEEEEE']);
    expect(slideColors(pal, 0).bg).toBe('#111111');
    expect(slideColors(pal, 0).accent).toBe('#FFFFFF');
    expect(slideColors(pal, 5).bg).toBe('#222222');
  });

  it('picks white text on dark and ink text on light backgrounds', () => {
    const pal = p(['#000000', '#FFFFFF', '#000000', '#FFFFFF']);
    expect(slideColors(pal, 0).text).toBe('#FFFFFF');
    expect(slideColors(pal, 1).text).toBe('#0F172A');
  });

  it('falls back to the text colour when the accent lacks 3:1 contrast', () => {
    const pal = p(['#101010', '#202020', '#151515', '#303030']);
    const c = slideColors(pal, 0);
    expect(c.accent).toBe(c.text);
  });

  it('every preset slide has readable text', () => {
    for (const pal of PRESET_PALETTES) {
      for (let i = 0; i < pal.colors.length; i++) {
        const c = slideColors(pal, i);
        expect(contrast(c.bg, c.text)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(c.bg, c.accent)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('validates palettes', () => {
    expect(isValidPalette(p(['#000000', '#111111', '#222222', '#333333']))).toBe(true);
    expect(isValidPalette(p(['#000000', '#111111']))).toBe(false);
    expect(isValidPalette(p(['#000000', '#111111', '#222222', 'red']))).toBe(false);
    expect(isValidPalette({ id: 'x', colors: [] })).toBe(false);
  });

  it('defaults to the first preset with nothing stored', () => {
    const prefs = readPalettePrefs();
    expect(prefs).toEqual({ selectedId: PRESET_PALETTES[0].id, custom: [] });
    expect(selectedPalette(prefs)).toBe(PRESET_PALETTES[0]);
  });

  it('round-trips custom palettes and the selection', () => {
    const custom = { id: 'custom-1', name: 'Mine', colors: ['#000000', '#111111', '#222222', '#333333'] };
    writePalettePrefs({ selectedId: 'custom-1', custom: [custom] });
    const prefs = readPalettePrefs();
    expect(selectedPalette(prefs)).toEqual(custom);
    expect(allPalettes(prefs)).toHaveLength(PRESET_PALETTES.length + 1);
  });

  it('invalid stored palettes fall back to presets without throwing', () => {
    localStorage.setItem('vcb.awards.palettes', '{"not":"an array"}');
    localStorage.setItem('vcb.awards.palette', 'ghost');
    expect(readPalettePrefs()).toEqual({ selectedId: PRESET_PALETTES[0].id, custom: [] });
    localStorage.setItem('vcb.awards.palettes', JSON.stringify([{ id: 'c', name: 'Bad', colors: ['#000000'] }]));
    expect(readPalettePrefs().custom).toEqual([]);
  });

  it('migrates the old theme preference (preset)', () => {
    localStorage.setItem('vcb.awards.theme', JSON.stringify({ presetId: 'gold', custom: null }));
    expect(readPalettePrefs()).toEqual({ selectedId: 'gold', custom: [] });
  });

  it('migrates the old custom gradient into a custom palette', () => {
    localStorage.setItem('vcb.awards.theme', JSON.stringify({ presetId: 'navy', custom: { from: '#123456', to: '#654321' } }));
    const prefs = readPalettePrefs();
    expect(prefs.custom).toHaveLength(1);
    expect(prefs.custom[0].colors.slice(0, 2)).toEqual(['#123456', '#654321']);
    expect(prefs.custom[0].colors.length).toBeGreaterThanOrEqual(4);
    expect(prefs.selectedId).toBe(prefs.custom[0].id);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/palette.test.ts`
Expected: FAIL — `Failed to resolve import "./palette"`.

- [ ] **Step 3: Implement**

```ts
// src/awards/palette.ts
/**
 * Award-story palettes: 4–5 colours that rotate slide by slide (Wrapped-style).
 * Text colour is chosen per slide for contrast, so any palette stays readable.
 */
export interface Palette { id: string; name: string; colors: string[] }
export interface SlideColors { bg: string; accent: string; text: string; muted: string }

export const MIN_COLORS = 4;
export const MAX_COLORS = 5;
const HEX = /^#[0-9a-fA-F]{6}$/;
const WHITE = '#FFFFFF';
const INK = '#0F172A';

export const PRESET_PALETTES: Palette[] = [
  { id: 'navy', name: 'Navy', colors: ['#1C4586', '#0B1B36', '#F97316', '#2865F6', '#F5C542'] },
  { id: 'gold', name: 'Gold Night', colors: ['#1A1A1A', '#3A2A05', '#F5C542', '#7A5A10', '#FFFFFF'] },
  { id: 'court', name: 'Court Orange', colors: ['#C2410C', '#7C2D12', '#FFFFFF', '#1C4586', '#FDBA74'] },
  { id: 'light', name: 'Clean Light', colors: ['#F8FAFC', '#E2E8F0', '#2356A8', '#C2410C', '#0F172A'] },
  { id: 'wrapped', name: 'Wrapped', colors: ['#1ED760', '#FF4FA3', '#5B2EFF', '#FF7A1A', '#121212'] },
];

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function slideColors(p: Palette, i: number): SlideColors {
  const n = p.colors.length;
  const k = ((i % n) + n) % n;
  const bg = p.colors[k];
  const text = contrast(bg, WHITE) >= contrast(bg, INK) ? WHITE : INK;
  const candidate = p.colors[(k + 2) % n];
  const accent = contrast(bg, candidate) >= 3 ? candidate : text;
  const muted = text === WHITE ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.72)';
  return { bg, accent, text, muted };
}

export function isValidPalette(x: unknown): x is Palette {
  if (!x || typeof x !== 'object') return false;
  const p = x as Partial<Palette>;
  return typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.colors)
    && p.colors.length >= MIN_COLORS && p.colors.length <= MAX_COLORS && p.colors.every((c) => typeof c === 'string' && HEX.test(c));
}

export interface PalettePrefs { selectedId: string; custom: Palette[] }

const LIST_KEY = 'vcb.awards.palettes';
const SELECTED_KEY = 'vcb.awards.palette';
const OLD_THEME_KEY = 'vcb.awards.theme';

export function newPaletteId(): string {
  return `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function migrateOldTheme(): PalettePrefs | null {
  const raw = JSON.parse(localStorage.getItem(OLD_THEME_KEY) ?? 'null') as { presetId?: string; custom?: { from?: string; to?: string } | null } | null;
  if (!raw) return null;
  const base = PRESET_PALETTES.find((p) => p.id === raw.presetId) ?? PRESET_PALETTES[0];
  const c = raw.custom;
  if (c && typeof c.from === 'string' && typeof c.to === 'string' && HEX.test(c.from) && HEX.test(c.to)) {
    const migrated: Palette = { id: newPaletteId(), name: 'My colours', colors: [c.from, c.to, ...base.colors.slice(2)].slice(0, MAX_COLORS) };
    return { selectedId: migrated.id, custom: [migrated] };
  }
  return { selectedId: base.id, custom: [] };
}

export function readPalettePrefs(): PalettePrefs {
  const fallback: PalettePrefs = { selectedId: PRESET_PALETTES[0].id, custom: [] };
  try {
    const list = localStorage.getItem(LIST_KEY);
    const selected = localStorage.getItem(SELECTED_KEY);
    if (list === null && selected === null) return migrateOldTheme() ?? fallback;
    const parsed: unknown = JSON.parse(list ?? '[]');
    const custom = Array.isArray(parsed) ? parsed.filter(isValidPalette) : [];
    const prefs = { selectedId: selected ?? fallback.selectedId, custom };
    return allPalettes(prefs).some((p) => p.id === prefs.selectedId) ? prefs : { ...prefs, selectedId: fallback.selectedId };
  } catch {
    return fallback;
  }
}

export function writePalettePrefs(p: PalettePrefs): void {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(p.custom));
    localStorage.setItem(SELECTED_KEY, p.selectedId);
  } catch { /* per-device convenience only */ }
}

export function allPalettes(p: PalettePrefs): Palette[] {
  return [...PRESET_PALETTES, ...p.custom];
}

export function selectedPalette(p: PalettePrefs): Palette {
  return allPalettes(p).find((x) => x.id === p.selectedId) ?? PRESET_PALETTES[0];
}
```

- [ ] **Step 4: Run tests — expect PASS.** If "every preset slide has readable text" fails, adjust the offending preset colour (darken a background or swap accent order) rather than loosening the test; record the change in the commit message.

Run: `npx vitest run src/awards/palette.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/awards/palette.ts src/awards/palette.test.ts
git commit -m "feat(awards): rotating story palettes with per-slide contrast and storage"
```

---

### Task 2: Story stats

**Files:**
- Create: `src/awards/story/storyStats.ts`
- Test: `src/awards/story/storyStats.test.ts`

**Interfaces:**
- Consumes: `teamSeason(matches, people)` from `src/teams/stats/teamSeason.ts` (returns `record`, `sideOut`, `receptionPos`, `aces`, `rotations`, `bestRotation`); `WEAK_RECEPTION_POS` from `src/matches/statFlags.ts`; `AwardScope` from `src/types/awards.ts`.
- Produces:
  - `interface StoryStat { id: 'record' | 'strength' | 'rotation'; kicker: string; big: number; bigSuffix: string; caption: string; detail: string | null }`
  - `const MIN_ROTATION_RALLIES = 20`
  - `function storyStats(scope: AwardScope, matches: Match[], people: Map<string, Person>): StoryStat[]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/awards/story/storyStats.test.ts
import { describe, expect, it } from 'vitest';
import { finished, player } from '../testMatches';
import { latestRosterIndex } from '../../teams/stats/rosterIndex';
import { storyStats } from './storyStats';

const run = (scope: 'season' | 'match', ms: ReturnType<typeof finished>[]) => storyStats(scope, ms, latestRosterIndex(ms));

describe('storyStats', () => {
  it('nothing for no matches', () => {
    expect(run('season', [])).toEqual([]);
  });

  it('season record counts wins out of matches with set totals', () => {
    const ms = [finished('a', '2026-09-01', null), finished('b', '2026-09-08', null, { result: { setsUs: 1, setsThem: 3, sets: [] } })];
    const [record] = run('season', ms);
    expect(record).toMatchObject({ id: 'record', big: 1, caption: 'win out of 2 matches', detail: 'Sets 4–4' });
  });

  it('skips the record slide for a winless season', () => {
    const ms = [finished('a', '2026-09-01', null, { result: { setsUs: 0, setsThem: 3, sets: [] } })];
    expect(run('season', ms).some((s) => s.id === 'record')).toBe(false);
  });

  it('score-only season: record shown, strength and rotation skipped, no NaN', () => {
    const ms = [finished('a', '2026-09-01', null), finished('b', '2026-09-08', null)];
    const stats = run('season', ms);
    expect(stats.map((s) => s.id)).toEqual(['record']);
    for (const s of stats) expect(Number.isFinite(s.big)).toBe(true);
  });

  it('picks reception when it beats side-out by more', () => {
    // fixture side-out is exactly 50% (score 0); reception 100% from '#+'
    const ms = [finished('a', '2026-09-01', [player('p', { R: '#+' })])];
    const strength = run('season', ms).find((s) => s.id === 'strength')!;
    expect(strength).toMatchObject({ kicker: 'Reception', big: 100, bigSuffix: '%' });
  });

  it('falls back to aces when no percentage is positive', () => {
    const ms = [finished('a', '2026-09-01', [player('p', { R: '==' })])];
    const strength = run('season', ms).find((s) => s.id === 'strength')!;
    expect(strength).toMatchObject({ big: 3, caption: 'aces' });
  });

  it('shows the best rotation only with at least 20 rallies', () => {
    const one = [finished('a', '2026-09-01', [player('p', { A: '#' })])];
    expect(run('season', one).some((s) => s.id === 'rotation')).toBe(false);
    const four = ['a', 'b', 'c', 'd'].map((id, i) => finished(id, `2026-09-0${i + 1}`, [player('p', { A: '#' })]));
    expect(run('season', four).find((s) => s.id === 'rotation')).toMatchObject({ kicker: 'Rotation 4', big: 83, detail: '20 of 24 rallies' });
  });

  it('match scope: final score with set scores, no rotation slide', () => {
    const m = finished('a', '2026-09-01', [player('p', { R: '#+' })], { opponent: 'Rivals', result: { setsUs: 3, setsThem: 1, sets: [{ us: 25, them: 20 }, { us: 22, them: 25 }, { us: 25, them: 18 }, { us: 25, them: 23 }] } });
    const stats = run('match', [m]);
    expect(stats[0]).toMatchObject({ id: 'record', kicker: 'Final score', big: 3, bigSuffix: '–1', caption: 'vs Rivals', detail: '25–20 · 22–25 · 25–18 · 25–23' });
    expect(stats.some((s) => s.id === 'rotation')).toBe(false);
  });
});
```

Note on the rotation fixture: `finished()` gives rotation 4 `{ won: 5, lost: 1 }` per match → 4 matches = 20/24 = 83%, the highest rate.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/story/storyStats.test.ts`
Expected: FAIL — cannot resolve `./storyStats`.

- [ ] **Step 3: Implement**

```ts
// src/awards/story/storyStats.ts
import { WEAK_RECEPTION_POS } from '../../matches/statFlags';
import type { Person } from '../../teams/stats/rosterIndex';
import { teamSeason, type TeamSeason } from '../../teams/stats/teamSeason';
import type { AwardScope } from '../../types/awards';
import type { Match } from '../../types/match';

/** One big-number story slide. `big` counts up; `bigSuffix` is appended ("%", "–1"). */
export interface StoryStat {
  id: 'record' | 'strength' | 'rotation';
  kicker: string;
  big: number;
  bigSuffix: string;
  caption: string;
  detail: string | null;
}

export const MIN_ROTATION_RALLIES = 20;

const pct = (x: number) => Math.round(x * 100);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function recordStat(scope: AwardScope, matches: Match[], s: TeamSeason): StoryStat | null {
  if (scope === 'match') {
    const m = matches[0];
    return {
      id: 'record', kicker: 'Final score', big: m.result.setsUs, bigSuffix: `–${m.result.setsThem}`,
      caption: `vs ${m.opponent}`,
      detail: m.result.sets.length ? m.result.sets.map((x) => `${x.us}–${x.them}`).join(' · ') : null,
    };
  }
  if (s.record.won === 0) return null; // story slides stay positive
  return {
    id: 'record', kicker: 'This season', big: s.record.won, bigSuffix: '',
    caption: `${plural(s.record.won, 'win', 'wins')} out of ${matches.length} ${plural(matches.length, 'match', 'matches')}`,
    detail: `Sets ${s.record.setsWon}–${s.record.setsLost}`,
  };
}

function strengthStat(s: TeamSeason): StoryStat | null {
  const candidates: { score: number; stat: StoryStat }[] = [];
  if (s.sideOut !== null && s.sideOut - 0.5 > 0) {
    candidates.push({ score: s.sideOut - 0.5, stat: { id: 'strength', kicker: 'Side-out', big: pct(s.sideOut), bigSuffix: '%', caption: 'of rallies won on the opponent’s serve', detail: null } });
  }
  if (s.receptionPos !== null && s.receptionPos - WEAK_RECEPTION_POS > 0) {
    candidates.push({ score: s.receptionPos - WEAK_RECEPTION_POS, stat: { id: 'strength', kicker: 'Reception', big: pct(s.receptionPos), bigSuffix: '%', caption: 'of serves received on target', detail: null } });
  }
  if (candidates.length) return candidates.reduce((a, b) => (b.score > a.score ? b : a)).stat;
  if (s.aces > 0) return { id: 'strength', kicker: 'From the service line', big: s.aces, bigSuffix: '', caption: plural(s.aces, 'ace', 'aces'), detail: null };
  return null;
}

function rotationStat(s: TeamSeason): StoryStat | null {
  if (s.bestRotation === null) return null;
  const v = s.rotations[s.bestRotation];
  const rallies = v.won + v.lost;
  if (rallies < MIN_ROTATION_RALLIES) return null;
  return {
    id: 'rotation', kicker: `Rotation ${s.bestRotation}`, big: pct(v.won / rallies), bigSuffix: '%',
    caption: 'of its rallies won — the strongest rotation', detail: `${v.won} of ${rallies} rallies`,
  };
}

/** The story slides' numbers, in order; any slide without enough data is left out. */
export function storyStats(scope: AwardScope, matches: Match[], people: Map<string, Person>): StoryStat[] {
  if (matches.length === 0) return [];
  const s = teamSeason(matches, people);
  const out = [recordStat(scope, matches, s), strengthStat(s), scope === 'season' ? rotationStat(s) : null];
  return out.filter((x): x is StoryStat => x !== null);
}
```

- [ ] **Step 4: Run tests — expect PASS.** If `teamSeason` does not export `TeamSeason`, it does (`export interface TeamSeason` at `src/teams/stats/teamSeason.ts:49`).

Run: `npx vitest run src/awards/story/storyStats.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/awards/story
git commit -m "feat(awards): story stats — record, team strength, best rotation with skip rules"
```

---

### Task 3: Story sequence + toggle preference

**Files:**
- Create: `src/awards/story/buildStory.ts`, `src/awards/story/storyPref.ts`
- Test: `src/awards/story/buildStory.test.ts`, `src/awards/story/storyPref.test.ts`

**Interfaces:**
- Consumes: `StoryStat` (Task 2).
- Produces:
  - `type Slide = { kind: 'intro'; colorIndex: number; title: string; subtitle: string } | { kind: 'stat'; colorIndex: number; stat: StoryStat } | { kind: 'awardTitle' | 'awardSuspense' | 'awardReveal'; colorIndex: number; awardIndex: number } | { kind: 'summary'; colorIndex: number }`
  - `interface StoryInput { introTitle: string; teamName: string; stats: StoryStat[]; awardCount: number; includeStory: boolean }`
  - `function buildStory(i: StoryInput): Slide[]`
  - `function colorIndexForAward(slides: Slide[], awardIndex: number): number`
  - `function sceneProgress(slides: Slide[], index: number): { scenes: number; current: number; fraction: number }`
  - `function readStoryPref(): boolean`, `function writeStoryPref(on: boolean): void`

- [ ] **Step 1: Write the failing tests**

```ts
// src/awards/story/buildStory.test.ts
import { describe, expect, it } from 'vitest';
import type { StoryStat } from './storyStats';
import { buildStory, colorIndexForAward, sceneProgress } from './buildStory';

const stat = (id: StoryStat['id']): StoryStat => ({ id, kicker: id, big: 1, bigSuffix: '', caption: '', detail: null });
const base = { introTitle: 'Season 2026-27', teamName: 'U17', stats: [stat('record'), stat('strength')], awardCount: 2, includeStory: true };

describe('buildStory', () => {
  it('orders intro, stats, three steps per award, summary — one colour per scene', () => {
    const s = buildStory(base);
    expect(s.map((x) => x.kind)).toEqual([
      'intro', 'stat', 'stat',
      'awardTitle', 'awardSuspense', 'awardReveal',
      'awardTitle', 'awardSuspense', 'awardReveal',
      'summary',
    ]);
    expect(s.map((x) => x.colorIndex)).toEqual([0, 1, 2, 3, 3, 3, 4, 4, 4, 5]);
  });

  it('toggle off leaves only awards and summary', () => {
    expect(buildStory({ ...base, includeStory: false }).map((x) => x.kind)).toEqual([
      'awardTitle', 'awardSuspense', 'awardReveal', 'awardTitle', 'awardSuspense', 'awardReveal', 'summary',
    ]);
  });

  it('zero awards: story only, no summary', () => {
    expect(buildStory({ ...base, awardCount: 0 }).map((x) => x.kind)).toEqual(['intro', 'stat', 'stat']);
  });

  it('finds the colour an award is revealed in (for matching exports)', () => {
    const s = buildStory(base);
    expect(colorIndexForAward(s, 1)).toBe(4);
    expect(colorIndexForAward(s, 9)).toBe(0);
  });

  it('reports progress per scene, with partial progress inside an award', () => {
    const s = buildStory(base);
    expect(sceneProgress(s, 0)).toEqual({ scenes: 6, current: 0, fraction: 1 });
    expect(sceneProgress(s, 4)).toEqual({ scenes: 6, current: 3, fraction: 2 / 3 });
  });
});
```

```ts
// src/awards/story/storyPref.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStoryPref, writeStoryPref } from './storyPref';

describe('storyPref', () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('defaults to on and round-trips', () => {
    expect(readStoryPref()).toBe(true);
    writeStoryPref(false);
    expect(readStoryPref()).toBe(false);
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readStoryPref()).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/story`
Expected: FAIL — cannot resolve `./buildStory` / `./storyPref`.

- [ ] **Step 3: Implement**

```ts
// src/awards/story/buildStory.ts
import type { StoryStat } from './storyStats';

export type Slide =
  | { kind: 'intro'; colorIndex: number; title: string; subtitle: string }
  | { kind: 'stat'; colorIndex: number; stat: StoryStat }
  | { kind: 'awardTitle' | 'awardSuspense' | 'awardReveal'; colorIndex: number; awardIndex: number }
  | { kind: 'summary'; colorIndex: number };

export interface StoryInput { introTitle: string; teamName: string; stats: StoryStat[]; awardCount: number; includeStory: boolean }

/** The full presentation: optional story, three steps per award, then a summary. One palette colour per scene. */
export function buildStory(i: StoryInput): Slide[] {
  const out: Slide[] = [];
  let color = 0;
  if (i.includeStory) {
    out.push({ kind: 'intro', colorIndex: color++, title: i.introTitle, subtitle: i.teamName });
    for (const stat of i.stats) out.push({ kind: 'stat', colorIndex: color++, stat });
  }
  for (let a = 0; a < i.awardCount; a++) {
    const c = color++;
    out.push({ kind: 'awardTitle', colorIndex: c, awardIndex: a }, { kind: 'awardSuspense', colorIndex: c, awardIndex: a }, { kind: 'awardReveal', colorIndex: c, awardIndex: a });
  }
  if (i.awardCount > 0) out.push({ kind: 'summary', colorIndex: color++ });
  return out;
}

export function colorIndexForAward(slides: Slide[], awardIndex: number): number {
  const s = slides.find((x) => x.kind === 'awardReveal' && x.awardIndex === awardIndex);
  return s ? s.colorIndex : 0;
}

/** Progress-bar state: one segment per scene (colour); an award's three steps fill its segment in thirds. */
export function sceneProgress(slides: Slide[], index: number): { scenes: number; current: number; fraction: number } {
  const scenes = new Set(slides.map((s) => s.colorIndex)).size;
  const slide = slides[index];
  if (!slide) return { scenes, current: 0, fraction: 0 };
  const sameScene = slides.filter((s) => s.colorIndex === slide.colorIndex);
  const step = sameScene.indexOf(slide) + 1;
  return { scenes, current: slide.colorIndex, fraction: step / sameScene.length };
}
```

```ts
// src/awards/story/storyPref.ts
const KEY = 'vcb.awards.story';

/** Whether the presentation opens with the season/match story. Defaults to on. */
export function readStoryPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeStoryPref(on: boolean): void {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* per-device convenience only */ }
}
```

- [ ] **Step 4: Run tests — expect PASS.**

Run: `npx vitest run src/awards/story`

- [ ] **Step 5: Commit**

```bash
git add src/awards/story
git commit -m "feat(awards): story slide sequence, scene progress and the story toggle preference"
```

---

### Task 4: Slide renderer (colours, cut-out layout, story slides, summary)

**Files:**
- Create: `src/awards/card/wrapText.ts` (+ `wrapText.test.ts`), `src/awards/card/drawSlide.ts` (+ `drawSlide.test.ts`)
- Modify: `src/awards/card/drawAwardCard.ts`, `src/awards/card/drawAwardCard.test.ts`, `src/awards/CardThumbnail.tsx`, `src/awards/exportCards.ts`, `src/awards/exportCards.test.ts` (if it references themes)
- Delete: none yet (theme files are removed in Task 6 once nothing imports them)

**Interfaces:**
- Consumes: `SlideColors`, `slideColors`, `Palette` (Task 1); `Slide` (Task 3); `StoryStat` (Task 2).
- Produces:
  - `CardArt` becomes `{ photo: Img | null; cutout: Img | null; background: Img | null }` (all call sites updated)
  - `drawAwardCard(ctx, card: CardModel, colors: SlideColors, art: CardArt, t: number, reducedMotion?: boolean): void`
  - `drawTitleCard(ctx, title: string, colors: SlideColors, art: CardArt, pulse: number): void`
  - `wrapLines(ctx, s: string, maxWidth: number): string[]`, `fitFontSize(ctx, s: string, weight: number, maxSize: number, maxWidth: number): number`
  - in `drawSlide.ts`: `interface PresentCard { key: string; title: string; model: CardModel }`, `interface StoryDeps { palette: Palette; cards: PresentCard[]; artFor: (key: string) => CardArt; clubName: string }`, `const WIPE_MS = 250`, `function slideDurationMs(slide: Slide, cardCount: number): number`, `function renderStoryFrame(ctx, slides: Slide[], index: number, elapsedMs: number, deps: StoryDeps, reduced: boolean, prevIndex: number | null): boolean` (returns `true` when the frame is final — nothing left to animate)
  - `CardThumbnail` props `{ card; colors: SlideColors; art; width? }`
  - `renderPng(draw: (ctx: CanvasRenderingContext2D) => void): Promise<Blob>` in `exportCards.ts` (replaces `renderCardPng`)

- [ ] **Step 1: Write the failing tests**

```ts
// src/awards/card/wrapText.test.ts
import { describe, expect, it } from 'vitest';
import { recordingCtx } from './testCtx';
import { fitFontSize, wrapLines } from './wrapText';

describe('wrapText', () => {
  it('wraps words to the width (measure ≈ 0.55 em per char)', () => {
    const { ctx } = recordingCtx();
    ctx.font = '700 60px Inter';
    const lines = wrapLines(ctx, 'of rallies won on the opponent’s serve', 920);
    expect(lines.length).toBe(2);
    for (const l of lines) expect(l.length * 60 * 0.55).toBeLessThanOrEqual(920);
  });

  it('shrinks a long single line to fit, never below 40%', () => {
    const { ctx } = recordingCtx();
    expect(fitFontSize(ctx, 'Short', 900, 300, 920)).toBe(300);
    const size = fitFontSize(ctx, 'Extraordinarily long award title', 900, 120, 920);
    expect(size).toBeLessThan(120);
    expect(size).toBeGreaterThanOrEqual(48);
  });
});
```

```ts
// src/awards/card/drawSlide.test.ts
import { describe, expect, it } from 'vitest';
import { PRESET_PALETTES } from '../palette';
import { buildStory } from '../story/buildStory';
import type { StoryStat } from '../story/storyStats';
import type { CardModel } from './drawAwardCard';
import { renderStoryFrame, slideDurationMs, type StoryDeps } from './drawSlide';
import { recordingCtx } from './testCtx';

const model = (key: string, name: string): CardModel => ({ key, awardTitle: key, name, number: 7, statLine: null, footer: 'Season 2026-27', teamName: 'U17', clubName: 'Demo VC', note: '' });
const deps: StoryDeps = {
  palette: PRESET_PALETTES[0],
  cards: [{ key: 'mvp', title: 'MVP', model: model('mvp', 'Ana L.') }, { key: 'server', title: 'Best server', model: model('server', 'Bea S.') }],
  artFor: () => ({ photo: null, cutout: null, background: null }),
  clubName: 'Demo VC',
};
const stat: StoryStat = { id: 'strength', kicker: 'Side-out', big: 68, bigSuffix: '%', caption: 'of rallies won on the opponent’s serve', detail: null };
const slides = buildStory({ introTitle: 'Season 2026-27', teamName: 'U17', stats: [stat], awardCount: 2, includeStory: true });

describe('renderStoryFrame', () => {
  it('intro: every word of the title and the team name at the end', () => {
    const { ctx, texts } = recordingCtx();
    const done = renderStoryFrame(ctx, slides, 0, 10_000, deps, false, null);
    expect(done).toBe(true);
    expect(texts()).toEqual(expect.arrayContaining(['Season', '2026-27', 'U17']));
  });

  it('stat: counts up from 0 to the final number', () => {
    const early = recordingCtx();
    renderStoryFrame(early.ctx, slides, 1, 0, deps, false, null);
    expect(early.texts()).toContain('0%');
    const late = recordingCtx();
    renderStoryFrame(late.ctx, slides, 1, 10_000, deps, false, null);
    expect(late.texts()).toEqual(expect.arrayContaining(['SIDE-OUT', '68%']));
  });

  it('long caption wraps into several lines inside the card', () => {
    const { ctx, calls } = recordingCtx();
    renderStoryFrame(ctx, slides, 1, 10_000, deps, false, null);
    const captionLines = calls.filter((c) => c.method === 'fillText' && /rallies|serve/.test(String(c.args[0])));
    expect(captionLines.length).toBeGreaterThan(1);
  });

  it('reduced motion draws the final frame immediately', () => {
    const { ctx, texts } = recordingCtx();
    const done = renderStoryFrame(ctx, slides, 1, 0, deps, true, null);
    expect(done).toBe(true);
    expect(texts()).toContain('68%');
  });

  it('suspense never reports done (it pulses) unless motion is reduced', () => {
    const suspense = slides.findIndex((s) => s.kind === 'awardSuspense');
    expect(renderStoryFrame(recordingCtx().ctx, slides, suspense, 99_999, deps, false, null)).toBe(false);
    expect(renderStoryFrame(recordingCtx().ctx, slides, suspense, 0, deps, true, null)).toBe(true);
  });

  it('reveal shows the winner name; summary lists every winner and award', () => {
    const reveal = recordingCtx();
    renderStoryFrame(reveal.ctx, slides, slides.findIndex((s) => s.kind === 'awardReveal'), 10_000, deps, false, null);
    expect(reveal.texts()).toContain('Ana L.');
    const summary = recordingCtx();
    renderStoryFrame(summary.ctx, slides, slides.length - 1, 10_000, deps, false, null);
    expect(summary.texts()).toEqual(expect.arrayContaining(['Winners', 'Ana L.', 'Bea S.', 'MVP', 'Best server']));
  });

  it('wipes from the previous colour during the first 250 ms, not after', () => {
    const during = recordingCtx();
    expect(renderStoryFrame(during.ctx, slides, 1, 100, deps, false, 0)).toBe(false);
    const fillsDuring = during.calls.filter((c) => c.method === 'set:fillStyle').map((c) => c.args[0]);
    expect(fillsDuring).toContain(PRESET_PALETTES[0].colors[0]); // intro background still visible
  });

  it('durations: suspense is open-ended, summary grows with the number of winners', () => {
    expect(slideDurationMs(slides[1], 2)).toBeGreaterThan(0);
    expect(slideDurationMs({ kind: 'summary', colorIndex: 0 }, 10)).toBeGreaterThan(slideDurationMs({ kind: 'summary', colorIndex: 0 }, 2));
  });
});
```

Update `src/awards/card/drawAwardCard.test.ts`: replace `import { PRESETS } from './cardTheme';` with

```ts
import { PRESET_PALETTES, slideColors } from '../palette';
const colors = slideColors(PRESET_PALETTES[0], 0);
const colors2 = slideColors(PRESET_PALETTES[1], 0);
```

then replace every `PRESETS[0]` with `colors`, `PRESETS[1]` with `colors2`, and every `{ photo: X, background: Y }` art literal with `{ photo: X, cutout: null, background: Y }`. Add:

```ts
  it('draws a cut-out large, bottom-anchored, instead of the circle', () => {
    const cut = { width: 600, height: 900 } as unknown as ImageBitmap;
    const { ctx, calls } = recordingCtx();
    drawAwardCard(ctx, card, colors, { photo: null, cutout: cut, background: null }, 1);
    const draw = calls.find((c) => c.method === 'drawImage' && c.args[0] === cut)!;
    const [, , y, , h] = draw.args as number[];
    expect(h).toBeGreaterThan(CARD_H * 0.6);
    expect(y + h).toBeCloseTo(CARD_H, 0);
    expect(calls.some((c) => c.method === 'clip')).toBe(false); // no photo circle
  });
```

Replace the existing test "a background image is drawn cover-fit with a scrim" (the scrim is gone; the image is now a texture over the flat colour) with:

```ts
  it('a background image is drawn cover-fit as a translucent texture', () => {
    const { ctx, calls } = recordingCtx();
    drawAwardCard(ctx, card, colors, { photo: null, cutout: null, background: fakeImage }, 1);
    const draw = calls.find((c) => c.method === 'drawImage')!;
    // 800×600 into 1080×1920 cover → scale 3.2 → 2560×1920, centred: x = (1080-2560)/2
    expect(draw.args.slice(1)).toEqual([(CARD_W - 2560) / 2, 0, 2560, CARD_H]);
    expect(calls.some((c) => c.method === 'set:globalAlpha' && c.args[0] === 0.35)).toBe(true);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/card`
Expected: FAIL — missing modules `./wrapText`, `./drawSlide`, `../palette` colours not accepted by `drawAwardCard` types (vitest reports the import errors first).

- [ ] **Step 3: Implement `wrapText.ts`**

```ts
// src/awards/card/wrapText.ts
const FAMILY = 'Inter, system-ui, sans-serif';

/** Greedy word wrap at the context's current font. */
export function wrapLines(ctx: CanvasRenderingContext2D, s: string, maxWidth: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest size ≤ maxSize (down to 40% of it) at which `s` fits on one line. Leaves ctx.font set to it. */
export function fitFontSize(ctx: CanvasRenderingContext2D, s: string, weight: number, maxSize: number, maxWidth: number): number {
  const min = Math.ceil(maxSize * 0.4);
  let size = maxSize;
  for (;;) {
    ctx.font = `${weight} ${size}px ${FAMILY}`;
    if (size <= min || ctx.measureText(s).width <= maxWidth) return size;
    size = Math.max(min, Math.floor(size * 0.9));
  }
}
```

- [ ] **Step 4: Update `drawAwardCard.ts` to colours + cut-out**

Replace the top of the file through `drawHeader` and the signatures as follows (keep `fitName`, beats, confetti logic as is):

```ts
import type { SlideColors } from '../palette';
import { cardBeats, easeOutBack, easeOutCubic } from './cardTimeline';
import { confettiAt, seedFrom } from './confetti';
import { fitName } from './fitName';
import { fitFontSize } from './wrapText';

export const CARD_W = 1080;
export const CARD_H = 1920;
const CX = CARD_W / 2;
const CIRCLE_Y = 860;
const CIRCLE_R = 300;
const TEXT_W = 920;
/** Cut-out height as a share of the card: big enough to read as a poster. */
const CUTOUT_H = CARD_H * 0.7;

export interface CardModel {
  key: string; awardTitle: string; name: string; number: number | null;
  statLine: string | null; footer: string; teamName: string; clubName: string; note: string;
}
type Img = ImageBitmap | HTMLCanvasElement;
export interface CardArt { photo: Img | null; cutout: Img | null; background: Img | null }

/** Flat slide colour, one soft accent disc, and the optional photo texture on top. */
export function drawBackground(ctx: CanvasRenderingContext2D, colors: SlideColors, art: Pick<CardArt, 'background'>, alpha: number, seed = 0) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(seed % 2 ? CARD_W * 0.85 : CARD_W * 0.15, CARD_H * (0.2 + (seed % 3) * 0.25), 520, 0, Math.PI * 2);
  ctx.fill();
  if (art.background) {
    ctx.globalAlpha = 0.35 * alpha;
    const s = Math.max(CARD_W / art.background.width, CARD_H / art.background.height);
    const w = art.background.width * s, h = art.background.height * s;
    ctx.drawImage(art.background, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
  }
  ctx.restore();
}

export function text(ctx: CanvasRenderingContext2D, s: string, y: number, font: string, color: string, alpha: number) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, CX, y);
  ctx.restore();
}

export function drawHeader(ctx: CanvasRenderingContext2D, card: Pick<CardModel, 'teamName' | 'clubName'>, colors: SlideColors, alpha: number) {
  if (card.clubName.trim()) text(ctx, card.clubName.trim().toUpperCase(), 150, '700 34px Inter, system-ui, sans-serif', colors.muted, alpha);
  text(ctx, card.teamName.toUpperCase(), 200, '600 30px Inter, system-ui, sans-serif', colors.muted, alpha);
}
```

In `drawAwardCard`, change the signature to `(ctx, card, colors: SlideColors, art: CardArt, t, reducedMotion = false)` and:
- `drawBackground(ctx, colors, art, easeOutCubic(b.bg), seedFrom(card.key));` and `drawHeader(ctx, card, colors, ...)`.
- Title: `const size = fitFontSize(ctx, card.awardTitle, 900, 110, TEXT_W);` then `text(ctx, card.awardTitle, 420, \`900 ${size}px Inter, system-ui, sans-serif\`, colors.accent, tt)`.
- Replace the photo/number circle block with:

```ts
  if (b.photo > 0 && art.cutout) {
    // Poster layout: the player stands in front of the title, anchored to the bottom edge.
    const e = easeOutCubic(b.photo);
    const s = CUTOUT_H / art.cutout.height;
    const w = art.cutout.width * s;
    ctx.save();
    ctx.globalAlpha = e;
    ctx.drawImage(art.cutout, CX - w / 2, CARD_H - CUTOUT_H + (1 - e) * 200, w, CUTOUT_H);
    ctx.restore();
    // Fade the lower card back to the slide colour so name and stat stay legible.
    const g = ctx.createLinearGradient(0, 1150, 0, 1420);
    g.addColorStop(0, `${colors.bg}00`);
    g.addColorStop(1, colors.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 1150, CARD_W, CARD_H - 1150);
  } else if (b.photo > 0) {
    /* existing circle block, unchanged except: fillStyle = colors.accent, strokeStyle = colors.text,
       number fillStyle = colors.bg */
  }
```

  (Keep the existing circle code verbatim inside the `else if`, substituting `theme.accent → colors.accent`, `theme.text → colors.text`, `theme.bgTo → colors.bg`. Note the `y + h` assertion in the test: `y = CARD_H - CUTOUT_H` at `b.photo = 1`.)
- Name/stat/footer: `theme.text → colors.text`, `theme.muted → colors.muted`.
- Confetti colours: `[colors.accent, colors.text, '#F5C542']`.

Update `drawTitleCard`:

```ts
export function drawTitleCard(ctx: CanvasRenderingContext2D, title: string, colors: SlideColors, art: CardArt, pulse: number): void {
  drawBackground(ctx, colors, art, 1);
  ctx.save();
  const r = 340 + 40 * Math.sin(pulse * Math.PI * 2);
  const g = ctx.createRadialGradient(CX, CARD_H / 2, 0, CX, CARD_H / 2, r);
  g.addColorStop(0, `${colors.accent}66`);
  g.addColorStop(1, `${colors.accent}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.restore();
  const size = fitFontSize(ctx, title, 900, 120, TEXT_W);
  text(ctx, title, CARD_H / 2 + 40, `900 ${size}px Inter, system-ui, sans-serif`, colors.text, 1);
}
```

- [ ] **Step 5: Implement `drawSlide.ts`**

```ts
// src/awards/card/drawSlide.ts
import { slideColors, type Palette, type SlideColors } from '../palette';
import type { Slide } from '../story/buildStory';
import type { StoryStat } from '../story/storyStats';
import { CARD_DURATION_MS, easeOutBack, easeOutCubic } from './cardTimeline';
import { CARD_H, CARD_W, drawAwardCard, drawBackground, drawHeader, drawTitleCard, text, type CardArt, type CardModel } from './drawAwardCard';
import { fitFontSize, wrapLines } from './wrapText';

export interface PresentCard { key: string; title: string; model: CardModel }
export interface StoryDeps { palette: Palette; cards: PresentCard[]; artFor: (key: string) => CardArt; clubName: string }

export const WIPE_MS = 250;
const INTRO_MS = 1200;
const STAT_MS = 1600;
const SUSPENSE_PULSE_MS = 1600;
const TEXT_W = 920;
const CX = CARD_W / 2;
const FONT = 'Inter, system-ui, sans-serif';

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

/** How long a slide's entrance animation runs (suspense loops; its value is one pulse). */
export function slideDurationMs(slide: Slide, cardCount: number): number {
  switch (slide.kind) {
    case 'intro': return INTRO_MS;
    case 'stat': return STAT_MS;
    case 'awardTitle': return 0;
    case 'awardSuspense': return SUSPENSE_PULSE_MS;
    case 'awardReveal': return CARD_DURATION_MS;
    case 'summary': return 600 + 80 * cardCount;
  }
}

function drawIntro(ctx: CanvasRenderingContext2D, slide: Extract<Slide, { kind: 'intro' }>, colors: SlideColors, deps: StoryDeps, t: number) {
  const clubName = deps.clubName;
  drawBackground(ctx, colors, deps.artFor(''), 1, 1); // artFor('') carries only the shared background image
  drawHeader(ctx, { teamName: '', clubName }, colors, 1);
  const words = slide.title.split(/\s+/).filter(Boolean);
  const n = words.length;
  words.forEach((w, i) => {
    const p = seg(t, i / (n + 1), (i + 1) / (n + 1));
    if (p <= 0) return;
    const s = Math.max(0, easeOutBack(p));
    const size = fitFontSize(ctx, w, 900, 170, TEXT_W);
    ctx.save();
    ctx.translate(CX, 760 + i * 190);
    ctx.scale(1.15 - 0.15 * s, 1.15 - 0.15 * s);
    ctx.translate(-CX, -(760 + i * 190));
    text(ctx, w, 760 + i * 190, `900 ${size}px ${FONT}`, i === n - 1 ? colors.accent : colors.text, clamp(p * 2));
    ctx.restore();
  });
  text(ctx, slide.subtitle, 760 + n * 190 + 60, `700 56px ${FONT}`, colors.muted, seg(t, n / (n + 1), 1));
}

function drawStat(ctx: CanvasRenderingContext2D, stat: StoryStat, colors: SlideColors, deps: StoryDeps, t: number) {
  const clubName = deps.clubName;
  drawBackground(ctx, colors, deps.artFor(''), 1, 2);
  drawHeader(ctx, { teamName: '', clubName }, colors, 1);
  text(ctx, stat.kicker.toUpperCase(), 640, `800 64px ${FONT}`, colors.accent, seg(t, 0, 0.2));
  const shown = Math.round(stat.big * easeOutCubic(seg(t, 0, 0.7)));
  const big = `${shown}${stat.bigSuffix}`;
  const finalSize = fitFontSize(ctx, `${stat.big}${stat.bigSuffix}`, 900, 320, TEXT_W);
  text(ctx, big, 1000, `900 ${finalSize}px ${FONT}`, colors.text, 1);
  const ct = easeOutCubic(seg(t, 0.6, 1));
  ctx.font = `700 60px ${FONT}`;
  const lines = wrapLines(ctx, stat.caption, TEXT_W);
  lines.forEach((l, i) => text(ctx, l, 1160 + i * 76 + (1 - ct) * 40, `700 60px ${FONT}`, colors.text, ct));
  if (stat.detail) text(ctx, stat.detail, 1160 + lines.length * 76 + 60, `600 44px ${FONT}`, colors.muted, ct);
}

function drawSummary(ctx: CanvasRenderingContext2D, deps: StoryDeps, colors: SlideColors, t: number, reduced: boolean) {
  drawBackground(ctx, colors, deps.artFor(''), 1, 3);
  const first = deps.cards[0]?.model;
  if (first) drawHeader(ctx, first, colors, 1);
  text(ctx, 'Winners', 330, `900 120px ${FONT}`, colors.accent, 1);
  const n = deps.cards.length;
  const rows = Math.ceil(n / 2);
  const top = 420, bottom = CARD_H - 180;
  const rowH = Math.min(300, (bottom - top) / Math.max(1, rows));
  const r = Math.min(90, rowH * 0.28);
  deps.cards.forEach((c, i) => {
    const appear = reduced ? 1 : easeOutBack(seg(t * (600 + 80 * n), i * 80, i * 80 + 600));
    if (appear <= 0) return;
    const cx = n === 1 ? CX : i % 2 === 0 ? CARD_W * 0.27 : CARD_W * 0.73;
    const cy = top + Math.floor(i / 2) * rowH + r + 10;
    const art = deps.artFor(c.key);
    const img = art.cutout ?? art.photo;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(appear, appear);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = colors.accent;
    ctx.fill();
    ctx.clip();
    if (img) {
      const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
      ctx.drawImage(img, -(img.width * s) / 2, -(img.height * s) / 2, img.width * s, img.height * s);
    } else if (c.model.number !== null) {
      ctx.font = `900 ${Math.round(r)}px ${FONT}`;
      ctx.fillStyle = colors.bg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(c.model.number), 0, 4);
    }
    ctx.restore();
    const alpha = clamp(appear);
    const titleSize = Math.min(34, fitFontSize(ctx, c.title, 600, 34, CARD_W * 0.42));
    const nameSize = Math.min(46, fitFontSize(ctx, c.model.name, 800, 46, CARD_W * 0.42));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.muted;
    ctx.font = `600 ${titleSize}px ${FONT}`;
    ctx.fillText(c.title, cx, cy + r + 44);
    ctx.fillStyle = colors.text;
    ctx.font = `800 ${nameSize}px ${FONT}`;
    ctx.fillText(c.model.name, cx, cy + r + 44 + nameSize + 8);
    ctx.restore();
  });
}

/**
 * Draws slide `index` as it looks `elapsedMs` after it appeared. During the first WIPE_MS after a
 * colour change, the previous slide's colour is wiped away left to right. Returns true when the
 * frame is final (callers can stop their animation loop).
 */
export function renderStoryFrame(
  ctx: CanvasRenderingContext2D, slides: Slide[], index: number, elapsedMs: number, deps: StoryDeps, reduced: boolean, prevIndex: number | null,
): boolean {
  const slide = slides[index];
  const colors = slideColors(deps.palette, slide.colorIndex);
  const duration = slideDurationMs(slide, deps.cards.length);
  const t = reduced || duration === 0 ? 1 : clamp(elapsedMs / duration);
  let done = t >= 1;
  switch (slide.kind) {
    case 'intro': drawIntro(ctx, slide, colors, deps, t); break;
    case 'stat': drawStat(ctx, slide.stat, colors, deps, t); break;
    case 'awardTitle': {
      const c = deps.cards[slide.awardIndex];
      drawTitleCard(ctx, c.title, colors, deps.artFor(c.key), 0);
      break;
    }
    case 'awardSuspense': {
      const c = deps.cards[slide.awardIndex];
      drawTitleCard(ctx, c.title, colors, deps.artFor(c.key), reduced ? 0 : (elapsedMs % SUSPENSE_PULSE_MS) / SUSPENSE_PULSE_MS);
      done = reduced;
      break;
    }
    case 'awardReveal': {
      const c = deps.cards[slide.awardIndex];
      drawAwardCard(ctx, c.model, colors, deps.artFor(c.key), t, reduced);
      break;
    }
    case 'summary': drawSummary(ctx, deps, colors, t, reduced); break;
  }
  const prev = prevIndex === null ? null : slides[prevIndex];
  if (!reduced && prev && prev.colorIndex !== slide.colorIndex && elapsedMs < WIPE_MS) {
    const p = easeOutCubic(elapsedMs / WIPE_MS);
    ctx.save();
    ctx.fillStyle = slideColors(deps.palette, prev.colorIndex).bg;
    ctx.fillRect(CARD_W * p, 0, CARD_W * (1 - p), CARD_H);
    ctx.restore();
    return false;
  }
  return done;
}
```

`renderStoryFrame` never resets the transform: callers do (`ctx.setTransform(1, 0, 0, 1, 0, 0)` in Task 5 and Task 9; the thumbnail scales on purpose).

- [ ] **Step 6: Update `CardThumbnail.tsx` and `exportCards.ts`**

```tsx
// src/awards/CardThumbnail.tsx
import { useEffect, useRef } from 'react';
import type { SlideColors } from './palette';
import { CARD_H, CARD_W, drawAwardCard, type CardArt, type CardModel } from './card/drawAwardCard';

/** Small static preview (t = 1); scaled canvas, no animation. */
export function CardThumbnail({ card, colors, art, width = 108 }: { card: CardModel; colors: SlideColors; art: CardArt; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { photo, cutout, background } = art;
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const s = width / CARD_W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    drawAwardCard(ctx, card, colors, { photo, cutout, background }, 1, true);
  }, [card, colors, photo, cutout, background, width]);
  return <canvas ref={ref} width={width} height={Math.round((width * CARD_H) / CARD_W)} className="rounded-sm shadow-card" aria-hidden="true" />;
}
```

In `exportCards.ts` replace `renderCardPng` with:

```ts
/** Draws one 1080×1920 frame off-screen and returns it as PNG. */
export async function renderPng(draw: (ctx: CanvasRenderingContext2D) => void): Promise<Blob> {
  await ensureCardFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  draw(canvas.getContext('2d')!);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'));
}
```

and drop the `CardTheme` / `drawAwardCard` imports it no longer needs. Also add `'900 320px Inter', '800 64px Inter', '700 60px Inter'` to the `ensureCardFonts` list. Update `AwardsPage.tsx`'s `doExport` minimally so the build stays green until Task 6 rewires it:

```ts
const blob = await renderPng((ctx) => drawAwardCard(ctx, card, slideColors(PRESET_PALETTES[0], 0), artFor(a.key), 1));
```

(with imports `renderPng`, `drawAwardCard`, `PRESET_PALETTES`, `slideColors`), make `artFor` return `{ photo, cutout: null, background }`, and pass `colors={slideColors(PRESET_PALETTES[0], 0)}` where `AwardsPrepare` renders `CardThumbnail` (replace `theme={theme}`). `AwardsPresent` keeps compiling by mapping its `theme` prop internally: leave it untouched in this task except replacing `drawAwardCard(ctx, card.model, theme, …)` / `drawTitleCard(…, theme, …)` with `slideColors(PRESET_PALETTES[0], step.index)`; it is rewritten in Task 5.

- [ ] **Step 7: Run tests, lint and build**

Run: `npx vitest run src/awards && npx tsc -b`
Expected: PASS, no type errors. Fix any remaining `CardArt` literal missing `cutout` (TypeScript lists them).

- [ ] **Step 8: Commit**

```bash
git add src/awards
git commit -m "feat(awards): slide renderer — palette colours, cut-out poster layout, intro/stat/summary slides, colour wipe"
```

---

### Task 5: Story presenter

**Files:**
- Rewrite: `src/awards/AwardsPresent.tsx`
- Test: `src/awards/AwardsPresent.test.tsx` (rewrite)
- Modify: `src/awards/AwardsPage.tsx` (build the story and pass it)
- Delete: `src/awards/presentSteps.ts`, `src/awards/presentSteps.test.ts`

**Interfaces:**
- Consumes: `Slide`, `buildStory`, `sceneProgress` (Task 3); `renderStoryFrame`, `PresentCard`, `StoryDeps` (Task 4); `storyStats` (Task 2); `Palette` (Task 1).
- Produces: `AwardsPresent({ slides, deps, onExit }: { slides: Slide[]; deps: StoryDeps; onExit: () => void })`; `function slideAnnouncement(slide: Slide, cards: PresentCard[]): string` (exported for tests and the video task).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/awards/AwardsPresent.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardModel } from './card/drawAwardCard';
import type { StoryDeps } from './card/drawSlide';
import { PRESET_PALETTES } from './palette';
import { buildStory } from './story/buildStory';
import { AwardsPresent } from './AwardsPresent';

const model = (key: string, name: string): CardModel => ({ key, awardTitle: key, name, number: 7, statLine: null, footer: '', teamName: 'U17', clubName: '', note: '' });
const deps: StoryDeps = {
  palette: PRESET_PALETTES[0],
  cards: [{ key: 'server', title: 'Best server', model: model('server', 'Ana L.') }, { key: 'mvp', title: 'MVP', model: model('mvp', 'Bea S.') }],
  artFor: () => ({ photo: null, cutout: null, background: null }),
  clubName: '',
};
const stat = { id: 'record' as const, kicker: 'This season', big: 7, bigSuffix: '', caption: 'wins out of 10 matches', detail: null };
const story = buildStory({ introTitle: 'Season 2026-27', teamName: 'U17', stats: [stat], awardCount: 2, includeStory: true });
const awardsOnly = buildStory({ introTitle: '', teamName: '', stats: [], awardCount: 2, includeStory: false });

describe('AwardsPresent', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('announces story slides, then award steps, with keyboard navigation', () => {
    render(<AwardsPresent slides={story} deps={deps} onExit={vi.fn()} />);
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent('Season 2026-27 — U17');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(live).toHaveTextContent('This season: 7 wins out of 10 matches');
    fireEvent.keyDown(window, { key: ' ' });
    expect(live).toHaveTextContent('Best server');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(live).toHaveTextContent('Best server: Ana L.');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(live).not.toHaveTextContent('Ana L.');
  });

  it('ends on the summary, stays there, and Escape exits', () => {
    const onExit = vi.fn();
    render(<AwardsPresent slides={awardsOnly} deps={deps} onExit={onExit} />);
    for (let i = 0; i < 20; i++) fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('status')).toHaveTextContent('Winners: Best server — Ana L., MVP — Bea S.');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalled();
  });

  it('shows one progress segment per scene and fills them as you advance', () => {
    const { container } = render(<AwardsPresent slides={story} deps={deps} onExit={vi.fn()} />);
    const bar = screen.getByRole('progressbar', { name: 'Presentation progress' });
    expect(bar.children).toHaveLength(5); // intro, stat, 2 awards, summary
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(container.querySelector('canvas')!.className).toContain('object-contain');
  });

  it('releases a wake lock that resolves after unmount', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    let resolve!: (l: { release: () => Promise<void> }) => void;
    const request = vi.fn(() => new Promise<{ release: () => Promise<void> }>((r) => { resolve = r; }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    const { unmount } = render(<AwardsPresent slides={awardsOnly} deps={deps} onExit={vi.fn()} />);
    unmount();
    resolve({ release });
    await Promise.resolve();
    await Promise.resolve();
    expect(release).toHaveBeenCalled();
    // @ts-expect-error test cleanup
    delete navigator.wakeLock;
  });

  it('never shows runners-up (only winners are in cards)', () => {
    render(<AwardsPresent slides={awardsOnly} deps={deps} onExit={vi.fn()} />);
    expect(screen.queryByText(/Runners-up/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/AwardsPresent.test.tsx`
Expected: FAIL — `slides`/`deps` props unknown, no progressbar.

- [ ] **Step 3: Rewrite `AwardsPresent.tsx`**

Keep `useReducedMotion` and `useWakeLock` exactly as they are today; replace the rest:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize, X } from 'lucide-react';
import { CARD_H, CARD_W } from './card/drawAwardCard';
import { renderStoryFrame, type PresentCard, type StoryDeps } from './card/drawSlide';
import { slideColors } from './palette';
import { sceneProgress, type Slide } from './story/buildStory';

/* useReducedMotion and useWakeLock: unchanged from the previous version of this file */

export function slideAnnouncement(slide: Slide, cards: PresentCard[]): string {
  switch (slide.kind) {
    case 'intro': return `${slide.title} — ${slide.subtitle}`;
    case 'stat': return `${slide.stat.kicker}: ${slide.stat.big}${slide.stat.bigSuffix} ${slide.stat.caption}`;
    case 'awardTitle':
    case 'awardSuspense': return cards[slide.awardIndex].title;
    case 'awardReveal': return `${cards[slide.awardIndex].title}: ${cards[slide.awardIndex].model.name}`;
    case 'summary': return `Winners: ${cards.map((c) => `${c.title} — ${c.model.name}`).join(', ')}`;
  }
}

export function AwardsPresent({ slides, deps, onExit }: { slides: Slide[]; deps: StoryDeps; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const prevIndex = useRef<number | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useWakeLock();

  const go = useCallback((delta: number) => {
    setIndex((i) => {
      const next = Math.max(0, Math.min(slides.length - 1, i + delta));
      if (next !== i) prevIndex.current = i;
      return next;
    });
  }, [slides.length]);
  const next = useCallback(() => go(1), [go]);
  const back = useCallback(() => go(-1), [go]);
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void rootRef.current?.requestFullscreen?.()?.catch(() => undefined);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); back(); }
      else if (e.key === 'f' || e.key === 'F') fullscreen();
      else if (e.key === 'Escape') onExit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, fullscreen, onExit]);

  useEffect(() => {
    if (!controlsVisible) return;
    const id = window.setTimeout(() => setControlsVisible(false), 2000);
    return () => window.clearTimeout(id);
  }, [controlsVisible]);

  // One rAF loop per slide; draws to the canvas, never sets React state per frame.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || slides.length === 0) return;
    const start = performance.now();
    const from = prevIndex.current;
    let raf = 0;
    const frame = (now: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const done = renderStoryFrame(ctx, slides, index, now - start, deps, reduced, from);
      if (!done) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [index, slides, deps, reduced]);

  if (slides.length === 0) return null;
  const slide = slides[index];
  const progress = sceneProgress(slides, index);
  const colors = slideColors(deps.palette, slide.colorIndex);

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: colors.bg }}
      onPointerMove={() => setControlsVisible(true)}>
      <p role="status" aria-live="polite" className="sr-only">{slideAnnouncement(slide, deps.cards)}</p>

      {/* Letterboxed 9:16; tap halves = back / next. */}
      <div className="relative aspect-[9/16] h-full max-w-full">
        <canvas ref={canvasRef} width={CARD_W} height={CARD_H} className="h-full w-full object-contain" aria-hidden="true" />
        <div role="progressbar" aria-label="Presentation progress" aria-valuemin={1} aria-valuemax={progress.scenes} aria-valuenow={progress.current + 1}
          className="pointer-events-none absolute inset-x-3 top-3 flex gap-1">
          {Array.from({ length: progress.scenes }, (_, i) => (
            <span key={i} className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: `${colors.text}40` }}>
              <span className="block h-full rounded-full transition-[width] duration-300"
                style={{ background: colors.text, width: `${i < progress.current ? 100 : i === progress.current ? progress.fraction * 100 : 0}%` }} />
            </span>
          ))}
        </div>
        <button type="button" aria-label="Previous" className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize" onClick={back} />
        <button type="button" aria-label="Next" className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize" onClick={next} />
      </div>

      <div className={`absolute right-4 top-4 flex gap-2 transition-opacity ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <button type="button" onClick={back} aria-label="Previous slide" className="rounded-full bg-black/40 p-3 text-white"><ChevronLeft size={20} /></button>
        <button type="button" onClick={next} aria-label="Next slide" className="rounded-full bg-black/40 p-3 text-white"><ChevronRight size={20} /></button>
        <button type="button" onClick={fullscreen} aria-label="Fullscreen" className="rounded-full bg-black/40 p-3 text-white"><Maximize size={20} /></button>
        <button type="button" onClick={onExit} aria-label="Exit presentation" className="rounded-full bg-black/40 p-3 text-white"><X size={20} /></button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire it into `AwardsPage.tsx`**

Add near the other `useMemo`s (imports: `buildStory`, `storyStats`, `readStoryPref`, `PRESET_PALETTES`, `type StoryDeps`):

```ts
  const [includeStory] = useState(readStoryPref); // setter added in Task 6
  const palette = PRESET_PALETTES[0];              // replaced by the selected palette in Task 6
  const stats = useMemo(() => (ready ? storyStats(scope, ready.matches, ready.people) : []), [ready, scope]);
  const slides = useMemo(() => buildStory({
    introTitle: ready ? (scope === 'season' ? `Season ${ready.team.season}` : `vs ${ready.match!.opponent}`) : '',
    teamName: ready?.team.name ?? '', stats, awardCount: cards.length, includeStory,
  }), [ready, scope, stats, cards.length, includeStory]);
  const deps: StoryDeps = useMemo(() => ({ palette, cards, artFor, clubName: ready?.team.club ?? '' }), [palette, cards, artFor, ready]);
```

and render `<AwardsPresent slides={slides} deps={deps} onExit={() => setMode('prepare')} />`. Delete `presentSteps.ts` and its test.

- [ ] **Step 5: Run tests and typecheck — expect PASS**

Run: `npx vitest run src/awards && npx tsc -b`

- [ ] **Step 6: Commit**

```bash
git add -A src/awards
git commit -m "feat(awards): story presenter with scene progress bar over intro, stats, awards and summary"
```

---

### Task 6: Palette picker, palette editor and story toggle on the prepare screen

**Files:**
- Create: `src/awards/PaletteEditor.tsx`, `src/awards/PaletteEditor.test.tsx`
- Modify: `src/awards/AwardsPrepare.tsx`, `src/awards/AwardsPrepare.test.tsx`, `src/awards/AwardsPage.tsx`
- Delete: `src/awards/card/cardTheme.ts`, `src/awards/card/cardTheme.test.ts`

**Interfaces:**
- Consumes: Task 1 palette API; `readStoryPref`/`writeStoryPref`; `colorIndexForAward`; `Dialog` (`src/components/Dialog.tsx`: `{ title, onClose, children, footer?, size? }`).
- Produces:
  - `PaletteEditor({ initial, onSave, onDelete, onCancel }: { initial: Palette | null; onSave: (p: Palette) => void; onDelete?: () => void; onCancel: () => void })`
  - `AwardsPrepareProps` loses `themePrefs`/`onThemePrefs`, gains `palettePrefs: PalettePrefs; onPalettePrefs: (p: PalettePrefs) => void; includeStory: boolean; onIncludeStory: (on: boolean) => void; colorsFor: (key: string) => SlideColors; storyLabel: string`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/awards/PaletteEditor.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaletteEditor } from './PaletteEditor';

describe('PaletteEditor', () => {
  it('creates a named 4-colour palette by default and can add a fifth colour', () => {
    const onSave = vi.fn();
    render(<PaletteEditor initial={null} onSave={onSave} onCancel={vi.fn()} />);
    expect(screen.getAllByLabelText(/^Colour \d$/)).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Add colour' }));
    expect(screen.getAllByLabelText(/^Colour \d$/)).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Add colour' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Palette name'), { target: { value: 'Club night' } });
    fireEvent.change(screen.getByLabelText('Colour 1'), { target: { value: '#ff0000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save palette' }));
    const saved = onSave.mock.calls[0][0];
    expect(saved.name).toBe('Club night');
    expect(saved.colors).toHaveLength(5);
    expect(saved.colors[0]).toBe('#FF0000');
    expect(saved.id).toMatch(/^custom-/);
  });

  it('cannot go below four colours and requires a name', () => {
    render(<PaletteEditor initial={null} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Remove colour 4' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Palette name'), { target: { value: '  ' } });
    expect(screen.getByRole('button', { name: 'Save palette' })).toBeDisabled();
  });

  it('edits an existing palette keeping its id, and can delete it', () => {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const initial = { id: 'custom-1', name: 'Mine', colors: ['#000000', '#111111', '#222222', '#333333'] };
    render(<PaletteEditor initial={initial} onSave={onSave} onDelete={onDelete} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save palette' }));
    expect(onSave.mock.calls[0][0].id).toBe('custom-1');
    fireEvent.click(screen.getByRole('button', { name: 'Delete palette' }));
    expect(onDelete).toHaveBeenCalled();
  });
});
```

In `src/awards/AwardsPrepare.test.tsx`, replace the theme props in its shared `props` factory with:

```ts
  palettePrefs: { selectedId: 'navy', custom: [] }, onPalettePrefs: vi.fn(),
  includeStory: true, onIncludeStory: vi.fn(), storyLabel: 'Include season story',
  colorsFor: () => slideColors(PRESET_PALETTES[0], 0),
```

(import `PRESET_PALETTES, slideColors` from `./palette`; drop any test that exercised the old "Custom colours" checkbox) and add:

```tsx
  it('switches palette and toggles the story', () => {
    const onPalettePrefs = vi.fn();
    const onIncludeStory = vi.fn();
    render(<AwardsPrepare {...props()} onPalettePrefs={onPalettePrefs} onIncludeStory={onIncludeStory} />);
    fireEvent.change(screen.getByLabelText('Palette'), { target: { value: 'wrapped' } });
    expect(onPalettePrefs).toHaveBeenCalledWith({ selectedId: 'wrapped', custom: [] });
    fireEvent.click(screen.getByLabelText('Include season story'));
    expect(onIncludeStory).toHaveBeenCalledWith(false);
  });

  it('saves a new custom palette and selects it', () => {
    const onPalettePrefs = vi.fn();
    render(<AwardsPrepare {...props()} onPalettePrefs={onPalettePrefs} />);
    fireEvent.click(screen.getByRole('button', { name: 'New palette' }));
    fireEvent.change(screen.getByLabelText('Palette name'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save palette' }));
    const prefs = onPalettePrefs.mock.calls.at(-1)![0];
    expect(prefs.custom).toHaveLength(1);
    expect(prefs.selectedId).toBe(prefs.custom[0].id);
  });
```

(If the existing test file builds props inline rather than via a `props()` factory, introduce `function props(): AwardsPrepareProps` at the top with the current inline values plus the new ones above, and use it in every test.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/PaletteEditor.test.tsx src/awards/AwardsPrepare.test.tsx`
Expected: FAIL — no `PaletteEditor`, no "Palette" select.

- [ ] **Step 3: Implement `PaletteEditor.tsx`**

```tsx
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Input } from '../components/Input';
import { MAX_COLORS, MIN_COLORS, PRESET_PALETTES, newPaletteId, slideColors, type Palette } from './palette';

const DEFAULT_COLORS = PRESET_PALETTES.find((p) => p.id === 'wrapped')!.colors.slice(0, MIN_COLORS);

export function PaletteEditor({ initial, onSave, onDelete, onCancel }: {
  initial: Palette | null; onSave: (p: Palette) => void; onDelete?: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? 'My palette');
  const [colors, setColors] = useState<string[]>(initial?.colors ?? DEFAULT_COLORS);
  const draft: Palette = { id: initial?.id ?? 'draft', name, colors };
  const setColor = (i: number, v: string) => setColors((cs) => cs.map((c, j) => (j === i ? v.toUpperCase() : c)));

  return (
    <Dialog title={initial ? 'Edit palette' : 'New palette'} onClose={onCancel}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {onDelete && <Button variant="dangerGhost" onClick={onDelete}><Trash2 size={16} aria-hidden="true" /> Delete palette</Button>}
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={() => onSave({ id: initial?.id ?? newPaletteId(), name: name.trim(), colors })}>Save palette</Button>
        </div>
      }>
      <label className="block text-sm font-medium text-ink" htmlFor="palette-name">Palette name</label>
      <Input id="palette-name" className="mt-1 w-full" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />

      <p className="mt-4 text-sm font-medium text-ink">Colours</p>
      <p className="text-xs text-slate">Each slide takes the next colour; text turns white or dark automatically so it stays readable.</p>
      <ul className="mt-2 flex flex-wrap gap-3">
        {colors.map((c, i) => (
          <li key={i} className="flex flex-col items-center gap-1">
            <input type="color" aria-label={`Colour ${i + 1}`} value={c} onChange={(e) => setColor(i, e.target.value)}
              className="h-12 w-12 cursor-pointer rounded-md border border-border" />
            <Button variant="ghost" size="icon" aria-label={`Remove colour ${i + 1}`} disabled={colors.length <= MIN_COLORS}
              onClick={() => setColors((cs) => cs.filter((_, j) => j !== i))}>
              <Trash2 size={14} aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" size="sm" className="mt-2" disabled={colors.length >= MAX_COLORS}
        onClick={() => setColors((cs) => [...cs, cs[cs.length % cs.length]])}>Add colour</Button>

      <p className="mt-4 text-sm font-medium text-ink">Preview</p>
      <div className="mt-2 flex gap-2" aria-hidden="true">
        {colors.map((_, i) => {
          const sc = slideColors(draft, i);
          return (
            <div key={i} className="flex aspect-[9/16] w-12 flex-col items-center justify-center rounded-sm" style={{ background: sc.bg }}>
              <span className="text-lg font-black" style={{ color: sc.accent }}>7</span>
              <span className="text-[11px] font-semibold" style={{ color: sc.text }}>wins</span>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 4: Update `AwardsPrepare.tsx`**

Replace the `Theme` / `Custom colours` / `Top` / `Bottom` controls in the "Card settings" section with:

```tsx
        <label className="text-sm text-slate">Palette
          <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={props.palettePrefs.selectedId}
            onChange={(e) => props.onPalettePrefs({ ...props.palettePrefs, selectedId: e.target.value })}>
            <optgroup label="Presets">
              {PRESET_PALETTES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
            {props.palettePrefs.custom.length > 0 && (
              <optgroup label="Yours">
                {props.palettePrefs.custom.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <span className="flex gap-1" aria-hidden="true">
          {palette.colors.map((c, i) => <span key={i} className="h-6 w-6 rounded-sm border border-border" style={{ background: c }} />)}
        </span>
        <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>New palette</Button>
        {isCustom && <Button variant="ghost" size="sm" onClick={() => setEditing(palette)}>Edit palette</Button>}
        <label className="inline-flex items-center gap-2 text-sm text-slate">
          <input type="checkbox" checked={props.includeStory} onChange={(e) => props.onIncludeStory(e.target.checked)} />
          {props.storyLabel}
        </label>
```

with, near the top of the component:

```tsx
  const [editing, setEditing] = useState<Palette | 'new' | null>(null);
  const palette = selectedPalette(props.palettePrefs);
  const isCustom = props.palettePrefs.custom.some((p) => p.id === palette.id);
```

and, before the closing `</div>` of the component:

```tsx
      {editing && (
        <PaletteEditor
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={(p) => {
            const custom = props.palettePrefs.custom.some((x) => x.id === p.id)
              ? props.palettePrefs.custom.map((x) => (x.id === p.id ? p : x))
              : [...props.palettePrefs.custom, p];
            props.onPalettePrefs({ selectedId: p.id, custom });
            setEditing(null);
          }}
          onDelete={editing === 'new' ? undefined : () => {
            props.onPalettePrefs({ selectedId: PRESET_PALETTES[0].id, custom: props.palettePrefs.custom.filter((x) => x.id !== editing.id) });
            setEditing(null);
          }}
        />
      )}
```

Pass `colors={props.colorsFor(a.key)}` to `CardThumbnail`. Remove `themeFromPrefs`, `PRESETS`, `ThemePrefs`, `theme`, `custom` usages; update the props interface as listed under **Interfaces**. Imports: `PRESET_PALETTES, selectedPalette, type Palette, type PalettePrefs, type SlideColors` from `./palette`, `PaletteEditor` from `./PaletteEditor`.

- [ ] **Step 5: Wire `AwardsPage.tsx`**

Replace the theme state and the Task 5 placeholders:

```ts
  const [palettePrefs, setPalettePrefs] = useState<PalettePrefs>(readPalettePrefs);
  const [includeStory, setIncludeStory] = useState(readStoryPref);
  const palette = useMemo(() => selectedPalette(palettePrefs), [palettePrefs]);
  const colorsFor = useCallback((key: string) => {
    const i = cards.findIndex((c) => c.key === key);
    return slideColors(palette, colorIndexForAward(slides, Math.max(0, i)));
  }, [cards, palette, slides]);
```

(`slides` must be declared before `colorsFor`; order the hooks: `cards` → `stats` → `slides` → `colorsFor` → `deps`.) In `doExport` use `drawAwardCard(ctx, card, colorsFor(a.key), artFor(a.key), 1)`. Pass to `AwardsPrepare`:

```tsx
      palettePrefs={palettePrefs}
      onPalettePrefs={(p) => { setPalettePrefs(p); writePalettePrefs(p); }}
      includeStory={includeStory}
      onIncludeStory={(on) => { setIncludeStory(on); writeStoryPref(on); }}
      storyLabel={scope === 'season' ? 'Include season story' : 'Include match story'}
      colorsFor={colorsFor}
```

Delete `src/awards/card/cardTheme.ts` and `cardTheme.test.ts`; `grep -rn cardTheme src` must return nothing.

- [ ] **Step 6: Run tests, lint, build — expect PASS**

Run: `npx vitest run src/awards && npm run lint && npx tsc -b`

- [ ] **Step 7: Commit**

```bash
git add -A src/awards
git commit -m "feat(awards): palette picker and editor, story toggle; exports use the slide's palette colour"
```

---

### Task 7: Consent gating and the one-time share warning

**Files:**
- Modify: `src/awards/AwardsPage.tsx`, `src/awards/AwardsPage.test.tsx`, `src/awards/AwardsPrepare.tsx`, `src/awards/AwardsPrepare.test.tsx`
- Create: `src/awards/shareWarning.ts`, `src/awards/shareWarning.test.ts`

**Interfaces:**
- Consumes: `loadTeamRoster(teamId): Promise<Player[]>` (`player.consent.given`), `ConfirmDialog` (`{ title, message, confirmLabel, onConfirm, onCancel }`).
- Produces:
  - `function photoAllowedKeys(awards: ResolvedAward[], consented: Set<string>): Set<string>` and `function gatedArt(key, allowed, photos, cutouts, background): CardArt` (in `AwardsPage.tsx`, exported for tests)
  - `shareWarning.ts`: `function needsShareWarning(): boolean`, `function markShareWarned(): void` (sessionStorage key `vcb.awards.shareWarned`)
  - `AwardsPrepareProps` gains `photoAllowed: (key: string) => boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// src/awards/shareWarning.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markShareWarned, needsShareWarning } from './shareWarning';

describe('shareWarning', () => {
  afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });
  it('warns once per session', () => {
    expect(needsShareWarning()).toBe(true);
    markShareWarned();
    expect(needsShareWarning()).toBe(false);
  });
  it('still warns when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(needsShareWarning()).toBe(true);
  });
});
```

Add to `src/awards/AwardsPage.test.tsx` (it already mocks the APIs; extend the `loadTeamRoster` mock so player `a` has `consent: { given: true, date: null, confirmedBy: null }` and player `b` has `given: false`):

```ts
import { photoAllowedKeys } from './AwardsPage';

describe('photoAllowedKeys', () => {
  const award = (key: string, playerId: string | null) => ({ key, winner: playerId ? { playerId, name: '', number: null, current: true } : null }) as unknown as ResolvedAward;
  it('allows photos only for winners with consent; former players and empty awards are excluded', () => {
    const keys = photoAllowedKeys([award('mvp', 'a'), award('server', 'b'), award('x', 'gone'), award('none', null)], new Set(['a']));
    expect([...keys]).toEqual(['mvp']);
  });
});
```

Add to `src/awards/AwardsPrepare.test.tsx`:

```tsx
  it('disables photo controls for a winner without consent and says why', () => {
    render(<AwardsPrepare {...props()} photoAllowed={() => false} />);
    expect(screen.getAllByText('No photo consent on file — the card shows the jersey number.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Add photo')).not.toBeInTheDocument();
  });
```

And the Review-Focus case — the page builds card art through one pure function, so it is tested directly (add to `AwardsPage.test.tsx`):

```ts
import { gatedArt } from './AwardsPage';

describe('gatedArt', () => {
  const photo = document.createElement('canvas');
  const cut = document.createElement('canvas');
  const photos = new Map([['mvp', photo]]);
  const cutouts = new Map([['mvp', cut]]);
  it('photo dropped when winner loses consent', () => {
    expect(gatedArt('mvp', new Set(['mvp']), photos, cutouts, null)).toEqual({ photo, cutout: cut, background: null });
    // the MVP winner was changed to a player without consent → mvp is no longer in the allowed set
    expect(gatedArt('mvp', new Set(), photos, cutouts, null)).toEqual({ photo: null, cutout: null, background: null });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/shareWarning.test.ts src/awards/AwardsPage.test.tsx src/awards/AwardsPrepare.test.tsx`
Expected: FAIL — missing module / export / prop.

- [ ] **Step 3: Implement**

```ts
// src/awards/shareWarning.ts
const KEY = 'vcb.awards.shareWarned';

/** True until the coach has confirmed the minors' images warning in this browser session. */
export function needsShareWarning(): boolean {
  try { return sessionStorage.getItem(KEY) !== '1'; } catch { return true; }
}

export function markShareWarned(): void {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* warn again next time */ }
}
```

In `AwardsPage.tsx`:

```ts
/** Awards whose winner is a current player with photo consent; only these may carry a photo or cut-out. */
export function photoAllowedKeys(awards: ResolvedAward[], consented: Set<string>): Set<string> {
  return new Set(awards.filter((a) => a.winner && consented.has(a.winner.playerId)).map((a) => a.key));
}
```

- extend the `ready` load state with `consented: Set<string>` built from the roster: `new Set(roster.filter((p) => p.consent?.given).map((p) => p.id))`;
- `const allowed = useMemo(() => photoAllowedKeys(awards, ready?.consented ?? new Set()), [awards, ready]);`
- add and use

```ts
/** Card art for one award: photo and cut-out only while the winner has photo consent. */
export function gatedArt(
  key: string, allowed: Set<string>, photos: Map<string, HTMLCanvasElement>, cutouts: Map<string, HTMLCanvasElement>, background: HTMLCanvasElement | null,
): CardArt {
  const ok = allowed.has(key);
  return { photo: ok ? photos.get(key) ?? null : null, cutout: ok ? cutouts.get(key) ?? null : null, background };
}
```

  with `const artFor = useCallback((key: string) => gatedArt(key, allowed, photos, EMPTY_CUTOUTS, background), [allowed, photos, background]);` and a module-level `const EMPTY_CUTOUTS = new Map<string, HTMLCanvasElement>();` — Task 8 replaces it with the cut-out state;
- pass `photoAllowed={(k) => allowed.has(k)}` to `AwardsPrepare`;
- wrap every export (`exportKeys`) in the warning: if `needsShareWarning()`, store the pending keys in state and render

```tsx
      {pendingShare && (
        <ConfirmDialog
          title="Share award cards"
          message="You're about to share images of minors. Share them only within the team."
          confirmLabel="Share"
          onCancel={() => setPendingShare(null)}
          onConfirm={() => { markShareWarned(); const run = pendingShare; setPendingShare(null); run(); }}
        />
      )}
```

  where `pendingShare: (() => void) | null`; otherwise run the export directly.

In `AwardsPrepare.tsx`, for each award: when `!props.photoAllowed(a.key)`, render `<p className="text-xs text-slate">No photo consent on file — the card shows the jersey number.</p>` instead of the "Add photo" label and "Remove photo" button.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/awards`

- [ ] **Step 5: Commit**

```bash
git add -A src/awards
git commit -m "feat(awards): photos only with consent; one-time minors' images warning before sharing"
```

---

### Task 8: On-device background removal (MediaPipe, self-hosted) + CSP

**Files:**
- Modify: `package.json` / `package-lock.json` (dependency), `vite.config.ts`, `.gitignore`, `firebase.json`, `src/awards/AwardsPage.tsx`, `src/awards/AwardsPrepare.tsx`, `src/awards/AwardsPrepare.test.tsx`
- Create: `public/models/selfie_segmenter.tflite`, `src/awards/cutout/segment.ts`, `src/awards/cutout/segment.test.ts`, `src/awards/cutout/csp.test.ts`

**Interfaces:**
- Produces:
  - `function maskToAlpha(mask: Float32Array, mw: number, mh: number, w: number, h: number): Uint8ClampedArray`
  - `function opaqueBounds(alpha: Uint8ClampedArray, w: number, h: number, threshold?: number): { x: number; y: number; w: number; h: number } | null`
  - `function removeBackground(photo: HTMLCanvasElement): Promise<HTMLCanvasElement>`
  - `AwardsPrepareProps` gains `cutouts: Map<string, HTMLCanvasElement>; onCutout: (key: string, on: boolean) => Promise<void>`

- [ ] **Step 1: Add the dependency and the model**

```bash
npm install @mediapipe/tasks-vision@^1.1.1
mkdir -p public/models
curl -L -o public/models/selfie_segmenter.tflite https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
ls -l public/models/selfie_segmenter.tflite   # expect roughly 250 KB
ls node_modules/@mediapipe/tasks-vision/wasm   # expect vision_wasm_internal.js / .wasm (+ nosimd variants)
```

Append to `.gitignore`:

```
# Copied from node_modules/@mediapipe/tasks-vision/wasm by vite.config.ts
public/mediapipe/
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/awards/cutout/csp.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(resolve(process.cwd(), 'firebase.json'), 'utf8')) as {
  hosting: { headers: { headers: { key: string; value: string }[] }[] };
};
const csp = config.hosting.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy')!.value;
const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'))!;

describe('CSP for on-device background removal', () => {
  it('allows WebAssembly but not JavaScript eval', () => {
    expect(scriptSrc).toContain("'wasm-unsafe-eval'");
    expect(scriptSrc).not.toMatch(/'unsafe-eval'/);
  });
  it('loads model and runtime only from this origin', () => {
    expect(csp).not.toContain('storage.googleapis.com');
    expect(csp).not.toContain('cdn.jsdelivr.net');
  });
});
```

```ts
// src/awards/cutout/segment.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const createFromOptions = vi.fn();
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn().mockResolvedValue({}) },
  ImageSegmenter: { createFromOptions: (...a: unknown[]) => createFromOptions(...a) },
}));

import { maskToAlpha, opaqueBounds, removeBackground } from './segment';

describe('segment', () => {
  afterEach(() => createFromOptions.mockReset());

  it('maps confidence to alpha with a soft edge', () => {
    const a = maskToAlpha(new Float32Array([0, 0.5, 1, 0.2]), 2, 2, 2, 2);
    expect([...a]).toEqual([0, 128, 255, 0]);
  });

  it('samples a smaller mask up to the image size (nearest)', () => {
    const a = maskToAlpha(new Float32Array([1, 0]), 2, 1, 4, 1);
    expect([...a]).toEqual([255, 255, 0, 0]);
  });

  it('finds the opaque bounding box, or null when empty', () => {
    const alpha = new Uint8ClampedArray([
      0, 0, 0, 0,
      0, 200, 200, 0,
      0, 0, 200, 0,
    ]);
    expect(opaqueBounds(alpha, 4, 3)).toEqual({ x: 1, y: 1, w: 2, h: 2 });
    expect(opaqueBounds(new Uint8ClampedArray(4), 2, 2)).toBeNull();
  });

  it('retry after load failure: rejects, then a later call loads again', async () => {
    createFromOptions.mockRejectedValueOnce(new Error('no wasm'));
    const photo = document.createElement('canvas');
    await expect(removeBackground(photo)).rejects.toThrow('no wasm');
    createFromOptions.mockRejectedValueOnce(new Error('still no'));
    await expect(removeBackground(photo)).rejects.toThrow('still no');
    expect(createFromOptions).toHaveBeenCalledTimes(2);
  });
});
```

Add to `AwardsPrepare.test.tsx` (props factory gains `cutouts: new Map(), onCutout: vi.fn().mockResolvedValue(undefined), photos: new Map([['mvp', document.createElement('canvas')]])` for this test only):

```tsx
  it('offers background removal for a consented photo and shows progress, then an error on failure', async () => {
    const onCutout = vi.fn().mockRejectedValue(new Error('x'));
    render(<AwardsPrepare {...props()} photos={new Map([[firstAwardKey, document.createElement('canvas')]])} photoAllowed={() => true} onCutout={onCutout} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove background' }));
    expect(screen.getByText('Preparing on this device…')).toBeInTheDocument();
    expect(await screen.findByText('Could not remove the background. The original photo is kept.')).toBeInTheDocument();
    expect(onCutout).toHaveBeenCalledWith(firstAwardKey, true);
  });
```

(`firstAwardKey` = the key of the first award in the test's `awards` fixture.)

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/awards/cutout src/awards/AwardsPrepare.test.tsx`
Expected: FAIL — CSP lacks `'wasm-unsafe-eval'`; `./segment` missing; no "Remove background" button.

- [ ] **Step 4: Implement `segment.ts`**

```ts
// src/awards/cutout/segment.ts
/**
 * On-device background removal. The MediaPipe runtime and model are served from this
 * site (/mediapipe, /models) and loaded on first use only; photos never leave the device.
 */
interface Mask { width: number; height: number; getAsFloat32Array(): Float32Array; close(): void }
interface Segmenter { segment(image: HTMLCanvasElement): { confidenceMasks?: Mask[]; close(): void } }

let loading: Promise<Segmenter> | null = null;

function getSegmenter(): Promise<Segmenter> {
  if (!loading) {
    loading = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe');
      return (await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/models/selfie_segmenter.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      })) as unknown as Segmenter;
    })();
    loading.catch(() => { loading = null; }); // a failed load can be retried
  }
  return loading;
}

const smooth = (lo: number, hi: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

/** Person confidence → alpha (0–255) at the image size; a smoothstep gives the soft edge. */
export function maskToAlpha(mask: Float32Array, mw: number, mh: number, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const my = Math.min(mh - 1, Math.floor((y * mh) / h));
    for (let x = 0; x < w; x++) {
      const mx = Math.min(mw - 1, Math.floor((x * mw) / w));
      out[y * w + x] = Math.round(255 * smooth(0.3, 0.7, mask[my * mw + mx]));
    }
  }
  return out;
}

export function opaqueBounds(alpha: Uint8ClampedArray, w: number, h: number, threshold = 8): { x: number; y: number; w: number; h: number } | null {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export async function removeBackground(photo: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const segmenter = await getSegmenter();
  const result = segmenter.segment(photo);
  try {
    const masks = result.confidenceMasks ?? [];
    // Selfie models return either [person] or [background, person]: the last mask is the person.
    const mask = masks[masks.length - 1];
    if (!mask) throw new Error('No person found in the photo');
    const { width: w, height: h } = photo;
    const alpha = maskToAlpha(mask.getAsFloat32Array(), mask.width, mask.height, w, h);
    const box = opaqueBounds(alpha, w, h);
    if (!box) throw new Error('No person found in the photo');
    const src = photo.getContext('2d')!.getImageData(0, 0, w, h);
    for (let i = 0; i < alpha.length; i++) src.data[i * 4 + 3] = Math.min(src.data[i * 4 + 3], alpha[i]);
    const full = document.createElement('canvas');
    full.width = w;
    full.height = h;
    full.getContext('2d')!.putImageData(src, 0, 0);
    const out = document.createElement('canvas');
    out.width = box.w;
    out.height = box.h;
    out.getContext('2d')!.drawImage(full, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    full.width = 0;
    return out;
  } finally {
    result.close();
  }
}
```

- [ ] **Step 5: Self-host the runtime via `vite.config.ts`**

Add the plugin (imports: `cpSync`, `existsSync`, `mkdirSync` from `node:fs`; `resolve` from `node:path`):

```ts
/** Serves MediaPipe's WASM runtime from our own origin (CSP: no third-party scripts). */
function mediapipeWasm(): Plugin {
  return {
    name: 'mediapipe-wasm',
    buildStart() {
      const from = resolve(process.cwd(), 'node_modules/@mediapipe/tasks-vision/wasm');
      const to = resolve(process.cwd(), 'public/mediapipe');
      if (!existsSync(from)) return;
      mkdirSync(to, { recursive: true });
      cpSync(from, to, { recursive: true });
    },
  };
}
```

and add `mediapipeWasm()` to `plugins`. In `firebase.json`, change the CSP `script-src` to `script-src 'self' 'wasm-unsafe-eval' https://apis.google.com https://www.gstatic.com`.

- [ ] **Step 6: Wire cut-outs into the page and prepare screen**

`AwardsPage.tsx`:
- state `cutouts: Map<string, HTMLCanvasElement>` with a `cutoutsRef`, released on leave like photos;
- `artFor`: `gatedArt(key, allowed, photos, cutouts, background)` (deps `[allowed, photos, cutouts, background]`; drop `EMPTY_CUTOUTS`);
- when `onPhoto` replaces or removes a key's photo, also drop and release its cut-out;
- handler:

```ts
  const onCutout = useCallback(async (key: string, on: boolean) => {
    const drop = () => {
      const next = new Map(cutoutsRef.current);
      const old = next.get(key);
      next.delete(key);
      cutoutsRef.current = next;
      setCutouts(next);
      if (old) old.width = 0;
    };
    if (!on) return drop();
    const photo = photosRef.current.get(key);
    if (!photo) return;
    const { removeBackground } = await import('./cutout/segment');
    const cut = await removeBackground(photo); // rejects → caller shows the error, original kept
    drop();
    const next = new Map(cutoutsRef.current).set(key, cut);
    cutoutsRef.current = next;
    setCutouts(next);
  }, []);
```

`AwardsPrepare.tsx` — per award with a photo and `photoAllowed`:

```tsx
  const [cutting, setCutting] = useState<string | null>(null);
  const [cutError, setCutError] = useState<string | null>(null);
  // …inside the award row, next to "Remove photo":
  {photo && props.photoAllowed(a.key) && (props.cutouts.has(a.key) ? (
    <Button variant="ghost" size="sm" onClick={() => void props.onCutout(a.key, false)}>Use original</Button>
  ) : (
    <Button variant="ghost" size="sm" disabled={cutting !== null} onClick={() => {
      setCutting(a.key);
      setCutError(null);
      props.onCutout(a.key, true)
        .catch(() => setCutError(a.key))
        .finally(() => setCutting(null));
    }}>Remove background</Button>
  ))}
  {cutting === a.key && <span role="status" className="text-sm text-slate">Preparing on this device…</span>}
  {cutError === a.key && <p role="alert" className="w-full text-sm text-red-strong">Could not remove the background. The original photo is kept.</p>}
```

- [ ] **Step 7: Run tests, lint, build — expect PASS**

Run: `npx vitest run src/awards && npm run lint && npm run build && ls dist/mediapipe dist/models`
Expected: tests pass; `dist/mediapipe/vision_wasm_internal.wasm` and `dist/models/selfie_segmenter.tflite` exist.

- [ ] **Step 8: Manual check (dev server)** — `npm run dev`, open season awards, add a photo for a consented winner, click "Remove background": the Network tab shows only same-origin requests to `/mediapipe/…` and `/models/…`; the card shows the poster layout.

- [ ] **Step 9: Commit**

```bash
git add -A package.json package-lock.json vite.config.ts .gitignore firebase.json public/models src/awards
git commit -m "feat(awards): on-device background removal (self-hosted MediaPipe) with poster cut-outs; CSP allows wasm only"
```

---

### Task 9: Export menu — winner cards, summary card, video

**Files:**
- Create: `src/awards/exportVideo.ts`, `src/awards/exportVideo.test.ts`
- Modify: `src/awards/AwardsPage.tsx`, `src/awards/AwardsPrepare.tsx`, `src/awards/AwardsPrepare.test.tsx`

**Interfaces:**
- Consumes: `renderStoryFrame`, `StoryDeps` (Task 4); `Slide` (Task 3); `renderPng`, `shareOrDownload`, `ensureCardFonts` (`exportCards.ts`); `Menu` (`src/components/Menu.tsx`: `{ label, trigger, items: MenuItem[] }`, `MenuItem = { kind: 'action'; label; onSelect; icon? } | …`); `Dialog`.
- Produces:
  - `const VIDEO_TIMING: Record<Slide['kind'], number>`
  - `function pickVideoMime(isSupported?: (t: string) => boolean): string | null`
  - `function videoExtension(mime: string): 'mp4' | 'webm'`
  - `function videoSupported(): boolean`
  - `function storyTimeline(slides: Slide[]): { total: number; at(ms: number): { index: number; elapsed: number } }`
  - `function recordStory(slides: Slide[], deps: StoryDeps, opts: { signal: AbortSignal; onProgress: (p: number) => void }): Promise<Blob>`
  - `AwardsPrepareProps`: `onExportAll` stays (winner cards), add `onExportSummary: () => void; onRecordVideo: () => void; videoAvailable: boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// src/awards/exportVideo.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildStory } from './story/buildStory';
import { pickVideoMime, recordStory, storyTimeline, videoExtension, VIDEO_TIMING } from './exportVideo';
import { PRESET_PALETTES } from './palette';

const slides = buildStory({ introTitle: 'Season', teamName: 'U17', stats: [], awardCount: 1, includeStory: true });
const deps = { palette: PRESET_PALETTES[0], cards: [], artFor: () => ({ photo: null, cutout: null, background: null }), clubName: '' };

describe('exportVideo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('prefers MP4 and falls back to WebM, or null', () => {
    expect(pickVideoMime((t) => t.startsWith('video/mp4'))).toBe('video/mp4;codecs=avc1');
    expect(pickVideoMime((t) => t === 'video/webm')).toBe('video/webm');
    expect(pickVideoMime(() => false)).toBeNull();
    expect(videoExtension('video/mp4;codecs=avc1')).toBe('mp4');
    expect(videoExtension('video/webm;codecs=vp9')).toBe('webm');
  });

  it('lays slides end to end with the fixed timings', () => {
    const tl = storyTimeline(slides); // intro, title, suspense, reveal, summary
    expect(tl.total).toBe(VIDEO_TIMING.intro + VIDEO_TIMING.awardTitle + VIDEO_TIMING.awardSuspense + VIDEO_TIMING.awardReveal + VIDEO_TIMING.summary);
    expect(tl.at(0)).toEqual({ index: 0, elapsed: 0 });
    expect(tl.at(VIDEO_TIMING.intro + 10)).toEqual({ index: 1, elapsed: 10 });
    expect(tl.at(tl.total + 999).index).toBe(slides.length - 1);
  });

  it('abort rejects with AbortError and stops the recorder', async () => {
    const stop = vi.fn();
    class FakeRecorder {
      static isTypeSupported = () => true;
      state = 'recording';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {}
      stop() { stop(); this.state = 'inactive'; this.onstop?.(); }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ setTransform() {} } as unknown as CanvasRenderingContext2D);
    (HTMLCanvasElement.prototype as unknown as { captureStream: () => MediaStream }).captureStream = () => ({ getTracks: () => [] }) as unknown as MediaStream;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const ctrl = new AbortController();
    const p = recordStory(slides, deps, { signal: ctrl.signal, onProgress: () => {} });
    await new Promise((r) => setTimeout(r, 0)); // let the recorder start
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(stop).toHaveBeenCalled();
  });
});
```

Add to `AwardsPrepare.test.tsx`:

```tsx
  it('export menu offers cards, summary and video (video disabled when unsupported)', () => {
    const onExportSummary = vi.fn();
    render(<AwardsPrepare {...props()} onExportSummary={onExportSummary} videoAvailable={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Summary card/ }));
    expect(onExportSummary).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('menuitem', { name: /Video export isn't supported in this browser/ })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/exportVideo.test.ts src/awards/AwardsPrepare.test.tsx`
Expected: FAIL — module and menu missing.

- [ ] **Step 3: Implement `exportVideo.ts`**

```ts
// src/awards/exportVideo.ts
import { CARD_H, CARD_W } from './card/drawAwardCard';
import { renderStoryFrame, type StoryDeps } from './card/drawSlide';
import { ensureCardFonts } from './exportCards';
import type { Slide } from './story/buildStory';

export const VIDEO_TIMING: Record<Slide['kind'], number> = {
  intro: 2000, stat: 3000, awardTitle: 1500, awardSuspense: 1500, awardReveal: 4000, summary: 4000,
};
const MIME_PREFERENCE = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];

export function pickVideoMime(isSupported: (t: string) => boolean = (t) => MediaRecorder.isTypeSupported(t)): string | null {
  return MIME_PREFERENCE.find((t) => isSupported(t)) ?? null;
}

export function videoExtension(mime: string): 'mp4' | 'webm' {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
}

export function videoSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function' && pickVideoMime() !== null;
}

export function storyTimeline(slides: Slide[]): { total: number; at(ms: number): { index: number; elapsed: number } } {
  const starts: number[] = [];
  let total = 0;
  for (const s of slides) { starts.push(total); total += VIDEO_TIMING[s.kind]; }
  return {
    total,
    at(ms) {
      let index = 0;
      while (index + 1 < slides.length && starts[index + 1] <= ms) index++;
      return { index, elapsed: ms - starts[index] };
    },
  };
}

/** Plays the whole story once onto an off-screen canvas and records it. Nothing leaves the device. */
export async function recordStory(slides: Slide[], deps: StoryDeps, opts: { signal: AbortSignal; onProgress: (p: number) => void }): Promise<Blob> {
  await ensureCardFonts();
  if (opts.signal.aborted) throw new DOMException('Recording cancelled', 'AbortError');
  const mime = pickVideoMime();
  if (!mime) throw new Error('Video export is not supported in this browser');
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  const tl = storyTimeline(slides);

  return new Promise<Blob>((resolve, reject) => {
    let raf = 0;
    let aborted = false;
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      canvas.width = 0;
      if (aborted) reject(new DOMException('Recording cancelled', 'AbortError'));
      else resolve(new Blob(chunks, { type: mime.split(';')[0] }));
    };
    opts.signal.addEventListener('abort', () => { aborted = true; if (recorder.state !== 'inactive') recorder.stop(); }, { once: true });
    recorder.start(250);
    const start = performance.now();
    let last = -1;
    const frame = (now: number) => {
      const ms = now - start;
      const { index, elapsed } = tl.at(ms);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      renderStoryFrame(ctx, slides, index, elapsed, deps, false, index > 0 && index !== last ? index - 1 : null);
      if (index !== last) last = index;
      opts.onProgress(Math.min(1, ms / tl.total));
      if (ms >= tl.total) { if (recorder.state !== 'inactive') recorder.stop(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
```

Note on the wipe: `renderStoryFrame` wipes only while `elapsed < WIPE_MS`, so passing `index - 1` for every frame of a slide is correct; simplify to `index > 0 ? index - 1 : null` if preferred (the `last` tracking is not required).

- [ ] **Step 4: Export menu and page wiring**

`AwardsPrepare.tsx` — replace the "Export cards" button with:

```tsx
        <Menu
          label="Export"
          triggerClassName="inline-flex min-h-11 items-center gap-2 rounded-md border border-blue bg-surface px-4 font-medium text-blue hover:bg-blue/10 disabled:opacity-50"
          trigger={<><Share2 size={16} aria-hidden="true" /> Export</>}
          items={[
            { kind: 'action', label: 'Winner cards (PNG)', onSelect: props.onExportAll },
            { kind: 'action', label: 'Summary card (PNG)', onSelect: props.onExportSummary },
            props.videoAvailable
              ? { kind: 'action', label: 'Record video', onSelect: props.onRecordVideo }
              : { kind: 'action', label: 'Record video', hint: "Video export isn't supported in this browser", onSelect: () => {} },
          ]}
        />
```

(If `Menu` has no disabled state, the unsupported item is a no-op with the hint shown, as above; hide the whole Menu when `noWinners`.)

`AwardsPage.tsx`:

```ts
  const [recording, setRecording] = useState<{ progress: number; ctrl: AbortController } | null>(null);
  const exportSummary = () => guardShare(async () => {
    const blob = await renderPng((ctx) => renderStoryFrame(ctx, slides, slides.length - 1, 1e9, deps, true, null));
    await shareOrDownload([new File([blob], cardFileName('summary', fileCtx), { type: 'image/png' })], heading);
  });
  const recordVideo = () => guardShare(async () => {
    const ctrl = new AbortController();
    setRecording({ progress: 0, ctrl });
    try {
      const blob = await recordStory(slides, deps, { signal: ctrl.signal, onProgress: (p) => setRecording((r) => (r ? { ...r, progress: p } : r)) });
      const name = cardFileName('story', fileCtx).replace(/\.png$/, `.${videoExtension(blob.type)}`);
      await shareOrDownload([new File([blob], name, { type: blob.type })], heading);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setNotice('Could not record the video. Please try again.');
    } finally {
      setRecording(null);
    }
  });
```

where `fileCtx` is the existing `scope === 'match' ? { kind: 'match', … } : { kind: 'season', … }` object (extract it into a const), and `guardShare(run)` is the Task 7 warning wrapper generalised to take any async function (`exportKeys` uses it too). Render while recording:

```tsx
      {recording && (
        <Dialog title="Recording video" onClose={() => recording.ctrl.abort()}
          footer={<Button variant="secondary" onClick={() => recording.ctrl.abort()}>Cancel</Button>}>
          <p className="text-sm text-slate">Playing the story once on this device. Keep this tab open.</p>
          <progress className="mt-3 w-full" max={1} value={recording.progress} aria-label="Recording progress" />
        </Dialog>
      )}
```

Pass `onExportSummary={exportSummary}`, `onRecordVideo={recordVideo}`, `videoAvailable={videoSupported()}`.

- [ ] **Step 5: Run tests, lint, build — expect PASS**

Run: `npx vitest run src/awards && npm run lint && npm run build`

- [ ] **Step 6: Commit**

```bash
git add -A src/awards
git commit -m "feat(awards): export menu — winner cards, summary card and an on-device story video"
```

---

### Task 10: Docs and final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-volley-skills-awards-story-design.md` (Status line), `CLAUDE.md`

- [ ] **Step 1: Update docs**

Spec status line → `Status: Implemented (2026-10-xx) — see plans/2026-10-15-awards-story.md`. In `CLAUDE.md`, under the Text scouting paragraph, add:

```markdown
**Awards story** (`src/awards/`) is a canvas-rendered, Wrapped-style presentation:
`story/buildStory.ts` decides the slides, `card/drawSlide.ts` (`renderStoryFrame`)
draws any slide at any time for the live show, PNGs and the recorded video.
Background removal (`cutout/segment.ts`) runs MediaPipe on the device; its WASM
is copied to `public/mediapipe/` by a Vite plugin and the model lives in
`public/models/` — both same-origin, which is why CSP `script-src` has
`'wasm-unsafe-eval'`. Photos and cut-outs are memory-only and consent-gated.
```

- [ ] **Step 2: Full verification**

Run: `npm test && npm run lint && npm run build`
Expected: all test files pass, 0 lint errors, build succeeds; `grep -rn "cardTheme\|presentSteps" src` returns nothing.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-15-volley-skills-awards-story-design.md
git commit -m "docs: awards story — architecture notes and spec status"
```
