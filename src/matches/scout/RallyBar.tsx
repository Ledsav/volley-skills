import { POINT_REASON_LABELS, type MatchFormat, type PointReason, type SetScore, type Side } from '../../types/match';
import { POINT_REASONS } from '../skillGrades';
import { keyLabel } from './hotkeys';
import { Kbd } from './Kbd';

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
  /** `large` (quick score): taller point buttons with bigger type. */
  size?: 'normal' | 'large';
}

export function RallyBar({ onPoint, onTimeout, onReason, reasonPrompt, timeoutsUsed, format, size = 'normal' }: RallyBarProps) {
  const pointSize = size === 'large' ? 'min-h-24 text-xl' : 'min-h-14 text-base';
  const side = (team: Side) => {
    const us = team === 'us';
    const left = Math.max(0, format.timeoutsPerSet - timeoutsUsed[team]);
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="px-1 text-xs font-semibold uppercase tracking-wide text-slate">{us ? 'Us' : 'Them'}</span>
        <button
          type="button"
          onClick={() => onPoint(team)}
          className={`inline-flex ${pointSize} items-center justify-center gap-2 rounded-md font-semibold ${
            us ? 'bg-green/15 text-green-strong' : 'bg-red/10 text-red-strong'
          }`}
        >
          Point {team} <Kbd>{keyLabel(us ? 'pointUs' : 'pointThem')}</Kbd>
        </button>
        <button
          type="button"
          onClick={() => onTimeout(team)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border text-sm text-ink"
        >
          T/O {team} ({left}) <Kbd>{keyLabel(us ? 'timeoutUs' : 'timeoutThem')}</Kbd>
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {reasonPrompt && (
        <div
          role="group"
          aria-label={`Point ${reasonPrompt.winner} — reason (optional)`}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2"
        >
          <span className="text-xs text-slate">Why? (optional)</span>
          {POINT_REASONS[reasonPrompt.winner].map((reason, i) => (
            <button
              key={reason}
              type="button"
              onClick={() => onReason(reasonPrompt.eventId, reason)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium ${
                reasonPrompt.winner === 'us' ? 'bg-green/15 text-green-strong' : 'bg-red/10 text-red-strong'
              }`}
            >
              {POINT_REASON_LABELS[reason]}
              <Kbd>{i + 1}</Kbd>
            </button>
          ))}
        </div>
      )}
      {/* Mirrored: our side left, theirs right — each timeout under its own side's point. */}
      <div className="grid grid-cols-2 gap-3">
        {side('us')}
        {side('them')}
      </div>
    </div>
  );
}
