import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';
import { EditButton } from '../components/EditButton';
import { StatusChip } from '../components/StatusChip';
import { getTeam } from '../teams/teamsApi';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';
import type { Player } from '../types/player';
import { GuardiansSection } from './GuardiansSection';
import { PhysicalTestingSection } from './PhysicalTestingSection';
import { listAllPhysicalTests } from './physicalTestsApi';
import { PlayerContactSection } from './PlayerContactSection';
import { nextObjective } from './playerDashboard';
import { downloadPlayerExport } from './playerExport';
import { PlayerIdentityCard } from './PlayerIdentityCard';
import { PlayerKpiTiles } from './PlayerKpiTiles';
import { deletePlayer, getPlayer, updatePlayerDevelopmentPlan } from './playersApi';
import { PlayerSkillsSection } from './PlayerSkillsSection';

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
      className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card ${className}`.trim()}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {action}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </section>
  );
}

export function PlayerCardPage() {
  const { teamId, playerId } = useParams<{ teamId: string; playerId: string }>();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [latestByType, setLatestByType] = useState<Partial<Record<PhysicalTestType, PhysicalTest | null>>>({});
  const [editingSection, setEditingSection] = useState<'skills' | 'plan' | 'contact' | 'guardians' | null>(null);

  useEffect(() => {
    if (!teamId || !playerId) return;
    setError(null);
    void Promise.all([getPlayer(teamId, playerId), getTeam(teamId).catch(() => null)])
      .then(([fetchedPlayer, fetchedTeam]) => {
        setPlayer(fetchedPlayer);
        setIsAdmin(Boolean(firebaseUser?.email && fetchedTeam?.adminEmails.includes(firebaseUser.email)));
      })
      .catch(() => setError("You don't have access to this player."));
  }, [teamId, playerId, firebaseUser?.email]);

  const handleLatestLoaded = useCallback(
    (next: Partial<Record<PhysicalTestType, PhysicalTest | null>>) => setLatestByType(next),
    []
  );

  if (error) {
    return (
      <p role="alert" className="p-6 text-red">
        {error}
      </p>
    );
  }

  if (!player || !teamId || !playerId) return <p className="p-6 text-slate">Loading player...</p>;

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

  async function handleExport() {
    setExportError(null);
    try {
      const tests = await listAllPhysicalTests(teamId!, playerId!);
      downloadPlayerExport(player!, tests);
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
        {/* Region A — identity, at-a-glance stats, skills */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)] lg:h-[30rem]">
          <div className="md:col-span-2 lg:col-span-4 lg:row-span-2">
            <PlayerIdentityCard player={player} />
          </div>
          <div className="md:col-span-2 lg:col-span-8 lg:row-start-1 lg:col-start-5">
            <PlayerKpiTiles player={player} latestByType={latestByType} />
          </div>
          <Tile
            title="Skills"
            action={editAction('skills', 'Edit skills')}
            className="md:col-span-2 lg:col-span-8 lg:col-start-5 lg:row-start-2"
          >
            <PlayerSkillsSection
              teamId={teamId}
              playerId={playerId}
              player={player}
              onPlayerUpdated={setPlayer}
              isAdmin={isAdmin}
              editing={editingSection === 'skills'}
              onEditingChange={(v) => setEditingSection(v ? 'skills' : null)}
            />
          </Tile>
        </div>

        {/* Region B — the two deep panels */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:h-[30rem]">
          <Tile title="Physical testing">
            <PhysicalTestingSection
              teamId={teamId}
              playerId={playerId}
              isAdmin={isAdmin}
              onLatestLoaded={handleLatestLoaded}
            />
          </Tile>
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

        {/* Region C — next action, contacts, and (admin) data controls */}
        <div
          className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:h-[16rem] ${
            isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
          }`}
        >
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

          {isAdmin && (
            <Tile title="Data & privacy">
              <div className="flex h-full flex-col">
                <p className="text-sm text-slate">
                  Export produces a JSON file with this player&apos;s full record and physical-test history. Deleting a
                  player also removes their physical-test history.
                </p>
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
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title={`Delete ${player.fullName}?`}
          message="This will permanently delete this player's card, including contact info, skills, development plan, and physical test history. This cannot be undone."
          confirmLabel="Yes, delete player"
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
          error={deleteError}
        />
      )}
    </div>
  );
}
