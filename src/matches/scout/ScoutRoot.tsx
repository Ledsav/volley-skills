import type { ReactNode } from 'react';

/**
 * The scouting frame: always dark, on its own element only (the app theme on `<html>` is never
 * touched). Menus, sheets and alerts render inside it, so they inherit the dark tokens.
 */
export function ScoutRoot({ children }: { children: ReactNode }) {
  return (
    <div data-scout-root className="dark flex h-[100dvh] flex-col overflow-hidden bg-bg text-ink" style={{ colorScheme: 'dark' }}>
      {children}
    </div>
  );
}
