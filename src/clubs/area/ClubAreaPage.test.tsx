import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubAreaPage } from './ClubAreaPage';
import { useAuth } from '../../auth/AuthContext';
import { authValue, clubAdminAccess } from '../../test/authValue';

vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('./ProfileTab', () => ({ ProfileTab: () => <div>profile-body</div> }));
vi.mock('./PeopleTab', () => ({ PeopleTab: () => <div>people-body</div> }));
vi.mock('./ContractTab', () => ({ ContractTab: () => <div>contract-body</div> }));
vi.mock('./ExportTab', () => ({ ExportTab: () => <div>export-body</div> }));

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

  it('opens on Contract by default when restricted', () => {
    renderAt('/club', true);
    expect(screen.getByText('contract-body')).toBeInTheDocument();
    expect(screen.queryByText('profile-body')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Contract' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows Export in the full and restricted club area', () => {
    const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent);
    const { unmount } = renderAt('/club');
    expect(tabNames()).toEqual(['Profile', 'People & access', 'Export', 'Contract']);
    unmount();
    renderAt('/club', true);
    expect(tabNames()).toEqual(['Profile', 'Export', 'Contract']);
  });

  it('opens the Export tab', () => {
    renderAt('/club?tab=export', true);
    expect(screen.getByText('export-body')).toBeInTheDocument();
  });

  it('offers no People & access when restricted', () => {
    renderAt('/club?tab=people', true);
    expect(screen.queryByText('people-body')).not.toBeInTheDocument();
    expect(screen.getByRole('tablist')).not.toHaveTextContent('People & access');
  });
});
