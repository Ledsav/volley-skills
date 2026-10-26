import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { WelcomePage } from './WelcomePage';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';

vi.mock('../auth/AuthContext');
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn() }));

const renderPage = () => render(<MemoryRouter><WelcomePage /></MemoryRouter>);

describe('WelcomePage', () => {
  it('asks to be added when there is no other club', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ memberships: [], activeClubId: null, club: null }));
    renderPage();
    expect(screen.getByText(/Ask your club admin to add user@example.com/)).toBeInTheDocument();
  });

  it('offers to switch to another usable club when the active one is lost', () => {
    const switchClub = vi.fn();
    vi.mocked(useAuth).mockReturnValue(authValue({
      club: null,
      switchClub,
      memberships: [
        { clubId: 'club-1', role: 'member', clubName: 'Lost Club', status: 'active' },
        { clubId: 'club-2', role: 'member', clubName: 'Other Club', status: 'active' },
        { clubId: 'club-3', role: 'member', clubName: 'Gone Club', status: 'deleted' },
      ],
    }));
    renderPage();
    expect(screen.queryByText(/Ask your club admin/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Switch to Gone Club' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Other Club' }));
    expect(switchClub).toHaveBeenCalledWith('club-2');
  });
});

describe('WelcomePage for a platform admin', () => {
  it('offers the platform page to a platform admin with no club', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ memberships: [], activeClubId: null, club: null, role: null, isPlatformAdmin: true })
    );
    renderPage();
    expect(screen.getByRole('link', { name: 'Open the platform page' })).toHaveAttribute('href', '/platform');
  });

  it('does not offer the platform page to anyone else', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ memberships: [], activeClubId: null, club: null, role: null, isPlatformAdmin: false })
    );
    renderPage();
    expect(screen.queryByRole('link', { name: 'Open the platform page' })).not.toBeInTheDocument();
  });
});

describe('WelcomePage create a club', () => {
  it('offers to create a club', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ memberships: [], activeClubId: null, club: null }));
    renderPage();
    expect(screen.getByRole('link', { name: 'Create a club' })).toHaveAttribute('href', '/signup/club');
  });
});
