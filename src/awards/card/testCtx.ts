const noop = () => undefined;
const gradient = { addColorStop: noop };

/** A fake 2D context recording every call; measureText ≈ 0.55 em per char of the current font size. */
export function recordingCtx() {
  const calls: { method: string; args: unknown[] }[] = [];
  const state: Record<string, unknown> = { font: '10px Inter' };
  const sizeOf = () => Number(/(\d+(?:\.\d+)?)px/.exec(String(state.font))?.[1] ?? 10);
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: s.length * sizeOf() * 0.55 });
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
  return { ctx, calls, texts };
}
