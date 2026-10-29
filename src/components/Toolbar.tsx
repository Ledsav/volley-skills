import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode, type RefObject } from 'react';
import { TOOLBAR_H } from '../layout/chromeMetrics';
import { Button, buttonClassName } from './Button';

/**
 * Sticky top bar: transparent at rest (the page shows its large title), glass with the inline title once the
 * content scrolls. Slot order is leading, title, actions, then the one main action.
 */
export function Toolbar({
  title,
  leading,
  actions,
  mainAction,
  scrollContainer,
}: {
  title: string;
  leading?: ReactNode;
  actions?: ReactNode;
  mainAction?: ReactNode;
  scrollContainer?: RefObject<HTMLElement>;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = scrollContainer?.current ?? null;
    const read = () => setScrolled((el ? el.scrollTop : window.scrollY) > 0);
    read();
    const target: HTMLElement | Window = el ?? window;
    target.addEventListener('scroll', read, { passive: true });
    return () => target.removeEventListener('scroll', read);
  }, [scrollContainer]);

  return (
    <header
      data-scrolled={scrolled}
      style={{ top: 'env(safe-area-inset-top, 0px)', height: TOOLBAR_H }}
      className={`sticky z-30 flex items-center gap-2 px-4 ${scrolled ? 'glass' : 'bg-transparent'}`}
    >
      {leading && <div className="flex shrink-0 items-center gap-1">{leading}</div>}
      <span
        aria-hidden={!scrolled || undefined}
        className={`min-w-0 flex-1 truncate text-headline text-ink transition-opacity duration-150 motion-reduce:transition-none ${
          scrolled ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {title}
      </span>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      {mainAction && <div className="flex shrink-0 items-center">{mainAction}</div>}
    </header>
  );
}

/** MainAction's classes, shared with a main action that opens a menu. */
export const MAIN_ACTION_CLASS = `${buttonClassName('primary', 'pill')} relative gap-2 before:absolute before:-inset-y-1 before:inset-x-0`;

/** The screen's one main action: a filled ink pill with a 44px hit area around the 36px pill. */
export function MainAction({
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <Button
      variant="primary"
      size="pill"
      className={`relative before:absolute before:-inset-y-1 before:inset-x-0 ${className}`.trim()}
      {...rest}
    >
      {children}
    </Button>
  );
}
