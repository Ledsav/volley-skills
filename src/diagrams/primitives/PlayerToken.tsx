import { tokenColor } from '../tokenColor';
import type { PlayerItem } from '../../types/diagram';

export function PlayerToken({ item }: { item: PlayerItem }) {
  const r = 4;
  return (
    <g
      data-item-id={item.id}
      data-item-type="player"
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.size})`}
    >
      {item.shape === 'circle' ? (
        <circle r={r} fill={tokenColor(item.color)} />
      ) : (
        <rect x={-r} y={-r} width={r * 2} height={r * 2} fill={tokenColor(item.color)} />
      )}
      {item.label && (
        <text textAnchor="middle" dominantBaseline="central" fontSize={4} fill="rgb(var(--color-surface))" fontWeight={600}>
          {item.label}
        </text>
      )}
    </g>
  );
}
