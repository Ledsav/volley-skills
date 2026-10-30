/** Size caps for club documents. The numbers live in limitValues.js (plain JS, shared with the ops scripts). */
export { LIMITS } from './limitValues.js';

/** True when `value` is a string longer than `max`. */
export function tooLong(value: unknown, max: number): boolean {
  return typeof value === 'string' && value.length > max;
}
