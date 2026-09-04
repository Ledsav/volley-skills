import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ensureUserDoc } from './usersApi';

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('ensureUserDoc', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('returns the existing user doc without writing when one already exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ email: 'coach@example.com', role: 'admin' }),
    });

    const result = await ensureUserDoc('uid-1', 'coach@example.com');

    expect(result).toEqual({ uid: 'uid-1', email: 'coach@example.com', role: 'admin' });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('creates a role admin doc when the write succeeds', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const result = await ensureUserDoc('uid-2', 'coach@example.com');

    expect(result).toEqual({ uid: 'uid-2', email: 'coach@example.com', role: 'admin' });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('falls back to role viewer when the admin write is permission-denied', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc
      .mockRejectedValueOnce({ code: 'permission-denied' })
      .mockResolvedValueOnce(undefined);

    const result = await ensureUserDoc('uid-3', 'parent@example.com');

    expect(result).toEqual({ uid: 'uid-3', email: 'parent@example.com', role: 'viewer' });
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-permission errors instead of silently falling back', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockRejectedValueOnce({ code: 'unavailable' });

    await expect(ensureUserDoc('uid-4', 'coach@example.com')).rejects.toEqual({ code: 'unavailable' });
  });
});
