import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PlatformPage } from './PlatformPage';
import * as platformApi from './platformApi';
import * as interestApi from '../interest/interestApi';

vi.mock('./platformApi');
vi.mock('../interest/interestApi');
vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ appUser: { email: 'op@example.com' } }) }));
vi.mock('../components/Notice', () => ({ useNotify: () => vi.fn(), useUndoable: () => vi.fn() }));

function setup() {
  vi.mocked(platformApi.listClubs).mockResolvedValue({ clubs: [], lastDoc: null, hasMore: false });
  vi.mocked(interestApi.listInterestSignups).mockResolvedValue({
    signups: [{ id: 'a', name: 'Ana', email: 'ana@example.com', role: 'coach', reviewed: false, createdAt: null }],
    lastDoc: null, hasMore: false,
  });
  vi.mocked(interestApi.countUnreviewedInterestSignups).mockResolvedValue(1);
  render(<MemoryRouter><PlatformPage /></MemoryRouter>);
}

describe('PlatformPage', () => {
  it('has Clubs and Leads tabs', async () => {
    setup();
    expect(screen.getByRole('tab', { name: 'Clubs' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Leads' })).toBeInTheDocument();
    await waitFor(() => expect(platformApi.listClubs).toHaveBeenCalled());
  });

  it('the Leads tab shows the sign-ups panel without Grant access', async () => {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Leads' }));
    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grant access' })).not.toBeInTheDocument();
  });
});
