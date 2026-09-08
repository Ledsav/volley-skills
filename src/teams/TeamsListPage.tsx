import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { listMyTeams } from './teamsApi';
import { CreateTeamDialog } from './CreateTeamDialog';
import type { Team } from '../types/team';

export function TeamsListPage() {
  const { appUser } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

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
    <div className="w-full bg-bg p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Teams</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          Create team
        </Button>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-slate shadow-card">
          No teams yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teams.map((team) => (
            <Link
              key={team.id}
              to={`/teams/${team.id}`}
              className="rounded-lg border border-border bg-surface p-4 shadow-card hover:border-blue"
            >
              <div className="font-semibold text-ink">{team.name}</div>
              <p className="mt-1 text-sm text-slate">
                {team.club} · {team.ageGroup} · {team.season}
              </p>
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
    </div>
  );
}
