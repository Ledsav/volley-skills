import { Dialog } from '../../components/Dialog';
import type { RosterEntry } from '../../types/match';
import { useT } from '../../i18n/I18nProvider';

interface SubDialogProps {
  outPlayer: RosterEntry;
  candidates: RosterEntry[];
  onSub: (inPlayerId: string) => void;
  onCancel: () => void;
}

export function SubDialog({ outPlayer, candidates, onSub, onCancel }: SubDialogProps) {
  const t = useT();
  return (
    <Dialog title={t.scout.sub.title(outPlayer.number, outPlayer.name)} onClose={onCancel}>
      {candidates.length === 0 ? (
        <p className="text-sm text-slate">{t.scout.sub.nobody}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {candidates.map((c) => (
            <button
              key={c.playerId}
              type="button"
              aria-label={t.scout.sub.bringOn(c.number, c.name)}
              onClick={() => onSub(c.playerId)}
              className="flex min-h-14 flex-col items-center justify-center rounded-md border border-border bg-surface text-ink hover:bg-blue/10"
            >
              <span className="text-lg font-bold tabular-nums">{c.number}</span>
              <span className="max-w-full truncate px-1 text-xs text-slate">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}
