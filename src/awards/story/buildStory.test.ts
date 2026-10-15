// src/awards/story/buildStory.test.ts
import { describe, expect, it } from 'vitest';
import type { StoryStat } from './storyStats';
import { buildStory, colorIndexForAward, sceneProgress } from './buildStory';

const stat = (id: StoryStat['id']): StoryStat => ({ id, kicker: id, big: 1, bigSuffix: '', caption: '', detail: null });
const base = { introTitle: 'Season 2026-27', teamName: 'U17', stats: [stat('record'), stat('strength')], awardCount: 2, includeStory: true };

describe('buildStory', () => {
  it('orders intro, stats, three steps per award, summary — one colour per scene', () => {
    const s = buildStory(base);
    expect(s.map((x) => x.kind)).toEqual([
      'intro', 'stat', 'stat',
      'awardTitle', 'awardSuspense', 'awardReveal',
      'awardTitle', 'awardSuspense', 'awardReveal',
      'summary',
    ]);
    expect(s.map((x) => x.colorIndex)).toEqual([0, 1, 2, 3, 3, 3, 4, 4, 4, 5]);
  });

  it('toggle off leaves only awards and summary', () => {
    expect(buildStory({ ...base, includeStory: false }).map((x) => x.kind)).toEqual([
      'awardTitle', 'awardSuspense', 'awardReveal', 'awardTitle', 'awardSuspense', 'awardReveal', 'summary',
    ]);
  });

  it('zero awards: story only, no summary', () => {
    expect(buildStory({ ...base, awardCount: 0 }).map((x) => x.kind)).toEqual(['intro', 'stat', 'stat']);
  });

  it('finds the colour an award is revealed in (for matching exports)', () => {
    const s = buildStory(base);
    expect(colorIndexForAward(s, 1)).toBe(4);
    expect(colorIndexForAward(s, 9)).toBe(0);
  });

  it('reports progress per scene, with partial progress inside an award', () => {
    const s = buildStory(base);
    expect(sceneProgress(s, 0)).toEqual({ scenes: 6, current: 0, fraction: 1 });
    expect(sceneProgress(s, 4)).toEqual({ scenes: 6, current: 3, fraction: 2 / 3 });
  });
});
