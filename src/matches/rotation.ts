import { getT } from '../i18n/I18nProvider';
import type { PositionCategory } from '../types/player';
import type { RoleMap } from '../types/match';

export interface Slots51 {
  setter: string;
  oh1: string;
  mb1: string;
  opposite: string;
  oh2: string;
  mb2: string;
}

export type SlotKey = keyof Slots51;

/**
 * Serve-rotation order of a 5-1, starting at the setter. Index i is the
 * player i zones "after" the setter (P1 → P2 → … → P6 → P1), so with the
 * setter in P1 the lineup is P1 S, P2 OH1, P3 MB1, P4 O, P5 OH2, P6 MB2.
 * Opposite pairs are always 3 apart: S/O, OH1/OH2, MB1/MB2.
 */
const SLOT_ORDER: SlotKey[] = ['setter', 'oh1', 'mb1', 'opposite', 'oh2', 'mb2'];

export const SLOT_ROLE: Record<SlotKey, PositionCategory> = {
  setter: 'S',
  oh1: 'OH',
  mb1: 'MB',
  opposite: 'O',
  oh2: 'OH',
  mb2: 'MB',
};

/**
 * Builds a 5-1 lineup (index 0 = P1) with the setter in P`setterZone`.
 *
 * The P1 arrangement above is rotated so S sits in Pk while the relative order
 * is kept: `lineup[(k - 1 + i) % 6] = SLOT_ORDER[i]`. This matches the engine's
 * rotation (P2 → P1 on side-out), so the setter zone equals the rotation number.
 */
export function build51(slots: Slots51, setterZone: number): string[] {
  const k = setterZone - 1;
  const lineup = new Array<string>(6).fill('');
  SLOT_ORDER.forEach((key, i) => {
    lineup[(k + i) % 6] = slots[key];
  });
  return lineup;
}

/** Inverse of build51: reads the slots from a lineup given the setter's zone (1–6). */
export function slotsFromLineup(lineup: string[], setterZone: number): Slots51 {
  const k = setterZone - 1;
  const at = (i: number) => lineup[(k + i) % 6] ?? '';
  return { setter: at(0), oh1: at(1), mb1: at(2), opposite: at(3), oh2: at(4), mb2: at(5) };
}

const EXPECTED: { role: 'S' | 'O' | 'OH' | 'MB'; count: number }[] = [
  { role: 'S', count: 1 },
  { role: 'O', count: 1 },
  { role: 'OH', count: 2 },
  { role: 'MB', count: 2 },
];

const PAIRS: { role: PositionCategory; other: PositionCategory; message: 'setterOpposite' | 'middles' | 'outsides' }[] = [
  { role: 'S', other: 'O', message: 'setterOpposite' },
  { role: 'MB', other: 'MB', message: 'middles' },
  { role: 'OH', other: 'OH', message: 'outsides' },
];

/** Non-blocking warnings for a lineup that does not look like a 5-1. */
export function check51(lineup: string[], roles: RoleMap): string[] {
  const t = getT().matches.rotation;
  const warnings: string[] = [];
  const zonesOf = (role: PositionCategory) =>
    lineup.flatMap((id, zone) => (id && roles[id] === role ? [zone] : []));

  for (const { role, count } of EXPECTED) {
    const found = zonesOf(role).length;
    if (found !== count) warnings.push(t.expected(role, count, found));
  }
  for (const { role, other, message } of PAIRS) {
    const a = zonesOf(role);
    const b = zonesOf(other);
    if (role === other) {
      if (a.length === 2 && Math.abs(a[0] - a[1]) !== 3) warnings.push(t[message]);
    } else if (a.length === 1 && b.length === 1 && Math.abs(a[0] - b[0]) !== 3) {
      warnings.push(t[message]);
    }
  }
  return warnings;
}
