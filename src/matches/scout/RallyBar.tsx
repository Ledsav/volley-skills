import { useState } from 'react';
import { POINT_REASON_LABELS, type MatchFormat, type PointReason, type SetScore, type Side } from '../../types/match';

const REASONS: Record<Side, PointReason[]> = {
  us: ['oppError', 'unknown'],
  them: ['oppKill', 'oppAce', 'oppBlock', 'unknown'],
};

interface RallyBarProps {
  onPoint: (winner: Side, reason: PointReason) => void;
  onTimeout: (team: Side) => void;
  timeoutsUsed: SetScore;
  format: MatchFormat;
}

export function RallyBar({ onPoint, onTimeout, timeoutsUsed, format }: RallyBarProps) {
  const [picking, setPicking] = useState<Side | null>(null);

  if (picking) {
    return (
      <div className="rounded-lg border border-border bg-surface p-2" role="group" aria-label={`Point ${picking} — reason`}>
        <div className="grid grid-cols-2 gap-2">
          {REASONS[picking].map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => {
                onPoint(picking, reason);
                setPicking(null);
              }}
              className={`min-h-11 rounded-md font-medium ${picking === 'us' ? 'bg-green/15 text-green-strong' : 'bg-red/10 text-red-strong'}`}
            >
              {POINT_REASON_LABELS[reason]}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setPicking(null)} className="mt-2 min-h-11 w-full rounded-md text-sm text-slate hover:bg-bg">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => setPicking('us')} className="min-h-12 rounded-md bg-green/15 font-semibold text-green-strong">
        Point us
      </button>
      <button type="button" onClick={() => setPicking('them')} className="min-h-12 rounded-md bg-red/10 font-semibold text-red-strong">
        Point them
      </button>
      <button
        type="button"
        onClick={() => onTimeout('us')}
        className="min-h-11 rounded-md border border-border text-sm text-ink"
      >
        T/O us ({Math.max(0, format.timeoutsPerSet - timeoutsUsed.us)})
      </button>
      <button
        type="button"
        onClick={() => onTimeout('them')}
        className="min-h-11 rounded-md border border-border text-sm text-ink"
      >
        T/O them ({Math.max(0, format.timeoutsPerSet - timeoutsUsed.them)})
      </button>
    </div>
  );
}
