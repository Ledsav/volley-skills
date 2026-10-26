import type { ScoutCode } from './types';

/** Placeholder until the scout-code grammar lands: every code is reported as unparsed. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function parseScoutCode(_code: string): ScoutCode {
  return { kind: 'other', reason: 'unparsed' };
}
