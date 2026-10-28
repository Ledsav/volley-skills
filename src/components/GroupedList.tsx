import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface GroupedListProps {
  header?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** iOS inset-grouped list: a rounded surface of rows with an optional sentence-case header and footnote. */
export function GroupedList({ header, footer, children, className = '' }: GroupedListProps) {
  return (
    <section className={className}>
      {header && <h3 className="px-4 pb-2 text-caption text-ink-2">{header}</h3>}
      <ul className="overflow-hidden rounded-lg bg-surface shadow-card">{children}</ul>
      {footer && <div className="px-4 pt-2 text-footnote text-ink-2">{footer}</div>}
    </section>
  );
}

interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Renders a router link and a chevron. */
  to?: string;
  /** Renders a button, no chevron. */
  onClick?: () => void;
  /** Spread on the interactive element (or the row itself when it is plain), e.g. `useContextMenu().targetProps`. */
  rowProps?: HTMLAttributes<HTMLElement>;
}

export function ListRow({ title, subtitle, leading, trailing, to, onClick, rowProps }: ListRowProps) {
  const body = (
    <>
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="flex min-w-0 flex-1 flex-col py-2">
        <span className="truncate text-headline text-ink">{title}</span>
        {subtitle && <span className="truncate text-footnote text-ink-2">{subtitle}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center text-body text-ink-2">{trailing}</span>}
      {to && <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-3" />}
    </>
  );
  const inner = 'flex min-h-[52px] w-full items-center gap-3 px-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus';
  const tappable = `${inner} cursor-pointer active:bg-surface-3`;
  const separator = `relative before:absolute before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden ${
    leading ? 'before:left-[56px]' : 'before:left-4'
  }`;

  return (
    <li className={separator} {...(!to && !onClick ? rowProps : undefined)}>
      {to ? (
        <Link to={to} className={tappable} {...rowProps}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={tappable} {...rowProps}>
          {body}
        </button>
      ) : (
        <div className={inner}>{body}</div>
      )}
    </li>
  );
}
