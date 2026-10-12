import { describe, expect, it } from 'vitest';
import type { ActionEvent, Grade, Skill } from '../types/match';
import { countsForPlayer, expectedSkill, orderSkills } from './nextActions';

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
