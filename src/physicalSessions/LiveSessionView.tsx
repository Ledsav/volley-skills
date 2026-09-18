import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PlayerRosterPicker } from './PlayerRosterPicker';
import { QualityTileGrid } from './QualityTileGrid';
import { getEntries, closeSession } from './testingSessionsApi';
import { buildEntryId } from '../types/testingSession';
import type { TestingSession, TestingSessionEntry } from '../types/testingSession';
import type { Player } from '../types/player';

interface LiveSessionViewProps {
  teamId: string;
  session: TestingSession;
  players: Player[];
  recordedByUid: string;
  onSessionClosed: () => void;
}

export function LiveSessionView({ teamId, session, players, recordedByUid, onSessionClosed }: LiveSessionViewProps) {
  const [entries, setEntries] = useState<TestingSessionEntry[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEntries(await getEntries(teamId, session.id));
  }, [teamId, session.id]);

  useEffect(() => {
    setLoadError(null);
    load().catch(() => setLoadError('Could not load session progress. Please refresh the page.'));
  }, [load]);

  const entriesByPlayerAndType = new Map<string, TestingSessionEntry>();
  for (const entry of entries) {
    entriesByPlayerAndType.set(buildEntryId(entry.playerId, entry.testType), entry);
  }

  async function confirmClose() {
    try {
      await closeSession(teamId, session.id);
    } catch {
      setCloseError('Could not close the session. Please try again.');
      return;
    }
    setConfirmingClose(false);
    onSessionClosed();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate">
          Session started <span className="whitespace-nowrap tabular-nums">{session.date}</span>
        </p>
        <Button variant="dangerGhost" size="sm" className="shrink-0" onClick={() => { setCloseError(null); setConfirmingClose(true); }}>
          Close session
        </Button>
      </div>

      {loadError && <p role="alert" className="mb-3 text-sm text-red">{loadError}</p>}

      <div className="flex flex-col gap-4">
        <PlayerRosterPicker players={players} entries={entries} selectedPlayerId={selectedPlayerId} onSelect={setSelectedPlayerId} />
        {selectedPlayerId && (
          <QualityTileGrid
            teamId={teamId}
            sessionId={session.id}
            sessionDate={session.date}
            playerId={selectedPlayerId}
            playerName={players.find((p) => p.id === selectedPlayerId)?.fullName ?? ''}
            entriesByPlayerAndType={entriesByPlayerAndType}
            recordedByUid={recordedByUid}
            onEntryChanged={() => void load()}
          />
        )}
      </div>

      {confirmingClose && (
        <ConfirmDialog
          title="Close this session?"
          message="Entries already finished stay on each player's card. This can't be reopened."
          confirmLabel="Yes, close"
          onConfirm={() => void confirmClose()}
          onCancel={() => setConfirmingClose(false)}
          error={closeError}
        />
      )}
    </div>
  );
}
