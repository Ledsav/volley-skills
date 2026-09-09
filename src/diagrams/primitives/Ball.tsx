import { tokenColor, tokenColorAlpha } from '../tokenColor';
import type { BallItem } from '../../types/diagram';

const R = 2.6;
// A Mikasa V200W reads as a solid yellow ball with three blue accent panels
// meeting at the centre; the accent takes the item colour so a ball can still
// be colour-coded.
const MIKASA_YELLOW = '#f5c518';
// One accent panel: a curved rectangle — two parallel straight sides, a short
// flat inner edge just past the centre, and an outer "head" that is an arc
// concentric with the ball rim. Constant width, so it reads as a bent
// rectangle, not a wedge. Three, 120° apart, all cover the centre (so they
// connect) and leave three yellow bands between — the V200W pinwheel.
const BLADE = 'M -0.6 0.15 L -0.6 -2.427 A 2.5 2.5 0 0 1 0.6 -2.427 L 0.6 0.15 Z';

export function Ball({ item }: { item: BallItem }) {
  const tint = tokenColor(item.color);

  return (
    <g
      data-item-id={item.id}
      data-item-type="ball"
      data-ball-style={item.style}
      transform={`translate(${item.x} ${item.y}) scale(${item.size})`}
    >
      {item.style === 'mikasa' ? (
        <>
          <circle r={R} fill={MIKASA_YELLOW} />
          {[0, 120, 240].map((a) => (
            <path key={a} d={BLADE} transform={`rotate(${a})`} fill={tint} />
          ))}
          <circle r={R} fill="none" stroke={tokenColorAlpha('ink', 0.35)} strokeWidth={0.3} />
        </>
      ) : (
        <>
          <circle r={2.4} fill={tint} stroke={tokenColorAlpha('ink', 0.7)} strokeWidth={0.4} />
          {/* Two faint seams so a plain ball still reads as a sphere. */}
          <path
            d="M -2.4 -0.5 Q 0 -1.7 2.4 -0.5"
            fill="none"
            stroke={tokenColorAlpha('ink', 0.4)}
            strokeWidth={0.35}
          />
          <path
            d="M -2.2 1 Q 0 2.1 2.2 1"
            fill="none"
            stroke={tokenColorAlpha('ink', 0.4)}
            strokeWidth={0.35}
          />
        </>
      )}
    </g>
  );
}
