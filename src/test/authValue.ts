import type { User } from 'firebase/auth';
import type { Access } from '../auth/access';
import type { AuthContextValue } from '../auth/AuthContext';

const MEMBER_ACCESS: Access = {
  isSuperAdmin: false,
  sections: { exercises: false, trainings: false, guides: false },
};

export const superAdminAccess: Access = {
  isSuperAdmin: true,
  sections: { exercises: true, trainings: true, guides: true },
};

export function authValue(over: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    firebaseUser: { uid: 'u-1', email: 'user@example.com' } as User,
    appUser: { uid: 'u-1', email: 'user@example.com', role: 'member' },
    access: MEMBER_ACCESS,
    loading: false,
    authError: null,
    ...over,
  };
}
