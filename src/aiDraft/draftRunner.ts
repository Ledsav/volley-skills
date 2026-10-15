import { AiError, type ChatMessage } from '../ai/aiClient';

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

const TEXT: Record<AiError['kind'], string> = {
  notConfigured: 'Set up an AI provider in Settings first.',
  unauthorized: 'Key rejected — check it in Settings.',
  rateLimited: 'Rate limit reached — try again in a moment.',
  unreachable: 'Could not reach the AI provider.',
  badResponse: "The model's answer could not be used. Try again or rephrase the request.",
  privacyBlocked: 'No provider for this model keeps requests private (zero data retention). Pick another model in Settings.',
  http: 'The AI provider returned an error.',
};

export function draftErrorText(e: unknown): string {
  if (!(e instanceof AiError)) return 'Something went wrong. Please try again.';
  if (e.kind === 'rateLimited' && e.retryAfterSec) return `Rate limit reached — try again in ${e.retryAfterSec} s.`;
  return TEXT[e.kind];
}

export function needsSettings(e: unknown): boolean {
  return e instanceof AiError && (e.kind === 'notConfigured' || e.kind === 'unauthorized' || e.kind === 'privacyBlocked');
}
