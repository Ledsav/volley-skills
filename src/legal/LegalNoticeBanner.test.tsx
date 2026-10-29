import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalNoticeBanner } from './LegalNoticeBanner';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';
import { formatDate } from '../i18n/format';

const upcomingMock = vi.hoisted(() => vi.fn());
vi.mock('../auth/AuthContext');
vi.mock('./versions', async (orig) => ({ ...(await orig<typeof import('./versions')>()), upcoming: upcomingMock }));

const next = { version: '2026-12-01', announcedAt: '2026-10-23', effectiveFrom: '2026-12-01', material: true, summary: 's' };
const renderBanner = () => render(<MemoryRouter><LegalNoticeBanner /></MemoryRouter>);

describe('LegalNoticeBanner', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    upcomingMock.mockReset();
    upcomingMock.mockImplementation((doc: string) => (doc === 'terms' ? next : null));
    vi.mocked(useAuth).mockReturnValue(authValue({ role: 'admin' }));
  });

  it('shows the effective date and a link to the new version', () => {
    renderBanner();
    const date = formatDate('2026-12-01', 'long', 'en');
    expect(screen.getByRole('status')).toHaveTextContent(`Updated Terms of Service take effect on ${date} — review`);
    expect(screen.getByRole('link', { name: 'review the Terms of Service' })).toHaveAttribute('href', '/legal/terms?v=2026-12-01');
  });

  it('names the DPA separately', () => {
    upcomingMock.mockImplementation((doc: string) => (doc === 'dpa' ? next : null));
    renderBanner();
    expect(screen.getByRole('status')).toHaveTextContent(/Updated Data Processing Agreement takes effect on .* — review/);
    expect(screen.getByRole('link', { name: 'review the Data Processing Agreement' })).toHaveAttribute('href', '/legal/dpa?v=2026-12-01');
  });

  it('announces a sub-processor change with the objection window and the operator contact', () => {
    upcomingMock.mockImplementation((doc: string) => (doc === 'subprocessors' ? next : null));
    renderBanner();
    expect(screen.getByRole('status')).toHaveTextContent(/sub-processor list changes on .*You can object within 15 days of this notice/);
    expect(screen.getByRole('link', { name: 'See the list' })).toHaveAttribute('href', '/legal/subprocessors?v=2026-12-01');
    expect(screen.getByRole('link', { name: 'Contact the operator' }).getAttribute('href')).toMatch(/^mailto:/);
  });

  it('is hidden for members', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ role: 'member' }));
    renderBanner();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('is hidden after dismiss and remembers it for the session', () => {
    const first = renderBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('vcb.legalNoticeDismissed.terms.2026-12-01')).toBe('1');
    first.unmount();
    renderBanner();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('still renders and dismisses when sessionStorage throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    renderBanner();
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    get.mockRestore();
    set.mockRestore();
  });
});

describe('LegalNoticeBanner look', () => {
  it('is a neutral strip with ink links, never blue', () => {
    window.sessionStorage.clear();
    upcomingMock.mockReset();
    upcomingMock.mockImplementation((doc: string) => (doc === 'terms' ? next : null));
    vi.mocked(useAuth).mockReturnValue(authValue({ role: 'admin' }));
    renderBanner();
    expect(screen.getByRole('status').className).not.toMatch(/blue/);
    expect(screen.getByRole('link', { name: 'review the Terms of Service' })).toHaveClass('text-ink');
  });
});
