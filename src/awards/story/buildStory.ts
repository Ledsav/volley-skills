// src/awards/story/buildStory.ts
import type { StoryStat } from './storyStats';

export type Slide =
  | { kind: 'intro'; colorIndex: number; title: string; subtitle: string }
  | { kind: 'stat'; colorIndex: number; stat: StoryStat }
  | { kind: 'awardTitle' | 'awardSuspense' | 'awardReveal'; colorIndex: number; awardIndex: number }
  | { kind: 'summary'; colorIndex: number };

interface StoryInput { introTitle: string; teamName: string; stats: StoryStat[]; awardCount: number; includeStory: boolean }

/** The full presentation: optional story, three steps per award, then a summary. One palette colour per scene. */
export function buildStory(i: StoryInput): Slide[] {
  const out: Slide[] = [];
  let color = 0;
  if (i.includeStory) {
    out.push({ kind: 'intro', colorIndex: color++, title: i.introTitle, subtitle: i.teamName });
    for (const stat of i.stats) out.push({ kind: 'stat', colorIndex: color++, stat });
  }
  for (let a = 0; a < i.awardCount; a++) {
    const c = color++;
    out.push({ kind: 'awardTitle', colorIndex: c, awardIndex: a }, { kind: 'awardSuspense', colorIndex: c, awardIndex: a }, { kind: 'awardReveal', colorIndex: c, awardIndex: a });
  }
  if (i.awardCount > 0) out.push({ kind: 'summary', colorIndex: color++ });
  return out;
}

export function colorIndexForAward(slides: Slide[], awardIndex: number): number {
  const s = slides.find((x) => x.kind === 'awardReveal' && x.awardIndex === awardIndex);
  return s ? s.colorIndex : 0;
}

/** Progress-bar state: one segment per scene (colour); an award's three steps fill its segment in thirds. */
export function sceneProgress(slides: Slide[], index: number): { scenes: number; current: number; fraction: number } {
  const scenes = new Set(slides.map((s) => s.colorIndex)).size;
  const slide = slides[index];
  if (!slide) return { scenes, current: 0, fraction: 0 };
  const sameScene = slides.filter((s) => s.colorIndex === slide.colorIndex);
  const step = sameScene.indexOf(slide) + 1;
  return { scenes, current: slide.colorIndex, fraction: step / sameScene.length };
}
