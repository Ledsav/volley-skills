import { useEffect, useRef } from 'react';
import { Button } from '../../components/Button';
import { useMediaQuery } from '../../components/useMediaQuery';
import { useModalLayer } from '../../components/useModalLayer';
import { useT } from '../../i18n/I18nProvider';

interface TakeoverSheetProps {
  onTakeBack: () => void;
  onLeave: () => void;
}

/**
 * Shown when another device took over the match. Escape and the scrim do
 * nothing: the coach must choose. Laid out like ConfirmDialog (alert on desktop,
 * action sheet on phones), with focus starting on Leave, the safe choice.
 */
export function TakeoverSheet({ onTakeBack, onLeave }: TakeoverSheetProps) {
  const sp = useT().scout.page;
  const phone = useMediaQuery('(max-width: 767px)', false);
  const panelRef = useRef<HTMLDivElement>(null);
  const leaveRef = useRef<HTMLButtonElement>(null);
  useModalLayer(() => undefined, panelRef);

  useEffect(() => {
    leaveRef.current?.focus();
  }, []);

  const copy = (
    <>
      <h2 className="text-headline text-ink">{sp.takenOverTitle}</h2>
      <p className="mt-1 text-footnote text-ink-2">{sp.takenOverMessage}</p>
    </>
  );

  if (phone) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end bg-[var(--scrim)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-label={sp.takenOverTitle}
          data-layout="sheet"
          tabIndex={-1}
          className="flex w-full flex-col gap-2 focus:outline-none"
        >
          <div className="overflow-hidden rounded-xl bg-surface shadow-pop">
            <div className="px-4 py-4 text-center">{copy}</div>
            <div className="border-t border-separator">
              <Button variant="ghost" className="w-full rounded-none" onClick={onTakeBack}>{sp.takeBack}</Button>
            </div>
          </div>
          <Button ref={leaveRef} variant="ghost" className="w-full rounded-xl bg-surface shadow-pop" onClick={onLeave}>
            {sp.leave}
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
        aria-label={sp.takenOverTitle}
        data-layout="alert"
        tabIndex={-1}
        className="w-full max-w-sm overflow-hidden rounded-xl bg-surface shadow-pop focus:outline-none"
      >
        <div className="px-6 pb-5 pt-6 text-center">{copy}</div>
        <div className="grid grid-cols-2 border-t border-separator">
          <Button ref={leaveRef} variant="ghost" className="rounded-none rounded-bl-xl" onClick={onLeave}>{sp.leave}</Button>
          <Button variant="ghost" className="rounded-none rounded-br-xl border-l border-separator" onClick={onTakeBack}>
            {sp.takeBack}
          </Button>
        </div>
      </div>
    </div>
  );
}
