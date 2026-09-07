import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { deletePlayer, getPlayer, updatePlayerDevelopmentPlan } from './playersApi';
import { getTeam } from '../teams/teamsApi';
import { PlayerContactSection } from './PlayerContactSection';
import { PlayerSkillsSection } from './PlayerSkillsSection';
import { GuardiansSection } from './GuardiansSection';
import { DevelopmentPlanEditor } from '../components/DevelopmentPlanEditor';
import { PhysicalTestingSection } from './PhysicalTestingSection';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
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

  return (
    <div className="mx-auto max-w-2xl bg-bg p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">{player.fullName}</h1>
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

      {isAdmin && (
        <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Danger zone</h2>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-slate">Deleting a player also removes their physical test history.</p>
            <Button variant="destructive" size="sm" className="shrink-0" onClick={() => setShowDeleteConfirm(true)}>
              Delete player
            </Button>
          </div>
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
