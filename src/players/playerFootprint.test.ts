import { describe, expect, it } from 'vitest';
import { anonymizeRoster, playerMatchRecord, REMOVED_PLAYER_NAME, rosterHasPlayer } from './playerFootprint';
import type { Match } from '../types/match';

const roster = [
  { playerId: 'p1', number: 7, name: 'Ana Lima', positionCategory: 'OH' as const },
  { playerId: 'p2', number: 9, name: 'Bea Rossi', positionCategory: 'L' as const },
];

const stats = (playerId: string) => ({ playerId, points: 3 }) as never;

const match = {
  id: 'm1',
  date: '2026-10-01',
  opponent: 'Rivals',
  competition: 'league',
  homeAway: 'home',
  status: 'finished',
  roster,
  liberos: [{ playerId: 'p2', mode: 'auto', replaces: [] }],
  summary: null,
  report: {
    all: { players: { p1: stats('p1') } },
    bySet: { 1: { players: { p1: stats('p1') } }, 2: { players: {} } },
  },
} as unknown as Match;

describe('playerFootprint', () => {
  it('detects whether a match roster holds the player', () => {
    expect(rosterHasPlayer(match, 'p1')).toBe(true);
    expect(rosterHasPlayer(match, 'p3')).toBe(false);
    expect(rosterHasPlayer({ roster: undefined } as never, 'p1')).toBe(false);
  });

  it('strips name and number from only that player', () => {
    const out = anonymizeRoster(roster, 'p1');
    expect(out[0]).toEqual({ playerId: 'p1', number: 0, name: REMOVED_PLAYER_NAME, positionCategory: 'OH' });
    expect(out[1]).toEqual(roster[1]);
  });

  it('collects the roster snapshot and stats for one player', () => {
    expect(playerMatchRecord(match, 'p1')).toMatchObject({
      matchId: 'm1',
      opponent: 'Rivals',
      rosterEntry: roster[0],
      libero: false,
      stats: { playerId: 'p1' },
      statsBySet: { 1: { playerId: 'p1' } },
    });
    expect(playerMatchRecord(match, 'p2')).toMatchObject({ libero: true, stats: null, statsBySet: {} });
    expect(playerMatchRecord(match, 'p3')).toBeNull();
  });
});
