import { describe, expect, it } from 'vitest';
import type { ActionEvent, Grade, LiberoConfig, Skill, UsageProfile } from '../types/match';
import { rosterMap } from './format';
import { countsForPlayer, expectedSkill, orderSkills, predictPlayer } from './nextActions';
import type { ActionRecord } from './scoutEngine';
import { ROSTER } from './testFixtures';

const a = (skill: Skill, grade: Grade = '+'): ActionEvent => ({
  id: skill + grade, order: 1, source: 'tap', chunkId: null, type: 'action', playerId: 'p', skill, grade,
});

describe('expectedSkill', () => {
  it('follows the rally phase', () => {
    expect(expectedSkill({ currentRally: [], serving: 'us' })).toBe('S');
    expect(expectedSkill({ currentRally: [], serving: 'them' })).toBe('R');
    expect(expectedSkill({ currentRally: [a('R')], serving: 'them' })).toBe('E');
    expect(expectedSkill({ currentRally: [a('E')], serving: 'them' })).toBe('A');
    expect(expectedSkill({ currentRally: [a('A')], serving: 'them' })).toBe('B');
    expect(expectedSkill({ currentRally: [a('S')], serving: 'us' })).toBe('B');
    expect(expectedSkill({ currentRally: [a('B')], serving: 'us' })).toBe('D');
    expect(expectedSkill({ currentRally: [a('D')], serving: 'us' })).toBe('E');
    expect(expectedSkill({ currentRally: [a('F')], serving: 'us' })).toBe('E');
  });

  it('expects a block after an overpass, since the ball is on their side', () => {
    expect(expectedSkill({ currentRally: [a('R', '/')], serving: 'them' })).toBe('B');
    expect(expectedSkill({ currentRally: [a('D', '/')], serving: 'us' })).toBe('B');
    expect(expectedSkill({ currentRally: [a('F', '/')], serving: 'us' })).toBe('B');
  });

  it('expects another block after a block touch that goes back to their side', () => {
    expect(expectedSkill({ currentRally: [a('B', '-')], serving: 'us' })).toBe('B');
    expect(expectedSkill({ currentRally: [a('B', '+')], serving: 'us' })).toBe('D');
  });

  it('expects a free ball after their free ball back on our serve', () => {
    expect(expectedSkill({ currentRally: [a('S', '/')], serving: 'us' })).toBe('F');
  });
});

describe('orderSkills', () => {
  it('puts the expected skill first, then position defaults', () => {
    expect(orderSkills({ position: 'S', isLibero: false, expected: 'R', matchCounts: {}, history: null }))
      .toEqual(['R', 'E', 'S', 'D', 'B', 'A', 'F']);
  });

  it('drops skills a libero cannot perform', () => {
    expect(orderSkills({ position: 'L', isLibero: true, expected: 'S', matchCounts: {}, history: null }))
      .toEqual(['R', 'D', 'F', 'E']);
  });

  it('uses history averages when the player has no actions this match', () => {
    const order = orderSkills({
      position: 'OH', isLibero: false, expected: 'S', matchCounts: {},
      history: { matches: 2, totals: { E: 30, A: 4 } },
    });
    expect(order.slice(0, 3)).toEqual(['S', 'E', 'A']);
  });

  it('switches to current-match counts once the player has acted', () => {
    const order = orderSkills({
      position: 'OH', isLibero: false, expected: 'S', matchCounts: { B: 3 },
      history: { matches: 2, totals: { E: 30 } },
    });
    expect(order.slice(0, 2)).toEqual(['S', 'B']);
    expect(order.indexOf('E')).toBeGreaterThan(order.indexOf('R'));
  });
});

describe('countsForPlayer', () => {
  it('counts a player actions per skill', () => {
    const actions = [
      { eventId: '1', set: 1, playerId: 'p', skill: 'A' as const, grade: '#' as const, source: 'tap' as const },
      { eventId: '2', set: 1, playerId: 'p', skill: 'A' as const, grade: '=' as const, source: 'tap' as const },
      { eventId: '3', set: 1, playerId: 'q', skill: 'R' as const, grade: '#' as const, source: 'tap' as const },
    ];
    expect(countsForPlayer({ actions }, 'p')).toEqual({ A: 2 });
  });
});

describe('predictPlayer', () => {
  // P1..P6: setter serves from P1, libero in for mb2 at P6.
  const court = ['s', 'oh1', 'mb1', 'o', 'oh2', 'lib'];
  const roster = rosterMap(ROSTER);
  const liberos: LiberoConfig[] = [{ playerId: 'lib', mode: 'always', replaces: ['mb2'] }];
  const noUsage: UsageProfile = { players: {} };
  const act = (playerId: string, skill: Skill, n = 1): ActionRecord[] =>
    Array.from({ length: n }, (_, i) => ({ eventId: `${playerId}${skill}${i}`, set: 1, playerId, skill, grade: '+', source: 'tap' }));
  const predict = (skill: Skill, opts: { actions?: ActionRecord[]; usage?: UsageProfile; serving?: 'us' | 'them'; court?: string[] } = {}) =>
    predictPlayer({
      state: { court: opts.court ?? court, serving: opts.serving ?? 'them', actions: opts.actions ?? [] },
      skill,
      roster,
      liberos,
      usage: opts.usage ?? noUsage,
    });

  it('serve goes to the player in P1 when we serve', () => {
    expect(predict('S', { serving: 'us', court: ['oh1', 'mb1', 'o', 'oh2', 'lib', 's'] })).toBe('oh1');
  });

  it('never picks the libero for attack or block, even with counts', () => {
    const actions = act('lib', 'A', 5).concat(act('lib', 'B', 5));
    expect(predict('A', { actions })).toBe('oh1');
    expect(predict('B', { actions })).toBe('mb1');
  });

  it('picks the libero for reception once she has the counts or the history', () => {
    expect(predict('R', { actions: act('oh2', 'R', 1) })).toBe('oh2');
    expect(predict('R', { actions: act('oh2', 'R', 1).concat(act('lib', 'R', 2)) })).toBe('lib');
    const usage: UsageProfile = { players: { lib: { matches: 2, totals: { R: 40 } }, oh1: { matches: 2, totals: { R: 10 } } } };
    expect(predict('R', { usage })).toBe('lib');
  });

  it('uses the history prior to pick the usual setter', () => {
    // By position alone the S would set; history says #9 is the one who usually sets.
    const usage: UsageProfile = { players: { oh2: { matches: 4, totals: { E: 80 } }, s: { matches: 4, totals: { E: 4 } } } };
    expect(predict('E', { usage })).toBe('oh2');
  });

  it('lets this match counts overtake the history prior after a few actions', () => {
    const usage: UsageProfile = { players: { s: { matches: 4, totals: { E: 100 } } } };
    expect(predict('E', { usage, actions: act('oh1', 'E', 2) })).toBe('s');
    expect(predict('E', { usage, actions: act('oh1', 'E', 3) })).toBe('oh1');
  });

  it('falls back to the position default, then the lowest jersey number', () => {
    expect(predict('E')).toBe('s');
    expect(predict('R')).toBe('lib');
    expect(predict('A')).toBe('oh1'); // #7 Ana before #9 Lucía
    expect(predict('B')).toBe('mb1');
    expect(predict('D', { court: ['s', 'oh1', 'mb1', 'o', 'oh2', 'mb2'] })).toBe('oh1');
  });

  it('uses per-set roles from state.roles over the roster role', () => {
    // Olga (roster O) is the setter this set.
    const p = predictPlayer({
      state: { court, serving: 'them', actions: [], roles: { o: 'S', s: 'O' } },
      skill: 'E',
      roster,
      liberos,
      usage: noUsage,
    });
    expect(p).toBe('o');
  });

  it('returns null when nobody on court can perform the skill', () => {
    expect(predict('A', { court: ['lib'] })).toBeNull();
    expect(predict('R', { court: [] })).toBeNull();
  });
});
