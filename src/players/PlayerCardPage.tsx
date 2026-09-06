import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getPlayer } from './playersApi';
import { getTeam } from '../teams/teamsApi';
import { PlayerContactSection } from './PlayerContactSection';
import { PlayerSkillsSection } from './PlayerSkillsSection';
import type { Player } from '../types/player';

export function PlayerCardPage() {
  const { teamId, playerId } = useParams<{ teamId: string; playerId: string }>();
  const { firebaseUser } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId || !playerId) return;
    setError(null);
    void Promise.all([getPlayer(teamId, playerId), getTeam(teamId)])
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
    </div>
  );
}
