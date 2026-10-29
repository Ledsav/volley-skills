const noop = () => undefined;
const gradient = { addColorStop: noop };

/** A fake 2D context recording every call; measureText ≈ 0.55 em per char of the current font size. */
export function recordingCtx(opts: { charWidth?: (ch: string) => number; noLetterSpacing?: boolean } = {}) {
  const charWidth = opts.charWidth ?? (() => 0.55);
  const calls: { method: string; args: unknown[] }[] = [];
  const state: Record<string, unknown> = { font: '10px Inter' };
  if (!opts.noLetterSpacing) state.letterSpacing = '0px';
  const sizeOf = () => Number(/(\d+(?:\.\d+)?)px/.exec(String(state.font))?.[1] ?? 10);
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: Array.from(s).reduce((w, ch) => w + charWidth(ch) * sizeOf(), 0) });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return gradient;
      };
      return (...args: unknown[]) => calls.push({ method: prop, args });
    },
    set(target, prop: string, value) {
      target[prop] = value;
      calls.push({ method: `set:${prop}`, args: [value] });
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const texts = () => calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));
  /** Consecutive fillText calls on the same baseline joined into one string. */
  const runs = () => {
    const out: string[] = [];
    let lastY: unknown = Symbol('none');
    for (const c of calls) {
      if (c.method !== 'fillText') continue;
      if (c.args[2] === lastY) out[out.length - 1] += String(c.args[0]);
      else out.push(String(c.args[0]));
      lastY = c.args[2];
    }
    return out;
  };
  return { ctx, calls, texts, runs };
}
