import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, type InitialEntry } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TeamCalendarTab } from './TeamCalendarTab';
import * as calendarApi from './calendarApi';
import * as matchesApi from '../matches/matchesApi';
import * as trainingsApi from '../trainings/trainingsApi';
import * as exercisesApi from '../exercises/exercisesApi';
import { NoticeProvider, UNDO_MS } from '../components/Notice';
import { WithChrome } from '../test/chromeProbe';
import { withPendingAction } from '../search/pendingAction';

vi.mock('./calendarApi');
vi.mock('../matches/matchesApi');
vi.mock('../trainings/trainingsApi');
vi.mock('../exercises/exercisesApi');
vi.mock('./AssignTrainingDialog', () => ({
  AssignTrainingDialog: ({ onSaved }: { onSaved: () => void }) => <button onClick={onSaved}>assign-stub</button>,
}));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const session = {
  id: 's-1',
  date: '2026-09-10',
  trainingId: 't-1',
  trainingBusinessId: 'TR-0007',
  trainingName: 'Passing circuit',
  notes: '',
  createdBy: 'coach-uid',
  createdAt: null,
};

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function renderTab(entry: InitialEntry = '/teams/team-1?tab=calendar') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <NoticeProvider>
        <WithChrome>
          <TeamCalendarTab teamId="team-1" teamName="U17 Boys" />
          <LocationProbe />
        </WithChrome>
      </NoticeProvider>
    </MemoryRouter>
  );
}

describe('TeamCalendarTab', () => {
  beforeEach(() => {
    // setupTests.ts does not enable fake timers globally; fake only Date so that
    // vi.setSystemTime works while Testing Library's real-timer polling still runs.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.clearAllMocks();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    vi.mocked(calendarApi.listCalendarSessions).mockResolvedValue([session]);
    vi.mocked(trainingsApi.getTraining).mockResolvedValue({
      id: 't-1',
      businessId: 'TR-0007',
      name: 'Passing circuit',
      exercises: [
        { exerciseId: 'e-2', order: 2, durationMinutes: 15 },
        { exerciseId: 'e-1', order: 1, durationMinutes: 10 },
        { exerciseId: 'e-gone', order: 3, durationMinutes: 5 },
      ],
    } as never);
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([
      { id: 'e-1', name: 'Pepper' },
      { id: 'e-2', name: 'Serve receive' },
    ] as never);
    vi.mocked(matchesApi.listMatchesInRange).mockResolvedValue([
      { id: 'm1', date: '2026-09-12', opponent: 'Rivals', status: 'finished', result: { setsUs: 3, setsThem: 1, sets: [] } } as never,
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders sessions in the current month from their denormalized labels', async () => {
    render(
      <MemoryRouter>
        <TeamCalendarTab teamId="team-1" />
      </MemoryRouter>
    );

    expect(await screen.findByText('Passing circuit')).toBeInTheDocument();
    expect(calendarApi.listCalendarSessions).toHaveBeenCalledWith('team-1', '2026-09-01', '2026-09-30');
  });

  it('re-queries when navigating to the next month', async () => {
    render(
      <MemoryRouter>
        <TeamCalendarTab teamId="team-1" />
      </MemoryRouter>
    );
    await screen.findByText('Passing circuit');

    fireEvent.click(screen.getByLabelText('Next month'));

    await waitFor(() =>
      expect(calendarApi.listCalendarSessions).toHaveBeenLastCalledWith('team-1', '2026-10-01', '2026-10-31')
    );
  });

  it('shows an alert but keeps the grid when the session query fails', async () => {
    vi.mocked(calendarApi.listCalendarSessions).mockReset().mockRejectedValueOnce(new Error('permission-denied'));
    render(
      <MemoryRouter>
        <TeamCalendarTab teamId="team-1" />
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load calendar sessions/i);
    expect(screen.getByText('Mon')).toBeInTheDocument();
  });

  it("highlights today's cell", async () => {
    render(
      <MemoryRouter>
        <TeamCalendarTab teamId="team-1" />
      </MemoryRouter>
    );
    await screen.findByText('Passing circuit');

    // System time is 2026-09-15 (see beforeEach); the day number is rendered
    // as a distinguishable node so we can single out today's cell from others.
    expect(screen.getByLabelText('Today, 2026-09-15')).toBeInTheDocument();
    expect(screen.queryByLabelText('Today, 2026-09-14')).not.toBeInTheDocument();
  });

  it('offers no add affordance on out-of-month padding cells', async () => {
    render(
      <MemoryRouter>
        <TeamCalendarTab teamId="team-1" />
      </MemoryRouter>
    );
    await screen.findByText('Passing circuit');

    // Viewing September 2026: Aug 31 and Oct 1 are adjacent-month padding cells.
    expect(screen.queryByLabelText('Add training on 2026-08-31')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Add training on 2026-10-01')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Add training on 2026-09-15')).toBeInTheDocument();
  });

  it('opens the assign dialog from the add button on an empty in-month day', async () => {
    render(
      <MemoryRouter>
        <TeamCalendarTab teamId="team-1" />
      </MemoryRouter>
    );
    await screen.findByText('Passing circuit');

    expect(screen.queryByText('assign-stub')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Add training on 2026-09-20'));

    expect(screen.getByText('assign-stub')).toBeInTheDocument();
  });

  describe('session sheet and undoable remove', () => {
    beforeEach(() => {
      vi.useRealTimers();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
      vi.mocked(calendarApi.deleteCalendarSession).mockResolvedValue(undefined);
    });

    async function openSheet() {
      renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'TR-0007 · Passing circuit' }));
      return screen.findByRole('dialog', { name: 'Passing circuit' });
    }
    const removeName = 'Remove TR-0007 on 2026-09-10';

    it('a session opens its sheet with a link to the training', async () => {
      const dialog = await openSheet();
      expect(within(dialog).getByRole('link', { name: 'Open training' })).toHaveAttribute(
        'href',
        '/trainings?businessId=TR-0007&team=team-1&session=s-1'
      );
      expect(screen.getByTestId('loc').textContent).toBe('/teams/team-1?tab=calendar&session=s-1');
    });

    it('closing the sheet drops the session param and keeps the tab', async () => {
      await openSheet();
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByTestId('loc').textContent).toBe('/teams/team-1?tab=calendar');
    });

    it('removing is an undo: the session leaves at once and is deleted when the notice expires', async () => {
      const dialog = await openSheet();
      fireEvent.click(within(dialog).getByRole('button', { name: removeName }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'TR-0007 · Passing circuit' })).not.toBeInTheDocument();
      expect(calendarApi.deleteCalendarSession).not.toHaveBeenCalled();

      vi.mocked(calendarApi.listCalendarSessions).mockClear();
      await act(() => vi.advanceTimersByTimeAsync(UNDO_MS));
      expect(calendarApi.deleteCalendarSession).toHaveBeenCalledWith('team-1', 's-1');
      await waitFor(() => expect(calendarApi.listCalendarSessions).toHaveBeenCalled());
    });

    it('Undo restores the session and never deletes', async () => {
      const dialog = await openSheet();
      fireEvent.click(within(dialog).getByRole('button', { name: removeName }));
      fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
      expect(await screen.findByRole('button', { name: 'TR-0007 · Passing circuit' })).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(UNDO_MS * 2));
      expect(calendarApi.deleteCalendarSession).not.toHaveBeenCalled();
    });

    it('a failed remove brings the session back with the error', async () => {
      vi.mocked(calendarApi.deleteCalendarSession).mockRejectedValue(new Error('denied'));
      const dialog = await openSheet();
      fireEvent.click(within(dialog).getByRole('button', { name: removeName }));
      await act(() => vi.advanceTimersByTimeAsync(UNDO_MS));
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not remove the session. Please try again.');
      expect(screen.getByRole('button', { name: 'TR-0007 · Passing circuit' })).toBeInTheDocument();
    });

    it('changing month during the undo window still deletes the session', async () => {
      const dialog = await openSheet();
      fireEvent.click(within(dialog).getByRole('button', { name: removeName }));
      fireEvent.click(screen.getByLabelText('Next month'));
      await waitFor(() =>
        expect(calendarApi.listCalendarSessions).toHaveBeenLastCalledWith('team-1', '2026-10-01', '2026-10-31')
      );
      vi.mocked(calendarApi.listCalendarSessions).mockClear();
      await act(() => vi.advanceTimersByTimeAsync(UNDO_MS));
      expect(calendarApi.deleteCalendarSession).toHaveBeenCalledWith('team-1', 's-1');
      // the reload after the delete is for the month on screen, not the one it was removed from
      await waitFor(() =>
        expect(calendarApi.listCalendarSessions).toHaveBeenLastCalledWith('team-1', '2026-10-01', '2026-10-31')
      );
    });

    it("a session link opens that session's month and sheet", async () => {
      const s9 = { ...session, id: 's9', date: '2026-11-03' };
      vi.mocked(calendarApi.getCalendarSession).mockResolvedValue(s9);
      vi.mocked(calendarApi.listCalendarSessions).mockImplementation(async (_t, start) =>
        start === '2026-11-01' ? [s9] : []
      );
      renderTab('/teams/team-1?tab=calendar&session=s9');
      expect(await screen.findByRole('dialog', { name: 'Passing circuit' })).toBeInTheDocument();
      expect(calendarApi.getCalendarSession).toHaveBeenCalledWith('team-1', 's9');
      await waitFor(() =>
        expect(calendarApi.listCalendarSessions).toHaveBeenCalledWith('team-1', '2026-11-01', '2026-11-30')
      );
      expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
    });

    it('a link to a missing session is dropped quietly', async () => {
      vi.mocked(calendarApi.getCalendarSession).mockResolvedValue(null);
      renderTab('/teams/team-1?tab=calendar&session=gone');
      await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/teams/team-1?tab=calendar'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('a link whose read fails is dropped quietly too', async () => {
      vi.mocked(calendarApi.getCalendarSession).mockRejectedValue(new Error('denied'));
      renderTab('/teams/team-1?tab=calendar&session=gone');
      await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/teams/team-1?tab=calendar'));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('New session in the toolbar opens the assign sheet for the selected day', async () => {
      renderTab();
      await screen.findByRole('button', { name: 'TR-0007 · Passing circuit' });
      fireEvent.click(within(screen.getByTestId('chrome-probe')).getByRole('button', { name: 'New session' }));
      expect(screen.getByText('assign-stub')).toBeInTheDocument();
    });

    it('Plan a training lands with the assign sheet open', async () => {
      renderTab({ pathname: '/teams/team-1', search: '?tab=calendar', ...withPendingAction('new-session') });
      expect(await screen.findByText('assign-stub')).toBeInTheDocument();
    });
  });

  describe('Today button', () => {
    it('sits between the month arrows and returns to the current month', async () => {
      renderTab();
      await screen.findByText('Passing circuit');
      const buttons = within(screen.getByRole('heading', { name: 'September 2026' }).parentElement as HTMLElement).getAllByRole('button');
      expect(buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Previous month', 'Today', 'Next month']);

      fireEvent.click(screen.getByLabelText('Next month'));
      fireEvent.click(screen.getByLabelText('Next month'));
      expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Today' }));
      expect(await screen.findByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
      await waitFor(() =>
        expect(calendarApi.listCalendarSessions).toHaveBeenLastCalledWith('team-1', '2026-09-01', '2026-09-30')
      );
    });
  });

  describe('session plan in the sheet', () => {
    async function openSheet() {
      renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'TR-0007 · Passing circuit' }));
      return screen.findByRole('dialog', { name: 'Passing circuit' });
    }

    it('reads the training only when the sheet opens, then lists its numbered parts in order', async () => {
      renderTab();
      await screen.findByText('Passing circuit');
      expect(trainingsApi.getTraining).not.toHaveBeenCalled();
      expect(exercisesApi.getExercisesByIds).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'TR-0007 · Passing circuit' }));
      const dialog = await screen.findByRole('dialog', { name: 'Passing circuit' });
      expect(await within(dialog).findByText('3 parts · 30 min')).toBeInTheDocument();
      expect(trainingsApi.getTraining).toHaveBeenCalledTimes(1);
      expect(trainingsApi.getTraining).toHaveBeenCalledWith('t-1');
      expect(exercisesApi.getExercisesByIds).toHaveBeenCalledWith(['e-1', 'e-2', 'e-gone']);
      const rows = within(within(dialog).getByRole('list')).getAllByRole('listitem').map((li) => li.textContent);
      expect(rows).toEqual(['#1Pepper10 min', '#2Serve receive15 min', '#3Deleted exercise5 min']);
    });

    it('shows a loading state while the parts load', async () => {
      vi.mocked(trainingsApi.getTraining).mockReturnValue(new Promise(() => {}));
      const dialog = await openSheet();
      expect(within(dialog).getByRole('status')).toHaveTextContent('Loading the session plan');
    });

    it('keeps the sheet usable and hides the parts when the training was deleted', async () => {
      vi.mocked(trainingsApi.getTraining).mockResolvedValue(null);
      const dialog = await openSheet();
      expect(await within(dialog).findByText(/This training was deleted/)).toBeInTheDocument();
      expect(within(dialog).queryByRole('list')).not.toBeInTheDocument();
      expect(exercisesApi.getExercisesByIds).not.toHaveBeenCalled();
      expect(within(dialog).getByRole('link', { name: 'Open training' })).toBeInTheDocument();
    });

    it('shows one line and keeps the sheet usable when the parts cannot be read (offline)', async () => {
      vi.mocked(trainingsApi.getTraining).mockRejectedValue(new Error('offline'));
      const dialog = await openSheet();
      expect(await within(dialog).findByText('Could not load the session plan.')).toBeInTheDocument();
      expect(within(dialog).getByRole('link', { name: 'Open training' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('month loading', () => {
    it('ignores a slow answer for an older month', async () => {
      let resolveSep: (v: (typeof session)[]) => void = () => {};
      vi.mocked(calendarApi.listCalendarSessions).mockImplementation((_t, start) =>
        start === '2026-09-01'
          ? new Promise((resolve) => {
              resolveSep = resolve as never;
            })
          : Promise.resolve([{ ...session, id: 'oct', date: '2026-10-05', trainingName: 'October drill' }])
      );
      renderTab();
      fireEvent.click(await screen.findByLabelText('Next month'));
      expect(await screen.findByText('October drill')).toBeInTheDocument();
      await act(async () => resolveSep([session]));
      expect(screen.getByText('October drill')).toBeInTheDocument();
      expect(screen.queryByText('Passing circuit')).not.toBeInTheDocument();
    });

    it('a session link keeps the linked month when the current month answers late', async () => {
      const s9 = { ...session, id: 's9', date: '2026-11-03', trainingName: 'November drill' };
      let resolveSep: (v: (typeof session)[]) => void = () => {};
      vi.mocked(calendarApi.getCalendarSession).mockResolvedValue(s9);
      vi.mocked(calendarApi.listCalendarSessions).mockImplementation((_t, start) =>
        start === '2026-11-01'
          ? Promise.resolve([s9])
          : new Promise((resolve) => {
              resolveSep = resolve as never;
            })
      );
      renderTab('/teams/team-1?tab=calendar&session=s9');
      expect(await screen.findByRole('dialog', { name: 'November drill' })).toBeInTheDocument();
      await waitFor(() => expect(calendarApi.listCalendarSessions).toHaveBeenCalledWith('team-1', '2026-11-01', '2026-11-30'));
      await act(async () => resolveSep([session]));
      expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'TR-0007 · Passing circuit' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'TR-0007 · November drill' })).toBeInTheDocument();
    });

    it('a failed reload after a successful delete is a load error, never "could not remove"', async () => {
      vi.useRealTimers();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
      vi.mocked(calendarApi.deleteCalendarSession).mockResolvedValue(undefined);
      renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'TR-0007 · Passing circuit' }));
      const dialog = await screen.findByRole('dialog', { name: 'Passing circuit' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove TR-0007 on 2026-09-10' }));
      vi.mocked(calendarApi.listCalendarSessions).mockRejectedValue(new Error('offline'));
      await act(() => vi.advanceTimersByTimeAsync(UNDO_MS));
      expect(calendarApi.deleteCalendarSession).toHaveBeenCalledWith('team-1', 's-1');
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not load calendar sessions');
      expect(screen.queryByText(/Could not remove/)).not.toBeInTheDocument();
      // the deleted row stays gone
      expect(screen.queryByRole('button', { name: 'TR-0007 · Passing circuit' })).not.toBeInTheDocument();
    });
  });

  it('shows matches in the month as links to the match page', async () => {
    render(<MemoryRouter><TeamCalendarTab teamId="team-1" /></MemoryRouter>);
    const link = await screen.findByRole('link', { name: 'vs Rivals 3–1' });
    expect(link).toHaveAttribute('href', '/teams/team-1/matches/m1');
    expect(matchesApi.listMatchesInRange).toHaveBeenCalledWith('team-1', '2026-09-01', '2026-09-30');
  });

  it('offers adding a match on a day', async () => {
    const onNewMatch = vi.fn();
    render(<MemoryRouter><TeamCalendarTab teamId="team-1" onNewMatch={onNewMatch} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Add match on 2026-09-15' }));
    expect(onNewMatch).toHaveBeenCalledWith('2026-09-15');
  });

  describe('on a phone-width screen', () => {
    beforeEach(() => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })) as unknown as typeof window.matchMedia;
    });

    afterEach(() => {
      // jsdom has no matchMedia; restore that so the desktop tests keep their fallback.
      delete (window as { matchMedia?: unknown }).matchMedia;
    });

    it("selects today by default and lists the tapped day's sessions full-width", async () => {
      render(
        <MemoryRouter>
          <TeamCalendarTab teamId="team-1" />
        </MemoryRouter>
      );
      await waitFor(() => expect(calendarApi.listCalendarSessions).toHaveBeenCalled());

      expect(screen.getByRole('button', { name: 'Today, Tuesday 15 September' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('No trainings scheduled.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Thursday 10 September, 1 training' }));

      expect(screen.getByText('Passing circuit')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'TR-0007 · Passing circuit' }));
      expect(await screen.findByLabelText('Remove TR-0007 on 2026-09-10')).toBeInTheDocument();
    });

    it('gives the match chip of the tapped day a 44px touch target', async () => {
      render(
        <MemoryRouter>
          <TeamCalendarTab teamId="team-1" />
        </MemoryRouter>
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Previous week' }));
      fireEvent.click(await screen.findByRole('button', { name: /Saturday 12 September/ }));
      expect(screen.getByRole('link', { name: 'vs Rivals 3–1' }).className).toContain('min-h-11');
    });

    it('opens the assign dialog for the selected day', async () => {
      renderTab();
      fireEvent.click(await screen.findByRole('button', { name: 'Sunday 20 September' }));
      fireEvent.click(within(screen.getByTestId('chrome-probe')).getByRole('button', { name: 'New session' }));

      expect(screen.getByText('assign-stub')).toBeInTheDocument();
    });

    it("Next week from the month's last week moves to the next month", async () => {
      vi.setSystemTime(new Date('2026-09-29T12:00:00Z'));
      renderTab();
      await waitFor(() => expect(calendarApi.listCalendarSessions).toHaveBeenCalledWith('team-1', '2026-09-01', '2026-09-30'));
      fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
      await waitFor(() =>
        expect(calendarApi.listCalendarSessions).toHaveBeenLastCalledWith('team-1', '2026-10-01', '2026-10-31')
      );
      expect(screen.getByRole('button', { name: 'Tuesday 6 October' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('labels the week strip with the month and Today jumps back to this week', async () => {
      render(
        <MemoryRouter>
          <TeamCalendarTab teamId="team-1" />
        </MemoryRouter>
      );
      await waitFor(() => expect(calendarApi.listCalendarSessions).toHaveBeenCalled());
      expect(screen.getByText('14–20 Sep')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
      expect(screen.getByText('28 Sep – 4 Oct')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Today' }));
      expect(await screen.findByRole('button', { name: 'Today, Tuesday 15 September' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('14–20 Sep')).toBeInTheDocument();
    });

    it('Previous week from the first week moves to the previous month', async () => {
      vi.setSystemTime(new Date('2026-09-02T12:00:00Z'));
      renderTab();
      await waitFor(() => expect(calendarApi.listCalendarSessions).toHaveBeenCalledWith('team-1', '2026-09-01', '2026-09-30'));
      fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
      await waitFor(() =>
        expect(calendarApi.listCalendarSessions).toHaveBeenLastCalledWith('team-1', '2026-08-01', '2026-08-31')
      );
      expect(screen.getByRole('button', { name: 'Wednesday 26 August' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('the week strip shows only the selected week', async () => {
      render(
        <MemoryRouter>
          <TeamCalendarTab teamId="team-1" />
        </MemoryRouter>
      );
      await waitFor(() => expect(calendarApi.listCalendarSessions).toHaveBeenCalled());
      expect(screen.queryByRole('button', { name: /Thursday 10 September/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
      expect(screen.getByRole('button', { name: /Thursday 10 September/ })).toBeInTheDocument();
    });
  });

  it('links each session to its training with the team and session, so the PDF can add team notes', async () => {
    render(
      <MemoryRouter>
        <TeamCalendarTab teamId="team-1" />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'TR-0007 · Passing circuit' }));
    const link = await screen.findByRole('link', { name: 'Open training' });
    expect(link).toHaveAttribute('href', `/trainings?businessId=TR-0007&team=team-1&session=${session.id}`);
  });
});
