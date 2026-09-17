import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { listInterestSignups, markInterestSignupReviewed } from './interestApi';
import type { InterestSignup, InterestSignupRole } from '../types/interestSignup';

const ROLE_LABEL: Record<InterestSignupRole, string> = {
  coach: 'Coach', guardian: 'Guardian', player: 'Player', other: 'Other',
};

export function InterestSignupsPage() {
  const [signups, setSignups] = useState<InterestSignup[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadFirstPage() {
    setError(null);
    try {
      const page = await listInterestSignups();
      setSignups(page.signups);
      setLastDoc(page.lastDoc);
      setHasMore(page.hasMore);
    } catch {
      setError('Could not load signups. Please refresh the page.');
    }
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listInterestSignups(lastDoc);
    setSignups((current) => [...current, ...page.signups]);
    setLastDoc(page.lastDoc);
    setHasMore(page.hasMore);
  }

  useEffect(() => {
    void loadFirstPage();
  }, []);

  async function markReviewed(id: string) {
    setSavingId(id);
    try {
      await markInterestSignupReviewed(id);
      setSignups((current) => current.map((s) => (s.id === id ? { ...s, reviewed: true } : s)));
    } catch {
      setError('Could not update this signup. Please try again.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Interest signups</h1>
        <Link to="/admin/access" className="text-sm text-blue hover:underline">
          Back to Access
        </Link>
      </div>

      {error && <p role="alert" className="mb-4 text-red">{error}</p>}

      {signups.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-slate shadow-card">
          No one has requested access yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <ul className="divide-y divide-border">
            {signups.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">{s.name}</span>
                    <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-slate">
                      {ROLE_LABEL[s.role]}
                    </span>
                    {!s.reviewed && (
                      <span className="shrink-0 rounded-full bg-orange/10 px-2 py-0.5 text-xs font-medium text-orange">
                        New
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-slate">{s.email}</p>
                </div>
                {!s.reviewed && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={savingId === s.id}
                    onClick={() => void markReviewed(s.id)}
                  >
                    Mark reviewed
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => void loadMore()}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
