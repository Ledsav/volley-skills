# Match Scouting — Plan B: Text Scouting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A coach can type free-text match notes on the scouting screen, have an AI model of their choice (Groq by default) turn them into scouting events, check and edit them in a preview with a replayed score, and merge them into the match timeline as one undoable batch.

**Architecture:** A provider-agnostic OpenAI-compatible client (`aiClient.ts`) driven by per-device settings (`aiSettings.ts`, localStorage only). Pure logic (`textScout.ts`) strips roster names to jersey numbers, builds the prompt, validates the model's JSON and maps it to event payloads with issues. `TextScoutPanel` owns draft → process → editable preview (replayed with the existing engine) → merge; `ScoutPage` writes the merged payloads as `source: 'text'` events sharing a `chunkId`, using orders between the insert anchor and the next event. Existing Undo already removes a whole `chunkId` batch with a confirm.

**Tech Stack:** React 18 + TypeScript (strict), Tailwind (design tokens), Vitest + Testing Library, browser `fetch`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-13-volley-skills-scouting-design.md` — §4.7 (Text mode), §4.8 (Settings — AI provider), §6.4, §9, §10 Plan B.

## Global Constraints

- TypeScript `strict` + `noUnusedLocals` / `noUnusedParameters` — unused symbols fail `npm run build`.
- Components never import `firebase/firestore`; Firestore stays behind `src/matches/matchesApi.ts`.
- AI settings and drafts live only in `localStorage` (every access wrapped in try/catch), never in Firestore.
- The provider receives only jersey numbers, per-set roles, libero flags, anchor state and the name-stripped text (spec §9). No names leave the device.
- Providers offered: `groq` (default), `openrouter`, `local` (Ollama / LM Studio), `custom`. Gemini is not offered.
- The model's response is always validated locally; never trusted.
- Event writes are fire-and-forget (never awaited before UI updates).
- Text-sourced events: `source: 'text'`, one shared `chunkId` per merge.
- Design tokens only (`navy blue orange green red ink slate border bg surface`), `tabular-nums`, `lucide-react` icons, 44px min touch targets on phone.
- Tests next to code; fictional player names in tests. Files valid UTF-8.
- Commit after each task; messages end with a blank line + `Co-Authored-By:` trailer for the implementing model.

## Review Focus

1. **Model output wrapped in Markdown fences or with prose around the JSON** — must still parse when the JSON object is extractable; otherwise one retry, then a clear error. → test in Task 1.
2. **Jersey numbers that aren't in the roster** (typos, opponents' numbers) — blocking issue on that row, Merge disabled until fixed or the row removed. → test in Task 3.
3. **Text panel used when no set is in play at the insert point** — Process disabled with "Start the set first." so no events land outside a set. → test in Task 4.
4. **Inserting in the middle of the timeline with tap events after the anchor** — merged orders sit strictly between the anchor and the next event; the preview reports conflicts in later events. → tests in Tasks 3 and 5.
5. **Shared device after sign-out** — API key and text drafts are removed from localStorage on sign-out. → test in Task 2.

---

## File map

| File | Responsibility |
|---|---|
| `src/matches/text/aiSettings.ts` | provider presets, read/write/clear settings, draft keys |
| `src/matches/text/aiClient.ts` | OpenAI-compatible `chatJson`, `testConnection`, typed `AiError` |
| `src/matches/text/textScout.ts` | `anonymizeNames`, `buildMessages`, `parseBatch`, `batchToPayloads`, `chunkText` |
| `src/matches/eventOrder.ts` | + `batchOrders` |
| `src/settings/AiProviderSettings.tsx` | Settings section (provider, base URL, key, model, Test connection) |
| `src/settings/SettingsPage.tsx` | renders the section |
| `src/auth/useSignOut.tsx` | clears AI settings + drafts before sign-out |
| `src/matches/text/TextScoutPanel.tsx` | draft, process, preview, merge |
| `src/matches/text/PreviewRallyCard.tsx` | editable rows for one parsed rally |
| `src/matches/scout/ScoutPage.tsx` | Text tab/button, merge writes, auto-select suspension |
| `src/legal/PrivacyPage.tsx`, `CLAUDE.md` | copy/docs |

---

### Task 1: AI settings and OpenAI-compatible client

**Files:**
- Create: `src/matches/text/aiSettings.ts`, `src/matches/text/aiClient.ts`
- Test: `src/matches/text/aiSettings.test.ts`, `src/matches/text/aiClient.test.ts`

**Interfaces:**
- Produces:
  - `type AiProvider = 'groq' | 'openrouter' | 'local' | 'custom'`
  - `interface AiSettings { provider: AiProvider; baseUrl: string; apiKey: string; model: string }`
  - `AI_PROVIDERS: Record<AiProvider, { label: string; baseUrl: string; defaultModel: string; needsKey: boolean; editableUrl: boolean; note: string }>`
  - `DEFAULT_AI_SETTINGS: AiSettings`
  - `readAiSettings(): AiSettings`, `writeAiSettings(s: AiSettings): void`, `isAiConfigured(s: AiSettings): boolean`
  - `draftKey(matchId: string): string`, `readDraft(matchId): string`, `writeDraft(matchId, text): void`, `clearAiLocalData(): void`
  - `interface ChatMessage { role: 'system' | 'user'; content: string }`
  - `type AiErrorKind = 'notConfigured' | 'unauthorized' | 'rateLimited' | 'unreachable' | 'badResponse' | 'http'`
  - `class AiError extends Error { kind: AiErrorKind; status: number | null; retryAfterSec: number | null }`
  - `chatJson(settings: AiSettings, messages: ChatMessage[], opts?: { fetchImpl?: typeof fetch; signal?: AbortSignal }): Promise<unknown>`
  - `testConnection(settings, opts?): Promise<void>` (resolves on success, throws `AiError`)
  - `extractJson(content: string): unknown` (throws `AiError('badResponse')`)

- [ ] **Step 1: Failing tests**

`src/matches/text/aiSettings.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AI_PROVIDERS,
  DEFAULT_AI_SETTINGS,
  clearAiLocalData,
  draftKey,
  isAiConfigured,
  readAiSettings,
  readDraft,
  writeAiSettings,
  writeDraft,
} from './aiSettings';

describe('aiSettings', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to Groq with its preset URL and model', () => {
    expect(readAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
    expect(DEFAULT_AI_SETTINGS.provider).toBe('groq');
    expect(DEFAULT_AI_SETTINGS.baseUrl).toBe(AI_PROVIDERS.groq.baseUrl);
  });

  it('round-trips settings through localStorage', () => {
    const s = { provider: 'local' as const, baseUrl: 'http://localhost:11434/v1', apiKey: '', model: 'qwen2.5:7b-instruct' };
    writeAiSettings(s);
    expect(readAiSettings()).toEqual(s);
  });

  it('falls back to defaults on corrupt storage', () => {
    localStorage.setItem('vcb.ai.settings', '{not json');
    expect(readAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('needs a key unless the provider is local', () => {
    expect(isAiConfigured({ ...DEFAULT_AI_SETTINGS, apiKey: '' })).toBe(false);
    expect(isAiConfigured({ ...DEFAULT_AI_SETTINGS, apiKey: 'k' })).toBe(true);
    expect(isAiConfigured({ provider: 'local', baseUrl: 'http://localhost:11434/v1', apiKey: '', model: 'm' })).toBe(true);
    expect(isAiConfigured({ provider: 'custom', baseUrl: '', apiKey: 'k', model: 'm' })).toBe(false);
    expect(isAiConfigured({ ...DEFAULT_AI_SETTINGS, apiKey: 'k', model: ' ' })).toBe(false);
  });

  it('stores drafts per match and clears everything AI-related', () => {
    writeDraft('m1', '7 ace');
    writeAiSettings({ ...DEFAULT_AI_SETTINGS, apiKey: 'secret' });
    localStorage.setItem('unrelated', 'keep');
    expect(readDraft('m1')).toBe('7 ace');
    expect(draftKey('m1')).toBe('vcb.textDraft.m1');
    clearAiLocalData();
    expect(readDraft('m1')).toBe('');
    expect(readAiSettings().apiKey).toBe('');
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
});
```

`src/matches/text/aiClient.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { AiError, chatJson, extractJson, testConnection } from './aiClient';
import type { AiSettings } from './aiSettings';

const settings: AiSettings = { provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'k', model: 'm' };
const messages = [{ role: 'user' as const, content: 'hi' }];

function reply(content: string, init: ResponseInit = { status: 200 }) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), init);
}

describe('extractJson', () => {
  it('parses plain JSON, fenced JSON and JSON surrounded by prose', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":{"b":2}} hope it helps')).toEqual({ a: { b: 2 } });
  });

  it('throws badResponse when there is no JSON object', () => {
    expect(() => extractJson('sorry, no')).toThrow(AiError);
    try {
      extractJson('sorry');
    } catch (e) {
      expect((e as AiError).kind).toBe('badResponse');
    }
  });
});

describe('chatJson', () => {
  it('posts an OpenAI-compatible request with auth and JSON mode', async () => {
    const fetchImpl = vi.fn(async () => reply('{"ok":true}'));
    await expect(chatJson(settings, messages, { fetchImpl })).resolves.toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: 'm', messages, temperature: 0, response_format: { type: 'json_object' } });
  });

  it('omits Authorization when there is no key (local)', async () => {
    const fetchImpl = vi.fn(async () => reply('{}'));
    await chatJson({ provider: 'local', baseUrl: 'http://localhost:11434/v1/', apiKey: '', model: 'm' }, messages, { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('retries once without response_format when the provider rejects it', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":{"message":"response_format is not supported"}}', { status: 400 }))
      .mockResolvedValueOnce(reply('{"ok":1}'));
    await expect(chatJson(settings, messages, { fetchImpl })).resolves.toEqual({ ok: 1 });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).response_format).toBeUndefined();
  });

  it('maps failures to typed errors', async () => {
    const kind = async (impl: () => Promise<Response>) => {
      try {
        await chatJson(settings, messages, { fetchImpl: vi.fn(impl) });
      } catch (e) {
        return { kind: (e as AiError).kind, retry: (e as AiError).retryAfterSec };
      }
      return null;
    };
    expect(await kind(async () => new Response('', { status: 401 }))).toEqual({ kind: 'unauthorized', retry: null });
    expect(await kind(async () => new Response('', { status: 429, headers: { 'retry-after': '12' } }))).toEqual({ kind: 'rateLimited', retry: 12 });
    expect(await kind(async () => { throw new TypeError('Failed to fetch'); })).toEqual({ kind: 'unreachable', retry: null });
    expect(await kind(async () => new Response('', { status: 500 }))).toEqual({ kind: 'http', retry: null });
    expect(await kind(async () => reply('not json'))).toEqual({ kind: 'badResponse', retry: null });
    expect(await kind(async () => new Response('{}', { status: 200 }))).toEqual({ kind: 'badResponse', retry: null });
  });

  it('refuses to call when not configured', async () => {
    const fetchImpl = vi.fn();
    await expect(chatJson({ ...settings, apiKey: '' }, messages, { fetchImpl })).rejects.toMatchObject({ kind: 'notConfigured' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('testConnection', () => {
  it('resolves when the model answers with JSON', async () => {
    await expect(testConnection(settings, { fetchImpl: vi.fn(async () => reply('{"ok":true}')) })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/matches/text` → FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/matches/text/aiSettings.ts`:

```ts
export type AiProvider = 'groq' | 'openrouter' | 'local' | 'custom';

export interface AiSettings {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const AI_PROVIDERS: Record<
  AiProvider,
  { label: string; baseUrl: string; defaultModel: string; needsKey: boolean; editableUrl: boolean; note: string }
> = {
  groq: {
    label: 'Groq (recommended)',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    needsKey: true,
    editableUrl: false,
    note: 'Free tier. Groq does not keep your requests by default; turn on Zero Data Retention in its Data Controls.',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: '',
    needsKey: true,
    editableUrl: false,
    note: 'Many free models. How data is handled depends on the provider behind the model you pick.',
  },
  local: {
    label: 'Local (Ollama / LM Studio)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:7b-instruct',
    needsKey: false,
    editableUrl: true,
    note: 'Runs on this computer; nothing leaves it. Allow this site in Ollama (OLLAMA_ORIGINS) or enable CORS in LM Studio.',
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    baseUrl: '',
    defaultModel: '',
    needsKey: true,
    editableUrl: true,
    note: 'Any OpenAI-compatible endpoint that allows browser requests.',
  },
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'groq',
  baseUrl: AI_PROVIDERS.groq.baseUrl,
  apiKey: '',
  model: AI_PROVIDERS.groq.defaultModel,
};

const SETTINGS_KEY = 'vcb.ai.settings';
const DRAFT_PREFIX = 'vcb.textDraft.';

function isProvider(v: unknown): v is AiProvider {
  return typeof v === 'string' && v in AI_PROVIDERS;
}

export function readAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const v = JSON.parse(raw) as Partial<AiSettings>;
    if (!isProvider(v.provider)) return DEFAULT_AI_SETTINGS;
    return {
      provider: v.provider,
      baseUrl: typeof v.baseUrl === 'string' ? v.baseUrl : AI_PROVIDERS[v.provider].baseUrl,
      apiKey: typeof v.apiKey === 'string' ? v.apiKey : '',
      model: typeof v.model === 'string' ? v.model : AI_PROVIDERS[v.provider].defaultModel,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function writeAiSettings(s: AiSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Storage blocked (private mode): settings last for this page only.
  }
}

export function isAiConfigured(s: AiSettings): boolean {
  if (!s.baseUrl.trim() || !s.model.trim()) return false;
  return !AI_PROVIDERS[s.provider].needsKey || s.apiKey.trim().length > 0;
}

export function draftKey(matchId: string): string {
  return `${DRAFT_PREFIX}${matchId}`;
}

export function readDraft(matchId: string): string {
  try {
    return localStorage.getItem(draftKey(matchId)) ?? '';
  } catch {
    return '';
  }
}

export function writeDraft(matchId: string, text: string): void {
  try {
    if (text) localStorage.setItem(draftKey(matchId), text);
    else localStorage.removeItem(draftKey(matchId));
  } catch {
    // Ignore: the draft simply isn't persisted.
  }
}

/** Removes the API key, provider settings and every text draft from this device. */
export function clearAiLocalData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === SETTINGS_KEY || k.startsWith(DRAFT_PREFIX))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage blocked: nothing was stored either.
  }
}
```

`src/matches/text/aiClient.ts`:

```ts
import { isAiConfigured, type AiSettings } from './aiSettings';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export type AiErrorKind = 'notConfigured' | 'unauthorized' | 'rateLimited' | 'unreachable' | 'badResponse' | 'http';

export class AiError extends Error {
  constructor(
    public kind: AiErrorKind,
    message: string,
    public status: number | null = null,
    public retryAfterSec: number | null = null,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

interface ChatOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/** Pulls the first JSON object out of a model reply (plain, fenced, or wrapped in prose). */
export function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : content).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
  }
  throw new AiError('badResponse', 'The model did not return JSON.');
}

async function post(settings: AiSettings, body: object, opts: ChatOptions): Promise<Response> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.apiKey.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  const url = `${settings.baseUrl.trim().replace(/\/+$/, '')}/chat/completions`;
  try {
    return await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: opts.signal });
  } catch {
    throw new AiError('unreachable', 'Could not reach the AI provider.');
  }
}

export async function chatJson(settings: AiSettings, messages: ChatMessage[], opts: ChatOptions = {}): Promise<unknown> {
  if (!isAiConfigured(settings)) throw new AiError('notConfigured', 'Set up an AI provider in Settings.');
  const base = { model: settings.model.trim(), messages, temperature: 0 };
  let res = await post(settings, { ...base, response_format: { type: 'json_object' } }, opts);
  if (res.status === 400) {
    const text = await res.text().catch(() => '');
    if (/response_format/i.test(text)) res = await post(settings, base, opts);
    else throw new AiError('http', `Provider error (400).`, 400);
  }
  if (res.status === 401 || res.status === 403) throw new AiError('unauthorized', 'Key rejected.', res.status);
  if (res.status === 429) {
    const ra = Number(res.headers.get('retry-after'));
    throw new AiError('rateLimited', 'Rate limit reached.', 429, Number.isFinite(ra) && ra > 0 ? ra : null);
  }
  if (!res.ok) throw new AiError('http', `Provider error (${res.status}).`, res.status);
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new AiError('badResponse', 'The provider returned an unreadable reply.');
  }
  const content = (payload as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new AiError('badResponse', 'The provider reply had no message.');
  return extractJson(content);
}

export async function testConnection(settings: AiSettings, opts: ChatOptions = {}): Promise<void> {
  await chatJson(
    settings,
    [
      { role: 'system', content: 'Reply only with a JSON object.' },
      { role: 'user', content: 'Reply with {"ok": true}.' },
    ],
    opts,
  );
}
```

- [ ] **Step 4: Run** `npx vitest run src/matches/text` → PASS. Then `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/matches/text/aiSettings.ts src/matches/text/aiSettings.test.ts src/matches/text/aiClient.ts src/matches/text/aiClient.test.ts
git commit -m "feat(text-scouting): provider-agnostic AI settings and OpenAI-compatible client"
```

---

### Task 2: Settings section and sign-out clearing

**Files:**
- Create: `src/settings/AiProviderSettings.tsx`, `src/settings/AiProviderSettings.test.tsx`
- Modify: `src/settings/SettingsPage.tsx` (render the section after "Appearance"), `src/auth/useSignOut.tsx`, its existing test file if one covers `run` (search `useSignOut` in `src/**/*.test.tsx`)

**Interfaces:**
- Consumes: Task 1 (`AI_PROVIDERS`, `readAiSettings`, `writeAiSettings`, `testConnection`, `AiError`, `clearAiLocalData`).
- Produces: `<AiProviderSettings testFn?: typeof testConnection />` (prop only for tests).

- [ ] **Step 1: Failing test** `src/settings/AiProviderSettings.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError } from '../matches/text/aiClient';
import { readAiSettings } from '../matches/text/aiSettings';
import { AiProviderSettings } from './AiProviderSettings';

describe('AiProviderSettings', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to Groq and saves the key on this device', () => {
    render(<AiProviderSettings />);
    expect(screen.getByLabelText('AI provider')).toHaveValue('groq');
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'gsk_test' } });
    expect(readAiSettings().apiKey).toBe('gsk_test');
  });

  it('switching to Local fills its URL and model and hides the key', () => {
    render(<AiProviderSettings />);
    fireEvent.change(screen.getByLabelText('AI provider'), { target: { value: 'local' } });
    expect(screen.getByLabelText('Base URL')).toHaveValue('http://localhost:11434/v1');
    expect(screen.getByLabelText('Model')).toHaveValue('qwen2.5:7b-instruct');
    expect(screen.queryByLabelText('API key')).toBeNull();
  });

  it('reports the Test connection result', async () => {
    const testFn = vi.fn().mockRejectedValueOnce(new AiError('unauthorized', 'Key rejected.', 401)).mockResolvedValueOnce(undefined);
    render(<AiProviderSettings testFn={testFn} />);
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Key rejected');
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Connected'));
  });
});
```

Add to the existing sign-out test (or create `src/auth/useSignOut.test.tsx` if none exists) a case: with `vcb.ai.settings` and `vcb.textDraft.m1` in localStorage, calling the hook's `signOut` (with `signOutAndClearLocalData` mocked to resolve `'signedOut'`) removes both keys before the helper is called. Mock pattern:

```tsx
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn(async () => 'signedOut') }));
```

and assert `localStorage.getItem('vcb.ai.settings')` is `null` after `await waitFor(...)`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`src/settings/AiProviderSettings.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '../components/Button';
import { FIELD_CLASS, Input } from '../components/Input';
import { AiError, testConnection } from '../matches/text/aiClient';
import { AI_PROVIDERS, readAiSettings, writeAiSettings, type AiProvider, type AiSettings } from '../matches/text/aiSettings';

const ERROR_TEXT: Record<AiError['kind'], string> = {
  notConfigured: 'Fill in the fields above first.',
  unauthorized: 'Key rejected — check it in your provider account.',
  rateLimited: 'Rate limit reached — try again in a moment.',
  unreachable: 'Could not reach the provider. For Local, is Ollama / LM Studio running and allowing this site?',
  badResponse: 'The model answered, but not with JSON. Try another model.',
  http: 'The provider returned an error.',
};

export function AiProviderSettings({ testFn = testConnection }: { testFn?: typeof testConnection }) {
  const [s, setS] = useState<AiSettings>(readAiSettings);
  const [status, setStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const preset = AI_PROVIDERS[s.provider];

  function update(next: AiSettings) {
    setS(next);
    writeAiSettings(next);
    setStatus(null);
  }

  async function runTest() {
    setTesting(true);
    setStatus('Testing…');
    try {
      await testFn(s);
      setStatus('Connected — text scouting is ready.');
    } catch (e) {
      setStatus(e instanceof AiError ? ERROR_TEXT[e.kind] : 'Connection failed.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div>
        <p className="font-medium text-ink">Text scouting (AI)</p>
        <p className="text-sm text-slate">
          Turns typed match notes into scouting actions. Settings and key stay on this device. Only jersey numbers,
          roles, the score and your notes (with player names replaced by numbers) are sent. Keep notes to the play.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Provider
        <select
          aria-label="AI provider"
          className={`${FIELD_CLASS} min-h-11`}
          value={s.provider}
          onChange={(e) => {
            const provider = e.target.value as AiProvider;
            const p = AI_PROVIDERS[provider];
            update({ provider, baseUrl: p.baseUrl, model: p.defaultModel, apiKey: p.needsKey ? s.apiKey : '' });
          }}
        >
          {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((id) => (
            <option key={id} value={id}>{AI_PROVIDERS[id].label}</option>
          ))}
        </select>
      </label>
      <p className="text-xs text-slate">{preset.note}</p>
      {preset.editableUrl && (
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Base URL
          <Input aria-label="Base URL" value={s.baseUrl} onChange={(e) => update({ ...s, baseUrl: e.target.value })} />
        </label>
      )}
      {preset.needsKey && (
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          API key
          <Input
            aria-label="API key"
            type="password"
            autoComplete="off"
            value={s.apiKey}
            onChange={(e) => update({ ...s, apiKey: e.target.value })}
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Model
        <Input aria-label="Model" value={s.model} onChange={(e) => update({ ...s, model: e.target.value })} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => void runTest()} disabled={testing}>
          Test connection
        </Button>
        {status && (
          <p role="status" className="text-sm text-ink">
            {status}
          </p>
        )}
      </div>
    </section>
  );
}
```

`SettingsPage.tsx`: import and render `<AiProviderSettings />` after the Appearance section.

`useSignOut.tsx`: import `clearAiLocalData` from `'../matches/text/aiSettings'` and call it at the start of `run` (before `signOutAndClearLocalData`), only when `force` is true or after the unsynced check — simplest correct: inside `run`, call `const result = await signOutAndClearLocalData({ force }); if (result === 'unsynced') { setAskUnsynced(true); return; }` and call `clearAiLocalData()` **before** that line guarded so it only runs when sign-out proceeds: restructure as

```tsx
  async function run(force: boolean) {
    const result = await signOutAndClearLocalData({ force, beforeSignOut: clearAiLocalData });
    if (result === 'unsynced') setAskUnsynced(true);
  }
```

and add an optional `beforeSignOut?: () => void` to `SignOutOptions` in `src/firebase/signOut.ts`, invoked right before `signOut(auth)` (after the unsynced check). Update `src/firebase/signOut.test.ts` with a case that `beforeSignOut` runs when signing out and not when returning `'unsynced'`. (The useSignOut test then asserts the helper was called with `beforeSignOut: clearAiLocalData`; the actual clearing is covered by Task 1's `clearAiLocalData` test.)

- [ ] **Step 4: Run** `npx vitest run src/settings src/auth src/firebase` → PASS; `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/settings/AiProviderSettings.tsx src/settings/AiProviderSettings.test.tsx src/settings/SettingsPage.tsx src/auth/useSignOut.tsx src/firebase/signOut.ts src/firebase/signOut.test.ts
git commit -m "feat(text-scouting): AI provider settings with Test connection; sign-out clears key and drafts"
```

(Stage the useSignOut test file too if you created or changed one.)

---

### Task 3: Text → events logic

**Files:**
- Create: `src/matches/text/textScout.ts`, `src/matches/text/textScout.test.ts`
- Modify: `src/matches/eventOrder.ts` (+ `batchOrders`), `src/matches/eventOrder.test.ts`

**Interfaces:**
- Consumes: `rallyOutcome` (skillGrades), types (`Grade`, `Skill`, `Side`, `PointReason`, `RosterEntry`, `MatchEventPayload`, `GRADES`, `SKILLS`), `appendOrder` (eventOrder), `ChatMessage` (aiClient).
- Produces:
  - `interface ParsedAction { number: number; skill: Skill; grade: Grade }`
  - `interface ParsedRally { actions: ParsedAction[]; point: { winner: Side; reason: PointReason | null } | null; subs: { outNumber: number; inNumber: number }[]; timeouts: { team: Side }[] }`
  - `interface ParsedBatch { rallies: ParsedRally[]; unparsed: string[] }`
  - `interface AnchorInfo { set: number; score: { us: number; them: number }; serving: Side; rotation: number; onCourt: number[] }`
  - `interface PromptPlayer { number: number; role: string; isLibero: boolean }`
  - `anonymizeNames(text: string, roster: RosterEntry[]): string`
  - `SYSTEM_PROMPT: string`; `buildMessages(text: string, players: PromptPlayer[], anchor: AnchorInfo): ChatMessage[]`
  - `parseBatch(raw: unknown): { ok: true; batch: ParsedBatch } | { ok: false; error: string }`
  - `interface BatchIssue { rally: number; kind: 'unknownNumber' | 'noWinner' | 'conflictingWinner'; blocking: boolean; message: string }`
  - `batchToPayloads(batch: ParsedBatch, roster: RosterEntry[]): { payloads: MatchEventPayload[]; issues: BatchIssue[] }`
  - `chunkText(text: string, maxChars?: number): string[]`
  - `mergeBatches(batches: ParsedBatch[]): ParsedBatch`
  - (eventOrder) `batchOrders(events: { id: string; order: number }[], anchorId: string | null, count: number, maxWritten: number): number[]`

- [ ] **Step 1: Failing tests**

`src/matches/text/textScout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '../../types/match';
import { anonymizeNames, batchToPayloads, buildMessages, chunkText, mergeBatches, parseBatch, type ParsedBatch } from './textScout';

const roster: RosterEntry[] = [
  { playerId: 'p7', number: 7, name: 'Ana Pérez', positionCategory: 'OH' },
  { playerId: 'p9', number: 9, name: 'Lucía Gómez', positionCategory: 'OH' },
  { playerId: 'p2', number: 2, name: 'Sara Ruiz', positionCategory: 'S' },
  { playerId: 'p12', number: 12, name: 'Sara López', positionCategory: 'L' },
];

describe('anonymizeNames', () => {
  it('replaces first and full names with jersey numbers, ignoring accents and case', () => {
    expect(anonymizeNames('lucia kill, Ana Pérez ace', roster)).toBe('#9 kill, #7 ace');
    expect(anonymizeNames('LUCÍA bad reception', roster)).toBe('#9 bad reception');
  });

  it('hides an ambiguous first name instead of sending it', () => {
    expect(anonymizeNames('Sara set', roster)).toBe('#? set');
    expect(anonymizeNames('Sara Ruiz set', roster)).toBe('#? #2 set');
  });

  it('leaves volleyball words alone', () => {
    expect(anonymizeNames('7 ace, opp error, TO them', roster)).toBe('7 ace, opp error, TO them');
  });
});

describe('buildMessages', () => {
  it('sends numbers, roles and the anchor, never names', () => {
    const msgs = buildMessages(
      '#9 kill',
      [{ number: 9, role: 'OH', isLibero: false }, { number: 12, role: 'L', isLibero: true }],
      { set: 2, score: { us: 12, them: 10 }, serving: 'us', rotation: 3, onCourt: [9, 2, 7, 4, 11, 5] },
    );
    expect(msgs[0].role).toBe('system');
    const user = msgs[1].content;
    expect(user).toContain('"number":9');
    expect(user).toContain('"isLibero":true');
    expect(user).toContain('12-10');
    expect(user).toContain('#9 kill');
    expect(user).not.toMatch(/Lucía|Ana/);
  });
});

describe('parseBatch', () => {
  it('accepts a valid batch and fills defaults', () => {
    const r = parseBatch({ rallies: [{ actions: [{ number: 7, skill: 'S', grade: '#' }] }], unparsed: [] });
    expect(r).toEqual({
      ok: true,
      batch: { rallies: [{ actions: [{ number: 7, skill: 'S', grade: '#' }], point: null, subs: [], timeouts: [] }], unparsed: [] },
    });
  });

  it('maps unknown point reasons to null and keeps valid ones', () => {
    const r = parseBatch({ rallies: [{ actions: [], point: { winner: 'them', reason: 'whatever' } }, { actions: [], point: { winner: 'us', reason: 'oppError' } }] });
    expect(r.ok && r.batch.rallies.map((x) => x.point)).toEqual([{ winner: 'them', reason: null }, { winner: 'us', reason: 'oppError' }]);
  });

  it('rejects invalid skills, grades, numbers and shapes', () => {
    expect(parseBatch({ rallies: [{ actions: [{ number: 7, skill: 'X', grade: '#' }] }] }).ok).toBe(false);
    expect(parseBatch({ rallies: [{ actions: [{ number: 7, skill: 'A', grade: '++' }] }] }).ok).toBe(false);
    expect(parseBatch({ rallies: [{ actions: [{ number: 'seven', skill: 'A', grade: '#' }] }] }).ok).toBe(false);
    expect(parseBatch({ nope: true }).ok).toBe(false);
    expect(parseBatch(null).ok).toBe(false);
  });
});

describe('batchToPayloads', () => {
  const batch = (rallies: ParsedBatch['rallies']): ParsedBatch => ({ rallies, unparsed: [] });
  const r = (over: Partial<ParsedBatch['rallies'][number]>) => ({ actions: [], point: null, subs: [], timeouts: [], ...over });

  it('maps actions, adds a point only when no action decides the rally', () => {
    const { payloads, issues } = batchToPayloads(
      batch([
        r({ actions: [{ number: 7, skill: 'S', grade: '#' }], point: { winner: 'us', reason: null } }),
        r({ actions: [{ number: 9, skill: 'R', grade: '+' }], point: { winner: 'them', reason: 'oppKill' } }),
      ]),
      roster,
    );
    expect(payloads).toEqual([
      { type: 'action', playerId: 'p7', skill: 'S', grade: '#' },
      { type: 'action', playerId: 'p9', skill: 'R', grade: '+' },
      { type: 'point', winner: 'them', reason: 'oppKill' },
    ]);
    expect(issues).toEqual([]);
  });

  it('puts subs and timeouts before the rally actions', () => {
    const { payloads } = batchToPayloads(
      batch([r({ subs: [{ outNumber: 9, inNumber: 7 }], timeouts: [{ team: 'them' }], point: { winner: 'us', reason: 'oppError' } })]),
      roster,
    );
    expect(payloads.map((p) => p.type)).toEqual(['sub', 'timeout', 'point']);
  });

  it('flags unknown jersey numbers as blocking and skips them', () => {
    const { payloads, issues } = batchToPayloads(batch([r({ actions: [{ number: 33, skill: 'A', grade: '#' }] })]), roster);
    expect(payloads).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({ rally: 0, kind: 'unknownNumber', blocking: true }));
  });

  it('warns about rallies with no winner and about contradicting winners', () => {
    const { issues } = batchToPayloads(
      batch([
        r({ actions: [{ number: 9, skill: 'R', grade: '+' }] }),
        r({ actions: [{ number: 7, skill: 'A', grade: '#' }], point: { winner: 'them', reason: null } }),
      ]),
      roster,
    );
    expect(issues).toEqual([
      expect.objectContaining({ rally: 0, kind: 'noWinner', blocking: false }),
      expect.objectContaining({ rally: 1, kind: 'conflictingWinner', blocking: false }),
    ]);
  });
});

describe('chunkText and mergeBatches', () => {
  it('splits on lines under the size limit and never drops text', () => {
    const text = ['a'.repeat(30), 'b'.repeat(30), 'c'.repeat(30)].join('\n');
    const chunks = chunkText(text, 65);
    expect(chunks).toEqual([`${'a'.repeat(30)}\n${'b'.repeat(30)}`, 'c'.repeat(30)]);
    expect(chunkText('  ')).toEqual([]);
  });

  it('concatenates rallies and unparsed lines', () => {
    const a: ParsedBatch = { rallies: [{ actions: [], point: { winner: 'us', reason: null }, subs: [], timeouts: [] }], unparsed: ['x'] };
    const b: ParsedBatch = { rallies: [], unparsed: ['y'] };
    expect(mergeBatches([a, b])).toEqual({ rallies: a.rallies, unparsed: ['x', 'y'] });
  });
});
```

Add to `src/matches/eventOrder.test.ts`:

```ts
import { batchOrders } from './eventOrder';

describe('batchOrders', () => {
  const events = [{ id: 'a', order: 1 }, { id: 'b', order: 2 }, { id: 'c', order: 3 }];
  it('spreads orders strictly between the anchor and the next event', () => {
    const o = batchOrders(events, 'a', 3, 0);
    expect(o).toHaveLength(3);
    expect(o.every((x) => x > 1 && x < 2)).toBe(true);
    expect([...o].sort((x, y) => x - y)).toEqual(o);
  });
  it('appends after the end (and after unsynced writes) without an anchor', () => {
    expect(batchOrders(events, null, 2, 0)).toEqual([4, 5]);
    expect(batchOrders(events, null, 2, 9)).toEqual([10, 11]);
  });
  it('continues after an anchor that is the last event', () => {
    expect(batchOrders(events, 'c', 2, 0)).toEqual([4, 5]);
  });
  it('returns nothing for an empty batch', () => {
    expect(batchOrders(events, 'a', 0, 0)).toEqual([]);
  });
});
```

(Merge this `describe` into the existing file and its existing import line rather than adding a second import of the same module.)

- [ ] **Step 2: Run** `npx vitest run src/matches/text/textScout.test.ts src/matches/eventOrder.test.ts` → FAIL.

- [ ] **Step 3: Implement**

Append to `src/matches/eventOrder.ts`:

```ts
/**
 * Orders for a batch of `count` new events: strictly between the anchor and the
 * event after it, or appended after everything (including this device's
 * unsynced writes) when there is no anchor.
 */
export function batchOrders(
  events: { id: string; order: number }[],
  anchorId: string | null,
  count: number,
  maxWritten: number,
): number[] {
  if (count <= 0) return [];
  const anchor = anchorId ? events.find((e) => e.id === anchorId) : undefined;
  if (anchor) {
    const later = events.map((e) => e.order).filter((o) => o > anchor.order);
    if (later.length > 0) {
      const step = (Math.min(...later) - anchor.order) / (count + 1);
      return Array.from({ length: count }, (_, i) => anchor.order + step * (i + 1));
    }
    return Array.from({ length: count }, (_, i) => Math.max(anchor.order, maxWritten) + 1 + i);
  }
  const start = Math.max(appendOrder(events), maxWritten + 1);
  return Array.from({ length: count }, (_, i) => start + i);
}
```

`src/matches/text/textScout.ts`:

```ts
import { GRADES, SKILLS, type Grade, type MatchEventPayload, type PointReason, type RosterEntry, type Side, type Skill } from '../../types/match';
import { rallyOutcome } from '../skillGrades';
import type { ChatMessage } from './aiClient';

export interface ParsedAction {
  number: number;
  skill: Skill;
  grade: Grade;
}

export interface ParsedRally {
  actions: ParsedAction[];
  point: { winner: Side; reason: PointReason | null } | null;
  subs: { outNumber: number; inNumber: number }[];
  timeouts: { team: Side }[];
}

export interface ParsedBatch {
  rallies: ParsedRally[];
  unparsed: string[];
}

export interface AnchorInfo {
  set: number;
  score: { us: number; them: number };
  serving: Side;
  rotation: number;
  onCourt: number[];
}

export interface PromptPlayer {
  number: number;
  role: string;
  isLibero: boolean;
}

export interface BatchIssue {
  rally: number;
  kind: 'unknownNumber' | 'noWinner' | 'conflictingWinner';
  blocking: boolean;
  message: string;
}

const REASONS: PointReason[] = ['oppError', 'oppKill', 'oppAce', 'oppBlock', 'unknown'];

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Replaces roster names (any part, accent/case-insensitive) with `#number`; ambiguous parts become `#?`. */
export function anonymizeNames(text: string, roster: RosterEntry[]): string {
  const byPart = new Map<string, number | null>();
  for (const r of roster) {
    for (const part of r.name.split(/\s+/)) {
      const key = normalize(part);
      if (key.length < 2) continue;
      const existing = byPart.get(key);
      byPart.set(key, existing === undefined || existing === r.number ? r.number : null);
    }
  }
  const replaced = text.replace(/\p{L}[\p{L}'’-]*/gu, (word) => {
    const n = byPart.get(normalize(word));
    if (n === undefined) return word;
    return n === null ? '#?' : `#${n}`;
  });
  return replaced.replace(/(#\d+)(?:\s+\1)+\b/g, '$1');
}

export const SYSTEM_PROMPT = `You convert a volleyball coach's match notes about THEIR OWN team into JSON.
Players are identified only by jersey number ("#7" or "7"). "#?" means an unknown player: put that line in "unparsed".
Fundamentals (skill): S serve, R reception, A attack, B block, D dig, E set, F free ball.
Grades (DataVolley): "#" perfect/point (ace, kill, stuff block, perfect pass), "+" good, "!" ok, "-" poor, "/" overpass/blocked/free ball back, "=" error.
A rally ends with a point. Add "point" only when the notes say who won it and no action already decides it (S#, A#, B# win; any "=", A/ or B/ lose).
Point reasons (only for points not decided by our action): "oppError", "oppKill", "oppAce", "oppBlock", "unknown".
Substitutions like "8 in for 9" -> subs [{"outNumber":9,"inNumber":8}]. Timeouts "TO us"/"TO them" -> timeouts [{"team":"us"}].
Never invent players or actions. Anything you cannot map goes verbatim into "unparsed".
Reply ONLY with JSON of this shape:
{"rallies":[{"actions":[{"number":7,"skill":"S","grade":"#"}],"point":{"winner":"us","reason":"oppError"},"subs":[],"timeouts":[]}],"unparsed":[]}`;

export function buildMessages(text: string, players: PromptPlayer[], anchor: AnchorInfo): ChatMessage[] {
  const context = {
    players,
    situation: {
      set: anchor.set,
      score: `${anchor.score.us}-${anchor.score.them}`,
      serving: anchor.serving,
      rotation: anchor.rotation,
      onCourt: anchor.onCourt,
    },
  };
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Context: ${JSON.stringify(context)}\nNotes:\n${text}` },
  ];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSide = (v: unknown): v is Side => v === 'us' || v === 'them';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function parseBatch(raw: unknown): { ok: true; batch: ParsedBatch } | { ok: false; error: string } {
  if (!isObj(raw) || !Array.isArray(raw.rallies)) return { ok: false, error: 'Missing "rallies".' };
  const rallies: ParsedRally[] = [];
  for (const r of raw.rallies) {
    if (!isObj(r)) return { ok: false, error: 'A rally is not an object.' };
    const actions: ParsedAction[] = [];
    for (const a of Array.isArray(r.actions) ? r.actions : []) {
      if (!isObj(a) || !isNum(a.number) || !SKILLS.includes(a.skill as Skill) || !GRADES.includes(a.grade as Grade)) {
        return { ok: false, error: `Invalid action ${JSON.stringify(a)}.` };
      }
      actions.push({ number: a.number, skill: a.skill as Skill, grade: a.grade as Grade });
    }
    let point: ParsedRally['point'] = null;
    if (isObj(r.point)) {
      if (!isSide(r.point.winner)) return { ok: false, error: 'Invalid point winner.' };
      const reason = REASONS.includes(r.point.reason as PointReason) ? (r.point.reason as PointReason) : null;
      point = { winner: r.point.winner, reason };
    }
    const subs: ParsedRally['subs'] = [];
    for (const s of Array.isArray(r.subs) ? r.subs : []) {
      if (!isObj(s) || !isNum(s.outNumber) || !isNum(s.inNumber)) return { ok: false, error: 'Invalid substitution.' };
      subs.push({ outNumber: s.outNumber, inNumber: s.inNumber });
    }
    const timeouts: ParsedRally['timeouts'] = [];
    for (const t of Array.isArray(r.timeouts) ? r.timeouts : []) {
      if (!isObj(t) || !isSide(t.team)) return { ok: false, error: 'Invalid timeout.' };
      timeouts.push({ team: t.team });
    }
    rallies.push({ actions, point, subs, timeouts });
  }
  const unparsed = Array.isArray(raw.unparsed) ? raw.unparsed.filter((u): u is string => typeof u === 'string') : [];
  return { ok: true, batch: { rallies, unparsed } };
}

export function batchToPayloads(batch: ParsedBatch, roster: RosterEntry[]): { payloads: MatchEventPayload[]; issues: BatchIssue[] } {
  const byNumber = new Map(roster.map((r) => [r.number, r.playerId]));
  const payloads: MatchEventPayload[] = [];
  const issues: BatchIssue[] = [];
  const unknown = (rally: number, n: number) =>
    issues.push({ rally, kind: 'unknownNumber', blocking: true, message: `#${n} is not in this match's roster.` });

  batch.rallies.forEach((r, i) => {
    for (const s of r.subs) {
      const out = byNumber.get(s.outNumber);
      const inn = byNumber.get(s.inNumber);
      if (!out) unknown(i, s.outNumber);
      if (!inn) unknown(i, s.inNumber);
      if (out && inn) payloads.push({ type: 'sub', outPlayerId: out, inPlayerId: inn });
    }
    for (const t of r.timeouts) payloads.push({ type: 'timeout', team: t.team });
    let decided: Side | null = null;
    for (const a of r.actions) {
      const playerId = byNumber.get(a.number);
      if (!playerId) {
        unknown(i, a.number);
        continue;
      }
      payloads.push({ type: 'action', playerId, skill: a.skill, grade: a.grade });
      decided = rallyOutcome(a.skill, a.grade) ?? decided;
    }
    if (r.point) {
      if (decided && decided !== r.point.winner) {
        issues.push({ rally: i, kind: 'conflictingWinner', blocking: false, message: `The actions give the point to ${decided}, the notes to ${r.point.winner}.` });
      } else if (!decided) {
        payloads.push({ type: 'point', winner: r.point.winner, reason: r.point.reason });
      }
    } else if (!decided && r.actions.length > 0) {
      issues.push({ rally: i, kind: 'noWinner', blocking: false, message: 'No winner for this rally.' });
    }
  });
  return { payloads, issues };
}

/** Splits text by lines into chunks of at most `maxChars` (a single longer line stays whole). */
export function chunkText(text: string, maxChars = 1500): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxChars && current) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

export function mergeBatches(batches: ParsedBatch[]): ParsedBatch {
  return { rallies: batches.flatMap((b) => b.rallies), unparsed: batches.flatMap((b) => b.unparsed) };
}
```

Note: `rallyOutcome(...) ?? decided` keeps the latest deciding action (an `A#` after an earlier non-deciding action decides the rally).

- [ ] **Step 4: Run** the two test files → PASS; `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/matches/text/textScout.ts src/matches/text/textScout.test.ts src/matches/eventOrder.ts src/matches/eventOrder.test.ts
git commit -m "feat(text-scouting): name stripping, prompt, response validation and batch-to-events mapping"
```

---

### Task 4: Text panel — draft, process, preview, merge

**Files:**
- Create: `src/matches/text/TextScoutPanel.tsx`, `src/matches/text/PreviewRallyCard.tsx`, `src/matches/text/TextScoutPanel.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3; `replay`, `sortEvents`, `MatchState` (scoutEngine); `validGrades`, `SKILL_LABELS`, `GRADE_LABELS` (skillGrades); `POINT_REASON_LABELS`, `SKILLS` (types); `Button`, `Input`/`Textarea`, `FIELD_CLASS`.
- Produces:

```ts
interface TextScoutPanelProps {
  match: Match;
  events: MatchEvent[];
  anchorId: string | null;
  maxWritten: number;
  online: boolean;
  onMerge: (payloads: MatchEventPayload[], orders: number[]) => void;
  onClose: () => void;
  /** Injected for tests; defaults to chatJson with readAiSettings(). */
  ask?: (messages: ChatMessage[]) => Promise<unknown>;
}
```

- [ ] **Step 1: Failing test** `src/matches/text/TextScoutPanel.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type Match, type MatchEvent } from '../../types/match';
import { writeAiSettings, DEFAULT_AI_SETTINGS } from './aiSettings';
import { TextScoutPanel } from './TextScoutPanel';

const roster = [
  { playerId: 's', number: 2, name: 'Sara Ruiz', positionCategory: 'S' as const },
  { playerId: 'a', number: 7, name: 'Ana Pérez', positionCategory: 'OH' as const },
  { playerId: 'm', number: 11, name: 'Marta Gil', positionCategory: 'MB' as const },
  { playerId: 'o', number: 4, name: 'Olga Sanz', positionCategory: 'O' as const },
  { playerId: 'l', number: 9, name: 'Lucía Gómez', positionCategory: 'OH' as const },
  { playerId: 'n', number: 12, name: 'Nora Vidal', positionCategory: 'MB' as const },
];
const match = {
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT,
  roster, liberos: [], status: 'live', result: { setsUs: 0, setsThem: 0, sets: [] }, summary: null,
  usageContribution: null, activeDevice: null, createdBy: 'u', createdAt: null, updatedAt: null,
} as Match;
const setStart: MatchEvent = { id: 'e1', order: 1, source: 'tap', chunkId: null, type: 'setStart', set: 1, lineup: ['s', 'a', 'm', 'o', 'l', 'n'], serving: 'us' };

function renderPanel(over: Partial<Parameters<typeof TextScoutPanel>[0]> = {}) {
  const props = {
    match,
    events: [setStart],
    anchorId: null,
    maxWritten: 0,
    online: true,
    onMerge: vi.fn(),
    onClose: vi.fn(),
    ask: vi.fn(async () => ({
      rallies: [
        { actions: [{ number: 2, skill: 'S', grade: '#' }] },
        { actions: [{ number: 2, skill: 'S', grade: '+' }], point: { winner: 'them', reason: 'oppKill' } },
      ],
      unparsed: ['coach shouted'],
    })),
    ...over,
  };
  render(<MemoryRouter><TextScoutPanel {...props} /></MemoryRouter>);
  return props;
}

describe('TextScoutPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    writeAiSettings({ ...DEFAULT_AI_SETTINGS, apiKey: 'k' });
  });

  it('strips names before asking, previews the replayed score and merges in order', async () => {
    const props = renderPanel();
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: 'Sara ace\nSara serve, they kill' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    await screen.findByText('coach shouted');
    const sent = JSON.stringify((props.ask as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent).not.toContain('Sara');
    expect(sent).toContain('#2 ace');
    expect(screen.getByText(/0–0 → 1–1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(props.onMerge).toHaveBeenCalledWith(
      [
        { type: 'action', playerId: 's', skill: 'S', grade: '#' },
        { type: 'action', playerId: 's', skill: 'S', grade: '+' },
        { type: 'point', winner: 'them', reason: 'oppKill' },
      ],
      [2, 3, 4],
    );
  });

  it('keeps the draft across remounts', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '7 ace' } });
    document.body.innerHTML = '';
    renderPanel();
    expect(screen.getByLabelText('Match notes')).toHaveValue('7 ace');
  });

  it('blocks merge on unknown jersey numbers until the row is fixed', async () => {
    renderPanel({ ask: vi.fn(async () => ({ rallies: [{ actions: [{ number: 33, skill: 'A', grade: '#' }] }], unparsed: [] })) });
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '33 kill' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    expect(await screen.findByText('#33 is not in this match\'s roster.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Rally 1 action 1 player'), { target: { value: '7' } });
    expect(screen.getByRole('button', { name: 'Merge' })).toBeEnabled();
  });

  it('flags a score mismatch against the actual score', async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    await screen.findByText('coach shouted');
    fireEvent.change(screen.getByLabelText('Actual score us'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Actual score them'), { target: { value: '1' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/1–1.*2–1/);
  });

  it('needs a set in play, a configured provider and a connection', () => {
    renderPanel({ events: [] });
    expect(screen.getByText('Start the set first.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Process' })).toBeDisabled();
  });

  it('shows provider errors and keeps the draft', async () => {
    const { AiError } = await import('./aiClient');
    renderPanel({ ask: vi.fn(async () => { throw new AiError('rateLimited', 'x', 429, 20); }) });
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '7 ace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('retry in 20 s');
    expect(screen.getByLabelText('Match notes')).toHaveValue('7 ace');
  });

  it('retries once when the reply fails validation', async () => {
    const ask = vi.fn()
      .mockResolvedValueOnce({ nope: 1 })
      .mockResolvedValueOnce({ rallies: [{ actions: [{ number: 2, skill: 'S', grade: '#' }] }], unparsed: [] });
    renderPanel({ ask });
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '2 ace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Merge' })).toBeEnabled());
    expect(ask).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`src/matches/text/PreviewRallyCard.tsx`:

```tsx
import { Trash2 } from 'lucide-react';
import { FIELD_CLASS } from '../../components/Input';
import { POINT_REASON_LABELS, SKILLS, type Grade, type RosterEntry, type Skill } from '../../types/match';
import { GRADE_LABELS, SKILL_LABELS, validGrades } from '../skillGrades';
import type { BatchIssue, ParsedRally } from './textScout';

interface Props {
  index: number;
  rally: ParsedRally;
  roster: RosterEntry[];
  issues: BatchIssue[];
  onChange: (rally: ParsedRally) => void;
  onDelete: () => void;
}

const SELECT = `${FIELD_CLASS} min-h-11 px-2 py-1 text-sm`;

export function PreviewRallyCard({ index, rally, roster, issues, onChange, onDelete }: Props) {
  const n = index + 1;
  const setAction = (i: number, patch: Partial<ParsedRally['actions'][number]>) =>
    onChange({ ...rally, actions: rally.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  return (
    <li className={`rounded-md border p-2 ${issues.some((x) => x.blocking) ? 'border-red' : 'border-border'} bg-surface`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Rally {n}</span>
        <button type="button" aria-label={`Delete rally ${n}`} onClick={onDelete} className="flex h-11 w-11 items-center justify-center rounded-md text-red hover:bg-red/10">
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      {(rally.subs.length > 0 || rally.timeouts.length > 0) && (
        <p className="mb-1 text-xs text-slate">
          {rally.subs.map((s) => `Sub #${s.inNumber} in for #${s.outNumber}`).concat(rally.timeouts.map((t) => `Timeout ${t.team}`)).join(' · ')}
        </p>
      )}
      <ul className="space-y-1">
        {rally.actions.map((a, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1">
            <select aria-label={`Rally ${n} action ${i + 1} player`} className={SELECT} value={a.number} onChange={(e) => setAction(i, { number: Number(e.target.value) })}>
              {!roster.some((r) => r.number === a.number) && <option value={a.number}>#{a.number} ?</option>}
              {roster.map((r) => (
                <option key={r.playerId} value={r.number}>#{r.number}</option>
              ))}
            </select>
            <select
              aria-label={`Rally ${n} action ${i + 1} skill`}
              className={SELECT}
              value={a.skill}
              onChange={(e) => {
                const skill = e.target.value as Skill;
                const grades = validGrades(skill);
                setAction(i, { skill, grade: grades.includes(a.grade) ? a.grade : grades[0] });
              }}
            >
              {SKILLS.map((s) => (
                <option key={s} value={s}>{SKILL_LABELS[s]}</option>
              ))}
            </select>
            <select aria-label={`Rally ${n} action ${i + 1} grade`} className={SELECT} value={a.grade} onChange={(e) => setAction(i, { grade: e.target.value as Grade })}>
              {validGrades(a.skill).map((g) => (
                <option key={g} value={g}>{g} {GRADE_LABELS[a.skill][g]}</option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`Delete rally ${n} action ${i + 1}`}
              onClick={() => onChange({ ...rally, actions: rally.actions.filter((_, j) => j !== i) })}
              className="flex h-11 w-11 items-center justify-center rounded-md text-slate hover:bg-bg"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <label className="mt-2 flex items-center gap-2 text-sm text-ink">
        Point
        <select
          aria-label={`Rally ${n} point`}
          className={SELECT}
          value={rally.point ? rally.point.winner : ''}
          onChange={(e) =>
            onChange({ ...rally, point: e.target.value ? { winner: e.target.value as 'us' | 'them', reason: rally.point?.reason ?? null } : null })
          }
        >
          <option value="">From the actions</option>
          <option value="us">Us</option>
          <option value="them">Them</option>
        </select>
        {rally.point?.reason && <span className="text-xs text-slate">{POINT_REASON_LABELS[rally.point.reason]}</span>}
      </label>
      {issues.map((x, i) => (
        <p key={i} className={`mt-1 text-xs ${x.blocking ? 'text-red' : 'text-orange-strong'}`}>{x.message}</p>
      ))}
    </li>
  );
}
```

`src/matches/text/TextScoutPanel.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input, Textarea } from '../../components/Input';
import type { Match, MatchEvent, MatchEventPayload } from '../../types/match';
import { batchOrders } from '../eventOrder';
import { replay, sortEvents } from '../scoutEngine';
import { AiError, chatJson, type ChatMessage } from './aiClient';
import { isAiConfigured, readAiSettings, readDraft, writeDraft } from './aiSettings';
import { PreviewRallyCard } from './PreviewRallyCard';
import {
  anonymizeNames,
  batchToPayloads,
  buildMessages,
  chunkText,
  mergeBatches,
  parseBatch,
  type ParsedBatch,
} from './textScout';

interface TextScoutPanelProps {
  match: Match;
  events: MatchEvent[];
  anchorId: string | null;
  maxWritten: number;
  online: boolean;
  onMerge: (payloads: MatchEventPayload[], orders: number[]) => void;
  onClose: () => void;
  ask?: (messages: ChatMessage[]) => Promise<unknown>;
}

const ERROR_TEXT: Record<AiError['kind'], string> = {
  notConfigured: 'Set up an AI provider in Settings first.',
  unauthorized: 'Key rejected — check it in Settings.',
  rateLimited: 'Rate limit reached',
  unreachable: 'Could not reach the AI provider. Your notes are kept.',
  badResponse: "Couldn't parse — edit the notes or enter by taps.",
  http: 'The AI provider returned an error. Your notes are kept.',
};

export function TextScoutPanel({ match, events, anchorId, maxWritten, online, onMerge, onClose, ask }: TextScoutPanelProps) {
  const [text, setText] = useState(() => readDraft(match.id));
  const [batch, setBatch] = useState<ParsedBatch | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actual, setActual] = useState<{ us: string; them: string }>({ us: '', them: '' });
  const settings = readAiSettings();
  const configured = !!ask || isAiConfigured(settings);
  const askModel = ask ?? ((messages: ChatMessage[]) => chatJson(settings, messages));

  const sorted = useMemo(() => sortEvents(events), [events]);
  const anchorOrder = anchorId ? sorted.find((e) => e.id === anchorId)?.order ?? Infinity : Infinity;
  const before = useMemo(() => sorted.filter((e) => e.order <= anchorOrder), [sorted, anchorOrder]);
  const anchorState = useMemo(() => replay(match, before), [match, before]);

  const { payloads, issues } = useMemo(
    () => (batch ? batchToPayloads(batch, match.roster) : { payloads: [], issues: [] }),
    [batch, match.roster],
  );
  const orders = useMemo(() => batchOrders(events, anchorId, payloads.length, maxWritten), [events, anchorId, payloads.length, maxWritten]);
  const drafts = useMemo<MatchEvent[]>(
    () => payloads.map((p, i) => ({ ...p, id: `draft-${i}`, order: orders[i], source: 'text', chunkId: 'draft' }) as MatchEvent),
    [payloads, orders],
  );
  const afterState = useMemo(() => replay(match, [...before, ...drafts]), [match, before, drafts]);
  const laterIds = useMemo(() => new Set(sorted.filter((e) => e.order > anchorOrder).map((e) => e.id)), [sorted, anchorOrder]);
  const laterConflicts = useMemo(
    () => (laterIds.size === 0 ? 0 : replay(match, [...events, ...drafts]).warnings.filter((w) => laterIds.has(w.eventId)).length),
    [match, events, drafts, laterIds],
  );

  const blocking = issues.some((x) => x.blocking);
  const actualUs = actual.us === '' ? null : Number(actual.us);
  const actualThem = actual.them === '' ? null : Number(actual.them);
  const mismatch =
    batch && actualUs !== null && actualThem !== null && (actualUs !== afterState.score.us || actualThem !== afterState.score.them);

  function editText(next: string) {
    setText(next);
    writeDraft(match.id, next);
  }

  async function process() {
    setError(null);
    const chunks = chunkText(anonymizeNames(text, match.roster));
    if (chunks.length === 0) return;
    const liberoIds = new Set(match.liberos.map((l) => l.playerId));
    const players = match.roster.map((r) => ({
      number: r.number,
      role: anchorState.roles[r.playerId] ?? r.positionCategory,
      isLibero: liberoIds.has(r.playerId),
    }));
    const numberOf = new Map(match.roster.map((r) => [r.playerId, r.number]));
    const anchor = {
      set: anchorState.set,
      score: anchorState.score,
      serving: anchorState.serving,
      rotation: anchorState.rotation,
      onCourt: anchorState.court.map((id) => numberOf.get(id)).filter((n): n is number => n !== undefined),
    };
    const results: ParsedBatch[] = [];
    try {
      for (let i = 0; i < chunks.length; i++) {
        setBusy(chunks.length > 1 ? `Processing ${i + 1}/${chunks.length}…` : 'Processing…');
        const messages = buildMessages(chunks[i], players, anchor);
        let parsed = parseBatch(await askModel(messages));
        if (!parsed.ok) parsed = parseBatch(await askModel(messages));
        if (!parsed.ok) throw new AiError('badResponse', parsed.error);
        results.push(parsed.batch);
      }
      setBatch(mergeBatches(results));
    } catch (e) {
      if (e instanceof AiError) {
        setError(e.kind === 'rateLimited' && e.retryAfterSec ? `${ERROR_TEXT.rateLimited} — retry in ${e.retryAfterSec} s.` : ERROR_TEXT[e.kind]);
      } else {
        setError('Something went wrong. Your notes are kept.');
      }
    } finally {
      setBusy(null);
    }
  }

  function merge() {
    onMerge(payloads, orders);
    setBatch(null);
    editText('');
    setActual({ us: '', them: '' });
  }

  const canProcess = anchorState.inSet && configured && online && !busy && text.trim().length > 0;

  return (
    <section aria-label="Text scouting" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">Text</h2>
        <button type="button" onClick={onClose} className="min-h-11 rounded-md px-3 text-sm text-blue hover:bg-blue/10">Close</button>
      </div>
      <p className="text-xs tabular-nums text-slate">
        Inserting {anchorId ? 'after' : 'at'} {anchorState.score.us}–{anchorState.score.them} · Set {anchorState.set || '–'} · Rot {anchorState.rotation} ·{' '}
        {anchorState.serving === 'us' ? 'we serve' : 'they serve'}
      </p>
      {!anchorState.inSet && <p className="text-sm text-orange-strong">Start the set first.</p>}
      {!configured && (
        <p className="text-sm text-slate">
          No AI provider set up. <Link to="/settings" className="text-blue hover:underline">Open Settings</Link>
        </p>
      )}
      {!online && <p className="text-sm text-slate">Offline — your notes are saved; process them when you're back online.</p>}
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Match notes
        <Textarea
          aria-label="Match notes"
          rows={5}
          value={text}
          onChange={(e) => editText(e.target.value)}
          placeholder={'7 ace\n12 bad reception, 2 set, 9 kill\nopp error · TO them · 8 in for 9'}
        />
      </label>
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => void process()} disabled={!canProcess}>Process</Button>
        {busy && <span className="text-sm text-slate">{busy}</span>}
      </div>
      {error && <p role="alert" className="text-sm text-red">{error}</p>}

      {batch && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tabular-nums text-ink">
            {anchorState.score.us}–{anchorState.score.them} → {afterState.score.us}–{afterState.score.them} · Rot {afterState.rotation} ·{' '}
            {afterState.serving === 'us' ? 'we serve' : 'they serve'}
          </p>
          {laterConflicts > 0 && (
            <p className="text-xs text-orange-strong">{laterConflicts} later event(s) get warnings after this insert — check the timeline.</p>
          )}
          {batch.unparsed.length > 0 && (
            <div className="rounded-md bg-orange/10 p-2 text-xs text-ink">
              <p className="font-medium">Not understood:</p>
              <ul className="list-inside list-disc">
                {batch.unparsed.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {batch.rallies.map((r, i) => (
              <PreviewRallyCard
                key={i}
                index={i}
                rally={r}
                roster={match.roster}
                issues={issues.filter((x) => x.rally === i)}
                onChange={(next) => setBatch({ ...batch, rallies: batch.rallies.map((x, j) => (j === i ? next : x)) })}
                onDelete={() => setBatch({ ...batch, rallies: batch.rallies.filter((_, j) => j !== i) })}
              />
            ))}
          </ul>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-slate">
              Actual score — us
              <Input aria-label="Actual score us" type="number" min={0} className="w-20 tabular-nums" value={actual.us} onChange={(e) => setActual({ ...actual, us: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate">
              them
              <Input aria-label="Actual score them" type="number" min={0} className="w-20 tabular-nums" value={actual.them} onChange={(e) => setActual({ ...actual, them: e.target.value })} />
            </label>
          </div>
          {mismatch && (
            <p role="alert" className="text-sm text-red">
              Replay gives {afterState.score.us}–{afterState.score.them}, actual is {actual.us}–{actual.them}. Check rallies with no winner.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setBatch(null)}>Discard</Button>
            <Button variant="primary" size="sm" onClick={merge} disabled={blocking || payloads.length === 0}>Merge</Button>
          </div>
        </div>
      )}
    </section>
  );
}
```

Notes for the implementer:
- `Textarea` exists in `src/components/Input.tsx`. `anchorState.roles` exists on `MatchState` (per-set roles). `POINT_REASON_LABELS` is in `src/types/match.ts`.
- The "keeps the draft across remounts" test relies on `readDraft` in the `useState` initializer.
- The score-mismatch test: with the default `ask`, the replayed result is 1–1 (S# us; then the point them).

- [ ] **Step 4: Run** `npx vitest run src/matches/text` → PASS; `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/matches/text/TextScoutPanel.tsx src/matches/text/PreviewRallyCard.tsx src/matches/text/TextScoutPanel.test.tsx
git commit -m "feat(text-scouting): text panel with draft, AI processing, editable preview and merge"
```

---

### Task 5: Wire the panel into the scouting screen

**Files:**
- Modify: `src/matches/scout/ScoutPage.tsx`, `src/matches/scout/ScoutPage.test.tsx`

**Interfaces:**
- Consumes: `TextScoutPanel` (Task 4); existing ScoutPage internals: `addEvent`, `writtenRef`, `lastWriteRef`, `maxOrderRef`, `anchorId`/`setAnchorId`, `phoneTab`/`setPhoneTab`, `autoSelect` effect, `setWriteError`, `firebaseUser`.
- Produces: phone tab **Text** (`phoneTab === 'text'`); desktop footer button **✎ Text** toggling `textOpen`; `mergeText(payloads, orders)`.

- [ ] **Step 1: Failing tests** — add to `ScoutPage.test.tsx` (it already mocks `../matchesApi` and renders desktop layout because jsdom lacks `matchMedia`). Mock the panel to drive merges deterministically:

```tsx
vi.mock('../text/TextScoutPanel', () => ({
  TextScoutPanel: ({ onMerge, anchorId }: { onMerge: (p: unknown[], o: number[]) => void; anchorId: string | null }) => (
    <button
      onClick={() =>
        onMerge(
          [
            { type: 'action', playerId: 's', skill: 'S', grade: '#' },
            { type: 'point', winner: 'them', reason: null },
          ],
          anchorId ? [1.25, 1.5] : [2, 3],
        )
      }
    >
      merge-stub
    </button>
  ),
}));
```

Tests:

```tsx
  it('merges text events as one batch with source text and a shared chunkId', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: /text/i }));
    fireEvent.click(screen.getByRole('button', { name: 'merge-stub' }));
    const calls = vi.mocked(api.addEvent).mock.calls.map((c) => c[2]);
    expect(calls).toHaveLength(2);
    expect(calls.every((e) => e.source === 'text')).toBe(true);
    expect(new Set(calls.map((e) => e.chunkId)).size).toBe(1);
    expect(calls[0].chunkId).not.toBeNull();
    expect(calls.map((e) => e.order)).toEqual([2, 3]);
  });

  it('does not auto-select while the text panel is open', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: /text/i }));
    expect(screen.queryByRole('region', { name: /actions for/i })).toBeNull();
  });
```

(If the existing test file's `renderPage` helper or `setStart` fixture differ in name, adapt to them; keep the assertions. If the auto-select test already shows an action sheet on mount with Auto on, assert it disappears after opening the Text panel.)

- [ ] **Step 2: Run** `npx vitest run src/matches/scout/ScoutPage.test.tsx` → FAIL.

- [ ] **Step 3: Implement** in `ScoutPage.tsx`:

1. Imports: `import { TextScoutPanel } from '../text/TextScoutPanel';` and `PenLine` from `lucide-react` (merge into the existing lucide import).
2. State: `const [textOpen, setTextOpen] = useState(false);` and extend the phone tab type to `'court' | 'live' | 'timeline' | 'text'`. A derived flag: `const textVisible = isDesktop ? textOpen : phoneTab === 'text';`
3. Online flag:

```tsx
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
```

4. Merge handler (next to `record`):

```tsx
  function mergeText(payloads: MatchEventPayload[], orders: number[]) {
    if (!firebaseUser || payloads.length === 0) return;
    const chunkId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `chunk-${Date.now()}`;
    payloads.forEach((payload, i) => {
      const { id, written } = addEvent(teamId, matchId, { ...payload, order: orders[i], source: 'text', chunkId }, firebaseUser.uid);
      written.catch(() => setWriteError('Some text events could not be saved. Check your connection and the timeline.'));
      writtenRef.current.push(id);
      lastWriteRef.current = { id, order: orders[i] };
      maxOrderRef.current = Math.max(maxOrderRef.current, orders[i]);
    });
    setAnchorId(null);
  }
```

5. Auto-select suspension: in the auto-select effect's guard (currently `if (!autoSelect || !state.inSet) return;`) add `|| textVisible`, include `textVisible` in its dependency array, and when `textVisible` becomes true clear the current selection (`setSelection(null)` in a small effect keyed on `textVisible`).
6. Panel element:

```tsx
  const textPanel = (
    <TextScoutPanel
      match={match}
      events={events ?? []}
      anchorId={anchorId}
      maxWritten={maxOrderRef.current}
      online={online}
      onMerge={mergeText}
      onClose={() => (isDesktop ? setTextOpen(false) : setPhoneTab('court'))}
    />
  );
```

7. Layout: desktop right column renders `textOpen ? textPanel : live` above the timeline; phone adds `<Tab active={phoneTab === 'text'} onClick={() => setPhoneTab('text')}>Text</Tab>` and `{phoneTab === 'text' && textPanel}`. Desktop footer gets a button next to Undo:

```tsx
          <button
            type="button"
            onClick={() => setTextOpen((v) => !v)}
            aria-pressed={textOpen}
            className="hidden min-h-11 items-center gap-1 rounded-md px-3 text-sm font-medium text-ink hover:bg-bg lg:flex"
          >
            <PenLine size={16} aria-hidden="true" /> Text
          </button>
```

8. Hotkeys: typing in the textarea is already ignored (`isTypingTarget`). No change needed; verify with the existing hotkey tests.
9. Timeline "Insert after" already sets `anchorId`; the panel shows "Inserting after …" from it. Undo already confirms a whole `chunkId` batch — no change.

- [ ] **Step 4: Run** `npx vitest run src/matches` → PASS; then `npm test`, `npm run lint`, `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add src/matches/scout/ScoutPage.tsx src/matches/scout/ScoutPage.test.tsx
git commit -m "feat(text-scouting): text panel on the scouting screen; merges as one undoable batch"
```

---

### Task 6: Docs, privacy copy and final verification

**Files:**
- Modify: `src/legal/PrivacyPage.tsx` (+ its test if it asserts copy), `CLAUDE.md`

- [ ] **Step 1:** Privacy page — add a short paragraph under the existing data-processing section:

> **Text scouting (optional).** If a coach enables text scouting, their typed match notes are sent to the AI provider they choose in Settings (Groq by default, OpenRouter, or a model running on their own computer) to be turned into scouting actions. Player names are replaced by jersey numbers on the device before sending; only jersey numbers, playing roles, the score and the notes are sent. The provider key and drafts are stored only on that device and removed on sign-out.

If `src/legal/PrivacyPage.test.tsx` asserts headings/copy, add an assertion that the page mentions "Text scouting".

- [ ] **Step 2:** `CLAUDE.md` — in the Architecture section add one short paragraph: text scouting uses a provider-agnostic OpenAI-compatible client (`src/matches/text/aiClient.ts`), settings and drafts in localStorage only (`aiSettings.ts`), names stripped to jersey numbers before sending (`textScout.ts`), merges are `source: 'text'` events sharing a `chunkId`. Keep the file's ~80-column wrapping.

- [ ] **Step 3:** Verify: `npm test`, `npm run lint`, `npm run build` — all green. Check every changed file is valid UTF-8: `for f in $(git diff --name-only main...HEAD); do iconv -f UTF-8 -t UTF-8 "$f" >/dev/null || echo "BAD $f"; done`.

- [ ] **Step 4: Commit**

```bash
git add src/legal/PrivacyPage.tsx CLAUDE.md
git commit -m "docs(text-scouting): privacy copy and architecture note"
```

(Stage the privacy test too if changed.)

- [ ] **Step 5:** Hand over for a manual test: Settings → choose Groq, paste a key, **Test connection**; scouting screen → **Text** → type notes → **Process** → edit a row → **Merge** → **Undo** removes the batch after confirming.
