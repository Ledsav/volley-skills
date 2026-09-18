import { useState } from 'react';
import { PHYSICAL_TEST_LABELS, PHYSICAL_TEST_ORDER } from '../types/physicalTest';
import type { PhysicalTestType } from '../types/physicalTest';
import { buildEntryId, type TestingSessionEntry } from '../types/testingSession';
import { SessionQualityPanel } from './SessionQualityPanel';

interface QualityTileGridProps {
  teamId: string;
  sessionId: string;
  sessionDate: string;
  playerId: string;
  playerName: string;
  entriesByPlayerAndType: Map<string, TestingSessionEntry>;
  recordedByUid: string;
  onEntryChanged: () => void;
}

// Soft-hyphen break points for words too long for a half-width phone tile;
// automatic hyphenation isn't available in every browser.
const TILE_LABEL_OVERRIDES: Partial<Record<PhysicalTestType, string>> = {
  cmj: 'Counter\u00ADmovement Jump',
};

function statusLabel(entry: TestingSessionEntry | undefined): string {
  if (!entry) return 'Not started';
  return entry.status === 'complete' ? 'Done' : 'In progress';
}

export function QualityTileGrid({
  teamId,
  sessionId,
  sessionDate,
  playerId,
  playerName,
  entriesByPlayerAndType,
  recordedByUid,
  onEntryChanged,
}: QualityTileGridProps) {
  const [openType, setOpenType] = useState<PhysicalTestType | null>(null);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PHYSICAL_TEST_ORDER.map((testType) => {
          const entry = entriesByPlayerAndType.get(buildEntryId(playerId, testType));
          const status = statusLabel(entry);
          const done = status === 'Done';
          return (
            <button
              key={testType}
              type="button"
              disabled={done}
              onClick={() => {
                if (done) return;
                setOpenType(testType);
              }}
              className={`flex min-h-11 min-w-0 flex-col items-start rounded-md border border-border bg-surface p-3 text-left ${
                done ? 'cursor-default opacity-70' : 'hover:bg-blue/5'
              }`}
            >
              <span className="w-full break-words text-sm font-medium text-ink hyphens-auto">
                {TILE_LABEL_OVERRIDES[testType] ?? PHYSICAL_TEST_LABELS[testType]}
              </span>
              <span
                className={`text-xs ${done ? 'text-green' : status === 'In progress' ? 'text-orange' : 'text-slate'}`}
              >
                {status}
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
          testType={openType}
          entry={entriesByPlayerAndType.get(buildEntryId(playerId, openType)) ?? null}
          recordedByUid={recordedByUid}
          onClose={() => {
            setOpenType(null);
            onEntryChanged();
          }}
          onFinished={() => {
            setOpenType(null);
            onEntryChanged();
          }}
        />
      )}
    </div>
  );
}
