import { useEffect, useRef } from 'react';
import type { CardTheme } from './card/cardTheme';
import { CARD_H, CARD_W, drawAwardCard, type CardArt, type CardModel } from './card/drawAwardCard';

/** Small static preview (t = 1); scaled canvas, no animation. */
export function CardThumbnail({ card, theme, art, width = 108 }: { card: CardModel; theme: CardTheme; art: CardArt; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const s = width / CARD_W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    drawAwardCard(ctx, card, theme, art, 1, true);
  }, [card, theme, art, width]);
  return <canvas ref={ref} width={width} height={Math.round((width * CARD_H) / CARD_W)} className="rounded-sm shadow-card" aria-hidden="true" />;
}
