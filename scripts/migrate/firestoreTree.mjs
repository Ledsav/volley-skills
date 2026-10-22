// Admin SDK helpers shared by the migration and ops scripts: read a whole tree in
// id-ordered pages, count docs under a collection, write a list of docs in batches.
// Read cost matters: one pass over the tree costs about one read per doc.
import { FieldPath } from 'firebase-admin/firestore';

/**
 * The subcollections each collection's docs can have (the app's data model; the rules
 * deny any other path). Walking these names instead of calling listCollections() on
 * every doc saves one billed read per doc — Spark allows 50,000 reads a day.
 */
export const SUBCOLLECTIONS = {
  teams: ['players', 'calendar', 'testingSessions', 'matches', 'awards', 'scoutProfile'],
  players: ['physicalTests'],
  testingSessions: ['entries'],
  matches: ['events'],
  exercises: ['diagrams'],
};

const nameOf = (path) => path.split('/').pop();

/** Every doc of `col` in id order, one bounded page at a time. `select()` with no fields skips the data. */
async function pages(col, { pageSize, withData }) {
  const out = [];
  let last = null;
  for (;;) {
    let q = col.orderBy(FieldPath.documentId()).limit(pageSize);
    if (!withData) q = q.select();
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    out.push(...snap.docs);
    if (snap.docs.length < pageSize) return out;
    last = snap.docs[snap.docs.length - 1];
  }
}

/** `{ path, data }` for every doc under the named top-level collections, at any depth. */
export async function readTree(db, collectionNames, { pageSize = 500 } = {}) {
  const docs = [];
  async function walk(col, name) {
    for (const doc of await pages(col, { pageSize, withData: true })) {
      docs.push({ path: doc.ref.path, data: doc.data() });
      for (const sub of SUBCOLLECTIONS[name] ?? []) await walk(doc.ref.collection(sub), sub);
    }
  }
  for (const name of collectionNames) await walk(db.collection(name), name);
  return docs;
}

/**
 * Number of docs in the collection at `path`, at all depths. A collection without
 * subcollections is counted with one count() aggregation (one read per 1,000 docs);
 * only parents (teams, players, matches...) are fetched, without their data.
 */
export async function countUnder(db, path, { pageSize = 500 } = {}) {
  async function count(col, name) {
    const subs = SUBCOLLECTIONS[name] ?? [];
    if (subs.length === 0) return (await col.count().get()).data().count;
    let n = 0;
    for (const doc of await pages(col, { pageSize, withData: false })) {
      n += 1;
      for (const sub of subs) n += await count(doc.ref.collection(sub), sub);
    }
    return n;
  }
  return count(db.collection(path), nameOf(path));
}

/**
 * Writes `{ path, data }` docs with `set` (replaces), `batchSize` per commit. With
 * `resume`, docs that already exist are skipped (checked with getAll, 100 at a
 * time): that is the checkpoint after a run stopped by the daily write quota.
 */
export async function writeAll(db, writes, { resume = false, batchSize = 400, log = () => {} } = {}) {
  let written = 0;
  let skipped = 0;
  for (let i = 0; i < writes.length; i += batchSize) {
    let chunk = writes.slice(i, i + batchSize);
    if (resume) {
      const missing = [];
      for (let j = 0; j < chunk.length; j += 100) {
        const part = chunk.slice(j, j + 100);
        const snaps = await db.getAll(...part.map((w) => db.doc(w.path)));
        snaps.forEach((s, k) => (s.exists ? (skipped += 1) : missing.push(part[k])));
      }
      chunk = missing;
    }
    if (chunk.length > 0) {
      const batch = db.batch();
      for (const w of chunk) batch.set(db.doc(w.path), w.data);
      await batch.commit();
      written += chunk.length;
    }
    log(`  ${Math.min(i + batchSize, writes.length)}/${writes.length} processed (${written} written, ${skipped} skipped)`);
  }
  return { written, skipped };
}
