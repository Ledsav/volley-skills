import { describe, expect, it } from 'vitest';
import type { Grade, Side, Skill } from '../types/match';
import type { ActionRecord, RallyRecord, TimeoutRecord } from './scoutEngine';
import { computeStats, liveAlerts, playerForm } from './scoutStats';

let id = 0;
const act = (playerId: string, skill: Skill, grade: Grade, set = 1): ActionRecord => ({
  eventId: `a${++id}`, set, playerId, skill, grade, source: 'tap',
});
const rally = (winner: Side, serving: Side, rotation = 1, set = 1, index = 0, reason: RallyRecord['reason'] = null): RallyRecord => ({
  set, index, serving, rotation, winner, reason, scoreAfter: { us: 0, them: 0 }, actionIds: [], endEventId: `r${++id}`,
});
const empty = { actions: [] as ActionRecord[], rallies: [] as RallyRecord[], timeouts: [] as TimeoutRecord[] };

describe('computeStats', () => {
  it('computes attack efficiency, points and errors per player', () => {
    const actions = ['#', '#', '=', '/', '+'].map((g) => act('oh1', 'A', g as Grade));
    const p = computeStats({ ...empty, actions }, {}).players.oh1;
    expect(p.skills.A?.attempts).toBe(5);
    expect(p.skills.A?.grades['#']).toBe(2);
    expect(p.attackEff).toBe(0);
    expect(p.points).toBe(2);
    expect(p.errors).toBe(2);
  });

  it('computes reception positivity and perfect rate', () => {
    const actions = ['#', '+', '-', '='].map((g) => act('oh1', 'R', g as Grade));
    const p = computeStats({ ...empty, actions }, {}).players.oh1;
    expect(p.receptionPos).toBe(0.5);
    expect(p.receptionPerfect).toBe(0.25);
    expect(p.attackEff).toBeNull();
  });

  it('computes side-out, break point, rotations and opponent errors', () => {
    const rallies = [
      rally('us', 'them', 1),
      rally('them', 'them', 1),
      rally('us', 'us', 6, 1, 2, 'oppError'),
      rally('them', 'us', 6),
      rally('them', 'us', 6),
    ];
    const t = computeStats({ ...empty, rallies }, {}).team;
    expect(t.sideOut).toEqual({ won: 1, total: 2 });
    expect(t.breakPoint).toEqual({ won: 1, total: 3 });
    expect(t.oppErrorPoints).toBe(1);
    expect(t.rotations[6]).toEqual({ won: 1, lost: 2 });
    expect(t.weakestRotation).toBe(6);
  });

  it('filters by set', () => {
    const actions = [act('oh1', 'S', '#', 1), act('oh1', 'S', '=', 2)];
    expect(computeStats({ ...empty, actions }, { set: 2 }).players.oh1.skills.S?.grades['=']).toBe(1);
    expect(computeStats({ ...empty, actions }, { set: 2 }).players.oh1.skills.S?.grades['#']).toBe(0);
    expect(computeStats({ ...empty, actions }, {}).team.aces).toBe(1);
  });

  it('measures the run after each timeout', () => {
    const rallies = [0, 1, 2, 3, 4, 5, 6].map((i) => rally(i < 2 ? 'them' : 'us', 'us', 1, 1, i));
    const timeouts: TimeoutRecord[] = [{ set: 1, team: 'us', ralliesBefore: 2, score: { us: 0, them: 2 }, eventId: 't1' }];
    const [effect] = computeStats({ ...empty, rallies, timeouts }, {}).timeoutEffects;
    expect(effect).toEqual({ set: 1, team: 'us', score: { us: 0, them: 2 }, won: 5, lost: 0 });
  });
});

describe('liveAlerts and playerForm', () => {
  it('alerts on 3 errors in the current set and on an opponent run', () => {
    const actions = [act('oh2', 'R', '='), act('oh2', 'A', '='), act('oh2', 'A', '/')];
    const rallies = [rally('us', 'us'), rally('them', 'us'), rally('them', 'them'), rally('them', 'them')];
    const alerts = liveAlerts({ actions, rallies, set: 1 });
    expect(alerts).toContainEqual({ kind: 'playerErrors', playerId: 'oh2', errors: 3 });
    expect(alerts).toContainEqual({ kind: 'oppRun', run: 3 });
    expect(playerForm({ actions, set: 1 }, 'oh2')).toBe('bad');
  });

  it('marks a player in good form', () => {
    const actions = [act('oh1', 'A', '#'), act('oh1', 'A', '#'), act('oh1', 'S', '#')];
    expect(playerForm({ actions, set: 1 }, 'oh1')).toBe('good');
    expect(playerForm({ actions, set: 1 }, 'nobody')).toBeNull();
  });
});
