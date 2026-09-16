import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** `lg` widens the panel for form-heavy content (development plan, skills). */
  size?: 'md' | 'lg';
  /**
   * Fills the viewport edge-to-edge below the `sm` breakpoint instead of a
   * centered card, reverting to the normal centered card from `sm` up. For
   * content meant to be worked in during a live session on a phone.
   */
  mobileSheet?: boolean;
}

const SIZE_CLASS: Record<NonNullable<DialogProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

const MOBILE_SHEET_SIZE_CLASS: Record<NonNullable<DialogProps['size']>, string> = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
};

export function Dialog({ title, onClose, children, size = 'md', mobileSheet = false }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the panel once on mount only — re-running this on every render (e.g.
  // because `onClose` is an inline function recreated by the parent) would
  // steal focus away from an input the user is actively typing into.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      data-testid="dialog-backdrop"
      className={`fixed inset-0 z-50 flex bg-black/50 ${
        mobileSheet ? 'items-stretch justify-stretch p-0 sm:items-center sm:justify-center sm:p-4' : 'items-center justify-center p-4'
      }`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`flex w-full flex-col overflow-hidden bg-surface focus:outline-none ${
          mobileSheet
            ? `h-full max-h-none rounded-none border-0 shadow-none sm:h-auto sm:max-h-[90vh] sm:rounded-lg sm:border sm:border-border sm:shadow-pop ${MOBILE_SHEET_SIZE_CLASS[size]}`
            : `max-h-[90vh] rounded-lg border border-border shadow-pop ${SIZE_CLASS[size]}`
        }`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate transition-colors hover:bg-bg hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto py-5 pl-6 pr-3 [scrollbar-gutter:stable]">{children}</div>
      </div>
    </div>
  );
}
