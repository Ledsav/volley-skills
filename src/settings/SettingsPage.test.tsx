import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

const mockSignOut = vi.fn();
const mockNavigate = vi.fn();

vi.mock('firebase/auth', () => ({ signOut: (...args: unknown[]) => mockSignOut(...args) }));
vi.mock('../firebase/config', () => ({ auth: {} }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  );
}

describe('SettingsPage', () => {
  it('shows the theme toggle', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /dark mode|light mode/i })).toBeInTheDocument();
  });

  it('signs out and redirects to /login when Sign out is clicked', async () => {
    mockSignOut.mockResolvedValue(undefined);
    renderSettings();

    fireEvent.click(screen.getByText('Sign out'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('links to the privacy policy', () => {
    renderSettings();
    expect(screen.getByText('Privacy policy')).toHaveAttribute('href', '/privacy');
  });
});
