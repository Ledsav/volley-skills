import type { Club, ClubStatus } from '../types/club';
import { DAY_MS } from './dates';
import { getT } from '../i18n/I18nProvider';

export type ClubActionKind = 'activate' | 'deactivate' | 'endContract' | 'changeDates' | 'reject' | 'reinstate';

export interface ClubAction {
  kind: ClubActionKind;
  label: string;
  to: ClubStatus;
  reasonRequired: boolean;
  needsDates: boolean;
  secondary: boolean;
}

type ActionDef = Omit<ClubAction, 'label'>;

const activate: ActionDef = { kind: 'activate', to: 'active', reasonRequired: false, needsDates: false, secondary: false };
const deactivate: ActionDef = { kind: 'deactivate', to: 'suspended', reasonRequired: true, needsDates: false, secondary: false };
const endContract: ActionDef = { kind: 'endContract', to: 'terminating', reasonRequired: false, needsDates: true, secondary: true };
const changeDates: ActionDef = { kind: 'changeDates', to: 'terminating', reasonRequired: false, needsDates: true, secondary: true };
const reject: ActionDef = { kind: 'reject', to: 'deleted', reasonRequired: false, needsDates: false, secondary: true };
// Reinstating needs no dates from the page: changeClubStatus clears them.
const reinstate: ActionDef = { kind: 'reinstate', to: 'active', reasonRequired: false, needsDates: false, secondary: false };

function defsFor(status: ClubStatus): ActionDef[] {
  switch (status) {
    case 'pending': return [activate, reject];
    case 'active': return [deactivate, endContract];
    case 'suspended': return [activate, endContract];
    case 'terminating': return [reinstate, changeDates];
    default: return [];
  }
}

/** The actions offered for a club; labels follow the active language at call time. */
export function clubActions(club: Pick<Club, 'status'>): ClubAction[] {
  const labels = getT().platform.actions;
  return defsFor(club.status).map((d) => ({ ...d, label: labels[d.kind] }));
}

// A paused club ends today by default: a later end date would give it full use again.
export function defaultTerminationDates(now: Date, status?: ClubStatus): { effectiveAt: Date; retrievalEndsAt: Date } {
  const effectiveAt = status === 'suspended' ? now : new Date(now.getTime() + 30 * DAY_MS);
  return { effectiveAt, retrievalEndsAt: new Date(effectiveAt.getTime() + 30 * DAY_MS) };
}
