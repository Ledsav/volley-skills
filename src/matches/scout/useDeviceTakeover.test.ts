import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '../../types/match';
import * as api from '../matchesApi';
import { useDeviceTakeover } from './useDeviceTakeover';

vi.mock('../matchesApi');

const base = { teamId: 't1', matchId: 'm1', deviceId: 'me', active: true };
let push: (m: Match | null) => void = () => undefined;
const unsubscribe = vi.fn();
const withDevice = (id: string, at: number) => ({ id: 'm1', activeDevice: { id, at } }) as unknown as Match;

describe('useDeviceTakeover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(api.claimDevice).mockResolvedValue();
    vi.mocked(api.subscribeMatch).mockImplementation((_t, _m, onChange) => {
      push = onChange;
      return unsubscribe;
    });
  });
  afterEach(() => vi.useRealTimers());

  it('stops the heartbeat once another device claims', async () => {
    const { result } = renderHook(() => useDeviceTakeover(base));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.claimDevice).toHaveBeenCalledTimes(1);
    act(() => push(withDevice('other', Date.now())));
    expect(result.current.takenOver).toBe(true);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(api.claimDevice).toHaveBeenCalledTimes(1);
  });

  it('ignores its own claim and a stale claim from another device', () => {
    const { result } = renderHook(() => useDeviceTakeover(base));
    act(() => push(withDevice('me', Date.now())));
    expect(result.current.takenOver).toBe(false);
    act(() => push(withDevice('other', Date.now() - 3 * 60_000)));
    expect(result.current.takenOver).toBe(false);
    act(() => push(null));
    expect(result.current.takenOver).toBe(false);
  });

  it('take back claims again and resumes the heartbeat', async () => {
    const { result } = renderHook(() => useDeviceTakeover(base));
    act(() => push(withDevice('other', Date.now())));
    act(() => result.current.takeBack());
    expect(api.claimDevice).toHaveBeenCalledWith('t1', 'm1', 'me');
    expect(result.current.takenOver).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.claimDevice).toHaveBeenCalledTimes(2);
  });

  it('runs exactly one heartbeat and stops it, with the listener, on unmount', async () => {
    const { unmount } = renderHook(() => useDeviceTakeover(base));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(api.claimDevice).toHaveBeenCalledTimes(2);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(api.claimDevice).toHaveBeenCalledTimes(2);
  });

  it('does nothing while inactive', async () => {
    renderHook(() => useDeviceTakeover({ ...base, active: false }));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(api.subscribeMatch).not.toHaveBeenCalled();
    expect(api.claimDevice).not.toHaveBeenCalled();
  });
});
