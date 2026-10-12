import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type Match } from '../types/match';
import { TeamMatchesTab } from './TeamMatchesTab';
import * as matchesApi from './matchesApi';

vi.mock('./matchesApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: { uid: 'u1' } }) }));
vi.mock('./MatchSetupForm', () => ({ MatchSetupForm: ({ defaultDate }: { defaultDate?: string }) => <p>setup-form {defaultDate}</p> }));

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
    render(<MemoryRouter><TeamMatchesTab teamId="t1" /></MemoryRouter>);
    expect(await screen.findByText('Rivals')).toBeInTheDocument();
    expect(screen.getByText('3–1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resume/i })).toHaveAttribute('href', '/teams/t1/matches/m2/scout');
  });

  it('opens the setup form, pre-filled from the calendar date', async () => {
    render(<MemoryRouter><TeamMatchesTab teamId="t1" newMatchDate="2026-11-02" /></MemoryRouter>);
    expect(await screen.findByText('setup-form 2026-11-02')).toBeInTheDocument();
  });

  it('opens the setup form from the button', async () => {
    render(<MemoryRouter><TeamMatchesTab teamId="t1" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /new match/i }));
    expect(screen.getByText(/setup-form/)).toBeInTheDocument();
  });
});
