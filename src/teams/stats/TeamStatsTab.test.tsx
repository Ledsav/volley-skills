import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finished, player } from '../../awards/testMatches';
import * as matchesApi from '../../matches/matchesApi';
import { WithChrome } from '../../test/chromeProbe';
import { downloadText } from '../../export/exportJson';
import type { Team } from '../../types/team';
import TeamStatsTab from './TeamStatsTab';

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
    render(<MemoryRouter><WithChrome><TeamStatsTab team={team} /></WithChrome></MemoryRouter>);
    expect(await screen.findByText(/Based on 1 scouted match/)).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Top scorer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Season awards/ })).toHaveAttribute('href', '/teams/t1/awards');
  });

  it('empty state when nothing is scouted', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([finished('m2', '2026-09-08', null)]);
    render(<MemoryRouter><WithChrome><TeamStatsTab team={team} /></WithChrome></MemoryRouter>);
    expect(await screen.findByText(/No scouted matches yet/)).toBeInTheDocument();
  });

  it('load error is shown inline', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockRejectedValue(new Error('x'));
    render(<MemoryRouter><WithChrome><TeamStatsTab team={team} /></WithChrome></MemoryRouter>);
    expect(await screen.findByText('Could not load team stats.')).toBeInTheDocument();
  });

  it('Export in the toolbar prints and downloads CSV', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([finished('m1', '2026-09-01', [player('a', { A: '#' })])]);
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<MemoryRouter><WithChrome><TeamStatsTab team={team} /></WithChrome></MemoryRouter>);
    await screen.findByText(/Based on 1 scouted match/);
    fireEvent.click(screen.getByRole('button', { name: 'Print / PDF' }));
    expect(print).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'CSV · Excel (Belgium/EU)' }));
    expect(downloadText).toHaveBeenCalledWith(expect.stringMatching(/U17-Girls-stats/), expect.any(String), 'text/csv;charset=utf-8');
  });

  it('publishes no Export before there is anything to export', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([finished('m2', '2026-09-08', null)]);
    render(<MemoryRouter><WithChrome><TeamStatsTab team={team} /></WithChrome></MemoryRouter>);
    await screen.findByText(/No scouted matches yet/);
    expect(screen.queryByRole('button', { name: 'Print / PDF' })).not.toBeInTheDocument();
  });

  it('CSV from the toolbar exports what the current filter shows', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([
      finished('m1', '2026-09-01', [player('a', { A: '#' })], { competition: 'cup' }),
      finished('m2', '2026-09-08', [player('a', { A: '#' })], { competition: 'league' }),
    ]);
    render(<MemoryRouter><WithChrome><TeamStatsTab team={team} /></WithChrome></MemoryRouter>);
    await screen.findByText(/Based on 2 scouted matches/);
    fireEvent.click(screen.getByRole('button', { name: /Competition/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Cup' }));
    await screen.findByText(/Showing 1 of 2 matches/);
    fireEvent.click(screen.getByRole('button', { name: 'CSV · Excel (Belgium/EU)' }));
    expect(downloadText).toHaveBeenCalledWith(expect.stringMatching(/stats-2026-09-01-2026-09-01\.csv$/), expect.any(String), 'text/csv;charset=utf-8');
  });

  it('shows skeletons with a status while loading', () => {
    vi.mocked(matchesApi.listFinishedMatches).mockReturnValue(new Promise(() => undefined));
    render(<MemoryRouter><WithChrome><TeamStatsTab team={team} /></WithChrome></MemoryRouter>);
    expect(within(screen.getByRole('status')).getByText('Loading team stats…')).toBeInTheDocument();
  });

  it('switching Last 5 to Dates seeds the inputs from all matches and keeps data', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([
      finished('m1', '2026-09-01', [player('a', { A: '#' })]),
      finished('m2', '2026-09-08', [player('a', { A: '#' })]),
    ]);
    render(<MemoryRouter><WithChrome><TeamStatsTab team={team} /></WithChrome></MemoryRouter>);
    await screen.findByText(/Based on 2 scouted matches/);
    fireEvent.click(screen.getByRole('radio', { name: 'Last 5' }));
    expect(await screen.findByText(/Showing the last 5 scouted matches/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Dates…' }));
    expect(await screen.findByLabelText('From')).toHaveValue('2026-09-01');
    expect(screen.getByLabelText('To')).toHaveValue('2026-09-08');
    expect(screen.getByRole('region', { name: 'Top scorer' })).toBeInTheDocument();
  });

  it('filter changes the URL-driven view', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([
      finished('m1', '2026-09-01', [player('a', { A: '#' })], { competition: 'cup' }),
      finished('m2', '2026-09-08', [player('a', { A: '#' })], { competition: 'league' }),
    ]);
    render(<MemoryRouter><WithChrome><TeamStatsTab team={team} /></WithChrome></MemoryRouter>);
    await screen.findByText(/Based on 2 scouted matches/);
    fireEvent.click(screen.getByRole('button', { name: /Competition/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Cup' }));
    expect(await screen.findByText(/Showing 1 of 2 matches/)).toBeInTheDocument();
  });
});
