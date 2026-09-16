import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { startSession, listPastSessions } from './testingSessionsApi';
import type { TestingSession } from '../types/testingSession';

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
      <ul className="divide-y divide-border">
        {pastSessions.map((s) => (
          <li key={s.id} className="py-2 text-sm text-ink">{s.date}</li>
        ))}
      </ul>
    </div>
  );
}
