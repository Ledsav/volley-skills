import { useState } from 'react';
import { useClubFeatures } from '../clubs/useClubFeatures';
import { visibleTestTypes } from '../types/physicalTest';
import type { PhysicalTestType } from '../types/physicalTest';
import { buildEntryId, type TestingSessionEntry } from '../types/testingSession';
import { SessionQualityPanel } from './SessionQualityPanel';
import { useT } from '../i18n/I18nProvider';

interface QualityTileGridProps {
  teamId: string;
  sessionId: string;
  sessionDate: string;
  playerId: string;
  playerName: string;
  entriesByPlayerAndType: Map<string, TestingSessionEntry>;
  recordedByUid: string;
  playerNumber?: number;
}

function entryStatus(entry: TestingSessionEntry | undefined): 'notStarted' | 'inProgress' | 'done' {
  if (!entry) return 'notStarted';
  return entry.status === 'complete' ? 'done' : 'inProgress';
}

export function QualityTileGrid({
  teamId,
  sessionId,
  sessionDate,
  playerId,
  playerName,
  entriesByPlayerAndType,
  recordedByUid,
  playerNumber,
}: QualityTileGridProps) {
  const { growthTestsEnabled } = useClubFeatures();
  const t = useT();
  const s = t.physicalSessions.tiles;
  const [openType, setOpenType] = useState<PhysicalTestType | null>(null);

  return (
    <div className="min-w-0 flex-1">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {visibleTestTypes(growthTestsEnabled).map((testType) => {
          const entry = entriesByPlayerAndType.get(buildEntryId(playerId, testType));
          const status = entryStatus(entry);
          const done = status === 'done';
          return (
            <button
              key={testType}
              type="button"
              disabled={done}
              onClick={() => {
                if (done) return;
                setOpenType(testType);
              }}
              className={`flex min-h-[72px] min-w-0 flex-col items-start rounded-lg bg-surface p-3 text-left shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                done ? 'cursor-default opacity-70' : 'active:bg-surface-3'
              }`}
            >
              <span className="w-full break-words text-headline text-ink hyphens-auto">
                {/* Soft-hyphen break point for a word too long for a half-width phone tile; browsers don't all hyphenate. */}
                {testType === 'cmj' ? s.cmjTile : t.labels.physicalTest[testType]}
              </span>
              <span
                className={`text-footnote ${done ? 'text-green-strong' : status === 'inProgress' ? 'text-orange-strong' : 'text-ink-2'}`}
              >
                {s[status]}
              </span>
            </button>
          );
        })}
      </div>

      {openType && (
        <SessionQualityPanel
          teamId={teamId}
          sessionId={sessionId}
          sessionDate={sessionDate}
          playerId={playerId}
          playerName={playerName}
          playerNumber={playerNumber}
          testType={openType}
          entry={entriesByPlayerAndType.get(buildEntryId(playerId, openType)) ?? null}
          recordedByUid={recordedByUid}
          onClose={() => setOpenType(null)}
          onFinished={() => setOpenType(null)}
        />
      )}
    </div>
  );
}
