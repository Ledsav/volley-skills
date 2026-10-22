// Admin SDK helpers shared by the migration and ops scripts: read a whole tree in
// id-ordered pages, count docs under a collection, write a list of docs in batches.
import { FieldPath } from 'firebase-admin/firestore';

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

async function walk(col, visit, opts) {
  for (const doc of await pages(col, opts)) {
    visit(doc);
    for (const sub of await doc.ref.listCollections()) await walk(sub, visit, opts);
  }
}

/** `{ path, data }` for every doc under the named top-level collections, at any depth. */
export async function readTree(db, collectionNames, { pageSize = 500 } = {}) {
  const docs = [];
  for (const name of collectionNames) {
    await walk(db.collection(name), (d) => docs.push({ path: d.ref.path, data: d.data() }), { pageSize, withData: true });
  }
  return docs;
}

/** Number of docs in the collection at `path`, at all depths. */
export async function countUnder(db, path, { pageSize = 500 } = {}) {
  let n = 0;
  await walk(db.collection(path), () => { n += 1; }, { pageSize, withData: false });
  return n;
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
