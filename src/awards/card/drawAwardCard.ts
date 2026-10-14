import type { CardTheme } from './cardTheme';
import { cardBeats, easeOutBack, easeOutCubic } from './cardTimeline';
import { confettiAt, seedFrom } from './confetti';
import { fitName } from './fitName';

export const CARD_W = 1080;
export const CARD_H = 1920;
const CX = CARD_W / 2;
const CIRCLE_Y = 860;
const CIRCLE_R = 300;
const TEXT_W = 920;

export interface CardModel {
  key: string; awardTitle: string; name: string; number: number | null;
  statLine: string | null; footer: string; teamName: string; clubName: string; note: string;
}
type Img = ImageBitmap | HTMLCanvasElement;
export interface CardArt { photo: Img | null; background: Img | null }

function drawBackground(ctx: CanvasRenderingContext2D, theme: CardTheme, art: CardArt, alpha: number) {
  ctx.save();
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, theme.bgFrom);
  g.addColorStop(1, theme.bgTo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  if (art.background) {
    ctx.globalAlpha = alpha;
    const s = Math.max(CARD_W / art.background.width, CARD_H / art.background.height);
    const w = art.background.width * s, h = art.background.height * s;
    ctx.drawImage(art.background, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }
  ctx.restore();
}

function text(ctx: CanvasRenderingContext2D, s: string, y: number, font: string, color: string, alpha: number) {
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

function drawHeader(ctx: CanvasRenderingContext2D, card: Pick<CardModel, 'teamName' | 'clubName'>, theme: CardTheme, alpha: number) {
  if (card.clubName.trim()) text(ctx, card.clubName.trim().toUpperCase(), 150, '700 34px Inter, system-ui, sans-serif', theme.muted, alpha);
  text(ctx, card.teamName.toUpperCase(), 200, '600 30px Inter, system-ui, sans-serif', theme.muted, alpha);
}

export function drawAwardCard(ctx: CanvasRenderingContext2D, card: CardModel, theme: CardTheme, art: CardArt, t: number, reducedMotion = false): void {
  const b = cardBeats(t, reducedMotion);
  drawBackground(ctx, theme, art, easeOutCubic(b.bg));
  drawHeader(ctx, card, theme, easeOutCubic(b.bg));

  // Award title: slides up 60px while fading in
  const tt = easeOutCubic(b.title);
  if (tt > 0) {
    ctx.save();
    ctx.translate(0, (1 - tt) * 60);
    text(ctx, card.awardTitle, 420, '900 110px Inter, system-ui, sans-serif', theme.accent, tt);
    ctx.restore();
  }

  // Photo / number circle: spring scale
  if (b.photo > 0) {
    const s = Math.max(0, easeOutBack(b.photo));
    ctx.save();
    ctx.translate(CX, CIRCLE_Y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.arc(0, 0, CIRCLE_R, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = theme.accent;
    ctx.fill();
    ctx.lineWidth = 16;
    ctx.strokeStyle = theme.text;
    ctx.stroke();
    ctx.clip();
    if (art.photo) {
      const ps = Math.max((CIRCLE_R * 2) / art.photo.width, (CIRCLE_R * 2) / art.photo.height);
      const w = art.photo.width * ps, h = art.photo.height * ps;
      ctx.drawImage(art.photo, -w / 2, -h / 2, w, h);
    } else if (card.number !== null) {
      ctx.font = '900 300px Inter, system-ui, sans-serif';
      ctx.fillStyle = theme.bgTo;
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

  // Name: letter-by-letter reveal
  if (b.name > 0) {
    const { size, lines } = fitName(ctx, card.name, TEXT_W);
    const totalChars = lines.join('').length;
    let shown = Math.ceil(totalChars * b.name);
    lines.forEach((line, i) => {
      const visible = line.slice(0, Math.max(0, shown));
      shown -= line.length;
      if (visible) text(ctx, visible, 1330 + i * (size * 1.1), `800 ${size}px Inter, system-ui, sans-serif`, theme.text, 1);
    });
  }

  // Stat line or note
  const st = easeOutCubic(b.stat);
  const sub = card.statLine ?? (card.note || null);
  if (sub) text(ctx, sub, 1560, '600 52px Inter, system-ui, sans-serif', theme.muted, st);
  text(ctx, card.footer, 1780, '500 36px Inter, system-ui, sans-serif', theme.muted, st);

  // Confetti
  if (b.confetti > 0) {
    for (const p of confettiAt(seedFrom(card.key), b.confetti, [theme.accent, theme.text, '#F5C542'])) {
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
export function drawTitleCard(ctx: CanvasRenderingContext2D, title: string, theme: CardTheme, art: CardArt, pulse: number): void {
  drawBackground(ctx, theme, art, 1);
  ctx.save();
  const r = 340 + 40 * Math.sin(pulse * Math.PI * 2);
  const g = ctx.createRadialGradient(CX, CARD_H / 2, 0, CX, CARD_H / 2, r);
  g.addColorStop(0, `${theme.accent}66`);
  g.addColorStop(1, `${theme.accent}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.restore();
  text(ctx, title, CARD_H / 2 + 40, '900 120px Inter, system-ui, sans-serif', theme.text, 1);
}
