import type { SlideColors } from '../palette';
import { CARD_H, CARD_W, MARGIN } from './geometry';
import { fitBlock, textAt } from './wrapText';

type Img = ImageBitmap | HTMLCanvasElement;

/** Club logo and sponsor logos for the cards. Session-only: never stored. */
export interface Branding { clubLogo: Img | null; sponsors: Img[]; mono: boolean }

export const MAX_SPONSORS = 6;
export const HEADER_ROW = { top: 50, h: 110, baseline: 122 };
export const SPONSOR_ROW = { top: 1740, h: 120, divider: 1712 };
const SLOT_GAP = 40;
const FONT = 'Inter, system-ui, sans-serif';

interface Box { x: number; y: number; w: number; h: number }

/** Largest rect with the image's aspect ratio that fits inside `box`, centred. */
export function containRect(iw: number, ih: number, box: Box): Box {
  const s = Math.min(box.w / iw, box.h / ih);
  const w = iw * s, h = ih * s;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** Equal-width sponsor slots across the card between the margins. */
export function sponsorSlots(n: number): Box[] {
  if (n <= 0) return [];
  const w = Math.floor((CARD_W - 2 * MARGIN - SLOT_GAP * (n - 1)) / n);
  return Array.from({ length: n }, (_, i) => ({ x: MARGIN + i * (w + SLOT_GAP), y: SPONSOR_ROW.top, w, h: SPONSOR_ROW.h }));
}

/** Lowest y the card's own content may use: above the sponsor row when there is one. */
export function contentBottom(b: Branding | null | undefined): number {
  return b && b.sponsors.length ? SPONSOR_ROW.divider - 22 : CARD_H - 50;
}

/**
 * A logo on a white background (most JPGs) would tint into a solid block. When at least three
 * corners are opaque near-white, near-white pixels become transparent (soft edge 220–235).
 * Mutates RGBA `px`; returns whether it did.
 */
export function knockOutWhite(px: Uint8ClampedArray, w: number, h: number): boolean {
  const isWhite = (i: number) => px[i + 3] > 250 && Math.min(px[i], px[i + 1], px[i + 2]) > 235;
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
  if (corners.filter(isWhite).length < 3) return false;
  for (let i = 0; i < px.length; i += 4) {
    const m = Math.min(px[i], px[i + 1], px[i + 2]);
    if (m > 235) px[i + 3] = 0;
    else if (m > 220) px[i + 3] = Math.round(px[i + 3] * ((235 - m) / 15));
  }
  return true;
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
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
  }
  const out = x ? c : null;
  byColor.set(color, out);
  return out;
}

/** Draws a logo contain-fitted in `box`; `tint` makes it a single-colour silhouette. */
export function drawLogo(ctx: CanvasRenderingContext2D, img: Img, box: Box, tint: string | null, alpha = 1) {
  const r = containRect(img.width, img.height, box);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage((tint && tinted(img, tint)) || img, r.x, r.y, r.w, r.h);
  ctx.restore();
}

export interface HeaderInfo { clubLogo: Img | null; clubName: string; teamName: string; right: string }

/** One header row: [club logo] TEAM on the left, season / match on the right. */
export function drawHeaderRow(ctx: CanvasRenderingContext2D, h: HeaderInfo, colors: SlideColors, alpha: number) {
  if (alpha <= 0) return;
  let leftX = MARGIN;
  if (h.clubLogo) {
    drawLogo(ctx, h.clubLogo, { x: MARGIN, y: HEADER_ROW.top, w: HEADER_ROW.h, h: HEADER_ROW.h }, null, alpha);
    leftX += HEADER_ROW.h + 24;
  }
  const rightW = 380;
  const right = h.right.trim() ? fitBlock(ctx, h.right.trim().toUpperCase(), 600, 30, rightW, 1) : null;
  const club = h.clubLogo ? '' : h.clubName.trim();
  const team = h.teamName.trim();
  const leftText = [club, team].filter(Boolean).join(' · ').toUpperCase();
  if (leftText) {
    const left = fitBlock(ctx, leftText, 800, 36, CARD_W - MARGIN - (right ? rightW + 40 : 0) - leftX, 1);
    textAt(ctx, left.lines[0], leftX, HEADER_ROW.baseline, `800 ${left.size}px ${FONT}`, colors.text, alpha);
  }
  if (right) textAt(ctx, right.lines[0], CARD_W - MARGIN, HEADER_ROW.baseline, `600 ${right.size}px ${FONT}`, colors.muted, alpha, 'right');
}

/** Divider plus one row of sponsor logos (single-colour in the slide's text colour unless `mono` is off). */
export function drawSponsorRow(ctx: CanvasRenderingContext2D, b: Branding | null | undefined, colors: SlideColors, alpha: number) {
  if (!b || b.sponsors.length === 0 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = colors.muted;
  ctx.fillRect(MARGIN, SPONSOR_ROW.divider, CARD_W - 2 * MARGIN, 2);
  ctx.restore();
  const slots = sponsorSlots(b.sponsors.length);
  b.sponsors.forEach((img, i) => drawLogo(ctx, img, slots[i], b.mono ? colors.text : null, alpha));
}
