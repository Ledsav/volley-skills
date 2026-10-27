import type { DiagramItemType } from '../types/diagram';
import { useT } from '../i18n/I18nProvider';

const PALETTE_TYPES: DiagramItemType[] = [
  'player',
  'ball',
  'cone',
  'ladder',
  'net',
  'pole',
  'line',
  'arrow',
  'text',
  'zoneLabel',
];

interface Props {
  onAdd: (type: DiagramItemType) => void;
  variant: 'rail' | 'grid';
}

export function Palette({ onAdd, variant }: Props) {
  const t = useT();
  return (
    <div className={variant === 'rail' ? 'flex flex-col gap-1' : 'grid grid-cols-3 gap-2'}>
      {PALETTE_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onAdd(type)}
          className="min-h-11 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-bg"
        >
          {t.diagrams.palette[type]}
        </button>
      ))}
    </div>
  );
}
