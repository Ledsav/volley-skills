import { AuthShell } from '../auth/AuthShell';
import { useAuth } from '../auth/AuthContext';
import { useSignOut } from '../auth/useSignOut';
import { Button } from '../components/Button';

/** Signed in, but not a member of any club yet. */
export function WelcomePage() {
  const { appUser, firebaseUser } = useAuth();
  const { signOut, unsyncedDialog } = useSignOut();
  const email = appUser?.email ?? firebaseUser?.email ?? '';
  return (
    <AuthShell title="Welcome to Volley Skills">
      <p className="text-center text-slate">
        Ask your club admin to add {email} to your club, then sign in again.
      </p>
      <div className="mt-6 flex justify-center">
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
      </div>
      {unsyncedDialog}
    </AuthShell>
  );
}
