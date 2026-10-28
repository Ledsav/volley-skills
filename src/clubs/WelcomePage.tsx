import { Link } from 'react-router-dom';
import { AuthShell } from '../auth/AuthShell';
import { useAuth } from '../auth/AuthContext';
import { useSignOut } from '../auth/useSignOut';
import { Button } from '../components/Button';
import { otherUsableClubs } from './activeClub';
import { useT } from '../i18n/I18nProvider';

/** Signed in, but not a member of any club yet. */
export function WelcomePage() {
  const { appUser, firebaseUser, memberships, activeClubId, isPlatformAdmin, switchClub } = useAuth();
  const { signOut, unsyncedDialog } = useSignOut();
  const w = useT().clubs.welcome;
  const email = appUser?.email ?? firebaseUser?.email ?? '';
  const others = otherUsableClubs(memberships, activeClubId);
  return (
    <AuthShell title={w.title}>
      <p className="text-center text-slate">
        {others.length > 0
          ? w.noLongerAccess
          : w.askAdmin(email)}
      </p>
      <div className="mt-6 flex flex-col items-center gap-2">
        {isPlatformAdmin && (
          <Link
            to="/platform"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-navy px-4 py-2 font-medium text-white hover:bg-navy/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            {w.openPlatform}
          </Link>
        )}
        {!isPlatformAdmin && (
          <Link
            to="/signup/club"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-blue bg-surface px-4 py-2 font-medium text-blue-strong hover:bg-blue/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            {w.createClub}
          </Link>
        )}
        {others.map((m) => (
          <Button key={m.clubId} variant="primary" onClick={() => switchClub(m.clubId)}>
            {w.switchTo(m.clubName)}
          </Button>
        ))}
        <Button variant="secondary" onClick={signOut}>
          {w.signOut}
        </Button>
      </div>
      {unsyncedDialog}
    </AuthShell>
  );
}
