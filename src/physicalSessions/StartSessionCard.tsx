import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { startSession, listPastSessions, SessionAlreadyOpenError } from './testingSessionsApi';
import type { TestingSession } from '../types/testingSession';
import { ChevronRight } from 'lucide-react';
import { PastSessionDialog } from './PastSessionDialog';
import { useNotify } from '../components/Notice';
import { useT } from '../i18n/I18nProvider';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface StartSessionCardProps {
  teamId: string;
  creatorUid: string;
  onStarted: (sessionId: string) => void;
}

export function StartSessionCard({ teamId, creatorUid, onStarted }: StartSessionCardProps) {
  const [date, setDate] = useState(todayIso());
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

  async function handleStart() {
    setError(null);
    try {
      const id = await startSession(teamId, date, creatorUid);
      onStarted(id);
    } catch (err) {
      setError(err instanceof SessionAlreadyOpenError ? s.start.alreadyOpen : s.start.couldNotStart);
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <label htmlFor="session-date" className="mb-1 block text-sm font-medium text-ink">{s.start.date}</label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input id="session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-48" />
          <Button variant="primary" onClick={() => void handleStart()} className="w-full sm:w-auto">{s.start.startNew}</Button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-strong">{error}</p>}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-ink">{s.start.pastSessions}</h3>
      {loadError && <p role="alert" className="text-sm text-red-strong">{loadError}</p>}
      {!loadError && pastSessions.length === 0 && <p className="text-sm text-slate">{s.start.noSessions}</p>}
      <ul className="divide-y divide-border rounded-md border border-border">
        {pastSessions.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setViewing(p)}
              className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue"
            >
              <span className="tabular-nums">{p.date}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

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
