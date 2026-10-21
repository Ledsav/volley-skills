import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileTab } from './ProfileTab';
import * as clubAdminApi from '../clubAdminApi';
import { useAuth } from '../../auth/AuthContext';
import { authValue, testClub } from '../../test/authValue';

const notify = vi.hoisted(() => vi.fn());
vi.mock('../clubAdminApi', async (orig) => ({ ...(await orig<typeof import('../clubAdminApi')>()), updateClubProfile: vi.fn() }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../components/Notice', () => ({ useNotify: () => notify }));
vi.mock('../../firebase/config', () => ({ db: {} }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ name: 'Test Club', country: 'BE', locale: 'it', aiEnabled: false, growthTestsEnabled: true }) }));
  vi.mocked(clubAdminApi.updateClubProfile).mockResolvedValue(undefined);
});

describe('ProfileTab', () => {
  it('prefills the form from the active club', () => {
    render(<ProfileTab />);
    expect(screen.getByLabelText('Club name')).toHaveValue('Test Club');
    expect(screen.getByLabelText('Country')).toHaveValue('BE');
    expect(screen.getByLabelText('Language')).toHaveValue('it');
    expect(screen.getByRole('checkbox', { name: /AI features/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Growth tests/ })).toBeChecked();
  });

  it("saves the profile and notifies 'Club details saved'", async () => {
    render(<ProfileTab />);
    fireEvent.change(screen.getByLabelText('Club name'), { target: { value: '  New Name ' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /AI features/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(clubAdminApi.updateClubProfile).toHaveBeenCalledWith({
      name: 'New Name', country: 'BE', locale: 'it', aiEnabled: true, referenceOptOut: false, growthTestsEnabled: true,
    }));
    expect(notify).toHaveBeenCalledWith('Club details saved');
  });

  it('refuses a name under 2 characters inline without saving', () => {
    render(<ProfileTab />);
    fireEvent.change(screen.getByLabelText('Club name'), { target: { value: ' A ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/2 and 80/);
    expect(clubAdminApi.updateClubProfile).not.toHaveBeenCalled();
  });

  it('explains AI and growth tests next to their switches', () => {
    render(<ProfileTab />);
    expect(screen.getByText('Lets your staff use AI drafting and text scouting with their own provider key. Off by default.')).toBeInTheDocument();
    expect(screen.getByText('Height and body mass may be health data. Only switch on if your club has a lawful basis to record them.')).toBeInTheDocument();
  });

  it('shows an inline error when saving fails', async () => {
    vi.mocked(clubAdminApi.updateClubProfile).mockRejectedValue(new Error('x'));
    render(<ProfileTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i);
  });

  it('saves referenceOptOut when the customer switch is toggled', async () => {
    render(<ProfileTab />);
    fireEvent.click(screen.getByRole('checkbox', { name: "Don't name our club as a customer" }));
    expect(screen.getByText("We won't list your club as a reference customer.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(clubAdminApi.updateClubProfile).toHaveBeenCalledWith(
      expect.objectContaining({ referenceOptOut: true })));
  });

  it('is read-only when restricted', () => {
    render(<ProfileTab restricted />);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Club name')).toBeDisabled();
    expect(screen.getByLabelText('Country')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /AI features/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /customer/ })).toBeDisabled();
  });
});
