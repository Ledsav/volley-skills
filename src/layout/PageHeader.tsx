import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  /** Small line above the title (e.g. a match's date and competition). */
  eyebrow?: ReactNode;
  /** Muted line under the title. */
  description?: ReactNode;
  /** Page-level buttons; they sit right of the title from `sm`, and stack under it on phones. */
  actions?: ReactNode;
  className?: string;
}

/** The one page title treatment (design-system §3 "Page title", 22/28 semibold). */
export function PageHeader({ title, eyebrow, description, actions, className = 'mb-6' }: PageHeaderProps) {
  return (
    <header className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${className}`.trim()}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-0.5 text-sm text-slate">{eyebrow}</div>}
        <h1 className="break-words text-title font-semibold text-ink">{title}</h1>
        {description && <div className="mt-1 text-slate">{description}</div>}
      </div>
      {actions && <div className="grid auto-cols-fr grid-flow-col gap-2 sm:flex sm:shrink-0 sm:flex-wrap sm:justify-end">{actions}</div>}
    </header>
  );
}
