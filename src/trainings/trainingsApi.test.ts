import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createTraining,
  updateTraining,
  deleteTraining,
  listTrainings,
  findTrainingByBusinessId,
  resolveExerciseNames,
  bulkCreateTrainings,
  getTraining,
  searchTrainings,
} from './trainingsApi';

const {
  mockRunTransaction,
  mockCollection,
  mockDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockGetDocs,
  mockWhere,
  mockGetDoc,
} = vi.hoisted(() => ({
  mockRunTransaction: vi.fn(),
  mockCollection: vi.fn(() => 'trainings-collection'),
  mockDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  mockGetDoc: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  runTransaction: mockRunTransaction,
  collection: mockCollection,
  doc: mockDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDoc: mockGetDoc,
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
  // Retry tests run withBackoff's jittered sleeps on fake timers, so they
  // stay instant and don't depend on its default delays.
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a training inside a transaction, incrementing the counter and formatting the business id', async () => {
    mockDoc.mockImplementation((...args: unknown[]) => {
      if (args[3] === 'counters') return { ref: 'counters/trainings' };
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
      args[3] === 'counters' ? { ref: 'counters/trainings' } : { id: 'training-1' }
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

    await updateTraining(
      'training-1',
      {
        name: 'Passing circuit v2',
        exercises: [{ exerciseId: 'ex-9', order: 1, durationMinutes: 20 }],
      },
      'TR-0007'
    );

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({
        name: 'Passing circuit v2',
        exercises: [{ exerciseId: 'ex-9', order: 1, durationMinutes: 20 }],
        exerciseIds: ['ex-9'],
      })
    );
  });

  it('create writes searchTokens from the name and businessId', async () => {
    mockDoc.mockImplementation((...args: unknown[]) => (args[3] === 'counters' ? { ref: 'c' } : { id: 't1' }));
    const tx = { get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ lastSequence: 41 }) }), set: vi.fn() };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));
    await createTraining({ name: 'Attacco', description: '', ageGroupTarget: '', exercises: [] }, 'u');
    const tokens = tx.set.mock.calls[1][1].searchTokens;
    expect(tokens).toContain('att');
    expect(tokens).toContain('0042');
    expect(tokens).toContain('tr-0042');
  });

  it('bulk create writes tokens for every row', async () => {
    mockDoc.mockImplementation((...args: unknown[]) => (args[3] === 'counters' ? { ref: 'c' } : { id: 'tx' }));
    const tx = { get: vi.fn().mockResolvedValue({ exists: () => false }), set: vi.fn() };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));
    await bulkCreateTrainings(
      [
        { name: 'Alfa', description: '', ageGroupTarget: '', exercises: [] },
        { name: 'Beta', description: '', ageGroupTarget: '', exercises: [] },
      ],
      'u'
    );
    expect(tx.set.mock.calls[0][1].searchTokens).toEqual(expect.arrayContaining(['alf', 'tr-0001']));
    expect(tx.set.mock.calls[1][1].searchTokens).toEqual(expect.arrayContaining(['bet', 'tr-0002']));
  });

  it('update with a new name rewrites the tokens', async () => {
    mockDoc.mockReturnValue('doc-ref');
    await updateTraining('t1', { name: 'Servizio' }, 'TR-0042');
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.searchTokens).toEqual(expect.arrayContaining(['serv', 'tr-0042']));
  });

  it('update without a name leaves searchTokens alone', async () => {
    mockDoc.mockReturnValue('doc-ref');
    await updateTraining('t1', { description: 'x' }, 'TR-0042');
    expect(mockUpdateDoc.mock.calls[0][1]).not.toHaveProperty('searchTokens');
  });

  it('getTraining returns the training or null', async () => {
    mockDoc.mockReturnValue('doc-ref');
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, id: 't1', data: () => ({ name: 'A' }) });
    expect(await getTraining('t1')).toEqual({ id: 't1', name: 'A' });
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await getTraining('nope')).toBeNull();
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

  it('resolves exercise names to id lists, grouping duplicates', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'ex-1', data: () => ({ name: 'Butterfly' }) },
        { id: 'ex-2', data: () => ({ name: 'Dig' }) },
        { id: 'ex-3', data: () => ({ name: 'Dig' }) },
      ],
    });

    const map = await resolveExerciseNames(['Butterfly', 'Dig', 'Butterfly', '  ']);

    expect(map.get('Butterfly')).toEqual(['ex-1']);
    expect(map.get('Dig')).toEqual(['ex-2', 'ex-3']);
    expect(mockWhere).toHaveBeenCalledWith('name', 'in', ['Butterfly', 'Dig']);
  });

  it('bulk-creates trainings in one transaction with sequential business ids', async () => {
    mockDoc.mockImplementation((...args: unknown[]) => {
      if (args[3] === 'counters') return { ref: 'counters/trainings' };
      return { id: 'training-x' };
    });
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ lastSequence: 6 }) }),
      set: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

    const count = await bulkCreateTrainings(
      [
        {
          name: 'A',
          description: '',
          ageGroupTarget: 'U17',
          exercises: [{ exerciseId: 'ex-1', order: 1, durationMinutes: 10 }],
        },
        { name: 'B', description: '', ageGroupTarget: '', exercises: [] },
      ],
      'coach-uid'
    );

    expect(count).toBe(2);
    // 2 training sets + 1 counter set
    expect(tx.set).toHaveBeenCalledTimes(3);
    expect(tx.set.mock.calls[0][1]).toMatchObject({
      businessId: 'TR-0007',
      name: 'A',
      exerciseIds: ['ex-1'],
      createdBy: 'coach-uid',
    });
    expect(tx.set.mock.calls[1][1]).toMatchObject({ businessId: 'TR-0008', name: 'B', exerciseIds: [] });
    expect(tx.set.mock.calls[2][1]).toEqual({ lastSequence: 8 });
  });

  it('retries the transaction once on a transient resource-exhausted error', async () => {
    mockDoc.mockImplementation((...args: unknown[]) => {
      if (args[3] === 'counters') return { ref: 'counters/trainings' };
      return { id: 'training-x' };
    });
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ lastSequence: 6 }) }),
      set: vi.fn(),
    };
    mockRunTransaction
      .mockRejectedValueOnce(Object.assign(new Error('quota'), { code: 'resource-exhausted' }))
      .mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

    vi.useFakeTimers();
    const pending = bulkCreateTrainings(
      [{ name: 'A', description: '', ageGroupTarget: '', exercises: [] }],
      'coach-uid'
    );
    await vi.runAllTimersAsync();
    const count = await pending;

    expect(count).toBe(1);
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
  });

  it('retries a name-resolution query once on a transient unavailable error', async () => {
    mockGetDocs
      .mockRejectedValueOnce(Object.assign(new Error('blip'), { code: 'unavailable' }))
      .mockResolvedValue({ docs: [{ id: 'ex-1', data: () => ({ name: 'Butterfly' }) }] });

    vi.useFakeTimers();
    const pending = resolveExerciseNames(['Butterfly']);
    await vi.runAllTimersAsync();
    const map = await pending;

    expect(map.get('Butterfly')).toEqual(['ex-1']);
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });

  it('rejects a bulk training import above the MAX_IMPORT cap before opening a transaction', async () => {
    const rows = Array.from({ length: 101 }, () => ({
      name: 'x',
      description: '',
      ageGroupTarget: '',
      exercises: [],
    }));

    await expect(bulkCreateTrainings(rows, 'coach-uid')).rejects.toThrow(/capped at 100 entries/);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});

describe('searchTrainings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries searchTokens ordered by name, 20 per page', async () => {
    mockGetDocs.mockResolvedValue({ docs: Array.from({ length: 20 }, (_, i) => ({ id: `d${i}`, data: () => ({ name: `N${i}` }) })) });
    const page = await searchTrainings('pass');
    expect(mockWhere).toHaveBeenCalledWith('searchTokens', 'array-contains', 'pass');
    const args = (vi.mocked(mockGetDocs).mock.calls[0][0] as unknown[]);
    expect(args).toContainEqual({ type: 'orderBy', args: ['name'] });
    expect(args).toContainEqual({ type: 'limit', args: [20] });
    expect(page.items).toHaveLength(20);
    expect(page.hasMore).toBe(true);
  });

  it('continues after the cursor and reports the last page', async () => {
    const cursor = { id: 'c' } as never;
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'x', data: () => ({ name: 'X' }) }] });
    const page = await searchTrainings('pass', cursor);
    const args = (vi.mocked(mockGetDocs).mock.calls[0][0] as unknown[]);
    expect(args).toContainEqual({ type: 'startAfter', args: [cursor] });
    expect(page.hasMore).toBe(false);
    expect(page.lastDoc?.id).toBe('x');
  });
});
