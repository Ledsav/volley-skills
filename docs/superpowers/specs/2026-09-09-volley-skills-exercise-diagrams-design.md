# Volley Skills — Exercise Diagrams Design Spec

Date: 2026-09-09
Status: Approved for planning

## 1. Purpose

Give admins a **court-diagram builder** so each exercise can carry one or more
illustrations (setup, phases, rotations) drawn from a fixed palette of volleyball
primitives — court, net, poles, players (with a role label and colour), balls,
cones, ladders, lines, arrows, text. Diagrams are authored on a full-screen
canvas editor, stored as a small **JSON scene** per diagram, and rendered to
**SVG** on demand everywhere they appear (editor, exercise detail, library lists,
trainings). No Cloud Storage, no server rendering — the JSON lives in Firestore
and the renderer is a pure client component.

Driving use cases:

- **Explaining a drill** — a coach opening an exercise sees the court setup at a
  glance instead of parsing a paragraph.
- **Phased drills** — "Setup / Phase 1 / Phase 2" as an ordered set of static
  diagrams on one exercise.
- **Consistent look** — every illustration uses the club's design-system palette,
  so the library reads as one document.

## 2. Scope Decisions

- **Full drag-and-drop canvas editor.** Palette → drop → drag to position →
  select → edit properties. Not a form/list editor and not a raw-JSON editor.
- **Hand-rolled React + SVG.** The canvas *is* an `<svg>`; each primitive is a
  small React component. One dependency added — `@use-gesture/react` (~5 KB) —
  for drag / pinch ergonomics only. No `tldraw`, `konva`, `fabric`, or similar.
- **Ordered set of named static diagrams per exercise.** `0..N` diagrams, each
  with a `title` and an `order`. Each diagram is a still illustration. No
  animation, no keyframes, no timeline.
- **Dedicated full-page route** — `/exercises/:exerciseId/diagram`, lazy-loaded,
  `RequireAdmin`. Chosen for mobile: it owns the viewport, the browser back
  button leaves the editor for free, and the editor bundle is code-split off
  every other page. The exercise's name/description/category stay in the
  existing `ExerciseFormDialog`.
- **Subcollection storage** — `exercises/{exerciseId}/diagrams/{diagramId}`. The
  exercise doc is untouched, so `/exercises` list reads stay lean.
- **One renderer** — a pure `<DiagramSvg scene interactive={false} />` serves the
  editor canvas, detail view, list thumbnails, training views, and (future)
  string serialization for PDF export. Only `interactive` differs.
- **Design-system palette only.** Element colours are picked from
  `navy | blue | orange | green | red | ink` swatches — no arbitrary hex.
- **Admin only.** Same gate as the rest of `/exercises`. Viewers never reach the
  editor, and diagram *reads* mirror the parent `exercises` read rule, which is
  `isAdmin()` today — so diagrams are admin-only end to end until exercise access
  is broadened.

### Out of scope

- Animation / movement playback / keyframes.
- Freeform pen drawing or arbitrary SVG paths.
- Uploading raster images or importing external diagram formats.
- A shared, reusable "saved assets / templates" library across exercises. The
  palette is a fixed set of primitives; there is no user-defined component.
- Server-side or build-time rendering; PDF/print export (the renderer is kept
  pure so this is a later addition, not built here).
- Bulk import of diagrams (the JSON bulk-import feature is not extended).
- Real-time collaborative editing.

## 3. Architecture

New feature folder `src/diagrams/` owns everything. Touch points in existing
code are small and listed in §9.

```
src/diagrams/
  DiagramEditorPage.tsx        the /exercises/:exerciseId/diagram route (React.lazy)
  DiagramEditorPage.test.tsx
  useDiagramEditor.ts          useReducer + hook: all editor state and actions
  useDiagramEditor.test.ts
  diagramsApi.ts               all Firestore reads/writes for the subcollection
  diagramsApi.test.ts
  parseScene.ts                pure: unknown -> Scene | error, with repair/clamp
  parseScene.test.ts
  tokenColor.ts                palette-name -> CSS colour string
  tokenColor.test.ts
  DiagramSvg.tsx               the pure renderer (court + items [+ selection])
  DiagramSvg.test.tsx
  Palette.tsx                  primitive buttons / add-grid
  PropertiesPanel.tsx          selected-item field editor
  DiagramTabs.tsx              diagram title tabs (add / rename / reorder / delete)
  DiagramThumbnail.tsx         lazy-fetch first diagram + render a small DiagramSvg
  primitives/
    CourtBackdrop.tsx  PlayerToken.tsx  Ball.tsx  Cone.tsx  Ladder.tsx
    Net.tsx  Pole.tsx  Line.tsx  Arrow.tsx  TextLabel.tsx  ZoneLabel.tsx

src/types/diagram.ts           Scene, DiagramItem union, Diagram doc type
tests/rules/diagrams.test.ts   security-rules coverage
```

### 3.1 Responsibilities

- **`parseScene(input)`** — pure, hand-written type guards (same style as
  `src/bulkImport/parseJsonArray.ts`, no new dep). Returns
  `{ ok: true, scene: Scene }` or `{ ok: false, error: string }`. Tolerant on
  read: drops items with an unknown `type`, clamps out-of-range numbers
  (`x`, `y`, `size`, `rotation`, `fontSize`, `rungs`), truncates over-long
  strings (`title` handled by the caller, `label`, `text.content`), enforces the
  §4.4 caps. Strict enough that a returned `Scene` always satisfies the schema.
  Called on every load and before every write.

- **`tokenColor(name)`** — maps a palette name to the CSS string
  `rgb(var(--color-<name>))` (e.g. `blue` → `rgb(var(--color-blue))`). Because
  CSS custom properties cascade into inline SVG, `fill`/`stroke` using these
  repaint automatically when the `dark` class toggles. Unknown / missing name
  falls back to `ink`. Alpha variants (`ink` at 40% for zone labels, 60% for
  ladders) are produced with `rgb(var(--color-ink) / 0.4)`.

- **`DiagramSvg`** — pure render, no fetching, no context. See §5.

- **`useDiagramEditor(exerciseId)`** — the editor's entire state machine. See §6.

- **`diagramsApi.ts`** — the only place `firebase/firestore` is imported for this
  feature. See §7. Returns plain typed objects (`{ id, ...data } as Diagram`),
  writes use `serverTimestamp()`, and mutating calls are wrapped in
  `withBackoff` (matching `exercisesApi.ts`).

- **`DiagramThumbnail({ exerciseId })`** — used in list rows. Lazily fetches the
  `order: 0` diagram for that exercise via one `limit(1)` query, caches the
  result in a module-level `Map<exerciseId, Diagram | null>`, and renders a small
  static `<DiagramSvg>` (or nothing if the exercise has no diagrams).

## 4. Data model

### 4.1 Firestore shape

```
exercises/{exerciseId}/diagrams/{diagramId}
  title       string, 1–40 chars
  order       integer ≥ 0            — tab order; not required contiguous
  scene       Scene                  — see §4.2
  updatedBy   uid
  updatedAt   serverTimestamp
```

`diagramId` is a Firestore auto-ID. There is no counter and no `businessId`.

### 4.2 Scene

```jsonc
{
  "v": 1,                     // schema version
  "court": "full",            // "full" | "half" | "blank"
  "showZones": false,         // draw zone 1–6 labels on the court
  "items": [ DiagramItem, ... ]
}
```

### 4.3 DiagramItem

Discriminated union on `type`. **Common fields** on every item:

| Field | Type | Rule |
|---|---|---|
| `id` | string | 4–12 chars, unique within the scene. Generated `crypto.randomUUID().slice(0, 8)` |
| `type` | string | one of the ten below |
| `x`, `y` | number | court coordinates, see §4.5. May fall outside 0–100 |
| `rotation` | number | degrees, `-180`..`180`; `0` where rotation is meaningless |
| `size` | number | multiplier `0.5`..`2` on the type's base dimension |
| `color` | string | one of `navy \| blue \| orange \| green \| red \| ink` |

**Type-specific fields:**

| `type` | Extra fields | Notes |
|---|---|---|
| `player` | `label` string 0–3 chars; `shape` `"circle" \| "square"` | `label` is the role text ("S", "OH", "6", "MB") |
| `ball` | — | `rotation` ignored in UI |
| `cone` | — | |
| `ladder` | `rungs` int 3–10; `length` number 5–40 (court units) | drawn along the item's local x-axis, rotated by `rotation` |
| `net` | `length` number 5–60 | standalone net (e.g. on a `blank` court); the court preset draws its own centre net independently |
| `pole` | — | |
| `line` | `points` array of `{x,y}`, length 2–12; `style` `"solid" \| "dashed"`; `thickness` number 1–4 | drags as a whole shape (all points shift together); per-endpoint editing deferred (§11) |
| `arrow` | `from` `{x,y}`; `to` `{x,y}`; `curved` bool; `style` `"pass" \| "shot" \| "run"`; `head` `"single" \| "double"` | `pass` solid, `shot` heavy solid, `run` dashed; `curved` renders a quadratic curve with an auto control point |
| `text` | `content` string 1–60 chars; `fontSize` number 2–8 (court units) | free-floating label |
| `zoneLabel` | `zone` int 1–6 | a movable "1".."6" marker, distinct from `scene.showZones` |

`parseScene` rejects an item missing a required type-specific field; it clamps
numeric ranges and truncates strings rather than rejecting.

### 4.4 Caps

Enforced in `parseScene` (client) and lightly in rules (§7.2):

| Limit | Value |
|---|---|
| diagrams per exercise | 12 |
| items per scene | 60 |
| `title` length | 40 |
| `player.label` length | 3 |
| `text.content` length | 60 |
| `line.points` length | 12 |

A full 60-item scene serializes to roughly 8 KB; twelve of them is one small
subcollection, far under the 1 MB Firestore document limit even individually.

### 4.5 Coordinate system

- `x` runs 0–100 along the court's **long** axis, `y` 0–100 across the **short**
  axis. Origin top-left.
- The renderer emits `<svg viewBox="0 0 100 100">` and positions the court inside
  it per preset: `full` = full 9 m × 18 m proportion letterboxed into the 100×100
  box; `half` = 9 m × 9 m; `blank` = no court drawn. The 0–100 space is constant
  regardless of preset, so switching preset never moves items.
- Items are **not** clipped to 0–100 — benches, off-court cones, and staging
  areas are legal.
- `size`, `length`, `fontSize`, `thickness` are all in these court units (or a
  multiplier of a unit-defined base), so a scene renders identically at any
  pixel size.

## 5. The renderer — `DiagramSvg`

```tsx
interface DiagramSvgProps {
  scene: Scene;
  interactive?: boolean;          // default false
  selectedId?: string | null;     // editor only
  onItemPointerDown?: (id: string, e: React.PointerEvent) => void;   // editor only
  onBackgroundPointerDown?: (e: React.PointerEvent) => void;         // editor only
}
```

- Returns a single `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">`.
- **Three render passes:**
  1. `<CourtBackdrop court={scene.court} showZones={scene.showZones} />` — lines,
     centre net, attack lines, optional faint zone numbers. Non-interactive,
     `pointer-events: none`.
  2. `scene.items` mapped in array order (**array index = z-order**) to one
     primitive component each. In interactive mode each primitive's root element
     gets `onPointerDown={e => onItemPointerDown(item.id, e)}`.
  3. When `interactive && selectedId`: a selection outline around the selected
     item's bounding box plus **one** combined rotate/resize handle at a corner.
     Line/arrow selection instead shows endpoint markers (not individually
     draggable yet — see §11).
- **Pure.** No `useEffect`, no data access, no router, no auth. Safe to render
  many times on a page (list thumbnails) and safe for a future
  `renderToStaticMarkup` string export.
- Colours resolve through `tokenColor`; fonts inherit `Inter`. Text uses `<text>`
  with a fixed user-unit `font-size` (no wrapping).
- One primitive component per type in `src/diagrams/primitives/`, each taking its
  fully-typed item and returning an SVG fragment.

## 6. The editor

### 6.1 Route and entry points

- Route `/exercises/:exerciseId/diagram` in `src/App.tsx`, inside the existing
  `RequireAdmin` group, `element={<Suspense><DiagramEditorPage/></Suspense>}`
  with `DiagramEditorPage` behind `React.lazy`.
- **"Edit diagrams"** button in `ExerciseFormDialog` (edit mode) and on the
  exercise list row → navigates to the route.
- Header of the editor page: `‹ Back` to `/exercises`, exercise name (read-only),
  a **Save** button (§6.4), and a dirty indicator.

### 6.2 Responsive layout (one component tree, CSS-driven)

| Region | Desktop ≥1024px | Phone |
|---|---|---|
| Diagram tabs | row above the canvas | horizontal-scroll chips, top |
| Palette | left rail of primitive buttons | `+ Add` button → bottom-sheet grid |
| Canvas | centre, fills available space | full-bleed; pinch-zoom / drag-pan |
| Properties | right rail, always visible | bottom sheet, slides up on selection |
| Item actions (delete, nudge, forward/back) | in the properties rail | in the properties sheet + a compact bottom toolbar |

- Touch targets ≥ 44 px. Tap a palette primitive → inserted at the current
  viewport centre in court coordinates and selected. Tap empty canvas →
  deselect.
- Canvas pan/zoom is a transform wrapper around `<DiagramSvg>`; `@use-gesture/react`
  supplies drag, pinch, and wheel handlers. Zoom clamped ~0.5×–4×.
- **Snap-to-grid** toggle (default on), grid = 2.5 court units, applied on drag
  end and on nudge.
- Dragging a token dispatches `translateItem` (a per-move `{dx,dy}` delta, snapped
  to the grid when Snap is on); dragging the transform handle dispatches
  `transformItem` (rotation + size together). A line/arrow drags as a whole
  (every point / `from`+`to` shift by the same delta) — per-endpoint handle
  dragging is a documented deferral (see §11).

### 6.3 State — `useDiagramEditor`

`useReducer`; no external store. State:

```ts
interface EditorState {
  diagrams: Diagram[];          // sorted by order
  activeDiagramId: string | null;
  selectedItemId: string | null;
  dirtyIds: Set<string>;        // diagram ids with unsaved changes ("new:*" for unsaved-new)
  deletedIds: string[];         // persisted diagrams removed this session
  undo: Scene[];                // snapshots of the active scene, cap 30
  redo: Scene[];
}
```

Actions: `loadDiagrams`, `selectDiagram`, `addDiagram`, `renameDiagram`,
`reorderDiagram`, `deleteDiagram`, `selectItem`, `addItem`, `moveItem`,
`transformItem`, `setItemProp`, `deleteItem`, `reorderItem` (z-order:
forward/back/front/back), `undo`, `redo`, `markSaved`.

- Every mutating item/scene action pushes the pre-mutation active scene onto
  `undo` (cap 30, drop oldest) and clears `redo`.
- Any scene mutation adds the active diagram's id to `dirtyIds`.
- `deleteDiagram` on a persisted diagram moves its id to `deletedIds`; on an
  unsaved-new one just drops it.

### 6.4 Save flow

- **Explicit Save** button, enabled when `dirtyIds` is non-empty or `deletedIds`
  is non-empty.
- **Autosave** on a 3 s debounce after the last change, and on route-leave.
- Route-leave while dirty: a React Router navigation blocker prompt
  ("You have unsaved changes"); `beforeunload` guard for tab close.
- On save, `diagramsApi.saveDiagramSet(exerciseId, ops, uid)` where `ops` is
  `{ creates: {tempId, title, order, scene}[], updates: {id, title, order, scene}[], deletes: string[] }`:
  1. Every `scene` in `creates` + `updates` is run through `parseScene`. If any
     fails, the whole save aborts with a message naming the diagram — nothing is
     written.
  2. A single `writeBatch`: `set` on fresh `doc(collection(...))` refs for
     creates, `update` for updates (with `updatedBy`, `updatedAt`), `delete` for
     deletes. ≤ 12 diagrams → ≤ 12 writes, well under the 500 cap.
  3. `withBackoff(() => batch.commit())`.
  4. On success the hook maps `tempId`→ real id, clears `dirtyIds` / `deletedIds`.
  5. On failure: a toast, `dirtyIds` / `deletedIds` retained, user stays on the
     page.

## 7. Data access, rules, indexes

### 7.1 `diagramsApi.ts`

```ts
listDiagrams(exerciseId: string): Promise<Diagram[]>
  // query(collection(db,'exercises',exerciseId,'diagrams'), orderBy('order'), limit(12))
  // bounded; no cursor — 12 is the hard cap

getFirstDiagram(exerciseId: string): Promise<Diagram | null>
  // orderBy('order'), limit(1) — for DiagramThumbnail

saveDiagramSet(exerciseId: string, ops: DiagramSaveOps, uid: string): Promise<{ idMap: Record<string,string> }>
  // one writeBatch (creates + updates + deletes), wrapped in withBackoff
  // throws before commit if any scene fails parseScene
```

`deleteExercise` in `src/exercises/exercisesApi.ts` gains a cascade: call
`listDiagrams`, add each `delete` to the existing delete path (batch). A
half-failed cascade leaves an orphan subcollection, which is harmless and can be
swept by a future maintenance script — noted, not guarded.

### 7.2 `firestore.rules`

A nested `match` **inside** the existing `match /exercises/{exerciseId} { … }`
block (its closing brace moves down to enclose this). There is no `isSignedIn()`
helper in `firestore.rules` — the file uses `isAdmin()` and inline
`request.auth != null`.

```
match /exercises/{exerciseId} {
  // ... existing exercise read/create/update/delete rules ...

  match /diagrams/{diagramId} {
    allow read: if isAdmin();                 // mirrors the current exercises read rule
    allow create, update: if isAdmin()
      && request.resource.data.title is string
      && request.resource.data.title.size() >= 1
      && request.resource.data.title.size() <= 40
      && request.resource.data.order is int
      && request.resource.data.scene.v == 1
      && request.resource.data.scene.court in ['full', 'half', 'blank']
      && request.resource.data.scene.items.size() <= 60;
    allow delete: if isAdmin();
  }
}
```

Deep per-item validation stays in `parseScene` on the client — rules enforce the
boundary (who can write) and the coarse caps (title length, version, item
count), consistent with how the app design spec treats rules. `read` uses the
same `isAdmin()` predicate as the parent `exercises` collection, so if exercise
read access is later broadened this rule is updated alongside it.

### 7.3 Indexes

None. `listDiagrams` / `getFirstDiagram` are a single-field `order` sort within
one subcollection, covered by Firestore's automatic single-field index. No
`firestore.indexes.json` change. (Called out explicitly because CLAUDE.md
requires a matching index for every new query — here the correct answer is
none.)

## 8. Read-only surfaces

`<DiagramSvg interactive={false} />` also renders here:

- **Exercise modal / detail (`ExerciseFormDialog`)** — a horizontal **diagram
  strip**: one thumbnail per diagram with its `title` caption, in `order`. Tap →
  a lightbox at full size with prev/next across the set. No diagrams → strip and
  lightbox absent; the "Edit diagrams" button still shows for admins. The strip
  fetches via `listDiagrams(exerciseId)` when the modal opens.
- **`/exercises` list rows (`ExercisesPage`)** — a leading `<DiagramThumbnail>`
  showing diagram `order: 0`. Fetched lazily per visible row via
  `getFirstDiagram`, memoised in the module-level cache so paging back doesn't
  refetch. Renders nothing when the exercise has no diagram.
- **Trainings (`/trainings` builder and detail)** — each exercise in the ordered
  list shows its first-diagram `<DiagramThumbnail>` inline. Read-only.
- **Future (not built here):** `serializeDiagramToSvgString(scene)` via
  `renderToStaticMarkup(<DiagramSvg scene={scene} />)` for training PDF / print
  export. The renderer is kept free of React-DOM-only APIs so this is a drop-in
  later.

## 9. Touch points in existing code

| File | Change |
|---|---|
| `src/App.tsx` | add the lazy `/exercises/:exerciseId/diagram` route inside `RequireAdmin` |
| `src/exercises/ExerciseFormDialog.tsx` | "Edit diagrams" button (edit mode); diagram strip + lightbox |
| `src/exercises/ExercisesPage.tsx` | `<DiagramThumbnail>` in each row; "Edit diagrams" affordance on the row |
| `src/exercises/exercisesApi.ts` | `deleteExercise` cascades to the `diagrams` subcollection |
| `src/trainings/*` (builder + detail views) | `<DiagramThumbnail>` beside each listed exercise |
| `firestore.rules` | the `diagrams` match block (§7.2) |
| `package.json` | add `@use-gesture/react` |

## 10. Testing

Priority order per the app design spec §13: rules, then pure logic, then
components.

### Rules (`tests/rules/diagrams.test.ts`, `npm run test:rules`)

- admin can `create`, `update`, `delete`, and `read` a diagram under an exercise.
- signed-out, viewer, and signed-in non-admin **cannot** write or delete.
- signed-in non-admin **cannot** read (mirrors the parent `exercises` rule).
- write rejected when: `title` empty, `title` > 40 chars, `order` not an int,
  `scene.v` ≠ 1, `scene.court` not in the enum, `scene.items` length > 60.
- a valid write with a 60-item scene is accepted.

### Pure unit tests (`npm test`)

- **`parseScene`**: valid scene round-trips unchanged; unknown item `type`
  dropped; `x`/`y`/`size`/`rotation`/`fontSize`/`rungs` out of range clamped;
  over-long `label` / `text.content` truncated; item missing a required
  type-specific field → error; `items` beyond 60 → error; `points` beyond 12
  clamped; `v` ≠ 1 → error; non-object / non-array `items` → error.
- **`tokenColor`**: every palette name → `rgb(var(--color-<name>))`; unknown →
  `ink`; alpha helper form.
- **`useDiagramEditor` reducer**:
  - `addItem` inserts at end (top z-order) and selects it; `deleteItem` removes
    and clears selection.
  - `moveItem` / `transformItem` / `setItemProp` mutate only the target item.
  - `reorderItem` forward/back/front/back reorders the `items` array correctly at
    boundaries.
  - `addDiagram` / `renameDiagram` / `reorderDiagram` / `deleteDiagram` (new vs
    persisted → `deletedIds`).
  - `undo` restores the previous scene and moves it to `redo`; stack caps at 30;
    `redo` reapplies; a fresh mutation clears `redo`.
  - `dirtyIds` gains the active id on mutation and is cleared by `markSaved`.
- **`diagramsApi.saveDiagramSet`**: builds one batch with the right
  create/update/delete ops; throws before commit if a scene fails `parseScene`;
  maps temp ids to real ids on success.

### Component tests (RTL)

- **`DiagramEditorPage`**: placing a primitive from the palette adds it to the
  active scene and selects it; editing a `player` `label` in the properties panel
  updates the rendered `<text>`; delete removes it; **Save** is disabled until a
  change is made, then calls `saveDiagramSet` once with a validated set;
  switching diagram tabs swaps the canvas contents.
- **`DiagramSvg`**: renders each `court` preset without throwing; renders one
  item of every `type` without throwing; `interactive={false}` shows no selection
  handles; `interactive` + `selectedId` shows exactly one selection outline.
- **`DiagramThumbnail`**: renders an `<svg>` when `getFirstDiagram` resolves to a
  diagram; renders nothing when it resolves to `null`; hits the cache on a second
  mount for the same `exerciseId`.

No E2E. The gesture math in `@use-gesture/react` is not unit-tested directly; the
reducer actions its handlers dispatch are.

## 11. Known limitations (documented, not addressed here)

- Line/arrow endpoints are not individually draggable yet — the whole shape moves
  as a unit; per-endpoint editing is deferred.
- The properties panel does not yet expose every type-specific field
  (`text.fontSize`, `net.length`, `ladder.length`, `line.thickness`/`style`,
  `arrow.curved`/`head`, `line`/`arrow` points); those values take their
  `createItem` defaults until edited via import. Deferred.
- `Net`/`Pole` ignore `color`; `Text`/`Line`/`Arrow` ignore `size`; `ZoneLabel`
  ignores `rotation` — the panel hides or should hide those controls for those
  types. Partial.
- No animation — movement across phases is shown as separate static diagrams.
- Fine positioning on a phone relies on snap-to-grid and nudge buttons; freehand
  touch dragging is imprecise by nature.
- No shared/reusable diagram templates or saved custom assets; every diagram
  starts from the fixed palette.
- Diagram thumbnails in list/training views cost one `limit(1)` read per distinct
  exercise (cached per session).
- A `saveDiagramSet` batch that fails mid-flight writes nothing; the user
  re-presses Save (no auto-retry beyond `withBackoff`).
- `exercises`-`diagrams` cascade delete is best-effort client-side; an orphaned
  subcollection after a partial failure is harmless and swept later.
- Colours are limited to six palette tokens by design; no custom colours.
