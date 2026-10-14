import type { Access } from '../auth/access';
import type { Team } from '../types/team';

/** Mirrors the rules' isTeamAdmin(): listed in adminEmails, or a superadmin. */
export function isTeamAdmin(team: Pick<Team, 'adminEmails'>, email: string | null | undefined, access: Access | null): boolean {
  return !!access?.isSuperAdmin || (!!email && team.adminEmails.includes(email));
}
