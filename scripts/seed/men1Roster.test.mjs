import { describe, expect, it } from 'vitest';
import { SKILL_KEYS } from './parseWorkbook.mjs';
import { men1Players, MEN1_TEAM } from './men1Roster.mjs';

const today = '2026-10-15';
const players = men1Players({ team: { name: MEN1_TEAM.name, ageGroup: 'Senior', season: '2026-27' }, admin: 'coach@example.com', today });

describe('men1Roster', () => {
  it('builds 14 adults with distinct shirt numbers', () => {
    expect(players).toHaveLength(14);
    expect(new Set(players.map((p) => p.number)).size).toBe(14);
    for (const p of players) expect(Number(p.dob.slice(0, 4))).toBeLessThanOrEqual(2008); // 18+ in 2026
  });

  it('records photo consent for every player (adults consent for themselves) and no guardians', () => {
    for (const p of players) {
      expect(p.consent).toEqual({ given: true, date: today, confirmedBy: 'coach@example.com' });
      expect(p.guardians).toEqual([]);
    }
  });

  it('covers a full senior squad: setters, outsides, opposites, middles, liberos, 7 starters', () => {
    const count = (pos) => players.filter((p) => p.positionCategory === pos).length;
    expect([count('S'), count('OH'), count('O'), count('MB'), count('L')]).toEqual([2, 4, 2, 4, 2]);
    expect(players.filter((p) => p.starting)).toHaveLength(7);
  });

  it('scores every skill 1–10 with avg and level derived like the app', () => {
    for (const p of players) {
      for (const k of SKILL_KEYS) expect(p.skills[k].score).toBeGreaterThanOrEqual(1);
      for (const k of SKILL_KEYS) expect(p.skills[k].score).toBeLessThanOrEqual(10);
      const avg = SKILL_KEYS.reduce((t, k) => t + p.skills[k].score, 0) / SKILL_KEYS.length;
      expect(p.avgScore).toBeCloseTo(avg, 6);
      expect(p.level).toBe(avg < 4 ? 'Beginner' : avg < 6 ? 'Developing' : avg < 8 ? 'Advanced' : 'Elite');
      expect(p.teamName).toBe('Men 1');
    }
  });
});
