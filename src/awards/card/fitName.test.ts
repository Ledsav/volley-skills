import { describe, expect, it } from 'vitest';
import { fitName } from './fitName';
import { recordingCtx } from './testCtx';

describe('fitName', () => {
  it('keeps a short name at max size on one line', () => {
    const { ctx } = recordingCtx();
    expect(fitName(ctx, 'Lena P.', 900)).toEqual({ size: 120, lines: ['Lena P.'] });
  });

  it('shrinks a longer name before wrapping', () => {
    const { ctx } = recordingCtx();
    const r = fitName(ctx, 'Maria Fernanda', 900); // 14 chars × 0.55 × size ≤ 900 → size ≤ 116
    expect(r.lines).toHaveLength(1);
    expect(r.size).toBeLessThan(120);
    expect(r.size).toBeGreaterThanOrEqual(64);
  });

  it('wraps to two lines at min size, then ellipsis', () => {
    const { ctx } = recordingCtx();
    const r = fitName(ctx, 'Maria-Fernanda Van den Broeck-Oliveira de la Cruz y Santos', 900);
    expect(r.size).toBe(64);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[1].endsWith('…')).toBe(true);
    for (const l of r.lines) expect(l.length * 64 * 0.55).toBeLessThanOrEqual(900);
  });

  it('handles an unbreakable token and non-Latin text', () => {
    const { ctx } = recordingCtx();
    const r = fitName(ctx, 'Wolfeschlegelsteinhausenbergerdorffvoralternwarengewissenhaftschaferswessen', 900);
    expect(r.lines.every((l) => l.length * r.size * 0.55 <= 900)).toBe(true);
    expect(fitName(ctx, 'Zoë Ünal', 900).lines).toEqual(['Zoë Ünal']);
  });
});
