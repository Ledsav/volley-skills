import { describe, expect, it } from 'vitest';
import { PRESETS } from './cardTheme';
import { CARD_H, CARD_W, drawAwardCard, drawTitleCard, type CardModel } from './drawAwardCard';
import { recordingCtx } from './testCtx';

const card: CardModel = {
  key: 'mvp', awardTitle: 'MVP', name: 'Lena P.', number: 12, statLine: '6.2 MVP pts', footer: 'vs Rivals · 12 Oct 2026', teamName: 'U17 Girls', clubName: 'Demo VC', note: '',
};
const fakeImage = { width: 800, height: 600 } as unknown as ImageBitmap;

describe('drawAwardCard', () => {
  it('at t=1 draws title, name, stat line, footer, team name', () => {
    const { ctx, texts } = recordingCtx();
    drawAwardCard(ctx, card, PRESETS[0], { photo: null, background: null }, 1);
    const all = texts();
    for (const s of ['MVP', 'Lena P.', '6.2 MVP pts', 'vs Rivals · 12 Oct 2026', 'DEMO VC', 'U17 GIRLS']) expect(all).toContain(s);
  });

  it('omits the club line when the team has no club', () => {
    const { ctx, texts } = recordingCtx();
    drawAwardCard(ctx, { ...card, clubName: '  ' }, PRESETS[0], { photo: null, background: null }, 1);
    expect(texts()).toContain('U17 GIRLS');
    expect(texts()).not.toContain('');
  });

  it('draws the jersey number when there is no photo, the photo otherwise', () => {
    const a = recordingCtx();
    drawAwardCard(a.ctx, card, PRESETS[0], { photo: null, background: null }, 1);
    expect(a.texts()).toContain('12');
    expect(a.calls.some((c) => c.method === 'drawImage')).toBe(false);

    const b = recordingCtx();
    drawAwardCard(b.ctx, card, PRESETS[0], { photo: fakeImage, background: null }, 1);
    expect(b.texts()).not.toContain('12');
    expect(b.calls.filter((c) => c.method === 'drawImage')).toHaveLength(1);
  });

  it('a background image is drawn cover-fit with a scrim', () => {
    const { ctx, calls } = recordingCtx();
    drawAwardCard(ctx, card, PRESETS[0], { photo: null, background: fakeImage }, 1);
    const draw = calls.find((c) => c.method === 'drawImage')!;
    // 800×600 into 1080×1920 cover → scale 3.2 → 2560×1920, centred: x = (1080-2560)/2
    expect(draw.args.slice(1)).toEqual([(CARD_W - 2560) / 2, 0, 2560, CARD_H]);
    expect(calls.some((c) => c.method === 'set:fillStyle' && c.args[0] === 'rgba(0,0,0,0.45)')).toBe(true);
  });

  it('is deterministic for the same t', () => {
    const a = recordingCtx(), b = recordingCtx();
    drawAwardCard(a.ctx, card, PRESETS[1], { photo: null, background: null }, 0.93);
    drawAwardCard(b.ctx, card, PRESETS[1], { photo: null, background: null }, 0.93);
    expect(a.calls).toEqual(b.calls);
  });

  it('at t=0 nothing but the background is visible', () => {
    const { ctx, texts } = recordingCtx();
    drawAwardCard(ctx, card, PRESETS[0], { photo: null, background: null }, 0);
    expect(texts()).toEqual([]);
  });

  it('omits the stat line when null and shows the note for custom awards', () => {
    const { ctx, texts } = recordingCtx();
    drawAwardCard(ctx, { ...card, statLine: null, note: 'Always cheering' }, PRESETS[0], { photo: null, background: null }, 1);
    expect(texts()).toContain('Always cheering');
    expect(texts()).not.toContain('6.2 MVP pts');
  });

  it('title card shows only the award title', () => {
    const { ctx, texts } = recordingCtx();
    drawTitleCard(ctx, 'Best server', PRESETS[0], { photo: null, background: null }, 0.5);
    expect(texts()).toContain('Best server');
    expect(texts()).not.toContain('Lena P.');
  });
});
