import type { PoleItem } from '../../types/diagram';

export function Pole({ item }: { item: PoleItem }) {
  return (
    <g data-item-id={item.id} data-item-type="pole" transform={`translate(${item.x} ${item.y}) scale(${item.size})`}>
      <circle r={1.2} fill="rgb(var(--color-ink))" />
    </g>
  );
}
