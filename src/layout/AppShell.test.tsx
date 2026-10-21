import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppShell } from './AppShell';
import { useAuth } from '../auth/AuthContext';
import { Timestamp } from 'firebase/firestore';
import { authValue, clubAdminAccess, testClub } from '../test/authValue';
import { useNotify } from '../components/Notice';

const mockSignOut = vi.fn();
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: (...args: unknown[]) => mockSignOut(...args) }));
vi.mock('../auth/AuthContext');
vi.mock('../components/Notice');
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
      authValue({ access: clubAdminAccess, firebaseUser: { uid: 'u1', email: 'coach@example.com' } as never })
    );
  });

  it('shows every nav destination in both shells for a club admin', () => {
    renderShell();
    for (const label of ['Home', 'Teams', 'Exercises', 'Trainings']) {
      expect(screen.getAllByText(label)).toHaveLength(2);
    }
    // Admin destinations live in the sidebar only; phones reach them via the account menu.
    for (const label of ['Guides', 'Access']) {
      expect(screen.getAllByText(label)).toHaveLength(1);
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

  it('groups the admin-only destinations under an Admin label for a club admin', () => {
    const { container } = renderShell();
    const aside = container.querySelector('aside') as HTMLElement;
    const admin = within(aside).getByRole('group', { name: 'Admin' });
    expect(within(admin).getByRole('link', { name: 'Guides' })).toBeInTheDocument();
    expect(within(admin).getByRole('link', { name: /Access/ })).toBeInTheDocument();
    expect(within(admin).queryByRole('link', { name: 'Teams' })).not.toBeInTheDocument();
  });

  it('shows only granted sections for a member', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: { isClubAdmin: false, sections: { exercises: true, trainings: false, guides: false } } })
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
    for (const label of ['Home', 'Teams', 'Exercises', 'Trainings', 'Settings']) {
      expect(within(bottomBar).getByText(label)).not.toHaveClass('sr-only');
    }
  });

  it('caps page content at one shared width so wide screens keep readable lines', () => {
    renderShell();
    expect(screen.getByText('Page content').parentElement).toHaveClass('mx-auto', 'max-w-screen-xl');
  });

  it('has a skip link to main and Home first in the sidebar', () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    renderShell();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(document.getElementById('main')?.tagName).toBe('MAIN');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const labels = within(nav).getAllByRole('link').map((l) => l.textContent?.trim());
    expect(labels.indexOf('Home')).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf('Home')).toBeLessThan(labels.indexOf('Teams'));
  });

  it('caps the phone bottom bar at 5 items for a club admin', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: clubAdminAccess, appUser: { uid: 'u-1', email: 'user@example.com' } })
    );
    renderShell();
    const bottom = screen.getByRole('navigation', { name: 'Main (phone)' });
    expect(within(bottom).getAllByRole('link')).toHaveLength(5);
    expect(within(bottom).queryByText('Guides')).toBeNull();
    expect(within(bottom).queryByText('Access')).toBeNull();
  });

  it('offers Guides and Access in the account menu for a club admin', () => {
    renderShell();
    openAccountMenu();
    const menu = screen.getByRole('menu', { name: /^Account/ });
    expect(within(menu).getByRole('menuitem', { name: 'Guides' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Access' })).toBeInTheDocument();
  });

  describe('club state', () => {
    const DAY = 86_400_000;
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    const effective = new Date(Date.now() + 10 * DAY);
    const retrieval = new Date(Date.now() + 40 * DAY);
    const ending = () =>
      testClub({
        status: 'terminating',
        termination: {
          requestedAt: null,
          requestedBy: null,
          effectiveAt: Timestamp.fromDate(effective),
          retrievalEndsAt: Timestamp.fromDate(retrieval),
        },
      });
    const two = [
      { clubId: 'club-1', role: 'member' as const, clubName: 'Test Club', status: 'active' as const },
      { clubId: 'club-2', role: 'member' as const, clubName: 'Other Club', status: 'active' as const },
    ];

    it('shows the contract-ending banner while terminating', () => {
      vi.mocked(useAuth).mockReturnValue(authValue({ club: ending(), role: 'admin', access: clubAdminAccess }));
      const { unmount } = renderShell();
      expect(screen.getByRole('status')).toHaveTextContent(
        `Your contract ends on ${fmt(effective)}. Export your data before ${fmt(retrieval)}.`
      );
      unmount();
      vi.mocked(useAuth).mockReturnValue(authValue({ club: ending(), role: 'member' }));
      renderShell();
      expect(screen.getByRole('status')).toHaveTextContent(`Your club's contract ends on ${fmt(effective)}.`);
    });

    it('offers Switch to <club> for each other club only when there is more than one', () => {
      const switchClub = vi.fn();
      vi.mocked(useAuth).mockReturnValue(authValue({ memberships: two, switchClub }));
      const { unmount } = renderShell();
      openAccountMenu();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Switch to Other Club' }));
      expect(switchClub).toHaveBeenCalledWith('club-2');
      unmount();
      vi.mocked(useAuth).mockReturnValue(authValue());
      renderShell();
      openAccountMenu();
      expect(screen.queryByRole('menuitem', { name: /^Switch to/ })).not.toBeInTheDocument();
    });

    it('notifies once when the stored club was dropped', () => {
      const notify = vi.fn();
      vi.mocked(useNotify).mockReturnValue(notify);
      vi.mocked(useAuth).mockReturnValue(authValue({ droppedClub: true }));
      const { rerender } = renderShell();
      rerender(
        <MemoryRouter initialEntries={['/teams']}>
          <AppShell><p>Page content</p></AppShell>
        </MemoryRouter>
      );
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith('You no longer have access to your previous club.');
    });
  });
});
