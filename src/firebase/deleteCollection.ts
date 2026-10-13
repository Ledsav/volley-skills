import { getDocs, limit, query, writeBatch, type CollectionReference } from 'firebase/firestore';
import { db } from './config';

const PAGE_SIZE = 400; // under the 500-op batch limit

/**
 * Deletes every doc in a collection, a bounded page at a time, one batch per
 * page. Firestore never cascades deletes, so `beforeDelete` lets the caller
 * clear each doc's own subcollections first.
 */
export async function deleteCollection(
  col: CollectionReference,
  beforeDelete?: (docId: string) => Promise<void>,
): Promise<void> {
  for (;;) {
    const snapshot = await getDocs(query(col, limit(PAGE_SIZE)));
    if (snapshot.empty) return;
    if (beforeDelete) {
      for (const d of snapshot.docs) await beforeDelete(d.id);
    }
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snapshot.docs.length < PAGE_SIZE) return;
  }
}
