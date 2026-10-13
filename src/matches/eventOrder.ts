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
 * Orders for a batch of `count` new events. With an anchor, the orders sit
 * strictly between the anchor and the next known order after it (events, this
 * device's unsynced writes); `lastWrite` resolves an anchor that is this
 * device's own unsynced write. Without an anchor, they are appended after
 * everything, including unsynced writes.
 */
export function batchOrders(
  events: { id: string; order: number }[],
  anchorId: string | null,
  count: number,
  maxWritten: number,
  lastWrite: { id: string; order: number } | null = null,
): number[] {
  if (count <= 0) return [];
  let anchorOrder: number | null = null;
  if (anchorId) {
    const known = events.find((e) => e.id === anchorId);
    if (known) anchorOrder = known.order;
    else if (lastWrite && lastWrite.id === anchorId) anchorOrder = lastWrite.order;
  }
  if (anchorOrder !== null) {
    const anchor = anchorOrder;
    const bounds = [...events.map((e) => e.order), maxWritten, lastWrite?.order ?? -Infinity].filter((o) => o > anchor);
    if (bounds.length > 0) {
      const step = (Math.min(...bounds) - anchor) / (count + 1);
      return Array.from({ length: count }, (_, i) => anchor + step * (i + 1));
    }
    return Array.from({ length: count }, (_, i) => Math.max(anchor, maxWritten) + 1 + i);
  }
  const start = Math.max(appendOrder(events), maxWritten + 1);
  return Array.from({ length: count }, (_, i) => start + i);
}
