import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { SignupInfoPage } from './SignupInfoPage';

describe('SignupInfoPage', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('is indexable with its canonical path (a public route)', () => {
    render(<MemoryRouter><SignupInfoPage /></MemoryRouter>);
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('index, follow');
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toMatch(/\/signup$/);
  });
});

describe('SignupInfoPage start', () => {
  it('Start is an ink pill to the club form', () => {
    render(<MemoryRouter><SignupInfoPage /></MemoryRouter>);
    const start = screen.getByRole('link', { name: 'Start' });
    expect(start).toHaveAttribute('href', '/signup/club');
    expect(start).toHaveClass('bg-ink');
  });
});
