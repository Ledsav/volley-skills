import { describe, expect, it } from 'vitest';
import { applyOnboarding, EMPTY_ONBOARDING, parseOnboarding, type OnboardingState } from './onboardingState';

describe('parseOnboarding', () => {
  it('gives the empty state for missing or non-object values', () => {
    expect(parseOnboarding(undefined)).toEqual(EMPTY_ONBOARDING);
    expect(parseOnboarding(null)).toEqual(EMPTY_ONBOARDING);
    expect(parseOnboarding('x')).toEqual(EMPTY_ONBOARDING);
  });

  it('falls back safely on malformed fields and drops extras', () => {
    expect(parseOnboarding({ welcomed: 'yes', tips: 'x', hiddenChecklists: [1, 'c1'], extra: 1 })).toEqual({
      welcomed: false,
      tips: [],
      hiddenChecklists: ['c1'],
    });
  });

  it('keeps a valid partial map', () => {
    expect(parseOnboarding({ welcomed: true })).toEqual({ welcomed: true, tips: [], hiddenChecklists: [] });
  });
});

describe('applyOnboarding', () => {
  it('marks welcomed', () => {
    expect(applyOnboarding(EMPTY_ONBOARDING, { kind: 'welcomed' }).welcomed).toBe(true);
  });

  it('adds a tip once', () => {
    const once = applyOnboarding(EMPTY_ONBOARDING, { kind: 'tip', id: 'search' });
    const twice = applyOnboarding(once, { kind: 'tip', id: 'search' });
    expect(twice.tips).toEqual(['search']);
  });

  it('hides then shows a checklist', () => {
    const hidden = applyOnboarding(EMPTY_ONBOARDING, { kind: 'hideChecklist', clubId: 'c1' });
    expect(hidden.hiddenChecklists).toEqual(['c1']);
    expect(applyOnboarding(hidden, { kind: 'showChecklist', clubId: 'c1' }).hiddenChecklists).toEqual([]);
  });

  it('resets welcome and tips and unhides only that club', () => {
    const state: OnboardingState = { welcomed: true, tips: ['search'], hiddenChecklists: ['c1', 'c2'] };
    expect(applyOnboarding(state, { kind: 'reset', clubId: 'c1' })).toEqual({
      welcomed: false,
      tips: [],
      hiddenChecklists: ['c2'],
    });
  });

  it('does not mutate its input', () => {
    const state: OnboardingState = { welcomed: false, tips: [], hiddenChecklists: [] };
    applyOnboarding(state, { kind: 'tip', id: 'diagram' });
    expect(state.tips).toEqual([]);
  });

  it('caps lists and keeps the newest', () => {
    const many = Array.from({ length: 64 }, (_, i) => `c${i}`);
    const hidden = applyOnboarding({ ...EMPTY_ONBOARDING, hiddenChecklists: many }, { kind: 'hideChecklist', clubId: 'new' });
    expect(hidden.hiddenChecklists).toHaveLength(64);
    expect(hidden.hiddenChecklists[63]).toBe('new');
    expect(hidden.hiddenChecklists[0]).toBe('c1');

    const tips = Array.from({ length: 32 }, (_, i) => `t${i}`);
    const next = applyOnboarding({ ...EMPTY_ONBOARDING, tips }, { kind: 'tip', id: 'search' });
    expect(next.tips).toHaveLength(32);
    expect(next.tips[31]).toBe('search');
  });

  it('caps oversized parsed lists too', () => {
    const parsed = parseOnboarding({ tips: Array.from({ length: 40 }, (_, i) => `t${i}`) });
    expect(parsed.tips).toHaveLength(32);
    expect(parsed.tips[31]).toBe('t39');
  });
});

describe('applyOnboarding no-ops', () => {
  it('returns the same object when nothing changes', () => {
    const state = { welcomed: true, tips: ['search'], hiddenChecklists: ['c1'] };
    expect(applyOnboarding(state, { kind: 'welcomed' })).toBe(state);
    expect(applyOnboarding(state, { kind: 'tip', id: 'search' })).toBe(state);
    expect(applyOnboarding(state, { kind: 'hideChecklist', clubId: 'c1' })).toBe(state);
    expect(applyOnboarding(state, { kind: 'showChecklist', clubId: 'other' })).toBe(state);
    expect(applyOnboarding(state, { kind: 'tip', id: 'diagram' })).not.toBe(state);
  });
});
