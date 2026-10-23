import { NotFoundState, isNotFoundError } from '../components/NotFoundState';
import { usePageMeta } from '../layout/usePageMeta';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isTeamAdmin } from '../teams/teamAccess';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';
import { EditButton } from '../components/EditButton';
import { StatusChip } from '../components/StatusChip';
import { listFinishedMatches } from '../matches/matchesApi';
import { getTeam } from '../teams/teamsApi';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';
import type { Player } from '../types/player';
import { GuardiansSection } from './GuardiansSection';
import { PhysicalTestingSection } from './PhysicalTestingSection';
import { listAllPhysicalTests } from './physicalTestsApi';
import { PlayerContactSection } from './PlayerContactSection';
import { nextObjective } from './playerDashboard';
import { downloadPlayerExport } from './playerExport';
import { loadPlayerFootprint } from './playerFootprintApi';
import { PlayerIdentityCard } from './PlayerIdentityCard';
import { matchRatings, seasonStats, type SeasonStats } from './matchRating';
import { PlayerMatchStatsSection } from './PlayerMatchStatsSection';
import { PlayerKpiTiles } from './PlayerKpiTiles';
import { ageFromDob } from './age';
import { deletePlayer, getPlayer, recordPlayerConsent, setPhotoConsent, setPlayerLeftClub, updatePlayerDevelopmentPlan } from './playersApi';
import { deletionDueDate, todayIso } from './retention';
import { PlayerSkillsSection } from './PlayerSkillsSection';
import { PageSkeleton } from '../components/Skeleton';
import { SectionTabs } from '../components/SectionTabs';
import { SuggestionToggle } from './SuggestionToggle';
import { readSuggestionPref, writeSuggestionPref } from './suggestionPref';

function Tile({
  title,
  action,
  className = '',
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col rounded-lg border border-border bg-surface shadow-card ${className}`.trim()}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {action}
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

type PlayerSection = 'skills' | 'matches' | 'physical' | 'plan' | 'contact' | 'privacy';
const SECTION_ORDER: PlayerSection[] = ['skills', 'matches', 'physical', 'plan', 'contact', 'privacy'];
const ADMIN_SECTIONS: PlayerSection[] = ['matches', 'privacy'];
const SECTION_LABEL: Record<PlayerSection, string> = {
  skills: 'Skills',
  matches: 'Matches',
  physical: 'Physical',
  plan: 'Plan',
  contact: 'Contact',
  privacy: 'Privacy',
};

export function PlayerCardPage() {
  usePageMeta({ title: 'Player' });
  const { teamId, playerId } = useParams<{ teamId: string; playerId: string }>();
  const navigate = useNavigate();
  const { appUser, access } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [latestByType, setLatestByType] = useState<Partial<Record<PhysicalTestType, PhysicalTest | null>>>({});
  const [editingSection, setEditingSection] = useState<'skills' | 'plan' | 'contact' | 'guardians' | null>(null);
  const [season, setSeason] = useState<SeasonStats | null>(null);
  const [matchStatsError, setMatchStatsError] = useState(false);

  useEffect(() => {
    if (!teamId || !playerId) return;
    setError(null);
    setNotFound(false);
    void Promise.all([getPlayer(teamId, playerId), getTeam(teamId).catch(() => null)])
      .then(([fetchedPlayer, fetchedTeam]) => {
        if (!fetchedPlayer) {
          setNotFound(true);
          return;
        }
        setPlayer(fetchedPlayer);
        setIsAdmin(!!fetchedTeam && isTeamAdmin(fetchedTeam, appUser?.email, access));
      })
      .catch((e) => (isNotFoundError(e) ? setNotFound(true) : setError('Could not load this player.')));
  }, [teamId, playerId, appUser?.email, access]);

  const handleLatestLoaded = useCallback(
    (next: Partial<Record<PhysicalTestType, PhysicalTest | null>>) => setLatestByType(next),
    []
  );

  // Matches are team-admin data: only admins load them, viewers never query.
  useEffect(() => {
    if (!isAdmin || !teamId || !playerId) return;
    let active = true;
    setSeason(null);
    setMatchStatsError(false);
    listFinishedMatches(teamId)
      .then((matches) => {
        if (active) setSeason(seasonStats(matches, playerId));
      })
      .catch(() => {
        if (active) setMatchStatsError(true);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, teamId, playerId]);

  const ratings = useMemo(() => (season ? matchRatings(season) : undefined), [season]);
  const [showSuggestions, setShowSuggestions] = useState(readSuggestionPref);
  const hasSuggestions = isAdmin && !!ratings && Object.values(ratings).some((r) => r?.rating != null);
  const [section, setSection] = useState<PlayerSection>('skills');
  const sections = SECTION_ORDER.filter((id) => isAdmin || !ADMIN_SECTIONS.includes(id)).map((id) => ({ id, label: SECTION_LABEL[id] }));

  if (notFound) {
    return <NotFoundState title="Player not found" message="It may have been deleted, or you don't have access." backTo={`/teams/${teamId}`} backLabel="Back to team" />;
  }

  if (error) {
    return (
      <p role="alert" className="p-6 text-red">
        {error}
      </p>
    );
  }

  if (!player || !teamId || !playerId) return <PageSkeleton layout="player" label="Loading player..." />;

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deletePlayer(teamId!, playerId!);
    } catch {
      setDeleteError('Could not delete this player. Please try again.');
      return;
    }
    navigate(`/teams/${teamId}`, { replace: true });
  }

  async function handleRecordConsent() {
    if (!appUser?.email) return;
    setConsentError(null);
    try {
      const consent = await recordPlayerConsent(teamId!, playerId!, appUser.email);
      setPlayer({ ...player!, consent });
    } catch {
      setConsentError('Could not record consent. Please try again.');
    }
  }

  async function handlePhotoConsent(given: boolean) {
    if (!appUser?.email || !player) return;
    setPhotoError(null);
    try {
      await setPhotoConsent(teamId!, playerId!, given, appUser.email);
      setPlayer({ ...player, photoConsent: given, photoConsentAt: given ? new Date() : null, photoConsentBy: given ? appUser.email : null });
    } catch {
      setPhotoError('Could not update photo consent. Please try again.');
    }
  }

  async function handleLeftClub(date: string | null) {
    setLeftError(null);
    try {
      await setPlayerLeftClub(teamId!, playerId!, date);
      setPlayer({ ...player!, leftClubAt: date });
    } catch {
      setLeftError('Could not update membership. Please try again.');
    }
  }

  async function handleExport() {
    setExportError(null);
    try {
      const [tests, footprint] = await Promise.all([
        listAllPhysicalTests(teamId!, playerId!),
        loadPlayerFootprint(teamId!, playerId!),
      ]);
      downloadPlayerExport(player!, tests, footprint);
    } catch {
      setExportError("Could not export this player's data. Please try again.");
      return;
    }
  }

  const next = nextObjective(player.developmentPlan);
  const editAction = (section: typeof editingSection, label: string) =>
    isAdmin ? <EditButton label={label} onClick={() => setEditingSection(section)} /> : undefined;

  return (
    <div className="w-full bg-bg p-4 lg:p-6">
      <div className="flex flex-col gap-4">
        {/* Always in view: who this is and the numbers at a glance. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <PlayerIdentityCard player={player} />
          </div>
          <div className="lg:col-span-8">
            <PlayerKpiTiles player={player} latestByType={latestByType} />
          </div>
        </div>

        <SectionTabs label="Player sections" tabs={sections} active={section} onChange={setSection} />

        {/* Every section stays mounted (hidden when inactive): switching never
            refetches, and Physical keeps feeding the KPI tiles above. */}
        <div role="tabpanel" aria-label={SECTION_LABEL.skills} hidden={section !== 'skills'}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Tile
              title="Skills"
              action={
                <div className="flex items-center gap-1">
                  {hasSuggestions && (
                    <SuggestionToggle on={showSuggestions} onChange={(on) => { setShowSuggestions(on); writeSuggestionPref(on); }} />
                  )}
                  {editAction('skills', 'Edit skills')}
                </div>
              }
              className="lg:col-span-2"
            >
              <PlayerSkillsSection
                teamId={teamId}
                playerId={playerId}
                player={player}
                onPlayerUpdated={setPlayer}
                isAdmin={isAdmin}
                ratings={isAdmin ? ratings : undefined}
                showSuggestions={showSuggestions}
                editing={editingSection === 'skills'}
                onEditingChange={(v) => setEditingSection(v ? 'skills' : null)}
              />
            </Tile>
            <Tile title="Next objective">
              {next ? (
                <div>
                  <p className="font-medium text-ink">{next.objective}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusChip status={next.status} />
                    <span className="text-xs text-slate">
                      {next.targetDate ? `Due ${next.targetDate}` : 'No target date'}
                    </span>
                  </div>
                  {next.coachComment && <p className="mt-2 text-sm text-slate">{next.coachComment}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate">No open short-term objectives.</p>
              )}
            </Tile>
          </div>
        </div>
        {isAdmin && (
          <div role="tabpanel" aria-label={SECTION_LABEL.matches} hidden={section !== 'matches'}>
          <Tile title="Match stats">
            <PlayerMatchStatsSection teamId={teamId} season={season} error={matchStatsError} />
          </Tile>
        </div>
        )}
        <div role="tabpanel" aria-label={SECTION_LABEL.physical} hidden={section !== 'physical'}>
          <Tile title="Physical testing">
            <PhysicalTestingSection
              teamId={teamId}
              playerId={playerId}
              isAdmin={isAdmin}
              storedLatest={player.latestTests}
              onLatestLoaded={handleLatestLoaded}
            />
          </Tile>
        </div>
        <div role="tabpanel" aria-label={SECTION_LABEL.plan} hidden={section !== 'plan'}>
          <Tile title="Development plan" action={editAction('plan', 'Edit plan')}>
            <DevelopmentPlanEditor
              plan={player.developmentPlan}
              onSave={(plan) =>
                updatePlayerDevelopmentPlan(teamId, playerId, plan).then(() =>
                  setPlayer({ ...player, developmentPlan: plan })
                )
              }
              isAdmin={isAdmin}
              editing={editingSection === 'plan'}
              onEditingChange={(v) => setEditingSection(v ? 'plan' : null)}
            />
          </Tile>
        </div>
        <div role="tabpanel" aria-label={SECTION_LABEL.contact} hidden={section !== 'contact'}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Tile title="Contact & registration" action={editAction('contact', 'Edit')}>
              <PlayerContactSection
                teamId={teamId}
                playerId={playerId}
                player={player}
                onPlayerUpdated={setPlayer}
                isAdmin={isAdmin}
                editing={editingSection === 'contact'}
                onEditingChange={(v) => setEditingSection(v ? 'contact' : null)}
              />
            </Tile>
            <Tile title="Guardians" action={editAction('guardians', 'Edit')}>
              <GuardiansSection
                teamId={teamId}
                playerId={playerId}
                player={player}
                onPlayerUpdated={setPlayer}
                isAdmin={isAdmin}
                editing={editingSection === 'guardians'}
                onEditingChange={(v) => setEditingSection(v ? 'guardians' : null)}
              />
            </Tile>
          </div>
        </div>
        {isAdmin && (
          <div role="tabpanel" aria-label={SECTION_LABEL.privacy} hidden={section !== 'privacy'}>
          <div className="max-w-xl">
            <Tile title="Data & privacy">
              <div className="flex h-full flex-col">
                {player.consent?.given ? (
                  <p className="mb-2 text-sm text-ink">
                    Guardian consent recorded
                    {player.consent.date && <span className="tabular-nums"> on {player.consent.date}</span>}
                    {player.consent.confirmedBy && <> by {player.consent.confirmedBy}</>}.
                  </p>
                ) : (
                  <div className="mb-3 rounded-md border border-orange bg-orange/10 p-3 text-sm text-ink">
                    <p className="font-medium">Guardian consent not recorded</p>
                    <label className="mt-2 flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                        className="mt-1"
                      />
                      I confirm a parent or legal guardian has consented to storing this player's data, including physical-test measurements and match statistics.
                    </label>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      disabled={!consentChecked}
                      onClick={() => void handleRecordConsent()}
                    >
                      Record consent
                    </Button>
                    {consentError && (
                      <p role="alert" className="mt-2 text-sm text-red">
                        {consentError}
                      </p>
                    )}
                  </div>
                )}
                {(ageFromDob(player.dob ?? '') ?? 0) >= 18 ? (
                  <p className="mb-3 text-sm text-slate">Adult: photos follow the club's own agreement with the player</p>
                ) : (
                  <div className="mb-3 text-sm text-ink">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={player.photoConsent === true}
                        onChange={(e) => void handlePhotoConsent(e.target.checked)}
                        className="mt-1"
                      />
                      Guardian consent to use photos in award cards
                    </label>
                    {player.photoConsent === true && player.photoConsentBy && (
                      <p className="mt-1 text-caption text-slate">Recorded by {player.photoConsentBy}.</p>
                    )}
                    {photoError && (
                      <p role="alert" className="mt-2 text-sm text-red">
                        {photoError}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-sm text-slate">
                  Export produces a JSON file with everything stored about this player: their record, physical tests,
                  testing-session entries and match stats. Deleting a player erases all of it and removes their name
                  and number from past match reports.
                </p>
                {player.leftClubAt ? (
                  <div className="mt-3 text-sm text-ink">
                    <p>
                      Left the club on <span className="tabular-nums">{player.leftClubAt}</span>. Their data is due for
                      deletion on <span className="tabular-nums">{deletionDueDate(player.leftClubAt)}</span>.
                    </p>
                    <Button variant="ghost" size="sm" className="mt-1" onClick={() => void handleLeftClub(null)}>
                      Still in the club
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 self-start"
                    onClick={() => void handleLeftClub(todayIso())}
                  >
                    Mark as left the club
                  </Button>
                )}
                {leftError && (
                  <p role="alert" className="mt-2 text-sm text-red">
                    {leftError}
                  </p>
                )}
                <div className="mt-auto flex flex-col gap-2 pt-3">
                  <Button variant="secondary" size="sm" onClick={() => void handleExport()}>
                    Export data (JSON)
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                    Delete player
                  </Button>
                </div>
                {exportError && (
                  <p role="alert" className="mt-3 text-sm text-red">
                    {exportError}
                  </p>
                )}
              </div>
            </Tile>
          </div>
        </div>
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title={`Delete ${player.fullName}?`}
          message="This will permanently delete this player's card (contact info, skills, development plan), their physical tests and testing-session entries, and remove their name and number from past match reports. This cannot be undone."
          confirmLabel="Yes, delete player"
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
          error={deleteError}
        />
      )}
    </div>
  );
}
