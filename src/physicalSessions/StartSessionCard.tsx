import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
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
  /** The start sheet is open (the tab's "New testing session" action). */
  starting?: boolean;
  onCloseStart?: () => void;
}

export function StartSessionCard({ teamId, creatorUid, onStarted, starting = false, onCloseStart }: StartSessionCardProps) {
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

      <h2 className="mb-2 text-title-3 text-ink">{s.start.pastSessions}</h2>
      {loadError && <p role="alert" className="text-footnote text-red-strong">{loadError}</p>}
      {!loadError && pastSessions.length === 0 && <p className="text-footnote text-ink-2">{s.start.noSessions}</p>}
      {pastSessions.length > 0 && (
        <GroupedList>
          {pastSessions.map((p) => (
            <ListRow key={p.id} title={<span className="tabular-nums">{p.date}</span>} onClick={() => setViewing(p)} trailing={<ChevronRight size={18} aria-hidden="true" className="text-ink-3" />} />
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
