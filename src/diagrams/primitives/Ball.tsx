import { tokenColor } from '../tokenColor';
import type { BallItem } from '../../types/diagram';

export function Ball({ item }: { item: BallItem }) {
  return (
    <g data-item-id={item.id} data-item-type="ball" transform={`translate(${item.x} ${item.y}) scale(${item.size})`}>
      <circle r={2.4} fill={tokenColor(item.color)} stroke="rgb(var(--color-ink))" strokeWidth={0.4} />
    </g>
  );
}
