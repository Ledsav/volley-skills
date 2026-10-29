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
import { useT } from '../i18n/I18nProvider';

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
  const t = useT();
  const s = t.physicalSessions;
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
      () => setLoadError(s.live.loadError)
    );
  }, [teamId, session.id, s.live.loadError]);

  const entriesByPlayerAndType = new Map<string, TestingSessionEntry>();
  for (const entry of entries) {
    entriesByPlayerAndType.set(buildEntryId(entry.playerId, entry.testType), entry);
  }

  async function confirmClose() {
    try {
      await closeSession(teamId, session.id);
    } catch {
      setCloseError(s.live.couldNotClose);
      return;
    }
    setConfirmingClose(false);
    onSessionClosed();
  }

  async function confirmDelete() {
    try {
      await deleteSession(teamId, session.id);
    } catch {
      setDeleteError(t.common.couldNotDeleteSession);
      return;
    }
    setConfirmingDelete(false);
    notify(s.shared.sessionDeleted);
    onSessionClosed();
  }

  const finishedCount = entries.filter((e) => e.status === 'complete').length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-footnote text-ink-2">
          {s.live.started} <span className="whitespace-nowrap tabular-nums">{session.date}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setDeleteError(null); setConfirmingDelete(true); }}>
            {s.shared.deleteSession}
          </Button>
          <Button variant="dangerGhost" size="sm" onClick={() => { setCloseError(null); setConfirmingClose(true); }}>
            {s.live.closeSession}
          </Button>
        </div>
      </div>

      {loadError && <p role="alert" className="mb-3 text-footnote text-red-strong">{loadError}</p>}

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <PlayerRosterPicker players={players} entries={entries} selectedPlayerId={selectedPlayerId} onSelect={setSelectedPlayerId} />
        {selectedPlayerId && (
          <QualityTileGrid
            teamId={teamId}
            sessionId={session.id}
            sessionDate={session.date}
            playerId={selectedPlayerId}
            playerName={players.find((p) => p.id === selectedPlayerId)?.fullName ?? ''}
            playerNumber={players.find((p) => p.id === selectedPlayerId)?.number}
            entriesByPlayerAndType={entriesByPlayerAndType}
            recordedByUid={recordedByUid}
          />
        )}
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title={s.shared.deleteTitle}
          message={s.shared.deleteMessage(finishedCount)}
          confirmLabel={s.shared.deleteConfirm}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setConfirmingDelete(false)}
          error={deleteError}
        />
      )}

      {confirmingClose && (
        <ConfirmDialog
          title={s.live.closeTitle}
          message={s.live.closeMessage}
          confirmLabel={s.live.closeConfirm}
          onConfirm={() => void confirmClose()}
          onCancel={() => setConfirmingClose(false)}
          error={closeError}
        />
      )}
    </div>
  );
}
