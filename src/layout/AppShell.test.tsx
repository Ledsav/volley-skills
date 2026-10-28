import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppShell } from './AppShell';
import { useAuth } from '../auth/AuthContext';
import { Timestamp } from 'firebase/firestore';
import { authValue, clubAdminAccess, testClub } from '../test/authValue';
import { useNotify } from '../components/Notice';
import { formatDateValue } from '../i18n/format';

const mockSignOut = vi.fn();
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: (...args: unknown[]) => mockSignOut(...args) }));
vi.mock('../auth/AuthContext');
vi.mock('../components/Notice');
const unreviewed = vi.hoisted(() => ({ count: 0 }));
vi.mock('../interest/interestApi', () => ({
  countUnreviewedInterestSignups: () => Promise.resolve(unreviewed.count),
}));

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

  const aside = (c: HTMLElement) => c.querySelector('aside') as HTMLElement;
  const group = (c: HTMLElement, name: string) => within(aside(c)).getByRole('group', { name });

  it('lists every destination once in the sidebar, grouped by who it is for', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ access: clubAdminAccess, isPlatformAdmin: true }));
    const { container } = renderShell();
    const nav = within(aside(container)).getByRole('navigation', { name: 'Main' });
    const labels = within(nav).getAllByRole('link').map((l) => l.textContent?.replace(/\d+$/, '').trim());
    expect(labels).toEqual(['Today', 'Teams', 'Trainings', 'Exercises', 'Guides', 'Members & settings', 'Clubs & sign-ups']);
    expect(within(group(container, 'Coaching')).getAllByRole('link').map((l) => l.textContent)).toEqual(['Teams', 'Trainings', 'Exercises']);
    expect(within(group(container, 'Club')).getByRole('link', { name: 'Members & settings' })).toHaveAttribute('href', '/club');
    expect(within(group(container, 'Platform')).getByRole('link', { name: /Clubs & sign-ups/ })).toHaveAttribute('href', '/platform');
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('shows the platform group only to platform admins, carrying the pending sign-ups count', async () => {
    const first = renderShell();
    expect(within(aside(first.container)).queryByRole('group', { name: 'Platform' })).not.toBeInTheDocument();
    cleanup();
    unreviewed.count = 4;
    vi.mocked(useAuth).mockReturnValue(authValue({ access: clubAdminAccess, isPlatformAdmin: true }));
    const { container } = renderShell();
    const link = within(group(container, 'Platform')).getByRole('link', { name: /Clubs & sign-ups/ });
    await waitFor(() => expect(link).toHaveTextContent('4'));
    unreviewed.count = 0;
  });

  it('keeps only personal things in the account menu, never a page that is in the sidebar', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: clubAdminAccess, isPlatformAdmin: true, firebaseUser: { uid: 'u1', email: 'coach@example.com' } as never })
    );
    const { container } = renderShell();
    const account = within(aside(container)).getByRole('button', { name: 'Account: coach@example.com' });
    expect(account).toHaveTextContent('coach@example.com');
    fireEvent.click(account);
    const menu = screen.getByRole('menu', { name: 'Account: coach@example.com' });
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent?.trim())).toEqual(['Settings', 'Terms & privacy', 'Sign out']);
  });

  it('shows only granted sections for a member, and no club or platform group', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: { isClubAdmin: false, sections: { exercises: true, trainings: false, guides: false } } })
    );
    const { container } = renderShell();
    expect(screen.getAllByText('Teams')).toHaveLength(2);
    expect(screen.getAllByText('Exercises')).toHaveLength(2);
    expect(screen.queryByText('Trainings')).not.toBeInTheDocument();
    expect(within(aside(container)).queryByRole('group', { name: 'Club' })).not.toBeInTheDocument();
    expect(screen.queryByText('Guides')).not.toBeInTheDocument();
  });

  it('shows the active club under the logo', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ name: 'Volley Club Belair' }) }));
    const { container } = renderShell();
    expect(within(aside(container)).getByText('Volley Club Belair')).toBeInTheDocument();
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

  it('shows text labels in the phone bottom bar, with More for everything else', () => {
    const { container } = renderShell();
    const bottomBar = container.querySelector('nav.fixed') as HTMLElement;
    for (const label of ['Today', 'Teams', 'Trainings', 'Exercises', 'More']) {
      expect(within(bottomBar).getByText(label)).not.toHaveClass('sr-only');
    }
    expect(within(bottomBar).getByRole('link', { name: 'More' })).toHaveAttribute('href', '/more');
  });

  it('caps page content at one shared width so wide screens keep readable lines', () => {
    renderShell();
    expect(screen.getByText('Page content').parentElement).toHaveClass('mx-auto', 'max-w-screen-xl');
  });

  it('has a skip link to main and Today first in the sidebar', () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    renderShell();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(document.getElementById('main')?.tagName).toBe('MAIN');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const labels = within(nav).getAllByRole('link').map((l) => l.textContent?.trim());
    expect(labels.indexOf('Today')).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf('Today')).toBeLessThan(labels.indexOf('Teams'));
  });

  it('caps the phone bottom bar at 5 items for a club admin, with no club pages on it', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: clubAdminAccess, isPlatformAdmin: true, appUser: { uid: 'u-1', email: 'user@example.com' } })
    );
    renderShell();
    const bottom = screen.getByRole('navigation', { name: 'Main (phone)' });
    expect(within(bottom).getAllByRole('link')).toHaveLength(5);
    expect(within(bottom).queryByText('Guides')).toBeNull();
    expect(within(bottom).queryByText('Members & settings')).toBeNull();
  });

  it('tab bar has at most 5 tabs with visible labels', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ access: clubAdminAccess, isPlatformAdmin: true }));
    renderShell();
    const bottom = screen.getByRole('navigation', { name: 'Main (phone)' });
    const tabs = within(bottom).getAllByRole('link');
    expect(tabs.length).toBeLessThanOrEqual(5);
    for (const tab of tabs) {
      expect(tab.querySelector('svg')).not.toBeNull();
      expect(tab.textContent?.trim()).not.toBe('');
      expect(tab.querySelector('.sr-only')).toBeNull();
    }
  });

  it('shows the unsynced sign-out dialog outside the tablet overlay panel', async () => {
    mockSignOut.mockResolvedValueOnce('unsynced');
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const overlay = screen.getByRole('dialog', { name: 'Main' });
    fireEvent.click(within(overlay).getByRole('button', { name: /^Account/ }));
    fireEvent.click(within(overlay).getByRole('menuitem', { name: 'Sign out' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(overlay.contains(confirm)).toBe(false);
  });

  describe('club state', () => {
    const DAY = 86_400_000;
    const fmt = (d: Date) => formatDateValue(d, 'long', 'en');
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

    const openClubMenu = () => fireEvent.click(screen.getByRole('button', { name: /^Club:/ }));

    it('switches club from the club name under the logo, only when there is more than one', () => {
      const switchClub = vi.fn();
      vi.mocked(useAuth).mockReturnValue(authValue({ memberships: two, switchClub, club: testClub({ name: 'Test Club' }) }));
      const { unmount } = renderShell();
      openClubMenu();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Switch to Other Club' }));
      expect(switchClub).toHaveBeenCalledWith('club-2');
      unmount();
      vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ name: 'Test Club' }) }));
      renderShell();
      expect(screen.queryByRole('button', { name: /^Club:/ })).not.toBeInTheDocument();
    });

    it('does not offer a switch to a deleted club', () => {
      const memberships = [...two, { clubId: 'club-3', role: 'member' as const, clubName: 'Gone Club', status: 'deleted' as const }];
      vi.mocked(useAuth).mockReturnValue(authValue({ memberships: [memberships[0], memberships[2]], club: testClub({ name: 'Test Club' }) }));
      renderShell();
      expect(screen.queryByRole('button', { name: /^Club:/ })).not.toBeInTheDocument();
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
