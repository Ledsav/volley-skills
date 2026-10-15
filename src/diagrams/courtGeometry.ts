/** Court lines on the 0–100 diagram grid. Shared by the renderer and the AI prompt so they can't drift. */
export function courtGeometry(court: 'full' | 'half') {
  const top = 6;
  const bottom = court === 'full' ? 94 : 72;
  return { left: 10, right: 90, top, bottom, netY: court === 'full' ? (top + bottom) / 2 : top };
}
