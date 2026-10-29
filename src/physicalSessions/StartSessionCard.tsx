import { formatDate } from '../i18n/format';
import { TabEmptyState } from '../teams/TabEmptyState';
import { useEffect, useState } from 'react';
import { ChevronRight, Timer } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Sheet } from '../components/Sheet';
import { GroupedList, ListRow } from '../components/GroupedList';
import { startSession, listPastSessions, SessionAlreadyOpenError } from './testingSessionsApi';
import type { TestingSession } from '../types/testingSession';
import { PastSessionDialog } from './PastSessionDialog';
import { useNotify } from '../components/Notice';
import { useT } from '../i18n/I18nProvider';
import { todayLocalIso } from '../dates/today';

interface StartSessionCardProps {
  teamId: string;
  creatorUid: string;
  onStarted: (sessionId: string) => void;
  /** Opens the start sheet (the empty state's action). */
  onRequestStart?: () => void;
  /** The start sheet is open (the tab's "New testing session" action). */
  starting?: boolean;
  onCloseStart?: () => void;
}

export function StartSessionCard({ teamId, creatorUid, onStarted, starting = false, onCloseStart, onRequestStart }: StartSessionCardProps) {
  const [date, setDate] = useState(todayLocalIso);
  const [busy, setBusy] = useState(false);
  const [pastSessions, setPastSessions] = useState<TestingSession[]>([]);
  const [viewing, setViewing] = useState<TestingSession | null>(null);
  const notify = useNotify();
  const s = useT().physicalSessions;
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    listPastSessions(teamId)
      .then(setPastSessions)
      .catch(() => setLoadError(s.start.loadError));
  }, [teamId, s.start.loadError]);

  // A fresh sheet starts from today's local date again, with no stale error.
  useEffect(() => {
    if (starting) {
      setDate(todayLocalIso());
      setError(null);
    }
  }, [starting]);

  async function handleStart() {
    setError(null);
    setBusy(true);
    try {
      const id = await startSession(teamId, date, creatorUid);
      onStarted(id);
    } catch (err) {
      setError(err instanceof SessionAlreadyOpenError ? s.start.alreadyOpen : s.start.couldNotStart);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {starting && (
        <Sheet
          title={s.start.newSession}
          onClose={() => onCloseStart?.()}
          confirm={{ label: s.start.startNew, onConfirm: () => void handleStart(), disabled: busy }}
        >
          <label htmlFor="session-date" className="mb-1 block text-footnote text-ink-2">{s.start.date}</label>
          <Input id="session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full tabular-nums" />
          {error && <p role="alert" className="mt-3 text-footnote text-red-strong">{error}</p>}
        </Sheet>
      )}

      {loadError && <p role="alert" className="text-footnote text-red-strong">{loadError}</p>}
      {!loadError && pastSessions.length === 0 && (
        <div className="rounded-lg bg-surface shadow-card">
          <TabEmptyState
            icon={Timer}
            title={s.start.noSessions}
            body={s.start.noSessionsBody}
            action={onRequestStart && <Button variant="primary" onClick={onRequestStart}>{s.start.newSession}</Button>}
          />
        </div>
      )}
      {pastSessions.length > 0 && (
        <GroupedList header={s.start.pastSessions}>
          {pastSessions.map((p) => (
            <ListRow key={p.id} title={<span className="tabular-nums" title={p.date}>{formatDate(p.date, 'short')}</span>} onClick={() => setViewing(p)} trailing={<ChevronRight size={18} aria-hidden="true" className="text-ink-3" />} />
          ))}
        </GroupedList>
      )}

      {viewing && (
        <PastSessionDialog
          teamId={teamId}
          session={viewing}
          onClose={() => setViewing(null)}
          onDeleted={() => {
            setPastSessions((current) => current.filter((p) => p.id !== viewing.id));
            setViewing(null);
            notify(s.shared.sessionDeleted);
          }}
        />
      )}
    </div>
  );
}
