import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireClubAdmin } from './RequireClubAdmin';
import { RequireSection } from './RequireSection';
import { useAuth } from './AuthContext';
import { authValue, clubAdminAccess } from '../test/authValue';

vi.mock('./AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function renderWith(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('RequireClubAdmin', () => {
  it('renders for a club admin', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ access: clubAdminAccess }));
    renderWith(<RequireClubAdmin><p>secret</p></RequireClubAdmin>);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
  it('blocks a member', () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    renderWith(<RequireClubAdmin><p>secret</p></RequireClubAdmin>);
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("You don't have access to this page.");
  });
});

describe('RequireSection', () => {
  it('renders when the section is granted', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: { isClubAdmin: false, sections: { exercises: true, trainings: false, guides: false } } })
    );
    renderWith(<RequireSection section="exercises"><p>lib</p></RequireSection>);
    expect(screen.getByText('lib')).toBeInTheDocument();
  });
  it('blocks when the section is not granted', () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    renderWith(<RequireSection section="trainings"><p>lib</p></RequireSection>);
    expect(screen.queryByText('lib')).not.toBeInTheDocument();
  });
});
