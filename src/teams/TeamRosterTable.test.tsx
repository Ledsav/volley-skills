import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TeamRosterTable } from './TeamRosterTable';
import * as playersApi from '../players/playersApi';
import type { Player } from '../types/player';

vi.mock('../players/playersApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function makePlayer(id: string, number: number, fullName: string): Player {
  return {
    id,
    number,
    fullName,
    dob: '2012-01-01',
    nationality: 'BEL',
    licenseNumber: 'J-000001',
    position: 'OH',
    playerPhone: '',
    guardians: [],
    viewerEmails: [],
    teamName: 'U17',
    ageGroup: 'U17',
    season: '2026-27',
    skills: {
      serve: { score: 6, notes: '', priority: false },
      attack: { score: 7, notes: '', priority: false },
      set: { score: null, notes: '', priority: false },
      defence: { score: null, notes: '', priority: false },
      reception: { score: null, notes: '', priority: false },
      jump: { score: null, notes: '', priority: false },
      speed: { score: null, notes: '', priority: false },
      iq: { score: null, notes: '', priority: false },
    },
    avgScore: 6.5,
    level: 'Advanced',
    developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
    consent: { given: false, date: null, confirmedBy: null },
    createdBy: 'coach-uid',
    createdAt: null,
    updatedAt: null,
  };
}

describe('TeamRosterTable', () => {
  it('renders the first page of players with their skill scores', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('player-1', 1, 'Test Player')],
      lastDoc: null,
    });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findByText('Test Player');
    expect(screen.getByText('6.5')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });

  it('loads the next page when "Load more" is clicked', async () => {
    const lastDocStub = { id: 'player-1' } as never;
    vi.spyOn(playersApi, 'listPlayers')
      .mockResolvedValueOnce({ players: [makePlayer('player-1', 1, 'First Player')], lastDoc: lastDocStub })
      .mockResolvedValueOnce({ players: [makePlayer('player-2', 2, 'Second Player')], lastDoc: null });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findByText('First Player');
    fireEvent.click(screen.getByText('Load more'));

    await waitFor(() => expect(screen.getByText('Second Player')).toBeInTheDocument());
    expect(playersApi.listPlayers).toHaveBeenCalledWith('team-1', lastDocStub);
  });
});
