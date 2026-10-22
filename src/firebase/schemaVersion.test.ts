import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLEAR_TIMEOUT_MS, resetCacheIfSchemaChanged, SCHEMA_KEY } from './schemaVersion';

vi.mock('./config', () => ({ db: {} }));

function storage(value: string | null = null) {
  return { getItem: vi.fn(() => value), setItem: vi.fn() };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('resetCacheIfSchemaChanged', () => {
  it('clears the cache once and records the version', async () => {
    const s = storage();
    const clear = vi.fn().mockResolvedValue(undefined);
    await resetCacheIfSchemaChanged({ storage: s, clear });
    expect(clear).toHaveBeenCalledTimes(1);
    expect(s.setItem).toHaveBeenCalledWith(SCHEMA_KEY, '2');
    expect(SCHEMA_KEY).toBe('vcb.schemaVersion');
  });

  it('does nothing when the version matches', async () => {
    const clear = vi.fn();
    await resetCacheIfSchemaChanged({ storage: storage('2'), clear });
    expect(clear).not.toHaveBeenCalled();
  });

  it('leaves the key unset when another tab holds the cache', async () => {
    const s = storage('1');
    await expect(
      resetCacheIfSchemaChanged({ storage: s, clear: vi.fn().mockRejectedValue(new Error('failed-precondition')) }),
    ).resolves.toBeUndefined();
    expect(s.setItem).not.toHaveBeenCalled();
  });

  it('gives up after the timeout', async () => {
    vi.useFakeTimers();
    const s = storage();
    const done = resetCacheIfSchemaChanged({ storage: s, clear: () => new Promise<void>(() => {}) });
    await vi.advanceTimersByTimeAsync(CLEAR_TIMEOUT_MS);
    await expect(done).resolves.toBeUndefined();
    expect(s.setItem).not.toHaveBeenCalled();
  });

  it('survives blocked storage', async () => {
    const clear = vi.fn();
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: vi.fn(),
    };
    await expect(resetCacheIfSchemaChanged({ storage: blocked, clear })).resolves.toBeUndefined();
    expect(clear).not.toHaveBeenCalled();
  });
});
