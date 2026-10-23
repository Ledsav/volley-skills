import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalReviewScreen } from './LegalReviewScreen';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess, testClub } from '../test/authValue';
import * as clubAdminApi from '../clubs/clubAdminApi';

const notify = vi.hoisted(() => vi.fn());
vi.mock('../auth/AuthContext');
vi.mock('../clubs/clubAdminApi');
vi.mock('../auth/reauth', () => ({ sendSigningLink: vi.fn() }));
vi.mock('../components/Notice', () => ({ useNotify: () => notify }));
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn() }));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const renderScreen = () => render(<MemoryRouter><LegalReviewScreen /></MemoryRouter>);

describe('LegalReviewScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clubAdminApi.requestTermination).mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue(authValue({
      role: 'admin', access: clubAdminAccess, club: testClub({ legal: null }),
      appUser: { uid: 'u-1', email: 'Admin@Example.com' },
    }));
  });

  it('shows the title and the summary of the versions in force', () => {
    renderScreen();
    expect(screen.getByRole('heading', { name: 'Accept the Terms and DPA' })).toBeInTheDocument();
    expect(screen.getByText('First version of the Terms of Service.')).toBeInTheDocument();
    expect(screen.getByText('First version of the Data Processing Agreement.')).toBeInTheDocument();
  });

  it('validates the person name and the authority checkbox', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/name \(1 to 100 characters\)/i)).toBeInTheDocument();
    expect(screen.getByText(/authorised to act for this club/i, { selector: 'p' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'x'.repeat(101) } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/name \(1 to 100 characters\)/i)).toBeInTheDocument();
  });

  it('moves on to the documents once the details are valid', () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ann Coach' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByRole('link', { name: /Open in a new tab/ }).length).toBeGreaterThan(0);
  });

  it('End our contract opens the confirm dialog and requests termination', async () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'End our contract' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Request end of contract' }));
    await vi.waitFor(() => expect(clubAdminApi.requestTermination).toHaveBeenCalledWith('admin@example.com'));
  });
});
