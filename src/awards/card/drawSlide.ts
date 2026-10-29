// src/awards/card/drawSlide.ts
import { slideColors, type Palette, type SlideColors } from '../palette';
import type { Slide } from '../story/buildStory';
import type { StoryStat } from '../story/storyStats';
import { CARD_DURATION_MS, easeOutBack, easeOutCubic } from './cardTimeline';
import { CARD_H, CARD_W, cardHeader, drawAwardCard, drawBackground, drawTitleCard, text, type CardArt, type CardModel } from './drawAwardCard';
import { contentBottom, drawHeaderRow, drawSponsorRow, type HeaderInfo } from './branding';
import { drawGlow, readableOverGlow } from './glow';
import { initialsOf } from './initials';
import { fontFor, trackPx } from './type';
import { fitBlock, fitFontSize, fillTabular } from './wrapText';

export interface PresentCard { key: string; title: string; model: CardModel }
export interface StoryDeps { palette: Palette; cards: PresentCard[]; artFor: (key: string) => CardArt; clubName: string; winnersTitle: string }

const WIPE_MS = 250;
const INTRO_MS = 1200;
const STAT_MS = 1600;
const SUSPENSE_PULSE_MS = 1600;
const TEXT_W = 920;
const CX = CARD_W / 2;

/** Header row for story slides: club logo / name and the season or match on the right. */
function storyHeader(deps: StoryDeps, clubName: string): HeaderInfo {
  const first = deps.cards[0]?.model;
  return { clubLogo: deps.artFor('').branding?.clubLogo ?? null, clubName, teamName: '', right: first?.footer ?? '' };
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

/** How long a slide's entrance animation runs (suspense loops; its value is one pulse). */
export function slideDurationMs(slide: Slide, cardCount: number): number {
  switch (slide.kind) {
    case 'intro': return INTRO_MS;
    case 'stat': return STAT_MS;
    case 'awardTitle': return 0;
    case 'awardSuspense': return SUSPENSE_PULSE_MS;
    case 'awardReveal': return CARD_DURATION_MS;
    case 'summary': return 600 + 80 * cardCount;
  }
}

function drawIntro(ctx: CanvasRenderingContext2D, slide: Extract<Slide, { kind: 'intro' }>, colors: SlideColors, deps: StoryDeps, t: number) {
  const clubName = deps.clubName;
  drawBackground(ctx, colors, deps.artFor(''), 1, 1); // artFor('') carries only the shared background image
  drawHeaderRow(ctx, storyHeader(deps, clubName), colors, 1);
  // Short titles punch in a word per line; long ones wrap and shrink (max 4 lines).
  const { size, lines } = fitBlock(ctx, slide.title, 700, 170, TEXT_W, 4);
  const words = slide.title.split(/\s+/).filter(Boolean);
  const rows = words.length <= 4 && words.every((w) => fitFontSize(ctx, w, 700, 170, TEXT_W) === 170) ? words : lines;
  const rowSize = rows === words ? 170 : size;
  const lineH = rowSize * 1.12;
  const n = rows.length;
  rows.forEach((w, i) => {
    const p = seg(t, i / (n + 1), (i + 1) / (n + 1));
    if (p <= 0) return;
    const s = Math.max(0, easeOutBack(p));
    const y = 760 + i * lineH;
    ctx.save();
    ctx.translate(CX, y);
    ctx.scale(1.15 - 0.15 * s, 1.15 - 0.15 * s);
    ctx.translate(-CX, -y);
    text(ctx, w, y, fontFor('display', rowSize), i === n - 1 ? colors.accent : colors.text, clamp(p * 2), trackPx('display', rowSize));
    ctx.restore();
  });
  const sub = fitBlock(ctx, slide.subtitle, 500, 56, TEXT_W, 1);
  text(ctx, sub.lines[0] ?? '', 760 + (n - 1) * lineH + 110, fontFor('body', sub.size), colors.muted, seg(t, n / (n + 1), 1), trackPx('body', sub.size));
}

function drawStat(ctx: CanvasRenderingContext2D, stat: StoryStat, colors: SlideColors, deps: StoryDeps, t: number) {
  const clubName = deps.clubName;
  drawBackground(ctx, colors, deps.artFor(''), 1, 2);
  drawHeaderRow(ctx, storyHeader(deps, clubName), colors, 1);
  const kicker = fitBlock(ctx, stat.kicker, 500, 56, TEXT_W, 1);
  text(ctx, kicker.lines[0] ?? '', 640, fontFor('body', kicker.size), colors.accent, seg(t, 0, 0.2), trackPx('body', kicker.size));
  const shown = Math.round(stat.big * easeOutCubic(seg(t, 0, 0.7)));
  const big = `${shown}${stat.bigSuffix}`;
  // Digits are laid out in fixed cells, so the final size is measured with every digit as a 0.
  const finalSize = fitFontSize(ctx, `${stat.big}${stat.bigSuffix}`.replace(/\d/g, '0'), 700, 320, TEXT_W);
  fillTabular(ctx, big, CX, 1000, fontFor('display', finalSize), colors.text, 1, 'center', trackPx('display', finalSize));
  const ct = easeOutCubic(seg(t, 0.6, 1));
  const caption = fitBlock(ctx, stat.caption, 600, 60, TEXT_W, 3);
  const capH = caption.size * 1.27;
  caption.lines.forEach((l, i) => text(ctx, l, 1160 + i * capH + (1 - ct) * 40, fontFor('headline', caption.size), colors.text, ct, trackPx('headline', caption.size)));
  if (stat.detail) {
    const detail = fitBlock(ctx, stat.detail, 500, 44, TEXT_W, 2);
    detail.lines.forEach((l, i) => text(ctx, l, 1160 + caption.lines.length * capH + 50 + i * detail.size * 1.25, fontFor('body', detail.size), colors.muted, ct, trackPx('body', detail.size)));
  }
}

function drawSummary(ctx: CanvasRenderingContext2D, deps: StoryDeps, colors: SlideColors, t: number, reduced: boolean) {
  drawBackground(ctx, colors, deps.artFor(''), 1, 3);
  const first = deps.cards[0]?.model;
  if (first) drawHeaderRow(ctx, cardHeader(first, deps.artFor('')), colors, 1);
  text(ctx, deps.winnersTitle, 330, fontFor('title', 112), colors.accent, 1, trackPx('title', 112));
  const n = deps.cards.length;
  const rows = Math.ceil(n / 2);
  const top = 420, bottom = contentBottom(deps.artFor('').branding) - 20;
  const rowH = Math.min(300, (bottom - top) / Math.max(1, rows));
  const r = Math.min(90, rowH * 0.28);
  deps.cards.forEach((c, i) => {
    const appear = reduced ? 1 : easeOutBack(seg(t * (600 + 80 * n), i * 80, i * 80 + 600));
    if (appear <= 0) return;
    const cx = n === 1 ? CX : i % 2 === 0 ? CARD_W * 0.27 : CARD_W * 0.73;
    const cy = top + Math.floor(i / 2) * rowH + r + 10;
    const art = deps.artFor(c.key);
    const img = art.cutout ?? art.photo;
    const glowAlpha = !img && !readableOverGlow(colors.bg, colors.accent, colors.text, 0.35) ? 0 : 0.35;
    drawGlow(ctx, cx, cy, r * 1.6, colors.accent, glowAlpha * clamp(appear));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(appear, appear);
    if (img) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();
      const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
      ctx.drawImage(img, -(img.width * s) / 2, -(img.height * s) / 2, img.width * s, img.height * s);
    } else {
      const label = c.model.number !== null ? String(c.model.number) : initialsOf(c.model.name);
      if (label) {
        ctx.font = fontFor('display', Math.round(r));
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 4);
      }
    }
    ctx.restore();
    const alpha = clamp(appear);
    const title = fitBlock(ctx, c.title, 500, 34, CARD_W * 0.42, 1);
    const name = fitBlock(ctx, c.model.name, 600, 46, CARD_W * 0.42, 1);
    const titleSize = title.size;
    const nameSize = name.size;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.muted;
    ctx.font = fontFor('body', titleSize);
    ctx.fillText(title.lines[0] ?? '', cx, cy + r + 44);
    ctx.fillStyle = colors.text;
    ctx.font = fontFor('headline', nameSize);
    ctx.fillText(name.lines[0] ?? '', cx, cy + r + 44 + nameSize + 8);
    ctx.restore();
  });
}

/**
 * Draws slide `index` as it looks `elapsedMs` after it appeared. During the first WIPE_MS after a
 * colour change, the previous slide's colour is wiped away left to right. Returns true when the
 * frame is final (callers can stop their animation loop).
 */
export function renderStoryFrame(
  ctx: CanvasRenderingContext2D, slides: Slide[], index: number, elapsedMs: number, deps: StoryDeps, reduced: boolean, prevIndex: number | null,
): boolean {
  const slide = slides[index];
  const colors = slideColors(deps.palette, slide.colorIndex);
  const duration = slideDurationMs(slide, deps.cards.length);
  const t = reduced || duration === 0 ? 1 : clamp(elapsedMs / duration);
  let done = t >= 1;
  switch (slide.kind) {
    case 'intro': drawIntro(ctx, slide, colors, deps, t); drawSponsorRow(ctx, deps.artFor('').branding, colors, 1); break;
    case 'stat': drawStat(ctx, slide.stat, colors, deps, t); drawSponsorRow(ctx, deps.artFor('').branding, colors, 1); break;
    case 'awardTitle': {
      const c = deps.cards[slide.awardIndex];
      drawTitleCard(ctx, c.title, colors, deps.artFor(c.key), 0, cardHeader(c.model, deps.artFor(c.key)));
      break;
    }
    case 'awardSuspense': {
      const c = deps.cards[slide.awardIndex];
      drawTitleCard(ctx, c.title, colors, deps.artFor(c.key), reduced ? 0 : (elapsedMs % SUSPENSE_PULSE_MS) / SUSPENSE_PULSE_MS, cardHeader(c.model, deps.artFor(c.key)));
      done = reduced;
      break;
    }
    case 'awardReveal': {
      const c = deps.cards[slide.awardIndex];
      drawAwardCard(ctx, c.model, colors, deps.artFor(c.key), t, reduced);
      break;
    }
    case 'summary': drawSummary(ctx, deps, colors, t, reduced); drawSponsorRow(ctx, deps.artFor('').branding, colors, 1); break;
  }
  const prev = prevIndex === null ? null : slides[prevIndex];
  if (!reduced && prev && prev.colorIndex !== slide.colorIndex && elapsedMs < WIPE_MS) {
    const p = easeOutCubic(elapsedMs / WIPE_MS);
    ctx.save();
    ctx.fillStyle = slideColors(deps.palette, prev.colorIndex).bg;
    ctx.fillRect(CARD_W * p, 0, CARD_W * (1 - p), CARD_H);
    ctx.restore();
    return false;
  }
  return done;
}
