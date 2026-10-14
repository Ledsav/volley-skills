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
  const height = size === 'large' ? 'min-h-20 text-xl' : 'min-h-12 text-base';
  const timeout = (team: Side) => {
    const left = Math.max(0, format.timeoutsPerSet - timeoutsUsed[team]);
    return (
      <button
        type="button"
        onClick={() => onTimeout(team)}
        aria-label={`T/O ${team} (${left} left)`}
        title={`Timeout ${team} · key ${keyLabel(team === 'us' ? 'timeoutUs' : 'timeoutThem')}`}
        className={`flex ${height} min-w-14 flex-col items-center justify-center rounded-md border border-border px-2 text-xs font-medium leading-tight text-ink`}
      >
        <span>T/O</span>
        <span className="tabular-nums text-slate">{left} left</span>
      </button>
    );
  };
  const point = (team: Side) => (
    <button
      type="button"
      onClick={() => onPoint(team)}
      className={`inline-flex ${height} min-w-0 items-center justify-center gap-2 rounded-md font-semibold ${
        team === 'us' ? 'bg-green/15 text-green-strong' : 'bg-red/10 text-red-strong'
      }`}
    >
      Point {team} <Kbd>{keyLabel(team === 'us' ? 'pointUs' : 'pointThem')}</Kbd>
    </button>
  );

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
      {/* One mirrored row: our timeout and point on the left, theirs on the right. */}
      <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2">
        {timeout('us')}
        {point('us')}
        {point('them')}
        {timeout('them')}
      </div>
    </div>
  );
}
