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
  formatMonthLabel,
  monthRange,
  todayIso,
} from './monthGrid';
import { weekdayNames } from '../i18n/format';
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
      className={`flex items-center gap-1 truncate rounded-sm bg-orange/15 font-medium text-orange-strong hover:underline ${
        touch ? 'min-h-11 px-3 text-sm' : 'px-1.5 py-0.5 text-xs'
      }`}
      title={matchLabel(match, t)}
    >
      <Trophy size={11} aria-hidden="true" />
      <span className="truncate">{matchLabel(match, t)}</span>
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

  const load = useCallback(async () => {
    const { start, end } = monthRange(view.year, view.month);
    const [sessionList, matchList] = await Promise.all([
      listCalendarSessions(teamId, start, end),
      listMatchesInRange(teamId, start, end).catch(() => [] as Match[]),
    ]);
    setSessions(sessionList);
    setMatches(matchList);
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
        if (mounted.current) await loadRef.current();
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
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label={c.previousMonth}
          onClick={() => goToMonth(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-md text-slate hover:bg-blue/10 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span className="text-base font-semibold text-ink">{formatMonthLabel(view.year, view.month)}</span>
        <button
          type="button"
          aria-label={c.nextMonth}
          onClick={() => goToMonth(1)}
          className="flex h-11 w-11 items-center justify-center rounded-md text-slate hover:bg-blue/10 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-strong">
          {error}
        </p>
      )}

      {isDesktop ? (
        <DesktopMonthGrid {...viewProps} />
      ) : (
        <MobileMonthView {...viewProps} selectedDate={selectedDate} onSelect={setSelectedDate} />
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
        {...targetProps}
        className="block w-full truncate rounded-full bg-ink px-2 text-left text-caption text-on-ink hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {label}
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

function DesktopMonthGrid({ grid, todayStr, sessionsByDate, onAdd, onOpen, onRemove, teamId, matchesByDate, onNewMatch }: ViewProps) {
  const t = useT();
  return (
    <div className="grid grid-cols-7 gap-px border border-border bg-border text-sm">
      {weekdayNames('short').map((d) => (
        <div key={d} className="bg-surface px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate">
          {d}
        </div>
      ))}
      {grid.flat().map((cell) => {
        const isToday = cell.inMonth && cell.date === todayStr;
        return (
          <div
            key={cell.date}
            className={`flex min-h-24 flex-col bg-surface p-1 ${
              cell.inMonth
                ? 'group transition-colors hover:bg-blue/5 focus-within:bg-blue/5'
                : 'opacity-40'
            } ${isToday ? 'ring-1 ring-inset ring-blue' : ''}`}
          >
            {cell.inMonth ? (
              <>
                <span
                  aria-label={isToday ? t.calendar.tab.todayDate(cell.date) : undefined}
                  className={`block w-full text-right text-xs tabular-nums ${
                    isToday ? 'font-semibold text-blue-strong' : 'text-slate'
                  }`}
                >
                  {isToday ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-strong text-on-ink">
                      {Number(cell.date.slice(-2))}
                    </span>
                  ) : (
                    Number(cell.date.slice(-2))
                  )}
                </span>
                {(matchesByDate[cell.date] ?? []).map((m) => (
                  <MatchChip key={m.id} teamId={teamId} match={m} />
                ))}
                <ul className="mt-1 space-y-1">
                  {(sessionsByDate[cell.date] ?? []).map((session) => (
                    <SessionPill key={session.id} session={session} onOpen={onOpen} onRemove={onRemove} />
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => onAdd(cell.date)}
                  aria-label={t.calendar.tab.addTrainingOn(cell.date)}
                  className="mt-1 flex flex-1 items-center justify-center gap-1 rounded-sm py-1 text-xs font-medium text-slate transition-colors hover:bg-blue/10 hover:text-blue-strong focus:outline-none focus-visible:bg-blue/10 focus-visible:text-blue-strong group-hover:text-blue-strong"
                >
                  <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
                  <span>{t.calendar.tab.add}</span>
                </button>
                {onNewMatch && (
                  <button
                    type="button"
                    onClick={() => onNewMatch(cell.date)}
                    aria-label={t.calendar.tab.addMatchOn(cell.date)}
                    className="flex items-center justify-center gap-1 rounded-sm py-1 text-xs font-medium text-slate hover:bg-orange/10 hover:text-orange-strong group-hover:text-orange-strong"
                  >
                    <Trophy size={12} aria-hidden="true" /> {t.calendar.tab.match}
                  </button>
                )}
              </>
            ) : (
              <span aria-hidden="true" className="block w-full text-right text-xs tabular-nums text-slate">
                {Number(cell.date.slice(-2))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Phone layout: a 7-column grid is far too narrow for session labels, so the
 * month shows only day numbers with a dot per session, and the tapped day's
 * sessions are listed full-width underneath.
 */
function MobileMonthView({
  grid,
  todayStr,
  sessionsByDate,
  onAdd,
  onOpen,
  onRemove,
  teamId,
  matchesByDate,
  onNewMatch,
  selectedDate,
  onSelect,
}: ViewProps & { selectedDate: string; onSelect: (date: string) => void }) {
  const t = useT();
  const weekdayInitials = weekdayNames('narrow');
  const selectedSessions = sessionsByDate[selectedDate] ?? [];
  const selectedMatches = matchesByDate[selectedDate] ?? [];

  return (
    <div>
      <div className="rounded-lg border border-border bg-surface p-2 shadow-card">
        <div className="grid grid-cols-7" aria-hidden="true">
          {weekdayInitials.map((d, i) => (
            <div key={i} className="py-1 text-center text-xs font-medium text-slate">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {grid.flat().map((cell) => {
            const day = Number(cell.date.slice(-2));
            if (!cell.inMonth) {
              return (
                <span key={cell.date} aria-hidden="true" className="flex h-12 items-start justify-center pt-1.5 text-sm tabular-nums text-slate/40">
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
            const label = t.calendar.tab.dayLabel(isToday, formatDayLabel(cell.date), count);
            return (
              <button
                key={cell.date}
                type="button"
                aria-label={label}
                aria-pressed={isSelected}
                onClick={() => onSelect(cell.date)}
                className="flex h-12 flex-col items-center gap-1 rounded-md pt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-navy font-semibold text-white'
                      : isToday
                        ? 'font-semibold text-blue-strong ring-1 ring-inset ring-blue'
                        : 'text-ink'
                  }`}
                >
                  {day}
                </span>
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                  {Array.from({ length: sessionDots }, (_, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-blue" />
                  ))}
                  {Array.from({ length: matchDots }, (_, i) => (
                    <span key={`m${i}`} className="h-1.5 w-1.5 rounded-full bg-orange" />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section aria-label={t.calendar.tab.trainingsOn(formatDayLabel(selectedDate))} className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">{formatDayLabel(selectedDate)}</h3>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onAdd(selectedDate)} aria-label={t.calendar.tab.addTrainingOn(selectedDate)}>
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" className="mr-1" />
              {t.calendar.tab.addTraining}
            </Button>
            {onNewMatch && (
              <Button variant="secondary" size="sm" onClick={() => onNewMatch(selectedDate)} aria-label={t.calendar.tab.addMatchOn(selectedDate)}>
                <Trophy size={16} aria-hidden="true" className="mr-1" /> {t.calendar.tab.match}
              </Button>
            )}
          </div>
        </div>
        {selectedMatches.length > 0 && (
          <div className="mb-2 space-y-1">
            {selectedMatches.map((m) => (
              <MatchChip key={m.id} teamId={teamId} match={m} touch />
            ))}
          </div>
        )}
        {selectedSessions.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-slate">
            {t.calendar.tab.noTrainings}
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
