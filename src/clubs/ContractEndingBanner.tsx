import { useAuth } from '../auth/AuthContext';
import { formatDateValue } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';

const fmt = (d: Date) => formatDateValue(d, 'long');

/** Shown above the app while the club's contract is running out. */
export function ContractEndingBanner() {
  const { club, role } = useAuth();
  const t = useT().clubs.endingBanner;
  const effective = club?.termination.effectiveAt?.toDate();
  if (club?.status !== 'terminating' || !effective) return null;
  const retrieval = club.termination.retrievalEndsAt?.toDate();
  const text =
    role === 'admin' && retrieval
      ? t.adminWithExport(fmt(effective), fmt(retrieval))
      : t.member(fmt(effective));
  return (
    <div role="status" className="border-b border-separator bg-orange-tint px-4 py-2.5 text-footnote text-ink print:hidden">
      {text}
    </div>
  );
}
