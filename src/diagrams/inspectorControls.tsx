import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

/** The editor inspector's building blocks: one look for the desktop panel and the phone's bottom panels. */

/** A titled group of fields; groups are separated by a hairline. */
export function InspectorSection({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-separator px-4 py-4 first:border-t-0">
      {title && <h2 className="text-headline text-ink">{title}</h2>}
      {children}
    </section>
  );
}

const LABEL = 'text-footnote text-ink-2';
const FIELD =
  'h-11 w-full min-w-0 rounded-sm bg-surface-2 px-3 text-base text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:text-callout';

/** A labelled control, the label above it. */
export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

export function TextField({ label, ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label}>
      <input {...rest} className={FIELD} />
    </Field>
  );
}

/** A native select (keyboard and screen readers stay native) dressed as a field with a chevron. */
export function SelectField({
  label,
  children,
  ...rest
}: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label}>
      <span className="relative block">
        <select {...rest} className={`${FIELD} cursor-pointer appearance-none pr-9`}>
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2"
        />
      </span>
    </Field>
  );
}

/** A range slider with its current value shown beside the label. */
export function SliderField({
  label,
  valueText,
  hint,
  ...rest
}: { label: string; valueText: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className={LABEL}>{label}</span>
        <span className="text-footnote font-medium tabular-nums text-ink">{valueText}</span>
      </span>
      <input type="range" {...rest} className="h-6 w-full cursor-pointer accent-[rgb(var(--color-ink))]" />
      {hint && <span className="text-footnote text-ink-2">{hint}</span>}
    </label>
  );
}

/**
 * An on/off row: the text on the left, a switch on the right. The native checkbox stays (visually hidden) so the
 * row keeps its checkbox semantics, keyboard toggling and label.
 */
export function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
      <span className="text-body text-ink">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 motion-reduce:transition-none ${
          checked ? 'bg-ink' : 'bg-surface-3'
        }`}
      >
        <span
          className={`h-6 w-6 rounded-full shadow-card transition-transform duration-200 ease-out-strong motion-reduce:transition-none ${
            checked ? 'translate-x-5 bg-on-ink' : 'translate-x-0 bg-white'
          }`}
        />
      </span>
    </label>
  );
}

/** A row of equal buttons on one track (nudge pad, layer order). */
export function ButtonGroup({ label, columns, children }: { label: string; columns: 2 | 4; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      <div role="group" aria-label={label} className={`grid gap-1 ${columns === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
        {children}
      </div>
    </div>
  );
}

export const GROUP_BUTTON =
  'pressable inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-sm bg-surface-2 px-2 text-footnote font-medium text-ink hover:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** The full-width destructive action at the bottom of the inspector. */
export function DestructiveRow({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-3 text-callout font-semibold text-red-strong hover:bg-red-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {icon}
      {children}
    </button>
  );
}
