import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { deletePlayer, getPlayer, updatePlayerDevelopmentPlan } from './playersApi';
import { listAllPhysicalTests } from './physicalTestsApi';
import { downloadPlayerExport } from './playerExport';
import { getTeam } from '../teams/teamsApi';
import { PlayerContactSection } from './PlayerContactSection';
import { PlayerSkillsSection } from './PlayerSkillsSection';
import { GuardiansSection } from './GuardiansSection';
import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';
import { PhysicalTestingSection } from './PhysicalTestingSection';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LevelPill } from '../components/LevelPill';
import { getInitials } from './nameFormat';
import type { Player } from '../types/player';

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

  return (
    <div className="w-full bg-bg p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue/10 text-lg font-bold text-blue">
          {getInitials(player.fullName)}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">{player.fullName}</h1>
            {player.avgScore !== null && <LevelPill level={player.level} />}
          </div>
          <p className="text-sm text-slate">
            #{player.number} · {player.position}
          </p>
        </div>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border bg-surface shadow-card">
        <PlayerContactSection
          teamId={teamId}
          playerId={playerId}
          player={player}
          onPlayerUpdated={setPlayer}
          isAdmin={isAdmin}
        />
        <PlayerSkillsSection
          teamId={teamId}
          playerId={playerId}
          player={player}
          onPlayerUpdated={setPlayer}
          isAdmin={isAdmin}
        />
        <GuardiansSection
          teamId={teamId}
          playerId={playerId}
          player={player}
          onPlayerUpdated={setPlayer}
          isAdmin={isAdmin}
        />
        <DevelopmentPlanEditor
          plan={player.developmentPlan}
          onSave={(plan) =>
            updatePlayerDevelopmentPlan(teamId, playerId, plan).then(() => setPlayer({ ...player, developmentPlan: plan }))
          }
          isAdmin={isAdmin}
        />
        <PhysicalTestingSection teamId={teamId} playerId={playerId} isAdmin={isAdmin} />
      </div>

      {isAdmin && (
        <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Data &amp; privacy</h2>
          <p className="mt-1 text-slate">
            Export produces a JSON file with this player&apos;s full record and physical-test history.
            Deleting a player also removes their physical-test history.
          </p>
          <div className="mt-3 flex items-center justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => void handleExport()}>
              Export data (JSON)
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              Delete player
            </Button>
          </div>
          {exportError && <p role="alert" className="mt-3 text-sm text-red">{exportError}</p>}
        </section>
      )}

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
