import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { useT } from '../i18n/I18nProvider';
import type { CalendarSession } from '../types/calendarSession';
import { formatDayLabel } from './monthGrid';
import { sessionLink } from './sessionLabels';

interface CalendarSessionSheetProps {
  teamId: string;
  session: CalendarSession;
  onClose: () => void;
  onRemove: (session: CalendarSession) => void;
}

/** A calendar session's view sheet: the day, the training and its notes, with Open training and Remove. */
export function CalendarSessionSheet({ teamId, session, onClose, onRemove }: CalendarSessionSheetProps) {
  const c = useT().calendar.tab;
  return (
    <Sheet
      title={session.trainingName}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
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
    </Sheet>
  );
}
