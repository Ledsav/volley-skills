import { tokenColor } from '../tokenColor';
import type { LineItem } from '../../types/diagram';

export function Line({ item }: { item: LineItem }) {
  const d = item.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  // `thickness` is the base weight; the Size control scales it up or down.
  const width = item.thickness * item.size;
  const dash = item.style === 'dashed' ? `${3 * item.size} ${2 * item.size}` : undefined;
  return (
    <g data-item-id={item.id} data-item-type="line">
      <path
        d={d}
        fill="none"
        stroke={tokenColor(item.color)}
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}
