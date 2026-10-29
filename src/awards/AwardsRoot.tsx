import type { ReactNode } from 'react';

/**
 * The awards frame: always dark, on its own element only (the app theme on `<html>` is never
 * touched). Sheets, menus and alerts render inside it, so they inherit the dark tokens.
 */
export function AwardsRoot({ children }: { children: ReactNode }) {
  return (
    <div data-awards-root className="dark min-h-[100dvh] bg-bg text-ink" style={{ colorScheme: 'dark' }}>
      {children}
    </div>
  );
}
