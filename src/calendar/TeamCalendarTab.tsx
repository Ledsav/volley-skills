import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { CalendarSession } from '../types/calendarSession';
import { AssignTrainingDialog } from './AssignTrainingDialog';
import { deleteCalendarSession, listCalendarSessions } from './calendarApi';
import { addMonths, buildMonthGrid, formatMonthLabel, monthRange } from './monthGrid';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TeamCalendarTab({ teamId }: { teamId: string }) {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [assignDate, setAssignDate] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CalendarSession | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { start, end } = monthRange(view.year, view.month);
    setSessions(await listCalendarSessions(teamId, start, end));
  }, [teamId, view]);

  useEffect(() => {
    setError(null);
    load().catch(() => setError('Could not load calendar sessions. Please refresh the page.'));
  }, [load]);

  const grid = buildMonthGrid(view.year, view.month);
  const sessionsByDate = sessions.reduce<Record<string, CalendarSession[]>>((acc, session) => {
    (acc[session.date] ??= []).push(session);
    return acc;
  }, {});

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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setView(addMonths(view.year, view.month, -1))}
          className="px-2 text-slate hover:text-ink"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-ink">{formatMonthLabel(view.year, view.month)}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setView(addMonths(view.year, view.month, 1))}
          className="px-2 text-slate hover:text-ink"
        >
          ›
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red">
          {error}
        </p>
      )}

      <div className="grid grid-cols-7 gap-px  border border-border bg-border text-sm">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-surface px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate">
            {d}
          </div>
        ))}
        {grid.flat().map((cell) => (
          <div
            key={cell.date}
            className={`flex min-h-24 flex-col bg-surface p-1 ${
              cell.inMonth
                ? 'group transition-colors hover:bg-blue/5 focus-within:bg-blue/5'
                : 'opacity-40'
            }`}
          >
            {cell.inMonth ? (
              <>
                <span className="block w-full text-right text-xs tabular-nums text-slate">
                  {Number(cell.date.slice(-2))}
                </span>
                <ul className="mt-1 space-y-1">
                  {(sessionsByDate[cell.date] ?? []).map((session) => (
                    <li key={session.id} className="flex items-center gap-1.5 rounded-sm bg-blue/10 py-0.5 pl-1.5 pr-1 text-xs">
                      <Link
                        to={`/trainings?businessId=${session.trainingBusinessId}`}
                        className="min-w-0 flex-1 truncate text-blue hover:underline"
                        title={`${session.trainingBusinessId} · ${session.trainingName}`}
                      >
                        {session.trainingBusinessId} · {session.trainingName}
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove ${session.trainingBusinessId} on ${session.date}`}
                        onClick={() => { setDeleteError(null); setPendingDelete(session); }}
                        className="shrink-0 rounded-sm p-0.5 text-red hover:bg-red/10 hover:text-red-strong"
                      >
                        <X size={11} strokeWidth={2} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setAssignDate(cell.date)}
                  aria-label={`Add training on ${cell.date}`}
                  className="mt-1 flex flex-1 items-center justify-center gap-1 rounded-sm py-1 text-xs font-medium text-slate/50 transition-colors hover:bg-blue/10 hover:text-blue focus:outline-none focus-visible:bg-blue/10 focus-visible:text-blue group-hover:text-blue"
                >
                  <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
                  <span>Add</span>
                </button>
              </>
            ) : (
              <span
                aria-hidden="true"
                className="block w-full text-right text-xs tabular-nums text-slate"
              >
                {Number(cell.date.slice(-2))}
              </span>
            )}
          </div>
        ))}
      </div>

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
          message={`${pendingDelete.trainingBusinessId} · ${pendingDelete.trainingName} on ${pendingDelete.date}`}
          confirmLabel="Yes, remove"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
          error={deleteError}
        />
      )}
    </div>
  );
}
