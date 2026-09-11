export type UserRole = 'superadmin' | 'member';

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
}
