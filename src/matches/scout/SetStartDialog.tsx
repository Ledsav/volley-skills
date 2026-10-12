import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { FIELD_CLASS } from '../../components/Input';
import type { LiberoConfig, RosterEntry, Side } from '../../types/match';

interface SetStartDialogProps {
  setNumber: number;
  roster: RosterEntry[];
  liberos: LiberoConfig[];
  initialLineup: string[];
  initialServing: Side;
  onStart: (lineup: string[], serving: Side) => void;
  onCancel: () => void;
}

export function SetStartDialog({ setNumber, roster, liberos, initialLineup, initialServing, onStart, onCancel }: SetStartDialogProps) {
  const liberoIds = new Set(liberos.map((l) => l.playerId));
  const eligible = roster.filter((r) => !liberoIds.has(r.playerId));
  const [lineup, setLineup] = useState<string[]>(() => Array.from({ length: 6 }, (_, i) => initialLineup[i] ?? ''));
  const [serving, setServing] = useState<Side>(initialServing);

  const filled = lineup.filter(Boolean);
  const error =
    filled.length < 6 ? 'Fill all six positions.' : new Set(filled).size < 6 ? 'A player is in two positions.' : null;

  return (
    <Dialog
      title={`Start set ${setNumber}`}
      onClose={onCancel}
      mobileSheet
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Back</Button>
          <Button variant="primary" disabled={!!error} onClick={() => onStart(lineup, serving)}>Start set</Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-slate">P1 is the server. Front row: P4, P3, P2.</p>
      <div className="grid grid-cols-3 gap-2">
        {[3, 2, 1, 4, 5, 0].map((zone) => (
          <label key={zone} className="flex flex-col gap-1 text-xs font-medium text-slate">
            P{zone + 1}
            <select
              aria-label={`Position P${zone + 1}`}
              className={`${FIELD_CLASS} min-h-11`}
              value={lineup[zone]}
              onChange={(e) => setLineup((cur) => cur.map((id, i) => (i === zone ? e.target.value : id)))}
            >
              <option value="">—</option>
              {eligible.map((r) => (
                <option key={r.playerId} value={r.playerId}>#{r.number} {r.name}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <fieldset className="mt-4 flex gap-4">
        <legend className="mb-1 text-sm font-medium text-ink">First serve</legend>
        {(['us', 'them'] as const).map((side) => (
          <label key={side} className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input type="radio" name="serving" checked={serving === side} onChange={() => setServing(side)} />
            {side === 'us' ? 'We serve' : 'They serve'}
          </label>
        ))}
      </fieldset>
      {error && <p className="mt-3 text-sm text-slate">{error}</p>}
    </Dialog>
  );
}
