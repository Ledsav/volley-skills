import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { deletePlayer, listPlayersDueForDeletion } from '../players/playersApi';
import { deletionCutoff, RETENTION_MONTHS, todayIso } from '../players/retention';
import type { Player } from '../types/player';

interface RetentionNoticeProps {
  teamId: string;
  onDeleted: () => void;
}

/**
 * Lists players who left the club more than the retention period ago, so an
 * admin deletes their data (there is no server to do it on a schedule).
 * Renders nothing when no one is due or the list can't be read.
 */
export function RetentionNotice({ teamId, onDeleted }: RetentionNoticeProps) {
  const [due, setDue] = useState<Player[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Player | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPlayersDueForDeletion(teamId, deletionCutoff(todayIso()))
      .then((players) => {
        if (!cancelled) setDue(players);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    const player = pendingDelete;
    setDeleteError(null);
    try {
      await deletePlayer(teamId, player.id);
    } catch {
      setDeleteError('Could not delete this player. Please try again.');
      return;
    }
    setDue((current) => current.filter((p) => p.id !== player.id));
    setPendingDelete(null);
    onDeleted();
  }

  if (due.length === 0) return null;

  return (
    <section
      aria-labelledby="retention-heading"
      className="mb-4 rounded-md border border-orange bg-orange/10 p-3 text-sm text-ink"
    >
      <h2 id="retention-heading" className="font-medium">
        {due.length === 1 ? '1 player is' : `${due.length} players are`} due for deletion
      </h2>
      <p className="mt-1 text-slate">
        They left the club more than {RETENTION_MONTHS} months ago, so their data should be deleted. Export it first
        from their card if the family asked for a copy.
      </p>
      <ul className="mt-2 divide-y divide-orange/30">
        {due.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 truncate">
              <Link to={`/teams/${teamId}/players/${p.id}`} className="text-blue hover:underline">
                {p.fullName}
              </Link>
              <span className="text-slate">
                {' '}
                · left <span className="tabular-nums">{p.leftClubAt}</span>
              </span>
            </span>
            <Button variant="destructive" size="sm" className="shrink-0" onClick={() => setPendingDelete(p)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.fullName}?`}
          message="This permanently deletes their player card, skills, development plan, physical tests and testing-session entries, and removes their name and number from past match reports. This cannot be undone."
          confirmLabel="Yes, delete player"
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError(null);
          }}
          error={deleteError}
        />
      )}
    </section>
  );
}
