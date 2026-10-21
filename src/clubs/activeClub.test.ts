import { afterEach, describe, expect, it } from 'vitest';
import type { Membership } from '../types/club';
import { ACTIVE_CLUB_KEY, otherUsableClubs, pickActiveClub, readStoredClub, storeClub } from './activeClub';

const m = (clubId: string, clubName: string, status: Membership['status'] = 'active'): Membership => ({
  clubId, clubName, status, role: 'member',
});

describe('pickActiveClub', () => {
  it('keeps a stored club that is still a membership', () => {
    expect(pickActiveClub([m('a', 'Alpha'), m('b', 'Beta')], 'b')).toEqual({ clubId: 'b', dropped: false });
  });

  it('falls back to the first club by name when the stored one is gone, and reports dropped', () => {
    expect(pickActiveClub([m('z', 'Zeta'), m('b', 'Beta')], 'gone')).toEqual({ clubId: 'b', dropped: true });
    expect(pickActiveClub([m('z', 'Zeta'), m('b', 'Beta')], null)).toEqual({ clubId: 'b', dropped: false });
  });

  it('ignores memberships in deleted clubs', () => {
    expect(pickActiveClub([m('a', 'Alpha', 'deleted'), m('b', 'Beta')], 'a')).toEqual({ clubId: 'b', dropped: true });
    expect(pickActiveClub([m('a', 'Alpha', 'suspended')], 'a')).toEqual({ clubId: 'a', dropped: false });
  });

  it('returns null when there are no usable memberships', () => {
    expect(pickActiveClub([m('a', 'Alpha', 'deleted')], 'a')).toEqual({ clubId: null, dropped: true });
    expect(pickActiveClub([], null)).toEqual({ clubId: null, dropped: false });
  });
});

describe('stored active club', () => {
  afterEach(() => localStorage.clear());

  it('round-trips through localStorage under vcb.activeClub', () => {
    expect(ACTIVE_CLUB_KEY).toBe('vcb.activeClub');
    expect(readStoredClub()).toBeNull();
    storeClub('club-a');
    expect(localStorage.getItem('vcb.activeClub')).toBe('club-a');
    expect(readStoredClub()).toBe('club-a');
    storeClub(null);
    expect(readStoredClub()).toBeNull();
  });
});

describe('otherUsableClubs', () => {
  it('lists usable memberships other than the active one', () => {
    const list = [m('a', 'Alpha'), m('b', 'Beta'), m('c', 'Gamma', 'deleted')];
    expect(otherUsableClubs(list, 'a').map((x) => x.clubId)).toEqual(['b']);
    expect(otherUsableClubs(list, null).map((x) => x.clubId)).toEqual(['a', 'b']);
    expect(otherUsableClubs([m('a', 'Alpha'), m('c', 'Gamma', 'deleted')], 'a')).toEqual([]);
  });
});
