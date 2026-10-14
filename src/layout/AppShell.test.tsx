import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppShell } from './AppShell';
import { useAuth } from '../auth/AuthContext';
import { authValue, superAdminAccess } from '../test/authValue';

const mockSignOut = vi.fn();
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: (...args: unknown[]) => mockSignOut(...args) }));
vi.mock('../auth/AuthContext');
vi.mock('../interest/interestApi', () => ({ countUnreviewedInterestSignups: vi.fn().mockResolvedValue(0) }));

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/teams']}>
      <AppShell><p>Page content</p></AppShell>
    </MemoryRouter>
  );
}

const openAccountMenu = () => fireEvent.click(screen.getByRole('button', { name: /^Account/ }));

describe('AppShell', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: superAdminAccess, firebaseUser: { uid: 'u1', email: 'coach@example.com' } as never })
    );
  });

  it('shows every nav destination in both shells for a super-admin', () => {
    renderShell();
    for (const label of ['Teams', 'Exercises', 'Trainings', 'Guides', 'Access']) {
      expect(screen.getAllByText(label)).toHaveLength(2);
    }
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('keeps account actions in one account menu in the sidebar, showing who is signed in', () => {
    const { container } = renderShell();
    const aside = container.querySelector('aside') as HTMLElement;
    // No loose Settings / theme / sign-out rows in the sidebar any more.
    expect(within(aside).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(within(aside).queryByRole('button', { name: /mode$/ })).not.toBeInTheDocument();
    const account = within(aside).getByRole('button', { name: 'Account: coach@example.com' });
    expect(account).toHaveTextContent('coach@example.com');
    fireEvent.click(account);
    const menu = screen.getByRole('menu', { name: 'Account: coach@example.com' });
    for (const item of ['Settings', 'Privacy policy', 'Sign out']) {
      expect(within(menu).getByRole('menuitem', { name: item })).toBeInTheDocument();
    }
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Dark mode' })).toBeInTheDocument();
    // Phones keep Settings in the bottom bar.
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('groups the admin-only destinations under an Admin label for a super-admin', () => {
    const { container } = renderShell();
    const aside = container.querySelector('aside') as HTMLElement;
    const admin = within(aside).getByRole('group', { name: 'Admin' });
    expect(within(admin).getByRole('link', { name: 'Guides' })).toBeInTheDocument();
    expect(within(admin).getByRole('link', { name: /Access/ })).toBeInTheDocument();
    expect(within(admin).queryByRole('link', { name: 'Teams' })).not.toBeInTheDocument();
  });

  it('shows only granted sections for a member', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: { isSuperAdmin: false, sections: { exercises: true, trainings: false, guides: false } } })
    );
    renderShell();
    expect(screen.getAllByText('Teams')).toHaveLength(2);
    expect(screen.getAllByText('Exercises')).toHaveLength(2);
    expect(screen.queryByText('Trainings')).not.toBeInTheDocument();
    expect(screen.queryByText('Guides')).not.toBeInTheDocument();
    expect(screen.queryByText('Access')).not.toBeInTheDocument();
  });

  it('signs out and clears local data when a sign-out button is clicked', async () => {
    mockSignOut.mockResolvedValue('signedOut');
    renderShell();
    openAccountMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ force: false, beforeSignOut: expect.any(Function) }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks before signing out when scouting actions have not synced', async () => {
    mockSignOut.mockResolvedValueOnce('unsynced').mockResolvedValueOnce('signedOut');
    renderShell();
    openAccountMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent("Some scouting actions haven't synced yet. Sign out anyway? They will be lost.");
    fireEvent.click(screen.getByRole('button', { name: 'Sign out anyway' }));
    await waitFor(() => expect(mockSignOut).toHaveBeenLastCalledWith({ force: true, beforeSignOut: expect.any(Function) }));
  });

  it('shows text labels in the phone bottom bar, not icons alone', () => {
    const { container } = renderShell();
    const bottomBar = container.querySelector('nav.fixed') as HTMLElement;
    for (const label of ['Teams', 'Exercises', 'Trainings', 'Guides', 'Access', 'Settings']) {
      expect(within(bottomBar).getByText(label)).not.toHaveClass('sr-only');
    }
  });
});
