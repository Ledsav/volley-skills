/** Height of the sticky toolbar (`Toolbar`), in px. */
export const TOOLBAR_H = 52;
/** Height of the pinned team tab strip under the toolbar, in px. */
export const TEAM_TABS_H = 64;
/** Where a sticky element sits to clear the safe area, the toolbar and (with `below`) the team tab strip. */
export function stickyTop(below: 'toolbar' | 'teamTabs'): string {
  const offset = below === 'toolbar' ? TOOLBAR_H : TOOLBAR_H + TEAM_TABS_H;
  return `calc(${offset}px + env(safe-area-inset-top, 0px))`;
}
