import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getSession } from './testingSessionsApi';
import { listPlayers } from '../players/playersApi';
import { StartSessionCard } from './StartSessionCard';
import { LiveSessionView } from './LiveSessionView';
import type { Team } from '../types/team';
import type { Player } from '../types/player';
import type { TestingSession } from '../types/testingSession';

interface TeamPhysicalSessionTabProps {
  teamId: string;
  team: Team;
  onTeamChanged: (team: Team) => void;
}

export function TeamPhysicalSessionTab({ teamId, team, onTeamChanged }: TeamPhysicalSessionTabProps) {
  const { firebaseUser } = useAuth();
  const [session, setSession] = useState<TestingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [playersError, setPlayersError] = useState<string | null>(null);

  useEffect(() => {
    if (!team.activeTestingSessionId) {
      setSession(null);
      return;
    }
    setError(null);
    getSession(teamId, team.activeTestingSessionId)
      .then(setSession)
      .catch(() => setError('Could not load the active session. Please refresh the page.'));
  }, [teamId, team.activeTestingSessionId]);

  useEffect(() => {
    setPlayersError(null);
    listPlayers(teamId)
      .then((page) => setPlayers(page.players))
      .catch(() => setPlayersError('Could not load the roster. Please refresh the page.'));
  }, [teamId]);

  if (!firebaseUser) return null;

  if (playersError) {
    return <p role="alert" className="text-sm text-red">{playersError}</p>;
  }

  if (!players) {
    return <p className="text-sm text-slate">Loading roster...</p>;
  }

  if (error) {
    return <p role="alert" className="text-sm text-red">{error}</p>;
  }

  if (team.activeTestingSessionId && session) {
    return (
      <LiveSessionView
        teamId={teamId}
        session={session}
        players={players}
        recordedByUid={firebaseUser.uid}
        onSessionClosed={() => {
          setSession(null);
          onTeamChanged({ ...team, activeTestingSessionId: null });
        }}
      />
    );
  }

  if (team.activeTestingSessionId) {
    return <p className="text-sm text-slate">Loading session...</p>;
  }

  return (
    <StartSessionCard
      teamId={teamId}
      creatorUid={firebaseUser.uid}
      onStarted={(sessionId) => onTeamChanged({ ...team, activeTestingSessionId: sessionId })}
    />
  );
}
