import type { Gender } from '../i18n/catalog';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { FileUp, Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { useAuth } from '../auth/AuthContext';
import type { Match, MatchStatus } from '../types/match';
import { getT, useT } from '../i18n/I18nProvider';
import { todayIso } from '../calendar/monthGrid';
import { createMatch, listMatches } from './matchesApi';
import { DvwImportDialog } from './dvw/DvwImportDialog';
import { MatchSetupForm } from './MatchSetupForm';

const STATUS_CLASS: Record<MatchStatus, string> = {
  setup: 'bg-border/60 text-ink',
  live: 'bg-orange/15 text-orange-strong',
  finished: 'bg-green/15 text-green-strong',
};

interface TeamMatchesTabProps {
  teamId: string;
  teamName: string;
  gender?: Gender;
  newMatchDate?: string | null;
  onNewMatchHandled?: () => void;
}

export function TeamMatchesTab({ teamId, teamName, gender, newMatchDate = null, onNewMatchHandled }: TeamMatchesTabProps) {
  const navigate = useNavigate();
  const t = useT();
  const l = t.matches.list;
  const { firebaseUser } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingDate, setCreatingDate] = useState<string | null>(newMatchDate);
  const [importing, setImporting] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

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
    loadPage(null).catch(() => setError(getT().matches.list.loadError));
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
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {!online && <span className="text-xs text-slate">{l.offlineImport}</span>}
        <Button variant="secondary" size="sm" disabled={!online} onClick={() => setImporting(true)}>
          <FileUp size={16} aria-hidden="true" className="mr-1" />
          {l.importDvw}
        </Button>
        <Button variant="primary" size="sm" onClick={() => setCreatingDate(todayIso())}>
          <Plus size={16} aria-hidden="true" className="mr-1" />
          {l.newMatch}
        </Button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red">{error}</p>}
      {matches.length === 0 && !error ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-slate">{l.none}</p>
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
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[m.status]}`}>{t.labels.matchStatus[m.status]}</span>
              {m.status === 'live' && (
                <Link to={`/teams/${teamId}/matches/${m.id}/scout`} className="text-sm font-medium text-blue hover:underline">
                  {l.resume}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => void loadPage(cursor)}>{l.loadMore}</Button>
        </div>
      )}
      {importing && (
        <DvwImportDialog
          teamId={teamId}
          teamName={teamName}
          gender={gender}
          onClose={() => setImporting(false)}
          onImported={(matchId) => {
            setImporting(false);
            navigate(`/teams/${teamId}/matches/${matchId}`);
          }}
        />
      )}
      {creatingDate && firebaseUser && (
        <Dialog title={l.createTitle} onClose={closeCreate} size="lg" mobileSheet guardUnsaved>
          <MatchSetupForm
            teamId={teamId}
            defaultDate={creatingDate}
            submitLabel={l.createSubmit}
            onCancel={closeCreate}
            onSubmit={(input) => {
              // Not awaited: offline the write only resolves on server ack. The
              // match page reads it back from the local cache meanwhile.
              const { id, written } = createMatch(teamId, input, firebaseUser.uid);
              written.catch(() => setError(l.createError));
              closeCreate();
              navigate(`/teams/${teamId}/matches/${id}`);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}
