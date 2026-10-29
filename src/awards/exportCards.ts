import { fileSlug } from '../export/exportJson';
import { CARD_H, CARD_W } from './card/drawAwardCard';

export function cardFileName(
  awardKey: string,
  c: { kind: 'match'; date: string; opponent: string } | { kind: 'season'; season: string },
): string {
  return c.kind === 'match'
    ? `award-${awardKey}-${c.date}-vs-${fileSlug(c.opponent)}.png`
    : `award-${awardKey}-season-${fileSlug(c.season)}.png`;
}

/** Text drawn before Inter loads silently falls back to another font. */
export async function ensureCardFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  await Promise.all(
    ['700 120px Inter', '600 52px Inter', '500 36px Inter'].map((f) => document.fonts.load(f).catch(() => [])),
  );
}

/** Draws one 1080×1920 frame off-screen and returns it as PNG. */
export async function renderPng(draw: (ctx: CanvasRenderingContext2D) => void): Promise<Blob> {
  await ensureCardFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  draw(canvas.getContext('2d')!);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'));
}

export { shareOrDownload } from '../export/shareFile';
