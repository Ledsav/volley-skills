import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { SeasonStats } from './matchRating';
import { PlayerMatchStatsSection } from './PlayerMatchStatsSection';

const season: SeasonStats = {
  matchesPlayed: 2,
  skills: {},
  attackEff: 0.3,
  serveEff: -0.1,
  receptionPos: 0.55,
  receptionPerfect: 0.2,
  points: 14,
  errors: 6,
  rows: [
    { matchId: 'm2', date: '2026-10-08', opponent: 'Rivals', attackEff: 0.25, serveEff: 0, receptionPos: 0.5, points: 6, errors: 2 },
    { matchId: 'm1', date: '2026-10-01', opponent: 'Neighbours', attackEff: null, serveEff: null, receptionPos: null, points: 8, errors: 4 },
  ],
};

const renderSection = (props: Partial<Parameters<typeof PlayerMatchStatsSection>[0]> = {}) =>
  render(
    <MemoryRouter>
      <PlayerMatchStatsSection teamId="t1" season={season} error={false} {...props} />
    </MemoryRouter>,
  );

describe('PlayerMatchStatsSection', () => {
  it('shows season KPIs and one linked row per match', () => {
    renderSection();
    expect(screen.getByText('+30%')).toBeInTheDocument();
    expect(screen.getByText('55%')).toBeInTheDocument();
    expect(screen.getByText('14 / 6')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rivals' })).toHaveAttribute('href', '/teams/t1/matches/m2');
    expect(screen.getByRole('row', { name: '2026-10-01 vs Neighbours' })).toHaveTextContent('8 / 4');
  });

  it('shows loading, error and empty states', () => {
    const { rerender } = renderSection({ season: null });
    expect(screen.getByText('Loading match stats…')).toBeInTheDocument();
    rerender(<MemoryRouter><PlayerMatchStatsSection teamId="t1" season={null} error /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load match stats.');
    rerender(<MemoryRouter><PlayerMatchStatsSection teamId="t1" season={{ ...season, matchesPlayed: 0, rows: [] }} error={false} /></MemoryRouter>);
    expect(screen.getByText('No scouted matches for this player yet.')).toBeInTheDocument();
  });
});
