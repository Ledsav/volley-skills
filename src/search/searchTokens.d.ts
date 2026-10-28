export const MAX_TOKENS: 120;
export const MIN_PREFIX: 2;
export const MAX_PREFIX: 12;
export function normalize(s: string): string;
export function words(s: string): string[];
export function searchTokens(name: string, extra?: string): string[];
