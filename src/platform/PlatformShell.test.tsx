import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformShell } from './PlatformShell';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../auth/useSignOut', () => ({ useSignOut: () => ({ signOut: vi.fn(), unsyncedDialog: null }) }));

const renderShell = () =>
  render(
    <MemoryRouter>
      <PlatformShell><p>body</p></PlatformShell>
    </MemoryRouter>
  );

describe('PlatformShell', () => {
  beforeEach(() => vi.mocked(useAuth).mockReset());

  it('offers Back to app to an operator who is also a club member', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ memberships: [{ clubId: 'club-1', email: 'user@example.com', role: 'admin' } as never] })
    );
    renderShell();
    expect(screen.getByRole('link', { name: 'Back to app' })).toHaveAttribute('href', '/');
  });

  it('offers no Back to app to an operator with no club', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ memberships: [] }));
    renderShell();
    expect(screen.queryByRole('link', { name: 'Back to app' })).not.toBeInTheDocument();
  });
});
