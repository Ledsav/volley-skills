import { describe, expect, it } from 'vitest';
import { goToDestinations, navGroups, phoneTabs } from './navModel';
import type { Access } from '../auth/access';

const all: Access = { isClubAdmin: true, sections: { exercises: true, trainings: true, guides: true } };
const coach: Access = { isClubAdmin: false, sections: { exercises: true, trainings: false, guides: false } };

const shape = (groups: ReturnType<typeof navGroups>) =>
  groups.map((g) => [g.label, g.items.map((i) => `${i.label} ${i.to}`)]);

describe('navGroups', () => {
  it('puts every destination in exactly one group, by who it is for', () => {
    expect(shape(navGroups(all, true))).toEqual([
      [null, ['Today /']],
      ['Coaching', ['Teams /teams', 'Trainings /trainings', 'Exercises /exercises']],
      ['Club', ['Guides /admin/guides', 'Members & settings /club']],
      ['Platform', ['Clubs & sign-ups /platform']],
    ]);
    const paths = navGroups(all, true).flatMap((g) => g.items.map((i) => i.to));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('shows a coach only the sections granted, and no empty groups', () => {
    expect(shape(navGroups(coach, false))).toEqual([
      [null, ['Today /']],
      ['Coaching', ['Teams /teams', 'Exercises /exercises']],
    ]);
  });

  it('gives the platform group to a platform admin even without club access', () => {
    expect(shape(navGroups(null, true)).map(([label]) => label)).toEqual([null, 'Coaching', 'Platform']);
  });
});

describe('Today and Go to', () => {
  it('labels the first item Today', () => {
    const first = navGroups(all, false)[0].items[0];
    expect(first.label).toBe('Today');
    expect(first.to).toBe('/');
  });

  it('goToDestinations ends with Settings and repeats no path', () => {
    const paths = goToDestinations(all, true).map((i) => i.to);
    expect(paths).toEqual(['/', '/teams', '/trainings', '/exercises', '/admin/guides', '/club', '/platform', '/settings']);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('phoneTabs', () => {
  it('keeps Home and the coaching pages on the bar and sends the rest to More', () => {
    expect(phoneTabs(all, true).map((i) => i.label)).toEqual(['Today', 'Teams', 'Trainings', 'Exercises']);
    expect(phoneTabs(coach, false).map((i) => i.label)).toEqual(['Today', 'Teams', 'Exercises']);
  });
});
