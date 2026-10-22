import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readAll, readAllFromServer } from './readAll';

const { mockGetDocs, mockGetDocsFromServer, mockStartAfter } = vi.hoisted(() => ({
  mockGetDocs: vi.fn(),
  mockGetDocsFromServer: vi.fn(),
  mockStartAfter: vi.fn((d: unknown) => ({ type: 'startAfter', d })),
}));

vi.mock('firebase/firestore', () => ({
  documentId: () => '__name__',
  getDocs: mockGetDocs,
  getDocsFromServer: mockGetDocsFromServer,
  limit: (n: number) => ({ type: 'limit', n }),
  orderBy: (f: unknown) => ({ type: 'orderBy', f }),
  query: (...args: unknown[]) => args,
  startAfter: mockStartAfter,
}));

const page = (n: number, offset = 0) => ({ docs: Array.from({ length: n }, (_, i) => ({ id: `d${offset + i}` })) });

describe('readAll', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockGetDocsFromServer.mockReset();
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

  it('readAllFromServer never answers from the offline cache', async () => {
    mockGetDocsFromServer.mockResolvedValueOnce(page(200)).mockResolvedValueOnce(page(1, 200));
    const docs = await readAllFromServer('col' as never);
    expect(docs).toHaveLength(201);
    expect(mockGetDocsFromServer).toHaveBeenCalledTimes(2);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('readAllFromServer fails when the server cannot be reached', async () => {
    mockGetDocsFromServer.mockRejectedValueOnce(new Error('Failed to get documents from server.'));
    await expect(readAllFromServer('col' as never)).rejects.toThrow(/from server/);
  });
});
