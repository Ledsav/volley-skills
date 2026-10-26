import type { ClubStatus } from '../types/club';

export const CLUB_STATUS_LABEL: Record<ClubStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  suspended: 'Paused',
  terminating: 'Ending',
  deleted: 'Deleted',
};
