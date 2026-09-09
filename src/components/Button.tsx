import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dangerGhost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'icon';

// inline-flex + min-h-11 (44px) keeps every text button at least the recommended
// mobile touch-target size, regardless of how tight its padding/text is. The
// `icon` size opts out for dense desktop toolbars (36px square).
const BASE_CLASS =
  'inline-flex items-center justify-center rounded-md font-medium cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue disabled:cursor-not-allowed disabled:opacity-50';

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 py-1.5 text-sm',
  md: 'min-h-11 px-4 py-2',
  icon: 'h-9 w-9 text-sm',
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-navy text-white hover:bg-navy/90',
  secondary: 'border border-blue bg-surface text-blue hover:bg-blue/10',
  ghost: 'text-blue hover:bg-blue/10',
  // Quiet destructive: for row-level "Delete"/"Remove" actions. Solid `destructive`
  // stays reserved for confirm buttons and standalone danger-zone actions.
  dangerGhost: 'text-red hover:bg-red/10',
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
