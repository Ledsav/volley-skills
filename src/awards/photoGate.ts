import { ageFromDob } from '../players/age';
import type { Player } from '../types/player';

/**
 * Whether a player's photo may appear on an award card. Adults (18 or over, from a valid date
 * of birth) need no toggle; everyone else, including a player with no valid dob, needs the
 * guardian's photo consent.
 */
export function photoAllowed(player: Partial<Pick<Player, 'dob' | 'photoConsent'>>, today: Date): boolean {
  const age = ageFromDob(player.dob ?? '', today);
  if (age !== null && age >= 18) return true;
  return player.photoConsent === true;
}
