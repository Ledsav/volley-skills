import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { MoreHorizontal } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { FIELD_CLASS } from '../components/Input';
import { SkeletonBlock } from '../components/Skeleton';
import { Menu } from '../components/Menu';
import type { Club, ClubStatus } from '../types/club';
import { ClubActionDialog } from './ClubActionDialog';
import { clubActions, type ClubAction } from './clubActions';
import { listClubs } from './platformApi';
import { formatDateValue } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';

const STATUSES: ClubStatus[] = ['pending', 'active', 'suspended', 'terminating', 'deleted'];

function day(value: unknown): string {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return formatDateValue((value as { toDate: () => Date }).toDate(), 'numeric');
  }
  return '—';
}

/** "terms-2026-10-22_dpa-…" → "2026-10-22"; any other key is shown as stored. */
function termsVersion(versionKey: string): string {
  return /^terms-(\d{4}-\d{2}-\d{2})_/.exec(versionKey)?.[1] ?? versionKey;
}

const STATUS_PILL: Record<ClubStatus, string> = {
  pending: 'bg-surface-3 text-ink',
  active: 'bg-green-tint text-green-strong',
  suspended: 'bg-orange-tint text-orange-strong',
  terminating: 'bg-orange-tint text-orange-strong',
  deleted: 'bg-surface-3 text-ink-2',
};

const TH = 'px-3 py-2 text-left text-caption text-ink-2';
const TD = 'px-3 py-2 align-top text-callout text-ink';
const SUB = 'mt-0.5 text-footnote text-ink-2 tabular-nums';

/** Club-doc fields only: the operator never sees club data, so no row links anywhere. */
export function ClubsTable() {
  const { appUser } = useAuth();
  const t = useT();
  const p = t.platform.table;
  const operatorEmail = (appUser?.email ?? '').toLowerCase();
  const [status, setStatus] = useState<ClubStatus | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<'loadMoreFailed' | 'loadFailed' | null>(null);
  const [active, setActive] = useState<{ club: Club; action: ClubAction } | null>(null);
  const request = useRef(0);

  const load = useCallback(async (filter: ClubStatus | null, after: QueryDocumentSnapshot | null) => {
    const mine = ++request.current;
    setError(null);
    try {
      const page = await listClubs({ status: filter, after });
      if (mine !== request.current) return;
      setClubs((current) => (after ? [...current, ...page.clubs] : page.clubs));
      setLastDoc(page.lastDoc);
      setHasMore(page.hasMore);
    } catch {
      if (mine !== request.current) return;
      setError(after ? 'loadMoreFailed' : 'loadFailed');
    } finally {
      if (mine === request.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    setLoaded(false);
    setClubs([]);
    void load(status, null);
  }, [status, load]);

  function merge(id: string, patch: Partial<Club>) {
    setClubs((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="club-status-filter" className="text-footnote text-ink-2">{p.status}</label>
        <select id="club-status-filter" className={`${FIELD_CLASS} min-h-11 cursor-pointer`}
          value={status ?? ''} onChange={(e) => setStatus((e.target.value || null) as ClubStatus | null)}>
          <option value="">{p.all}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t.clubs.status[s]}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="mb-3 text-footnote text-red-strong">{p[error]}</p>}

      {/* pb-24: room for the row menu to open below the last row inside the scroller. */}
      <div className="overflow-x-auto rounded-lg bg-surface pb-24 shadow-card">
        <table className="w-full border-collapse">
          <thead className="border-b border-separator">
            <tr>
              {([p.columns.club, p.columns.owner, p.columns.status, p.columns.terms, p.columns.actions])
                .map((h) => <th key={h} scope="col" className={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-separator">
            {!loaded && clubs.length === 0 && [0, 1, 2].map((i) => (
              <tr key={`sk-${i}`} aria-hidden="true">
                {[0, 1, 2, 3, 4].map((c) => (
                  <td key={c} className="px-3 py-3"><SkeletonBlock className="h-4 w-24 max-w-full" /></td>
                ))}
              </tr>
            ))}
            {clubs.map((club) => {
              const actions = clubActions(club);
              const primary = actions.filter((a) => !a.secondary);
              const secondary = actions.filter((a) => a.secondary);
              return (
                <tr key={club.id}>
                  <th scope="row" className={`${TD} text-left font-medium`}>
                    {club.name}
                    <p className={`${SUB} font-normal`}>{p.created(club.country, day(club.createdAt))}</p>
                  </th>
                  <td className={`${TD} break-all`}>{club.ownerEmail}</td>
                  <td className={TD}>
                    <span className={`inline-block rounded-full px-2 text-caption ${STATUS_PILL[club.status]}`}>
                      {t.clubs.status[club.status]}
                    </span>
                    {club.status === 'terminating' && (
                      <p className={SUB}>{p.endsAndExport(day(club.termination?.effectiveAt), day(club.termination?.retrievalEndsAt))}</p>
                    )}
                  </td>
                  <td className={`${TD} tabular-nums`}>
                    {club.legal ? p.termsAccepted(termsVersion(club.legal.versionKey)) : <span className="text-ink-2">{p.notAccepted}</span>}
                  </td>
                  <td className="px-3 py-1 align-top">
                    <div className="flex flex-wrap items-center gap-1">
                      {primary.map((a) => (
                        <Button key={a.kind} variant="ghost" size="sm" onClick={() => setActive({ club, action: a })}>
                          {a.label}
                        </Button>
                      ))}
                      {secondary.length > 0 && (
                        <Menu label={p.moreActionsFor(club.name)}
                          triggerClassName="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2"
                          trigger={<MoreHorizontal size={18} aria-hidden="true" />}
                          items={secondary.map((a) => ({
                            kind: 'action' as const, label: a.label, onSelect: () => setActive({ club, action: a }),
                          }))} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loaded && clubs.length === 0 && <p role="status" className="sr-only">{p.loading}</p>}
        {loaded && clubs.length === 0 && !error && (
          <p className="p-4 text-callout text-ink-2">{p.noClubs(status !== null)}</p>
        )}
      </div>

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => void load(status, lastDoc)}>{p.loadMore}</Button>
        </div>
      )}

      {active && (
        <ClubActionDialog club={active.club} action={active.action} operatorEmail={operatorEmail}
          onClose={() => setActive(null)} onChanged={(patch) => merge(active.club.id, patch)} />
      )}
    </div>
  );
}
