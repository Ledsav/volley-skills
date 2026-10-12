export function appendOrder(events: { order: number }[]): number {
  return events.length === 0 ? 1 : Math.max(...events.map((e) => e.order)) + 1;
}

/** An order strictly between the anchor and the event after it (or after the end). */
export function orderAfter(events: { id: string; order: number }[], anchorId: string): number {
  const sorted = [...events].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((e) => e.id === anchorId);
  if (i < 0) return appendOrder(events);
  const next = sorted[i + 1];
  return next ? (sorted[i].order + next.order) / 2 : sorted[i].order + 1;
}
