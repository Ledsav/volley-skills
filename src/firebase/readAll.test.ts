import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readAll } from './readAll';

const { mockGetDocs, mockStartAfter } = vi.hoisted(() => ({
  mockGetDocs: vi.fn(),
  mockStartAfter: vi.fn((d: unknown) => ({ type: 'startAfter', d })),
}));

vi.mock('firebase/firestore', () => ({
  documentId: () => '__name__',
  getDocs: mockGetDocs,
  limit: (n: number) => ({ type: 'limit', n }),
  orderBy: (f: unknown) => ({ type: 'orderBy', f }),
  query: (...args: unknown[]) => args,
  startAfter: mockStartAfter,
}));

const page = (n: number, offset = 0) => ({ docs: Array.from({ length: n }, (_, i) => ({ id: `d${offset + i}` })) });

describe('readAll', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockStartAfter.mockClear();
  });

  it('returns a single short page without a cursor', async () => {
    mockGetDocs.mockResolvedValueOnce(page(3));
    const docs = await readAll('col' as never);
    expect(docs).toHaveLength(3);
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(mockStartAfter).not.toHaveBeenCalled();
  });

  it('follows the cursor until a short page', async () => {
    mockGetDocs.mockResolvedValueOnce(page(200)).mockResolvedValueOnce(page(5, 200));
    const docs = await readAll('col' as never);
    expect(docs).toHaveLength(205);
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(mockStartAfter).toHaveBeenCalledWith({ id: 'd199' });
  });
});
