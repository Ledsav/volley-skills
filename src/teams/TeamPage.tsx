import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getTeam } from './teamsApi';
import { TeamSettingsTab } from './TeamSettingsTab';
import { TeamRosterTable } from './TeamRosterTable';
import type { Team } from '../types/team';

type Tab = 'overview' | 'settings';

const tabClass = (active: boolean) =>
  `border-b-2 px-1 py-3 text-sm font-medium ${
    active ? 'border-blue text-blue' : 'border-transparent text-slate hover:text-ink'
  }`;

export function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!teamId) return;
    void getTeam(teamId).then(setTeam);
  }, [teamId]);

  if (!team || !teamId) return <p className="p-6 text-slate">Loading team...</p>;

  return (
    <div className="mx-auto max-w-2xl bg-bg p-6">
      <div className="mb-6 rounded-lg border border-border bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">{team.name}</h1>
        <p className="mt-1 text-slate">{team.description}</p>

        <nav className="mt-4 flex gap-6 border-b border-border">
          <button onClick={() => setTab('overview')} className={tabClass(tab === 'overview')}>
            Overview
          </button>
          <button onClick={() => setTab('settings')} className={tabClass(tab === 'settings')}>
            Settings
          </button>
        </nav>

        <div className="mt-6">
          {tab === 'overview' && <TeamRosterTable teamId={teamId} />}
          {tab === 'settings' && <TeamSettingsTab team={team} onTeamUpdated={setTeam} />}
        </div>
      </div>
    </div>
  );
}
