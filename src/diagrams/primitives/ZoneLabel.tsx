import { tokenColorAlpha } from '../tokenColor';
import type { ZoneLabelItem } from '../../types/diagram';

export function ZoneLabel({ item }: { item: ZoneLabelItem }) {
  return (
    <g data-item-id={item.id} data-item-type="zoneLabel" transform={`translate(${item.x} ${item.y}) scale(${item.size})`}>
      <text fontSize={5} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={tokenColorAlpha(item.color, 0.5)}>
        {item.zone}
      </text>
    </g>
  );
}
