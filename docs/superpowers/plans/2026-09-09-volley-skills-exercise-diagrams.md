# Exercise Diagrams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins draw one or more volleyball court diagrams per exercise on a full-screen canvas editor, stored as compact JSON scenes in a Firestore subcollection and rendered to SVG everywhere they appear.

**Architecture:** A new `src/diagrams/` feature folder. A pure `<DiagramSvg>` renders a `Scene` (court preset + item list) to one `<svg viewBox="0 0 100 100">`; the same component powers the editor canvas, exercise-detail thumbnails, library-list thumbnails, and training views. The editor is hand-rolled React + SVG with a `useReducer` state machine and `@use-gesture/react` for drag/pinch only. Diagrams live at `exercises/{exerciseId}/diagrams/{diagramId}`; all authorization is in `firestore.rules` (no Cloud Functions).

**Tech Stack:** React 18 + TypeScript (strict), Vite, Tailwind, React Router v7, Firebase Auth + Firestore, Vitest + Testing Library, `@firebase/rules-unit-testing`. One new runtime dependency: `@use-gesture/react`.

**Spec:** `docs/superpowers/specs/2026-09-09-volley-skills-exercise-diagrams-design.md` — read it alongside this plan.

## Global Constraints

- **TypeScript `strict`**, plus `noUnusedLocals` / `noUnusedParameters` — an unused symbol fails `npm run build`. Every declared variable/param must be used.
- **Data-access isolation:** only `src/diagrams/diagramsApi.ts` may import from `firebase/firestore` for this feature. Components and hooks call the api module.
- **Writes use `serverTimestamp()`**; mutating Firestore calls are wrapped in `withBackoff(...)` from `src/firebase/withBackoff.ts`.
- **Fetching discipline:** no unbounded collection reads. `listDiagrams` uses `limit(12)`, `getFirstDiagram` uses `limit(1)`. No new composite index is required (single-field `order` sort) — do **not** add one to `firestore.indexes.json`.
- **Caps** (verbatim from spec §4.4): diagrams per exercise `12`, items per scene `60`, `title` length `40`, `player.label` length `3`, `text.content` length `60`, `line.points` length `12`.
- **Scene schema version:** `scene.v` is the literal `1`.
- **Court presets:** exactly `'full' | 'half' | 'blank'`.
- **Palette colours:** exactly `'navy' | 'blue' | 'orange' | 'green' | 'red' | 'ink'` — no arbitrary hex anywhere.
- **Coordinate space:** `x`/`y` are `0..100` (items may fall outside; never clipped). `viewBox="0 0 100 100"`.
- **Rules mirror the parent:** `exercises` is `allow read: if isAdmin()` today — diagrams read + write are both `isAdmin()`.
- **Rules tests** run only via `npm run test:rules` (needs JDK 21+, serial). All other tests run via `npm test`.
- **Design system:** Tailwind tokens only (`navy`, `blue`, `orange`, `green`, `red`, `ink`, `slate`, `border`, `bg`, `surface`; radius `sm/md/lg`; shadow `card/pop`). Inter is already global. Icons from `lucide-react`.
- **Commits:** conventional prefixes (`feat:`, `test:`, `docs:`, `chore:`). End every commit message with the trailer:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01CsxGtMFm3AxC938EEp5PMd
  ```

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `src/types/diagram.ts` | `Scene`, `DiagramItem` union + per-type interfaces, `Diagram` doc type, `PaletteColor`, `CourtPreset`, `SCENE_LIMITS`, `PALETTE_COLORS` |
| `src/diagrams/tokenColor.ts` | `tokenColor(name)` → CSS `rgb(var(--color-…))` string; `tokenColorAlpha(name, a)` |
| `src/diagrams/parseScene.ts` | `parseScene(input)` → `{ ok, scene } | { ok:false, error }`, tolerant repair/clamp |
| `src/diagrams/sceneFactory.ts` | `emptyScene(court?)`, `createItem(type, at)` — pure builders used by editor + tests |
| `src/diagrams/diagramsApi.ts` | `listDiagrams`, `getFirstDiagram`, `saveDiagramSet` + `DiagramSaveOps` type |
| `src/diagrams/primitives/CourtBackdrop.tsx` | non-interactive court lines / net / attack lines / optional zone numbers per preset |
| `src/diagrams/primitives/PlayerToken.tsx` … `ZoneLabel.tsx` | one SVG fragment per item type (10 files) |
| `src/diagrams/DiagramSvg.tsx` | pure renderer: backdrop + items (z-order = array order) + optional selection layer |
| `src/diagrams/useDiagramEditor.ts` | `diagramReducer`, `useDiagramEditor(exerciseId, uid)`, `buildSaveOps`, `EditorState`/`EditorDiagram`/`EditorAction` types |
| `src/diagrams/DiagramTabs.tsx` | diagram title chips: select / add / rename / reorder / delete |
| `src/diagrams/Palette.tsx` | primitive buttons (desktop rail) / add-grid (phone sheet) |
| `src/diagrams/PropertiesPanel.tsx` | selected-item field editor + delete + z-order + nudge |
| `src/diagrams/CanvasStage.tsx` | pan/zoom wrapper around `<DiagramSvg>` using `@use-gesture/react` |
| `src/diagrams/DiagramEditorPage.tsx` | the `/exercises/:exerciseId/diagram` route: layout, wiring, autosave, nav-blocker |
| `src/diagrams/DiagramThumbnail.tsx` | lazy-fetch `order:0` diagram (module cache) + render small static `<DiagramSvg>` |
| `src/diagrams/DiagramLightbox.tsx` | full-size diagram viewer with prev/next, used from the exercise detail strip |
| `tests/rules/diagrams.rules.test.ts` | security-rules coverage for the subcollection |
| plus a `.test.ts(x)` beside every non-trivial source file above |

**Modified:**

| Path | Change |
|---|---|
| `package.json` | add `@use-gesture/react` to `dependencies` |
| `firestore.rules` | nested `match /diagrams/{diagramId}` inside the existing `match /exercises/{exerciseId}` block |
| `src/App.tsx` | lazy `/exercises/:exerciseId/diagram` route inside the authenticated layout, wrapped in `RequireAdmin` + `Suspense` |
| `src/exercises/exercisesApi.ts` | `deleteExercise` cascades: delete the exercise's `diagrams` in the same batch |
| `src/exercises/exercisesApi.test.ts` | cover the cascade |
| `src/exercises/ExerciseFormDialog.tsx` | "Edit diagrams" button (edit mode) + diagram strip + lightbox |
| `src/exercises/ExercisesPage.tsx` | `<DiagramThumbnail>` on each row |
| `src/trainings/TrainingBuilderDialog.tsx` | `<DiagramThumbnail>` beside each listed exercise row |

---

## Task 1: Firestore rules for the diagrams subcollection

**Files:**
- Modify: `firestore.rules` (inside `match /exercises/{exerciseId} { … }`, currently lines 23–37)
- Test: `tests/rules/diagrams.rules.test.ts` (create)

**Interfaces:**
- Consumes: existing `isAdmin()` helper in `firestore.rules`; `getTestEnv` from `tests/rules/testEnv.ts`.
- Produces: the `exercises/{id}/diagrams/{id}` security boundary. Doc shape asserted: `{ title: string(1..40), order: int, scene: { v: 1, court: 'full'|'half'|'blank', items: list(≤60) }, updatedBy, updatedAt }`.

- [ ] **Step 1: Write the failing rules test**

Create `tests/rules/diagrams.rules.test.ts`:

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

const validScene = {
  v: 1,
  court: 'full',
  showZones: false,
  items: [{ id: 'a1', type: 'player', x: 20, y: 30, rotation: 0, size: 1, color: 'blue', label: 'S', shape: 'circle' }],
};

function diagramDoc(overrides: Record<string, unknown> = {}) {
  return { title: 'Setup', order: 0, scene: validScene, updatedBy: 'admin-uid', updatedAt: new Date(), ...overrides };
}

describe('diagrams rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('users/admin-uid').set({ email: 'coach@example.com', role: 'admin' });
      await db.doc('users/viewer-uid').set({ email: 'parent@example.com', role: 'viewer' });
      await db.doc('exercises/ex-1').set({ name: 'Pepper', description: '', category: 'warmup', createdBy: 'admin-uid' });
      await db.doc('exercises/ex-1/diagrams/dg-1').set(diagramDoc());
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets an admin read, create, update and delete a diagram', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('exercises/ex-1/diagrams/dg-1').get());
    await assertSucceeds(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ title: 'Phase 1', order: 1 })));
    await assertSucceeds(db.doc('exercises/ex-1/diagrams/dg-1').update({ title: 'Setup v2' }));
    await assertSucceeds(db.doc('exercises/ex-1/diagrams/dg-1').delete());
  });

  it('denies a viewer and denies an unauthenticated caller', async () => {
    const env = await getTestEnv();
    const viewer = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(viewer.doc('exercises/ex-1/diagrams/dg-1').get());
    await assertFails(viewer.collection('exercises/ex-1/diagrams').add(diagramDoc()));
    await assertFails(anon.doc('exercises/ex-1/diagrams/dg-1').get());
  });

  it('rejects writes that violate the coarse shape caps', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ title: '' })));
    await assertFails(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ title: 'x'.repeat(41) })));
    await assertFails(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ order: 1.5 })));
    await assertFails(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ scene: { ...validScene, v: 2 } })));
    await assertFails(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ scene: { ...validScene, court: 'triangle' } })));
    await assertFails(
      db.collection('exercises/ex-1/diagrams').add(
        diagramDoc({ scene: { ...validScene, items: Array.from({ length: 61 }, (_, i) => ({ ...validScene.items[0], id: `i${i}` })) } })
      )
    );
  });

  it('accepts a write with a full 60-item scene', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    const items = Array.from({ length: 60 }, (_, i) => ({ ...validScene.items[0], id: `i${i}` }));
    await assertSucceeds(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ scene: { ...validScene, items } })));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:rules -- diagrams.rules`
Expected: the "admin" test FAILS (writes/reads to the not-yet-defined subcollection path are denied by the default deny), confirming the rule is absent.

- [ ] **Step 3: Add the nested rule block**

In `firestore.rules`, inside `match /exercises/{exerciseId} { … }`, after the existing `allow delete: if isAdmin();` line and before that block's closing `}`:

```
      match /diagrams/{diagramId} {
        allow read: if isAdmin();
        allow create, update: if isAdmin()
          && request.resource.data.title is string
          && request.resource.data.title.size() >= 1
          && request.resource.data.title.size() <= 40
          && request.resource.data.order is int
          && request.resource.data.scene.v == 1
          && request.resource.data.scene.court in ['full', 'half', 'blank']
          && request.resource.data.scene.items is list
          && request.resource.data.scene.items.size() <= 60;
        allow delete: if isAdmin();
      }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:rules -- diagrams.rules`
Expected: all four tests PASS.

- [ ] **Step 5: Run the whole rules suite for regressions**

Run: `npm run test:rules`
Expected: every rules file still passes (the new `match` is nested and cannot affect sibling collections).

- [ ] **Step 6: Commit**

```bash
git add firestore.rules tests/rules/diagrams.rules.test.ts
git commit -m "feat: firestore rules for exercise diagrams subcollection"
```

---

## Task 2: Diagram types + `tokenColor`

**Files:**
- Create: `src/types/diagram.ts`
- Create: `src/diagrams/tokenColor.ts`
- Test: `src/diagrams/tokenColor.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `src/types/diagram.ts`: `PaletteColor`, `PALETTE_COLORS: PaletteColor[]`, `CourtPreset`, `Point`, per-type item interfaces (`PlayerItem`, `BallItem`, `ConeItem`, `LadderItem`, `NetItem`, `PoleItem`, `LineItem`, `ArrowItem`, `TextItem`, `ZoneLabelItem`), `DiagramItem` (union), `DiagramItemType`, `Scene`, `Diagram`, `SCENE_LIMITS`.
  - `src/diagrams/tokenColor.ts`: `tokenColor(name: PaletteColor | string): string`, `tokenColorAlpha(name: PaletteColor | string, alpha: number): string`.

- [ ] **Step 1: Write `src/types/diagram.ts`**

```ts
export type PaletteColor = 'navy' | 'blue' | 'orange' | 'green' | 'red' | 'ink';
export const PALETTE_COLORS: PaletteColor[] = ['navy', 'blue', 'orange', 'green', 'red', 'ink'];

export type CourtPreset = 'full' | 'half' | 'blank';

export interface Point {
  x: number;
  y: number;
}

interface BaseItem {
  id: string;
  x: number;
  y: number;
  rotation: number;
  size: number;
  color: PaletteColor;
}

export interface PlayerItem extends BaseItem {
  type: 'player';
  label: string;
  shape: 'circle' | 'square';
}
export interface BallItem extends BaseItem {
  type: 'ball';
}
export interface ConeItem extends BaseItem {
  type: 'cone';
}
export interface LadderItem extends BaseItem {
  type: 'ladder';
  rungs: number;
  length: number;
}
export interface NetItem extends BaseItem {
  type: 'net';
  length: number;
}
export interface PoleItem extends BaseItem {
  type: 'pole';
}
export interface LineItem extends BaseItem {
  type: 'line';
  points: Point[];
  style: 'solid' | 'dashed';
  thickness: number;
}
export interface ArrowItem extends BaseItem {
  type: 'arrow';
  from: Point;
  to: Point;
  curved: boolean;
  style: 'pass' | 'shot' | 'run';
  head: 'single' | 'double';
}
export interface TextItem extends BaseItem {
  type: 'text';
  content: string;
  fontSize: number;
}
export interface ZoneLabelItem extends BaseItem {
  type: 'zoneLabel';
  zone: number;
}

export type DiagramItem =
  | PlayerItem
  | BallItem
  | ConeItem
  | LadderItem
  | NetItem
  | PoleItem
  | LineItem
  | ArrowItem
  | TextItem
  | ZoneLabelItem;

export type DiagramItemType = DiagramItem['type'];

export interface Scene {
  v: 1;
  court: CourtPreset;
  showZones: boolean;
  items: DiagramItem[];
}

export interface Diagram {
  id: string;
  title: string;
  order: number;
  scene: Scene;
  updatedBy: string;
  updatedAt: unknown;
}

export const SCENE_LIMITS = {
  diagramsPerExercise: 12,
  itemsPerScene: 60,
  titleLength: 40,
  labelLength: 3,
  textLength: 60,
  linePoints: 12,
} as const;
```

- [ ] **Step 2: Write the failing test `src/diagrams/tokenColor.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { PALETTE_COLORS } from '../types/diagram';
import { tokenColor, tokenColorAlpha } from './tokenColor';

describe('tokenColor', () => {
  it('maps every palette colour to its CSS custom-property reference', () => {
    for (const name of PALETTE_COLORS) {
      expect(tokenColor(name)).toBe(`rgb(var(--color-${name}))`);
    }
  });

  it('falls back to ink for an unknown name', () => {
    expect(tokenColor('chartreuse')).toBe('rgb(var(--color-ink))');
  });

  it('produces an alpha form clamped to 0..1', () => {
    expect(tokenColorAlpha('ink', 0.4)).toBe('rgb(var(--color-ink) / 0.4)');
    expect(tokenColorAlpha('ink', 5)).toBe('rgb(var(--color-ink) / 1)');
    expect(tokenColorAlpha('ink', -1)).toBe('rgb(var(--color-ink) / 0)');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/diagrams/tokenColor.test.ts`
Expected: FAIL — `Cannot find module './tokenColor'`.

- [ ] **Step 4: Write `src/diagrams/tokenColor.ts`**

```ts
import { PALETTE_COLORS, type PaletteColor } from '../types/diagram';

const KNOWN = new Set<string>(PALETTE_COLORS);

function resolve(name: PaletteColor | string): string {
  return KNOWN.has(name) ? name : 'ink';
}

export function tokenColor(name: PaletteColor | string): string {
  return `rgb(var(--color-${resolve(name)}))`;
}

export function tokenColorAlpha(name: PaletteColor | string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  return `rgb(var(--color-${resolve(name)}) / ${a})`;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/diagrams/tokenColor.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/diagram.ts src/diagrams/tokenColor.ts src/diagrams/tokenColor.test.ts
git commit -m "feat: diagram scene types and tokenColor helper"
```

---

## Task 3: `parseScene` — validation and repair

**Files:**
- Create: `src/diagrams/parseScene.ts`
- Test: `src/diagrams/parseScene.test.ts`

**Interfaces:**
- Consumes: `Scene`, `DiagramItem`, `DiagramItemType`, `PALETTE_COLORS`, `SCENE_LIMITS` from `src/types/diagram.ts`; `isPlainObject` from `src/bulkImport/parseJsonArray.ts`.
- Produces:
  - `ParseSceneResult = { ok: true; scene: Scene } | { ok: false; error: string }`
  - `parseScene(input: unknown): ParseSceneResult` — on success the returned `Scene` always satisfies the schema (unknown item types dropped, numbers clamped, strings truncated). Fails only for: not an object, `v !== 1`, `court` not in enum, `items` not an array, `items.length > 60`, or an item missing a required type-specific field.

Clamp ranges (apply, do not reject): `x`/`y` → `[-20, 120]`; `rotation` → `[-180, 180]`; `size` → `[0.5, 2]`; `ladder.rungs` → int `[3, 10]`; `ladder.length` → `[5, 40]`; `net.length` → `[5, 60]`; `line.thickness` → `[1, 4]`; `text.fontSize` → `[2, 8]`; `zoneLabel.zone` → int `[1, 6]`. Truncate: `player.label` → 3 chars; `text.content` → 60 chars; `line.points` → first 12 (but still require ≥ 2, else the item is invalid → reject).

- [ ] **Step 1: Write the failing test `src/diagrams/parseScene.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { parseScene } from './parseScene';
import type { Scene } from '../types/diagram';

const player = { id: 'p1', type: 'player', x: 20, y: 30, rotation: 0, size: 1, color: 'blue', label: 'S', shape: 'circle' };
const scene = (items: unknown[]): unknown => ({ v: 1, court: 'full', showZones: false, items });

describe('parseScene', () => {
  it('round-trips a valid scene unchanged', () => {
    const input = scene([player]);
    const result = parseScene(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scene).toEqual(input);
  });

  it('rejects a non-object, wrong version, bad court, or non-array items', () => {
    expect(parseScene(null).ok).toBe(false);
    expect(parseScene('x').ok).toBe(false);
    expect(parseScene({ ...(scene([]) as object), v: 2 }).ok).toBe(false);
    expect(parseScene({ ...(scene([]) as object), court: 'oval' }).ok).toBe(false);
    expect(parseScene({ v: 1, court: 'full', showZones: false, items: {} }).ok).toBe(false);
  });

  it('rejects a scene with more than 60 items', () => {
    const items = Array.from({ length: 61 }, (_, i) => ({ ...player, id: `p${i}` }));
    expect(parseScene(scene(items)).ok).toBe(false);
  });

  it('drops items with an unknown type but keeps the rest', () => {
    const result = parseScene(scene([player, { id: 'x', type: 'hologram', x: 0, y: 0 }]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scene.items).toHaveLength(1);
      expect(result.scene.items[0].id).toBe('p1');
    }
  });

  it('clamps out-of-range numbers and truncates over-long strings', () => {
    const result = parseScene(
      scene([{ ...player, x: 999, size: 9, rotation: 900, label: 'LONGLABEL' }])
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const it = result.scene.items[0] as Extract<Scene['items'][number], { type: 'player' }>;
      expect(it.x).toBe(120);
      expect(it.size).toBe(2);
      expect(it.rotation).toBe(180);
      expect(it.label).toBe('LON');
    }
  });

  it('coerces an unknown colour to ink', () => {
    const result = parseScene(scene([{ ...player, color: 'gold' }]));
    if (result.ok) expect(result.scene.items[0].color).toBe('ink');
    else throw new Error('expected ok');
  });

  it('rejects an item missing a required type-specific field', () => {
    expect(parseScene(scene([{ id: 'l1', type: 'ladder', x: 0, y: 0, rotation: 0, size: 1, color: 'ink' }])).ok).toBe(false);
    expect(parseScene(scene([{ id: 'a1', type: 'arrow', x: 0, y: 0, rotation: 0, size: 1, color: 'ink', from: { x: 0, y: 0 } }])).ok).toBe(false);
  });

  it('clamps line.points to the first 12 and rejects fewer than 2', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i }));
    const ok = parseScene(scene([{ id: 'l1', type: 'line', x: 0, y: 0, rotation: 0, size: 1, color: 'ink', points: many, style: 'solid', thickness: 2 }]));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect((ok.scene.items[0] as { points: unknown[] }).points).toHaveLength(12);
    const tooFew = parseScene(scene([{ id: 'l2', type: 'line', x: 0, y: 0, rotation: 0, size: 1, color: 'ink', points: [{ x: 0, y: 0 }], style: 'solid', thickness: 2 }]));
    expect(tooFew.ok).toBe(false);
  });

  it('defaults showZones to false and requires the field to be boolean when present', () => {
    const r1 = parseScene({ v: 1, court: 'blank', items: [] });
    expect(r1.ok && r1.scene.showZones).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/diagrams/parseScene.test.ts`
Expected: FAIL — `Cannot find module './parseScene'`.

- [ ] **Step 3: Write `src/diagrams/parseScene.ts`**

```ts
import { isPlainObject } from '../bulkImport/parseJsonArray';
import {
  PALETTE_COLORS,
  SCENE_LIMITS,
  type CourtPreset,
  type DiagramItem,
  type Point,
  type Scene,
} from '../types/diagram';

export type ParseSceneResult = { ok: true; scene: Scene } | { ok: false; error: string };

const COURTS: CourtPreset[] = ['full', 'half', 'blank'];
const COLORS = new Set<string>(PALETTE_COLORS);
const KNOWN_TYPES = new Set<DiagramItem['type']>([
  'player', 'ball', 'cone', 'ladder', 'net', 'pole', 'line', 'arrow', 'text', 'zoneLabel',
]);

const clamp = (n: unknown, lo: number, hi: number, fallback: number): number => {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(lo, Math.min(hi, x));
};
const clampInt = (n: unknown, lo: number, hi: number, fallback: number): number =>
  Math.round(clamp(n, lo, hi, fallback));
const str = (v: unknown, max: number, fallback = ''): string =>
  (typeof v === 'string' ? v : fallback).slice(0, max);
const color = (v: unknown): DiagramItem['color'] =>
  (typeof v === 'string' && COLORS.has(v) ? v : 'ink') as DiagramItem['color'];
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? v : fallback) as T;
const point = (v: unknown): Point | null =>
  isPlainObject(v) && typeof v.x === 'number' && typeof v.y === 'number'
    ? { x: clamp(v.x, -20, 120, 0), y: clamp(v.y, -20, 120, 0) }
    : null;

/** Returns a repaired item, or null if a required field is unusable (caller rejects the whole scene). */
function repairItem(raw: unknown): DiagramItem | null {
  if (!isPlainObject(raw)) return null;
  const type = raw.type;
  if (typeof type !== 'string' || !KNOWN_TYPES.has(type as DiagramItem['type'])) return null;

  const base = {
    id: str(raw.id, 12) || Math.random().toString(36).slice(2, 10),
    x: clamp(raw.x, -20, 120, 50),
    y: clamp(raw.y, -20, 120, 50),
    rotation: clamp(raw.rotation, -180, 180, 0),
    size: clamp(raw.size, 0.5, 2, 1),
    color: color(raw.color),
  };

  switch (type) {
    case 'ball':
    case 'cone':
    case 'pole':
      return { ...base, type };
    case 'player':
      return { ...base, type, label: str(raw.label, SCENE_LIMITS.labelLength), shape: oneOf(raw.shape, ['circle', 'square'] as const, 'circle') };
    case 'ladder':
      return { ...base, type, rungs: clampInt(raw.rungs, 3, 10, 5), length: clamp(raw.length, 5, 40, 20) };
    case 'net':
      return { ...base, type, length: clamp(raw.length, 5, 60, 30) };
    case 'text': {
      const content = str(raw.content, SCENE_LIMITS.textLength);
      if (content === '') return null;
      return { ...base, type, content, fontSize: clamp(raw.fontSize, 2, 8, 4) };
    }
    case 'zoneLabel':
      return { ...base, type, zone: clampInt(raw.zone, 1, 6, 1) };
    case 'line': {
      const pts = Array.isArray(raw.points) ? raw.points.map(point).filter((p): p is Point => p !== null).slice(0, SCENE_LIMITS.linePoints) : [];
      if (pts.length < 2) return null;
      return { ...base, type, points: pts, style: oneOf(raw.style, ['solid', 'dashed'] as const, 'solid'), thickness: clamp(raw.thickness, 1, 4, 2) };
    }
    case 'arrow': {
      const from = point(raw.from);
      const to = point(raw.to);
      if (!from || !to) return null;
      return {
        ...base, type, from, to,
        curved: raw.curved === true,
        style: oneOf(raw.style, ['pass', 'shot', 'run'] as const, 'pass'),
        head: oneOf(raw.head, ['single', 'double'] as const, 'single'),
      };
    }
    default:
      return null;
  }
}

export function parseScene(input: unknown): ParseSceneResult {
  if (!isPlainObject(input)) return { ok: false, error: 'scene must be an object' };
  if (input.v !== 1) return { ok: false, error: 'unsupported scene version' };
  if (typeof input.court !== 'string' || !COURTS.includes(input.court as CourtPreset)) {
    return { ok: false, error: 'court must be one of full, half, blank' };
  }
  if (!Array.isArray(input.items)) return { ok: false, error: 'scene.items must be an array' };
  if (input.items.length > SCENE_LIMITS.itemsPerScene) {
    return { ok: false, error: `a scene may hold at most ${SCENE_LIMITS.itemsPerScene} items` };
  }

  const items: DiagramItem[] = [];
  for (const raw of input.items) {
    const repaired = repairItem(raw);
    if (repaired === null) {
      if (isPlainObject(raw) && typeof raw.type === 'string' && !KNOWN_TYPES.has(raw.type as DiagramItem['type'])) {
        continue; // unknown type: drop silently
      }
      return { ok: false, error: 'a scene item is missing a required field' };
    }
    items.push(repaired);
  }

  return {
    ok: true,
    scene: {
      v: 1,
      court: input.court as CourtPreset,
      showZones: input.showZones === true,
      items,
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/diagrams/parseScene.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/diagrams/parseScene.ts src/diagrams/parseScene.test.ts
git commit -m "feat: parseScene validation and repair for diagram scenes"
```

---

## Task 4: `sceneFactory` — `emptyScene` and `createItem`

**Files:**
- Create: `src/diagrams/sceneFactory.ts`
- Test: `src/diagrams/sceneFactory.test.ts`

**Interfaces:**
- Consumes: item types + `Scene`, `CourtPreset`, `DiagramItemType` from `src/types/diagram.ts`.
- Produces:
  - `emptyScene(court?: CourtPreset): Scene` — `{ v: 1, court: court ?? 'full', showZones: false, items: [] }`.
  - `createItem(type: DiagramItemType, at: Point): DiagramItem` — a fully-populated default item of that type positioned at `at`, with a fresh `id` from `newId()`.
  - `newId(): string` — `crypto.randomUUID().slice(0, 8)`.

- [ ] **Step 1: Write the failing test `src/diagrams/sceneFactory.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { createItem, emptyScene, newId } from './sceneFactory';
import { parseScene } from './parseScene';
import type { DiagramItemType } from '../types/diagram';

const ALL_TYPES: DiagramItemType[] = ['player', 'ball', 'cone', 'ladder', 'net', 'pole', 'line', 'arrow', 'text', 'zoneLabel'];

describe('sceneFactory', () => {
  it('emptyScene defaults to a full court with no items', () => {
    expect(emptyScene()).toEqual({ v: 1, court: 'full', showZones: false, items: [] });
    expect(emptyScene('blank').court).toBe('blank');
  });

  it('newId returns an 8-char string, unique across calls', () => {
    const a = newId();
    const b = newId();
    expect(a).toHaveLength(8);
    expect(a).not.toBe(b);
  });

  it('createItem builds a schema-valid item of every type at the given point', () => {
    for (const type of ALL_TYPES) {
      const item = createItem(type, { x: 40, y: 60 });
      expect(item.type).toBe(type);
      const result = parseScene({ v: 1, court: 'full', showZones: false, items: [item] });
      expect(result.ok, `type ${type} must survive parseScene`).toBe(true);
      if (result.ok) expect(result.scene.items[0]).toEqual(item);
    }
  });

  it('positions line and arrow endpoints relative to the drop point', () => {
    const line = createItem('line', { x: 30, y: 30 });
    if (line.type === 'line') expect(line.points[0]).toEqual({ x: 30, y: 30 });
    const arrow = createItem('arrow', { x: 30, y: 30 });
    if (arrow.type === 'arrow') expect(arrow.from).toEqual({ x: 30, y: 30 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/diagrams/sceneFactory.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/diagrams/sceneFactory.ts`**

```ts
import type { CourtPreset, DiagramItem, DiagramItemType, Point, Scene } from '../types/diagram';

export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function emptyScene(court: CourtPreset = 'full'): Scene {
  return { v: 1, court, showZones: false, items: [] };
}

export function createItem(type: DiagramItemType, at: Point): DiagramItem {
  const base = { id: newId(), x: at.x, y: at.y, rotation: 0, size: 1, color: 'ink' as const };
  switch (type) {
    case 'player':
      return { ...base, color: 'blue', type, label: '', shape: 'circle' };
    case 'ball':
      return { ...base, color: 'orange', type };
    case 'cone':
      return { ...base, color: 'orange', type };
    case 'pole':
      return { ...base, type };
    case 'ladder':
      return { ...base, type, rungs: 5, length: 20 };
    case 'net':
      return { ...base, type, length: 30 };
    case 'text':
      return { ...base, type, content: 'Text', fontSize: 4 };
    case 'zoneLabel':
      return { ...base, type, zone: 1 };
    case 'line':
      return { ...base, type, points: [{ x: at.x, y: at.y }, { x: at.x + 15, y: at.y }], style: 'solid', thickness: 2 };
    case 'arrow':
      return { ...base, type, from: { x: at.x, y: at.y }, to: { x: at.x + 15, y: at.y - 10 }, curved: false, style: 'pass', head: 'single' };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/diagrams/sceneFactory.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/diagrams/sceneFactory.ts src/diagrams/sceneFactory.test.ts
git commit -m "feat: emptyScene and createItem builders"
```

---

## Task 5: `diagramsApi` — data access

**Files:**
- Create: `src/diagrams/diagramsApi.ts`
- Test: `src/diagrams/diagramsApi.test.ts`

**Interfaces:**
- Consumes: `db` from `src/firebase/config.ts`; `withBackoff` from `src/firebase/withBackoff.ts`; `parseScene` from `./parseScene`; `Diagram`, `Scene` from `src/types/diagram.ts`.
- Produces:
  ```ts
  export interface DiagramSaveOps {
    creates: { tempId: string; title: string; order: number; scene: Scene }[];
    updates: { id: string; title: string; order: number; scene: Scene }[];
    deletes: string[];
  }
  export function listDiagrams(exerciseId: string): Promise<Diagram[]>;
  export function getFirstDiagram(exerciseId: string): Promise<Diagram | null>;
  export function saveDiagramSet(
    exerciseId: string,
    ops: DiagramSaveOps,
    uid: string,
  ): Promise<{ idMap: Record<string, string> }>;
  ```
  `saveDiagramSet` runs every `creates`/`updates` scene through `parseScene` first and throws `Error("Diagram \"<title>\" is invalid: <reason>")` before any write if one fails. Otherwise one `writeBatch` (`set` for creates with fresh refs, `update` for updates, `delete` for deletes), committed via `withBackoff`. `idMap` maps each create's `tempId` → the new doc id.

- [ ] **Step 1: Write the failing test `src/diagrams/diagramsApi.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listDiagrams, getFirstDiagram, saveDiagramSet } from './diagramsApi';
import type { Scene } from '../types/diagram';

const {
  mockCollection, mockDoc, mockGetDocs, mockQuery, mockOrderBy, mockLimit, mockWriteBatch,
} = vi.hoisted(() => ({
  mockCollection: vi.fn(() => 'diagrams-col'),
  mockDoc: vi.fn((...args: unknown[]) => ({ path: args.join('/') })),
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn((...args: unknown[]) => args),
  mockOrderBy: vi.fn((...args: unknown[]) => ({ orderBy: args })),
  mockLimit: vi.fn((...args: unknown[]) => ({ limit: args })),
  mockWriteBatch: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  orderBy: mockOrderBy,
  limit: mockLimit,
  writeBatch: mockWriteBatch,
  serverTimestamp: () => 'ts',
}));
vi.mock('../firebase/config', () => ({ db: {} }));

const scene: Scene = { v: 1, court: 'full', showZones: false, items: [] };

describe('diagramsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists diagrams ordered by `order`, capped at 12', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'd1', data: () => ({ title: 'Setup', order: 0, scene }) }],
    });
    const result = await listDiagrams('ex-1');
    expect(result).toEqual([{ id: 'd1', title: 'Setup', order: 0, scene }]);
    expect(mockOrderBy).toHaveBeenCalledWith('order');
    expect(mockLimit).toHaveBeenCalledWith(12);
  });

  it('getFirstDiagram returns the single doc or null', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'd1', data: () => ({ title: 'A', order: 0, scene }) }] });
    expect(await getFirstDiagram('ex-1')).toMatchObject({ id: 'd1' });
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    expect(await getFirstDiagram('ex-1')).toBeNull();
    expect(mockLimit).toHaveBeenLastCalledWith(1);
  });

  it('saveDiagramSet batches creates, updates and deletes and returns an idMap', async () => {
    const set = vi.fn();
    const update = vi.fn();
    const del = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({ set, update, delete: del, commit });
    mockDoc.mockImplementation((_db: unknown, _col: string, ...rest: string[]) =>
      rest.length ? { id: rest[rest.length - 1] } : { id: 'generated-id' });

    const { idMap } = await saveDiagramSet('ex-1', {
      creates: [{ tempId: 'new:1', title: 'Setup', order: 0, scene }],
      updates: [{ id: 'd2', title: 'Phase 1', order: 1, scene }],
      deletes: ['d3'],
    }, 'coach-uid');

    expect(set).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(idMap['new:1']).toBe('generated-id');
    expect(update.mock.calls[0][1]).toMatchObject({ updatedBy: 'coach-uid', updatedAt: 'ts' });
  });

  it('throws before any write when a scene fails validation', async () => {
    const commit = vi.fn();
    mockWriteBatch.mockReturnValue({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit });
    await expect(
      saveDiagramSet('ex-1', {
        creates: [{ tempId: 'new:1', title: 'Broken', order: 0, scene: { v: 2 } as unknown as Scene }],
        updates: [],
        deletes: [],
      }, 'coach-uid'),
    ).rejects.toThrow(/Broken/);
    expect(commit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/diagrams/diagramsApi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/diagrams/diagramsApi.ts`**

```ts
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { withBackoff } from '../firebase/withBackoff';
import { parseScene } from './parseScene';
import type { Diagram, Scene } from '../types/diagram';

const MAX_DIAGRAMS = 12;

export interface DiagramSaveOps {
  creates: { tempId: string; title: string; order: number; scene: Scene }[];
  updates: { id: string; title: string; order: number; scene: Scene }[];
  deletes: string[];
}

function colRef(exerciseId: string) {
  return collection(db, 'exercises', exerciseId, 'diagrams');
}

export async function listDiagrams(exerciseId: string): Promise<Diagram[]> {
  const snap = await getDocs(query(colRef(exerciseId), orderBy('order'), limit(MAX_DIAGRAMS)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Diagram);
}

export async function getFirstDiagram(exerciseId: string): Promise<Diagram | null> {
  const snap = await getDocs(query(colRef(exerciseId), orderBy('order'), limit(1)));
  const first = snap.docs[0];
  return first ? ({ id: first.id, ...first.data() } as Diagram) : null;
}

export async function saveDiagramSet(
  exerciseId: string,
  ops: DiagramSaveOps,
  uid: string,
): Promise<{ idMap: Record<string, string> }> {
  for (const entry of [...ops.creates, ...ops.updates]) {
    const parsed = parseScene(entry.scene);
    if (!parsed.ok) throw new Error(`Diagram "${entry.title}" is invalid: ${parsed.error}`);
  }

  const batch = writeBatch(db);
  const idMap: Record<string, string> = {};

  for (const c of ops.creates) {
    const ref = doc(colRef(exerciseId));
    idMap[c.tempId] = ref.id;
    batch.set(ref, {
      title: c.title,
      order: c.order,
      scene: c.scene,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  }
  for (const u of ops.updates) {
    batch.update(doc(db, 'exercises', exerciseId, 'diagrams', u.id), {
      title: u.title,
      order: u.order,
      scene: u.scene,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  }
  for (const id of ops.deletes) {
    batch.delete(doc(db, 'exercises', exerciseId, 'diagrams', id));
  }

  await withBackoff(() => batch.commit());
  return { idMap };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/diagrams/diagramsApi.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/diagrams/diagramsApi.ts src/diagrams/diagramsApi.test.ts
git commit -m "feat: diagramsApi list/getFirst/saveDiagramSet"
```

---

## Task 6: Cascade-delete diagrams when an exercise is deleted

**Files:**
- Modify: `src/exercises/exercisesApi.ts:53-55` (`deleteExercise`)
- Modify: `src/exercises/exercisesApi.test.ts`

**Interfaces:**
- Consumes: existing `firebase/firestore` imports already in `exercisesApi.ts` (`collection`, `doc`, `getDocs`, `query`, `writeBatch`, `limit` — add any missing to the existing import block).
- Produces: `deleteExercise(exerciseId)` now deletes the exercise doc **and** every doc in its `diagrams` subcollection in one `writeBatch` wrapped in `withBackoff`. Signature unchanged.

- [ ] **Step 1: Add the failing test to `src/exercises/exercisesApi.test.ts`**

Add `getDocs` and `writeBatch` handling if not already in the hoisted mock (they are). Add this test inside `describe('exercisesApi', …)`:

```ts
it('deletes an exercise together with its diagrams subcollection in one batch', async () => {
  const set = vi.fn();
  const del = vi.fn();
  const commit = vi.fn().mockResolvedValue(undefined);
  mockWriteBatch.mockReturnValue({ set, update: vi.fn(), delete: del, commit });
  mockGetDocs.mockResolvedValue({
    docs: [{ ref: 'diagram-ref-1' }, { ref: 'diagram-ref-2' }],
  });

  await deleteExercise('ex-1');

  expect(del).toHaveBeenCalledWith('diagram-ref-1');
  expect(del).toHaveBeenCalledWith('diagram-ref-2');
  expect(del).toHaveBeenCalledWith('doc-ref'); // the exercise doc itself
  expect(commit).toHaveBeenCalledTimes(1);
});
```

Update the existing `it('deletes an exercise', …)` test to the batch shape (it currently asserts `mockDeleteDoc`); replace its body with:

```ts
it('deletes an exercise', async () => {
  const del = vi.fn();
  const commit = vi.fn().mockResolvedValue(undefined);
  mockWriteBatch.mockReturnValue({ set: vi.fn(), update: vi.fn(), delete: del, commit });
  mockGetDocs.mockResolvedValue({ docs: [] });
  await deleteExercise('ex-1');
  expect(del).toHaveBeenCalledWith('doc-ref');
  expect(commit).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/exercises/exercisesApi.test.ts`
Expected: FAIL — `deleteExercise` still calls `deleteDoc`, not a batch.

- [ ] **Step 3: Rewrite `deleteExercise` in `src/exercises/exercisesApi.ts`**

Ensure the import block includes `getDocs`, `query`, `writeBatch`, `collection`, `doc` (all already imported). Replace lines 53–55:

```ts
export async function deleteExercise(exerciseId: string): Promise<void> {
  const diagrams = await getDocs(collection(db, 'exercises', exerciseId, 'diagrams'));
  const batch = writeBatch(db);
  diagrams.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'exercises', exerciseId));
  await withBackoff(() => batch.commit());
}
```

- [ ] **Step 4: Run the exercises api tests to verify they pass**

Run: `npx vitest run src/exercises/exercisesApi.test.ts`
Expected: PASS (all, including the two delete tests).

- [ ] **Step 5: Run the full unit suite for regressions**

Run: `npm test`
Expected: PASS. (`ExercisesPage` delete flow still calls `deleteExercise('id')` — unchanged signature.)

- [ ] **Step 6: Commit**

```bash
git add src/exercises/exercisesApi.ts src/exercises/exercisesApi.test.ts
git commit -m "feat: cascade-delete diagrams when an exercise is removed"
```

---

## Task 7: Primitive components + `CourtBackdrop`

**Files:**
- Create: `src/diagrams/primitives/CourtBackdrop.tsx`
- Create: `src/diagrams/primitives/PlayerToken.tsx`, `Ball.tsx`, `Cone.tsx`, `Ladder.tsx`, `Net.tsx`, `Pole.tsx`, `Line.tsx`, `Arrow.tsx`, `TextLabel.tsx`, `ZoneLabel.tsx`
- Create: `src/diagrams/primitives/index.tsx` — `PRIMITIVES: Record<DiagramItemType, (item) => JSX>` lookup + `renderItem(item)` helper
- Test: `src/diagrams/primitives/primitives.test.tsx`

**Interfaces:**
- Consumes: item types from `src/types/diagram.ts`; `tokenColor`, `tokenColorAlpha` from `../tokenColor`.
- Produces:
  - Each primitive is `function X({ item }: { item: XItem }): JSX.Element`, returning an SVG fragment whose outermost element carries `data-item-id={item.id}` and `data-item-type={item.type}` and applies `transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.size})`}` (except `line`/`arrow`, which are positioned by their own point fields and set only the `data-item-*` attrs on a `<g>`).
  - `CourtBackdrop({ court, showZones }: { court: CourtPreset; showZones: boolean }): JSX.Element` — a `<g data-court={court}>` with `pointerEvents: 'none'`. For `'full'`/`'half'` it draws the boundary rect, a `<line data-court-net>` and attack lines; for `'blank'` it renders an empty `<g data-court="blank" />`. When `showZones`, adds six `<text data-zone-label>` numbers.
  - `renderItem(item: DiagramItem): JSX.Element` — dispatches on `item.type` to the matching primitive.

- [ ] **Step 1: Write the failing test `src/diagrams/primitives/primitives.test.tsx`**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CourtBackdrop } from './CourtBackdrop';
import { renderItem } from './index';
import { createItem } from '../sceneFactory';
import type { CourtPreset, DiagramItemType } from '../../types/diagram';

const svg = (child: React.ReactNode) => render(<svg viewBox="0 0 100 100">{child}</svg>).container;

const ALL_TYPES: DiagramItemType[] = ['player', 'ball', 'cone', 'ladder', 'net', 'pole', 'line', 'arrow', 'text', 'zoneLabel'];

describe('primitives', () => {
  it('renders one of every item type without throwing, tagged with data-item-*', () => {
    for (const type of ALL_TYPES) {
      const item = createItem(type, { x: 40, y: 50 });
      const container = svg(renderItem(item));
      const el = container.querySelector(`[data-item-id="${item.id}"]`);
      expect(el, `${type} must render a tagged element`).not.toBeNull();
      expect(el?.getAttribute('data-item-type')).toBe(type);
    }
  });

  it('renders each court preset; full/half draw a net line, blank draws nothing', () => {
    for (const court of ['full', 'half'] as CourtPreset[]) {
      const container = svg(<CourtBackdrop court={court} showZones={false} />);
      expect(container.querySelector('[data-court-net]')).not.toBeNull();
    }
    const blank = svg(<CourtBackdrop court="blank" showZones={false} />);
    expect(blank.querySelector('[data-court-net]')).toBeNull();
    expect(blank.querySelector('[data-court="blank"]')).not.toBeNull();
  });

  it('adds six zone labels when showZones is true', () => {
    const container = svg(<CourtBackdrop court="full" showZones />);
    expect(container.querySelectorAll('[data-zone-label]')).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/diagrams/primitives/primitives.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the primitive components**

`src/diagrams/primitives/PlayerToken.tsx`:

```tsx
import { tokenColor } from '../tokenColor';
import type { PlayerItem } from '../../types/diagram';

export function PlayerToken({ item }: { item: PlayerItem }) {
  const r = 4;
  return (
    <g
      data-item-id={item.id}
      data-item-type="player"
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.size})`}
    >
      {item.shape === 'circle' ? (
        <circle r={r} fill={tokenColor(item.color)} />
      ) : (
        <rect x={-r} y={-r} width={r * 2} height={r * 2} fill={tokenColor(item.color)} />
      )}
      {item.label && (
        <text textAnchor="middle" dominantBaseline="central" fontSize={4} fill="rgb(var(--color-surface))" fontWeight={600}>
          {item.label}
        </text>
      )}
    </g>
  );
}
```

`src/diagrams/primitives/Ball.tsx`:

```tsx
import { tokenColor } from '../tokenColor';
import type { BallItem } from '../../types/diagram';

export function Ball({ item }: { item: BallItem }) {
  return (
    <g data-item-id={item.id} data-item-type="ball" transform={`translate(${item.x} ${item.y}) scale(${item.size})`}>
      <circle r={2.4} fill={tokenColor(item.color)} stroke="rgb(var(--color-ink))" strokeWidth={0.4} />
    </g>
  );
}
```

`src/diagrams/primitives/Cone.tsx`:

```tsx
import { tokenColor } from '../tokenColor';
import type { ConeItem } from '../../types/diagram';

export function Cone({ item }: { item: ConeItem }) {
  return (
    <g
      data-item-id={item.id}
      data-item-type="cone"
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.size})`}
    >
      <polygon points="0,-4 3,3 -3,3" fill={tokenColor(item.color)} />
      <rect x={-3.6} y={3} width={7.2} height={1.4} fill={tokenColor(item.color)} />
    </g>
  );
}
```

`src/diagrams/primitives/Ladder.tsx`:

```tsx
import { tokenColorAlpha } from '../tokenColor';
import type { LadderItem } from '../../types/diagram';

export function Ladder({ item }: { item: LadderItem }) {
  const w = 5;
  const stroke = tokenColorAlpha(item.color, 0.6);
  const rungs = Array.from({ length: item.rungs }, (_, i) => (i * item.length) / (item.rungs - 1));
  return (
    <g
      data-item-id={item.id}
      data-item-type="ladder"
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.size})`}
    >
      <line x1={-w / 2} y1={0} x2={-w / 2} y2={item.length} stroke={stroke} strokeWidth={0.5} />
      <line x1={w / 2} y1={0} x2={w / 2} y2={item.length} stroke={stroke} strokeWidth={0.5} />
      {rungs.map((y, i) => (
        <line key={i} x1={-w / 2} y1={y} x2={w / 2} y2={y} stroke={stroke} strokeWidth={0.5} />
      ))}
    </g>
  );
}
```

`src/diagrams/primitives/Net.tsx`:

```tsx
import type { NetItem } from '../../types/diagram';

export function Net({ item }: { item: NetItem }) {
  return (
    <g
      data-item-id={item.id}
      data-item-type="net"
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.size})`}
    >
      <rect x={0} y={-2} width={item.length} height={4} fill="url(#netHatch)" stroke="rgb(var(--color-ink))" strokeWidth={0.4} />
    </g>
  );
}
```

`src/diagrams/primitives/Pole.tsx`:

```tsx
import type { PoleItem } from '../../types/diagram';

export function Pole({ item }: { item: PoleItem }) {
  return (
    <g data-item-id={item.id} data-item-type="pole" transform={`translate(${item.x} ${item.y}) scale(${item.size})`}>
      <circle r={1.2} fill="rgb(var(--color-ink))" />
    </g>
  );
}
```

`src/diagrams/primitives/Line.tsx`:

```tsx
import { tokenColor } from '../tokenColor';
import type { LineItem } from '../../types/diagram';

export function Line({ item }: { item: LineItem }) {
  const d = item.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <g data-item-id={item.id} data-item-type="line">
      <path
        d={d}
        fill="none"
        stroke={tokenColor(item.color)}
        strokeWidth={item.thickness}
        strokeDasharray={item.style === 'dashed' ? '3 2' : undefined}
        strokeLinecap="round"
      />
    </g>
  );
}
```

`src/diagrams/primitives/Arrow.tsx`:

```tsx
import { tokenColor } from '../tokenColor';
import type { ArrowItem } from '../../types/diagram';

export function Arrow({ item }: { item: ArrowItem }) {
  const { from, to } = item;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const nx = -(to.y - from.y);
  const ny = to.x - from.x;
  const len = Math.hypot(nx, ny) || 1;
  const bend = item.curved ? 8 : 0;
  const cx = mx + (nx / len) * bend;
  const cy = my + (ny / len) * bend;
  const d = item.curved ? `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}` : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const dash = item.style === 'run' ? '3 2' : undefined;
  const width = item.style === 'shot' ? 1.6 : 1;
  return (
    <g data-item-id={item.id} data-item-type="arrow">
      <path d={d} fill="none" stroke={tokenColor(item.color)} strokeWidth={width} strokeDasharray={dash} markerEnd={`url(#arrowhead-${item.head})`} />
    </g>
  );
}
```

`src/diagrams/primitives/TextLabel.tsx`:

```tsx
import { tokenColor } from '../tokenColor';
import type { TextItem } from '../../types/diagram';

export function TextLabel({ item }: { item: TextItem }) {
  return (
    <g data-item-id={item.id} data-item-type="text" transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}>
      <text fontSize={item.fontSize} fill={tokenColor(item.color)} dominantBaseline="central">
        {item.content}
      </text>
    </g>
  );
}
```

`src/diagrams/primitives/ZoneLabel.tsx`:

```tsx
import { tokenColorAlpha } from '../tokenColor';
import type { ZoneLabelItem } from '../../types/diagram';

export function ZoneLabel({ item }: { item: ZoneLabelItem }) {
  return (
    <g data-item-id={item.id} data-item-type="zoneLabel" transform={`translate(${item.x} ${item.y}) scale(${item.size})`}>
      <text fontSize={5} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={tokenColorAlpha(item.color, 0.5)}>
        {item.zone}
      </text>
    </g>
  );
}
```

`src/diagrams/primitives/CourtBackdrop.tsx`:

```tsx
import { tokenColorAlpha } from '../tokenColor';
import type { CourtPreset } from '../../types/diagram';

// Court occupies x∈[10,90]. Full court y∈[6,94] with the net across the middle;
// half court y∈[6,72] with the net along the top edge.
const LINE = 'rgb(var(--color-ink))';

export function CourtBackdrop({ court, showZones }: { court: CourtPreset; showZones: boolean }) {
  if (court === 'blank') return <g data-court="blank" style={{ pointerEvents: 'none' }} />;

  const top = 6;
  const bottom = court === 'full' ? 94 : 72;
  const netY = court === 'full' ? (top + bottom) / 2 : top;
  const attackOffset = (bottom - top) * (court === 'full' ? 0.17 : 0.34);

  const zones =
    court === 'full'
      ? [
          [82, 86, '1'], [50, 86, '6'], [18, 86, '5'],
          [18, netY + 6, '4'], [50, netY + 6, '3'], [82, netY + 6, '2'],
        ]
      : [
          [82, 66, '1'], [50, 66, '6'], [18, 66, '5'],
          [18, top + 8, '4'], [50, top + 8, '3'], [82, top + 8, '2'],
        ];

  return (
    <g data-court={court} style={{ pointerEvents: 'none' }}>
      <rect x={10} y={top} width={80} height={bottom - top} fill="none" stroke={LINE} strokeWidth={0.6} />
      <line data-court-net x1={8} y1={netY} x2={92} y2={netY} stroke={LINE} strokeWidth={1} />
      <line x1={10} y1={netY + attackOffset} x2={90} y2={netY + attackOffset} stroke={LINE} strokeWidth={0.4} strokeDasharray="2 1.5" />
      {court === 'full' && (
        <line x1={10} y1={netY - attackOffset} x2={90} y2={netY - attackOffset} stroke={LINE} strokeWidth={0.4} strokeDasharray="2 1.5" />
      )}
      {showZones &&
        zones.map(([x, y, n]) => (
          <text key={n as string} data-zone-label x={x as number} y={y as number} fontSize={4} textAnchor="middle" fill={tokenColorAlpha('ink', 0.4)}>
            {n}
          </text>
        ))}
    </g>
  );
}
```

`src/diagrams/primitives/index.tsx`:

```tsx
import type { DiagramItem } from '../../types/diagram';
import { PlayerToken } from './PlayerToken';
import { Ball } from './Ball';
import { Cone } from './Cone';
import { Ladder } from './Ladder';
import { Net } from './Net';
import { Pole } from './Pole';
import { Line } from './Line';
import { Arrow } from './Arrow';
import { TextLabel } from './TextLabel';
import { ZoneLabel } from './ZoneLabel';

export function renderItem(item: DiagramItem) {
  switch (item.type) {
    case 'player': return <PlayerToken key={item.id} item={item} />;
    case 'ball': return <Ball key={item.id} item={item} />;
    case 'cone': return <Cone key={item.id} item={item} />;
    case 'ladder': return <Ladder key={item.id} item={item} />;
    case 'net': return <Net key={item.id} item={item} />;
    case 'pole': return <Pole key={item.id} item={item} />;
    case 'line': return <Line key={item.id} item={item} />;
    case 'arrow': return <Arrow key={item.id} item={item} />;
    case 'text': return <TextLabel key={item.id} item={item} />;
    case 'zoneLabel': return <ZoneLabel key={item.id} item={item} />;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/diagrams/primitives/primitives.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: no errors (every `switch` is exhaustive over the union; no unused imports).

- [ ] **Step 6: Commit**

```bash
git add src/diagrams/primitives
git commit -m "feat: SVG primitive components and court backdrop"
```

---

## Task 8: `DiagramSvg` renderer

**Files:**
- Create: `src/diagrams/DiagramSvg.tsx`
- Test: `src/diagrams/DiagramSvg.test.tsx`

**Interfaces:**
- Consumes: `Scene`, `DiagramItem` from `src/types/diagram.ts`; `CourtBackdrop`, `renderItem` from `./primitives`.
- Produces:
  ```ts
  interface DiagramSvgProps {
    scene: Scene;
    interactive?: boolean;
    selectedId?: string | null;
    onItemPointerDown?: (id: string, e: React.PointerEvent) => void;
    onBackgroundPointerDown?: (e: React.PointerEvent) => void;
    className?: string;
  }
  export function DiagramSvg(props: DiagramSvgProps): JSX.Element;
  ```
  Renders `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">` containing `<defs>` (arrowhead markers `arrowhead-single` / `arrowhead-double`, `netHatch` pattern), the `<CourtBackdrop>`, then `scene.items` in array order via `renderItem`. When `interactive`, wraps each item in a `<g>` with an `onPointerDown` that calls `onItemPointerDown(item.id, e)`. When `interactive && selectedId` matches an item, renders one `<rect data-selection-outline>` around a nominal bounding box (item.x±6, item.y±6 for point items; the from/to bbox for line/arrow) plus, for `line`/`arrow`, `<circle data-endpoint-handle>` at each endpoint.

- [ ] **Step 1: Write the failing test `src/diagrams/DiagramSvg.test.tsx`**

```tsx
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagramSvg } from './DiagramSvg';
import { emptyScene } from './sceneFactory';
import { createItem } from './sceneFactory';
import type { Scene } from '../types/diagram';

const withItems = (items: Scene['items']): Scene => ({ ...emptyScene('full'), items });

describe('DiagramSvg', () => {
  it('renders an svg with a 0 0 100 100 viewBox and the court backdrop', () => {
    const { container } = render(<DiagramSvg scene={emptyScene('half')} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100');
    expect(container.querySelector('[data-court="half"]')).not.toBeNull();
  });

  it('renders items in array order (later items appear after earlier in the DOM)', () => {
    const a = { ...createItem('player', { x: 20, y: 20 }), id: 'a' };
    const b = { ...createItem('ball', { x: 30, y: 30 }), id: 'b' };
    const { container } = render(<DiagramSvg scene={withItems([a, b])} />);
    const ids = [...container.querySelectorAll('[data-item-id]')].map((el) => el.getAttribute('data-item-id'));
    expect(ids).toEqual(['a', 'b']);
  });

  it('shows no selection outline when not interactive', () => {
    const a = { ...createItem('player', { x: 20, y: 20 }), id: 'a' };
    const { container } = render(<DiagramSvg scene={withItems([a])} selectedId="a" />);
    expect(container.querySelector('[data-selection-outline]')).toBeNull();
  });

  it('shows exactly one selection outline for the selected item when interactive', () => {
    const a = { ...createItem('player', { x: 20, y: 20 }), id: 'a' };
    const b = { ...createItem('player', { x: 40, y: 40 }), id: 'b' };
    const { container } = render(<DiagramSvg scene={withItems([a, b])} interactive selectedId="a" />);
    expect(container.querySelectorAll('[data-selection-outline]')).toHaveLength(1);
  });

  it('calls onItemPointerDown with the item id when an item is pressed', () => {
    const a = { ...createItem('cone', { x: 20, y: 20 }), id: 'a' };
    const onItemPointerDown = vi.fn();
    const { container } = render(
      <DiagramSvg scene={withItems([a])} interactive onItemPointerDown={onItemPointerDown} />,
    );
    fireEvent.pointerDown(container.querySelector('[data-item-id="a"]')!);
    expect(onItemPointerDown).toHaveBeenCalledWith('a', expect.anything());
  });

  it('renders endpoint handles for a selected arrow', () => {
    const arrow = { ...createItem('arrow', { x: 10, y: 10 }), id: 'ar' };
    const { container } = render(<DiagramSvg scene={withItems([arrow])} interactive selectedId="ar" />);
    expect(container.querySelectorAll('[data-endpoint-handle]')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/diagrams/DiagramSvg.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/diagrams/DiagramSvg.tsx`**

```tsx
import type { PointerEvent } from 'react';
import { CourtBackdrop } from './primitives/CourtBackdrop';
import { renderItem } from './primitives';
import type { DiagramItem, Scene } from '../types/diagram';

interface DiagramSvgProps {
  scene: Scene;
  interactive?: boolean;
  selectedId?: string | null;
  onItemPointerDown?: (id: string, e: PointerEvent) => void;
  onBackgroundPointerDown?: (e: PointerEvent) => void;
  className?: string;
}

function endpoints(item: DiagramItem): { x: number; y: number }[] {
  if (item.type === 'arrow') return [item.from, item.to];
  if (item.type === 'line') return item.points;
  return [];
}

function bbox(item: DiagramItem): { x: number; y: number; w: number; h: number } {
  const pts = endpoints(item);
  if (pts.length > 0) {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return { x: minX - 2, y: minY - 2, w: Math.max(...xs) - minX + 4, h: Math.max(...ys) - minY + 4 };
  }
  const pad = 6 * item.size;
  return { x: item.x - pad, y: item.y - pad, w: pad * 2, h: pad * 2 };
}

export function DiagramSvg({
  scene,
  interactive = false,
  selectedId = null,
  onItemPointerDown,
  onBackgroundPointerDown,
  className,
}: DiagramSvgProps) {
  const selected = interactive && selectedId ? scene.items.find((i) => i.id === selectedId) ?? null : null;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      onPointerDown={interactive ? onBackgroundPointerDown : undefined}
    >
      <defs>
        <marker id="arrowhead-single" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="rgb(var(--color-ink))" />
        </marker>
        <marker id="arrowhead-double" markerWidth="10" markerHeight="6" refX="9" refY="3" orient="auto">
          <path d="M0,0 L5,3 L0,6 Z M4,0 L10,3 L4,6 Z" fill="rgb(var(--color-ink))" />
        </marker>
        <pattern id="netHatch" width="2" height="4" patternUnits="userSpaceOnUse">
          <path d="M0,0 L0,4" stroke="rgb(var(--color-ink) / 0.5)" strokeWidth="0.3" />
        </pattern>
      </defs>

      <CourtBackdrop court={scene.court} showZones={scene.showZones} />

      {scene.items.map((item) =>
        interactive ? (
          <g
            key={item.id}
            onPointerDown={(e) => {
              e.stopPropagation();
              onItemPointerDown?.(item.id, e);
            }}
            style={{ cursor: 'move' }}
          >
            {renderItem(item)}
          </g>
        ) : (
          renderItem(item)
        ),
      )}

      {selected && (() => {
        const b = bbox(selected);
        return (
          <g style={{ pointerEvents: 'none' }}>
            <rect
              data-selection-outline
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill="none"
              stroke="rgb(var(--color-blue))"
              strokeWidth={0.6}
              strokeDasharray="2 1.5"
            />
            {endpoints(selected).length > 0
              ? endpoints(selected).map((p, i) => (
                  <circle key={i} data-endpoint-handle data-endpoint-index={i} cx={p.x} cy={p.y} r={1.8} fill="rgb(var(--color-blue))" />
                ))
              : (
                <circle data-transform-handle cx={b.x + b.w} cy={b.y} r={1.8} fill="rgb(var(--color-blue))" />
              )}
          </g>
        );
      })()}
    </svg>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/diagrams/DiagramSvg.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/diagrams/DiagramSvg.tsx src/diagrams/DiagramSvg.test.tsx
git commit -m "feat: DiagramSvg pure renderer with selection layer"
```

---

## Task 9: `useDiagramEditor` reducer + hook

**Files:**
- Create: `src/diagrams/useDiagramEditor.ts`
- Test: `src/diagrams/useDiagramEditor.test.ts`

**Interfaces:**
- Consumes: `Scene`, `DiagramItem`, `CourtPreset`, `SCENE_LIMITS` from `src/types/diagram.ts`; `emptyScene`, `newId` from `./sceneFactory`; `listDiagrams`, `saveDiagramSet`, `DiagramSaveOps` from `./diagramsApi`.
- Produces:
  ```ts
  export interface EditorDiagram { id: string; persisted: boolean; title: string; order: number; scene: Scene; }
  export interface EditorState {
    diagrams: EditorDiagram[];
    activeDiagramId: string | null;
    selectedItemId: string | null;
    dirtyIds: Set<string>;
    deletedIds: string[];
    undo: Scene[];
    redo: Scene[];
  }
  export type EditorAction =
    | { type: 'loaded'; diagrams: EditorDiagram[] }
    | { type: 'selectDiagram'; id: string }
    | { type: 'addDiagram' }
    | { type: 'renameDiagram'; id: string; title: string }
    | { type: 'reorderDiagram'; id: string; direction: 'left' | 'right' }
    | { type: 'deleteDiagram'; id: string }
    | { type: 'selectItem'; id: string | null }
    | { type: 'addItem'; item: DiagramItem }
    | { type: 'moveItem'; id: string; x: number; y: number }
    | { type: 'transformItem'; id: string; rotation: number; size: number }
    | { type: 'setItemProp'; id: string; patch: Partial<DiagramItem> }
    | { type: 'deleteItem'; id: string }
    | { type: 'reorderItem'; id: string; to: 'front' | 'back' | 'forward' | 'backward' }
    | { type: 'setCourt'; court: CourtPreset }
    | { type: 'toggleZones' }
    | { type: 'undo' }
    | { type: 'redo' }
    | { type: 'saved'; idMap: Record<string, string> };
  export const initialEditorState: EditorState;
  export function diagramReducer(state: EditorState, action: EditorAction): EditorState;
  export function buildSaveOps(state: EditorState): DiagramSaveOps;
  export function useDiagramEditor(exerciseId: string, uid: string): {
    state: EditorState;
    activeDiagram: EditorDiagram | null;
    dispatch: React.Dispatch<EditorAction>;
    save: () => Promise<void>;
    saving: boolean;
    dirty: boolean;
    loadError: string | null;
    saveError: string | null;
  };
  ```
- `UNDO_LIMIT = 30`. Every item/scene mutation (add/move/transform/setProp/delete/reorder item, setCourt, toggleZones) pushes the pre-mutation active scene onto `undo` (cap 30), clears `redo`, and adds the active diagram id to `dirtyIds`. `addDiagram` appends `{ id: `new:${newId()}`, persisted: false, title: `Diagram ${n+1}`, order: n, scene: emptyScene('full') }`, makes it active, adds its id to `dirtyIds`. Guard: `addDiagram` is a no-op when `diagrams.length >= SCENE_LIMITS.diagramsPerExercise`. `deleteDiagram` removes it, drops its id from `dirtyIds`, appends to `deletedIds` iff `persisted`, re-points `activeDiagramId` to `diagrams[0]` if it was active, clears undo/redo. `saved` renames `new:*` ids via `idMap`, sets `persisted: true` on all, clears `dirtyIds`/`deletedIds`.

- [ ] **Step 1: Write the failing test `src/diagrams/useDiagramEditor.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { diagramReducer, initialEditorState, buildSaveOps, type EditorState } from './useDiagramEditor';
import { emptyScene, createItem } from './sceneFactory';
import type { Scene } from '../types/diagram';

function loaded(scene: Scene = emptyScene('full')): EditorState {
  return diagramReducer(initialEditorState, {
    type: 'loaded',
    diagrams: [{ id: 'd1', persisted: true, title: 'Setup', order: 0, scene }],
  });
}

describe('diagramReducer', () => {
  it('loads diagrams and activates the first', () => {
    const s = loaded();
    expect(s.activeDiagramId).toBe('d1');
    expect(s.dirtyIds.size).toBe(0);
  });

  it('addItem appends the item, selects it, and marks the diagram dirty', () => {
    const item = createItem('player', { x: 20, y: 20 });
    const s = diagramReducer(loaded(), { type: 'addItem', item });
    expect(s.diagrams[0].scene.items).toEqual([item]);
    expect(s.selectedItemId).toBe(item.id);
    expect(s.dirtyIds.has('d1')).toBe(true);
  });

  it('moveItem / transformItem / setItemProp mutate only the target item', () => {
    const a = { ...createItem('cone', { x: 10, y: 10 }), id: 'a' };
    const b = { ...createItem('cone', { x: 50, y: 50 }), id: 'b' };
    let s = diagramReducer(loaded(), { type: 'addItem', item: a });
    s = diagramReducer(s, { type: 'addItem', item: b });
    s = diagramReducer(s, { type: 'moveItem', id: 'a', x: 15, y: 25 });
    s = diagramReducer(s, { type: 'transformItem', id: 'a', rotation: 90, size: 1.5 });
    s = diagramReducer(s, { type: 'setItemProp', id: 'a', patch: { color: 'green' } });
    const [ia, ib] = s.diagrams[0].scene.items;
    expect(ia).toMatchObject({ id: 'a', x: 15, y: 25, rotation: 90, size: 1.5, color: 'green' });
    expect(ib).toMatchObject({ id: 'b', x: 50, y: 50, rotation: 0 });
  });

  it('deleteItem removes the item and clears the selection', () => {
    const a = { ...createItem('ball', { x: 10, y: 10 }), id: 'a' };
    let s = diagramReducer(loaded(), { type: 'addItem', item: a });
    s = diagramReducer(s, { type: 'deleteItem', id: 'a' });
    expect(s.diagrams[0].scene.items).toHaveLength(0);
    expect(s.selectedItemId).toBeNull();
  });

  it('reorderItem moves an item within the z-order array', () => {
    const ids = ['a', 'b', 'c'];
    let s = loaded();
    for (const id of ids) s = diagramReducer(s, { type: 'addItem', item: { ...createItem('cone', { x: 1, y: 1 }), id } });
    s = diagramReducer(s, { type: 'reorderItem', id: 'a', to: 'front' });
    expect(s.diagrams[0].scene.items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    s = diagramReducer(s, { type: 'reorderItem', id: 'a', to: 'backward' });
    expect(s.diagrams[0].scene.items.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('addDiagram appends up to the cap then no-ops', () => {
    let s = loaded();
    for (let i = 0; i < 20; i += 1) s = diagramReducer(s, { type: 'addDiagram' });
    expect(s.diagrams).toHaveLength(12);
    expect(s.diagrams[11].persisted).toBe(false);
    expect(s.activeDiagramId).toBe(s.diagrams[11].id);
  });

  it('deleteDiagram on a persisted diagram records it in deletedIds and re-points active', () => {
    let s = loaded();
    s = diagramReducer(s, { type: 'addDiagram' });
    const newId = s.activeDiagramId!;
    s = diagramReducer(s, { type: 'deleteDiagram', id: 'd1' });
    expect(s.deletedIds).toEqual(['d1']);
    expect(s.diagrams.map((d) => d.id)).toEqual([newId]);
    s = diagramReducer(s, { type: 'deleteDiagram', id: newId });
    expect(s.deletedIds).toEqual(['d1']); // unsaved-new one not recorded
  });

  it('undo restores the previous scene and redo reapplies; stack caps at 30', () => {
    let s = loaded();
    for (let i = 0; i < 35; i += 1) {
      s = diagramReducer(s, { type: 'addItem', item: { ...createItem('cone', { x: i, y: i }), id: `c${i}` } });
    }
    expect(s.undo).toHaveLength(30);
    const count = s.diagrams[0].scene.items.length;
    s = diagramReducer(s, { type: 'undo' });
    expect(s.diagrams[0].scene.items.length).toBe(count - 1);
    s = diagramReducer(s, { type: 'redo' });
    expect(s.diagrams[0].scene.items.length).toBe(count);
  });

  it('setCourt and toggleZones mutate the active scene and mark it dirty', () => {
    let s = loaded();
    s = diagramReducer(s, { type: 'setCourt', court: 'blank' });
    s = diagramReducer(s, { type: 'toggleZones' });
    expect(s.diagrams[0].scene.court).toBe('blank');
    expect(s.diagrams[0].scene.showZones).toBe(true);
    expect(s.dirtyIds.has('d1')).toBe(true);
  });

  it('saved swaps temp ids for real ids and clears dirty/deleted', () => {
    let s = loaded();
    s = diagramReducer(s, { type: 'addDiagram' });
    const tempId = s.activeDiagramId!;
    s = diagramReducer(s, { type: 'deleteDiagram', id: 'd1' });
    s = diagramReducer(s, { type: 'saved', idMap: { [tempId]: 'real-9' } });
    expect(s.diagrams[0].id).toBe('real-9');
    expect(s.diagrams[0].persisted).toBe(true);
    expect(s.dirtyIds.size).toBe(0);
    expect(s.deletedIds).toEqual([]);
  });
});

describe('buildSaveOps', () => {
  it('splits diagrams into creates (unpersisted), updates (persisted + dirty) and deletes', () => {
    let s = loaded();
    s = diagramReducer(s, { type: 'renameDiagram', id: 'd1', title: 'Setup v2' });
    s = diagramReducer(s, { type: 'addDiagram' });
    s = diagramReducer(s, { type: 'deleteDiagram', id: 'd1' });
    // d1 now deleted; re-add it back to exercise: emulate a persisted+dirty case instead
    let s2 = loaded();
    s2 = diagramReducer(s2, { type: 'addItem', item: { ...createItem('cone', { x: 1, y: 1 }), id: 'x' } });
    s2 = diagramReducer(s2, { type: 'addDiagram' });
    const ops = buildSaveOps(s2);
    expect(ops.updates.map((u) => u.id)).toEqual(['d1']);
    expect(ops.creates).toHaveLength(1);
    expect(ops.deletes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/diagrams/useDiagramEditor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/diagrams/useDiagramEditor.ts`**

```ts
import { useCallback, useEffect, useReducer, useState } from 'react';
import { SCENE_LIMITS, type CourtPreset, type DiagramItem, type Scene } from '../types/diagram';
import { emptyScene, newId } from './sceneFactory';
import { listDiagrams, saveDiagramSet, type DiagramSaveOps } from './diagramsApi';

const UNDO_LIMIT = 30;

export interface EditorDiagram {
  id: string;
  persisted: boolean;
  title: string;
  order: number;
  scene: Scene;
}

export interface EditorState {
  diagrams: EditorDiagram[];
  activeDiagramId: string | null;
  selectedItemId: string | null;
  dirtyIds: Set<string>;
  deletedIds: string[];
  undo: Scene[];
  redo: Scene[];
}

export type EditorAction =
  | { type: 'loaded'; diagrams: EditorDiagram[] }
  | { type: 'selectDiagram'; id: string }
  | { type: 'addDiagram' }
  | { type: 'renameDiagram'; id: string; title: string }
  | { type: 'reorderDiagram'; id: string; direction: 'left' | 'right' }
  | { type: 'deleteDiagram'; id: string }
  | { type: 'selectItem'; id: string | null }
  | { type: 'addItem'; item: DiagramItem }
  | { type: 'moveItem'; id: string; x: number; y: number }
  | { type: 'transformItem'; id: string; rotation: number; size: number }
  | { type: 'setItemProp'; id: string; patch: Partial<DiagramItem> }
  | { type: 'deleteItem'; id: string }
  | { type: 'reorderItem'; id: string; to: 'front' | 'back' | 'forward' | 'backward' }
  | { type: 'setCourt'; court: CourtPreset }
  | { type: 'toggleZones' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'saved'; idMap: Record<string, string> };

export const initialEditorState: EditorState = {
  diagrams: [],
  activeDiagramId: null,
  selectedItemId: null,
  dirtyIds: new Set(),
  deletedIds: [],
  undo: [],
  redo: [],
};

function reorderZ(items: DiagramItem[], id: string, to: 'front' | 'back' | 'forward' | 'backward'): DiagramItem[] {
  const i = items.findIndex((it) => it.id === id);
  if (i < 0) return items;
  const next = items.slice();
  const [it] = next.splice(i, 1);
  const j =
    to === 'front' ? next.length : to === 'back' ? 0 : to === 'forward' ? Math.min(next.length, i + 1) : Math.max(0, i - 1);
  next.splice(j, 0, it);
  return next;
}

/** Apply `mutate` to the active diagram's scene, recording undo + dirty. */
function mutateActive(state: EditorState, mutate: (scene: Scene) => Scene): EditorState {
  const active = state.diagrams.find((d) => d.id === state.activeDiagramId);
  if (!active) return state;
  const nextScene = mutate(active.scene);
  if (nextScene === active.scene) return state;
  return {
    ...state,
    diagrams: state.diagrams.map((d) => (d.id === active.id ? { ...d, scene: nextScene } : d)),
    dirtyIds: new Set(state.dirtyIds).add(active.id),
    undo: [...state.undo, active.scene].slice(-UNDO_LIMIT),
    redo: [],
  };
}

function patchItems(scene: Scene, id: string, fn: (item: DiagramItem) => DiagramItem): Scene {
  return { ...scene, items: scene.items.map((it) => (it.id === id ? fn(it) : it)) };
}

export function diagramReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'loaded': {
      const sorted = [...action.diagrams].sort((a, b) => a.order - b.order);
      return { ...initialEditorState, diagrams: sorted, activeDiagramId: sorted[0]?.id ?? null };
    }
    case 'selectDiagram':
      return { ...state, activeDiagramId: action.id, selectedItemId: null, undo: [], redo: [] };
    case 'addDiagram': {
      if (state.diagrams.length >= SCENE_LIMITS.diagramsPerExercise) return state;
      const n = state.diagrams.length;
      const id = `new:${newId()}`;
      const diagram: EditorDiagram = { id, persisted: false, title: `Diagram ${n + 1}`, order: n, scene: emptyScene('full') };
      return {
        ...state,
        diagrams: [...state.diagrams, diagram],
        activeDiagramId: id,
        selectedItemId: null,
        dirtyIds: new Set(state.dirtyIds).add(id),
        undo: [],
        redo: [],
      };
    }
    case 'renameDiagram':
      return {
        ...state,
        diagrams: state.diagrams.map((d) =>
          d.id === action.id ? { ...d, title: action.title.slice(0, SCENE_LIMITS.titleLength) } : d,
        ),
        dirtyIds: new Set(state.dirtyIds).add(action.id),
      };
    case 'reorderDiagram': {
      const i = state.diagrams.findIndex((d) => d.id === action.id);
      const j = action.direction === 'left' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= state.diagrams.length) return state;
      const next = state.diagrams.slice();
      [next[i], next[j]] = [next[j], next[i]];
      const renumbered = next.map((d, k) => ({ ...d, order: k }));
      const dirtyIds = new Set(state.dirtyIds);
      renumbered.forEach((d) => dirtyIds.add(d.id));
      return { ...state, diagrams: renumbered, dirtyIds };
    }
    case 'deleteDiagram': {
      const target = state.diagrams.find((d) => d.id === action.id);
      if (!target) return state;
      const diagrams = state.diagrams.filter((d) => d.id !== action.id).map((d, k) => ({ ...d, order: k }));
      const dirtyIds = new Set(state.dirtyIds);
      dirtyIds.delete(action.id);
      return {
        ...state,
        diagrams,
        dirtyIds,
        deletedIds: target.persisted ? [...state.deletedIds, action.id] : state.deletedIds,
        activeDiagramId: state.activeDiagramId === action.id ? diagrams[0]?.id ?? null : state.activeDiagramId,
        selectedItemId: null,
        undo: [],
        redo: [],
      };
    }
    case 'selectItem':
      return { ...state, selectedItemId: action.id };
    case 'addItem': {
      const next = mutateActive(state, (scene) =>
        scene.items.length >= SCENE_LIMITS.itemsPerScene ? scene : { ...scene, items: [...scene.items, action.item] },
      );
      return next === state ? state : { ...next, selectedItemId: action.item.id };
    }
    case 'moveItem':
      return mutateActive(state, (scene) =>
        patchItems(scene, action.id, (it) => ({ ...it, x: action.x, y: action.y })),
      );
    case 'transformItem':
      return mutateActive(state, (scene) =>
        patchItems(scene, action.id, (it) => ({ ...it, rotation: action.rotation, size: action.size })),
      );
    case 'setItemProp':
      return mutateActive(state, (scene) =>
        patchItems(scene, action.id, (it) => ({ ...it, ...action.patch }) as DiagramItem),
      );
    case 'deleteItem': {
      const next = mutateActive(state, (scene) => ({ ...scene, items: scene.items.filter((it) => it.id !== action.id) }));
      return next === state ? state : { ...next, selectedItemId: null };
    }
    case 'reorderItem':
      return mutateActive(state, (scene) => ({ ...scene, items: reorderZ(scene.items, action.id, action.to) }));
    case 'setCourt':
      return mutateActive(state, (scene) => (scene.court === action.court ? scene : { ...scene, court: action.court }));
    case 'toggleZones':
      return mutateActive(state, (scene) => ({ ...scene, showZones: !scene.showZones }));
    case 'undo': {
      const active = state.diagrams.find((d) => d.id === state.activeDiagramId);
      if (!active || state.undo.length === 0) return state;
      const prev = state.undo[state.undo.length - 1];
      return {
        ...state,
        diagrams: state.diagrams.map((d) => (d.id === active.id ? { ...d, scene: prev } : d)),
        undo: state.undo.slice(0, -1),
        redo: [...state.redo, active.scene].slice(-UNDO_LIMIT),
        dirtyIds: new Set(state.dirtyIds).add(active.id),
        selectedItemId: null,
      };
    }
    case 'redo': {
      const active = state.diagrams.find((d) => d.id === state.activeDiagramId);
      if (!active || state.redo.length === 0) return state;
      const next = state.redo[state.redo.length - 1];
      return {
        ...state,
        diagrams: state.diagrams.map((d) => (d.id === active.id ? { ...d, scene: next } : d)),
        redo: state.redo.slice(0, -1),
        undo: [...state.undo, active.scene].slice(-UNDO_LIMIT),
        dirtyIds: new Set(state.dirtyIds).add(active.id),
        selectedItemId: null,
      };
    }
    case 'saved': {
      const diagrams = state.diagrams.map((d) => ({
        ...d,
        id: action.idMap[d.id] ?? d.id,
        persisted: true,
      }));
      return { ...state, diagrams, dirtyIds: new Set(), deletedIds: [], undo: [], redo: [] };
    }
  }
}

export function buildSaveOps(state: EditorState): DiagramSaveOps {
  return {
    creates: state.diagrams
      .filter((d) => !d.persisted)
      .map((d) => ({ tempId: d.id, title: d.title, order: d.order, scene: d.scene })),
    updates: state.diagrams
      .filter((d) => d.persisted && state.dirtyIds.has(d.id))
      .map((d) => ({ id: d.id, title: d.title, order: d.order, scene: d.scene })),
    deletes: state.deletedIds,
  };
}

export function useDiagramEditor(exerciseId: string, uid: string) {
  const [state, dispatch] = useReducer(diagramReducer, initialEditorState);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listDiagrams(exerciseId)
      .then((docs) => {
        if (cancelled) return;
        dispatch({
          type: 'loaded',
          diagrams: docs.map((d) => ({ id: d.id, persisted: true, title: d.title, order: d.order, scene: d.scene })),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load diagrams. Please refresh.');
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  const save = useCallback(async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const ops = buildSaveOps(state);
      const { idMap } = await saveDiagramSet(exerciseId, ops, uid);
      dispatch({ type: 'saved', idMap });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save diagrams. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [state, exerciseId, uid]);

  const activeDiagram = state.diagrams.find((d) => d.id === state.activeDiagramId) ?? null;
  const dirty = state.dirtyIds.size > 0 || state.deletedIds.length > 0;

  return { state, activeDiagram, dispatch, save, saving, dirty, loadError, saveError };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/diagrams/useDiagramEditor.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: no errors (the `switch` over `EditorAction` is exhaustive — no `default` needed).

- [ ] **Step 6: Commit**

```bash
git add src/diagrams/useDiagramEditor.ts src/diagrams/useDiagramEditor.test.ts
git commit -m "feat: useDiagramEditor reducer and hook"
```

---

## Task 10: Editor chrome — `DiagramTabs`, `Palette`, `PropertiesPanel`

**Files:**
- Create: `src/diagrams/DiagramTabs.tsx`, `src/diagrams/Palette.tsx`, `src/diagrams/PropertiesPanel.tsx`
- Test: `src/diagrams/DiagramTabs.test.tsx`, `src/diagrams/PropertiesPanel.test.tsx`

**Interfaces:**
- Consumes: `EditorDiagram`, `EditorAction` from `./useDiagramEditor`; `DiagramItem`, `DiagramItemType`, `PALETTE_COLORS`, `SCENE_LIMITS` from `src/types/diagram.ts`; `createItem` from `./sceneFactory`; `Button` from `../components/Button`; `Input` from `../components/Input`; icons from `lucide-react`.
- Produces:
  ```ts
  export function DiagramTabs(props: {
    diagrams: EditorDiagram[];
    activeId: string | null;
    dirtyIds: Set<string>;
    canAdd: boolean;
    dispatch: React.Dispatch<EditorAction>;
  }): JSX.Element;

  export const PALETTE_ITEMS: { type: DiagramItemType; label: string }[];
  export function Palette(props: {
    onAdd: (type: DiagramItemType) => void;
    variant: 'rail' | 'grid';
  }): JSX.Element;

  export function PropertiesPanel(props: {
    item: DiagramItem | null;
    dispatch: React.Dispatch<EditorAction>;
  }): JSX.Element;
  ```
  `DiagramTabs`: one chip per diagram (click → `selectDiagram`); active chip shows an inline rename `<input>` (change → `renameDiagram`); `‹`/`›` buttons → `reorderDiagram`; trash → `deleteDiagram`; `+` (disabled unless `canAdd`) → `addDiagram`. `Palette`: a button per `PALETTE_ITEMS` entry calling `onAdd(type)`. `PropertiesPanel`: when `item` is null renders a muted hint; otherwise renders the fields for that item type (colour swatches from `PALETTE_COLORS` → `setItemProp`; `player.label` text input capped at `SCENE_LIMITS.labelLength`; `size` range; `rotation` range; type-specifics per spec §1 table), plus nudge buttons (`moveItem` ±1), z-order buttons (`reorderItem`), and Delete (`deleteItem`).

- [ ] **Step 1: Write the failing tests**

`src/diagrams/DiagramTabs.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagramTabs } from './DiagramTabs';
import { emptyScene } from './sceneFactory';
import type { EditorDiagram } from './useDiagramEditor';

const diagrams: EditorDiagram[] = [
  { id: 'd1', persisted: true, title: 'Setup', order: 0, scene: emptyScene() },
  { id: 'd2', persisted: true, title: 'Phase 1', order: 1, scene: emptyScene() },
];

it('selects a diagram on chip click', () => {
  const dispatch = vi.fn();
  render(<DiagramTabs diagrams={diagrams} activeId="d1" dirtyIds={new Set()} canAdd dispatch={dispatch} />);
  fireEvent.click(screen.getByText('Phase 1'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'selectDiagram', id: 'd2' });
});

it('renames the active diagram from the inline input', () => {
  const dispatch = vi.fn();
  render(<DiagramTabs diagrams={diagrams} activeId="d1" dirtyIds={new Set()} canAdd dispatch={dispatch} />);
  fireEvent.change(screen.getByDisplayValue('Setup'), { target: { value: 'Warmup' } });
  expect(dispatch).toHaveBeenCalledWith({ type: 'renameDiagram', id: 'd1', title: 'Warmup' });
});

it('adds a diagram, and the + control is disabled when canAdd is false', () => {
  const dispatch = vi.fn();
  const { rerender } = render(
    <DiagramTabs diagrams={diagrams} activeId="d1" dirtyIds={new Set()} canAdd dispatch={dispatch} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /add diagram/i }));
  expect(dispatch).toHaveBeenCalledWith({ type: 'addDiagram' });
  rerender(<DiagramTabs diagrams={diagrams} activeId="d1" dirtyIds={new Set()} canAdd={false} dispatch={dispatch} />);
  expect(screen.getByRole('button', { name: /add diagram/i })).toBeDisabled();
});
```

`src/diagrams/PropertiesPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';
import { createItem } from './sceneFactory';

it('shows a hint when nothing is selected', () => {
  render(<PropertiesPanel item={null} dispatch={vi.fn()} />);
  expect(screen.getByText(/select an element/i)).toBeInTheDocument();
});

it('edits a player label via setItemProp', () => {
  const dispatch = vi.fn();
  const item = { ...createItem('player', { x: 10, y: 10 }), id: 'p1' };
  render(<PropertiesPanel item={item} dispatch={dispatch} />);
  fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'OH' } });
  expect(dispatch).toHaveBeenCalledWith({ type: 'setItemProp', id: 'p1', patch: { label: 'OH' } });
});

it('changes colour from a swatch', () => {
  const dispatch = vi.fn();
  const item = { ...createItem('cone', { x: 10, y: 10 }), id: 'c1' };
  render(<PropertiesPanel item={item} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole('button', { name: 'green' }));
  expect(dispatch).toHaveBeenCalledWith({ type: 'setItemProp', id: 'c1', patch: { color: 'green' } });
});

it('deletes the selected item', () => {
  const dispatch = vi.fn();
  const item = { ...createItem('ball', { x: 10, y: 10 }), id: 'b1' };
  render(<PropertiesPanel item={item} dispatch={dispatch} />);
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  expect(dispatch).toHaveBeenCalledWith({ type: 'deleteItem', id: 'b1' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/diagrams/DiagramTabs.test.tsx src/diagrams/PropertiesPanel.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `src/diagrams/DiagramTabs.tsx`**

```tsx
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { SCENE_LIMITS } from '../types/diagram';
import type { EditorAction, EditorDiagram } from './useDiagramEditor';

interface Props {
  diagrams: EditorDiagram[];
  activeId: string | null;
  dirtyIds: Set<string>;
  canAdd: boolean;
  dispatch: React.Dispatch<EditorAction>;
}

export function DiagramTabs({ diagrams, activeId, dirtyIds, canAdd, dispatch }: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-surface px-3 py-2">
      {diagrams.map((d) => {
        const active = d.id === activeId;
        return (
          <div
            key={d.id}
            className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-sm ${
              active ? 'border-blue bg-blue/10' : 'border-border bg-bg'
            }`}
          >
            {active ? (
              <input
                aria-label="Diagram title"
                value={d.title}
                onChange={(e) => dispatch({ type: 'renameDiagram', id: d.id, title: e.target.value })}
                maxLength={SCENE_LIMITS.titleLength}
                className="w-28 bg-transparent text-ink focus:outline-none"
              />
            ) : (
              <button type="button" onClick={() => dispatch({ type: 'selectDiagram', id: d.id })} className="text-slate">
                {d.title}
              </button>
            )}
            {dirtyIds.has(d.id) && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-orange" />}
            {active && (
              <>
                <button type="button" aria-label="Move diagram left" onClick={() => dispatch({ type: 'reorderDiagram', id: d.id, direction: 'left' })}>
                  <ChevronLeft className="h-4 w-4 text-slate" />
                </button>
                <button type="button" aria-label="Move diagram right" onClick={() => dispatch({ type: 'reorderDiagram', id: d.id, direction: 'right' })}>
                  <ChevronRight className="h-4 w-4 text-slate" />
                </button>
                <button type="button" aria-label="Delete diagram" onClick={() => dispatch({ type: 'deleteDiagram', id: d.id })}>
                  <Trash2 className="h-4 w-4 text-red" />
                </button>
              </>
            )}
          </div>
        );
      })}
      <button
        type="button"
        aria-label="Add diagram"
        disabled={!canAdd}
        onClick={() => dispatch({ type: 'addDiagram' })}
        className="shrink-0 rounded-md border border-border p-1 text-slate disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/diagrams/Palette.tsx`**

```tsx
import type { DiagramItemType } from '../types/diagram';

export const PALETTE_ITEMS: { type: DiagramItemType; label: string }[] = [
  { type: 'player', label: 'Player' },
  { type: 'ball', label: 'Ball' },
  { type: 'cone', label: 'Cone' },
  { type: 'ladder', label: 'Ladder' },
  { type: 'net', label: 'Net' },
  { type: 'pole', label: 'Pole' },
  { type: 'line', label: 'Line' },
  { type: 'arrow', label: 'Arrow' },
  { type: 'text', label: 'Text' },
  { type: 'zoneLabel', label: 'Zone #' },
];

interface Props {
  onAdd: (type: DiagramItemType) => void;
  variant: 'rail' | 'grid';
}

export function Palette({ onAdd, variant }: Props) {
  return (
    <div className={variant === 'rail' ? 'flex flex-col gap-1' : 'grid grid-cols-3 gap-2'}>
      {PALETTE_ITEMS.map((p) => (
        <button
          key={p.type}
          type="button"
          onClick={() => onAdd(p.type)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-bg"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Write `src/diagrams/PropertiesPanel.tsx`**

```tsx
import { PALETTE_COLORS, SCENE_LIMITS, type DiagramItem } from '../types/diagram';
import { tokenColor } from './tokenColor';
import type { EditorAction } from './useDiagramEditor';

interface Props {
  item: DiagramItem | null;
  dispatch: React.Dispatch<EditorAction>;
}

export function PropertiesPanel({ item, dispatch }: Props) {
  if (!item) {
    return <p className="p-3 text-sm text-slate">Select an element to edit its properties.</p>;
  }
  const set = (patch: Partial<DiagramItem>) => dispatch({ type: 'setItemProp', id: item.id, patch });

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      {'color' in item && (
        <div>
          <span className="mb-1 block font-medium text-ink">Colour</span>
          <div className="flex gap-1">
            {PALETTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={item.color === c}
                onClick={() => set({ color: c })}
                className={`h-6 w-6 rounded-full border-2 ${item.color === c ? 'border-ink' : 'border-transparent'}`}
                style={{ background: tokenColor(c) }}
              />
            ))}
          </div>
        </div>
      )}

      {item.type === 'player' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">Role</span>
          <input
            value={item.label}
            maxLength={SCENE_LIMITS.labelLength}
            onChange={(e) => set({ label: e.target.value })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          />
        </label>
      )}

      {item.type === 'player' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">Shape</span>
          <select
            value={item.shape}
            onChange={(e) => set({ shape: e.target.value as 'circle' | 'square' })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          >
            <option value="circle">Circle</option>
            <option value="square">Square</option>
          </select>
        </label>
      )}

      {item.type === 'text' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">Text</span>
          <input
            value={item.content}
            maxLength={SCENE_LIMITS.textLength}
            onChange={(e) => set({ content: e.target.value })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          />
        </label>
      )}

      {item.type === 'ladder' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">Rungs: {item.rungs}</span>
          <input type="range" min={3} max={10} value={item.rungs} onChange={(e) => set({ rungs: Number(e.target.value) })} className="w-full" />
        </label>
      )}

      {item.type === 'arrow' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">Style</span>
          <select
            value={item.style}
            onChange={(e) => set({ style: e.target.value as 'pass' | 'shot' | 'run' })}
            className="w-full rounded-md border border-border bg-surface px-2 py-1"
          >
            <option value="pass">Pass</option>
            <option value="shot">Shot</option>
            <option value="run">Run</option>
          </select>
        </label>
      )}

      {item.type === 'zoneLabel' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">Zone</span>
          <select value={item.zone} onChange={(e) => set({ zone: Number(e.target.value) })} className="w-full rounded-md border border-border bg-surface px-2 py-1">
            {[1, 2, 3, 4, 5, 6].map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="mb-1 block font-medium text-ink">Size</span>
        <input type="range" min={0.5} max={2} step={0.1} value={item.size} onChange={(e) => set({ size: Number(e.target.value) })} className="w-full" />
      </label>

      {item.type !== 'ball' && item.type !== 'pole' && item.type !== 'line' && item.type !== 'arrow' && (
        <label className="block">
          <span className="mb-1 block font-medium text-ink">Rotation</span>
          <input type="range" min={-180} max={180} value={item.rotation} onChange={(e) => set({ rotation: Number(e.target.value) })} className="w-full" />
        </label>
      )}

      <div className="flex flex-wrap gap-1">
        <button type="button" className="rounded-md border border-border px-2 py-1" onClick={() => dispatch({ type: 'moveItem', id: item.id, x: item.x - 1, y: item.y })}>←</button>
        <button type="button" className="rounded-md border border-border px-2 py-1" onClick={() => dispatch({ type: 'moveItem', id: item.id, x: item.x + 1, y: item.y })}>→</button>
        <button type="button" className="rounded-md border border-border px-2 py-1" onClick={() => dispatch({ type: 'moveItem', id: item.id, x: item.x, y: item.y - 1 })}>↑</button>
        <button type="button" className="rounded-md border border-border px-2 py-1" onClick={() => dispatch({ type: 'moveItem', id: item.id, x: item.x, y: item.y + 1 })}>↓</button>
      </div>

      <div className="flex flex-wrap gap-1">
        <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => dispatch({ type: 'reorderItem', id: item.id, to: 'backward' })}>Back</button>
        <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => dispatch({ type: 'reorderItem', id: item.id, to: 'forward' })}>Forward</button>
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: 'deleteItem', id: item.id })}
        className="rounded-md border border-red px-3 py-1.5 font-medium text-red hover:bg-red/10"
      >
        Delete element
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/diagrams/DiagramTabs.test.tsx src/diagrams/PropertiesPanel.test.tsx`
Expected: PASS.

- [ ] **Step 7: Typecheck + lint**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/diagrams/DiagramTabs.tsx src/diagrams/Palette.tsx src/diagrams/PropertiesPanel.tsx src/diagrams/DiagramTabs.test.tsx src/diagrams/PropertiesPanel.test.tsx
git commit -m "feat: diagram editor chrome (tabs, palette, properties panel)"
```

---

## Task 11: `DiagramEditorPage` + `CanvasStage` + route

**Files:**
- Create: `src/diagrams/CanvasStage.tsx`
- Create: `src/diagrams/DiagramEditorPage.tsx`
- Create: `src/diagrams/DiagramEditorPage.test.tsx`
- Modify: `package.json` (add `@use-gesture/react`)
- Modify: `src/App.tsx` (route)

**Interfaces:**
- Consumes: `useDiagramEditor` and its actions; `DiagramSvg`; `DiagramTabs`, `Palette`, `PropertiesPanel`; `createItem` from `./sceneFactory`; `useAuth` from `../auth/AuthContext`; `useParams`, `useNavigate`, `useBlocker` from `react-router-dom`; `Button` from `../components/Button`; `@use-gesture/react` (`useGesture`).
- Produces:
  - `CanvasStage({ children, onDropAt }: { children: React.ReactNode; onDropAt?: (pt: {x:number;y:number}) => void }): JSX.Element` — a `<div>` that owns pan (`translate`) + zoom (`scale`, clamp 0.5–4) state via `useGesture`, applying a CSS transform to an inner wrapper that holds `children`. Exposes a `data-canvas-stage` attribute. Provides a `screenToCourt(clientX, clientY)` conversion through a ref callback used by the page for pointer math.
  - `DiagramEditorPage(): JSX.Element` — reads `:exerciseId` from the route + `firebaseUser.uid` from auth. Renders: header (`‹ Exercises` link, `Save` button — disabled unless `dirty`, shows `saving`), `<DiagramTabs>`, and a responsive body: on `lg:` a 3-column grid (`Palette variant="rail"` | `CanvasStage`>`DiagramSvg interactive` | `PropertiesPanel`); below `lg` a single column with the canvas, a bottom `Palette variant="grid"` in a collapsible panel, and `PropertiesPanel` under it. Wires: palette `onAdd` → `dispatch({type:'addItem', item: createItem(type, centerOfViewport)})`; `DiagramSvg.onItemPointerDown` → `dispatch({type:'selectItem', id})` then begins a drag that dispatches `moveItem` (snap to 2.5 when the snap toggle is on); `onBackgroundPointerDown` → `selectItem(null)`. Autosave: a `useEffect` with a 3000 ms `setTimeout` keyed on `state` that calls `save()` when `dirty`; also `save()` on unmount if `dirty`. `useBlocker` prompts on navigation while `dirty`; a `beforeunload` listener too. If `loadError`, render it in place of the editor.

- [ ] **Step 1: Add the dependency**

Run:

```bash
npm install @use-gesture/react
```

Expected: `@use-gesture/react` added under `dependencies` in `package.json` (a recent 10.x). Commit this with the task's final commit.

- [ ] **Step 2: Write the failing test `src/diagrams/DiagramEditorPage.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramEditorPage } from './DiagramEditorPage';
import * as diagramsApi from './diagramsApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./diagramsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

// A data router is required because DiagramEditorPage uses useBlocker().
function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/exercises/:exerciseId/diagram', element: <DiagramEditorPage /> },
      { path: '/exercises', element: <div>Exercises list</div> },
    ],
    { initialEntries: ['/exercises/ex-1/diagram'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('DiagramEditorPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'c@e.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    vi.mocked(diagramsApi.listDiagrams).mockResolvedValue([
      { id: 'd1', title: 'Setup', order: 0, scene: { v: 1, court: 'full', showZones: false, items: [] }, updatedBy: 'x', updatedAt: null },
    ]);
    vi.mocked(diagramsApi.saveDiagramSet).mockResolvedValue({ idMap: {} });
  });

  it('loads the diagram set and shows its tab', async () => {
    renderPage();
    expect(await screen.findByDisplayValue('Setup')).toBeInTheDocument();
  });

  it('adds an element from the palette and shows it selected in the canvas', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    fireEvent.click(screen.getByRole('button', { name: 'Cone' }));
    await waitFor(() => {
      const container = document.querySelector('[data-canvas-stage]')!;
      expect(container.querySelector('[data-item-type="cone"]')).not.toBeNull();
      expect(container.querySelector('[data-selection-outline]')).not.toBeNull();
    });
  });

  it('keeps Save disabled until a change, then calls saveDiagramSet once', async () => {
    renderPage();
    await screen.findByDisplayValue('Setup');
    const save = screen.getByRole('button', { name: /save/i });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Ball' }));
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1));
  });

  it('renders a load error instead of the editor when listDiagrams rejects', async () => {
    vi.mocked(diagramsApi.listDiagrams).mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/could not load diagrams/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/diagrams/DiagramEditorPage.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write `src/diagrams/CanvasStage.tsx`**

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGesture } from '@use-gesture/react';

interface StageApi {
  screenToCourt: (clientX: number, clientY: number) => { x: number; y: number };
}

interface Props {
  children: ReactNode;
  onReady?: (api: StageApi) => void;
}

const MIN = 0.5;
const MAX = 4;

export function CanvasStage({ children, onReady }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0, scale: 1 });

  useGesture(
    {
      onDrag: ({ delta: [dx, dy], pinching }) => {
        if (pinching) return;
        setT((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
      },
      onPinch: ({ offset: [s] }) => setT((cur) => ({ ...cur, scale: Math.max(MIN, Math.min(MAX, s)) })),
      onWheel: ({ delta: [, dy] }) => setT((s) => ({ ...s, scale: Math.max(MIN, Math.min(MAX, s.scale - dy * 0.001)) })),
    },
    { target: outerRef, eventOptions: { passive: false } },
  );

  // Publish a fresh screen→court converter whenever the transform changes.
  useEffect(() => {
    if (!onReady) return;
    onReady({
      screenToCourt: (clientX, clientY) => {
        const el = outerRef.current;
        if (!el) return { x: 50, y: 50 };
        const r = el.getBoundingClientRect();
        const side = Math.min(r.width, r.height) || 1;
        const px = (clientX - r.left - t.x) / t.scale;
        const py = (clientY - r.top - t.y) / t.scale;
        return { x: (px / side) * 100, y: (py / side) * 100 };
      },
    });
  }, [t, onReady]);

  return (
    <div ref={outerRef} data-canvas-stage className="relative h-full w-full overflow-hidden bg-bg" style={{ touchAction: 'none' }}>
      <div className="absolute inset-0" style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`, transformOrigin: '0 0' }}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `src/diagrams/DiagramEditorPage.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { DiagramSvg } from './DiagramSvg';
import { DiagramTabs } from './DiagramTabs';
import { Palette } from './Palette';
import { PropertiesPanel } from './PropertiesPanel';
import { CanvasStage } from './CanvasStage';
import { createItem } from './sceneFactory';
import { useDiagramEditor } from './useDiagramEditor';
import { SCENE_LIMITS, type DiagramItemType } from '../types/diagram';

const SNAP = 2.5;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

export function DiagramEditorPage() {
  const { exerciseId = '' } = useParams();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? '';
  const { state, activeDiagram, dispatch, save, saving, dirty, loadError, saveError } = useDiagramEditor(exerciseId, uid);
  const stageApi = useRef<{ screenToCourt: (x: number, y: number) => { x: number; y: number } } | null>(null);
  const [snapOn, setSnapOn] = useState(true);

  const handleStageReady = useCallback((api: { screenToCourt: (x: number, y: number) => { x: number; y: number } }) => {
    stageApi.current = api;
  }, []);

  // Autosave 3s after the last change.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void save(), 3000);
    return () => window.clearTimeout(timer);
  }, [state, dirty, save]);

  // Save on unmount if still dirty.
  useEffect(() => () => {
    if (dirty) void save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn on tab close while dirty.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state === 'blocked' && window.confirm('You have unsaved diagram changes. Leave anyway?')) {
      blocker.proceed();
    } else if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  const addFromPalette = useCallback(
    (type: DiagramItemType) => {
      const at = { x: 50, y: 50 };
      dispatch({ type: 'addItem', item: createItem(type, at) });
    },
    [dispatch],
  );

  const beginDrag = useCallback(
    (id: string, e: React.PointerEvent) => {
      dispatch({ type: 'selectItem', id });
      const startClient = { x: e.clientX, y: e.clientY };
      const item = activeDiagram?.scene.items.find((i) => i.id === id);
      if (!item) return;
      const origin = { x: item.x, y: item.y };
      const move = (ev: PointerEvent) => {
        const api = stageApi.current;
        if (!api) return;
        const a = api.screenToCourt(startClient.x, startClient.y);
        const b = api.screenToCourt(ev.clientX, ev.clientY);
        const nx = origin.x + (b.x - a.x);
        const ny = origin.y + (b.y - a.y);
        dispatch({ type: 'moveItem', id, x: snapOn ? snap(nx) : nx, y: snapOn ? snap(ny) : ny });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [activeDiagram, dispatch, snapOn],
  );

  if (loadError) {
    return (
      <div className="p-6">
        <p role="alert" className="text-red">{loadError}</p>
        <Link to="/exercises" className="mt-3 inline-block text-blue underline">Back to exercises</Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col bg-bg">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
        <button type="button" onClick={() => navigate('/exercises')} className="text-sm text-blue">‹ Exercises</button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-slate">
            <input type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} /> Snap
          </label>
          {saveError && <span role="alert" className="text-xs text-red">{saveError}</span>}
          <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>

      <DiagramTabs
        diagrams={state.diagrams}
        activeId={state.activeDiagramId}
        dirtyIds={state.dirtyIds}
        canAdd={state.diagrams.length < SCENE_LIMITS.diagramsPerExercise}
        dispatch={dispatch}
      />

      {activeDiagram ? (
        <div className="grid flex-1 grid-rows-[1fr_auto] overflow-hidden lg:grid-cols-[160px_1fr_260px] lg:grid-rows-1">
          <aside className="hidden border-r border-border bg-surface p-2 lg:block">
            <Palette onAdd={addFromPalette} variant="rail" />
          </aside>

          <div className="relative overflow-hidden">
            <CanvasStage onReady={handleStageReady}>
              <DiagramSvg
                scene={activeDiagram.scene}
                interactive
                selectedId={state.selectedItemId}
                onItemPointerDown={beginDrag}
                onBackgroundPointerDown={() => dispatch({ type: 'selectItem', id: null })}
              />
            </CanvasStage>
          </div>

          <aside className="border-t border-border bg-surface lg:border-l lg:border-t-0">
            <div className="lg:hidden">
              <Palette onAdd={addFromPalette} variant="grid" />
            </div>
            <PropertiesPanel
              item={activeDiagram.scene.items.find((i) => i.id === state.selectedItemId) ?? null}
              dispatch={dispatch}
            />
          </aside>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate">
          <p>No diagrams yet.</p>
          <Button variant="primary" size="sm" onClick={() => dispatch({ type: 'addDiagram' })}>Add the first diagram</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Wire the route in `src/App.tsx`**

Add the lazy import near the top:

```tsx
import { lazy, Suspense } from 'react';
const DiagramEditorPage = lazy(() =>
  import('./diagrams/DiagramEditorPage').then((m) => ({ default: m.DiagramEditorPage })),
);
```

Inside the `<Route element={<AuthenticatedLayout />}>` group, add:

```tsx
<Route
  path="/exercises/:exerciseId/diagram"
  element={
    <RequireAdmin>
      <Suspense fallback={<div className="p-6 text-slate">Loading editor…</div>}>
        <DiagramEditorPage />
      </Suspense>
    </RequireAdmin>
  }
/>
```

- [ ] **Step 7: Run the page tests to verify they pass**

Run: `npx vitest run src/diagrams/DiagramEditorPage.test.tsx`
Expected: PASS (4 tests). The test uses `createMemoryRouter` + `RouterProvider` (a data router) so `useBlocker` works. If `window.confirm` is called during a test, stub it in `beforeEach` with `vi.spyOn(window, 'confirm').mockReturnValue(true)`.

- [ ] **Step 8: Full build + unit suite + lint**

Run: `npm run build && npm test && npm run lint`
Expected: all clean. Confirm `dist` build still succeeds with the new lazy chunk.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/App.tsx src/diagrams/CanvasStage.tsx src/diagrams/DiagramEditorPage.tsx src/diagrams/DiagramEditorPage.test.tsx
git commit -m "feat: diagram editor page, canvas stage, and lazy route"
```

---

## Task 12: `DiagramThumbnail` + session cache

**Files:**
- Create: `src/diagrams/DiagramThumbnail.tsx`
- Test: `src/diagrams/DiagramThumbnail.test.tsx`

**Interfaces:**
- Consumes: `getFirstDiagram` from `./diagramsApi`; `DiagramSvg` from `./DiagramSvg`; `Diagram` from `src/types/diagram.ts`.
- Produces:
  ```ts
  export function clearDiagramThumbnailCache(): void; // test helper
  export function DiagramThumbnail(props: { exerciseId: string; className?: string }): JSX.Element | null;
  ```
  Module-level `const cache = new Map<string, Diagram | null>()`. On mount, if `cache.has(exerciseId)` render immediately from it; otherwise call `getFirstDiagram`, store the result (including `null`), and render. Renders `null` when the resolved value is `null`. The rendered element is a non-interactive `<DiagramSvg>` inside a fixed-aspect wrapper (`className` merged).

- [ ] **Step 1: Write the failing test `src/diagrams/DiagramThumbnail.test.tsx`**

```tsx
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramThumbnail, clearDiagramThumbnailCache } from './DiagramThumbnail';
import * as diagramsApi from './diagramsApi';

vi.mock('./diagramsApi');
vi.mock('../firebase/config', () => ({ db: {} }));

const diagram = {
  id: 'd1', title: 'Setup', order: 0, updatedBy: 'x', updatedAt: null,
  scene: { v: 1 as const, court: 'full' as const, showZones: false, items: [] },
};

describe('DiagramThumbnail', () => {
  beforeEach(() => {
    clearDiagramThumbnailCache();
    vi.clearAllMocks();
  });

  it('fetches and renders an svg when a diagram exists', async () => {
    vi.mocked(diagramsApi.getFirstDiagram).mockResolvedValue(diagram);
    const { container } = render(<DiagramThumbnail exerciseId="ex-1" />);
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
  });

  it('renders nothing when the exercise has no diagram', async () => {
    vi.mocked(diagramsApi.getFirstDiagram).mockResolvedValue(null);
    const { container } = render(<DiagramThumbnail exerciseId="ex-2" />);
    await waitFor(() => expect(diagramsApi.getFirstDiagram).toHaveBeenCalled());
    expect(container.querySelector('svg')).toBeNull();
  });

  it('serves a second mount for the same exercise from cache (no refetch)', async () => {
    vi.mocked(diagramsApi.getFirstDiagram).mockResolvedValue(diagram);
    const first = render(<DiagramThumbnail exerciseId="ex-1" />);
    await waitFor(() => expect(first.container.querySelector('svg')).not.toBeNull());
    first.unmount();
    render(<DiagramThumbnail exerciseId="ex-1" />);
    expect(diagramsApi.getFirstDiagram).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/diagrams/DiagramThumbnail.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/diagrams/DiagramThumbnail.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { getFirstDiagram } from './diagramsApi';
import { DiagramSvg } from './DiagramSvg';
import type { Diagram } from '../types/diagram';

const cache = new Map<string, Diagram | null>();

export function clearDiagramThumbnailCache() {
  cache.clear();
}

export function DiagramThumbnail({ exerciseId, className }: { exerciseId: string; className?: string }) {
  const [diagram, setDiagram] = useState<Diagram | null | undefined>(
    cache.has(exerciseId) ? cache.get(exerciseId) : undefined,
  );

  useEffect(() => {
    if (cache.has(exerciseId)) {
      setDiagram(cache.get(exerciseId) ?? null);
      return;
    }
    let cancelled = false;
    getFirstDiagram(exerciseId)
      .then((d) => {
        cache.set(exerciseId, d);
        if (!cancelled) setDiagram(d);
      })
      .catch(() => {
        if (!cancelled) setDiagram(null);
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  if (!diagram) return null;

  return (
    <div className={className ?? 'aspect-square w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-surface'}>
      <DiagramSvg scene={diagram.scene} />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/diagrams/DiagramThumbnail.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/diagrams/DiagramThumbnail.tsx src/diagrams/DiagramThumbnail.test.tsx
git commit -m "feat: DiagramThumbnail with per-session cache"
```

---

## Task 13: Read-only surfaces — exercise detail strip, lightbox, list & training thumbnails

**Files:**
- Create: `src/diagrams/DiagramLightbox.tsx`
- Create: `src/diagrams/DiagramLightbox.test.tsx`
- Modify: `src/exercises/ExerciseFormDialog.tsx`
- Modify: `src/exercises/ExerciseFormDialog.test.tsx`
- Modify: `src/exercises/ExercisesPage.tsx`
- Modify: `src/trainings/TrainingBuilderDialog.tsx`

**Interfaces:**
- Consumes: `listDiagrams` from `../diagrams/diagramsApi`; `DiagramSvg` from `../diagrams/DiagramSvg`; `DiagramThumbnail` from `../diagrams/DiagramThumbnail`; `useNavigate` from `react-router-dom`; `Diagram` from `../types/diagram`.
- Produces:
  - `DiagramLightbox({ diagrams, startIndex, onClose }: { diagrams: Diagram[]; startIndex: number; onClose: () => void }): JSX.Element` — a fixed overlay showing one `<DiagramSvg>` full size with `‹`/`›` (wrapping) and its `title`; `Esc` and a close button call `onClose`.
  - `ExerciseFormDialog` (edit mode only, i.e. `exercise` prop present): an **"Edit diagrams"** `Button` that calls `navigate(`/exercises/${exercise.id}/diagram`)`, and a **diagram strip** — on open, `listDiagrams(exercise.id)` populates a row of clickable thumbnails (`<DiagramSvg>` in a small box + `title`); clicking opens `<DiagramLightbox>` at that index. No diagrams → no strip. Fetch failure → the strip is silently omitted (non-critical).
  - `ExercisesPage`: each row gets a leading `<DiagramThumbnail exerciseId={exercise.id} />` before the name button.
  - `TrainingBuilderDialog`: each exercise row in the ordered list renders a small `<DiagramThumbnail exerciseId={row.exerciseId} />` before the name.

- [ ] **Step 1: Write the failing test `src/diagrams/DiagramLightbox.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagramLightbox } from './DiagramLightbox';
import type { Diagram } from '../types/diagram';

const mk = (id: string, title: string): Diagram => ({
  id, title, order: 0, updatedBy: 'x', updatedAt: null,
  scene: { v: 1, court: 'full', showZones: false, items: [] },
});

const diagrams = [mk('d1', 'Setup'), mk('d2', 'Phase 1')];

it('shows the start diagram and steps forward with wrap', () => {
  render(<DiagramLightbox diagrams={diagrams} startIndex={0} onClose={vi.fn()} />);
  expect(screen.getByText('Setup')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(screen.getByText('Phase 1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(screen.getByText('Setup')).toBeInTheDocument();
});

it('closes on the close button and on Escape', () => {
  const onClose = vi.fn();
  render(<DiagramLightbox diagrams={diagrams} startIndex={0} onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: /close/i }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/diagrams/DiagramLightbox.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/diagrams/DiagramLightbox.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { DiagramSvg } from './DiagramSvg';
import type { Diagram } from '../types/diagram';

interface Props {
  diagrams: Diagram[];
  startIndex: number;
  onClose: () => void;
}

export function DiagramLightbox({ diagrams, startIndex, onClose }: Props) {
  const [i, setI] = useState(startIndex);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((n) => (n + 1) % diagrams.length);
      if (e.key === 'ArrowLeft') setI((n) => (n - 1 + diagrams.length) % diagrams.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [diagrams.length, onClose]);

  const current = diagrams[i];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-3xl items-center justify-between text-white">
        <span className="font-medium">{current.title}</span>
        <button type="button" aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></button>
      </div>
      <div className="my-3 w-full max-w-3xl rounded-lg bg-surface p-4">
        <DiagramSvg scene={current.scene} />
      </div>
      {diagrams.length > 1 && (
        <div className="flex gap-4 text-white">
          <button type="button" aria-label="Previous diagram" onClick={() => setI((n) => (n - 1 + diagrams.length) % diagrams.length)}>‹ Prev</button>
          <button type="button" aria-label="Next diagram" onClick={() => setI((n) => (n + 1) % diagrams.length)}>Next ›</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the lightbox test to verify it passes**

Run: `npx vitest run src/diagrams/DiagramLightbox.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the failing `ExerciseFormDialog` test**

In `src/exercises/ExerciseFormDialog.test.tsx`, add `vi.mock('../diagrams/diagramsApi')` at the top with the other mocks, wrap renders in a `MemoryRouter` (import from `react-router-dom`), and add:

```tsx
it('shows an Edit diagrams button and a diagram strip in edit mode', async () => {
  vi.mocked(useAuth).mockReturnValue({ firebaseUser: null, appUser: null, loading: false, authError: null });
  const diagramsApi = await import('../diagrams/diagramsApi');
  vi.spyOn(diagramsApi, 'listDiagrams').mockResolvedValue([
    { id: 'd1', title: 'Setup', order: 0, updatedBy: 'x', updatedAt: null, scene: { v: 1, court: 'full', showZones: false, items: [] } },
  ]);

  render(
    <MemoryRouter>
      <ExerciseFormDialog
        exercise={{ id: 'ex-1', name: 'Pepper', description: '', category: 'warmup', createdBy: 'x', createdAt: null }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole('button', { name: /edit diagrams/i })).toBeInTheDocument();
  expect(await screen.findByText('Setup')).toBeInTheDocument();
});

it('does not show Edit diagrams when creating a new exercise', () => {
  vi.mocked(useAuth).mockReturnValue({ firebaseUser: { uid: 'u' } as never, appUser: null, loading: false, authError: null });
  render(<MemoryRouter><ExerciseFormDialog onClose={vi.fn()} onSaved={vi.fn()} /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: /edit diagrams/i })).not.toBeInTheDocument();
});
```

Update the three existing `render(<ExerciseFormDialog … />)` calls in that file to be wrapped in `<MemoryRouter>…</MemoryRouter>`.

- [ ] **Step 6: Run the dialog test to verify the new cases fail**

Run: `npx vitest run src/exercises/ExerciseFormDialog.test.tsx`
Expected: the two new tests FAIL (no button / no strip yet); the existing tests still pass with the router wrapper.

- [ ] **Step 7: Implement the strip + button in `src/exercises/ExerciseFormDialog.tsx`**

Add imports:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { listDiagrams } from '../diagrams/diagramsApi';
import { DiagramSvg } from '../diagrams/DiagramSvg';
import { DiagramLightbox } from '../diagrams/DiagramLightbox';
import type { Diagram } from '../types/diagram';
```

Inside the component, after the existing `useState` hooks:

```tsx
const navigate = useNavigate();
const [diagrams, setDiagrams] = useState<Diagram[]>([]);
const [lightbox, setLightbox] = useState<number | null>(null);

useEffect(() => {
  if (!exercise) return;
  listDiagrams(exercise.id).then(setDiagrams).catch(() => setDiagrams([]));
}, [exercise]);
```

In the JSX, directly above the error `<p>` / action buttons row, add:

```tsx
{exercise && (
  <div className="mt-4">
    <div className="mb-1 flex items-center justify-between">
      <span className="text-sm font-medium text-ink">Diagrams</span>
      <Button variant="secondary" size="sm" onClick={() => navigate(`/exercises/${exercise.id}/diagram`)}>
        Edit diagrams
      </Button>
    </div>
    {diagrams.length > 0 && (
      <div className="flex gap-2 overflow-x-auto">
        {diagrams.map((d, idx) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setLightbox(idx)}
            className="shrink-0"
            aria-label={`Open diagram ${d.title}`}
          >
            <span className="block aspect-square w-20 overflow-hidden rounded-sm border border-border bg-bg">
              <DiagramSvg scene={d.scene} />
            </span>
            <span className="mt-0.5 block max-w-20 truncate text-xs text-slate">{d.title}</span>
          </button>
        ))}
      </div>
    )}
  </div>
)}

{lightbox !== null && (
  <DiagramLightbox diagrams={diagrams} startIndex={lightbox} onClose={() => setLightbox(null)} />
)}
```

- [ ] **Step 8: Add `DiagramThumbnail` to the exercises list**

In `src/exercises/ExercisesPage.tsx`, import `DiagramThumbnail` from `../diagrams/DiagramThumbnail`. In the row `<div key={exercise.id} className="flex items-start justify-between gap-4 p-4">`, add as the first child inside a new flex wrapper:

```tsx
<div className="flex items-start gap-3">
  <DiagramThumbnail exerciseId={exercise.id} />
  <button type="button" onClick={() => setDialog({ mode: 'edit', exercise })} className="text-left">
    {/* …existing name/category/description markup… */}
  </button>
</div>
```

Keep the existing Delete button as the row's trailing element.

- [ ] **Step 9: Add `DiagramThumbnail` to the training builder**

In `src/trainings/TrainingBuilderDialog.tsx`, import `DiagramThumbnail`. In the exercise-row `<li>` (around line 165, `key={`${row.exerciseId}-${i}`}`), add `<DiagramThumbnail exerciseId={row.exerciseId} className="aspect-square w-10 shrink-0 overflow-hidden rounded-sm border border-border" />` as the first child, before the name span.

- [ ] **Step 10: Run all affected tests**

Run: `npx vitest run src/exercises src/trainings src/diagrams`
Expected: PASS. Fix any router-context failures by wrapping renders in `<MemoryRouter>` in the touched test files.

- [ ] **Step 11: Full verification**

Run: `npm run build && npm test && npm run lint`
Expected: all clean.

- [ ] **Step 12: Run the rules suite once more**

Run: `npm run test:rules`
Expected: PASS (no rules changes since Task 1, but confirm nothing regressed).

- [ ] **Step 13: Commit**

```bash
git add src/diagrams/DiagramLightbox.tsx src/diagrams/DiagramLightbox.test.tsx src/exercises/ExerciseFormDialog.tsx src/exercises/ExerciseFormDialog.test.tsx src/exercises/ExercisesPage.tsx src/trainings/TrainingBuilderDialog.tsx
git commit -m "feat: surface diagrams in exercise detail, library list, and trainings"
```

---

## Task 14: Manual smoke test against the emulator + docs

**Files:**
- Modify: `CLAUDE.md` (add a one-line pointer to the diagrams feature, if the "What this is" list enumerates features)
- No source changes expected; this task is verification.

- [ ] **Step 1: Boot the emulator stack**

Run: `npm run dev:emulator`
Then open the app, sign in as the seeded admin (copy the sign-in link from the Auth emulator console).

- [ ] **Step 2: Exercise the editor**

1. Go to `/exercises`, open an exercise, click **Edit diagrams**.
2. Add a diagram; drop a `player`, set its role to `S` and colour to `blue`; drop a `ball`, a `cone`, an `arrow`; drag the arrow endpoints.
3. Switch court preset to `half`, toggle zones on.
4. Add a second diagram named `Phase 1`; reorder the tabs.
5. Wait 3 s — confirm autosave fires (Save button returns to disabled). Reload the page — confirm both diagrams and all items persist.
6. Delete an element; delete the second diagram; reload — confirm the deletions stuck.
7. Navigate away with unsaved changes — confirm the "unsaved changes" prompt.

- [ ] **Step 3: Verify read-only surfaces**

1. Exercise modal shows the diagram strip; clicking a thumbnail opens the lightbox with prev/next.
2. `/exercises` list rows show the first-diagram thumbnail.
3. Open a training that includes this exercise — its row shows the thumbnail.

- [ ] **Step 4: Verify the security boundary manually (optional)**

In the Emulator UI, confirm `exercises/{id}/diagrams/{id}` docs exist with `title`, `order`, `scene`, `updatedBy`, `updatedAt`.

- [ ] **Step 5: Update docs and commit**

If `CLAUDE.md` enumerates features, add diagrams to the list. Then:

```bash
git add CLAUDE.md
git commit -m "docs: note the exercise diagrams feature"
```

If no doc change is needed, skip the commit and mark the task complete.

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| §2 full canvas editor, hand-rolled + `@use-gesture/react` | 10, 11 |
| §2 ordered named diagrams per exercise | 9 (reducer), 10 (tabs) |
| §2 dedicated lazy `RequireAdmin` route | 11 |
| §2 subcollection storage | 1, 5 |
| §2 one renderer | 8 |
| §2 palette colours only | 2 (`tokenColor`), 10 (`PropertiesPanel` swatches) |
| §2 admin only (read + write) | 1 |
| §4.1 Firestore shape | 5, 1 |
| §4.2 Scene / §4.3 DiagramItem union | 2 |
| §4.4 caps | 3 (`parseScene`), 1 (rules), 9 (`addDiagram`/`addItem` guards) |
| §4.5 coordinate system | 7 (`CourtBackdrop`), 8 (`viewBox`) |
| §5 `DiagramSvg` (pure, 3 passes, selection layer, defs) | 8 |
| §5 primitive-per-type | 7 |
| §6.1 route + "Edit diagrams" entry points | 11, 13 |
| §6.2 responsive layout | 11 |
| §6.3 editor state + actions | 9 |
| §6.4 save flow (explicit Save, 3s autosave, unmount save, nav blocker, `beforeunload`, validate-before-write) | 9 (`save`, `buildSaveOps`), 11 (autosave/blocker), 5 (`saveDiagramSet` validation) |
| §7.1 `diagramsApi` (`listDiagrams`, `getFirstDiagram`, `saveDiagramSet`) | 5 |
| §7.1 cascade delete | 6 |
| §7.2 rules | 1 |
| §7.3 no index | Global Constraints + Task 5 note |
| §8 exercise-detail strip + lightbox | 13 |
| §8 `/exercises` list thumbnails | 12, 13 |
| §8 trainings thumbnails | 13 |
| §8 future SVG-string export | intentionally not built — renderer kept pure (Task 8) so it remains a drop-in |
| §10 rules tests | 1 |
| §10 pure unit tests (`parseScene`, `tokenColor`, reducer, `saveDiagramSet`) | 2, 3, 5, 9 |
| §10 component tests (`DiagramEditorPage`, `DiagramSvg`, `DiagramThumbnail`) | 8, 11, 12 |
| §11 limitations | inherent — no tasks needed |

No gaps.

**2. Placeholder scan**

No "TBD"/"TODO"/"handle edge cases"/"similar to Task N". Every code step carries full source. Every test step carries runnable test code.

**3. Type consistency**

- `Scene`, `DiagramItem`, `PaletteColor`, `CourtPreset`, `SCENE_LIMITS`, `PALETTE_COLORS` defined once in Task 2, imported everywhere.
- `parseScene` → `ParseSceneResult` (Task 3), consumed by Task 5 (`saveDiagramSet`) and Task 4 test.
- `emptyScene` / `createItem` / `newId` (Task 4) — signatures match every call site (Tasks 7, 8, 9, 11 tests).
- `DiagramSaveOps` defined in Task 5, imported by Task 9 (`buildSaveOps` return type).
- `EditorState` / `EditorAction` / `EditorDiagram` / `diagramReducer` / `buildSaveOps` / `useDiagramEditor` (Task 9) — consumed by Tasks 10 (`dispatch` prop type), 11 (page).
- `renderItem` (Task 7) consumed by `DiagramSvg` (Task 8).
- `getFirstDiagram` (Task 5) consumed by `DiagramThumbnail` (Task 12).
- `listDiagrams` (Task 5) consumed by `useDiagramEditor` (Task 9) and `ExerciseFormDialog` (Task 13).
- `DiagramThumbnail` prop `{ exerciseId, className? }` — same at all call sites (Tasks 13).
- `DiagramLightbox` prop `{ diagrams, startIndex, onClose }` — same in Task 13 test and `ExerciseFormDialog` usage.
- Action payload shapes in `PropertiesPanel`/`DiagramTabs` (`{ type: 'setItemProp', id, patch }`, `{ type: 'renameDiagram', id, title }`, etc.) match the `EditorAction` union exactly.

Consistent throughout.

---

## Execution Handoff

Choose how to execute:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, two-stage review between tasks.
2. **Inline Execution** — batch the tasks in this session with review checkpoints via `superpowers:executing-plans`.
