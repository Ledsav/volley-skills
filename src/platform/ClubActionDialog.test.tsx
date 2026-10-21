import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubActionDialog } from './ClubActionDialog';
import { clubActions, defaultTerminationDates } from './clubActions';
import * as platformApi from './platformApi';
import { endOfLocalDay, startOfLocalDay } from './dates';
import { testClub } from '../test/authValue';

const notify = vi.hoisted(() => vi.fn());
vi.mock('./platformApi');
vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('../components/Notice', () => ({ useNotify: () => notify }));

const NOW = new Date(2026, 9, 21, 10, 0, 0);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Status = 'active' | 'suspended' | 'terminating' | 'pending';

function action(status: Status, kind: string) {
  const a = clubActions({ status }).find((x) => x.kind === kind);
  if (!a) throw new Error('no action');
  return a;
}

function open(kind: string, status: Status = 'active', over = {}) {
  const onClose = vi.fn();
  const onChanged = vi.fn();
  const club = testClub({ status, ...over });
  render(<ClubActionDialog club={club} action={action(status, kind)} operatorEmail="op@example.com"
    onClose={onClose} onChanged={onChanged} />);
  return { club, onClose, onChanged };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.mocked(platformApi.changeClubStatus).mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

const reasonBox = () => screen.getByLabelText(/Reason/);
const effective = () => screen.getByLabelText('End date') as HTMLInputElement;
const retrieval = () => screen.getByLabelText('Data export open until') as HTMLInputElement;

describe('ClubActionDialog', () => {
  it('Deactivate requires a reason', () => {
    open('deactivate');
    const confirm = screen.getByRole('button', { name: 'Deactivate' });
    expect(confirm).toBeDisabled();
    fireEvent.change(reasonBox(), { target: { value: '   ' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(reasonBox(), { target: { value: 'Unpaid' } });
    expect(confirm).toBeEnabled();
    expect(reasonBox()).toHaveAttribute('maxlength', '300');
  });

  it('End contract prefills now+30 and +30 days, and refuses a retrieval date under 30 days after effectiveAt inline', () => {
    open('endContract');
    const d = defaultTerminationDates(NOW);
    expect(effective().value).toBe(iso(d.effectiveAt));
    expect(retrieval().value).toBe(iso(d.retrievalEndsAt));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.change(retrieval(), { target: { value: iso(new Date(d.effectiveAt.getTime() + 10 * 86_400_000)) } });
    expect(screen.getByRole('alert')).toHaveTextContent('Data export must stay open at least 30 days after the end date.');
    expect(screen.getByRole('button', { name: 'End contract' })).toBeDisabled();
  });

  it('End contract on a paused club defaults the end date to today and says a later date restores full use', () => {
    open('endContract', 'suspended');
    expect(effective().value).toBe(iso(NOW));
    expect(retrieval().value).toBe(iso(new Date(NOW.getTime() + 30 * 86_400_000)));
    expect(screen.getByText('A later end date gives the club full use again until then.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End contract' })).toBeEnabled();
  });

  it('End contract on an active club has no paused-club line', () => {
    open('endContract');
    expect(screen.queryByText('A later end date gives the club full use again until then.')).not.toBeInTheDocument();
  });

  it('End contract and Change dates explain what the two dates mean', () => {
    const copy = 'The club keeps full use until the end date, then can only export its data until the export date.';
    open('endContract');
    expect(screen.getByText(copy)).toBeInTheDocument();
    cleanup();
    open('changeDates', 'terminating', {
      termination: { requestedAt: null, requestedBy: null, effectiveAt: Timestamp.fromDate(NOW), retrievalEndsAt: Timestamp.fromDate(new Date(NOW.getTime() + 40 * 86_400_000)) },
    });
    expect(screen.getByText(copy)).toBeInTheDocument();
  });

  it('Change dates keeps an end date that has passed and moves only the export date', async () => {
    const pastEnd = Timestamp.fromDate(new Date(NOW.getTime() - 10 * 86_400_000));
    open('changeDates', 'terminating', {
      termination: { requestedAt: null, requestedBy: null, effectiveAt: pastEnd, retrievalEndsAt: Timestamp.fromDate(new Date(NOW.getTime() + 20 * 86_400_000)) },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.change(retrieval(), { target: { value: iso(new Date(NOW.getTime() + 40 * 86_400_000)) } });
    const confirm = screen.getByRole('button', { name: 'Change dates' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(platformApi.changeClubStatus).toHaveBeenCalled());
    const [change] = vi.mocked(platformApi.changeClubStatus).mock.calls[0];
    expect(change.dates?.effectiveAt).toBe(pastEnd);
    expect(change.dates?.retrievalEndsAt).toEqual(endOfLocalDay(retrieval().value));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Dates updated'));
  });

  it('Change dates still refuses moving the end date to another past date', () => {
    open('changeDates', 'terminating', {
      termination: { requestedAt: null, requestedBy: null, effectiveAt: Timestamp.fromDate(new Date(NOW.getTime() - 10 * 86_400_000)), retrievalEndsAt: Timestamp.fromDate(new Date(NOW.getTime() + 40 * 86_400_000)) },
    });
    fireEvent.change(effective(), { target: { value: iso(new Date(NOW.getTime() - 12 * 86_400_000)) } });
    expect(screen.getByRole('alert')).toHaveTextContent("The end date can't be in the past.");
    expect(screen.getByRole('button', { name: 'Change dates' })).toBeDisabled();
  });

  it('End contract allows an effective date of today for a serious breach', () => {
    open('endContract');
    fireEvent.change(effective(), { target: { value: iso(NOW) } });
    fireEvent.change(retrieval(), { target: { value: iso(new Date(NOW.getTime() + 40 * 86_400_000)) } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End contract' })).toBeEnabled();
  });

  it('refuses an effective date before today', () => {
    open('endContract');
    fireEvent.change(effective(), { target: { value: iso(new Date(NOW.getTime() - 3 * 86_400_000)) } });
    expect(screen.getByRole('alert')).toHaveTextContent("The end date can't be in the past.");
    expect(screen.getByRole('button', { name: 'End contract' })).toBeDisabled();
  });

  it('converts the dates with startOfLocalDay(effective) and endOfLocalDay(retrieval)', async () => {
    open('endContract');
    fireEvent.click(screen.getByRole('button', { name: 'End contract' }));
    await waitFor(() => expect(platformApi.changeClubStatus).toHaveBeenCalled());
    const [change] = vi.mocked(platformApi.changeClubStatus).mock.calls[0];
    expect(change.dates?.effectiveAt).toEqual(startOfLocalDay(effective().value));
    expect(change.dates?.retrievalEndsAt).toEqual(endOfLocalDay(retrieval().value));
  });

  it('disables Confirm while saving so a double click sends one change', async () => {
    let finish: () => void = () => {};
    vi.mocked(platformApi.changeClubStatus).mockReturnValue(new Promise((r) => { finish = () => r(); }));
    open('deactivate');
    fireEvent.change(reasonBox(), { target: { value: 'Unpaid' } });
    const confirm = screen.getByRole('button', { name: 'Deactivate' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(confirm).toBeDisabled();
    expect(platformApi.changeClubStatus).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(notify).toHaveBeenCalled());
  });

  it('calls changeClubStatus with from, to, reason and dates, notifies and refreshes the row', async () => {
    const { club, onClose, onChanged } = open('deactivate', 'active', { name: 'Brussels VC' });
    fireEvent.change(reasonBox(), { target: { value: '  Unpaid  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(platformApi.changeClubStatus).toHaveBeenCalledWith(
      { clubId: club.id, from: 'active', to: 'suspended', reason: 'Unpaid' }, 'op@example.com');
    expect(notify).toHaveBeenCalledWith('Brussels VC is now Paused');
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ status: 'suspended', statusReason: 'Unpaid' }));
  });

  it('sends no dates and clears them in the row when reinstating', async () => {
    const { onChanged } = open('reinstate', 'terminating', {
      termination: { requestedAt: null, requestedBy: null, effectiveAt: Timestamp.fromDate(NOW), retrievalEndsAt: Timestamp.fromDate(NOW) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reinstate' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const [change] = vi.mocked(platformApi.changeClubStatus).mock.calls[0];
    expect(change.dates).toBeUndefined();
    expect(onChanged.mock.calls[0][0].termination).toEqual({ requestedAt: null, requestedBy: null, effectiveAt: null, retrievalEndsAt: null });
  });

  it('shows an inline error and keeps the dialog open when the change fails', async () => {
    vi.mocked(platformApi.changeClubStatus).mockRejectedValue(new Error('denied'));
    const { onClose, onChanged } = open('activate', 'pending');
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update the club. Please try again.');
    expect(onClose).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled();
  });
});
