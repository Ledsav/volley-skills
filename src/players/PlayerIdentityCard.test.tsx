import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayerIdentityCard } from './PlayerIdentityCard';
import type { Player } from '../types/player';

const basePlayer: Player = {
  id: 'player-1',
  number: 7,
  fullName: 'Alex Rivera',
  dob: '2011-03-04',
  nationality: 'BEL',
  licenseNumber: 'J-000123',
  positionCategory: 'OH',
  starting: false,
  playerPhone: '',
  guardians: [],
  viewerEmails: [],
  teamName: 'U17 A',
  ageGroup: 'U17',
  season: '2026-27',
  skills: {
    serve: { score: null, notes: '', priority: false },
    attack: { score: null, notes: '', priority: false },
    set: { score: null, notes: '', priority: false },
    defence: { score: null, notes: '', priority: false },
    reception: { score: null, notes: '', priority: false },
    jump: { score: null, notes: '', priority: false },
    speed: { score: null, notes: '', priority: false },
    iq: { score: null, notes: '', priority: false },
  },
  avgScore: null,
  level: null,
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  consent: { given: false, date: null, confirmedBy: null },
  createdBy: 'coach-uid',
  createdAt: null,
  updatedAt: null,
};

describe('PlayerIdentityCard', () => {
  it('shows the name, initials, number, position, and registration metadata', () => {
    render(<PlayerIdentityCard player={basePlayer} />);

    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByText('AR')).toBeInTheDocument();
    expect(screen.getByText(/#7/)).toBeInTheDocument();
    expect(screen.getByText(/Outside/)).toBeInTheDocument();
    expect(screen.getByText('U17 A')).toBeInTheDocument();
    expect(screen.getByText('2026-27')).toBeInTheDocument();
    expect(screen.getByText('J-000123')).toBeInTheDocument();
  });

  it('shows the level only once the player has scores', () => {
    const { rerender } = render(<PlayerIdentityCard player={basePlayer} />);
    expect(screen.queryByText('Advanced')).not.toBeInTheDocument();

    rerender(<PlayerIdentityCard player={{ ...basePlayer, avgScore: 6.4, level: 'Advanced' }} />);
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('6.4')).toBeInTheDocument();
  });
});
