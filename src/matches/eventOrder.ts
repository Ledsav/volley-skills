export function appendOrder(events: { order: number }[]): number {
  return events.length === 0 ? 1 : Math.max(...events.map((e) => e.order)) + 1;
}

/** An order strictly between `value` and the next event after it (or after the end). */
export function orderAfterValue(events: { order: number }[], value: number): number {
  const later = events.map((e) => e.order).filter((o) => o > value);
  return later.length === 0 ? value + 1 : (value + Math.min(...later)) / 2;
}

/** An order strictly between the anchor and the event after it (or after the end). */
export function orderAfter(events: { id: string; order: number }[], anchorId: string): number {
  const anchor = events.find((e) => e.id === anchorId);
  return anchor ? orderAfterValue(events, anchor.order) : appendOrder(events);
}

/**
 * The order for the next write. `lastWrite`/`maxWritten` cover writes this
 * device made that the snapshot may not include yet (rapid taps), so two taps
 * never share an order and a chain of inserts stays in sequence.
 */
export function nextOrder(
  events: { id: string; order: number }[],
  anchorId: string | null,
  lastWrite: { id: string; order: number } | null,
  maxWritten: number,
): number {
  if (anchorId) {
    if (events.some((e) => e.id === anchorId)) return orderAfter(events, anchorId);
    if (lastWrite && lastWrite.id === anchorId) return orderAfterValue(events, lastWrite.order);
  }
  return Math.max(appendOrder(events), maxWritten + 1);
}

/**
 * Orders for a batch of `count` new events: strictly between the anchor and the
 * event after it, or appended after everything (including this device's
 * unsynced writes) when there is no anchor.
 */
export function batchOrders(
  events: { id: string; order: number }[],
  anchorId: string | null,
  count: number,
  maxWritten: number,
): number[] {
  if (count <= 0) return [];
  const anchor = anchorId ? events.find((e) => e.id === anchorId) : undefined;
  if (anchor) {
    const later = events.map((e) => e.order).filter((o) => o > anchor.order);
    if (later.length > 0) {
      const step = (Math.min(...later) - anchor.order) / (count + 1);
      return Array.from({ length: count }, (_, i) => anchor.order + step * (i + 1));
    }
    return Array.from({ length: count }, (_, i) => Math.max(anchor.order, maxWritten) + 1 + i);
  }
  const start = Math.max(appendOrder(events), maxWritten + 1);
  return Array.from({ length: count }, (_, i) => start + i);
}
