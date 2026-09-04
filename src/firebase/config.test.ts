import { describe, expect, it, vi } from 'vitest';

const mockInitializeApp = vi.fn(() => 'app-instance');
const mockGetAuth = vi.fn(() => 'auth-instance');
const mockGetFirestore = vi.fn(() => 'firestore-instance');

vi.mock('firebase/app', () => ({ initializeApp: mockInitializeApp }));
vi.mock('firebase/auth', () => ({ getAuth: mockGetAuth }));
vi.mock('firebase/firestore', () => ({ getFirestore: mockGetFirestore }));

describe('firebase config', () => {
  it('initializes the firebase app and exports auth/firestore instances', async () => {
    const { auth, db } = await import('./config');
    expect(mockInitializeApp).toHaveBeenCalled();
    expect(auth).toBe('auth-instance');
    expect(db).toBe('firestore-instance');
  });
});
