import { useAuth } from '../auth/AuthContext';

const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/** Shown above the app while the club's contract is running out. */
export function ContractEndingBanner() {
  const { club, role } = useAuth();
  const effective = club?.termination.effectiveAt?.toDate();
  if (club?.status !== 'terminating' || !effective) return null;
  const retrieval = club.termination.retrievalEndsAt?.toDate();
  const text =
    role === 'admin' && retrieval
      ? `Your contract ends on ${fmt(effective)}. Export your data before ${fmt(retrieval)}.`
      : `Your club's contract ends on ${fmt(effective)}.`;
  return (
    <div role="status" className="border-b border-orange bg-orange/10 px-4 py-2 text-sm text-ink print:hidden">
      {text}
    </div>
  );
}
