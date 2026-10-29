import { NotFoundState, isNotFoundError } from '../components/NotFoundState';
import { usePageMeta } from '../layout/usePageMeta';
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { isTeamAdmin } from '../teams/teamAccess';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';
import { StatusChip } from '../components/StatusChip';
import { listFinishedMatches } from '../matches/matchesApi';
import { getTeam } from '../teams/teamsApi';
import { teamGender } from '../teams/teamGender';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';
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
import { deletionDueDate } from './retention';
import { todayLocalIso } from '../dates/today';
import { PlayerSkillsSection } from './PlayerSkillsSection';
import { useSave } from '../components/useSave';
import { PendingDot, PlayerSyncProvider, usePlayerSync, type SyncKey } from './playerSync';
import { PageSkeleton } from '../components/Skeleton';
import { SegmentedControl } from '../components/SegmentedControl';
import { usePublishPageChrome } from '../layout/PageChrome';
import { EditPickerSheet, type EditTarget } from './EditPickerSheet';
import { SuggestionToggle } from './SuggestionToggle';
import { readSuggestionPref, writeSuggestionPref } from './suggestionPref';

function Section({
  title,
  trailing,
  className = '',
  pending = false,
  plain = false,
  children,
}: {
  title: string;
  trailing?: ReactNode;
  className?: string;
  pending?: boolean;
  /** The body brings its own groups, so no card around it. */
  plain?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={className}>
      <header className="flex min-h-11 items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2 text-title-3 text-ink">
          {title}
          <PendingDot pending={pending} />
        </h2>
        {trailing}
      </header>
      <div className={plain ? '' : 'rounded-lg bg-surface p-4 shadow-card'}>{children}</div>
    </section>
  );
}

type PlayerSection = 'skills' | 'matches' | 'physical' | 'plan' | 'contact' | 'privacy';
const SECTION_ORDER: PlayerSection[] = ['skills', 'matches', 'physical', 'plan', 'contact', 'privacy'];
const ADMIN_SECTIONS: PlayerSection[] = ['matches', 'privacy'];
export function PlayerCardPage() {
  return (
    <PlayerSyncProvider>
      <PlayerCardContent />
    </PlayerSyncProvider>
  );
}

function PlayerCardContent() {
  const t = useT();
  const sync = usePlayerSync();
  const consentSave = useSave();
  const photoSave = useSave();
  const leftSave = useSave();
  const planSave = useSave();
  const queue = (key: SyncKey) => ({ onQueued: (w: Promise<unknown>) => sync.queued(key, w) });
  const c = t.players.card;
  const SECTION_LABEL = c.sections;
  usePageMeta({ title: c.pageTitle });
  const { teamId, playerId } = useParams<{ teamId: string; playerId: string }>();
  const navigate = useNavigate();
  const { appUser, access } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [gender, setGender] = useState<Gender>('mixed');
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
  const [editingSection, setEditingSection] = useState<EditTarget | null>(null);
  const [picking, setPicking] = useState(false);
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
        setGender(fetchedTeam ? teamGender(fetchedTeam) : 'mixed');
      })
      .catch((e) => (isNotFoundError(e) ? setNotFound(true) : setError(c.loadError)));
  }, [teamId, playerId, appUser?.email, access, c.loadError]);

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

  // Nothing is published while loading, not found or errored.
  usePublishPageChrome(
    {
      title: player?.fullName,
      mainAction: isAdmin ? { label: c.edit, icon: Pencil, onSelect: () => setPicking(true) } : undefined,
      more: isAdmin
        ? [{ kind: 'action', label: c.deleteMenu(gender), danger: true, icon: <Trash2 size={16} />, onSelect: () => setShowDeleteConfirm(true) }]
        : [],
    },
    !!player && !notFound && !error,
  );

  if (notFound) {
    return <NotFoundState title={c.notFoundTitle(gender)} message={c.notFoundMessage(gender)} backTo={`/teams/${teamId}`} backLabel={c.backToTeam} />;
  }

  if (error) {
    return (
      <p role="alert" className="p-6 text-red-strong">
        {error}
      </p>
    );
  }

  if (!player || !teamId || !playerId) return <PageSkeleton layout="player" label={c.loading} />;

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deletePlayer(teamId!, playerId!);
    } catch {
      setDeleteError(c.deleteError(gender));
      return;
    }
    navigate(`/teams/${teamId}`, { replace: true });
  }

  async function handleRecordConsent() {
    if (!appUser?.email) return;
    setConsentError(null);
    try {
      const today = todayLocalIso();
      const done = await consentSave.save(() => recordPlayerConsent(teamId!, playerId!, appUser.email!, today), queue('consent'));
      if (!done) return;
      setPlayer({ ...player!, consent: { given: true, date: today, confirmedBy: appUser.email! } });
    } catch {
      setConsentError(c.consentError);
    }
  }

  async function handlePhotoConsent(given: boolean) {
    if (!appUser?.email || !player) return;
    setPhotoError(null);
    try {
      const done = await photoSave.save(() => setPhotoConsent(teamId!, playerId!, given, appUser.email!), queue('photo'));
      if (!done) return;
      setPlayer({ ...player, photoConsent: given, photoConsentAt: given ? new Date() : null, photoConsentBy: given ? appUser.email : null });
    } catch {
      setPhotoError(c.photoError);
    }
  }

  async function handleLeftClub(date: string | null) {
    setLeftError(null);
    try {
      const done = await leftSave.save(() => setPlayerLeftClub(teamId!, playerId!, date), queue('leftClub'));
      if (!done) return;
      setPlayer({ ...player!, leftClubAt: date });
    } catch {
      setLeftError(c.leftError);
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
      setExportError(c.exportError(gender));
      return;
    }
  }

  const next = nextObjective(player.developmentPlan);

  function pickEdit(target: EditTarget) {
    setPicking(false);
    setEditingSection(target);
    setSection(target === 'guardians' ? 'contact' : target);
  }

  return (
    <div className="w-full bg-bg p-4 lg:p-6">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-4">
        {sync.syncFailed && (
          <p role="alert" className="text-callout text-red-strong">
            {c.sync.failed}
          </p>
        )}
        <Link to={`/teams/${teamId}`} className="inline-flex min-h-11 items-center gap-1 self-start text-callout text-ink-2 hover:text-ink">
          <ChevronLeft size={18} aria-hidden="true" />
          {c.backToTeam}
        </Link>
        {/* Always in view: who this is and the numbers at a glance. */}
        <PlayerIdentityCard player={player} gender={gender} />
        <PlayerKpiTiles player={player} latestByType={latestByType} />

        <SegmentedControl semantics="tabs" label={c.sectionsLabel} options={sections} value={section} onChange={setSection} className="md:self-start" />

        {/* Every section stays mounted (hidden when inactive): switching never
            refetches, and Physical keeps feeding the KPI tiles above. */}
        <div role="tabpanel" aria-label={SECTION_LABEL.skills} hidden={section !== 'skills'}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Section
              title={c.tiles.skills}
              pending={sync.isPending('skills')}
              trailing={
                hasSuggestions ? (
                  <SuggestionToggle on={showSuggestions} onChange={(on) => { setShowSuggestions(on); writeSuggestionPref(on); }} />
                ) : undefined
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
                gender={gender}
                editing={editingSection === 'skills'}
                onEditingChange={(v) => setEditingSection(v ? 'skills' : null)}
              />
            </Section>
            <Section title={c.tiles.nextObjective}>
              {next ? (
                <div>
                  <p className="text-headline text-ink">{next.objective}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusChip status={next.status} />
                    <span className="text-footnote tabular-nums text-ink-2">
                      {next.targetDate ? c.due(next.targetDate) : c.noTargetDate}
                    </span>
                  </div>
                  {next.coachComment && <p className="mt-2 text-callout text-ink-2">{next.coachComment}</p>}
                </div>
              ) : (
                <p className="text-callout text-ink-2">{c.noOpenObjectives}</p>
              )}
            </Section>
          </div>
        </div>
        {isAdmin && (
          <div role="tabpanel" aria-label={SECTION_LABEL.matches} hidden={section !== 'matches'}>
            <Section title={c.tiles.matchStats}>
              <PlayerMatchStatsSection gender={gender} teamId={teamId} season={season} error={matchStatsError} />
            </Section>
          </div>
        )}
        <div role="tabpanel" aria-label={SECTION_LABEL.physical} hidden={section !== 'physical'}>
          <Section title={c.tiles.physicalTesting}>
            <PhysicalTestingSection
              teamId={teamId}
              playerId={playerId}
              isAdmin={isAdmin}
              storedLatest={player.latestTests}
              onLatestLoaded={handleLatestLoaded}
            />
          </Section>
        </div>
        <div role="tabpanel" aria-label={SECTION_LABEL.plan} hidden={section !== 'plan'}>
          <Section title={c.tiles.developmentPlan} pending={sync.isPending('plan')}>
            <DevelopmentPlanEditor
              plan={player.developmentPlan}
              onSave={async (plan) => {
                const done = await planSave.save(() => updatePlayerDevelopmentPlan(teamId, playerId, plan), queue('plan'));
                if (done) setPlayer({ ...player, developmentPlan: plan });
              }}
              isAdmin={isAdmin}
              editing={editingSection === 'plan'}
              onEditingChange={(v) => setEditingSection(v ? 'plan' : null)}
            />
          </Section>
        </div>
        <div role="tabpanel" aria-label={SECTION_LABEL.contact} hidden={section !== 'contact'}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Section title={c.tiles.contact} pending={sync.isPending('contact')}>
              <PlayerContactSection
                teamId={teamId}
                playerId={playerId}
                player={player}
                onPlayerUpdated={setPlayer}
                isAdmin={isAdmin}
                gender={gender}
                editing={editingSection === 'contact'}
                onEditingChange={(v) => setEditingSection(v ? 'contact' : null)}
              />
            </Section>
            <Section title={c.tiles.guardians} pending={sync.isPending('guardians')}>
              <GuardiansSection
                teamId={teamId}
                playerId={playerId}
                player={player}
                onPlayerUpdated={setPlayer}
                isAdmin={isAdmin}
                editing={editingSection === 'guardians'}
                onEditingChange={(v) => setEditingSection(v ? 'guardians' : null)}
              />
            </Section>
          </div>
        </div>
        {isAdmin && (
          <div role="tabpanel" aria-label={SECTION_LABEL.privacy} hidden={section !== 'privacy'}>
            <Section title={c.tiles.privacy} className="max-w-[720px]" plain>
              <div className="flex flex-col gap-4 text-callout text-ink">
                <div className="rounded-lg bg-surface p-4 shadow-card">
                  {player.consent?.given ? (
                    <p>
                      {c.consentRecorded}
                      <PendingDot pending={sync.isPending('consent')} />
                      {player.consent.date && <span className="tabular-nums">{c.consentOn}{player.consent.date}</span>}
                      {player.consent.confirmedBy && <>{c.consentBy}{player.consent.confirmedBy}</>}.
                    </p>
                  ) : (
                    <div className="rounded-lg bg-orange-tint p-3">
                      <p className="text-headline">{c.consentMissing}</p>
                      <label className="mt-2 flex min-h-11 items-start gap-2">
                        <input
                          type="checkbox"
                          checked={consentChecked}
                          onChange={(e) => setConsentChecked(e.target.checked)}
                          className="mt-1"
                        />
                        {t.players.shared.consent(gender)}
                      </label>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        disabled={!consentChecked}
                        onClick={() => void handleRecordConsent()}
                      >
                        {c.recordConsent}
                      </Button>
                      {consentError && (
                        <p role="alert" className="mt-2 text-red-strong">
                          {consentError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-surface p-4 shadow-card">
                  {(ageFromDob(player.dob ?? '') ?? 0) >= 18 ? (
                    <p className="text-ink-2">{c.adultPhotos}</p>
                  ) : (
                    <div>
                      <label className="flex min-h-11 items-start gap-2">
                        <input
                          type="checkbox"
                          checked={player.photoConsent === true}
                          onChange={(e) => void handlePhotoConsent(e.target.checked)}
                          className="mt-1"
                        />
                        {c.photoConsent}
                        <PendingDot pending={sync.isPending('photo')} />
                      </label>
                      {player.photoConsent === true && player.photoConsentBy && (
                        <p className="mt-1 text-caption text-ink-2">{c.photoRecordedBy(player.photoConsentBy)}</p>
                      )}
                      {photoError && (
                        <p role="alert" className="mt-2 text-red-strong">
                          {photoError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-surface p-4 shadow-card">
                  {player.leftClubAt ? (
                    <div>
                      <p>
                        {c.leftBefore}<span className="tabular-nums">{player.leftClubAt}</span>{c.leftMiddle}<span className="tabular-nums">{deletionDueDate(player.leftClubAt)}</span>{c.leftAfter}
                      </p>
                      <PendingDot pending={sync.isPending('leftClub')} />
                      <Button variant="ghost" size="sm" className="mt-1" onClick={() => void handleLeftClub(null)}>
                        {c.stillInClub}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => void handleLeftClub(todayLocalIso())}>
                        {c.markLeft(gender)}
                      </Button>
                      <PendingDot pending={sync.isPending('leftClub')} />
                    </div>
                  )}
                  {leftError && (
                    <p role="alert" className="mt-2 text-red-strong">
                      {leftError}
                    </p>
                  )}
                </div>
                <div className="rounded-lg bg-surface p-4 shadow-card">
                  <p className="text-ink-2">{c.exportInfo(gender)}</p>
                  <Button variant="secondary" size="sm" className="mt-3" onClick={() => void handleExport()}>
                    {c.exportButton}
                  </Button>
                  {exportError && (
                    <p role="alert" className="mt-3 text-red-strong">
                      {exportError}
                    </p>
                  )}
                </div>
              </div>
            </Section>
          </div>
        )}
      </div>

      {picking && <EditPickerSheet onPick={pickEdit} onClose={() => setPicking(false)} />}
      {showDeleteConfirm && (
        <ConfirmDialog
          title={c.deleteTitle(player.fullName)}
          message={c.deleteMessage(gender)}
          confirmLabel={c.deleteConfirm(gender)}
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
          error={deleteError}
        />
      )}
    </div>
  );
}
