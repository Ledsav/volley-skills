// src/awards/card/drawSlide.test.ts
import { describe, expect, it } from 'vitest';
import { PRESET_PALETTES } from '../palette';
import { buildStory } from '../story/buildStory';
import type { StoryStat } from '../story/storyStats';
import type { CardModel } from './drawAwardCard';
import { renderStoryFrame, slideDurationMs, type StoryDeps } from './drawSlide';
import { CARD_H } from './drawAwardCard';
import { recordingCtx } from './testCtx';

const model = (key: string, name: string): CardModel => ({ key, awardTitle: key, name, number: 7, statLine: null, footer: 'Season 2026-27', teamName: 'U17', clubName: 'Demo VC', note: '' });
const deps: StoryDeps = {
  palette: PRESET_PALETTES[0],
  cards: [{ key: 'mvp', title: 'MVP', model: model('mvp', 'Ana L.') }, { key: 'server', title: 'Best server', model: model('server', 'Bea S.') }],
  artFor: () => ({ photo: null, cutout: null, background: null }),
  clubName: 'Demo VC',
};
const stat: StoryStat = { id: 'strength', kicker: 'Side-out', big: 68, bigSuffix: '%', caption: 'of rallies won on the opponent’s serve', detail: null };
const slides = buildStory({ introTitle: 'Season 2026-27', teamName: 'U17', stats: [stat], awardCount: 2, includeStory: true });

describe('renderStoryFrame', () => {
  it('intro: every word of the title and the team name at the end', () => {
    const { ctx, texts } = recordingCtx();
    const done = renderStoryFrame(ctx, slides, 0, 10_000, deps, false, null);
    expect(done).toBe(true);
    expect(texts()).toEqual(expect.arrayContaining(['Season', '2026-27', 'U17']));
  });

  it('stat: counts up from 0 to the final number', () => {
    const early = recordingCtx();
    renderStoryFrame(early.ctx, slides, 1, 0, deps, false, null);
    expect(early.texts()).toContain('0%');
    const late = recordingCtx();
    renderStoryFrame(late.ctx, slides, 1, 10_000, deps, false, null);
    expect(late.texts()).toEqual(expect.arrayContaining(['SIDE-OUT', '68%']));
  });

  it('long caption wraps into several lines inside the card', () => {
    const { ctx, calls } = recordingCtx();
    renderStoryFrame(ctx, slides, 1, 10_000, deps, false, null);
    const captionLines = calls.filter((c) => c.method === 'fillText' && /rallies|serve/.test(String(c.args[0])));
    expect(captionLines.length).toBeGreaterThan(1);
  });

  it('reduced motion draws the final frame immediately', () => {
    const { ctx, texts } = recordingCtx();
    const done = renderStoryFrame(ctx, slides, 1, 0, deps, true, null);
    expect(done).toBe(true);
    expect(texts()).toContain('68%');
  });

  it('suspense never reports done (it pulses) unless motion is reduced', () => {
    const suspense = slides.findIndex((s) => s.kind === 'awardSuspense');
    expect(renderStoryFrame(recordingCtx().ctx, slides, suspense, 99_999, deps, false, null)).toBe(false);
    expect(renderStoryFrame(recordingCtx().ctx, slides, suspense, 0, deps, true, null)).toBe(true);
  });

  it('reveal shows the winner name; summary lists every winner and award', () => {
    const reveal = recordingCtx();
    renderStoryFrame(reveal.ctx, slides, slides.findIndex((s) => s.kind === 'awardReveal'), 10_000, deps, false, null);
    expect(reveal.texts()).toContain('Ana L.');
    const summary = recordingCtx();
    renderStoryFrame(summary.ctx, slides, slides.length - 1, 10_000, deps, false, null);
    expect(summary.texts()).toEqual(expect.arrayContaining(['Winners', 'Ana L.', 'Bea S.', 'MVP', 'Best server']));
  });

  it('wipes from the previous colour during the first 250 ms, not after', () => {
    const during = recordingCtx();
    expect(renderStoryFrame(during.ctx, slides, 1, 100, deps, false, 0)).toBe(false);
    const fillsDuring = during.calls.filter((c) => c.method === 'set:fillStyle').map((c) => c.args[0]);
    expect(fillsDuring).toContain(PRESET_PALETTES[0].colors[0]); // intro background still visible
  });

  it('durations: suspense is open-ended, summary grows with the number of winners', () => {
    expect(slideDurationMs(slides[1], 2)).toBeGreaterThan(0);
    expect(slideDurationMs({ kind: 'summary', colorIndex: 0 }, 10)).toBeGreaterThan(slideDurationMs({ kind: 'summary', colorIndex: 0 }, 2));
  });
});

/** Text lines wider than the 920px text area, or drawn below the card (recordingCtx measures 0.55 em/char). */
function overflows(calls: { method: string; args: unknown[] }[]): string[] {
  let size = 10;
  const bad: string[] = [];
  for (const c of calls) {
    if (c.method === 'set:font') size = Number(/(\d+(?:\.\d+)?)px/.exec(String(c.args[0]))?.[1] ?? size);
    if (c.method === 'fillText') {
      const s = String(c.args[0]);
      const y = c.args[2] as number;
      if (s.length * size * 0.55 > 921 || y > CARD_H) bad.push(`${s} @${size}px y=${y}`);
    }
  }
  return bad;
}

describe('long text never leaves the card', () => {
  const long = (key: string): CardModel => ({
    key, awardTitle: 'Most improved player of the whole season', name: 'Maximiliana Alexandrovna-Kowalczyk', number: 12,
    statLine: null, note: 'Always first in the gym and last to leave, cheering on every single teammate all year',
    footer: 'vs Volleyball Club Grand-Duché Esch-sur-Alzette Ladies · 12 Oct 2026', teamName: 'U17 Girls', clubName: 'Demo VC',
  });
  const longDeps: StoryDeps = { ...deps, cards: [{ key: 'x', title: 'Most improved player of the whole season', model: long('x') }] };
  const longStat: StoryStat = { id: 'record', kicker: 'Final score — a long day at the office', big: 3, bigSuffix: '–2', caption: 'vs Volleyball Club Grand-Duché Esch-sur-Alzette Ladies', detail: '25–23 · 23–25 · 25–27 · 25–21 · 15–13 · after a very long fight' };
  const longSlides = buildStory({ introTitle: 'vs Volleyball Club Grand-Duché Esch sur Alzette Ladies Team', teamName: 'Seniors Dames Nationale 1 — Promotion League Squad', stats: [longStat], awardCount: 1, includeStory: true });

  it('every slide, fully drawn, keeps each text line inside the text area and on the card', () => {
    longSlides.forEach((_, i) => {
      const { ctx, calls } = recordingCtx();
      renderStoryFrame(ctx, longSlides, i, 1e9, longDeps, true, null);
      expect(overflows(calls), `slide ${i} (${longSlides[i].kind})`).toEqual([]);
    });
  });
});
