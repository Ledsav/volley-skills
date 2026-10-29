import type { ReactNode } from 'react';

/** Shared pill for filter chips and toggles: ink when active, quiet surface otherwise. */
export function chipClass(active: boolean): string {
  return (
    'pressable inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-4 text-callout font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ' +
    (active ? 'bg-ink text-on-ink' : 'bg-surface-2 text-ink-2 hover:bg-surface-3')
  );
}

export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0 ${className}`}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
          className={chipClass(option.id === value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ToggleChip({
  pressed,
  onToggle,
  label,
  ariaLabel,
  icon,
}: {
  pressed: boolean;
  onToggle: () => void;
  label: string;
  ariaLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <button type="button" aria-pressed={pressed} aria-label={ariaLabel} onClick={onToggle} className={chipClass(pressed)}>
      {icon}
      {label}
    </button>
  );
}
