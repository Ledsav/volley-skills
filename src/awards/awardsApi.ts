import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AwardsConfig, AwardsInput } from '../types/awards';

const strip = ({ picks, custom, order }: AwardsInput): AwardsInput => ({ picks, custom, order });

export async function getSeasonAwards(teamId: string): Promise<AwardsInput | null> {
  const snap = await getDoc(doc(db, 'teams', teamId, 'awards', 'season'));
  return snap.exists() ? strip(snap.data() as AwardsConfig) : null;
}

/** Not awaited by the UI: the persistent cache queues it offline. */
export function saveSeasonAwards(teamId: string, input: AwardsInput, uid: string): Promise<void> {
  return setDoc(doc(db, 'teams', teamId, 'awards', 'season'), { ...strip(input), updatedBy: uid, updatedAt: serverTimestamp() });
}

export function saveMatchAwards(teamId: string, matchId: string, input: AwardsInput, uid: string): Promise<void> {
  return updateDoc(doc(db, 'teams', teamId, 'matches', matchId), {
    awards: { ...strip(input), updatedBy: uid, updatedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
}
