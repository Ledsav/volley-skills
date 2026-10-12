import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type Match, type MatchEvent } from '../../types/match';
import * as api from '../matchesApi';
import { ScoutPage } from './ScoutPage';

vi.mock('../matchesApi');
vi.mock('../../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: { uid: 'u1' } }) }));

const roster = [
  { playerId: 's', number: 2, name: 'Sofía', positionCategory: 'S' as const },
  { playerId: 'oh1', number: 7, name: 'Ana', positionCategory: 'OH' as const },
  { playerId: 'mb1', number: 11, name: 'Marta', positionCategory: 'MB' as const },
  { playerId: 'o', number: 4, name: 'Olga', positionCategory: 'O' as const },
  { playerId: 'oh2', number: 9, name: 'Lucía', positionCategory: 'OH' as const },
  { playerId: 'mb2', number: 12, name: 'Nora', positionCategory: 'MB' as const },
  { playerId: 'bench', number: 5, name: 'Bea', positionCategory: 'OH' as const },
];
const match: Match = {
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT,
  roster, liberos: [], status: 'live', result: { setsUs: 0, setsThem: 0, sets: [] }, summary: null,
  usageContribution: null, activeDevice: null, createdBy: 'u1', createdAt: null, updatedAt: null,
};
const setStart: MatchEvent = {
  id: 'e1', order: 1, source: 'tap', chunkId: null, type: 'setStart', set: 1,
  lineup: ['s', 'oh1', 'mb1', 'o', 'oh2', 'mb2'], serving: 'them',
};

function renderPage(events: MatchEvent[]) {
  vi.mocked(api.subscribeEvents).mockImplementation((_t, _m, onChange) => {
    onChange(events, 0);
    return () => undefined;
  });
  return render(
    <MemoryRouter initialEntries={['/teams/t1/matches/m1/scout']}>
      <Routes>
        <Route path="/teams/:teamId/matches/:matchId/scout" element={<ScoutPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ScoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getMatch).mockResolvedValue(match);
    vi.mocked(api.getUsageProfile).mockResolvedValue({ players: {} });
    vi.mocked(api.claimDevice).mockResolvedValue();
    vi.mocked(api.updateMatchResult).mockResolvedValue();
    vi.mocked(api.addEvent).mockReturnValue({ id: 'new', written: Promise.resolve() });
    vi.mocked(api.deleteEvents).mockResolvedValue();
  });

  it('asks for the lineup before the first set', async () => {
    renderPage([]);
    expect(await screen.findByRole('dialog', { name: 'Start set 1' })).toBeInTheDocument();
  });

  it('records player → grade with reception pre-selected when receiving', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: '#7 Ana' }));
    expect(screen.getByRole('button', { name: 'Reception' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '+ Good' }));
    expect(api.addEvent).toHaveBeenCalledWith(
      't1', 'm1',
      expect.objectContaining({ type: 'action', playerId: 'oh1', skill: 'R', grade: '+', order: 2, source: 'tap', chunkId: null }),
      'u1',
    );
  });

  it('records a point for them with a reason', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: 'Point them' }));
    fireEvent.click(screen.getByRole('button', { name: 'Opp. kill' }));
    expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'point', winner: 'them', reason: 'oppKill' }), 'u1');
  });

  it('undo deletes the last event', async () => {
    const last: MatchEvent = { id: 'e2', order: 2, source: 'tap', chunkId: null, type: 'timeout', team: 'us' };
    renderPage([setStart, last]);
    fireEvent.click(await screen.findByRole('button', { name: /undo/i }));
    await waitFor(() => expect(api.deleteEvents).toHaveBeenCalledWith('t1', 'm1', ['e2']));
  });

  it('warns when another device is scouting', async () => {
    vi.mocked(api.getMatch).mockResolvedValue({ ...match, activeDevice: { id: 'other-device', at: Date.now() } });
    renderPage([setStart]);
    expect(await screen.findByRole('alertdialog', { name: /another device/i })).toBeInTheDocument();
    expect(api.claimDevice).not.toHaveBeenCalled();
  });

  it('keeps the device heartbeat firing while points change the result', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      let push: (e: MatchEvent[]) => void = () => undefined;
      vi.mocked(api.subscribeEvents).mockImplementation((_t, _m, onChange) => {
        push = (e) => onChange(e, 0);
        onChange([setStart], 0);
        return () => undefined;
      });
      render(
        <MemoryRouter initialEntries={['/teams/t1/matches/m1/scout']}>
          <Routes>
            <Route path="/teams/:teamId/matches/:matchId/scout" element={<ScoutPage />} />
          </Routes>
        </MemoryRouter>,
      );
      await screen.findByRole('button', { name: 'Point them' });
      expect(api.claimDevice).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(50_000);
      // 25 points plus setEnd closes the set, which changes the match result and re-sets the match state.
      const points: MatchEvent[] = Array.from({ length: 25 }, (_, i) => ({
        id: `p${i}`, order: i + 2, source: 'tap', chunkId: null, type: 'point', winner: 'them', reason: 'oppKill',
      }));
      const setEnd: MatchEvent = { id: 'se', order: 27, source: 'tap', chunkId: null, type: 'setEnd', set: 1 };
      act(() => push([setStart, ...points, setEnd]));
      expect(api.updateMatchResult).toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(11_000);
      expect(api.claimDevice).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  // Fix 2 (undo clears a deleted insert anchor) has no UI path until Task 13 (timeline "Insert after"),
  // so it cannot be exercised through the page yet.
  it.skip('undo clears the insert anchor when the anchor event is deleted (needs Task 13 UI)', () => undefined);
});
