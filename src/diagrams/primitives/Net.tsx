import type { NetItem } from '../../types/diagram';

export function Net({ item }: { item: NetItem }) {
  return (
    <g
      data-item-id={item.id}
      data-item-type="net"
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.size})`}
    >
      <rect x={0} y={-2} width={item.length} height={4} fill="url(#netHatch)" stroke="rgb(var(--color-ink))" strokeWidth={0.4} />
    </g>
  );
}
