import { useEffect, useRef, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '../components/Button';
import { useContextMenu } from '../components/ContextMenu';
import { Menu, type MenuItem } from '../components/Menu';
import { useUndoable } from '../components/Notice';
import { SwipeRow } from '../components/SwipeRow';
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

const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

function RequestRow({
  signup,
  saving,
  onMarkReviewed,
  onDelete,
}: {
  signup: InterestSignup;
  saving: boolean;
  onMarkReviewed: () => void;
  onDelete: () => void;
}) {
  const ti = useT().interest;
  const t = ti.panel;
  const date = formatRequestDate(signup.createdAt);
  const items: MenuItem[] = [
    ...(signup.reviewed
      ? []
      : [{ kind: 'action', label: t.markReviewed, disabled: saving, onSelect: onMarkReviewed } as MenuItem]),
    { kind: 'action', label: t.delete, danger: true, onSelect: onDelete },
  ];
  const label = t.rowMenu(signup.name);
  const { targetProps, menu } = useContextMenu({ label, items });

  return (
    <li className="relative before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden">
      <SwipeRow trailing={[{ label: t.delete, tone: 'destructive', undoable: true, onAction: onDelete }]}>
        <>
          <div {...targetProps} className="flex min-h-[60px] items-center gap-3 px-4 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`truncate text-headline text-ink ${signup.reviewed ? '' : 'font-bold'}`}>{signup.name}</span>
                <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-caption text-ink-2">
                  {ti.roles[signup.role]}
                </span>
                {!signup.reviewed && (
                  <span className="shrink-0 rounded-full bg-orange-tint px-2 py-0.5 text-caption text-orange-strong">
                    {t.newBadge}
                  </span>
                )}
              </div>
              <p className="truncate text-footnote text-ink-2">
                {signup.email}
                {date && <span className="tabular-nums"> · {date}</span>}
              </p>
            </div>
            {!signup.reviewed && (
              <Button variant="secondary" size="sm" className="shrink-0" disabled={saving} onClick={onMarkReviewed}>
                {t.markReviewed}
              </Button>
            )}
            <span onClick={stop} onKeyDown={stop} className="-mr-2 shrink-0">
              <Menu
                label={label}
                trigger={<MoreHorizontal size={20} aria-hidden="true" />}
                triggerClassName="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3"
                items={items}
              />
            </span>
          </div>
          {menu}
        </>
      </SwipeRow>
    </li>
  );
}

/**
 * Permanent list of everyone who asked for access via the public request page.
 * Reviewed requests stay listed until deleted; only the "New" markers and the
 * pending count go away once each one is reviewed. Deleting a handled request
 * honours the request page's promise that its data is not kept. Delete is an undo:
 * the row leaves at once and the write happens when the notice expires.
 */
export function AccessRequestsPanel() {
  const ti = useT().interest;
  const t = ti.panel;
  const undoable = useUndoable();
  const [signups, setSignups] = useState<InterestSignup[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [pending, setPending] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<'loadError' | 'loadMoreError' | 'updateError' | 'deleteError' | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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

  const hide = (id: string) => setHidden((cur) => new Set(cur).add(id));
  const unhide = (id: string) =>
    setHidden((cur) => {
      const next = new Set(cur);
      next.delete(id);
      return next;
    });

  function requestDelete(signup: InterestSignup) {
    setError(null);
    hide(signup.id);
    undoable({
      message: t.deleted(signup.name),
      commit: async () => {
        await deleteInterestSignup(signup.id);
        if (!mounted.current) return;
        setSignups((current) => current.filter((s) => s.id !== signup.id));
        unhide(signup.id);
        if (!signup.reviewed) setPending((n) => Math.max(0, n - 1));
        notifySignupsChanged();
      },
      onUndo: () => unhide(signup.id),
      onCommitError: () => {
        if (mounted.current) {
          unhide(signup.id);
          setError('deleteError');
        }
      },
    });
  }

  const visible = signups.filter((s) => !hidden.has(s.id));
  const shownNew = pending - signups.filter((s) => hidden.has(s.id) && !s.reviewed).length;

  return (
    <section aria-labelledby="access-requests-heading" className="mb-6">
      <div className="mb-3 flex items-center gap-2 px-4">
        <h2 id="access-requests-heading" className="text-title-3 text-ink">{t.heading}</h2>
        {shownNew > 0 && (
          <span className="rounded-full bg-orange-tint px-2 py-0.5 text-caption tabular-nums text-orange-strong">
            {t.newCount(shownNew)}
          </span>
        )}
      </div>

      {error && <p role="alert" className="mb-3 px-4 text-footnote text-red-strong">{t[error]}</p>}

      {loaded && visible.length === 0 && !error ? (
        <p className="px-4 text-footnote text-ink-2">{t.empty}</p>
      ) : (
        <ul className="overflow-hidden rounded-lg bg-surface shadow-card">
          {visible.map((s) => (
            <RequestRow
              key={s.id}
              signup={s}
              saving={savingId === s.id}
              onMarkReviewed={() => void markReviewed(s)}
              onDelete={() => requestDelete(s)}
            />
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => void loadMore()}>{t.loadMore}</Button>
        </div>
      )}
    </section>
  );
}
