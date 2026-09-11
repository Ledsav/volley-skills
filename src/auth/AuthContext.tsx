import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase/config';
import { ensureUserDoc } from './usersApi';
import { resolveAccess } from './access';
import type { Access } from './access';
import type { AppUser } from '../types/auth';

export interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  access: Access | null;
  loading: boolean;
  authError: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  appUser: null,
  access: null,
  loading: true,
  authError: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      try {
        if (user && user.email) {
          const resolved = await ensureUserDoc(user.uid, user.email);
          setAppUser(resolved);
          setAccess(await resolveAccess(resolved));
        } else {
          setAppUser(null);
          setAccess(null);
        }
        setAuthError(null);
      } catch {
        setAppUser(null);
        setAccess(null);
        setAuthError('Could not finish signing you in.');
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, access, loading, authError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
