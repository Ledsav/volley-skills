import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listDiagrams, getFirstDiagram, saveDiagramSet } from './diagramsApi';
import type { Scene } from '../types/diagram';

const {
  mockCollection, mockDoc, mockGetDocs, mockQuery, mockOrderBy, mockLimit, mockWriteBatch,
} = vi.hoisted(() => ({
  mockCollection: vi.fn(() => 'diagrams-col'),
  mockDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn((...args: unknown[]) => args),
  mockOrderBy: vi.fn((...args: unknown[]) => ({ orderBy: args })),
  mockLimit: vi.fn((...args: unknown[]) => ({ limit: args })),
  mockWriteBatch: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  orderBy: mockOrderBy,
  limit: mockLimit,
  writeBatch: mockWriteBatch,
  serverTimestamp: () => 'ts',
}));
vi.mock('../firebase/config', () => ({ db: {} }));

const scene: Scene = { v: 1, court: 'full', showZones: false, items: [] };

describe('diagramsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists diagrams ordered by `order`, capped at 12', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'd1', data: () => ({ title: 'Setup', order: 0, scene }) }],
    });
    const result = await listDiagrams('ex-1');
    expect(result).toEqual([{ id: 'd1', title: 'Setup', order: 0, scene }]);
    expect(mockOrderBy).toHaveBeenCalledWith('order');
    expect(mockLimit).toHaveBeenCalledWith(12);
  });

  it('getFirstDiagram returns the single doc or null', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'd1', data: () => ({ title: 'A', order: 0, scene }) }] });
    expect(await getFirstDiagram('ex-1')).toMatchObject({ id: 'd1' });
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    expect(await getFirstDiagram('ex-1')).toBeNull();
    expect(mockLimit).toHaveBeenLastCalledWith(1);
  });

  it('saveDiagramSet batches creates, updates and deletes and returns an idMap', async () => {
    const set = vi.fn();
    const update = vi.fn();
    const del = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({ set, update, delete: del, commit });
    mockDoc.mockImplementation((...args: unknown[]) => {
      const rest = args.slice(2) as string[];
      return rest.length ? { id: rest[rest.length - 1] } : { id: 'generated-id' };
    });

    const { idMap } = await saveDiagramSet('ex-1', {
      creates: [{ tempId: 'new:1', title: 'Setup', order: 0, scene }],
      updates: [{ id: 'd2', title: 'Phase 1', order: 1, scene }],
      deletes: ['d3'],
    }, 'coach-uid');

    expect(set).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(idMap['new:1']).toBe('generated-id');
    expect(update.mock.calls[0][1]).toMatchObject({ updatedBy: 'coach-uid', updatedAt: 'ts' });
  });

  it('throws before any write when a scene fails validation', async () => {
    const commit = vi.fn();
    mockWriteBatch.mockReturnValue({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit });
    await expect(
      saveDiagramSet('ex-1', {
        creates: [{ tempId: 'new:1', title: 'Broken', order: 0, scene: { v: 2 } as unknown as Scene }],
        updates: [],
        deletes: [],
      }, 'coach-uid'),
    ).rejects.toThrow(/Broken/);
    expect(commit).not.toHaveBeenCalled();
  });
});
