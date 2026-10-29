/** Court lines on the 0–100 diagram grid. Shared by the renderer and the AI prompt so they can't drift. */
export function courtGeometry(court: 'full' | 'half') {
  const top = 6;
  const bottom = court === 'full' ? 94 : 72;
  return { left: 10, right: 90, top, bottom, netY: court === 'full' ? (top + bottom) / 2 : top };
}

/** The court's own outline (net posts included), the frame before the items are measured. */
export function courtBox(court: 'full' | 'half' | 'blank'): { x: number; y: number; w: number; h: number } {
  if (court === 'blank') return { x: 0, y: 0, w: 100, h: 100 };
  const g = courtGeometry(court);
  return { x: 8, y: g.top, w: 84, h: g.bottom - g.top };
}
