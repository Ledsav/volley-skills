import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type LiberoConfig, type MatchEvent, type MatchEventPayload, type Side } from '../types/match';
import { ROSTER } from './testFixtures';
import { applyLibero, replay, type EngineMatch } from './scoutEngine';

const LINEUP = ['s', 'oh1', 'mb1', 'o', 'oh2', 'mb2']; // mb2 in P6
let n = 0;
const ev = (p: MatchEventPayload): MatchEvent => {
  n += 1;
  return { id: `e${String(n).padStart(3, '0')}`, order: n, source: 'tap', chunkId: null, ...p } as MatchEvent;
};
const start = (serving: Side = 'us', lineup = LINEUP) => ev({ type: 'setStart', set: 1, lineup, serving });
const sub = (outPlayerId: string, inPlayerId: string) => ev({ type: 'sub', outPlayerId, inPlayerId });
const to = (team: Side) => ev({ type: 'timeout', team });
const m = (liberos: LiberoConfig[], format = DEFAULT_FORMAT): EngineMatch => ({ format, roster: ROSTER, liberos });

const ALWAYS: LiberoConfig = { playerId: 'lib', mode: 'always', replaces: ['mb1', 'mb2'] };

describe('applyLibero', () => {
  it('puts the libero in for a replaced back-row player', () => {
    const r = applyLibero(LINEUP, [ALWAYS], 'them');
    expect(r.court[5]).toBe('lib');
    expect(r.activeLiberoId).toBe('lib');
  });

  it('never lets the libero serve', () => {
    const lineup = ['mb2', 's', 'oh1', 'mb1', 'o', 'oh2'];
    expect(applyLibero(lineup, [ALWAYS], 'us').court[0]).toBe('mb2');
    expect(applyLibero(lineup, [ALWAYS], 'them').court[0]).toBe('lib');
  });

  it('leaves front-row players alone', () => {
    const lineup = ['s', 'oh1', 'mb1', 'o', 'oh2', 'oh2x'];
    expect(applyLibero(lineup, [ALWAYS], 'them').court).toEqual(lineup);
  });

  it('picks the reception libero when receiving and the defence libero when serving', () => {
    const liberos: LiberoConfig[] = [
      { playerId: 'lib', mode: 'receiving', replaces: ['mb1', 'mb2'] },
      { playerId: 'lib2', mode: 'serving', replaces: ['mb1', 'mb2'] },
    ];
    expect(applyLibero(LINEUP, liberos, 'them').court[5]).toBe('lib');
    expect(applyLibero(LINEUP, liberos, 'us').court[5]).toBe('lib2');
  });

  it('has no libero on court when no mode matches', () => {
    const liberos: LiberoConfig[] = [{ playerId: 'lib', mode: 'receiving', replaces: ['mb2'] }];
    const r = applyLibero(LINEUP, liberos, 'us');
    expect(r.court[5]).toBe('mb2');
    expect(r.activeLiberoId).toBeNull();
  });
});

describe('replay — subs and timeouts', () => {
  beforeEach(() => {
    n = 0;
  });

  it('applies the libero after replay', () => {
    const s = replay(m([ALWAYS]), [start('them')]);
    expect(s.court[5]).toBe('lib');
    expect(s.lineup[5]).toBe('mb2');
  });

  it('swaps a substitute into the lineup and counts it', () => {
    const s = replay(m([]), [start('us'), sub('oh2', 'bench')]);
    expect(s.lineup[4]).toBe('bench');
    expect(s.subsUsed).toBe(1);
  });

  it('keeps the libero replacing the player who came in for a replaced player', () => {
    const s = replay(m([ALWAYS]), [start('them'), sub('mb2', 'bench')]);
    expect(s.lineup[5]).toBe('bench');
    expect(s.court[5]).toBe('lib');
  });

  it('warns past the substitution limit', () => {
    const format = { ...DEFAULT_FORMAT, subsPerSet: 1 };
    const s = replay(m([], format), [start('us'), sub('oh2', 'bench'), sub('bench', 'oh2')]);
    expect(s.warnings.map((w) => w.code)).toContain('subLimit');
  });

  it('warns on an illegal re-entry', () => {
    const s = replay(m([]), [start('us'), sub('oh2', 'bench'), sub('bench', 'oh2'), sub('oh1', 'bench')]);
    expect(s.warnings.map((w) => w.code)).toEqual(['illegalReentry']);
  });

  it('ignores a sub whose outgoing player is not on court', () => {
    const s = replay(m([]), [start('us'), sub('bench', 'oh2')]);
    expect(s.warnings[0].code).toBe('subNotOnCourt');
    expect(s.subsUsed).toBe(0);
  });

  it('counts timeouts, records them, and warns past the limit', () => {
    const s = replay(m([]), [start('us'), to('us'), to('us'), to('us'), to('them')]);
    expect(s.timeoutsUsed).toEqual({ us: 3, them: 1 });
    expect(s.timeouts).toHaveLength(4);
    expect(s.timeouts[0]).toMatchObject({ set: 1, team: 'us', ralliesBefore: 0, score: { us: 0, them: 0 } });
    expect(s.warnings.map((w) => w.code)).toEqual(['timeoutLimit']);
  });

  it('warns when crediting an off-court player but still counts the action', () => {
    const s = replay(m([]), [start('us'), ev({ type: 'action', playerId: 'bench', skill: 'A', grade: '+' })]);
    expect(s.warnings[0].code).toBe('offCourt');
    expect(s.actions).toHaveLength(1);
  });

  it('ignores actions by players outside the roster', () => {
    const s = replay(m([]), [start('us'), ev({ type: 'action', playerId: 'ghost', skill: 'A', grade: '#' })]);
    expect(s.warnings[0].code).toBe('unknownPlayer');
    expect(s.score.us).toBe(0);
  });
});
