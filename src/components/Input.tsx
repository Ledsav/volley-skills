import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

// min-w-0 lets a field shrink inside a flex row instead of holding its intrinsic
// (~20ch) width, which would push siblings off-screen on phones.
export const FIELD_CLASS =
  'min-w-0 rounded-[12px] border border-transparent bg-surface-2 px-3.5 py-3 text-base text-ink placeholder:text-ink-3 sm:text-body focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus/20';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = 'w-full', ...rest }: InputProps) {
  return <input className={`${FIELD_CLASS} ${className}`.trim()} {...rest} />;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = 'w-full', ...rest }: TextareaProps) {
  return <textarea className={`${FIELD_CLASS} ${className}`.trim()} {...rest} />;
}
