// I/O core of the searchTokens backfill: reads each exercise and training of a club once,
// writes only the docs whose tokens are missing or differ. Tested on the emulator.
import { planSearchTokens } from './searchTokensPlan.mjs';

const PAGE = 300;
const BATCH = 450;

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} clubId
 * @param {{ dryRun?: boolean, pageSize?: number, batchSize?: number }} [opts]
 * @returns {Promise<{ read: number, written: number, skipped: number }>}
 */
export async function backfillSearchTokens(db, clubId, { dryRun = false, pageSize = PAGE, batchSize = BATCH } = {}) {
  let read = 0;
  let written = 0;
  for (const [sub, kind] of [['exercises', 'exercise'], ['trainings', 'training']]) {
    let last = null;
    for (;;) {
      let q = db.collection(`clubs/${clubId}/${sub}`).orderBy('__name__').limit(pageSize);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      if (snap.empty) break;
      read += snap.size;
      last = snap.docs[snap.docs.length - 1];
      const plan = planSearchTokens(snap.docs.map((d) => ({ path: d.ref.path, kind, data: d.data() })));
      if (!dryRun) {
        for (let i = 0; i < plan.length; i += batchSize) {
          const batch = db.batch();
          for (const u of plan.slice(i, i + batchSize)) batch.update(db.doc(u.path), { searchTokens: u.searchTokens });
          await batch.commit();
        }
      }
      written += plan.length;
      if (snap.size < pageSize) break;
    }
  }
  return { read, written, skipped: read - written };
}
