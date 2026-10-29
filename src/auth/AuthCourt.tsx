/**
 * Decorative hairline court for the sign-in frame: pure SVG coloured by
 * tokens, so it follows the theme. `stage` is the large desktop court,
 * `strip` the cropped phone strip that fades into the page.
 */
export function AuthCourt({ variant }: { variant: 'stage' | 'strip' }) {
  const svg = (
    <svg
      viewBox="0 0 180 360"
      aria-hidden="true"
      focusable="false"
      data-testid={variant === 'stage' ? 'auth-court' : 'auth-court-strip'}
      className="h-full w-full overflow-visible text-ink-3"
    >
      <rect x="0" y="0" width="180" height="360" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <line x1="0" y1="120" x2="180" y2="120" stroke="currentColor" strokeWidth="1" />
      <line x1="0" y1="240" x2="180" y2="240" stroke="currentColor" strokeWidth="1" />
      <line x1="-14" y1="180" x2="194" y2="180" className="stroke-ink" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="-14" cy="180" r="2.4" className="fill-ink" />
      <circle cx="194" cy="180" r="2.4" className="fill-ink" />
      <g fill="currentColor" fontFamily="Inter, system-ui, sans-serif" fontSize="15" fontWeight="600" textAnchor="middle">
        <text x="30" y="216">4</text>
        <text x="90" y="216">3</text>
        <text x="150" y="216">2</text>
        <text x="30" y="306">5</text>
        <text x="90" y="306">6</text>
        <text x="150" y="306">1</text>
      </g>
      <path d="M150 384 Q 70 230 46 74" fill="none" className="stroke-ink" strokeWidth="1.6" strokeDasharray="2 5" strokeLinecap="round" />
      <ellipse cx="46" cy="76" rx="9" ry="4" className="fill-ink" opacity=".12" />
      <circle cx="46" cy="70" r="6" className="fill-ink" />
      <circle cx="150" cy="384" r="3" className="fill-ink" />
    </svg>
  );
  if (variant === 'stage') {
    return (
      <div className="pointer-events-none absolute left-1/2 top-[46%] -ml-[150px] -mt-[300px] h-[600px] w-[300px] opacity-90 [transform:perspective(1100px)_rotateX(58deg)_rotateZ(-24deg)]">
        {svg}
      </div>
    );
  }
  return (
    <div className="pointer-events-none relative -mx-5 h-[150px] overflow-hidden">
      <div className="absolute left-1/2 -top-10 -ml-[75px] h-[300px] w-[150px] [transform:perspective(700px)_rotateX(60deg)_rotateZ(-24deg)]">
        {svg}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[60px] bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
}
