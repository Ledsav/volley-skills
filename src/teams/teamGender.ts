import type { Gender } from '../i18n/catalog';

/** The grammatical gender to use for a team; teams that predate the field read as mixed. */
export function teamGender(team: { gender?: Gender }): Gender {
  return team.gender ?? 'mixed';
}

export const GENDERS: readonly Gender[] = ['women', 'men', 'mixed'];

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value);
}
