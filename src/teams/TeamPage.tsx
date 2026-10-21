import { usePageMeta } from '../layout/usePageMeta';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { isTeamAdmin } from './teamAccess';
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
import { PageHeader } from '../layout/PageHeader';
import { PageSkeleton } from '../components/Skeleton';
import { NotFoundState, isNotFoundError } from '../components/NotFoundState';
import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';
import { TeamCalendarTab } from '../calendar/TeamCalendarTab';
import { TeamMatchesTab } from '../matches/TeamMatchesTab';
import { TeamPhysicalSessionTab } from '../physicalSessions/TeamPhysicalSessionTab';
import type { Player } from '../types/player';
import type { Team } from '../types/team';
import { useNotify } from '../components/Notice';

const TeamStatsTab = lazy(() => import('./stats/TeamStatsTab'));

type TeamTab = 'roster' | 'calendar' | 'matches' | 'stats' | 'plan' | 'physical' | 'settings';
const TEAM_TABS: TeamTab[] = ['roster', 'calendar', 'matches', 'stats', 'plan', 'physical', 'settings'];
// Earlier tab ids, so old links and bookmarks still land on the right tab.
const LEGACY_TAB: Record<string, TeamTab> = { overview: 'roster', physicalSession: 'physical' };

export function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { firebaseUser, appUser, access } = useAuth();
  const canCalendar = !!access?.sections.trainings;
  const [team, setTeam] = useState<Team | null>(null);
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const requestedTab = (tabParam && LEGACY_TAB[tabParam]) || tabParam;
  const tab: TeamTab = TEAM_TABS.includes(requestedTab as TeamTab) ? (requestedTab as TeamTab) : 'roster';
  const [newMatchDate, setNewMatchDate] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showImportPlayers, setShowImportPlayers] = useState(false);
  const notify = useNotify();
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

  const changeTab = (next: TeamTab) => {
    const p = new URLSearchParams(params);
    // stats filter params belong to the Stats tab only
    for (const k of ['comp', 'ha', 'range', 'from', 'to']) p.delete(k);
    p.set('tab', next);
    setParams(p, { replace: true });
  };
  const admin = isTeamAdmin(team, appUser?.email, access);
  const activeTab = (tab === 'calendar' && !canCalendar) || (tab === 'stats' && !admin) ? 'roster' : tab;
  // Ordered by how often a coach reaches for them; Settings stays last.
  const tabs: { id: TeamTab; label: string }[] = [
    { id: 'roster', label: 'Roster' },
    ...(canCalendar ? [{ id: 'calendar' as const, label: 'Calendar' }] : []),
    { id: 'matches', label: 'Matches' },
    ...(admin ? [{ id: 'stats' as const, label: 'Stats' }] : []),
    { id: 'plan', label: 'Development plan' },
    { id: 'physical', label: 'Physical testing' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      {/* Title and tabs sit on the canvas; each tab brings its own cards (no card-in-card). */}
      <PageHeader
        title={team.name}
        description={team.description ? <span className="print:hidden">{team.description}</span> : undefined}
        className="mb-4"
      />

      <SectionTabs label="Team section" tabs={tabs} active={activeTab} onChange={changeTab} className="print:hidden" />

      <div className="mt-6">
        {activeTab === 'roster' && (
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
            <TeamRosterTable
              key={rosterRefreshKey}
              teamId={teamId}
              onPlayersChange={setRosterPlayers}
              onRosterChanged={() => {
                notify('Player removed.');
              }}
            />
          </>
        )}
        {activeTab === 'calendar' && canCalendar && (
          <TeamCalendarTab
            teamId={teamId}
            onNewMatch={(date) => {
              setNewMatchDate(date);
              changeTab('matches');
            }}
          />
        )}
        {activeTab === 'matches' && (
          <TeamMatchesTab teamId={teamId} newMatchDate={newMatchDate} onNewMatchHandled={() => setNewMatchDate(null)} />
        )}
        {activeTab === 'stats' && admin && (
          <Suspense fallback={<p className="text-slate">Loading team stats…</p>}>
            <TeamStatsTab team={team} />
          </Suspense>
        )}
        {activeTab === 'physical' && (
          <TeamPhysicalSessionTab
            teamId={teamId}
            team={team}
            onTeamChanged={setTeam}
          />
        )}
        {activeTab === 'plan' && (
          <div className="rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
            <DevelopmentPlanEditor
              plan={team.developmentPlan}
              onSave={(plan) => updateTeamDevelopmentPlan(teamId, plan).then(() => setTeam({ ...team, developmentPlan: plan }))}
              isAdmin={true}
            />
          </div>
        )}
        {activeTab === 'settings' && <TeamSettingsTab team={team} onTeamUpdated={setTeam} />}
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
            notify(
              `Imported ${n} player${n === 1 ? '' : 's'} with consent not given — confirm each one on their card.`,
              { durationMs: 6000 },
            );
            setRosterRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
