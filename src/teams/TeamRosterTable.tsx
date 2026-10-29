import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useContextMenu } from '../components/ContextMenu';
import { FIELD_CLASS } from '../components/Input';
import { Select } from '../components/Select';
import { GroupedList } from '../components/GroupedList';
import { LevelPill } from '../components/LevelPill';
import type { MenuItem } from '../components/Menu';
import { SwipeRow } from '../components/SwipeRow';
import { deletePlayer, listPlayers, setPlayerStarting } from '../players/playersApi';
import { ageFromDob } from '../players/age';
import { filterRoster, positionGroupKey, sortRoster, type RosterSort } from '../players/rosterSort';
import { stickyTop } from '../layout/chromeMetrics';
import type { Level, Player, PositionCategory } from '../types/player';
import { formatDate, formatNumber } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';

const SORT_VALUES = ['lineup', 'position', 'skill', 'birthdate'] as const satisfies readonly RosterSort[];
const TH_CLASS = 'sticky z-10 whitespace-nowrap bg-surface px-3 py-2 text-left text-caption text-ink-2';
// Under the toolbar and the pinned tab strip
const TH_STYLE = { top: stickyTop('teamTabs') };
const SORT_BUTTON_CLASS =
  'min-h-11 cursor-pointer text-inherit focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';

const LEVEL_BAR_CLASS: Record<Level, string> = {
  Beginner: 'bg-red',
  Developing: 'bg-orange',
  Advanced: 'bg-blue',
  Elite: 'bg-green',
};

/** Decorative average-skill meter: the fill is avgScore out of 10 in the level colour; an empty track when unrated. */
function AvgSkillBar({ avgScore, level, className = 'w-8' }: { avgScore: number | null | undefined; level: Level | null; className?: string }) {
  const pct = avgScore == null ? 0 : Math.max(0, Math.min(100, (avgScore / 10) * 100));
  return (
    <span aria-hidden="true" data-testid="avg-skill-bar" className={`block h-1 shrink-0 overflow-hidden rounded-full bg-surface-3 ${className}`}>
      <span
        data-testid="avg-skill-fill"
        className={`block h-full rounded-full ${level ? LEVEL_BAR_CLASS[level] : 'bg-ink-3'}`}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

/** ISO birthdate with the current age beside it, or an em dash when unknown. */
function BornCell({ dob }: { dob: string }) {
  const t = useT().teams.roster;
  const age = ageFromDob(dob);
  if (age === null) return <>—</>;
  return (
    <>
      <span className="tabular-nums" title={dob}>{formatDate(dob, 'short')}</span>
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

/** The row's ⋯ button: opens the same menu as long-press and right-click (a portal, so no list clip cuts it off). */
function RowMenuButton({ name, isOpen, closeMenu, open }: { name: string; isOpen: boolean; closeMenu: () => void; open: (e: MouseEvent<HTMLButtonElement>) => void }) {
  const tr = useT().teams.roster;
  const openAtPress = useRef<boolean | null>(null);
  return (
    <button
      type="button"
      aria-label={tr.rowMenu(name)}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      onPointerDown={() => (openAtPress.current = isOpen)}
      onClick={(e) => {
        // A press outside the menu already closed it, so a kebab press while open must stay closed.
        const wasOpen = openAtPress.current ?? isOpen;
        openAtPress.current = null;
        if (wasOpen) closeMenu();
        else open(e);
      }}
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <MoreHorizontal size={20} aria-hidden="true" />
    </button>
  );
}

/** A phone / tablet row: grouped list item with swipe (right: Starting, left: Remove), kebab and long-press menu. */
function RosterPhoneRow(props: RowProps) {
  const { teamId, player, gender, onToggleStarting, onRemove } = props;
  const t = useT();
  const tr = t.teams.roster;
  const { targetProps, menu, isOpen, closeMenu } = useRowActions(props);
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
        {/* Name budget at 360px (list 328px): 328 - 16 (pl-4) - 8 (two gap-1) - 44 (kebab) - 92 (widest pill, Italian) - 46 (avatar 36 + gap 10) = 122px. */}
        <div className="relative flex min-h-[52px] items-center gap-1 pl-4 pr-0 before:absolute before:left-[62px] before:right-0 before:top-0 before:h-px before:bg-separator group-first:before:hidden">
          <Link
            to={`/teams/${teamId}/players/${player.id}`}
            className="flex min-w-0 flex-1 items-center gap-2.5 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-footnote font-semibold text-ink-2"
            >
              {initials(player.fullName)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-headline text-ink">{player.fullName}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                {player.starting && (
                  <span className="shrink-0 rounded-full bg-surface-3 px-2 text-caption text-ink">{tr.starting}</span>
                )}
                <span className="truncate text-footnote tabular-nums text-ink-2">{subtitle}</span>
              </span>
            </span>
          </Link>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <LevelPill level={player.level} gender={gender} />
            <span className="flex items-center gap-1.5">
              <span className="text-callout tabular-nums text-ink-2">
                {player.avgScore != null ? formatNumber(player.avgScore, 1) : '—'}
              </span>
              <AvgSkillBar avgScore={player.avgScore} level={player.level} />
            </span>
          </span>
          <RowMenuButton name={player.fullName} isOpen={isOpen} closeMenu={closeMenu} open={(e) => targetProps.onContextMenu?.(e)} />
        </div>
      </SwipeRow>
      {menu}
    </li>
  );
}

/** A desktop table row: the Starter checkbox, then the facts; Remove lives in the row's ⋯ menu (and right-click). */
function RosterTableRow(props: RowProps) {
  const { teamId, player, gender, onToggleStarting } = props;
  const t = useT();
  const tr = t.teams.roster;
  const { targetProps, menu, isOpen, closeMenu } = useRowActions(props);
  return (
    <tr {...targetProps} className="h-[52px] min-h-[52px] hover:bg-surface-2">
      <td className="px-3 py-1 text-center">
        <label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center">
          <span className="sr-only">{tr.startingFor(player.fullName)}</span>
          <input type="checkbox" checked={player.starting} onChange={(e) => onToggleStarting(player, e.target.checked)} />
        </label>
      </td>
      <td className="w-12 px-3 py-2 text-right text-callout tabular-nums text-ink-2">{player.number ?? '—'}</td>
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
      <td className="px-3 py-2 text-callout tabular-nums text-ink">
        <span className="flex items-center justify-end gap-2">
          <AvgSkillBar avgScore={player.avgScore} level={player.level} className="w-12" />
          {player.avgScore != null ? formatNumber(player.avgScore, 1) : '—'}
        </span>
      </td>
      <td className="px-3 py-2">
        <LevelPill level={player.level} gender={gender} />
      </td>
      <td className="w-14 py-1 pl-1 pr-2 text-right">
        <RowMenuButton name={player.fullName} isOpen={isOpen} closeMenu={closeMenu} open={(e) => targetProps.onContextMenu?.(e)} />
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

  // Under the Position sort the list splits into one group per position (already adjacent after sorting).
  const groups = useMemo(() => {
    if (sort !== 'position') return null;
    const out: { key: PositionCategory; players: Player[] }[] = [];
    for (const player of visiblePlayers) {
      const key = positionGroupKey(player.positionCategory);
      const last = out[out.length - 1];
      if (last && last.key === key) last.players.push(player);
      else out.push({ key, players: [player] });
    }
    return out;
  }, [sort, visiblePlayers]);

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
            className={`${FIELD_CLASS} w-full`}
          />
        </label>
        <label className="flex items-center gap-2 text-callout text-ink-2 xl:hidden">
          {tr.sort}
          <Select
            aria-label={tr.sortAria}
            value={sort}
            onChange={(e) => setSort(e.target.value as RosterSort)}
            className="w-auto"
          >
            {SORT_VALUES.map((value) => (
              <option key={value} value={value}>
                {{ lineup: tr.sortLineup, position: tr.sortPosition, skill: tr.sortSkill, birthdate: tr.sortBirthdate }[value]}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {startingError && (
        <p role="alert" className="mb-3 text-callout text-red-strong">
          {startingError}
        </p>
      )}

      {/* Below xl (<1280px): grouped rows. The table needs ~740px of card width, which it only gets at xl
          (the sidebar eats the room at lg), so anything narrower would scroll sideways. */}
      {visiblePlayers.length > 0 && groups && (
        <div className="flex flex-col gap-4 xl:hidden">
          {groups.map((group) => (
            <GroupedList key={group.key} header={t.teams.roster.positionGroup[group.key](gender)}>
              {group.players.map((player) => (
                <RosterPhoneRow key={player.id} {...rowProps(player)} />
              ))}
            </GroupedList>
          ))}
        </div>
      )}
      {visiblePlayers.length > 0 && !groups && (
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
              <th scope="col" aria-sort={ariaSort('lineup')} className={`${TH_CLASS} rounded-tl-lg text-center`} style={TH_STYLE}>
                <button type="button" onClick={() => setSort('lineup')} title={tr.startColHint} className={SORT_BUTTON_CLASS}>
                  {tr.startCol}
                </button>
              </th>
              <th scope="col" className={`${TH_CLASS} text-right`} style={TH_STYLE}>
                <span aria-hidden="true">#</span>
                <span className="sr-only">{tr.numberCol}</span>
              </th>
              <th scope="col" className={TH_CLASS} style={TH_STYLE}>
                {tr.nameCol}
              </th>
              <th scope="col" aria-sort={ariaSort('position')} className={TH_CLASS} style={TH_STYLE}>
                <button type="button" onClick={() => setSort('position')} className={SORT_BUTTON_CLASS}>
                  {tr.position}
                </button>
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
              <th scope="col" className={`${TH_CLASS} rounded-tr-lg text-right`} style={TH_STYLE}>
                <span className="sr-only">{tr.actions}</span>
              </th>
            </tr>
          </thead>
          {groups ? (
            groups.map((group) => (
              <tbody key={group.key} className="divide-y divide-separator">
                <tr>
                  <th scope="rowgroup" colSpan={8} className="bg-surface-2 px-3 py-2 text-left text-caption text-ink-2">
                    {tr.positionGroup[group.key](gender)}
                  </th>
                </tr>
                {group.players.map((player) => (
                  <RosterTableRow key={player.id} {...rowProps(player)} />
                ))}
              </tbody>
            ))
          ) : (
            <tbody className="divide-y divide-separator">
              {visiblePlayers.map((player) => (
                <RosterTableRow key={player.id} {...rowProps(player)} />
              ))}
            </tbody>
          )}
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
