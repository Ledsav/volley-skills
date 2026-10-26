import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

/** A fresh 20-character Firestore auto id; the rules require it for a new club. */
export function newClubId(): string {
  return doc(collection(db, 'clubs')).id;
}
