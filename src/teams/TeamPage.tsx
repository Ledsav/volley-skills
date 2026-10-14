import { usePageMeta } from '../layout/usePageMeta';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getTeam, updateTeamDevelopmentPlan } from './teamsApi';
import { TeamSettingsTab } from './TeamSettingsTab';
import { TeamRosterTable } from './TeamRosterTable';
import { TeamStatsRow } from './TeamStatsRow';
import { RetentionNotice } from './RetentionNotice';
import { AddPlayerDialog } from '../players/AddPlayerDialog';
import { useAuth } from '../auth/AuthContext';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { PLAYER_IMPORT_EXAMPLE, validatePlayerRows } from '../players/playersImport';
import { bulkCreatePlayers } from '../players/playersApi';
import { Button } from '../components/Button';
import { SectionTabs } from '../components/SectionTabs';
import { PageSkeleton } from '../components/Skeleton';
import { NotFoundState, isNotFoundError } from '../components/NotFoundState';
import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';
import { TeamCalendarTab } from '../calendar/TeamCalendarTab';
import { TeamMatchesTab } from '../matches/TeamMatchesTab';
import { TeamPhysicalSessionTab } from '../physicalSessions/TeamPhysicalSessionTab';
import type { Player } from '../types/player';
import type { Team } from '../types/team';

type TeamTab = 'overview' | 'calendar' | 'matches' | 'plan' | 'settings' | 'physicalSession';

export function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { firebaseUser, access } = useAuth();
  const canCalendar = !!access?.sections.trainings;
  const [team, setTeam] = useState<Team | null>(null);
  const [tab, setTab] = useState<TeamTab>('overview');
  const [newMatchDate, setNewMatchDate] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showImportPlayers, setShowImportPlayers] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [rosterRefreshKey, setRosterRefreshKey] = useState(0);
  const [rosterPlayers, setRosterPlayers] = useState<Player[]>([]);
  usePageMeta({ title: team?.name ?? 'Team' });

  useEffect(() => {
    if (!teamId) return;
    setNotFound(false);
    setLoadError(false);
    void getTeam(teamId)
      .then((t) => (t ? setTeam(t) : setNotFound(true)))
      .catch((e) => (isNotFoundError(e) ? setNotFound(true) : setLoadError(true)));
  }, [teamId, loadAttempt]);

  if (notFound) {
    return <NotFoundState title="Team not found" message="It may have been deleted, or you don't have access." backTo="/teams" backLabel="All teams" />;
  }

  if (loadError && !team) {
    return (
      <div role="alert" className="p-6">
        <p className="text-red">Could not load this team.</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setLoadAttempt((n) => n + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  if (!team || !teamId) return <PageSkeleton layout="team" label="Loading team..." />;

  const activeTab = tab === 'calendar' && !canCalendar ? 'overview' : tab;
  const tabs: { id: TeamTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(canCalendar ? [{ id: 'calendar' as const, label: 'Calendar' }] : []),
    { id: 'matches', label: 'Matches' },
    { id: 'physicalSession', label: 'Physical Session' },
    { id: 'plan', label: 'Development Plan' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <div className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">{team.name}</h1>
        <p className="mt-1 text-slate">{team.description}</p>

        <SectionTabs label="Team section" tabs={tabs} active={activeTab} onChange={setTab} className="mt-4" />

        <div className="mt-6">
          {activeTab === 'overview' && (
            <>
              <RetentionNotice teamId={teamId} onDeleted={() => setRosterRefreshKey((k) => k + 1)} />
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
              {importNotice && <p className="mb-4 text-sm text-green-strong">{importNotice}</p>}
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
          {activeTab === 'calendar' && canCalendar && (
            <TeamCalendarTab
              teamId={teamId}
              onNewMatch={(date) => {
                setNewMatchDate(date);
                setTab('matches');
              }}
            />
          )}
          {activeTab === 'matches' && (
            <TeamMatchesTab teamId={teamId} newMatchDate={newMatchDate} onNewMatchHandled={() => setNewMatchDate(null)} />
          )}
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
