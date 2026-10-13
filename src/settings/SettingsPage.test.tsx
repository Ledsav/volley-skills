import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

const mockSignOut = vi.fn();

vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: (...args: unknown[]) => mockSignOut(...args) }));

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => mockSignOut.mockReset());

  it('shows the theme toggle', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /dark mode|light mode/i })).toBeInTheDocument();
  });

  it('signs out and clears local data when Sign out is clicked', async () => {
    mockSignOut.mockResolvedValue('signedOut');
    renderSettings();

    fireEvent.click(screen.getByText('Sign out'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ force: false }));
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
    expect(accountSection.className).toContain('sm:flex-row');
    expect(signOut.className).toContain('w-full');
    expect(signOut.className).toContain('sm:w-auto');

    const themeBtn = screen.getByRole('button', { name: /dark mode|light mode/i });
    const appearanceSection = themeBtn.closest('section') as HTMLElement;
    expect(appearanceSection.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(themeBtn.className).toContain('w-full');
  });

  it('links to the privacy policy', () => {
    renderSettings();
    expect(screen.getByText('Privacy policy')).toHaveAttribute('href', '/privacy');
  });
});
