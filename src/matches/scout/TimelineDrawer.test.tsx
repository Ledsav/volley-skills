import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type MatchEvent } from '../../types/match';
import { rosterMap } from '../format';
import { replay } from '../scoutEngine';
import { TimelineDrawer } from './TimelineDrawer';

const roster = [
  { playerId: 's', number: 2, name: 'S', positionCategory: 'S' as const },
  { playerId: 'a', number: 7, name: 'A', positionCategory: 'OH' as const },
  { playerId: 'b', number: 8, name: 'B', positionCategory: 'OH' as const },
  { playerId: 'c', number: 9, name: 'C', positionCategory: 'MB' as const },
  { playerId: 'd', number: 10, name: 'D', positionCategory: 'MB' as const },
  { playerId: 'e', number: 11, name: 'E', positionCategory: 'O' as const },
];
const meta = (id: string, order: number, source: 'tap' | 'text' = 'tap') => ({ id, order, source, chunkId: null });
const events: MatchEvent[] = [
  { ...meta('e1', 1), type: 'setStart', set: 1, lineup: ['s', 'a', 'b', 'c', 'd', 'e'], serving: 'us' },
  { ...meta('e2', 2), type: 'action', playerId: 's', skill: 'S', grade: '#' },
  { ...meta('e3', 3, 'text'), type: 'action', playerId: 'a', skill: 'D', grade: '+' },
];
const state = replay({ format: DEFAULT_FORMAT, roster, liberos: [] }, events);

describe('TimelineDrawer', () => {
  it('lists events newest first with the score after each rally', () => {
    render(<TimelineDrawer events={events} state={state} roster={rosterMap(roster)} onDelete={vi.fn()} onEdit={vi.fn()} onInsertAfter={vi.fn()} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('#7 Dig + Good');
    expect(within(rows[0]).getByRole('img', { name: 'From text' })).toBeInTheDocument();
    expect(rows[0]).not.toHaveTextContent('✎');
    expect(screen.getByText('1–0')).toBeInTheDocument();
  });

  it('deletes, edits and inserts', () => {
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    const onInsertAfter = vi.fn();
    render(<TimelineDrawer events={events} state={state} roster={rosterMap(roster)} onDelete={onDelete} onEdit={onEdit} onInsertAfter={onInsertAfter} />);
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    expect(onDelete).toHaveBeenCalledWith(['e3']);
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
    expect(onEdit).toHaveBeenCalledWith(events[2]);
    fireEvent.click(screen.getAllByRole('button', { name: /insert after/i })[1]);
    expect(onInsertAfter).toHaveBeenCalledWith('e2');
  });
});
