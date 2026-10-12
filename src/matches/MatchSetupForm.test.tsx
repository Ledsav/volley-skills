import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchSetupInput } from '../types/match';
import type { Player } from '../types/player';
import { MatchSetupForm } from './MatchSetupForm';
import * as matchesApi from './matchesApi';

vi.mock('./matchesApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const players = [
  ['s', 2, 'S'], ['a', 7, 'OH'], ['b', 9, 'OH'], ['m1', 11, 'MB'], ['m2', 12, 'MB'], ['o', 4, 'O'], ['l', 1, 'L'],
].map(([id, number, positionCategory]) => ({ id, number, fullName: `Name ${id}`, positionCategory, starting: false }) as Player);

describe('MatchSetupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(matchesApi.loadTeamRoster).mockResolvedValue(players);
  });

  it('submits a match with all players ticked and a libero replacing the middles', async () => {
    const onSubmit = vi.fn<(input: MatchSetupInput) => Promise<void>>(() => Promise.resolve());
    render(<MatchSetupForm teamId="t1" defaultDate="2026-10-18" submitLabel="Create match" onSubmit={onSubmit} onCancel={vi.fn()} />);
    await screen.findByText('#7 Name a');

    fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'Rivals' } });
    fireEvent.change(screen.getByLabelText('Libero 1'), { target: { value: 'l' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create match' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const input = onSubmit.mock.calls[0][0];
    expect(input).toMatchObject({ date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home' });
    expect(input.roster).toHaveLength(7);
    expect(input.liberos).toEqual([{ playerId: 'l', mode: 'always', replaces: ['m1', 'm2'] }]);
  });

  it('shows the validation error instead of submitting', async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(<MatchSetupForm teamId="t1" defaultDate="2026-10-18" submitLabel="Create match" onSubmit={onSubmit} onCancel={vi.fn()} />);
    await screen.findByText('#7 Name a');
    fireEvent.click(screen.getByRole('button', { name: 'Create match' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/opponent/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
