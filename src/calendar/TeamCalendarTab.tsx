import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Trophy } from 'lucide-react';
import { Button } from '../components/Button';
import { useContextMenu } from '../components/ContextMenu';
import { useUndoable } from '../components/Notice';
import { SwipeRow } from '../components/SwipeRow';
import { useMediaQuery } from '../components/useMediaQuery';
import { usePublishPageChrome } from '../layout/PageChrome';
import { useTakePendingAction } from '../search/pendingAction';
import { listMatchesInRange } from '../matches/matchesApi';
import type { Match } from '../types/match';
import type { CalendarSession } from '../types/calendarSession';
import { AssignTrainingDialog } from './AssignTrainingDialog';
import { CalendarSessionSheet } from './CalendarSessionSheet';
import { deleteCalendarSession, getCalendarSession, listCalendarSessions } from './calendarApi';
import { sessionLabel } from './sessionLabels';
import {
  addMonths,
  buildMonthGrid,
  formatDayLabel,
  formatWeekRange,
  monthRange,
  shiftDate,
  todayIso,
} from './monthGrid';
import { monthNames, weekdayNames } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';
import type { Catalog } from '../i18n/catalog';

const MAX_DOTS = 3;

type Grid = ReturnType<typeof buildMonthGrid>;
type SessionsByDate = Record<string, CalendarSession[]>;

interface ViewProps {
  grid: Grid;
  todayStr: string;
  sessionsByDate: SessionsByDate;
  onAdd: (date: string) => void;
  onOpen: (session: CalendarSession) => void;
  onRemove: (session: CalendarSession) => void;
  teamId: string;
  matchesByDate: Record<string, Match[]>;
  onNewMatch?: (date: string) => void;
}

/** Today if it falls in the viewed month, otherwise the month's first day. */
function defaultSelection(year: number, month: number): string {
  const today = todayIso();
  const { start, end } = monthRange(year, month);
  return today >= start && today <= end ? today : start;
}

function matchLabel(m: Match, t: Catalog): string {
  return m.status === 'setup' ? t.calendar.tab.matchVs(m.opponent) : t.calendar.tab.matchResult(m.opponent, m.result.setsUs, m.result.setsThem);
}

function MatchChip({ teamId, match, touch = false }: { teamId: string; match: Match; touch?: boolean }) {
  const t = useT();
  return (
    <Link
      to={`/teams/${teamId}/matches/${match.id}`}
      className={`block truncate rounded-full text-ink ring-1 ring-inset ring-ink hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        touch ? 'flex min-h-11 items-center px-4 text-callout' : 'px-2 text-caption'
      }`}
      title={matchLabel(match, t)}
    >
      {matchLabel(match, t)}
    </Link>
  );
}

export function TeamCalendarTab({
  teamId,
  teamName,
  onNewMatch,
}: {
  teamId: string;
  teamName?: string;
  onNewMatch?: (date: string) => void;
}) {
  const t = useT();
  const c = t.calendar.tab;
  const undoable = useUndoable();
  const [params, setParams] = useSearchParams();
  const sessionParam = params.get('session');
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState(() => defaultSelection(view.year, view.month));
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [assignDate, setAssignDate] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [linked, setLinked] = useState<CalendarSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const mounted = useRef(true);

  // Only the newest load may write: a slow answer for an older month (or for the month a `?session=` link
  // replaced) must not overwrite the month now showing.
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const { start, end } = monthRange(view.year, view.month);
    try {
      const [sessionList, matchList] = await Promise.all([
        listCalendarSessions(teamId, start, end),
        listMatchesInRange(teamId, start, end).catch(() => [] as Match[]),
      ]);
      if (seq !== loadSeq.current) return;
      setSessions(sessionList);
      setMatches(matchList);
    } catch (e) {
      if (seq === loadSeq.current) throw e;
    }
  }, [teamId, view]);
  // A pending remove commits seconds later, maybe after the month changed: it must reload the month then showing.
  const loadRef = useRef(load);
  loadRef.current = load;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setError(null);
    load().catch(() => setError(c.loadError));
  }, [load, c]);

  const dropSessionParam = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('session');
        return next;
      },
      { replace: true }
    );
  }, [setParams]);

  // A `?session=` link: use the loaded month if it has the session, otherwise read that one document.
  useEffect(() => {
    if (!sessionParam) {
      setLinked(null);
      return;
    }
    if (sessionsRef.current.some((s) => s.id === sessionParam)) return;
    let cancelled = false;
    getCalendarSession(teamId, sessionParam)
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          dropSessionParam();
          return;
        }
        const [y, m] = found.date.split('-').map(Number);
        setLinked(found);
        setView({ year: y, month: m - 1 });
        setSelectedDate(found.date);
      })
      .catch(() => {
        if (!cancelled) dropSessionParam();
      });
    return () => {
      cancelled = true;
    };
  }, [sessionParam, teamId, dropSessionParam]);

  const visibleSessions = sessions.filter((s) => !hidden.has(s.id));
  const openSession =
    (sessionParam &&
      (visibleSessions.find((s) => s.id === sessionParam) ?? (linked?.id === sessionParam && !hidden.has(linked.id) ? linked : null))) ||
    null;

  const grid = buildMonthGrid(view.year, view.month);
  const todayStr = todayIso();
  const sessionsByDate = visibleSessions.reduce<SessionsByDate>((acc, session) => {
    (acc[session.date] ??= []).push(session);
    return acc;
  }, {});

  const matchesByDate = matches.reduce<Record<string, Match[]>>((acc, m) => {
    (acc[m.date] ??= []).push(m);
    return acc;
  }, {});

  function goToMonth(delta: number) {
    const next = addMonths(view.year, view.month, delta);
    setView(next);
    setSelectedDate(defaultSelection(next.year, next.month));
  }

  function goToToday() {
    const now = new Date();
    setView({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(todayIso());
  }

  function shiftWeek(direction: -1 | 1) {
    const next = shiftDate(selectedDate, 7 * direction);
    const year = Number(next.slice(0, 4));
    const month = Number(next.slice(5, 7)) - 1;
    if (year !== view.year || month !== view.month) setView({ year, month });
    setSelectedDate(next);
  }

  function setHiddenId(id: string, on: boolean) {
    setHidden((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openSessionSheet(s: CalendarSession) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('session', s.id);
        return next;
      },
      { replace: true }
    );
  }

  function requestRemove(s: CalendarSession) {
    setHiddenId(s.id, true);
    setError(null);
    if (sessionParam === s.id) dropSessionParam();
    undoable({
      message: c.removed(sessionLabel(s), s.date),
      commit: async () => {
        await deleteCalendarSession(teamId, s.id);
        // The delete worked: a failed reload is a load problem, never "could not remove" (that would unhide a deleted row).
        if (mounted.current) void loadRef.current().catch(() => mounted.current && setError(c.loadError));
      },
      onUndo: () => {
        if (mounted.current) setHiddenId(s.id, false);
      },
      onCommitError: () => {
        if (!mounted.current) return;
        setHiddenId(s.id, false);
        setError(c.removeError);
      },
    });
  }

  usePublishPageChrome({
    title: teamName,
    mainAction: { label: c.newSession, icon: Plus, onSelect: () => setAssignDate(selectedDate) },
  });
  useTakePendingAction('new-session', () => setAssignDate(selectedDate));

  const viewProps: ViewProps = {
    grid,
    todayStr,
    sessionsByDate,
    teamId,
    matchesByDate,
    onNewMatch,
    onAdd: setAssignDate,
    onOpen: openSessionSheet,
    onRemove: requestRemove,
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-title-2 text-ink">
          {monthNames()[view.month]} <span className="font-medium text-ink-2">{view.year}</span>
        </h2>
        <div className="flex items-center">
          <button
            type="button"
            aria-label={c.previousMonth}
            onClick={() => goToMonth(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="flex h-11 items-center rounded-md px-3 text-callout font-medium text-ink hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {c.today}
          </button>
          <button
            type="button"
            aria-label={c.nextMonth}
            onClick={() => goToMonth(1)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-callout text-red-strong">
          {error}
        </p>
      )}

      {isDesktop ? (
        <DesktopMonthGrid {...viewProps} />
      ) : (
        <MobileMonthView {...viewProps} selectedDate={selectedDate} onSelect={setSelectedDate} onShiftWeek={shiftWeek} />
      )}

      {assignDate && (
        <AssignTrainingDialog
          teamId={teamId}
          date={assignDate}
          onClose={() => setAssignDate(null)}
          onSaved={() => {
            setAssignDate(null);
            void load();
          }}
        />
      )}

      {openSession && (
        <CalendarSessionSheet teamId={teamId} session={openSession} onClose={dropSessionParam} onRemove={requestRemove} />
      )}
    </div>
  );
}

function useSessionMenu(session: CalendarSession, onOpen: (s: CalendarSession) => void, onRemove: (s: CalendarSession) => void) {
  const c = useT().calendar.tab;
  return useContextMenu({
    label: c.sessionMenu(sessionLabel(session)),
    items: [
      { kind: 'action', label: c.open, onSelect: () => onOpen(session) },
      { kind: 'divider' },
      { kind: 'action', label: c.remove, danger: true, onSelect: () => onRemove(session) },
    ],
  });
}

/** A session pill (desktop): opens the sheet; right-click offers Open and Remove. */
function SessionPill({ session, onOpen, onRemove }: { session: CalendarSession; onOpen: (s: CalendarSession) => void; onRemove: (s: CalendarSession) => void }) {
  const label = sessionLabel(session);
  const { targetProps, menu } = useSessionMenu(session, onOpen, onRemove);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(session)}
        title={label}
        aria-label={label}
        {...targetProps}
        className="block w-full truncate rounded-full bg-ink px-2 text-left text-caption text-on-ink hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {session.trainingName}
      </button>
      {menu}
    </li>
  );
}

/** A session in the phone agenda: tap opens the sheet; swipe left or long-press removes. */
function SessionRow({ session, onOpen, onRemove }: { session: CalendarSession; onOpen: (s: CalendarSession) => void; onRemove: (s: CalendarSession) => void }) {
  const c = useT().calendar.tab;
  const label = sessionLabel(session);
  const { targetProps, menu } = useSessionMenu(session, onOpen, onRemove);
  return (
    <li className="relative before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden">
      <SwipeRow trailing={[{ label: c.remove, tone: 'destructive', undoable: true, onAction: () => onRemove(session) }]}>
        <button
          type="button"
          aria-label={label}
          onClick={() => onOpen(session)}
          {...targetProps}
          className="flex min-h-[52px] w-full cursor-pointer flex-col justify-center bg-surface px-4 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus active:bg-surface-3"
        >
          <span className="truncate text-headline text-ink">{session.trainingName}</span>
          <span className="truncate text-footnote tabular-nums text-ink-2">
            {[session.trainingBusinessId, session.notes].filter(Boolean).join(' · ')}
          </span>
        </button>
      </SwipeRow>
      {menu}
    </li>
  );
}

const ADD_BUTTON_CLASS =
  'relative flex h-7 w-7 items-center justify-center rounded-md text-ink-2 before:absolute before:-inset-2 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100';

function DesktopMonthGrid({ grid, todayStr, sessionsByDate, onAdd, onOpen, onRemove, teamId, matchesByDate, onNewMatch }: ViewProps) {
  const t = useT();
  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-separator">
      {weekdayNames('short').map((d) => (
        <div key={d} className="bg-surface px-2 py-1.5 text-caption text-ink-2">
          {d}
        </div>
      ))}
      {grid.flat().map((cell) => {
        const isToday = cell.inMonth && cell.date === todayStr;
        const day = Number(cell.date.slice(-2));
        return (
          <div key={cell.date} className={`flex min-h-24 flex-col bg-surface p-1.5 ${cell.inMonth ? 'group' : ''}`}>
            {cell.inMonth ? (
              <>
                <div className="flex items-center justify-between gap-1">
                  <span
                    aria-label={isToday ? t.calendar.tab.todayDate(cell.date) : undefined}
                    className={
                      isToday
                        ? 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink text-caption font-semibold tabular-nums text-on-ink'
                        : 'inline-flex h-6 items-center px-1 text-caption tabular-nums text-ink-2'
                    }
                  >
                    {day}
                  </span>
                  <span className="flex items-center gap-1">
                    {onNewMatch && (
                      <button
                        type="button"
                        onClick={() => onNewMatch(cell.date)}
                        aria-label={t.calendar.tab.addMatchOn(cell.date)}
                        className={ADD_BUTTON_CLASS}
                      >
                        <Trophy size={14} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onAdd(cell.date)}
                      aria-label={t.calendar.tab.addTrainingOn(cell.date)}
                      className={ADD_BUTTON_CLASS}
                    >
                      <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  </span>
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {(matchesByDate[cell.date] ?? []).map((m) => (
                    <MatchChip key={m.id} teamId={teamId} match={m} />
                  ))}
                </div>
                <ul className="mt-1 space-y-1">
                  {(sessionsByDate[cell.date] ?? []).map((session) => (
                    <SessionPill key={session.id} session={session} onOpen={onOpen} onRemove={onRemove} />
                  ))}
                </ul>
              </>
            ) : (
              <span aria-hidden="true" className="inline-flex h-6 items-center px-1 text-caption tabular-nums text-ink-3">
                {day}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Phone layout: a 7-column month is far too narrow for session labels, so the screen shows the selected week as a
 * strip of day numbers with a dot per session or match, and the selected day's agenda full-width underneath.
 */
function MobileMonthView({
  grid,
  todayStr,
  sessionsByDate,
  onOpen,
  onRemove,
  teamId,
  matchesByDate,
  onNewMatch,
  selectedDate,
  onSelect,
  onShiftWeek,
}: ViewProps & { selectedDate: string; onSelect: (date: string) => void; onShiftWeek: (direction: -1 | 1) => void }) {
  const t = useT();
  const c = t.calendar.tab;
  const weekdayInitials = weekdayNames('narrow');
  const week = grid.find((w) => w.some((cell) => cell.date === selectedDate)) ?? grid[0];
  const selectedSessions = sessionsByDate[selectedDate] ?? [];
  const selectedMatches = matchesByDate[selectedDate] ?? [];
  const arrowClass =
    'flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';

  return (
    <div>
      <div className="rounded-lg bg-surface p-2 shadow-card">
        <div className="mb-1 flex items-center justify-between">
          <button type="button" aria-label={c.previousWeek} onClick={() => onShiftWeek(-1)} className={arrowClass}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span className="text-footnote tabular-nums text-ink-2">{formatWeekRange(week[0].date, week[6].date)}</span>
          <button type="button" aria-label={c.nextWeek} onClick={() => onShiftWeek(1)} className={arrowClass}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-7" aria-hidden="true">
          {weekdayInitials.map((d, i) => (
            <div key={i} className="py-1 text-center text-caption text-ink-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {week.map((cell) => {
            const day = Number(cell.date.slice(-2));
            if (!cell.inMonth) {
              return (
                <span key={cell.date} aria-hidden="true" className="flex h-12 items-start justify-center pt-1.5 text-callout tabular-nums text-ink-3">
                  {day}
                </span>
              );
            }
            const count = sessionsByDate[cell.date]?.length ?? 0;
            const matchCount = matchesByDate[cell.date]?.length ?? 0;
            const sessionDots = Math.min(count, MAX_DOTS);
            const matchDots = Math.min(matchCount, MAX_DOTS - sessionDots);
            const isToday = cell.date === todayStr;
            const isSelected = cell.date === selectedDate;
            const label = c.dayLabel(isToday, formatDayLabel(cell.date), count);
            return (
              <button
                key={cell.date}
                type="button"
                aria-label={label}
                aria-pressed={isSelected}
                onClick={() => onSelect(cell.date)}
                className="flex h-12 flex-col items-center gap-1 rounded-md pt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-callout tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-ink font-semibold text-on-ink'
                      : isToday
                        ? 'font-semibold text-ink ring-1 ring-inset ring-ink'
                        : 'text-ink'
                  }`}
                >
                  {day}
                </span>
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                  {Array.from({ length: sessionDots }, (_, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-ink" />
                  ))}
                  {Array.from({ length: matchDots }, (_, i) => (
                    <span key={`m${i}`} className="h-1.5 w-1.5 rounded-full ring-1 ring-inset ring-ink" />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section aria-label={c.trainingsOn(formatDayLabel(selectedDate))} className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-title-3 text-ink">{formatDayLabel(selectedDate)}</h3>
          {onNewMatch && (
            <Button variant="secondary" size="sm" onClick={() => onNewMatch(selectedDate)} aria-label={c.addMatchOn(selectedDate)}>
              <Trophy size={16} aria-hidden="true" className="mr-1" /> {c.match}
            </Button>
          )}
        </div>
        {selectedMatches.length > 0 && (
          <div className="mb-2 space-y-1">
            {selectedMatches.map((m) => (
              <MatchChip key={m.id} teamId={teamId} match={m} touch />
            ))}
          </div>
        )}
        {selectedSessions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-separator px-4 py-6 text-center text-callout text-ink-2">
            {c.noTrainings}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg bg-surface shadow-card">
            {selectedSessions.map((session) => (
              <SessionRow key={session.id} session={session} onOpen={onOpen} onRemove={onRemove} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
