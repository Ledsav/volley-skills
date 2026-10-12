import { describe, expect, it } from 'vitest';
import { GRADE_LABELS, rallyOutcome, SKILL_LABELS, validGrades } from './skillGrades';

describe('skillGrades', () => {
  it('labels every skill', () => {
    expect(SKILL_LABELS.R).toBe('Reception');
    expect(SKILL_LABELS.E).toBe('Set');
  });

  it('hides grades that make no sense for a skill', () => {
    expect(validGrades('S')).toEqual(['#', '+', '-', '/', '=']);
    expect(validGrades('E')).toEqual(['#', '+', '!', '-', '=']);
    expect(validGrades('B')).toEqual(['#', '+', '-', '/', '=']);
    expect(validGrades('A')).toEqual(['#', '+', '!', '-', '/', '=']);
  });

  it('labels grades per skill', () => {
    expect(GRADE_LABELS.A['#']).toBe('Kill');
    expect(GRADE_LABELS.S['#']).toBe('Ace');
    expect(GRADE_LABELS.B['/']).toBe('Tooled');
  });

  it('derives rally outcomes', () => {
    expect(rallyOutcome('S', '#')).toBe('us');
    expect(rallyOutcome('A', '#')).toBe('us');
    expect(rallyOutcome('B', '#')).toBe('us');
    expect(rallyOutcome('R', '#')).toBeNull();
    expect(rallyOutcome('D', '=')).toBe('them');
    expect(rallyOutcome('A', '/')).toBe('them');
    expect(rallyOutcome('B', '/')).toBe('them');
    expect(rallyOutcome('R', '/')).toBeNull();
    expect(rallyOutcome('A', '+')).toBeNull();
  });
});
