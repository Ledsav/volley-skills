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

export interface SkillMeterProps {
  score: number | null;
}

export function SkillMeter({ score }: SkillMeterProps) {
  const filledCount = score ?? 0;
  const color = score !== null ? bandColor(score) : null;

  return (
    <div className="flex items-center gap-1" role="meter" aria-valuemin={1} aria-valuemax={10} aria-valuenow={score ?? undefined}>
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
        const segmentNumber = i + 1;
        const isFilled = segmentNumber <= filledCount;
        const isBandBoundary = BAND_BOUNDARIES.has(segmentNumber);
        return (
          <div
            key={segmentNumber}
            data-testid="skill-segment"
            data-filled={isFilled ? 'true' : 'false'}
            className={[
              'h-2 flex-1 rounded-sm border',
              isFilled && color ? `${FILLED_CLASS[color]} border-transparent` : 'bg-transparent border-border',
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
