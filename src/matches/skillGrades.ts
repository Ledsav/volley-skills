import { GRADES, type Grade, type PointReason, type Side, type Skill } from '../types/match';
import { labels as enLabels } from '../i18n/en/labels';
import { getT } from '../i18n/I18nProvider';

/**
 * English labels, kept as the text-scout protocol vocabulary and for tests. UI text reads the
 * active catalog instead (`labelSkill`, `labelGrade`, or `useT().labels`).
 */
export const SKILL_LABELS = enLabels.skill;
export const GRADE_LABELS = enLabels.grade;

/** The active-language label of a skill, for code outside components. */
export function labelSkill(skill: Skill): string {
  return getT().labels.skill[skill];
}

/** The active-language label of a grade for a skill ('' when the skill has no such grade). */
export function labelGrade(skill: Skill, grade: Grade): string {
  return getT().labels.grade[skill][grade] ?? '';
}

/** Grades offered for a skill; the set never depends on the active language. */
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

/** Point-reason chips per winner, in the order shown (keys 1–4 follow this order). */
export const POINT_REASONS: Record<Side, PointReason[]> = {
  us: ['oppError', 'unknown'],
  them: ['oppKill', 'oppAce', 'oppBlock', 'unknown'],
};
