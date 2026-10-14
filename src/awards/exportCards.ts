import { fileSlug } from '../export/exportJson';
import type { CardTheme } from './card/cardTheme';
import { CARD_H, CARD_W, drawAwardCard, type CardArt, type CardModel } from './card/drawAwardCard';

export function cardFileName(
  awardKey: string,
  c: { kind: 'match'; date: string; opponent: string } | { kind: 'season'; season: string },
): string {
  return c.kind === 'match'
    ? `vcb-${awardKey}-${c.date}-vs-${fileSlug(c.opponent)}.png`
    : `vcb-${awardKey}-season-${fileSlug(c.season)}.png`;
}

/** Text drawn before Inter loads silently falls back to another font. */
export async function ensureCardFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  await Promise.all(
    ['900 120px Inter', '800 120px Inter', '700 34px Inter', '600 52px Inter', '500 36px Inter'].map((f) => document.fonts.load(f).catch(() => [])),
  );
}

export async function renderCardPng(card: CardModel, theme: CardTheme, art: CardArt): Promise<Blob> {
  await ensureCardFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  drawAwardCard(canvas.getContext('2d')!, card, theme, art, 1);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'));
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke later: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareOrDownload(files: File[], title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files }) && typeof navigator.share === 'function') {
    try {
      await navigator.share({ files, title });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // otherwise fall through to download
    }
  }
  for (let i = 0; i < files.length; i++) {
    download(files[i]);
    if (i < files.length - 1) await new Promise((r) => setTimeout(r, 300));
  }
  return 'downloaded';
}
