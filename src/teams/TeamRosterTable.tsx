import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FIELD_CLASS } from '../components/Input';
import { LevelPill } from '../components/LevelPill';
import { deletePlayer, listPlayers, setPlayerStarting } from '../players/playersApi';
import { ageFromDob } from '../players/age';
import { filterRoster, sortRoster, type RosterSort } from '../players/rosterSort';
import type { Player } from '../types/player';
import { formatNumber } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';

const NUMERIC_HEADER_CLASS =
  'px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate';
const NUMERIC_CELL_CLASS = 'px-3 py-2 text-right tabular-nums text-ink';

const SORT_VALUES = ['lineup', 'skill', 'birthdate'] as const satisfies readonly RosterSort[];

/** ISO birthdate with the current age beside it, or an em dash when unknown. */
function BornCell({ dob }: { dob: string }) {
  const t = useT().teams.roster;
  const age = ageFromDob(dob);
  if (age === null) return <>—</>;
  return (
    <>
      <span className="tabular-nums">{dob}</span>
      <span className="text-slate"> · {t.age(age)}</span>
    </>
  );
}

interface TeamRosterTableProps {
  teamId: string;
  /** The team's grammatical gender, for position wording in Italian. */
  gender?: Gender;
  onPlayersChange?: (players: Player[]) => void;
  /** Fired after a player is removed, so a parent can surface a notice. */
  onRosterChanged?: () => void;
}

export function TeamRosterTable({ teamId, gender = 'mixed', onPlayersChange, onRosterChanged }: TeamRosterTableProps) {
  const t = useT();
  const lb = t.labels;
  const tr = t.teams.roster;
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
      setStartingError(tr.startingError);
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
      setDeleteError(tr.removeError);
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
          <span className="sr-only">{tr.searchLabel}</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr.searchPlaceholder}
            className={`${FIELD_CLASS} w-full text-base sm:text-sm`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate">
          {tr.sort}
          <select
            aria-label={tr.sortAria}
            value={sort}
            onChange={(e) => setSort(e.target.value as RosterSort)}
            className={`${FIELD_CLASS} px-2 text-base sm:text-sm`}
          >
            {SORT_VALUES.map((value) => (
              <option key={value} value={value}>
                {{ lineup: tr.sortLineup, skill: tr.sortSkill, birthdate: tr.sortBirthdate }[value]}
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

      {/* Below xl (<1280px): a card per player — one column on phones, two
          from `sm`. The table needs ~740px of card width, which it only gets
          at xl (the sidebar eats the room at lg), so anything narrower would
          scroll sideways (design system §UX table guidance). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:hidden">
        {visiblePlayers.map((player) => (
          <div
            key={player.id}
            data-testid="roster-mobile-card"
            className="rounded-lg border border-border bg-surface p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                to={`/teams/${teamId}/players/${player.id}`}
                className="flex min-w-0 items-baseline gap-2 active:opacity-70"
              >
                {player.number != null && (
                  <span className="shrink-0 tabular-nums text-sm font-semibold text-slate">
                    {`#${player.number}`}
                  </span>
                )}
                <span className="font-medium text-ink">{player.fullName}</span>
              </Link>
              <LevelPill level={player.level} gender={gender} />
            </div>

            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate">{tr.position}</dt>
              <dd className="text-ink">{lb.position[player.positionCategory](gender)}</dd>

              <dt className="text-slate">{tr.born}</dt>
              <dd className="text-ink">
                <BornCell dob={player.dob ?? ''} />
              </dd>

              <dt className="text-slate">{tr.skillAvg}</dt>
              <dd className="tabular-nums text-ink">{player.avgScore != null ? formatNumber(player.avgScore, 1) : '—'}</dd>
            </dl>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={player.starting}
                  onChange={(e) => void toggleStarting(player, e.target.checked)}
                />
                <span className="sr-only">{tr.startingFor(player.fullName)}</span>
                <span aria-hidden="true">{tr.starting}</span>
              </label>
              <Button
                variant="dangerGhost"
                size="sm"
                onClick={() => setPendingDelete(player)}
                aria-label={tr.removeAria(player.fullName)}
              >
                {tr.remove}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {visiblePlayers.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-4 text-center text-sm text-slate shadow-card">
          {players.length === 0 ? tr.none : tr.noMatch}
        </p>
      )}

      {/* Wide desktop (>=1280px): the full table. `relative` keeps the header's
          absolutely-positioned sr-only text inside this box, not the page. */}
      <div className="relative hidden overflow-x-auto rounded-lg border border-border bg-surface shadow-card xl:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">{tr.startCol}</th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">{tr.nameCol}</th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">
                {tr.position}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">
                {tr.born}
              </th>
              <th scope="col" className={`${NUMERIC_HEADER_CLASS} whitespace-nowrap`}>{tr.skillAvg}</th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate">{tr.level}</th>
              <th scope="col" className="px-3 py-2 text-right">
                <span className="sr-only">{tr.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visiblePlayers.map((player) => (
              <tr key={player.id} className="border-b border-border last:border-b-0 hover:bg-bg">
                <td className="px-3 py-2">
                  <label className="inline-flex items-center">
                    <span className="sr-only">{tr.startingFor(player.fullName)}</span>
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
                  <span className="block max-w-[10rem] truncate">{lb.position[player.positionCategory](gender)}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-ink">
                  <BornCell dob={player.dob ?? ''} />
                </td>
                <td className={NUMERIC_CELL_CLASS}>{player.avgScore != null ? formatNumber(player.avgScore, 1) : '—'}</td>
                <td className="px-3 py-2">
                  <LevelPill level={player.level} gender={gender} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="dangerGhost"
                    size="sm"
                    onClick={() => setPendingDelete(player)}
                    aria-label={tr.removeAria(player.fullName)}
                  >
                    {tr.remove}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <Button variant="secondary" onClick={() => void loadMore()} className="mt-4">
          {t.teams.shared.loadMore}
        </Button>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={tr.removeTitle(pendingDelete.fullName)}
          message={tr.removeMessage}
          confirmLabel={tr.removeConfirm}
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
