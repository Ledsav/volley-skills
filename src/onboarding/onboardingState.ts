export type TipId = 'search' | 'row-actions' | 'scout-start' | 'pdf-share' | 'diagram';

/** Stored on `users/{uid}.onboarding`. Shown-once state, per user, across devices. */
export interface OnboardingState {
  welcomed: boolean;
  tips: string[];
  hiddenChecklists: string[];
}

export const EMPTY_ONBOARDING: OnboardingState = { welcomed: false, tips: [], hiddenChecklists: [] };

export type OnboardingChange =
  | { kind: 'welcomed' }
  | { kind: 'tip'; id: TipId }
  | { kind: 'hideChecklist'; clubId: string }
  | { kind: 'showChecklist'; clubId: string }
  | { kind: 'reset'; clubId: string };

const MAX_TIPS = 32;
const MAX_HIDDEN_CHECKLISTS = 64;

function strings(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string').slice(-max);
}

/** Any stored value becomes a safe state: wrong types fall back to defaults, extra keys are dropped. */
export function parseOnboarding(raw: unknown): OnboardingState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...EMPTY_ONBOARDING, tips: [], hiddenChecklists: [] };
  const r = raw as Record<string, unknown>;
  return {
    welcomed: r.welcomed === true,
    tips: strings(r.tips, MAX_TIPS),
    hiddenChecklists: strings(r.hiddenChecklists, MAX_HIDDEN_CHECKLISTS),
  };
}

function withValue(list: string[], value: string, max: number): string[] {
  return [...list.filter((v) => v !== value), value].slice(-max);
}

/** Pure and non-mutating. Lists are capped to the rule limits, keeping the newest entries.
 *  A change that alters nothing returns `state` itself, so callers can skip the update with `===`. */
export function applyOnboarding(state: OnboardingState, change: OnboardingChange): OnboardingState {
  switch (change.kind) {
    case 'welcomed':
      return state.welcomed ? state : { ...state, welcomed: true };
    case 'tip':
      return state.tips.includes(change.id) ? state : { ...state, tips: withValue(state.tips, change.id, MAX_TIPS) };
    case 'hideChecklist':
      return state.hiddenChecklists.includes(change.clubId)
        ? state
        : { ...state, hiddenChecklists: withValue(state.hiddenChecklists, change.clubId, MAX_HIDDEN_CHECKLISTS) };
    case 'showChecklist':
      return state.hiddenChecklists.includes(change.clubId)
        ? { ...state, hiddenChecklists: state.hiddenChecklists.filter((c) => c !== change.clubId) }
        : state;
    case 'reset':
      return { welcomed: false, tips: [], hiddenChecklists: state.hiddenChecklists.filter((c) => c !== change.clubId) };
  }
}
