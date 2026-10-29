import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { SkeletonBlock } from '../components/Skeleton';
import { Sheet } from '../components/Sheet';
import { useT } from '../i18n/I18nProvider';
import type { CalendarSession } from '../types/calendarSession';
import { formatDayLabel } from './monthGrid';
import { sessionLink } from './sessionLabels';
import { useSessionParts } from './useSessionParts';

interface CalendarSessionSheetProps {
  teamId: string;
  session: CalendarSession;
  onClose: () => void;
  onRemove: (session: CalendarSession) => void;
}

/** A calendar session's view sheet: the day, the training and its notes, with Open training and Remove. */
export function CalendarSessionSheet({ teamId, session, onClose, onRemove }: CalendarSessionSheetProps) {
  const t = useT();
  const c = t.calendar.tab;
  const parts = useSessionParts(session.trainingId);
  return (
    <Sheet
      title={session.trainingName}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            variant="dangerGhost"
            aria-label={c.removeSession(session.trainingBusinessId, session.date)}
            onClick={() => onRemove(session)}
          >
            {c.remove}
          </Button>
          <Link
            to={sessionLink(teamId, session)}
            className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-callout font-semibold text-on-ink hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {c.openTraining}
          </Link>
        </div>
      }
    >
      <p className="text-callout tabular-nums text-ink-2">{formatDayLabel(session.date)}</p>
      <p className="mt-1 text-footnote tabular-nums text-ink-2">{session.trainingBusinessId}</p>
      {session.notes && <p className="mt-4 whitespace-pre-line text-body text-ink">{session.notes}</p>}

      <section aria-label={c.partsHeading} className="mt-5">
        <h3 className="mb-2 text-title-3 text-ink">{c.partsHeading}</h3>
        {parts.status === 'loading' && (
          <div role="status" className="flex flex-col gap-2">
            <span className="sr-only">{c.partsLoading}</span>
            <SkeletonBlock className="h-5 w-full" />
            <SkeletonBlock className="h-5 w-4/5" />
            <SkeletonBlock className="h-5 w-3/5" />
          </div>
        )}
        {parts.status === 'error' && <p className="text-footnote text-ink-2">{c.partsError}</p>}
        {parts.status === 'deleted' && <p className="text-footnote text-ink-2">{c.trainingDeleted}</p>}
        {parts.status === 'ready' && parts.parts.length === 0 && <p className="text-footnote text-ink-2">{c.noParts}</p>}
        {parts.status === 'ready' && parts.parts.length > 0 && (
          <>
            <p className="mb-2 text-footnote tabular-nums text-ink-2">{c.partsSummary(parts.parts.length, parts.totalMinutes)}</p>
            <ol className="overflow-hidden rounded-lg bg-surface-2">
              {parts.parts.map((part, i) => (
                <li
                  key={`${part.exerciseId}-${i}`}
                  className="relative flex items-center gap-3 px-3 py-2 before:absolute before:left-3 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden"
                >
                  <span className="w-6 shrink-0 text-footnote tabular-nums text-ink-2">#{i + 1}</span>
                  <span className={`min-w-0 flex-1 truncate text-callout ${part.name ? 'text-ink' : 'text-ink-2'}`}>
                    {part.name ?? t.calendar.assign.deletedExercise}
                  </span>
                  <span className="shrink-0 text-footnote tabular-nums text-ink-2">{t.calendar.assign.minutes(part.durationMinutes)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </Sheet>
  );
}
