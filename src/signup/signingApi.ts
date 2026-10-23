import type { User } from 'firebase/auth';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { currentAuthTime, signingWindowOpen } from '../auth/reauth';
import { storeClub } from '../clubs/activeClub';
import { buildAcceptance } from '../legal/acceptance';
import { clearSignDraft, readSignDraft } from '../legal/signDraft';
import { versionKey } from '../legal/versions';
import { acceptanceDoc, legalUpdate, signupClubDoc, signupMemberDoc } from './signupDocs';

export type CommitOutcome = 'done' | 'alreadyDone' | 'linkExpired' | 'noDraft' | 'wrongAccount';

/**
 * Commits the saved signing draft (a new club or a re-acceptance) in one batch.
 * Rules require a fresh email-link sign-in; the client checks the window first.
 */
export async function commitSignDraft(user: User, now: number = Date.now()): Promise<CommitOutcome> {
  const draft = readSignDraft(now);
  if (!draft) return 'noDraft';
  const email = draft.email.trim().toLowerCase();
  if ((user.email ?? '').trim().toLowerCase() !== email) return 'wrongAccount';

  const authTime = await currentAuthTime(user);
  if (!signingWindowOpen(authTime, now)) return 'linkExpired';

  const acceptance = await buildAcceptance({
    termsVersion: draft.termsVersion,
    dpaVersion: draft.dpaVersion,
    subprocessorsVersion: draft.subprocessorsVersion,
    language: draft.language,
    email,
    personName: draft.personName,
    authTime,
    userAgent: navigator.userAgent,
  });
  const key = versionKey(draft.termsVersion, draft.dpaVersion);
  const acceptanceRef = doc(db, 'clubs', draft.clubId, 'acceptances', key);

  const batch = writeBatch(db);
  if (draft.kind === 'signup') {
    batch.set(doc(db, 'clubs', draft.clubId), signupClubDoc(draft.club, email, key));
    batch.set(doc(db, 'clubs', draft.clubId, 'members', email), signupMemberDoc(draft.clubId, email));
    batch.set(acceptanceRef, acceptanceDoc(acceptance));
  } else {
    batch.set(acceptanceRef, acceptanceDoc(acceptance));
    batch.update(doc(db, 'clubs', draft.clubId), legalUpdate(key, email));
  }

  const finish = (outcome: 'done' | 'alreadyDone'): CommitOutcome => {
    clearSignDraft();
    if (draft.kind === 'signup') storeClub(draft.clubId);
    return outcome;
  };

  try {
    await batch.commit();
  } catch (e) {
    if ((e as { code?: string }).code !== 'permission-denied') throw e;
    // A retry is refused (club or acceptance exists); if our acceptance is there, it already worked.
    let ours = false;
    try {
      const snap = await getDoc(acceptanceRef);
      ours = snap.exists() && (snap.data() as { acceptedBy?: string } | undefined)?.acceptedBy === email;
    } catch {
      /* the check itself failed (denied, offline): report the original error below */
    }
    // For a sign-up, make sure the new club is the active one when the earlier attempt already created it.
    if (ours) return finish('alreadyDone');
    throw e;
  }
  return finish('done');
}
