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
        <Route path="/teams/:teamId/matches/:matchId" element={<p>match page</p>} />
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

  it('substitutes a player from the action sheet', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: '#9 Lucía' }));
    fireEvent.click(screen.getByRole('button', { name: /substitute/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Bring on #5 Bea' }));
    expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'sub', outPlayerId: 'oh2', inPlayerId: 'bench' }), 'u1');
  });

  it('rotation arrows write a correction', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: 'Next rotation' }));
    expect(api.addEvent).toHaveBeenCalledWith(
      't1', 'm1',
      expect.objectContaining({ type: 'correction', rotation: 6, score: null, serving: null, source: 'correction' }),
      'u1',
    );
  });

  it('asks to confirm the set at set point', async () => {
    const corr: MatchEvent = { id: 'e2', order: 2, source: 'correction', chunkId: null, type: 'correction', score: { us: 25, them: 20 }, rotation: null, serving: null };
    renderPage([setStart, corr]);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm set' }));
    expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'setEnd', set: 1 }), 'u1');
  });

  it('finishes the match once it is over', async () => {
    vi.mocked(api.finishMatch).mockResolvedValue();
    const events: MatchEvent[] = [];
    let order = 0;
    for (let set = 1; set <= 3; set++) {
      events.push(
        { ...setStart, id: `s${set}`, order: ++order, set } as MatchEvent,
        { id: `c${set}`, order: ++order, source: 'correction', chunkId: null, type: 'correction', score: { us: 25, them: 10 }, rotation: null, serving: null },
        { id: `x${set}`, order: ++order, source: 'tap', chunkId: null, type: 'setEnd', set },
      );
    }
    renderPage(events);
    fireEvent.click(await screen.findByRole('button', { name: 'Finish match' }));
    await waitFor(() =>
      expect(api.finishMatch).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ result: expect.objectContaining({ setsUs: 3, setsThem: 0 }) })),
    );
  });

  it('double-tapping Confirm set writes exactly one setEnd', async () => {
    const corr: MatchEvent = { id: 'e2', order: 2, source: 'correction', chunkId: null, type: 'correction', score: { us: 25, them: 20 }, rotation: null, serving: null };
    renderPage([setStart, corr]);
    const btn = await screen.findByRole('button', { name: 'Confirm set' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    const setEnds = vi.mocked(api.addEvent).mock.calls.filter((c) => c[2].type === 'setEnd');
    expect(setEnds).toHaveLength(1);
  });

  it('does not finish when usage history cannot be reloaded', async () => {
    vi.mocked(api.getUsageProfile).mockResolvedValueOnce({ players: {} }).mockRejectedValueOnce(new Error('offline'));
    const events: MatchEvent[] = [];
    let order = 0;
    for (let set = 1; set <= 3; set++) {
      events.push(
        { ...setStart, id: `s${set}`, order: ++order, set } as MatchEvent,
        { id: `c${set}`, order: ++order, source: 'correction', chunkId: null, type: 'correction', score: { us: 25, them: 10 }, rotation: null, serving: null },
        { id: `x${set}`, order: ++order, source: 'tap', chunkId: null, type: 'setEnd', set },
      );
    }
    renderPage(events);
    fireEvent.click(await screen.findByRole('button', { name: 'Finish match' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load usage history — try finishing again.');
    expect(api.finishMatch).not.toHaveBeenCalled();
  });

  it('undo clears the insert anchor when the anchor event is deleted', async () => {
    const last: MatchEvent = { id: 'e2', order: 2, source: 'tap', chunkId: null, type: 'timeout', team: 'us' };
    renderPage([setStart, last]);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Insert after' }))[0]);
    expect(screen.getByText('Inserting into the timeline')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(screen.queryByText('Inserting into the timeline')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Point them' }));
    fireEvent.click(screen.getByRole('button', { name: 'Opp. kill' }));
    expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'point', order: 3 }), 'u1');
    expect(screen.queryByText('Inserting into the timeline')).not.toBeInTheDocument();
  });

  it('deleting the anchor event from the timeline clears the anchor', async () => {
    const last: MatchEvent = { id: 'e2', order: 2, source: 'tap', chunkId: null, type: 'timeout', team: 'us' };
    renderPage([setStart, last]);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Insert after' }))[0]);
    expect(screen.getByText('Inserting into the timeline')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(api.deleteEvents).toHaveBeenCalledWith('t1', 'm1', ['e2']);
    expect(screen.queryByText('Inserting into the timeline')).not.toBeInTheDocument();
  });
});
