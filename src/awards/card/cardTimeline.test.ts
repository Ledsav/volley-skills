import { describe, expect, it } from 'vitest';
import { cardBeats, easeOutBack, easeOutCubic } from './cardTimeline';

describe('cardTimeline', () => {
  it('beats follow the spec segments', () => {
    expect(cardBeats(0)).toEqual({ bg: 0, title: 0, photo: 0, name: 0, stat: 0, confetti: 0 });
    expect(cardBeats(0.2).bg).toBe(1);
    expect(cardBeats(0.2).title).toBe(0);
    expect(cardBeats(0.45).title).toBe(1);
    expect(cardBeats(0.7).name).toBe(0);
    expect(cardBeats(0.85).name).toBe(1);
    expect(cardBeats(0.85).stat).toBe(0);
    expect(cardBeats(1)).toEqual({ bg: 1, title: 1, photo: 1, name: 1, stat: 1, confetti: 1 });
  });

  it('clamps t outside [0,1]', () => {
    expect(cardBeats(-1).bg).toBe(0);
    expect(cardBeats(2).stat).toBe(1);
  });

  it('easings', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map(easeOutBack))).toBeGreaterThan(1);
    expect(easeOutBack(1)).toBeCloseTo(1);
  });

  it('reduced motion: everything visible, no confetti', () => {
    expect(cardBeats(0.1, true)).toEqual({ bg: 1, title: 1, photo: 1, name: 1, stat: 1, confetti: 0 });
  });
});
