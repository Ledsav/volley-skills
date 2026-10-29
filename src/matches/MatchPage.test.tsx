import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type Match, type MatchSetupInput } from '../types/match';
import { MatchPage } from './MatchPage';
import * as matchesApi from './matchesApi';
import { buildReportData } from './report/reportData';
import { replay } from './scoutEngine';
import { downloadText } from '../export/exportJson';
import { WithChrome } from '../test/chromeProbe';

vi.mock('./matchesApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../export/exportJson', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../export/exportJson')>()),
  downloadText: vi.fn(),
}));
vi.mock('./MatchSetupForm', () => ({
  MatchSetupForm: ({
    onDirtyChange,
    onSubmit,
  }: {
    onDirtyChange?: (d: boolean) => void;
    onSubmit: (input: MatchSetupInput) => Promise<void> | void;
  }) => (
    <div>
      <label>
        Opponent
        <input onChange={() => onDirtyChange?.(true)} />
      </label>
      <button onClick={() => onDirtyChange?.(false)}>mock-save</button>
      <button onClick={() => void onSubmit({ ...match, opponent: 'Renamed' })}>mock-submit</button>
    </div>
  ),
}));

const match: Match = {
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT,
  roster: [], liberos: [], status: 'setup', result: { setsUs: 0, setsThem: 0, sets: [] }, summary: null,
  usageContribution: null, activeDevice: null, createdBy: 'u1', createdAt: null, updatedAt: null,
};

const never = () => new Promise<void>(() => undefined);

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/teams/t1/matches/m1']}>
      <WithChrome>
        <Routes>
          <Route path="/teams/:teamId/matches/:matchId" element={<MatchPage />} />
          <Route path="/teams/:teamId/matches/:matchId/scout" element={<p>scout page</p>} />
          <Route path="/teams/:teamId/matches/:matchId/awards" element={<p>awards page</p>} />
          <Route path="/teams/:teamId" element={<p>team page</p>} />
        </Routes>
      </WithChrome>
    </MemoryRouter>,
  );
}

describe('MatchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(matchesApi.getMatch).mockResolvedValue(match);
    vi.mocked(matchesApi.subscribeEvents).mockImplementation((_t, _m, onChange) => {
      onChange([], 0);
      return () => undefined;
    });
  });

  it('disables Start scouting while the setup has unsaved edits', async () => {
    renderPage();
    const start = await screen.findByRole('button', { name: 'Start scouting' });
    expect(start).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'Other' } });
    expect(start).toBeDisabled();
    expect(screen.getByText('Save the setup first.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('mock-save'));
    expect(start).toBeEnabled();
  });

  it('starts scouting without waiting for the server (offline)', async () => {
    vi.mocked(matchesApi.setMatchStatus).mockImplementation(never);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Start scouting' }));
    expect(await screen.findByText('scout page')).toBeInTheDocument();
    expect(matchesApi.setMatchStatus).toHaveBeenCalledWith('t1', 'm1', 'live');
  });

  it('applies a setup save immediately while the write is pending', async () => {
    vi.mocked(matchesApi.updateMatchSetup).mockImplementation(never);
    renderPage();
    fireEvent.click(await screen.findByText('mock-submit'));
    expect(matchesApi.updateMatchSetup).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ opponent: 'Renamed' }));
    expect(await screen.findByRole('heading', { name: 'vs Renamed' })).toBeInTheDocument();
  });

  it('reopens a finished match immediately and reverts with an error if the write is rejected', async () => {
    vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...match, status: 'finished' });
    let reject: (e: Error) => void = () => undefined;
    vi.mocked(matchesApi.setMatchStatus).mockImplementation(() => new Promise<void>((_, r) => (reject = r)));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reopen for editing' }));
    expect(screen.getByText('Scouting in progress')).toBeInTheDocument();
    reject(new Error('denied'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not reopen/i));
    expect(screen.getByRole('button', { name: 'Reopen for editing' })).toBeInTheDocument();
  });

  it('renders a finished match from its stored report without reading events', async () => {
    const stats = buildReportData(replay(match, [])).all;
    const report = { setsWon: { us: 3, them: 1 }, setScores: [{ us: 25, them: 20 }], sets: [1], all: stats, bySet: { 1: stats } };
    vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...match, status: 'finished', report });
    renderPage();
    expect(await screen.findByText('3–1')).toBeInTheDocument();
    expect(matchesApi.subscribeEvents).not.toHaveBeenCalled();
  });

  it('prints and exports the selected set of a finished match as CSV', async () => {
    const stats = buildReportData(replay(match, [])).all;
    const report = { setsWon: { us: 3, them: 1 }, setScores: [{ us: 25, them: 20 }], sets: [1], all: stats, bySet: { 1: stats } };
    vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...match, status: 'finished', report });
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderPage();

    const pick = async (name: string) => fireEvent.click(await screen.findByRole('button', { name }));

    await pick('Print / PDF');
    expect(print).toHaveBeenCalled();

    await pick('CSV · Excel (Belgium/EU)');
    expect(downloadText).toHaveBeenLastCalledWith('2026-10-18-Rivals-all.csv', expect.stringContaining('Number;Name'), 'text/csv;charset=utf-8');

    await pick('CSV · Excel (English) / Sheets');
    expect(downloadText).toHaveBeenLastCalledWith('2026-10-18-Rivals-all.csv', expect.stringContaining('Number,Name'), 'text/csv;charset=utf-8');

    fireEvent.change(screen.getByLabelText('Set'), { target: { value: '1' } });
    await pick('CSV · Excel (Belgium/EU)');
    expect(downloadText).toHaveBeenLastCalledWith('2026-10-18-Rivals-set1.csv', expect.any(String), 'text/csv;charset=utf-8');
    expect(screen.getByRole('button', { name: 'Reopen for editing' })).toBeInTheDocument();
  });

  it('falls back to the event log for a finished match without a stored report', async () => {
    vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...match, status: 'finished' });
    renderPage();
    await screen.findByRole('button', { name: 'Reopen for editing' });
    expect(matchesApi.subscribeEvents).toHaveBeenCalled();
  });

  it('does not read events while the match is in setup', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Start scouting' });
    expect(matchesApi.subscribeEvents).not.toHaveBeenCalled();
  });

  it('does not finish a live match when the usage history cannot be loaded', async () => {
    vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...match, status: 'live' });
    vi.mocked(matchesApi.getUsageProfile).mockRejectedValue(new Error('offline'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Finish match' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load usage history — try finishing again.'));
    expect(matchesApi.finishMatch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Finish match' })).toBeEnabled();
  });

  it('shows the not-found state for a missing match', async () => {
    vi.mocked(matchesApi.getMatch).mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Match not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to team' })).toHaveAttribute('href', '/teams/t1');
  });

  it('shows the same state when access is denied', async () => {
    vi.mocked(matchesApi.getMatch).mockRejectedValue({ code: 'permission-denied' });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Match not found' })).toBeInTheDocument();
  });

  it('finished match opens match awards from the toolbar', async () => {
    vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...match, status: 'finished' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Match awards' }));
    expect(await screen.findByText('awards page')).toBeInTheDocument();
  });

  it('Delete match… is in More in every state and confirms with focus on Cancel', async () => {
    for (const status of ['setup', 'live', 'finished'] as const) {
      vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...match, status });
      vi.mocked(matchesApi.deleteMatch).mockResolvedValue(undefined);
      const { unmount } = render(
        <MemoryRouter initialEntries={['/teams/t1/matches/m1']}>
          <WithChrome>
            <Routes>
              <Route path="/teams/:teamId/matches/:matchId" element={<MatchPage />} />
              <Route path="/teams/:teamId" element={<p>team page</p>} />
            </Routes>
          </WithChrome>
        </MemoryRouter>,
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Delete match…' }));
      const dialog = screen.getByRole('alertdialog', { name: 'Delete this match?' });
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
      expect(matchesApi.deleteMatch).not.toHaveBeenCalled();
      if (status === 'finished') {
        fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, delete' }));
        expect(await screen.findByText('team page')).toBeInTheDocument();
        expect(matchesApi.deleteMatch).toHaveBeenCalledWith('t1', 'm1');
      }
      unmount();
    }
  });
});
