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

describe('AppShell', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(authValue({ access: superAdminAccess }));
  });

  it('shows every nav destination in both shells for a super-admin', () => {
    renderShell();
    for (const label of ['Teams', 'Exercises', 'Trainings', 'Guides', 'Access']) {
      expect(screen.getAllByText(label)).toHaveLength(2);
    }
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('has a Settings link in the desktop sidebar as well as the bottom bar', () => {
    const { container } = renderShell();
    expect(screen.getAllByRole('link', { name: 'Settings' })).toHaveLength(2);
    const aside = container.querySelector('aside') as HTMLElement;
    expect(within(aside).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
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
    fireEvent.click(screen.getAllByText('Sign out')[0]);
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ force: false, beforeSignOut: expect.any(Function) }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks before signing out when scouting actions have not synced', async () => {
    mockSignOut.mockResolvedValueOnce('unsynced').mockResolvedValueOnce('signedOut');
    renderShell();
    fireEvent.click(screen.getAllByText('Sign out')[0]);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent("Some scouting actions haven't synced yet. Sign out anyway? They will be lost.");
    fireEvent.click(screen.getByRole('button', { name: 'Sign out anyway' }));
    await waitFor(() => expect(mockSignOut).toHaveBeenLastCalledWith({ force: true, beforeSignOut: expect.any(Function) }));
  });
});
