import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { navGroups } from '../layout/navModel';
import { clubAdminAccess } from '../test/authValue';

const mockClub = vi.hoisted(() => ({ aiEnabled: true }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ access: { isClubAdmin: true, sections: { guides: true } }, isPlatformAdmin: true, club: { aiEnabled: mockClub.aiEnabled } }),
}));

function renderSettings(entry = '/settings') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SettingsPage />
    </MemoryRouter>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    mockClub.aiEnabled = true;
  });

  it('hides the AI provider settings when the club has AI off', () => {
    mockClub.aiEnabled = false;
    renderSettings();
    expect(screen.queryByRole('heading', { name: 'AI provider' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
  });

  it('holds only personal settings: no page links and no sign-out, even for an admin and operator', () => {
    renderSettings();
    // Help links (providers' docs, what is sent) are fine; no sidebar destination is repeated here.
    const pages = navGroups(clubAdminAccess, true).flatMap((g) => g.items.map((i) => i.to));
    const hrefs = screen.queryAllByRole('link').map((l) => l.getAttribute('href'));
    expect(hrefs.filter((h) => h !== null && pages.includes(h))).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('theme is a System, Light and Dark choice that stores it', () => {
    localStorage.removeItem('theme');
    renderSettings();
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'System' }));
    expect(localStorage.getItem('theme')).toBeNull();
    expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');
  });

  it('with storage blocked it shows System and Dark still paints', () => {
    document.documentElement.classList.remove('dark');
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    try {
      renderSettings();
      expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');
      fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    } finally {
      get.mockRestore();
      set.mockRestore();
      document.documentElement.classList.remove('dark');
    }
  });

  it('the AI row opens the AI subpage', () => {
    const { unmount } = renderSettings();
    const row = screen.getByRole('link', { name: /Provider/ });
    expect(row).toHaveAttribute('href', '/settings?view=ai');
    expect(row).toHaveTextContent('Groq');
    unmount();
    renderSettings('/settings?view=ai');
    expect(screen.getByRole('heading', { level: 1, name: 'AI provider' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('view=ai with AI off shows the root settings', () => {
    mockClub.aiEnabled = false;
    renderSettings('/settings?view=ai');
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test connection' })).not.toBeInTheDocument();
  });

  it('focus follows the AI subpage and back', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <main id="main" tabIndex={-1}><SettingsPage /></main>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('link', { name: /Provider/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'AI provider' })).toHaveFocus();
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toHaveFocus();
  });
});
