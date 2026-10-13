import {
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type CollectionReference,
  type Query,
  type QueryConstraint,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

const PAGE_SIZE = 200;

/**
 * Reads every doc of a collection (optionally filtered by equality `where`s),
 * one bounded page at a time with a cursor, never in one unbounded read. For
 * data exports and erasure only, which must see everything; views paginate.
 * Ordering by document id needs no composite index.
 */
export async function readAll(
  col: CollectionReference,
  ...constraints: QueryConstraint[]
): Promise<QueryDocumentSnapshot[]> {
  const docs: QueryDocumentSnapshot[] = [];
  let last: QueryDocumentSnapshot | null = null;
  for (;;) {
    const page: Query = query(
      col,
      ...constraints,
      orderBy(documentId()),
      ...(last ? [startAfter(last)] : []),
      limit(PAGE_SIZE),
    );
    const snapshot: QuerySnapshot = await getDocs(page);
    docs.push(...snapshot.docs);
    if (snapshot.docs.length < PAGE_SIZE) return docs;
    last = snapshot.docs[snapshot.docs.length - 1];
  }
}
