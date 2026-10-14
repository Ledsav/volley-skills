import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tab } from './Tab';

describe('Tab', () => {
  it('marks the active tab as selected with the blue underline', () => {
    render(
      <Tab active onClick={vi.fn()}>
        Overview
      </Tab>
    );
    const tab = screen.getByRole('tab', { name: 'Overview' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(tab.className).toContain('border-blue');
  });

  it('leaves an inactive tab unselected and calls onClick', () => {
    const onClick = vi.fn();
    render(
      <Tab active={false} onClick={onClick}>
        Settings
      </Tab>
    );
    const tab = screen.getByRole('tab', { name: 'Settings' });
    expect(tab).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(tab);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
