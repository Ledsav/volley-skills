import { Info } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sheet } from './Sheet';
import { useMediaQuery } from './useMediaQuery';

interface InfoTooltipProps {
  /** Accessible name for the trigger button, e.g. "Serve scoring guide". */
  label: string;
  children: ReactNode;
}

const MAX_WIDTH = 256; // 16rem
const GAP = 6;
const PHONE_QUERY = '(max-width: 767px)';

/**
 * A small ⓘ trigger. On desktop, hover or keyboard focus reveals a popover, and a click pins it open until a
 * second click, Escape or a press outside. On a phone a tap opens the same guide in a sheet. The popover is
 * portalled to <body> and fixed-positioned from the trigger's rect, so it is never clipped by an ancestor's
 * `overflow` and never adds to a scroll area.
 */
export function InfoTooltip({ label, children }: InfoTooltipProps) {
  const id = useId();
  const phone = useMediaQuery(PHONE_QUERY, false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
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

  useEffect(() => {
    if (!open) return;
    const close = () => {
      pinned.current = false;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // One Escape dismisses only the tooltip, not a sheet it sits in.
        e.stopPropagation();
        close();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!triggerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const reveal = () => {
    if (!phone) setOpen(true);
  };
  const conceal = () => {
    if (!pinned.current) setOpen(false);
  };

  function onClick() {
    if (phone) {
      setSheet(true);
      return;
    }
    if (pinned.current) {
      pinned.current = false;
      setOpen(false);
    } else {
      pinned.current = true;
      setOpen(true);
    }
  }

  return (
    <span className="inline-flex align-middle" onMouseEnter={reveal} onMouseLeave={conceal}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onFocus={reveal}
        onBlur={conceal}
        onKeyDown={(e) => {
          // Tabbing away from a tooltip pinned by keyboard closes it; a pointer pin survives a stray blur.
          if (e.key === 'Tab') {
            pinned.current = false;
            setOpen(false);
          }
        }}
        onClick={onClick}
        className="relative inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-2 transition-colors before:absolute before:-inset-3.5 hover:text-ink focus:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open &&
        !phone &&
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
            className="pointer-events-none z-50 w-max rounded-xl bg-surface p-3 text-left text-footnote text-ink shadow-pop"
          >
            {children}
          </div>,
          document.body
        )}
      {sheet &&
        createPortal(
          <Sheet title={label} onClose={() => setSheet(false)}>
            <div className="text-footnote text-ink">{children}</div>
          </Sheet>,
          document.body
        )}
    </span>
  );
}
