/**
 * Retries a Firestore operation on transient overload errors only.
 *
 * Firestore returns `resource-exhausted` when a per-second quota is briefly
 * exceeded and `unavailable` on a transient backend blip — both clear on their
 * own within a second or two. Every other error (`permission-denied`,
 * `failed-precondition`, a bug) is rethrown immediately: retrying it just wastes
 * quota and hides the real failure.
 *
 * Backoff is exponential with full jitter, capped at `maxMs`.
 */
const RETRYABLE_CODES = new Set(['resource-exhausted', 'unavailable']);

export interface BackoffOptions {
  /** Number of retries after the initial attempt. */
  retries?: number;
  /** Base delay for the first retry, in ms. */
  baseMs?: number;
  /** Upper bound on any single delay, in ms. */
  maxMs?: number;
}

function isRetryable(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    RETRYABLE_CODES.has((error as { code?: string }).code ?? '')
  );
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withBackoff<T>(fn: () => Promise<T>, options: BackoffOptions = {}): Promise<T> {
  const { retries = 3, baseMs = 300, maxMs = 4000 } = options;

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt >= retries) throw error;
      const ceiling = Math.min(maxMs, baseMs * 2 ** attempt);
      await sleep(Math.random() * ceiling);
      attempt += 1;
    }
  }
}
