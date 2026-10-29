import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalReviewScreen } from './LegalReviewScreen';
import { useAuth } from '../auth/AuthContext';
import { readSignDraft } from './signDraft';
import { sendSigningLink } from '../auth/reauth';
import { Timestamp } from 'firebase/firestore';
import { authValue, clubAdminAccess, testClub } from '../test/authValue';
import * as clubAdminApi from '../clubs/clubAdminApi';

const notify = vi.hoisted(() => vi.fn());
vi.mock('../auth/AuthContext');
vi.mock('../clubs/clubAdminApi');
vi.mock('../auth/reauth', () => ({ sendSigningLink: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../components/Notice', () => ({ useNotify: () => notify }));
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn() }));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const renderScreen = () => render(<MemoryRouter><LegalReviewScreen /></MemoryRouter>);

describe('LegalReviewScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
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

  it('offers to switch to another club', () => {
    const switchClub = vi.fn();
    vi.mocked(useAuth).mockReturnValue(authValue({
      role: 'admin', access: clubAdminAccess, club: testClub({ legal: null }), switchClub,
      memberships: [
        { clubId: 'club-1', role: 'admin', clubName: 'Test Club', status: 'active' },
        { clubId: 'club-2', role: 'member', clubName: 'Other VC', status: 'active' },
      ],
    }));
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Other VC' }));
    expect(switchClub).toHaveBeenCalledWith('club-2');
  });

  it('saves a reaccept draft with the shown versions and sends the link', async () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: '  Ann Coach ' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    for (const link of screen.getAllByRole('link', { name: /Open in a new tab/ })) {
      link.addEventListener('click', (e) => e.preventDefault());
      fireEvent.click(link);
    }
    fireEvent.click(screen.getByRole('checkbox', { name: /Terms of Service/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Data Processing Agreement/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    for (const box of screen.getAllByRole('checkbox', { name: /specifically approve clause/ })) fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Approve these clauses specifically' }));
    await vi.waitFor(() => expect(sendSigningLink).toHaveBeenCalledWith('admin@example.com', expect.any(String)));
    expect(vi.mocked(sendSigningLink).mock.calls[0][1]).toBe(readSignDraft(Date.now())?.nonce);
    expect(readSignDraft(Date.now())).toMatchObject({
      kind: 'reaccept', clubId: 'club-1', email: 'admin@example.com', personName: 'Ann Coach',
      termsVersion: '2026-10-22', dpaVersion: '2026-10-22', subprocessorsVersion: '2026-10-22', language: 'en',
    });
  });

  it('hides End our contract once termination is requested', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({
      role: 'admin', access: clubAdminAccess,
      club: testClub({ legal: null, termination: { requestedAt: Timestamp.fromMillis(1000), requestedBy: 'a@example.com', effectiveAt: null, retrievalEndsAt: null } }),
    }));
    renderScreen();
    expect(screen.queryByRole('button', { name: 'End our contract' })).not.toBeInTheDocument();
  });
});
