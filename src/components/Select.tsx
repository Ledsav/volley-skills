import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Field, FIELD_CLASS } from './Input';

/**
 * A native select (keyboard, screen readers and the phone picker stay native) dressed as a field. The chevron and
 * its right padding come from the global select rule in index.css, so a plain `<select className={FIELD_CLASS}>`
 * looks the same; this is the shorthand. Full width unless `className` says otherwise.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = 'w-full', children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={`${FIELD_CLASS} ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
});

/** A select with its label above it (and optional helper text below). */
export function SelectField({
  label,
  hint,
  children,
  className,
  ...rest
}: { label: ReactNode; hint?: ReactNode; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint}>
      <Select className={className} {...rest}>
        {children}
      </Select>
    </Field>
  );
}
