import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const FIELD_CLASS =
  'rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-blue focus:border-blue';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = 'w-full', ...rest }: InputProps) {
  return <input className={`${FIELD_CLASS} ${className}`.trim()} {...rest} />;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = 'w-full', ...rest }: TextareaProps) {
  return <textarea className={`${FIELD_CLASS} ${className}`.trim()} {...rest} />;
}
