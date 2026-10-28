import type { ReactNode } from 'react';

interface TabProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

/**
 * One underline tab. Active tab takes `blue` (matching links / active nav);
 * `navy` stays reserved for the sidebar and primary actions (design system §7).
 * Render several inside a `<div role="tablist" aria-label="…">` — they switch panels
 * in place, so they are tabs (aria-selected), not navigation (aria-current).
 */
export function Tab({ active, onClick, children }: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`shrink-0 cursor-pointer border-b-2 px-1 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
        active ? 'border-blue text-blue-strong' : 'border-transparent text-slate hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
