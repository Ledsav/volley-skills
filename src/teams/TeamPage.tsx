import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getTeam, updateTeamDevelopmentPlan } from './teamsApi';
import { TeamSettingsTab } from './TeamSettingsTab';
import { TeamRosterTable } from './TeamRosterTable';
import { TeamStatsRow } from './TeamStatsRow';
import { AddPlayerDialog } from '../players/AddPlayerDialog';
import { useAuth } from '../auth/AuthContext';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { PLAYER_IMPORT_EXAMPLE, validatePlayerRows } from '../players/playersImport';
import { bulkCreatePlayers } from '../players/playersApi';
import { Button } from '../components/Button';
import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';
import { TeamCalendarTab } from '../calendar/TeamCalendarTab';
import type { Player } from '../types/player';
import type { Team } from '../types/team';

type Tab = 'overview' | 'calendar' | 'plan' | 'settings';

const tabClass = (active: boolean) =>
  `border-b-2 px-1 py-3 text-sm font-medium ${
    active ? 'border-blue text-blue' : 'border-transparent text-slate hover:text-ink'
  }`;

export function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { firebaseUser } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showImportPlayers, setShowImportPlayers] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [rosterRefreshKey, setRosterRefreshKey] = useState(0);
  const [rosterPlayers, setRosterPlayers] = useState<Player[]>([]);

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
    <div className="w-full bg-bg p-6 lg:p-8">
      <div className="mb-6 rounded-lg border border-border bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">{team.name}</h1>
        <p className="mt-1 text-slate">{team.description}</p>

        <nav className="mt-4 flex gap-6 overflow-x-auto border-b border-border">
          <button onClick={() => setTab('overview')} className={`${tabClass(tab === 'overview')} shrink-0`}>
            Overview
          </button>
          <button onClick={() => setTab('calendar')} className={`${tabClass(tab === 'calendar')} shrink-0`}>
            Calendar
          </button>
          <button onClick={() => setTab('plan')} className={`${tabClass(tab === 'plan')} shrink-0`}>
            Development Plan
          </button>
          <button onClick={() => setTab('settings')} className={`${tabClass(tab === 'settings')} shrink-0`}>
            Settings
          </button>
        </nav>

        <div className="mt-6">
          {tab === 'overview' && (
            <>
              <TeamStatsRow players={rosterPlayers} />
              <div className="mb-4 flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowImportPlayers(true)}>
                  Import players
                </Button>
                <Button variant="primary" size="sm" onClick={() => setShowAddPlayer(true)}>
                  + Add player
                </Button>
              </div>
              {importNotice && <p className="mb-4 text-sm text-green">{importNotice}</p>}
              <TeamRosterTable key={rosterRefreshKey} teamId={teamId} onPlayersChange={setRosterPlayers} />
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
      {showImportPlayers && firebaseUser && (
        <BulkImportDialog
          title="Import players"
          hint="Imported players start with consent not given — confirm each one on their card."
          exampleJson={PLAYER_IMPORT_EXAMPLE}
          validate={validatePlayerRows}
          commit={(inputs) => bulkCreatePlayers(teamId, team, inputs, firebaseUser.uid)}
          onClose={() => setShowImportPlayers(false)}
          onImported={(n) => {
            setShowImportPlayers(false);
            setImportNotice(
              `Imported ${n} player${n === 1 ? '' : 's'} with consent not given — confirm each one on their card.`
            );
            window.setTimeout(() => setImportNotice(null), 6000);
            setRosterRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
