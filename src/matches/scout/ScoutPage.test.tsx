import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type Match, type MatchEvent } from '../../types/match';
import * as api from '../matchesApi';
import { ScoutPage } from './ScoutPage';

vi.mock('../matchesApi');
vi.mock('../../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../text/TextScoutPanel', async () => {
  const { useState } = await import('react');
  return {
    // Holds local state (a "batch" and the last merge result) so tests can tell a remount from a hidden panel.
    TextScoutPanel: ({ onMerge, anchorId }: { onMerge: (p: unknown[], o: number[]) => boolean; anchorId: string | null }) => {
      const [batch, setBatch] = useState(false);
      const [merged, setMerged] = useState<boolean | null>(null);
      return (
        <div>
          <button
            onClick={() =>
              onMerge(
                [
                  { type: 'action', playerId: 's', skill: 'S', grade: '#' },
                  { type: 'point', winner: 'them', reason: null },
                ],
                anchorId ? [1.25, 1.5] : [2, 3],
              )
            }
          >
            merge-stub
          </button>
          <button onClick={() => setMerged(onMerge([], []))}>merge-empty-stub</button>
          <button onClick={() => setBatch(true)}>process-stub</button>
          {batch && <p>batch-stub</p>}
          {merged !== null && <p>merged-{String(merged)}</p>}
        </div>
      );
    },
  };
});
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

/** App tools (Quick score, Auto-select, Text panel, Exit) live in the header's Match tools menu. */
async function openTools() {
  fireEvent.click(await screen.findByRole('button', { name: 'Match tools' }));
}
async function chooseTool(name: RegExp) {
  await openTools();
  fireEvent.click(screen.queryByRole('menuitemcheckbox', { name }) ?? screen.getByRole('menuitem', { name }));
}
/** aria-checked of a toggle in the tools menu (closes the menu again). */
async function toolState(name: RegExp) {
  await openTools();
  const item = screen.getByRole('menuitemcheckbox', { name });
  const checked = item.getAttribute('aria-checked');
  fireEvent.keyDown(item, { key: 'Escape' });
  return checked;
}

describe('ScoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(api.getMatch).mockResolvedValue(match);
    vi.mocked(api.getUsageProfile).mockResolvedValue({ players: {} });
    vi.mocked(api.claimDevice).mockResolvedValue();
    vi.mocked(api.updateMatchResult).mockResolvedValue();
    vi.mocked(api.addEvent).mockReturnValue({ id: 'new', written: Promise.resolve() });
    vi.mocked(api.deleteEvents).mockResolvedValue();
    vi.mocked(api.updateEvent).mockResolvedValue();
  });

  it('keeps match events in the bottom dock, on every tab, apart from Undo', async () => {
    renderPage([setStart]);
    const dock = await screen.findByRole('region', { name: 'Match events' });
    for (const name of [/^Point us/, /^Point them/, /T\/O us/, /T\/O them/]) {
      expect(within(dock).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(within(dock).queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('button', { name: /undo/i })).toBeInTheDocument();
  });

  it('puts the app tools in one Match tools menu', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: 'Match tools' }));
    const menu = screen.getByRole('menu', { name: 'Match tools' });
    expect(within(menu).getByRole('menuitemcheckbox', { name: /Quick score/ })).toHaveAttribute('aria-checked', 'false');
    expect(within(menu).getByRole('menuitemcheckbox', { name: /Auto-select next player/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Exit to match' }));
    expect(screen.getByText('match page')).toBeInTheDocument();
  });

  it('quick score hides the court and still records points', async () => {
    renderPage([setStart]);
    await chooseTool(/Quick score/);
    expect(screen.queryByRole('button', { name: '#7 Ana' })).not.toBeInTheDocument();
    await openTools();
    expect(screen.queryByRole('menuitemcheckbox', { name: /Auto-select/ })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /Point us/ }));
    expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'point', winner: 'us' }), 'u1');
    expect(window.localStorage.getItem('vcb.scout.quickScore')).toBe('on');
  });

  it('turning quick score on closes an open action sheet', async () => {
    renderPage([setStart]);
    fireEvent.click(await screen.findByRole('button', { name: '#7 Ana' }));
    expect(screen.getByRole('button', { name: 'Reception' })).toBeInTheDocument();
    await chooseTool(/Quick score/);
    expect(screen.queryByRole('button', { name: 'Reception' })).not.toBeInTheDocument();
    await chooseTool(/Quick score/);
    expect(screen.getByRole('button', { name: '#7 Ana' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reception' })).not.toBeInTheDocument();
  });

  it('starts in quick score when this device chose it before', async () => {
    window.localStorage.setItem('vcb.scout.quickScore', 'on');
    renderPage([setStart]);
    expect(await toolState(/Quick score/)).toBe('true');
    expect(screen.queryByRole('button', { name: '#7 Ana' })).not.toBeInTheDocument();
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

  it('Start set writes the per-set roles and saves changed roles to the roster', async () => {
    vi.mocked(api.updateMatchRoster).mockResolvedValue();
    renderPage([]);
    const dialog = await screen.findByRole('dialog', { name: 'Start set 1' });
    fireEvent.change(within(dialog).getByLabelText('Opposite'), { target: { value: 'bench' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start set' }));
    const event = vi.mocked(api.addEvent).mock.calls[0][2];
    expect(event).toMatchObject({ type: 'setStart', set: 1 });
    if (event.type !== 'setStart') throw new Error('expected setStart');
    expect(event.lineup).toContain('bench');
    expect(event.roles).toMatchObject({ bench: 'O', o: 'O', s: 'S' });
    expect(api.updateMatchRoster).toHaveBeenCalledTimes(1);
    const [, , nextRoster] = vi.mocked(api.updateMatchRoster).mock.calls[0];
    expect(nextRoster.find((r) => r.playerId === 'bench')?.positionCategory).toBe('O');
    expect(nextRoster.find((r) => r.playerId === 'oh1')?.positionCategory).toBe('OH');
  });

  it('Start set leaves the roster alone when no role changed', async () => {
    renderPage([]);
    const dialog = await screen.findByRole('dialog', { name: 'Start set 1' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start set' }));
    expect(api.addEvent).toHaveBeenCalledTimes(1);
    expect(api.updateMatchRoster).not.toHaveBeenCalled();
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

  it('merges text events as one batch with source text and a shared chunkId', async () => {
    renderPage([setStart]);
    await chooseTool(/Text panel/);
    fireEvent.click(screen.getByRole('button', { name: 'merge-stub' }));
    const calls = vi.mocked(api.addEvent).mock.calls.map((c) => c[2]);
    expect(calls).toHaveLength(2);
    expect(calls.every((e) => e.source === 'text')).toBe(true);
    expect(new Set(calls.map((e) => e.chunkId)).size).toBe(1);
    expect(calls[0].chunkId).not.toBeNull();
    expect(calls.map((e) => e.order)).toEqual([2, 3]);
  });

  it('reports that an empty text merge wrote nothing', async () => {
    renderPage([setStart]);
    await chooseTool(/Text panel/);
    fireEvent.click(screen.getByRole('button', { name: 'merge-empty-stub' }));
    expect(screen.getByText('merged-false')).toBeInTheDocument();
    expect(api.addEvent).not.toHaveBeenCalled();
  });

  it('keeps the text preview when the desktop panel is closed and reopened', async () => {
    renderPage([setStart]);
    await chooseTool(/Text panel/);
    fireEvent.click(screen.getByRole('button', { name: 'process-stub' }));
    await chooseTool(/Text panel/);
    expect(screen.queryByRole('button', { name: 'process-stub' })).not.toBeInTheDocument();
    await chooseTool(/Text panel/);
    expect(screen.getByText('batch-stub')).toBeInTheDocument();
  });

  describe('on a phone-width screen', () => {
    beforeEach(() => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })) as unknown as typeof window.matchMedia;
    });

    afterEach(() => {
      // jsdom has no matchMedia; restore that so the desktop tests keep their fallback.
      delete (window as { matchMedia?: unknown }).matchMedia;
    });

    it('keeps the events dock when switching away from the court tab', async () => {
      renderPage([setStart]);
      fireEvent.click(await screen.findByRole('tab', { name: 'Live' }));
      expect(screen.getByRole('region', { name: 'Match events' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('tab', { name: 'Timeline' }));
      expect(within(screen.getByRole('region', { name: 'Match events' })).getByRole('button', { name: /^Point us/ })).toBeInTheDocument();
    });

    it('keeps the text preview across tab switches', async () => {
      renderPage([setStart]);
      const nav = await screen.findByRole('tablist', { name: 'Scouting views' });
      fireEvent.click(within(nav).getByRole('tab', { name: 'Text' }));
      fireEvent.click(screen.getByRole('button', { name: 'process-stub' }));
      fireEvent.click(within(nav).getByRole('tab', { name: 'Court' }));
      expect(screen.queryByRole('button', { name: 'process-stub' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '#7 Ana' })).toBeInTheDocument();
      fireEvent.click(within(nav).getByRole('tab', { name: 'Text' }));
      expect(screen.getByText('batch-stub')).toBeInTheDocument();
    });
  });

  it('does not auto-select while the text panel is open', async () => {
    renderPage([setStart]);
    await chooseTool(/Text panel/);
    expect(screen.queryByRole('region', { name: /actions for/i })).toBeNull();
  });

  describe('auto-select', () => {
    const reception: MatchEvent = {
      id: 'new', order: 2, source: 'tap', chunkId: null, type: 'action', playerId: 'oh1', skill: 'R', grade: '+',
    };
    const sheetFor = (name: string) => screen.queryByRole('region', { name: `Actions for ${name}` });

    it('after a reception, selects the setter with Set pre-selected', async () => {
      renderPage([setStart]);
      fireEvent.click(await screen.findByRole('button', { name: '#7 Ana' }));
      fireEvent.click(screen.getByRole('button', { name: '+ Good' }));
      expect(sheetFor('#7 Ana')).not.toBeInTheDocument();
      act(() => pushEvents([setStart, reception]));
      expect(screen.getByRole('button', { name: '#2 Sofía' })).toHaveAttribute('aria-pressed', 'true');
      expect(sheetFor('#2 Sofía')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Set' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('after a point that wins the serve back, selects the new P1 with Serve', async () => {
      renderPage([setStart]);
      fireEvent.click(await screen.findByRole('button', { name: 'Point us' }));
      const point: MatchEvent = { id: 'new', order: 2, source: 'tap', chunkId: null, type: 'point', winner: 'us', reason: null };
      act(() => pushEvents([setStart, point]));
      // Side-out rotation: #7 Ana moves from P2 to P1.
      expect(screen.getByRole('button', { name: '#7 Ana' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Serve' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('does not auto-select in quick score, so leaving it opens no sheet', async () => {
      renderPage([setStart]);
      await chooseTool(/Quick score/);
      fireEvent.click(screen.getByRole('button', { name: /Point us/ }));
      const point: MatchEvent = { id: 'new', order: 2, source: 'tap', chunkId: null, type: 'point', winner: 'us', reason: null };
      act(() => pushEvents([setStart, point]));
      await chooseTool(/Quick score/);
      expect(screen.getByRole('button', { name: '#7 Ana' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('button', { name: 'Serve' })).not.toBeInTheDocument();
    });

    it('closing the sheet suppresses auto-select until the next recorded event', async () => {
      renderPage([setStart]);
      fireEvent.click(await screen.findByRole('button', { name: '#7 Ana' }));
      fireEvent.click(screen.getByRole('button', { name: '+ Good' }));
      act(() => pushEvents([setStart, reception]));
      fireEvent.click(screen.getByRole('button', { name: 'Close actions' }));
      expect(sheetFor('#2 Sofía')).not.toBeInTheDocument();
      // A snapshot with no new write of ours (e.g. a pending write confirming) does not reopen it.
      act(() => pushEvents([setStart, { ...reception }]));
      expect(screen.queryByRole('region', { name: /^Actions for/ })).not.toBeInTheDocument();

      vi.mocked(api.addEvent).mockReturnValueOnce({ id: 'to', written: Promise.resolve() });
      fireEvent.click(screen.getByRole('button', { name: /T\/O us/ }));
      const timeout: MatchEvent = { id: 'to', order: 3, source: 'tap', chunkId: null, type: 'timeout', team: 'us' };
      act(() => pushEvents([setStart, reception, timeout]));
      expect(sheetFor('#2 Sofía')).toBeInTheDocument();
    });

    it('does nothing with the Auto toggle off, and remembers the choice on this device', async () => {
      renderPage([setStart]);
      expect(await toolState(/Auto-select/)).toBe('true');
      await chooseTool(/Auto-select/);
      expect(await toolState(/Auto-select/)).toBe('false');
      expect(window.localStorage.getItem('vcb.scoutAutoSelect')).toBe('off');
      fireEvent.click(screen.getByRole('button', { name: '#7 Ana' }));
      fireEvent.click(screen.getByRole('button', { name: '+ Good' }));
      act(() => pushEvents([setStart, reception]));
      expect(screen.queryByRole('region', { name: /^Actions for/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '#2 Sofía' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('starts with Auto off when the device stored that preference', async () => {
      window.localStorage.setItem('vcb.scoutAutoSelect', 'off');
      renderPage([setStart]);
      expect(await toolState(/Auto-select/)).toBe('false');
    });

    it('does not auto-select between sets', async () => {
      const corr: MatchEvent = { id: 'e2', order: 2, source: 'correction', chunkId: null, type: 'correction', score: { us: 25, them: 20 }, rotation: null, serving: null };
      renderPage([setStart, corr]);
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm set' }));
      const end: MatchEvent = { id: 'new', order: 3, source: 'tap', chunkId: null, type: 'setEnd', set: 1 };
      act(() => pushEvents([setStart, corr, end]));
      expect(screen.getByRole('button', { name: 'Start set 2' })).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: /^Actions for/ })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { pressed: true }).filter((b) => b.getAttribute('aria-label')?.startsWith('#'))).toHaveLength(0);
    });

    it('selects the server once a set starts with us serving', async () => {
      renderPage([]);
      const dialog = await screen.findByRole('dialog', { name: 'Start set 1' });
      expect(dialog).toBeInTheDocument();
      const start: MatchEvent = { ...setStart, id: 'new', serving: 'us' } as MatchEvent;
      // Simulate this device having written the setStart (the dialog's own flow is covered elsewhere).
      vi.mocked(api.addEvent).mockReturnValueOnce({ id: 'new', written: Promise.resolve() });
      fireEvent.click(within(dialog).getByRole('button', { name: /start set/i }));
      act(() => pushEvents([start]));
      expect(screen.getByRole('button', { name: '#2 Sofía' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Serve' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('keyboard', () => {
    const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = window) =>
      act(() => {
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
      });
    const actions = () => vi.mocked(api.addEvent).mock.calls.map((c) => c[2]).filter((e) => e.type === 'action');

    it('scouts a whole receiving rally from the keyboard', async () => {
      const ids = ['w1', 'w2', 'w3'];
      vi.mocked(api.addEvent).mockImplementation(() => ({ id: ids.shift() ?? 'wx', written: Promise.resolve() }));
      renderPage([]);
      const dialog = await screen.findByRole('dialog', { name: 'Start set 1' });
      vi.mocked(api.addEvent).mockReturnValueOnce({ id: 'start', written: Promise.resolve() });
      fireEvent.click(within(dialog).getByRole('button', { name: /start set/i }));
      const start: MatchEvent = { ...setStart, id: 'start' };
      act(() => pushEvents([start]));
      // Auto-select picks the receiver (#7 Ana, outside hitter) with Reception.
      expect(screen.getByRole('button', { name: '#7 Ana' })).toHaveAttribute('aria-pressed', 'true');

      press('+', { shiftKey: true });
      const r: MatchEvent = { id: 'w1', order: 2, source: 'tap', chunkId: null, type: 'action', playerId: 'oh1', skill: 'R', grade: '+' };
      act(() => pushEvents([start, r]));
      expect(screen.getByRole('button', { name: '#2 Sofía' })).toHaveAttribute('aria-pressed', 'true');

      press('#', { shiftKey: true });
      const e: MatchEvent = { id: 'w2', order: 3, source: 'tap', chunkId: null, type: 'action', playerId: 's', skill: 'E', grade: '#' };
      act(() => pushEvents([start, r, e]));

      // #4 Olga: unique and no longer number starts with 4, so it selects at once.
      press('4');
      expect(screen.getByRole('button', { name: '#4 Olga' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Attack' })).toHaveAttribute('aria-pressed', 'true');
      press('#', { shiftKey: true });

      expect(actions()).toEqual([
        expect.objectContaining({ playerId: 'oh1', skill: 'R', grade: '+' }),
        expect.objectContaining({ playerId: 's', skill: 'E', grade: '#' }),
        expect.objectContaining({ playerId: 'o', skill: 'A', grade: '#' }),
      ]);
    });

    it('switches the fundamental and ignores grades it does not have', async () => {
      renderPage([setStart]);
      fireEvent.click(await screen.findByRole('button', { name: '#11 Marta' }));
      press('a');
      expect(screen.getByRole('button', { name: 'Attack' })).toHaveAttribute('aria-pressed', 'true');
      press('e');
      press('/');
      expect(api.addEvent).not.toHaveBeenCalled();
      press('-');
      expect(actions()).toEqual([expect.objectContaining({ playerId: 'mb1', skill: 'E', grade: '-' })]);
    });

    it('waits on an ambiguous jersey prefix until Enter', async () => {
      renderPage([setStart]);
      await screen.findByRole('button', { name: 'Point us' });
      press('1');
      expect(screen.getByRole('status')).toHaveTextContent('#1…');
      press('1');
      expect(screen.getByRole('button', { name: '#11 Marta' })).toHaveAttribute('aria-pressed', 'true');
      press('Escape');
      expect(screen.queryByRole('region', { name: /^Actions for/ })).not.toBeInTheDocument();
      press('8');
      expect(screen.getByRole('status')).toHaveTextContent('No player #8');
    });

    it('P then 1 records a point us and amends its reason', async () => {
      renderPage([setStart]);
      await screen.findByRole('button', { name: 'Point us' });
      press('p');
      expect(api.addEvent).toHaveBeenCalledWith('t1', 'm1', expect.objectContaining({ type: 'point', winner: 'us', reason: null }), 'u1');
      press('1');
      expect(api.updateEvent).toHaveBeenCalledWith('t1', 'm1', 'new', { reason: 'oppError' });
      expect(screen.queryByRole('button', { name: 'Opp. error' })).not.toBeInTheDocument();
    });

    it('T / Shift+T call timeouts and Shift+S opens the substitution', async () => {
      renderPage([setStart]);
      await screen.findByRole('button', { name: 'Point us' });
      press('t');
      press('T', { shiftKey: true });
      const calls = vi.mocked(api.addEvent).mock.calls.map((c) => c[2]);
      expect(calls).toEqual([expect.objectContaining({ type: 'timeout', team: 'us' }), expect.objectContaining({ type: 'timeout', team: 'them' })]);
      fireEvent.click(screen.getByRole('button', { name: '#9 Lucía' }));
      press('S', { shiftKey: true });
      expect(screen.getByRole('dialog', { name: 'Substitute #9 Lucía' })).toBeInTheDocument();
      // Dialog open: keys do nothing.
      press('p');
      expect(api.addEvent).toHaveBeenCalledTimes(2);
    });

    it('Ctrl+Z and Backspace undo', async () => {
      const last: MatchEvent = { id: 'e2', order: 2, source: 'tap', chunkId: null, type: 'timeout', team: 'us' };
      renderPage([setStart, last]);
      await screen.findByRole('button', { name: 'Point us' });
      press('z', { ctrlKey: true });
      expect(api.deleteEvents).toHaveBeenCalledWith('t1', 'm1', ['e2']);
      vi.mocked(api.deleteEvents).mockClear();
      press('Backspace');
      expect(api.deleteEvents).toHaveBeenCalledTimes(1);
    });

    it('Shift+A toggles auto-select', async () => {
      renderPage([setStart]);
      await screen.findByRole('button', { name: 'Match tools' });
      press('A', { shiftKey: true });
      expect(await toolState(/Auto-select/)).toBe('false');
    });

    it('ignores keys while the set start dialog is open', async () => {
      renderPage([]);
      await screen.findByRole('dialog', { name: 'Start set 1' });
      press('?');
      press('p');
      expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
      expect(api.addEvent).not.toHaveBeenCalled();
    });

    it('ignores keys while typing in an input', async () => {
      renderPage([setStart]);
      await screen.findByRole('button', { name: 'Point us' });
      const input = document.createElement('input');
      document.body.appendChild(input);
      try {
        input.focus();
        press('p', {}, input);
        press('?', {}, input);
        expect(api.addEvent).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
      } finally {
        input.remove();
      }
    });

    it('? opens the cheat sheet listing the keys, and ? closes it', async () => {
      renderPage([setStart]);
      await screen.findByRole('button', { name: 'Point us' });
      press('?');
      const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
      for (const label of ['P', 'O', 'Shift+T', 'Ctrl+Z', 'Backspace', 'Shift+S', 'Shift+A', 'Esc', '#', '=', 'S', 'F']) {
        expect(within(sheet).getAllByText(label, { selector: 'kbd' }).length).toBeGreaterThan(0);
      }
      expect(within(sheet).getByText('Point us')).toBeInTheDocument();
      press('p');
      expect(api.addEvent).not.toHaveBeenCalled();
      press('?');
      expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
    });

    it('records nothing between sets, but Undo still works', async () => {
      const corr: MatchEvent = { id: 'c1', order: 2, source: 'correction', chunkId: null, type: 'correction', score: { us: 25, them: 20 }, rotation: null, serving: null };
      const end: MatchEvent = { id: 'x1', order: 3, source: 'tap', chunkId: null, type: 'setEnd', set: 1 };
      renderPage([setStart, corr, end]);
      await screen.findByRole('button', { name: 'Undo set end' });
      press('p');
      press('t');
      press('7');
      expect(api.addEvent).not.toHaveBeenCalled();
      expect(screen.queryByRole('region', { name: /^Actions for/ })).not.toBeInTheDocument();
      press('z', { ctrlKey: true });
      expect(api.deleteEvents).toHaveBeenCalledWith('t1', 'm1', ['x1']);
    });
  });
});
