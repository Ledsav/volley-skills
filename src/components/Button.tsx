import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md';

const BASE_CLASS =
  'rounded-md font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue disabled:cursor-not-allowed disabled:opacity-50';

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-navy text-white hover:bg-navy/90',
  secondary: 'border border-blue bg-surface text-blue hover:bg-blue/10',
  ghost: 'text-blue hover:bg-blue/10',
  destructive: 'bg-red text-white hover:bg-red-strong',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({ variant, size = 'md', className = '', children, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={`${BASE_CLASS} ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
