import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhysicalTestingSection } from './PhysicalTestingSection';
import * as physicalTestsApi from './physicalTestsApi';
import { useAuth } from '../auth/AuthContext';
import { authValue, testClub } from '../test/authValue';
import type { PhysicalTest } from '../types/physicalTest';
import { NoticeProvider, UNDO_MS } from '../components/Notice';
import { I18nProvider } from '../i18n/I18nProvider';
import { PlayerSyncProvider } from './playerSync';

vi.mock('./physicalTestsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const cmjEntry: PhysicalTest = {
  id: 'test-1',
  testType: 'cmj',
  attemptsCm: [30, 34, 32],
  bestCm: 34,
  date: '2026-09-01',
  notes: '',
  recordedBy: 'coach-uid',
  createdAt: null,
};

describe('PhysicalTestingSection', () => {
  it('shows the latest value per quality, and "No data yet" where none exists', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never })
    );
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({ cmj: cmjEntry });
    const stored = { cmj: cmjEntry };

    render(<PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={true} storedLatest={stored} />);

    expect(await screen.findByText(/34 cm — 2026-09-01/)).toBeInTheDocument();
    expect(screen.getAllByText('No data yet').length).toBe(7);
    expect(physicalTestsApi.loadLatestTests).toHaveBeenCalledWith('team-1', 'player-1', stored, true);
  });

  it('offers no Growth tile when growth tests are off', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never, club: testClub({ growthTestsEnabled: false }) })
    );
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});

    render(<PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={true} />);

    await waitFor(() => expect(screen.getAllByText('No data yet').length).toBe(7));
    expect(screen.queryByText('Growth')).not.toBeInTheDocument();
  });

  it('keeps an existing growth record reachable (history, no add) when growth tests are off', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never, club: testClub({ growthTestsEnabled: false }) })
    );
    const growth = { id: 'g-1', testType: 'growth', heightCm: 170, bodyMassKg: 60, date: '2026-09-02', notes: '', recordedBy: 'coach-uid', createdAt: null } as unknown as PhysicalTest;
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({ growth });

    render(<PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={true} />);

    expect(await screen.findByText('Growth')).toBeInTheDocument();
    expect(screen.getAllByText('View history').length).toBe(8);
    expect(screen.getAllByText('Add new').length).toBe(7);
  });

  it('hides "Add new" when isAdmin is false', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never })
    );
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});

    render(<PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={false} />);

    await waitFor(() => expect(screen.getAllByText('No data yet').length).toBe(8));
    expect(screen.queryByText('Add new')).not.toBeInTheDocument();
  });

  it('shows a visible error instead of silent "No data yet" rows when the load fails', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never })
    );
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockRejectedValue({ code: 'permission-denied' });

    render(<PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={true} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
  });

  it('opens the add-test dialog for the clicked quality and refreshes on save', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never })
    );
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});

    render(<PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={true} />);

    await waitFor(() => expect(screen.getAllByText('No data yet').length).toBe(8));
    fireEvent.click(screen.getAllByText('Add new')[0]);

    expect(await screen.findByLabelText('Height (cm)')).toBeInTheDocument();
  });

  it('offline, a new entry closes the sheet and dots its row until it syncs', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never })
    );
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    vi.spyOn(physicalTestsApi, 'fetchLatestTests').mockResolvedValue({});
    let resolve: (id: string) => void = () => undefined;
    vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockReturnValue(new Promise<string>((r) => (resolve = r)));

    render(
      <NoticeProvider>
        <PlayerSyncProvider>
          <PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={true} />
        </PlayerSyncProvider>
      </NoticeProvider>,
    );

    await waitFor(() => expect(screen.getAllByText('No data yet').length).toBe(8));
    fireEvent.click(screen.getAllByText('Add new')[0]);
    fireEvent.change(await screen.findByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Height (cm)'), { target: { value: '160' } });
    fireEvent.change(screen.getByLabelText('Body mass (kg)'), { target: { value: '50' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.queryByLabelText('Height (cm)')).not.toBeInTheDocument());
    expect(screen.getByRole('img', { name: 'Waiting to sync' })).toBeInTheDocument();
    await act(async () => resolve('test-1'));
    expect(screen.queryByRole('img', { name: 'Waiting to sync' })).not.toBeInTheDocument();
  });

  it('history opens as a sheet and Escape returns focus to View history', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never }));
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({ tests: [], lastDoc: null });
    vi.spyOn(physicalTestsApi, 'listSeriesByType').mockResolvedValue([]);

    render(
      <NoticeProvider>
        <PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={true} />
      </NoticeProvider>,
    );

    await waitFor(() => expect(screen.getAllByText('No data yet').length).toBe(8));
    const trigger = screen.getAllByText('View history')[0];
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closing the sheet during the undo window still deletes and refreshes the latest row', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never }));
      vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({ cmj: cmjEntry });
      const fetchLatest = vi.spyOn(physicalTestsApi, 'fetchLatestTests').mockResolvedValue({});
      vi.spyOn(physicalTestsApi, 'listHistoryByType').mockResolvedValue({ tests: [cmjEntry], lastDoc: null });
      vi.spyOn(physicalTestsApi, 'listSeriesByType').mockResolvedValue([]);
      const del = vi.spyOn(physicalTestsApi, 'deletePhysicalTest').mockResolvedValue(undefined);

      render(
        <I18nProvider>
          <NoticeProvider>
            <PhysicalTestingSection teamId="team-1" playerId="player-1" isAdmin={true} />
          </NoticeProvider>
        </I18nProvider>,
      );

      await screen.findByText(/34 cm — 2026-09-01/);
      fireEvent.click(screen.getAllByText('View history')[0]);
      fireEvent.click(await screen.findByText(/2026-09-01 —/));
      fireEvent.click(screen.getByText('Delete entry'));
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(del).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNDO_MS);
      });

      expect(del).toHaveBeenCalledWith('team-1', 'player-1', 'test-1');
      expect(fetchLatest).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
