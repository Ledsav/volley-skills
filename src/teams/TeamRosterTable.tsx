import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useContextMenu } from '../components/ContextMenu';
import { FIELD_CLASS } from '../components/Input';
import { LevelPill } from '../components/LevelPill';
import type { MenuItem } from '../components/Menu';
import { SwipeRow } from '../components/SwipeRow';
import { deletePlayer, listPlayers, setPlayerStarting } from '../players/playersApi';
import { ageFromDob } from '../players/age';
import { filterRoster, sortRoster, type RosterSort } from '../players/rosterSort';
import type { Player } from '../types/player';
import { formatNumber } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';

const SORT_VALUES = ['lineup', 'skill', 'birthdate'] as const satisfies readonly RosterSort[];
const TH_CLASS = 'sticky z-10 whitespace-nowrap bg-surface px-3 py-2 text-left text-caption text-ink-2';
// 52px toolbar plus the 64px pinned tab strip
const TH_STYLE = { top: 'calc(env(safe-area-inset-top, 0px) + 116px)' };
const SORT_BUTTON_CLASS =
  'min-h-11 cursor-pointer text-inherit focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** ISO birthdate with the current age beside it, or an em dash when unknown. */
function BornCell({ dob }: { dob: string }) {
  const t = useT().teams.roster;
  const age = ageFromDob(dob);
  if (age === null) return <>—</>;
  return (
    <>
      <span className="tabular-nums">{dob}</span>
      <span className="text-ink-2"> · {t.age(age)}</span>
    </>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

interface RowProps {
  teamId: string;
  player: Player;
  gender: Gender;
  onToggleStarting: (player: Player, starting: boolean) => void;
  onRemove: (player: Player) => void;
}

/** Open card, Starting and Remove: the same actions in the phone kebab, long-press, right-click and the desktop row. */
function useRowActions({ teamId, player, onToggleStarting, onRemove }: RowProps) {
  const tr = useT().teams.roster;
  const navigate = useNavigate();
  const items: MenuItem[] = [
    { kind: 'action', label: tr.openCard, onSelect: () => navigate(`/teams/${teamId}/players/${player.id}`) },
    {
      kind: 'action',
      label: player.starting ? tr.unsetStarting : tr.setStarting,
      onSelect: () => onToggleStarting(player, !player.starting),
    },
    { kind: 'divider' },
    { kind: 'action', label: tr.removeMenu, danger: true, onSelect: () => onRemove(player) },
  ];
  return useContextMenu({ label: tr.rowMenu(player.fullName), items });
}

/** A phone / tablet row: grouped list item with swipe (right: Starting, left: Remove), kebab and long-press menu. */
function RosterPhoneRow(props: RowProps) {
  const { teamId, player, gender, onToggleStarting, onRemove } = props;
  const t = useT();
  const tr = t.teams.roster;
  const { targetProps, menu } = useRowActions(props);
  const age = ageFromDob(player.dob ?? '');
  const subtitle = [
    t.labels.position[player.positionCategory](gender),
    player.number != null ? `#${player.number}` : null,
    age !== null ? tr.age(age) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li data-testid="roster-mobile-card" className="group" {...targetProps}>
      <SwipeRow
        leading={{
          label: player.starting ? tr.unsetStarting : tr.setStarting,
          tone: 'neutral',
          undoable: true,
          onAction: () => onToggleStarting(player, !player.starting),
        }}
        trailing={[{ label: tr.removeMenu, tone: 'destructive', undoable: false, onAction: () => onRemove(player) }]}
      >
        <div className="relative flex min-h-[52px] items-center gap-2 pl-4 pr-1 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator group-first:before:hidden">
          <Link
            to={`/teams/${teamId}/players/${player.id}`}
            className="flex min-w-0 flex-1 items-center gap-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3 text-footnote font-semibold text-ink-2"
            >
              {initials(player.fullName)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-headline text-ink">{player.fullName}</span>
              <span className="truncate text-footnote tabular-nums text-ink-2">{subtitle}</span>
            </span>
          </Link>
          {player.starting && (
            <span className="shrink-0 rounded-full bg-surface-3 px-2 text-caption text-ink">{tr.starting}</span>
          )}
          <span className="shrink-0 text-callout tabular-nums text-ink-2">
            {player.avgScore != null ? formatNumber(player.avgScore, 1) : '—'}
          </span>
          <LevelPill level={player.level} gender={gender} />
          {/* Opens the context menu (a portal), so the grouped list's rounded clip never cuts it off. */}
          <button
            type="button"
            aria-label={tr.rowMenu(player.fullName)}
            aria-haspopup="menu"
            onClick={(e) => targetProps.onContextMenu?.(e)}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <MoreHorizontal size={20} aria-hidden="true" />
          </button>
        </div>
      </SwipeRow>
      {menu}
    </li>
  );
}

/** A desktop table row; keeps the Starting checkbox, and right-click offers the same actions. */
function RosterTableRow(props: RowProps) {
  const { teamId, player, gender, onToggleStarting, onRemove } = props;
  const t = useT();
  const tr = t.teams.roster;
  const { targetProps, menu } = useRowActions(props);
  return (
    <tr {...targetProps} className="h-[52px] min-h-[52px] hover:bg-surface-2">
      <td className="px-3 py-2">
        <label className="inline-flex items-center">
          <span className="sr-only">{tr.startingFor(player.fullName)}</span>
          <input type="checkbox" checked={player.starting} onChange={(e) => onToggleStarting(player, e.target.checked)} />
        </label>
      </td>
      <td className="px-3 py-2">
        <Link to={`/teams/${teamId}/players/${player.id}`} className="text-headline text-ink hover:underline">
          {player.fullName}
        </Link>
      </td>
      <td className="px-3 py-2 text-callout text-ink">
        <span className="block max-w-[10rem] truncate">{t.labels.position[player.positionCategory](gender)}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-callout text-ink">
        <BornCell dob={player.dob ?? ''} />
      </td>
      <td className="px-3 py-2 text-right text-callout tabular-nums text-ink">
        {player.avgScore != null ? formatNumber(player.avgScore, 1) : '—'}
      </td>
      <td className="px-3 py-2">
        <LevelPill level={player.level} gender={gender} />
      </td>
      <td className="px-3 py-2 text-right">
        <Button variant="dangerGhost" size="sm" onClick={() => onRemove(player)} aria-label={tr.removeAria(player.fullName)}>
          {tr.remove}
        </Button>
        {menu}
      </td>
    </tr>
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

  const rowProps = (player: Player): RowProps => ({
    teamId,
    player,
    gender,
    onToggleStarting: (p, starting) => void toggleStarting(p, starting),
    onRemove: setPendingDelete,
  });
  const ariaSort = (value: RosterSort): 'ascending' | 'descending' | undefined =>
    sort === value ? (value === 'skill' ? 'descending' : 'ascending') : undefined;

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
        <label className="flex items-center gap-2 text-callout text-ink-2 xl:hidden">
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
        <p role="alert" className="mb-3 text-callout text-red-strong">
          {startingError}
        </p>
      )}

      {/* Below xl (<1280px): grouped rows. The table needs ~740px of card width, which it only gets at xl
          (the sidebar eats the room at lg), so anything narrower would scroll sideways. */}
      {visiblePlayers.length > 0 && (
        <ul className="overflow-hidden rounded-lg bg-surface shadow-card xl:hidden">
          {visiblePlayers.map((player) => (
            <RosterPhoneRow key={player.id} {...rowProps(player)} />
          ))}
        </ul>
      )}

      {visiblePlayers.length === 0 && (
        <p className="rounded-lg bg-surface p-4 text-center text-callout text-ink-2 shadow-card">
          {players.length === 0 ? tr.none : tr.noMatch}
        </p>
      )}

      {/* Wide desktop (>=1280px): the full table. `relative` keeps the header's absolutely-positioned sr-only text
          inside this box, not the page. Headers stick under the toolbar and the pinned tab strip. */}
      <div className="relative hidden rounded-lg bg-surface shadow-card xl:block">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th scope="col" aria-sort={ariaSort('lineup')} className={TH_CLASS} style={TH_STYLE}>
                <button type="button" onClick={() => setSort('lineup')} className={SORT_BUTTON_CLASS}>
                  {tr.startCol}
                </button>
              </th>
              <th scope="col" className={TH_CLASS} style={TH_STYLE}>
                {tr.nameCol}
              </th>
              <th scope="col" className={TH_CLASS} style={TH_STYLE}>
                {tr.position}
              </th>
              <th scope="col" aria-sort={ariaSort('birthdate')} className={TH_CLASS} style={TH_STYLE}>
                <button type="button" onClick={() => setSort('birthdate')} className={SORT_BUTTON_CLASS}>
                  {tr.born}
                </button>
              </th>
              <th scope="col" aria-sort={ariaSort('skill')} className={`${TH_CLASS} text-right`} style={TH_STYLE}>
                <button type="button" onClick={() => setSort('skill')} className={SORT_BUTTON_CLASS}>
                  {tr.skillAvg}
                </button>
              </th>
              <th scope="col" className={TH_CLASS} style={TH_STYLE}>
                {tr.level}
              </th>
              <th scope="col" className={`${TH_CLASS} text-right`} style={TH_STYLE}>
                <span className="sr-only">{tr.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-separator">
            {visiblePlayers.map((player) => (
              <RosterTableRow key={player.id} {...rowProps(player)} />
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
