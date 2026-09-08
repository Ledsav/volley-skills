import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamStatsRow } from './TeamStatsRow';
import type { Player } from '../types/player';

function playerWithAvg(avgScore: number | null): Player {
  return { avgScore } as Player;
}

describe('TeamStatsRow', () => {
  it('shows the player count and the team average skill', () => {
    render(<TeamStatsRow players={[playerWithAvg(6), playerWithAvg(8)]} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Players')).toBeInTheDocument();
    expect(screen.getByText('7.0')).toBeInTheDocument();
    expect(screen.getByText('Avg. skill')).toBeInTheDocument();
  });

  it('shows a dash for the average when no player has a score yet', () => {
    render(<TeamStatsRow players={[playerWithAvg(null)]} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
