import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { focusPageHeading } from '../layout/focusPageHeading';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Sheet } from '../components/Sheet';
import { SkeletonBlock } from '../components/Skeleton';
import { useMediaQuery } from '../components/useMediaQuery';
import { useT } from '../i18n/I18nProvider';
import { actionItems, goToItems, teamActionPath } from './localSources';
import { rankItems } from './match';
import { withPendingAction } from './pendingAction';
import { pushRecent, readRecents, searchKey, type Recent } from './recents';
import type { SearchGroupId, SearchItem } from './types';
import { useSearchData } from './useSearchData';
import { useServerSearch, type ServerGroupState } from './useServerSearch';

const GROUP_CAP = 5;

interface ViewGroup {
  id: SearchGroupId;
  label: string;
  /** Every matching item; the view shows the first few unless expanded. */
  items: SearchItem[];
  /** Placeholder rows while the group's data is still loading. */
  skeleton: boolean;
  /** Exercises and trainings come from the server: no cap, they end with "Show more" instead. */
  server?: ServerGroupState;
}

type Entry = SearchItem & { more?: true };

interface Props {
  /** `restoreFocus` is false when the close is a navigation, whose new page owns focus. */
  onClose: (restoreFocus?: boolean) => void;
}

export function SearchPalette({ onClose }: Props) {
  const t = useT().search;
  const { access, isPlatformAdmin, activeClubId, appUser } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const wide = useMediaQuery('(min-width: 768px)', true);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<SearchGroupId>>(() => new Set());
  const [picking, setPicking] = useState<SearchItem | null>(null);
  const [announce, setAnnounce] = useState('');
  const q = query.trim();

  const data = useSearchData({ opened: true, typed: q.length > 0 });
  const canExercises = !!access?.sections.exercises;
  const canTrainings = !!access?.sections.trainings;
  // No query is sent for a section the person lacks (the rules would reject it), nor while picking a team.
  const server = useServerSearch(picking ? '' : q, { exercises: canExercises, trainings: canTrainings });
  const recentsKey = searchKey(activeClubId, appUser?.email);
  const recents = useMemo<Recent[]>(() => (activeClubId ? readRecents(recentsKey) : []), [activeClubId, recentsKey]);

  const actions = useMemo(
    () => actionItems(access, false, data.teams.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [access, data.teams.length],
  );
  const goto = useMemo(() => goToItems(access, isPlatformAdmin), [access, isPlatformAdmin]);

  const recentIdsFor = (group: SearchGroupId) =>
    recents.filter((r) => r.group === group).map((r) => r.id.slice(group.length + 1));

  const offline = server.offline;
  const anyLoading =
    data.loading.teams || data.loading.players || data.loading.matches || server.exercises.loading || server.trainings.loading;

  const { groups, noResults } = useMemo(() => {
    const label = (id: keyof typeof t.groups) => t.groups[id];
    const out: ViewGroup[] = [];
    if (picking) {
      const teams = q ? rankItems(q, data.teams, recentIdsFor('teams')) : data.teams;
      out.push({ id: 'teams', label: t.chooseTeam, items: teams, skeleton: data.loading.teams && teams.length === 0 });
      return { groups: out, noResults: false };
    }
    if (!q) {
      if (recents.length > 0) {
        out.push({
          id: 'recent',
          label: label('recent'),
          items: recents.map((r) => ({ id: r.id, group: 'recent', label: r.label, sublabel: r.sublabel, to: r.to })),
          skeleton: false,
        });
      }
      out.push({ id: 'goto', label: label('goto'), items: goto, skeleton: false });
      return { groups: out, noResults: false };
    }
    const ranked = (id: SearchGroupId, items: SearchItem[]) => rankItems(q, items, recentIdsFor(id));
    const defs: [SearchGroupId, keyof typeof t.groups, SearchItem[], boolean][] = [
      ['goto', 'goto', goto, false],
      ['actions', 'actions', actions, false],
      ['teams', 'teams', data.teams, data.loading.teams],
      ['players', 'players', data.players, data.loading.players],
      ['matches', 'matches', data.matches, data.loading.matches],
    ];
    for (const [id, name, items, loading] of defs) {
      const matched = ranked(id, items);
      if (matched.length > 0 || loading) out.push({ id, label: label(name), items: matched, skeleton: loading && matched.length === 0 });
    }
    const serverDefs: [SearchGroupId, keyof typeof t.groups, ServerGroupState][] = [
      ['exercises', 'exercises', server.exercises],
      ['trainings', 'trainings', server.trainings],
    ];
    for (const [id, name, s] of serverDefs) {
      if (s.items.length > 0 || s.loading || s.hasMore) out.push({ id, label: label(name), items: s.items, skeleton: s.loading && s.items.length === 0, server: s });
    }
    if (out.length === 0) {
      return { groups: actions.length > 0 ? [{ id: 'actions' as const, label: label('actions'), items: actions, skeleton: false }] : [], noResults: true };
    }
    return { groups: out, noResults: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, picking, data, server, goto, actions, recents]);

  const isCapped = (g: ViewGroup) => !g.server && !picking && !expanded.has(g.id) && g.items.length > GROUP_CAP;
  // A capped group ends with a "Show all N" row that is a real option, so keyboard users can reach it.
  const visible = (g: ViewGroup): Entry[] =>
    g.server
      ? g.server.hasMore
        ? [...g.items, { id: `more:${g.id}`, group: g.id, label: t.showMore, more: true }]
        : g.items
      : isCapped(g)
      ? [...g.items.slice(0, GROUP_CAP), { id: `more:${g.id}`, group: g.id, label: t.showAll(g.items.length), more: true }]
      : g.items;
  const flat = groups.flatMap((g) => visible(g));
  const groupStarts: number[] = [];
  {
    let n = 0;
    for (const g of groups) {
      const count = visible(g).length;
      if (count > 0) groupStarts.push(n);
      n += count;
    }
  }
  const activeIndex = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);
  const optionId = (i: number) => `${listId}-opt-${i}`;
  const matchTotal = noResults ? 0 : groups.reduce((n, g) => n + g.items.length, 0);

  useEffect(() => {
    if (!q || anyLoading) return;
    const id = setTimeout(() => setAnnounce(t.results(matchTotal)), 300);
    return () => clearTimeout(id);
  }, [q, anyLoading, matchTotal, t]);

  useEffect(() => {
    // The phone sheet focuses its own panel after mount; take focus back for the field.
    inputRef.current?.focus();
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  function choose(item: Entry) {
    if (item.more) {
      const serverGroup = groups.find((g) => g.id === item.group)?.server;
      if (serverGroup) {
        serverGroup.showMore();
        return;
      }
      setExpanded(new Set([...expanded, item.group]));
      return;
    }
    if (picking) {
      const action = picking.action;
      onClose(false);
      if (action) navigate(teamActionPath(action, item.id), withPendingAction(action));
      return;
    }
    if (item.pick) {
      setPicking(item);
      setQuery('');
      setActive(0);
      return;
    }
    if (activeClubId && item.to && item.group !== 'actions') {
      const recent =
        item.group === 'recent'
          ? recents.find((r) => r.id === item.id)
          : { id: `${item.group}:${item.id}`, group: item.group, label: item.label, sublabel: item.sublabel, to: item.to };
      if (recent) pushRecent(recentsKey, recent);
    }
    onClose(false);
    if (item.run) item.run();
    else if (item.to) {
      navigate(item.to, item.action ? withPendingAction(item.action) : undefined);
      // The shell moves focus on a route change; a result for the page we are already on changes no route, so do it here.
      if (item.to.split(/[?#]/)[0] === pathname) setTimeout(() => focusPageHeading(document.getElementById('main')), 0);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const n = flat.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (n > 0) setActive((activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
    } else if (e.key === 'Enter') {
      const item = flat[activeIndex];
      if (!item) return;
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        if (item.to && !picking) {
          window.open(item.to, '_blank', 'noopener');
          onClose();
        }
        return;
      }
      choose(item);
    } else if (e.key === 'Escape') {
      // Handled here so a surrounding phone sheet does not also close.
      e.preventDefault();
      e.stopPropagation();
      if (query) {
        setQuery('');
        setActive(0);
      } else if (picking) {
        setPicking(null);
        setActive(0);
      } else {
        onClose();
      }
    } else if (e.key === 'Tab') {
      // Always trapped, even with no groups: Tab never falls through to the page behind the palette.
      e.preventDefault();
      e.stopPropagation();
      if (groupStarts.length === 0) return;
      const idx = Math.max(0, activeIndex);
      if (e.shiftKey) {
        const before = groupStarts.filter((s) => s < idx);
        setActive(before.length > 0 ? before[before.length - 1] : groupStarts[groupStarts.length - 1]);
      } else {
        setActive(groupStarts.find((s) => s > idx) ?? groupStarts[0]);
      }
    }
  }

  let counter = -1;
  const body = (
    <div data-search-palette className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-separator px-4">
        <Search size={18} className="shrink-0 text-ink-3" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          aria-label={t.title}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={t.placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setExpanded(new Set());
          }}
          onKeyDown={onKeyDown}
          className="h-12 min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-3 focus:outline-none"
        />
      </div>
      {noResults && (
        <p className="px-4 pt-3 text-callout text-ink-2">
          {t.noResults(q)}
        </p>
      )}
      <div
        id={listId}
        role="listbox"
        aria-label={t.title}
        onMouseDown={(e) => e.preventDefault()}
        className="max-h-[min(60vh,28rem)] min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
      >
        {picking && !data.loading.teams && data.teams.length === 0 && (
          <p role="presentation" className="px-3 py-3 text-callout text-ink-2">
            {t.noTeams}
          </p>
        )}
        {groups.map((g) => {
          const shown = visible(g);
          return (
            <div key={g.id} role="presentation" className="pb-1">
              <div role="presentation" className="px-3 pb-1 pt-2 text-caption text-ink-2">
                {g.label}
              </div>
              {shown.map((item: Entry) => {
                counter++;
                const i = counter;
                const Icon = item.icon;
                const isActive = i === activeIndex;
                return (
                  <div
                    key={`${item.group}:${item.id}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => choose(item)}
                    onMouseMove={() => !isActive && setActive(i)}
                    className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-3 py-2 ${isActive ? 'bg-surface-2' : ''}`}
                  >
                    {Icon && <Icon size={18} className="shrink-0 text-ink-3" aria-hidden="true" />}
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-body ${item.more ? 'text-ink-2' : 'text-ink'}`}>{item.label}</span>
                      {item.sublabel && <span className="block truncate text-footnote text-ink-2">{item.sublabel}</span>}
                    </span>
                    {item.more && <ChevronDown size={16} className="shrink-0 text-ink-3" aria-hidden="true" />}
                    {item.pick && <ChevronRight size={16} className="shrink-0 text-ink-3" aria-hidden="true" />}
                  </div>
                );
              })}
              {g.skeleton && (
                <div aria-hidden="true" className="flex flex-col gap-2 px-3 py-2">
                  <SkeletonBlock className="h-8 w-full" />
                  <SkeletonBlock className="h-8 w-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {offline && q && !picking && (canExercises || canTrainings) && (
        <p role="note" className="border-t border-separator px-4 py-2 text-footnote text-ink-2">
          {t.offlineNote}
        </p>
      )}
      <div aria-live="polite" role="status" className="sr-only">
        {q ? announce : ''}
      </div>
    </div>
  );

  if (!wide) {
    return (
      <Sheet title={t.title} onClose={() => onClose()} detent="large">
        {body}
      </Sheet>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/20" onMouseDown={() => onClose()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        className="glass glass-pop fixed left-1/2 top-[18vh] z-50 flex max-h-[70vh] w-[640px] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-xl"
      >
        {body}
      </div>
    </>
  );
}

