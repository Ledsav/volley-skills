import type { Player } from '../types/player';
import type { PhysicalTest } from '../types/physicalTest';

export interface PlayerExport {
  exportedAt: string;
  player: Record<string, unknown>;
  physicalTests: Record<string, unknown>[];
}

function normalizeTimestamp(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return null;
}

export function buildPlayerExport(
  player: Player,
  physicalTests: PhysicalTest[],
  now: Date = new Date()
): PlayerExport {
  const { createdAt, updatedAt, ...rest } = player;
  return {
    exportedAt: now.toISOString(),
    player: {
      ...rest,
      createdAt: normalizeTimestamp(createdAt),
      updatedAt: normalizeTimestamp(updatedAt),
    },
    physicalTests: physicalTests.map((test) => {
      const { createdAt: testCreatedAt, ...testRest } = test as PhysicalTest & { createdAt?: unknown };
      const createdAtIso = normalizeTimestamp(testCreatedAt);
      return createdAtIso == null ? { ...testRest } : { ...testRest, createdAt: createdAtIso };
    }),
  };
}

export function downloadPlayerExport(player: Player, physicalTests: PhysicalTest[]): void {
  const payload = buildPlayerExport(player, physicalTests);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `player-${player.fullName.replace(/\s+/g, '-')}-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
