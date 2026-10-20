import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PlayerRosterPicker } from './PlayerRosterPicker';
import { QualityTileGrid } from './QualityTileGrid';
import { subscribeEntries, closeSession, deleteSession } from './testingSessionsApi';
import { buildEntryId } from '../types/testingSession';
import type { TestingSession, TestingSessionEntry } from '../types/testingSession';
import type { Player } from '../types/player';
import { useNotify } from '../components/Notice';

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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const notify = useNotify();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    return subscribeEntries(
      teamId,
      session.id,
      (next) => {
        setEntries(next);
        setLoadError(null);
      },
      () => setLoadError('Could not load session progress. Please refresh the page.')
    );
  }, [teamId, session.id]);

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

  async function confirmDelete() {
    try {
      await deleteSession(teamId, session.id);
    } catch {
      setDeleteError('Could not delete the session. Please try again.');
      return;
    }
    setConfirmingDelete(false);
    notify('Session deleted.');
    onSessionClosed();
  }

  const finishedCount = entries.filter((e) => e.status === 'complete').length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate">
          Session started <span className="whitespace-nowrap tabular-nums">{session.date}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setDeleteError(null); setConfirmingDelete(true); }}>
            Delete session
          </Button>
          <Button variant="dangerGhost" size="sm" onClick={() => { setCloseError(null); setConfirmingClose(true); }}>
            Close session
          </Button>
        </div>
      </div>

      {loadError && <p role="alert" className="mb-3 text-sm text-red">{loadError}</p>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
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
          />
        )}
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this session?"
          message={`This also removes the ${finishedCount} result${finishedCount === 1 ? '' : 's'} recorded in it from the players' cards. This can't be undone.`}
          confirmLabel="Yes, delete"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setConfirmingDelete(false)}
          error={deleteError}
        />
      )}

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
