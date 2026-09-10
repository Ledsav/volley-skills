import type { DevelopmentPlan, ShortTermObjective } from '../types/developmentPlan';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';
import { SKILL_KEYS, type SkillKey, type Skills } from '../types/player';

/** Skills flagged as a focus area (priority), in canonical skill order. */
export function focusAreaKeys(skills: Skills): SkillKey[] {
  return SKILL_KEYS.filter((key) => skills[key]?.priority);
}

/** How many of the skills have a numeric score recorded. */
export function ratedSkillCount(skills: Skills): number {
  return SKILL_KEYS.filter((key) => skills[key]?.score != null).length;
}

/**
 * The objective a coach should look at next: the first short-term objective
 * that isn't Completed, ordered by target date. Objectives with no target date
 * sort after dated ones. Returns null when every objective is done or the list
 * is empty.
 */
export function nextObjective(plan: DevelopmentPlan): ShortTermObjective | null {
  const open = plan.shortTermObjectives.filter((objective) => objective.status !== 'Completed');
  if (open.length === 0) return null;
  const sorted = [...open].sort((a, b) => {
    if (!a.targetDate) return 1;
    if (!b.targetDate) return -1;
    return a.targetDate.localeCompare(b.targetDate);
  });
  return sorted[0];
}

/** Count of short-term and season objectives that are not yet Completed. */
export function openObjectiveCount(plan: DevelopmentPlan): number {
  const all = [...plan.shortTermObjectives, ...plan.seasonObjectives];
  return all.filter((objective) => objective.status !== 'Completed').length;
}

/** Most recent test date across all recorded test types, or null when there are none. */
export function latestTestDate(
  latestByType: Partial<Record<PhysicalTestType, PhysicalTest | null>>
): string | null {
  const dates = Object.values(latestByType)
    .filter((test): test is PhysicalTest => test != null)
    .map((test) => test.date);
  if (dates.length === 0) return null;
  return dates.reduce((latest, date) => (date > latest ? date : latest));
}
