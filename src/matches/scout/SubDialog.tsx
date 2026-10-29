import { tapFlash } from '../../motion/tapFlash';
import { Dialog } from '../../components/Dialog';
import type { RosterEntry } from '../../types/match';
import { useT } from '../../i18n/I18nProvider';
import { shortNames } from '../format';
import { RoleChip } from './RoleChip';

interface SubDialogProps {
  outPlayer: RosterEntry;
  candidates: RosterEntry[];
  onSub: (inPlayerId: string) => void;
  onCancel: () => void;
}

export function SubDialog({ outPlayer, candidates, onSub, onCancel }: SubDialogProps) {
  const t = useT();
  const names = shortNames([outPlayer, ...candidates]);
  // Like-for-like first: a middle usually comes off for a middle.
  const sorted = [...candidates].sort(
    (a, b) =>
      Number(b.positionCategory === outPlayer.positionCategory) - Number(a.positionCategory === outPlayer.positionCategory) || a.number - b.number,
  );
  return (
    <Dialog title={t.scout.sub.title(outPlayer.number, outPlayer.name)} onClose={onCancel}>
      {candidates.length === 0 ? (
        <p className="text-callout text-ink-2">{t.scout.sub.nobody}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {sorted.map((c) => (
            <button
              key={c.playerId}
              type="button"
              aria-label={t.scout.sub.bringOn(c.number, c.name)}
              onPointerDown={(e) => tapFlash(e.currentTarget)}
              onClick={() => onSub(c.playerId)}
              className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md bg-surface-2 px-1 text-ink"
            >
              <span className="max-w-full truncate text-headline">{names.get(c.playerId)}</span>
              <span className="flex items-center gap-1.5">
                <span className="text-callout tabular-nums leading-none text-ink-2">#{c.number}</span>
                <RoleChip role={c.positionCategory} />
              </span>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}
