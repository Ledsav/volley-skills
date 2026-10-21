import type { Club, MemberRole } from '../types/club';

export type ClubView = 'none' | 'pending' | 'app' | 'ending' | 'exportOnly' | 'locked';

/** Same strict comparisons as the security rules: full use only while now < effectiveAt. */
export function clubView(club: Club | null, role: MemberRole | null, now: Date): ClubView {
  if (!club || club.status === 'deleted') return 'none';
  if (club.status === 'pending') return 'pending';
  if (club.status === 'active') return 'app';
  const adminView: ClubView = role === 'admin' ? 'exportOnly' : 'locked';
  if (club.status === 'suspended') return adminView;
  const t = now.getTime();
  const effective = club.termination.effectiveAt?.toMillis();
  const retrievalEnds = club.termination.retrievalEndsAt?.toMillis();
  if (effective === undefined || t < effective) return 'ending';
  if (retrievalEnds === undefined || t >= retrievalEnds) return 'locked';
  return adminView;
}
