// The only place the app mark is rendered. Brand artwork is fixed SVG copied byte for byte from
// docs/design/brand/logo (guide: docs/design/brand/README.md), not theme tokens: it must not shift with dark mode.
import appIcon from '../assets/brand/volley-skills-mark-app-icon.svg';

/**
 * The Spin mark (white on the black app tile) with, by default, the "Volley Skills" wordmark in ink beside it.
 * With `wordmark={false}` the image carries the name instead. The tile has a 1 px edge in dark mode so it does
 * not vanish on a black surface (brand section 6).
 */
export function BrandMark({ className = '', wordmark = true }: { className?: string; wordmark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={appIcon}
        alt={wordmark ? '' : 'Volley Skills'}
        className="h-7 w-7 rounded-[22.5%] shadow-[0_0_0_1px_var(--brand-tile-edge)]"
      />
      {wordmark && <span className="text-headline text-ink">Volley Skills</span>}
    </span>
  );
}
