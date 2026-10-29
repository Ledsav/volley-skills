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
  variant: 'rail' | 'grid' | 'toolbar';
}

export function Palette({ onAdd, variant }: Props) {
  const t = useT();
  return (
    <div
      className={
        variant === 'toolbar'
          ? 'flex min-w-0 flex-1 gap-1 overflow-x-auto'
          : variant === 'rail'
            ? 'flex flex-col gap-1'
            : 'grid grid-cols-3 gap-2'
      }
    >
      {PALETTE_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onAdd(type)}
          className={
            variant === 'toolbar'
              ? 'min-h-11 shrink-0 rounded-md px-3 text-callout text-ink hover:bg-surface-2'
              : 'min-h-11 rounded-md bg-surface-2 px-3 py-2 text-callout font-medium text-ink hover:bg-surface-3'
          }
        >
          {t.diagrams.palette[type]}
        </button>
      ))}
    </div>
  );
}
