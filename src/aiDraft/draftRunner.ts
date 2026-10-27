import { AiError, type ChatMessage } from '../ai/aiClient';
import { getT } from '../i18n/I18nProvider';

export type AskFn = (messages: ChatMessage[], signal: AbortSignal) => Promise<unknown>;

/** Runs a model call and validates it; one silent retry when the reply isn't usable JSON. */
export async function runDraft<T>(call: () => Promise<unknown>, validate: (raw: unknown) => T): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return validate(await call());
    } catch (e) {
      if (attempt === 0 && e instanceof AiError && e.kind === 'badResponse') continue;
      throw e;
    }
  }
}

/** The coach-facing text for a failed model call, in the active language. */
export function draftErrorText(e: unknown): string {
  const t = getT().aiDraft.errors;
  if (!(e instanceof AiError)) return t.generic;
  if (e.kind === 'rateLimited' && e.retryAfterSec) return t.rateLimitedIn(e.retryAfterSec);
  return t[e.kind];
}

export function needsSettings(e: unknown): boolean {
  return e instanceof AiError && (e.kind === 'notConfigured' || e.kind === 'unauthorized' || e.kind === 'privacyBlocked');
}
