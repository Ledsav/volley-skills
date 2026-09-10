import { Info } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface InfoTooltipProps {
  /** Accessible name for the trigger button, e.g. "Serve scoring guide". */
  label: string;
  children: ReactNode;
}

const MAX_WIDTH = 256; // 16rem
const GAP = 6;

/**
 * A small ⓘ trigger that reveals a popover on hover or keyboard focus. The panel
 * is portalled to <body> and fixed-positioned from the trigger's rect, so it is
 * never clipped by an ancestor's `overflow` and never adds to a scroll area.
 */
export function InfoTooltip({ label, children }: InfoTooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 0;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - MAX_WIDTH - 8));
    const below = r.bottom + GAP;
    const flipsUp = below + panelHeight > window.innerHeight - 8 && r.top - GAP - panelHeight > 8;
    setPos({ top: flipsUp ? r.top - GAP - panelHeight : below, left });
  }, [open, children]);

  return (
    <span
      className="inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate transition-colors hover:text-ink focus:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            role="tooltip"
            style={{
              position: 'fixed',
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              maxWidth: MAX_WIDTH,
            }}
            className="pointer-events-none z-50 w-max rounded-md border border-border bg-surface p-3 text-left text-xs font-normal leading-relaxed text-ink shadow-pop"
          >
            {children}
          </div>,
          document.body
        )}
    </span>
  );
}
