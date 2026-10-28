import type { ReactNode } from 'react';
import type { MenuItem } from '../components/Menu';
import { usePublishPageChrome, type PageMainAction } from './PageChrome';

interface PageHeaderProps {
  title: ReactNode;
  /** Small line above the title (e.g. a match's date and competition). */
  eyebrow?: ReactNode;
  /** Muted line under the title. */
  description?: ReactNode;
  /** Page-level buttons; they sit right of the title from `sm`, and stack under it on phones. */
  actions?: ReactNode;
  /** The page's one primary action. The toolbar shows it, so it is not rendered in the content. */
  mainAction?: PageMainAction;
  /** Overflow items for the toolbar's More menu; not rendered in the content. */
  more?: MenuItem[];
  /** Toolbar title when `title` is not a plain string. */
  chromeTitle?: string;
  className?: string;
}

/**
 * The one page title treatment: large title on phones, title-1 from `md`. It also publishes the title,
 * main action and More items to the shell toolbar.
 * A <div>, not <header>: the print stylesheet hides every <header> (app chrome),
 * and the page title must still print.
 */
export function PageHeader({ title, eyebrow, description, actions, mainAction, more, chromeTitle, className = 'mb-6' }: PageHeaderProps) {
  usePublishPageChrome({ title: chromeTitle ?? (typeof title === 'string' ? title : null), mainAction, more });
  return (
    <div data-page-header className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${className}`.trim()}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-0.5 text-sm text-slate">{eyebrow}</div>}
        <h1 className="text-large-title break-words text-ink md:text-title-1">{title}</h1>
        {description && <div className="mt-1 text-slate">{description}</div>}
      </div>
      {actions && <div className="grid auto-cols-fr grid-flow-col gap-2 sm:flex sm:shrink-0 sm:flex-wrap sm:justify-end">{actions}</div>}
    </div>
  );
}
