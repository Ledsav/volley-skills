import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { navGroups } from '../layout/navModel';
import { clubAdminAccess } from '../test/authValue';

const mockClub = vi.hoisted(() => ({ aiEnabled: true }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ access: { isClubAdmin: true, sections: { guides: true } }, isPlatformAdmin: true, club: { aiEnabled: mockClub.aiEnabled } }),
}));

function renderSettings() {
  return render(
    <MemoryRouter>
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

  it('shows the theme toggle, full width on phones', () => {
    renderSettings();
    const themeBtn = screen.getByRole('button', { name: /dark mode|light mode/i });
    expect((themeBtn.closest('section') as HTMLElement).className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(themeBtn.className).toContain('w-full');
  });

  it('renders each section as a settings row that becomes a 3-column grid on desktop', () => {
    renderSettings();
    for (const title of ['Appearance', 'AI provider']) {
      const section = screen.getByRole('heading', { name: title }).closest('section') as HTMLElement;
      expect(section.className).toContain('lg:grid-cols-3');
    }
  });
});
