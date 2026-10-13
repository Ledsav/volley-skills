// Brand artwork is fixed SVG (src/assets/brand, guide in docs/brand/README.md),
// not theme tokens: the mark must not shift with dark mode.
import lockupOnNavy from '../assets/brand/volley-skills-lockup-on-navy.svg';
import mark from '../assets/brand/volley-skills-mark.svg';

/** The Spin Ball on its own, for light surfaces. Decorative — pair it with visible text. */
export function LogoMark({ className = '' }: { className?: string }) {
  return <img src={mark} alt="" aria-hidden="true" className={className} />;
}

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
