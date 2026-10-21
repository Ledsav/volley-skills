import { describe, expect, it, vi, beforeEach } from 'vitest';
import { clubCol, clubDoc, getActiveClubId, setActiveClubId } from './clubPaths';

const { mockCollection, mockDoc } = vi.hoisted(() => ({
  mockCollection: vi.fn((...args: unknown[]) => ({ args })),
  mockDoc: vi.fn((...args: unknown[]) => ({ args })),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
}));

vi.mock('./config', () => ({ db: {} }));

describe('clubPaths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveClubId('c-9');
  });

  it('builds collection paths under the active club', () => {
    expect(clubCol('teams', 't-1', 'players')).toEqual({
      args: [{}, 'clubs', 'c-9', 'teams', 't-1', 'players'],
    });
  });

  it('builds the club doc itself with no segments', () => {
    expect(clubDoc()).toEqual({ args: [{}, 'clubs', 'c-9'] });
  });

  it('returns the active club id', () => {
    expect(getActiveClubId()).toBe('c-9');
  });

  it('throws without an active club', () => {
    setActiveClubId(null);
    expect(() => clubCol('teams')).toThrow('No active club');
    expect(() => getActiveClubId()).toThrow('No active club');
  });
});
