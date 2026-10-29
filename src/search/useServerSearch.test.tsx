import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../exercises/exercisesApi', () => ({ searchExercises: vi.fn() }));
vi.mock('../trainings/trainingsApi', () => ({ searchTrainings: vi.fn() }));

import { searchExercises } from '../exercises/exercisesApi';
import { searchTrainings } from '../trainings/trainingsApi';
import { serverToken, useServerSearch } from './useServerSearch';

const ex = (id: string, name: string) => ({ id, name, category: 'attack', description: '' });
const page = (items: unknown[], hasMore = false, lastDoc: unknown = { id: 'cursor' }) => ({ items, lastDoc, hasMore });
const both = { exercises: true, trainings: true };

function setOnline(v: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value: v, configurable: true });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useServerSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setOnline(true);
    vi.mocked(searchExercises).mockResolvedValue(page([]) as never);
    vi.mocked(searchTrainings).mockResolvedValue(page([]) as never);
  });
  afterEach(() => {
    vi.useRealTimers();
    setOnline(true);
  });

  it('waits 300 ms after the last keystroke', async () => {
    const { rerender } = renderHook(({ q }) => useServerSearch(q, both), { initialProps: { q: 'pa' } });
    await advance(250);
    rerender({ q: 'pas' });
    await advance(250);
    expect(searchExercises).not.toHaveBeenCalled();
    await advance(60);
    expect(searchExercises).toHaveBeenCalledTimes(1);
    expect(searchExercises).toHaveBeenCalledWith('pas', null);
    expect(searchTrainings).toHaveBeenCalledWith('pas', null);
  });

  it('sends the longest word and filters the other words on the client', async () => {
    vi.mocked(searchExercises).mockResolvedValue(page([ex('1', 'Attacco in diagonale'), ex('2', 'Rete e attacco')]) as never);
    const { result } = renderHook(() => useServerSearch('rete attacco', both));
    await advance(300);
    expect(searchExercises).toHaveBeenCalledWith('attacco', null);
    expect(result.current.exercises.items.map((i) => i.id)).toEqual(['2']);
    expect(result.current.exercises.items[0]).toMatchObject({ group: 'exercises', label: 'Rete e attacco', to: '/exercises?exercise=2' });
  });

  it('shapes training items with the businessId', async () => {
    vi.mocked(searchTrainings).mockResolvedValue(page([{ id: 't1', name: 'Sessione', businessId: 'TR-0001' }]) as never);
    const { result } = renderHook(() => useServerSearch('tr-0001', both));
    await advance(300);
    expect(result.current.trainings.items[0]).toMatchObject({
      id: 't1',
      group: 'trainings',
      label: 'Sessione',
      sublabel: 'TR-0001',
      keywords: ['TR-0001'],
      to: '/trainings?training=t1',
    });
  });

  it('truncates the token to 12', async () => {
    expect(serverToken('riscaldamento')).toBe('riscaldament');
    renderHook(() => useServerSearch('riscaldamento', both));
    await advance(300);
    expect(searchExercises).toHaveBeenCalledWith('riscaldament', null);
  });

  it('sends nothing below 2 characters', async () => {
    const { result } = renderHook(() => useServerSearch('a', both));
    await advance(400);
    expect(searchExercises).not.toHaveBeenCalled();
    expect(result.current.exercises.loading).toBe(false);
  });

  it('sends nothing for a disabled group', async () => {
    renderHook(() => useServerSearch('pass', { exercises: true, trainings: false }));
    await advance(300);
    expect(searchExercises).toHaveBeenCalled();
    expect(searchTrainings).not.toHaveBeenCalled();
  });

  it('shows the first 5 matches', async () => {
    vi.mocked(searchExercises).mockResolvedValue(page(Array.from({ length: 8 }, (_, i) => ex(`e${i}`, `Passo ${i}`))) as never);
    const { result } = renderHook(() => useServerSearch('pas', both));
    await advance(300);
    expect(result.current.exercises.items).toHaveLength(5);
    expect(result.current.exercises.hasMore).toBe(true);
  });

  it('ignores a stale response', async () => {
    let resolveSlow: (v: unknown) => void = () => {};
    vi.mocked(searchExercises)
      .mockImplementationOnce(() => new Promise((r) => (resolveSlow = r)) as never)
      .mockResolvedValueOnce(page([ex('2', 'Servizio float')]) as never);
    const { result, rerender } = renderHook(({ q }) => useServerSearch(q, both), { initialProps: { q: 'ser' } });
    await advance(300);
    rerender({ q: 'servizio' });
    await advance(300);
    expect(result.current.exercises.items.map((i) => i.id)).toEqual(['2']);
    await act(async () => resolveSlow(page([ex('1', 'Serie lunga')])));
    expect(result.current.exercises.items.map((i) => i.id)).toEqual(['2']);
  });

  it('show more appends the next page using the cursor', async () => {
    const cursor = { id: 'c1' };
    vi.mocked(searchExercises)
      .mockResolvedValueOnce(page([ex('1', 'Passo uno')], true, cursor) as never)
      .mockResolvedValueOnce(page([ex('2', 'Passo due')], false, { id: 'c2' }) as never);
    const { result } = renderHook(() => useServerSearch('pas', both));
    await advance(300);
    expect(result.current.exercises.hasMore).toBe(true);
    await act(async () => result.current.exercises.showMore());
    expect(searchExercises).toHaveBeenLastCalledWith('pas', cursor);
    expect(result.current.exercises.items.map((i) => i.id)).toEqual(['1', '2']);
    expect(result.current.exercises.hasMore).toBe(false);
  });

  it('sends nothing while offline and reports offline', async () => {
    setOnline(false);
    const { result } = renderHook(() => useServerSearch('pass', both));
    await advance(400);
    expect(searchExercises).not.toHaveBeenCalled();
    expect(result.current.offline).toBe(true);
    expect(result.current.exercises.loading).toBe(false);
    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.offline).toBe(false);
  });

  it('a failed query leaves the group empty', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(searchExercises).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useServerSearch('pass', both));
    await advance(300);
    expect(result.current.exercises).toMatchObject({ items: [], loading: false, hasMore: false });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
