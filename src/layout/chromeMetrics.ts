/** Height of the sticky toolbar (`Toolbar`), in px. */
export const TOOLBAR_H = 52;
/** Height of the pinned team tab strip under the toolbar, in px. */
export const TEAM_TABS_H = 64;
/** Where a sticky element sits to clear the safe area, the toolbar and (with `below`) the team tab strip. */
export function stickyTop(below: 'toolbar' | 'teamTabs'): string {
  const offset = below === 'toolbar' ? TOOLBAR_H : TOOLBAR_H + TEAM_TABS_H;
  return `calc(${offset}px + env(safe-area-inset-top, 0px))`;
}
/**
 * Glass for a strip pinned under the toolbar (the team tabs) once the page scrolls. The page container caps the
 * content width, so the glass is carried on to the right edge of the window (a spread shadow in the glass colour,
 * clipped to the strip's height), and it drops the glass edge, whose dark-mode outline would box the strip in.
 */
export const STRIP_GLASS = 'glass [clip-path:inset(0_-100vmax_0_0)] !shadow-[0_0_0_100vmax_var(--glass)]';
