import { Moon, Sun } from 'lucide-react';
import type { Theme } from './theme';
import { useTheme } from './useTheme';

interface ThemeToggleProps {
  className?: string;
  /** Hides the text label visually (still present for screen readers) — for tight spaces like a floating mobile button. */
  compact?: boolean;
}

export function ThemeToggle({ className = '', compact = false }: ThemeToggleProps) {
  const [theme, toggle] = useTheme();
  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;
  const label = nextTheme === 'dark' ? 'Dark mode' : 'Light mode';

  return (
    <button type="button" onClick={toggle} className={className}>
      <Icon size={compact ? 18 : 20} strokeWidth={1.5} />
      <span className={compact ? 'sr-only' : ''}>{label}</span>
    </button>
  );
}
