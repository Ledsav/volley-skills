import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { startSession, listPastSessions } from './testingSessionsApi';
import type { TestingSession } from '../types/testingSession';
import { ChevronRight } from 'lucide-react';
import { PastSessionDialog } from './PastSessionDialog';
import { useNotify } from '../components/Notice';

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
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    listPastSessions(teamId)
      .then(setPastSessions)
      .catch(() => setLoadError('Could not load past sessions.'));
  }, [teamId]);

  async function handleStart() {
    setError(null);
    try {
      const id = await startSession(teamId, date, creatorUid);
      onStarted(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the session. Please try again.');
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <label htmlFor="session-date" className="mb-1 block text-sm font-medium text-ink">Date</label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input id="session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-48" />
          <Button variant="primary" onClick={() => void handleStart()} className="w-full sm:w-auto">Start new session</Button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red">{error}</p>}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-ink">Past sessions</h3>
      {loadError && <p role="alert" className="text-sm text-red">{loadError}</p>}
      {!loadError && pastSessions.length === 0 && <p className="text-sm text-slate">No sessions yet.</p>}
      <ul className="divide-y divide-border rounded-md border border-border">
        {pastSessions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setViewing(s)}
              className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue"
            >
              <span className="tabular-nums">{s.date}</span>
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
            setPastSessions((current) => current.filter((s) => s.id !== viewing.id));
            setViewing(null);
            notify('Session deleted.');
          }}
        />
      )}
    </div>
  );
}
