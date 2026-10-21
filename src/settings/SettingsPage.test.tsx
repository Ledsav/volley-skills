import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

const mockSignOut = vi.fn();

const mockAccess = vi.hoisted(() => ({ current: null as null | { isClubAdmin: boolean; sections: { guides: boolean } }, platform: false }));
const mockClub = vi.hoisted(() => ({ aiEnabled: true }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ access: mockAccess.current, isPlatformAdmin: mockAccess.platform, club: { aiEnabled: mockClub.aiEnabled } }),
}));
vi.mock('../interest/interestApi', () => ({ countUnreviewedInterestSignups: vi.fn().mockResolvedValue(3) }));

vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: (...args: unknown[]) => mockSignOut(...args) }));

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    mockSignOut.mockReset();
    mockAccess.current = null;
    mockAccess.platform = false;
    mockClub.aiEnabled = true;
  });

  it('hides the AI provider settings when the club has AI off', () => {
    mockClub.aiEnabled = false;
    renderSettings();
    expect(screen.queryByRole('heading', { name: 'AI provider' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
  });

  it('hides the Admin section from members without admin access', () => {
    renderSettings();
    expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('does not show the pending-request count to a club admin who is not the platform operator', async () => {
    mockAccess.current = { isClubAdmin: true, sections: { guides: true } };
    renderSettings();
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    await Promise.resolve();
    expect(within(nav).getByRole('link', { name: /Club/ })).not.toHaveTextContent('pending requests');
    expect(within(nav).queryByRole('link', { name: /Platform/ })).not.toBeInTheDocument();
  });

  it('links the platform operator to Platform, with the pending-request count there and not on Club', async () => {
    mockAccess.current = { isClubAdmin: true, sections: { guides: true } };
    mockAccess.platform = true;
    renderSettings();
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(nav).getByRole('link', { name: /Guides/ })).toHaveAttribute('href', '/admin/guides');
    const clubLink = within(nav).getByRole('link', { name: /Club/ });
    expect(clubLink).toHaveAttribute('href', '/club');
    const platformLink = within(nav).getByRole('link', { name: /Platform/ });
    expect(platformLink).toHaveAttribute('href', '/platform');
    await waitFor(() => expect(platformLink).toHaveTextContent('3 pending requests'));
    expect(clubLink).not.toHaveTextContent('pending requests');
  });

  it('shows a platform operator with no club access only Platform', () => {
    mockAccess.platform = true;
    renderSettings();
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(nav).getByRole('link', { name: /Platform/ })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /Club/ })).not.toBeInTheDocument();
  });

  it('shows only Guides to a guides-section admin', () => {
    mockAccess.current = { isClubAdmin: false, sections: { guides: true } };
    renderSettings();
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(nav).getByRole('link', { name: /Guides/ })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /Club/ })).not.toBeInTheDocument();
  });

  it('shows the theme toggle', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /dark mode|light mode/i })).toBeInTheDocument();
  });

  it('signs out and clears local data when Sign out is clicked', async () => {
    mockSignOut.mockResolvedValue('signedOut');
    renderSettings();

    fireEvent.click(screen.getByText('Sign out'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ force: false, beforeSignOut: expect.any(Function) }));
  });

  it('asks before signing out when scouting actions have not synced', async () => {
    mockSignOut.mockResolvedValueOnce('unsynced').mockResolvedValueOnce('signedOut');
    renderSettings();

    fireEvent.click(screen.getByText('Sign out'));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(/haven't synced yet/);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('stacks each settings row for mobile with a full-width control', () => {
    renderSettings();

    const signOut = screen.getByRole('button', { name: 'Sign out' });
    const accountSection = signOut.closest('section') as HTMLElement;
    expect(accountSection.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(signOut.className).toContain('w-full');
    expect(signOut.className).toContain('sm:w-auto');

    const themeBtn = screen.getByRole('button', { name: /dark mode|light mode/i });
    const appearanceSection = themeBtn.closest('section') as HTMLElement;
    expect(appearanceSection.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(themeBtn.className).toContain('w-full');
  });

  it('renders each section as a settings row that becomes a 3-column grid on desktop', () => {
    renderSettings();
    for (const title of ['Appearance', 'AI provider', 'Account']) {
      const section = screen.getByRole('heading', { name: title }).closest('section') as HTMLElement;
      expect(section.className).toContain('lg:grid-cols-3');
    }
  });

  it('links to the privacy policy', () => {
    renderSettings();
    const link = screen.getByText('Privacy policy');
    expect(link).toHaveAttribute('href', '/privacy');
    expect(link.closest('section')).toContainElement(screen.getByRole('button', { name: 'Sign out' }));
  });
});
