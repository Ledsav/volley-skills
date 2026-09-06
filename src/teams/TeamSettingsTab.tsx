import { useState, type FormEvent } from 'react';
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
              <button
                onClick={() => void handleRemove(email)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-red hover:bg-red/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd} className="rounded-lg border border-border bg-surface p-4 shadow-card">
        <label htmlFor="new-admin-email" className="mb-1 block text-sm font-medium text-ink">
          Add admin by email
        </label>
        <div className="flex gap-3">
          <input
            id="new-admin-email"
            type="email"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-navy px-4 py-2 font-medium text-white hover:bg-navy/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            Grant access
          </button>
        </div>
      </form>
    </div>
  );
}
