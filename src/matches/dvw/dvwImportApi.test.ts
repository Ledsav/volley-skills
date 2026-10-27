// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewMatchEvent } from '../../types/match';
import type { Player } from '../../types/player';
import { loadFixture } from './loadFixture';
import { autoMapPlayers, mapDvw, type DvwPlan } from './mapDvw';
import { parseDvw } from './parseDvw';
import { pickOurSide } from './pickSide';
import { discardImport, findImportedMatch, runImport, startImport } from './dvwImportApi';

const m = vi.hoisted(() => {
  const state = { n: 0, batches: [] as { sets: { id: string }[] }[] };
  return {
    state,
    setDoc: vi.fn(() => Promise.resolve()),
    getDocs: vi.fn(),
    where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
    limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
    doc: vi.fn((_parent: unknown, id?: string) => ({ id: id ?? `gen${++state.n}` })),
    finishMatch: vi.fn(() => Promise.resolve()),
    deleteMatch: vi.fn(() => Promise.resolve()),
    getUsageProfile: vi.fn(() => Promise.resolve({ players: {} })),
    commitImpl: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('firebase/firestore', () => ({
  doc: m.doc,
  setDoc: m.setDoc,
  getDocs: m.getDocs,
  query: vi.fn((...args: unknown[]) => args),
  where: m.where,
  limit: m.limit,
  serverTimestamp: () => 'ts',
  writeBatch: vi.fn(() => {
    const sets: { id: string }[] = [];
    const b = { sets, set: vi.fn((ref: { id: string }) => sets.push(ref)), commit: vi.fn(() => m.commitImpl()) };
    m.state.batches.push(b);
    return b;
  }),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));
vi.mock('../matchesApi', () => ({
  matchesCol: () => 'matches',
  matchDoc: (_t: string, id: string) => ({ id }),
  eventsCol: () => 'events',
  finishMatch: m.finishMatch,
  deleteMatch: m.deleteMatch,
  getUsageProfile: m.getUsageProfile,
}));

const meta = { fileName: 'x.dvw', fileSha256: 'a'.repeat(64), generator: 'DataVolley', warnings: 2 };

function realPlan(): DvwPlan {
  const file = parseDvw(loadFixture('three-sets-home.dvw'));
  if ('error' in file) throw new Error(file.error.code);
  const us = pickOurSide(file.teams, ['Volley Club Test', 'U17']);
  const players = file.players
    .filter((p) => p.side === us)
    .map((p) => ({ id: `p${p.jersey}`, number: p.jersey, fullName: `App ${p.jersey}`, positionCategory: 'U', starting: false }) as Player);
  return mapDvw(file, { us, mapping: autoMapPlayers(file, us, players), players, importId: 'imp1' });
}

function fakePlan(count: number): DvwPlan {
  const real = realPlan();
  const events = Array.from({ length: count }, (_, i) => ({ ...real.events[0], order: i + 1 }) as NewMatchEvent);
  return { ...real, events };
}

describe('dvwImportApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.state.batches.length = 0;
    m.state.n = 0;
    m.commitImpl.mockImplementation(() => Promise.resolve());
  });

  it('writes events in batches of at most 450 with the pre-generated ids', async () => {
    const plan = fakePlan(1000);
    const job = startImport('t1', plan, meta, 'uid-1');
    expect(job.eventIds).toHaveLength(1000);
    const progress = vi.fn();
    await runImport('t1', plan, job, progress);
    expect(m.state.batches).toHaveLength(3);
    expect(m.state.batches.map((b) => b.sets.length)).toEqual([450, 450, 100]);
    expect(m.state.batches.flatMap((b) => b.sets.map((s) => s.id))).toEqual(job.eventIds);
    expect(progress).toHaveBeenLastCalledWith(1000, 1000);
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    expect(m.setDoc).toHaveBeenCalledWith(
      { id: job.matchId },
      expect.objectContaining({
        status: 'setup',
        createdBy: 'uid-1',
        import: { format: 'dvw', fileName: 'x.dvw', fileSha256: meta.fileSha256, generator: 'DataVolley', importedAt: 'ts', importedBy: 'uid-1', warnings: 2 },
      }),
    );
  });

  it('resumes after a failed batch without rewriting earlier ones', async () => {
    const plan = fakePlan(1000);
    const job = startImport('t1', plan, meta, 'uid-1');
    m.commitImpl.mockImplementationOnce(() => Promise.resolve()).mockImplementationOnce(() => Promise.reject(new Error('offline')));
    await expect(runImport('t1', plan, job, vi.fn())).rejects.toThrow('offline');
    expect(job.nextBatch).toBe(1);
    expect(m.finishMatch).not.toHaveBeenCalled();
    await runImport('t1', plan, job, vi.fn());
    expect(m.state.batches).toHaveLength(4); // 2 in the first run (one failed), then batches 2 and 3
    expect(m.state.batches[2].sets.map((s) => s.id)).toEqual(job.eventIds.slice(450, 900));
    expect(m.state.batches[3].sets.map((s) => s.id)).toEqual(job.eventIds.slice(900));
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    expect(m.finishMatch).toHaveBeenCalledTimes(1);
  });

  it('finishes through buildFinishPayload', async () => {
    const plan = realPlan();
    const job = startImport('t1', plan, meta, 'uid-1');
    await runImport('t1', plan, job, vi.fn());
    expect(m.finishMatch).toHaveBeenCalledTimes(1);
    const [team, matchId, payload] = m.finishMatch.mock.calls[0] as unknown as [string, string, { summary: { sourceCounts: { import?: number } } }];
    expect(team).toBe('t1');
    expect(matchId).toBe(job.matchId);
    const actions = plan.events.filter((e) => e.type === 'action').length;
    expect(actions).toBeGreaterThan(0);
    expect(payload.summary.sourceCounts.import).toBe(actions);
  });

  it('findImportedMatch queries import.fileSha256 with limit 1', async () => {
    m.getDocs.mockResolvedValue({ empty: false, docs: [{ id: 'm9', data: () => ({ date: '2026-10-01', opponent: 'Rivals' }) }] });
    expect(await findImportedMatch('t1', meta.fileSha256)).toEqual({ id: 'm9', date: '2026-10-01', opponent: 'Rivals' });
    expect(m.where).toHaveBeenCalledWith('import.fileSha256', '==', meta.fileSha256);
    expect(m.limit).toHaveBeenCalledWith(1);
    m.getDocs.mockResolvedValue({ empty: true, docs: [] });
    expect(await findImportedMatch('t1', meta.fileSha256)).toBeNull();
  });

  it('discardImport deletes the match', async () => {
    await discardImport('t1', 'm1');
    expect(m.deleteMatch).toHaveBeenCalledWith('t1', 'm1');
  });
});
