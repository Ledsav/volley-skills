import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { MoreHorizontal } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { FIELD_CLASS } from '../components/Input';
import { Menu } from '../components/Menu';
import { CLUB_STATUS_LABEL } from '../clubs/statusLabels';
import type { Club, ClubStatus } from '../types/club';
import { ClubActionDialog } from './ClubActionDialog';
import { clubActions, type ClubAction } from './clubActions';
import { listClubs } from './platformApi';

const STATUSES = Object.keys(CLUB_STATUS_LABEL) as ClubStatus[];

function day(value: unknown): string {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  return '—';
}

const TH = 'whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate';
const TD = 'whitespace-nowrap px-3 py-2 text-sm text-ink tabular-nums';

/** Club-doc fields only: the operator never sees club data, so no row links anywhere. */
export function ClubsTable() {
  const { appUser } = useAuth();
  const operatorEmail = (appUser?.email ?? '').toLowerCase();
  const [status, setStatus] = useState<ClubStatus | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError(after ? 'Could not load more clubs. Please try again.' : 'Could not load clubs. Please refresh the page.');
    } finally {
      if (mine === request.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    setLoaded(false);
    void load(status, null);
  }, [status, load]);

  function merge(id: string, patch: Partial<Club>) {
    setClubs((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="club-status-filter" className="text-sm font-medium text-ink">Status</label>
        <select id="club-status-filter" className={`${FIELD_CLASS} min-h-11 cursor-pointer`}
          value={status ?? ''} onChange={(e) => setStatus((e.target.value || null) as ClubStatus | null)}>
          <option value="">All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{CLUB_STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-red">{error}</p>}

      {/* pb-24: room for the row menu to open below the last row inside the scroller. */}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface pb-24 shadow-card">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-border">
            <tr>
              {['Club', 'Country', 'Owner', 'Status', 'Created', 'Legal version', 'Ends', 'Export until', 'Actions']
                .map((h) => <th key={h} scope="col" className={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clubs.map((club) => {
              const actions = clubActions(club);
              const primary = actions.filter((a) => !a.secondary);
              const secondary = actions.filter((a) => a.secondary);
              return (
                <tr key={club.id}>
                  <th scope="row" className={`${TD} text-left font-medium`}>{club.name}</th>
                  <td className={TD}>{club.country}</td>
                  <td className={TD}>{club.ownerEmail}</td>
                  <td className={TD}>{CLUB_STATUS_LABEL[club.status]}</td>
                  <td className={TD}>{day(club.createdAt)}</td>
                  <td className={TD}>{club.legal?.versionKey ?? '—'}</td>
                  <td className={TD}>{day(club.termination?.effectiveAt)}</td>
                  <td className={TD}>{day(club.termination?.retrievalEndsAt)}</td>
                  <td className="px-3 py-1">
                    <div className="flex items-center gap-1">
                      {primary.map((a) => (
                        <Button key={a.kind} variant="ghost" size="sm" onClick={() => setActive({ club, action: a })}>
                          {a.label}
                        </Button>
                      ))}
                      {secondary.length > 0 && (
                        <Menu label={`More actions for ${club.name}`}
                          triggerClassName="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate hover:bg-bg"
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
        {loaded && clubs.length === 0 && !error && (
          <p className="p-4 text-sm text-slate">No clubs{status ? ' with this status' : ' yet'}.</p>
        )}
      </div>

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => void load(status, lastDoc)}>Load more</Button>
        </div>
      )}

      {active && (
        <ClubActionDialog club={active.club} action={active.action} operatorEmail={operatorEmail}
          onClose={() => setActive(null)} onChanged={(patch) => merge(active.club.id, patch)} />
      )}
    </div>
  );
}
