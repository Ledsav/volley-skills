import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { StatusLayout } from '../components/StatusLayout';
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
  const pill =
    'inline-flex min-h-12 w-full items-center justify-center rounded-md px-4 py-2 font-semibold tracking-[-0.01em] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';
  return (
    <AuthShell>
      <StatusLayout
        icon={Users}
        title={w.title}
        actions={
          <>
            {isPlatformAdmin && (
              <Link to="/platform" className={`${pill} bg-ink text-on-ink hover:bg-ink/90`}>
                {w.openPlatform}
              </Link>
            )}
            {!isPlatformAdmin && (
              <Link to="/signup/club" className={`${pill} bg-surface-2 text-ink hover:bg-surface-3`}>
                {w.createClub}
              </Link>
            )}
            {others.map((m) => (
              <Button key={m.clubId} variant="primary" className="min-h-12 w-full" onClick={() => switchClub(m.clubId)}>
                {w.switchTo(m.clubName)}
              </Button>
            ))}
            <Button variant="secondary" className="min-h-12 w-full" onClick={signOut}>
              {w.signOut}
            </Button>
          </>
        }
      >
        <p>{others.length > 0 ? w.noLongerAccess : w.askAdmin(email)}</p>
      </StatusLayout>
      {unsyncedDialog}
    </AuthShell>
  );
}
