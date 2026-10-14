import { describe, expect, it } from 'vitest';
import { confettiAt, mulberry32, seedFrom } from './confetti';

describe('confetti', () => {
  it('PRNG is deterministic', () => {
    const a = mulberry32(42), b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('seedFrom is stable and differs per text', () => {
    expect(seedFrom('mvp')).toBe(seedFrom('mvp'));
    expect(seedFrom('mvp')).not.toBe(seedFrom('server'));
  });

  it('same seed and progress → identical particles', () => {
    expect(confettiAt(7, 0.5, ['#f00'])).toEqual(confettiAt(7, 0.5, ['#f00']));
  });

  it('no particles at 0, they fall and fade', () => {
    expect(confettiAt(7, 0, ['#f00'])).toEqual([]);
    const early = confettiAt(7, 0.2, ['#f00']);
    const late = confettiAt(7, 0.9, ['#f00']);
    expect(late[0].y).toBeGreaterThan(early[0].y);
    expect(late[0].alpha).toBeLessThan(early[0].alpha);
  });
});
