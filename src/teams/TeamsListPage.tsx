import { usePageMeta } from '../layout/usePageMeta';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { SkeletonBlock } from '../components/Skeleton';
import { bulkCreateTeams, listClubTeams, listMyTeams } from './teamsApi';
import { TEAM_IMPORT_EXAMPLE, validateTeamRows } from './teamsImport';
import { teamImportIssueText } from './teamsImportMessages';
import { useT } from '../i18n/I18nProvider';
import { CreateTeamDialog } from './CreateTeamDialog';
import { TeamCard } from './TeamCard';
import { readTeamsFilter, writeTeamsFilter, type TeamsFilter } from './teamsFilter';
import type { Team } from '../types/team';
import { useNotify } from '../components/Notice';
import { PageHeader } from '../layout/PageHeader';
import { useTakePendingAction } from '../search/pendingAction';
import { Plus } from 'lucide-react';

/** Grouped rows on phones; a card grid from md (TeamCard layout="responsive" supplies the rest). */
const LIST_CLASS =
  'overflow-hidden rounded-lg bg-surface shadow-card md:grid md:grid-cols-2 md:gap-3 md:overflow-visible md:rounded-none md:bg-transparent md:shadow-none lg:grid-cols-3 xl:grid-cols-4';

export function TeamsListPage() {
  const t = useT();
  const l = t.teams.list;
  usePageMeta({ title: l.title });
  const { appUser, access } = useAuth();
  const isClubAdmin = !!access?.isClubAdmin;
  const [filter, setFilter] = useState<TeamsFilter>(readTeamsFilter);
  // Only a club admin has a choice; everyone else lists the teams they are on.
  const effective: TeamsFilter = isClubAdmin ? filter : 'mine';
  const [teams, setTeams] = useState<Team[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const requestId = useRef(0);
  const notify = useNotify();
  useTakePendingAction('new-team', () => {
    if (isClubAdmin) setShowCreate(true);
  });

  const email = appUser?.email;
  // Every request takes a number; a page whose number is no longer the latest (the filter changed, or a newer
  // load started) is dropped, so a late page never replaces or mixes into the current list.
  const load = useCallback(
    async (cursor: QueryDocumentSnapshot | null) => {
      if (!email) return;
      const id = ++requestId.current;
      try {
        const page = effective === 'all' ? await listClubTeams(cursor) : await listMyTeams(email, cursor);
        if (id !== requestId.current) return;
        setTeams((current) => (cursor ? [...current, ...page.teams] : page.teams));
        setLastDoc(page.lastDoc);
        setHasMore(page.hasMore);
      } catch {
        if (id !== requestId.current) return;
        if (!cursor) {
          setTeams([]);
          setLastDoc(null);
          setHasMore(false);
        }
      }
      setLoaded(true);
    },
    [email, effective],
  );

  useEffect(() => {
    setTeams([]);
    setLastDoc(null);
    setHasMore(false);
    setLoaded(false);
    void load(null);
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  const changeFilter = (next: TeamsFilter) => {
    setFilter(next);
    writeTeamsFilter(next);
  };

  const emptyText = !isClubAdmin ? l.noneAssigned : effective === 'mine' ? l.noneMine : l.none;

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={l.title}
        mainAction={isClubAdmin ? { label: l.create, icon: Plus, onSelect: () => setShowCreate(true) } : undefined}
        more={isClubAdmin ? [{ kind: 'action', label: l.import, onSelect: () => setShowImport(true) }] : undefined}
      />

      {isClubAdmin && (
        <SegmentedControl
          label={l.filterLabel}
          options={[
            { id: 'mine', label: l.filterMine },
            { id: 'all', label: l.filterAll },
          ]}
          value={filter}
          onChange={changeFilter}
          className="mb-4 w-full sm:w-auto"
        />
      )}

      {!loaded ? (
        <div role="status" className={LIST_CLASS}>
          <span className="sr-only">{t.teams.shared.loading}</span>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} aria-hidden="true" className="flex min-h-[52px] items-center gap-3 px-4 py-2 md:rounded-lg md:bg-surface md:p-4 md:shadow-card">
              <SkeletonBlock className="h-10 w-10 shrink-0" />
              <div className="flex flex-1 flex-col gap-2">
                <SkeletonBlock className="h-4 w-40 max-w-full" />
                <SkeletonBlock className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-lg bg-surface p-6 text-center text-callout text-ink-2 shadow-card">{emptyText}</div>
      ) : (
        <ul className={LIST_CLASS}>
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} layout="responsive" withMenu />
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => void load(lastDoc)}>
            {t.teams.shared.loadMore}
          </Button>
        </div>
      )}

      {showCreate && (
        <CreateTeamDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load(null);
          }}
        />
      )}

      {showImport && appUser && (
        <BulkImportDialog
          title={t.teams.list.importTitle}
          exampleJson={TEAM_IMPORT_EXAMPLE}
          validate={validateTeamRows}
          formatIssue={(issue) => teamImportIssueText(issue, t)}
          commit={(inputs) => bulkCreateTeams(inputs, appUser.uid, appUser.email)}
          onClose={() => setShowImport(false)}
          onImported={(n) => {
            setShowImport(false);
            notify(t.teams.list.imported(n));
            void load(null);
          }}
        />
      )}
    </div>
  );
}
