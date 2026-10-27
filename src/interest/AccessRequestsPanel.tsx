import { useEffect, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  countUnreviewedInterestSignups, deleteInterestSignup, listInterestSignups, markInterestSignupReviewed,
} from './interestApi';
import { notifySignupsChanged } from './signupEvents';
import type { InterestSignup } from '../types/interestSignup';
import { formatDateValue } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';

function formatRequestDate(value: unknown): string | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return formatDateValue((value as { toDate: () => Date }).toDate(), 'numeric');
  }
  return null;
}

/**
 * Permanent list of everyone who asked for access via the public request page.
 * Reviewed requests stay listed until deleted; only the "New" markers and the
 * pending count go away once each one is reviewed. Deleting a handled request
 * honours the request page's promise that its data is not kept.
 */
export function AccessRequestsPanel({ onGrant }: { onGrant?: (email: string) => void }) {
  const ti = useT().interest;
  const t = ti.panel;
  const [signups, setSignups] = useState<InterestSignup[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [pending, setPending] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<'loadError' | 'loadMoreError' | 'updateError' | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InterestSignup | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFirstPage() {
      try {
        const [page, count] = await Promise.all([listInterestSignups(), countUnreviewedInterestSignups()]);
        setSignups(page.signups);
        setLastDoc(page.lastDoc);
        setHasMore(page.hasMore);
        setPending(count);
      } catch {
        setError('loadError');
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
      setError('loadMoreError');
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
      setError('updateError');
    } finally {
      setSavingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const signup = pendingDelete;
    setDeleteError(null);
    try {
      await deleteInterestSignup(signup.id);
    } catch {
      setDeleteError(t.deleteError);
      return;
    }
    setSignups((current) => current.filter((s) => s.id !== signup.id));
    if (!signup.reviewed) setPending((n) => Math.max(0, n - 1));
    notifySignupsChanged();
    setPendingDelete(null);
  }

  function grant(signup: InterestSignup) {
    onGrant?.(signup.email);
    void markReviewed(signup);
  }

  return (
    <section aria-labelledby="access-requests-heading"
      className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="access-requests-heading" className="text-lg font-semibold text-ink">{t.heading}</h2>
        {pending > 0 && (
          <span className="rounded-full bg-orange/10 px-2 py-0.5 text-xs font-medium text-orange-strong">
            {t.newCount(pending)}
          </span>
        )}
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-red">{t[error]}</p>}

      {loaded && signups.length === 0 && !error ? (
        <p className="text-sm text-slate">{t.empty}</p>
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
                      {ti.roles[s.role]}
                    </span>
                    {!s.reviewed && (
                      <span className="shrink-0 rounded-full bg-orange/10 px-2 py-0.5 text-xs font-medium text-orange-strong">
                        {t.newBadge}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-slate">
                    {s.email}
                    {date && <span className="tabular-nums"> · {date}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {onGrant && (
                    <Button variant="secondary" size="sm" className="flex-1 sm:flex-none"
                      disabled={savingId === s.id} onClick={() => grant(s)}>
                      {t.grantAccess}
                    </Button>
                  )}
                  {!s.reviewed && (
                    <Button variant="ghost" size="sm" className="flex-1 sm:flex-none"
                      disabled={savingId === s.id} onClick={() => void markReviewed(s)}>
                      {t.markReviewed}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="flex-1 sm:flex-none"
                    disabled={savingId === s.id} onClick={() => setPendingDelete(s)}>
                    {t.delete}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => void loadMore()}>{t.loadMore}</Button>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={t.deleteTitle(pendingDelete.name)}
          message={t.deleteMessage}
          confirmLabel={t.deleteConfirm}
          onConfirm={() => void confirmDelete()}
          onCancel={() => { setPendingDelete(null); setDeleteError(null); }}
          error={deleteError}
        />
      )}
    </section>
  );
}
