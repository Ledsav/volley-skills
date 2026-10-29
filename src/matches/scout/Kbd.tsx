import type { ReactNode } from 'react';

/** Desktop-only keyboard-shortcut badge; decorative (the cheat sheet is the accessible list). */
export function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      aria-hidden="true"
      className={`hidden min-w-4 items-center justify-center rounded-sm border border-separator bg-surface-2 px-1 font-sans text-[10px] font-medium leading-4 text-ink-2 lg:inline-flex ${className}`}
    >
      {children}
    </kbd>
  );
}
