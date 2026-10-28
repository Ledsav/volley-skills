import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type Match } from '../types/match';
import { TeamMatchesTab } from './TeamMatchesTab';
import * as matchesApi from './matchesApi';

vi.mock('./matchesApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: { uid: 'u1' } }) }));
vi.mock('./dvw/DvwImportDialog', () => ({ DvwImportDialog: () => <p>dvw-dialog</p> }));
vi.mock('./MatchSetupForm', () => ({
  MatchSetupForm: ({ defaultDate, onSubmit }: { defaultDate?: string; onSubmit: (input: unknown) => Promise<void> | void }) => (
    <div>
      <p>setup-form {defaultDate}</p>
      <button onClick={() => void onSubmit({ opponent: 'New FC' })}>mock-create</button>
    </div>
  ),
}));

const match = (over: Partial<Match>): Match => ({
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT,
  roster: [], liberos: [], status: 'finished', result: { setsUs: 3, setsThem: 1, sets: [] }, summary: null,
  usageContribution: null, activeDevice: null, createdBy: 'u1', createdAt: null, updatedAt: null, ...over,
});

describe('TeamMatchesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(matchesApi.listMatches).mockResolvedValue({
      matches: [match({}), match({ id: 'm2', opponent: 'Live FC', status: 'live', result: { setsUs: 1, setsThem: 0, sets: [] } })],
      lastDoc: null,
      hasMore: false,
    });
  });

  it('lists matches with result and status', async () => {
    render(<MemoryRouter><TeamMatchesTab teamId="t1" teamName="Team" /></MemoryRouter>);
    expect(await screen.findByText('Rivals')).toBeInTheDocument();
    expect(screen.getByText('3–1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resume/i })).toHaveAttribute('href', '/teams/t1/matches/m2/scout');
  });

  it('opens the setup form, pre-filled from the calendar date', async () => {
    render(<MemoryRouter><TeamMatchesTab teamId="t1" teamName="Team" newMatchDate="2026-11-02" /></MemoryRouter>);
    expect(await screen.findByText('setup-form 2026-11-02')).toBeInTheDocument();
  });

  it('opens the setup form from a pending action', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/teams/t1', search: '?tab=matches', state: { pendingAction: 'new-match' } }]}>
        <TeamMatchesTab teamId="t1" teamName="Team" />
      </MemoryRouter>
    );
    expect(await screen.findByText(/^setup-form [0-9]{4}-[0-9]{2}-[0-9]{2}$/)).toBeInTheDocument();
  });

  it('opens the setup form from the button', async () => {
    render(<MemoryRouter><TeamMatchesTab teamId="t1" teamName="Team" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /new match/i }));
    expect(screen.getByText(/setup-form/)).toBeInTheDocument();
  });

  it('creates the match without waiting for the server and opens it', async () => {
    vi.mocked(matchesApi.createMatch).mockReturnValue({ id: 'new-m', written: new Promise<void>(() => undefined) });
    render(
      <MemoryRouter initialEntries={['/teams/t1']}>
        <Routes>
          <Route path="/teams/:teamId" element={<TeamMatchesTab teamId="t1" teamName="Team" />} />
          <Route path="/teams/:teamId/matches/:matchId" element={<p>match page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /new match/i }));
    fireEvent.click(screen.getByText('mock-create'));
    expect(await screen.findByText('match page')).toBeInTheDocument();
    expect(matchesApi.createMatch).toHaveBeenCalledWith('t1', { opponent: 'New FC' }, 'u1');
  });

  describe('DataVolley import', () => {
    afterEach(() => vi.restoreAllMocks());

    it('opens the import dialog online', async () => {
      render(<MemoryRouter><TeamMatchesTab teamId="t1" teamName="Team" /></MemoryRouter>);
      fireEvent.click(await screen.findByRole('button', { name: /import from datavolley/i }));
      expect(screen.getByText('dvw-dialog')).toBeInTheDocument();
    });

    it('disables the DataVolley import offline', async () => {
      vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
      render(<MemoryRouter><TeamMatchesTab teamId="t1" teamName="Team" /></MemoryRouter>);
      expect(await screen.findByRole('button', { name: /import from datavolley/i })).toBeDisabled();
      expect(screen.getByText('Connect to the internet to import.')).toBeInTheDocument();
    });
  });

  describe('new-match default date', () => {
    afterEach(() => vi.useRealTimers());

    it("uses the local calendar date, not the UTC one", async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 14, 0, 30));
      render(<MemoryRouter><TeamMatchesTab teamId="t1" teamName="Team" /></MemoryRouter>);
      fireEvent.click(await screen.findByRole('button', { name: /new match/i }));
      expect(screen.getByText('setup-form 2026-10-14')).toBeInTheDocument();
    });
  });
});
