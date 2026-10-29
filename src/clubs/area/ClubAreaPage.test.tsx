import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubAreaPage } from './ClubAreaPage';
import { useAuth } from '../../auth/AuthContext';
import { authValue, clubAdminAccess } from '../../test/authValue';
import { WithChrome } from '../../test/chromeProbe';
import { loadClubExportData } from '../export/clubExportApi';

vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('./ProfileTab', () => ({ ProfileTab: () => <div>profile-body</div> }));
vi.mock('./PeopleTab', () => ({ PeopleTab: () => <div>people-body</div> }));
vi.mock('./ContractTab', () => ({ ContractTab: () => <div>contract-body</div> }));
vi.mock('./ExportTab', async (orig) => {
  const actual = await orig<typeof import('./ExportTab')>();
  return { ExportTab: () => <><div>export-body</div><actual.ExportTab /></> };
});
vi.mock('../export/clubExportApi', () => ({ loadClubExportData: vi.fn() }));
vi.mock('../../components/Notice', () => ({ useNotify: () => vi.fn() }));

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(authValue({ access: clubAdminAccess, role: 'admin' }));
});

function renderAt(url: string, restricted = false) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <WithChrome><ClubAreaPage restricted={restricted} /><Where /></WithChrome>
    </MemoryRouter>,
  );
}

function Where() {
  const l = useLocation();
  const nav = useNavigationType();
  return <output data-testid="where" data-nav={nav}>{l.pathname + l.search}</output>;
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

  it('the Export tab publishes Download export, disabled while running', async () => {
    let finish: (v: never) => void = () => {};
    vi.mocked(loadClubExportData).mockReturnValue(new Promise<never>((res) => { finish = res; }));
    renderAt('/club?tab=export');
    const probe = screen.getByTestId('chrome-probe');
    const action = () => probe.querySelector('button') as HTMLButtonElement;
    expect(action()).toHaveTextContent('Download export');
    expect(action()).toBeEnabled();
    fireEvent.click(action());
    expect(action()).toBeDisabled();
    await act(async () => { finish(Promise.reject(new Error('stop')) as never); await Promise.resolve(); });
  });

  it('Profile and Contract publish the title and no main action', () => {
    renderAt('/club?tab=profile');
    expect(screen.getByTestId('chrome-probe').querySelector('button')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Contract' }));
    expect(screen.getByTestId('chrome-probe').querySelector('button')).toBeNull();
  });

  it('choosing a tab replaces ?tab= without a new history entry', () => {
    renderAt('/club');
    fireEvent.click(screen.getByRole('tab', { name: 'Contract' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/club?tab=contract');
    expect(screen.getByTestId('where')).toHaveAttribute('data-nav', 'REPLACE');
  });
});
