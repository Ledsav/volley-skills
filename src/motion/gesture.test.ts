import { describe, expect, it } from 'vitest';
import { nearest, project, rubberband } from './gesture';

describe('project', () => {
  it('projects where a flick would come to rest', () => {
    expect(project(1000)).toBeCloseTo(499, 6);
    expect(project(0)).toBe(0);
  });
});

describe('rubberband', () => {
  it('is 0 at no overshoot, increasing, and always short of the overshoot', () => {
    expect(rubberband(0, 300)).toBe(0);
    let prev = 0;
    for (const o of [10, 50, 100, 400, 2000]) {
      const r = rubberband(o, 300);
      expect(r).toBeGreaterThan(prev);
      expect(r).toBeLessThan(o);
      prev = r;
    }
  });
});

describe('nearest', () => {
  it('picks the closest point', () => {
    expect(nearest([0, 300, 600], 420)).toBe(300);
  });
});
