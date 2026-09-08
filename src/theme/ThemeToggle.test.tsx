import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ThemeToggle } from './ThemeToggle';
import * as theme from './theme';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    vi.spyOn(theme, 'getInitialTheme').mockReturnValue('light');
    vi.spyOn(theme, 'applyTheme');
  });

  it('shows "Dark mode" as the action when currently light', () => {
    render(<ThemeToggle />);
    expect(screen.getByText('Dark mode')).toBeInTheDocument();
  });

  it('switches to dark and shows "Light mode" as the next action when clicked', () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole('button'));

    expect(theme.applyTheme).toHaveBeenCalledWith('dark');
    expect(screen.getByText('Light mode')).toBeInTheDocument();
  });

  it('starts already in dark mode when that is the initial theme', () => {
    vi.spyOn(theme, 'getInitialTheme').mockReturnValue('dark');
    render(<ThemeToggle />);
    expect(screen.getByText('Light mode')).toBeInTheDocument();
  });
});
