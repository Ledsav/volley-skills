import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveAccess } from './access';

const mockGetDoc = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...a: unknown[]) => mockDoc(...a),
  getDoc: (...a: unknown[]) => mockGetDoc(...a),
}));
vi.mock('../firebase/config', () => ({ db: {} }));

describe('resolveAccess', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockDoc.mockReset();
    mockDoc.mockImplementation((_db: unknown, _c: unknown, id: unknown) => id);
  });

  it('gives a super-admin every section without any reads', async () => {
    const access = await resolveAccess({ uid: 'u', email: 'a@b.com', role: 'superadmin' });
    expect(access).toEqual({
      isSuperAdmin: true,
      sections: { exercises: true, trainings: true, guides: true },
    });
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('marks a section true when its doc reads successfully, false on permission-denied', async () => {
    mockGetDoc.mockImplementation((id: string) => {
      if (id === 'exercises') return Promise.resolve({ exists: () => true });
      if (id === 'trainings') return Promise.reject({ code: 'permission-denied' });
      if (id === 'guides') return Promise.reject({ code: 'permission-denied' });
      throw new Error('unexpected ' + id);
    });
    const access = await resolveAccess({ uid: 'u', email: 'm@b.com', role: 'member' });
    expect(access).toEqual({
      isSuperAdmin: false,
      sections: { exercises: true, trainings: false, guides: false },
    });
  });

  it('rethrows a non-permission error', async () => {
    mockGetDoc.mockRejectedValue({ code: 'unavailable' });
    await expect(
      resolveAccess({ uid: 'u', email: 'm@b.com', role: 'member' })
    ).rejects.toEqual({ code: 'unavailable' });
  });
});
