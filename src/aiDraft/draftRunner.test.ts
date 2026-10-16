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
