import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/firestore';
import { auth } from '../firebase/config';
import { setActiveClubId } from '../firebase/activeClub';
import { listMyMemberships, probePlatformAdmin, subscribeClub } from '../clubs/clubsApi';
import { pickActiveClub, readStoredClub, storeClub } from '../clubs/activeClub';
import { ensureUserDoc, writeOnboarding } from './usersApi';
import { applyOnboarding, type OnboardingChange, type OnboardingState } from '../onboarding/onboardingState';
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
  /** The user's shown-once state; `null` until the user doc is read and when signed out. */
  onboarding: OnboardingState | null;
  /** Applies the change here at once, then writes it without waiting; a failed write is swallowed. */
  updateOnboarding: (change: OnboardingChange) => void;
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
  onboarding: null,
  updateOnboarding: () => {},
});

interface Session {
  appUser: AppUser | null;
  access: Access | null;
  memberships: Membership[];
  activeClubId: string | null;
  role: MemberRole | null;
  isPlatformAdmin: boolean;
  droppedClub: boolean;
  onboarding: OnboardingState | null;
}

const SIGNED_OUT: Session = {
  appUser: null,
  access: null,
  memberships: [],
  activeClubId: null,
  role: null,
  isPlatformAdmin: false,
  droppedClub: false,
  onboarding: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session>(SIGNED_OUT);
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const uidRef = useRef<string | null>(null);
  uidRef.current = session.appUser?.uid ?? null;
  const updateOnboarding = useCallback((change: OnboardingChange) => {
    const uid = uidRef.current;
    if (!uid) return;
    setSession((s) => (s.onboarding ? { ...s, onboarding: applyOnboarding(s.onboarding, change) } : s));
    writeOnboarding(uid, change).catch(() => {});
  }, []);

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

        setSession({
          appUser,
          access,
          memberships,
          activeClubId: clubId,
          role,
          isPlatformAdmin,
          droppedClub: dropped,
          onboarding: appUser.onboarding,
        });
        setAuthError(null);
        if (clubId) {
          // Section access depends on the club's status in the rules, so it is probed again
          // whenever the status changes; only the latest probe of this sign-in lands.
          let seenStatus: Club['status'] | null | undefined;
          let probe = 0;
          const reprobe = async () => {
            const mine = ++probe;
            try {
              const next = role ? await resolveAccess(role) : null;
              if (current === generation && mine === probe) setSession((s) => ({ ...s, access: next }));
            } catch {
              // Offline or transient: keep the access already resolved.
            }
          };
          // Loading ends with the first club snapshot, so screens can branch on its status.
          unsubscribeClub = subscribeClub(clubId, (next) => {
            const status = next?.status ?? null;
            if (seenStatus !== undefined && status !== seenStatus) void reprobe();
            seenStatus = status;
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
    <AuthContext.Provider value={{ firebaseUser, ...session, club, loading, authError, switchClub, updateOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
