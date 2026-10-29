import type { Gender } from '../i18n/catalog';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { FileUp, Plus, Trophy } from 'lucide-react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useContextMenu } from '../components/ContextMenu';
import { Sheet } from '../components/Sheet';
import { GroupedList } from '../components/GroupedList';
import { SkeletonBlock } from '../components/Skeleton';
import { usePublishPageChrome } from '../layout/PageChrome';
import { useAuth } from '../auth/AuthContext';
import type { Match, MatchStatus } from '../types/match';
import { getT, useT } from '../i18n/I18nProvider';
import { formatDate } from '../i18n/format';
import { todayIso } from '../calendar/monthGrid';
import { createMatch, deleteMatch, listMatches } from './matchesApi';
import { DvwImportDialog } from './dvw/DvwImportDialog';
import { MatchSetupForm } from './MatchSetupForm';
import { useTakePendingAction } from '../search/pendingAction';
import { TabEmptyState } from '../teams/TabEmptyState';

// Only the states that need attention get a chip; a finished match is the normal case and shows its score.
const STATUS_CLASS: Partial<Record<MatchStatus, string>> = {
  setup: 'bg-surface-3 text-ink-2',
  live: 'bg-green-tint text-green-strong',
};

/** "Thu 29 Oct" this year, "29 Oct 2025" otherwise. Never wraps (the raw ISO date broke at its hyphens). */
function matchDate(iso: string): string {
  return iso.slice(0, 4) === todayIso().slice(0, 4) ? formatDate(iso, 'weekday') : formatDate(iso, 'short');
}

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
      className="relative flex min-h-[60px] items-center before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden"
    >
      {/* Two lines (opponent, then date and state) so the opponent keeps the width; the score sits in a fixed
          tabular column so it lines up from row to row. */}
      <Link
        to={page}
        className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2 pl-4 pr-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus active:bg-surface-3"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-headline text-ink">{m.opponent}</span>
          <span className="flex min-w-0 items-center gap-2 text-footnote text-ink-2">
            <span className="whitespace-nowrap tabular-nums">{matchDate(m.date)}</span>
            {STATUS_CLASS[m.status] && (
              <span className={`shrink-0 rounded-full px-2 text-caption ${STATUS_CLASS[m.status]}`}>{t.labels.matchStatus[m.status]}</span>
            )}
          </span>
        </span>
        <span className="w-12 shrink-0 whitespace-nowrap text-right text-title-3 tabular-nums text-ink">
          {m.status === 'setup' ? <span className="text-ink-3">—</span> : `${m.result.setsUs}–${m.result.setsThem}`}
        </span>
      </Link>
      {m.status === 'live' && (
        <Link
          to={`${page}/scout`}
          className="-ml-2 mr-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-callout font-semibold text-ink hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
        <TabEmptyState
          icon={Trophy}
          title={l.none}
          action={<Button variant="primary" onClick={() => setCreatingDate(todayIso())}>{l.newMatch}</Button>}
        />
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
        <Sheet title={l.createTitle} onClose={closeCreate} size="lg" detent="large" guardUnsaved>
          <MatchSetupForm
            teamId={teamId}
            narrow
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
        </Sheet>
      )}
    </div>
  );
}
