import { describe, expect, it } from 'vitest';
import type { Access } from '../auth/access';
import { actionItems, goToItems, teamActionPath } from './localSources';

const none: Access = { isClubAdmin: false, sections: { exercises: false, trainings: false, guides: false } };

describe('localSources', () => {
  it('member with no sections', () => {
    expect(goToItems(none, false).map((i) => i.id)).toEqual(['/', '/teams', '/settings']);
    expect(actionItems(none, true)).toEqual([]);
  });

  it('club admin gets New team', () => {
    const admin: Access = { isClubAdmin: true, sections: { exercises: true, trainings: true, guides: true } };
    expect(actionItems(admin, false, true).map((i) => i.id)).toEqual(['new-team', 'new-training', 'new-exercise', 'new-match', 'add-player']);
    // A club with no teams: nothing to pick, so no team-picker actions.
    expect(actionItems(admin, false, false).map((i) => i.id)).toEqual(['new-team', 'new-training', 'new-exercise']);
    expect(goToItems(admin, false).map((i) => i.id)).toContain('/club');
  });

  it('section admin gets New training but not New team', () => {
    const trainer: Access = { isClubAdmin: false, sections: { exercises: false, trainings: true, guides: false } };
    expect(actionItems(trainer, false).map((i) => i.id)).toEqual(['new-training']);
  });

  it('a team admin gets the team-picker actions', () => {
    const items = actionItems(none, false, true);
    expect(items.map((i) => i.id)).toEqual(['new-match', 'add-player']);
    expect(items.every((i) => i.pick === 'team')).toBe(true);
  });

  it('new-session lands on the team calendar', () => {
    expect(teamActionPath('new-session', 't1')).toBe('/teams/t1?tab=calendar');
    expect(teamActionPath('add-player', 't1')).toBe('/teams/t1?tab=roster');
    expect(teamActionPath('new-match', 't1')).toBe('/teams/t1?tab=matches');
  });
});
