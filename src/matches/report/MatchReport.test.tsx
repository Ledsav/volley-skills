import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type Match, type MatchEvent } from '../../types/match';
import { replay } from '../scoutEngine';
import { MatchReport } from './MatchReport';

const roster = ['s', 'a', 'b', 'c', 'd', 'e'].map((id, i) => ({ playerId: id, number: i + 1, name: `N${id}`, positionCategory: 'OH' as const }));
const match = {
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT, roster,
  liberos: [], status: 'finished', result: { setsUs: 0, setsThem: 0, sets: [] }, summary: null, usageContribution: null,
  activeDevice: null, createdBy: 'u', createdAt: null, updatedAt: null,
} as Match;
let order = 0;
const m = (e: object) => ({ id: `x${++order}`, order, source: 'tap', chunkId: null, ...e }) as MatchEvent;
const events: MatchEvent[] = [
  m({ type: 'setStart', set: 1, lineup: ['s', 'a', 'b', 'c', 'd', 'e'], serving: 'us' }),
  m({ type: 'action', playerId: 's', skill: 'S', grade: '#' }),
  m({ type: 'action', playerId: 's', skill: 'S', grade: '=' }),
  m({ type: 'setStart', set: 2, lineup: ['s', 'a', 'b', 'c', 'd', 'e'], serving: 'us' }),
  m({ type: 'action', playerId: 'a', skill: 'A', grade: '#' }),
];

describe('MatchReport', () => {
  it('renders KPIs, players and filters by set', () => {
    render(<MatchReport match={match} state={replay(match, events)} />);
    expect(screen.getByText('Aces / serve errors')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /#1 Ns/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /#2 Na/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Set'), { target: { value: '2' } });
    expect(screen.queryByRole('row', { name: /#1 Ns/ })).toBeNull();
  });
});
