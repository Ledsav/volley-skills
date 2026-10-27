import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfileTab } from './ProfileTab';
import { useAuth } from '../../auth/AuthContext';
import { authValue, testClub } from '../../test/authValue';

vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../components/Notice', () => ({ useNotify: () => vi.fn() }));
vi.mock('../../firebase/config', () => ({ db: {} }));
vi.mock('../../i18n/locales', async (orig) => ({ ...(await orig<typeof import('../../i18n/locales')>()), ITALIAN_ENABLED: true }));

describe('ProfileTab with Italian enabled', () => {
  it('offers Italiano', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ locale: 'en' }) }));
    render(<ProfileTab />);
    expect(screen.getByRole('option', { name: 'Italiano' })).toBeInTheDocument();
  });
});
