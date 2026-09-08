import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createTraining,
  updateTraining,
  deleteTraining,
  listTrainings,
  findTrainingByBusinessId,
} from './trainingsApi';

const {
  mockRunTransaction,
  mockCollection,
  mockDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockGetDocs,
  mockWhere,
} = vi.hoisted(() => ({
  mockRunTransaction: vi.fn(),
  mockCollection: vi.fn(() => 'trainings-collection'),
  mockDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
}));

vi.mock('firebase/firestore', () => ({
  runTransaction: mockRunTransaction,
  collection: mockCollection,
  doc: mockDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDoc: vi.fn(),
  getDocs: mockGetDocs,
  query: vi.fn((...args: unknown[]) => args),
  where: mockWhere,
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  startAfter: vi.fn((...args: unknown[]) => ({ type: 'startAfter', args })),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('trainingsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a training inside a transaction, incrementing the counter and formatting the business id', async () => {
    mockDoc.mockImplementation((...args: unknown[]) => {
      if (args[1] === 'counters') return { ref: 'counters/trainings' };
      return { id: 'training-1' };
    });
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ lastSequence: 6 }) }),
      set: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

    const result = await createTraining(
      {
        name: 'Passing circuit',
        description: '',
        ageGroupTarget: 'U17',
        exercises: [
          { exerciseId: 'ex-1', order: 1, durationMinutes: 10 },
          { exerciseId: 'ex-2', order: 2, durationMinutes: 15 },
        ],
      },
      'coach-uid'
    );

    expect(result).toEqual({ id: 'training-1', businessId: 'TR-0007' });
    expect(tx.set).toHaveBeenCalledWith({ ref: 'counters/trainings' }, { lastSequence: 7 });
    const trainingPayload = tx.set.mock.calls[1][1];
    expect(trainingPayload).toMatchObject({
      businessId: 'TR-0007',
      name: 'Passing circuit',
      ageGroupTarget: 'U17',
      exerciseIds: ['ex-1', 'ex-2'],
      createdBy: 'coach-uid',
      createdAt: 'server-timestamp',
    });
  });

  it('starts the sequence at 1 when the counter does not exist yet', async () => {
    mockDoc.mockImplementation((...args: unknown[]) =>
      args[1] === 'counters' ? { ref: 'counters/trainings' } : { id: 'training-1' }
    );
    const tx = { get: vi.fn().mockResolvedValue({ exists: () => false }), set: vi.fn() };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

    const result = await createTraining(
      { name: 'X', description: '', ageGroupTarget: '', exercises: [] },
      'coach-uid'
    );

    expect(result.businessId).toBe('TR-0001');
    expect(tx.set).toHaveBeenCalledWith({ ref: 'counters/trainings' }, { lastSequence: 1 });
  });

  it('rewrites exerciseIds when exercises are updated', async () => {
    mockDoc.mockReturnValue('doc-ref');
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateTraining('training-1', {
      name: 'Passing circuit v2',
      exercises: [{ exerciseId: 'ex-9', order: 1, durationMinutes: 20 }],
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', {
      name: 'Passing circuit v2',
      exercises: [{ exerciseId: 'ex-9', order: 1, durationMinutes: 20 }],
      exerciseIds: ['ex-9'],
    });
  });

  it('deletes a training', async () => {
    mockDoc.mockReturnValue('doc-ref');
    mockDeleteDoc.mockResolvedValue(undefined);
    await deleteTraining('training-1');
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref');
  });

  it('filters the list by ageGroupTarget when given', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await listTrainings(null, { ageGroupTarget: 'U15' });
    expect(mockWhere).toHaveBeenCalledWith('ageGroupTarget', '==', 'U15');
  });

  it('finds a single training by business id', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'training-1', data: () => ({ businessId: 'TR-0007', name: 'Passing circuit' }) }],
    });

    const found = await findTrainingByBusinessId('TR-0007');

    expect(found).toEqual({ id: 'training-1', businessId: 'TR-0007', name: 'Passing circuit' });
    expect(mockWhere).toHaveBeenCalledWith('businessId', '==', 'TR-0007');
  });
});
