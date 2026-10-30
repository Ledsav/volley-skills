import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../src/types/limitValues.js';
import { countOf, formatReport, joinLen, limitsReport, MAX_PATHS, rowsLen, textLen } from './limitsReport.mjs';

const s = (n) => 'x'.repeat(n);
const objective = (text) => ({ objective: text, targetDate: '2026-12-31', status: 'Active', coachComment: '' });
const team = (extra = {}) => ({ name: 'U17', adminEmails: ['coach@example.com'], developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' }, ...extra });
const doc = (path, data) => ({ path, data });

describe('measurements', () => {
  it('count text as the rules do', () => {
    expect(textLen(undefined)).toBe(0);
    expect(textLen('abc')).toBe(3);
    expect(textLen(null)).toBe(4);
    expect(textLen(12)).toBe(2);
    expect(textLen(['a'])).toBe(Infinity);
    expect(textLen({ a: 1 })).toBe(Infinity);
  });

  it('count lists, joined lists and rows of flat maps', () => {
    expect(countOf(undefined)).toBe(0);
    expect(countOf([1, 2])).toBe(2);
    expect(countOf({ a: 1 })).toBe(1);
    expect(countOf('abc')).toBe(Infinity);
    expect(joinLen(['ab', 'c'])).toBe(3);
    expect(joinLen([['nested']])).toBe(Infinity);
    expect(rowsLen([{ a: 'ab', b: 1 }, { c: null }])).toBe(7);
    expect(rowsLen([{ a: { nested: 1 } }])).toBe(Infinity);
    expect(rowsLen(['not a row'])).toBe(Infinity);
  });
});

describe('limitsReport', () => {
  it('reports nothing over the caps for data at the caps', () => {
    const plan = { shortTermObjectives: Array.from({ length: LIMITS.objectives }, () => objective(s(100))), seasonObjectives: [], generalNotes: s(LIMITS.longText) };
    const report = limitsReport([
      doc('clubs/c1/teams/t1', team({ name: s(LIMITS.shortText), developmentPlan: plan })),
      doc('clubs/c1/teams/t1/players/p1', { fullName: s(LIMITS.shortText), guardians: Array.from({ length: LIMITS.guardians }, () => ({ relation: 'mother', name: 'A', phone: '', email: '' })), developmentPlan: plan }),
    ]);
    expect(report.over).toBe(0);
    expect(report.clubs.c1.docs).toBe(2);
    expect(report.clubs.c1.checks['team.plan.shortTermObjectives.count']).toEqual({ cap: LIMITS.objectives, max: LIMITS.objectives, over: 0, paths: [] });
    expect(report.clubs.c1.checks['player.guardians.count'].max).toBe(LIMITS.guardians);
  });

  it('counts every doc over a cap, with its path and the maximum, per club', () => {
    const tooMany = { shortTermObjectives: Array.from({ length: LIMITS.objectives + 2 }, () => objective('a')), seasonObjectives: [], generalNotes: '' };
    const report = limitsReport([
      doc('clubs/c1/teams/t1/players/p1', { developmentPlan: tooMany }),
      doc('clubs/c1/teams/t1/players/p2', { developmentPlan: { ...tooMany, shortTermObjectives: [objective(s(LIMITS.longText + 1))] } }),
      doc('clubs/c1/teams/t1/matches/m1', { date: '2026-10-30', opponent: s(LIMITS.shortText + 5), roster: [] }),
      doc('clubs/c2/config/skillGuide', { skills: [{ key: 'serve', label: 'Serve', howToEvaluate: '', ranges: Array.from({ length: LIMITS.guideRanges + 1 }, (_, i) => ({ min: i, max: i, description: '' })) }], extra: 1 }),
      doc('clubs/c2/teams/t9', team({ description: ['a list'] })),
    ]);
    const c1 = report.clubs.c1.checks;
    expect(c1['player.plan.shortTermObjectives.count']).toEqual({ cap: LIMITS.objectives, max: LIMITS.objectives + 2, over: 1, paths: ['clubs/c1/teams/t1/players/p1'] });
    expect(c1['player.plan.objective.longestText']).toMatchObject({ max: LIMITS.longText + 1, over: 1, paths: ['clubs/c1/teams/t1/players/p2'] });
    expect(c1['match.opponent']).toMatchObject({ max: LIMITS.shortText + 5, over: 1 });
    const c2 = report.clubs.c2.checks;
    expect(c2['skillGuide.entry.ranges.count']).toMatchObject({ max: LIMITS.guideRanges + 1, over: 1 });
    expect(c2['skillGuide.otherKeys']).toMatchObject({ max: 1, over: 1 });
    expect(c2['team.description']).toMatchObject({ max: Infinity, over: 1 });
    expect(report.over).toBe(6);
  });

  it('lists at most MAX_PATHS paths per check but counts them all', () => {
    const docs = Array.from({ length: MAX_PATHS + 3 }, (_, i) => doc(`clubs/c1/exercises/e${i}`, { name: s(LIMITS.shortText + 1) }));
    const c = limitsReport(docs).clubs.c1.checks['exercise.name'];
    expect(c.over).toBe(MAX_PATHS + 3);
    expect(c.paths).toHaveLength(MAX_PATHS);
  });

  it('ignores docs outside clubs and kinds without caps', () => {
    const report = limitsReport([
      doc('teams/legacy', { name: s(1000) }),
      doc('clubs/c1/members/someone@example.com', { email: s(1000) }),
      doc('clubs/c1/teams/t1/matches/m1/events/e1', { chunkId: s(1000) }),
      doc('clubs/c1', { name: s(1000) }),
    ]);
    expect(report).toEqual({ clubs: {}, over: 0 });
  });
});

describe('formatReport', () => {
  it('prints counts, caps, maxima, paths and club ids, never a stored value', () => {
    const secret = `Ada Example ${s(LIMITS.shortText)}`;
    const report = limitsReport([
      doc('clubs/c1/teams/t1/players/p1', { fullName: secret, playerPhone: '+00 123', guardians: [{ relation: 'mother', name: 'Grace Example', phone: '', email: 'grace@example.com' }] }),
      doc('clubs/c1/teams/t1/matches/m1', { date: '2026-10-30', opponent: 'Rivals VC', roster: [] }),
    ]);
    const text = formatReport(report).join('\n');
    expect(text).toContain('Club c1:');
    expect(text).toContain(`OVER player.fullName: 1 doc(s) over ${LIMITS.shortText}, max ${secret.length}`);
    expect(text).toContain('clubs/c1/teams/t1/players/p1');
    expect(text).toContain('ok   match.opponent: max 9 of 200');
    for (const value of ['Ada', 'Grace', 'grace@example.com', '+00 123', 'Rivals']) expect(text).not.toContain(value);
    expect(text).toMatch(/Result: 1 field\(s\) over a cap/);
  });

  it('says so when everything is within the caps', () => {
    const lines = formatReport(limitsReport([doc('clubs/c1/exercises/e1', { name: 'Serve' })]));
    expect(lines.at(-1)).toBe('Result: every measured field is within its cap.');
    expect(lines[0]).toBe('Club c1: 1 capped documents, all within the caps');
  });
});
