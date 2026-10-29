export const MAX_TOKENS: 120;
export const MIN_PREFIX: 2;
export const MAX_PREFIX: 12;
export function normalize(s: string): string;
export function words(s: string): string[];
/** `extra` (a training's businessId) tokens come first, so the 120 cap never cuts them. */
export function searchTokens(name: string, extra?: string): string[];
