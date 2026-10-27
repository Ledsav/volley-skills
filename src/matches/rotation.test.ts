import { describe, expect, it } from 'vitest';
import type { RoleMap } from '../types/match';
import { build51, check51, slotsFromLineup, type Slots51 } from './rotation';

const slots: Slots51 = { setter: 's', oh1: 'oh1', mb1: 'mb1', opposite: 'o', oh2: 'oh2', mb2: 'mb2' };
const roles: RoleMap = { s: 'S', oh1: 'OH', mb1: 'MB', o: 'O', oh2: 'OH', mb2: 'MB' };

describe('build51', () => {
  it('puts the setter in P1 with the standard order', () => {
    expect(build51(slots, 1)).toEqual(['s', 'oh1', 'mb1', 'o', 'oh2', 'mb2']);
  });

  it.each([1, 2, 3, 4, 5, 6])('setter in P%i keeps opposite pairs 3 apart', (k) => {
    const lineup = build51(slots, k);
    expect(lineup[k - 1]).toBe('s');
    const zone = (id: string) => lineup.indexOf(id);
    expect(Math.abs(zone('s') - zone('o'))).toBe(3);
    expect(Math.abs(zone('oh1') - zone('oh2'))).toBe(3);
    expect(Math.abs(zone('mb1') - zone('mb2'))).toBe(3);
    expect(new Set(lineup).size).toBe(6);
    expect(check51(lineup, roles)).toEqual([]);
    expect(slotsFromLineup(lineup, k)).toEqual(slots);
  });

  it('setter in P6 equals one side-out rotation from P1 (OH1 serves)', () => {
    expect(build51(slots, 6)).toEqual(['oh1', 'mb1', 'o', 'oh2', 'mb2', 's']);
  });
});

describe('check51', () => {
  it('flags wrong role counts', () => {
    const lineup = ['s', 'oh1', 'mb1', 'o', 'oh2', 'x'];
    expect(check51(lineup, { ...roles, x: 'OH' })).toEqual([
      { code: 'expected', role: 'OH', count: 2, found: 3 },
      { code: 'expected', role: 'MB', count: 2, found: 1 },
    ]);
  });

  it('flags setter and opposite side by side', () => {
    expect(check51(['s', 'o', 'mb1', 'oh1', 'oh2', 'mb2'], roles)).toContainEqual({ code: 'setterOpposite' });
  });

  it('flags middles and outsides not opposite', () => {
    const w = check51(['s', 'mb1', 'mb2', 'o', 'oh1', 'oh2'], roles);
    expect(w).toContainEqual({ code: 'middles' });
    expect(w).toContainEqual({ code: 'outsides' });
  });
});
