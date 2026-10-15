import { useEffect, useRef } from 'react';
import type { SlideColors } from './palette';
import { CARD_H, CARD_W, drawAwardCard, type CardArt, type CardModel } from './card/drawAwardCard';

/** Small static preview (t = 1); scaled canvas, no animation. */
export function CardThumbnail({ card, colors, art, width = 108 }: { card: CardModel; colors: SlideColors; art: CardArt; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { photo, cutout, background } = art;
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const s = width / CARD_W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    drawAwardCard(ctx, card, colors, { photo, cutout, background }, 1, true);
  }, [card, colors, photo, cutout, background, width]);
  return <canvas ref={ref} width={width} height={Math.round((width * CARD_H) / CARD_W)} className="rounded-sm shadow-card" aria-hidden="true" />;
}
