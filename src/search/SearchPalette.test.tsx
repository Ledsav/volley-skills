import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Access } from '../auth/access';
import { SearchPalette } from './SearchPalette';
import { pushRecent } from './recents';
import type { SearchItem } from './types';

const admin: Access = { isClubAdmin: true, sections: { exercises: true, trainings: true, guides: true } };

const mocks = vi.hoisted(() => ({
  access: null as unknown,
  data: {
    teams: [] as SearchItem[],
    players: [] as SearchItem[],
    matches: [] as SearchItem[],
    loading: { teams: false, players: false, matches: false },
  },
}));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ access: mocks.access ?? admin, isPlatformAdmin: false, activeClubId: 'c1' }),
}));
vi.mock('./useSearchData', () => ({ useSearchData: () => mocks.data }));

const teams: SearchItem[] = [{ id: 't1', group: 'teams', label: 'Falcons U17', sublabel: 'U17 · 2026-27', to: '/teams/t1' }];
const player = (n: number): SearchItem => ({ id: `t1/p${n}`, group: 'players', label: `Anna Falcone ${n}`, sublabel: 'Falcons U17', to: `/teams/t1/players/p${n}` });

function Where() {
  const loc = useLocation();
  return <output data-testid="where">{loc.pathname + loc.search + JSON.stringify(loc.state)}</output>;
}

function setup() {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <SearchPalette onClose={onClose} />
      <Where />
    </MemoryRouter>
  );
  return { onClose, input: screen.getByRole('combobox') };
}

const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });
const activeLabel = (input: HTMLElement) => document.getElementById(input.getAttribute('aria-activedescendant') ?? '')?.textContent;

beforeEach(() => {
  mocks.access = null;
  sessionStorage.clear();
  mocks.data = { teams, players: [], matches: [], loading: { teams: false, players: false, matches: false } };
});
afterEach(() => vi.useRealTimers());

describe('SearchPalette', () => {
  it('empty query shows recents then Go to', () => {
    pushRecent('c1', { id: 'teams:t1', group: 'teams', label: 'Falcons U17', to: '/teams/t1' });
    setup();
    const headings = screen.getAllByText(/^(Recent|Go to)$/).map((h) => h.textContent);
    expect(headings).toEqual(['Recent', 'Go to']);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options[0]).toContain('Falcons U17');
    expect(options.some((o) => o?.includes('Teams'))).toBe(true);
  });

  it('arrow keys move aria-activedescendant and Enter navigates', () => {
    const { input, onClose } = setup();
    const first = input.getAttribute('aria-activedescendant');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).not.toBe(first);
    expect(activeLabel(input)).toContain('Teams');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('where').textContent).toContain('/teams');
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('Ctrl+Enter opens in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { input, onClose } = setup();
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(open).toHaveBeenCalledWith('/', '_blank', 'noopener');
    expect(onClose).toHaveBeenCalled();
    open.mockRestore();
  });

  it('Tab jumps to the next group', () => {
    mocks.data.players = [player(1)];
    const { input } = setup();
    type(input, 'fal');
    expect(activeLabel(input)).toContain('Falcons');
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(activeLabel(input)).toContain('Anna Falcone 1');
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(activeLabel(input)).toContain('Falcons');
  });

  it('Esc clears then closes', () => {
    const { input, onClose } = setup();
    type(input, 'fal');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('caps groups at 5 with a Show all N option reachable by keyboard', () => {
    mocks.data.players = Array.from({ length: 7 }, (_, i) => player(i + 1));
    const { input } = setup();
    type(input, 'anna');
    expect(screen.getAllByRole('option')).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
    for (let i = 0; i < 5; i++) fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(activeLabel(input)).toBe('Show all 7');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getAllByRole('option')).toHaveLength(7);
    expect(screen.queryByRole('option', { name: 'Show all 7' })).toBeNull();
    expect(activeLabel(input)).toContain('Anna Falcone 6');
  });

  it('typing collapses expanded groups again', () => {
    mocks.data.players = Array.from({ length: 7 }, (_, i) => player(i + 1));
    const { input } = setup();
    type(input, 'anna');
    fireEvent.click(screen.getByRole('option', { name: 'Show all 7' }));
    expect(screen.getAllByRole('option')).toHaveLength(7);
    type(input, 'anna f');
    expect(screen.getAllByRole('option')).toHaveLength(6);
  });

  it('no results shows the message and Actions', () => {
    const { input } = setup();
    type(input, 'zzzz');
    expect(screen.getByText('No results for ‘zzzz’')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /New team/ })).toBeInTheDocument();
  });

  it('no results and no actions shows no empty Actions heading', () => {
    const none = { isClubAdmin: false, sections: { exercises: false, trainings: false, guides: false } };
    mocks.access = none;
    mocks.data.teams = [];
    const { input } = setup();
    type(input, 'zzzz');
    expect(screen.getByText('No results for ‘zzzz’')).toBeInTheDocument();
    expect(screen.queryByText('Actions')).toBeNull();
  });

  it('the team picker says so when the club has no teams', () => {
    mocks.data.teams = [];
    const { input } = setup();
    type(input, 'add pl');
    fireEvent.click(screen.getByRole('option', { name: /Add player/ }));
    expect(screen.getByText('No teams yet')).toBeInTheDocument();
  });

  it('a team-picker action asks for a team first', () => {
    const { input, onClose } = setup();
    type(input, 'add pl');
    fireEvent.click(screen.getByRole('option', { name: /Add player/ }));
    expect(screen.getByText('Choose a team')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('option', { name: /Falcons U17/ }));
    expect(screen.getByTestId('where').textContent).toContain('/teams/t1?tab=roster');
    expect(screen.getByTestId('where').textContent).toContain('"pendingAction":"add-player"');
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('Esc leaves the team picker before closing', () => {
    const { input, onClose } = setup();
    type(input, 'new match');
    fireEvent.click(screen.getByRole('option', { name: /New match/ }));
    expect(screen.getByText('Choose a team')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Choose a team')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('an action with a URL navigates with its pending action', () => {
    const { input } = setup();
    type(input, 'new team');
    fireEvent.click(screen.getByRole('option', { name: /New team/ }));
    const where = screen.getByTestId('where').textContent;
    expect(where).toContain('/teams');
    expect(where).toContain('"pendingAction":"new-team"');
  });

  it('announces the result count', () => {
    vi.useFakeTimers();
    mocks.data.players = [player(1), player(2)];
    const { input } = setup();
    type(input, 'anna');
    const live = screen.getByText('', { selector: '[aria-live="polite"]' });
    expect(live).toHaveTextContent('');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(live).toHaveTextContent('2 results');
  });

  it('shows skeleton rows while players load', () => {
    mocks.data.loading = { teams: false, players: true, matches: true };
    const { input } = setup();
    type(input, 'mar');
    const playersGroup = screen.getByText('Players').parentElement as HTMLElement;
    expect(playersGroup.querySelectorAll('[data-skeleton-block]')).toHaveLength(2);
    expect(within(playersGroup).queryByRole('option')).toBeNull();
    expect(screen.queryByText(/No results/)).toBeNull();
  });
});
