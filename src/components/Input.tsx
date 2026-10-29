import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

// min-w-0 lets a field shrink inside a flex row instead of holding its intrinsic
// (~20ch) width, which would push siblings off-screen on phones.
// The fill is surface-2, which steps one shade darker on the bg canvas (index.css "Fill context"), so a field is
// visible both on the page and inside a card or sheet.
export const FIELD_CLASS =
  'min-w-0 rounded-[12px] border border-transparent bg-surface-2 px-3.5 py-3 text-base text-ink placeholder:text-ink-3 sm:text-body focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus/20';

/** The one form-label look (design system: footnote, ink-2, 6 px above its control). */
export const FIELD_LABEL_CLASS = 'mb-1.5 block text-footnote text-ink-2';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = 'w-full', ...rest }: InputProps) {
  return <input className={`${FIELD_CLASS} ${className}`.trim()} {...rest} />;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = 'w-full', ...rest }: TextareaProps) {
  return <textarea className={`${FIELD_CLASS} ${className}`.trim()} {...rest} />;
}

/** A form label above its control: `<FieldLabel htmlFor="name">Name</FieldLabel>`. */
export function FieldLabel({ className = '', children, ...rest }: LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) {
  return (
    <label className={`${FIELD_LABEL_CLASS} ${className}`.trim()} {...rest}>
      {children}
    </label>
  );
}

/**
 * A labelled control with optional helper text: the label wraps the control, so no id is needed.
 * `<Field label="Name"><Input … /></Field>`.
 */
export function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col ${className}`.trim()}>
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      {children}
      {hint && <span className="mt-1.5 text-footnote text-ink-2">{hint}</span>}
    </label>
  );
}
