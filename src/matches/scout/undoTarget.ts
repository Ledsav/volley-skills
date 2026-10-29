import type { MatchEvent } from '../../types/match';
import { sortEvents } from '../scoutEngine';

export interface UndoTarget {
  kind: 'none' | 'importOnly' | 'single' | 'batch';
  ids: string[];
  /** What remains of the written-ids stack after popping. */
  stack: string[];
}

/** True when the match has events and every one of them came from a DataVolley import. */
export function onlyImports(events: MatchEvent[]): boolean {
  return events.length > 0 && events.every((e) => e.source === 'import');
}

/**
 * Which event(s) Undo removes: this device's last write still in the snapshot, else the
 * last event by order. Imported events are never targets. A shared chunk undoes together.
 */
export function undoTarget(events: MatchEvent[], stack: readonly string[]): UndoTarget {
  if (events.length === 0) return { kind: 'none', ids: [], stack: [...stack] };
  const rest = [...stack];
  let last: MatchEvent | undefined;
  while (!last && rest.length > 0) {
    const id = rest.pop();
    const found = events.find((e) => e.id === id);
    if (found && found.source !== 'import') last = found;
  }
  if (!last) {
    const own = sortEvents(events).filter((e) => e.source !== 'import');
    last = own[own.length - 1];
  }
  if (!last) return { kind: 'importOnly', ids: [], stack: rest };
  const chunkId = last.chunkId;
  const chunk = chunkId ? events.filter((e) => e.chunkId === chunkId && e.source !== 'import') : [];
  if (chunk.length > 1) return { kind: 'batch', ids: chunk.map((e) => e.id), stack: rest };
  return { kind: 'single', ids: [last.id], stack: rest };
}
