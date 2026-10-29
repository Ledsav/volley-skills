import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { AccessRequestsPanel } from './AccessRequestsPanel';
import * as interestApi from './interestApi';
import { SIGNUPS_CHANGED_EVENT } from './signupEvents';
import { NoticeProvider, UNDO_MS } from '../components/Notice';
import type { InterestSignup } from '../types/interestSignup';

vi.mock('./interestApi');
vi.mock('../firebase/config', () => ({ db: {} }));

const signups: InterestSignup[] = [
  { id: 'a', name: 'Ana', email: 'ana@example.com', role: 'coach', reviewed: false, createdAt: null },
  { id: 'b', name: 'Ben', email: 'ben@example.com', role: 'guardian', reviewed: true, createdAt: null },
];

function renderPanel() {
  return render(
    <NoticeProvider>
      <AccessRequestsPanel />
    </NoticeProvider>
  );
}

async function deleteFromMenu(name: string) {
  fireEvent.click(screen.getByRole('button', { name: `Actions for ${name}` }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(interestApi.listInterestSignups).mockResolvedValue({ signups, lastDoc: null, hasMore: false });
  vi.mocked(interestApi.countUnreviewedInterestSignups).mockResolvedValue(1);
  vi.mocked(interestApi.markInterestSignupReviewed).mockResolvedValue(undefined);
  vi.mocked(interestApi.deleteInterestSignup).mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

describe('AccessRequestsPanel', () => {
  it('offers no Grant access (B10)', async () => {
    renderPanel();
    await screen.findByText('ana@example.com');
    expect(screen.queryByRole('button', { name: 'Grant access' })).not.toBeInTheDocument();
    expect(screen.queryByText('Grant access')).not.toBeInTheDocument();
  });

  it('lists reviewed and new requests, flagging only the new ones', async () => {
    renderPanel();
    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText('ben@example.com')).toBeInTheDocument();
    expect(screen.getByText('1 new')).toBeInTheDocument();
    expect(screen.getAllByText('New')).toHaveLength(1);
  });

  it('clears the notification when a request is marked reviewed but keeps it listed', async () => {
    const listener = vi.fn();
    window.addEventListener(SIGNUPS_CHANGED_EVENT, listener);
    renderPanel();
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
    renderPanel();
    expect(await screen.findByText(/no one has requested access yet/i)).toBeInTheDocument();
  });

  it('Delete is an undo: the row leaves at once and is deleted when the notice expires (B10)', async () => {
    renderPanel();
    await screen.findByText('ben@example.com');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await deleteFromMenu('Ben');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText('ben@example.com')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent("Ben's request deleted");
    expect(interestApi.deleteInterestSignup).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    expect(interestApi.deleteInterestSignup).toHaveBeenCalledTimes(1);
    expect(interestApi.deleteInterestSignup).toHaveBeenCalledWith('b');
    expect(screen.queryByText('ben@example.com')).not.toBeInTheDocument();
  });

  it('Undo brings the request back and never deletes', async () => {
    renderPanel();
    await screen.findByText('ben@example.com');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await deleteFromMenu('Ben');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('ben@example.com')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS * 2);
    });
    expect(interestApi.deleteInterestSignup).not.toHaveBeenCalled();
  });

  it('a failed delete brings the row back with the error', async () => {
    vi.mocked(interestApi.deleteInterestSignup).mockRejectedValue(new Error('denied'));
    renderPanel();
    await screen.findByText('ben@example.com');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await deleteFromMenu('Ben');
    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    expect(screen.getByText('ben@example.com')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not delete this request. Please try again.');
  });

  it('deleting a new request lowers the count at once and tells the nav badge only after the delete', async () => {
    const listener = vi.fn();
    window.addEventListener(SIGNUPS_CHANGED_EVENT, listener);
    renderPanel();
    await screen.findByText('1 new');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await deleteFromMenu('Ana');
    expect(screen.queryByText('1 new')).not.toBeInTheDocument();
    expect(listener).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(SIGNUPS_CHANGED_EVENT, listener);
  });

  it('right-click offers Mark reviewed and Delete', async () => {
    renderPanel();
    const row = (await screen.findByText('ana@example.com')).closest('li')!;
    fireEvent.contextMenu(row.querySelector('div[class*="min-h-"]')!);
    expect(await screen.findAllByRole('menuitem', { name: 'Mark reviewed' })).not.toHaveLength(0);
    expect(screen.getAllByRole('menuitem', { name: 'Delete' }).length).toBeGreaterThan(0);
  });
});
