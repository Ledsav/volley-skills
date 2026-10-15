// src/awards/card/wrapText.test.ts
import { describe, expect, it } from 'vitest';
import { recordingCtx } from './testCtx';
import { fitFontSize, wrapLines } from './wrapText';

describe('wrapText', () => {
  it('wraps words to the width (measure ≈ 0.55 em per char)', () => {
    const { ctx } = recordingCtx();
    ctx.font = '700 60px Inter';
    const lines = wrapLines(ctx, 'of rallies won on the opponent’s serve', 920);
    expect(lines.length).toBe(2);
    for (const l of lines) expect(l.length * 60 * 0.55).toBeLessThanOrEqual(920);
  });

  it('shrinks a long single line to fit, never below 40%', () => {
    const { ctx } = recordingCtx();
    expect(fitFontSize(ctx, 'Short', 900, 300, 920)).toBe(300);
    const size = fitFontSize(ctx, 'Extraordinarily long award title', 900, 120, 920);
    expect(size).toBeLessThan(120);
    expect(size).toBeGreaterThanOrEqual(48);
  });
});
