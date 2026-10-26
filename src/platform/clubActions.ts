import type { Club, ClubStatus } from '../types/club';
import { DAY_MS } from './dates';

export type ClubActionKind = 'activate' | 'deactivate' | 'endContract' | 'changeDates' | 'reject' | 'reinstate';

export interface ClubAction {
  kind: ClubActionKind;
  label: string;
  to: ClubStatus;
  reasonRequired: boolean;
  needsDates: boolean;
  secondary: boolean;
}

const activate: ClubAction = { kind: 'activate', label: 'Activate', to: 'active', reasonRequired: false, needsDates: false, secondary: false };
const deactivate: ClubAction = { kind: 'deactivate', label: 'Deactivate', to: 'suspended', reasonRequired: true, needsDates: false, secondary: false };
const endContract: ClubAction = { kind: 'endContract', label: 'End contract', to: 'terminating', reasonRequired: false, needsDates: true, secondary: true };
const changeDates: ClubAction = { kind: 'changeDates', label: 'Change dates', to: 'terminating', reasonRequired: false, needsDates: true, secondary: true };
const reject: ClubAction = { kind: 'reject', label: 'Reject', to: 'deleted', reasonRequired: false, needsDates: false, secondary: true };
// Reinstating needs no dates from the page: changeClubStatus clears them.
const reinstate: ClubAction = { kind: 'reinstate', label: 'Reinstate', to: 'active', reasonRequired: false, needsDates: false, secondary: false };

export function clubActions(club: Pick<Club, 'status'>): ClubAction[] {
  switch (club.status) {
    case 'pending': return [activate, reject];
    case 'active': return [deactivate, endContract];
    case 'suspended': return [activate, endContract];
    case 'terminating': return [reinstate, changeDates];
    default: return [];
  }
}

// A paused club ends today by default: a later end date would give it full use again.
export function defaultTerminationDates(now: Date, status?: ClubStatus): { effectiveAt: Date; retrievalEndsAt: Date } {
  const effectiveAt = status === 'suspended' ? now : new Date(now.getTime() + 30 * DAY_MS);
  return { effectiveAt, retrievalEndsAt: new Date(effectiveAt.getTime() + 30 * DAY_MS) };
}
