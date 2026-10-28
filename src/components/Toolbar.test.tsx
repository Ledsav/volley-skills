import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MainAction, Toolbar } from './Toolbar';

afterEach(() => {
  window.scrollY = 0;
});

describe('Toolbar', () => {
  it('is transparent at the top and glass once scrolled', () => {
    render(<Toolbar title="Trainings" />);
    const header = document.querySelector('header')!;
    expect(header).toHaveAttribute('data-scrolled', 'false');
    expect(header.className).not.toContain('glass');
    act(() => {
      window.scrollY = 24;
      fireEvent.scroll(window);
    });
    expect(header).toHaveAttribute('data-scrolled', 'true');
    expect(header.className).toContain('glass');
  });

  it('reads the initial scroll position on mount', () => {
    window.scrollY = 10;
    render(<Toolbar title="Trainings" />);
    expect(document.querySelector('header')).toHaveAttribute('data-scrolled', 'true');
  });

  it('renders the main action last, after the actions', () => {
    render(
      <Toolbar
        title="Trainings"
        leading={<button>Back</button>}
        actions={<button>Search</button>}
        mainAction={<MainAction>New</MainAction>}
      />,
    );
    const names = Array.from(document.querySelectorAll('header button')).map((b) => b.textContent);
    expect(names).toEqual(['Back', 'Search', 'New']);
  });

  it('MainAction is a primary pill button', () => {
    render(<MainAction>New</MainAction>);
    const button = screen.getByRole('button', { name: 'New' });
    expect(button.className).toContain('bg-ink');
    expect(button.className).toContain('rounded-full');
  });
});
