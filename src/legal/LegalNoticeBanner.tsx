import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { OPERATOR } from './operator';
import { upcoming, type VersionedDoc } from './versions';

const keyOf = (doc: VersionedDoc, version: string) => `vcb.legalNoticeDismissed.${doc}.${version}`;

function isDismissed(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** For club admins: announces upcoming Terms, DPA and sub-processor versions. Dismissible per session. */
export function LegalNoticeBanner() {
  const { role } = useAuth();
  const [dismissed, setDismissed] = useState<string[]>([]);
  if (role !== 'admin') return null;

  const now = new Date();
  const items: { key: string; node: ReactNode }[] = [];
  for (const doc of ['terms', 'dpa'] as const) {
    const v = upcoming(doc, now);
    if (!v) continue;
    items.push({
      key: keyOf(doc, v.version),
      node: (
        <>
          Updated terms take effect on {fmt(v.effectiveFrom)} —{' '}
          <Link className="text-blue underline" to={`/legal/${doc}?v=${encodeURIComponent(v.version)}`}>review</Link>
        </>
      ),
    });
  }
  const sub = upcoming('subprocessors', now);
  if (sub) {
    items.push({
      key: keyOf('subprocessors', sub.version),
      node: (
        <>
          The sub-processor list changes on {fmt(sub.effectiveFrom)}. You can object within 15 days of this notice.{' '}
          <Link className="text-blue underline" to={`/legal/subprocessors?v=${encodeURIComponent(sub.version)}`}>See the list</Link>
          {' · '}
          <a className="text-blue underline" href={`mailto:${OPERATOR.contactEmail}`}>Contact the operator</a>
        </>
      ),
    });
  }

  const visible = items.filter((i) => !dismissed.includes(i.key) && !isDismissed(i.key));
  if (visible.length === 0) return null;

  function dismiss(key: string) {
    try {
      window.sessionStorage.setItem(key, '1');
    } catch {
      /* storage blocked: hide until the next render only */
    }
    setDismissed((d) => [...d, key]);
  }

  return (
    <>
      {visible.map((i) => (
        <div key={i.key} role="status"
          className="flex items-start justify-between gap-3 border-b border-blue bg-blue/10 px-4 py-2 text-sm text-ink print:hidden">
          <span>{i.node}</span>
          <button type="button" onClick={() => dismiss(i.key)} aria-label="Dismiss" className="shrink-0 text-slate hover:text-ink">×</button>
        </div>
      ))}
    </>
  );
}
