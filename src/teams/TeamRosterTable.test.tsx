import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TeamRosterTable } from './TeamRosterTable';
import * as playersApi from '../players/playersApi';
import type { Player } from '../types/player';

vi.mock('../players/playersApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function makePlayer(id: string, number: number, fullName: string, position = 'OH'): Player {
  return {
    id,
    number,
    fullName,
    dob: '2012-01-01',
    nationality: 'BEL',
    licenseNumber: 'J-000001',
    position,
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
  it('renders players in the desktop table with a single averaged skill column, not per-skill columns', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('player-1', 1, 'Test Player')],
      lastDoc: null,
      hasMore: false,
    });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findAllByText('Test Player');
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Skill avg')).toBeInTheDocument();
    expect(table.getByText('6.5')).toBeInTheDocument();
    expect(table.getByText('Advanced')).toBeInTheDocument();
    // per-skill column headers are gone
    expect(screen.queryByText('serve')).not.toBeInTheDocument();
    expect(screen.queryByText('reception')).not.toBeInTheDocument();
  });

  it('also renders a mobile card for each player, for narrow screens', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('player-1', 1, 'Test Player')],
      lastDoc: null,
      hasMore: false,
    });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    const cards = await screen.findAllByTestId('roster-mobile-card');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByText('Test Player')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Advanced')).toBeInTheDocument();
  });

  it('truncates a long free-text position instead of distorting the row, with the full text in a title attribute', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('player-1', 1, 'Test Player', 'All-round (developing)')],
      lastDoc: null,
      hasMore: false,
    });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    const positions = await screen.findAllByTitle('All-round (developing)');
    expect(positions.length).toBeGreaterThan(0);
    for (const el of positions) {
      expect(el).toHaveClass('truncate');
    }
  });

  it('loads the next page when "Load more" is clicked', async () => {
    const lastDocStub = { id: 'player-1' } as never;
    vi.spyOn(playersApi, 'listPlayers')
      .mockResolvedValueOnce({ players: [makePlayer('player-1', 1, 'First Player')], lastDoc: lastDocStub, hasMore: true })
      .mockResolvedValueOnce({ players: [makePlayer('player-2', 2, 'Second Player')], lastDoc: null, hasMore: false });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findAllByText('First Player');
    fireEvent.click(screen.getByText('Load more'));

    await waitFor(() => expect(screen.getAllByText('Second Player').length).toBeGreaterThan(0));
    expect(playersApi.listPlayers).toHaveBeenCalledWith('team-1', lastDocStub);
  });
});
