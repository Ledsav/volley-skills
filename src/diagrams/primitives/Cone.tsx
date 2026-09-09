import { tokenColor } from '../tokenColor';
import type { ConeItem } from '../../types/diagram';

export function Cone({ item }: { item: ConeItem }) {
  return (
    <g
      data-item-id={item.id}
      data-item-type="cone"
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.size})`}
    >
      <polygon points="0,-4 3,3 -3,3" fill={tokenColor(item.color)} />
      <rect x={-3.6} y={3} width={7.2} height={1.4} fill={tokenColor(item.color)} />
    </g>
  );
}
