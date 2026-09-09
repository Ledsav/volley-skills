import { tokenColor, tokenColorAlpha } from '../tokenColor';
import type { ConeItem } from '../../types/diagram';

// Half-width of the tapered body at height y (y = 3 base, y = -3.4 tip):
// widest at the base, narrowing toward the tip — bands follow the same taper.
const hw = (y: number) => 1 + 2 * ((y + 3.4) / 6.4);
const band = (top: number, bot: number) =>
  `M ${-hw(top)} ${top} L ${hw(top)} ${top} L ${hw(bot)} ${bot} L ${-hw(bot)} ${bot} Z`;

export function Cone({ item }: { item: ConeItem }) {
  const fill = tokenColor(item.color);
  return (
    <g
      data-item-id={item.id}
      data-item-type="cone"
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.size})`}
    >
      {/* Square base flange, a touch darker so it reads as ground contact. */}
      <rect x={-4} y={3} width={8} height={1.9} rx={0.5} fill={fill} />
      <rect x={-4} y={3} width={8} height={1.9} rx={0.5} fill={tokenColorAlpha('ink', 0.18)} />
      {/* Tapered body with a rounded tip. */}
      <path
        d="M -3 3 L 3 3 L 1 -3.4 Q 0 -4.2 -1 -3.4 Z"
        fill={fill}
        stroke={tokenColorAlpha('ink', 0.35)}
        strokeWidth={0.3}
        strokeLinejoin="round"
      />
      {/* Reflective collars, following the body taper (narrower higher up). */}
      <path data-cone-band d={band(-1.8, -0.4)} fill="rgb(var(--color-surface))" />
      <path data-cone-band d={band(1.2, 2.2)} fill="rgb(var(--color-surface))" />
    </g>
  );
}
