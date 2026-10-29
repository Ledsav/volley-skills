import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Centred status block (icon tile, title, body, actions) used by the
 * auth and access status pages. The role sits on the root so a heading
 * inside an alert is announced with it.
 */
export function StatusLayout({
  icon: Icon,
  illustration,
  title,
  children,
  actions,
  role,
  tone = 'neutral',
  className = '',
}: {
  icon?: LucideIcon;
  illustration?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  role?: 'alert' | 'status';
  tone?: 'neutral' | 'error';
  className?: string;
}) {
  return (
    <div
      role={role}
      className={`mx-auto flex w-full max-w-[400px] flex-col items-center gap-4 text-center ${className}`}
    >
      {illustration ??
        (Icon && (
          <div
            className={`grid h-14 w-14 place-items-center rounded-[16px] bg-surface-2 ${
              tone === 'error' ? 'text-red-strong' : 'text-ink'
            }`}
          >
            <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
          </div>
        ))}
      {title && (
        <h1 tabIndex={-1} className="text-title-1 text-ink">
          {title}
        </h1>
      )}
      {children && <div className="text-body text-ink-2 [overflow-wrap:anywhere]">{children}</div>}
      {actions && <div className="mt-2 flex w-full flex-col gap-2">{actions}</div>}
    </div>
  );
}
