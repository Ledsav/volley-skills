import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { useModalLayer } from './useModalLayer';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** `lg` widens the panel for form-heavy content (development plan, skills). */
  size?: 'md' | 'lg';
  /**
   * Fills the viewport edge-to-edge below the `sm` breakpoint instead of a
   * centered card, reverting to the normal centered card from `sm` up. For
   * content meant to be read or worked in on a phone (a full-screen page
   * with a close button rather than a floating popup).
   */
  mobileSheet?: boolean;
  /**
   * Pinned below the scrolling body, so primary actions (Save / Cancel) stay
   * reachable on a phone without scrolling to the end of a long form. A form
   * in the body wires its submit button here via the `form` attribute.
   */
  footer?: ReactNode;
  /**
   * The form has unsaved changes: a backdrop tap, Escape or the close button asks
   * "Discard changes?" first instead of closing. Explicit Cancel buttons in the
   * body still call `onClose` directly.
   */
  dirty?: boolean;
  /**
   * Treat the dialog as dirty once any field inside it changes (inputs bubble
   * `onChange`), so form dialogs get the discard guard without tracking state.
   */
  guardUnsaved?: boolean;
}

const SIZE_CLASS: Record<NonNullable<DialogProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

const MOBILE_SHEET_SIZE_CLASS: Record<NonNullable<DialogProps['size']>, string> = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
};

export function Dialog({ title, onClose, children, size = 'md', mobileSheet = false, footer, dirty = false, guardUnsaved = false }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [edited, setEdited] = useState(false);
  const markEdited = guardUnsaved ? () => setEdited(true) : undefined;
  const requestClose = () => (dirty || edited ? setConfirmDiscard(true) : onClose());

  // Focus the panel once on mount only — re-running this on every render (e.g.
  // because `onClose` is an inline function recreated by the parent) would
  // steal focus away from an input the user is actively typing into.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useModalLayer(requestClose, panelRef);

  return (
    <>
      <div
        data-testid="dialog-backdrop"
        className={`fixed inset-0 z-50 flex bg-black/50 ${
          mobileSheet ? 'items-stretch justify-stretch p-0 sm:items-center sm:justify-center sm:p-4' : 'items-center justify-center p-4'
        }`}
        onClick={requestClose}
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
          <header
            className={`flex shrink-0 items-center justify-between gap-4 border-b border-border ${
              mobileSheet ? 'px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-4' : 'px-6 py-4'
            }`}
          >
            <h2 className="min-w-0 truncate text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="-mr-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate transition-colors hover:bg-bg hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-blue sm:h-9 sm:w-9"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>
          <div
            onChange={markEdited}
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain py-5 [scrollbar-gutter:stable] ${
              mobileSheet ? 'px-4 sm:pl-6 sm:pr-3' : 'pl-6 pr-3'
            }`}
          >
            {children}
          </div>
          {footer && (
            <footer
              onChange={markEdited}
              className={`flex shrink-0 items-center justify-end gap-3 border-t border-border bg-surface ${
                mobileSheet ? 'px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-3' : 'px-6 py-3'
              }`}
            >
              {footer}
            </footer>
          )}
        </div>
      </div>
      {confirmDiscard && (
        <ConfirmDialog
          title="Discard changes?"
          message="Your changes haven't been saved."
          confirmLabel="Discard"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
