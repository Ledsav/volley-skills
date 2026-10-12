import { GRADES, type Grade, type Side, type Skill } from '../types/match';

export const SKILL_LABELS: Record<Skill, string> = {
  S: 'Serve',
  R: 'Reception',
  A: 'Attack',
  B: 'Block',
  D: 'Dig',
  E: 'Set',
  F: 'Free ball',
};

/** DataVolley grades with a per-skill meaning. A missing key = grade not offered. */
export const GRADE_LABELS: Record<Skill, Partial<Record<Grade, string>>> = {
  S: { '#': 'Ace', '+': 'Pressure', '-': 'Easy', '/': 'Free back', '=': 'Error' },
  R: { '#': 'Perfect', '+': 'Good', '!': 'OK', '-': 'Poor', '/': 'Overpass', '=': 'Aced' },
  A: { '#': 'Kill', '+': 'Good', '!': 'Covered', '-': 'Easy dig', '/': 'Blocked', '=': 'Error' },
  B: { '#': 'Stuff', '+': 'Touch ours', '-': 'Touch theirs', '/': 'Tooled', '=': 'Net' },
  D: { '#': 'Perfect', '+': 'Good', '!': 'OK', '-': 'Poor', '/': 'Overpass', '=': 'Error' },
  E: { '#': 'Perfect', '+': 'Good', '!': 'OK', '-': 'Poor', '=': 'Error' },
  F: { '#': 'Perfect', '+': 'Good', '!': 'OK', '-': 'Poor', '/': 'Overpass', '=': 'Error' },
};

export function validGrades(skill: Skill): Grade[] {
  return GRADES.filter((g) => GRADE_LABELS[skill][g] !== undefined);
}

/** Who wins the rally because of this action, or null if the rally continues. */
export function rallyOutcome(skill: Skill, grade: Grade): Side | null {
  if (grade === '#' && (skill === 'S' || skill === 'A' || skill === 'B')) return 'us';
  if (grade === '=') return 'them';
  if (grade === '/' && (skill === 'A' || skill === 'B')) return 'them';
  return null;
}
