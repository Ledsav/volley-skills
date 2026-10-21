import { describe, expect, it, vi, beforeEach } from 'vitest';
import { updateClubProfile, transferOwnership, requestTermination, CLUB_COUNTRY_CODES } from './clubAdminApi';

const updateDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'col'),
  doc: vi.fn((_db, ...p) => p.join('/')),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  serverTimestamp: () => 'TS',
}));
vi.mock('../firebase/config', () => ({ db: {} }));

beforeEach(() => { updateDoc.mockReset().mockResolvedValue(undefined); });

describe('clubAdminApi', () => {
  it('updateClubProfile writes exactly the six profile fields to the club doc', async () => {
    const input = {
      name: 'N', country: 'IT', locale: 'it' as const,
      aiEnabled: true, referenceOptOut: false, growthTestsEnabled: true,
    };
    await updateClubProfile({ ...input, extra: 1 } as typeof input);
    expect(updateDoc).toHaveBeenCalledWith('clubs/club-1', input);
  });

  it('transferOwnership lowercases the email', async () => {
    await transferOwnership('New@X.Y');
    expect(updateDoc).toHaveBeenCalledWith('clubs/club-1', { ownerEmail: 'new@x.y' });
  });

  it('requestTermination writes only requestedAt/requestedBy with a server timestamp', async () => {
    await requestTermination('Boss@X.Y');
    expect(updateDoc).toHaveBeenCalledWith('clubs/club-1', {
      'termination.requestedAt': 'TS', 'termination.requestedBy': 'boss@x.y',
    });
  });

  it('country codes include the expected regions', () => {
    expect(CLUB_COUNTRY_CODES).toContain('IT');
    expect(CLUB_COUNTRY_CODES).toContain('US');
    expect(CLUB_COUNTRY_CODES).toHaveLength(36);
  });
});
