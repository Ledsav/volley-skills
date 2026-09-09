import { tokenColorAlpha } from '../tokenColor';
import type { CourtPreset } from '../../types/diagram';

// Court occupies x∈[10,90]. Full court y∈[6,94] with the net across the middle;
// half court y∈[6,72] with the net along the top edge.
const LINE = 'rgb(var(--color-ink))';

export function CourtBackdrop({ court, showZones }: { court: CourtPreset; showZones: boolean }) {
  if (court === 'blank') return <g data-court="blank" style={{ pointerEvents: 'none' }} />;

  const top = 6;
  const bottom = court === 'full' ? 94 : 72;
  const netY = court === 'full' ? (top + bottom) / 2 : top;
  const attackOffset = (bottom - top) * (court === 'full' ? 0.17 : 0.34);

  const zones =
    court === 'full'
      ? [
          [82, 86, '1'], [50, 86, '6'], [18, 86, '5'],
          [18, netY + 6, '4'], [50, netY + 6, '3'], [82, netY + 6, '2'],
        ]
      : [
          [82, 66, '1'], [50, 66, '6'], [18, 66, '5'],
          [18, top + 8, '4'], [50, top + 8, '3'], [82, top + 8, '2'],
        ];

  return (
    <g data-court={court} style={{ pointerEvents: 'none' }}>
      <rect x={10} y={top} width={80} height={bottom - top} fill="none" stroke={LINE} strokeWidth={0.6} />
      <line data-court-net x1={8} y1={netY} x2={92} y2={netY} stroke={LINE} strokeWidth={1} />
      <line x1={10} y1={netY + attackOffset} x2={90} y2={netY + attackOffset} stroke={LINE} strokeWidth={0.4} strokeDasharray="2 1.5" />
      {court === 'full' && (
        <line x1={10} y1={netY - attackOffset} x2={90} y2={netY - attackOffset} stroke={LINE} strokeWidth={0.4} strokeDasharray="2 1.5" />
      )}
      {showZones &&
        zones.map(([x, y, n]) => (
          <text key={n as string} data-zone-label x={x as number} y={y as number} fontSize={4} textAnchor="middle" fill={tokenColorAlpha('ink', 0.4)}>
            {n}
          </text>
        ))}
    </g>
  );
}
