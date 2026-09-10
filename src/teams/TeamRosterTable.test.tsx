import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TeamRosterTable } from './TeamRosterTable';
import * as playersApi from '../players/playersApi';
import { ageFromDob } from '../players/age';
import type { Player, PositionCategory } from '../types/player';

vi.mock('../players/playersApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function makePlayer(
  id: string,
  number: number,
  fullName: string,
  positionCategory: PositionCategory = 'OH',
  extra: Partial<Player> = {}
): Player {
  return {
    id,
    number,
    fullName,
    dob: '2012-01-01',
    nationality: 'BEL',
    licenseNumber: 'J-000001',
    positionCategory,
    starting: false,
    playerPhone: '',
    guardians: [],
    viewerEmails: [],
    teamName: 'U17',
    ageGroup: 'U17',
    season: '2026-27',
    skills: {
      serve: { score: 6, notes: '', priority: false },
      attack: { score: 7, notes: '', priority: false },
      block: { score: null, notes: '', priority: false },
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
    ...extra,
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

  it('shows the position-category label for each player', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('player-1', 1, 'Test Player', 'MB')],
      lastDoc: null,
      hasMore: false,
    });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findAllByText('Test Player');
    expect(within(screen.getByRole('table')).getByText('Middle')).toBeInTheDocument();
  });

  it('removes a player from the list after the delete is confirmed', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('player-1', 1, 'Test Player'), makePlayer('player-2', 2, 'Other Player')],
      lastDoc: null,
      hasMore: false,
    });
    const deleteSpy = vi.spyOn(playersApi, 'deletePlayer').mockResolvedValue(undefined);
    const onPlayersChange = vi.fn();

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" onPlayersChange={onPlayersChange} />
      </MemoryRouter>
    );

    await screen.findAllByText('Test Player');
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: 'Remove Test Player' }));
    fireEvent.click(screen.getByText('Yes, remove player'));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('team-1', 'player-1'));
    await waitFor(() => expect(screen.queryAllByText('Test Player')).toHaveLength(0));
    expect(screen.getAllByText('Other Player').length).toBeGreaterThan(0);
    expect(onPlayersChange).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'player-2' })]);
  });

  it('keeps the Remove control outside the player-card link so it never navigates', async () => {
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
    for (const button of screen.getAllByRole('button', { name: 'Remove Test Player' })) {
      expect(button.closest('a')).toBeNull();
    }
  });

  it('shows an error and keeps the player when the delete fails', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('player-1', 1, 'Test Player')],
      lastDoc: null,
      hasMore: false,
    });
    vi.spyOn(playersApi, 'deletePlayer').mockRejectedValue({ code: 'permission-denied' });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findAllByText('Test Player');
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: 'Remove Test Player' }));
    fireEvent.click(screen.getByText('Yes, remove player'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not remove/i);
    expect(screen.getAllByText('Test Player').length).toBeGreaterThan(0);
  });

  it('filters the roster by a case-insensitive search over name and position category', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [
        makePlayer('p1', 1, 'Ana Silva', 'S'),
        makePlayer('p2', 2, 'Bea Costa', 'MB'),
      ],
      lastDoc: null,
      hasMore: false,
    });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findAllByText('Ana Silva');
    fireEvent.change(screen.getByRole('searchbox', { name: /search/i }), { target: { value: 'mb' } });

    await waitFor(() => expect(screen.queryAllByText('Ana Silva')).toHaveLength(0));
    expect(screen.getAllByText('Bea Costa').length).toBeGreaterThan(0);
  });

  it('shows each player age computed from the date of birth, and can sort oldest first', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [
        makePlayer('younger', 1, 'Younger Player', 'OH', { dob: '2012-01-01' }),
        makePlayer('older', 2, 'Older Player', 'OH', { dob: '2008-01-01' }),
      ],
      lastDoc: null,
      hasMore: false,
    });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findAllByText('Older Player');
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Age')).toBeInTheDocument();
    expect(table.getByText(`${ageFromDob('2008-01-01')}y`)).toBeInTheDocument();
    expect(table.getByText(`${ageFromDob('2012-01-01')}y`)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: /sort/i }), { target: { value: 'age' } });
    await waitFor(() => {
      const names = table.getAllByRole('link').map((a) => a.textContent);
      expect(names).toEqual(['Older Player', 'Younger Player']);
    });
  });

  it('orders the table by skill average, highest first, when that sort is chosen', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [
        makePlayer('low', 1, 'Low Score', 'OH', { avgScore: 4.1 }),
        makePlayer('high', 2, 'High Score', 'OH', { avgScore: 8.7 }),
      ],
      lastDoc: null,
      hasMore: false,
    });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findAllByText('Low Score');
    fireEvent.change(screen.getByRole('combobox', { name: /sort/i }), { target: { value: 'skill' } });

    await waitFor(() => {
      const names = within(screen.getByRole('table'))
        .getAllByRole('link')
        .map((a) => a.textContent);
      expect(names).toEqual(['High Score', 'Low Score']);
    });
  });

  it('defaults to the lineup order: starters first, then setter before outside', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [
        makePlayer('sub', 1, 'Sub Setter', 'S', { starting: false }),
        makePlayer('oh', 2, 'Starting OH', 'OH', { starting: true }),
        makePlayer('setter', 3, 'Starting Setter', 'S', { starting: true }),
      ],
      lastDoc: null,
      hasMore: false,
    });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findAllByText('Sub Setter');

    await waitFor(() => {
      const names = within(screen.getByRole('table'))
        .getAllByRole('link')
        .map((a) => a.textContent);
      expect(names).toEqual(['Starting Setter', 'Starting OH', 'Sub Setter']);
    });
    expect((screen.getByRole('combobox', { name: /sort/i }) as HTMLSelectElement).value).toBe('lineup');
  });

  it('toggles a player starting flag through the roster checkbox', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('p1', 1, 'Test Player', 'OH', { starting: false })],
      lastDoc: null,
      hasMore: false,
    });
    const startingSpy = vi.spyOn(playersApi, 'setPlayerStarting').mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findAllByText('Test Player');
    const checkbox = within(screen.getByRole('table')).getByRole('checkbox', { name: /starting.*test player/i });
    fireEvent.click(checkbox);

    await waitFor(() => expect(startingSpy).toHaveBeenCalledWith('team-1', 'p1', true));
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
