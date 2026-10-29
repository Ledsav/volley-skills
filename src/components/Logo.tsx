// Brand artwork is fixed SVG (src/assets/brand, guide in docs/brand/README.md),
// not theme tokens: the mark must not shift with dark mode.
import appIcon from '../assets/brand/volley-skills-app-icon.svg';
import lockupOnNavy from '../assets/brand/volley-skills-lockup-on-navy.svg';

/**
 * Full lockup for blue/navy surfaces: the Spin Ball with "VOLLEY / SKILLS"
 * stacked beside it. Sized in em, so set the size with a text-size class on
 * `className`.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex ${className}`}>
      <img src={lockupOnNavy} alt="Volley Skills" className="h-[1.6em] w-auto" />
    </span>
  );
}

/**
 * Icon plus "Volley Skills" wordmark in ink, for theme surfaces. The cleanup
 * increment swaps the image for the new mono mark here, and nowhere else. The
 * app icon's fixed navy tile reads in both themes (brand artwork is not tokenised).
 */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src={appIcon} alt="" className="h-7 w-7" />
      <span className="text-headline text-ink">Volley Skills</span>
    </span>
  );
}
