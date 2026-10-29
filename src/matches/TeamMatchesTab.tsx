import type { Gender } from '../i18n/catalog';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { FileUp, Plus, Trophy } from 'lucide-react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useContextMenu } from '../components/ContextMenu';
import { Dialog } from '../components/Dialog';
import { GroupedList } from '../components/GroupedList';
import { SkeletonBlock } from '../components/Skeleton';
import { usePublishPageChrome } from '../layout/PageChrome';
import { useAuth } from '../auth/AuthContext';
import type { Match, MatchStatus } from '../types/match';
import { getT, useT } from '../i18n/I18nProvider';
import { todayIso } from '../calendar/monthGrid';
import { createMatch, deleteMatch, listMatches } from './matchesApi';
import { DvwImportDialog } from './dvw/DvwImportDialog';
import { MatchSetupForm } from './MatchSetupForm';
import { useTakePendingAction } from '../search/pendingAction';

const STATUS_CLASS: Record<MatchStatus, string> = {
  setup: 'bg-surface-3 text-ink-2',
  live: 'bg-green-tint text-green-strong',
  finished: 'bg-surface-3 text-ink-2',
};

interface TeamMatchesTabProps {
  teamId: string;
  teamName: string;
  gender?: Gender;
  newMatchDate?: string | null;
  onNewMatchHandled?: () => void;
  /** Team admin: adds Season awards to the toolbar's More menu. */
  admin?: boolean;
}

interface MatchRowProps {
  match: Match;
  teamId: string;
  onDelete: (match: Match) => void;
}

function MatchRow({ match: m, teamId, onDelete }: MatchRowProps) {
  const navigate = useNavigate();
  const t = useT();
  const l = t.matches.list;
  const page = `/teams/${teamId}/matches/${m.id}`;
  const { targetProps, menu } = useContextMenu({
    label: l.rowMenu(m.opponent),
    items: () => [
      { kind: 'action' as const, label: m.status === 'finished' ? l.menu.report : l.menu.open, onSelect: () => navigate(page) },
      ...(m.status === 'live' ? [{ kind: 'action' as const, label: l.menu.scout, onSelect: () => navigate(`${page}/scout`) }] : []),
      { kind: 'divider' as const },
      { kind: 'action' as const, label: l.menu.delete, danger: true, onSelect: () => onDelete(m) },
    ],
  });
  return (
    <li
      {...targetProps}
      className="relative flex min-h-[52px] items-center gap-3 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden"
    >
      <Link
        to={page}
        className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus active:bg-surface-3"
      >
        <span className="w-20 shrink-0 text-footnote tabular-nums text-ink-2">{m.date}</span>
        <span className="min-w-0 flex-1 truncate text-headline text-ink">{m.opponent}</span>
        <span className="text-title-3 tabular-nums text-ink">
          {m.result.setsUs}–{m.result.setsThem}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-caption ${STATUS_CLASS[m.status]}`}>{t.labels.matchStatus[m.status]}</span>
      </Link>
      {m.status === 'live' && (
        <Link
          to={`${page}/scout`}
          className="mr-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-callout font-semibold text-ink hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {l.resume}
        </Link>
      )}
      {menu}
    </li>
  );
}

export function TeamMatchesTab({ teamId, teamName, gender, newMatchDate = null, onNewMatchHandled, admin = false }: TeamMatchesTabProps) {
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
  const [loaded, setLoaded] = useState(false);
  const [deleting, setDeleting] = useState<Match | null>(null);
  const deletingRef = useRef(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      setLoaded(true);
    },
    [teamId],
  );

  useEffect(() => {
    loadPage(null).catch(() => {
      setError(getT().matches.list.loadError);
      setLoaded(true);
    });
  }, [loadPage]);

  useEffect(() => {
    if (newMatchDate) setCreatingDate(newMatchDate);
  }, [newMatchDate]);

  useTakePendingAction('new-match', () => setCreatingDate(todayIso()));

  function closeCreate() {
    setCreatingDate(null);
    onNewMatchHandled?.();
  }

  usePublishPageChrome({
    title: teamName,
    mainAction: { label: l.newMatch, icon: Plus, onSelect: () => setCreatingDate(todayIso()) },
    more: [
      { kind: 'action', label: l.importDvw, icon: <FileUp size={16} />, disabled: !online, onSelect: () => setImporting(true) },
      ...(admin
        ? [{ kind: 'action' as const, label: t.teams.stats.seasonAwards, icon: <Trophy size={16} />, onSelect: () => navigate(`/teams/${teamId}/awards`) }]
        : []),
    ],
  });

  return (
    <div>
      {!online && <p className="mb-3 text-footnote text-ink-2">{l.offlineImport}</p>}
      {error && <p role="alert" className="mb-3 text-callout text-red-strong">{error}</p>}
      {!loaded ? (
        <div role="status" className="overflow-hidden rounded-lg bg-surface">
          <span className="sr-only">{t.matches.page.loading}</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex min-h-[52px] items-center px-4">
              <SkeletonBlock className="h-5 w-full" />
            </div>
          ))}
        </div>
      ) : matches.length === 0 && !error ? (
        <p className="rounded-lg border border-dashed border-separator px-4 py-6 text-center text-callout text-ink-2">{l.none}</p>
      ) : (
        <GroupedList>
          {matches.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              teamId={teamId}
              onDelete={(target) => {
                setDeleteError(null);
                setDeleting(target);
              }}
            />
          ))}
        </GroupedList>
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
      {deleting && (
        <ConfirmDialog
          title={t.matches.page.deleteTitle}
          message={t.matches.page.deleteMessage}
          confirmLabel={t.matches.page.deleteConfirm}
          error={deleteError}
          onCancel={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
          onConfirm={() => {
            if (deletingRef.current) return;
            deletingRef.current = true;
            const target = deleting;
            setDeleteError(null);
            deleteMatch(teamId, target.id)
              .then(() => {
                setMatches((cur) => cur.filter((x) => x.id !== target.id));
                setDeleting(null);
              })
              .catch(() => setDeleteError(t.matches.page.deleteError))
              .finally(() => {
                deletingRef.current = false;
              });
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
