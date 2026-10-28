import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { useT } from '../i18n/I18nProvider';
import { useReducedMotion } from '../motion/useReducedMotion';

/**
 * The one way to confirm that something worked ("Imported 12 players.").
 * Errors stay inline next to what failed (`role="alert"`); this is only for
 * success, so it is polite, auto-dismisses, and never blocks the page.
 *
 * `useUndoable` is the same region with an Undo button: the destructive write is deferred and runs when the
 * notice expires, is replaced by another undoable, the route changes or the page hides.
 */
type Notify = (message: string, opts?: { durationMs?: number }) => void;

export interface UndoableOptions {
  message: string;
  /** The real write, run once. */
  commit: () => void | Promise<void>;
  /** Restore UI state. */
  onUndo?: () => void;
  onCommitError?: (error: unknown) => void;
}

export const UNDO_MS = 6000;

const NoticeContext = createContext<Notify>(() => {});
const UndoableContext = createContext<(o: UndoableOptions) => void>(() => {});

export function useNotify(): Notify {
  return useContext(NoticeContext);
}

export function useUndoable(): (o: UndoableOptions) => void {
  return useContext(UndoableContext);
}

const DEFAULT_MS = 4000;

interface Shown {
  id: number;
  message: string;
  undo: boolean;
}

interface Queued {
  message: string;
  durationMs: number;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('[data-own-undo]')) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (target instanceof HTMLElement && target.isContentEditable);
}

/** Commits the pending undoable when the pathname changes. Only mounted inside a router. */
function RouteCommit({ onChange }: { onChange: () => void }) {
  const { pathname } = useLocation();
  const prev = useRef(pathname);
  useEffect(() => {
    if (prev.current !== pathname) {
      prev.current = pathname;
      onChange();
    }
  }, [pathname, onChange]);
  return null;
}

export function NoticeProvider({ children }: { children: ReactNode }) {
  const t = useT().components;
  const inRouter = useInRouterContext();
  const reduced = useReducedMotion();
  const [notice, setNotice] = useState<Shown | null>(null);
  const timer = useRef<number>();
  const nextId = useRef(0);
  const pending = useRef<UndoableOptions | null>(null);
  const queue = useRef<Queued[]>([]);
  const pillRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<() => void>(() => {});

  const showPlain = useCallback((message: string, durationMs: number) => {
    window.clearTimeout(timer.current);
    setNotice({ id: ++nextId.current, message, undo: false });
    timer.current = window.setTimeout(() => closeRef.current(), durationMs);
  }, []);

  /** Closes the current notice and shows the next queued plain one, if any. */
  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    const next = queue.current.shift();
    if (next) showPlain(next.message, next.durationMs);
    else setNotice(null);
  }, [showPlain]);
  closeRef.current = close;

  /** Runs the pending commit once. Returns whether there was one. */
  const runPending = useCallback((): boolean => {
    const p = pending.current;
    if (!p) return false;
    pending.current = null;
    window.clearTimeout(timer.current);
    const fail = (e: unknown) => {
      if (p.onCommitError) p.onCommitError(e);
      else console.error(e);
    };
    try {
      void Promise.resolve(p.commit()).catch(fail);
    } catch (e) {
      fail(e);
    }
    return true;
  }, []);

  const commitAndClose = useCallback(() => {
    if (runPending()) closeRef.current();
  }, [runPending]);

  const startUndoTimer = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(commitAndClose, UNDO_MS);
  }, [commitAndClose]);

  const notify = useCallback<Notify>(
    (message, opts) => {
      const durationMs = opts?.durationMs ?? DEFAULT_MS;
      if (pending.current) queue.current.push({ message, durationMs });
      else showPlain(message, durationMs);
    },
    [showPlain],
  );

  const undoable = useCallback(
    (o: UndoableOptions) => {
      runPending(); // a second undoable commits the first at once
      pending.current = o;
      setNotice({ id: ++nextId.current, message: o.message, undo: true });
      startUndoTimer();
    },
    [runPending, startUndoTimer],
  );

  const undo = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    window.clearTimeout(timer.current);
    p.onUndo?.();
    closeRef.current();
  }, []);

  // pagehide commits; unmounting the provider commits.
  useEffect(() => {
    const onHide = () => commitAndClose();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      runPending();
      window.clearTimeout(timer.current);
    };
  }, [runPending, commitAndClose]);

  // Ctrl+Z / Cmd+Z while the undo notice is showing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!pending.current) return;
      if (e.key.toLowerCase() !== 'z' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.defaultPrevented || isEditable(e.target)) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  // The undo pill rises 12px and fades in over 200ms; reduced motion fades only.
  const pillId = notice?.undo ? notice.id : null;
  useLayoutEffect(() => {
    const el = pillRef.current;
    if (pillId === null || !el || typeof el.animate !== 'function') return;
    el.animate(
      reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: 'translateY(12px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
      { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }, [pillId, reduced]);

  const holds = useRef({ pointer: false, focus: false });
  const hold = (kind: 'pointer' | 'focus', on: boolean) => {
    holds.current[kind] = on;
    if (!pending.current) return;
    if (holds.current.pointer || holds.current.focus) window.clearTimeout(timer.current);
    else startUndoTimer();
  };

  return (
    <NoticeContext.Provider value={notify}>
      <UndoableContext.Provider value={undoable}>
        {children}
        {inRouter && <RouteCommit onChange={commitAndClose} />}
        {/* Live region always mounted so screen readers announce each new message. */}
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6 print:hidden"
        >
          {notice && !notice.undo && (
            <div
              key={notice.id}
              className="pointer-events-auto flex max-w-md items-start gap-3 rounded-md bg-ink px-4 py-3 text-sm text-surface shadow-pop"
            >
              <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" className="mt-px shrink-0 text-green" />
              <p className="flex-1">{notice.message}</p>
              <button
                type="button"
                onClick={close}
                aria-label={t.dismiss}
                className="-m-1 shrink-0 rounded-sm p-1 opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          )}
          {notice?.undo && (
            <div
              key={notice.id}
              ref={pillRef}
              onPointerEnter={() => hold('pointer', true)}
              onPointerLeave={() => hold('pointer', false)}
              onFocus={() => hold('focus', true)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hold('focus', false);
              }}
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-ink py-1.5 pl-4 pr-1.5 text-callout text-on-ink shadow-pop"
            >
              <p className="flex-1">{notice.message}</p>
              <button
                type="button"
                onClick={undo}
                className="inline-flex min-h-11 items-center rounded-full bg-on-ink/15 px-4 font-semibold hover:bg-on-ink/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {t.undo}
              </button>
            </div>
          )}
        </div>
      </UndoableContext.Provider>
    </NoticeContext.Provider>
  );
}
