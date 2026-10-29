import { usePageMeta } from '../layout/usePageMeta';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { isTeamAdmin } from './teamAccess';
import { getTeam, updateTeamDevelopmentPlan } from './teamsApi';
import { TeamSettingsTab } from './TeamSettingsTab';
import { TeamRosterTable } from './TeamRosterTable';
import { TeamStatsRow } from './TeamStatsRow';
import { RetentionNotice } from './RetentionNotice';
import { TeamGenderPrompt } from './TeamGenderPrompt';
import { ITALIAN_ENABLED } from '../i18n/locales';
import { AddPlayerDialog } from '../players/AddPlayerDialog';
import { useAuth } from '../auth/AuthContext';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { PLAYER_IMPORT_EXAMPLE, validatePlayerRows } from '../players/playersImport';
import { playerImportIssueText } from '../players/playersImportMessages';
import { bulkCreatePlayers } from '../players/playersApi';
import { Button } from '../components/Button';
import type { MenuItem } from '../components/Menu';
import { SegmentedControl } from '../components/SegmentedControl';
import { useWindowScrolled } from '../layout/useWindowScrolled';
import { Pencil, Upload, UserPlus } from 'lucide-react';
import { PageHeader } from '../layout/PageHeader';
import { useTakePendingAction } from '../search/pendingAction';
import { PageSkeleton } from '../components/Skeleton';
import { NotFoundState, isNotFoundError } from '../components/NotFoundState';
import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';
import { TeamCalendarTab } from '../calendar/TeamCalendarTab';
import { TeamMatchesTab } from '../matches/TeamMatchesTab';
import { TeamPhysicalSessionTab } from '../physicalSessions/TeamPhysicalSessionTab';
import type { Player } from '../types/player';
import type { Team } from '../types/team';
import { useNotify } from '../components/Notice';
import { useT } from '../i18n/I18nProvider';
import { teamGender } from './teamGender';

const TeamStatsTab = lazy(() => import('./stats/TeamStatsTab'));

type TeamTab = 'roster' | 'calendar' | 'matches' | 'stats' | 'plan' | 'physical' | 'settings';
// Tabs that publish their own toolbar chrome while active; the page header stays quiet then.
const OWN_CHROME = new Set<TeamTab>(['matches', 'calendar', 'physical']);
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
  const [planEditing, setPlanEditing] = useState(false);
  const scrolled = useWindowScrolled();
  useTakePendingAction('add-player', () => setShowAddPlayer(true));
  const notify = useNotify();
  const [rosterRefreshKey, setRosterRefreshKey] = useState(0);
  const [rosterPlayers, setRosterPlayers] = useState<Player[]>([]);
  const t = useT();
  usePageMeta({ title: team?.name ?? t.teams.page.pageTitle });

  useEffect(() => {
    if (!teamId) return;
    setNotFound(false);
    setLoadError(false);
    void getTeam(teamId)
      .then((loaded) => (loaded ? setTeam(loaded) : setNotFound(true)))
      .catch((e) => (isNotFoundError(e) ? setNotFound(true) : setLoadError(true)));
  }, [teamId, loadAttempt]);

  if (notFound) {
    return <NotFoundState title={t.teams.page.notFoundTitle} message={t.teams.page.notFoundMessage} backTo="/teams" backLabel={t.teams.page.allTeams} />;
  }

  if (loadError && !team) {
    return (
      <div role="alert" className="p-6">
        <p className="text-red-strong">{t.teams.page.loadError}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setLoadAttempt((n) => n + 1)}>
          {t.teams.page.tryAgain}
        </Button>
      </div>
    );
  }

  if (!team || !teamId) return <PageSkeleton layout="team" label={t.teams.page.loading} />;

  const changeTab = (next: TeamTab) => {
    const p = new URLSearchParams(params);
    // stats filter params belong to the Stats tab only
    // `session` belongs to the Calendar tab
    for (const k of ['comp', 'ha', 'range', 'from', 'to', 'session']) p.delete(k);
    p.set('tab', next);
    setParams(p, { replace: true });
  };
  const admin = isTeamAdmin(team, appUser?.email, access);
  const gender = teamGender(team);
  const activeTab = (tab === 'calendar' && !canCalendar) || (tab === 'stats' && !admin) ? 'roster' : tab;
  // Ordered by how often a coach reaches for them; Settings stays last.
  const tabs: { id: TeamTab; label: string }[] = [
    { id: 'roster', label: t.teams.page.tabs.roster },
    ...(canCalendar ? [{ id: 'calendar' as const, label: t.teams.page.tabs.calendar }] : []),
    { id: 'matches', label: t.teams.page.tabs.matches },
    ...(admin ? [{ id: 'stats' as const, label: t.teams.page.tabs.stats }] : []),
    { id: 'plan', label: t.teams.page.tabs.plan },
    { id: 'physical', label: t.teams.page.tabs.physical },
    { id: 'settings', label: t.teams.page.tabs.settings },
  ];

  const mainAction =
    activeTab === 'roster'
      ? { label: t.teams.page.addPlayer(gender), icon: UserPlus, onSelect: () => setShowAddPlayer(true) }
      : activeTab === 'plan'
        ? { label: t.teams.page.editPlan, icon: Pencil, onSelect: () => setPlanEditing(true) }
        : undefined;
  const more: MenuItem[] | undefined =
    activeTab === 'roster'
      ? [{ kind: 'action', label: t.teams.page.importPlayers, icon: <Upload size={16} />, onSelect: () => setShowImportPlayers(true) }]
      : undefined;

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      {/* Title and tabs sit on the canvas; each tab brings its own cards (no card-in-card). */}
      <PageHeader
        title={team.name}
        eyebrow={`${team.season} · ${team.ageGroup}`}
        description={team.description ? <span className="print:hidden">{team.description}</span> : undefined}
        publishChrome={!OWN_CHROME.has(activeTab)}
        mainAction={mainAction}
        more={more}
        className="mb-2"
      />

      {/* Pinned under the 52px toolbar; turns glass once the page scrolls, like the toolbar. */}
      <div
        style={{ top: 'calc(52px + env(safe-area-inset-top, 0px))' }}
        className={`sticky z-20 -mx-4 flex h-16 items-center px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 print:hidden ${scrolled ? 'glass' : 'bg-bg'}`}
      >
        <SegmentedControl
          semantics="tabs"
          label={t.teams.page.sectionLabel}
          options={tabs}
          value={activeTab}
          onChange={changeTab}
          className="w-full md:w-auto"
        />
      </div>

      <div role="tabpanel" aria-label={tabs.find((x) => x.id === activeTab)?.label} className="mt-4">
        {activeTab === 'roster' && (
          <>
            {ITALIAN_ENABLED && admin && !team.gender && (
              <TeamGenderPrompt teamId={teamId} onSaved={(gender) => setTeam({ ...team, gender })} />
            )}
            <RetentionNotice teamId={teamId} gender={gender} onDeleted={() => setRosterRefreshKey((k) => k + 1)} />
            <TeamStatsRow players={rosterPlayers} />
            <TeamRosterTable
              key={rosterRefreshKey}
              teamId={teamId}
              gender={gender}
              onPlayersChange={setRosterPlayers}
              onRosterChanged={() => {
                notify(t.teams.page.playerRemoved);
              }}
            />
          </>
        )}
        {activeTab === 'calendar' && canCalendar && (
          <TeamCalendarTab
            teamId={teamId}
            teamName={team.name}
            onNewMatch={(date) => {
              setNewMatchDate(date);
              changeTab('matches');
            }}
          />
        )}
        {activeTab === 'matches' && (
          <TeamMatchesTab teamId={teamId} teamName={team.name} gender={gender} newMatchDate={newMatchDate} onNewMatchHandled={() => setNewMatchDate(null)} admin={admin} />
        )}
        {activeTab === 'stats' && admin && (
          <Suspense fallback={<p className="text-ink-2">{t.teams.shared.loadingStats}</p>}>
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
          <section className="rounded-lg bg-surface p-4 shadow-card sm:p-6">
            <DevelopmentPlanEditor
              plan={team.developmentPlan}
              onSave={(plan) => updateTeamDevelopmentPlan(teamId, plan).then(() => setTeam({ ...team, developmentPlan: plan }))}
              isAdmin={true}
              editing={planEditing}
              onEditingChange={setPlanEditing}
            />
          </section>
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
          title={t.teams.page.importPlayersTitle}
          hint={t.teams.page.importPlayersHint}
          exampleJson={PLAYER_IMPORT_EXAMPLE}
          validate={validatePlayerRows}
          formatIssue={(issue) => playerImportIssueText(issue, t)}
          commit={(inputs) => bulkCreatePlayers(teamId, team, inputs, firebaseUser.uid)}
          onClose={() => setShowImportPlayers(false)}
          onImported={(n) => {
            setShowImportPlayers(false);
            notify(t.teams.page.playersImported(n, gender), { durationMs: 6000 });
            setRosterRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
