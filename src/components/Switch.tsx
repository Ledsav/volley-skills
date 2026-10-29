import { useId, type ReactNode } from 'react';

/**
 * An on/off switch (design system: settings toggles). The native checkbox stays, visually hidden and with
 * `role="switch"`, so it keeps its label, keyboard toggling (Space) and form semantics; the track is decoration.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-flex h-7 w-12 items-center rounded-full p-0.5 transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-disabled:opacity-50 motion-reduce:transition-none ${
          checked ? 'bg-ink' : 'bg-surface-3'
        }`}
      >
        <span
          className={`h-6 w-6 rounded-full shadow-card transition-transform duration-200 ease-out-strong motion-reduce:transition-none ${
            checked ? 'translate-x-5 bg-on-ink' : 'translate-x-0 bg-white'
          }`}
        />
      </span>
    </span>
  );
}

/** A settings row: the label (and optional description) on the left, the switch on the right; the label toggles it. */
export function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  className = '',
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`flex min-h-11 items-center justify-between gap-3 ${className}`.trim()}>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block cursor-pointer text-body text-ink">
          {label}
        </label>
        {description && (
          <p id={`${id}-d`} className="mt-0.5 text-footnote text-ink-2">
            {description}
          </p>
        )}
      </div>
      <Switch id={id} checked={checked} onChange={onChange} disabled={disabled} aria-describedby={description ? `${id}-d` : undefined} />
    </div>
  );
}
