import { describe, expect, it, vi, beforeEach } from 'vitest';
import { listCalendarSessions, createCalendarSession, deleteCalendarSession } from './calendarApi';

const { mockAddDoc, mockDeleteDoc, mockGetDocs, mockCollection, mockDoc, mockWhere } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn(() => 'calendar-collection'),
  mockDoc: vi.fn(() => 'doc-ref'),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  query: vi.fn((...args: unknown[]) => args),
  where: mockWhere,
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('calendarApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries only the given date range', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 's-1', data: () => ({ date: '2026-09-10', trainingName: 'Passing circuit' }) }],
    });

    const sessions = await listCalendarSessions('team-1', '2026-09-01', '2026-09-30');

    expect(sessions).toEqual([{ id: 's-1', date: '2026-09-10', trainingName: 'Passing circuit' }]);
    expect(mockWhere).toHaveBeenCalledWith('date', '>=', '2026-09-01');
    expect(mockWhere).toHaveBeenCalledWith('date', '<=', '2026-09-30');
  });

  it('creates a session with the denormalized training label and a timestamp', async () => {
    mockAddDoc.mockResolvedValue({ id: 's-2' });

    const id = await createCalendarSession(
      'team-1',
      {
        date: '2026-09-12',
        trainingId: 't-1',
        trainingBusinessId: 'TR-0007',
        trainingName: 'Passing circuit',
        notes: 'Focus on serve receive',
      },
      'coach-uid'
    );

    expect(id).toBe('s-2');
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload).toMatchObject({
      date: '2026-09-12',
      trainingBusinessId: 'TR-0007',
      trainingName: 'Passing circuit',
      createdBy: 'coach-uid',
      createdAt: 'server-timestamp',
    });
  });

  it('deletes a session', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    await deleteCalendarSession('team-1', 's-2');
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref');
  });
});
