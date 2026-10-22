// Backup I/O core (backup design §3, §4): read every document generically, pack it into a
// sealed envelope, unpack it, and write it back. The CLIs (backup.mjs, restore.mjs) are thin
// wrappers; tests/rules/backup.rules.test.mjs runs this against the emulator.
import { gunzipSync, gzipSync } from 'node:zlib';
import { writeAll } from '../migrate/firestoreTree.mjs';
import { openBackup, sealBackup } from './backupCrypto.mjs';
import { decodeData, encodeData } from './firestoreJson.mjs';

const FORMAT = 'volley-skills-backup';
const VERSION = 1;

/**
 * `{ path, data }` for every document in the database, sorted by path, and the billed reads
 * (about 3 per document). The walk is generic, so a collection no schema lists is still
 * found: listCollections() at every level, and listDocuments(), which also returns parents
 * that do not exist but hold subcollections.
 */
export async function readEverything(db) {
  const docs = [];
  let reads = 1;
  async function walk(collections) {
    for (const col of collections) {
      const refs = await col.listDocuments();
      reads += Math.max(1, refs.length);
      for (let i = 0; i < refs.length; i += 100) {
        const part = refs.slice(i, i + 100);
        const snaps = await db.getAll(...part);
        reads += part.length;
        for (const snap of snaps) if (snap.exists) docs.push({ path: snap.ref.path, data: snap.data() });
      }
      for (const ref of refs) {
        const subs = await ref.listCollections();
        reads += 1;
        await walk(subs);
      }
    }
  }
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

/** Writes every backed-up doc with `set` (replaces). Docs created after the backup are left alone. */
export async function restoreDocs(db, docs, { log = () => {} } = {}) {
  const { written } = await writeAll(db, docs, { log });
  return { written };
}
