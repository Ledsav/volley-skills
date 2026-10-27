import type { PositionCategory } from '../../types/player';
import { useT } from '../../i18n/I18nProvider';

/**
 * The on-court role as a chip. On a player card it sits beside the jersey number at
 * nearly the same weight, under the name. The libero gets the orange the court uses
 * for it. `inverted` sits on a filled (selected) tile.
 */
export function RoleChip({ role, label, libero = false, inverted = false }: { role: PositionCategory; label?: string; libero?: boolean; inverted?: boolean }) {
  const t = useT();
  const tone = inverted ? 'bg-white/20 text-white' : libero ? 'bg-orange/25 text-ink' : 'bg-ink/[0.06] text-ink';
  return (
    // The scout screen has no team loaded, so the role name takes the mixed form (R11).
    <span title={t.labels.position[role]('mixed')} className={`inline-flex h-5 shrink-0 items-center rounded-sm px-1.5 text-xs font-bold leading-none tracking-wide ${tone}`}>
      {label ?? role}
    </span>
  );
}
