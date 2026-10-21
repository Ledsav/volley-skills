interface Particle { x: number; y: number; rot: number; size: number; color: string; alpha: number }

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Particles in card space (1080×1920) at burst progress p ∈ [0,1]; pure in (seed, p). */
export function confettiAt(seed: number, p: number, colors: string[], count = 120): Particle[] {
  if (p <= 0) return [];
  const rnd = mulberry32(seed);
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.2;
    const speed = 900 + rnd() * 900;
    const spin = (rnd() - 0.5) * 12;
    const size = 12 + rnd() * 16;
    const color = colors[Math.floor(rnd() * colors.length)];
    const x0 = 540, y0 = 1000;
    out.push({
      x: x0 + Math.cos(angle) * speed * p,
      y: y0 + Math.sin(angle) * speed * p + 2200 * p * p,
      rot: spin * p,
      size,
      color,
      alpha: Math.max(0, 1 - p * 0.9),
    });
  }
  return out;
}
