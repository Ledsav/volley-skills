import { describe, expect, it } from 'vitest';
import { computeAvgScore, computeLevel, computeTeamAvgScore } from './skillMath';
import type { Player, Skills } from '../types/player';

function skillsWith(scores: Partial<Record<keyof Skills, number | null>>): Skills {
  const keys: (keyof Skills)[] = ['serve', 'attack', 'set', 'defence', 'reception', 'jump', 'speed', 'iq'];
  const skills = {} as Skills;
  for (const key of keys) {
    skills[key] = { score: scores[key] ?? null, notes: '', priority: false };
  }
  return skills;
}

describe('computeAvgScore', () => {
  it('returns null when no skills have a score', () => {
    expect(computeAvgScore(skillsWith({}))).toBeNull();
  });

  it('averages only the skills that have a score', () => {
    expect(computeAvgScore(skillsWith({ serve: 6, attack: 8 }))).toBe(7);
  });

  it('averages all 8 skills when fully scored', () => {
    expect(
      computeAvgScore(
        skillsWith({ serve: 5, attack: 5, set: 5, defence: 5, reception: 5, jump: 5, speed: 5, iq: 5 })
      )
    ).toBe(5);
  });
});

describe('computeLevel', () => {
  it('returns null for a null average', () => {
    expect(computeLevel(null)).toBeNull();
  });

  it('returns Beginner below 4', () => {
    expect(computeLevel(3.9)).toBe('Beginner');
  });

  it('returns Developing from 4 up to but excluding 6', () => {
    expect(computeLevel(4)).toBe('Developing');
    expect(computeLevel(5.9)).toBe('Developing');
  });

  it('returns Advanced from 6 up to but excluding 8', () => {
    expect(computeLevel(6)).toBe('Advanced');
    expect(computeLevel(7.9)).toBe('Advanced');
  });

  it('returns Elite at 8 and above', () => {
    expect(computeLevel(8)).toBe('Elite');
    expect(computeLevel(10)).toBe('Elite');
  });
});

function playerWithAvg(avgScore: number | null): Player {
  return { avgScore } as Player;
}

describe('computeTeamAvgScore', () => {
  it('returns null when there are no players', () => {
    expect(computeTeamAvgScore([])).toBeNull();
  });

  it('returns null when no player has a score yet', () => {
    expect(computeTeamAvgScore([playerWithAvg(null), playerWithAvg(null)])).toBeNull();
  });

  it('averages only the players who have a score', () => {
    expect(computeTeamAvgScore([playerWithAvg(6), playerWithAvg(null), playerWithAvg(8)])).toBe(7);
  });
});
