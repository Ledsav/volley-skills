import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signOutAndClearLocalData } from './signOut';

const m = vi.hoisted(() => ({
  signOut: vi.fn(() => Promise.resolve()),
  waitForPendingWrites: vi.fn(() => Promise.resolve()),
  terminate: vi.fn(() => Promise.resolve()),
  clearIndexedDbPersistence: vi.fn(() => Promise.resolve()),
}));

vi.mock('firebase/auth', () => ({ signOut: m.signOut }));
vi.mock('firebase/firestore', () => ({
  waitForPendingWrites: m.waitForPendingWrites,
  terminate: m.terminate,
  clearIndexedDbPersistence: m.clearIndexedDbPersistence,
}));
vi.mock('./config', () => ({ auth: 'auth', db: 'db' }));

describe('signOutAndClearLocalData', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it('signs out, shuts Firestore down, wipes the local cache and reloads to /login', async () => {
    const redirect = vi.fn();
    expect(await signOutAndClearLocalData({ redirect })).toBe('signedOut');
    expect(m.signOut).toHaveBeenCalledWith('auth');
    expect(m.terminate).toHaveBeenCalledWith('db');
    expect(m.clearIndexedDbPersistence).toHaveBeenCalledWith('db');
    expect(m.terminate.mock.invocationCallOrder[0]).toBeLessThan(m.clearIndexedDbPersistence.mock.invocationCallOrder[0]);
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('reports unsynced writes instead of signing out when they do not flush quickly', async () => {
    vi.useFakeTimers();
    m.waitForPendingWrites.mockReturnValueOnce(new Promise<void>(() => undefined));
    const redirect = vi.fn();
    const result = signOutAndClearLocalData({ redirect });
    await vi.advanceTimersByTimeAsync(1_500);
    expect(await result).toBe('unsynced');
    expect(m.signOut).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('signs out anyway when forced, without waiting for pending writes', async () => {
    const redirect = vi.fn();
    expect(await signOutAndClearLocalData({ force: true, redirect })).toBe('signedOut');
    expect(m.waitForPendingWrites).not.toHaveBeenCalled();
    expect(m.clearIndexedDbPersistence).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('still reloads to /login when the cache cannot be cleared (another tab holds it)', async () => {
    m.clearIndexedDbPersistence.mockRejectedValueOnce(new Error('failed-precondition'));
    const redirect = vi.fn();
    expect(await signOutAndClearLocalData({ redirect })).toBe('signedOut');
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
