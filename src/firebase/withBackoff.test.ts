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

  it('rethrows a non-object throw (string, undefined) immediately', async () => {
    const stringThrower = vi.fn().mockRejectedValue('boom');
    await expect(withBackoff(stringThrower)).rejects.toBe('boom');
    expect(stringThrower).toHaveBeenCalledTimes(1);

    const undefinedThrower = vi.fn().mockImplementation(() => Promise.reject());
    await expect(withBackoff(undefinedThrower)).rejects.toBeUndefined();
    expect(undefinedThrower).toHaveBeenCalledTimes(1);
  });

  it('never schedules a retry delay longer than the ceiling for that attempt', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const fn = vi.fn().mockRejectedValue(firestoreError('unavailable'));

    const promise = withBackoff(fn, { retries: 3, baseMs: 100, maxMs: 250 });
    const assertion = expect(promise).rejects.toMatchObject({ code: 'unavailable' });
    await vi.runAllTimersAsync();
    await assertion;

    // ceilings per attempt: min(250, 100), min(250, 200), min(250, 400) => 100, 200, 250
    const delays = timeoutSpy.mock.calls.map(([, ms]) => ms as number);
    expect(delays).toHaveLength(3);
    expect(delays[0]).toBeLessThanOrEqual(100);
    expect(delays[1]).toBeLessThanOrEqual(200);
    expect(delays[2]).toBeLessThanOrEqual(250);
    for (const d of delays) expect(d).toBeGreaterThanOrEqual(0);

    timeoutSpy.mockRestore();
  });
});
