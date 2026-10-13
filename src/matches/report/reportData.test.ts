import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type Match, type MatchEvent } from '../../types/match';
import { replay } from '../scoutEngine';
import { computeStats } from '../scoutStats';
import { buildReportData } from './reportData';

const roster = ['s', 'a', 'b', 'c', 'd', 'e'].map((id, i) => ({ playerId: id, number: i + 1, name: `N${id}`, positionCategory: 'OH' as const }));
const match = {
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT, roster,
  liberos: [], status: 'live', result: { setsUs: 0, setsThem: 0, sets: [] }, summary: null, usageContribution: null,
  activeDevice: null, createdBy: 'u', createdAt: null, updatedAt: null,
} as Match;
let order = 0;
const m = (e: object) => ({ id: `x${++order}`, order, source: 'tap', chunkId: null, ...e }) as MatchEvent;

describe('buildReportData', () => {
  it('stores whole-match and per-set stats identical to computing them from the state', () => {
    const state = replay(match, [
      m({ type: 'setStart', set: 1, lineup: ['s', 'a', 'b', 'c', 'd', 'e'], serving: 'us' }),
      m({ type: 'action', playerId: 's', skill: 'S', grade: '#' }),
      m({ type: 'setStart', set: 2, lineup: ['s', 'a', 'b', 'c', 'd', 'e'], serving: 'us' }),
      m({ type: 'action', playerId: 'a', skill: 'A', grade: '#' }),
    ]);
    const report = buildReportData(state);
    expect(report.sets).toEqual([1, 2]);
    expect(report.all).toEqual(computeStats(state, {}));
    expect(report.bySet[1]).toEqual(computeStats(state, { set: 1 }));
    expect(report.bySet[2]).toEqual(computeStats(state, { set: 2 }));
    expect(report.setsWon).toEqual(state.setsWon);
  });
});
