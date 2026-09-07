import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { listPlayers } from '../players/playersApi';
import type { Level, Player } from '../types/player';

const LEVEL_PILL_CLASS: Record<Level, string> = {
  Beginner: 'bg-red/10 text-red',
  Developing: 'bg-orange/10 text-orange',
  Advanced: 'bg-blue/10 text-blue',
  Elite: 'bg-green/10 text-green',
};

function levelPillClass(level: Level | null): string {
  return level ? LEVEL_PILL_CLASS[level] : 'bg-bg text-slate';
}

const NUMERIC_HEADER_CLASS =
  'px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate';
const NUMERIC_CELL_CLASS = 'px-3 py-2 text-right tabular-nums text-ink';

export function TeamRosterTable({ teamId }: { teamId: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);

  async function loadFirstPage() {
    const page = await listPlayers(teamId);
    setPlayers(page.players);
    setLastDoc(page.lastDoc);
    setHasMore(page.players.length > 0 && page.lastDoc !== null);
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listPlayers(teamId, lastDoc);
    setPlayers((current) => [...current, ...page.players]);
    setLastDoc(page.lastDoc);
    setHasMore(page.players.length > 0 && page.lastDoc !== null);
  }

  useEffect(() => {
    void loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">
                Position
              </th>
              <th className={NUMERIC_HEADER_CLASS}>Skill avg</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">Level</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className="border-b border-border last:border-b-0 hover:bg-bg">
                <td className="px-3 py-2 tabular-nums text-ink">{player.number}</td>
                <td className="px-3 py-2">
                  <Link to={`/teams/${teamId}/players/${player.id}`} className="text-blue hover:underline">
                    {player.fullName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-ink">{player.position}</td>
                <td className={NUMERIC_CELL_CLASS}>{player.avgScore?.toFixed(1) ?? '—'}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${levelPillClass(player.level)}`}
                  >
                    {player.level ?? '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <Button variant="secondary" onClick={() => void loadMore()} className="mt-4">
          Load more
        </Button>
      )}
    </div>
  );
}
