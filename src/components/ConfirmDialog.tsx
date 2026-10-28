import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { useMediaQuery } from './useMediaQuery';
import { useModalLayer } from './useModalLayer';
import { useT } from '../i18n/I18nProvider';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  error?: string | null;
  /** `destructive` (default: every current caller) paints the confirm in red text. */
  tone?: 'destructive' | 'default';
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, error, tone = 'destructive' }: ConfirmDialogProps) {
  const c = useT().common;
  const phone = useMediaQuery('(max-width: 767px)', false);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useModalLayer(onCancel, panelRef);

  // Start on Cancel: the safe choice for a destructive confirmation.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const confirmVariant = tone === 'destructive' ? 'dangerGhost' : 'ghost';
  const errorLine = error && (
    <p role="alert" className="px-4 pb-3 text-center text-footnote text-red-strong">
      {error}
    </p>
  );

  if (phone) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end bg-[var(--scrim)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
          data-layout="sheet"
          tabIndex={-1}
          className="flex w-full flex-col gap-2 focus:outline-none"
        >
          <div className="overflow-hidden rounded-xl bg-surface shadow-pop">
            <div className="px-4 py-4 text-center">
              <h2 className="text-headline text-ink">{title}</h2>
              <p className="mt-1 text-footnote text-ink-2">{message}</p>
            </div>
            {errorLine}
            <div className="border-t border-separator">
              <Button variant={confirmVariant} className="w-full rounded-none" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </div>
          <Button ref={cancelRef} variant="ghost" className="w-full rounded-xl bg-surface shadow-pop" onClick={onCancel}>
            {c.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--scrim)] p-4">
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        data-layout="alert"
        tabIndex={-1}
        className="w-full max-w-sm overflow-hidden rounded-xl bg-surface shadow-pop focus:outline-none"
      >
        <div className="px-6 pb-5 pt-6 text-center">
          <h2 className="text-headline text-ink">{title}</h2>
          <p className="mt-1 text-footnote text-ink-2">{message}</p>
        </div>
        {errorLine}
        <div className="grid grid-cols-2 border-t border-separator">
          <Button ref={cancelRef} variant="ghost" className="rounded-none rounded-bl-xl" onClick={onCancel}>
            {c.cancel}
          </Button>
          <Button variant={confirmVariant} className="rounded-none rounded-br-xl border-l border-separator" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
