import { Link } from 'react-router-dom';
import { useT } from '../i18n/I18nProvider';
import { OPERATOR } from './operator';

/** Footer links to the legal texts; "Report content" is promised by Terms T24. */
export function LegalLinks() {
  const t = useT().legal;
  const LINKS = [
    { to: '/legal/terms', label: t.links.terms },
    { to: '/legal/dpa', label: t.links.dpa },
    { to: '/legal/subprocessors', label: t.docTitles.subprocessors },
    { to: '/privacy', label: t.docTitles.privacy },
    { to: '/legal/dpia-pack', label: t.docTitles.dpiaPack },
  ];
  return (
    <nav aria-label={t.links.label} className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
      {LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="text-slate hover:underline">{l.label}</Link>
      ))}
      <a href={`mailto:${OPERATOR.contactEmail}`} className="text-slate hover:underline">{t.links.reportContent}</a>
    </nav>
  );
}
