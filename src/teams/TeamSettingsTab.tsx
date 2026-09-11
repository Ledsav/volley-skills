import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../auth/AuthContext';
import { deleteTeam, updateTeamInfo } from './teamsApi';
import type { Team } from '../types/team';

interface TeamSettingsTabProps {
  team: Team;
  onTeamUpdated: (team: Team) => void;
}

export function TeamSettingsTab({ team, onTeamUpdated }: TeamSettingsTabProps) {
  const navigate = useNavigate();
  const { access } = useAuth();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? '');
  const [notes, setNotes] = useState(team.notes ?? '');
  const [infoError, setInfoError] = useState<string | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSaveInfo(event: FormEvent) {
    event.preventDefault();
    setInfoError(null);
    setSavingInfo(true);
    const updates = { name: name.trim(), description: description.trim(), notes: notes.trim() };
    try {
      await updateTeamInfo(team.id, updates);
    } catch {
      setInfoError('Could not save team info. Please try again.');
      setSavingInfo(false);
      return;
    }
    onTeamUpdated({ ...team, ...updates });
    setSavingInfo(false);
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
        <form onSubmit={handleSaveInfo} className="p-4">
          <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">Team info</h2>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Team name
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Description
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Notes
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </label>
          </div>
          {infoError && <p role="alert" className="mt-3 text-sm text-red">{infoError}</p>}
          <Button variant="primary" size="sm" type="submit" className="mt-3 w-full sm:w-auto" disabled={savingInfo}>
            Save team info
          </Button>
        </form>

        {access?.isSuperAdmin && (
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
        )}
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
