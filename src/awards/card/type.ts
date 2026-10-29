// src/awards/card/type.ts
/** Canvas type roles (design system §3): Inter at 500–700, tracking tightens with size and is never positive. */
export const FAMILY = 'Inter, system-ui, sans-serif';

export type Role = 'display' | 'title' | 'headline' | 'body' | 'caption';

export const ROLE: Record<Role, { weight: 500 | 600 | 700; tracking: number }> = {
  display: { weight: 700, tracking: -0.035 },
  title: { weight: 700, tracking: -0.02 },
  headline: { weight: 600, tracking: -0.01 },
  body: { weight: 500, tracking: -0.005 },
  caption: { weight: 500, tracking: 0 },
};

export function fontFor(role: Role, size: number): string {
  return `${ROLE[role].weight} ${size}px ${FAMILY}`;
}

/** Letter spacing in px for a role at a size, rounded to 0.1; never above 0. */
export function trackPx(role: Role, size: number): number {
  const v = Math.round(ROLE[role].tracking * size * 10) / 10;
  return v > 0 ? 0 : v + 0;
}
