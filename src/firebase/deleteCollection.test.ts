import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteCollection } from './deleteCollection';

const { mockGetDocs, mockBatchDelete, mockCommit } = vi.hoisted(() => ({
  mockGetDocs: vi.fn(),
  mockBatchDelete: vi.fn(),
  mockCommit: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getDocs: mockGetDocs,
  query: vi.fn((...args: unknown[]) => args),
  limit: vi.fn((n: number) => ({ type: 'limit', n })),
  writeBatch: () => ({ delete: mockBatchDelete, commit: mockCommit }),
}));
vi.mock('./config', () => ({ db: {} }));

const page = (ids: string[]) => ({
  empty: ids.length === 0,
  docs: ids.map((id) => ({ id, ref: `${id}-ref` })),
});

describe('deleteCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommit.mockResolvedValue(undefined);
  });

  it('does nothing for an empty collection', async () => {
    mockGetDocs.mockResolvedValueOnce(page([]));
    await deleteCollection({} as never);
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it('clears each doc’s subcollections before batch-deleting the page', async () => {
    mockGetDocs.mockResolvedValueOnce(page(['a', 'b']));
    const calls: string[] = [];
    const beforeDelete = vi.fn(async (id: string) => {
      calls.push(`sub:${id}`);
    });
    mockCommit.mockImplementation(async () => {
      calls.push('commit');
    });

    await deleteCollection({} as never, beforeDelete);

    expect(calls).toEqual(['sub:a', 'sub:b', 'commit']);
    expect(mockBatchDelete).toHaveBeenCalledWith('a-ref');
    expect(mockBatchDelete).toHaveBeenCalledWith('b-ref');
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('keeps paging while full pages come back', async () => {
    const full = Array.from({ length: 400 }, (_, i) => `d${i}`);
    mockGetDocs.mockResolvedValueOnce(page(full)).mockResolvedValueOnce(page(['last']));
    await deleteCollection({} as never);
    expect(mockCommit).toHaveBeenCalledTimes(2);
    expect(mockBatchDelete).toHaveBeenCalledTimes(401);
  });
});
