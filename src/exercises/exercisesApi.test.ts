import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createExercise,
  updateExercise,
  deleteExercise,
  listExercises,
  getExercisesByIds,
  countTrainingsUsingExercise,
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

  it('updates an exercise', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await updateExercise('ex-1', { name: 'Pepper (advanced)' });
    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { name: 'Pepper (advanced)' });
  });

  it('deletes an exercise', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    await deleteExercise('ex-1');
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref');
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
