import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { PendingActionId } from './types';

/** Router navigation options that tell the destination page to open its create form. */
export function withPendingAction(id: PendingActionId): { state: { pendingAction: PendingActionId } } {
  return { state: { pendingAction: id } };
}

/**
 * Runs `run` once when the page was reached with this pending action, then clears the
 * location state so a reload or Back does not reopen the dialog.
 */
export function useTakePendingAction(id: PendingActionId, run: () => void): void {
  const location = useLocation();
  const navigate = useNavigate();
  const runRef = useRef(run);
  runRef.current = run;
  const taken = useRef<string | null>(null);
  const pending = (location.state as { pendingAction?: PendingActionId } | null)?.pendingAction;
  useEffect(() => {
    if (pending !== id || taken.current === location.key) return;
    taken.current = location.key;
    runRef.current();
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [pending, id, location.key, location.pathname, location.search, navigate]);
}
