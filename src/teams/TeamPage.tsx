import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getTeam, updateTeamDevelopmentPlan } from './teamsApi';
import { TeamSettingsTab } from './TeamSettingsTab';
import { TeamRosterTable } from './TeamRosterTable';
import { AddPlayerDialog } from '../players/AddPlayerDialog';
import { Button } from '../components/Button';
import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';
import { TeamCalendarTab } from '../calendar/TeamCalendarTab';
import type { Team } from '../types/team';

type Tab = 'overview' | 'calendar' | 'plan' | 'settings';

const tabClass = (active: boolean) =>
  `border-b-2 px-1 py-3 text-sm font-medium ${
    active ? 'border-blue text-blue' : 'border-transparent text-slate hover:text-ink'
  }`;

export function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [rosterRefreshKey, setRosterRefreshKey] = useState(0);

  useEffect(() => {
    if (!teamId) return;
    setError(null);
    void getTeam(teamId)
      .then(setTeam)
      .catch(() => setError("You don't have access to this team."));
  }, [teamId]);

  if (error) {
    return (
      <p role="alert" className="p-6 text-red">
        {error}
      </p>
    );
  }

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
          <button onClick={() => setTab('calendar')} className={tabClass(tab === 'calendar')}>
            Calendar
          </button>
          <button onClick={() => setTab('plan')} className={tabClass(tab === 'plan')}>
            Development Plan
          </button>
          <button onClick={() => setTab('settings')} className={tabClass(tab === 'settings')}>
            Settings
          </button>
        </nav>

        <div className="mt-6">
          {tab === 'overview' && (
            <>
              <div className="mb-4 flex justify-end">
                <Button variant="primary" size="sm" onClick={() => setShowAddPlayer(true)}>
                  + Add player
                </Button>
              </div>
              <TeamRosterTable key={rosterRefreshKey} teamId={teamId} />
            </>
          )}
          {tab === 'calendar' && <TeamCalendarTab teamId={teamId} />}
          {tab === 'plan' && (
            <DevelopmentPlanEditor
              plan={team.developmentPlan}
              onSave={(plan) => updateTeamDevelopmentPlan(teamId, plan).then(() => setTeam({ ...team, developmentPlan: plan }))}
              isAdmin={true}
            />
          )}
          {tab === 'settings' && <TeamSettingsTab team={team} onTeamUpdated={setTeam} />}
        </div>
      </div>
      {showAddPlayer && (
        <AddPlayerDialog
          teamId={teamId}
          team={team}
          onClose={() => setShowAddPlayer(false)}
          onCreated={() => {
            setShowAddPlayer(false);
            setRosterRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
