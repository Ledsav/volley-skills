import { useEffect, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import {
  countUnreviewedInterestSignups, listInterestSignups, markInterestSignupReviewed,
} from './interestApi';
import { notifySignupsChanged } from './signupEvents';
import type { InterestSignup, InterestSignupRole } from '../types/interestSignup';

const ROLE_LABEL: Record<InterestSignupRole, string> = {
  coach: 'Coach', guardian: 'Guardian', player: 'Player', other: 'Other',
};

function formatRequestDate(value: unknown): string | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  return null;
}

/**
 * Permanent list of everyone who asked for access via the public request page.
 * Reviewed requests stay listed; only the "New" markers and the pending count
 * go away once each one is reviewed.
 */
export function AccessRequestsPanel({ onGrant }: { onGrant: (email: string) => void }) {
  const [signups, setSignups] = useState<InterestSignup[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [pending, setPending] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadFirstPage() {
      try {
        const [page, count] = await Promise.all([listInterestSignups(), countUnreviewedInterestSignups()]);
        setSignups(page.signups);
        setLastDoc(page.lastDoc);
        setHasMore(page.hasMore);
        setPending(count);
      } catch {
        setError('Could not load access requests. Please refresh the page.');
      } finally {
        setLoaded(true);
      }
    }
    void loadFirstPage();
  }, []);

  async function loadMore() {
    if (!lastDoc) return;
    try {
      const page = await listInterestSignups(lastDoc);
      setSignups((current) => [...current, ...page.signups]);
      setLastDoc(page.lastDoc);
      setHasMore(page.hasMore);
    } catch {
      setError('Could not load more requests. Please try again.');
    }
  }

  async function markReviewed(signup: InterestSignup) {
    if (signup.reviewed) return;
    setSavingId(signup.id);
    setError(null);
    try {
      await markInterestSignupReviewed(signup.id);
      setSignups((current) => current.map((s) => (s.id === signup.id ? { ...s, reviewed: true } : s)));
      setPending((n) => Math.max(0, n - 1));
      notifySignupsChanged();
    } catch {
      setError('Could not update this request. Please try again.');
    } finally {
      setSavingId(null);
    }
  }

  function grant(signup: InterestSignup) {
    onGrant(signup.email);
    void markReviewed(signup);
  }

  return (
    <section aria-labelledby="access-requests-heading"
      className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="access-requests-heading" className="text-lg font-semibold text-ink">Access requests</h2>
        {pending > 0 && (
          <span className="rounded-full bg-orange/10 px-2 py-0.5 text-xs font-medium text-orange">
            {pending} new
          </span>
        )}
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-red">{error}</p>}

      {loaded && signups.length === 0 && !error ? (
        <p className="text-sm text-slate">No one has requested access yet.</p>
      ) : (
        <ul className="max-h-96 divide-y divide-border overflow-y-auto">
          {signups.map((s) => {
            const date = formatRequestDate(s.createdAt);
            return (
              <li key={s.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`truncate ${s.reviewed ? 'text-ink' : 'font-semibold text-ink'}`}>{s.name}</span>
                    <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-slate">
                      {ROLE_LABEL[s.role]}
                    </span>
                    {!s.reviewed && (
                      <span className="shrink-0 rounded-full bg-orange/10 px-2 py-0.5 text-xs font-medium text-orange">
                        New
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-slate">
                    {s.email}
                    {date && <span className="tabular-nums"> · {date}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" className="flex-1 sm:flex-none"
                    disabled={savingId === s.id} onClick={() => grant(s)}>
                    Grant access
                  </Button>
                  {!s.reviewed && (
                    <Button variant="ghost" size="sm" className="flex-1 sm:flex-none"
                      disabled={savingId === s.id} onClick={() => void markReviewed(s)}>
                      Mark reviewed
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => void loadMore()}>Load more</Button>
        </div>
      )}
    </section>
  );
}
