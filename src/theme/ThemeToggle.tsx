import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, getInitialTheme, type Theme } from './theme';

interface ThemeToggleProps {
  className?: string;
  /** Hides the text label visually (still present for screen readers) — for tight spaces like a floating mobile button. */
  compact?: boolean;
}

export function ThemeToggle({ className = '', compact = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;
  const label = nextTheme === 'dark' ? 'Dark mode' : 'Light mode';

  return (
    <button type="button" onClick={() => setTheme(nextTheme)} className={className}>
      <Icon size={compact ? 18 : 20} strokeWidth={1.5} />
      <span className={compact ? 'sr-only' : ''}>{label}</span>
    </button>
  );
}
