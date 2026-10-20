# Training PDF export + player/target-aware builder — design

Date: 2026-10-20 · Status: approved

## 1. Intent

A coach wants to hand a training to **another coach who is not in the app**, so
that coach can run the session on their own. The coach is on their **phone** and
shares it **straight into a chat** (WhatsApp, Telegram…). The PDF must stand on
its own: no links back into the app, nothing that assumes context.

What the receiving coach needs first: the **lineup** (the running order of
exercises with minutes and times) and **how many people** the session expects.
Then **one page per exercise**, explaining it, with its court diagrams.

Along the way two small data additions make the builder smarter:

- Each exercise can say the **minimum players** needed to run it.
- Each training can say **suggested players** and its **targets** (what the
  session focuses on). The builder's exercise picker then suggests what fits.

## 2. Goals / non-goals / anti-goals

**Goals**
- From a training → a real `.pdf` file in the phone's share sheet (download
  fallback where file sharing isn't supported). Two taps, see §7 "Sharing".
- Clean pagination: a cover page, then each exercise starting on its own page.
- Diagrams in the PDF look as good as in the app (vector if possible).
- Builder suggestions driven by targets and suggested players.
- **Full back-compat**: every new field is optional. Existing exercises and
  trainings without them behave exactly as today; missing fields are simply not
  considered for ranking, warnings or PDF lines.

**Non-goals**
- No club name, logo or branding in the PDF (user: "no need for club name").
- No print-dialog flow (`window.print`) for this — the existing match report
  keeps its own print path.
- No new structured exercise fields (objectives, equipment, coaching points…).
  The free-text `description` stays the single place for that.
- No multi-category exercises. User: don't add fields when existing ones can be
  leveraged — targets reuse the existing single `category`.
- No AI-drafting changes in this increment (see §9).
- No i18n — the app is English-only; the PDF is too.

**Anti-goals** (would be a failure even if it technically works)
- A PDF that only opens a print dialog on the phone, or needs a laptop.
- Exercises split awkwardly mid-diagram, or a cover page that runs onto the
  first exercise.
- Old trainings/exercises showing "0 players", empty target chips, or being
  hidden/penalised because the new fields are missing.
- Hiding exercises from the picker. Suggestions re-order and flag; they never
  remove options.
- Bloating the main bundle — the PDF library loads only when exporting.

## 3. Data model changes

All optional. No migration, no backfill.

```ts
// src/types/exercise.ts
interface Exercise {
  ...existing
  minPlayers?: number;          // NEW — integer 1..30, fewest people to run the drill
}
// NewExerciseInput gains minPlayers?: number

// src/types/training.ts
interface Training {
  ...existing
  suggestedPlayers?: number;    // NEW — integer 1..60, suggested player count for the session (a planning suggestion, not a head count)
  targets?: ExerciseCategory[]; // NEW — reuses the 9 exercise categories, unique, 0..9
}
```

- `suggestedPlayers` lives on the club-wide training template and is a **planning
  suggestion** ("designed for about N players"), not a head count for one
  session (user decision). Calendar sessions are untouched.
- "Not set" is **field absent** (not `0`, not `null`). Clearing a value in a form
  removes the field (`deleteField()` on update).
- `targets` values are the existing `ExerciseCategory` keys; labels come from
  `EXERCISE_CATEGORIES`. Empty array ≡ absent (write absent).

**Firestore rules** (`firestore.rules`): today exercises/trainings have no
`hasOnly`, so the new fields would already be accepted. Add light type/range
validation so bad data can't be written:
- exercises create/update: `!('minPlayers' in data) || (data.minPlayers is int && 1 <= x <= 30)`
- trainings create/update: same pattern for `suggestedPlayers` (1..60) and
  `targets is list && targets.size() <= 9` (element-wise `in` check if the rules
  language allows it cheaply; otherwise size + list type is enough — builder's call).
- Rules tests in `tests/rules/` for: absent fields still allowed (back-compat),
  valid values allowed, out-of-range / wrong-type rejected.

**JSON import** (`exercisesImport.ts`, `trainingsImport.ts`): accept the new
fields as optional, validate the same ranges, ignore when absent. Update the
example snippets in those files.

**Indexes**: the suggestions query (§5) is `where('category','in',targets) +
orderBy('name') + limit`, served by the existing `exercises (category, name)`
composite index. No new index expected — builder verifies.

## 4. Editing the new fields

- **ExerciseFormDialog**: optional "Minimum players" number input (blank = not set).
- **ExerciseDetailSheet** and picker rows: show "Min N players" when set; nothing
  when not.
- **TrainingBuilderDialog**: near name/description, add
  - "Suggested players" number input (blank = not set);
  - "Targets" — toggle chips for the 9 categories (multi-select).
- **TrainingViewSheet**: show targets chips and "N players" next to the existing
  age-group / exercise-count / minutes pills, only when set.

## 5. Builder suggestions

The picker is cursor-paginated (`listExercises`, `orderBy('name').limit(N)`,
optional category filter) and fetching discipline forbids unbounded reads, so
"re-order the whole library" is done like this (my call):

1. **"Suggested for your targets" section** at the top of the picker, shown only
   when `targets` is non-empty: a separate paged query
   `where('category','in',targets).orderBy('name').limit(N)` with its own
   "Show more" cursor. The normal full list stays below, unchanged.
   If the user also picks a category filter, the filter wins and the suggested
   section hides (avoids two overlapping lists).
2. **Players check**, client-side on whatever rows are loaded, only when
   `suggestedPlayers` is set: an exercise with `minPlayers > suggestedPlayers`
   gets a warning badge ("Needs 8 · suggested 6") and sinks to the bottom **of
   its loaded page**. It stays selectable. Exercises without `minPlayers` are
   treated as fitting (no badge, no sinking).
3. **Target coverage hint** (my call, cheap and directly serves "what is better
   to add"): each target chip shows a small check when at least one selected
   exercise has that category, so uncovered targets stand out.
4. Already-selected rows in the training also get the players warning badge if
   they don't fit.

No ranking score, no hidden exercises, nothing changes when neither field is set.

## 6. The PDF

**Format**: A4 portrait (EU), English, light colours always (ignore the app's
dark mode). Inter if it can be embedded from the self-hosted `@fontsource/inter`
files, otherwise the library's default sans — builder's call.

**Every page**: small header `businessId · Training name`; footer `Page X of Y`.

**Page 1 — cover / lineup**
- Title: training name, with `businessId` as a subtle label.
- Facts row (only those set): age group target, **suggested players**, total
  minutes, number of exercises.
- Targets as chips/labels (if set).
- Description (if set), line breaks preserved.
- **Lineup table**: `#`, exercise name, category, min players (blank if not
  set), minutes, start–end (`0–10`, `10–25`… same math as `TrainingViewSheet`).
- If the lineup is too long it continues onto page 2 with the table header
  repeated; exercise pages still start on a fresh page after it.

**Then one section per exercise, each starting on a new page**
- One section per **unique** exercise, in order of first appearance (my call).
  The builder allows the same exercise twice; its page is not repeated.
- Heading: the lineup number(s) + name, e.g. `#2 · Serve receive 3v3`, or
  `#2, #5 · …` when repeated. Numbers match the cover's lineup table, so a
  deleted exercise (no page) doesn't break the numbering.
- Facts: category · minutes · start–end (one per slot when repeated) ·
  "Min N players" (if set). If
  `suggestedPlayers` is set and the exercise needs more, a short note
  ("Needs 8 — suggested 6 players").
- Description, line breaks preserved.
- Diagrams in their saved `order`, each with its title. Layout aims to keep the
  whole exercise on one page: 1 diagram → large (about ⅔ page width, centred);
  2+ → two-column grid. Never split a diagram across pages; a long description
  or many diagrams flow to the next page naturally (the header remains).
- Exercise with no diagrams: just the text.

**Missing data**: an exercise that was deleted from the library appears in the
lineup as "Deleted exercise" (same wording as `TrainingViewSheet`) and gets no
page. A training with zero exercises still exports a cover page.

**File name**: `<businessId>-<slug(name)>.pdf` using `fileSlug` from
`src/export/exportJson.ts`.

**Content boundary**: training + exercise + diagram data only. No player data,
no emails, no `createdBy`. (Nothing about minors leaves the app.)

## 7. How it's made (my calls, builder may revisit with reason)

- **Library: `pdfmake`**, loaded via dynamic `import()` from the export action so
  it lands in its own chunk. Chosen for declarative layout with automatic
  pagination, `pageBreak: 'before'`, repeating table headers, header/footer with
  page numbers, and native `svg` nodes (vector diagrams). Must work under the
  prod CSP (`script-src 'self' 'wasm-unsafe-eval'`, no `unsafe-eval`) — builder
  verifies; if it can't, pick another client-side library that does.
- **Diagrams**: render `DiagramSvg` (non-interactive) to a string with
  `renderToStaticMarkup`, then resolve the theme CSS variables
  (`rgb(var(--color-ink))`, `rgb(var(--color-blue) / 0.1)`, …) to literal
  light-theme colours, since a PDF has no CSS. The SVG uses `<marker>`
  arrowheads and a `<pattern>` net hatch — builder verifies they render in the
  PDF; if a feature doesn't survive, fall back to rasterising that diagram to a
  PNG (canvas, ≥2× scale) for the PDF.
- **Data loading**: training is already loaded; exercises via the existing
  `getExercisesByIds`; diagrams via `listDiagrams(exerciseId)` per exercise (≤12
  each, bounded by the training). Pure layout logic (doc-definition builder) is
  a separate pure module so it can be unit-tested without the PDF library.
- **Sharing**: reuse the pattern from `src/awards/exportCards.ts`
  `shareOrDownload` — Web Share API with a `File` when `navigator.canShare({files})`
  is true, otherwise trigger a download. Same behaviour on every platform (my
  call: desktop browsers that support file sharing show their share dialog,
  that's fine). If it's cleanly reusable, lift it to a shared helper rather than
  duplicating.
- **Two taps** (my call, same reason and pattern as the awards video's "Video
  ready → Share video" in `src/awards/AwardsPage.tsx`): browsers only open the
  share sheet straight after a tap, and building the PDF (lazy chunk + reads +
  layout) takes too long, so iOS Safari would refuse and fall back to a
  download. Flow: tap "Share PDF" → "Preparing PDF…" (disabled) → button becomes
  "Share PDF ready" → tap opens the share sheet. The built file is kept in
  memory while the sheet stays open, so re-sharing doesn't rebuild. Nothing is
  built ahead of time.
- **Where**: the button sits in the `TrainingViewSheet` footer next to
  Edit / Start.
  Errors inline with `role="alert"` (project convention); no success toast
  needed when the share sheet opens (the OS gives feedback), a `useNotify()`
  "PDF downloaded" on the download fallback.
- **Access**: anyone who can open the training view can export. No rules change
  needed for export itself.
- Suggested folder: `src/trainings/pdf/` (`buildTrainingPdf.ts` pure doc
  definition, `diagramToPdfSvg.ts`, `exportTrainingPdf.ts` orchestration).

## 8. Testing

- Rules tests for the new optional fields (§3).
- Unit: import validators accept/reject the new fields; the picker's
  players-fit/sort helper; target-coverage helper; the pure PDF doc-definition
  builder (cover facts only when set, one `pageBreak: 'before'` per exercise,
  deleted exercises in lineup only, start–end math); CSS-variable resolution in
  diagram SVG strings.
- Component: ExerciseFormDialog and TrainingBuilderDialog save/clear the new
  fields (clearing removes them); TrainingViewSheet shows the Share PDF button
  and the new pills only when set; picker shows the suggested section only with
  targets.
- The user tests the real PDF on their phone themselves.

## 9. Left for later

- AI drafting (`src/aiDraft/`) could send targets + suggested players in its
  request and propose `minPlayers` for new exercises. Not in this increment; the
  AI-draft validators must simply tolerate the new optional fields if they ever
  appear.
- Exercise library filter by "fits N players".
