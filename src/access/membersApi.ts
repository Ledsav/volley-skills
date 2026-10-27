import { getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { clubCol, clubDoc, getActiveClubId } from '../firebase/clubPaths';
import { readAll } from '../firebase/readAll';
import type { Member, MemberRole } from '../types/club';
import { addGrantOps, emptyGrantSet, listGrantHolders } from './accessApi';

export async function listMembers(): Promise<Member[]> {
  const docs = await readAll(clubCol('members'));
  return docs
    .map((d) => d.data() as Member)
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function addMember(rawEmail: string, role: MemberRole, addedBy: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const ref = clubDoc('members', email);
  if ((await getDoc(ref)).exists()) throw new Error('already-member');
  await setDoc(ref, {
    email, clubId: getActiveClubId(), role,
    addedBy: addedBy.trim().toLowerCase(), addedAt: serverTimestamp(),
  });
}

export async function setMemberRole(rawEmail: string, role: MemberRole): Promise<void> {
  await updateDoc(clubDoc('members', rawEmail.trim().toLowerCase()), { role });
}

export async function removeFromClub(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const holder = (await listGrantHolders()).find((h) => h.email === email);
  const batch = writeBatch(db);
  if (holder) addGrantOps(batch, email, emptyGrantSet(), holder.grants);
  batch.delete(clubDoc('members', email));
  await batch.commit();
}

/** Why a role change or removal is blocked; the UI maps the code to text. */
export type RoleBlockReason = 'owner' | 'lastAdmin' | 'demoteFirst';

export function canChangeRole(
  target: Member, members: Member[], ownerEmail: string,
): { demote: boolean; remove: boolean; reason: RoleBlockReason | null } {
  if (target.email.toLowerCase() === ownerEmail.toLowerCase()) {
    return { demote: false, remove: false, reason: 'owner' };
  }
  if (target.role === 'member') return { demote: false, remove: true, reason: null };
  if (members.filter((x) => x.role === 'admin').length <= 1) {
    return { demote: false, remove: false, reason: 'lastAdmin' };
  }
  return { demote: true, remove: false, reason: 'demoteFirst' };
}
