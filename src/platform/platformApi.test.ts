import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLUBS_PAGE, changeClubStatus, listClubs } from './platformApi';

class FakeTs { constructor(public d: Date) {} }
const m = vi.hoisted(() => ({
  collection: vi.fn((_db: unknown, ...p: string[]) => `col:${p.join('/')}`),
  doc: vi.fn((a: unknown, ...p: string[]) => (typeof a === 'string' ? { id: 'LOG1', path: `${a}/LOG1` } : { id: p[p.length - 1], path: p.join('/') })),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((n: number) => ({ type: 'limit', n })),
  startAfter: vi.fn((d: unknown) => ({ type: 'startAfter', d })),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  writeBatch: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  ...m,
  Timestamp: { fromDate: (d: Date) => new FakeTs(d) },
}));
const db = vi.hoisted(() => ({ name: 'db' }));
vi.mock('../firebase/config', () => ({ db }));

const batch = { update: vi.fn(), set: vi.fn(), commit: vi.fn() };
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockClear());
  m.getDocs.mockReset();
  m.writeBatch.mockReturnValue(batch);
  batch.update.mockReset();
  batch.set.mockReset();
  batch.commit.mockReset().mockResolvedValue(undefined);
});

const snap = (id: string) => ({ id, data: () => ({ name: id }) });

describe('listClubs', () => {
  it('lists clubs newest first, filtered by status when set, with a cursor', async () => {
    const docs = Array.from({ length: CLUBS_PAGE }, (_, i) => snap(`c${i}`));
    m.getDocs.mockResolvedValue({ docs });
    const after = snap('prev') as never;
    const r = await listClubs({ status: 'pending', after });
    expect(m.collection).toHaveBeenCalledWith(db, 'clubs');
    expect(m.query).toHaveBeenCalledWith(
      'col:clubs',
      { type: 'orderBy', args: ['createdAt', 'desc'] },
      { type: 'where', args: ['status', '==', 'pending'] },
      { type: 'limit', n: CLUBS_PAGE },
      { type: 'startAfter', d: after },
    );
    expect(r.clubs[0]).toEqual({ id: 'c0', name: 'c0' });
    expect(r.lastDoc).toBe(docs[CLUBS_PAGE - 1]);
    expect(r.hasMore).toBe(true);
  });

  it('omits the filter and cursor when not given and reports no more on a short page', async () => {
    m.getDocs.mockResolvedValue({ docs: [snap('a')] });
    const r = await listClubs({ status: null, after: null });
    expect(m.query).toHaveBeenCalledWith(
      'col:clubs',
      { type: 'orderBy', args: ['createdAt', 'desc'] },
      { type: 'limit', n: CLUBS_PAGE },
    );
    expect(r.hasMore).toBe(false);
  });
});

describe('changeClubStatus', () => {
  it('writes the status change and its log in one batch with matching reason', async () => {
    await changeClubStatus({ clubId: 'c1', from: 'active', to: 'suspended', reason: 'unpaid' }, 'op@x.io');
    expect(m.collection).toHaveBeenCalledWith(db, 'clubs', 'c1', 'statusLog');
    expect(batch.update).toHaveBeenCalledWith({ id: 'c1', path: 'clubs/c1' }, {
      status: 'suspended', statusReason: 'unpaid', statusChangedAt: 'SERVER_TS',
      statusChangedBy: 'op@x.io', lastStatusLogId: 'LOG1',
    });
    expect(batch.set).toHaveBeenCalledWith(
      { id: 'LOG1', path: 'col:clubs/c1/statusLog/LOG1' },
      { from: 'active', to: 'suspended', reason: 'unpaid', by: 'op@x.io', at: 'SERVER_TS' },
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('sets termination dates as Timestamps only when dates are given', async () => {
    const eff = new Date(2027, 1, 1);
    const ret = new Date(2027, 2, 5);
    await changeClubStatus({ clubId: 'c1', from: 'active', to: 'terminating', reason: null, dates: { effectiveAt: eff, retrievalEndsAt: ret } }, 'op@x.io');
    const patch = batch.update.mock.calls[0][1];
    expect(patch['termination.effectiveAt']).toEqual(new FakeTs(eff));
    expect(patch['termination.retrievalEndsAt']).toEqual(new FakeTs(ret));

    batch.update.mockClear();
    await changeClubStatus({ clubId: 'c1', from: 'pending', to: 'active', reason: null }, 'op@x.io');
    expect(Object.keys(batch.update.mock.calls[0][1]).some((k) => k.startsWith('termination'))).toBe(false);
  });

  it('clears the termination dates when reinstating', async () => {
    await changeClubStatus({ clubId: 'c1', from: 'terminating', to: 'active', reason: null }, 'op@x.io');
    const patch = batch.update.mock.calls[0][1];
    expect(patch['termination.effectiveAt']).toBeNull();
    expect(patch['termination.retrievalEndsAt']).toBeNull();
  });
});
