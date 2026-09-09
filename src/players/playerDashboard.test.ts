import { describe, expect, it } from 'vitest';
import {
  focusAreaKeys,
  nextObjective,
  openObjectiveCount,
  latestTestDate,
  ratedSkillCount,
} from './playerDashboard';
import type { DevelopmentPlan } from '../types/developmentPlan';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';
import type { Skills } from '../types/player';

function makeSkills(overrides: Partial<Record<keyof Skills, boolean>> = {}): Skills {
  const keys: (keyof Skills)[] = ['serve', 'attack', 'set', 'defence', 'reception', 'jump', 'speed', 'iq'];
  return Object.fromEntries(
    keys.map((key) => [key, { score: null, notes: '', priority: overrides[key] ?? false }])
  ) as Skills;
}

const emptyPlan: DevelopmentPlan = { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' };

describe('focusAreaKeys', () => {
  it('returns the flagged skills in canonical skill order', () => {
    const skills = makeSkills({ iq: true, serve: true, defence: true });
    expect(focusAreaKeys(skills)).toEqual(['serve', 'defence', 'iq']);
  });

  it('returns an empty array when nothing is flagged', () => {
    expect(focusAreaKeys(makeSkills())).toEqual([]);
  });
});

describe('ratedSkillCount', () => {
  it('counts skills that have a numeric score', () => {
    const skills = makeSkills();
    skills.serve.score = 6;
    skills.attack.score = 0;
    expect(ratedSkillCount(skills)).toBe(2);
  });

  it('is zero when nothing has been rated', () => {
    expect(ratedSkillCount(makeSkills())).toBe(0);
  });
});

describe('nextObjective', () => {
  it('returns the earliest-dated objective that is not Completed', () => {
    const plan: DevelopmentPlan = {
      ...emptyPlan,
      shortTermObjectives: [
        { objective: 'Later', targetDate: '2026-12-01', status: 'Not started', coachComment: '' },
        { objective: 'Sooner', targetDate: '2026-10-01', status: 'In progress', coachComment: '' },
        { objective: 'Done early', targetDate: '2026-09-01', status: 'Completed', coachComment: '' },
      ],
    };
    expect(nextObjective(plan)?.objective).toBe('Sooner');
  });

  it('sorts objectives with no target date after dated ones', () => {
    const plan: DevelopmentPlan = {
      ...emptyPlan,
      shortTermObjectives: [
        { objective: 'No date', targetDate: '', status: 'Not started', coachComment: '' },
        { objective: 'Dated', targetDate: '2027-01-01', status: 'Not started', coachComment: '' },
      ],
    };
    expect(nextObjective(plan)?.objective).toBe('Dated');
  });

  it('returns null when every objective is Completed', () => {
    const plan: DevelopmentPlan = {
      ...emptyPlan,
      shortTermObjectives: [{ objective: 'Done', targetDate: '2026-10-01', status: 'Completed', coachComment: '' }],
    };
    expect(nextObjective(plan)).toBeNull();
  });

  it('returns null for an empty plan', () => {
    expect(nextObjective(emptyPlan)).toBeNull();
  });
});

describe('openObjectiveCount', () => {
  it('counts short-term and season objectives that are not Completed', () => {
    const plan: DevelopmentPlan = {
      shortTermObjectives: [
        { objective: 'a', targetDate: '', status: 'Not started', coachComment: '' },
        { objective: 'b', targetDate: '', status: 'Completed', coachComment: '' },
      ],
      seasonObjectives: [
        { objective: 'c', target: '', status: 'In progress', coachComment: '' },
        { objective: 'd', target: '', status: 'Attention', coachComment: '' },
      ],
      generalNotes: '',
    };
    expect(openObjectiveCount(plan)).toBe(3);
  });
});

describe('latestTestDate', () => {
  it('returns the most recent date across all recorded test types', () => {
    const latestByType: Partial<Record<PhysicalTestType, PhysicalTest | null>> = {
      cmj: { id: '1', date: '2026-05-01', testType: 'cmj', attemptsCm: [], bestCm: 40, notes: '', recordedBy: 'x', createdAt: null },
      sprint10m: {
        id: '2',
        date: '2026-08-20',
        testType: 'sprint10m',
        attemptsSeconds: [],
        bestSeconds: 1.9,
        notes: '',
        recordedBy: 'x',
        createdAt: null,
      },
      growth: null,
    };
    expect(latestTestDate(latestByType)).toBe('2026-08-20');
  });

  it('returns null when no tests are recorded', () => {
    expect(latestTestDate({ growth: null, cmj: null })).toBeNull();
  });
});
