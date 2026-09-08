import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { LevelPill } from '../components/LevelPill';
import { listPlayers } from '../players/playersApi';
import type { Player } from '../types/player';

const NUMERIC_HEADER_CLASS =
  'px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate';
const NUMERIC_CELL_CLASS = 'px-3 py-2 text-right tabular-nums text-ink';

interface TeamRosterTableProps {
  teamId: string;
  onPlayersChange?: (players: Player[]) => void;
}

export function TeamRosterTable({ teamId, onPlayersChange }: TeamRosterTableProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);

  async function loadFirstPage() {
    const page = await listPlayers(teamId);
    setPlayers(page.players);
    onPlayersChange?.(page.players);
    setLastDoc(page.lastDoc);
    setHasMore(page.hasMore);
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listPlayers(teamId, lastDoc);
    setPlayers((current) => {
      const next = [...current, ...page.players];
      onPlayersChange?.(next);
      return next;
    });
    setLastDoc(page.lastDoc);
    setHasMore(page.hasMore);
  }

  useEffect(() => {
    void loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  return (
    <div>
      {/* Mobile (<640px): a tap-friendly card per player — a wide table forces
          horizontal scroll on a phone, so this is a separate layout, not a
          squeezed table (design system §UX table guidance). */}
      <div className="flex flex-col gap-3 sm:hidden">
        {players.map((player) => (
          <Link
            key={player.id}
            to={`/teams/${teamId}/players/${player.id}`}
            data-testid="roster-mobile-card"
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-card active:bg-bg"
          >
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="shrink-0 tabular-nums text-sm text-slate">#{player.number}</span>
                <span className="truncate font-medium text-ink">{player.fullName}</span>
              </div>
              <p className="mt-0.5 truncate text-sm text-slate" title={player.position}>
                {player.position}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="tabular-nums font-semibold text-ink">{player.avgScore?.toFixed(1) ?? '—'}</span>
              <LevelPill level={player.level} />
            </div>
          </Link>
        ))}
      </div>

      {players.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-4 text-center text-sm text-slate shadow-card">
          No players yet.
        </p>
      )}

      {/* Tablet/desktop (>=640px): the full table. */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface shadow-card sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">#</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">Name</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">
                Position
              </th>
              <th className={`${NUMERIC_HEADER_CLASS} whitespace-nowrap`}>Skill avg</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">Level</th>
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
                <td className="px-3 py-2 text-ink">
                  <span className="block max-w-[12rem] truncate" title={player.position}>
                    {player.position}
                  </span>
                </td>
                <td className={NUMERIC_CELL_CLASS}>{player.avgScore?.toFixed(1) ?? '—'}</td>
                <td className="px-3 py-2">
                  <LevelPill level={player.level} />
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
