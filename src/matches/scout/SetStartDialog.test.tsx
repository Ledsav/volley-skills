import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RoleMap, RosterEntry } from '../../types/match';
import { check51 } from '../rotation';
import { SetStartDialog } from './SetStartDialog';

const roster: RosterEntry[] = [
  { playerId: 's', number: 2, name: 'Sofía', positionCategory: 'S' },
  { playerId: 'oh1', number: 7, name: 'Ana', positionCategory: 'OH' },
  { playerId: 'mb1', number: 11, name: 'Marta', positionCategory: 'MB' },
  { playerId: 'o', number: 4, name: 'Olga', positionCategory: 'O' },
  { playerId: 'oh2', number: 9, name: 'Lucía', positionCategory: 'OH' },
  { playerId: 'mb2', number: 12, name: 'Nora', positionCategory: 'MB' },
  { playerId: 'bench', number: 5, name: 'Bea', positionCategory: 'OH' },
  { playerId: 'lib', number: 1, name: 'Lara', positionCategory: 'L' },
];
const roles: RoleMap = Object.fromEntries(roster.map((r) => [r.playerId, r.positionCategory]));
const LINEUP = ['s', 'oh1', 'mb1', 'o', 'oh2', 'mb2'];

function renderDialog(onStart = vi.fn()) {
  render(
    <SetStartDialog
      setNumber={1}
      roster={roster}
      liberos={[{ playerId: 'lib', mode: 'receiving', replaces: ['mb1', 'mb2'] }]}
      roles={roles}
      initialLineup={LINEUP}
      initialServing="us"
      onStart={onStart}
      onCancel={() => undefined}
    />,
  );
  return onStart;
}

const startButton = () => screen.getByRole('button', { name: 'Start set' });

describe('SetStartDialog', () => {
  it('pre-fills the slots from the previous 5-1 lineup and lists matching roles first', () => {
    renderDialog();
    expect(screen.getByLabelText('Setter')).toHaveValue('s');
    expect(screen.getByLabelText('Opposite')).toHaveValue('o');
    expect(screen.getByLabelText('Middle 2')).toHaveValue('mb2');
    expect(screen.getByLabelText('Setter starts in')).toHaveValue('1');
    const options = within(screen.getByLabelText('Opposite')).getAllByRole('option');
    expect(options[1]).toHaveTextContent('#4 Olga (O)');
    expect(options.map((o) => o.textContent)).not.toContain('#1 Lara (L)');
  });

  it('an outside picked as opposite plays opposite this set and the lineup stays a 5-1', () => {
    const onStart = renderDialog();
    fireEvent.change(screen.getByLabelText('Opposite'), { target: { value: 'bench' } });
    const preview = screen.getByRole('group', { name: 'Lineup preview' });
    expect(within(preview).getByText('#5')).toBeInTheDocument();
    expect(within(preview).getByText('O (was OH)')).toBeInTheDocument();

    fireEvent.click(startButton());
    const [lineup, serving, setRoles] = onStart.mock.calls[0];
    expect(lineup).toEqual(['s', 'oh1', 'mb1', 'bench', 'oh2', 'mb2']);
    expect(serving).toBe('us');
    expect(setRoles.bench).toBe('O');
    expect(setRoles.o).toBe('O');
    expect(check51(lineup, setRoles)).toEqual([]);
  });

  it('places the setter in the chosen starting zone', () => {
    const onStart = renderDialog();
    fireEvent.change(screen.getByLabelText('Setter starts in'), { target: { value: '3' } });
    fireEvent.click(startButton());
    const [lineup, , setRoles] = onStart.mock.calls[0];
    expect(lineup[2]).toBe('s');
    expect(lineup[5]).toBe('o');
    expect(check51(lineup, setRoles)).toEqual([]);
  });

  it('blocks Start when a player is picked twice', () => {
    const onStart = renderDialog();
    fireEvent.change(screen.getByLabelText('Outside 2'), { target: { value: 'oh1' } });
    expect(startButton()).toBeDisabled();
    expect(screen.getByText('A player is in two slots.')).toBeInTheDocument();
    fireEvent.click(startButton());
    expect(onStart).not.toHaveBeenCalled();
  });

  it('manual mode warns (without blocking) about a lineup that is not a 5-1', () => {
    const onStart = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
    expect(screen.getByLabelText('Position P3')).toHaveValue('mb1');
    fireEvent.change(screen.getByLabelText('Position P3'), { target: { value: 'bench' } });
    const warnings = screen.getByRole('list', { name: 'Lineup warnings' });
    expect(within(warnings).getByText('Expected 2 outsides on court, found 3.')).toBeInTheDocument();
    fireEvent.click(startButton());
    expect(onStart).toHaveBeenCalledWith(['s', 'oh1', 'bench', 'o', 'oh2', 'mb2'], 'us', roles);
  });
});
