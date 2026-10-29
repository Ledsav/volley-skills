import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';
import { deletePlayer, listPlayersDueForDeletion } from '../players/playersApi';
import { deletionCutoff, RETENTION_MONTHS } from '../players/retention';
import { todayLocalIso } from '../dates/today';
import type { Player } from '../types/player';

interface RetentionNoticeProps {
  teamId: string;
  /** The team's grammatical gender, for the Italian wording. */
  gender?: Gender;
  onDeleted: () => void;
}

/**
 * Lists players who left the club more than the retention period ago, so an
 * admin deletes their data (there is no server to do it on a schedule).
 * Renders nothing when no one is due or the list can't be read.
 */
export function RetentionNotice({ teamId, gender = 'mixed', onDeleted }: RetentionNoticeProps) {
  const t = useT();
  const [due, setDue] = useState<Player[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Player | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPlayersDueForDeletion(teamId, deletionCutoff(todayLocalIso()))
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
      setDeleteError(t.teams.retention.deleteError);
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
        {t.teams.retention.heading(due.length, gender)}
      </h2>
      <p className="mt-1 text-slate">
        {t.teams.retention.body(RETENTION_MONTHS)}
      </p>
      <ul className="mt-2 divide-y divide-orange/30">
        {due.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 truncate">
              <Link to={`/teams/${teamId}/players/${p.id}`} className="text-blue-strong hover:underline">
                {p.fullName}
              </Link>
              <span className="text-slate">
                {' '}
                · {t.teams.retention.left} <span className="tabular-nums">{p.leftClubAt}</span>
              </span>
            </span>
            <Button variant="destructive" size="sm" className="shrink-0" onClick={() => setPendingDelete(p)}>
              {t.common.delete}
            </Button>
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <ConfirmDialog
          title={t.teams.retention.deleteTitle(pendingDelete.fullName)}
          message={t.teams.retention.deleteMessage}
          confirmLabel={t.teams.retention.deleteConfirm}
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
