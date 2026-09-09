import type { DiagramItemType } from '../types/diagram';

export const PALETTE_ITEMS: { type: DiagramItemType; label: string }[] = [
  { type: 'player', label: 'Player' },
  { type: 'ball', label: 'Ball' },
  { type: 'cone', label: 'Cone' },
  { type: 'ladder', label: 'Ladder' },
  { type: 'net', label: 'Net' },
  { type: 'pole', label: 'Pole' },
  { type: 'line', label: 'Line' },
  { type: 'arrow', label: 'Arrow' },
  { type: 'text', label: 'Text' },
  { type: 'zoneLabel', label: 'Zone #' },
];

interface Props {
  onAdd: (type: DiagramItemType) => void;
  variant: 'rail' | 'grid';
}

export function Palette({ onAdd, variant }: Props) {
  return (
    <div className={variant === 'rail' ? 'flex flex-col gap-1' : 'grid grid-cols-3 gap-2'}>
      {PALETTE_ITEMS.map((p) => (
        <button
          key={p.type}
          type="button"
          onClick={() => onAdd(p.type)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-bg"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
