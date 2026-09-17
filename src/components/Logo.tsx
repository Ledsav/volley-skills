// Brand colours are fixed hex, not theme tokens: the mark must not shift with dark mode.
const V_NAVY = '#12295A';
const BALL_YELLOW = '#F5C518';

/** The badge on its own: a slanted V catching the ball. */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="24" fill="white" />
      <path d="M17 24 H37 L50 62 L68 24 H88 L60 82 H41 Z" fill={V_NAVY} />
      <circle cx="57" cy="24" r="9" fill={BALL_YELLOW} />
    </svg>
  );
}

/**
 * Full lockup for blue/navy surfaces: the badge stands in for the V of
 * "VOLLEY", with "SKILLS" stacked beneath. Sized entirely in em, so set the
 * size with a text-size class on `className`.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span role="img" aria-label="Volley Skills" className={`inline-flex items-start gap-[0.06em] ${className}`}>
      <LogoMark className="h-[1.52em] w-[1.52em] shrink-0" />
      <span
        aria-hidden="true"
        className="flex flex-col font-display font-black uppercase italic leading-[0.8] tracking-[-0.03em]"
      >
        <span className="text-white">olley</span>
        <span style={{ color: BALL_YELLOW }}>Skills</span>
      </span>
    </span>
  );
}
