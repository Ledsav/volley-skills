import { tokenColor } from '../tokenColor';
import type { ArrowItem } from '../../types/diagram';

export function Arrow({ item }: { item: ArrowItem }) {
  const { from, to } = item;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const nx = -(to.y - from.y);
  const ny = to.x - from.x;
  const len = Math.hypot(nx, ny) || 1;
  const bend = item.curved ? 8 : 0;
  const cx = mx + (nx / len) * bend;
  const cy = my + (ny / len) * bend;
  const d = item.curved ? `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}` : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const dash = item.style === 'run' ? '3 2' : undefined;
  const width = item.style === 'shot' ? 1.6 : 1;
  return (
    <g data-item-id={item.id} data-item-type="arrow">
      <path d={d} fill="none" stroke={tokenColor(item.color)} strokeWidth={width} strokeDasharray={dash} markerEnd={`url(#arrowhead-${item.head})`} />
    </g>
  );
}
