import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createExercise,
  updateExercise,
  deleteExercise,
  listExercises,
  getExercisesByIds,
  countTrainingsUsingExercise,
  bulkCreateExercises,
} from './exercisesApi';

const {
  mockAddDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockGetDoc,
  mockGetDocs,
  mockGetCountFromServer,
  mockCollection,
  mockDoc,
  mockWhere,
  mockWriteBatch,
} = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockGetCountFromServer: vi.fn(),
  mockCollection: vi.fn(() => 'exercises-collection'),
  mockDoc: vi.fn(() => 'doc-ref'),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  mockWriteBatch: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  getCountFromServer: mockGetCountFromServer,
  query: vi.fn((...args: unknown[]) => args),
  where: mockWhere,
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  startAfter: vi.fn((...args: unknown[]) => ({ type: 'startAfter', args })),
  serverTimestamp: () => 'server-timestamp',
  writeBatch: mockWriteBatch,
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('exercisesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an exercise stamped with the creator and a server timestamp', async () => {
    mockAddDoc.mockResolvedValue({ id: 'ex-1' });

    const id = await createExercise(
      { name: 'Pepper', description: 'Two-player control drill', category: 'warmup' },
      'coach-uid'
    );

    expect(id).toBe('ex-1');
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload).toMatchObject({
      name: 'Pepper',
      category: 'warmup',
      createdBy: 'coach-uid',
      createdAt: 'server-timestamp',
    });
  });

  it('bulk-creates exercises in a single batch stamped with creator + timestamp', async () => {
    const batchSet = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({ set: batchSet, commit: batchCommit });

    const count = await bulkCreateExercises(
      [
        { name: 'A', description: '', category: 'warmup' },
        { name: 'B', description: 'x', category: 'attack' },
      ],
      'coach-uid'
    );

    expect(count).toBe(2);
    expect(batchSet).toHaveBeenCalledTimes(2);
    expect(batchSet.mock.calls[0][1]).toMatchObject({
      name: 'A',
      category: 'warmup',
      createdBy: 'coach-uid',
      createdAt: 'server-timestamp',
    });
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it('retries the batch commit once on a transient resource-exhausted error', async () => {
    const batchSet = vi.fn();
    const batchCommit = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('quota'), { code: 'resource-exhausted' }))
      .mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({ set: batchSet, commit: batchCommit });

    const count = await bulkCreateExercises([{ name: 'A', description: '', category: 'warmup' }], 'coach-uid');

    expect(count).toBe(1);
    expect(batchCommit).toHaveBeenCalledTimes(2);
  });

  it('rejects a bulk exercise import above the MAX_IMPORT cap before any write', async () => {
    const batchSet = vi.fn();
    const batchCommit = vi.fn();
    mockWriteBatch.mockReturnValue({ set: batchSet, commit: batchCommit });

    await expect(
      bulkCreateExercises(
        Array.from({ length: 101 }, () => ({ name: 'x', description: '', category: 'warmup' as const })),
        'coach-uid'
      )
    ).rejects.toThrow(/capped at 100 entries/);
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('updates an exercise', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await updateExercise('ex-1', { name: 'Pepper (advanced)' });
    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { name: 'Pepper (advanced)' });
  });

  it('deletes an exercise', async () => {
    const del = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({ set: vi.fn(), update: vi.fn(), delete: del, commit });
    mockGetDocs.mockResolvedValue({ docs: [] });
    await deleteExercise('ex-1');
    expect(del).toHaveBeenCalledWith('doc-ref');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('deletes an exercise together with its diagrams subcollection in one batch', async () => {
    const set = vi.fn();
    const del = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({ set, update: vi.fn(), delete: del, commit });
    mockGetDocs.mockResolvedValue({
      docs: [{ ref: 'diagram-ref-1' }, { ref: 'diagram-ref-2' }],
    });

    await deleteExercise('ex-1');

    expect(del).toHaveBeenCalledWith('diagram-ref-1');
    expect(del).toHaveBeenCalledWith('diagram-ref-2');
    expect(del).toHaveBeenCalledWith('doc-ref'); // the exercise doc itself
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('lists exercises without a category filter, paginated', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'ex-1', data: () => ({ name: 'Pepper', category: 'warmup' }) }],
    });

    const { exercises, lastDoc } = await listExercises();

    expect(exercises).toEqual([{ id: 'ex-1', name: 'Pepper', category: 'warmup' }]);
    expect(lastDoc).toEqual({ id: 'ex-1', data: expect.any(Function) });
    expect(mockWhere).not.toHaveBeenCalled();
  });

  it('adds a category where-clause when a category is given', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await listExercises(null, 'attack');
    expect(mockWhere).toHaveBeenCalledWith('category', '==', 'attack');
  });

  it('resolves a list of exercise ids, dropping ones that no longer exist', async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, id: 'ex-1', data: () => ({ name: 'Pepper' }) })
      .mockResolvedValueOnce({ exists: () => false });

    const result = await getExercisesByIds(['ex-1', 'ex-gone']);

    expect(result).toEqual([{ id: 'ex-1', name: 'Pepper' }]);
  });

  it('counts trainings that reference an exercise', async () => {
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 3 }) });

    const count = await countTrainingsUsingExercise('ex-1');

    expect(count).toBe(3);
    expect(mockWhere).toHaveBeenCalledWith('exerciseIds', 'array-contains', 'ex-1');
  });
});
