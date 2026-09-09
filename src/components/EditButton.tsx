import { Pencil } from 'lucide-react';

interface EditButtonProps {
  onClick: () => void;
  /** Defaults to "Edit". Use a more specific label when several sit near each other. */
  label?: string;
  className?: string;
}

/**
 * The one "edit this section" affordance used across the app — a small pencil +
 * label, sized to sit in a card or tile header.
 */
export function EditButton({ onClick, label = 'Edit', className = '' }: EditButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-blue transition-colors hover:bg-blue/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${className}`.trim()}
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
