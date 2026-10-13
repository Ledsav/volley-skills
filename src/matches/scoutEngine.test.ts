import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type MatchEvent, type MatchEventPayload, type Side } from '../types/match';
import { replay, resultFromState, sameResult, type EngineMatch } from './scoutEngine';
import { ROSTER } from './testFixtures';

const LINEUP = ['s', 'oh1', 'mb1', 'o', 'oh2', 'mb2'];
const match: EngineMatch = { format: DEFAULT_FORMAT, roster: ROSTER, liberos: [] };

let n = 0;
const ev = (p: MatchEventPayload): MatchEvent => {
  n += 1;
  return { id: `e${String(n).padStart(3, '0')}`, order: n, source: 'tap', chunkId: null, ...p } as MatchEvent;
};
const start = (serving: Side = 'us', set = 1, lineup = LINEUP) => ev({ type: 'setStart', set, lineup, serving });
const act = (playerId: string, skill: 'S' | 'R' | 'A' | 'B' | 'D' | 'E' | 'F', grade: '#' | '+' | '!' | '-' | '/' | '=') =>
  ev({ type: 'action', playerId, skill, grade });
const point = (winner: Side) => ev({ type: 'point', winner, reason: winner === 'us' ? 'oppError' : null });
const correct = (c: { score?: { us: number; them: number }; rotation?: number; serving?: Side }) =>
  ev({ type: 'correction', score: c.score ?? null, rotation: c.rotation ?? null, serving: c.serving ?? null });
const setEnd = (set = 1) => ev({ type: 'setEnd', set });

describe('replay — rallies and rotation', () => {
  beforeEach(() => {
    n = 0;
  });

  it('starts empty before any set', () => {
    const s = replay(match, []);
    expect(s.set).toBe(0);
    expect(s.inSet).toBe(false);
  });

  it('starts a set with the setter zone as rotation', () => {
    const s = replay(match, [start('us')]);
    expect(s.set).toBe(1);
    expect(s.inSet).toBe(true);
    expect(s.rotation).toBe(1);
    expect(s.lineup).toEqual(LINEUP);
    expect(s.court).toEqual(LINEUP);
  });

  it('an ace scores for us and keeps the serve', () => {
    const s = replay(match, [start('us'), act('s', 'S', '#')]);
    expect(s.score).toEqual({ us: 1, them: 0 });
    expect(s.serving).toBe('us');
    expect(s.rotation).toBe(1);
    expect(s.rallies).toHaveLength(1);
  });

  it('a serve error gives them the point and the serve', () => {
    const s = replay(match, [start('us'), act('s', 'S', '=')]);
    expect(s.score).toEqual({ us: 0, them: 1 });
    expect(s.serving).toBe('them');
  });

  it('a side-out rotates the lineup clockwise', () => {
    const s = replay(match, [start('them'), act('oh1', 'R', '+'), act('s', 'E', '+'), act('oh1', 'A', '#')]);
    expect(s.score).toEqual({ us: 1, them: 0 });
    expect(s.serving).toBe('us');
    expect(s.rotation).toBe(6);
    expect(s.lineup).toEqual(['oh1', 'mb1', 'o', 'oh2', 'mb2', 's']);
  });

  it('keeps the rally open on non-ending actions', () => {
    const s = replay(match, [start('them'), act('oh1', 'R', '+'), act('s', 'E', '+')]);
    expect(s.currentRally.map((a) => a.skill)).toEqual(['R', 'E']);
    expect(s.rallies).toHaveLength(0);
  });

  it('a point event closes the rally with its reason', () => {
    const s = replay(match, [start('us'), act('s', 'S', '+'), point('us')]);
    expect(s.score).toEqual({ us: 1, them: 0 });
    expect(s.rallies[0].reason).toBe('oppError');
    expect(s.rallies[0].actionIds).toHaveLength(1);
    expect(s.currentRally).toHaveLength(0);
  });

  it('ignores and warns about events before any set', () => {
    const s = replay(match, [act('s', 'S', '#')]);
    expect(s.score).toEqual({ us: 0, them: 0 });
    expect(s.warnings[0].code).toBe('noSet');
  });

  it('sorts by order, then id, so ties are deterministic', () => {
    const a = { ...start('us'), order: 1 };
    const x = { ...act('s', 'S', '='), id: 'b', order: 2 } as MatchEvent;
    const y = { ...act('s', 'S', '#'), id: 'a', order: 2 } as MatchEvent;
    const s1 = replay(match, [a, x, y]);
    const s2 = replay(match, [y, a, x]);
    expect(s1.rallies.map((r) => r.winner)).toEqual(['us', 'them']);
    expect(s2.rallies.map((r) => r.winner)).toEqual(['us', 'them']);
  });
});

describe('replay — sets and corrections', () => {
  beforeEach(() => {
    n = 0;
  });

  it('flags set point at 25–23 but not at 25–24', () => {
    expect(replay(match, [start('us'), correct({ score: { us: 24, them: 23 } }), act('s', 'S', '#')]).setPointReached).toBe(true);
    expect(replay(match, [start('us'), correct({ score: { us: 24, them: 24 } }), act('s', 'S', '#')]).setPointReached).toBe(false);
    expect(replay(match, [start('us'), correct({ score: { us: 25, them: 24 } }), act('s', 'S', '#')]).setPointReached).toBe(true);
  });

  it('uses deciding-set points in the last set', () => {
    const s = replay(match, [start('us', 5), correct({ score: { us: 14, them: 12 } }), act('s', 'S', '#')]);
    expect(s.setPointReached).toBe(true);
  });

  it('records a set end and the match end', () => {
    const events: MatchEvent[] = [];
    for (let set = 1; set <= 3; set++) {
      events.push(start('us', set), correct({ score: { us: 25, them: 20 } }), setEnd(set));
    }
    const s = replay(match, events);
    expect(s.setsWon).toEqual({ us: 3, them: 0 });
    expect(s.setScores).toHaveLength(3);
    expect(s.inSet).toBe(false);
    expect(s.matchOver).toBe(true);
    expect(resultFromState(s)).toEqual({ setsUs: 3, setsThem: 0, sets: s.setScores });
  });

  it('refuses to end a tied set', () => {
    const s = replay(match, [start('us'), setEnd()]);
    expect(s.inSet).toBe(true);
    expect(s.warnings[0].code).toBe('setEndTie');
  });

  it('a rotation correction rotates the lineup, and later side-outs continue from it', () => {
    const s = replay(match, [start('them'), correct({ rotation: 4 })]);
    expect(s.rotation).toBe(4);
    expect(s.lineup[0]).toBe('o');
    const t = replay(match, [start('them'), correct({ rotation: 4 }), point('us')]);
    expect(t.rotation).toBe(3);
    expect(t.lineup[0]).toBe('oh2');
  });

  it('a serving correction changes who serves', () => {
    const s = replay(match, [start('us'), correct({ serving: 'them' })]);
    expect(s.serving).toBe('them');
  });

  it('compares match results field by field', () => {
    const a = { setsUs: 1, setsThem: 0, sets: [{ us: 25, them: 20 }] };
    expect(sameResult(a, { setsThem: 0, sets: [{ them: 20, us: 25 }], setsUs: 1 })).toBe(true);
    expect(sameResult(a, { ...a, setsThem: 1 })).toBe(false);
    expect(sameResult(a, { ...a, sets: [{ us: 25, them: 21 }] })).toBe(false);
    expect(sameResult(a, { ...a, sets: [] })).toBe(false);
  });
});

describe('replay — per-set roles', () => {
  beforeEach(() => {
    n = 0;
  });

  it('falls back to roster roles when setStart has no roles', () => {
    const s = replay(match, [start('us')]);
    expect(s.roles.s).toBe('S');
    expect(s.roles.oh1).toBe('OH');
    expect(s.rotation).toBe(1);
  });

  it('setStart.roles override the roster for rotation and state.roles', () => {
    // Olga (roster O) sets this set from P4; Sofía plays opposite.
    const e = ev({ type: 'setStart', set: 1, lineup: LINEUP, serving: 'us', roles: { o: 'S', s: 'O' } });
    const s = replay(match, [e]);
    expect(s.rotation).toBe(4);
    expect(s.roles.o).toBe('S');
    expect(s.roles.s).toBe('O');
    expect(s.roles.mb1).toBe('MB');
  });

  it('roles reset to the roster at the next set start', () => {
    const e = ev({ type: 'setStart', set: 1, lineup: LINEUP, serving: 'us', roles: { o: 'S', s: 'O' } });
    const s = replay(match, [e, correct({ score: { us: 25, them: 10 } }), setEnd(1), start('us', 2)]);
    expect(s.roles.s).toBe('S');
    expect(s.rotation).toBe(1);
  });

  it('a sub inherits the outgoing player role for the rest of the set', () => {
    const s = replay(match, [start('us'), ev({ type: 'sub', outPlayerId: 'oh1', inPlayerId: 'bench' })]);
    expect(s.roles.bench).toBe('OH');
    const t = replay(match, [start('us'), ev({ type: 'sub', outPlayerId: 's', inPlayerId: 'bench' })]);
    expect(t.roles.bench).toBe('S');
  });
});
