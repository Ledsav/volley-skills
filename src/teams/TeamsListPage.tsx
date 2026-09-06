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
    setHasMore(page.teams.length > 0 && page.lastDoc !== null);
  }

  async function loadMore() {
    if (!appUser || !lastDoc) return;
    const page = await listMyTeams(appUser.email, lastDoc);
    setTeams((current) => [...current, ...page.teams]);
    setLastDoc(page.lastDoc);
    setHasMore(page.teams.length > 0);
  }

  useEffect(() => {
    void loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.email]);

  return (
    <div className="mx-auto max-w-2xl bg-bg p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Teams</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          Create team
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card">
        <ul className="divide-y divide-border">
          {teams.map((team) => (
            <li key={team.id} className="px-4 py-3">
              <Link to={`/teams/${team.id}`} className="font-medium text-blue hover:underline">
                {team.name}
              </Link>
            </li>
          ))}
          {teams.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate">No teams yet.</li>}
        </ul>
      </div>

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
