// src/awards/card/wrapText.test.ts
import { describe, expect, it } from 'vitest';
import { recordingCtx } from './testCtx';
import { fillTabular, fitFontSize, textAt, wrapLines } from './wrapText';

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

  it('textAt applies letter spacing inside save/restore', () => {
    const { ctx, calls } = recordingCtx();
    textAt(ctx, 'Hi', 0, 0, '700 120px Inter', '#fff', 1, 'left', -4.2);
    const m = calls.map((c) => c.method);
    const set = m.indexOf('set:letterSpacing');
    expect(calls[set].args[0]).toBe('-4.2px');
    expect(m.indexOf('save')).toBeLessThan(set);
    expect(set).toBeLessThan(m.indexOf('fillText'));
    expect(m.indexOf('fillText')).toBeLessThan(m.indexOf('restore'));
  });

  it('textAt draws untracked when the context has no letterSpacing', () => {
    const { ctx, calls, texts } = recordingCtx({ noLetterSpacing: true });
    expect(() => textAt(ctx, 'Hi', 0, 0, '700 120px Inter', '#fff', 1, 'left', -4.2)).not.toThrow();
    expect(texts()).toEqual(['Hi']);
    expect(calls.some((c) => c.method === 'set:letterSpacing')).toBe(false);
  });

  it('fillTabular keeps every digit in a fixed-width cell', () => {
    const charWidth = (c: string) => (c === '1' ? 0.3 : 0.55);
    const percentX = (s: string) => {
      const { ctx, calls, texts } = recordingCtx({ charWidth });
      fillTabular(ctx, s, 0, 0, '700 100px Inter', '#fff', 1, 'left');
      expect(texts()).toEqual(Array.from(s));
      return calls.filter((c) => c.method === 'fillText' && c.args[0] === '%').map((c) => c.args[1])[0];
    };
    expect(percentX('11%')).toBe(percentX('40%'));
  });

  it('fillTabular centres the run on x', () => {
    const { ctx, calls } = recordingCtx();
    fillTabular(ctx, '68%', 540, 0, '700 100px Inter', '#fff', 1, 'center');
    const cell = 0.55 * 100;
    const first = calls.find((c) => c.method === 'fillText' && c.args[0] === '6')!;
    expect(first.args[1]).toBeCloseTo(540 - (cell * 3) / 2 + cell / 2, 6);
  });
});
