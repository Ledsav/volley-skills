// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SKILLS, type MatchEvent, type SetScore, type Skill } from '../../types/match';
import type { Player } from '../../types/player';
import { buildReportData } from '../report/reportData';
import { replay } from '../scoutEngine';
import { validGrades } from '../skillGrades';
import { loadFixture } from './loadFixture';
import { autoMapPlayers, mapDvw } from './mapDvw';
import { parseDvw } from './parseDvw';
import { pickOurSide } from './pickSide';
import type { DvwFile } from './types';

function parsed(name: string): DvwFile {
  const result = parseDvw(loadFixture(name));
  if ('error' in result) throw new Error(result.error);
  return result;
}

// `dropped`: our skill lines the import leaves out (the serve graded `!`, and a `$$` line in the five-set file).
const cases: { name: string; setsWon: SetScore; corrections: number; dropped: number }[] = [
  { name: 'three-sets-home.dvw', setsWon: { us: 3, them: 0 }, corrections: 1, dropped: 1 },
  { name: 'five-sets-away.dvw', setsWon: { us: 3, them: 2 }, corrections: 0, dropped: 2 },
];

describe.each(cases)('round trip: $name', ({ name, setsWon, corrections, dropped }) => {
  const file = parsed(name);
  const us = pickOurSide(file.teams, ['Volley Club Test', 'U17']);
  const ours = file.players.filter((p) => p.side === us);
  const players = ours.map(
    (p) => ({ id: `p${p.jersey}`, number: p.jersey, fullName: `App ${p.jersey}`, positionCategory: 'U', starting: false }) as Player,
  );
  const mapping = autoMapPlayers(file, us, players);
  const plan = mapDvw(file, { us, mapping, players, importId: 'imp1' });
  const events: MatchEvent[] = plan.events.map((e) => ({ ...e, id: `e${e.order}` }));
  const state = replay({ format: plan.setup.format, roster: plan.setup.roster, liberos: plan.setup.liberos }, events);
  const report = buildReportData(state);

  it('has a 12-player app roster and no blocking issue', () => {
    expect(players).toHaveLength(12);
    expect(plan.issues.filter((i) => i.kind === 'blocking')).toEqual([]);
  });

  it("replays to the file's set scores", () => {
    const fileSets = file.sets
      .filter((s) => s.played)
      .map((s) => (us === '*' ? { us: s.home, them: s.visiting } : { us: s.visiting, them: s.home }));
    expect(report.setScores).toEqual(fileSets);
    expect(plan.checks.replaySets).toEqual(fileSets);
    expect(plan.checks.fileSets).toEqual(fileSets);
    expect(report.setsWon).toEqual(setsWon);
    expect(state.warnings.filter((w) => w.code === 'setEndTie')).toEqual([]);
    expect(plan.checks.corrections).toHaveLength(corrections);
  });

  it('keeps every valid our-side skill line as an action', () => {
    const expected: Partial<Record<Skill, number>> = {};
    const actual: Partial<Record<Skill, number>> = {};
    for (const line of file.scout) {
      const c = line.code;
      if (c.kind === 'skill' && c.side === us && c.jersey !== null && validGrades(c.skill).includes(c.grade)) {
        expected[c.skill] = (expected[c.skill] ?? 0) + 1;
      }
    }
    for (const p of Object.values(report.all.players)) {
      for (const skill of SKILLS) {
        const n = p.skills[skill]?.attempts ?? 0;
        if (n) actual[skill] = (actual[skill] ?? 0) + n;
      }
    }
    expect(actual).toEqual(expected);
    expect(plan.issues.filter((i) => i.kind === 'warning')).toHaveLength(dropped);
  });
});
