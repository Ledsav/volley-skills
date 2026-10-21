import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubAreaPage } from './ClubAreaPage';
import { useAuth } from '../../auth/AuthContext';
import { authValue, clubAdminAccess } from '../../test/authValue';

vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('./ProfileTab', () => ({ ProfileTab: () => <div>profile-body</div> }));
vi.mock('./PeopleTab', () => ({ PeopleTab: () => <div>people-body</div> }));

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(authValue({ access: clubAdminAccess, role: 'admin' }));
});

function renderAt(url: string, restricted = false) {
  return render(<MemoryRouter initialEntries={[url]}><ClubAreaPage restricted={restricted} /></MemoryRouter>);
}

describe('ClubAreaPage', () => {
  it('renders Profile, People & access and Contract tabs', () => {
    renderAt('/club');
    const list = screen.getByRole('tablist', { name: 'Club sections' });
    for (const n of ['Profile', 'People & access', 'Contract']) {
      expect(list).toHaveTextContent(n);
    }
    expect(screen.getByRole('heading', { name: 'Club' })).toBeInTheDocument();
    expect(screen.getByText('profile-body')).toBeInTheDocument();
  });

  it('opens the tab named in ?tab=', () => {
    renderAt('/club?tab=people');
    expect(screen.getByText('people-body')).toBeInTheDocument();
    expect(screen.queryByText('profile-body')).not.toBeInTheDocument();
  });

  it('offers only Profile and Contract when restricted', () => {
    renderAt('/club?tab=people', true);
    expect(screen.queryByText('people-body')).not.toBeInTheDocument();
    expect(screen.getByRole('tablist')).not.toHaveTextContent('People & access');
  });
});
