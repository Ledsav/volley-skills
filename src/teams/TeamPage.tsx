import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
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
import { Tab } from '../components/Tab';
import { FIELD_CLASS } from '../components/Input';
import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';
import { TeamCalendarTab } from '../calendar/TeamCalendarTab';
import { TeamPhysicalSessionTab } from '../physicalSessions/TeamPhysicalSessionTab';
import type { Player } from '../types/player';
import type { Team } from '../types/team';

type TeamTab = 'overview' | 'calendar' | 'plan' | 'settings' | 'physicalSession';

export function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { firebaseUser, access } = useAuth();
  const canCalendar = !!access?.sections.trainings;
  const [team, setTeam] = useState<Team | null>(null);
  const [tab, setTab] = useState<TeamTab>('overview');
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

  const activeTab = tab === 'calendar' && !canCalendar ? 'overview' : tab;
  const tabs: { id: TeamTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(canCalendar ? [{ id: 'calendar' as const, label: 'Calendar' }] : []),
    { id: 'physicalSession', label: 'Physical Session' },
    { id: 'plan', label: 'Development Plan' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <div className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">{team.name}</h1>
        <p className="mt-1 text-slate">{team.description}</p>

        {/* Phones get a full-width section picker (native OS picker on tap);
            five underline tabs don't fit a phone-width card without scrolling. */}
        <div className="relative mt-4 sm:hidden">
          <label htmlFor="team-section" className="sr-only">
            Team section
          </label>
          <select
            id="team-section"
            value={activeTab}
            onChange={(e) => setTab(e.target.value as TeamTab)}
            className={`${FIELD_CLASS} min-h-11 w-full cursor-pointer appearance-none pr-10 font-medium`}
          >
            {tabs.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate"
            aria-hidden="true"
          />
        </div>

        <nav className="mt-4 hidden flex-wrap gap-x-4 border-b border-border sm:flex md:gap-x-6">
          {tabs.map(({ id, label }) => (
            <Tab key={id} active={activeTab === id} onClick={() => setTab(id)}>
              {label}
            </Tab>
          ))}
        </nav>

        <div className="mt-6">
          {activeTab === 'overview' && (
            <>
              <TeamStatsRow players={rosterPlayers} />
              <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => setShowImportPlayers(true)}
                >
                  Import players
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => setShowAddPlayer(true)}
                >
                  + Add player
                </Button>
              </div>
              {importNotice && <p className="mb-4 text-sm text-green">{importNotice}</p>}
              <TeamRosterTable
                key={rosterRefreshKey}
                teamId={teamId}
                onPlayersChange={setRosterPlayers}
                onRosterChanged={() => {
                  setImportNotice('Player removed.');
                  window.setTimeout(() => setImportNotice(null), 4000);
                }}
              />
            </>
          )}
          {activeTab === 'calendar' && canCalendar && <TeamCalendarTab teamId={teamId} />}
          {activeTab === 'physicalSession' && (
            <TeamPhysicalSessionTab
              teamId={teamId}
              team={team}
              onTeamChanged={setTeam}
            />
          )}
          {activeTab === 'plan' && (
            <DevelopmentPlanEditor
              plan={team.developmentPlan}
              onSave={(plan) => updateTeamDevelopmentPlan(teamId, plan).then(() => setTeam({ ...team, developmentPlan: plan }))}
              isAdmin={true}
            />
          )}
          {activeTab === 'settings' && <TeamSettingsTab team={team} onTeamUpdated={setTeam} />}
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
