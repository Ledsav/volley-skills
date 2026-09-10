import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { addTeamAdmin, deleteTeam, removeTeamAdmin } from './teamsApi';
import type { Team } from '../types/team';

interface TeamSettingsTabProps {
  team: Team;
  onTeamUpdated: (team: Team) => void;
}

export function TeamSettingsTab({ team, onTeamUpdated }: TeamSettingsTabProps) {
  const navigate = useNavigate();
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    // Firebase Auth always lowercases request.auth.token.email, and the rules
    // compare it exactly against adminEmails, so store the normalized form.
    const email = newAdminEmail.trim().toLowerCase();
    if (!email) return;
    if (team.adminEmails.includes(email)) {
      setError('That email is already an admin of this team.');
      return;
    }
    try {
      await addTeamAdmin(team.id, email, team.adminEmails);
    } catch {
      setError('Could not grant access. Please try again.');
      return;
    }
    onTeamUpdated({ ...team, adminEmails: [...team.adminEmails, email] });
    setNewAdminEmail('');
  }

  async function handleRemove(email: string) {
    setError(null);
    try {
      await removeTeamAdmin(team.id, email, team.adminEmails);
    } catch {
      setError('Could not remove this admin. Please try again.');
      return;
    }
    onTeamUpdated({ ...team, adminEmails: team.adminEmails.filter((e) => e !== email) });
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteTeam(team.id);
    } catch {
      setDeleteError('Could not delete the team. Please try again.');
      return;
    }
    navigate('/teams', { replace: true });
  }

  return (
    <div>
      <div className="divide-y divide-border rounded-lg border border-border bg-surface shadow-card">
        <div className="p-4">
          <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">Admins</h2>
          <ul className="divide-y divide-border">
            {team.adminEmails.map((email) => (
              <li
                key={email}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span className="break-words text-ink">{email}</span>
                {team.adminEmails.length > 1 && (
                  <Button
                    variant="dangerGhost"
                    size="sm"
                    className="self-end sm:self-auto"
                    onClick={() => void handleRemove(email)}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleAdd} className="p-4">
          <label htmlFor="new-admin-email" className="mb-1 block text-sm font-medium text-ink">
            Add admin by email
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Input
              id="new-admin-email"
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              required
            />
            <Button
              variant="primary"
              size="sm"
              type="submit"
              className="w-full shrink-0 sm:w-auto"
            >
              Grant access
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red">
              {error}
            </p>
          )}
        </form>

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Danger zone</h2>
            <p className="mt-1 text-sm text-slate">
              Deleting a team also removes its roster and every player's records.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete team
          </Button>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title={`Delete ${team.name}?`}
          message="This will permanently delete the team, its roster, and every player's records, including their physical test history. This cannot be undone."
          confirmLabel="Yes, delete team"
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
          error={deleteError}
        />
      )}
    </div>
  );
}
