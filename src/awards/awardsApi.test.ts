import { beforeEach, describe, expect, it, vi } from 'vitest';

const setDoc = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const updateDoc = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const getDoc = vi.fn();
vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: (...a: unknown[]) => getDoc(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  serverTimestamp: () => 'TS',
}));

import { getSeasonAwards, saveMatchAwards, saveSeasonAwards } from './awardsApi';

const input = { picks: { mvp: { playerId: 'a', hidden: false } }, custom: [], order: ['mvp'] };

describe('awardsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the season doc or null', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ ...input, updatedBy: 'u', updatedAt: 'x' }) });
    expect(await getSeasonAwards('t1')).toEqual(input);
    getDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await getSeasonAwards('t1')).toBeNull();
  });

  it('writes season and match awards with author + timestamp', async () => {
    await saveSeasonAwards('t1', input, 'u1');
    expect(setDoc).toHaveBeenCalledWith({ path: 'clubs/club-1/teams/t1/awards/season' }, { ...input, updatedBy: 'u1', updatedAt: 'TS' });
    await saveMatchAwards('t1', 'm1', input, 'u1');
    expect(updateDoc).toHaveBeenCalledWith({ path: 'clubs/club-1/teams/t1/matches/m1' }, { awards: { ...input, updatedBy: 'u1', updatedAt: 'TS' }, updatedAt: 'TS' });
  });
});
