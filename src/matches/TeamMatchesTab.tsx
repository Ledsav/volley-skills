import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { useAuth } from '../auth/AuthContext';
import type { Match, MatchStatus } from '../types/match';
import { createMatch, listMatches } from './matchesApi';
import { MatchSetupForm } from './MatchSetupForm';

const STATUS_LABEL: Record<MatchStatus, string> = { setup: 'Setup', live: 'Live', finished: 'Finished' };
const STATUS_CLASS: Record<MatchStatus, string> = {
  setup: 'bg-border/60 text-ink',
  live: 'bg-orange/15 text-orange-strong',
  finished: 'bg-green/15 text-green-strong',
};

interface TeamMatchesTabProps {
  teamId: string;
  newMatchDate?: string | null;
  onNewMatchHandled?: () => void;
}

export function TeamMatchesTab({ teamId, newMatchDate = null, onNewMatchHandled }: TeamMatchesTabProps) {
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingDate, setCreatingDate] = useState<string | null>(newMatchDate);

  const loadPage = useCallback(
    async (after: QueryDocumentSnapshot | null) => {
      const page = await listMatches(teamId, after);
      setMatches((cur) => (after ? [...cur, ...page.matches] : page.matches));
      setCursor(page.lastDoc);
      setHasMore(page.hasMore);
    },
    [teamId],
  );

  useEffect(() => {
    loadPage(null).catch(() => setError('Could not load matches.'));
  }, [loadPage]);

  useEffect(() => {
    if (newMatchDate) setCreatingDate(newMatchDate);
  }, [newMatchDate]);

  function closeCreate() {
    setCreatingDate(null);
    onNewMatchHandled?.();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreatingDate(new Date().toISOString().slice(0, 10))}>
          <Plus size={16} aria-hidden="true" className="mr-1" />
          New match
        </Button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red">{error}</p>}
      {matches.length === 0 && !error ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-slate">No matches yet.</p>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 shadow-card">
              <Link to={`/teams/${teamId}/matches/${m.id}`} className="min-w-0 flex-1">
                <span className="block text-xs tabular-nums text-slate">{m.date}</span>
                <span className="block truncate font-medium text-ink">{m.opponent}</span>
              </Link>
              <span className="text-lg font-semibold tabular-nums text-ink">
                {m.result.setsUs}–{m.result.setsThem}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[m.status]}`}>{STATUS_LABEL[m.status]}</span>
              {m.status === 'live' && (
                <Link to={`/teams/${teamId}/matches/${m.id}/scout`} className="text-sm font-medium text-blue hover:underline">
                  Resume
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => void loadPage(cursor)}>Load more</Button>
        </div>
      )}
      {creatingDate && firebaseUser && (
        <Dialog title="New match" onClose={closeCreate} size="lg" mobileSheet>
          <MatchSetupForm
            teamId={teamId}
            defaultDate={creatingDate}
            submitLabel="Create match"
            onCancel={closeCreate}
            onSubmit={async (input) => {
              const id = await createMatch(teamId, input, firebaseUser.uid);
              closeCreate();
              navigate(`/teams/${teamId}/matches/${id}`);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}
