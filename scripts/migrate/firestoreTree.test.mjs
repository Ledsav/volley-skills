import { describe, expect, it } from 'vitest';
import { countUnder, readTree } from './firestoreTree.mjs';

/**
 * A minimal in-memory stand-in for the Admin SDK calls firestoreTree uses. It counts
 * billed reads (one per doc fetched, one per count() aggregation) and refuses
 * listCollections(), which would cost a read per doc on Spark's 50,000/day.
 */
function fakeDb(paths) {
  const stats = { docReads: 0, aggregations: 0 };
  const children = (colPath) =>
    paths
      .filter((p) => p.startsWith(`${colPath}/`) && p.slice(colPath.length + 1).split('/').length === 1)
      .sort();
  const docRef = (path) => ({
    path,
    id: path.split('/').pop(),
    collection: (name) => collection(`${path}/${name}`),
    listCollections: () => {
      throw new Error('listCollections is billed per doc: not allowed');
    },
  });
  function collection(colPath) {
    const query = { limitN: Infinity, after: null };
    const q = {
      orderBy: () => q,
      select: () => q,
      limit: (n) => ((query.limitN = n), q),
      startAfter: (doc) => ((query.after = doc.ref.path), q),
      get: async () => {
        const all = children(colPath).filter((p) => query.after === null || p > query.after).slice(0, query.limitN);
        stats.docReads += all.length;
        return { docs: all.map((p) => ({ ref: docRef(p), id: p.split('/').pop(), data: () => ({ path: p }) })) };
      },
      count: () => ({
        get: async () => {
          stats.aggregations += 1;
          return { data: () => ({ count: children(colPath).length }) };
        },
      }),
    };
    return q;
  }
  return { db: { collection }, stats };
}

const TREE = [
  'teams/t1',
  'teams/t1/players/p1',
  'teams/t1/players/p1/physicalTests/x1',
  'teams/t1/matches/m1',
  ...Array.from({ length: 30 }, (_, i) => `teams/t1/matches/m1/events/e${String(i).padStart(2, '0')}`),
  'teams/t1/testingSessions/s1',
  'teams/t1/testingSessions/s1/entries/n1',
  'teams/t1/awards/season',
  'exercises/x1',
  'exercises/x1/diagrams/d1',
];

describe('readTree', () => {
  it('reads every doc of the known schema once, without listCollections', async () => {
    const { db, stats } = fakeDb(TREE);
    const docs = await readTree(db, ['teams', 'exercises'], { pageSize: 7 });
    expect(docs.map((d) => d.path).sort()).toEqual([...TREE].sort());
    expect(stats.docReads).toBe(TREE.length);
  });
});

describe('countUnder', () => {
  it('counts leaf collections with aggregations, not doc reads', async () => {
    const { db, stats } = fakeDb(TREE);
    expect(await countUnder(db, 'teams')).toBe(TREE.filter((p) => p.startsWith('teams/')).length);
    // Parents (team, player, match, session) are fetched to find their children; the 30 events are not.
    expect(stats.docReads).toBeLessThan(10);
  });
});
