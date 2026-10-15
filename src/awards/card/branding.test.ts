import { describe, expect, it } from 'vitest';
import { PRESET_PALETTES, slideColors } from '../palette';
import { containRect, contentBottom, drawHeaderRow, drawSponsorRow, knockOutWhite, SPONSOR_ROW, sponsorSlots, type Branding } from './branding';
import { CARD_W } from './geometry';
import { recordingCtx } from './testCtx';

const colors = slideColors(PRESET_PALETTES[0], 0);
const img = (w: number, h: number) => ({ width: w, height: h }) as unknown as ImageBitmap;
const branding = (n: number, clubLogo: ImageBitmap | null = null): Branding => ({ clubLogo, sponsors: Array.from({ length: n }, () => img(400, 100)), mono: false });

describe('branding', () => {
  it('fits a logo inside its box without cropping, centred', () => {
    expect(containRect(400, 100, { x: 0, y: 0, w: 200, h: 100 })).toEqual({ x: 0, y: 25, w: 200, h: 50 });
    expect(containRect(100, 400, { x: 10, y: 0, w: 200, h: 100 })).toEqual({ x: 97.5, y: 0, w: 25, h: 100 });
  });

  it('spreads up to six sponsor slots across the row, inside the margins, without overlap', () => {
    for (let n = 1; n <= 6; n++) {
      const slots = sponsorSlots(n);
      expect(slots).toHaveLength(n);
      slots.forEach((s, i) => {
        expect(s.x).toBeGreaterThanOrEqual(60);
        expect(s.x + s.w).toBeLessThanOrEqual(CARD_W - 60);
        expect(s.y).toBe(SPONSOR_ROW.top);
        if (i > 0) expect(s.x).toBeGreaterThanOrEqual(slots[i - 1].x + slots[i - 1].w);
      });
    }
  });

  it('draws one logo per sponsor inside the sponsor row, and nothing without sponsors', () => {
    const { ctx, calls } = recordingCtx();
    drawSponsorRow(ctx, branding(4), colors, 1);
    const draws = calls.filter((c) => c.method === 'drawImage');
    expect(draws).toHaveLength(4);
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

  it('knocks out a white background so a JPG logo can be tinted', () => {
    // 2×2: white corners except one dark pixel
    const px = new Uint8ClampedArray([255, 255, 255, 255, 250, 250, 250, 255, 20, 30, 40, 255, 255, 255, 255, 255]);
    expect(knockOutWhite(px, 2, 2)).toBe(true);
    expect([px[3], px[7], px[11], px[15]]).toEqual([0, 0, 255, 0]);
  });

  it('leaves a logo alone when its corners are not white (already transparent or coloured)', () => {
    const px = new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0]);
    expect(knockOutWhite(px, 2, 2)).toBe(false);
    expect(px[7]).toBe(255);
  });
});
