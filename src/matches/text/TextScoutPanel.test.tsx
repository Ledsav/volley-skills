import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT, type Match, type MatchEvent } from '../../types/match';
import { writeAiSettings, DEFAULT_AI_SETTINGS } from './aiSettings';
import { AiError } from './aiClient';
import { PROCESS_TIMEOUT_MS, TextScoutPanel } from './TextScoutPanel';

const roster = [
  { playerId: 's', number: 2, name: 'Sara Ruiz', positionCategory: 'S' as const },
  { playerId: 'a', number: 7, name: 'Ana Pérez', positionCategory: 'OH' as const },
  { playerId: 'm', number: 11, name: 'Marta Gil', positionCategory: 'MB' as const },
  { playerId: 'o', number: 4, name: 'Olga Sanz', positionCategory: 'O' as const },
  { playerId: 'l', number: 9, name: 'Lucía Gómez', positionCategory: 'OH' as const },
  { playerId: 'n', number: 12, name: 'Nora Vidal', positionCategory: 'MB' as const },
];
const match = {
  id: 'm1', date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT,
  roster, liberos: [], status: 'live', result: { setsUs: 0, setsThem: 0, sets: [] }, summary: null,
  usageContribution: null, activeDevice: null, createdBy: 'u', createdAt: null, updatedAt: null,
} as Match;
const setStart: MatchEvent = { id: 'e1', order: 1, source: 'tap', chunkId: null, type: 'setStart', set: 1, lineup: ['s', 'a', 'm', 'o', 'l', 'n'], serving: 'us' };

function renderPanel(over: Partial<Parameters<typeof TextScoutPanel>[0]> = {}) {
  const props = {
    match,
    events: [setStart],
    anchorId: null,
    maxWritten: 0,
    online: true,
    onMerge: vi.fn(() => true),
    onClose: vi.fn(),
    ask: vi.fn(async () => ({
      rallies: [
        { actions: [{ number: 2, skill: 'S', grade: '#' }] },
        { actions: [{ number: 2, skill: 'S', grade: '+' }], point: { winner: 'them', reason: 'oppKill' } },
      ],
      unparsed: ['coach shouted'],
    })),
    ...over,
  };
  render(<MemoryRouter><TextScoutPanel {...props} /></MemoryRouter>);
  return props;
}

describe('TextScoutPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    writeAiSettings({ ...DEFAULT_AI_SETTINGS, apiKey: 'k' });
  });

  it('offers an Open Settings link when no AI provider is set up', () => {
    localStorage.clear();
    renderPanel({ ask: undefined });
    expect(screen.getByText('No AI provider set up.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', '/settings');
  });

  it('strips names before asking, previews the replayed score and merges in order', async () => {
    const props = renderPanel();
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: 'Sara ace\nSara serve, they kill' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    await screen.findByText('coach shouted');
    const sent = JSON.stringify((props.ask as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(sent).not.toContain('Sara');
    expect(sent).toContain('#2 ace');
    expect(screen.getByText(/0–0 → 1–1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(props.onMerge).toHaveBeenCalledWith(
      [
        { type: 'action', playerId: 's', skill: 'S', grade: '#' },
        { type: 'action', playerId: 's', skill: 'S', grade: '+' },
        { type: 'point', winner: 'them', reason: 'oppKill' },
      ],
      [2, 3, 4],
    );
  });

  it('keeps the draft across remounts', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '7 ace' } });
    document.body.innerHTML = '';
    renderPanel();
    expect(screen.getByLabelText('Match notes')).toHaveValue('7 ace');
  });

  it('blocks merge on unknown jersey numbers until the row is fixed', async () => {
    renderPanel({ ask: vi.fn(async () => ({ rallies: [{ actions: [{ number: 33, skill: 'A', grade: '#' }] }], unparsed: [] })) });
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '33 kill' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    expect(await screen.findByText('#33 is not in this match\'s roster.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Rally 1 action 1 player'), { target: { value: '7' } });
    expect(screen.getByRole('button', { name: 'Merge' })).toBeEnabled();
  });

  it('flags a score mismatch against the actual score', async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    await screen.findByText('coach shouted');
    fireEvent.change(screen.getByLabelText('Actual score us'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Actual score them'), { target: { value: '1' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/1–1.*2–1/);
  });

  it('needs a set in play, a configured provider and a connection', () => {
    renderPanel({ events: [] });
    expect(screen.getByText('Start the set first.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Process' })).toBeDisabled();
  });

  it('shows provider errors and keeps the draft', async () => {
    const { AiError } = await import('./aiClient');
    renderPanel({ ask: vi.fn(async () => { throw new AiError('rateLimited', 'x', 429, 20); }) });
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '7 ace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('retry in 20 s');
    expect(screen.getByLabelText('Match notes')).toHaveValue('7 ace');
  });

  it('retries once when the reply fails validation', async () => {
    const ask = vi.fn()
      .mockResolvedValueOnce({ nope: 1 })
      .mockResolvedValueOnce({ rallies: [{ actions: [{ number: 2, skill: 'S', grade: '#' }] }], unparsed: [] });
    renderPanel({ ask });
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '2 ace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Merge' })).toBeEnabled());
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('blocks an invalid skill/grade pair until the grade is fixed', async () => {
    renderPanel({ ask: vi.fn(async () => ({ rallies: [{ actions: [{ number: 2, skill: 'S', grade: '!' }] }], unparsed: [] })) });
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    await screen.findByText(/has no grade "!"/);
    expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Rally 1 action 1 grade'), { target: { value: '#' } });
    expect(screen.getByRole('button', { name: 'Merge' })).toBeEnabled();
  });

  it('does not report warnings that later events already had', async () => {
    const extra = { playerId: 'z', number: 20, name: 'Zoe Mir', positionCategory: 'OH' as const };
    const later = { id: 'e2', order: 2, source: 'tap', chunkId: null, type: 'action', playerId: 'z', skill: 'A', grade: '#' } as MatchEvent;
    renderPanel({
      match: { ...match, roster: [...roster, extra] } as Match,
      events: [setStart, later],
      anchorId: 'e1',
      maxWritten: 2,
    });
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    await screen.findByText('coach shouted');
    expect(screen.queryByText(/later event/)).not.toBeInTheDocument();
  });

  describe('after merge', () => {
    const one = async () => ({ rallies: [{ actions: [{ number: 2, skill: 'S', grade: '#' }] }], unparsed: [] });

    it('keeps notes typed after Process', async () => {
      renderPanel({ ask: vi.fn(one) });
      const notes = screen.getByLabelText('Match notes');
      fireEvent.change(notes, { target: { value: '2 ace' } });
      fireEvent.click(screen.getByRole('button', { name: 'Process' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Merge' })).toBeEnabled());
      fireEvent.change(notes, { target: { value: '2 ace\n7 kill' } });
      fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
      expect(notes).toHaveValue('7 kill');
      expect(screen.queryByRole('button', { name: 'Merge' })).not.toBeInTheDocument();
    });

    it('keeps the whole text when the processed part was edited', async () => {
      renderPanel({ ask: vi.fn(one) });
      const notes = screen.getByLabelText('Match notes');
      fireEvent.change(notes, { target: { value: '2 ace' } });
      fireEvent.click(screen.getByRole('button', { name: 'Process' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Merge' })).toBeEnabled());
      fireEvent.change(notes, { target: { value: '2 kill' } });
      fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
      expect(notes).toHaveValue('2 kill');
    });

    it('keeps the preview and notes when nothing was written', async () => {
      const props = renderPanel({ ask: vi.fn(one), onMerge: vi.fn(() => false) });
      fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '2 ace' } });
      fireEvent.click(screen.getByRole('button', { name: 'Process' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Merge' })).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
      expect(props.onMerge).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Merge' })).toBeInTheDocument();
      expect(screen.getByLabelText('Match notes')).toHaveValue('2 ace');
    });
  });

  it('retries once when the reply is not JSON', async () => {
    const ask = vi.fn()
      .mockRejectedValueOnce(new AiError('badResponse', 'not json'))
      .mockResolvedValueOnce({ rallies: [{ actions: [{ number: 2, skill: 'S', grade: '#' }] }], unparsed: [] });
    renderPanel({ ask });
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '2 ace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Merge' })).toBeEnabled());
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('adds the Local hint when a local provider is unreachable', async () => {
    writeAiSettings({ provider: 'local', baseUrl: 'http://localhost:11434/v1', apiKey: '', model: 'm', rememberKey: true });
    renderPanel({ ask: vi.fn(async () => { throw new AiError('unreachable', 'x'); }) });
    fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '7 ace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Is Ollama / LM Studio running');
  });

  describe('timeout and cancel', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const hang = () => vi.fn((_m: unknown, signal: AbortSignal) => new Promise<unknown>((_r, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))));

    it('times out, keeps the draft and re-enables Process', async () => {
      const ask = hang();
      renderPanel({ ask });
      fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '7 ace' } });
      fireEvent.click(screen.getByRole('button', { name: 'Process' }));
      expect(screen.getByRole('button', { name: 'Process' })).toBeDisabled();
      await act(async () => {
        vi.advanceTimersByTime(PROCESS_TIMEOUT_MS);
      });
      expect(screen.getByRole('alert')).toHaveTextContent('Timed out — your notes are kept.');
      expect(screen.getByRole('button', { name: 'Process' })).toBeEnabled();
      expect(screen.getByLabelText('Match notes')).toHaveValue('7 ace');
      expect((ask.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
    });

    it('Cancel aborts the request', async () => {
      renderPanel({ ask: vi.fn(() => new Promise<unknown>(() => undefined)) });
      fireEvent.change(screen.getByLabelText('Match notes'), { target: { value: '7 ace' } });
      fireEvent.click(screen.getByRole('button', { name: 'Process' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      });
      expect(screen.getByRole('alert')).toHaveTextContent('Cancelled.');
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Match notes')).toHaveValue('7 ace');
    });
  });
});
