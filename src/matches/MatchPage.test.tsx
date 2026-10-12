import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type Match } from '../types/match';
import { MatchPage } from './MatchPage';
import * as matchesApi from './matchesApi';

vi.mock('./matchesApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('./MatchSetupForm', () => ({
  MatchSetupForm: ({ onDirtyChange }: { onDirtyChange?: (d: boolean) => void }) => (
    <div>
      <label>
        Opponent
        <input onChange={() => onDirtyChange?.(true)} />
      </label>
      <button onClick={() => onDirtyChange?.(false)}>mock-save</button>
    </div>
  ),
}));

const match: Match = {
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT,
  roster: [], liberos: [], status: 'setup', result: { setsUs: 0, setsThem: 0, sets: [] }, summary: null,
  usageContribution: null, activeDevice: null, createdBy: 'u1', createdAt: null, updatedAt: null,
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/teams/t1/matches/m1']}>
      <Routes>
        <Route path="/teams/:teamId/matches/:matchId" element={<MatchPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MatchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(matchesApi.getMatch).mockResolvedValue(match);
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

  it('shows an error when starting scouting fails', async () => {
    vi.mocked(matchesApi.setMatchStatus).mockRejectedValue(new Error('nope'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Start scouting' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not start/i));
  });
});
