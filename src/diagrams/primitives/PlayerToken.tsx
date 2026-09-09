import { tokenColor, tokenColorAlpha } from '../tokenColor';
import type { PlayerItem, PlayerView } from '../../types/diagram';

// Light limb/skin tone that contrasts with the vivid jersey on light and dark.
const SKIN = '#c3ccd9';
// Theme-adaptive outline: dark ink on light, light ink on dark — always frames
// the figure against the background so head / torso / limbs stay legible.
const OUTLINE = tokenColorAlpha('ink', 0.55);
const SW = 0.4;

/** A limb drawn as an outlined thick stroke, so an arm never merges into the body. */
function limb(d: string, w = 1.4) {
  return (
    <>
      <path d={d} fill="none" stroke={OUTLINE} strokeWidth={w + 0.7} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={SKIN} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

const head = (cx: number, cy: number, r: number) => (
  <circle cx={cx} cy={cy} r={r} fill={SKIN} stroke={OUTLINE} strokeWidth={SW} />
);

function figure(view: PlayerView, jersey: string) {
  switch (view) {
    case 'above':
      return (
        <>
          <polygon points="-0.9,-1.9 0.9,-1.9 0,-3.2" fill={SKIN} stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
          <ellipse cx={0} cy={0.7} rx={3.2} ry={1.6} fill={jersey} stroke={OUTLINE} strokeWidth={SW} />
          {head(0, -0.6, 1.5)}
        </>
      );
    case 'aboveMale':
      return (
        <>
          <polygon points="-1,-2.5 1,-2.5 0,-3.8" fill={SKIN} stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
          <rect x={-3.5} y={-1.3} width={7} height={3} rx={0.9} fill={jersey} stroke={OUTLINE} strokeWidth={SW} />
          {head(0, -1.6, 1.55)}
        </>
      );
    case 'aboveFemale':
      return (
        <>
          <polygon points="-0.9,-2.7 0.9,-2.7 0,-3.9" fill={SKIN} stroke={OUTLINE} strokeWidth={SW} strokeLinejoin="round" />
          <circle cx={0} cy={-3.4} r={0.95} fill={SKIN} stroke={OUTLINE} strokeWidth={SW} />
          <path
            d="M -2 -1.3 Q 0 -2.2 2 -1.3 L 2.9 2.3 Q 0 3.2 -2.9 2.3 Z"
            fill={jersey}
            stroke={OUTLINE}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          {head(0, -1.9, 1.45)}
        </>
      );
    case 'front':
      return (
        <>
          {limb('M -1.9 -1.5 L -2.9 1.8', 1.1)}
          {limb('M 1.9 -1.5 L 2.9 1.8', 1.1)}
          {limb('M -0.85 1.9 L -0.95 4.9', 1.5)}
          {limb('M 0.85 1.9 L 0.95 4.9', 1.5)}
          <rect x={-2} y={-2} width={4} height={4.1} rx={0.9} fill={jersey} stroke={OUTLINE} strokeWidth={SW} />
          {head(0, -3.6, 1.55)}
        </>
      );
    case 'dig':
      return (
        <>
          {/* Both legs bent the same way — a parallel stance, back leg only
              slightly staggered behind the front. */}
          {limb('M 0.25 0.8 L 0.85 2.5 L 0.35 4.5', 1.5)}
          {limb('M 0.7 0.8 L 1.3 2.5 L 0.8 4.5', 1.5)}
          <path
            d="M 0.3 -2.2 Q 1.7 -1.7 1.5 0.2 Q 0.7 1.3 -0.6 0.9 Q -1.3 -0.7 0.3 -2.2 Z"
            fill={jersey}
            stroke={OUTLINE}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          {limb('M 0.9 -1.6 L 3.5 0.5', 1.7)}
          <circle cx={3.6} cy={0.6} r={0.85} fill={SKIN} stroke={OUTLINE} strokeWidth={SW} />
          {head(1.7, -2.7, 1.3)}
        </>
      );
    case 'spike':
      return (
        <>
          {limb('M -0.4 1.1 L -1.9 2.4 L -1.4 4.1', 1.4)}
          {limb('M 0.4 1.1 L 1.4 2.2 L 2.7 1.6', 1.4)}
          {limb('M 0.2 -1.9 L -1.6 -1.1 L -2.5 -2.1', 1.3)}
          <path
            d="M 0.9 -2.8 Q 2 -1.3 1.2 0.7 Q 0.5 1.7 -0.7 1.2 Q -1.7 -0.9 0.9 -2.8 Z"
            fill={jersey}
            stroke={OUTLINE}
            strokeWidth={SW}
            strokeLinejoin="round"
          />
          {limb('M 0.7 -2.4 L 2.1 -4.1 L 3.1 -5.5', 1.5)}
          <circle cx={3.2} cy={-5.6} r={0.85} fill={SKIN} stroke={OUTLINE} strokeWidth={SW} />
          {head(1.0, -3.5, 1.3)}
          <circle cx={3.9} cy={-6.4} r={0.9} fill="rgb(var(--color-surface))" stroke={OUTLINE} strokeWidth={SW} />
        </>
      );
    case 'set':
      return (
        <>
          {limb('M -0.9 2 L -1.2 3.4 L -0.9 4.9', 1.5)}
          {limb('M 0.9 2 L 1.2 3.4 L 0.9 4.9', 1.5)}
          <rect x={-1.7} y={-1} width={3.4} height={3.2} rx={0.8} fill={jersey} stroke={OUTLINE} strokeWidth={SW} />
          {limb('M -1.5 -0.6 L -1.5 -3.4 L -0.5 -4.6', 1.3)}
          {limb('M 1.5 -0.6 L 1.5 -3.4 L 0.5 -4.6', 1.3)}
          {head(0, -2.7, 1.5)}
          <circle cx={0} cy={-5.4} r={1.05} fill="rgb(var(--color-surface))" stroke={OUTLINE} strokeWidth={SW} />
        </>
      );
    case 'token':
      return null;
  }
}

export function PlayerToken({ item }: { item: PlayerItem }) {
  const r = 4;
  const jersey = tokenColor(item.color);
  const isToken = item.view === 'token';

  return (
    <g
      data-item-id={item.id}
      data-item-type="player"
      data-player-view={item.view}
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.size})`}
    >
      {isToken ? (
        <>
          {item.shape === 'circle' ? (
            <circle r={r} fill={jersey} />
          ) : (
            <rect x={-r} y={-r} width={r * 2} height={r * 2} fill={jersey} />
          )}
          {item.label && (
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={4}
              fill="rgb(var(--color-surface))"
              fontWeight={600}
            >
              {item.label}
            </text>
          )}
        </>
      ) : (
        <>
          {figure(item.view, jersey)}
          {item.label && (
            <>
              <rect
                x={-(item.label.length * 1.9 + 1.8) / 2}
                y={4}
                width={item.label.length * 1.9 + 1.8}
                height={3.6}
                rx={1.1}
                fill="rgb(var(--color-surface))"
                stroke={OUTLINE}
                strokeWidth={0.25}
              />
              <text
                y={5.8}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={3}
                fill="rgb(var(--color-ink))"
                fontWeight={600}
              >
                {item.label}
              </text>
            </>
          )}
        </>
      )}
    </g>
  );
}
