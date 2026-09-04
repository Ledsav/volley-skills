export type UserRole = 'admin' | 'viewer';

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
}
