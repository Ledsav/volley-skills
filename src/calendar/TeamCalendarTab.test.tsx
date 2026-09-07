import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TeamCalendarTab } from './TeamCalendarTab';
import * as calendarApi from './calendarApi';

vi.mock('./calendarApi');
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

describe('TeamCalendarTab', () => {
  beforeEach(() => {
    // setupTests.ts does not enable fake timers globally; fake only Date so that
    // vi.setSystemTime works while Testing Library's real-timer polling still runs.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.clearAllMocks();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    vi.mocked(calendarApi.listCalendarSessions).mockResolvedValue([session]);
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

    expect(await screen.findByText('TR-0007 · Passing circuit')).toBeInTheDocument();
    expect(calendarApi.listCalendarSessions).toHaveBeenCalledWith('team-1', '2026-09-01', '2026-09-30');
  });

  it('re-queries when navigating to the next month', async () => {
    render(
      <MemoryRouter>
        <TeamCalendarTab teamId="team-1" />
      </MemoryRouter>
    );
    await screen.findByText('TR-0007 · Passing circuit');

    fireEvent.click(screen.getByLabelText('Next month'));

    await waitFor(() =>
      expect(calendarApi.listCalendarSessions).toHaveBeenLastCalledWith('team-1', '2026-10-01', '2026-10-31')
    );
  });

  it('removes a session after confirmation', async () => {
    vi.mocked(calendarApi.deleteCalendarSession).mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <TeamCalendarTab teamId="team-1" />
      </MemoryRouter>
    );
    await screen.findByText('TR-0007 · Passing circuit');

    fireEvent.click(screen.getByLabelText('Remove TR-0007 on 2026-09-10'));
    fireEvent.click(screen.getByText('Yes, remove'));

    await waitFor(() => expect(calendarApi.deleteCalendarSession).toHaveBeenCalledWith('team-1', 's-1'));
  });
});
