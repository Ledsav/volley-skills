import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finished, player } from '../../awards/testMatches';
import * as matchesApi from '../../matches/matchesApi';
import { downloadText } from '../../export/exportJson';
import type { Team } from '../../types/team';
import { TeamStatsTab } from './TeamStatsTab';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../../matches/matchesApi', async (orig) => ({
  ...(await orig<typeof import('../../matches/matchesApi')>()),
  listFinishedMatches: vi.fn(),
  loadTeamRoster: vi.fn(),
}));
vi.mock('../../export/exportJson', async (orig) => ({ ...(await orig<typeof import('../../export/exportJson')>()), downloadText: vi.fn() }));

const team = { id: 't1', name: 'U17 Girls', season: '2026-27', adminEmails: [] } as unknown as Team;

describe('TeamStatsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(matchesApi.loadTeamRoster).mockResolvedValue([]);
  });

  it('shows coverage, KPIs and leaderboards', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([
      finished('m1', '2026-09-01', [player('a', { A: '########' })]),
      finished('m2', '2026-09-08', null),
    ]);
    render(<MemoryRouter><TeamStatsTab team={team} /></MemoryRouter>);
    expect(await screen.findByText(/Based on 1 scouted match/)).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Top scorer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Season awards/ })).toHaveAttribute('href', '/teams/t1/awards');
  });

  it('empty state when nothing is scouted', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([finished('m2', '2026-09-08', null)]);
    render(<MemoryRouter><TeamStatsTab team={team} /></MemoryRouter>);
    expect(await screen.findByText(/No scouted matches yet/)).toBeInTheDocument();
  });

  it('load error is shown inline', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockRejectedValue(new Error('x'));
    render(<MemoryRouter><TeamStatsTab team={team} /></MemoryRouter>);
    expect(await screen.findByText('Could not load team stats.')).toBeInTheDocument();
  });

  it('exports: print and CSV', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([finished('m1', '2026-09-01', [player('a', { A: '#' })])]);
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<MemoryRouter><TeamStatsTab team={team} /></MemoryRouter>);
    await screen.findByText(/Based on 1 scouted match/);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Print / PDF' }));
    expect(print).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'CSV · Excel (Belgium/EU)' }));
    expect(downloadText).toHaveBeenCalledWith(expect.stringMatching(/U17-Girls-stats/), expect.any(String), 'text/csv;charset=utf-8');
  });

  it('filter changes the URL-driven view', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([
      finished('m1', '2026-09-01', [player('a', { A: '#' })], { competition: 'cup' }),
      finished('m2', '2026-09-08', [player('a', { A: '#' })], { competition: 'league' }),
    ]);
    render(<MemoryRouter><TeamStatsTab team={team} /></MemoryRouter>);
    await screen.findByText(/Based on 2 scouted matches/);
    fireEvent.change(screen.getByLabelText('Competition'), { target: { value: 'cup' } });
    expect(await screen.findByText(/Showing 1 of 2 matches/)).toBeInTheDocument();
  });
});
