import type { ReactNode } from 'react';

/**
 * Centered content-card shell shared by the auth screens and the auth
 * loading/error states, so they follow the same design-system treatment
 * as the rest of the app (bg canvas, bordered surface card, shadow-card).
 */
export function AuthShell({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-card">
        {title && <h1 className="mb-4 text-xl font-semibold tracking-[-0.01em] text-ink">{title}</h1>}
        {children}
      </div>
    </div>
  );
}
