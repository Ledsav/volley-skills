import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { CalendarSession } from '../types/calendarSession';
import { deleteCalendarSession, listCalendarSessions } from './calendarApi';
import { addMonths, buildMonthGrid, formatMonthLabel, monthRange } from './monthGrid';
import { AssignTrainingDialog } from './AssignTrainingDialog';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TeamCalendarTab({ teamId }: { teamId: string }) {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [assignDate, setAssignDate] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CalendarSession | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { start, end } = monthRange(view.year, view.month);
    setSessions(await listCalendarSessions(teamId, start, end));
  }, [teamId, view]);

  useEffect(() => {
    void load();
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

      <div className="grid grid-cols-7 gap-px rounded-lg border border-border bg-border text-sm">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-surface px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate">
            {d}
          </div>
        ))}
        {grid.flat().map((cell) => (
          <div
            key={cell.date}
            className={`min-h-24 bg-surface p-1 ${cell.inMonth ? '' : 'opacity-40'}`}
          >
            <button
              type="button"
              onClick={() => setAssignDate(cell.date)}
              className="block w-full text-right text-xs tabular-nums text-slate hover:text-blue"
              aria-label={`Assign training on ${cell.date}`}
            >
              {Number(cell.date.slice(-2))}
            </button>
            <ul className="mt-1 space-y-1">
              {(sessionsByDate[cell.date] ?? []).map((session) => (
                <li key={session.id} className="flex items-center gap-1 rounded-sm bg-blue/10 px-1 py-0.5 text-xs">
                  <Link
                    to={`/trainings?businessId=${session.trainingBusinessId}`}
                    className="flex-1 truncate text-blue hover:underline"
                    title={`${session.trainingBusinessId} · ${session.trainingName}`}
                  >
                    {session.trainingBusinessId} · {session.trainingName}
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remove ${session.trainingBusinessId} on ${session.date}`}
                    onClick={() => { setDeleteError(null); setPendingDelete(session); }}
                    className="text-red hover:text-red-strong"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
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
