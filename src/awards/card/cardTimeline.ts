export const CARD_DURATION_MS = 3500;

interface Beats { bg: number; title: number; photo: number; name: number; stat: number; confetti: number }

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export function easeOutBack(x: number): number {
  const c1 = 1.70158, c3 = c1 + 1, v = clamp(x);
  return 1 + c3 * Math.pow(v - 1, 3) + c1 * Math.pow(v - 1, 2);
}

/** Raw (linear) progress per layer; the renderer applies the easing per layer. */
export function cardBeats(t: number, reducedMotion = false): Beats {
  if (reducedMotion) return { bg: 1, title: 1, photo: 1, name: 1, stat: 1, confetti: 0 };
  return {
    bg: seg(t, 0, 0.2),
    title: seg(t, 0.2, 0.45),
    photo: seg(t, 0.45, 0.7),
    name: seg(t, 0.7, 0.85),
    stat: seg(t, 0.85, 1),
    confetti: seg(t, 0.85, 1),
  };
}
