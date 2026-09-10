import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface InfoTooltipProps {
  /** Accessible name for the trigger button, e.g. "Serve scoring guide". */
  label: string;
  children: ReactNode;
}

/**
 * A small ⓘ trigger that reveals a popover on hover or keyboard focus. Pure CSS
 * (no state), so it is cheap to scatter through a list; the panel is anchored to
 * the trigger's left edge and grows rightward to stay on screen.
 */
export function InfoTooltip({ label, children }: InfoTooltipProps) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate transition-colors hover:text-ink focus:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 w-max max-w-[16rem] rounded-md border border-border bg-surface p-3 text-left text-xs font-normal leading-relaxed text-ink opacity-0 shadow-pop transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
