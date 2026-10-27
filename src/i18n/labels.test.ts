import { describe, expect, it } from 'vitest';
import type { Gender } from './catalog';
import { labels as en } from './en/labels';
import { labels as it_ } from './it/labels';

const GENDERS: Gender[] = ['women', 'men', 'mixed'];

describe('label catalogs', () => {
  it('has an Italian entry for every English key', () => {
    for (const name of Object.keys(en) as (keyof typeof en)[]) {
      expect(Object.keys(it_[name]).sort(), name).toEqual(Object.keys(en[name]).sort());
    }
    for (const skill of Object.keys(en.grade) as (keyof typeof en.grade)[]) {
      expect(Object.keys(it_.grade[skill]).sort(), skill).toEqual(Object.keys(en.grade[skill]).sort());
    }
  });

  it('returns a non-empty string for every plain label', () => {
    const plain = ['skill', 'pointReason', 'playerSkill', 'objectiveStatus', 'exerciseCategory', 'exerciseFocus'] as const;
    for (const name of plain) {
      for (const v of Object.values(it_[name])) expect(v.length).toBeGreaterThan(0);
    }
    for (const grades of Object.values(it_.grade)) for (const v of Object.values(grades)) expect(v.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for every gendered label and gender', () => {
    for (const name of ['position', 'level', 'awardTitle'] as const) {
      for (const catalog of [en, it_]) {
        for (const fn of Object.values(catalog[name]) as ((g: Gender) => string)[]) {
          for (const g of GENDERS) expect(fn(g).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('uses the glossary terms and agrees with the team gender', () => {
    expect(it_.skill.S).toBe('Battuta');
    expect(it_.position.S('women')).toBe('Palleggiatrice');
    expect(it_.position.S('men')).toBe('Palleggiatore');
    expect(it_.position.S('mixed')).toBe('Palleggiatore/trice');
    expect(it_.level.Advanced('men')).toBe('Avanzato');
    expect(it_.level.Advanced('women')).toBe('Avanzata');
  });

  it('English ignores gender', () => {
    expect(en.position.S('women')).toBe(en.position.S('men'));
    expect(en.level.Advanced('women')).toBe('Advanced');
  });
});
