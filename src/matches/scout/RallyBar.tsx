import { tapFlash } from '../../motion/tapFlash';
import { Timer } from 'lucide-react';
import type { PointerEvent } from 'react';
import { useT } from '../../i18n/I18nProvider';
import { type MatchFormat, type PointReason, type SetScore, type Side } from '../../types/match';
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
  /** Short viewports (landscape phones): one row, T/O us · Point us · Point them · T/O them. */
  oneRow?: boolean;
}

export function RallyBar({ onPoint, onTimeout, onReason, reasonPrompt, timeoutsUsed, format, size = 'normal', oneRow = false }: RallyBarProps) {
  const t = useT();
  const pointSize = size === 'large' ? 'min-h-24 text-title-2' : 'min-h-14 text-headline';
  const timeoutSize = size === 'large' ? 'min-h-20' : 'min-h-14';
  const flash = (e: PointerEvent<HTMLButtonElement>) => tapFlash(e.currentTarget);
  const timeout = (team: Side) => {
    const left = Math.max(0, format.timeoutsPerSet - timeoutsUsed[team]);
    return (
      <button
        type="button"
        onPointerDown={flash}
        onClick={() => onTimeout(team)}
        aria-label={t.scout.rally.timeoutAria(t.matches.shared.side(team), left)}
        title={t.scout.rally.timeoutTitle(t.matches.shared.side(team), keyLabel(team === 'us' ? 'timeoutUs' : 'timeoutThem'))}
        // A real but lighter button than Point: outlined, no fill, same 56 px target.
        className={`flex ${timeoutSize} min-w-0 items-center justify-center gap-1.5 rounded-md border border-ink-3/60 px-3 text-callout font-medium tabular-nums text-ink hover:bg-surface-2 ${
          team === 'us' ? '[grid-area:tu]' : '[grid-area:tt]'
        }`}
      >
        <Timer size={16} aria-hidden="true" className="shrink-0 text-ink-2" />
        <span className="truncate">
          {t.scout.rally.timeoutShort} <span className="text-ink-2">· {t.scout.rally.left(left)}</span>
        </span>
        <Kbd>{keyLabel(team === 'us' ? 'timeoutUs' : 'timeoutThem')}</Kbd>
      </button>
    );
  };
  const point = (team: Side) => (
    <button
      type="button"
      onPointerDown={flash}
      onClick={() => onPoint(team)}
      className={`inline-flex ${pointSize} min-w-0 items-center justify-center gap-2 rounded-md ${
        team === 'us' ? 'bg-ink text-on-ink [grid-area:pu]' : 'bg-surface-2 text-ink [grid-area:pt]'
      }`}
    >
      {t.scout.rally.point(t.matches.shared.side(team))} <Kbd>{keyLabel(team === 'us' ? 'pointUs' : 'pointThem')}</Kbd>
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      {reasonPrompt && (
        <div
          role="group"
          aria-label={t.scout.rally.reasonGroup(t.matches.shared.side(reasonPrompt.winner))}
          className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-lg bg-surface p-2 [scrollbar-width:none]"
        >
          <span className="shrink-0 text-footnote text-ink-2">{t.scout.rally.why}</span>
          {POINT_REASONS[reasonPrompt.winner].map((reason, i) => (
            <button
              key={reason}
              type="button"
              onPointerDown={flash}
              onClick={() => onReason(reasonPrompt.eventId, reason)}
              className="inline-flex min-h-14 shrink-0 items-center gap-1.5 rounded-md bg-surface-2 px-4 text-callout font-medium text-ink"
            >
              {t.labels.pointReason[reason]}
              <Kbd>{i + 1}</Kbd>
            </button>
          ))}
        </div>
      )}
      {/* Mirrored: our side on the left, theirs on the right, each T/O under its point. The DOM order stays
          T/O us, Point us, Point them, T/O them (invariant 36); the grid areas do the layout. */}
      <div
        className={`grid gap-2 ${
          oneRow ? "grid-cols-[auto_1fr_1fr_auto] [grid-template-areas:'tu_pu_pt_tt']" : "grid-cols-2 [grid-template-areas:'pu_pt'_'tu_tt']"
        }`}
      >
        {timeout('us')}
        {point('us')}
        {point('them')}
        {timeout('them')}
      </div>
    </div>
  );
}
