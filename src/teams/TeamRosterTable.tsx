import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LevelPill } from '../components/LevelPill';
import { deletePlayer, listPlayers, setPlayerStarting } from '../players/playersApi';
import { ageFromDob } from '../players/age';
import { filterRoster, sortRoster, type RosterSort } from '../players/rosterSort';
import { POSITION_CATEGORIES, type Player } from '../types/player';

const NUMERIC_HEADER_CLASS =
  'px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate';
const NUMERIC_CELL_CLASS = 'px-3 py-2 text-right tabular-nums text-ink';

const POSITION_LABELS = Object.fromEntries(POSITION_CATEGORIES.map((c) => [c.value, c.label])) as Record<
  Player['positionCategory'],
  string
>;

const SORT_OPTIONS: { value: RosterSort; label: string }[] = [
  { value: 'lineup', label: 'Lineup' },
  { value: 'skill', label: 'Skill level' },
  { value: 'birthdate', label: 'Birthdate' },
];

/** ISO birthdate with the current age beside it, or an em dash when unknown. */
function BornCell({ dob }: { dob: string }) {
  const age = ageFromDob(dob);
  if (age === null) return <>—</>;
  return (
    <>
      <span className="tabular-nums">{dob}</span>
      <span className="text-slate"> · {age}y</span>
    </>
  );
}

interface TeamRosterTableProps {
  teamId: string;
  onPlayersChange?: (players: Player[]) => void;
  /** Fired after a player is removed, so a parent can surface a notice. */
  onRosterChanged?: () => void;
}

export function TeamRosterTable({ teamId, onPlayersChange, onRosterChanged }: TeamRosterTableProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Player | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<RosterSort>('lineup');
  const [startingError, setStartingError] = useState<string | null>(null);

  const visiblePlayers = useMemo(
    () => sortRoster(filterRoster(players, search), sort),
    [players, search, sort]
  );

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

  async function toggleStarting(player: Player, starting: boolean) {
    setStartingError(null);
    const apply = (list: Player[]) => list.map((p) => (p.id === player.id ? { ...p, starting } : p));
    setPlayers((current) => {
      const next = apply(current);
      onPlayersChange?.(next);
      return next;
    });
    try {
      await setPlayerStarting(teamId, player.id, starting);
    } catch {
      setStartingError('Could not update the lineup. Please try again.');
      setPlayers((current) => {
        const reverted = apply(current).map((p) => (p.id === player.id ? { ...p, starting: !starting } : p));
        onPlayersChange?.(reverted);
        return reverted;
      });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleteError(null);
    try {
      await deletePlayer(teamId, pendingDelete.id);
    } catch {
      setDeleteError('Could not remove this player. Please try again.');
      return;
    }
    const removedId = pendingDelete.id;
    setPlayers((current) => {
      const next = current.filter((p) => p.id !== removedId);
      onPlayersChange?.(next);
      return next;
    });
    setPendingDelete(null);
    onRosterChanged?.();
  }

  useEffect(() => {
    void loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex-1">
          <span className="sr-only">Search players</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, position, number"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-slate focus:border-blue focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate">
          Sort
          <select
            aria-label="Sort roster"
            value={sort}
            onChange={(e) => setSort(e.target.value as RosterSort)}
            className="rounded-md border border-border bg-surface px-2 py-2 text-sm text-ink focus:border-blue focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {startingError && (
        <p role="alert" className="mb-3 text-sm text-red">
          {startingError}
        </p>
      )}

      {/* Mobile (<640px): a tap-friendly card per player — a wide table forces
          horizontal scroll on a phone, so this is a separate layout, not a
          squeezed table (design system §UX table guidance). */}
      <div className="flex flex-col gap-3 sm:hidden">
        {visiblePlayers.map((player) => (
          <div
            key={player.id}
            data-testid="roster-mobile-card"
            className="flex items-center gap-2 rounded-lg border border-border bg-surface shadow-card"
          >
            <label
              className="flex shrink-0 items-center pl-4"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="sr-only">Starting: {player.fullName}</span>
              <input
                type="checkbox"
                checked={player.starting}
                onChange={(e) => void toggleStarting(player, e.target.checked)}
              />
            </label>
            <Link
              to={`/teams/${teamId}/players/${player.id}`}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 p-4 active:bg-bg"
            >
              <div className="min-w-0">
                <span className="block truncate font-medium text-ink">{player.fullName}</span>
                <p className="mt-0.5 truncate text-sm text-slate">
                  {POSITION_LABELS[player.positionCategory]}
                  {ageFromDob(player.dob ?? '') !== null &&
                    ` · ${player.dob} (${ageFromDob(player.dob ?? '')}y)`}
                  {player.starting && ' · Starting'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums font-semibold text-ink">{player.avgScore?.toFixed(1) ?? '—'}</span>
                <LevelPill level={player.level} />
              </div>
            </Link>
            <Button
              variant="dangerGhost"
              size="sm"
              className="mr-2"
              onClick={() => setPendingDelete(player)}
              aria-label={`Remove ${player.fullName}`}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>

      {visiblePlayers.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-4 text-center text-sm text-slate shadow-card">
          {players.length === 0 ? 'No players yet.' : 'No players match your search.'}
        </p>
      )}

      {/* Tablet/desktop (>=640px): the full table. */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface shadow-card sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">Start</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">Name</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">
                Position
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">
                Born
              </th>
              <th className={`${NUMERIC_HEADER_CLASS} whitespace-nowrap`}>Skill avg</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">Level</th>
              <th className="px-3 py-2 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visiblePlayers.map((player) => (
              <tr key={player.id} className="border-b border-border last:border-b-0 hover:bg-bg">
                <td className="px-3 py-2">
                  <label className="inline-flex items-center">
                    <span className="sr-only">Starting: {player.fullName}</span>
                    <input
                      type="checkbox"
                      checked={player.starting}
                      onChange={(e) => void toggleStarting(player, e.target.checked)}
                    />
                  </label>
                </td>
                <td className="px-3 py-2">
                  <Link to={`/teams/${teamId}/players/${player.id}`} className="text-blue hover:underline">
                    {player.fullName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-ink">
                  <span className="block max-w-[10rem] truncate">{POSITION_LABELS[player.positionCategory]}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-ink">
                  <BornCell dob={player.dob ?? ''} />
                </td>
                <td className={NUMERIC_CELL_CLASS}>{player.avgScore?.toFixed(1) ?? '—'}</td>
                <td className="px-3 py-2">
                  <LevelPill level={player.level} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="dangerGhost"
                    size="sm"
                    onClick={() => setPendingDelete(player)}
                    aria-label={`Remove ${player.fullName}`}
                  >
                    Remove
                  </Button>
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

      {pendingDelete && (
        <ConfirmDialog
          title={`Remove ${pendingDelete.fullName}?`}
          message="This permanently deletes their player card, skills, development plan, and physical-test history. This cannot be undone."
          confirmLabel="Yes, remove player"
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError(null);
          }}
          error={deleteError}
        />
      )}
    </div>
  );
}
