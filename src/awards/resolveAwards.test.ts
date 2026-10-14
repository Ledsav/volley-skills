import { describe, expect, it } from 'vitest';
import { latestRosterIndex } from '../teams/stats/rosterIndex';
import { EMPTY_AWARDS } from '../types/awards';
import { defaultOrder, resolveAwards, revealable } from './resolveAwards';
import { finished, player } from './testMatches';

const m = finished('m1', '2026-10-12', [player('a', { A: '########', S: '#' }), player('b', { A: '#!!!!!!!' })]);
const people = latestRosterIndex([m]);
const byKey = (xs: ReturnType<typeof resolveAwards>, k: string) => xs.find((x) => x.key === k)!;

describe('resolveAwards', () => {
  it('stats choice by default, MVP last, statLine present', () => {
    const out = resolveAwards('match', [m], null, people);
    expect(out[out.length - 1].key).toBe('mvp');
    const att = byKey(out, 'attacker');
    expect(att.winner?.playerId).toBe('a');
    expect(att.statLine).toBe('+100% att. eff. · 8 att.');
    expect(att.runnersUp.map((r) => r.playerId)).toEqual(['b']);
    expect(att.overridden).toBe(false);
  });

  it('override keeps the suggestion and drops the stat line', () => {
    const out = resolveAwards('match', [m], { ...EMPTY_AWARDS, picks: { attacker: { playerId: 'b', hidden: false } } }, people);
    const att = byKey(out, 'attacker');
    expect(att.winner?.playerId).toBe('b');
    expect(att.overridden).toBe(true);
    expect(att.statLine).toBeNull();
    expect(att.suggested?.playerId).toBe('a');
  });

  it('override equal to the stats choice is not "overridden"', () => {
    const out = resolveAwards('match', [m], { ...EMPTY_AWARDS, picks: { attacker: { playerId: 'a', hidden: false } } }, people);
    expect(byKey(out, 'attacker').overridden).toBe(false);
    expect(byKey(out, 'attacker').statLine).not.toBeNull();
  });

  it('hidden awards are excluded from the reveal', () => {
    const out = resolveAwards('match', [m], { ...EMPTY_AWARDS, picks: { mvp: { playerId: null, hidden: true } } }, people);
    expect(byKey(out, 'mvp').hidden).toBe(true);
    expect(revealable(out).some((x) => x.key === 'mvp')).toBe(false);
  });

  it('custom awards slot in before MVP and respect saved order', () => {
    const custom = [{ id: 'c1', title: 'Spirit of the team', playerId: 'b', note: 'Always cheering' }];
    expect(defaultOrder('match', custom).slice(-2)).toEqual(['c1', 'mvp']);
    const out = resolveAwards('match', [m], { picks: {}, custom, order: ['c1', 'attacker'] }, people);
    expect(out.slice(0, 2).map((x) => x.key)).toEqual(['c1', 'attacker']);
    const c = byKey(out, 'c1');
    expect(c).toMatchObject({ kind: 'custom', title: 'Spirit of the team', note: 'Always cheering', statLine: null });
    expect(c.winner?.playerId).toBe('b');
  });

  it('unknown override player → "Unknown player", never a crash', () => {
    const out = resolveAwards('match', [m], { ...EMPTY_AWARDS, picks: { mvp: { playerId: 'ghost', hidden: false } } }, people);
    expect(byKey(out, 'mvp').winner).toMatchObject({ playerId: 'ghost', name: 'Unknown player' });
  });

  it('no eligible player and no override → winner null, not revealable', () => {
    const out = resolveAwards('match', [m], null, people);
    expect(byKey(out, 'setter').winner).toBeNull();
    expect(revealable(out).some((x) => x.key === 'setter')).toBe(false);
  });

  it('nothing scouted at all → every stats award has no winner', () => {
    const out = resolveAwards('season', [finished('x', '2026-10-01', null)], null, new Map());
    expect(out.filter((x) => x.kind === 'stats').every((x) => x.winner === null)).toBe(true);
  });
});
