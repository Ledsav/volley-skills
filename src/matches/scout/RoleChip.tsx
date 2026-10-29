import type { PositionCategory } from '../../types/player';
import { useT } from '../../i18n/I18nProvider';

interface RoleChipProps {
  role: PositionCategory;
  label?: string;
  libero?: boolean;
  /**
   * `badge`: the court tile's lead element, larger and higher-contrast, so the role reads first.
   * `chip` (default): the quiet inline chip used in lists and the action panel.
   */
  variant?: 'chip' | 'badge';
  /** On a selected (surface-3) tile the badge inverts, so it never melts into the fill. */
  selected?: boolean;
}

/**
 * The on-court role as a chip. Roles stay neutral (ink on surface); only the libero gets the orange
 * tint the court uses for it.
 */
export function RoleChip({ role, label, libero = false, variant = 'chip', selected = false }: RoleChipProps) {
  const t = useT();
  const tone = libero
    ? 'bg-orange/25 text-ink'
    : variant === 'badge'
      ? selected
        ? 'bg-ink text-on-ink'
        : 'bg-surface-3 text-ink'
      : 'bg-surface-2 text-ink-2';
  const size = variant === 'badge' ? 'h-6 px-2 text-footnote' : 'h-5 px-1.5 text-xs';
  return (
    // The scout screen has no team loaded, so the role name takes the mixed form (R11).
    <span title={t.labels.position[role]('mixed')} className={`inline-flex shrink-0 items-center rounded-sm font-bold leading-none tracking-wide ${size} ${tone}`}>
      {label ?? role}
    </span>
  );
}
