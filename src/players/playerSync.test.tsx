import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { NoticeProvider } from '../components/Notice';
import { PendingDot, PlayerSyncProvider, usePlayerSync } from './playerSync';

function deferred() {
  let resolve: () => void = () => undefined;
  let reject: (e: Error) => void = () => undefined;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <NoticeProvider>
    <PlayerSyncProvider>{children}</PlayerSyncProvider>
  </NoticeProvider>
);

describe('playerSync', () => {
  it('queued shows the offline notice and marks the key pending until it settles', async () => {
    const { result } = renderHook(() => usePlayerSync(), { wrapper });
    const d = deferred();
    act(() => result.current.queued('skills', d.promise));
    expect(screen.getByText('Saved on this device · will sync')).toBeInTheDocument();
    expect(result.current.isPending('skills')).toBe(true);
    expect(result.current.isPending('plan')).toBe(false);
    await act(async () => d.resolve());
    expect(result.current.isPending('skills')).toBe(false);
    expect(result.current.syncFailed).toBe(false);
  });

  it('a key stays pending until every queued write on it settles', async () => {
    const { result } = renderHook(() => usePlayerSync(), { wrapper });
    const a = deferred();
    const b = deferred();
    act(() => {
      result.current.queued('contact', a.promise);
      result.current.queued('contact', b.promise);
    });
    await act(async () => a.resolve());
    expect(result.current.isPending('contact')).toBe(true);
    await act(async () => b.resolve());
    expect(result.current.isPending('contact')).toBe(false);
  });

  it('a rejected queued write clears the key and raises syncFailed', async () => {
    const { result } = renderHook(() => usePlayerSync(), { wrapper });
    const d = deferred();
    act(() => result.current.queued('guardians', d.promise));
    await act(async () => d.reject(new Error('denied')));
    expect(result.current.isPending('guardians')).toBe(false);
    expect(result.current.syncFailed).toBe(true);
  });

  it('without a provider it is inert', () => {
    const { result } = renderHook(() => usePlayerSync());
    act(() => result.current.queued('skills', new Promise(() => undefined)));
    expect(result.current.isPending('skills')).toBe(false);
    expect(result.current.syncFailed).toBe(false);
  });

  it('PendingDot is labelled "Waiting to sync" and renders nothing when not pending', () => {
    const { rerender } = render(<PendingDot pending />);
    expect(screen.getByRole('img', { name: 'Waiting to sync' })).toBeInTheDocument();
    rerender(<PendingDot pending={false} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
