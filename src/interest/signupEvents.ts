// Fired on `window` whenever an access request's reviewed state changes, so
// the nav badge in AppShell can recount without a page reload.
export const SIGNUPS_CHANGED_EVENT = 'vcb:interest-signups-changed';

export function notifySignupsChanged(): void {
  window.dispatchEvent(new Event(SIGNUPS_CHANGED_EVENT));
}
