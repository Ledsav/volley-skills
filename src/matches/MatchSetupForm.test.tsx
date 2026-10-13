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

  it('stores the per-match role from the role select, defaulting to the profile position', async () => {
    const onSubmit = vi.fn<(input: MatchSetupInput) => Promise<void>>(() => Promise.resolve());
    render(<MatchSetupForm teamId="t1" defaultDate="2026-10-18" submitLabel="Create match" onSubmit={onSubmit} onCancel={vi.fn()} />);
    await screen.findByText('#7 Name a');
    expect(screen.getByLabelText('Role for Name a')).toHaveValue('OH');
    fireEvent.change(screen.getByLabelText('Role for Name a'), { target: { value: 'O' } });
    fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'Rivals' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create match' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const roster = onSubmit.mock.calls[0][0].roster;
    expect(roster.find((r) => r.playerId === 'a')?.positionCategory).toBe('O');
    expect(roster.find((r) => r.playerId === 'b')?.positionCategory).toBe('OH');
  });

  it('shows the validation error instead of submitting', async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(<MatchSetupForm teamId="t1" defaultDate="2026-10-18" submitLabel="Create match" onSubmit={onSubmit} onCancel={vi.fn()} />);
    await screen.findByText('#7 Name a');
    fireEvent.click(screen.getByRole('button', { name: 'Create match' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/opponent/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows Saved immediately, without waiting for the server write', async () => {
    const onSubmit = vi.fn<(input: MatchSetupInput) => Promise<void>>(() => new Promise<void>(() => undefined));
    const onDirtyChange = vi.fn();
    render(
      <MatchSetupForm teamId="t1" defaultDate="2026-10-18" submitLabel="Save setup" onSubmit={onSubmit} onCancel={vi.fn()} onDirtyChange={onDirtyChange} />,
    );
    await screen.findByText('#7 Name a');
    fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'Rivals' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('button', { name: 'Save setup' })).toBeEnabled();
  });

  it('surfaces a rejected write after the fact and marks the form dirty again', async () => {
    let reject: (e: Error) => void = () => undefined;
    const onSubmit = vi.fn<(input: MatchSetupInput) => Promise<void>>(() => new Promise<void>((_, r) => (reject = r)));
    const onDirtyChange = vi.fn();
    render(
      <MatchSetupForm teamId="t1" defaultDate="2026-10-18" submitLabel="Save setup" onSubmit={onSubmit} onCancel={vi.fn()} onDirtyChange={onDirtyChange} />,
    );
    await screen.findByText('#7 Name a');
    fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'Rivals' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    await screen.findByText('Saved.');
    reject(new Error('denied'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i);
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('re-enables the submit button and shows Saved after a successful submit', async () => {
    const onSubmit = vi.fn<(input: MatchSetupInput) => Promise<void>>(() => Promise.resolve());
    render(<MatchSetupForm teamId="t1" defaultDate="2026-10-18" submitLabel="Save setup" onSubmit={onSubmit} onCancel={vi.fn()} />);
    await screen.findByText('#7 Name a');
    fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'Rivals' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save setup' })).toBeEnabled();
  });

  it('ticks at most 14 players, shows the counter, and pre-fills the libero', async () => {
    const big = Array.from({ length: 16 }, (_, i) => ({ id: `x${i}`, number: i + 1, fullName: `Fic ${i}`, positionCategory: 'OH', starting: false }) as Player);
    big.push({ id: 'lib', number: 40, fullName: 'Fic Libero', positionCategory: 'L', starting: false } as Player);
    vi.mocked(matchesApi.loadTeamRoster).mockResolvedValue(big);
    render(<MatchSetupForm teamId="t1" submitLabel="Create match" onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByText('14 / 14 selected')).toBeInTheDocument();
    expect(screen.getByLabelText('Include Fic Libero')).toBeChecked();
    expect(screen.getByLabelText('Include Fic 15')).not.toBeChecked();
    expect(screen.getByLabelText('Libero 1')).toHaveValue('lib');
    expect(screen.getByLabelText('Libero 1 mode')).toHaveValue('always');
  });

  it('pre-fills two liberos as receiving and serving', async () => {
    vi.mocked(matchesApi.loadTeamRoster).mockResolvedValue([
      ...players.filter((p) => p.positionCategory !== 'L'),
      { id: 'l1', number: 33, fullName: 'Fic One', positionCategory: 'L', starting: false } as Player,
      { id: 'l2', number: 55, fullName: 'Fic Two', positionCategory: 'L', starting: false } as Player,
    ]);
    render(<MatchSetupForm teamId="t1" submitLabel="Create match" onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByText('#7 Name a');
    expect(screen.getByLabelText('Libero 1')).toHaveValue('l1');
    expect(screen.getByLabelText('Libero 1 mode')).toHaveValue('receiving');
    expect(screen.getByLabelText('Libero 2')).toHaveValue('l2');
    expect(screen.getByLabelText('Libero 2 mode')).toHaveValue('serving');
  });

  it('highlights duplicate numbers live and disables submit', async () => {
    render(<MatchSetupForm teamId="t1" submitLabel="Create match" onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByText('#7 Name a');
    expect(screen.queryByText(/Duplicate #/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Number for Name b'), { target: { value: '7' } });
    expect(screen.getAllByText('Duplicate #7')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Create match' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Include Name b'));
    expect(screen.queryByText(/Duplicate #/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create match' })).toBeEnabled();
  });

  it('defaults the date to the local calendar date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(2026, 9, 14, 0, 30));
      render(<MatchSetupForm teamId="t1" submitLabel="Create match" onSubmit={vi.fn()} onCancel={vi.fn()} />);
      await screen.findByText('#7 Name a');
      expect(screen.getByLabelText('Date')).toHaveValue('2026-10-14');
    } finally {
      vi.useRealTimers();
    }
  });
});
