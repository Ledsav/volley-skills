import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireSuperAdmin } from './RequireSuperAdmin';
import { RequireSection } from './RequireSection';
import { useAuth } from './AuthContext';
import { authValue, superAdminAccess } from '../test/authValue';

vi.mock('./AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

function renderWith(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('RequireSuperAdmin', () => {
  it('renders for a super-admin', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ access: superAdminAccess }));
    renderWith(<RequireSuperAdmin><p>secret</p></RequireSuperAdmin>);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
  it('blocks a member', () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    renderWith(<RequireSuperAdmin><p>secret</p></RequireSuperAdmin>);
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("You don't have access to this page.");
  });
});

describe('RequireSection', () => {
  it('renders when the section is granted', () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: { isSuperAdmin: false, sections: { exercises: true, trainings: false, guides: false } } })
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
