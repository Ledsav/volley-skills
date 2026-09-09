import { tokenColorAlpha } from '../tokenColor';
import type { LadderItem } from '../../types/diagram';

export function Ladder({ item }: { item: LadderItem }) {
  const w = 5;
  const stroke = tokenColorAlpha(item.color, 0.6);
  const rungs = Array.from({ length: item.rungs }, (_, i) => (i * item.length) / (item.rungs - 1));
  return (
    <g
      data-item-id={item.id}
      data-item-type="ladder"
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.size})`}
    >
      <line x1={-w / 2} y1={0} x2={-w / 2} y2={item.length} stroke={stroke} strokeWidth={0.5} />
      <line x1={w / 2} y1={0} x2={w / 2} y2={item.length} stroke={stroke} strokeWidth={0.5} />
      {rungs.map((y, i) => (
        <line key={i} x1={-w / 2} y1={y} x2={w / 2} y2={y} stroke={stroke} strokeWidth={0.5} />
      ))}
    </g>
  );
}
