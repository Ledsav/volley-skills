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
    shirtSize: '',
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

function renderRoster() {
  return render(
    <MemoryRouter>
      <TeamRosterTable teamId="team-1" />
    </MemoryRouter>
  );
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

  it('keeps the wide table for screens it fits and uses grouped rows below that', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('player-1', 7, 'Marie Dubois', 'MB')],
      lastDoc: null,
      hasMore: false,
    });

    renderRoster();

    const rowList = (await screen.findAllByTestId('roster-mobile-card'))[0].parentElement as HTMLElement;
    expect(rowList.className).toContain('xl:hidden');
    expect(rowList.className).not.toContain('sm:grid-cols-2');

    // `relative` keeps the header's absolutely-positioned sr-only text inside the box instead of widening the page.
    const tableWrapper = screen.getByRole('table').parentElement as HTMLElement;
    expect(tableWrapper.className).toContain('xl:block');
    expect(tableWrapper.className).toContain('relative');
  });

  it('the phone row shows position, number, age, average and level', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('player-1', 7, 'Marie Dubois', 'MB', { dob: '2009-04-12', avgScore: 6.5, level: 'Developing' })],
      lastDoc: null,
      hasMore: false,
    });

    renderRoster();

    const card = within((await screen.findAllByTestId('roster-mobile-card'))[0]);
    expect(card.getByText(/Middle · #7/)).toBeInTheDocument();
    expect(card.getByText('6.5')).toBeInTheDocument();
    expect(card.getByText('Developing')).toBeInTheDocument();
  });

  it("shows a Starting chip on a starting player's row", async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [
        makePlayer('p1', 1, 'Starter One', 'OH', { starting: true }),
        makePlayer('p2', 2, 'Bench Two', 'OH', { starting: false }),
      ],
      lastDoc: null,
      hasMore: false,
    });
    renderRoster();
    const cards = await screen.findAllByTestId('roster-mobile-card');
    expect(within(cards[0]).getByText('Starting')).toBeInTheDocument();
    expect(within(cards[1]).queryByText('Starting')).not.toBeInTheDocument();
  });

  it('the row menu sets a player as starting', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('p1', 1, 'Test Player', 'OH', { starting: false })],
      lastDoc: null,
      hasMore: false,
    });
    const startingSpy = vi.spyOn(playersApi, 'setPlayerStarting').mockResolvedValue(undefined);
    renderRoster();
    await screen.findAllByText('Test Player');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Test Player' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Set as starting' }));
    await waitFor(() => expect(startingSpy).toHaveBeenCalledWith('team-1', 'p1', true));
    expect(within((await screen.findAllByTestId('roster-mobile-card'))[0]).getByText('Starting')).toBeInTheDocument();
  });

  it('right-click on a phone row offers Open card, Set as starting and Remove…', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('p1', 1, 'Test Player')],
      lastDoc: null,
      hasMore: false,
    });
    renderRoster();
    const card = (await screen.findAllByTestId('roster-mobile-card'))[0];
    fireEvent.contextMenu(card, { clientX: 20, clientY: 20 });
    const items = (await screen.findAllByRole('menuitem')).map((m) => m.textContent);
    expect(items).toEqual(['Open card', 'Set as starting', 'Remove…']);
  });

  it('Remove… from a row menu opens the confirmation and never deletes directly', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('p1', 1, 'Test Player')],
      lastDoc: null,
      hasMore: false,
    });
    const deleteSpy = vi.spyOn(playersApi, 'deletePlayer').mockResolvedValue(undefined);
    renderRoster();
    await screen.findAllByText('Test Player');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Test Player' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove…' }));
    expect(await screen.findByText('Yes, remove player')).toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('a column header sorts by skill and marks aria-sort', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [
        makePlayer('low', 1, 'Low Score', 'OH', { avgScore: 4.1 }),
        makePlayer('high', 2, 'High Score', 'OH', { avgScore: 8.7 }),
      ],
      lastDoc: null,
      hasMore: false,
    });
    renderRoster();
    await screen.findAllByText('Low Score');
    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Skill avg' }));
    await waitFor(() => {
      expect(table.getAllByRole('link').map((a) => a.textContent)).toEqual(['High Score', 'Low Score']);
    });
    expect(table.getByRole('columnheader', { name: 'Skill avg' })).toHaveAttribute('aria-sort', 'descending');
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

  it('shows each player birthdate with the age beside it, and can sort oldest first by birthdate', async () => {
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
    expect(table.getByText('Born')).toBeInTheDocument();
    expect(table.getByText('2008-01-01')).toBeInTheDocument();
    expect(table.getByText('2012-01-01')).toBeInTheDocument();
    expect(table.getByText(`· ${ageFromDob('2008-01-01')}y`)).toBeInTheDocument();
    expect(table.getByText(`· ${ageFromDob('2012-01-01')}y`)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: /sort/i }), { target: { value: 'birthdate' } });
    await waitFor(() => {
      const names = table.getAllByRole('link').map((a) => a.textContent);
      expect(names).toEqual(['Older Player', 'Younger Player']);
    });
  });

  it('orders same-age players by their actual birthdate when sorting by birthdate', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [
        makePlayer('nov', 1, 'November Player', 'OH', { dob: '2009-11-30' }),
        makePlayer('jan', 2, 'January Player', 'OH', { dob: '2009-01-15' }),
      ],
      lastDoc: null,
      hasMore: false,
    });

    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" />
      </MemoryRouter>
    );

    await screen.findAllByText('January Player');
    fireEvent.change(screen.getByRole('combobox', { name: /sort/i }), { target: { value: 'birthdate' } });
    await waitFor(() => {
      const names = within(screen.getByRole('table'))
        .getAllByRole('link')
        .map((a) => a.textContent);
      expect(names).toEqual(['January Player', 'November Player']);
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

  describe('phone row layout', () => {
    it('puts the Starting chip on the second line and stacks the pill above the average and its bar', async () => {
      vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
        players: [makePlayer('p1', 4, 'Starter One', 'S', { starting: true, avgScore: 6.5, level: 'Advanced' })],
        lastDoc: null,
        hasMore: false,
      });
      renderRoster();
      const card = within((await screen.findAllByTestId('roster-mobile-card'))[0]);
      const nameLine = card.getByText('Starter One');
      const chip = card.getByText('Starting');
      // the chip shares the subtitle line, not the name line
      expect(nameLine.parentElement).toBe(chip.parentElement?.parentElement);
      expect(chip.parentElement).not.toBe(nameLine.parentElement);
      expect(chip.nextElementSibling).toHaveTextContent(/Setter · #4/);
      // pill above the number + bar in one trailing column
      const pill = card.getByText('Advanced');
      const column = pill.parentElement as HTMLElement;
      expect(column.className).toContain('flex-col');
      expect(column).toContainElement(card.getByText('6.5'));
      expect(column).toContainElement(card.getByTestId('avg-skill-bar'));
    });

    it('draws a decorative avg-skill bar at avgScore/10 in the level colour, empty when unrated', async () => {
      vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
        players: [
          makePlayer('p1', 1, 'Rated', 'OH', { avgScore: 6.5, level: 'Advanced' }),
          makePlayer('p2', 2, 'Unrated', 'OH', { avgScore: null, level: null }),
        ],
        lastDoc: null,
        hasMore: false,
      });
      renderRoster();
      const cards = await screen.findAllByTestId('roster-mobile-card');
      const bar = within(cards[0]).getByTestId('avg-skill-bar');
      expect(bar).toHaveAttribute('aria-hidden', 'true');
      const fill = within(bar).getByTestId('avg-skill-fill');
      expect(fill).toHaveStyle({ width: '65%' });
      expect(fill.className).toContain('bg-blue');
      expect(within(cards[1]).getByTestId('avg-skill-fill')).toHaveStyle({ width: '0%' });
      // the desktop average cell has the bar too
      expect(within(screen.getByRole('table')).getAllByTestId('avg-skill-bar')).toHaveLength(2);
    });
  });

  describe('Position sort', () => {
    const roster = () => [
      makePlayer('mb', 8, 'Mia Block', 'MB'),
      makePlayer('s2', 6, 'Sara Set', 'S'),
      makePlayer('s1', 3, 'Sofia Set', 'S'),
      makePlayer('tbd', 1, 'Tess New', 'TBD'),
    ];

    it('shows no group headers under the default Lineup sort', async () => {
      vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: roster(), lastDoc: null, hasMore: false });
      renderRoster();
      await screen.findAllByTestId('roster-mobile-card');
      expect(screen.queryByRole('heading', { name: 'Setters' })).not.toBeInTheDocument();
      expect(screen.getByRole('table').querySelectorAll('th[scope="rowgroup"]')).toHaveLength(0);
    });

    it('groups the phone list by position, one list per group', async () => {
      vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: roster(), lastDoc: null, hasMore: false });
      renderRoster();
      await screen.findAllByTestId('roster-mobile-card');
      fireEvent.change(screen.getByRole('combobox', { name: /sort/i }), { target: { value: 'position' } });
      const headings = (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent);
      expect(headings).toEqual(['Setters', 'Middle blockers', 'Position not set']);
      const cards = screen.getAllByTestId('roster-mobile-card');
      expect(cards.map((c) => within(c).getByText(/^(Sofia|Sara|Mia|Tess)/).textContent)).toEqual([
        'Sofia Set',
        'Sara Set',
        'Mia Block',
        'Tess New',
      ]);
      expect(new Set(cards.map((c) => c.parentElement)).size).toBe(3);
    });

    it('groups the table with one tbody per position and a rowgroup header, sortable from the Position header', async () => {
      vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: roster(), lastDoc: null, hasMore: false });
      renderRoster();
      await screen.findAllByTestId('roster-mobile-card');
      const table = within(screen.getByRole('table'));
      fireEvent.click(table.getByRole('button', { name: 'Position' }));
      await waitFor(() => expect(screen.getByRole('table').querySelectorAll('tbody')).toHaveLength(3));
      expect(table.getByRole('columnheader', { name: 'Position' })).toHaveAttribute('aria-sort', 'ascending');
      const groupHeaders = screen.getByRole('table').querySelectorAll('th[scope="rowgroup"]');
      expect(Array.from(groupHeaders).map((h) => h.textContent)).toEqual(['Setters', 'Middle blockers', 'Position not set']);
    });
  });

  describe('row kebab', () => {
    it('reports aria-expanded and closes the menu when pressed again', async () => {
      vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
        players: [makePlayer('p1', 1, 'Test Player')],
        lastDoc: null,
        hasMore: false,
      });
      renderRoster();
      await screen.findAllByText('Test Player');
      const kebab = screen.getByRole('button', { name: 'Actions for Test Player' });
      expect(kebab).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(kebab);
      expect(await screen.findByRole('menu')).toBeInTheDocument();
      expect(kebab).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(kebab);
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(kebab).toHaveAttribute('aria-expanded', 'false');
    });

    it('stays closed when the press that closes the menu is the kebab itself', async () => {
      vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
        players: [makePlayer('p1', 1, 'Test Player')],
        lastDoc: null,
        hasMore: false,
      });
      renderRoster();
      await screen.findAllByText('Test Player');
      const kebab = screen.getByRole('button', { name: 'Actions for Test Player' });
      fireEvent.click(kebab);
      await screen.findByRole('menu');
      // a real press: pointerdown reaches the document first and closes the menu, then click arrives
      fireEvent.pointerDown(kebab);
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      fireEvent.click(kebab);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('reverts the Starting toggle and shows the error when saving fails (invariant 27)', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({
      players: [makePlayer('p1', 1, 'Test Player', 'OH', { starting: false })],
      lastDoc: null,
      hasMore: false,
    });
    vi.spyOn(playersApi, 'setPlayerStarting').mockRejectedValue(new Error('offline'));
    const onPlayersChange = vi.fn();
    render(
      <MemoryRouter>
        <TeamRosterTable teamId="team-1" onPlayersChange={onPlayersChange} />
      </MemoryRouter>
    );
    await screen.findAllByText('Test Player');
    const checkbox = within(screen.getByRole('table')).getByRole('checkbox', { name: /starting.*test player/i });
    fireEvent.click(checkbox);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not update the lineup/i);
    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(screen.queryByText('Starting')).not.toBeInTheDocument();
    expect(onPlayersChange).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'p1', starting: false })]);
  });
});
