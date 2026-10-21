import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/firestore';
import { auth } from '../firebase/config';
import { setActiveClubId } from '../firebase/activeClub';
import { listMyMemberships, probePlatformAdmin, subscribeClub } from '../clubs/clubsApi';
import { pickActiveClub, readStoredClub, storeClub } from '../clubs/activeClub';
import { ensureUserDoc } from './usersApi';
import { resolveAccess } from './access';
import type { Access } from './access';
import type { AppUser } from '../types/auth';
import type { Club, MemberRole, Membership } from '../types/club';

export interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  access: Access | null;
  loading: boolean;
  authError: string | null;
  memberships: Membership[];
  activeClubId: string | null;
  club: Club | null;
  role: MemberRole | null;
  isPlatformAdmin: boolean;
  /** The stored club was no longer usable and another one (or none) was opened instead. */
  droppedClub: boolean;
  /** Stores the choice and reloads, so every subscription and cursor starts over in the new club. */
  switchClub: (clubId: string) => void;
}

function switchClub(clubId: string): void {
  storeClub(clubId);
  window.location.reload();
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  appUser: null,
  access: null,
  loading: true,
  authError: null,
  memberships: [],
  activeClubId: null,
  club: null,
  role: null,
  isPlatformAdmin: false,
  droppedClub: false,
  switchClub,
});

interface Session {
  appUser: AppUser | null;
  access: Access | null;
  memberships: Membership[];
  activeClubId: string | null;
  role: MemberRole | null;
  isPlatformAdmin: boolean;
  droppedClub: boolean;
}

const SIGNED_OUT: Session = {
  appUser: null,
  access: null,
  memberships: [],
  activeClubId: null,
  role: null,
  isPlatformAdmin: false,
  droppedClub: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session>(SIGNED_OUT);
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Each auth change bumps the generation so a slower, older sign-in never lands.
    let generation = 0;
    let unsubscribeClub: Unsubscribe | null = null;
    const stopClub = () => {
      unsubscribeClub?.();
      unsubscribeClub = null;
    };
    const signOutState = (error: string | null) => {
      setActiveClubId(null);
      setSession(SIGNED_OUT);
      setClub(null);
      setAuthError(error);
      setLoading(false);
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const current = ++generation;
      stopClub();
      setFirebaseUser(user);
      if (!user || !user.email) {
        signOutState(null);
        return;
      }
      setLoading(true);
      try {
        const email = user.email.toLowerCase();
        const appUser = await ensureUserDoc(user.uid, email);
        const [memberships, isPlatformAdmin] = await Promise.all([
          listMyMemberships(email),
          probePlatformAdmin(email),
        ]);
        if (current !== generation) return;

        const { clubId, dropped } = pickActiveClub(memberships, readStoredClub());
        storeClub(clubId);
        setActiveClubId(clubId);
        const role = memberships.find((m) => m.clubId === clubId)?.role ?? null;
        const access = role ? await resolveAccess(role) : null;
        if (current !== generation) return;

        setSession({ appUser, access, memberships, activeClubId: clubId, role, isPlatformAdmin, droppedClub: dropped });
        setAuthError(null);
        if (clubId) {
          // Loading ends with the first club snapshot, so screens can branch on its status.
          unsubscribeClub = subscribeClub(clubId, (next) => {
            setClub(next);
            setLoading(false);
          });
        } else {
          setClub(null);
          setLoading(false);
        }
      } catch {
        if (current !== generation) return;
        signOutState('Could not finish signing you in.');
      }
    });
    return () => {
      generation++;
      stopClub();
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, ...session, club, loading, authError, switchClub }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
