import type { ReactNode } from 'react';

interface TabProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

/**
 * One underline tab. Active tab takes `blue` (matching links / active nav);
 * `navy` stays reserved for the sidebar and primary actions (design system §7).
 * Render several inside a `<nav className="flex gap-6 border-b border-border">`.
 */
export function Tab({ active, onClick, children }: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`shrink-0 cursor-pointer border-b-2 px-1 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
        active ? 'border-blue text-blue' : 'border-transparent text-slate hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
