import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ensureUserDoc } from './usersApi';

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...p: string[]) => p.join('/')),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: () => 'server-ts',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('ensureUserDoc', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('returns the user without rewriting an existing (even legacy) doc', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ email: 'coach@example.com', role: 'superadmin' }),
    });

    const result = await ensureUserDoc('uid-1', 'coach@example.com');

    expect(result).toEqual({ uid: 'uid-1', email: 'coach@example.com' });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('creates the user doc with email and createdAt only', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const result = await ensureUserDoc('uid-2', 'coach@example.com');

    expect(result).toEqual({ uid: 'uid-2', email: 'coach@example.com' });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).toHaveBeenCalledWith('users/uid-2', {
      email: 'coach@example.com',
      createdAt: 'server-ts',
    });
  });

  it('rethrows a failed write', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockRejectedValueOnce({ code: 'permission-denied' });

    await expect(ensureUserDoc('uid-3', 'coach@example.com')).rejects.toEqual({ code: 'permission-denied' });
  });
});
