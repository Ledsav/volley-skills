import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type MatchEvent } from '../../types/match';
import { rosterMap } from '../format';
import { replay } from '../scoutEngine';
import { LiveStatsPanel } from './LiveStatsPanel';

const roster = ['s', 'a', 'b', 'c', 'd', 'e'].map((id, i) => ({ playerId: id, number: i + 1, name: id.toUpperCase(), positionCategory: 'OH' as const }));
let order = 0;
const m = (e: object) => ({ id: `x${++order}`, order, source: 'tap', chunkId: null, ...e }) as MatchEvent;
const events: MatchEvent[] = [
  m({ type: 'setStart', set: 1, lineup: ['s', 'a', 'b', 'c', 'd', 'e'], serving: 'them' }),
  m({ type: 'action', playerId: 'a', skill: 'R', grade: '=' }),
  m({ type: 'action', playerId: 'a', skill: 'R', grade: '=' }),
  m({ type: 'action', playerId: 'a', skill: 'R', grade: '=' }),
];
const state = replay({ format: DEFAULT_FORMAT, roster, liberos: [] }, events);

describe('LiveStatsPanel', () => {
  it('shows alerts and per-player rows', () => {
    render(<LiveStatsPanel state={state} roster={rosterMap(roster)} />);
    expect(screen.getByRole('alert')).toHaveTextContent('#2 A: 3 errors this set');
    expect(screen.getByRole('alert')).toHaveTextContent('Opponent run 3');
    expect(screen.getByRole('row', { name: /#2 A/ })).toHaveTextContent('0%');
  });

  it('toggles scope', () => {
    render(<LiveStatsPanel state={state} roster={rosterMap(roster)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Match' }));
    expect(screen.getByRole('button', { name: 'Match' })).toHaveAttribute('aria-pressed', 'true');
  });
});
