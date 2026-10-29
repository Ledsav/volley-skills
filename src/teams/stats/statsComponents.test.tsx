import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { AwardRanking } from '../../awards/awardRules';
import type { Person } from './rosterIndex';
import { Leaderboards } from './Leaderboards';
import { PlayerStatsTable } from './PlayerStatsTable';
import { RotationBars } from './RotationBars';
import { TeamTrendChart } from './TeamTrendChart';
import type { TeamPlayerRow } from './teamSeason';

const people = new Map<string, Person>([
  ['a', { playerId: 'a', name: 'Ana', number: 7, current: true }],
  ['b', { playerId: 'b', name: 'Bea', number: 9, current: false }],
]);

describe('stats components', () => {
  it('leaderboards: top 3, links only for current players, not-enough-data line', () => {
    const rankings: AwardRanking[] = [{
      id: 'attacker',
      ranked: [
        { playerId: 'a', value: 0.4, display: '+40% att. eff.', attempts: 40, rank: 1 },
        { playerId: 'b', value: 0.3, display: '+30% att. eff.', attempts: 35, rank: 2 },
      ],
      notEnoughData: ['c'],
    }];
    render(<MemoryRouter><Leaderboards teamId="t1" rankings={rankings} people={people} /></MemoryRouter>);
    const card = screen.getByRole('region', { name: 'Best attacker' });
    expect(within(card).getByRole('link', { name: /#7 Ana/ })).toHaveAttribute('href', '/teams/t1/players/a');
    expect(within(card).getByText(/#9 Bea/).closest('a')).toBeNull();
    expect(within(card).getByText('+40% att. eff. · 40 att.')).toBeInTheDocument();
    expect(within(card).getByText(/Not enough data: Unknown player/)).toBeInTheDocument();
  });

  it('leaderboards: shows every player tied at rank 3', () => {
    const tied = ['a', 'b', 'c', 'd'].map((playerId) => ({ playerId, value: 0.3, display: '+30% att. eff.', attempts: 20, rank: 1 }));
    render(<MemoryRouter><Leaderboards teamId="t1" rankings={[{ id: 'attacker', ranked: tied, notEnoughData: [] }]} people={people} /></MemoryRouter>);
    expect(within(screen.getByRole('region', { name: 'Best attacker' })).getAllByRole('listitem')).toHaveLength(4);
  });

  it('leaderboard with no ranked players says so', () => {
    render(<MemoryRouter><Leaderboards teamId="t1" rankings={[{ id: 'setter', ranked: [], notEnoughData: [] }]} people={people} /></MemoryRouter>);
    expect(within(screen.getByRole('region', { name: 'Best setter' })).getByText('No data yet')).toBeInTheDocument();
  });

  const row = (over: Partial<TeamPlayerRow>): TeamPlayerRow => ({
    playerId: 'a', number: 7, name: 'Ana', current: true, matchesPlayed: 2, points: 5, errors: 1, mvpAvg: 2,
    attackEff: 0.1, serveEff: null, receptionPos: null, ratings: {}, ...over,
  });

  it("leaderboard bars take the band of the player's season rating", () => {
    const rankings: AwardRanking[] = [{ id: 'attacker', ranked: [{ playerId: 'a', value: 0.4, display: '+40% att. eff.', attempts: 40, rank: 1 }], notEnoughData: [] }];
    const players = [row({ ratings: { attack: { rating: 8.5, attempts: 40 } } })];
    render(<MemoryRouter><Leaderboards teamId="t1" rankings={rankings} people={people} players={players} /></MemoryRouter>);
    const fill = within(screen.getByRole('region', { name: 'Best attacker' })).getByRole('listitem').querySelector('[data-band]')!;
    expect(fill).toHaveAttribute('data-band', 'Elite');
    expect(fill.className).toMatch(/(^|\s)bg-green(\s|$)/);
  });

  it('a card whose leader is negative draws empty bars', () => {
    const ranked = [
      { playerId: 'a', value: -0.05, display: '-5% att. eff.', attempts: 40, rank: 1 },
      { playerId: 'b', value: -0.1, display: '-10% att. eff.', attempts: 35, rank: 2 },
    ];
    render(<MemoryRouter><Leaderboards teamId="t1" rankings={[{ id: 'attacker', ranked, notEnoughData: [] }]} people={people} /></MemoryRouter>);
    const fills = within(screen.getByRole('region', { name: 'Best attacker' })).getAllByRole('listitem').map((li) => li.querySelector('[data-band]') as HTMLElement);
    expect(fills).toHaveLength(2);
    fills.forEach((f) => expect(f.style.width).toBe('0%'));
  });

  it('rotation bars say how best and weakest are judged', () => {
    render(<RotationBars rotations={{ 1: { won: 4, lost: 2 }, 2: { won: 1, lost: 5 }, 3: { won: 0, lost: 0 }, 4: { won: 0, lost: 0 }, 5: { won: 0, lost: 0 }, 6: { won: 0, lost: 0 } }} best={1} weakest={2} />);
    expect(screen.getByText('In rotation order 1 to 6. Best and weakest by share of rallies won.')).toBeInTheDocument();
  });

  it('player table sorts by a column', () => {
    const rows: TeamPlayerRow[] = [
      { playerId: 'a', number: 7, name: 'Ana', current: true, matchesPlayed: 2, points: 5, errors: 1, mvpAvg: 2, attackEff: 0.1, serveEff: null, receptionPos: null, ratings: {} },
      { playerId: 'b', number: 9, name: 'Bea', current: true, matchesPlayed: 3, points: 9, errors: 2, mvpAvg: 4, attackEff: 0.3, serveEff: null, receptionPos: null, ratings: {} },
    ];
    render(<MemoryRouter><PlayerStatsTable teamId="t1" rows={rows} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Points/ }));
    const firstRow = screen.getAllByRole('row')[1];
    expect(within(firstRow).getByText('Bea')).toBeInTheDocument();
  });

  it('trend chart has an accessible data table; rotations call out best and weakest', () => {
    render(<TeamTrendChart points={[
      { matchId: 'm1', date: '2026-09-01', opponent: 'X', won: true, sideOut: 0.5, attackEff: 0.2, receptionPos: 0.6 },
      { matchId: 'm2', date: '2026-09-08', opponent: 'Y', won: false, sideOut: 0.4, attackEff: null, receptionPos: 0.5 },
    ]} />);
    expect(screen.getByRole('table', { name: 'Trend data' })).toBeInTheDocument();
    render(<RotationBars rotations={{ 1: { won: 4, lost: 2 }, 2: { won: 1, lost: 5 }, 3: { won: 0, lost: 0 }, 4: { won: 0, lost: 0 }, 5: { won: 0, lost: 0 }, 6: { won: 0, lost: 0 } }} best={1} weakest={2} />);
    expect(screen.getByText('Best rotation: 1')).toBeInTheDocument();
    expect(screen.getByText('Weakest rotation: 2')).toBeInTheDocument();
  });
});
