import { Link } from 'react-router-dom';
import { Archive, Hourglass, PauseCircle } from 'lucide-react';
import { StatusLayout } from '../components/StatusLayout';
import { AuthShell } from '../auth/AuthShell';
import { parseVersionKey } from '../legal/versions';
import { useAuth } from '../auth/AuthContext';
import { useSignOut } from '../auth/useSignOut';
import { Button } from '../components/Button';
import { otherUsableClubs } from './activeClub';
import { useT } from '../i18n/I18nProvider';

export type ClubStatusKind = 'pending' | 'locked' | 'ended';

export function ClubStatusScreen({ kind }: { kind: ClubStatusKind }) {
  const { club, memberships, activeClubId, switchClub } = useAuth();
  const { signOut, unsyncedDialog } = useSignOut();
  const t = useT().clubs;
  const s = t.statusScreen;
  const clubName = club?.name ?? t.yourClubFallback;
  const others = otherUsableClubs(memberships, activeClubId);

  const copy: Record<ClubStatusKind, { title: string; body: string }> = {
    pending: { title: s.pending.title, body: s.pending.body(clubName) },
    locked: { title: s.locked.title, body: s.locked.body(clubName) },
    ended: { title: s.ended.title, body: s.ended.body(clubName) },
  };
  const { title, body } = copy[kind];
  const accepted = kind === 'pending' && club?.legal ? parseVersionKey(club.legal.versionKey) : null;

  const icon = { pending: Hourglass, locked: PauseCircle, ended: Archive }[kind];

  return (
    <AuthShell>
      <StatusLayout
        icon={icon}
        title={title}
        actions={
          <>
            {others.map((m) => (
              <Button key={m.clubId} variant="primary" className="min-h-12 w-full" onClick={() => switchClub(m.clubId)}>
                {s.switchTo(m.clubName)}
              </Button>
            ))}
            <Button variant="secondary" className="min-h-12 w-full" onClick={signOut}>
              {s.signOut}
            </Button>
          </>
        }
      >
        <p>{body}</p>
        {kind === 'pending' && (
          <>
            <p className="mt-3">{s.emailWhenActive}</p>
            {accepted && (
              <p className="mt-3 text-footnote">
                {s.accepted}{' '}
                <Link to={`/legal/terms?v=${accepted.terms}`} className="text-ink underline tabular-nums">
                  {s.termsOfService(accepted.terms)}
                </Link>
                {s.and}
                <Link to={`/legal/dpa?v=${accepted.dpa}`} className="text-ink underline tabular-nums">
                  {s.dpa(accepted.dpa)}
                </Link>
              </p>
            )}
          </>
        )}
      </StatusLayout>
      {unsyncedDialog}
    </AuthShell>
  );
}
