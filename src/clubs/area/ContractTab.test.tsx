import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractTab } from './ContractTab';
import * as clubAdminApi from '../clubAdminApi';
import { useAuth } from '../../auth/AuthContext';
import { authValue, clubAdminAccess, testClub } from '../../test/authValue';
import type { Club } from '../../types/club';

const notify = vi.hoisted(() => vi.fn());
const operator = vi.hoisted(() => ({ OPERATOR_CONTACT_EMAIL: null as string | null }));

vi.mock('../clubAdminApi');
vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../components/Notice', () => ({ useNotify: () => notify }));
vi.mock('../../firebase/config', () => ({ db: {} }));
vi.mock('../../legal/operator', () => operator);

const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
const T1 = new Date('2026-11-01T10:00:00Z');
const T2 = new Date('2026-12-15T10:00:00Z');

function signIn(over: Partial<Club> = {}) {
  vi.mocked(useAuth).mockReturnValue(authValue({
    access: clubAdminAccess, role: 'admin',
    appUser: { uid: 'u-1', email: 'Admin@Example.com' },
    club: testClub(over),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  operator.OPERATOR_CONTACT_EMAIL = null;
  vi.mocked(clubAdminApi.requestTermination).mockResolvedValue(undefined);
});

describe('ContractTab', () => {
  it('shows the club status in words', () => {
    signIn();
    const { unmount } = render(<ContractTab />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    unmount();

    signIn({ status: 'suspended', statusReason: 'Invoice overdue' });
    const second = render(<ContractTab />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('Invoice overdue')).toBeInTheDocument();
    second.unmount();

    signIn({
      status: 'terminating',
      termination: { requestedAt: null, requestedBy: null, effectiveAt: Timestamp.fromDate(T1), retrievalEndsAt: Timestamp.fromDate(T2) },
    });
    render(<ContractTab />);
    expect(screen.getByText('Ending')).toBeInTheDocument();
    expect(screen.getByText(`Full use until ${fmt(T1)}`)).toBeInTheDocument();
    expect(screen.getByText(`Data export until ${fmt(T2)}`)).toBeInTheDocument();
  });

  it('shows the accepted legal version, or Not yet accepted', () => {
    signIn();
    const { unmount } = render(<ContractTab />);
    expect(screen.getByText('Not yet accepted')).toBeInTheDocument();
    unmount();

    signIn({ legal: { versionKey: '2026-09', acceptedAt: Timestamp.fromDate(T1), acceptedBy: 'owner@example.com' } });
    render(<ContractTab />);
    expect(screen.getByText(/2026-09/)).toBeInTheDocument();
    expect(screen.getByText(/owner@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(fmt(T1)))).toBeInTheDocument();
  });

  it('End our contract asks for confirmation then writes the request', async () => {
    signIn();
    render(<ContractTab />);
    fireEvent.click(screen.getByRole('button', { name: 'End our contract' }));
    expect(screen.getByRole('alertdialog', { name: "End your club's contract?" })).toBeInTheDocument();
    expect(clubAdminApi.requestTermination).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Request end of contract' }));
    await waitFor(() => expect(clubAdminApi.requestTermination).toHaveBeenCalledWith('admin@example.com'));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('End of contract requested'));
  });

  it('shows the request instead of the button once requested', () => {
    signIn({ termination: { requestedAt: Timestamp.fromDate(T1), requestedBy: 'owner@example.com', effectiveAt: null, retrievalEndsAt: null } });
    render(<ContractTab />);
    expect(screen.getByText(`End of contract requested on ${fmt(T1)} by owner@example.com`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End our contract' })).not.toBeInTheDocument();
  });

  it('offers End our contract while paused', () => {
    signIn({ status: 'suspended' });
    render(<ContractTab />);
    expect(screen.getByRole('button', { name: 'End our contract' })).toBeInTheDocument();
  });

  it('offers no End our contract while terminating or pending', () => {
    for (const status of ['terminating', 'pending'] as const) {
      signIn({ status });
      const { unmount } = render(<ContractTab />);
      expect(screen.queryByRole('button', { name: 'End our contract' })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('shows the operator contact only when OPERATOR_CONTACT_EMAIL is set', () => {
    signIn();
    const { unmount } = render(<ContractTab />);
    expect(screen.queryByText(/ops@example\.com/)).not.toBeInTheDocument();
    unmount();
    operator.OPERATOR_CONTACT_EMAIL = 'ops@example.com';
    render(<ContractTab />);
    expect(screen.getByText(/ops@example\.com/)).toBeInTheDocument();
  });
});
