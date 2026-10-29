import { describe, expect, it } from 'vitest';
import { PRESET_PALETTES, slideColors } from '../palette';
import { containRect, contentBottom, drawHeaderRow, drawSponsorRow, knockOutBackground, monoMask, opaqueBounds, SPONSOR_ROW, sponsorLayout, type Branding } from './branding';
import { CARD_W } from './geometry';
import { recordingCtx } from './testCtx';

const NAVY = PRESET_PALETTES.find((p) => p.id === 'navy')!;
const colors = slideColors(NAVY, 0);
const img = (w: number, h: number) => ({ width: w, height: h }) as unknown as ImageBitmap;
const branding = (n: number, clubLogo: ImageBitmap | null = null): Branding => ({ clubLogo, sponsors: Array.from({ length: n }, () => img(400, 100)), mono: false });

describe('branding', () => {
  it('fits a logo inside its box without cropping, centred', () => {
    expect(containRect(400, 100, { x: 0, y: 0, w: 200, h: 100 })).toEqual({ x: 0, y: 25, w: 200, h: 50 });
    expect(containRect(100, 400, { x: 10, y: 0, w: 200, h: 100 })).toEqual({ x: 97.5, y: 0, w: 25, h: 100 });
  });

  it('lays out up to six sponsors in one row, inside the margins, without overlap', () => {
    const shapes = [[900, 160], [600, 600], [360, 620], [1000, 300], [1200, 200], [400, 400]];
    for (let n = 1; n <= 6; n++) {
      const slots = sponsorLayout(shapes.slice(0, n).map(([w, h]) => ({ w, h })));
      expect(slots).toHaveLength(n);
      slots.forEach((s, i) => {
        expect(s.x).toBeGreaterThanOrEqual(60);
        expect(s.x + s.w).toBeLessThanOrEqual(CARD_W - 60);
        expect(s.y).toBeGreaterThanOrEqual(SPONSOR_ROW.top);
        expect(s.y + s.h).toBeLessThanOrEqual(SPONSOR_ROW.top + SPONSOR_ROW.h);
        if (i > 0) expect(s.x).toBeGreaterThanOrEqual(slots[i - 1].x + slots[i - 1].w + 30);
      });
    }
  });

  it('balances logos by visual weight: a wide wordmark gets far more width than a square badge', () => {
    const [wide, square] = sponsorLayout([{ w: 1000, h: 170 }, { w: 500, h: 500 }, { w: 400, h: 400 }, { w: 400, h: 400 }]);
    expect(wide.w).toBeGreaterThan(square.w * 1.8);
    expect(wide.w / wide.h).toBeCloseTo(1000 / 170, 1); // boxes keep the logo's shape
    const area = (b: { w: number; h: number }) => b.w * b.h;
    expect(area(wide) / area(square)).toBeGreaterThan(0.6);
    expect(area(wide) / area(square)).toBeLessThan(2); // text needs a little more area to stay legible
  });

  it('draws one logo per sponsor inside the sponsor row, and nothing without sponsors', () => {
    const { ctx, calls } = recordingCtx();
    drawSponsorRow(ctx, branding(4), colors, 1);
    const draws = calls.filter((c) => c.method === 'drawImage');
    expect(draws).toHaveLength(4);
    for (let i = 1; i < 4; i++) expect(draws[i].args[1] as number).toBeGreaterThan((draws[i - 1].args[1] as number) + (draws[i - 1].args[3] as number));
    for (const d of draws) {
      const [, , y, , h] = d.args as number[];
      expect(y).toBeGreaterThanOrEqual(SPONSOR_ROW.top);
      expect(y + h).toBeLessThanOrEqual(SPONSOR_ROW.top + SPONSOR_ROW.h);
    }
    const none = recordingCtx();
    drawSponsorRow(none.ctx, branding(0), colors, 1);
    expect(none.calls).toHaveLength(0);
  });

  it('gives the card more room when there are no sponsors', () => {
    expect(contentBottom(branding(0))).toBeGreaterThan(contentBottom(branding(2)));
    expect(contentBottom(branding(2))).toBeLessThan(SPONSOR_ROW.top);
  });

  it('header row: the club logo replaces the club name; team and the right-hand text on one row', () => {
    const withLogo = recordingCtx();
    drawHeaderRow(withLogo.ctx, { clubLogo: img(300, 300), clubName: 'Demo VC', teamName: 'U17 Girls', right: 'Season 2026-27' }, colors, 1);
    expect(withLogo.calls.filter((c) => c.method === 'drawImage')).toHaveLength(1);
    expect(withLogo.texts()).toEqual(['U17 GIRLS', 'SEASON 2026-27']);
    const ys = withLogo.calls.filter((c) => c.method === 'fillText').map((c) => c.args[2]);
    expect(new Set(ys).size).toBe(1); // one row, not stacked
    const noLogo = recordingCtx();
    drawHeaderRow(noLogo.ctx, { clubLogo: null, clubName: 'Demo VC', teamName: 'U17 Girls', right: '' }, colors, 1);
    expect(noLogo.texts()).toEqual(['DEMO VC · U17 GIRLS']);
  });

  const rgba = (...p: number[][]) => new Uint8ClampedArray(p.flat());

  it('knocks out a white background so a JPG logo sits on any slide colour', () => {
    // 2×2: white corners except one dark pixel
    const px = rgba([255, 255, 255, 255], [250, 250, 250, 255], [20, 30, 40, 255], [255, 255, 255, 255]);
    expect(knockOutBackground(px, 2, 2)).toBe(true);
    expect([px[3], px[7], px[11], px[15]]).toEqual([0, 0, 255, 0]);
  });

  it('knocks out a solid coloured block behind a logo too, keeping the mark on it', () => {
    // 3×3 navy block with a white centre (the logo's text)
    const navy = [20, 24, 60, 255];
    const px = rgba(navy, navy, navy, navy, [255, 255, 255, 255], [22, 25, 58, 255], navy, navy, navy);
    expect(knockOutBackground(px, 3, 3)).toBe(true);
    expect(Array.from({ length: 9 }, (_, i) => px[i * 4 + 3])).toEqual([0, 0, 0, 0, 255, 0, 0, 0, 0]);
  });

  it('leaves a logo alone when its corners do not share one opaque colour', () => {
    const px = rgba([0, 0, 0, 0], [255, 255, 255, 255], [255, 255, 255, 255], [0, 0, 0, 0]);
    expect(knockOutBackground(px, 2, 2)).toBe(false);
    expect(px[7]).toBe(255);
    const mixed = rgba([255, 0, 0, 255], [0, 0, 255, 255], [0, 255, 0, 255], [255, 255, 255, 255]);
    expect(knockOutBackground(mixed, 2, 2)).toBe(false);
  });

  it('finds the opaque content box so transparent padding does not shrink a logo', () => {
    const t = [0, 0, 0, 0], o = [9, 9, 9, 255];
    // 4×3, content at (1,1)-(2,1)
    expect(opaqueBounds(rgba(t, t, t, t, t, o, o, t, t, t, t, t), 4, 3)).toEqual({ x: 1, y: 1, w: 2, h: 1 });
    expect(opaqueBounds(rgba(t, t), 2, 1)).toBeNull();
  });

  it('single-colour mode keeps the light details inside a dark mark as holes (no solid blobs)', () => {
    // purple hexagon with white letters: purple stays ink, white becomes a hole
    const purple = [110, 60, 200, 255], white = [255, 255, 255, 255];
    const px = rgba(purple, purple, purple, white, purple, purple);
    monoMask(px);
    expect([px[3], px[7], px[11], px[15], px[19]]).toEqual([255, 255, 255, 0, 255]);
  });

  it('single-colour mode keeps a light logo whole (white text after its block was knocked out)', () => {
    const white = [255, 255, 255, 255], yellow = [255, 200, 0, 255], clear = [0, 0, 0, 0];
    const px = rgba(white, white, yellow, clear);
    monoMask(px);
    expect([px[3], px[7], px[11], px[15]]).toEqual([255, 255, 255, 0]);
  });
});
