import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TabBar } from './TabBar';
import { phoneTabs } from './navModel';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess } from '../test/authValue';

vi.mock('../auth/AuthContext');

function renderBar(path: string, pendingSignups?: number) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar pendingSignups={pendingSignups} />
    </MemoryRouter>
  );
}

describe('TabBar', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(authValue({ access: clubAdminAccess }));
  });

  it('renders one link per phone tab plus More, inside the labelled nav', () => {
    renderBar('/');
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAccessibleName();
    const tabs = phoneTabs(clubAdminAccess, false);
    expect(within(nav).getAllByRole('link')).toHaveLength(tabs.length + 1);
    for (const { label } of tabs) expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'More' })).toHaveAttribute('href', '/more');
  });

  it('marks only the current tab, and shows its label while the others keep theirs for screen readers only', () => {
    renderBar('/more');
    const nav = screen.getByRole('navigation');
    const current = within(nav).getByRole('link', { name: 'More' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(within(current).getByText('More')).not.toHaveClass('sr-only');
    const others = within(nav).getAllByRole('link').filter((l) => l !== current);
    for (const l of others) {
      expect(l).not.toHaveAttribute('aria-current');
      expect(l.querySelector('span.sr-only')).toHaveTextContent(/\S/);
    }
  });

  it('shows the pending sign-ups count on More only when there are some', () => {
    const { unmount } = renderBar('/', 3);
    expect(screen.getByRole('link', { name: /More/ })).toHaveTextContent('3');
    unmount();
    renderBar('/', 0);
    expect(screen.getByRole('link', { name: 'More' })).not.toHaveTextContent(/\d/);
  });
});
