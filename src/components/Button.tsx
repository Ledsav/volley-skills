import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dangerGhost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'icon' | 'pill';

// inline-flex + min-h-11 (44px) keeps every text button at least the recommended
// mobile touch-target size, regardless of how tight its padding/text is. The
// `icon` size opts out for dense desktop toolbars (36px square).
const BASE_CLASS =
  'inline-flex items-center justify-center font-semibold tracking-[-0.01em] pressable cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50';

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-11 rounded-md px-3 py-1.5 text-sm',
  md: 'min-h-11 rounded-md px-4 py-2',
  icon: 'h-9 w-9 rounded-md text-sm',
  pill: 'min-h-9 rounded-full px-4 text-callout font-semibold',
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-on-ink hover:bg-ink/90',
  secondary: 'bg-surface-2 text-ink hover:bg-surface-3',
  ghost: 'text-ink hover:bg-surface-2',
  // Quiet destructive: for row-level "Delete"/"Remove" actions. Solid `destructive`
  // stays reserved for confirm buttons and standalone danger-zone actions.
  dangerGhost: 'text-red-strong hover:bg-red-tint',
  destructive: 'font-semibold text-red-strong hover:bg-red-tint',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size = 'md', className = '', children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={`${BASE_CLASS} ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
});
