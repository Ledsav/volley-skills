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

    expect(result).toEqual({ uid: 'uid-1', email: 'coach@example.com', role: 'superadmin' });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('maps a legacy stored role viewer to member', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ email: 'parent@example.com', role: 'viewer' }),
    });

    const result = await ensureUserDoc('uid-1b', 'parent@example.com');

    expect(result).toEqual({ uid: 'uid-1b', email: 'parent@example.com', role: 'member' });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('creates a role admin doc when the write succeeds', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const result = await ensureUserDoc('uid-2', 'coach@example.com');

    expect(result).toEqual({ uid: 'uid-2', email: 'coach@example.com', role: 'superadmin' });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', {
      email: 'coach@example.com',
      role: 'superadmin',
    });
  });

  it('falls back to role viewer when the admin write is permission-denied', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc
      .mockRejectedValueOnce({ code: 'permission-denied' })
      .mockResolvedValueOnce(undefined);

    const result = await ensureUserDoc('uid-3', 'parent@example.com');

    expect(result).toEqual({ uid: 'uid-3', email: 'parent@example.com', role: 'member' });
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockSetDoc).toHaveBeenLastCalledWith('doc-ref', {
      email: 'parent@example.com',
      role: 'member',
    });
  });

  it('rethrows non-permission errors instead of silently falling back', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockRejectedValueOnce({ code: 'unavailable' });

    await expect(ensureUserDoc('uid-4', 'coach@example.com')).rejects.toEqual({ code: 'unavailable' });
  });
});
