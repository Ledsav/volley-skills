import { Link } from 'react-router-dom';
import { OPERATOR } from './operator';

const LINKS = [
  { to: '/legal/terms', label: 'Terms' },
  { to: '/legal/dpa', label: 'DPA' },
  { to: '/legal/subprocessors', label: 'Sub-processors' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/legal/dpia-pack', label: 'DPIA pack' },
] as const;

/** Footer links to the legal texts; "Report content" is promised by Terms T24. */
export function LegalLinks() {
  return (
    <nav aria-label="Legal" className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
      {LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="text-slate hover:underline">{l.label}</Link>
      ))}
      <a href={`mailto:${OPERATOR.contactEmail}`} className="text-slate hover:underline">Report content</a>
    </nav>
  );
}
