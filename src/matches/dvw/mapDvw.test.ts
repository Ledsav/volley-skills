import { describe, expect, it } from 'vitest';
import type { MatchEvent, NewMatchEvent } from '../../types/match';
import type { Player } from '../../types/player';
import { replay, type EngineMatch } from '../scoutEngine';
import { autoMapPlayers, mapDvw, ourFilePlayers, type DvwPlan, type PlayerMapping } from './mapDvw';
import { parseScoutCode } from './parseScoutCode';
import type { DvwFile, DvwPlayer, DvwSide, ScoutLine } from './types';

const HOME_COURT = [7, 11, 3, 5, 8, 9];
const VISITING_COURT = [10, 6, 9, 12, 7, 11];

const filePlayer = (
  side: DvwSide,
  jersey: number,
  roleCode: DvwPlayer['roleCode'],
  specialRole: DvwPlayer['specialRole'] = null,
): DvwPlayer => ({
  side, jersey, roleCode, specialRole, fileId: `${side}${jersey}`, lastName: `Last${jersey}`, firstName: `First${jersey}`,
  startingPositions: [null, null, null, null, null],
});

const HOME_PLAYERS: DvwPlayer[] = [
  filePlayer('*', 7, 2), filePlayer('*', 11, 5), filePlayer('*', 3, 4), filePlayer('*', 5, 2),
  filePlayer('*', 8, 4), filePlayer('*', 9, 3), filePlayer('*', 4, 1, 'L'), filePlayer('*', 12, 2),
  filePlayer('*', 1, 6), filePlayer('*', 6, 2),
];
const VISITING_PLAYERS: DvwPlayer[] = VISITING_COURT.map((j) => filePlayer('a', j, 2));

type LineSpec = string | { code: string; set?: number; home?: (number | null)[]; visiting?: (number | null)[] };

/** A small file: each line is a scout code (line number = index + 1), set 1 unless given. */
function file(lines: LineSpec[], opts: Partial<DvwFile> = {}): DvwFile {
  const scout: ScoutLine[] = lines.map((spec, i) => {
    const s = typeof spec === 'string' ? { code: spec } : spec;
    return {
      lineNo: i + 1,
      raw: s.code,
      code: parseScoutCode(s.code),
      set: s.set ?? 1,
      homeCourt: s.home ?? HOME_COURT,
      visitingCourt: s.visiting ?? VISITING_COURT,
    };
  });
  return {
    generator: 'Test',
    date: '2026-10-18',
    season: '2026/2027',
    league: 'Test League',
    teams: { '*': { name: 'Volley Club Test', setsWon: 3 }, a: { name: 'Rivali Uno', setsWon: 0 } },
    sets: [],
    players: [...HOME_PLAYERS, ...VISITING_PLAYERS],
    scout,
    warnings: [],
    ...opts,
  };
}

const appPlayer = (jersey: number, positionCategory: Player['positionCategory'] = 'U') =>
  ({ id: `p${jersey}`, number: jersey, fullName: `App ${jersey}`, positionCategory, starting: false }) as Player;
const PLAYERS: Player[] = [7, 11, 3, 5, 8, 9, 4, 12, 1, 6].map((j) => appPlayer(j));

function plan(f: DvwFile, over: { us?: DvwSide; mapping?: PlayerMapping } = {}): DvwPlan {
  const us = over.us ?? '*';
  const mapping = over.mapping ?? autoMapPlayers(f, us, PLAYERS);
  return mapDvw(f, { us, mapping, players: PLAYERS, importId: 'imp1' });
}

/** Payloads only, without the meta fields. */
const payloads = (events: NewMatchEvent[]) =>
  events.map((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !['order', 'source', 'chunkId'].includes(k))));

const withIds = (events: NewMatchEvent[]): MatchEvent[] => events.map((e) => ({ ...e, id: `e${e.order}` }));
const engineMatch = (p: DvwPlan): EngineMatch => ({
  format: p.setup.format, roster: p.setup.roster, liberos: p.setup.liberos,
});

const LINEUP = ['p7', 'p11', 'p3', 'p5', 'p8', 'p9'];

describe('ourFilePlayers / autoMapPlayers', () => {
  it('lists our players seen on court, in skill lines or in sub lines', () => {
    const f = file(['*04RM+', '*c05:12', 'a10SM#', 'ac06:14']);
    expect(ourFilePlayers(f, '*').map((p) => p.jersey).sort((a, b) => a - b)).toEqual([3, 4, 5, 7, 8, 9, 11, 12]);
  });

  it('maps the same jersey to that app player, else null', () => {
    const f = file(['*04RM+', '*c05:12']);
    const mapping = autoMapPlayers(f, '*', PLAYERS.filter((p) => p.number !== 12));
    expect(mapping['*7']).toBe('p7');
    expect(mapping['*4']).toBe('p4');
    expect(mapping['*12']).toBeNull();
  });
});

describe('mapDvw: setup', () => {
  it('builds the match setup from the file', () => {
    const p = plan(file(['*04RM+', 'ap00:01']));
    expect(p.setup).toMatchObject({
      date: '2026-10-18', opponent: 'Rivali Uno', competition: 'league', homeAway: 'home',
    });
    expect(p.setup.format.bestOf).toBe(5);
    expect(p.setup.roster).toContainEqual({ playerId: 'p11', number: 11, name: 'App 11', positionCategory: 'S' });
    expect(p.setup.roster).toContainEqual({ playerId: 'p4', number: 4, name: 'App 4', positionCategory: 'L' });
    expect(p.setup.liberos).toEqual([{ playerId: 'p4', mode: 'always', replaces: ['p3', 'p8'] }]);
  });

  it('puts the libero on court for a back-row middle', () => {
    // P5 is #8, a middle: the libero (#4) replaces them, so their reception is on court.
    const p = plan(file(['a10SM-', '*04RM+', '*08AH+', 'ap00:01']));
    const state = replay(engineMatch(p), withIds(p.events));
    expect(state.actions.map((a) => a.playerId)).toEqual(['p4', 'p8']);
    const offCourt = state.warnings.filter((w) => w.code === 'offCourt').map((w) => w.eventId);
    expect(offCourt).toEqual([`e${p.events.findIndex((e) => e.type === 'action' && e.playerId === 'p8') + 1}`]);
  });

  it('treats a player with special role L as a libero whatever the role code', () => {
    const f = file(['*04RM+', 'ap00:01'], {
      players: [...HOME_PLAYERS.map((pl) => (pl.jersey === 4 ? { ...pl, roleCode: 4 as const } : pl)), ...VISITING_PLAYERS],
    });
    const p = plan(f);
    expect(p.setup.roster).toContainEqual({ playerId: 'p4', number: 4, name: 'App 4', positionCategory: 'L' });
    expect(p.setup.liberos).toEqual([{ playerId: 'p4', mode: 'always', replaces: ['p3', 'p8'] }]);
  });

  it('uses best of 3 when the winner won two sets, and orients an away match', () => {
    const f = file(['ap00:01'], {
      date: null,
      teams: { '*': { name: 'Rivali Uno', setsWon: 0 }, a: { name: 'Volley Club Test', setsWon: 2 } },
      players: [...HOME_PLAYERS.map((pl) => ({ ...pl, side: 'a' as const })), ...VISITING_PLAYERS.map((pl) => ({ ...pl, side: '*' as const }))],
    });
    const p = plan(f, { us: 'a' });
    expect(p.setup).toMatchObject({ date: '', opponent: 'Rivali Uno', homeAway: 'away' });
    expect(p.setup.format.bestOf).toBe(3);
  });
});

describe('mapDvw: sets', () => {
  it('maps setStart lineup, serving and roles from the first line of each set', () => {
    const set2Court = [11, 3, 5, 8, 9, 7];
    const p = plan(
      file([
        'aP06>LUp',
        'a10SM-',
        '*04RM+',
        'ap00:01',
        { code: '**1set' },
        { code: '*P11>LUp', set: 2, home: set2Court },
        { code: '*11SM#', set: 2, home: set2Court },
        { code: '*p01:00', set: 2, home: set2Court },
        { code: '**2set', set: 2, home: set2Court },
      ]),
    );
    const starts = p.events.filter((e) => e.type === 'setStart');
    expect(starts).toHaveLength(2);
    expect(starts[0]).toMatchObject({ set: 1, lineup: LINEUP, serving: 'them' });
    expect(starts[1]).toMatchObject({ set: 2, lineup: ['p11', 'p3', 'p5', 'p8', 'p9', 'p7'], serving: 'us' });
    const roles = starts[0].type === 'setStart' ? starts[0].roles : null;
    expect(roles).toMatchObject({ p7: 'OH', p11: 'S', p3: 'MB', p9: 'O', p4: 'L' });
    expect(p.events.filter((e) => e.type === 'setEnd').map((e) => (e.type === 'setEnd' ? e.set : 0))).toEqual([1, 2]);
    expect(p.events[0].type).toBe('setStart');
  });

  it('blocks import while a starter is skipped', () => {
    const f = file(['*07SM+', 'ap00:01']);
    const p = plan(f, { mapping: { ...autoMapPlayers(f, '*', PLAYERS), '*7': null } });
    expect(p.issues).toContainEqual({
      kind: 'blocking',
      message: 'Map or keep every starter: the app needs six players on court in set 1.',
      lines: [1],
    });
  });

  it('maps a starter missing from the file player list by number, with a warning', () => {
    const f = file(['*07SM+', 'ap00:01'], { players: [...HOME_PLAYERS.filter((pl) => pl.jersey !== 9), ...VISITING_PLAYERS] });
    expect(ourFilePlayers(f, '*')).toContainEqual({
      side: '*', jersey: 9, fileId: '', lastName: '', firstName: '', specialRole: null, roleCode: 6, startingPositions: [],
    });
    const p = plan(f);
    expect(p.events[0]).toMatchObject({ type: 'setStart', lineup: LINEUP });
    expect(p.setup.roster).toContainEqual({ playerId: 'p9', number: 9, name: 'App 9', positionCategory: 'U' });
    expect(p.issues).toEqual([
      { kind: 'warning', message: "#9 is not in the file's player list (first seen on line 1).", lines: [1] },
    ]);
  });

  it('blocks two file players mapped to the same app player in a lineup', () => {
    const f = file(['*07SM+', 'ap00:01']);
    const p = plan(f, { mapping: { ...autoMapPlayers(f, '*', PLAYERS), '*9': 'p7' } });
    expect(p.issues.filter((i) => i.kind === 'blocking' && i.message.startsWith('Two file players'))).toEqual([
      { kind: 'blocking', message: 'Two file players are mapped to the same app player (#7 and #9).', lines: [1] },
    ]);
  });

  it('blocks two bench players mapped to the same app player', () => {
    const f = file(['*c05:12', '*T', '*c08:06']);
    const p = plan(f, { mapping: { ...autoMapPlayers(f, '*', PLAYERS), '*6': 'p12' } });
    expect(p.issues).toContainEqual({
      kind: 'blocking',
      message: 'Two file players are mapped to the same app player (#12 and #6).',
      lines: [3],
    });
  });

  it('allows one app player for a file player who never appears in the match', () => {
    const f = file(['*07SM+', 'ap00:01']);
    // #12 is in the file's player list but not in the scout: their mapping does not count.
    const p = plan(f, { mapping: { ...autoMapPlayers(f, '*', PLAYERS), '*12': 'p7' } });
    expect(p.issues.filter((i) => i.kind === 'blocking')).toEqual([]);
  });

  it('takes serving from the first serve line when we are the visiting team', () => {
    const awayPlayers = {
      players: [...HOME_PLAYERS.map((pl) => ({ ...pl, side: 'a' as const })), ...VISITING_PLAYERS.map((pl) => ({ ...pl, side: '*' as const }))],
    };
    const lines = (codes: string[]) => codes.map((code) => ({ code, visiting: HOME_COURT }));
    const theyServe = plan(file(lines(['*10SM+', 'ap00:01']), awayPlayers), { us: 'a' });
    expect(theyServe.events[0]).toMatchObject({ type: 'setStart', serving: 'them', lineup: LINEUP });
    const weServe = plan(file(lines(['a07SM+', '*p01:00']), awayPlayers), { us: 'a' });
    expect(weServe.events[0]).toMatchObject({ type: 'setStart', serving: 'us', lineup: LINEUP });
  });

  it('flags more than two liberos', () => {
    const f = file(['*04RM+', '*12DM+', '*06RM+', 'ap00:01'], {
      players: [
        ...HOME_PLAYERS.map((pl) => (pl.jersey === 12 ? { ...pl, specialRole: 'L' as const } : pl.jersey === 6 ? { ...pl, roleCode: 1 as const } : pl)),
        ...VISITING_PLAYERS,
      ],
    });
    const p = plan(f);
    expect(p.setup.liberos).toHaveLength(2);
    expect(p.issues.filter((i) => i.kind === 'blocking')).toHaveLength(1);
  });
});

describe('mapDvw: actions and points', () => {
  it('emits no point when our action already decided the rally', () => {
    const p = plan(file(['*07SH#', '*p01:00']));
    expect(payloads(p.events).slice(1)).toEqual([{ type: 'action', playerId: 'p7', skill: 'S', grade: '#' }]);
    expect(p.issues).toEqual([]);
  });

  it('drops a conflicting deciding action; the point line wins', () => {
    const p = plan(file(['*09AH=', '*p01:00']));
    expect(payloads(p.events).slice(1)).toEqual([{ type: 'point', winner: 'us', reason: 'unknown' }]);
    expect(p.issues).toHaveLength(1);
    expect(p.issues[0]).toMatchObject({ kind: 'warning' });
    expect(p.issues[0].lines).toContain(1);
  });

  it('infers the point reason from the last opponent skill line', () => {
    const cases: [string[], string, string][] = [
      [['a10SM#', 'ap00:01'], 'them', 'oppAce'],
      [['*07RM+', 'a10AH#', 'ap00:01'], 'them', 'oppKill'],
      [['*09AH+', 'a12BH#', 'ap00:01'], 'them', 'oppBlock'],
      [['*07SM+', 'a10AH=', '*p01:00'], 'us', 'oppError'],
      [['*07SM+', 'a10AH/', '*p01:00'], 'us', 'oppError'],
      [['*07SM+', 'a10DM+', 'a12AH=', '*p01:00'], 'us', 'oppError'],
      [['*07SM+', '*p01:00'], 'us', 'unknown'],
      [['a10SM#', '*p01:00'], 'us', 'unknown'],
    ];
    for (const [lines, winner, reason] of cases) {
      const points = plan(file(lines)).events.filter((e) => e.type === 'point');
      expect(points, lines.join(' ')).toMatchObject([{ winner, reason }]);
    }
  });

  it('drops actions of skipped players and $$ lines, keeping their points', () => {
    const f = file(['*12AH#', '*p01:00', '*$$RM=', 'ap01:01']);
    const p = plan(f, { mapping: { ...autoMapPlayers(f, '*', PLAYERS), '*12': null } });
    expect(payloads(p.events).slice(1)).toEqual([
      { type: 'point', winner: 'us', reason: 'unknown' },
      { type: 'point', winner: 'them', reason: 'unknown' },
    ]);
    expect(p.issues).toEqual([
      { kind: 'warning', message: '1 action of #12 dropped: not mapped to a player (line 1).', lines: [1] },
      { kind: 'warning', message: '1 action by an unknown player ($$) dropped (line 3).', lines: [3] },
    ]);
  });

  it('groups dropped actions into one warning per jersey and reason', () => {
    const f = file([
      ...Array.from({ length: 6 }, () => '*12DM+'), // lines 1-6: #12 skipped
      '*$$RM=', // 7
      '*07SM#', // 8
      '*09AH+', // 9: decided
      '*09AH+', // 10: decided
      '*p01:00', // 11
      '*$$DM+', // 12
      '*11EM+', // 13
      '*12DM+', // 14
      'ap01:01',
    ]);
    const p = plan(f, { mapping: { ...autoMapPlayers(f, '*', PLAYERS), '*12': null } });
    expect(p.issues).toEqual([
      {
        kind: 'warning',
        message: '7 actions of #12 dropped: not mapped to a player (lines 1, 2, 3, 4, 5, …).',
        lines: [1, 2, 3, 4, 5],
      },
      { kind: 'warning', message: '2 actions by an unknown player ($$) dropped (lines 7, 12).', lines: [7, 12] },
      {
        kind: 'warning',
        message: '2 actions of #9 dropped: the rally was already decided (lines 9, 10).',
        lines: [9, 10],
      },
    ]);
  });

  it('drops a grade the app does not offer for that skill', () => {
    const p = plan(file(['*07EH/', 'ap00:01']));
    expect(p.events.some((e) => e.type === 'action')).toBe(false);
    expect(p.issues).toEqual([
      { kind: 'warning', message: '1 Set "/" action dropped: the app has no such grade (line 1).', lines: [1] },
    ]);
  });

  it('groups dropped grades into one warning per skill and grade', () => {
    const p = plan(file([...Array.from({ length: 7 }, () => '*07EH/'), 'ap00:01']));
    expect(p.issues).toEqual([
      {
        kind: 'warning',
        message: '7 Set "/" actions dropped: the app has no such grade (lines 1, 2, 3, 4, 5, …).',
        lines: [1, 2, 3, 4, 5],
      },
    ]);
  });

  it('keeps a serve graded "!" (OK) and reads a block graded "!" as "-" (DataVolley: poor block, ball to the opponent)', () => {
    const p = plan(file(['*07SM!', '*09BH!', 'ap00:01']));
    expect(p.events.filter((e) => e.type === 'action').map((e) => (e.type === 'action' ? `${e.skill}${e.grade}` : ''))).toEqual([
      'S!',
      'B-',
    ]);
    expect(p.issues).toEqual([]);
  });

  it('drops our actions after the rally was decided, until the next point line', () => {
    const p = plan(file(['*07SM#', '*09AH+', '*p01:00', '*07SM+']));
    expect(p.events.filter((e) => e.type === 'action').map((e) => (e.type === 'action' ? e.grade : ''))).toEqual(['#', '+']);
    expect(p.issues).toEqual([
      { kind: 'warning', message: '1 action of #9 dropped: the rally was already decided (line 2).', lines: [2] },
    ]);
  });

  it('maps opponent skill lines to nothing', () => {
    const p = plan(file(['a10SM-', 'a12RM+', 'a07AH+', '*09DM+', 'ap00:01']));
    expect(p.events.filter((e) => e.type === 'action')).toHaveLength(1);
  });
});

describe('mapDvw: subs and timeouts', () => {
  it('maps our subs and both teams’ timeouts, ignoring opponent subs', () => {
    const f = file(['*c05:12', 'ac06:14', '*T', 'aT', '*c08:44']);
    const p = plan(f);
    expect(payloads(p.events).slice(1)).toEqual([
      { type: 'sub', outPlayerId: 'p5', inPlayerId: 'p12' },
      { type: 'timeout', team: 'us' },
      { type: 'timeout', team: 'them' },
    ]);
    // #44 is skipped, so only the skipped sub is reported (not "#44 is not in the file's player list").
    expect(p.issues).toEqual([expect.objectContaining({ kind: 'warning', lines: [5] })]);
    expect(p.issues[0].message).toMatch(/substitution #8 → #44/);
  });
});

describe('mapDvw: score check', () => {
  it('re-syncs the score after a mismatching point', () => {
    const f = file(['*07SM#', '*p01:00', 'a10SM#', 'ap01:02', '**1set'], {
      sets: [{ played: true, home: 1, visiting: 2 }],
    });
    const p = plan(f);
    expect(payloads(p.events)).toEqual([
      expect.objectContaining({ type: 'setStart' }),
      { type: 'action', playerId: 'p7', skill: 'S', grade: '#' },
      { type: 'point', winner: 'them', reason: 'oppAce' },
      { type: 'correction', score: { us: 1, them: 2 }, rotation: null, serving: null },
      { type: 'setEnd', set: 1 },
    ]);
    expect(p.checks.corrections).toEqual([4]);
    const state = replay(engineMatch(p), withIds(p.events));
    expect(state.warnings.filter((w) => w.code === 'setEndTie')).toEqual([]);
    expect(state.setScores).toEqual([{ us: 1, them: 2 }]);
  });

  it('orients the file score to us when we are the visiting team', () => {
    const f = file(['ap00:01', '*p02:01', '**1set'].map((code) => ({ code, visiting: HOME_COURT })), {
      players: [...HOME_PLAYERS.map((pl) => ({ ...pl, side: 'a' as const })), ...VISITING_PLAYERS.map((pl) => ({ ...pl, side: '*' as const }))],
      sets: [{ played: true, home: 2, visiting: 1 }],
    });
    const p = plan(f, { us: 'a' });
    expect(p.events[0]).toMatchObject({ type: 'setStart', lineup: LINEUP });
    expect(payloads(p.events).slice(1, 4)).toEqual([
      { type: 'point', winner: 'us', reason: 'unknown' },
      { type: 'point', winner: 'them', reason: 'unknown' },
      { type: 'correction', score: { us: 1, them: 2 }, rotation: null, serving: null },
    ]);
    expect(p.checks.fileSets).toEqual([{ us: 1, them: 2 }]);
    expect(p.checks.replaySets).toEqual([{ us: 1, them: 2 }]);
  });

  it('fills the checks and warns when the replay differs from the file sets', () => {
    const f = file(['*P11>LUp', '*07SM#', '*p01:00', '>ROT', '*$$&H#', '**1set'], {
      sets: [{ played: true, home: 25, visiting: 20 }, { played: false, home: 0, visiting: 0 }],
    });
    const p = plan(f);
    expect(p.checks.fileSets).toEqual([{ us: 25, them: 20 }]);
    expect(p.checks.pointLineSets).toEqual([{ us: 1, them: 0 }]);
    expect(p.checks.replaySets).toEqual([{ us: 1, them: 0 }]);
    expect(p.checks.ignoredLines).toBe(2);
    expect(p.checks.eventCounts).toEqual({ setStart: 1, action: 1, point: 0, sub: 0, timeout: 0, correction: 0, setEnd: 1 });
    expect(p.issues).toContainEqual({
      kind: 'warning', message: "The replayed score differs from the file's set scores.", lines: [],
    });
  });
});

describe('mapDvw: limits and meta', () => {
  it('refuses more than 1,900 events', () => {
    const blocking = (n: number) =>
      plan(file(Array.from({ length: n }, () => '*T'))).issues.filter((i) => i.kind === 'blocking');
    expect(blocking(1899)).toEqual([]); // setStart + 1,899 timeouts = 1,900
    expect(blocking(1900)).toEqual([
      { kind: 'blocking', message: 'This match is too long to import (more than 1,900 events).', lines: [] },
    ]);
  });

  it('orders events 1..n with source import and the import id as chunkId', () => {
    const p = plan(file(['*07SM+', 'ap00:01', '*T', '*07SM#', '*p01:01']));
    expect(p.events.map((e) => e.order)).toEqual(p.events.map((_, i) => i + 1));
    expect(p.events.every((e) => e.source === 'import' && e.chunkId === 'imp1')).toBe(true);
  });
});

describe('mapDvw: real-file rallies and liberos', () => {
  it('drops only the wrong-way action when the rally goes on (no later action is lost)', () => {
    // Line 2's reception error would hand the point to the opponent, but the rally continues and we win it.
    const p = plan(file(['a10SM+', '*07RM=', '*11EH+', '*09AH#', '*p01:00']));
    expect(payloads(p.events).slice(1)).toEqual([
      { type: 'action', playerId: 'p11', skill: 'E', grade: '+' },
      { type: 'action', playerId: 'p9', skill: 'A', grade: '#' },
    ]);
    expect(p.issues).toEqual([
      {
        kind: 'warning',
        message: 'Line 2: this action ended the rally the other way; line 5 gives the point to us — action dropped.',
        lines: [2],
      },
    ]);
    expect(replay(engineMatch(p), withIds(p.events)).score).toEqual({ us: 1, them: 0 });
  });

  // Real files rarely carry role codes: only the libero is marked.
  const NO_ROLES: DvwPlayer[] = HOME_PLAYERS.map((pl) => (pl.specialRole === 'L' ? pl : { ...pl, roleCode: 6 as const }));
  const rally = ['a10SM+', '*04RM+', '*11EH+', '*09AH+', 'a12DM+', 'a07AH+', '*07DM+', 'ap00:01'];

  it('finds who the libero replaced from the scout when no middle is known', () => {
    // P5 (#8) sits in the back row on every line and never plays a ball; #7 (P1) and #9 (P6) do.
    const p = plan(file([...rally, ...rally, ...rally], { players: [...NO_ROLES, ...VISITING_PLAYERS] }));
    expect(p.setup.liberos).toEqual([{ playerId: 'p4', mode: 'always', replaces: ['p8'] }]);
    expect(p.issues).toEqual([]);
    const state = replay(engineMatch(p), withIds(p.events));
    expect(state.warnings.filter((w) => w.code === 'offCourt')).toEqual([]);
  });

  it('warns when the libero would never come on court', () => {
    const p = plan(file(rally, { players: [...NO_ROLES, ...VISITING_PLAYERS] }));
    expect(p.setup.liberos).toEqual([{ playerId: 'p4', mode: 'always', replaces: [] }]);
    expect(p.issues).toEqual([
      {
        kind: 'warning',
        message: 'The libero never comes on court: mark your middle blockers as MB in the team roster, then import again.',
        lines: [],
      },
    ]);
  });
});
