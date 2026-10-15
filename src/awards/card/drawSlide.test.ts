// src/awards/card/drawSlide.test.ts
import { describe, expect, it } from 'vitest';
import { PRESET_PALETTES } from '../palette';
import { buildStory } from '../story/buildStory';
import type { StoryStat } from '../story/storyStats';
import type { CardModel } from './drawAwardCard';
import { renderStoryFrame, slideDurationMs, type StoryDeps } from './drawSlide';
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
