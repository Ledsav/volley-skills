// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LIMITS as L } from './limits';
import { MAX_TOKENS } from '../search/searchTokens.js';
import { SKILL_KEYS } from './player';
import { PHYSICAL_TEST_ORDER } from './physicalTest';
import { MAX_CUSTOM_AWARDS } from './awards';
import { MAX_ROSTER } from '../matches/matchSetup';

// firestore.rules cannot import LIMITS, so it repeats the numbers. These checks fail when one side
// changes without the other. The behaviour itself is tested on the emulator (tests/rules/limits.rules.test.ts).
const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8').replace(/\s+/g, ' ');

describe('firestore.rules mirrors LIMITS', () => {
  const snippets: string[] = [
    // text
    `string(d.get('fullName', '')).size() <= ${L.shortText}`,
    `string(d.get('description', '')).size() <= ${L.longText}`,
    `string(s.get('notes', '')).size() <= ${L.longText}`,
    `string(d.get('opponent', '')).size() <= ${L.shortText}`,
    `string(request.resource.data.get('notes', '')).size() <= ${L.longText}`,
    `string(d.get('updatedBy', '')).size() <= ${L.email}`,
    // email lists
    `v.size() <= ${L.emailList} && v.join('').size() <= ${L.emailList * L.email}`,
    `a.size() <= ${L.emailList} && a.join('').size() <= ${L.emailList * L.email}`,
    `adminEmails.size() <= ${L.sectionEmailList} && request.resource.data.adminEmails.join('').size() <= ${L.sectionEmailList * L.email}`,
    // lists of rows
    `g.size() <= ${L.guardians} && rows10(g).join('').size() <= ${L.guardiansText}`,
    `s.size() <= ${L.objectives} && rows10(s).join('').size() <= ${L.objectivesText}`,
    `n.size() <= ${L.objectives} && rows10(n).join('').size() <= ${L.objectivesText}`,
    `x.size() <= ${L.trainingExercises} && rows50(x).join('').size() <= ${L.trainingExercisesText}`,
    `i.size() <= ${L.trainingExercises} && i.join('').size() <= ${L.trainingExercisesText}`,
    `r.size() <= ${L.matchRoster} && rows30(r).join('').size() <= ${L.matchRosterText}`,
    `d.get('liberos', []).size() <= ${L.matchLiberos}`,
    `t.size() <= ${L.searchTokens} && t.join('').size() <= ${L.searchTokensText}`,
    `c.size() <= ${MAX_CUSTOM_AWARDS} && rows5(c).join('').size() <= ${L.awardCustomText}`,
    `a.get('picks', {}).size() <= ${L.awardPicks}`,
    `o.size() <= ${L.awardOrder} && o.join('').size() <= ${L.awardOrderText}`,
    `d.get('latestTests', {}).size() <= ${L.latestTests}`,
    `d.consent.values().join('').size() <= ${L.consentText}`,
    // events and the usage profile
    `d.size() <= ${L.eventFields}`,
    `d.get('lineup', []).size() <= ${L.eventLineup} && d.get('lineup', []).join('').size() <= ${L.eventLineupText}`,
    `d.roles.size() <= ${L.eventRoles}`,
    `get('players', {}).size() <= ${L.scoutProfilePlayers}`,
    // guides
    `l is list && l.size() <= ${L.guideSkills}`,
    `e.ranges.size() <= ${L.guideRanges} && rows5(e.ranges).join('').size() <= ${L.guideRangesText}`,
    `l is list && l.size() <= ${L.guideTests}`,
    `string(e.protocol).size() <= ${L.longText}`,
    `string(e.howToEvaluate).size() <= ${L.longText}`,
  ];

  it.each(snippets)('contains %s', (snippet) => {
    expect(rules).toContain(snippet);
  });
});

describe('limitValues.d.ts matches limitValues.js', () => {
  it('declares every cap with its value', () => {
    const dts = readFileSync(join(process.cwd(), 'src/types/limitValues.d.ts'), 'utf8');
    const declared = Object.fromEntries([...dts.matchAll(/readonly (\w+): (\d+);/g)].map((m) => [m[1], Number(m[2])]));
    expect(declared).toEqual({ ...L });
  });
});

describe('LIMITS fit the shapes the app and the rules assume', () => {
  it('matches the hardcoded sets and the older caps', () => {
    expect(L.searchTokens).toBe(MAX_TOKENS);
    expect(L.awardCustom).toBe(MAX_CUSTOM_AWARDS);
    expect(L.guideSkills).toBe(SKILL_KEYS.length);
    expect(L.guideTests).toBe(PHYSICAL_TEST_ORDER.length);
    expect(L.matchRoster).toBeGreaterThanOrEqual(MAX_ROSTER);
  });

  it('keeps each list within the rows helper that collects it in the rules', () => {
    // rows5 / rows10 / rows30 / rows50 read at most that many rows.
    expect(L.guideRanges).toBeLessThanOrEqual(5);
    expect(MAX_CUSTOM_AWARDS).toBeLessThanOrEqual(5);
    expect(L.guardians).toBeLessThanOrEqual(10);
    expect(L.objectives).toBeLessThanOrEqual(10);
    expect(L.matchRoster).toBeLessThanOrEqual(30);
    expect(L.trainingExercises).toBeLessThanOrEqual(50);
  });

  it('leaves room in each total for every row at its field caps', () => {
    expect(L.guardiansText).toBeGreaterThanOrEqual(L.guardians * (2 * L.shortText + L.email + 'mother'.length));
    expect(L.guideRangesText).toBeGreaterThanOrEqual(L.guideRanges * (L.longText + 4));
    expect(L.awardCustomText).toBeGreaterThanOrEqual(MAX_CUSTOM_AWARDS * (40 + 80 + 2 * 40));
  });
});
