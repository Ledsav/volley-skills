import { AuthShell } from '../auth/AuthShell';
import { useAuth } from '../auth/AuthContext';
import { useSignOut } from '../auth/useSignOut';
import { Button } from '../components/Button';
import { otherUsableClubs } from './activeClub';

/** Signed in, but not a member of any club yet. */
export function WelcomePage() {
  const { appUser, firebaseUser, memberships, activeClubId, switchClub } = useAuth();
  const { signOut, unsyncedDialog } = useSignOut();
  const email = appUser?.email ?? firebaseUser?.email ?? '';
  const others = otherUsableClubs(memberships, activeClubId);
  return (
    <AuthShell title="Welcome to Volley Skills">
      <p className="text-center text-slate">
        {others.length > 0
          ? 'You no longer have access to this club.'
          : `Ask your club admin to add ${email} to your club, then sign in again.`}
      </p>
      <div className="mt-6 flex flex-col items-center gap-2">
        {others.map((m) => (
          <Button key={m.clubId} variant="primary" onClick={() => switchClub(m.clubId)}>
            Switch to {m.clubName}
          </Button>
        ))}
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
      </div>
      {unsyncedDialog}
    </AuthShell>
  );
}
