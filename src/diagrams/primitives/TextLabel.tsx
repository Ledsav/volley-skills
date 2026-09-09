import { tokenColor } from '../tokenColor';
import type { TextItem } from '../../types/diagram';

export function TextLabel({ item }: { item: TextItem }) {
  return (
    <g data-item-id={item.id} data-item-type="text" transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}>
      <text fontSize={item.fontSize} fill={tokenColor(item.color)} dominantBaseline="central">
        {item.content}
      </text>
    </g>
  );
}
