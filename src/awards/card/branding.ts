import type { SlideColors } from '../palette';
import { CARD_H, CARD_W, MARGIN } from './geometry';
import { ROLE } from './type';
import { fitBlock, textAt } from './wrapText';

type Img = ImageBitmap | HTMLCanvasElement;

/** Club logo and sponsor logos for the cards. Session-only: never stored. */
export interface Branding { clubLogo: Img | null; sponsors: Img[]; mono: boolean }

export const MAX_SPONSORS = 6;
const HEADER_ROW = { top: 50, h: 110, baseline: 122 };
export const SPONSOR_ROW = { top: 1740, h: 120, divider: 1712 };
const FONT = 'Inter, system-ui, sans-serif';

interface Box { x: number; y: number; w: number; h: number }

/** Largest rect with the image's aspect ratio that fits inside `box`, centred. */
export function containRect(iw: number, ih: number, box: Box): Box {
  const s = Math.min(box.w / iw, box.h / ih);
  const w = iw * s, h = ih * s;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

const MIN_GAP = 40;
const MAX_GAP = 120;
const MAX_LOGO_W = 0.4; // of the row: one wordmark never takes the whole row

/**
 * One row of sponsor boxes, sized by visual weight: every logo gets about the same area
 * (a wide wordmark gets a wide box, a square badge a square one), capped at the row's
 * height and 40% of its width, then spread across the row with even gaps.
 */
export function sponsorLayout(sizes: { w: number; h: number }[]): Box[] {
  const n = sizes.length;
  if (n === 0) return [];
  const avail = CARD_W - 2 * MARGIN;
  const ratios = sizes.map(({ w, h }) => (w > 0 && h > 0 ? w / h : 1));
  const boxes = (k: number) => ratios.map((r) => {
    const h = Math.min(SPONSOR_ROW.h, k / Math.sqrt(r), (avail * MAX_LOGO_W) / r);
    return { w: r * h, h };
  });
  const total = (k: number) => boxes(k).reduce((t, b) => t + b.w, 0) + MIN_GAP * (n - 1);
  let lo = 0, hi = SPONSOR_ROW.h * 40;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (total(mid) <= avail) lo = mid;
    else hi = mid;
  }
  const bs = boxes(lo);
  const used = bs.reduce((t, b) => t + b.w, 0);
  const gap = n > 1 ? Math.min(MAX_GAP, Math.max(MIN_GAP, (avail - used) / (n - 1))) : 0;
  let x = MARGIN + (avail - used - gap * (n - 1)) / 2;
  return bs.map((b) => {
    const box = { x, y: SPONSOR_ROW.top + (SPONSOR_ROW.h - b.h) / 2, w: b.w, h: b.h };
    x += b.w + gap;
    return box;
  });
}

/** Lowest y the card's own content may use: above the sponsor row when there is one. */
export function contentBottom(b: Branding | null | undefined): number {
  return b && b.sponsors.length ? SPONSOR_ROW.divider - 22 : CARD_H - 50;
}

/**
 * A logo on a white background (most JPGs) or on a solid colour block would sit on the slide
 * as a rectangle. When at least three corners share one opaque colour, pixels close to that
 * colour become transparent (soft edge for anti-aliasing). Mutates RGBA `px`; returns whether it did.
 */
export function knockOutBackground(px: Uint8ClampedArray, w: number, h: number): boolean {
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4].filter((i) => px[i + 3] > 250);
  const dist = (i: number, j: number) => Math.max(Math.abs(px[i] - px[j]), Math.abs(px[i + 1] - px[j + 1]), Math.abs(px[i + 2] - px[j + 2]));
  const ref = corners.find((c) => corners.filter((o) => dist(c, o) <= 24).length >= 3);
  if (ref === undefined) return false;
  const bg = [px[ref], px[ref + 1], px[ref + 2]];
  for (let i = 0; i < px.length; i += 4) {
    const d = Math.max(Math.abs(px[i] - bg[0]), Math.abs(px[i + 1] - bg[1]), Math.abs(px[i + 2] - bg[2]));
    if (d <= 20) px[i + 3] = 0;
    else if (d < 40) px[i + 3] = Math.round(px[i + 3] * ((d - 20) / 20));
  }
  return true;
}

/** Bounding box of the pixels that are not (almost) transparent, or null when there are none. */
export function opaqueBounds(px: Uint8ClampedArray, w: number, h: number): Box | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const luma = (px: Uint8ClampedArray, i: number) => (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;

/**
 * Alpha mask for a single-colour logo. A mostly dark logo keeps its light details (white
 * letters in a coloured badge) as holes, so it does not turn into a solid blob; a mostly
 * light logo (white text) stays whole. Mutates the alpha of RGBA `px`.
 */
export function monoMask(px: Uint8ClampedArray): void {
  let sum = 0, count = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 128) { sum += luma(px, i); count++; }
  if (!count || sum / count >= 0.6) return;
  for (let i = 0; i < px.length; i += 4) {
    const l = luma(px, i);
    if (l >= 0.86) px[i + 3] = 0;
    else if (l > 0.74) px[i + 3] = Math.round(px[i + 3] * ((0.86 - l) / 0.12));
  }
}

// Tinted copies are cached per image and colour: the presenter redraws every frame.
const tintCache = new WeakMap<Img, Map<string, HTMLCanvasElement | null>>();
function tinted(img: Img, color: string): HTMLCanvasElement | null {
  let byColor = tintCache.get(img);
  if (!byColor) tintCache.set(img, (byColor = new Map()));
  if (byColor.has(color)) return byColor.get(color)!;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d');
  if (x) {
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    monoMask(data.data);
    x.putImageData(data, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
  }
  const out = x ? c : null;
  byColor.set(color, out);
  return out;
}

/** Draws a logo contain-fitted in `box`; `tint` makes it a single-colour silhouette. */
function drawLogo(ctx: CanvasRenderingContext2D, img: Img, box: Box, tint: string | null, alpha = 1) {
  const r = containRect(img.width, img.height, box);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage((tint && tinted(img, tint)) || img, r.x, r.y, r.w, r.h);
  ctx.restore();
}

export interface HeaderInfo { clubLogo: Img | null; clubName: string; teamName: string; right: string }

/** One header row: [club logo] team on the left, season / match on the right. */
export function drawHeaderRow(ctx: CanvasRenderingContext2D, h: HeaderInfo, colors: SlideColors, alpha: number) {
  if (alpha <= 0) return;
  let leftX = MARGIN;
  if (h.clubLogo) {
    drawLogo(ctx, h.clubLogo, { x: MARGIN, y: HEADER_ROW.top, w: HEADER_ROW.h, h: HEADER_ROW.h }, null, alpha);
    leftX += HEADER_ROW.h + 24;
  }
  const rightW = 380;
  const right = h.right.trim() ? fitBlock(ctx, h.right.trim(), ROLE.caption.weight, 30, rightW, 1) : null;
  const club = h.clubLogo ? '' : h.clubName.trim();
  const team = h.teamName.trim();
  const leftText = [club, team].filter(Boolean).join(' · ');
  if (leftText) {
    const left = fitBlock(ctx, leftText, ROLE.caption.weight, 32, CARD_W - MARGIN - (right ? rightW + 40 : 0) - leftX, 1);
    textAt(ctx, left.lines[0], leftX, HEADER_ROW.baseline, `${ROLE.caption.weight} ${left.size}px ${FONT}`, colors.text, alpha);
  }
  if (right) textAt(ctx, right.lines[0], CARD_W - MARGIN, HEADER_ROW.baseline, `${ROLE.caption.weight} ${right.size}px ${FONT}`, colors.muted, alpha, 'right');
}

/** Divider plus one row of sponsor logos (single-colour in the slide's text colour unless `mono` is off). */
export function drawSponsorRow(ctx: CanvasRenderingContext2D, b: Branding | null | undefined, colors: SlideColors, alpha: number) {
  if (!b || b.sponsors.length === 0 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = colors.muted;
  ctx.fillRect(MARGIN, SPONSOR_ROW.divider, CARD_W - 2 * MARGIN, 2);
  ctx.restore();
  const slots = sponsorLayout(b.sponsors.map((img) => ({ w: img.width, h: img.height })));
  b.sponsors.forEach((img, i) => drawLogo(ctx, img, slots[i], b.mono ? colors.text : null, alpha));
}
