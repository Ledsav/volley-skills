import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AccessRequestsPanel } from './AccessRequestsPanel';
import * as interestApi from './interestApi';
import { SIGNUPS_CHANGED_EVENT } from './signupEvents';
import type { InterestSignup } from '../types/interestSignup';

vi.mock('./interestApi');
vi.mock('../firebase/config', () => ({ db: {} }));

const signups: InterestSignup[] = [
  { id: 'a', name: 'Ana', email: 'ana@example.com', role: 'coach', reviewed: false, createdAt: null },
  { id: 'b', name: 'Ben', email: 'ben@example.com', role: 'guardian', reviewed: true, createdAt: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(interestApi.listInterestSignups).mockResolvedValue({ signups, lastDoc: null, hasMore: false });
  vi.mocked(interestApi.countUnreviewedInterestSignups).mockResolvedValue(1);
  vi.mocked(interestApi.markInterestSignupReviewed).mockResolvedValue(undefined);
});

describe('AccessRequestsPanel', () => {
  it('renders no Grant access action without onGrant, and one per request with it', async () => {
    const { unmount } = render(<AccessRequestsPanel />);
    await screen.findByText('ana@example.com');
    expect(screen.queryByRole('button', { name: 'Grant access' })).not.toBeInTheDocument();
    unmount();
    render(<AccessRequestsPanel onGrant={vi.fn()} />);
    expect(await screen.findAllByRole('button', { name: 'Grant access' })).toHaveLength(2);
  });

  it('lists reviewed and new requests, flagging only the new ones', async () => {
    render(<AccessRequestsPanel onGrant={vi.fn()} />);
    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText('ben@example.com')).toBeInTheDocument();
    expect(screen.getByText('1 new')).toBeInTheDocument();
    expect(screen.getAllByText('New')).toHaveLength(1);
  });

  it('clears the notification when a request is marked reviewed but keeps it listed', async () => {
    const listener = vi.fn();
    window.addEventListener(SIGNUPS_CHANGED_EVENT, listener);
    render(<AccessRequestsPanel onGrant={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark reviewed' }));

    await waitFor(() => expect(screen.queryByText('1 new')).not.toBeInTheDocument());
    expect(interestApi.markInterestSignupReviewed).toHaveBeenCalledWith('a');
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(SIGNUPS_CHANGED_EVENT, listener);
  });

  it('shows an empty state when nobody has requested access', async () => {
    vi.mocked(interestApi.listInterestSignups).mockResolvedValue({ signups: [], lastDoc: null, hasMore: false });
    vi.mocked(interestApi.countUnreviewedInterestSignups).mockResolvedValue(0);
    render(<AccessRequestsPanel onGrant={vi.fn()} />);
    expect(await screen.findByText(/no one has requested access yet/i)).toBeInTheDocument();
  });

  it('deletes a request only after confirmation and drops it from the list', async () => {
    vi.mocked(interestApi.deleteInterestSignup).mockResolvedValue(undefined);
    render(<AccessRequestsPanel onGrant={vi.fn()} />);
    const ana = await screen.findByText('ana@example.com');
    const row = ana.closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(interestApi.deleteInterestSignup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete request' }));

    await waitFor(() => expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument());
    expect(interestApi.deleteInterestSignup).toHaveBeenCalledWith('a');
  });
});
