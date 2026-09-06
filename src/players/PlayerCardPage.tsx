import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPlayer } from './playersApi';
import { PlayerContactSection } from './PlayerContactSection';
import type { Player } from '../types/player';

export function PlayerCardPage() {
  const { teamId, playerId } = useParams<{ teamId: string; playerId: string }>();
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (!teamId || !playerId) return;
    void getPlayer(teamId, playerId).then(setPlayer);
  }, [teamId, playerId]);

  if (!player || !teamId || !playerId) return <p className="p-6 text-slate">Loading player...</p>;

  return (
    <div className="mx-auto max-w-2xl bg-bg p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">{player.fullName}</h1>
      <PlayerContactSection teamId={teamId} playerId={playerId} player={player} onPlayerUpdated={setPlayer} />
      <p className="mt-6 text-slate">Skills section coming in Task 13.</p>
    </div>
  );
}
