import { AuthShell } from '../auth/AuthShell';
import { useAuth } from '../auth/AuthContext';
import { useSignOut } from '../auth/useSignOut';
import { Button } from '../components/Button';

export type ClubStatusKind = 'pending' | 'locked' | 'exportOnly' | 'ended';

export function ClubStatusScreen({ kind }: { kind: ClubStatusKind }) {
  const { club, memberships, activeClubId, switchClub } = useAuth();
  const { signOut, unsyncedDialog } = useSignOut();
  const clubName = club?.name ?? 'Your club';
  const others = memberships.filter((m) => m.clubId !== activeClubId);

  const copy: Record<ClubStatusKind, { title: string; body: string }> = {
    pending: {
      title: 'Your club is waiting for activation',
      body: `${clubName} has been set up and will be available as soon as it is activated.`,
    },
    locked: {
      title: "Your club's access is paused",
      body: `Access to ${clubName} is paused for now. Contact your club admin to find out more.`,
    },
    exportOnly: {
      title: "Your club's access is paused",
      body: `Your club's data is kept. ${clubName} can't be used right now, but you can export your data.`,
    },
    ended: {
      title: "Your club's contract has ended",
      body: `The contract for ${clubName} has ended and its data is no longer available.`,
    },
  };
  const { title, body } = copy[kind];

  return (
    <AuthShell title={title}>
      <p className="text-center text-slate">{body}</p>
      {/* The Export action for kind="exportOnly" arrives with the data-export plan (Plan 4). */}
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
