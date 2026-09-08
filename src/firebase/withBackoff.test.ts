import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withBackoff } from './withBackoff';

function firestoreError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

describe('withBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the result without delay when the operation succeeds first try', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await withBackoff(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on resource-exhausted and resolves once the operation recovers', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(firestoreError('resource-exhausted'))
      .mockRejectedValueOnce(firestoreError('resource-exhausted'))
      .mockResolvedValue('recovered');

    const promise = withBackoff(fn, { retries: 3, baseMs: 100, maxMs: 1000 });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries on unavailable', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(firestoreError('unavailable'))
      .mockResolvedValue('ok');

    const promise = withBackoff(fn, { retries: 2, baseMs: 50, maxMs: 500 });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rethrows a non-retryable error immediately without retrying', async () => {
    const fn = vi.fn().mockRejectedValue(firestoreError('permission-denied'));

    await expect(withBackoff(fn, { retries: 3, baseMs: 100, maxMs: 1000 })).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget is exhausted and rethrows the last error', async () => {
    const fn = vi.fn().mockRejectedValue(firestoreError('unavailable'));

    const promise = withBackoff(fn, { retries: 2, baseMs: 10, maxMs: 100 });
    const assertion = expect(promise).rejects.toMatchObject({ code: 'unavailable' });
    await vi.runAllTimersAsync();
    await assertion;

    // initial attempt + 2 retries
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
