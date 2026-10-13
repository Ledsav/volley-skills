import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

let pushEvents: (e: MatchEvent[]) => void = () => undefined;

function renderPage(events: MatchEvent[]) {
  vi.mocked(api.subscribeEvents).mockImplementation((_t, _m, onChange) => {
    pushEvents = (e) => onChange(e, 0);
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
    vi.mocked(api.updateEvent).mockResolvedValue();
  });

  it('asks for the lineup before the first set', async () => {
    renderPage([]);
    expect(await screen.findByRole('dialog', { name: 'Start set 1' })).toBeInTheDocument();
  });

  it('closing the first-set dialog keeps the scout screen usable', async () => {
    renderPage([]);
    const dialog = await screen.findByRole('dialog', { name: 'Start set 1' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('dialog', { name: 'Start set 1' })).not.toBeInTheDocument();
    expect(screen.queryByText('match page')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start set 1' }));
    expect(screen.getByRole('dialog', { name: 'Start set 1' })).toBeInTheDocument();
  });

  it('after a set ends, offers Start set and Undo set end instead of a blocking dialog', async () => {
    const corr: MatchEvent = { id: 'c1', order: 2, source: 'correction', chunkId: null, type: 'correction', score: { us: 25, them: 20 }, rotation: null, serving: null };
    const end: MatchEvent = { id: 'x1', order: 3, source: 'tap', chunkId: null, type: 'setEnd', set: 1 };
    renderPage([setStart, corr, end]);
    fireEvent.click(await screen.findByRole('button', { name: 'Undo set end' }));
    expect(api.deleteEvents).toHaveBeenCalledWith('t1', 'm1', ['x1']);
    expect(screen.queryByRole('dialog', { name: 'Start set 2' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start set 2' })).toBeInTheDocument();
  });

  it('between sets, nothing can be recorded but Undo set end still works', async () => {
    const corr: MatchEvent = { id: 'c1', order: 2, source: 'correction', chunkId: null, type: 'correction', score: { us: 25, them: 20 }, rotation: null, serving: null };
    const end: MatchEvent = { id: 'x1', order: 3, source: 'tap', chunkId: null, type: 'setEnd', set: 1 };
    renderPage([setStart, corr, end]);
    const undoEnd = await screen.findByRole('button', { name: 'Undo set end' });
    expect(screen.queryByRole('button', { name: 'Point us' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Point them' })).not.toBeInTheDocument();
    expect(screen.getByText('Start the set to record actions.')).toBeInTheDocument();
    const tile = screen.getByRole('button', { name: '#7 Ana' });
    expect(tile).toBeDisabled();
    fireEvent.click(tile);
    expect(screen.queryByRole('button', { name: 'Reception' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Correct score' })).toBeDisabled();
    expect(api.addEvent).not.toHaveBeenCalled();
    fireEvent.click(undoEnd);
    expect(api.deleteEvents).toHaveBeenCalledWith('t1', 'm1', ['x1']);
  });

  it('closes an open action sheet when the set ends', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: '#7 Ana' }));
    expect(screen.getByRole('button', { name: 'Reception' })).toBeInTheDocument();
    const corr: MatchEvent = { id: 'c1', order: 2, source: 'correction', chunkId: null, type: 'correction', score: { us: 25, them: 20 }, rotation: null, serving: null };
    const end: MatchEvent = { id: 'x1', order: 3, source: 'tap', chunkId: null, type: 'setEnd', set: 1 };
    act(() => pushEvents([setStart, corr, end]));
    expect(screen.queryByRole('button', { name: 'Reception' })).not.toBeInTheDocument();
  });

  it('before set 1, with the dialog closed, nothing can be recorded', async () => {
    renderPage([]);
    const dialog = await screen.findByRole('dialog', { name: 'Start set 1' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('button', { name: 'Point us' })).not.toBeInTheDocument();
    expect(screen.getByText('Start the set to record actions.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start set 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '#7 Ana' }));
    expect(screen.queryByRole('button', { name: 'Reception' })).not.toBeInTheDocument();
    expect(api.addEvent).not.toHaveBeenCalled();
  });

  it("defaults the next set's first serve to the other side of the previous set's first serve", async () => {
    // Set 1: we served first; the last rally left them serving. Set 2 should default to them.
    const start: MatchEvent = { ...setStart, serving: 'us' } as MatchEvent;
    const corr: MatchEvent = { id: 'c1', order: 2, source: 'correction', chunkId: null, type: 'correction', score: { us: 25, them: 20 }, rotation: null, serving: 'them' };
    const end: MatchEvent = { id: 'x1', order: 3, source: 'tap', chunkId: null, type: 'setEnd', set: 1 };
    renderPage([start, corr, end]);
    fireEvent.click(await screen.findByRole('button', { name: 'Start set 2' }));
    expect(screen.getByLabelText('They serve')).toBeChecked();
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

  it('records a point in one tap, then amends it with an optional reason', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: 'Point them' }));
    expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'point', winner: 'them', reason: null }), 'u1');
    fireEvent.click(screen.getByRole('button', { name: 'Opp. kill' }));
    expect(api.updateEvent).toHaveBeenCalledWith('t1', 'm1', 'new', { reason: 'oppKill' });
    expect(screen.queryByRole('button', { name: 'Opp. kill' })).not.toBeInTheDocument();
  });

  it('hides the reason chips after a few seconds or when another action is recorded', async () => {
    renderPage([setStart]);
    const pointUs = await screen.findByRole('button', { name: 'Point us' });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.click(pointUs);
      expect(screen.getByRole('button', { name: 'Opp. error' })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(5_000));
      expect(screen.queryByRole('button', { name: 'Opp. error' })).not.toBeInTheDocument();
      fireEvent.click(pointUs);
      expect(screen.getByRole('button', { name: 'Opp. error' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /T\/O us/ }));
      expect(screen.queryByRole('button', { name: 'Opp. error' })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('undo deletes the last event', async () => {
    const last: MatchEvent = { id: 'e2', order: 2, source: 'tap', chunkId: null, type: 'timeout', team: 'us' };
    renderPage([setStart, last]);
    fireEvent.click(await screen.findByRole('button', { name: /undo/i }));
    await waitFor(() => expect(api.deleteEvents).toHaveBeenCalledWith('t1', 'm1', ['e2']));
  });

  it('sends a match that is not live back to the match page', async () => {
    for (const status of ['setup', 'finished'] as const) {
      vi.mocked(api.getMatch).mockResolvedValue({ ...match, status });
      const { unmount } = renderPage([setStart]);
      expect(await screen.findByText('match page')).toBeInTheDocument();
      expect(api.claimDevice).not.toHaveBeenCalled();
      unmount();
    }
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
    // A timeout does not end a rally: with a stale anchor it would re-anchor on the new event and show the banner.
    fireEvent.click(screen.getByRole('button', { name: /T\/O us/ }));
    expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'timeout', order: 3 }), 'u1');
    expect(screen.queryByText('Inserting into the timeline')).not.toBeInTheDocument();
  });

  it('confirms before deleting a set start, but deletes an action immediately', async () => {
    const last: MatchEvent = { id: 'e2', order: 2, source: 'tap', chunkId: null, type: 'timeout', team: 'us' };
    renderPage([setStart, last]);
    const deletes = await screen.findAllByRole('button', { name: 'Delete' });
    fireEvent.click(deletes[0]);
    expect(api.deleteEvents).toHaveBeenCalledWith('t1', 'm1', ['e2']);
    vi.mocked(api.deleteEvents).mockClear();
    fireEvent.click(deletes[deletes.length - 1]);
    expect(await screen.findByText('Delete set start?')).toBeInTheDocument();
    expect(api.deleteEvents).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(api.deleteEvents).toHaveBeenCalledWith('t1', 'm1', ['e1']);
  });

  it('undo after an insert deletes the inserted event, not the tail', async () => {
    const e2: MatchEvent = { id: 'e2', order: 2, source: 'tap', chunkId: null, type: 'timeout', team: 'us' };
    const e3: MatchEvent = { id: 'e3', order: 3, source: 'tap', chunkId: null, type: 'timeout', team: 'them' };
    renderPage([setStart, e2, e3]);
    // Timeline is newest first: [e3, e2, e1].
    fireEvent.click((await screen.findAllByRole('button', { name: 'Insert after' }))[1]);
    vi.mocked(api.addEvent).mockReturnValueOnce({ id: 'ins', written: Promise.resolve() });
    fireEvent.click(screen.getByRole('button', { name: /T\/O us/ }));
    expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'timeout', order: 2.5 }), 'u1');
    const ins: MatchEvent = { id: 'ins', order: 2.5, source: 'tap', chunkId: null, type: 'timeout', team: 'us' };
    act(() => pushEvents([setStart, e2, ins, e3]));
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(api.deleteEvents).toHaveBeenCalledWith('t1', 'm1', ['ins']);
  });

  it('rapid taps before the snapshot lands never reuse an order', async () => {
    let n = 0;
    vi.mocked(api.addEvent).mockImplementation(() => ({ id: `w${++n}`, written: Promise.resolve() }));
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: /T\/O us/ }));
    fireEvent.click(screen.getByRole('button', { name: /T\/O them/ }));
    const orders = vi.mocked(api.addEvent).mock.calls.map((c) => c[2].order);
    expect(orders).toEqual([2, 3]);
  });

  it('rapid inserts before the snapshot lands stay in sequence after the anchor', async () => {
    let n = 0;
    vi.mocked(api.addEvent).mockImplementation(() => ({ id: `w${++n}`, written: Promise.resolve() }));
    const e2: MatchEvent = { id: 'e2', order: 2, source: 'tap', chunkId: null, type: 'timeout', team: 'us' };
    const e3: MatchEvent = { id: 'e3', order: 3, source: 'tap', chunkId: null, type: 'timeout', team: 'them' };
    renderPage([setStart, e2, e3]);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Insert after' }))[1]);
    fireEvent.click(screen.getByRole('button', { name: /T\/O us/ }));
    fireEvent.click(screen.getByRole('button', { name: /T\/O them/ }));
    const orders = vi.mocked(api.addEvent).mock.calls.map((c) => c[2].order);
    expect(orders).toEqual([2.5, 2.75]);
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
