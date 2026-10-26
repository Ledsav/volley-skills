// Purging an ended club (club platform spec §7.4): every subcollection goes except
// the contract evidence (acceptances, statusLog), and the club doc becomes a
// tombstone. Firebase Auth accounts are never touched (a person may belong to other clubs).
import { FieldValue } from 'firebase-admin/firestore';
import { countUnder } from '../migrate/firestoreTree.mjs';

export const KEEP_SUBCOLLECTIONS = ['acceptances', 'statusLog'];

const iso = (ts) => new Date(ts.toMillis()).toISOString();

/**
 * A deleted club (rejected while pending, or already purged) may always be purged; a
 * terminating one only after its retrieval window. `club` is the doc's data or null.
 */
export function purgeAllowed(club, now) {
  if (!club) return { ok: false, reason: 'club not found' };
  if (club.status === 'deleted') return { ok: true };
  if (club.status !== 'terminating') return { ok: false, reason: `club is ${club.status}` };
  const ends = club.termination?.retrievalEndsAt;
  if (!ends) return { ok: false, reason: 'terminating club has no retrievalEndsAt' };
  if (now.getTime() <= ends.toMillis()) return { ok: false, reason: `retrieval window open until ${iso(ends)}` };
  return { ok: true };
}

export function tombstoneOf(club, at) {
  const { name, country, ownerEmail, createdAt } = club;
  return { name, country, ownerEmail, createdAt, status: 'deleted', statusChangedAt: at, legal: club.legal ?? null };
}

/** Purges `clubs/{clubId}`; returns the doc count deleted per subcollection. */
export async function purgeClub(db, clubId, now, log = console.log) {
  const ref = db.doc(`clubs/${clubId}`);
  const club = (await ref.get()).data() ?? null;
  const allowed = purgeAllowed(club, now);
  if (!allowed.ok) throw new Error(allowed.reason);

  const summary = {};
  for (const sub of await ref.listCollections()) {
    if (KEEP_SUBCOLLECTIONS.includes(sub.id)) continue;
    summary[sub.id] = await countUnder(db, sub.path);
    await db.recursiveDelete(sub);
    log(`  ${sub.id}: ${summary[sub.id]} deleted`);
  }

  const at = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(ref, tombstoneOf(club, at));
  batch.set(ref.collection('statusLog').doc(), {
    from: club.status, to: 'deleted', reason: 'Data purged', by: 'purge-script', at,
  });
  await batch.commit();
  log(`clubs/${clubId} is now a tombstone; acceptances and statusLog kept.`);
  return summary;
}
