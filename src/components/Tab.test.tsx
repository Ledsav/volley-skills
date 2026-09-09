import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tab } from './Tab';

describe('Tab', () => {
  it('marks the active tab with aria-current and the blue underline', () => {
    render(
      <Tab active onClick={vi.fn()}>
        Overview
      </Tab>
    );
    const tab = screen.getByRole('button', { name: 'Overview' });
    expect(tab).toHaveAttribute('aria-current', 'page');
    expect(tab.className).toContain('border-blue');
  });

  it('leaves an inactive tab without aria-current and calls onClick', () => {
    const onClick = vi.fn();
    render(
      <Tab active={false} onClick={onClick}>
        Settings
      </Tab>
    );
    const tab = screen.getByRole('button', { name: 'Settings' });
    expect(tab).not.toHaveAttribute('aria-current');
    fireEvent.click(tab);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
