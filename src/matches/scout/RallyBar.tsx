import { POINT_REASON_LABELS, type MatchFormat, type PointReason, type SetScore, type Side } from '../../types/match';

const REASONS: Record<Side, PointReason[]> = {
  us: ['oppError', 'unknown'],
  them: ['oppKill', 'oppAce', 'oppBlock', 'unknown'],
};

/** A point just recorded without a reason; the bar offers to amend it. */
export interface ReasonPrompt {
  eventId: string;
  winner: Side;
}

interface RallyBarProps {
  /** Records the point immediately (reason: null). */
  onPoint: (winner: Side) => void;
  onTimeout: (team: Side) => void;
  /** Amends the just-recorded point with a reason. */
  onReason: (eventId: string, reason: PointReason) => void;
  reasonPrompt: ReasonPrompt | null;
  timeoutsUsed: SetScore;
  format: MatchFormat;
}

export function RallyBar({ onPoint, onTimeout, onReason, reasonPrompt, timeoutsUsed, format }: RallyBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onPoint('us')} className="min-h-12 rounded-md bg-green/15 font-semibold text-green-strong">
          Point us
        </button>
        <button type="button" onClick={() => onPoint('them')} className="min-h-12 rounded-md bg-red/10 font-semibold text-red-strong">
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
      {reasonPrompt && (
        <div
          role="group"
          aria-label={`Point ${reasonPrompt.winner} — reason (optional)`}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2"
        >
          <span className="text-xs text-slate">Why? (optional)</span>
          {REASONS[reasonPrompt.winner].map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => onReason(reasonPrompt.eventId, reason)}
              className={`min-h-11 rounded-md px-3 text-sm font-medium ${
                reasonPrompt.winner === 'us' ? 'bg-green/15 text-green-strong' : 'bg-red/10 text-red-strong'
              }`}
            >
              {POINT_REASON_LABELS[reason]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
