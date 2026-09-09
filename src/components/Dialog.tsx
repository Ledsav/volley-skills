import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** `lg` widens the panel for form-heavy content (development plan, skills). */
  size?: 'md' | 'lg';
}

const SIZE_CLASS: Record<NonNullable<DialogProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export function Dialog({ title, onClose, children, size = 'md' }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      data-testid="dialog-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`flex max-h-[90vh] w-full ${SIZE_CLASS[size]} flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-pop focus:outline-none`}
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
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
