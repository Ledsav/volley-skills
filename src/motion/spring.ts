/** Spring parameters: `response` is the period in seconds, `damping` the ratio (1 = critically damped). */
export interface SpringParams {
  response: number;
  damping: number;
}

export const SPRING_DEFAULT: SpringParams = { response: 0.35, damping: 1 };
/** After a flick: a small overshoot only after a throw. */
export const SPRING_FLICK: SpringParams = { response: 0.35, damping: 0.85 };
export const SPRING_SNAPPY: SpringParams = { response: 0.3, damping: 1 };

const SUBSTEP = 1 / 240;

/**
 * Advances a unit-mass spring towards `target` by `dt` and returns [x, v]. Semi-implicit Euler with
 * k = (2π / response)² and c = 4π · damping / response, in sub-steps of at most 1/240 s: at a full 1/60 frame
 * Euler's numerical damping would swallow the small overshoot of damping .85.
 */
export function springStep(x: number, v: number, target: number, p: SpringParams, dt: number): [number, number] {
  const k = (2 * Math.PI / p.response) ** 2;
  const c = (4 * Math.PI * p.damping) / p.response;
  const n = Math.max(1, Math.ceil(dt / SUBSTEP - 1e-9));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    v += (-k * (x - target) - c * v) * h;
    x += v * h;
  }
  return [x, v];
}

const MAX_DT = 1 / 30; // a stalled frame (hidden tab) must not blow the integrator up

/**
 * Animates `from` to `to` on requestAnimationFrame. `velocity` is in units per second. `stop()` cancels and
 * returns the current value so an interruption can start from where the thing actually is.
 */
export function animateSpring(o: {
  from: number;
  to: number;
  velocity?: number;
  params?: SpringParams;
  onUpdate: (x: number) => void;
  onComplete?: () => void;
}): { stop: () => number } {
  const params = o.params ?? SPRING_DEFAULT;
  let x = o.from;
  let v = o.velocity ?? 0;
  let last = performance.now();
  let raf = 0;
  let stopped = false;

  const frame = (now: number) => {
    if (stopped) return;
    const dt = Math.min(Math.max((now - last) / 1000, 0), MAX_DT);
    last = now;
    [x, v] = springStep(x, v, o.to, params, dt);
    if (Math.abs(x - o.to) < 0.5 && Math.abs(v) < 5) {
      x = o.to;
      o.onUpdate(x);
      stopped = true;
      o.onComplete?.();
      return;
    }
    o.onUpdate(x);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      return x;
    },
  };
}
