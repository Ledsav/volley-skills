import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { AuthShell } from './AuthShell';

function setup(props: Partial<React.ComponentProps<typeof AuthShell>> = {}) {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <AuthShell {...props}>
          <p>form</p>
        </AuthShell>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('AuthShell', () => {
  it('draws the court as decorative inline svg and shows no image but the brand mark', () => {
    const { container } = setup({ title: 'Welcome back' });
    const court = screen.getByTestId('auth-court');
    expect(court.tagName.toLowerCase()).toBe('svg');
    expect(court).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('img:not([alt=""])')).toHaveLength(0);
  });

  it('shows the title as h1 and the nav action as a link', () => {
    setup({ title: 'Welcome back', navAction: { to: '/request-access', label: 'Request access' } });
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request access' })).toHaveAttribute('href', '/request-access');
  });

  it('renders the tagline with Together. in ink-3', () => {
    const { container } = setup();
    expect(screen.getByText('Together.')).toHaveClass('text-ink-3');
    expect(container.querySelector('.uppercase')).toBeNull();
  });

  it('adds the phone court strip only on pages with a title', () => {
    const { unmount } = setup({ title: 'Welcome back' });
    expect(screen.getByTestId('auth-court-strip')).toBeInTheDocument();
    unmount();
    setup();
    expect(screen.queryByTestId('auth-court-strip')).toBeNull();
  });

  it('pins the legal links when asked', () => {
    const { unmount } = setup();
    expect(screen.queryByRole('navigation', { name: 'Legal' })).toBeNull();
    unmount();
    setup({ legalLinks: true });
    expect(screen.getByRole('navigation', { name: 'Legal' })).toBeInTheDocument();
  });
});
