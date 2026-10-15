import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, X } from 'lucide-react';

/**
 * The one way to confirm that something worked ("Imported 12 players.").
 * Errors stay inline next to what failed (`role="alert"`); this is only for
 * success, so it is polite, auto-dismisses, and never blocks the page.
 */
type Notify = (message: string, opts?: { durationMs?: number }) => void;

const NoticeContext = createContext<Notify>(() => {});

export function useNotify(): Notify {
  return useContext(NoticeContext);
}

const DEFAULT_MS = 4000;

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<number>();
  const nextId = useRef(0);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setNotice(null);
  }, []);

  const notify = useCallback<Notify>((message, opts) => {
    window.clearTimeout(timer.current);
    setNotice({ id: ++nextId.current, message });
    timer.current = window.setTimeout(() => setNotice(null), opts?.durationMs ?? DEFAULT_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <NoticeContext.Provider value={notify}>
      {children}
      {/* Live region always mounted so screen readers announce each new message. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6 print:hidden"
      >
        {notice && (
          <div
            key={notice.id}
            className="pointer-events-auto flex max-w-md items-start gap-3 rounded-md bg-ink px-4 py-3 text-sm text-surface shadow-pop"
          >
            <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" className="mt-px shrink-0 text-green" />
            <p className="flex-1">{notice.message}</p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="-m-1 shrink-0 rounded-sm p-1 opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </NoticeContext.Provider>
  );
}
