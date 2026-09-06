import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { addTeamAdmin, removeTeamAdmin } from './teamsApi';
import type { Team } from '../types/team';

interface TeamSettingsTabProps {
  team: Team;
  onTeamUpdated: (team: Team) => void;
}

export function TeamSettingsTab({ team, onTeamUpdated }: TeamSettingsTabProps) {
  const [newAdminEmail, setNewAdminEmail] = useState('');

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!newAdminEmail) return;
    await addTeamAdmin(team.id, newAdminEmail, team.adminEmails);
    onTeamUpdated({ ...team, adminEmails: [...team.adminEmails, newAdminEmail] });
    setNewAdminEmail('');
  }

  async function handleRemove(email: string) {
    await removeTeamAdmin(team.id, email, team.adminEmails);
    onTeamUpdated({ ...team, adminEmails: team.adminEmails.filter((e) => e !== email) });
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-ink">Admins</h2>
      <ul className="mb-6 divide-y divide-border rounded-lg border border-border bg-surface">
        {team.adminEmails.map((email) => (
          <li key={email} className="flex items-center justify-between px-4 py-3">
            <span className="text-ink">{email}</span>
            {team.adminEmails.length > 1 && (
              <Button variant="destructive" size="sm" onClick={() => void handleRemove(email)}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd} className="rounded-lg border border-border bg-surface p-4 shadow-card">
        <label htmlFor="new-admin-email" className="mb-1 block text-sm font-medium text-ink">
          Add admin by email
        </label>
        <div className="flex gap-3">
          <Input
            id="new-admin-email"
            type="email"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            required
          />
          <Button variant="primary" type="submit" className="shrink-0">
            Grant access
          </Button>
        </div>
      </form>
    </div>
  );
}
