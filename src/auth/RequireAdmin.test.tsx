import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireAdmin } from './RequireAdmin';
import { useAuth } from './AuthContext';

vi.mock('./AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function renderGuard() {
  return render(
    <MemoryRouter>
      <RequireAdmin>
        <p>Admin content</p>
      </RequireAdmin>
    </MemoryRouter>
  );
}

describe('RequireAdmin', () => {
  it('renders the page for a global admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });

    renderGuard();

    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('denies an authenticated viewer', () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'parent-uid', email: 'parent@example.com' } as never,
      appUser: { uid: 'parent-uid', email: 'parent@example.com', role: 'viewer' },
      loading: false,
      authError: null,
    });

    renderGuard();

    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("You don't have access to this page.");
  });
});
