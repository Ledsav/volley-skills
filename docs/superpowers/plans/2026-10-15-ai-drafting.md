# AI Drafting for Exercises & Trainings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coaches draft exercises (with an AI court diagram) and trainings with their own AI provider, review a visual preview of every proposal, and save only what they keep; the provider key is hardened and the Privacy page describes both.

**Architecture:** The provider-agnostic client moves from `src/matches/text/` to `src/ai/` and gains `temperature`/`maxTokens`. A new `src/aiDraft/` folder holds pure units (prompt builders, validators that run model output through `parseScene`, library-index loader, save orchestration) plus two dialogs (exercise drafting, training drafting) opened from "Draft with AI" buttons on the Exercises and Trainings pages. All writes reuse `createExercise`, `saveDiagramSet`, `createTraining` under the existing rules.

**Tech Stack:** React 18 + TypeScript (strict, `noUnusedLocals`), Vite, Vitest + Testing Library, Tailwind tokens, Firestore client SDK, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-10-15-volley-skills-ai-drafting-design.md`

## Global Constraints

- No player, team, guardian or match data in any drafting prompt — only the coach's request text and club-library exercise `id | name | category | description`.
- Exercise `createdBy` (uid) never appears in a prompt.
- Draft limits: name 1–80 chars, description ≤ 2000 chars, request ≤ 500 chars, minutes integer 1–60, ≤ 20 training steps, 1–5 exercise proposals, library index ≤ 150 entries, existing-name list ≤ 50.
- `max_tokens` on every request: `AI_MAX_TOKENS = { scout: 2000, draft: 4000 }`; scouting `temperature: 0`, drafting `0.7`.
- Storage keys stay `vcb.ai.*` (renaming wipes users' settings).
- No hardcoded club names in UI or copy; Privacy copy stays region-agnostic, operator is the responsible party.
- Components never import `firebase/firestore`; data access stays in `*Api.ts` modules.
- No unbounded collection reads — all library loads go through paginated `listExercises` (page size 25) with a hard cap.
- Success feedback via `useNotify()`; errors inline with `role="alert"`.
- No `dark:` Tailwind variants; use tokens (`text-ink`, `text-slate`, `bg-surface`, `border-border`, `text-red`, `text-orange`, `bg-blue/10`, `text-blue`).
- Drafts live in component state only — never localStorage.
- Writes that need the server use `useSave()` with `{ offline: 'block' }`.

## Review Focus

1. **Every diagram item the model returns is malformed** → the exercise text still shows and saves; the card says "No diagram" (Task 5: `toDraftScene` test "keeps text when no item survives").
2. **Model invents or mangles a library id** (`" ex-1 "`, unknown id) → the step is dropped with an issue, never written to Firestore (Task 6: "drops unknown and whitespace-padded ids").
3. **Coach closes the dialog while the model is answering** → the request is aborted and nothing renders afterwards (Task 11: "aborts the request when the dialog unmounts").
4. **Save fails halfway, coach presses Save again** → exercises already created are not created twice (Task 9: "retry does not re-create exercises").
5. **AI not configured / key rejected** → dialog shows an inline message with a Settings link instead of a crash (Task 11: "shows a Settings link when AI is not configured").

---

## File Structure

| File | Responsibility |
|---|---|
| `src/ai/aiClient.ts` (moved) | OpenAI-compatible `chatJson`, `AI_MAX_TOKENS`, `AiError` |
| `src/ai/aiSettings.ts` (moved) | Provider settings + key storage, `forgetAiKey` |
| `src/ai/csp.test.ts` | Pins CSP `connect-src` and the Trusted Types report-only header |
| `src/diagrams/courtGeometry.ts` | Court `top`/`bottom`/`netY` shared by `CourtBackdrop` and the prompt |
| `src/diagrams/sceneFactory.ts` (modify) | `sceneAsDiagram()` to render an unsaved scene as a `Diagram` |
| `src/aiDraft/types.ts` | `ExerciseDraft`, `TrainingStepDraft`, `TrainingDraft`, `LibraryIndexEntry`, `DRAFT_LIMITS` |
| `src/aiDraft/diagramPrompt.ts` | Scene-format guide text for the model |
| `src/aiDraft/validateDraft.ts` | Model JSON → typed drafts (exercise + training) |
| `src/aiDraft/exercisePrompt.ts` | Exercise drafting messages |
| `src/aiDraft/trainingPrompt.ts` | Training drafting messages + index line format |
| `src/aiDraft/libraryIndex.ts` | Bounded library loads (`loadLibraryIndex`, `existingExerciseNames`, `categoriesForGoal`) |
| `src/aiDraft/saveDrafts.ts` | Save orchestration, retry-safe |
| `src/aiDraft/draftRunner.ts` | One-retry-on-bad-JSON runner + error text |
| `src/aiDraft/trainingDraftOps.ts` | Pure step edits (move/remove/minutes/total) |
| `src/aiDraft/DraftDiagramPreview.tsx` | Small diagram preview / "No diagram" box |
| `src/aiDraft/ExerciseProposalReview.tsx` | Cards for exercise proposals |
| `src/aiDraft/ExerciseDraftDialog.tsx` | Request → generate → review → save (exercises) |
| `src/aiDraft/TrainingProposalReview.tsx` | Step list for a training proposal |
| `src/aiDraft/TrainingDraftDialog.tsx` | Request → generate → review → save / open in builder |

**Deviations from the spec (equivalent behaviour, simpler UI):** the spec's shared `DraftRequestDialog` is folded into each draft dialog (their inputs share nothing but a textarea). In the training review, a new step's "Keep" toggle is the step's **Remove** button (spec: "unkeeping removes the step" — same effect). A new exercise inside a training with no valid category is dropped with an issue (the training review has no category picker).

---

### Task 1: Move the AI client to `src/ai/`

**Files:**
- Move: `src/matches/text/aiClient.ts` → `src/ai/aiClient.ts`, `aiClient.test.ts` → `src/ai/aiClient.test.ts`
- Move: `src/matches/text/aiSettings.ts` → `src/ai/aiSettings.ts`, `aiSettings.test.ts` → `src/ai/aiSettings.test.ts`
- Modify imports: `src/matches/text/textScout.ts`, `src/matches/text/TextScoutPanel.tsx`, `src/matches/text/TextScoutPanel.test.tsx`, `src/settings/AiProviderSettings.tsx`, `src/settings/AiProviderSettings.test.tsx`, `src/auth/useSignOut.tsx`, `src/auth/useSignOut.test.tsx`

**Interfaces:**
- Produces: `src/ai/aiClient.ts` (`chatJson`, `testConnection`, `AiError`, `ChatMessage`, `extractJson`), `src/ai/aiSettings.ts` (unchanged API).

- [ ] **Step 1: Move the files with git**

```bash
mkdir -p src/ai
git mv src/matches/text/aiClient.ts src/ai/aiClient.ts
git mv src/matches/text/aiClient.test.ts src/ai/aiClient.test.ts
git mv src/matches/text/aiSettings.ts src/ai/aiSettings.ts
git mv src/matches/text/aiSettings.test.ts src/ai/aiSettings.test.ts
```

- [ ] **Step 2: Update every import**

Find them: `grep -rn "aiClient\|aiSettings" src --include=*.ts --include=*.tsx`. Rewrite:

- In `src/matches/text/*.ts(x)`: `'./aiClient'` → `'../../ai/aiClient'`, `'./aiSettings'` → `'../../ai/aiSettings'` (also inside any `vi.mock(...)` strings).
- In `src/settings/*` and `src/auth/*`: `'../matches/text/aiClient'` → `'../ai/aiClient'`, `'../matches/text/aiSettings'` → `'../ai/aiSettings'`.
- The moved files import each other with `'./aiSettings'` — leave as is.

- [ ] **Step 3: Run the full unit suite and typecheck**

Run: `npm test` then `npx tsc -b`
Expected: all tests PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "refactor(ai): move the AI client out of text scouting into src/ai"
```

---

### Task 2: `chatJson` temperature and `max_tokens`

**Files:**
- Modify: `src/ai/aiClient.ts`
- Modify: `src/matches/text/TextScoutPanel.tsx:77`
- Test: `src/ai/aiClient.test.ts`

**Interfaces:**
- Produces: `export const AI_MAX_TOKENS = { scout: 2000, draft: 4000 } as const;` `export const DRAFT_TEMPERATURE = 0.7;` and `ChatOptions` gains `temperature?: number; maxTokens?: number` (defaults `0` and `AI_MAX_TOKENS.scout`).

- [ ] **Step 1: Write the failing tests** (append inside `describe('chatJson', …)` in `src/ai/aiClient.test.ts`; also add `AI_MAX_TOKENS` to the import)

```ts
  it('caps every request with max_tokens (scout cap by default)', async () => {
    const fetchImpl = vi.fn(async () => reply('{}'));
    await chatJson(settings, messages, { fetchImpl });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.max_tokens).toBe(AI_MAX_TOKENS.scout);
    expect(body.temperature).toBe(0);
  });

  it('passes temperature and maxTokens through, also on the no-JSON-mode retry', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":{"message":"response_format is not supported"}}', { status: 400 }))
      .mockResolvedValueOnce(reply('{}'));
    await chatJson(settings, messages, { fetchImpl, temperature: 0.7, maxTokens: AI_MAX_TOKENS.draft });
    for (const call of fetchImpl.mock.calls) {
      const body = JSON.parse(call[1].body);
      expect(body).toMatchObject({ temperature: 0.7, max_tokens: 4000 });
    }
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ai/aiClient.test.ts`
Expected: FAIL — `AI_MAX_TOKENS` is not exported / `max_tokens` undefined.

- [ ] **Step 3: Implement**

In `src/ai/aiClient.ts`:

```ts
/** Hard caps per request so one prompt can't drain a provider quota. */
export const AI_MAX_TOKENS = { scout: 2000, draft: 4000 } as const;
/** Drafting wants variety; scouting stays deterministic (temperature 0). */
export const DRAFT_TEMPERATURE = 0.7;

interface ChatOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}
```

and in `chatJson` replace the `base` object:

```ts
  const base = {
    model: settings.model.trim(),
    messages,
    temperature: opts.temperature ?? 0,
    max_tokens: opts.maxTokens ?? AI_MAX_TOKENS.scout,
    ...(settings.provider === 'openrouter' ? OPENROUTER_PRIVACY : {}),
  };
```

In `src/matches/text/TextScoutPanel.tsx` line 77 make the cap explicit:

```ts
  const askModel = ask ?? ((messages: ChatMessage[], signal: AbortSignal) => chatJson(settings, messages, { signal, maxTokens: AI_MAX_TOKENS.scout }));
```

(add `AI_MAX_TOKENS` to its `'../../ai/aiClient'` import).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ai src/matches/text`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai/aiClient.ts src/ai/aiClient.test.ts src/matches/text/TextScoutPanel.tsx
git commit -m "feat(ai): cap max_tokens on every request and allow a drafting temperature"
```

---

### Task 3: Key hardening in settings

**Files:**
- Modify: `src/ai/aiSettings.ts`
- Modify: `src/settings/AiProviderSettings.tsx`
- Test: `src/ai/aiSettings.test.ts`, `src/settings/AiProviderSettings.test.tsx`, `src/settings/SettingsPage.test.tsx:94`

**Interfaces:**
- Produces: `DEFAULT_AI_SETTINGS.rememberKey === false`; `export function forgetAiKey(s: AiSettings): AiSettings` (writes and returns `{ ...s, apiKey: '' }`).

- [ ] **Step 1: Write the failing tests**

Append to `src/ai/aiSettings.test.ts` (add `forgetAiKey` to the import):

```ts
  it('keeps the key for this browser session only by default', () => {
    expect(DEFAULT_AI_SETTINGS.rememberKey).toBe(false);
    writeAiSettings({ ...DEFAULT_AI_SETTINGS, apiKey: 'gsk_x' });
    expect(localStorage.getItem('vcb.ai.settings')).not.toContain('gsk_x');
    expect(sessionStorage.getItem('vcb.ai.sessionKey')).toBe('gsk_x');
  });

  it('keeps remembering a key for settings saved before the default changed', () => {
    localStorage.setItem('vcb.ai.settings', JSON.stringify({ provider: 'groq', baseUrl: AI_PROVIDERS.groq.baseUrl, apiKey: 'old', model: 'm' }));
    expect(readAiSettings()).toMatchObject({ apiKey: 'old', rememberKey: true });
  });

  it('forgetAiKey clears the key from both storages and keeps the provider', () => {
    const remembered = { ...DEFAULT_AI_SETTINGS, apiKey: 'a', rememberKey: true };
    writeAiSettings(remembered);
    expect(forgetAiKey(remembered)).toEqual({ ...remembered, apiKey: '' });
    expect(localStorage.getItem('vcb.ai.settings')).not.toContain('"a"');
    const session = { ...DEFAULT_AI_SETTINGS, apiKey: 'b', rememberKey: false };
    writeAiSettings(session);
    forgetAiKey(session);
    expect(sessionStorage.getItem('vcb.ai.sessionKey')).toBeNull();
    expect(readAiSettings().apiKey).toBe('');
  });
```

The existing test `'defaults to Groq with its preset URL and model'` still passes (it compares against `DEFAULT_AI_SETTINGS`).

Append to `src/settings/AiProviderSettings.test.tsx`:

```ts
  it('Forget key removes the key from this device', () => {
    renderAi();
    const forget = screen.getByRole('button', { name: 'Forget key' });
    expect(forget).toBeDisabled();
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'gsk_test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forget key' }));
    expect(screen.getByLabelText('API key')).toHaveValue('');
    expect(readAiSettings().apiKey).toBe('');
    expect(sessionStorage.getItem('vcb.ai.sessionKey')).toBeNull();
  });

  it('leaves "Remember on this device" off for a fresh setup', () => {
    renderAi();
    expect(screen.getByLabelText('Remember on this device')).not.toBeChecked();
  });
```

In `src/settings/SettingsPage.test.tsx:94` change `'Text scouting (AI)'` → `'AI provider'`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ai/aiSettings.test.ts src/settings`
Expected: FAIL (`forgetAiKey` missing, default still `true`, no "Forget key" button, old section title).

- [ ] **Step 3: Implement**

`src/ai/aiSettings.ts` — in `DEFAULT_AI_SETTINGS` set `rememberKey: false`. Leave `readAiSettings`'s `v.rememberKey !== false` as is (older stored settings without the field keep remembering). Add after `writeAiSettings`:

```ts
/** Drops the key from localStorage and sessionStorage; provider and model stay. */
export function forgetAiKey(s: AiSettings): AiSettings {
  const next = { ...s, apiKey: '' };
  writeAiSettings(next);
  return next;
}
```

`src/settings/AiProviderSettings.tsx`:

- import `forgetAiKey` from `'../ai/aiSettings'` and `useNotify` from `'../components/Notice'`; `const notify = useNotify();` inside the component.
- Section header: `<SettingsSection title="AI provider" description="Used for text scouting and for drafting exercises and trainings.">`
- Test status text: `'Connected — AI features are ready.'` (update any test asserting the old text: `grep -rn "text scouting is ready" src`).
- Right after the "Remember on this device" `<label>`, add:

```tsx
            <Button
              variant="ghost"
              size="sm"
              disabled={!s.apiKey}
              onClick={() => {
                setS(forgetAiKey(s));
                setStatus(null);
                notify('API key removed from this device.');
              }}
            >
              Forget key
            </Button>
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ai src/settings src/auth`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai/aiSettings.ts src/ai/aiSettings.test.ts src/settings
git commit -m "feat(settings): session-only AI key by default and a Forget key action"
```

---

### Task 4: CSP Trusted Types (report-only), readiness item, Privacy page

**Files:**
- Modify: `firebase.json` (the `"source": "**"` headers block)
- Create: `src/ai/csp.test.ts`
- Modify: `docs/PRODUCTION-READINESS.md` (section B list)
- Modify: `src/legal/PrivacyPage.tsx`, Test: `src/legal/PrivacyPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/ai/csp.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(resolve(process.cwd(), 'firebase.json'), 'utf8')) as {
  hosting: { headers: { headers: { key: string; value: string }[] }[] };
};
const all = config.hosting.headers.flatMap((h) => h.headers);
const csp = all.find((h) => h.key === 'Content-Security-Policy')!.value;
const connectSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src'))!;

describe('CSP for AI requests', () => {
  it('lets the browser reach only Firebase, Groq, OpenRouter and this computer', () => {
    const hosts = connectSrc.split(/\s+/).slice(1);
    for (const h of hosts) {
      expect(h).toMatch(/^('self'|https:\/\/[^ ]*googleapis\.com|https:\/\/apis\.google\.com|https:\/\/api\.groq\.com|https:\/\/openrouter\.ai|http:\/\/localhost:\*|http:\/\/127\.0\.0\.1:\*)$/);
    }
  });

  it('reports (does not yet enforce) Trusted Types', () => {
    const ro = all.find((h) => h.key === 'Content-Security-Policy-Report-Only');
    expect(ro?.value).toBe("require-trusted-types-for 'script'");
  });
});
```

In `src/legal/PrivacyPage.test.tsx` change line 25's heading to `'AI features (optional)'` and add a test:

```ts
  it('describes AI drafting and where the provider key lives', () => {
    render(<MemoryRouter><PrivacyPage /></MemoryRouter>);
    expect(screen.getByText(/Draft with AI/)).toHaveTextContent(/No player, team, guardian or match data/);
    expect(screen.getByText(/removed on sign-out/)).toHaveTextContent(/for the browser session by default/);
  });
```

(match the file's existing render wrapper — if it renders without `MemoryRouter`, mirror that.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ai/csp.test.ts src/legal`
Expected: FAIL.

- [ ] **Step 3: Implement**

`firebase.json` — in the `"source": "**"` block, after the `Content-Security-Policy` entry, add:

```json
          {
            "key": "Content-Security-Policy-Report-Only",
            "value": "require-trusted-types-for 'script'"
          },
```

`docs/PRODUCTION-READINESS.md` — append to the section B list:

```markdown
- [ ] **Trusted Types: report-only → enforce** — `firebase.json` sends
      `Content-Security-Policy-Report-Only: require-trusted-types-for 'script'`.
      After deploy, sign in (email link), open a player card, scout a match and
      draft with AI with DevTools open; if no Trusted Types violations appear,
      move the directive into the enforced `Content-Security-Policy`.
```

`src/legal/PrivacyPage.tsx`:

- `const LAST_UPDATED = '15 October 2026';`
- Replace the whole `<Section title="Text scouting (optional)">…</Section>` with:

```tsx
      <Section title="AI features (optional)">
        <p>
          If a coach enables text scouting, their typed match notes are sent to the AI provider they choose in
          Settings (Groq by default, OpenRouter, another compatible service, or a model running on their own computer
          — in which case nothing leaves it) to be turned into scouting actions. Groq and OpenRouter are based in the
          United States, so these notes leave the EU. Through OpenRouter, notes only go to model providers that keep
          nothing and never train on them; Groq does not keep requests by default.
        </p>
        <p>
          Player names are replaced by jersey numbers on the device before sending; only jersey numbers, playing
          roles, the set, score, serving side and rotation, and the notes are sent. Coaches are asked not to type
          names (including opponents&apos;) or health details in the notes. Drafts are stored only on that device
          and removed on sign-out.
        </p>
        <p>
          When a coach uses &quot;Draft with AI&quot; for exercises or trainings, their request text and the names,
          categories and short descriptions of exercises in the club library are sent to the same provider. No
          player, team, guardian or match data is sent. Coaches are asked not to type personal data in requests.
        </p>
        <p>
          The provider key belongs to the coach&apos;s own account with that provider, and requests are made under
          the coach&apos;s own agreement with it. The key is stored only on the coach&apos;s device — for the
          browser session by default, or on that device if they choose to remember it — can be removed in Settings
          at any time, and is removed on sign-out.
        </p>
      </Section>
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ai src/legal src/awards/cutout/csp.test.ts src/seo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add firebase.json src/ai/csp.test.ts docs/PRODUCTION-READINESS.md src/legal
git commit -m "feat(privacy): describe AI drafting and key storage; report-only Trusted Types"
```

---

### Task 5: Draft types, court geometry, diagram guide, exercise validation

**Files:**
- Create: `src/diagrams/courtGeometry.ts`, `src/diagrams/courtGeometry.test.ts`
- Modify: `src/diagrams/primitives/CourtBackdrop.tsx:11-13`
- Modify: `src/diagrams/sceneFactory.ts` (add `sceneAsDiagram`), Test: `src/diagrams/sceneFactory.test.ts`
- Create: `src/aiDraft/types.ts`, `src/aiDraft/diagramPrompt.ts`, `src/aiDraft/diagramPrompt.test.ts`, `src/aiDraft/validateDraft.ts`, `src/aiDraft/validateDraft.test.ts`

**Interfaces:**
- Produces:
  - `courtGeometry(court: 'full' | 'half'): { left: number; right: number; top: number; bottom: number; netY: number }`
  - `sceneAsDiagram(id: string, scene: Scene, title?: string): Diagram`
  - types `ExerciseDraft`, `TrainingStepDraft`, `TrainingDraft`, `LibraryIndexEntry`, const `DRAFT_LIMITS`, `DRAFT_ITEM_TYPES`
  - `diagramFormatGuide(): string`
  - `toDraftScene(raw: unknown): { scene: Scene | null; issues: string[] }`
  - `validateExerciseDraft(raw: unknown): ExerciseDraft | null`
  - `validateExerciseProposals(raw: unknown, count: number): ExerciseDraft[]` (throws `AiError('badResponse')` when none survive)

- [ ] **Step 1: Write the failing tests**

`src/diagrams/courtGeometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { courtGeometry } from './courtGeometry';

describe('courtGeometry', () => {
  it('full court: net across the middle', () => {
    expect(courtGeometry('full')).toEqual({ left: 10, right: 90, top: 6, bottom: 94, netY: 50 });
  });
  it('half court: net along the top edge', () => {
    expect(courtGeometry('half')).toEqual({ left: 10, right: 90, top: 6, bottom: 72, netY: 6 });
  });
});
```

Append to `src/diagrams/sceneFactory.test.ts` (import `sceneAsDiagram`, `emptyScene`):

```ts
describe('sceneAsDiagram', () => {
  it('wraps an unsaved scene so diagram viewers can render it', () => {
    const scene = emptyScene('half');
    expect(sceneAsDiagram('d1', scene)).toEqual({ id: 'd1', title: 'AI draft', order: 0, scene, updatedBy: '', updatedAt: null });
  });
});
```

`src/aiDraft/diagramPrompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SCENE_LIMITS } from '../types/diagram';
import { diagramFormatGuide } from './diagramPrompt';

describe('diagramFormatGuide', () => {
  const guide = diagramFormatGuide();
  it('states the grid, both courts and the limits', () => {
    expect(guide).toContain('0-100');
    expect(guide).toContain('net at y=50');
    expect(guide).toContain('net at y=6');
    expect(guide).toContain(`at most ${SCENE_LIMITS.itemsPerScene} items`);
    expect(guide).toContain(`at most ${SCENE_LIMITS.labelLength} characters`);
  });
  it('only offers the item types drafts may use', () => {
    for (const t of ['player', 'ball', 'cone', 'arrow', 'text', 'zoneLabel']) expect(guide).toContain(`"type":"${t}"`);
    for (const t of ['ladder', 'net', 'pole', 'line']) expect(guide).not.toContain(`"type":"${t}"`);
  });
});
```

`src/aiDraft/validateDraft.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AiError } from '../ai/aiClient';
import { toDraftScene, validateExerciseDraft, validateExerciseProposals } from './validateDraft';

const goodDiagram = {
  court: 'full',
  items: [
    { type: 'player', x: 30, y: 80, label: 'P1', color: 'blue' },
    { type: 'arrow', from: { x: 50, y: 20 }, to: { x: 30, y: 78 }, style: 'shot' },
  ],
};

describe('toDraftScene', () => {
  it('builds a v1 scene with fresh ids', () => {
    const { scene, issues } = toDraftScene(goodDiagram);
    expect(issues).toEqual([]);
    expect(scene?.v).toBe(1);
    expect(scene?.court).toBe('full');
    expect(scene?.items).toHaveLength(2);
    expect(new Set(scene!.items.map((i) => i.id)).size).toBe(2);
  });

  it('drops disallowed and broken items one by one, keeping the rest', () => {
    const { scene, issues } = toDraftScene({
      court: 'half',
      items: [{ type: 'ladder', x: 1, y: 1, rungs: 4, length: 10 }, { type: 'arrow', from: { x: 1 } }, { type: 'cone', x: 20, y: 30 }, 'junk'],
    });
    expect(scene?.items.map((i) => i.type)).toEqual(['cone']);
    expect(issues).toEqual(['3 diagram items were dropped.']);
  });

  it('keeps text when no item survives', () => {
    expect(toDraftScene({ court: 'full', items: [{ type: 'arrow' }] })).toEqual({ scene: null, issues: ['The diagram could not be used.'] });
    expect(toDraftScene(undefined)).toEqual({ scene: null, issues: ['No diagram was proposed.'] });
  });

  it('defaults an unknown court to full and caps the item count', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ type: 'cone', x: i, y: 10 }));
    const { scene } = toDraftScene({ court: 'stadium', items: many });
    expect(scene?.court).toBe('full');
    expect(scene?.items).toHaveLength(60);
  });
});

describe('validateExerciseDraft', () => {
  it('trims and truncates text, keeps a valid category', () => {
    const d = validateExerciseDraft({ name: `  ${'n'.repeat(100)} `, category: 'reception', description: 'd'.repeat(2500), diagram: goodDiagram });
    expect(d?.name).toHaveLength(80);
    expect(d?.description).toHaveLength(2000);
    expect(d?.category).toBe('reception');
    expect(d?.scene).not.toBeNull();
    expect(d?.key).toMatch(/\w+/);
  });

  it('marks an unknown category for the coach to pick', () => {
    const d = validateExerciseDraft({ name: 'X', category: 'blocking', description: '' });
    expect(d?.category).toBeNull();
    expect(d?.issues).toContain('Pick a category.');
  });

  it('rejects a proposal without a name', () => {
    expect(validateExerciseDraft({ name: '  ', category: 'game' })).toBeNull();
    expect(validateExerciseDraft('nope')).toBeNull();
  });
});

describe('validateExerciseProposals', () => {
  it('keeps at most the requested count of valid proposals', () => {
    const raw = { exercises: [{ name: '' }, { name: 'A', category: 'game' }, { name: 'B', category: 'game' }, { name: 'C', category: 'game' }] };
    expect(validateExerciseProposals(raw, 2).map((d) => d.name)).toEqual(['A', 'B']);
  });

  it('throws badResponse when nothing is usable', () => {
    expect(() => validateExerciseProposals({ exercises: [] }, 3)).toThrow(AiError);
    expect(() => validateExerciseProposals({ nope: 1 }, 3)).toThrow(/no usable exercises/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/diagrams/courtGeometry.test.ts src/diagrams/sceneFactory.test.ts src/aiDraft`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/diagrams/courtGeometry.ts`:

```ts
/** Court lines on the 0–100 diagram grid. Shared by the renderer and the AI prompt so they can't drift. */
export function courtGeometry(court: 'full' | 'half') {
  const top = 6;
  const bottom = court === 'full' ? 94 : 72;
  return { left: 10, right: 90, top, bottom, netY: court === 'full' ? (top + bottom) / 2 : top };
}
```

`src/diagrams/primitives/CourtBackdrop.tsx` — import `courtGeometry` from `'../courtGeometry'` and replace lines 11–13 with:

```ts
  const { top, bottom, netY } = courtGeometry(court);
```

`src/diagrams/sceneFactory.ts` — add (`Diagram` to the type import from `'../types/diagram'`):

```ts
/** An unsaved scene shaped as a `Diagram`, for viewers (lightbox, detail sheet) that render diagrams. */
export function sceneAsDiagram(id: string, scene: Scene, title = 'AI draft'): Diagram {
  return { id, title, order: 0, scene, updatedBy: '', updatedAt: null };
}
```

`src/aiDraft/types.ts`:

```ts
import type { ExerciseCategory } from '../types/exercise';
import type { DiagramItemType, Scene } from '../types/diagram';

export const DRAFT_LIMITS = {
  nameMax: 80,
  descriptionMax: 2000,
  requestMax: 500,
  minutesMin: 1,
  minutesMax: 60,
  maxSteps: 20,
  maxProposals: 5,
  indexCap: 150,
  existingNamesCap: 50,
} as const;

/** Item types the model may place; the rest stay editor-only. */
export const DRAFT_ITEM_TYPES: readonly DiagramItemType[] = ['player', 'ball', 'cone', 'arrow', 'text', 'zoneLabel'];

export interface ExerciseDraft {
  /** Local id; also the key that remembers the saved exercise id across a retry. */
  key: string;
  name: string;
  /** null => the model's category was unusable; the coach must pick one. */
  category: ExerciseCategory | null;
  description: string;
  /** null => no usable diagram. */
  scene: Scene | null;
  issues: string[];
}

export interface LibraryIndexEntry {
  id: string;
  name: string;
  category: ExerciseCategory;
  /** Full description; the prompt line truncates it. */
  description: string;
}

export type TrainingStepDraft =
  | { kind: 'library'; exerciseId: string; name: string; category: ExerciseCategory; description: string; minutes: number }
  | { kind: 'new'; exercise: ExerciseDraft; minutes: number };

export interface TrainingDraft {
  name: string;
  description: string;
  ageGroupTarget: string;
  steps: TrainingStepDraft[];
  issues: string[];
}
```

`src/aiDraft/diagramPrompt.ts`:

```ts
import { courtGeometry } from '../diagrams/courtGeometry';
import { PALETTE_COLORS, SCENE_LIMITS } from '../types/diagram';

export function diagramFormatGuide(): string {
  const full = courtGeometry('full');
  const half = courtGeometry('half');
  return [
    'Diagram format: {"court":"full"|"half"|"blank","showZones":boolean,"items":[...]} on a 0-100 grid (x left to right, y top to bottom).',
    `Full court: lines x ${full.left}-${full.right}, y ${full.top}-${full.bottom}, net at y=${full.netY}; our side is the bottom half.`,
    `Half court: lines x ${half.left}-${half.right}, y ${half.top}-${half.bottom}, net at y=${half.netY}.`,
    `At most ${SCENE_LIMITS.itemsPerScene} items. Optional "color" on any item: ${PALETTE_COLORS.join('|')}.`,
    'Item shapes:',
    `- {"type":"player","x":n,"y":n,"label":string} (label at most ${SCENE_LIMITS.labelLength} characters, e.g. "S", "OH", "1")`,
    '- {"type":"ball","x":n,"y":n}',
    '- {"type":"cone","x":n,"y":n}',
    '- {"type":"arrow","from":{"x":n,"y":n},"to":{"x":n,"y":n},"style":"pass"|"shot"|"run","curved":boolean}',
    `- {"type":"text","x":n,"y":n,"content":string} (at most ${SCENE_LIMITS.textLength} characters)`,
    '- {"type":"zoneLabel","x":n,"y":n,"zone":1-6}',
    'Use color to tell groups apart (for example blue for players, red for the coach or feeder).',
  ].join('\n');
}
```

`src/aiDraft/validateDraft.ts`:

```ts
import { AiError } from '../ai/aiClient';
import { isPlainObject } from '../bulkImport/parseJsonArray';
import { parseScene } from '../diagrams/parseScene';
import { newId } from '../diagrams/sceneFactory';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../types/exercise';
import { SCENE_LIMITS, type CourtPreset, type DiagramItem, type Scene } from '../types/diagram';
import { DRAFT_ITEM_TYPES, DRAFT_LIMITS, type ExerciseDraft } from './types';

const CATEGORY_KEYS = new Set<string>(EXERCISE_CATEGORIES.map((c) => c.key));
const COURTS: CourtPreset[] = ['full', 'half', 'blank'];
const ALLOWED = new Set<string>(DRAFT_ITEM_TYPES);

export function isCategory(v: unknown): v is ExerciseCategory {
  return typeof v === 'string' && CATEGORY_KEYS.has(v);
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Model diagram → repaired scene. Each item is checked on its own so one bad item doesn't sink the rest. */
export function toDraftScene(raw: unknown): { scene: Scene | null; issues: string[] } {
  if (!isPlainObject(raw)) return { scene: null, issues: ['No diagram was proposed.'] };
  const court = COURTS.includes(raw.court as CourtPreset) ? (raw.court as CourtPreset) : 'full';
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: DiagramItem[] = [];
  let dropped = 0;
  for (const item of rawItems) {
    if (items.length >= SCENE_LIMITS.itemsPerScene) break;
    if (!isPlainObject(item) || typeof item.type !== 'string' || !ALLOWED.has(item.type)) {
      dropped++;
      continue;
    }
    const one = parseScene({ v: 1, court, items: [{ ...item, id: newId() }] });
    if (one.ok && one.scene.items.length === 1) items.push(one.scene.items[0]);
    else dropped++;
  }
  if (items.length === 0) return { scene: null, issues: ['The diagram could not be used.'] };
  const issues = dropped > 0 ? [`${dropped} diagram item${dropped === 1 ? ' was' : 's were'} dropped.`] : [];
  return { scene: { v: 1, court, showZones: raw.showZones === true, items }, issues };
}

export function validateExerciseDraft(raw: unknown): ExerciseDraft | null {
  if (!isPlainObject(raw)) return null;
  const name = text(raw.name, DRAFT_LIMITS.nameMax);
  if (!name) return null;
  const category = isCategory(raw.category) ? raw.category : null;
  const diagram = toDraftScene(raw.diagram);
  return {
    key: newId(),
    name,
    category,
    description: text(raw.description, DRAFT_LIMITS.descriptionMax),
    scene: diagram.scene,
    issues: [...(category ? [] : ['Pick a category.']), ...diagram.issues],
  };
}

export function validateExerciseProposals(raw: unknown, count: number): ExerciseDraft[] {
  const list = isPlainObject(raw) && Array.isArray(raw.exercises) ? raw.exercises : [];
  const drafts = list
    .map(validateExerciseDraft)
    .filter((d): d is ExerciseDraft => d !== null)
    .slice(0, count);
  if (drafts.length === 0) throw new AiError('badResponse', 'The model returned no usable exercises.');
  return drafts;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/diagrams src/aiDraft`
Expected: PASS (including existing `primitives.test.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/diagrams src/aiDraft
git commit -m "feat(ai-draft): draft types, shared court geometry and exercise/diagram validation"
```

---

### Task 6: Training proposal validation

**Files:**
- Modify: `src/aiDraft/validateDraft.ts`
- Test: `src/aiDraft/validateDraft.test.ts`

**Interfaces:**
- Consumes: `validateExerciseDraft`, `LibraryIndexEntry`, `TrainingDraft`, `DRAFT_LIMITS` (Task 5).
- Produces: `validateTrainingProposal(raw: unknown, opts: { index: LibraryIndexEntry[]; allowNew: boolean; ageGroupTarget: string }): TrainingDraft` (throws `AiError('badResponse')` when no step survives).

- [ ] **Step 1: Write the failing tests** (append; add `validateTrainingProposal` to the import)

```ts
describe('validateTrainingProposal', () => {
  const index = [
    { id: 'ex-1', name: 'Pepper', category: 'warmup' as const, description: 'Pairs' },
    { id: 'ex-2', name: 'Queen of the court', category: 'game' as const, description: 'Game' },
  ];
  const opts = { index, allowNew: true, ageGroupTarget: 'U15' };

  it('maps library steps and new exercises, clamping minutes', () => {
    const d = validateTrainingProposal(
      {
        name: 'Receive day',
        description: 'Focus on passing',
        steps: [
          { exerciseId: 'ex-1', minutes: 0 },
          { new: { name: 'Short serve receive', category: 'reception', description: 'x' }, minutes: 25.6 },
          { exerciseId: 'ex-2', minutes: 300 },
        ],
      },
      opts,
    );
    expect(d.name).toBe('Receive day');
    expect(d.ageGroupTarget).toBe('U15');
    expect(d.steps.map((s) => [s.kind, s.minutes])).toEqual([['library', 1], ['new', 26], ['library', 60]]);
    expect(d.steps[0]).toMatchObject({ exerciseId: 'ex-1', name: 'Pepper', category: 'warmup', description: 'Pairs' });
  });

  it('drops unknown and whitespace-padded ids', () => {
    const d = validateTrainingProposal({ name: 'T', steps: [{ exerciseId: ' ex-1 ', minutes: 10 }, { exerciseId: 'made-up', minutes: 10 }, { exerciseId: 'ex-2', minutes: 10 }] }, opts);
    expect(d.steps).toHaveLength(1);
    expect(d.issues).toEqual(['2 steps used exercises that are not in the library and were dropped.']);
  });

  it('drops new exercises when they are not allowed or have no valid category', () => {
    const steps = [{ new: { name: 'A', category: 'game' }, minutes: 10 }, { new: { name: 'B', category: 'nope' }, minutes: 10 }, { exerciseId: 'ex-1', minutes: 10 }];
    expect(validateTrainingProposal({ name: 'T', steps }, { ...opts, allowNew: false }).steps).toHaveLength(1);
    const allowed = validateTrainingProposal({ name: 'T', steps }, opts);
    expect(allowed.steps.map((s) => s.kind)).toEqual(['new', 'library']);
    expect(allowed.issues).toContain('1 new exercise had no valid category and was dropped.');
  });

  it('falls back to a default name, caps steps at 20 and rejects an empty plan', () => {
    const many = Array.from({ length: 30 }, () => ({ exerciseId: 'ex-1', minutes: 5 }));
    const d = validateTrainingProposal({ steps: many }, opts);
    expect(d.name).toBe('AI training');
    expect(d.steps).toHaveLength(20);
    expect(() => validateTrainingProposal({ name: 'T', steps: [] }, opts)).toThrow(AiError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/aiDraft/validateDraft.test.ts`
Expected: FAIL (`validateTrainingProposal` missing).

- [ ] **Step 3: Implement** (append to `src/aiDraft/validateDraft.ts`; extend the `./types` import with `LibraryIndexEntry`, `TrainingDraft`, `TrainingStepDraft`)

```ts
function minutes(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 10;
  return Math.max(DRAFT_LIMITS.minutesMin, Math.min(DRAFT_LIMITS.minutesMax, n));
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function validateTrainingProposal(
  raw: unknown,
  opts: { index: LibraryIndexEntry[]; allowNew: boolean; ageGroupTarget: string },
): TrainingDraft {
  const obj = isPlainObject(raw) ? raw : {};
  const byId = new Map(opts.index.map((e) => [e.id, e]));
  const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];
  const steps: TrainingStepDraft[] = [];
  let unknownIds = 0;
  let newOff = 0;
  let newNoCategory = 0;
  for (const s of rawSteps) {
    if (steps.length >= DRAFT_LIMITS.maxSteps || !isPlainObject(s)) continue;
    if (typeof s.exerciseId === 'string') {
      const hit = byId.get(s.exerciseId);
      if (!hit) {
        unknownIds++;
        continue;
      }
      steps.push({ kind: 'library', exerciseId: hit.id, name: hit.name, category: hit.category, description: hit.description, minutes: minutes(s.minutes) });
    } else if (isPlainObject(s.new)) {
      if (!opts.allowNew) {
        newOff++;
        continue;
      }
      const exercise = validateExerciseDraft(s.new);
      if (!exercise) continue;
      if (!exercise.category) {
        newNoCategory++;
        continue;
      }
      steps.push({ kind: 'new', exercise, minutes: minutes(s.minutes) });
    }
  }
  if (steps.length === 0) throw new AiError('badResponse', 'The model returned no usable steps.');
  const issues: string[] = [];
  if (unknownIds) issues.push(`${unknownIds} ${plural(unknownIds, 'step used an exercise that is', 'steps used exercises that are')} not in the library and ${plural(unknownIds, 'was', 'were')} dropped.`);
  if (newOff) issues.push(`${newOff} new ${plural(newOff, 'exercise was', 'exercises were')} dropped because new exercises are off.`);
  if (newNoCategory) issues.push(`${newNoCategory} new ${plural(newNoCategory, 'exercise had', 'exercises had')} no valid category and ${plural(newNoCategory, 'was', 'were')} dropped.`);
  return {
    name: text(obj.name, DRAFT_LIMITS.nameMax) || 'AI training',
    description: text(obj.description, DRAFT_LIMITS.descriptionMax),
    // The coach's own age group wins over the model's guess.
    ageGroupTarget: opts.ageGroupTarget || text(obj.ageGroupTarget, 40),
    steps,
    issues,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/aiDraft/validateDraft.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aiDraft/validateDraft.ts src/aiDraft/validateDraft.test.ts
git commit -m "feat(ai-draft): validate training proposals against the sent library index"
```

---

### Task 7: Library index loading

**Files:**
- Create: `src/aiDraft/libraryIndex.ts`, `src/aiDraft/libraryIndex.test.ts`

**Interfaces:**
- Consumes: `listExercises(afterDoc, category)` from `src/exercises/exercisesApi.ts` (page size 25, returns `{ exercises, lastDoc, hasMore }`).
- Produces:
  - `categoriesForGoal(goal: string): ExerciseCategory[] | null`
  - `loadLibraryIndex(goal: string): Promise<LibraryIndexEntry[]>` (≤ 150)
  - `existingExerciseNames(category: ExerciseCategory | null): Promise<string[]>` (≤ 50, ≤ 2 pages)

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as exercisesApi from '../exercises/exercisesApi';
import type { Exercise, ExerciseCategory } from '../types/exercise';
import { categoriesForGoal, existingExerciseNames, loadLibraryIndex } from './libraryIndex';

vi.mock('../exercises/exercisesApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const ex = (id: string, category: ExerciseCategory): Exercise => ({
  id, name: `Ex ${id}`, description: `Desc ${id}`, category, createdBy: 'uid-secret', createdAt: null,
});

function pages(total: number, category: ExerciseCategory) {
  let served = 0;
  vi.mocked(exercisesApi.listExercises).mockImplementation(async (after, cat) => {
    const size = Math.min(25, total - served);
    const exercises = Array.from({ length: size }, (_, i) => ex(`${cat ?? category}-${served + i}`, cat ?? category));
    served += size;
    return { exercises, lastDoc: (size ? {} : null) as never, hasMore: served < total };
  });
}

describe('categoriesForGoal', () => {
  it('maps coaching words to categories and always adds warm-up and game', () => {
    expect(categoriesForGoal('Serve receive for U15')).toEqual(['service', 'reception', 'warmup', 'game']);
    expect(categoriesForGoal('blocking and digging')).toEqual(['defense', 'warmup', 'game']);
  });
  it('returns null when nothing matches (unfiltered library)', () => {
    expect(categoriesForGoal('a fun Friday session')).toBeNull();
  });
});

describe('loadLibraryIndex', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads pages unfiltered up to the 150 cap', async () => {
    pages(400, 'game');
    const index = await loadLibraryIndex('a fun Friday session');
    expect(index).toHaveLength(150);
    expect(exercisesApi.listExercises).toHaveBeenCalledTimes(6);
    expect(vi.mocked(exercisesApi.listExercises).mock.calls.every(([, cat]) => cat === null)).toBe(true);
  });

  it('queries only the matched categories', async () => {
    pages(10, 'game');
    await loadLibraryIndex('serve practice');
    const cats = vi.mocked(exercisesApi.listExercises).mock.calls.map(([, cat]) => cat);
    expect(new Set(cats)).toEqual(new Set(['service', 'warmup', 'game']));
  });

  it('never carries createdBy into the index', async () => {
    pages(3, 'game');
    const index = await loadLibraryIndex('anything');
    expect(JSON.stringify(index)).not.toContain('uid-secret');
    expect(Object.keys(index[0]).sort()).toEqual(['category', 'description', 'id', 'name']);
  });
});

describe('existingExerciseNames', () => {
  beforeEach(() => vi.clearAllMocks());
  it('reads at most two pages and 50 names', async () => {
    pages(200, 'game');
    const names = await existingExerciseNames('game');
    expect(names).toHaveLength(50);
    expect(exercisesApi.listExercises).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/aiDraft/libraryIndex.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `src/aiDraft/libraryIndex.ts`

```ts
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { listExercises } from '../exercises/exercisesApi';
import type { Exercise, ExerciseCategory } from '../types/exercise';
import { DRAFT_LIMITS, type LibraryIndexEntry } from './types';

/** Coaching words → category. Order here is the order of the returned list. */
const GOAL_WORDS: [ExerciseCategory, string[]][] = [
  ['warmup', ['warm']],
  ['physical', ['physical', 'fitness', 'conditioning', 'jump', 'agility']],
  ['service', ['serve', 'serving', 'service']],
  ['reception', ['receive', 'reception', 'passing', 'pass']],
  ['setting', ['setting', 'setter', 'set']],
  ['attack', ['attack', 'spike', 'hitting', 'hit']],
  ['defense', ['defense', 'defence', 'dig', 'block']],
  ['compound', ['compound', 'combined', 'transition']],
  ['game', ['game', 'scrimmage', 'match']],
];

export function categoriesForGoal(goal: string): ExerciseCategory[] | null {
  const g = goal.toLowerCase();
  const hits = GOAL_WORDS.filter(([, words]) => words.some((w) => new RegExp(`\\b${w}`).test(g))).map(([c]) => c);
  if (hits.length === 0) return null;
  return [...new Set<ExerciseCategory>([...hits, 'warmup', 'game'])];
}

const toEntry = (e: Exercise): LibraryIndexEntry => ({ id: e.id, name: e.name, category: e.category, description: e.description });

async function collect(category: ExerciseCategory | null, cap: number, maxPages = Infinity): Promise<Exercise[]> {
  const out: Exercise[] = [];
  let after: QueryDocumentSnapshot | null = null;
  for (let page = 0; page < maxPages && out.length < cap; page++) {
    const res = await listExercises(after, category);
    out.push(...res.exercises);
    if (!res.hasMore || !res.lastDoc) break;
    after = res.lastDoc;
  }
  return out.slice(0, cap);
}

/** Bounded library index for a training prompt: matched categories (plus warm-up and game), or the whole library, capped. */
export async function loadLibraryIndex(goal: string): Promise<LibraryIndexEntry[]> {
  const cats = categoriesForGoal(goal);
  if (!cats) return (await collect(null, DRAFT_LIMITS.indexCap)).map(toEntry);
  const out: Exercise[] = [];
  for (const c of cats) {
    if (out.length >= DRAFT_LIMITS.indexCap) break;
    out.push(...(await collect(c, DRAFT_LIMITS.indexCap - out.length)));
  }
  return out.map(toEntry);
}

/** Names the model must not repeat when drafting exercises. */
export async function existingExerciseNames(category: ExerciseCategory | null): Promise<string[]> {
  return (await collect(category, DRAFT_LIMITS.existingNamesCap, 2)).map((e) => e.name);
}
```

If the regex for `'set'` over-matches during manual testing (e.g. "settle"), that is acceptable — it only widens the index.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/aiDraft/libraryIndex.test.ts`
Expected: PASS. (In the "serve practice" test `practice` must not match anything — it doesn't.)

- [ ] **Step 5: Commit**

```bash
git add src/aiDraft/libraryIndex.ts src/aiDraft/libraryIndex.test.ts
git commit -m "feat(ai-draft): bounded library index and existing-name loader"
```

---

### Task 8: Prompt builders

**Files:**
- Create: `src/aiDraft/exercisePrompt.ts`, `src/aiDraft/exercisePrompt.test.ts`, `src/aiDraft/trainingPrompt.ts`, `src/aiDraft/trainingPrompt.test.ts`

**Interfaces:**
- Consumes: `ChatMessage` (`src/ai/aiClient.ts`), `diagramFormatGuide`, `LibraryIndexEntry`, `EXERCISE_CATEGORIES`.
- Produces:
  - `buildExerciseMessages(input: { request: string; category: ExerciseCategory | null; count: number; existingNames: string[]; alreadyProposed: string[] }): ChatMessage[]`
  - `libraryIndexLine(e: LibraryIndexEntry): string`
  - `buildTrainingMessages(input: { goal: string; ageGroupTarget: string; totalMinutes: number; allowNew: boolean; index: LibraryIndexEntry[] }): ChatMessage[]`

- [ ] **Step 1: Write the failing tests**

`src/aiDraft/exercisePrompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildExerciseMessages } from './exercisePrompt';

describe('buildExerciseMessages', () => {
  const msgs = buildExerciseMessages({ request: 'serve receive, 9 players', category: 'reception', count: 3, existingNames: ['Pepper', 'Butterfly'], alreadyProposed: ['Kept one'] });
  const [system, user] = msgs;

  it('is one system and one user message', () => {
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user']);
  });
  it('asks for JSON with the allowed categories and the diagram guide', () => {
    expect(system.content).toContain('{"exercises":[');
    expect(system.content).toContain('warmup, physical, service, setting, defense, reception, attack, compound, game');
    expect(system.content).toContain('Diagram format');
  });
  it('lists library names and already-kept proposals to avoid duplicates', () => {
    expect(system.content).toContain('Pepper; Butterfly');
    expect(user.content).toContain('Kept one');
  });
  it('carries the request, count and category', () => {
    expect(user.content).toContain('serve receive, 9 players');
    expect(user.content).toContain('Count: 3');
    expect(user.content).toContain('Category: reception');
  });
});
```

`src/aiDraft/trainingPrompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTrainingMessages, libraryIndexLine } from './trainingPrompt';

const entry = { id: 'ex-1', name: 'Pepper', category: 'warmup' as const, description: `Line one\nline two ${'x'.repeat(200)}` };

describe('libraryIndexLine', () => {
  it('is id | name | category | first 80 chars of a one-line description', () => {
    const line = libraryIndexLine(entry);
    expect(line.startsWith('ex-1 | Pepper | warmup | Line one line two ')).toBe(true);
    expect(line.split(' | ')[3]).toHaveLength(80);
  });
});

describe('buildTrainingMessages', () => {
  it('sends only the documented payload', () => {
    const [system, user] = buildTrainingMessages({ goal: 'serve receive', ageGroupTarget: 'U15', totalMinutes: 90, allowNew: true, index: [entry] });
    expect(system.content).toContain('ex-1 | Pepper | warmup');
    expect(system.content).toContain('"new"');
    expect(system.content).toContain('Diagram format');
    expect(system.content).not.toContain('createdBy');
    expect(user.content).toBe('Goal: serve receive\nAge group: U15\nTotal minutes: 90');
  });
  it('omits new-exercise instructions when not allowed and handles an empty library', () => {
    const [system] = buildTrainingMessages({ goal: 'g', ageGroupTarget: '', totalMinutes: 60, allowNew: false, index: [] });
    expect(system.content).not.toContain('"new"');
    expect(system.content).not.toContain('Diagram format');
    expect(system.content).toContain('(the library is empty)');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/aiDraft/exercisePrompt.test.ts src/aiDraft/trainingPrompt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/aiDraft/exercisePrompt.ts`:

```ts
import type { ChatMessage } from '../ai/aiClient';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../types/exercise';
import { diagramFormatGuide } from './diagramPrompt';
import { DRAFT_LIMITS } from './types';

export const CATEGORY_LIST = EXERCISE_CATEGORIES.map((c) => c.key).join(', ');

export const EXERCISE_SHAPE = `{"name":string,"category":string,"description":string,"diagram":object}`;

export function exerciseRules(): string {
  return [
    `"category" is one of: ${CATEGORY_LIST}.`,
    `"name" at most ${DRAFT_LIMITS.nameMax} characters. "description" is plain text, at most 1200 characters: setup, how it runs, coaching points, one variation.`,
    'Never include names of real people.',
    diagramFormatGuide(),
  ].join('\n');
}

export function buildExerciseMessages(input: {
  request: string;
  category: ExerciseCategory | null;
  count: number;
  existingNames: string[];
  alreadyProposed: string[];
}): ChatMessage[] {
  const system = [
    'You design volleyball training exercises for a club coach.',
    `Reply only with a JSON object: {"exercises":[${EXERCISE_SHAPE}]}.`,
    exerciseRules(),
    input.existingNames.length ? `The club library already has these exercises; do not repeat them: ${input.existingNames.join('; ')}.` : '',
  ].filter(Boolean).join('\n\n');
  const user = [
    `Request: ${input.request}`,
    `Count: ${input.count}`,
    `Category: ${input.category ?? 'any'}`,
    input.alreadyProposed.length ? `Already proposed, propose different ones: ${input.alreadyProposed.join('; ')}` : '',
  ].filter(Boolean).join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}
```

`src/aiDraft/trainingPrompt.ts`:

```ts
import type { ChatMessage } from '../ai/aiClient';
import { EXERCISE_SHAPE, exerciseRules } from './exercisePrompt';
import { DRAFT_LIMITS, type LibraryIndexEntry } from './types';

export function libraryIndexLine(e: LibraryIndexEntry): string {
  const desc = e.description.replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${e.id} | ${e.name} | ${e.category} | ${desc}`;
}

export function buildTrainingMessages(input: {
  goal: string;
  ageGroupTarget: string;
  totalMinutes: number;
  allowNew: boolean;
  index: LibraryIndexEntry[];
}): ChatMessage[] {
  const stepShape = input.allowNew
    ? `{"exerciseId":string,"minutes":number} or {"new":${EXERCISE_SHAPE},"minutes":number}`
    : `{"exerciseId":string,"minutes":number}`;
  const system = [
    'You plan volleyball training sessions for a club coach.',
    `Reply only with a JSON object: {"name":string,"description":string,"ageGroupTarget":string,"steps":[${stepShape}]}.`,
    `Use library exercises by their exact id. Start with a warm-up and end with a game when the library allows. Minutes per step ${DRAFT_LIMITS.minutesMin}-${DRAFT_LIMITS.minutesMax}, at most ${DRAFT_LIMITS.maxSteps} steps, total close to the target.`,
    input.allowNew ? `Only when no library exercise fits, add a new one with "new":\n${exerciseRules()}` : 'Use only library exercises.',
    `Library (id | name | category | description):\n${input.index.length ? input.index.map(libraryIndexLine).join('\n') : '(the library is empty)'}`,
  ].join('\n\n');
  const user = `Goal: ${input.goal}\nAge group: ${input.ageGroupTarget}\nTotal minutes: ${input.totalMinutes}`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/aiDraft`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aiDraft/exercisePrompt.ts src/aiDraft/exercisePrompt.test.ts src/aiDraft/trainingPrompt.ts src/aiDraft/trainingPrompt.test.ts
git commit -m "feat(ai-draft): exercise and training prompt builders"
```

---

### Task 9: Save orchestration, runner and step ops

**Files:**
- Create: `src/aiDraft/saveDrafts.ts`, `src/aiDraft/saveDrafts.test.ts`, `src/aiDraft/draftRunner.ts`, `src/aiDraft/draftRunner.test.ts`, `src/aiDraft/trainingDraftOps.ts`, `src/aiDraft/trainingDraftOps.test.ts`

**Interfaces:**
- Consumes: `createExercise(input, uid): Promise<string>`, `saveDiagramSet(exerciseId, ops, uid)`, `createTraining(input, uid): Promise<{ id; businessId }>`, `AiError`.
- Produces:
  - `class DraftSaveError extends Error`
  - `saveExerciseDrafts(drafts: ExerciseDraft[], uid: string, created: Map<string, string>): Promise<string[]>`
  - `trainingDraftToInput(draft: TrainingDraft, created: Map<string, string>): NewTrainingInput`
  - `saveTrainingDraft(draft: TrainingDraft, uid: string, created: Map<string, string>): Promise<{ id: string; businessId: string }>`
  - `type AskFn = (messages: ChatMessage[], signal: AbortSignal) => Promise<unknown>`
  - `runDraft<T>(call: () => Promise<unknown>, validate: (raw: unknown) => T): Promise<T>`
  - `draftErrorText(e: unknown): string`, `needsSettings(e: unknown): boolean`
  - `moveStep(d, i, delta)`, `removeStep(d, i)`, `setStepMinutes(d, i, m)`, `totalMinutes(d)`, `stepName(s)` — all pure on `TrainingDraft`

- [ ] **Step 1: Write the failing tests**

`src/aiDraft/saveDrafts.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as exercisesApi from '../exercises/exercisesApi';
import * as diagramsApi from '../diagrams/diagramsApi';
import * as trainingsApi from '../trainings/trainingsApi';
import { emptyScene } from '../diagrams/sceneFactory';
import { DraftSaveError, saveExerciseDrafts, saveTrainingDraft } from './saveDrafts';
import type { ExerciseDraft, TrainingDraft } from './types';

vi.mock('../exercises/exercisesApi');
vi.mock('../diagrams/diagramsApi');
vi.mock('../trainings/trainingsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const draft = (key: string, withScene = true): ExerciseDraft => ({
  key, name: `Name ${key}`, category: 'game', description: 'd', scene: withScene ? emptyScene('full') : null, issues: [],
});

describe('saveExerciseDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let n = 0;
    vi.mocked(exercisesApi.createExercise).mockImplementation(async () => `id-${++n}`);
    vi.mocked(diagramsApi.saveDiagramSet).mockResolvedValue({ idMap: {} });
  });

  it('creates each exercise, then its diagram titled "AI draft"', async () => {
    const ids = await saveExerciseDrafts([draft('a'), draft('b', false)], 'u1', new Map());
    expect(ids).toEqual(['id-1', 'id-2']);
    expect(exercisesApi.createExercise).toHaveBeenCalledWith({ name: 'Name a', category: 'game', description: 'd' }, 'u1');
    expect(diagramsApi.saveDiagramSet).toHaveBeenCalledTimes(1);
    expect(vi.mocked(diagramsApi.saveDiagramSet).mock.calls[0][1].creates[0]).toMatchObject({ title: 'AI draft', order: 0 });
  });

  it('retry does not re-create exercises', async () => {
    const created = new Map<string, string>();
    vi.mocked(exercisesApi.createExercise).mockResolvedValueOnce('id-1').mockRejectedValueOnce(new Error('net'));
    await expect(saveExerciseDrafts([draft('a'), draft('b')], 'u1', created)).rejects.toThrow('Could not add “Name b”. Already added: Name a.');
    vi.mocked(exercisesApi.createExercise).mockResolvedValueOnce('id-2');
    await expect(saveExerciseDrafts([draft('a'), draft('b')], 'u1', created)).resolves.toEqual(['id-1', 'id-2']);
    expect(exercisesApi.createExercise).toHaveBeenCalledTimes(3);
  });

  it('reports an exercise saved without its diagram and stops', async () => {
    vi.mocked(diagramsApi.saveDiagramSet).mockRejectedValueOnce(new Error('rules'));
    const err = await saveExerciseDrafts([draft('a'), draft('b')], 'u1', new Map()).catch((e) => e);
    expect(err).toBeInstanceOf(DraftSaveError);
    expect(err.message).toBe('“Name a” was added without its diagram — add one in the diagram editor.');
    expect(exercisesApi.createExercise).toHaveBeenCalledTimes(1);
  });

  it('refuses a draft without a category before writing anything', async () => {
    await expect(saveExerciseDrafts([{ ...draft('a'), category: null }], 'u1', new Map())).rejects.toThrow('“Name a” needs a category.');
    expect(exercisesApi.createExercise).not.toHaveBeenCalled();
  });
});

describe('saveTrainingDraft', () => {
  const training: TrainingDraft = {
    name: 'T', description: 'D', ageGroupTarget: 'U15', issues: [],
    steps: [
      { kind: 'library', exerciseId: 'lib-1', name: 'L', category: 'warmup', description: '', minutes: 10 },
      { kind: 'new', exercise: draft('n'), minutes: 20 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exercisesApi.createExercise).mockResolvedValue('new-1');
    vi.mocked(diagramsApi.saveDiagramSet).mockResolvedValue({ idMap: {} });
    vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't1', businessId: 'TR-0001' });
  });

  it('creates new exercises first, then the training with real ids in order', async () => {
    await expect(saveTrainingDraft(training, 'u1', new Map())).resolves.toEqual({ id: 't1', businessId: 'TR-0001' });
    expect(trainingsApi.createTraining).toHaveBeenCalledWith(
      { name: 'T', description: 'D', ageGroupTarget: 'U15', exercises: [
        { exerciseId: 'lib-1', order: 1, durationMinutes: 10 },
        { exerciseId: 'new-1', order: 2, durationMinutes: 20 },
      ] },
      'u1',
    );
  });

  it('says the exercises were kept when only the training failed', async () => {
    vi.mocked(trainingsApi.createTraining).mockRejectedValueOnce(new Error('tx'));
    const created = new Map<string, string>();
    await expect(saveTrainingDraft(training, 'u1', created)).rejects.toThrow('The new exercises were saved, but the training was not. Try Save again.');
    await saveTrainingDraft(training, 'u1', created);
    expect(exercisesApi.createExercise).toHaveBeenCalledTimes(1);
  });
});
```

`src/aiDraft/draftRunner.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { AiError } from '../ai/aiClient';
import { draftErrorText, needsSettings, runDraft } from './draftRunner';

describe('runDraft', () => {
  it('retries once on badResponse from the call or the validator', async () => {
    const call = vi.fn().mockResolvedValueOnce('bad').mockResolvedValueOnce('good');
    const validate = (raw: unknown) => {
      if (raw === 'bad') throw new AiError('badResponse', 'x');
      return raw;
    };
    await expect(runDraft(call, validate)).resolves.toBe('good');
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('gives up after the second badResponse and never retries other errors', async () => {
    const bad = vi.fn().mockRejectedValue(new AiError('badResponse', 'x'));
    await expect(runDraft(bad, (r) => r)).rejects.toThrow(AiError);
    expect(bad).toHaveBeenCalledTimes(2);
    const limited = vi.fn().mockRejectedValue(new AiError('rateLimited', 'x', 429, 12));
    await expect(runDraft(limited, (r) => r)).rejects.toThrow(AiError);
    expect(limited).toHaveBeenCalledTimes(1);
  });
});

describe('draftErrorText', () => {
  it('explains each failure in plain words', () => {
    expect(draftErrorText(new AiError('rateLimited', 'x', 429, 12))).toBe('Rate limit reached — try again in 12 s.');
    expect(draftErrorText(new AiError('rateLimited', 'x', 429, null))).toBe('Rate limit reached — try again in a moment.');
    expect(draftErrorText(new AiError('notConfigured', 'x'))).toBe('Set up an AI provider in Settings first.');
    expect(draftErrorText(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });
  it('sends configuration problems to Settings', () => {
    expect(needsSettings(new AiError('unauthorized', 'x'))).toBe(true);
    expect(needsSettings(new AiError('privacyBlocked', 'x'))).toBe(true);
    expect(needsSettings(new AiError('http', 'x'))).toBe(false);
  });
});
```

`src/aiDraft/trainingDraftOps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { moveStep, removeStep, setStepMinutes, stepName, totalMinutes } from './trainingDraftOps';
import type { TrainingDraft } from './types';

const d: TrainingDraft = {
  name: 'T', description: '', ageGroupTarget: '', issues: [],
  steps: [
    { kind: 'library', exerciseId: 'a', name: 'A', category: 'warmup', description: '', minutes: 10 },
    { kind: 'new', exercise: { key: 'k', name: 'B', category: 'game', description: '', scene: null, issues: [] }, minutes: 20 },
  ],
};

describe('trainingDraftOps', () => {
  it('moves within bounds and ignores moves past the ends', () => {
    expect(moveStep(d, 0, 1).steps.map(stepName)).toEqual(['B', 'A']);
    expect(moveStep(d, 0, -1)).toBe(d);
  });
  it('removes a step and totals minutes', () => {
    expect(removeStep(d, 0).steps.map(stepName)).toEqual(['B']);
    expect(totalMinutes(d)).toBe(30);
  });
  it('clamps edited minutes to 1–60', () => {
    expect(setStepMinutes(d, 0, 0).steps[0].minutes).toBe(1);
    expect(setStepMinutes(d, 0, 99).steps[0].minutes).toBe(60);
    expect(setStepMinutes(d, 0, Number.NaN).steps[0].minutes).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/aiDraft/saveDrafts.test.ts src/aiDraft/draftRunner.test.ts src/aiDraft/trainingDraftOps.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/aiDraft/saveDrafts.ts`:

```ts
import { saveDiagramSet } from '../diagrams/diagramsApi';
import { createExercise } from '../exercises/exercisesApi';
import { createTraining } from '../trainings/trainingsApi';
import type { NewTrainingInput } from '../types/training';
import type { ExerciseDraft, TrainingDraft } from './types';

export class DraftSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftSaveError';
  }
}

export const DRAFT_DIAGRAM_TITLE = 'AI draft';

/**
 * Saves drafts in order and stops at the first failure. `created` maps draft key → exercise id and
 * outlives a failed call, so pressing Save again never creates the same exercise twice.
 */
export async function saveExerciseDrafts(drafts: ExerciseDraft[], uid: string, created: Map<string, string>): Promise<string[]> {
  const ids: string[] = [];
  const addedNow: string[] = [];
  const withAdded = (msg: string) => (addedNow.length ? `${msg} Already added: ${addedNow.join(', ')}.` : msg);
  for (const d of drafts) {
    const existing = created.get(d.key);
    if (existing) {
      ids.push(existing);
      continue;
    }
    if (!d.category) throw new DraftSaveError(withAdded(`“${d.name}” needs a category.`));
    let id: string;
    try {
      id = await createExercise({ name: d.name, description: d.description, category: d.category }, uid);
    } catch {
      throw new DraftSaveError(withAdded(`Could not add “${d.name}”.`));
    }
    created.set(d.key, id);
    ids.push(id);
    if (d.scene) {
      try {
        await saveDiagramSet(id, { creates: [{ tempId: 'ai-0', title: DRAFT_DIAGRAM_TITLE, order: 0, scene: d.scene }], updates: [], deletes: [] }, uid);
      } catch {
        throw new DraftSaveError(withAdded(`“${d.name}” was added without its diagram — add one in the diagram editor.`));
      }
    }
    addedNow.push(d.name);
  }
  return ids;
}

/** Call after the draft's new exercises are saved (their ids are in `created`). */
export function trainingDraftToInput(draft: TrainingDraft, created: Map<string, string>): NewTrainingInput {
  return {
    name: draft.name.trim(),
    description: draft.description,
    ageGroupTarget: draft.ageGroupTarget,
    exercises: draft.steps.map((s, i) => ({
      exerciseId: s.kind === 'library' ? s.exerciseId : (created.get(s.exercise.key) as string),
      order: i + 1,
      durationMinutes: s.minutes,
    })),
  };
}

export function newExercisesOf(draft: TrainingDraft): ExerciseDraft[] {
  return draft.steps.flatMap((s) => (s.kind === 'new' ? [s.exercise] : []));
}

export async function saveTrainingDraft(draft: TrainingDraft, uid: string, created: Map<string, string>) {
  const fresh = newExercisesOf(draft);
  await saveExerciseDrafts(fresh, uid, created);
  try {
    return await createTraining(trainingDraftToInput(draft, created), uid);
  } catch {
    throw new DraftSaveError(
      fresh.length ? 'The new exercises were saved, but the training was not. Try Save again.' : 'Could not save the training. Please try again.',
    );
  }
}
```

Note the `saveTrainingDraft` "kept exercises" test: the second call re-runs `createTraining` (mock now resolves) and must not call `createExercise` again — `created` already holds `n`.

`src/aiDraft/draftRunner.ts`:

```ts
import { AiError, type ChatMessage } from '../ai/aiClient';

export type AskFn = (messages: ChatMessage[], signal: AbortSignal) => Promise<unknown>;

/** Runs a model call and validates it; one silent retry when the reply isn't usable JSON. */
export async function runDraft<T>(call: () => Promise<unknown>, validate: (raw: unknown) => T): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return validate(await call());
    } catch (e) {
      if (attempt === 0 && e instanceof AiError && e.kind === 'badResponse') continue;
      throw e;
    }
  }
}

const TEXT: Record<AiError['kind'], string> = {
  notConfigured: 'Set up an AI provider in Settings first.',
  unauthorized: 'Key rejected — check it in Settings.',
  rateLimited: 'Rate limit reached — try again in a moment.',
  unreachable: 'Could not reach the AI provider.',
  badResponse: "The model's answer could not be used. Try again or rephrase the request.",
  privacyBlocked: 'No provider for this model keeps requests private (zero data retention). Pick another model in Settings.',
  http: 'The AI provider returned an error.',
};

export function draftErrorText(e: unknown): string {
  if (!(e instanceof AiError)) return 'Something went wrong. Please try again.';
  if (e.kind === 'rateLimited' && e.retryAfterSec) return `Rate limit reached — try again in ${e.retryAfterSec} s.`;
  return TEXT[e.kind];
}

export function needsSettings(e: unknown): boolean {
  return e instanceof AiError && (e.kind === 'notConfigured' || e.kind === 'unauthorized' || e.kind === 'privacyBlocked');
}
```

`src/aiDraft/trainingDraftOps.ts`:

```ts
import { DRAFT_LIMITS, type TrainingDraft, type TrainingStepDraft } from './types';

export const stepName = (s: TrainingStepDraft) => (s.kind === 'library' ? s.name : s.exercise.name);

export function moveStep(d: TrainingDraft, index: number, delta: number): TrainingDraft {
  const target = index + delta;
  if (target < 0 || target >= d.steps.length) return d;
  const steps = d.steps.slice();
  [steps[index], steps[target]] = [steps[target], steps[index]];
  return { ...d, steps };
}

export function removeStep(d: TrainingDraft, index: number): TrainingDraft {
  return { ...d, steps: d.steps.filter((_, i) => i !== index) };
}

export function setStepMinutes(d: TrainingDraft, index: number, value: number): TrainingDraft {
  const m = Number.isFinite(value) ? Math.round(value) : DRAFT_LIMITS.minutesMin;
  const minutes = Math.max(DRAFT_LIMITS.minutesMin, Math.min(DRAFT_LIMITS.minutesMax, m));
  return { ...d, steps: d.steps.map((s, i) => (i === index ? { ...s, minutes } : s)) };
}

export const totalMinutes = (d: TrainingDraft) => d.steps.reduce((sum, s) => sum + s.minutes, 0);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/aiDraft`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aiDraft
git commit -m "feat(ai-draft): retry-safe save orchestration, draft runner and step ops"
```

---

### Task 10: Unsaved-scene support in `ExerciseDetailSheet`

**Files:**
- Modify: `src/exercises/ExerciseDetailSheet.tsx`
- Test: `src/exercises/ExerciseDetailSheet.test.tsx`

**Interfaces:**
- Consumes: `sceneAsDiagram` (Task 5).
- Produces: `ExerciseDetailEntry.scene?: Scene | null` — when the key is present (`scene !== undefined`) the sheet renders that scene (or "No diagrams") and never fetches.

- [ ] **Step 1: Write the failing test** (append; reuse the file's existing mocks for `../diagrams/diagramsApi`)

```ts
  it('renders an unsaved draft scene without fetching diagrams', () => {
    const scene = { v: 1 as const, court: 'full' as const, showZones: false, items: [] };
    render(
      <ExerciseDetailSheet
        entries={[
          { exerciseId: 'draft-1', name: 'Draft', description: 'D', category: 'game', scene },
          { exerciseId: 'draft-2', name: 'No diagram', description: '', scene: null },
        ]}
        startIndex={0}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('AI draft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next exercise' }));
    expect(screen.getByText('No diagrams for this exercise.')).toBeInTheDocument();
    expect(diagramsApi.listDiagrams).not.toHaveBeenCalled();
  });
```

(If the test file mocks `listDiagrams` under a different import name, follow it; add `fireEvent` to its imports if missing.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/exercises/ExerciseDetailSheet.test.tsx`
Expected: FAIL (type error on `scene` / fetch called).

- [ ] **Step 3: Implement**

In `src/exercises/ExerciseDetailSheet.tsx`:

- import `sceneAsDiagram` from `'../diagrams/sceneFactory'` and `Scene` type from `'../types/diagram'`.
- `ExerciseDetailEntry` gains:

```ts
  /** An unsaved (AI draft) diagram: rendered as is, nothing is fetched. `null` => draft without a diagram. */
  scene?: Scene | null;
```

- replace `const diagrams = entry ? diagramsById[entry.exerciseId] : undefined;` with:

```ts
  const diagrams: Diagram[] | 'error' | undefined =
    entry && entry.scene !== undefined
      ? entry.scene
        ? [sceneAsDiagram(entry.exerciseId, entry.scene)]
        : []
      : entry
        ? diagramsById[entry.exerciseId]
        : undefined;
```

- first line of the fetch effect becomes `if (!entry || !entry.name || entry.scene !== undefined || entry.exerciseId in diagramsById) return;`

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/exercises src/trainings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/ExerciseDetailSheet.tsx src/exercises/ExerciseDetailSheet.test.tsx
git commit -m "feat(exercises): detail sheet can show an unsaved draft diagram"
```

---

### Task 11: Exercise drafting dialog + Exercises page button

**Files:**
- Create: `src/aiDraft/DraftDiagramPreview.tsx`, `src/aiDraft/ExerciseProposalReview.tsx`, `src/aiDraft/ExerciseDraftDialog.tsx`, `src/aiDraft/ExerciseDraftDialog.test.tsx`
- Modify: `src/exercises/ExercisesPage.tsx`, Test: `src/exercises/ExercisesPage.test.tsx`

**Interfaces:**
- Consumes: `readAiSettings`, `isAiConfigured` (`src/ai/aiSettings`), `chatJson`, `AI_MAX_TOKENS`, `DRAFT_TEMPERATURE` (`src/ai/aiClient`), `existingExerciseNames` (Task 7), `buildExerciseMessages` (Task 8), `validateExerciseProposals` (Task 5), `runDraft`, `draftErrorText`, `needsSettings`, `AskFn`, `saveExerciseDrafts`, `DraftSaveError` (Task 9), `sceneAsDiagram`, `DiagramLightbox`, `DiagramSvg`, `useSave`, `OfflineError`, `Dialog`, `Button`, `Input`, `Textarea`, `FIELD_CLASS`.
- Produces:
  - `DraftDiagramPreview({ scene, label, onOpen?, className? })`
  - `ExerciseDraftDialog({ onClose, onSaved, ask? }: { onClose: () => void; onSaved: (count: number) => void; ask?: AskFn })`

- [ ] **Step 1: Write the failing tests**

`src/aiDraft/ExerciseDraftDialog.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError } from '../ai/aiClient';
import * as exercisesApi from '../exercises/exercisesApi';
import * as diagramsApi from '../diagrams/diagramsApi';
import { ExerciseDraftDialog } from './ExerciseDraftDialog';

vi.mock('../exercises/exercisesApi');
vi.mock('../diagrams/diagramsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../auth/AuthContext', async () => {
  const { authValue, superAdminAccess } = await import('../test/authValue');
  return { useAuth: () => authValue({ firebaseUser: { uid: 'coach' } as never, access: superAdminAccess }) };
});

const proposal = (name: string) => ({
  name, category: 'reception', description: `How ${name} runs`,
  diagram: { court: 'full', items: [{ type: 'player', x: 30, y: 80, label: 'P' }] },
});

function renderDialog(ask = vi.fn().mockResolvedValue({ exercises: [proposal('Alpha'), proposal('Beta')] }), onSaved = vi.fn()) {
  render(<MemoryRouter><ExerciseDraftDialog onClose={() => {}} onSaved={onSaved} ask={ask} /></MemoryRouter>);
  return { ask, onSaved };
}

async function generate(count = '2') {
  fireEvent.change(screen.getByLabelText('What do you need?'), { target: { value: 'serve receive for U15' } });
  fireEvent.change(screen.getByLabelText('How many'), { target: { value: count } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  await screen.findByText('Alpha');
}

describe('ExerciseDraftDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [], lastDoc: null, hasMore: false });
    let n = 0;
    vi.mocked(exercisesApi.createExercise).mockImplementation(async () => `id-${++n}`);
    vi.mocked(diagramsApi.saveDiagramSet).mockResolvedValue({ idMap: {} });
  });

  it('previews each proposal with its diagram, then saves only the kept ones', async () => {
    const { ask, onSaved } = renderDialog();
    await generate();
    expect(ask.mock.calls[0][0][1].content).toContain('serve receive for U15');
    expect(screen.getByRole('button', { name: 'Diagram for Alpha' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Keep Beta'));
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 kept' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(1));
    expect(exercisesApi.createExercise).toHaveBeenCalledTimes(1);
    expect(exercisesApi.createExercise).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alpha' }), 'coach');
  });

  it('lets the coach edit a proposal before saving', async () => {
    const { onSaved } = renderDialog();
    await generate();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alpha renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save 2 kept' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(2));
    expect(exercisesApi.createExercise).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alpha renamed' }), 'coach');
  });

  it('blocks saving while a kept proposal has no category', async () => {
    renderDialog(vi.fn().mockResolvedValue({ exercises: [{ ...proposal('Alpha'), category: 'blocking' }] }));
    await generate('1');
    expect(screen.getByText('Pick a category.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save 1 kept' })).toBeDisabled();
  });

  it('shows "No diagram" when the diagram could not be used', async () => {
    renderDialog(vi.fn().mockResolvedValue({ exercises: [{ ...proposal('Alpha'), diagram: { court: 'full', items: [{ type: 'arrow' }] } }] }));
    await generate('1');
    expect(screen.getByText('No diagram')).toBeInTheDocument();
  });

  it('Regenerate keeps kept proposals and asks only for the rest', async () => {
    const ask = vi.fn()
      .mockResolvedValueOnce({ exercises: [proposal('Alpha'), proposal('Beta')] })
      .mockResolvedValueOnce({ exercises: [proposal('Gamma')] });
    renderDialog(ask);
    await generate();
    fireEvent.click(screen.getByLabelText('Keep Beta'));
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    await screen.findByText('Gamma');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).toBeNull();
    expect(ask.mock.calls[1][0][1].content).toContain('Count: 1');
    expect(ask.mock.calls[1][0][1].content).toContain('Alpha');
  });

  it('shows a Settings link when AI is not configured', async () => {
    renderDialog(vi.fn().mockRejectedValue(new AiError('notConfigured', 'x')));
    fireEvent.change(screen.getByLabelText('What do you need?'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Set up an AI provider in Settings first.');
    expect(screen.getByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', '/settings');
  });

  it('aborts the request when the dialog unmounts', async () => {
    let signal: AbortSignal | undefined;
    const ask = vi.fn((_m, s: AbortSignal) => {
      signal = s;
      return new Promise(() => {});
    });
    const { unmount } = render(<MemoryRouter><ExerciseDraftDialog onClose={() => {}} onSaved={() => {}} ask={ask} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('What do you need?'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(ask).toHaveBeenCalled());
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
```

Append to `src/exercises/ExercisesPage.test.tsx`:

```tsx
vi.mock('../aiDraft/ExerciseDraftDialog', () => ({
  ExerciseDraftDialog: ({ onSaved }: { onSaved: (n: number) => void }) => <button onClick={() => onSaved(2)}>draft-dialog-stub</button>,
}));
```

(top-level, next to the other `vi.mock`s) and inside the `describe`:

```tsx
  it('opens AI drafting and reloads the list after saving', async () => {
    render(<ExercisesPage />);
    await screen.findByText('Pepper');
    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }));
    fireEvent.click(screen.getByText('draft-dialog-stub'));
    await waitFor(() => expect(exercisesApi.listExercises).toHaveBeenCalledTimes(2));
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/aiDraft/ExerciseDraftDialog.test.tsx src/exercises/ExercisesPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/aiDraft/DraftDiagramPreview.tsx`:

```tsx
import { DiagramSvg } from '../diagrams/DiagramSvg';
import type { Scene } from '../types/diagram';

interface Props {
  scene: Scene | null;
  label: string;
  onOpen?: () => void;
  className?: string;
}

/** Small read-only preview of a draft diagram; a dashed box when there is none. */
export function DraftDiagramPreview({ scene, label, onOpen, className = 'h-32 w-32' }: Props) {
  const box = `${className} shrink-0 overflow-hidden rounded-md border`;
  if (!scene) {
    return <div className={`${box} flex items-center justify-center border-dashed border-border text-xs text-slate`}>No diagram</div>;
  }
  if (!onOpen) {
    return <div className={`${box} border-border bg-surface`}><DiagramSvg scene={scene} /></div>;
  }
  return (
    <button type="button" aria-label={label} onClick={onOpen} className={`${box} border-border bg-surface hover:border-blue`}>
      <DiagramSvg scene={scene} />
    </button>
  );
}
```

`src/aiDraft/ExerciseProposalReview.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '../components/Button';
import { FIELD_CLASS, Input, Textarea } from '../components/Input';
import { DiagramLightbox } from '../diagrams/DiagramLightbox';
import { sceneAsDiagram } from '../diagrams/sceneFactory';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../types/exercise';
import { DraftDiagramPreview } from './DraftDiagramPreview';
import { DRAFT_LIMITS, type ExerciseDraft } from './types';

const CATEGORY_LABEL = Object.fromEntries(EXERCISE_CATEGORIES.map((c) => [c.key, c.label])) as Record<ExerciseCategory, string>;

export type ExerciseDraftPatch = Partial<Pick<ExerciseDraft, 'name' | 'category' | 'description'>>;

interface Props {
  drafts: ExerciseDraft[];
  kept: Set<string>;
  onToggleKeep: (key: string) => void;
  onEdit: (key: string, patch: ExerciseDraftPatch) => void;
}

export function ExerciseProposalReview({ drafts, kept, onToggleKeep, onEdit }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<ExerciseDraft | null>(null);

  return (
    <>
      <ul className="flex flex-col divide-y divide-border">
        {drafts.map((d) => (
          <li key={d.key} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row">
            <DraftDiagramPreview scene={d.scene} label={`Diagram for ${d.name}`} onOpen={() => setZoomed(d)} />
            <div className="min-w-0 flex-1">
              {editing === d.key ? (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-ink" htmlFor={`draft-name-${d.key}`}>Name</label>
                  <Input id={`draft-name-${d.key}`} maxLength={DRAFT_LIMITS.nameMax} value={d.name} onChange={(e) => onEdit(d.key, { name: e.target.value })} />
                  <label className="text-sm font-medium text-ink" htmlFor={`draft-cat-${d.key}`}>Category</label>
                  <select
                    id={`draft-cat-${d.key}`}
                    className={`${FIELD_CLASS} min-h-11`}
                    value={d.category ?? ''}
                    onChange={(e) => onEdit(d.key, { category: (e.target.value || null) as ExerciseCategory | null })}
                  >
                    <option value="">Pick a category</option>
                    {EXERCISE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <label className="text-sm font-medium text-ink" htmlFor={`draft-desc-${d.key}`}>Description</label>
                  <Textarea id={`draft-desc-${d.key}`} rows={6} maxLength={DRAFT_LIMITS.descriptionMax} value={d.description} onChange={(e) => onEdit(d.key, { description: e.target.value })} />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{d.name}</span>
                    {d.category && (
                      <span className="rounded-sm bg-blue/10 px-1.5 py-0.5 text-xs font-medium text-blue">{CATEGORY_LABEL[d.category]}</span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate">{d.description}</p>
                </>
              )}
              {d.issues.length > 0 && (
                <ul className="mt-2 text-xs text-slate">
                  {d.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              )}
              <div className="mt-2 flex items-center gap-2">
                <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="h-4 w-4" aria-label={`Keep ${d.name}`} checked={kept.has(d.key)} onChange={() => onToggleKeep(d.key)} />
                  Keep
                </label>
                <Button variant="ghost" size="sm" onClick={() => setEditing(editing === d.key ? null : d.key)}>
                  {editing === d.key ? 'Done' : 'Edit'}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {zoomed?.scene && (
        <DiagramLightbox diagrams={[sceneAsDiagram(zoomed.key, zoomed.scene)]} startIndex={0} onClose={() => setZoomed(null)} />
      )}
    </>
  );
}
```

Note: `Keep` checkbox's `aria-label` is the accessible name (the visible "Keep" text stays for sighted users). If the label element's text conflicts in tests, the `aria-label` wins.

`src/aiDraft/ExerciseDraftDialog.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AI_MAX_TOKENS, DRAFT_TEMPERATURE, chatJson } from '../ai/aiClient';
import { readAiSettings } from '../ai/aiSettings';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { FIELD_CLASS, Input, Textarea } from '../components/Input';
import { OfflineError, useSave } from '../components/useSave';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../types/exercise';
import { draftErrorText, needsSettings, runDraft, type AskFn } from './draftRunner';
import { buildExerciseMessages } from './exercisePrompt';
import { ExerciseProposalReview, type ExerciseDraftPatch } from './ExerciseProposalReview';
import { existingExerciseNames } from './libraryIndex';
import { DraftSaveError, saveExerciseDrafts } from './saveDrafts';
import { DRAFT_LIMITS, type ExerciseDraft } from './types';
import { validateExerciseProposals } from './validateDraft';

interface Props {
  onClose: () => void;
  onSaved: (count: number) => void;
  /** Test seam; defaults to the coach's provider from Settings. */
  ask?: AskFn;
}

type DraftError = { text: string; settingsLink: boolean };

export function ExerciseDraftDialog({ onClose, onSaved, ask }: Props) {
  const { firebaseUser } = useAuth();
  const [settings] = useState(readAiSettings);
  const askModel: AskFn =
    ask ?? ((messages, signal) => chatJson(settings, messages, { signal, temperature: DRAFT_TEMPERATURE, maxTokens: AI_MAX_TOKENS.draft }));
  const [request, setRequest] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | ''>('');
  const [count, setCount] = useState(3);
  const [drafts, setDrafts] = useState<ExerciseDraft[] | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<DraftError | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const createdRef = useRef(new Map<string, string>());
  const { saving, save } = useSave();

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function generate(keepCurrent: boolean) {
    const keptDrafts = keepCurrent && drafts ? drafts.filter((d) => kept.has(d.key)) : [];
    const wanted = count - keptDrafts.length;
    if (wanted < 1 || !request.trim()) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setGenerating(true);
    setError(null);
    try {
      const existingNames = await existingExerciseNames(category || null);
      const messages = buildExerciseMessages({
        request: request.trim(),
        category: category || null,
        count: wanted,
        existingNames,
        alreadyProposed: keptDrafts.map((d) => d.name),
      });
      const fresh = await runDraft(() => askModel(messages, controller.signal), (raw) => validateExerciseProposals(raw, wanted));
      if (controller.signal.aborted) return;
      const next = [...keptDrafts, ...fresh];
      setDrafts(next);
      setKept(new Set(next.map((d) => d.key)));
    } catch (e) {
      if (!controller.signal.aborted) setError({ text: draftErrorText(e), settingsLink: needsSettings(e) });
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setGenerating(false);
      }
    }
  }

  function cancelGenerate() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setGenerating(false);
  }

  function toggleKeep(key: string) {
    setKept((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function edit(key: string, patch: ExerciseDraftPatch) {
    setDrafts((cur) =>
      cur
        ? cur.map((d) =>
            d.key !== key
              ? d
              : { ...d, ...patch, issues: patch.category ? d.issues.filter((i) => i !== 'Pick a category.') : d.issues },
          )
        : cur,
    );
  }

  const toSave = drafts?.filter((d) => kept.has(d.key)) ?? [];
  const canSave = toSave.length > 0 && toSave.every((d) => d.category && d.name.trim()) && !saving && !generating;

  async function handleSave() {
    if (!firebaseUser || !canSave) return;
    setError(null);
    try {
      const done = await save(() => saveExerciseDrafts(toSave, firebaseUser.uid, createdRef.current), { offline: 'block' });
      if (done) onSaved(toSave.length);
    } catch (e) {
      setError({
        text:
          e instanceof OfflineError
            ? "You're offline. Saving drafts needs a connection."
            : e instanceof DraftSaveError
              ? e.message
              : 'Could not save. Please try again.',
        settingsLink: false,
      });
    }
  }

  const footer = generating ? (
    <Button variant="secondary" onClick={cancelGenerate}>Cancel</Button>
  ) : drafts ? (
    <>
      <Button variant="secondary" className="mr-auto" onClick={() => void generate(true)} disabled={kept.size >= count}>
        Regenerate
      </Button>
      <Button variant="ghost" onClick={onClose} className="hidden sm:inline-flex">Cancel</Button>
      <Button variant="primary" onClick={() => void handleSave()} disabled={!canSave}>
        {saving ? 'Saving…' : `Save ${toSave.length} kept`}
      </Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose} className="hidden sm:inline-flex">Cancel</Button>
      <Button variant="primary" onClick={() => void generate(false)} disabled={!request.trim()}>Generate</Button>
    </>
  );

  return (
    <Dialog title="Draft exercises with AI" size="lg" mobileSheet dirty={drafts !== null} onClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4">
        {!drafts && (
          <>
            <div>
              <label htmlFor="draft-request" className="mb-1 block text-sm font-medium text-ink">What do you need?</label>
              <Textarea
                id="draft-request"
                rows={3}
                maxLength={DRAFT_LIMITS.requestMax}
                placeholder="Serve-receive drills for 9 players, U15, one court"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate">Don&apos;t type names or other personal details — this text is sent to your AI provider.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="draft-category" className="mb-1 block text-sm font-medium text-ink">Category</label>
                <select id="draft-category" className={`${FIELD_CLASS} min-h-11 w-full`} value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory | '')}>
                  <option value="">Any</option>
                  {EXERCISE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="draft-count" className="mb-1 block text-sm font-medium text-ink">How many</label>
                <Input
                  id="draft-count"
                  type="number"
                  min={1}
                  max={DRAFT_LIMITS.maxProposals}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(DRAFT_LIMITS.maxProposals, Number(e.target.value) || 1)))}
                />
              </div>
            </div>
          </>
        )}

        {generating && <p role="status" className="text-sm text-slate">Drafting…</p>}

        {error && (
          <p role="alert" className="text-sm text-red">
            {error.text}{' '}
            {error.settingsLink && <Link to="/settings" className="text-blue hover:underline">Open Settings</Link>}
          </p>
        )}

        {drafts && <ExerciseProposalReview drafts={drafts} kept={kept} onToggleKeep={toggleKeep} onEdit={edit} />}
      </div>
    </Dialog>
  );
}
```

Check: the dialog's `role="status"` "Drafting…" is unrelated to `NoticeProvider` (not mounted in these tests). If `Textarea` / `Input` / `FIELD_CLASS` export names differ in `src/components/Input.tsx`, use the actual ones (they are imported this way in `AiProviderSettings.tsx` and `TrainingBuilderDialog.tsx`).

`src/exercises/ExercisesPage.tsx`:

- import `ExerciseDraftDialog` from `'../aiDraft/ExerciseDraftDialog'` and `Sparkles` from `'lucide-react'`.
- state: `const [showDraft, setShowDraft] = useState(false);`
- in `PageHeader` actions, between Import and New exercise:

```tsx
            <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => setShowDraft(true)}>
              <Sparkles size={16} aria-hidden="true" />
              Draft with AI
            </Button>
```

- next to the import dialog render:

```tsx
      {showDraft && (
        <ExerciseDraftDialog
          onClose={() => setShowDraft(false)}
          onSaved={(n) => {
            setShowDraft(false);
            notify(`Added ${n} exercise${n === 1 ? '' : 's'}.`);
            void loadFirstPage();
          }}
        />
      )}
```

(The Exercises route is already gated by `RequireSection section="exercises"`, which is the write permission, so no extra check is needed.)

- [ ] **Step 4: Run tests, lint, typecheck**

Run: `npx vitest run src/aiDraft src/exercises` then `npm run lint` then `npx tsc -b`
Expected: PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add src/aiDraft src/exercises
git commit -m "feat(exercises): draft exercises with AI, previewing each proposal and its diagram"
```

---

### Task 12: `TrainingBuilderDialog` prefill

**Files:**
- Modify: `src/trainings/TrainingBuilderDialog.tsx`
- Test: `src/trainings/TrainingBuilderDialog.test.tsx`

**Interfaces:**
- Produces: `TrainingBuilderDialogProps.initial?: NewTrainingInput` — a new training prefilled with name, description, age group and rows (names loaded via `getExercisesByIds`), saved through `createTraining`.

- [ ] **Step 1: Write the failing test** (append; reuse the file's existing mocks of `../exercises/exercisesApi` and `./trainingsApi`)

```tsx
  it('opens a new training prefilled from a draft', async () => {
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([
      { id: 'ex-1', name: 'Pepper', description: '', category: 'warmup', createdBy: 'x', createdAt: null },
    ]);
    render(
      <TrainingBuilderDialog
        initial={{ name: 'AI plan', description: 'D', ageGroupTarget: 'U15', exercises: [{ exerciseId: 'ex-1', order: 1, durationMinutes: 15 }] }}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'New training' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('AI plan');
    expect(await screen.findByText('Pepper')).toBeInTheDocument();
    expect(screen.getByText(/1 exercise · 15 min/)).toBeInTheDocument();
  });
```

(Adjust the heading query to how the existing tests find the dialog title; the title for a new training is the literal `'New training'`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/trainings/TrainingBuilderDialog.test.tsx`
Expected: FAIL (`initial` not a prop).

- [ ] **Step 3: Implement**

In `src/trainings/TrainingBuilderDialog.tsx`:

- import `NewTrainingInput` alongside `Training, TrainingExercise` from `'../types/training'`.
- props: add `/** Prefill a NEW training (e.g. from an AI draft). Ignored when \`training\` is set. */ initial?: NewTrainingInput;` and destructure it.
- initial state: `useState(training?.name ?? initial?.name ?? '')`, same for `description` and `ageGroupTarget`.
- replace the rows-loading effect's source:

```ts
  useEffect(() => {
    const source = training?.exercises ?? initial?.exercises;
    if (!source || source.length === 0) return;
    void getExercisesByIds(source.map((e) => e.exerciseId))
      .then((found) => {
        const byId = new Map(found.map((ex) => [ex.id, ex]));
        setRows(
          source
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((e) => ({
              ...e,
              name: byId.get(e.exerciseId)?.name ?? null,
              description: byId.get(e.exerciseId)?.description ?? '',
              category: byId.get(e.exerciseId)?.category,
            }))
        );
      })
      .catch(() => setError('Could not load the exercises for this training. Please reopen the dialog.'));
    // `initial` is a one-shot prefill; re-running on identity changes would wipe edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [training]);
```

Everything else (save path picks `createTraining` when `training` is undefined) already works.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/trainings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/trainings/TrainingBuilderDialog.tsx src/trainings/TrainingBuilderDialog.test.tsx
git commit -m "feat(trainings): builder can open prefilled from a draft"
```

---

### Task 13: Training drafting dialog + Trainings page button

**Files:**
- Create: `src/aiDraft/TrainingProposalReview.tsx`, `src/aiDraft/TrainingDraftDialog.tsx`, `src/aiDraft/TrainingDraftDialog.test.tsx`
- Modify: `src/trainings/TrainingsPage.tsx`, Test: `src/trainings/TrainingsPage.test.tsx`

**Interfaces:**
- Consumes: `loadLibraryIndex` (Task 7), `buildTrainingMessages` (Task 8), `validateTrainingProposal` (Task 6), `runDraft`, `draftErrorText`, `needsSettings`, `AskFn`, `saveTrainingDraft`, `saveExerciseDrafts`, `newExercisesOf`, `trainingDraftToInput`, `DraftSaveError`, step ops (Task 9), `ExerciseDetailSheet` with `scene` (Task 10), `TrainingBuilderDialog initial` (Task 12), `DiagramThumbnail`, `DraftDiagramPreview` (Task 11).
- Produces: `TrainingDraftDialog({ onClose, onSaved, onOpenInBuilder, ask? }: { onClose: () => void; onSaved: (businessId: string) => void; onOpenInBuilder: (initial: NewTrainingInput) => void; ask?: AskFn })`

- [ ] **Step 1: Write the failing tests**

`src/aiDraft/TrainingDraftDialog.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as exercisesApi from '../exercises/exercisesApi';
import * as diagramsApi from '../diagrams/diagramsApi';
import * as trainingsApi from '../trainings/trainingsApi';
import { TrainingDraftDialog } from './TrainingDraftDialog';

vi.mock('../exercises/exercisesApi');
vi.mock('../diagrams/diagramsApi');
vi.mock('../trainings/trainingsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
const access = vi.hoisted(() => ({ exercises: true }));
vi.mock('../auth/AuthContext', async () => {
  const { authValue } = await import('../test/authValue');
  return {
    useAuth: () =>
      authValue({
        firebaseUser: { uid: 'coach' } as never,
        access: { isSuperAdmin: false, sections: { exercises: access.exercises, trainings: true, guides: false } },
      }),
  };
});

const lib = [
  { id: 'ex-1', name: 'Pepper', description: 'Pairs', category: 'warmup' as const, createdBy: 'uid-secret', createdAt: null },
  { id: 'ex-2', name: 'Queen of the court', description: 'Game', category: 'game' as const, createdBy: 'uid-secret', createdAt: null },
];
const reply = {
  name: 'Receive day',
  description: 'Passing focus',
  steps: [
    { exerciseId: 'ex-1', minutes: 15 },
    { new: { name: 'Short serve receive', category: 'reception', description: 'x', diagram: { court: 'half', items: [{ type: 'cone', x: 20, y: 30 }] } }, minutes: 30 },
    { exerciseId: 'ex-2', minutes: 20 },
  ],
};

function renderDialog(ask = vi.fn().mockResolvedValue(reply)) {
  const onSaved = vi.fn();
  const onOpenInBuilder = vi.fn();
  render(<MemoryRouter><TrainingDraftDialog onClose={() => {}} onSaved={onSaved} onOpenInBuilder={onOpenInBuilder} ask={ask} /></MemoryRouter>);
  return { ask, onSaved, onOpenInBuilder };
}

async function generate() {
  fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'serve receive' } });
  fireEvent.change(screen.getByLabelText('Age group'), { target: { value: 'U15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  await screen.findByDisplayValue('Receive day');
}

describe('TrainingDraftDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.exercises = true;
    vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: lib, lastDoc: null, hasMore: false });
    vi.mocked(exercisesApi.createExercise).mockResolvedValue('new-1');
    vi.mocked(diagramsApi.saveDiagramSet).mockResolvedValue({ idMap: {} });
    vi.mocked(diagramsApi.getFirstDiagram).mockResolvedValue(null);
    vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't1', businessId: 'TR-0007' });
  });

  it('sends the library index without uids and lists steps with Library/New badges', async () => {
    const { ask } = renderDialog();
    await generate();
    const system = ask.mock.calls[0][0][0].content as string;
    expect(system).toContain('ex-1 | Pepper | warmup');
    expect(system).not.toContain('uid-secret');
    const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(within(steps[0]).getByText('Library')).toBeInTheDocument();
    expect(within(steps[1]).getByText('New')).toBeInTheDocument();
    expect(screen.getByText('65 / 90 min')).toBeInTheDocument();
  });

  it('reorders, edits minutes and removes steps before saving', async () => {
    const { onSaved } = renderDialog();
    await generate();
    fireEvent.click(screen.getByRole('button', { name: 'Move Queen of the court up' }));
    fireEvent.change(screen.getByLabelText('Minutes for Pepper'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Short serve receive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('TR-0007'));
    expect(exercisesApi.createExercise).not.toHaveBeenCalled();
    expect(vi.mocked(trainingsApi.createTraining).mock.calls[0][0].exercises).toEqual([
      { exerciseId: 'ex-1', order: 1, durationMinutes: 10 },
      { exerciseId: 'ex-2', order: 2, durationMinutes: 20 },
    ]);
  });

  it('saves new exercises then the training', async () => {
    const { onSaved } = renderDialog();
    await generate();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(exercisesApi.createExercise).toHaveBeenCalledWith(expect.objectContaining({ name: 'Short serve receive' }), 'coach');
    expect(vi.mocked(trainingsApi.createTraining).mock.calls[0][0].exercises[1].exerciseId).toBe('new-1');
  });

  it('Open in builder saves the new exercises first and hands over real ids', async () => {
    const { onOpenInBuilder } = renderDialog();
    await generate();
    fireEvent.click(screen.getByRole('button', { name: 'Open in builder' }));
    await waitFor(() => expect(onOpenInBuilder).toHaveBeenCalled());
    expect(onOpenInBuilder.mock.calls[0][0].exercises.map((e: { exerciseId: string }) => e.exerciseId)).toEqual(['ex-1', 'new-1', 'ex-2']);
    expect(trainingsApi.createTraining).not.toHaveBeenCalled();
  });

  it('hides "Allow new exercises" for coaches who cannot edit exercises', async () => {
    access.exercises = false;
    const { ask } = renderDialog();
    expect(screen.queryByLabelText('Allow new exercises')).toBeNull();
    await generate();
    expect(ask.mock.calls[0][0][0].content).not.toContain('"new"');
    expect(within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('opens a step in the detail sheet, showing the draft diagram', async () => {
    renderDialog();
    await generate();
    fireEvent.click(screen.getByRole('button', { name: 'View Short serve receive' }));
    expect(await screen.findByText('AI draft')).toBeInTheDocument();
  });
});
```

Append to `src/trainings/TrainingsPage.test.tsx` (top-level mocks next to the existing ones):

```tsx
vi.mock('../aiDraft/TrainingDraftDialog', () => ({
  TrainingDraftDialog: ({ onOpenInBuilder }: { onOpenInBuilder: (i: unknown) => void }) => (
    <button onClick={() => onOpenInBuilder({ name: 'From AI', description: '', ageGroupTarget: '', exercises: [] })}>draft-dialog-stub</button>
  ),
}));
```

and in the `describe` (if the file already stubs `TrainingBuilderDialog`, assert on that stub's props instead):

```tsx
  it('opens the builder prefilled from an AI draft', async () => {
    render(<MemoryRouter><TrainingsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Draft with AI' }));
    fireEvent.click(screen.getByText('draft-dialog-stub'));
    expect(await screen.findByDisplayValue('From AI')).toBeInTheDocument();
  });
```

(Match the file's existing render wrapper.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/aiDraft/TrainingDraftDialog.test.tsx src/trainings/TrainingsPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/aiDraft/TrainingProposalReview.tsx`:

```tsx
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Input, Textarea } from '../components/Input';
import { DiagramThumbnail } from '../diagrams/DiagramThumbnail';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../types/exercise';
import { DraftDiagramPreview } from './DraftDiagramPreview';
import { moveStep, removeStep, setStepMinutes, stepName, totalMinutes } from './trainingDraftOps';
import { DRAFT_LIMITS, type TrainingDraft } from './types';

const CATEGORY_LABEL = Object.fromEntries(EXERCISE_CATEGORIES.map((c) => [c.key, c.label])) as Record<ExerciseCategory, string>;
const iconBtn = 'inline-flex h-11 w-11 items-center justify-center rounded-md text-slate hover:bg-bg hover:text-ink disabled:opacity-30 sm:h-9 sm:w-9';

interface Props {
  draft: TrainingDraft;
  targetMinutes: number;
  onChange: (next: TrainingDraft) => void;
  onView: (index: number) => void;
}

export function TrainingProposalReview({ draft, targetMinutes, onChange, onView }: Props) {
  const total = totalMinutes(draft);
  const off = Math.abs(total - targetMinutes) > targetMinutes * 0.1;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="tdraft-name" className="mb-1 block text-sm font-medium text-ink">Training name</label>
          <Input id="tdraft-name" maxLength={DRAFT_LIMITS.nameMax} value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="tdraft-age" className="mb-1 block text-sm font-medium text-ink">Age group target</label>
          <Input id="tdraft-age" value={draft.ageGroupTarget} onChange={(e) => onChange({ ...draft, ageGroupTarget: e.target.value })} />
        </div>
      </div>
      <div>
        <label htmlFor="tdraft-desc" className="mb-1 block text-sm font-medium text-ink">Description</label>
        <Textarea id="tdraft-desc" rows={3} maxLength={DRAFT_LIMITS.descriptionMax} value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} />
      </div>

      <p className={`text-sm tabular-nums ${off ? 'text-orange' : 'text-slate'}`}>
        {total} / {targetMinutes} min
      </p>
      {draft.issues.length > 0 && (
        <ul className="text-xs text-slate">{draft.issues.map((i) => <li key={i}>{i}</li>)}</ul>
      )}

      <ol aria-label="Steps" className="flex flex-col divide-y divide-border">
        {draft.steps.map((s, i) => {
          const name = stepName(s);
          const category = s.kind === 'library' ? s.category : s.exercise.category;
          return (
            <li key={s.kind === 'library' ? `${s.exerciseId}-${i}` : s.exercise.key} className="flex items-center gap-3 py-3">
              {s.kind === 'library' ? (
                <DiagramThumbnail exerciseId={s.exerciseId} interactive={false} className="h-16 w-16 shrink-0" />
              ) : (
                <DraftDiagramPreview scene={s.exercise.scene} label={`Diagram for ${name}`} className="h-16 w-16" />
              )}
              <div className="min-w-0 flex-1">
                <button type="button" aria-label={`View ${name}`} onClick={() => onView(i)} className="block max-w-full truncate text-left font-medium text-ink hover:underline">
                  {name}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${s.kind === 'new' ? 'bg-orange/10 text-orange' : 'bg-bg text-slate'}`}>
                    {s.kind === 'new' ? 'New' : 'Library'}
                  </span>
                  {category && <span className="rounded-sm bg-blue/10 px-1.5 py-0.5 text-xs font-medium text-blue">{CATEGORY_LABEL[category]}</span>}
                </div>
              </div>
              <Input
                aria-label={`Minutes for ${name}`}
                type="number"
                min={DRAFT_LIMITS.minutesMin}
                max={DRAFT_LIMITS.minutesMax}
                className="w-16 tabular-nums"
                value={s.minutes}
                onChange={(e) => onChange(setStepMinutes(draft, i, Number(e.target.value)))}
              />
              <div className="flex shrink-0">
                <button type="button" className={iconBtn} aria-label={`Move ${name} up`} disabled={i === 0} onClick={() => onChange(moveStep(draft, i, -1))}>
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button type="button" className={iconBtn} aria-label={`Move ${name} down`} disabled={i === draft.steps.length - 1} onClick={() => onChange(moveStep(draft, i, 1))}>
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button type="button" className={iconBtn} aria-label={`Remove ${name}`} onClick={() => onChange(removeStep(draft, i))}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

(The `<ol aria-label="Steps">` lets tests count steps without picking up the issues `<ul>`.)

`src/aiDraft/TrainingDraftDialog.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AI_MAX_TOKENS, DRAFT_TEMPERATURE, chatJson } from '../ai/aiClient';
import { readAiSettings } from '../ai/aiSettings';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Input, Textarea } from '../components/Input';
import { OfflineError, useSave } from '../components/useSave';
import { ExerciseDetailSheet, type ExerciseDetailEntry } from '../exercises/ExerciseDetailSheet';
import type { NewTrainingInput } from '../types/training';
import { draftErrorText, needsSettings, runDraft, type AskFn } from './draftRunner';
import { loadLibraryIndex } from './libraryIndex';
import { DraftSaveError, newExercisesOf, saveExerciseDrafts, saveTrainingDraft, trainingDraftToInput } from './saveDrafts';
import { buildTrainingMessages } from './trainingPrompt';
import { TrainingProposalReview } from './TrainingProposalReview';
import { DRAFT_LIMITS, type TrainingDraft } from './types';
import { validateTrainingProposal } from './validateDraft';

interface Props {
  onClose: () => void;
  onSaved: (businessId: string) => void;
  onOpenInBuilder: (initial: NewTrainingInput) => void;
  ask?: AskFn;
}

type DraftError = { text: string; settingsLink: boolean };

function toEntries(draft: TrainingDraft): ExerciseDetailEntry[] {
  return draft.steps.map((s) =>
    s.kind === 'library'
      ? { exerciseId: s.exerciseId, name: s.name, description: s.description, category: s.category, durationMinutes: s.minutes }
      : {
          exerciseId: s.exercise.key,
          name: s.exercise.name,
          description: s.exercise.description,
          category: s.exercise.category ?? undefined,
          durationMinutes: s.minutes,
          scene: s.exercise.scene,
        },
  );
}

export function TrainingDraftDialog({ onClose, onSaved, onOpenInBuilder, ask }: Props) {
  const { firebaseUser, access } = useAuth();
  const canWriteExercises = !!access?.sections.exercises;
  const [settings] = useState(readAiSettings);
  const askModel: AskFn =
    ask ?? ((messages, signal) => chatJson(settings, messages, { signal, temperature: DRAFT_TEMPERATURE, maxTokens: AI_MAX_TOKENS.draft }));
  const [goal, setGoal] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [minutes, setMinutes] = useState(90);
  const [allowNew, setAllowNew] = useState(true);
  const [draft, setDraft] = useState<TrainingDraft | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<DraftError | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const createdRef = useRef(new Map<string, string>());
  const { saving, save } = useSave();

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function generate() {
    if (!goal.trim()) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setGenerating(true);
    setError(null);
    const newAllowed = allowNew && canWriteExercises;
    try {
      const index = await loadLibraryIndex(goal);
      const messages = buildTrainingMessages({ goal: goal.trim(), ageGroupTarget: ageGroup.trim(), totalMinutes: minutes, allowNew: newAllowed, index });
      const next = await runDraft(
        () => askModel(messages, controller.signal),
        (raw) => validateTrainingProposal(raw, { index, allowNew: newAllowed, ageGroupTarget: ageGroup.trim() }),
      );
      if (!controller.signal.aborted) setDraft(next);
    } catch (e) {
      if (!controller.signal.aborted) setError({ text: draftErrorText(e), settingsLink: needsSettings(e) });
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setGenerating(false);
      }
    }
  }

  function cancelGenerate() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setGenerating(false);
  }

  function saveErrorText(e: unknown) {
    if (e instanceof OfflineError) return "You're offline. Saving needs a connection.";
    if (e instanceof DraftSaveError) return e.message;
    return 'Could not save. Please try again.';
  }

  const canSave = !!draft && draft.name.trim().length > 0 && draft.steps.length > 0 && !saving && !generating && !!firebaseUser;

  async function handleSave() {
    if (!draft || !firebaseUser || !canSave) return;
    setError(null);
    let businessId = '';
    try {
      const done = await save(async () => {
        businessId = (await saveTrainingDraft(draft, firebaseUser.uid, createdRef.current)).businessId;
      }, { offline: 'block' });
      if (done) onSaved(businessId);
    } catch (e) {
      setError({ text: saveErrorText(e), settingsLink: false });
    }
  }

  async function handleOpenInBuilder() {
    if (!draft || !firebaseUser || !canSave) return;
    setError(null);
    try {
      const done = await save(() => saveExerciseDrafts(newExercisesOf(draft), firebaseUser.uid, createdRef.current), { offline: 'block' });
      if (done) onOpenInBuilder(trainingDraftToInput(draft, createdRef.current));
    } catch (e) {
      setError({ text: saveErrorText(e), settingsLink: false });
    }
  }

  const footer = generating ? (
    <Button variant="secondary" onClick={cancelGenerate}>Cancel</Button>
  ) : draft ? (
    <>
      <Button variant="secondary" className="mr-auto" onClick={() => void generate()}>Regenerate</Button>
      <Button variant="ghost" onClick={onClose} className="hidden sm:inline-flex">Cancel</Button>
      <Button variant="secondary" onClick={() => void handleOpenInBuilder()} disabled={!canSave}>Open in builder</Button>
      <Button variant="primary" onClick={() => void handleSave()} disabled={!canSave}>{saving ? 'Saving…' : 'Save'}</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose} className="hidden sm:inline-flex">Cancel</Button>
      <Button variant="primary" onClick={() => void generate()} disabled={!goal.trim()}>Generate</Button>
    </>
  );

  return (
    <Dialog title="Draft a training with AI" size="lg" mobileSheet dirty={draft !== null} onClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4">
        {!draft && (
          <>
            <div>
              <label htmlFor="tdraft-goal" className="mb-1 block text-sm font-medium text-ink">Goal</label>
              <Textarea
                id="tdraft-goal"
                rows={3}
                maxLength={DRAFT_LIMITS.requestMax}
                placeholder="Serve receive under pressure, 12 players, one court"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate">Don&apos;t type names or other personal details — this text is sent to your AI provider.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tdraft-age-in" className="mb-1 block text-sm font-medium text-ink">Age group</label>
                <Input id="tdraft-age-in" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} />
              </div>
              <div>
                <label htmlFor="tdraft-min" className="mb-1 block text-sm font-medium text-ink">Total minutes</label>
                <Input
                  id="tdraft-min"
                  type="number"
                  min={30}
                  max={180}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(30, Math.min(180, Number(e.target.value) || 90)))}
                />
              </div>
            </div>
            {canWriteExercises && (
              <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input type="checkbox" className="h-4 w-4" checked={allowNew} onChange={(e) => setAllowNew(e.target.checked)} />
                Allow new exercises
              </label>
            )}
          </>
        )}

        {generating && <p role="status" className="text-sm text-slate">Drafting…</p>}

        {error && (
          <p role="alert" className="text-sm text-red">
            {error.text}{' '}
            {error.settingsLink && <Link to="/settings" className="text-blue hover:underline">Open Settings</Link>}
          </p>
        )}

        {draft && <TrainingProposalReview draft={draft} targetMinutes={minutes} onChange={setDraft} onView={setViewing} />}
      </div>

      {draft && viewing !== null && (
        <ExerciseDetailSheet entries={toEntries(draft)} startIndex={viewing} onClose={() => setViewing(null)} />
      )}
    </Dialog>
  );
}
```

Label note: the request form uses "Age group" (`tdraft-age-in`) and the review uses "Age group target" (`tdraft-age`) so `getByLabelText('Age group')` in tests is unambiguous only before generating — the request inputs unmount once a draft exists, so there is no clash.

`src/trainings/TrainingsPage.tsx`:

- import `TrainingDraftDialog` from `'../aiDraft/TrainingDraftDialog'`, `Sparkles` from `'lucide-react'`, and `NewTrainingInput` type from `'../types/training'`.
- dialog state union: change `{ mode: 'new' }` to `{ mode: 'new'; initial?: NewTrainingInput }`.
- state: `const [showDraft, setShowDraft] = useState(false);`
- actions: between Import and New training:

```tsx
            <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => setShowDraft(true)}>
              <Sparkles size={16} aria-hidden="true" />
              Draft with AI
            </Button>
```

- builder render: add `initial={dialog.mode === 'new' ? dialog.initial : undefined}` to `<TrainingBuilderDialog …>`.
- after the builder render:

```tsx
      {showDraft && (
        <TrainingDraftDialog
          onClose={() => setShowDraft(false)}
          onSaved={(businessId) => {
            setShowDraft(false);
            notify(`Saved training ${businessId}.`);
            void load();
          }}
          onOpenInBuilder={(initial) => {
            setShowDraft(false);
            setDialog({ mode: 'new', initial });
          }}
        />
      )}
```

- [ ] **Step 4: Run tests, lint, typecheck, build**

Run: `npm test` then `npm run lint` then `npm run build`
Expected: all PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add src/aiDraft src/trainings
git commit -m "feat(trainings): draft a training with AI from the library, with new exercises where needed"
```

---

### Task 14: Final verification and docs touch-up

**Files:**
- Modify: `CLAUDE.md` (Architecture → text scouting paragraph)

- [ ] **Step 1: Update CLAUDE.md**

Replace the "**Text scouting** (`src/matches/text/`) …" paragraph with:

```markdown
**AI features** talk to any OpenAI-compatible endpoint through a provider-agnostic
client (`src/ai/aiClient.ts`, every request capped by `AI_MAX_TOKENS`). Settings
live in localStorage, the key in sessionStorage unless the coach opts to remember
it (`src/ai/aiSettings.ts`). Text scouting (`src/matches/text/`) strips player
names to jersey numbers before sending (`textScout.ts`); merges are `source: 'text'`
events sharing a `chunkId`. AI drafting (`src/aiDraft/`) sends only the request and
club-library exercise text, runs model output through the same validators as JSON
import (`parseScene`), and saves through the normal `*Api.ts` writes.
```

- [ ] **Step 2: Full verification**

Run: `npm test && npm run lint && npm run build`
Expected: all green. Report the counts from the vitest summary.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe the shared AI client and AI drafting"
```
