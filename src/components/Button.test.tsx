import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders a real button, defaults to type="button", and forwards onClick', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" onClick={onClick}>
        Save
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies a quiet red treatment for the dangerGhost variant (row-level delete)', () => {
    render(
      <Button variant="dangerGhost" onClick={vi.fn()}>
        Remove
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Remove' });
    expect(button.className).toContain('text-red');
    expect(button.className).not.toContain('bg-red ');
  });

  it('renders a compact square for the icon size', () => {
    render(
      <Button variant="ghost" size="icon" aria-label="Move up" onClick={vi.fn()}>
        ↑
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Move up' });
    expect(button.className).toContain('h-9');
    expect(button.className).toContain('w-9');
    expect(button.className).not.toContain('min-h-11');
  });

  it('always carries a pointer cursor and a focus ring', () => {
    render(
      <Button variant="secondary" onClick={vi.fn()}>
        Import
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Import' });
    expect(button.className).toContain('cursor-pointer');
    expect(button.className).toContain('focus-visible:ring-blue');
  });
});
