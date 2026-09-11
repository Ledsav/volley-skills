import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { Button } from '../components/Button';
import { bulkCreateTeams, listMyTeams } from './teamsApi';
import { TEAM_IMPORT_EXAMPLE, validateTeamRows } from './teamsImport';
import { CreateTeamDialog } from './CreateTeamDialog';
import type { Team } from '../types/team';

/** Up to two letters from a team name, for the card monogram. */
function teamMonogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function TeamsListPage() {
  const { appUser, access } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadFirstPage() {
    if (!appUser) return;
    const page = await listMyTeams(appUser.email);
    setTeams(page.teams);
    setLastDoc(page.lastDoc);
    setHasMore(page.hasMore);
  }

  async function loadMore() {
    if (!appUser || !lastDoc) return;
    const page = await listMyTeams(appUser.email, lastDoc);
    setTeams((current) => [...current, ...page.teams]);
    setLastDoc(page.lastDoc);
    setHasMore(page.hasMore);
  }

  useEffect(() => {
    void loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.email]);

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Teams</h1>
        <div
          className={`grid gap-2 sm:flex ${
            access?.isSuperAdmin ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {access?.isSuperAdmin && (
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setShowImport(true)}
            >
              Import
            </Button>
          )}
          {access?.isSuperAdmin && (
            <Button
              variant="primary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setShowCreate(true)}
            >
              Create team
            </Button>
          )}
        </div>
      </div>

      {notice && <p className="mb-4 text-sm text-green">{notice}</p>}

      {teams.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-slate shadow-card">
          {access?.isSuperAdmin ? 'No teams yet.' : 'No teams assigned yet — ask your club admin.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teams.map((team) => (
            <Link
              key={team.id}
              to={`/teams/${team.id}`}
              className="group flex flex-col rounded-lg border border-border bg-surface p-4 shadow-card transition-all duration-150 hover:border-blue hover:shadow-pop"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-navy/10 text-sm font-bold text-navy"
                >
                  {teamMonogram(team.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink group-hover:text-blue">{team.name}</div>
                  <p className="mt-0.5 truncate text-sm text-slate">
                    {team.club} · {team.ageGroup}
                  </p>
                </div>
              </div>
              <span className="mt-3 inline-flex w-fit rounded-full bg-bg px-2 py-0.5 text-xs font-medium tabular-nums text-slate">
                Season {team.season}
              </span>
              {team.description && <p className="mt-2 line-clamp-2 text-sm text-slate">{team.description}</p>}
            </Link>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => void loadMore()}>
            Load more
          </Button>
        </div>
      )}

      {showCreate && (
        <CreateTeamDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void loadFirstPage();
          }}
        />
      )}

      {showImport && appUser && (
        <BulkImportDialog
          title="Import teams"
          exampleJson={TEAM_IMPORT_EXAMPLE}
          validate={validateTeamRows}
          commit={(inputs) => bulkCreateTeams(inputs, appUser.uid, appUser.email)}
          onClose={() => setShowImport(false)}
          onImported={(n) => {
            setShowImport(false);
            setNotice(`Imported ${n} team${n === 1 ? '' : 's'}.`);
            window.setTimeout(() => setNotice(null), 4000);
            void loadFirstPage();
          }}
        />
      )}
    </div>
  );
}
