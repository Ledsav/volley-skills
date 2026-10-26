import { collection, doc, type CollectionReference, type DocumentReference } from 'firebase/firestore';
import { db } from './config';
import { getActiveClubId } from './activeClub';

export { getActiveClubId, setActiveClubId } from './activeClub';

/** A collection under `clubs/{activeClubId}/...`. */
export function clubCol(...segments: string[]): CollectionReference {
  return collection(db, 'clubs', getActiveClubId(), ...segments);
}

/** A document under `clubs/{activeClubId}/...`; with no segments, the club doc itself. */
export function clubDoc(...segments: string[]): DocumentReference {
  return doc(db, 'clubs', getActiveClubId(), ...segments);
}
