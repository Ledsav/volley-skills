export type Step = { kind: 'title' | 'suspense' | 'reveal'; index: number } | { kind: 'final' };
export const FIRST_STEP: Step = { kind: 'title', index: 0 };

export function nextStep(s: Step, count: number): Step {
  if (count === 0 || s.kind === 'final') return { kind: 'final' };
  if (s.kind === 'title') return { kind: 'suspense', index: s.index };
  if (s.kind === 'suspense') return { kind: 'reveal', index: s.index };
  return s.index + 1 < count ? { kind: 'title', index: s.index + 1 } : { kind: 'final' };
}

export function prevStep(s: Step, count: number): Step {
  if (s.kind === 'final') return count === 0 ? FIRST_STEP : { kind: 'reveal', index: count - 1 };
  if (s.kind === 'reveal') return { kind: 'suspense', index: s.index };
  if (s.kind === 'suspense') return { kind: 'title', index: s.index };
  return s.index > 0 ? { kind: 'reveal', index: s.index - 1 } : FIRST_STEP;
}
