// Backup I/O core (backup design §3, §4): read every document generically, pack it into a
// sealed envelope, unpack it, and write it back. The CLIs (backup.mjs, restore.mjs) are thin
// wrappers; tests/rules/backup.rules.test.mjs runs this against the emulator.
import { gunzipSync, gzipSync } from 'node:zlib';
import { openBackup, sealBackup } from './backupCrypto.mjs';
import { decodeData, encodeData } from './firestoreJson.mjs';

const FORMAT = 'volley-skills-backup';
const VERSION = 1;

/**
 * `{ path, data }` for every document in the database, sorted by path, and the billed reads
 * (about 3 per document). The walk is generic, so a collection no schema lists is still
 * found: listCollections() at every level, and listDocuments(), which also returns parents
 * that do not exist but hold subcollections.
 *
 * `maxReads` stops the walk before it would spend more (Spark's 50,000 reads a day are
 * shared with the live app); it can overshoot by at most one listDocuments() call.
 */
export async function readEverything(db, { maxReads = Infinity } = {}) {
  const docs = [];
  let reads = 0;
  const spend = (n) => {
    if (reads + n > maxReads) {
      throw new Error(`Stopped at the read budget of ${maxReads} reads (spent ${reads}). Nothing was written; raise --max-reads on a quiet day.`);
    }
    reads += n;
  };
  async function walk(collections) {
    for (const col of collections) {
      const refs = await col.listDocuments();
      spend(Math.max(1, refs.length));
      for (let i = 0; i < refs.length; i += 100) {
        const part = refs.slice(i, i + 100);
        spend(part.length);
        const snaps = await db.getAll(...part);
        for (const snap of snaps) if (snap.exists) docs.push({ path: snap.ref.path, data: snap.data() });
      }
      for (const ref of refs) {
        spend(1);
        await walk(await ref.listCollections());
      }
    }
  }
  spend(1);
  await walk(await db.listCollections());
  docs.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { docs, reads };
}

/** Number of documents per top-level collection (counts only: safe to log). */
export function countsByCollection(docs) {
  const counts = {};
  for (const { path } of docs) {
    const top = path.split('/')[0];
    counts[top] = (counts[top] ?? 0) + 1;
  }
  return counts;
}

/** The sealed envelope for `docs`: encoded, gzipped, encrypted for `publicKeyPem`. */
export function packBackup(docs, { projectId, createdAt, publicKeyPem }) {
  const content = { format: FORMAT, version: VERSION, projectId, createdAt, docs: docs.map((d) => ({ path: d.path, data: encodeData(d.data) })) };
  return sealBackup(gzipSync(Buffer.from(JSON.stringify(content))), publicKeyPem, { projectId, createdAt });
}

/** The backup's content with Firestore types rebuilt on `db`. Throws on a wrong key or passphrase, or a changed file. */
export function unpackBackup(envelope, privateKeyPem, passphrase, db) {
  const content = JSON.parse(gunzipSync(openBackup(envelope, privateKeyPem, passphrase)).toString('utf8'));
  if (content.format !== FORMAT || content.version !== VERSION) throw new Error('Unknown backup content version.');
  if (content.projectId !== envelope.projectId || content.createdAt !== envelope.createdAt) throw new Error('Backup header and content disagree.');
  return {
    projectId: content.projectId,
    createdAt: content.createdAt,
    docs: content.docs.map((d) => ({ path: d.path, data: decodeData(d.data, db) })),
  };
}

/**
 * Writes the backed-up docs from index `from` up to (not including) `until` with `set`
 * (replaces), `batchSize` per commit. Docs created after the backup are left alone. Docs are path-sorted, so `from`
 * is stable: after a stop (e.g. the daily write quota), the thrown error's `nextFrom` is
 * where to continue.
 */
export async function restoreDocs(db, docs, { from = 0, until = docs.length, batchSize = 200, log = () => {} } = {}) {
  let next = from;
  try {
    while (next < until) {
      const chunk = docs.slice(next, Math.min(until, next + batchSize));
      const batch = db.batch();
      for (const d of chunk) batch.set(db.doc(d.path), d.data);
      await batch.commit();
      next += chunk.length;
      log(`  ${next}/${docs.length} written`);
    }
  } catch (e) {
    e.nextFrom = next;
    throw e;
  }
  return { written: next - from, nextFrom: next };
}
