import { describe, expect, it, vi } from 'vitest';

const mockInitializeApp = vi.fn(() => 'app-instance');
const mockGetAuth = vi.fn(() => 'auth-instance');
const mockGetFirestore = vi.fn(() => 'firestore-instance');

vi.mock('firebase/app', () => ({ initializeApp: (...args: unknown[]) => mockInitializeApp(...args) }));
vi.mock('firebase/auth', () => ({ getAuth: (...args: unknown[]) => mockGetAuth(...args) }));
vi.mock('firebase/firestore', () => ({ getFirestore: (...args: unknown[]) => mockGetFirestore(...args) }));

describe('firebase config', () => {
  it('initializes the firebase app and exports auth/firestore instances', async () => {
    const { auth, db } = await import('./config');
    expect(mockInitializeApp).toHaveBeenCalled();
    expect(auth).toBe('auth-instance');
    expect(db).toBe('firestore-instance');
  });
});
