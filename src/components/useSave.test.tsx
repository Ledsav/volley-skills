import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineError, useSave } from './useSave';

const setOnline = (online: boolean) => vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online);

describe('useSave', () => {
  afterEach(() => vi.restoreAllMocks());

  it('ignores a second save while the first is in flight', async () => {
    let resolve: () => void = () => undefined;
    const write = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const { result } = renderHook(() => useSave());

    let first: Promise<boolean> = Promise.resolve(false);
    let second: Promise<boolean> = Promise.resolve(false);
    act(() => {
      first = result.current.save(write);
      second = result.current.save(write);
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(true);
    expect(await second).toBe(false);

    await act(async () => {
      resolve();
      expect(await first).toBe(true);
    });
    expect(result.current.saving).toBe(false);
  });

  it('rethrows a failed write and allows another try', async () => {
    const { result } = renderHook(() => useSave());
    await act(async () => {
      await expect(result.current.save(() => Promise.reject(new Error('denied')))).rejects.toThrow('denied');
    });
    expect(result.current.saving).toBe(false);
    const ok = vi.fn(() => Promise.resolve());
    await act(async () => {
      expect(await result.current.save(ok)).toBe(true);
    });
  });

  it('offline, queues the write and reports done without waiting for the server', async () => {
    setOnline(false);
    const write = vi.fn(() => new Promise<void>(() => undefined)); // never acked while offline
    const { result } = renderHook(() => useSave());
    await act(async () => {
      expect(await result.current.save(write)).toBe(true);
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(false);
  });

  it('offline with offline: "block", refuses before writing', async () => {
    setOnline(false);
    const write = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useSave());
    await act(async () => {
      await expect(result.current.save(write, { offline: 'block' })).rejects.toBeInstanceOf(OfflineError);
    });
    expect(write).not.toHaveBeenCalled();
  });
});
