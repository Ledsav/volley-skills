import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LiberoConfig } from '../../types/match';
import { rosterMap } from '../format';
import { ROSTER } from '../testFixtures';
import { CourtGrid } from './CourtGrid';

const court = ['s', 'oh1', 'mb1', 'o', 'oh2', 'lib'];

function renderGrid(liberos: LiberoConfig[]) {
  render(
    <CourtGrid
      court={court}
      roster={rosterMap(ROSTER)}
      liberos={liberos}
      activeLiberoId="lib"
      selectedId={null}
      form={() => null}
      onSelect={vi.fn()}
      onLongPress={vi.fn()}
    />,
  );
  return screen.getByRole('button', { name: '#1 Lara, libero' });
}

describe('CourtGrid', () => {
  it.each([
    ['receiving', 'L·rec'],
    ['serving', 'L·def'],
    ['always', 'L'],
  ] as const)('labels a %s libero tile "%s"', (mode, label) => {
    const tile = renderGrid([{ playerId: 'lib', mode, replaces: ['mb2'] }]);
    expect(within(tile).getByText(label)).toBeInTheDocument();
  });

  it('is inert when disabled: tiles are disabled and nothing is selected or long-pressed', () => {
    const onSelect = vi.fn();
    const onLongPress = vi.fn();
    render(
      <CourtGrid
        court={court}
        roster={rosterMap(ROSTER)}
        liberos={[]}
        activeLiberoId={null}
        selectedId={null}
        form={() => null}
        onSelect={onSelect}
        onLongPress={onLongPress}
        disabled
      />,
    );
    const tile = screen.getAllByRole('button')[0];
    expect(tile).toBeDisabled();
    fireEvent.click(tile);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('fills the selected tile and badges an auto-selection', () => {
    const props = {
      court,
      roster: rosterMap(ROSTER),
      liberos: [],
      activeLiberoId: null,
      selectedId: 'oh1',
      form: () => null,
      onSelect: vi.fn(),
      onLongPress: vi.fn(),
    };
    const { rerender } = render(<CourtGrid {...props} autoSelected />);
    const tile = screen.getByRole('button', { name: '#7 Ana' });
    expect(tile).toHaveAttribute('aria-pressed', 'true');
    expect(tile).toHaveClass('bg-blue', 'text-white');
    expect(within(tile).getByText('auto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '#2 Sofía' })).not.toHaveClass('bg-blue');

    rerender(<CourtGrid {...props} autoSelected={false} />);
    expect(screen.getByRole('button', { name: '#7 Ana' })).toHaveClass('bg-blue');
    expect(screen.queryByText('auto')).not.toBeInTheDocument();
  });
});
