import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNotify } from '../components/Notice';
import { useT } from '../i18n/I18nProvider';
import type { PhysicalTestType } from '../types/physicalTest';

export type SyncKey =
  | 'skills'
  | 'plan'
  | 'contact'
  | 'guardians'
  | 'consent'
  | 'photo'
  | 'leftClub'
  | `test:${PhysicalTestType}`;

export interface PlayerSync {
  /** Tells the coach the save is on this device, and keeps `key` pending until `written` settles. */
  queued(key: SyncKey, written: Promise<unknown>): void;
  isPending(key: SyncKey): boolean;
  /** A queued write was rejected after the form had closed. */
  syncFailed: boolean;
}

const INERT: PlayerSync = { queued: () => undefined, isPending: () => false, syncFailed: false };

const PlayerSyncContext = createContext<PlayerSync>(INERT);

export function PlayerSyncProvider({ children }: { children: ReactNode }) {
  const notify = useNotify();
  const t = useT();
  const message = t.players.card.sync.savedOffline;
  const [pending, setPending] = useState<ReadonlyMap<SyncKey, number>>(() => new Map());
  const [syncFailed, setSyncFailed] = useState(false);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const adjust = useCallback((key: SyncKey, delta: number) => {
    setPending((prev) => {
      const next = new Map(prev);
      const count = (next.get(key) ?? 0) + delta;
      if (count > 0) next.set(key, count);
      else next.delete(key);
      return next;
    });
  }, []);

  const queued = useCallback(
    (key: SyncKey, written: Promise<unknown>) => {
      notifyRef.current(message);
      adjust(key, 1);
      written.then(
        () => adjust(key, -1),
        () => {
          adjust(key, -1);
          setSyncFailed(true);
        },
      );
    },
    [adjust, message],
  );

  const value = useMemo<PlayerSync>(
    () => ({ queued, isPending: (key) => (pending.get(key) ?? 0) > 0, syncFailed }),
    [queued, pending, syncFailed],
  );

  return <PlayerSyncContext.Provider value={value}>{children}</PlayerSyncContext.Provider>;
}

export function usePlayerSync(): PlayerSync {
  return useContext(PlayerSyncContext);
}

export function PendingDot({ pending, className = '' }: { pending: boolean; className?: string }) {
  const t = useT();
  if (!pending) return null;
  const waiting = t.players.card.sync.waiting;
  return <span role="img" aria-label={waiting} title={waiting} className={`inline-block h-2 w-2 shrink-0 rounded-full bg-ink-2 ${className}`.trim()} />;
}
