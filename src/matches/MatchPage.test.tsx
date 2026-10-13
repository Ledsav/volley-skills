import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type Match, type MatchSetupInput } from '../types/match';
import { MatchPage } from './MatchPage';
import * as matchesApi from './matchesApi';

vi.mock('./matchesApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
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
      <Routes>
        <Route path="/teams/:teamId/matches/:matchId" element={<MatchPage />} />
        <Route path="/teams/:teamId/matches/:matchId/scout" element={<p>scout page</p>} />
      </Routes>
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

  it('does not finish a live match when the usage history cannot be loaded', async () => {
    vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...match, status: 'live' });
    vi.mocked(matchesApi.getUsageProfile).mockRejectedValue(new Error('offline'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Finish match' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load usage history — try finishing again.'));
    expect(matchesApi.finishMatch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Finish match' })).toBeEnabled();
  });
});
