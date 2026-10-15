type Band = 'red' | 'orange' | 'blue' | 'green';

const SEGMENT_COUNT = 10;
const BAND_BOUNDARIES = new Set([3, 5, 7]);

function bandColor(score: number): Band {
  if (score < 4) return 'red';
  if (score < 6) return 'orange';
  if (score < 8) return 'blue';
  return 'green';
}

const FILLED_CLASS: Record<Band, string> = {
  red: 'bg-red',
  orange: 'bg-orange',
  blue: 'bg-blue',
  green: 'bg-green',
};

// A suggestion is drawn on the meter itself: segments it would add pulse in green,
// segments it would remove pulse in orange. Motion only when the user allows it.
const GHOST_CLASS = {
  up: 'bg-green/40 border-green motion-safe:animate-pulse',
  down: 'border-orange-strong motion-safe:animate-pulse',
} as const;

export interface SkillMeterProps {
  score: number | null;
  /** Score suggested by match data; the difference to `score` is shown as ghost segments. */
  suggested?: number | null;
}

export function SkillMeter({ score, suggested = null }: SkillMeterProps) {
  const filledCount = score ?? 0;
  const color = score !== null ? bandColor(score) : null;
  const target = suggested ?? filledCount;

  return (
    <div className="flex items-center gap-1" role="meter" aria-valuemin={1} aria-valuemax={10} aria-valuenow={score ?? undefined}>
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
        const segmentNumber = i + 1;
        const isFilled = segmentNumber <= filledCount;
        const isBandBoundary = BAND_BOUNDARIES.has(segmentNumber);
        const ghost = !isFilled && segmentNumber <= target ? 'up' : isFilled && segmentNumber > target ? 'down' : undefined;
        return (
          <div
            key={segmentNumber}
            data-testid="skill-segment"
            data-filled={isFilled ? 'true' : 'false'}
            data-ghost={ghost}
            className={[
              'h-2 flex-1 rounded-sm border',
              ghost === 'up'
                ? GHOST_CLASS.up
                : isFilled && color
                  ? `${FILLED_CLASS[color]} ${ghost === 'down' ? GHOST_CLASS.down : 'border-transparent'}`
                  : 'bg-transparent border-border',
              isBandBoundary ? 'mr-1' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        );
      })}
    </div>
  );
}
