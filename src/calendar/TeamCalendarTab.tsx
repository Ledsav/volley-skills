import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useMediaQuery } from '../components/useMediaQuery';
import type { CalendarSession } from '../types/calendarSession';
import { AssignTrainingDialog } from './AssignTrainingDialog';
import { deleteCalendarSession, listCalendarSessions } from './calendarApi';
import {
  addMonths,
  buildMonthGrid,
  formatDayLabel,
  formatMonthLabel,
  monthRange,
  todayIso,
} from './monthGrid';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MAX_DOTS = 3;

type Grid = ReturnType<typeof buildMonthGrid>;
type SessionsByDate = Record<string, CalendarSession[]>;

interface ViewProps {
  grid: Grid;
  todayStr: string;
  sessionsByDate: SessionsByDate;
  onAdd: (date: string) => void;
  onRemove: (session: CalendarSession) => void;
}

/** Today if it falls in the viewed month, otherwise the month's first day. */
function defaultSelection(year: number, month: number): string {
  const today = todayIso();
  const { start, end } = monthRange(year, month);
  return today >= start && today <= end ? today : start;
}

function sessionLabel(session: CalendarSession): string {
  return `${session.trainingBusinessId} · ${session.trainingName}`;
}

export function TeamCalendarTab({ teamId }: { teamId: string }) {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState(() => defaultSelection(view.year, view.month));
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [assignDate, setAssignDate] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CalendarSession | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const load = useCallback(async () => {
    const { start, end } = monthRange(view.year, view.month);
    setSessions(await listCalendarSessions(teamId, start, end));
  }, [teamId, view]);

  useEffect(() => {
    setError(null);
    load().catch(() => setError('Could not load calendar sessions. Please refresh the page.'));
  }, [load]);

  const grid = buildMonthGrid(view.year, view.month);
  const todayStr = todayIso();
  const sessionsByDate = sessions.reduce<SessionsByDate>((acc, session) => {
    (acc[session.date] ??= []).push(session);
    return acc;
  }, {});

  function goToMonth(delta: number) {
    const next = addMonths(view.year, view.month, delta);
    setView(next);
    setSelectedDate(defaultSelection(next.year, next.month));
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteCalendarSession(teamId, pendingDelete.id);
    } catch {
      setDeleteError('Could not remove the session. Please try again.');
      return;
    }
    setPendingDelete(null);
    void load();
  }

  const viewProps: ViewProps = {
    grid,
    todayStr,
    sessionsByDate,
    onAdd: setAssignDate,
    onRemove: (session) => {
      setDeleteError(null);
      setPendingDelete(session);
    },
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => goToMonth(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-md text-slate hover:bg-blue/10 hover:text-ink"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span className="text-base font-semibold text-ink">{formatMonthLabel(view.year, view.month)}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => goToMonth(1)}
          className="flex h-10 w-10 items-center justify-center rounded-md text-slate hover:bg-blue/10 hover:text-ink"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red">
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

      {pendingDelete && (
        <ConfirmDialog
          title="Remove this session?"
          message={`${sessionLabel(pendingDelete)} on ${pendingDelete.date}`}
          confirmLabel="Yes, remove"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
          error={deleteError}
        />
      )}
    </div>
  );
}

function DesktopMonthGrid({ grid, todayStr, sessionsByDate, onAdd, onRemove }: ViewProps) {
  return (
    <div className="grid grid-cols-7 gap-px border border-border bg-border text-sm">
      {WEEKDAYS.map((d) => (
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
                  aria-label={isToday ? `Today, ${cell.date}` : undefined}
                  className={`block w-full text-right text-xs tabular-nums ${
                    isToday ? 'font-semibold text-blue' : 'text-slate'
                  }`}
                >
                  {isToday ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue text-white">
                      {Number(cell.date.slice(-2))}
                    </span>
                  ) : (
                    Number(cell.date.slice(-2))
                  )}
                </span>
                <ul className="mt-1 space-y-1">
                  {(sessionsByDate[cell.date] ?? []).map((session) => (
                    <li key={session.id} className="flex items-center gap-1.5 rounded-sm bg-blue/10 py-0.5 pl-1.5 pr-1 text-xs">
                      <Link
                        to={`/trainings?businessId=${session.trainingBusinessId}`}
                        className="min-w-0 flex-1 truncate text-blue hover:underline"
                        title={sessionLabel(session)}
                      >
                        {sessionLabel(session)}
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove ${session.trainingBusinessId} on ${session.date}`}
                        onClick={() => onRemove(session)}
                        className="shrink-0 rounded-sm p-0.5 text-red hover:bg-red/10 hover:text-red-strong"
                      >
                        <X size={11} strokeWidth={2} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => onAdd(cell.date)}
                  aria-label={`Add training on ${cell.date}`}
                  className="mt-1 flex flex-1 items-center justify-center gap-1 rounded-sm py-1 text-xs font-medium text-slate/50 transition-colors hover:bg-blue/10 hover:text-blue focus:outline-none focus-visible:bg-blue/10 focus-visible:text-blue group-hover:text-blue"
                >
                  <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
                  <span>Add</span>
                </button>
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
  onRemove,
  selectedDate,
  onSelect,
}: ViewProps & { selectedDate: string; onSelect: (date: string) => void }) {
  const selectedSessions = sessionsByDate[selectedDate] ?? [];

  return (
    <div>
      <div className="rounded-lg border border-border bg-surface p-2 shadow-card">
        <div className="grid grid-cols-7" aria-hidden="true">
          {WEEKDAY_INITIALS.map((d, i) => (
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
            const isToday = cell.date === todayStr;
            const isSelected = cell.date === selectedDate;
            const label = `${isToday ? 'Today, ' : ''}${formatDayLabel(cell.date)}${
              count ? `, ${count} training${count > 1 ? 's' : ''}` : ''
            }`;
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
                        ? 'font-semibold text-blue ring-1 ring-inset ring-blue'
                        : 'text-ink'
                  }`}
                >
                  {day}
                </span>
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                  {Array.from({ length: Math.min(count, MAX_DOTS) }, (_, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-blue" />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section aria-label={`Trainings on ${formatDayLabel(selectedDate)}`} className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">{formatDayLabel(selectedDate)}</h3>
          <Button variant="secondary" size="sm" onClick={() => onAdd(selectedDate)} aria-label={`Add training on ${selectedDate}`}>
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" className="mr-1" />
            Add training
          </Button>
        </div>
        {selectedSessions.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-slate">
            No trainings scheduled.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedSessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center gap-2 rounded-md border border-l-4 border-border border-l-blue bg-surface pl-3 shadow-card"
              >
                <Link to={`/trainings?businessId=${session.trainingBusinessId}`} className="min-w-0 flex-1 py-2.5">
                  <span className="block text-xs font-medium tabular-nums text-blue">{session.trainingBusinessId}</span>
                  <span className="block truncate text-sm font-medium text-ink">{session.trainingName}</span>
                  {session.notes && <span className="mt-0.5 block truncate text-xs text-slate">{session.notes}</span>}
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${session.trainingBusinessId} on ${session.date}`}
                  onClick={() => onRemove(session)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-red hover:bg-red/10"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
