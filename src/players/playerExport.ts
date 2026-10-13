import type { Player } from '../types/player';
import type { PhysicalTest } from '../types/physicalTest';
import { downloadJson, fileSlug, toExportable } from '../export/exportJson';
import { EMPTY_FOOTPRINT, type PlayerFootprint } from './playerFootprint';

export interface PlayerExport {
  exportedAt: string;
  player: Record<string, unknown>;
  physicalTests: Record<string, unknown>[];
  /** Entries in physical-testing session drafts. */
  testingSessionEntries: Record<string, unknown>[];
  /** Matches the player was on the roster for, with their stats. */
  matches: Record<string, unknown>[];
}

export function buildPlayerExport(
  player: Player,
  physicalTests: PhysicalTest[],
  footprint: PlayerFootprint = EMPTY_FOOTPRINT,
  now: Date = new Date()
): PlayerExport {
  return {
    exportedAt: now.toISOString(),
    player: toExportable(player) as Record<string, unknown>,
    physicalTests: physicalTests.map((t) => toExportable(t) as Record<string, unknown>),
    testingSessionEntries: footprint.testingEntries.map((e) => toExportable(e) as Record<string, unknown>),
    matches: footprint.matches.map((m) => toExportable(m) as Record<string, unknown>),
  };
}

export function downloadPlayerExport(player: Player, physicalTests: PhysicalTest[], footprint?: PlayerFootprint): void {
  const payload = buildPlayerExport(player, physicalTests, footprint);
  downloadJson(`player-${fileSlug(player.fullName)}-${payload.exportedAt.slice(0, 10)}.json`, payload);
}
