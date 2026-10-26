import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveAccess } from './access';

const mockGetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...p: string[]) => p.join('/'),
  getDoc: (...a: unknown[]) => mockGetDoc(...a),
}));
vi.mock('../firebase/config', () => ({ db: {} }));

describe('resolveAccess', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
  });

  it('gives a club admin every section without probing', async () => {
    const access = await resolveAccess('admin');
    expect(access).toEqual({
      isClubAdmin: true,
      sections: { exercises: true, trainings: true, guides: true },
    });
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('probes the three sections under the active club for a member', async () => {
    mockGetDoc.mockImplementation((path: string) => {
      if (path === 'clubs/club-1/sectionAccess/exercises') return Promise.resolve({ exists: () => true });
      if (path === 'clubs/club-1/sectionAccess/trainings') return Promise.reject({ code: 'permission-denied' });
      if (path === 'clubs/club-1/sectionAccess/guides') return Promise.reject({ code: 'permission-denied' });
      throw new Error('unexpected ' + path);
    });
    const access = await resolveAccess('member');
    expect(access).toEqual({
      isClubAdmin: false,
      sections: { exercises: true, trainings: false, guides: false },
    });
    expect(mockGetDoc).toHaveBeenCalledTimes(3);
  });

  it('rethrows a non-permission error', async () => {
    mockGetDoc.mockRejectedValue({ code: 'unavailable' });
    await expect(resolveAccess('member')).rejects.toEqual({ code: 'unavailable' });
  });
});
