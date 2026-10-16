# AI drafting for exercises & trainings + AI key hardening

Date: 2026-10-15 · Status: approved design, pending implementation plan

## 1. Goal

Let coaches draft **exercises** (with a court diagram) and **trainings** with the AI
provider they already configured for text scouting, review every proposal visually,
and save only what they keep. At the same time, harden how the provider key is stored
and describe both in the Privacy page.

Success looks like:

- A coach types "serve-receive drills for 9 players, U15" and gets up to 5 proposals,
  each with name, category, description and a rendered court diagram, and saves the
  ones they want in one click.
- A coach types a training goal and gets an ordered session built mostly from the
  club library, with new exercises only where the library has gaps, previewed step
  by step before saving.
- No player, team, guardian or match data is ever sent for drafting.
- The provider key is session-only by default, removable at any time, and capped
  per request.

### Out of scope

- Server-side AI proxy (Cloud Functions / Blaze) — a later step; this design must not
  block swapping `chatJson` for a callable function.
- MCP server.
- Editing a draft's diagram before saving (done afterwards in the diagram editor).
- Persisting drafts (they live in component state only).

## 2. Key hardening (Option 1)

Current state: sign-out already wipes AI settings, drafts and the session key
(`clearAiLocalData` via `useSignOut`); a session-only mode exists; the CSP
`connect-src` allows only Groq, OpenRouter and localhost.

Changes:

1. **Session-only by default.** `DEFAULT_AI_SETTINGS.rememberKey` becomes `false`.
   Already-saved settings keep their stored value (no silent deletion of keys users
   chose to remember). "Remember on this device" stays an explicit opt-in.
2. **"Forget key" action** in `AiProviderSettings`: clears the key from both
   `localStorage` and `sessionStorage`, keeps provider/model, confirms via
   `useNotify()`. Disabled when no key is set.
3. **`max_tokens` on every request.** `chatJson` gains an options object
   `{ temperature?, maxTokens? }`; caps live in one constants block
   (`AI_MAX_TOKENS = { scout: 2000, draft: 4000 }`). Scouting keeps `temperature: 0`;
   drafting uses `0.7`.
4. **Trusted Types, report-only.** Add a
   `Content-Security-Policy-Report-Only: require-trusted-types-for 'script'` header in
   `firebase.json` (no report endpoint; violations show in the console). Enforcement
   is a follow-up item in `docs/PRODUCTION-READINESS.md` once Firebase Auth's iframe
   flows are confirmed clean.
5. **Move the AI client out of scouting.** `src/matches/text/aiClient.ts` and
   `aiSettings.ts` (+ tests) move to `src/ai/`; imports in `textScout.ts`,
   `TextScoutPanel.tsx`, `AiProviderSettings.tsx`, `useSignOut.tsx` and their tests
   are updated. Storage keys (`vcb.ai.*`) are unchanged.

## 3. Privacy page

`src/legal/PrivacyPage.tsx`:

- Rename the section "Text scouting (optional)" → **"AI features (optional)"**; keep
  the existing text-scouting paragraphs.
- Add a paragraph on **drafting**: when a coach uses "Draft with AI", their request
  text and the names, categories and short descriptions of club-library exercises are
  sent to the provider chosen in Settings. No player, team, guardian or match data is
  sent. Coaches are asked not to type personal data in requests.
- Add a sentence on **keys**: the key belongs to the coach's own provider account,
  is stored only on their device (for the browser session by default, or remembered
  on that device if they opt in), can be removed in Settings at any time, and is
  removed on sign-out. Requests are made under the coach's own agreement with that
  provider.

Legal basis: this is a transparency update (GDPR Art. 13). Drafting processes no data
about players; the only personal data is a coach's own request text sent with their
own key. Copy stays region-agnostic and names the operator, not a club (see
project memory: EU-wide scope, club-agnostic app).

## 4. Shared drafting module — `src/aiDraft/`

| Unit | Purpose |
|---|---|
| `diagramPrompt.ts` | Compact text description of the scene format for the model: 0–100 grid; `full` court: baselines y=6/94, net y=50; `half` court: net y=6, baseline y=72; item types allowed for drafts (`player`, `ball`, `cone`, `arrow`, `text`, `zoneLabel`), arrow styles `pass`/`shot`/`run`, labels ≤3 chars, ≤60 items. Derived from `SCENE_LIMITS` and the court geometry (the `top`/`bottom`/`netY` values in `CourtBackdrop` move to an exported `courtGeometry(court)` helper used by both) so it cannot drift. |
| `exercisePrompt.ts` | Builds messages for exercise drafting. |
| `trainingPrompt.ts` | Builds messages for training drafting, including the library index. |
| `validateDraft.ts` | Pure validators turning model JSON into typed drafts (see §5.3, §6.3). Never throws on bad items; returns per-field issues. |
| `libraryIndex.ts` | Loads a bounded library index via `listExercises` (see §6.2). |
| `saveDrafts.ts` | Save orchestration (see §5.5, §6.5). |
| `DraftRequestDialog.tsx` | Request form (shared shell, mode-specific fields). |
| `ExerciseProposalReview.tsx` | Review UI for exercise proposals. |
| `TrainingProposalReview.tsx` | Review UI for a training proposal. |

Types:

```ts
interface ExerciseDraft {
  key: string;               // local id
  name: string;
  category: ExerciseCategory | null;   // null => invalid, coach must pick
  description: string;
  scene: Scene | null;       // null => no usable diagram
  issues: string[];          // human-readable repairs/drops
}

type TrainingStepDraft =
  | { kind: 'library'; exerciseId: string; name: string; category: ExerciseCategory; minutes: number }
  | { kind: 'new'; exercise: ExerciseDraft; minutes: number; keep: boolean };

interface TrainingDraft {
  name: string;
  description: string;
  ageGroupTarget: string;
  steps: TrainingStepDraft[];
  issues: string[];
}
```

Draft field limits (client-side, matching existing form behaviour): name 1–80 chars,
description ≤ 2000 chars, minutes integer 1–60.

## 5. Exercise drafting

### 5.1 Entry & request

"Draft with AI" button on `ExercisesPage`, next to "New exercise", visible only when
the user can write exercises. If AI isn't configured, the button still shows and the
dialog explains with a link to Settings.

Inputs: request text (required, ≤ 500 chars), category (optional), count 1–5
(default 3).

### 5.2 Prompt payload

System prompt: role, output JSON shape, the 9 categories, `diagramPrompt`, and
"existing exercises — do not duplicate": up to 50 names from the chosen category
(or across categories when none is chosen), loaded with the paginated
`listExercises` (≤ 2 pages). User message: the request text and count.

Expected output: `{ "exercises": [ { "name", "category", "description", "diagram": { "court", "showZones", "items": [...] } } ] }`.

### 5.3 Validation

- Extra proposals beyond the requested count are dropped.
- Name/description trimmed and truncated to limits; empty name → proposal dropped.
- Unknown category → `category: null` + issue; the review forces a pick before saving.
- Diagram: items get fresh ids, then `parseScene`. If it fails, `scene: null` + issue
  ("diagram could not be used"). Items of types not allowed for drafts are dropped
  with an issue.
- Zero valid proposals → `badResponse` error.

### 5.4 Review

One dialog, one card per proposal: `DiagramSvg` preview (tap → `DiagramLightbox`),
name, category chip, description, issues in muted text. Per card: **Keep** toggle
(default on) and **Edit** (inline name/category/description). Footer: **Regenerate**
(re-runs the request; kept proposals stay and their names are sent as "already
proposed"), **Cancel**, **Save N kept** (disabled while any kept card has no category).

### 5.5 Save

Sequential per kept proposal: `createExercise(input, uid)`, then, if `scene`,
`saveDiagramSet(exerciseId, { creates: [{ tempId, title: 'AI draft', order: 0, scene }], updates: [], deletes: [] }, uid)`.
On failure, stop and show an inline `role="alert"` error naming what was saved and
what wasn't (an exercise created without its diagram is reported as such). On
success, `useNotify()` ("3 exercises added") and the page list refreshes.

## 6. Training drafting

### 6.1 Entry & request

"Draft with AI" on `TrainingsPage` (visible to users with trainings access). Inputs:
goal (required, ≤ 500 chars), age group (free text, same as the builder), total
minutes (30–180, default 90), "Allow new exercises" (default on; hidden and forced
off when the user cannot write exercises).

### 6.2 Library index

`libraryIndex.ts` loads up to **150** exercises via `listExercises` with category
filters: the categories the coach names or that are inferred from the goal by simple
keyword match against category labels, always plus `warmup` and `game`; with no
match, unfiltered. Pages of 25 until the cap. Each entry is sent as
`id | name | category | first 80 chars of description`. No new queries or indexes.

### 6.3 Prompt & validation

Expected output: `{ "name", "description", "ageGroupTarget", "steps": [ { "exerciseId", "minutes" } | { "new": { ...exercise as in §5.2 }, "minutes" } ] }`.

- `exerciseId` not in the sent index → step dropped + issue.
- `new` steps when new exercises are not allowed → dropped + issue.
- New exercises validated as in §5.3.
- Minutes clamped to 1–60; steps capped at 20.
- No steps left → `badResponse`.

### 6.4 Review

Header: editable name, age group, total minutes vs target (warning tone when off by
> 10%). Ordered step list: minutes (editable), **Library**/**New** badge, diagram
thumbnail (library → `getFirstDiagram`, lazy; new → its draft scene), move up/down,
remove. New steps have a Keep toggle; unkeeping removes the step. Tapping a step opens
`ExerciseDetailSheet` over all steps; the sheet gains an optional `scene` on
`ExerciseDetailEntry` so unsaved drafts render without a fetch.

Footer: **Regenerate**, **Cancel**, **Open in builder**, **Save**.

**Open in builder** first saves the kept new exercises (as §6.5 step 1), then opens
`TrainingBuilderDialog` prefilled with the draft (new optional `initial` prop of type
`NewTrainingInput`), so the builder only ever sees real exercise ids.

### 6.5 Save

1. Create kept new exercises (+ diagrams) as in §5.5, collecting real ids.
2. `createTraining` with steps mapped to `TrainingExercise` (`order` = index,
   real ids), using the existing transactional `businessId`.

If step 1 fails partway, stop: no training is created, and the error lists the
exercises already added to the library. If step 2 fails, the error says the new
exercises were saved and the training was not; the draft stays open so the coach can
retry Save (already-created exercises are not created again — the draft records
their ids).

## 7. Errors

Reuse `AiError` kinds: `notConfigured` / `unauthorized` → inline message + Settings
link; `rateLimited` → "Try again in N s" when `retryAfterSec` is known;
`badResponse` → one automatic retry, then inline error; `unreachable`/`http` →
inline error. A **Cancel** button during generation aborts via `AbortSignal`.
Closing the dialog discards the draft.

## 8. Permissions & rules

All writes reuse existing paths (`exercises`, `exercises/{id}/diagrams`, `trainings`,
`counters/trainings`) under existing rules. No rules change is expected; if one
becomes necessary it ships with a test in `tests/rules/`.

## 9. Testing

- Unit: `diagramPrompt` (mentions limits from `SCENE_LIMITS`), prompt builders (no
  fields beyond the documented payload; snapshot of the library-index line format),
  `validateDraft` (bad category, unknown id, disallowed new steps, broken diagram,
  over-limit items, extra proposals, empty result), `libraryIndex` (cap, category
  selection), `saveDrafts` (ordering, partial failure reporting, no re-create on
  retry), `chatJson` sends `max_tokens`/`temperature`.
- Settings: default session-only for fresh settings, stored `rememberKey: true`
  preserved, Forget key clears both storages.
- Components: `ExerciseProposalReview` (keep/edit/save-disabled-without-category),
  `TrainingProposalReview` (reorder, remove, minutes total, open in builder),
  request dialog error states — with `chatJson` mocked.
- Privacy page test updated for the new section title and drafting paragraph.
