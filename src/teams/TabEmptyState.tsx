import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { StatusLayout } from '../components/StatusLayout';

/**
 * The Status layout (icon tile, title, body, optional action) for an empty list inside a page or sheet. The title is
 * a section heading, not StatusLayout's page-level h1, because the page already has its own.
 */
export function TabEmptyState({
  icon,
  title,
  body,
  action,
  className = '',
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`py-8 ${className}`.trim()}>
      <StatusLayout icon={icon} actions={action}>
        <h3 className="text-headline text-ink">{title}</h3>
        {body && <p className="mt-1 text-callout text-ink-2">{body}</p>}
      </StatusLayout>
    </div>
  );
}
