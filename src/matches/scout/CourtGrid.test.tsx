import { render, screen, within } from '@testing-library/react';
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
});
