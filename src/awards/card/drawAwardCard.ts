import type { SlideColors } from '../palette';
import { cardBeats, easeOutBack, easeOutCubic } from './cardTimeline';
import { confettiAt, seedFrom } from './confetti';
import { fitName } from './fitName';
import { fitBlock } from './wrapText';

export const CARD_W = 1080;
export const CARD_H = 1920;
const CX = CARD_W / 2;
const CIRCLE_Y = 860;
const CIRCLE_R = 300;
const TEXT_W = 920;
/**
 * Cut-out area: the player stands in y 500–1450 (about half the card, poster-sized) and the
 * name, stat and footer go below — nothing is painted over the player except a short fade
 * at its bottom edge.
 */
const CUTOUT_TOP = 500;
const CUTOUT_H = 950;
const CUTOUT_FADE = 0.14;

export interface CardModel {
  key: string; awardTitle: string; name: string; number: number | null;
  statLine: string | null; footer: string; teamName: string; clubName: string; note: string;
}
type Img = ImageBitmap | HTMLCanvasElement;
export interface CardArt { photo: Img | null; cutout: Img | null; background: Img | null }

/** Flat slide colour, one soft accent disc, and the optional photo texture on top. */
export function drawBackground(ctx: CanvasRenderingContext2D, colors: SlideColors, art: Pick<CardArt, 'background'>, alpha: number, seed = 0) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(seed % 2 ? CARD_W * 0.85 : CARD_W * 0.15, CARD_H * (0.2 + (seed % 3) * 0.25), 520, 0, Math.PI * 2);
  ctx.fill();
  if (art.background) {
    ctx.globalAlpha = 0.35 * alpha;
    const s = Math.max(CARD_W / art.background.width, CARD_H / art.background.height);
    const w = art.background.width * s, h = art.background.height * s;
    ctx.drawImage(art.background, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
  }
  ctx.restore();
}

export function text(ctx: CanvasRenderingContext2D, s: string, y: number, font: string, color: string, alpha: number) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, CX, y);
  ctx.restore();
}

export function drawHeader(ctx: CanvasRenderingContext2D, card: Pick<CardModel, 'teamName' | 'clubName'>, colors: SlideColors, alpha: number) {
  if (card.clubName.trim()) text(ctx, card.clubName.trim().toUpperCase(), 150, '700 34px Inter, system-ui, sans-serif', colors.muted, alpha);
  if (card.teamName.trim()) text(ctx, card.teamName.toUpperCase(), 200, '600 30px Inter, system-ui, sans-serif', colors.muted, alpha);
}

export function drawAwardCard(ctx: CanvasRenderingContext2D, card: CardModel, colors: SlideColors, art: CardArt, t: number, reducedMotion = false): void {
  const b = cardBeats(t, reducedMotion);
  drawBackground(ctx, colors, art, easeOutCubic(b.bg), seedFrom(card.key));
  drawHeader(ctx, card, colors, easeOutCubic(b.bg));

  // Award title: slides up 60px while fading in
  const tt = easeOutCubic(b.title);
  if (tt > 0) {
    const { size, lines } = fitBlock(ctx, card.awardTitle, 900, 110, TEXT_W, 2);
    ctx.save();
    ctx.translate(0, (1 - tt) * 60);
    // a two-line title grows upwards so the photo below keeps its place
    lines.forEach((l, i) => text(ctx, l, 420 - (lines.length - 1 - i) * size * 1.05, `900 ${size}px Inter, system-ui, sans-serif`, colors.accent, tt));
    ctx.restore();
  }

  if (b.photo > 0 && art.cutout) {
    // Poster layout: the player stands in front of the title, anchored to the bottom edge.
    const e = easeOutCubic(b.photo);
    const s = Math.min(CUTOUT_H / art.cutout.height, CARD_W / art.cutout.width);
    const w = art.cutout.width * s, h = art.cutout.height * s;
    const bottom = CUTOUT_TOP + CUTOUT_H;
    ctx.save();
    ctx.globalAlpha = e;
    ctx.drawImage(art.cutout, CX - w / 2, bottom - h + (1 - e) * 200, w, h);
    ctx.restore();
    // Soften only the bottom edge of the player into the slide colour.
    const fadeTop = bottom - h * CUTOUT_FADE;
    const g = ctx.createLinearGradient(0, fadeTop, 0, bottom);
    g.addColorStop(0, `${colors.bg}00`);
    g.addColorStop(1, colors.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, fadeTop, CARD_W, bottom - fadeTop);
  } else if (b.photo > 0) {
    // Photo / number circle: spring scale
    const s = Math.max(0, easeOutBack(b.photo));
    ctx.save();
    ctx.translate(CX, CIRCLE_Y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.arc(0, 0, CIRCLE_R, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = colors.accent;
    ctx.fill();
    ctx.lineWidth = 16;
    ctx.strokeStyle = colors.text;
    ctx.stroke();
    ctx.clip();
    if (art.photo) {
      const ps = Math.max((CIRCLE_R * 2) / art.photo.width, (CIRCLE_R * 2) / art.photo.height);
      const w = art.photo.width * ps, h = art.photo.height * ps;
      ctx.drawImage(art.photo, -w / 2, -h / 2, w, h);
    } else if (card.number !== null) {
      ctx.font = '900 300px Inter, system-ui, sans-serif';
      ctx.fillStyle = colors.bg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(card.number), 0, 10);
    }
    // light sweep while the circle settles
    if (!reducedMotion && b.photo < 1) {
      const sweepX = -CIRCLE_R + b.photo * CIRCLE_R * 2;
      const g = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 80, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-CIRCLE_R, -CIRCLE_R, CIRCLE_R * 2, CIRCLE_R * 2);
    }
    ctx.restore();
  }

  // Text positions: below the player with a cut-out, the classic spots with the circle.
  const posterLayout = !!art.cutout;
  const nameY = posterLayout ? CUTOUT_TOP + CUTOUT_H + 120 : 1330;
  const nameFit = fitName(ctx, card.name, TEXT_W);
  const subY = posterLayout ? nameY + (nameFit.lines.length - 1) * nameFit.size * 1.1 + 90 : 1560;
  const footerY = posterLayout ? 1860 : 1780;

  // Name: letter-by-letter reveal
  if (b.name > 0) {
    const { size, lines } = nameFit;
    const totalChars = lines.join('').length;
    let shown = Math.ceil(totalChars * b.name);
    lines.forEach((line, i) => {
      const visible = line.slice(0, Math.max(0, shown));
      shown -= line.length;
      if (visible) text(ctx, visible, nameY + i * (size * 1.1), `800 ${size}px Inter, system-ui, sans-serif`, colors.text, 1);
    });
  }

  // Stat line or note
  const st = easeOutCubic(b.stat);
  const sub = card.statLine ?? (card.note || null);
  if (sub) {
    const block = fitBlock(ctx, sub, 600, 52, TEXT_W, 2);
    block.lines.forEach((l, i) => text(ctx, l, subY + i * block.size * 1.2, `600 ${block.size}px Inter, system-ui, sans-serif`, colors.muted, st));
  }
  const footer = fitBlock(ctx, card.footer, 500, 36, TEXT_W, 1);
  text(ctx, footer.lines[0] ?? '', footerY, `500 ${footer.size}px Inter, system-ui, sans-serif`, colors.muted, st);

  // Confetti
  if (b.confetti > 0) {
    for (const p of confettiAt(seedFrom(card.key), b.confetti, [colors.accent, colors.text, '#F5C542'])) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
  }
}

/** The pre-reveal card: award title only, with a pulsing glow (pulse 0..1). */
export function drawTitleCard(ctx: CanvasRenderingContext2D, title: string, colors: SlideColors, art: CardArt, pulse: number): void {
  drawBackground(ctx, colors, art, 1);
  ctx.save();
  const r = 340 + 40 * Math.sin(pulse * Math.PI * 2);
  const g = ctx.createRadialGradient(CX, CARD_H / 2, 0, CX, CARD_H / 2, r);
  g.addColorStop(0, `${colors.accent}66`);
  g.addColorStop(1, `${colors.accent}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.restore();
  const { size, lines } = fitBlock(ctx, title, 900, 120, TEXT_W, 3);
  const lineH = size * 1.08;
  lines.forEach((l, i) => text(ctx, l, CARD_H / 2 + 40 + (i - (lines.length - 1) / 2) * lineH, `900 ${size}px Inter, system-ui, sans-serif`, colors.text, 1));
}
