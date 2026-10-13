import { describe, expect, it, vi } from 'vitest';
import { AiError, chatJson, extractJson, testConnection } from './aiClient';
import type { AiSettings } from './aiSettings';

const settings: AiSettings = { provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'k', model: 'm', rememberKey: true };
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
    expect(init.referrerPolicy).toBe('no-referrer');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: 'm', messages, temperature: 0, response_format: { type: 'json_object' } });
  });

  it('omits Authorization when there is no key (local)', async () => {
    const fetchImpl = vi.fn(async () => reply('{}'));
    await chatJson({ provider: 'local', baseUrl: 'http://localhost:11434/v1/', apiKey: '', model: 'm', rememberKey: true }, messages, { fetchImpl });
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

  it('reports an aborted request as unreachable', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => { throw new DOMException('Aborted', 'AbortError'); });
    await expect(chatJson(settings, messages, { fetchImpl, signal: controller.signal })).rejects.toMatchObject({ kind: 'unreachable' });
    expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBe(controller.signal);
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
