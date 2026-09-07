export function bestOf(attempts: number[], mode: 'max' | 'min'): number {
  return mode === 'max' ? Math.max(...attempts) : Math.min(...attempts);
}

export function computeApproachJump(
  standingReachCm: number,
  attemptsTouchCm: number[]
): { bestTouchCm: number; approachJumpCm: number } {
  const bestTouchCm = bestOf(attemptsTouchCm, 'max');
  return { bestTouchCm, approachJumpCm: bestTouchCm - standingReachCm };
}

export function computeReaction(attemptsCm: number[]): { averageCm: number; reactionTimeMs: number } {
  const sorted = [...attemptsCm].sort((a, b) => a - b);
  const middle = sorted.slice(1, -1);
  const averageCm = middle.reduce((sum, value) => sum + value, 0) / middle.length;
  const reactionTimeMs = Math.sqrt((2 * (averageCm / 100)) / 9.81) * 1000;
  return { averageCm, reactionTimeMs };
}

export function computeBodyMassRatio(weightKg: number, bodyMassKg: number): number {
  return weightKg / bodyMassKg;
}
