import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ClubStatusScreen } from './ClubStatusScreen';
import { useAuth } from '../auth/AuthContext';
import { authValue, testClub } from '../test/authValue';

vi.mock('../auth/AuthContext');
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn() }));

describe('ClubStatusScreen pending', () => {
  it('shows the accepted documents and the email promise', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({
      club: testClub({ status: 'pending', legal: { versionKey: 'terms-2026-10-22_dpa-2026-10-22', acceptedAt: null, acceptedBy: 'a@b.c' } }),
    }));
    render(<MemoryRouter><ClubStatusScreen kind="pending" /></MemoryRouter>);
    expect(screen.getByText(/We'll email you when it's active/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Terms of Service/ })).toHaveAttribute('href', '/legal/terms?v=2026-10-22');
    expect(screen.getByRole('link', { name: /Data Processing Agreement/ })).toHaveAttribute('href', '/legal/dpa?v=2026-10-22');
  });
});
