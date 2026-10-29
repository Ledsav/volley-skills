import { describe, expect, it } from 'vitest';
import { PRESET_PALETTES, slideColors } from '../palette';
import { CARD_H, CARD_W, drawAwardCard, drawTitleCard, type CardModel } from './drawAwardCard';
import { recordingCtx } from './testCtx';
import { SPONSOR_ROW } from './branding';

const card: CardModel = {
  key: 'mvp', awardTitle: 'MVP', name: 'Lena P.', number: 12, statLine: '6.2 MVP pts', footer: 'vs Rivals · 12 Oct 2026', teamName: 'U17 Girls', clubName: 'Demo VC', note: '',
};
const NAVY = PRESET_PALETTES.find((p) => p.id === 'navy')!;
const colors = slideColors(NAVY, 0);
const colors2 = slideColors(PRESET_PALETTES.find((p) => p.id === 'gold')!, 0);
const fakeImage = { width: 800, height: 600 } as unknown as ImageBitmap;

describe('drawAwardCard', () => {
  it('at t=1 draws one header row (club · team | match), title, name and stat', () => {
    const { ctx, texts } = recordingCtx();
    drawAwardCard(ctx, card, colors, { photo: null, cutout: null, background: null }, 1);
    const all = texts();
    for (const s of ['DEMO VC · U17 GIRLS', 'VS RIVALS · 12 OCT 2026', 'MVP', 'Lena P.', '6.2 MVP pts']) expect(all).toContain(s);
  });

  it('header shows only the team when the team has no club', () => {
    const { ctx, texts } = recordingCtx();
    drawAwardCard(ctx, { ...card, clubName: '  ' }, colors, { photo: null, cutout: null, background: null }, 1);
    expect(texts()).toContain('U17 GIRLS');
    expect(texts().some((t) => t.includes('·') && t.includes('U17'))).toBe(false);
  });

  it('name and stat share one row (less vertical stacking)', () => {
    const { ctx, calls } = recordingCtx();
    drawAwardCard(ctx, card, colors, { photo: null, cutout: null, background: null }, 1);
    const y = (s: string) => calls.find((c) => c.method === 'fillText' && c.args[0] === s)!.args[2];
    expect(y('Lena P.')).toBe(y('6.2 MVP pts'));
  });

  it('with sponsors, neither text nor the player enters the sponsor row, and every sponsor is drawn there', () => {
    const cut = { width: 600, height: 900 } as unknown as ImageBitmap;
    const logo = { width: 400, height: 120 } as unknown as ImageBitmap;
    const branding = { clubLogo: null, sponsors: [logo, logo, logo], mono: false };
    const long = { ...card, name: 'Maximiliana Alexandrovna-Kowalczyk', statLine: 'Always first in the gym and last to leave, every day' };
    for (const art of [{ photo: null, cutout: cut, background: null, branding }, { photo: fakeImage, cutout: null, background: null, branding }]) {
      const { ctx, calls } = recordingCtx();
      drawAwardCard(ctx, long, colors, art, 1);
      for (const c of calls.filter((c) => c.method === 'fillText')) expect(c.args[2] as number).toBeLessThan(SPONSOR_ROW.divider);
      const player = calls.find((c) => c.method === 'drawImage' && c.args[0] !== logo)!;
      if (art.cutout) expect((player.args[6] as number) + (player.args[8] as number)).toBeLessThan(SPONSOR_ROW.divider);
      expect(calls.filter((c) => c.method === 'drawImage' && c.args[0] === logo)).toHaveLength(3);
    }
  });

  it('draws the jersey number when there is no photo, the photo otherwise', () => {
    const a = recordingCtx();
    drawAwardCard(a.ctx, card, colors, { photo: null, cutout: null, background: null }, 1);
    expect(a.texts()).toContain('12');
    expect(a.calls.some((c) => c.method === 'drawImage')).toBe(false);

    const b = recordingCtx();
    drawAwardCard(b.ctx, card, colors, { photo: fakeImage, cutout: null, background: null }, 1);
    expect(b.texts()).not.toContain('12');
    expect(b.calls.filter((c) => c.method === 'drawImage')).toHaveLength(1);
  });

  it('a background image is drawn cover-fit as a translucent texture', () => {
    const { ctx, calls } = recordingCtx();
    drawAwardCard(ctx, card, colors, { photo: null, cutout: null, background: fakeImage }, 1);
    const draw = calls.find((c) => c.method === 'drawImage')!;
    // 800×600 into 1080×1920 cover → scale 3.2 → 2560×1920, centred: x = (1080-2560)/2
    expect(draw.args.slice(1)).toEqual([(CARD_W - 2560) / 2, 0, 2560, CARD_H]);
    expect(calls.some((c) => c.method === 'set:globalAlpha' && c.args[0] === 0.35)).toBe(true);
  });

  it('shows the whole cut-out player: nothing is painted over it and the text sits below it', () => {
    const cut = { width: 600, height: 900 } as unknown as ImageBitmap;
    const { ctx, calls } = recordingCtx();
    drawAwardCard(ctx, card, colors, { photo: null, cutout: cut, background: null }, 1);
    const draws = calls.filter((c) => c.method === 'drawImage' && c.args[0] === cut).map((c) => c.args as number[]);
    const y = Math.min(...draws.map((d) => d[6]));
    const bottom = Math.max(...draws.map((d) => d[6] + d[8]));
    expect(bottom - y).toBeGreaterThan(CARD_H * 0.45); // still poster-sized
    // the source is covered top to bottom, with no gaps between the pieces
    const src = draws.map((d) => [d[2], d[2] + d[4]]).sort((p, q) => p[0] - q[0]);
    expect(src[0][0]).toBe(0);
    src.slice(1).forEach((p, i) => expect(p[0]).toBeCloseTo(src[i][1], 6));
    expect(src[src.length - 1][1]).toBeCloseTo(900, 6);
    // the bottom edge fades by drawing the player itself more transparent, not by painting
    // a slide-coloured band over it (that showed as a rectangle on textured backgrounds)
    const last = calls.map((c) => c.method === 'drawImage' && c.args[0] === cut).lastIndexOf(true);
    for (const c of calls.slice(last + 1).filter((c) => c.method === 'fillRect')) {
      const [, fy, , fh] = c.args as number[];
      expect(Math.max(0, Math.min(bottom, fy + fh) - Math.max(y, fy))).toBe(0);
    }
    // the winner's name is drawn below the player, not on top of it
    const nameCall = calls.find((c) => c.method === 'fillText' && c.args[0] === 'Lena P.')!;
    expect(nameCall.args[2] as number).toBeGreaterThan(bottom);
    expect(calls.some((c) => c.method === 'clip')).toBe(false); // no photo circle
  });


  it('is deterministic for the same t', () => {
    const a = recordingCtx(), b = recordingCtx();
    drawAwardCard(a.ctx, card, colors2, { photo: null, cutout: null, background: null }, 0.93);
    drawAwardCard(b.ctx, card, colors2, { photo: null, cutout: null, background: null }, 0.93);
    expect(a.calls).toEqual(b.calls);
  });

  it('at t=0 nothing but the background is visible', () => {
    const { ctx, texts } = recordingCtx();
    drawAwardCard(ctx, card, colors, { photo: null, cutout: null, background: null }, 0);
    expect(texts()).toEqual([]);
  });

  it('omits the stat line when null and shows the note for custom awards', () => {
    const { ctx, texts } = recordingCtx();
    drawAwardCard(ctx, { ...card, statLine: null, note: 'Always cheering' }, colors, { photo: null, cutout: null, background: null }, 1);
    expect(texts()).toContain('Always cheering');
    expect(texts()).not.toContain('6.2 MVP pts');
  });

  it('title card shows only the award title', () => {
    const { ctx, texts } = recordingCtx();
    drawTitleCard(ctx, 'Best server', colors, { photo: null, cutout: null, background: null }, 0.5);
    expect(texts()).toContain('Best server');
    expect(texts()).not.toContain('Lena P.');
  });
});
