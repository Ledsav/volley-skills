import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SignupPage } from './SignupPage';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';

vi.mock('../auth/AuthContext');
vi.mock('../firebase/signOut', () => ({ signOutAndClearLocalData: vi.fn() }));
vi.mock('../auth/reauth', () => ({ sendSigningLink: vi.fn() }));
vi.mock('../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../i18n/locales')>()), ITALIAN_ENABLED: true }));

describe('SignupPage with Italian enabled', () => {
  it('offers Italiano as the club language', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ memberships: [], activeClubId: null, club: null }));
    render(<MemoryRouter><SignupPage /></MemoryRouter>);
    expect(screen.getByRole('option', { name: 'Italiano' })).toBeInTheDocument();
  });
});
