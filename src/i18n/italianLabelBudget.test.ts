import { describe, expect, it } from 'vitest';
import { en } from './en';
import { it as itCat } from './it';

// R6: jsdom has no layout, so a 375 px overflow assertion would measure 0 = 0. Instead, the tight
// places (scout skill/grade buttons, phone bottom-bar tabs, KPI tiles) get a label-length budget:
// an Italian label may be at most max(English length x 1.5, 12) characters.
const budget = (enText: string) => Math.max(Math.floor(enText.length * 1.5), 12);

type Pair = { place: string; en: string; it: string };

function pairs(): Pair[] {
  const out: Pair[] = [];
  for (const s of Object.keys(en.labels.skill) as (keyof typeof en.labels.skill)[]) {
    out.push({ place: `labels.skill.${s}`, en: en.labels.skill[s], it: itCat.labels.skill[s] });
    const enG = en.labels.grade[s] as Record<string, string>;
    const itG = itCat.labels.grade[s] as Record<string, string>;
    for (const g of Object.keys(enG)) out.push({ place: `labels.grade.${s}.${g}`, en: enG[g], it: itG[g] });
  }
  for (const k of ['home', 'teams', 'trainings', 'exercises', 'more'] as const) {
    out.push({ place: `layout.nav.${k}`, en: en.layout.nav[k], it: itCat.layout.nav[k] });
  }
  for (const k of ['newMatch', 'newTraining', 'newExercise'] as const) {
    out.push({ place: `home.shortcuts.${k}`, en: en.home.shortcuts[k], it: itCat.home.shortcuts[k] });
  }
  for (const k of ['skillsRated', 'focusAreas', 'openObjectives', 'lastPhysicalTest'] as const) {
    out.push({ place: `players.kpi.${k}`, en: en.players.kpi[k], it: itCat.players.kpi[k] });
  }
  for (const k of ['players', 'avgSkill'] as const) {
    out.push({ place: `teams.statsRow.${k}`, en: en.teams.statsRow[k], it: itCat.teams.statsRow[k] });
  }
  for (const k of ['roster', 'calendar', 'matches', 'stats', 'plan', 'physical', 'settings'] as const) {
    out.push({ place: `teams.page.tabs.${k}`, en: en.teams.page.tabs[k], it: itCat.teams.page.tabs[k] });
  }
  for (const k of ['skills', 'matches', 'physical', 'plan', 'contact', 'privacy'] as const) {
    out.push({ place: `players.card.sections.${k}`, en: en.players.card.sections[k], it: itCat.players.card.sections[k] });
  }
  for (const k of ['record', 'sideOut', 'breakPoint', 'attackEff', 'receptionPos', 'acesServeErrors', 'oppErrors'] as const) {
    out.push({ place: `teams.stats.${k}`, en: en.teams.stats[k], it: itCat.teams.stats[k] });
  }
  for (const k of ['tabCourt', 'tabLive', 'tabTimeline', 'tabText', 'dismiss', 'takeBack', 'leave'] as const) {
    out.push({ place: `scout.page.${k}`, en: en.scout.page[k], it: itCat.scout.page[k] });
  }
  for (const k of ['saved', 'saving', 'retry'] as const) {
    out.push({ place: `diagrams.editor.status.${k}`, en: en.diagrams.editor.status[k], it: itCat.diagrams.editor.status[k] });
  }
  out.push({ place: 'scout.rally.timeoutShort', en: en.scout.rally.timeoutShort, it: itCat.scout.rally.timeoutShort });
  return out;
}

describe('Italian label length budget (tight places)', () => {
  it('keeps every tight Italian label within max(English x 1.5, 12) characters', () => {
    const offenders = pairs()
      .filter((p) => p.it.length > budget(p.en))
      .map((p) => `${p.place}: "${p.it}" (${p.it.length} > ${budget(p.en)}, English "${p.en}")`);
    expect(offenders, `Over budget:\n${offenders.join('\n')}`).toEqual([]);
  });
});
