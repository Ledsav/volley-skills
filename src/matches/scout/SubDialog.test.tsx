import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RosterEntry } from '../../types/match';
import { SubDialog } from './SubDialog';

const entry = (playerId: string, number: number, name: string, positionCategory: RosterEntry['positionCategory']): RosterEntry => ({
  playerId,
  number,
  name,
  positionCategory,
});

describe('SubDialog', () => {
  it('lists like-for-like candidates first, then by number', () => {
    render(
      <SubDialog
        outPlayer={entry('mb1', 11, 'Marta', 'MB')}
        candidates={[entry('oh', 3, 'Bea', 'OH'), entry('mb2', 14, 'Nora', 'MB'), entry('s', 8, 'Iris', 'S')]}
        onSub={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('button', { name: /^Bring on/ }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Bring on #14 Nora',
      'Bring on #3 Bea',
      'Bring on #8 Iris',
    ]);
  });
});
