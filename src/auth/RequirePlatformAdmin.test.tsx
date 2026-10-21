import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequirePlatformAdmin } from './RequirePlatformAdmin';
import { useAuth } from './AuthContext';
import { authValue, clubAdminAccess } from '../test/authValue';

vi.mock('./AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const renderGate = () =>
  render(<MemoryRouter><RequirePlatformAdmin><p>secret</p></RequirePlatformAdmin></MemoryRouter>);

describe('RequirePlatformAdmin', () => {
  it('renders for a platform admin with no club membership', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ isPlatformAdmin: true, memberships: [], activeClubId: null, club: null, access: null, role: null }));
    renderGate();
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('denies a club admin who is not a platform admin', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ access: clubAdminAccess }));
    renderGate();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("You don't have access to this page.");
  });
});
