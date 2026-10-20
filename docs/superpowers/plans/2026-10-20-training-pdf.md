# Training PDF + Player/Target-aware Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optional `minPlayers` on exercises and `suggestedPlayers`/`targets` on trainings, a builder picker that suggests by them, and a shareable PDF of a training (cover lineup + one page per exercise with vector diagrams).

**Architecture:** New fields are optional end-to-end (types → api → rules → import → UI); "not set" is field-absent, cleared via `deleteField()`. Picker suggestions are a second paged `where('category','in',targets)` query plus client-side player-fit flags. The PDF is a pure doc-definition builder fed to lazily imported `pdfmake`; diagrams are `DiagramSvg` rendered to static markup with theme CSS variables resolved to light-theme literals.

**Tech Stack:** React 18, TypeScript strict, Firestore v9 modular, Vitest + Testing Library, `@firebase/rules-unit-testing`, `pdfmake` (new dep, lazy chunk).

**Spec:** `docs/superpowers/specs/2026-10-20-volley-skills-training-pdf-design.md`

## Global Constraints

- All three new fields optional; absent ≡ not set. Never write `0`, `null`, or `[]` for them — omit on create, `deleteField()` on update.
- `minPlayers`: integer 1..30. `suggestedPlayers`: integer 1..60. `targets`: unique `ExerciseCategory[]`, length 1..9 when present.
- UI label is **"Suggested players"** (a planning suggestion, not a head count). Exercise label **"Minimum players"**.
- Old docs without the fields: no badges, no sinking, no empty chips, no PDF lines for them.
- Suggestions never hide an exercise; they only add a section, re-order within a loaded page, and badge.
- No unbounded reads; any new query uses an existing or added composite index.
- `pdfmake` must be loaded only via dynamic `import()`; must run under prod CSP (`script-src 'self' 'wasm-unsafe-eval'`, no `unsafe-eval`).
- PDF: A4 portrait, English, light colours, no club name, no player data / emails / `createdBy`.
- Errors inline with `role="alert"`; success feedback via `useNotify()`.
- TS `noUnusedLocals`/`noUnusedParameters`; tests next to code; every rules change has a rules test.

## Review Focus

1. **Clearing a number field on edit** (type 8, save, clear, save) → field is removed from the doc, not saved as `0`/`NaN`. Test in Task 1 (`trainingWrite`) and Task 4 (builder component).
2. **Non-integer / out-of-range typed values** (`0`, `-3`, `7.5`, `999`) → form shows inline error and does not save; rules reject too. Tests in Task 1 (rules) and Task 3/4 (forms).
3. **Training with a deleted exercise, and with the same exercise twice** → PDF lineup lists both slots / "Deleted exercise"; exercise pages are unique and skip deleted ones; numbering matches the lineup. Tests in Task 7.
4. **Targets set + category filter chosen** → suggested section hides, normal filtered list shows; clearing the filter brings it back. Test in Task 5.
5. **Share sheet unavailable or cancelled** → cancel is silent (button stays "Share PDF ready"), unsupported falls back to download + notice; a build error shows inline alert and the button resets. Test in Task 8.

---

### Task 1: Data model, writes, and rules for the optional fields

**Files:**
- Modify: `src/types/exercise.ts`, `src/types/training.ts`
- Create: `src/firebase/optionalFields.ts`, `src/firebase/optionalFields.test.ts`
- Modify: `src/exercises/exercisesApi.ts` (`createExercise`, `updateExercise`, `bulkCreateExercises`), `src/trainings/trainingsApi.ts` (`createTraining`, `updateTraining`, `bulkCreateTrainings`)
- Modify: `firestore.rules` (exercises + trainings create/update)
- Test: `tests/rules/exercises.rules.test.ts`, `tests/rules/trainings.rules.test.ts`

**Interfaces:**
- Produces:
  - `Exercise.minPlayers?: number`, `NewExerciseInput.minPlayers?: number`
  - `Training.suggestedPlayers?: number`, `Training.targets?: ExerciseCategory[]`; same two optional on `NewTrainingInput`
  - `export const PLAYER_LIMITS = { minPlayers: { min: 1, max: 30 }, suggestedPlayers: { min: 1, max: 60 } } as const` in `src/types/exercise.ts`
  - `type ExerciseUpdate = Omit<Partial<NewExerciseInput>, 'minPlayers'> & { minPlayers?: number | null }`
  - `type TrainingUpdate = Omit<Partial<NewTrainingInput>, 'suggestedPlayers' | 'targets'> & { suggestedPlayers?: number | null; targets?: ExerciseCategory[] | null }`
  - `updateExercise(id, updates: ExerciseUpdate)`, `updateTraining(id, updates: TrainingUpdate)` — `null` (or empty `targets`) ⇒ `deleteField()`
  - `optionalForCreate<T extends object>(data: T): T` — drops keys whose value is `undefined`, `null`, or `[]`
  - `optionalForUpdate<T extends object>(data: T, keys: (keyof T)[]): Record<string, unknown>` — for listed keys, `null`/`undefined`-but-present/`[]` → `deleteField()`; other keys pass through

- [ ] **Step 1: Write failing unit tests** in `optionalFields.test.ts`:
  - `optionalForCreate({ name: 'A', minPlayers: undefined, targets: [] , suggestedPlayers: null })` → `{ name: 'A' }`
  - `optionalForCreate({ name: 'A', minPlayers: 6, targets: ['service'] })` keeps both
  - `optionalForUpdate({ minPlayers: null, name: 'B' }, ['minPlayers'])` → `name: 'B'` and `minPlayers` equals `deleteField()` (compare with `expect(x.minPlayers).toEqual(deleteField())` or `isEqual`)
  - `optionalForUpdate({ targets: [] }, ['targets'])` → `targets` is `deleteField()`
  - `optionalForUpdate({ name: 'B' }, ['minPlayers'])` → no `minPlayers` key at all (absent key untouched)
- [ ] **Step 2:** `npx vitest run src/firebase/optionalFields.test.ts` → FAIL (module missing)
- [ ] **Step 3:** Implement `optionalFields.ts`; add types/`PLAYER_LIMITS`; route the api writes through it (create: spread `optionalForCreate(input)`; update: `optionalForUpdate(updates, [...])`; keep `exerciseIds` derivation in `updateTraining`). `bulkCreate*` use `optionalForCreate` per input.
- [ ] **Step 4:** Unit tests PASS; `npx tsc -b` clean (call sites of `updateExercise`/`updateTraining` still compile).
- [ ] **Step 5: Write failing rules tests.**
  - exercises: create with `minPlayers: 6` succeeds; with `0`, `31`, `7.5`, `'6'` fails; update to `minPlayers: 12` succeeds; update removing it (`FieldValue.delete()` / compat `firebase.firestore.FieldValue.delete()` as the test env provides) succeeds; existing doc without it still updates (`{ name: 'Pepper v2' }`) — already covered, keep.
  - trainings: create with `suggestedPlayers: 12, targets: ['service','reception']` succeeds; `suggestedPlayers: 0`/`61`/`3.5` fails; `targets: 'service'` fails; `targets` with 10 entries fails; `targets: ['nonsense']` fails if element check implemented (see Step 7).
- [ ] **Step 6:** `npm run test:rules` → new cases FAIL.
- [ ] **Step 7:** In `firestore.rules` add helpers and `&&` them into exercises create/update and trainings create/update:
  ```
  function optIntIn(d, k, lo, hi) { return !(k in d) || (d[k] is int && d[k] >= lo && d[k] <= hi); }
  function optTargets(d) {
    return !('targets' in d) || (d.targets is list && d.targets.size() >= 1 && d.targets.size() <= 9
      && d.targets.toSet().difference(['warmup','physical','service','setting','defense','reception','attack','compound','game'].toSet()).size() == 0);
  }
  ```
- [ ] **Step 8:** `npm run test:rules` → all PASS.
- [ ] **Step 9: Commit** `feat(trainings): optional minPlayers, suggestedPlayers and targets in model, writes and rules`

---

### Task 2: JSON import accepts the new fields

**Files:**
- Modify: `src/exercises/exercisesImport.ts` (+ example), `src/trainings/trainingsImport.ts` (+ example)
- Test: `src/exercises/exercisesImport.test.ts`, `src/trainings/trainingsImport.test.ts`

**Interfaces:**
- Consumes: `PLAYER_LIMITS`, `EXERCISE_CATEGORIES` / category keys.
- Produces: `ExerciseImportInput.minPlayers?: number`; `NewTrainingInput` rows may carry `suggestedPlayers`, `targets` (deduped, original order).

- [ ] **Step 1: Failing tests:**
  - exercise row with `"minPlayers": 6` → input has `minPlayers: 6`; without it → input has no `minPlayers` key (`expect('minPlayers' in input).toBe(false)`)
  - `"minPlayers": 0` / `31` / `2.5` / `"6"` → error `row 1: "minPlayers" must be a whole number from 1 to 30`
  - training row with `"suggestedPlayers": 12, "targets": ["service","reception","service"]` → `suggestedPlayers: 12`, `targets: ['service','reception']`
  - `"targets": ["nonsense"]` → error `row 1: "targets" must be a list of: warmup, physical, …` (join of keys); `"targets": []` → accepted, key absent; `"suggestedPlayers": 61` → error `row 1: "suggestedPlayers" must be a whole number from 1 to 60`
- [ ] **Step 2:** run both test files → FAIL
- [ ] **Step 3:** Implement; add the fields to both `*_IMPORT_EXAMPLE` strings (one example row each).
- [ ] **Step 4:** tests PASS
- [ ] **Step 5: Commit** `feat(import): accept minPlayers, suggestedPlayers and targets in JSON import`

---

### Task 3: Exercise form + detail sheet show "Minimum players"

**Files:**
- Modify: `src/exercises/ExerciseFormDialog.tsx`, `src/exercises/ExerciseDetailSheet.tsx` (`ExerciseDetailEntry.minPlayers?: number`, shown in the facts line as `Min N players`)
- Create: `src/components/parseOptionalInt.ts` + `.test.ts`
- Test: `src/exercises/ExerciseFormDialog.test.tsx`, `src/exercises/ExerciseDetailSheet.test.tsx`

**Interfaces:**
- Produces: `parseOptionalInt(raw: string, min: number, max: number): { ok: true; value: number | null } | { ok: false }` — `''`/whitespace → `{ok:true,value:null}`; integer in range → value; else `{ok:false}`.

- [ ] **Step 1: Failing tests:** `parseOptionalInt` cases (`''`→null, `'6'`→6, `'0'`,`'31'`,`'7.5'`,`'abc'`→not ok for 1..30). Form: new exercise with Minimum players `6` → `createExercise` called with `minPlayers: 6`; blank → called without `minPlayers`; editing an exercise with `minPlayers: 6`, clearing → `updateExercise` called with `minPlayers: null`; `0` → `role="alert"` "Minimum players must be a whole number from 1 to 30." and no save. Detail sheet: entry with `minPlayers: 8` shows "Min 8 players"; without → text absent.
- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** Implement. Input `type="number" inputMode="numeric"`, `id="exercise-min-players"`, label "Minimum players", helper text "Fewest people needed to run it. Optional." Keep state as string. "Create & add diagrams" path passes it too.
- [ ] **Step 4:** PASS
- [ ] **Step 5: Commit** `feat(exercises): optional minimum players on the exercise form and detail view`

---

### Task 4: Builder saves suggested players + targets; view sheet shows them

**Files:**
- Modify: `src/trainings/TrainingBuilderDialog.tsx`, `src/trainings/TrainingViewSheet.tsx`
- Test: `src/trainings/TrainingBuilderDialog.test.tsx`, `src/trainings/TrainingViewSheet.test.tsx`

**Interfaces:**
- Consumes: `parseOptionalInt`, `PLAYER_LIMITS`, `TrainingUpdate`.
- Produces: builder state `suggestedPlayers: number | null` (parsed) and `targets: ExerciseCategory[]` available to Task 5; `Row.minPlayers?: number` loaded from `getExercisesByIds` / set in `addExercise`.

- [ ] **Step 1: Failing tests:**
  - Builder new: Suggested players `12`, toggle targets Service + Reception (`role="group"` `aria-label="Training targets"`, `aria-pressed`) → `createTraining` gets `suggestedPlayers: 12, targets: ['service','reception']` (order = `EXERCISE_CATEGORIES` order, not click order).
  - Builder new with nothing set → `createTraining` input has neither key.
  - Builder edit of training with both set, clear players + untoggle all targets → `updateTraining` gets `suggestedPlayers: null, targets: null`.
  - `61` → alert "Suggested players must be a whole number from 1 to 60." and no save.
  - `initial` (AI draft prefill) without the fields still works (existing test stays green).
  - View sheet: training with `suggestedPlayers: 12, targets: ['service']` shows "12 players" and a "Service" pill; legacy training shows neither.
- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** Implement. Fields sit after "Age group target": number input `id="training-suggested-players"` label "Suggested players" with helper "Roughly how many players this session is designed for. Optional."; targets chips reuse `chipClass`. View sheet pills go in the existing pills row (`Users` icon from lucide for players).
- [ ] **Step 4:** PASS
- [ ] **Step 5: Commit** `feat(trainings): suggested players and targets in the builder and view`

---

### Task 5: Picker suggestions

**Files:**
- Create: `src/trainings/suggestions.ts`, `src/trainings/suggestions.test.ts`
- Modify: `src/exercises/exercisesApi.ts` (add `listExercisesInCategories`), `src/trainings/TrainingBuilderDialog.tsx`
- Test: `src/trainings/TrainingBuilderDialog.test.tsx`

**Interfaces:**
- Consumes: Task 4 builder state, `Row.minPlayers`.
- Produces:
  - `needsMorePlayers(minPlayers: number | undefined, suggested: number | null): boolean` — true only when both set and `minPlayers > suggested`
  - `sortByFit<T extends { minPlayers?: number }>(items: T[], suggested: number | null): T[]` — stable; non-fitting moved after fitting; identity order when `suggested === null`
  - `coveredTargets(targets: ExerciseCategory[], rows: { category?: ExerciseCategory }[]): Set<ExerciseCategory>`
  - `listExercisesInCategories(categories: ExerciseCategory[], afterDoc: QueryDocumentSnapshot | null): Promise<ExercisesPage>` — `where('category','in',categories), orderBy('name'), startAfter?, limit(25)`; throws if `categories.length === 0` or `> 30`. Uses existing `(category, name)` index; confirm no new index is needed (if emulator/console asks for one, add it to `firestore.indexes.json`).

- [ ] **Step 1: Failing unit tests** for the three helpers: `needsMorePlayers(8, 6)` true; `(6, 6)` false; `(undefined, 6)` false; `(8, null)` false. `sortByFit([{minPlayers:8,id:'a'},{id:'b'},{minPlayers:4,id:'c'}], 6)` → ids `b`,`c`,`a`... precisely: fitting in original order `['b','c']` then `['a']` → `['b','c','a']`; with `null` → `['a','b','c']`. `coveredTargets(['service','defense'], [{category:'service'},{}])` → `{'service'}`.
- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** Implement helpers + api.
- [ ] **Step 4: Failing component tests** (mock `exercisesApi`):
  - targets `['service']`, open picker → "Suggested for your targets" heading rendered with items from `listExercisesInCategories(['service'], null)`; no targets → heading absent and `listExercisesInCategories` not called.
  - pick category chip "Defense" while targets set → suggested section hidden; back to "All" → shown again.
  - suggested players `6`, picker item with `minPlayers: 8` → badge text "Needs 8 · suggested 6", rendered after fitting items, Add button still enabled.
  - selected row with `minPlayers: 8` and suggested `6` → same badge on the row.
  - picker item with `minPlayers: 4` shows "Min 4 players"; item without `minPlayers` shows no such text.
  - target chip for a covered target has an accessible "covered" marker (e.g. `aria-label="Service (covered)"` on a check icon or chip description).
- [ ] **Step 5:** run → FAIL; implement in the dialog (suggested list has its own state + "Load more" cursor; reload it when `targets` change while the picker is open); run → PASS
- [ ] **Step 6: Commit** `feat(trainings): suggest exercises by targets and flag ones needing more players`

---

### Task 6: Diagram → PDF-safe SVG string

**Files:**
- Create: `src/trainings/pdf/diagramToPdfSvg.ts`, `src/trainings/pdf/diagramToPdfSvg.test.ts`

**Interfaces:**
- Produces:
  - `LIGHT_TOKENS: Record<string, [number, number, number]>` — every `--color-*` from the `:root` block of `src/index.css` (navy, blue, blue-strong, orange, orange-strong, green, green-strong, red, red-strong, ink, slate, border, bg, surface)
  - `resolveThemeColors(svg: string): string` — `rgb(var(--color-X))` → `rgb(r,g,b)`; `rgb(var(--color-X) / a)` → `rgba(r,g,b,a)`; unknown token → ink
  - `diagramToPdfSvg(scene: Scene): string` — `renderToStaticMarkup(<DiagramSvg scene={scene} />)`, resolved, with explicit `width="100" height="100"` if the root lacks them

- [ ] **Step 1: Failing tests:** `resolveThemeColors('fill="rgb(var(--color-ink))"')` → `fill="rgb(15,23,42)"`; `'rgb(var(--color-blue) / 0.1)'` → `'rgba(40,101,246,0.1)'`; `'rgb(var(--color-nope))'` → ink. `diagramToPdfSvg(sceneWithPlayerArrowNetCone)` contains `<svg`, `<marker`, `<pattern`, and does not contain `var(--`.
- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** Implement (regex over the string; keep a single test that asserts `LIGHT_TOKENS.ink` equals `[15,23,42]` so a drift from `index.css` is noticed).
- [ ] **Step 4:** PASS
- [ ] **Step 5: Commit** `feat(trainings): render court diagrams to PDF-safe SVG`

---

### Task 7: Pure PDF document definition

**Files:**
- Create: `src/trainings/pdf/buildTrainingPdf.ts`, `src/trainings/pdf/buildTrainingPdf.test.ts`

**Interfaces:**
- Consumes: `Training`, `Exercise`, `Diagram`, `EXERCISE_CATEGORIES`, `needsMorePlayers`, `diagramToPdfSvg` (injected — see signature, so tests don't render SVG).
- Produces:
  - `interface TrainingPdfInput { training: Training; exercisesById: Map<string, Exercise>; diagramsById: Map<string, Diagram[]>; svgFor: (d: Diagram) => string }`
  - `interface LineupEntry { number: number; exerciseId: string; name: string | null; category?: ExerciseCategory; minPlayers?: number; minutes: number; start: number; end: number }`
  - `buildLineup(training: Training, exercisesById: Map<string, Exercise>): LineupEntry[]` — sorted by `order`, start/end cumulative (same math as `TrainingViewSheet`)
  - `exercisePages(lineup: LineupEntry[]): { exerciseId: string; slots: LineupEntry[] }[]` — unique by first appearance, skips `name === null`
  - `buildTrainingDocDefinition(input: TrainingPdfInput): TDocumentDefinitions` (pdfmake type; use `import type` only)
  - `trainingPdfFileName(training: Training): string` → `` `${training.businessId}-${fileSlug(training.name)}.pdf` ``

Content rules (from spec §6): A4 portrait, margins ~40pt; `header` = `businessId · name` small slate; `footer` = `Page X of Y`; cover: title, businessId label, facts line built only from set values (age group, `N suggested players`, total min, exercise count), targets labels, description (preserve `\n`), lineup table (`#`, Exercise, Category, Min players, Min, Time) with `headerRows: 1`, `dontBreakRows: true`, deleted rows as "Deleted exercise". Each exercise page: first node has `pageBreak: 'before'`; heading `#2 · Name` / `#2, #5 · Name`; facts (category · per slot `N min · 10–25` · `Min N players`); warning line "Needs 8 — suggested 6 players" when `needsMorePlayers`; description; diagrams as `{ svg, width }` with title, `unbreakable: true` per diagram block — 1 diagram width ≈ 340pt centred, 2+ in a two-column grid ≈ 250pt each.

- [ ] **Step 1: Failing tests:**
  - `buildLineup` with exercises `[a 10, b 15, a 5]` → numbers 1..3, start/end `0–10, 10–25, 25–30`; missing exercise → `name: null`
  - `exercisePages` for `[a,b,a,deleted]` → `[{a, slots #1,#3}, {b, slots #2}]`
  - doc def: count nodes with `pageBreak === 'before'` equals unique non-deleted exercises (walk `content`); legacy training (no new fields) → serialized JSON contains no `suggested` and no `Targets`; training with `suggestedPlayers: 6` and exercise `minPlayers: 8` → JSON contains `Needs 8 — suggested 6 players`; zero-exercise training → content has the cover and zero page breaks; `svgFor` called once per diagram; JSON never contains `createdBy` value.
  - `trainingPdfFileName({businessId:'TR-0007', name:'Serve & receive'})` → `TR-0007-Serve-receive.pdf`
- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** `npm i pdfmake` (and `@types/pdfmake` only if the installed version ships no types; if types lag 0.3, declare a minimal local `src/types/pdfmake.d.ts`). Implement.
- [ ] **Step 4:** PASS
- [ ] **Step 5: Commit** `feat(trainings): pdf document definition for a training`

---

### Task 8: Generate + share from the view sheet

**Files:**
- Create: `src/export/shareFile.ts` (+ `.test.ts`) — lift `download` + `shareOrDownload` out of `src/awards/exportCards.ts`; `exportCards.ts` re-exports or imports them (keep awards behaviour identical)
- Create: `src/trainings/pdf/exportTrainingPdf.ts`
- Modify: `src/trainings/TrainingViewSheet.tsx`
- Test: `src/trainings/TrainingViewSheet.test.tsx`
- Modify: `CLAUDE.md` (one line under Architecture: training PDF export lives in `src/trainings/pdf/`, pdfmake lazy-loaded, diagrams via `diagramToPdfSvg`)

**Interfaces:**
- Consumes: Tasks 6–7, `listDiagrams`, `getExercisesByIds`.
- Produces:
  - `shareOrDownload(files: File[], title: string): Promise<'shared' | 'downloaded' | 'cancelled'>` (same semantics as today)
  - `generateTrainingPdf(training: Training): Promise<File>` — loads exercises (`getExercisesByIds` on unique ids) and diagrams (`listDiagrams` per unique existing exercise, in parallel), builds the def, `const { default: pdfMake } = await import('pdfmake/build/pdfmake')` + vfs fonts, returns `new File([blob], trainingPdfFileName(training), { type: 'application/pdf' })`

UI state machine in the footer, button before Edit: `idle` "Share PDF" (`FileDown` icon) → click → `building` "Preparing PDF…" disabled → `ready` "Share PDF ready" (primary-ish) → click → `shareOrDownload([file], training.name)`; `'downloaded'` → `notify('PDF downloaded')`; `'cancelled'` → stay `ready`; build failure → `role="alert"` "Could not create the PDF. Please try again." and back to `idle`. File kept in state for the sheet's lifetime.

- [ ] **Step 1: Failing tests** (mock `./pdf/exportTrainingPdf` and `../export/shareFile`): idle label; click → "Preparing PDF…" disabled → resolves → "Share PDF ready"; click → `shareOrDownload` called with the File; second share doesn't call `generateTrainingPdf` again; reject → alert text and "Share PDF" again; `'downloaded'` → notice shown; `'cancelled'` → no notice, still ready. `shareFile.test.ts`: `canShare` false → anchor click download, returns `'downloaded'`; `share` throws `AbortError` → `'cancelled'`.
- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** Implement; ensure `pdfmake` appears only behind `import()` (check `npm run build` output has a separate chunk and the main entry chunk size is unchanged within ~1 kB).
- [ ] **Step 4:** PASS; `npm test` all green
- [ ] **Step 5: Commit** `feat(trainings): share a training as PDF`

---

### Task 9: Full local verification

- [ ] `npm test` → all pass
- [ ] `npm run test:rules` → all pass
- [ ] `npm run lint` → clean
- [ ] `npm run build` → clean; note pdfmake chunk name/size
- [ ] `npm run dev:emulator`; in the browser: create an exercise with Minimum players 8 and diagrams (net, arrow, cone, players), a training with Suggested players 6 + targets, duplicate one exercise; check picker suggestions/badges; on the view sheet generate the PDF and open it (download path on desktop). Verify: cover lineup, one page per unique exercise, arrowheads + net hatch render, no `var(` artifacts, page numbers. If markers/pattern don't render, implement the PNG fallback in `diagramToPdfSvg` caller (canvas, 3× scale) and re-check.
- [ ] Check the prod CSP: run `npm run build && npx vite preview` with the `firebase.json` CSP header applied (or inspect pdfmake build for `new Function`/`eval`); PDF generation must not throw a CSP error.
- [ ] Commit any fixes; report results to the user with real outputs.
