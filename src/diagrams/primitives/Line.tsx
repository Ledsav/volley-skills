import { tokenColor } from '../tokenColor';
import type { LineItem } from '../../types/diagram';

export function Line({ item }: { item: LineItem }) {
  const d = item.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <g data-item-id={item.id} data-item-type="line">
      <path
        d={d}
        fill="none"
        stroke={tokenColor(item.color)}
        strokeWidth={item.thickness}
        strokeDasharray={item.style === 'dashed' ? '3 2' : undefined}
        strokeLinecap="round"
      />
    </g>
  );
}
