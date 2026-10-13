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
    return await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
      referrerPolicy: 'no-referrer',
    });
  } catch {
    if (opts.signal?.aborted) throw new AiError('unreachable', 'The request was cancelled or timed out.');
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
