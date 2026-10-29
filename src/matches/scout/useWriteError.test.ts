import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWriteError } from './useWriteError';

function deferred() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('useWriteError', () => {
  it('a rejected write shows the message', async () => {
    const { result } = renderHook(() => useWriteError());
    const w = deferred();
    act(() => result.current.track(w.promise, 'boom'));
    w.reject(new Error('x'));
    await flush();
    expect(result.current.error).toBe('boom');
  });

  it('a write issued after the error clears it once acknowledged', async () => {
    const { result } = renderHook(() => useWriteError());
    act(() => result.current.show('boom'));
    const w = deferred();
    act(() => result.current.track(w.promise, 'boom'));
    expect(result.current.error).toBe('boom');
    w.resolve();
    await flush();
    expect(result.current.error).toBeNull();
  });

  it('a write issued before the error does not clear it', async () => {
    const { result } = renderHook(() => useWriteError());
    const w1 = deferred();
    const w2 = deferred();
    const w3 = deferred();
    act(() => result.current.track(w1.promise, 'boom'));
    act(() => result.current.track(w2.promise, 'boom'));
    w2.reject(new Error('x'));
    await flush();
    expect(result.current.error).toBe('boom');
    act(() => result.current.track(w3.promise, 'boom'));
    w1.resolve();
    await flush();
    expect(result.current.error).toBe('boom');
    w3.resolve();
    await flush();
    expect(result.current.error).toBeNull();
  });

  it('stays while later writes are also rejected', async () => {
    const { result } = renderHook(() => useWriteError());
    const w1 = deferred();
    const w2 = deferred();
    act(() => result.current.track(w1.promise, 'boom'));
    w1.reject(new Error('x'));
    await flush();
    act(() => result.current.track(w2.promise, 'boom'));
    w2.reject(new Error('x'));
    await flush();
    expect(result.current.error).toBe('boom');
  });

  it('dismiss clears it', () => {
    const { result } = renderHook(() => useWriteError());
    act(() => result.current.show('boom'));
    act(() => result.current.dismiss());
    expect(result.current.error).toBeNull();
  });
});
