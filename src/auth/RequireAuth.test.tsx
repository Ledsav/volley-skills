import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireAuth } from './RequireAuth';
import { useAuth } from './AuthContext';

vi.mock('./AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function renderGuard() {
  return render(
    <MemoryRouter>
      <RequireAuth>
        <p>Protected content</p>
      </RequireAuth>
    </MemoryRouter>
  );
}

describe('RequireAuth', () => {
  it('shows a recoverable error instead of loading forever when auth resolution failed', () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: null,
      appUser: null,
      loading: false,
      authError: 'Could not finish signing you in.',
    });

    renderGuard();

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong signing you in.');
    expect(screen.getByText('Try again')).toHaveAttribute('href', '/login');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders the protected content for a signed-in user', () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });

    renderGuard();

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
