import {
  Columns4,
  Fence,
  Flag,
  Hash,
  MoveUpRight,
  Slash,
  TrafficCone,
  Type,
  UserRound,
  Volleyball,
  type LucideIcon,
} from 'lucide-react';
import type { DiagramItemType } from '../types/diagram';
import { useT } from '../i18n/I18nProvider';

const PALETTE: { type: DiagramItemType; Icon: LucideIcon }[] = [
  { type: 'player', Icon: UserRound },
  { type: 'ball', Icon: Volleyball },
  { type: 'cone', Icon: TrafficCone },
  { type: 'ladder', Icon: Columns4 },
  { type: 'net', Icon: Fence },
  { type: 'pole', Icon: Flag },
  { type: 'line', Icon: Slash },
  { type: 'arrow', Icon: MoveUpRight },
  { type: 'text', Icon: Type },
  { type: 'zoneLabel', Icon: Hash },
];

interface Props {
  onAdd: (type: DiagramItemType) => void;
  variant: 'grid' | 'toolbar';
}

const CONTAINER: Record<Props['variant'], string> = {
  toolbar: 'flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  grid: 'grid grid-cols-3 gap-2 min-[420px]:grid-cols-5',
};

const BUTTON: Record<Props['variant'], string> = {
  // Icon over a short label, a 48 px target in the floating toolbar.
  toolbar:
    'pressable inline-flex h-12 min-w-[56px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-caption text-ink hover:bg-surface-2 active:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
  grid: 'pressable inline-flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-md bg-surface-2 px-2 py-2 text-footnote font-medium text-ink hover:bg-surface-3 active:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
};

/** The elements a coach can add to the court; each tap adds one at the centre of the view. */
export function Palette({ onAdd, variant }: Props) {
  const t = useT();
  return (
    <div role="group" aria-label={t.diagrams.editor.addElement} className={CONTAINER[variant]}>
      {PALETTE.map(({ type, Icon }) => (
        <button key={type} type="button" onClick={() => onAdd(type)} className={BUTTON[variant]}>
          <Icon className="h-5 w-5 shrink-0 text-ink-2" strokeWidth={1.75} aria-hidden="true" />
          <span className="max-w-full truncate">{t.diagrams.palette[type]}</span>
        </button>
      ))}
    </div>
  );
}
