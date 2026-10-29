import type { SlideColors } from '../palette';
import { contentBottom, drawHeaderRow, drawSponsorRow, type Branding, type HeaderInfo } from './branding';
import { cardBeats, easeOutBack, easeOutCubic } from './cardTimeline';
import { confettiAt, seedFrom } from './confetti';
import { CARD_H, CARD_W, MARGIN } from './geometry';
import { drawGlow } from './glow';
import { initialsOf } from './initials';
import { fontFor, trackPx } from './type';
import { fitBlock, textAt } from './wrapText';

export { CARD_H, CARD_W } from './geometry';
const CX = CARD_W / 2;

/*
 * Card layout (horizontal bands, little vertical stacking):
 *   header row   [club logo] TEAM ··········· SEASON / MATCH
 *   title        big, left-aligned, up to 3 lines            player on the right
 *   lower third  NAME (left) ······················· stat (right), one row
 *   sponsor row  logos (only when there are sponsors)
 */
const TITLE_TOP = 280;
const TITLE_W = 600;
const NAME_W = 580;
const STAT_W = 380;
const PLAYER_TOP = 250;
const PLAYER_MAX_W = 720;
const CIRCLE_MAX_R = 280;
const CUTOUT_FADE = 0.12;
const FADE_STRIPS = 24;

export interface CardModel {
  key: string; awardTitle: string; name: string; number: number | null;
  statLine: string | null; footer: string; teamName: string; clubName: string; note: string;
}
type Img = ImageBitmap | HTMLCanvasElement;
export interface CardArt { photo: Img | null; cutout: Img | null; background: Img | null; branding?: Branding }

/** Header row content for a card: the club logo stands in for the club name. */
export function cardHeader(card: Pick<CardModel, 'teamName' | 'clubName' | 'footer'>, art: Pick<CardArt, 'branding'>): HeaderInfo {
  return { clubLogo: art.branding?.clubLogo ?? null, clubName: card.clubName, teamName: card.teamName, right: card.footer };
}

/** Flat slide colour, one soft accent glow, and the optional photo texture on top. */
export function drawBackground(ctx: CanvasRenderingContext2D, colors: SlideColors, art: Pick<CardArt, 'background'>, alpha: number, seed = 0) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  drawGlow(ctx, seed % 2 ? CARD_W * 0.85 : CARD_W * 0.15, CARD_H * (0.2 + (seed % 3) * 0.25), 620, colors.accent, 0.22);
  if (art.background) {
    ctx.globalAlpha = 0.35 * alpha;
    const s = Math.max(CARD_W / art.background.width, CARD_H / art.background.height);
    const w = art.background.width * s, h = art.background.height * s;
    ctx.drawImage(art.background, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
  }
  ctx.restore();
}

/** Centred line of text (story slides). */
export function text(ctx: CanvasRenderingContext2D, s: string, y: number, font: string, color: string, alpha: number, letterSpacing = 0) {
  textAt(ctx, s, CX, y, font, color, alpha, 'center', letterSpacing);
}

export function drawAwardCard(ctx: CanvasRenderingContext2D, card: CardModel, colors: SlideColors, art: CardArt, t: number, reducedMotion = false): void {
  const b = cardBeats(t, reducedMotion);
  const bgAlpha = easeOutCubic(b.bg);
  drawBackground(ctx, colors, art, bgAlpha, seedFrom(card.key));
  drawHeaderRow(ctx, cardHeader(card, art), colors, bgAlpha);

  // Measure the lower third first: the player fills the space between the title and it.
  const bottom = contentBottom(art.branding);
  const rowBase = bottom - 30;
  const name = fitBlock(ctx, card.name, 700, 100, NAME_W, 2);
  const nameTop = rowBase - (name.lines.length - 1) * name.size * 1.05 - name.size * 0.8;
  const sub = card.statLine ?? (card.note || null);
  // Prefer one slightly smaller line; wrap to two only when one line would get small.
  const oneLine = sub ? fitBlock(ctx, sub, 500, 46, STAT_W, 1) : null;
  const stat = !sub || !oneLine ? null
    : oneLine.size >= 36 && !oneLine.lines[0].endsWith('…') ? oneLine : fitBlock(ctx, sub, 500, 46, STAT_W, 2);
  const statTop = stat ? rowBase - (stat.lines.length - 1) * stat.size * 1.15 - stat.size * 0.8 : rowBase;
  const playerBottom = Math.min(nameTop, statTop) - 40;

  // Award title: big, left-aligned, slides up while fading in
  const title = fitBlock(ctx, card.awardTitle, 700, 112, TITLE_W, 3);
  const titleLineH = title.size * 1.04;
  const titleBottom = TITLE_TOP + title.lines.length * titleLineH;
  const tt = easeOutCubic(b.title);
  if (tt > 0) {
    ctx.save();
    ctx.translate(0, (1 - tt) * 60);
    title.lines.forEach((l, i) => textAt(ctx, l, MARGIN, TITLE_TOP + title.size * 0.85 + i * titleLineH, fontFor('display', title.size), colors.accent, tt, 'left', trackPx('display', title.size)));
    ctx.restore();
  }

  if (b.photo > 0 && art.cutout) {
    // Poster style: the player stands on the right, in front of the title's edge.
    const e = easeOutCubic(b.photo);
    const s = Math.min((playerBottom - PLAYER_TOP) / art.cutout.height, PLAYER_MAX_W / art.cutout.width);
    const w = art.cutout.width * s, h = art.cutout.height * s;
    const x = Math.min(CARD_W - 20 - w, CARD_W * 0.66 - w / 2);
    const y = playerBottom - h;
    // Solid player, then its last 12% in thin strips of falling opacity: the bottom edge
    // melts into whatever is behind it (a band painted over it showed on textured slides).
    const cw = art.cutout.width, ch = art.cutout.height;
    const top = y + (1 - e) * 200;
    drawGlow(ctx, x + w / 2, top + h * 0.45, h * 0.62, colors.accent, 0.42 * e);
    const solid = 1 - CUTOUT_FADE;
    ctx.save();
    ctx.globalAlpha = e;
    // Strip edges snap to whole pixels so neighbouring strips meet without seams.
    const at = (f: number) => Math.round(top + h * f);
    ctx.drawImage(art.cutout, 0, 0, cw, ch * solid, x, top, w, at(solid) - top);
    for (let i = 0; i < FADE_STRIPS; i++) {
      const f0 = solid + (CUTOUT_FADE * i) / FADE_STRIPS, f1 = solid + (CUTOUT_FADE * (i + 1)) / FADE_STRIPS;
      ctx.globalAlpha = e * (1 - (i + 0.5) / FADE_STRIPS);
      ctx.drawImage(art.cutout, 0, ch * f0, cw, ch * (f1 - f0), x, at(f0), w, at(f1) - at(f0));
    }
    ctx.restore();
  } else if (b.photo > 0) {
    // Photo / number circle on the right, clear of the title.
    const top = titleBottom + 40;
    const r = Math.max(80, Math.min(CIRCLE_MAX_R, (playerBottom - top) / 2));
    const cx = CARD_W - MARGIN - r;
    const cy = (top + playerBottom) / 2;
    const s = Math.max(0, easeOutBack(b.photo));
    drawGlow(ctx, cx, cy, r * 1.7, colors.accent, 0.42 * Math.min(1, s));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    if (art.photo) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const ps = Math.max((r * 2) / art.photo.width, (r * 2) / art.photo.height);
      const w = art.photo.width * ps, h = art.photo.height * ps;
      ctx.drawImage(art.photo, -w / 2, -h / 2, w, h);
    } else {
      const label = card.number !== null ? String(card.number) : initialsOf(card.name);
      if (label) {
        ctx.font = fontFor('display', Math.round(r));
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, r * 0.03);
      }
    }
    // light sweep while the circle settles (photo only)
    if (art.photo && !reducedMotion && b.photo < 1) {
      const sweepX = -r + b.photo * r * 2;
      const g = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 80, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
    }
    ctx.restore();
  }

  // Lower third: name (left, letter-by-letter) and stat (right) on one row.
  if (b.name > 0) {
    let shown = Math.ceil(name.lines.join('').length * b.name);
    name.lines.forEach((line, i) => {
      const visible = line.slice(0, Math.max(0, shown));
      shown -= line.length;
      const y = rowBase - (name.lines.length - 1 - i) * name.size * 1.05;
      if (visible) textAt(ctx, visible, MARGIN, y, fontFor('title', name.size), colors.text, 1, 'left', trackPx('title', name.size));
    });
  }
  const st = easeOutCubic(b.stat);
  if (stat) {
    stat.lines.forEach((l, i) => {
      const y = rowBase - (stat.lines.length - 1 - i) * stat.size * 1.15;
      textAt(ctx, l, CARD_W - MARGIN, y, fontFor('body', stat.size), colors.muted, st, 'right', trackPx('body', stat.size));
    });
  }

  drawSponsorRow(ctx, art.branding, colors, bgAlpha);

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

/** The pre-reveal card: header row, the award title with a pulsing glow (pulse 0..1), sponsors. */
export function drawTitleCard(ctx: CanvasRenderingContext2D, title: string, colors: SlideColors, art: CardArt, pulse: number, header?: HeaderInfo): void {
  drawBackground(ctx, colors, art, 1);
  if (header) drawHeaderRow(ctx, header, colors, 1);
  ctx.save();
  const r = 340 + 40 * Math.sin(pulse * Math.PI * 2);
  const g = ctx.createRadialGradient(CX, CARD_H / 2, 0, CX, CARD_H / 2, r);
  g.addColorStop(0, `${colors.accent}66`);
  g.addColorStop(1, `${colors.accent}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.restore();
  const { size, lines } = fitBlock(ctx, title, 700, 112, CARD_W - 2 * MARGIN - 40, 3);
  const lineH = size * 1.08;
  lines.forEach((l, i) => text(ctx, l, CARD_H / 2 + 40 + (i - (lines.length - 1) / 2) * lineH, fontFor('display', size), colors.text, 1, trackPx('display', size)));
  drawSponsorRow(ctx, art.branding, colors, 1);
}
