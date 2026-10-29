import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../i18n/I18nProvider';
import { getSession } from './testingSessionsApi';
import { listPlayers } from '../players/playersApi';
import { Plus } from 'lucide-react';
import { usePublishPageChrome } from '../layout/PageChrome';
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
  const s = useT().physicalSessions.tab;
  const [session, setSession] = useState<TestingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const p = useT().physicalSessions;

  useEffect(() => {
    if (!team.activeTestingSessionId) {
      setSession(null);
      return;
    }
    setError(null);
    getSession(teamId, team.activeTestingSessionId)
      .then(setSession)
      .catch(() => setError(s.loadSession));
  }, [teamId, team.activeTestingSessionId, s.loadSession]);

  useEffect(() => {
    let cancelled = false;
    setPlayersError(null);
    // The whole roster, not just the first page: a team can have more than one page of players.
    (async () => {
      let page = await listPlayers(teamId);
      const all = [...page.players];
      while (page.hasMore && page.lastDoc) {
        page = await listPlayers(teamId, page.lastDoc);
        all.push(...page.players);
      }
      if (!cancelled) setPlayers(all.filter((p) => !p.leftClubAt));
    })().catch(() => {
      if (!cancelled) setPlayersError(s.loadRoster);
    });
    return () => {
      cancelled = true;
    };
  }, [teamId, s.loadRoster]);

  const showingStart = !!players && !playersError && !error && !team.activeTestingSessionId;
  usePublishPageChrome({
    title: team.name,
    mainAction: showingStart ? { label: p.start.newSession, icon: Plus, onSelect: () => setStarting(true) } : undefined,
  });

  if (!firebaseUser) return null;

  if (playersError) {
    return <p role="alert" className="text-footnote text-red-strong">{playersError}</p>;
  }

  if (!players) {
    return <p className="text-footnote text-ink-2">{s.loadingRoster}</p>;
  }

  if (error) {
    return <p role="alert" className="text-footnote text-red-strong">{error}</p>;
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
    return <p className="text-footnote text-ink-2">{s.loadingSession}</p>;
  }

  return (
    <StartSessionCard
      teamId={teamId}
      creatorUid={firebaseUser.uid}
      starting={starting}
      onCloseStart={() => setStarting(false)}
      onRequestStart={() => setStarting(true)}
      onStarted={(sessionId) => {
        setStarting(false);
        onTeamChanged({ ...team, activeTestingSessionId: sessionId });
      }}
    />
  );
}
