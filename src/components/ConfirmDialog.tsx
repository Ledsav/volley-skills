import { Button } from './Button';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  error?: string | null;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, error }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="alertdialog"
        aria-label={title}
        className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-pop"
      >
        <h2 className="mb-2 text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        <p className="text-slate">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
