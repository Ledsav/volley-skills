import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateSpring, SPRING_DEFAULT, SPRING_FLICK, springStep, type SpringParams } from './spring';

function run(params: SpringParams, from: number, to: number, v0 = 0, steps = 90): number[] {
  const xs: number[] = [];
  let x = from;
  let v = v0;
  for (let i = 0; i < steps; i++) {
    [x, v] = springStep(x, v, to, params, 1 / 60);
    xs.push(x);
  }
  return xs;
}

describe('springStep', () => {
  it('settles on the target without overshoot at damping 1', () => {
    const xs = run(SPRING_DEFAULT, 0, 100);
    expect(Math.abs(xs[xs.length - 1] - 100)).toBeLessThan(0.5);
    expect(Math.max(...xs)).toBeLessThanOrEqual(100.001);
  });

  it('overshoots with the flick spring', () => {
    expect(Math.max(...run(SPRING_FLICK, 0, 100))).toBeGreaterThan(100);
  });

  it('carries initial velocity', () => {
    const xs = run(SPRING_DEFAULT, 0, 100, -2000, 10);
    expect(Math.min(...xs)).toBeLessThan(0);
  });
});

describe('animateSpring', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes exactly on the target', () => {
    const onUpdate = vi.fn();
    const onComplete = vi.fn();
    animateSpring({ from: 0, to: 100, onUpdate, onComplete });
    vi.advanceTimersByTime(3000);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenLastCalledWith(100);
  });

  it('stop() returns the in-flight value and cancels', () => {
    const onUpdate = vi.fn();
    const onComplete = vi.fn();
    const handle = animateSpring({ from: 0, to: 100, onUpdate, onComplete });
    vi.advanceTimersByTime(100);
    const x = handle.stop();
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(100);
    const calls = onUpdate.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(onUpdate.mock.calls.length).toBe(calls);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
